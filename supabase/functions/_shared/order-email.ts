// "We've received your order" email, sent once when an order is first marked paid.
// Uses Resend (the same provider Supabase Auth sends from). Needs the Edge Function
// secret RESEND_API_KEY; without it the email is skipped and payment carries on as normal.
// deno-lint-ignore no-explicit-any
type Sql = any;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "U Angel Foods <noreply@uangelfoods.com>";
const REPLY_TO = "uangelfoods@gmail.com";

const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const naira = (n: unknown) =>
    "₦" + Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const dayLabel = (d: string | null) => {
    if (!d) return "";
    const date = new Date(`${d}T12:00:00Z`);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
};

type Item = {
    name: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    customizations: { name: string; text?: string; type?: string }[];
    delivery_day: string | null;
};

export const sendOrderReceivedEmail = async (sql: Sql, reference: string) => {
    if (!RESEND_API_KEY) {
        console.log("order email skipped: RESEND_API_KEY not set");
        return;
    }

    const [order] = await sql`
        select o.id, o.subtotal, o.delivery_fee, o.total, o.online_amount, o.balance_due, o.payment_method,
               o.delivery_address, o.city, o.state, o.phone, o.note,
               coalesce(u.email, p.email) as email, p.name
          from public.orders o
          left join auth.users u on u.id = o.user_id
          left join public.profiles p on p.id = o.user_id
         where o.paystack_reference = ${reference}
         limit 1`;
    if (!order?.email) return;

    const items = (await sql`
        select name, quantity, unit_price, line_total, customizations, delivery_day::text as delivery_day
          from public.order_items where order_id = ${order.id} order by name`) as unknown as Item[];

    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const firstName = String(order.name ?? "").trim().split(/\s+/)[0];
    const payOnDelivery = Number(order.balance_due ?? 0) > 0;

    const itemRows = items.map((i) => {
        const extras = (i.customizations ?? [])
            .map((c) => (c.text ? `${c.name}: “${c.text}”` : c.name))
            .filter(Boolean);
        const sub = [
            extras.length ? esc(extras.join(", ")) : "",
            i.delivery_day ? `Delivery: ${esc(dayLabel(i.delivery_day))}` : "",
        ].filter(Boolean).join("<br>");
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #F0E6E0;vertical-align:top">
              <div style="font-weight:700;color:#1F2A44">${esc(i.name)}</div>
              ${sub ? `<div style="font-size:13px;color:#6B7280;margin-top:2px">${sub}</div>` : ""}
              <div style="font-size:13px;color:#6B7280;margin-top:2px">${i.quantity} × ${naira(i.unit_price)}</div>
            </td>
            <td style="padding:10px 0;border-bottom:1px solid #F0E6E0;text-align:right;vertical-align:top;font-weight:700;color:#1F2A44;white-space:nowrap">${naira(i.line_total)}</td>
          </tr>`;
    }).join("");

    const line = (label: string, value: string, strong = false) => `
          <tr>
            <td style="padding:4px 0;color:${strong ? "#1F2A44" : "#6B7280"};${strong ? "font-weight:700;font-size:16px" : ""}">${label}</td>
            <td style="padding:4px 0;text-align:right;color:#1F2A44;${strong ? "font-weight:700;font-size:16px" : ""}">${value}</td>
          </tr>`;

    const totals = [
        line("Subtotal", naira(order.subtotal)),
        line("Delivery", naira(order.delivery_fee)),
        line("Total", naira(order.total), true),
        ...(payOnDelivery
            ? [line("Paid now", naira(order.online_amount)), line("To pay on delivery", naira(order.balance_due), true)]
            : [line("Paid", naira(order.total))]),
    ].join("");

    const address = [order.delivery_address, order.city, order.state].filter(Boolean).map(esc).join(", ");

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#FFF3EC;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3EC;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
        <tr><td style="background:#FD652A;padding:24px;text-align:center">
          <img src="https://uangelfoods.com/assets/uangel-logo-white.png" alt="U Angel Foods" width="96" style="display:inline-block;width:96px;height:auto">
        </td></tr>
        <tr><td style="padding:28px 24px 8px">
          <h1 style="margin:0 0 8px;font-size:22px;color:#1F2A44">We've received your order${firstName ? `, ${esc(firstName)}` : ""}!</h1>
          <p style="margin:0;font-size:15px;line-height:22px;color:#4B5563">
            Thank you for shopping with U Angel Foods. Your payment went through and your order
            <strong>#${shortId}</strong> is with us. We'll get it ready and keep you updated in the app.
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${itemRows}</table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-top:10px">${totals}</table>
        </td></tr>
        <tr><td style="padding:20px 24px 0">
          <div style="background:#FFF3EC;border-radius:12px;padding:14px 16px;font-size:14px;line-height:21px;color:#1F2A44">
            <div style="font-weight:700;margin-bottom:4px">Delivering to</div>
            ${address}<br>${esc(order.phone)}
            ${order.note ? `<div style="margin-top:6px;color:#6B7280">Note: ${esc(order.note)}</div>` : ""}
          </div>
        </td></tr>
        <tr><td style="padding:22px 24px 28px;font-size:13px;line-height:20px;color:#6B7280">
          Questions about your order? Reply to this email or call <a href="tel:+2347049055555" style="color:#C43E0E">0704 905 5555</a>.
        </td></tr>
      </table>
      <p style="font-size:12px;color:#9CA3AF;margin:16px 0 0">U Angel Foods · <a href="https://uangelfoods.com" style="color:#9CA3AF">uangelfoods.com</a></p>
    </td></tr>
  </table>
</body></html>`;

    const text = [
        `We've received your order${firstName ? `, ${firstName}` : ""}!`,
        ``,
        `Order #${shortId}`,
        ...items.map((i) => `${i.quantity} × ${i.name}  ${naira(i.line_total)}`),
        ``,
        `Total: ${naira(order.total)}`,
        payOnDelivery ? `Paid now: ${naira(order.online_amount)}. To pay on delivery: ${naira(order.balance_due)}` : `Paid: ${naira(order.total)}`,
        ``,
        `Delivering to: ${[order.delivery_address, order.city, order.state].filter(Boolean).join(", ")}, ${order.phone}`,
        ``,
        `Questions? Reply to this email or call 0704 905 5555.`,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: FROM,
            to: [order.email],
            reply_to: REPLY_TO,
            subject: `We've received your order #${shortId}`,
            html,
            text,
        }),
    });
    if (!res.ok) console.error("order email failed", res.status, await res.text());
};
