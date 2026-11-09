// Shared helpers for the Paystack Edge Functions.
// Privileged DB access uses SUPABASE_DB_URL (injected into every Edge Function), so the
// functions work whether or not the project's legacy service_role key is enabled.
import postgres from "npm:postgres@3.4.5";

/** Key for Paystack API calls (secret sk_… or a restricted rk_… key with transaction permissions). */
export const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

/**
 * Keys that may have signed a webhook. Paystack signs webhooks with the account's main
 * SECRET key (sk_…), so when PAYSTACK_SECRET_KEY is a restricted key, set
 * PAYSTACK_WEBHOOK_SECRET to the sk_… key. Both are accepted.
 */
export const PAYSTACK_WEBHOOK_KEYS = [Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ?? "", PAYSTACK_SECRET_KEY]
    .filter((k, i, all) => k && all.indexOf(k) === i);

export const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

export const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/**
 * The signed-in user from the request's JWT. The function is deployed with JWT
 * verification ON, so the Supabase gateway has already checked the signature;
 * here we only read the claims.
 */
export const userFromRequest = (req: Request): { id: string; email: string | null } | null => {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const part = token.split(".")[1];
    if (!part) return null;
    try {
        const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
        if (!payload.sub || payload.role !== "authenticated") return null;
        return { id: payload.sub, email: payload.email ?? null };
    } catch {
        return null;
    }
};

export const paystack = async (path: string, init: RequestInit = {}) => {
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not set on the project");
    const res = await fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === false) throw new Error(body.message ?? `Paystack error ${res.status}`);
    return body;
};

/** Verify a transaction with Paystack and, if successful, mark the order paid. */
export const verifyAndMarkPaid = async (reference: string): Promise<"paid" | "already_paid" | "pending" | "failed"> => {
    const result = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    const tx = result.data;
    if (tx?.status !== "success") return tx?.status === "abandoned" || tx?.status === "ongoing" ? "pending" : "failed";
    if (tx.currency !== "NGN") throw new Error("Unexpected currency");
    const [row] = await sql`select public.mark_order_paid(${reference}, ${tx.amount}::bigint) as result`;
    return row.result;
};
