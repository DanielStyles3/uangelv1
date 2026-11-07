// Paystack webhook (set this URL in Paystack Dashboard → Settings → API Keys & Webhooks):
//   https://<project-ref>.supabase.co/functions/v1/paystack-webhook
// Deployed WITHOUT JWT verification; authenticity is checked with Paystack's
// HMAC-SHA512 signature of the raw body using the secret key.
import { PAYSTACK_SECRET_KEY, verifyAndMarkPaid } from "../_shared/paystack.ts";

const hmacSha512Hex = async (key: string, body: string) => {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const raw = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    if (!PAYSTACK_SECRET_KEY || signature !== (await hmacSha512Hex(PAYSTACK_SECRET_KEY, raw))) {
        return new Response("Invalid signature", { status: 401 });
    }

    try {
        const event = JSON.parse(raw);
        if (event.event === "charge.success" && event.data?.reference) {
            // Re-verify with Paystack's API rather than trusting the payload alone.
            await verifyAndMarkPaid(event.data.reference);
        }
    } catch (e) {
        console.error("webhook error", e);
        // Still 200 so Paystack doesn't retry forever on an unknown reference.
    }
    return new Response("ok", { status: 200 });
});
