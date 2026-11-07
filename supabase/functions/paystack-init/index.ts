// Starts a Paystack payment for one of the signed-in user's unpaid orders.
// POST { order_id, callback_url }  →  { authorization_url, reference }
// The amount comes from the database (never from the app).
import { cors, json, paystack, sql, userFromRequest } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const user = userFromRequest(req);
        if (!user) return json({ error: "Not signed in" }, 401);

        const { order_id, callback_url } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        const [order] = await sql`
            select o.id, o.total, o.status, o.payment_status, coalesce(u.email, ${user.email}) as email
              from public.orders o join auth.users u on u.id = o.user_id
             where o.id = ${order_id} and o.user_id = ${user.id}`;
        if (!order) return json({ error: "Order not found" }, 404);
        if (order.payment_status === "paid") return json({ error: "This order is already paid" }, 409);
        if (order.status !== "awaiting_payment") return json({ error: "This order can't be paid" }, 409);

        const reference = `UAF-${String(order.id).slice(0, 8)}-${Date.now()}`;
        const init = await paystack("/transaction/initialize", {
            method: "POST",
            body: JSON.stringify({
                email: order.email,
                amount: Math.round(Number(order.total) * 100), // kobo
                currency: "NGN",
                reference,
                callback_url,
                channels: ["card", "bank_transfer", "ussd", "bank"],
                metadata: { order_id: order.id, user_id: user.id },
            }),
        });

        await sql`update public.orders set paystack_reference = ${reference} where id = ${order.id}`;
        return json({ authorization_url: init.data.authorization_url, reference });
    } catch (e) {
        return json({ error: (e as Error).message }, 500);
    }
});
