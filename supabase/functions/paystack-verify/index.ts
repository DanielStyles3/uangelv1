// Called by the app after the Paystack checkout closes.
// POST { reference }  →  { status: 'paid' | 'already_paid' | 'pending' | 'failed', order_id }
import { cors, json, sql, userFromRequest, verifyAndMarkPaid } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const user = userFromRequest(req);
        if (!user) return json({ error: "Not signed in" }, 401);

        const { reference } = await req.json();
        if (!reference) return json({ error: "reference is required" }, 400);

        const [order] = await sql`
            select id from public.orders where paystack_reference = ${reference} and user_id = ${user.id}`;
        if (!order) return json({ error: "Payment not found" }, 404);

        const status = await verifyAndMarkPaid(reference);
        return json({ status, order_id: order.id });
    } catch (e) {
        return json({ error: (e as Error).message }, 500);
    }
});
