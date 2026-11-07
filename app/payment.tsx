import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { verifyPayment } from "@/lib/api";

/**
 * Landing route for the Paystack return link (fastfood://payment?reference=…).
 * Normally the in-app browser catches that link itself; this screen only shows up if
 * the phone opens the link as a fresh deep link. It verifies the payment and moves on.
 */
export default function PaymentReturn() {
    const { reference } = useLocalSearchParams<{ reference?: string }>();

    useEffect(() => {
        const go = async () => {
            if (!reference) return router.replace('/orders');
            try {
                const { order_id } = await verifyPayment(reference);
                router.replace({ pathname: '/orders/[id]', params: { id: order_id } });
            } catch {
                router.replace('/orders');
            }
        };
        go();
    }, [reference]);

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#fff' }}>
            <ActivityIndicator color="#FE8C00" size="large" />
            <Text style={{ fontFamily: 'Quicksand-SemiBold', color: '#181C2E' }}>Confirming your payment…</Text>
        </View>
    );
}
