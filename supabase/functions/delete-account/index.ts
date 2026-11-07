// Permanently deletes the signed-in user's account (App Store / Play requirement).
// POST {}  →  { deleted: true }
// Deleting the auth user cascades to their profile and service requests; their orders
// are kept for the business's records but unlinked (user_id set to null).
import { cors, json, sql, userFromRequest } from "../_shared/paystack.ts";

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
        const user = userFromRequest(req);
        if (!user) return json({ error: "Not signed in" }, 401);

        const result = await sql`delete from auth.users where id = ${user.id}`;
        if (result.count === 0) return json({ error: "Account not found" }, 404);
        return json({ deleted: true });
    } catch (e) {
        return json({ error: (e as Error).message }, 500);
    }
});
