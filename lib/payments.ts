import { router } from "expo-router";

/**
 * Opens Paystack checkout for an 'awaiting_payment' order inside the app (app/pay.tsx).
 * The pay screen creates the transaction (paystack-init), shows Paystack in a WebView,
 * intercepts the success redirect, verifies with the server (paystack-verify) and then
 * replaces itself with the order page — so the customer is back in the app instantly.
 * (paystack-webhook also marks the order paid server-side as a safety net.)
 *
 * mode 'replace' (default): swap the current screen (checkout / order page) for the pay
 *   screen, so the back stack stays clean when it later swaps itself for the order page.
 * mode 'push': keep the current screen underneath (e.g. the My orders list).
 */
export const openPayment = (orderId: string, mode: 'replace' | 'push' = 'replace') => {
    const target = { pathname: '/pay' as const, params: { orderId } };
    if (mode === 'push') router.push(target);
    else router.replace(target);
};
