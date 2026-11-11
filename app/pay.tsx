import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView, WebViewNavigation } from "react-native-webview";

import { startPayment, verifyPayment } from "@/lib/api";
import { notify } from "@/lib/notice";
import { useCartStore } from "@/store/cart.store";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
// Paystack redirects here after a successful payment; we intercept it inside the WebView
// (the page itself is never shown), so the customer lands back in the app instantly.
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/paystack-callback`;
// Paystack navigates here when the customer taps "Cancel" on the checkout page.
const PAYSTACK_CLOSE = "https://standard.paystack.co/close";
const POLL_MS = 5000;

type Outcome = "paid" | "pending" | "failed" | "cancelled";

/**
 * Paystack checkout inside the app (WebView). Opens with ?orderId=… and, as soon as the
 * payment succeeds, closes itself and replaces this screen with the order page.
 */
export default function PayScreen() {
    const { orderId, from } = useLocalSearchParams<{ orderId: string; from?: string }>();
    const fromCheckout = from === 'checkout';
    const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [finishing, setFinishing] = useState(false);
    const reference = useRef<string | null>(null);
    const done = useRef(false);

    const goToOrder = useCallback((outcome: Outcome) => {
        if (fromCheckout) {
            if (outcome === 'paid') {
                // Paid: the cart has become this order. Leave checkout behind and show the order.
                useCartStore.getState().clearCart();
                if (router.canDismiss()) router.dismissAll();
                router.push({ pathname: '/orders/[id]', params: { id: orderId, placed: '1', payment: 'paid' } });
            } else {
                // Not paid: back to Checkout with the cart exactly as it was.
                if (router.canGoBack()) router.back(); else router.replace('/cart');
                setTimeout(() => notify(
                    outcome === 'pending' ? 'Payment still processing' : 'Payment not completed',
                    outcome === 'pending'
                        ? 'If money left your account we’ll confirm the order automatically. Your cart is still here.'
                        : 'Nothing was charged. Your cart is still here, so you can change it, try again or save it for later.',
                ), 350);
            }
            return;
        }
        if (!orderId) return router.replace('/orders');
        router.replace({
            pathname: '/orders/[id]',
            params: { id: orderId, placed: outcome === 'paid' ? '1' : undefined, payment: outcome },
        });
    }, [orderId, fromCheckout]);

    /** Ask the server (which asks Paystack) for the truth, then leave. */
    const finish = useCallback(async (hint: Outcome) => {
        if (done.current) return;
        done.current = true;
        setFinishing(true);
        let outcome: Outcome = hint;
        try {
            if (reference.current) {
                const { status } = await verifyPayment(reference.current);
                outcome = status === 'paid' || status === 'already_paid' ? 'paid'
                    : status === 'pending' ? (hint === 'cancelled' ? 'cancelled' : 'pending')
                    : 'failed';
            }
        } catch {
            // Network hiccup: the order page will show the real state (and the webhook still marks it paid).
        }
        goToOrder(outcome);
    }, [goToOrder]);

    // 1) Create the Paystack transaction for this order.
    useEffect(() => {
        if (!orderId) return;
        startPayment(orderId, CALLBACK_URL)
            .then(({ authorization_url, reference: ref }) => {
                reference.current = ref;
                setCheckoutUrl(authorization_url);
            })
            .catch((e: Error) => setError(e.message));
    }, [orderId]);

    // 2) Backup: quietly check every few seconds, so a payment confirmed in the background
    //    (e.g. bank transfer) also jumps straight back into the app.
    useEffect(() => {
        if (!checkoutUrl) return;
        const timer = setInterval(async () => {
            if (done.current || !reference.current) return;
            try {
                const { status } = await verifyPayment(reference.current);
                if (status === 'paid' || status === 'already_paid') finish('paid');
            } catch {}
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [checkoutUrl, finish]);

    // 3) Intercept Paystack's redirects before they load.
    const intercept = (url: string): boolean => {
        // Paystack's "Cancel Payment" goes to our callback with ?cancelled=1 (cancel_action in paystack-init).
        if (url.startsWith(CALLBACK_URL) && /[?&]cancelled=1/.test(url)) { finish('cancelled'); return true; }
        if (url.startsWith(CALLBACK_URL)) { finish('paid'); return true; }
        if (url.startsWith(PAYSTACK_CLOSE)) { finish('cancelled'); return true; }
        return false;
    };

    const confirmClose = useCallback(() =>
        notify('Leave payment?', fromCheckout
            ? "If you've already paid, we'll confirm it. Otherwise you'll go back to checkout and your cart stays as it is."
            : "If you've already paid, we'll confirm it. Otherwise you can pay later from your order.", [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => finish('cancelled') },
        ]), [fromCheckout, finish]);

    // Android back button: same as the close button (ask, then check the payment), never a silent exit.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!done.current) confirmClose();
            return true;
        });
        return () => sub.remove();
    }, [confirmClose]);

    return (
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
            {/* No swipe-back on iPhone: leaving goes through confirmClose so the payment is checked. */}
            <Stack.Screen options={{ gestureEnabled: false }} />
            <View style={styles.bar}>
                <TouchableOpacity onPress={confirmClose} hitSlop={12} accessibilityLabel="Close payment">
                    <Ionicons name="close" size={24} color="#181C2E" />
                </TouchableOpacity>
                <View style={styles.barTitle}>
                    <Ionicons name="lock-closed" size={14} color="#2F9B65" />
                    <Text style={styles.barText}>Secure payment · Paystack</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            {error ? (
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={44} color="#F14141" />
                    <Text style={styles.errorTitle}>Couldn&apos;t start payment</Text>
                    <Text style={styles.errorBody}>{error}</Text>
                    <TouchableOpacity style={styles.btn} onPress={() => goToOrder('cancelled')}>
                        <Text style={styles.btnText}>{fromCheckout ? 'Back to checkout' : 'Back to my order'}</Text>
                    </TouchableOpacity>
                </View>
            ) : !checkoutUrl ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#FD652A" size="large" />
                    <Text style={styles.loadingText}>Opening secure checkout…</Text>
                </View>
            ) : (
                <WebView
                    source={{ uri: checkoutUrl }}
                    style={{ flex: 1 }}
                    startInLoadingState
                    renderLoading={() => (
                        <View style={[StyleSheet.absoluteFill, styles.center]}>
                            <ActivityIndicator color="#FD652A" size="large" />
                        </View>
                    )}
                    onShouldStartLoadWithRequest={(req): boolean => !intercept(req.url)}
                    onNavigationStateChange={(nav: WebViewNavigation): void => { intercept(nav.url); }}
                    javaScriptEnabled
                    domStorageEnabled
                    setSupportMultipleWindows={false}
                />
            )}

            {finishing && (
                <View style={[StyleSheet.absoluteFill, styles.overlay]}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={styles.overlayText}>Confirming your payment…</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff' },
    bar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6E6EA',
    },
    barTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barText: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#181C2E' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: '#fff' },
    loadingText: { fontFamily: 'Quicksand-SemiBold', fontSize: 14, color: '#878787', marginTop: 6 },
    errorTitle: { fontFamily: 'Quicksand-Bold', fontSize: 18, color: '#181C2E' },
    errorBody: { fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#878787', textAlign: 'center' },
    btn: { marginTop: 12, backgroundColor: '#FD652A', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14 },
    btnText: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#fff' },
    overlay: { backgroundColor: 'rgba(24,28,46,0.75)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    overlayText: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#fff' },
});
