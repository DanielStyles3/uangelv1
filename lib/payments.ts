import { router } from "expo-router";

/**
 * Opens Paystack checkout for an 'awaiting_payment' order inside the app (app/pay.tsx).
 * The pay screen creates the transaction (paystack-init), shows Paystack in a WebView,
 * intercepts the success redirect, verifies with the server (paystack-verify) and then
 * shows the order page. (paystack-webhook also marks the order paid server-side as a safety net.)
 *
 * mode 'replace' (default): swap the current screen (e.g. the order page) for the pay screen.
 * mode 'push': keep the current screen underneath (checkout, the My orders list).
 * from 'checkout': if the customer leaves without paying they go back to Checkout with their
 *   cart untouched; once paid the cart is cleared.
 */
export const openPayment = (orderId: string, mode: 'replace' | 'push' = 'replace', from?: 'checkout') => {
    const target = { pathname: '/pay' as const, params: from ? { orderId, from } : { orderId } };
    if (mode === 'push') router.push(target);
    else router.replace(target);
};
