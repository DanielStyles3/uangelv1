// Paystack redirects the browser here after checkout (?reference=...&trxref=...).
// We immediately 302-redirect back into the app (Supabase serves function responses as
// text/plain, so an HTML page wouldn't render — a redirect always works). The app's
// in-app browser session closes on that deep link and the app verifies the payment.
// Only app deep links (fastfood:// or exp://) are allowed as return_to.
Deno.serve((req) => {
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";
    const returnTo = url.searchParams.get("return_to") ?? "fastfood://payment";
    const safe = /^(fastfood|exp|exps):\/\//i.test(returnTo) ? returnTo : "fastfood://payment";
    const target = `${safe}${safe.includes("?") ? "&" : "?"}reference=${encodeURIComponent(reference)}`;

    return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
});
