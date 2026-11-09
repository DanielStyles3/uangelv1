// Starts a Paystack payment for one of the signed-in user's unpaid orders.
// POST { order_id, callback_url }  →  { authorization_url, reference }
// The amount comes from the database (never from the app): orders.online_amount, i.e. the
// total, or only the delivery fee for pay-on-delivery orders (null on old orders = total).
import { cors, json, paystack, sql, userFromRequest } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const user = userFromRequest(req);
        if (!user) return json({ error: "Not signed in" }, 401);

        const { order_id, callback_url } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        const [order] = await sql`
            select o.id, coalesce(o.online_amount, o.total) as amount_due, o.status, o.payment_status, coalesce(u.email, ${user.email}) as email
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
                amount: Math.round(Number(order.amount_due) * 100), // kobo
                currency: "NGN",
                reference,
                callback_url,
                // No `channels` list: Paystack offers every payment method enabled on the account
                // (card, bank transfer, USSD, Pay with Bank, QR, …). Manage them in the Paystack
                // dashboard → Settings → Preferences → Payment channels.
                metadata: { order_id: order.id, user_id: user.id },
            }),
        });

        // Keep every reference (not just the latest): a payment started on an earlier
        // attempt (e.g. a slow bank transfer) must still be matched to this order.
        await sql.begin(async (tx) => {
            await tx`insert into public.payment_attempts (reference, order_id) values (${reference}, ${order.id})`;
            await tx`update public.orders set paystack_reference = ${reference} where id = ${order.id}`;
        });
        return json({ authorization_url: init.data.authorization_url, reference });
    } catch (e) {
        return json({ error: (e as Error).message }, 500);
    }
});
