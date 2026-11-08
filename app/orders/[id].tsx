import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    Easing, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from "react-native-reanimated";

import CustomHeader from "@/components/CustomHeader";
import ProductImage from "@/components/ProductImage";
import useFetch from "@/lib/useFetch";
import { cancelOrder, getOrder } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { openPayment } from "@/lib/payments";
import { formatDateTime, formatNaira, formatNigerianPhone } from "@/lib/format";
import { useCartStore } from "@/store/cart.store";
import { Order, OrderStatus } from "@/type";

type IconName = keyof typeof Ionicons.glyphMap;

// Hero card copy + colours per status.
const STATUS: Record<OrderStatus, { title: string; body: string; icon: IconName; color: string; tint: string }> = {
    awaiting_payment: { title: 'Awaiting payment', body: 'Complete payment with Paystack to confirm your order.', icon: 'card', color: '#C2410C', tint: '#FFF1E6' },
    pending:          { title: 'Order received', body: "Payment confirmed. We'll confirm your order shortly.", icon: 'receipt', color: '#B45309', tint: '#FEF6E4' },
    confirmed:        { title: 'Order confirmed', body: 'Your order has been accepted and is queued for the kitchen.', icon: 'checkmark-done', color: '#1D4ED8', tint: '#EAF1FF' },
    preparing:        { title: 'Preparing your order', body: 'Our team is getting everything ready for you.', icon: 'restaurant', color: '#EA580C', tint: '#FFF1E6' },
    on_the_way:       { title: 'On the way', body: 'Your order is out for delivery. Keep your phone close.', icon: 'bicycle', color: '#4338CA', tint: '#EEEDFF' },
    delivered:        { title: 'Delivered', body: 'Enjoy! Thank you for choosing U Angel Foods: U Are An Angel.', icon: 'checkmark-circle', color: '#15803D', tint: '#E9F7EF' },
    cancelled:        { title: 'Order cancelled', body: 'This order was cancelled.', icon: 'close-circle', color: '#B91C1C', tint: '#FDECEC' },
};

const STEPS: { key: OrderStatus; label: string; icon: IconName }[] = [
    { key: 'pending',    label: 'Received',   icon: 'receipt-outline' },
    { key: 'confirmed',  label: 'Confirmed',  icon: 'checkmark-done-outline' },
    { key: 'preparing',  label: 'Preparing',  icon: 'restaurant-outline' },
    { key: 'on_the_way', label: 'On the way', icon: 'bicycle-outline' },
    { key: 'delivered',  label: 'Delivered',  icon: 'home-outline' },
];

const ACTIVE: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'on_the_way'];

/** Pulsing ring behind the hero icon while the order is in progress. */
const PulseIcon = ({ icon, color, active }: { icon: IconName; color: string; active: boolean }) => {
    const pulse = useSharedValue(0);
    useEffect(() => {
        pulse.value = active
            ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)
            : 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);
    const ring = useAnimatedStyle(() => ({ opacity: active ? (1 - pulse.value) * 0.45 : 0, transform: [{ scale: 1 + pulse.value * 0.7 }] }));
    return (
        <View style={styles.heroIconWrap}>
            <Animated.View style={[styles.heroRing, { backgroundColor: color }, ring]} />
            <View style={[styles.heroIcon, { backgroundColor: color }]}>
                <Ionicons name={icon} size={28} color="#fff" />
            </View>
        </View>
    );
};

/** Horizontal 5-step tracker with an animated progress fill. */
const Tracker = ({ order }: { order: Order }) => {
    const current = Math.max(0, STEPS.findIndex((s) => s.key === order.status));
    const [width, setWidth] = useState(0);
    const fill = useSharedValue(0);
    useEffect(() => {
        fill.value = withTiming(current / (STEPS.length - 1), { duration: 900, easing: Easing.out(Easing.cubic) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current]);
    const fillStyle = useAnimatedStyle(() => ({ width: fill.value * width }));

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Order progress</Text>
            <View style={styles.trackWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 36)}>
                <View style={styles.trackLine} />
                <Animated.View style={[styles.trackFill, fillStyle]} />
                <View style={styles.trackSteps}>
                    {STEPS.map((step, i) => {
                        const done = i <= current;
                        const isCurrent = i === current;
                        return (
                            <View key={step.key} style={styles.step}>
                                <View style={[styles.stepDot, done && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                                    <Ionicons name={step.icon} size={16} color={done ? '#fff' : '#B8B8C0'} />
                                </View>
                                <Text style={[styles.stepLabel, done && styles.stepLabelDone]} numberOfLines={1}>{step.label}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
            {order.paid_at && (
                <Text style={styles.trackNote}>Paid {formatDateTime(order.paid_at)}</Text>
            )}
        </View>
    );
};

const Row = ({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) => (
    <View style={styles.row}>
        <Text style={bold ? styles.rowLabelBold : styles.rowLabel}>{label}</Text>
        <Text style={[bold ? styles.rowValueBold : styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
);

export default function OrderDetails() {
    const { id, placed, payment } = useLocalSearchParams<{ id: string; placed?: string; payment?: string }>();
    const { data: order, loading, refetch } = useFetch({ fn: getOrder, params: { id } });
    const { addItem } = useCartStore();
    const [isCancelling, setIsCancelling] = useState(false);

    // Refresh when coming back to this screen…
    useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    // …and live: when the admin moves the order along, this screen updates instantly.
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`order-${id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => { refetch(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (loading && !order) {
        return (
            <SafeAreaView style={[styles.screen, styles.center]}>
                <ActivityIndicator color="#FE8C00" size="large" />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={[styles.screen, styles.center, { padding: 24, gap: 14 }]}>
                <Ionicons name="receipt-outline" size={44} color="#C4C4CC" />
                <Text style={styles.cardTitle}>Order not found</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/orders')}>
                    <Text style={styles.primaryBtnText}>Back to my orders</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const status = STATUS[order.status] ?? STATUS.pending;
    const isPaid = order.payment_status === 'paid';
    const awaitingPayment = order.status === 'awaiting_payment' && !isPaid;
    const inProgress = ACTIVE.includes(order.status);
    const items = order.order_items ?? [];
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);
    const shortId = order.id.slice(0, 8).toUpperCase();
    // Pay on delivery: only the delivery fee goes through Paystack; the rider collects the rest.
    const isPod = order.payment_method === 'pay_on_delivery';
    const onlineAmount = Number(order.online_amount ?? order.total);
    const balanceDue = Number(order.balance_due ?? 0);
    const balanceCollected = !!order.balance_collected_at;

    const orderAgain = () => {
        let added = 0;
        for (const item of items) {
            if (!item.menu_id) continue; // product no longer exists
            const extras = item.customizations.reduce((s, c) => s + Number(c.price), 0);
            addItem({
                id: item.menu_id,
                name: item.name,
                price: Number(item.unit_price) - extras,
                image_url: item.image_url,
                // Keeps cake choices too (size, flavour) and typed answers (the message on the cake).
                customizations: item.customizations.map((c) => ({ id: c.id, name: c.name, price: Number(c.price), type: c.type, ...(c.text ? { text: c.text } : {}) })),
            }, item.quantity);
            added++;
        }
        if (added === 0) return Alert.alert('Order again', "These items aren't available anymore.");
        router.push('/cart');
    };

    const shareReceipt = () => {
        const lines = [
            `U Angel Foods: order #${shortId}`,
            formatDateTime(order.created_at),
            '',
            ...items.map((i) => `${i.quantity}× ${i.name}  ${formatNaira(i.line_total)}`),
            '',
            `Subtotal ${formatNaira(order.subtotal)}`,
            `Delivery ${formatNaira(order.delivery_fee)}`,
            `Total ${formatNaira(order.total)} (${isPod
                ? `${isPaid ? 'Paid' : 'To pay'} online ${formatNaira(onlineAmount)} · ${balanceCollected ? 'Paid' : 'Pay'} ${formatNaira(balanceDue)} to the rider on delivery`
                : isPaid ? 'Paid with Paystack' : 'Not paid'})`,
            order.paystack_reference ? `Ref: ${order.paystack_reference}` : '',
        ].filter((l) => l !== null);
        Share.share({ message: lines.join('\n') }).catch(() => {});
    };

    const confirmCancel = () => {
        Alert.alert('Cancel order', 'Cancel this unpaid order?', [
            { text: 'Keep order', style: 'cancel' },
            {
                text: 'Cancel order',
                style: 'destructive',
                onPress: async () => {
                    setIsCancelling(true);
                    try {
                        await cancelOrder(order.id);
                        await refetch();
                    } catch (e: any) {
                        Alert.alert('Error', e.message);
                    } finally {
                        setIsCancelling(false);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <CustomHeader title={`Order #${shortId}`} showSearch={false} />

                {/* Just paid */}
                {placed === '1' && isPaid && (
                    <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.successBanner}>
                        <View style={styles.successIcon}>
                            <Ionicons name="checkmark" size={26} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.successTitle}>Payment successful!</Text>
                            <Text style={styles.successBody}>Thank you. Every order helps feed someone in need. 🧡</Text>
                        </View>
                    </Animated.View>
                )}

                {/* Status hero */}
                <Animated.View entering={FadeInDown.delay(60)} style={[styles.hero, { backgroundColor: status.tint, borderColor: `${status.color}33` }]}>
                    <PulseIcon icon={status.icon} color={status.color} active={inProgress} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.heroTitle, { color: status.color }]}>
                            {awaitingPayment && payment === 'pending' ? 'Payment processing' : status.title}
                        </Text>
                        <Text style={styles.heroBody}>
                            {awaitingPayment && payment === 'pending'
                                ? "Paystack hasn't confirmed your payment yet. Bank transfers can take a few minutes."
                                : status.body}
                        </Text>
                        <Text style={styles.heroMeta}>Placed {formatDateTime(order.created_at)}</Text>
                    </View>
                </Animated.View>

                {awaitingPayment && (
                    <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 10 }}>
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => openPayment(order.id)} activeOpacity={0.85}>
                            <Ionicons name="lock-closed" size={16} color="#fff" />
                            <Text style={styles.primaryBtnText}>Pay {formatNaira(onlineAmount)}{isPod ? ' delivery' : ''} now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostBtn} onPress={confirmCancel} disabled={isCancelling} activeOpacity={0.7}>
                            {isCancelling ? <ActivityIndicator color="#F14141" /> : <Text style={styles.ghostBtnText}>Cancel order</Text>}
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {(inProgress || order.status === 'delivered') && (
                    <Animated.View entering={FadeInDown.delay(140)}>
                        <Tracker order={order} />
                    </Animated.View>
                )}

                {/* Items */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.card}>
                    <View style={styles.cardHead}>
                        <Text style={styles.cardTitle}>Items</Text>
                        <Text style={styles.cardMeta}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
                    </View>
                    {items.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < items.length - 1 && styles.divider]}>
                            <View style={styles.itemThumb}>
                                <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                {item.customizations.length > 0 && (
                                    <Text style={styles.itemExtras} numberOfLines={2}>+ {item.customizations.map((c) => c.name).join(', ')}</Text>
                                )}
                                <Text style={styles.itemQty}>{item.quantity} × {formatNaira(item.unit_price)}</Text>
                            </View>
                            <Text style={styles.itemTotal}>{formatNaira(item.line_total)}</Text>
                        </View>
                    ))}
                </Animated.View>

                {/* Receipt */}
                <Animated.View entering={FadeInDown.delay(260)} style={styles.card}>
                    <View style={styles.cardHead}>
                        <Text style={styles.cardTitle}>Payment</Text>
                        <TouchableOpacity onPress={shareReceipt} style={styles.shareBtn} hitSlop={8}>
                            <Ionicons name="share-outline" size={16} color="#FE8C00" />
                            <Text style={styles.shareText}>Share receipt</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ gap: 10 }}>
                        <Row label="Subtotal" value={formatNaira(order.subtotal)} />
                        <Row label="Delivery fee" value={formatNaira(order.delivery_fee)} />
                        <View style={styles.dashed} />
                        <Row label="Total" value={formatNaira(order.total)} bold />
                        {isPod && (
                            <>
                                <Row label={isPaid ? 'Paid online (delivery)' : 'Pay online now (delivery)'} value={formatNaira(onlineAmount)} />
                                <Row
                                    label={balanceCollected ? 'Paid to the rider' : 'Pay the rider on delivery'}
                                    value={formatNaira(balanceDue)}
                                    valueColor={balanceCollected ? '#2F9B65' : '#C2410C'}
                                />
                            </>
                        )}
                    </View>
                    <View style={[styles.payPill, { backgroundColor: isPaid ? '#E9F7EF' : '#FFF1E6' }]}>
                        <Ionicons name={isPaid ? 'shield-checkmark' : 'time-outline'} size={16} color={isPaid ? '#2F9B65' : '#C2410C'} />
                        <Text style={[styles.payPillText, { color: isPaid ? '#2F9B65' : '#C2410C' }]}>
                            {isPod
                                ? (isPaid
                                    ? `Paid online ${formatNaira(onlineAmount)} · ${balanceCollected ? `Paid ${formatNaira(balanceDue)} on delivery` : `Pay ${formatNaira(balanceDue)} to the rider on delivery`}`
                                    : `Pay on delivery · ${order.payment_status === 'refunded' ? 'Refunded' : 'Delivery fee not paid'}`)
                                : <>
                                    {order.payment_method === 'paystack' ? 'Paystack' : order.payment_method === 'cash' ? 'Cash on delivery' : 'Bank transfer'}
                                    {' · '}{isPaid ? 'Paid' : order.payment_status === 'refunded' ? 'Refunded' : 'Not paid'}
                                </>}
                        </Text>
                    </View>
                    {order.paystack_reference && <Text style={styles.ref}>Ref: {order.paystack_reference}</Text>}
                </Animated.View>

                {/* Delivery */}
                <Animated.View entering={FadeInDown.delay(320)} style={styles.card}>
                    <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Delivery details</Text>
                    <View style={styles.infoRow}>
                        <View style={styles.infoIcon}><Ionicons name="location" size={18} color="#FE8C00" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoMain}>{order.delivery_address}</Text>
                            <Text style={styles.infoSub}>{order.city}, {order.state}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoIcon}><Ionicons name="call" size={18} color="#FE8C00" /></View>
                        <Text style={[styles.infoMain, { flex: 1 }]}>{formatNigerianPhone(order.phone)}</Text>
                    </View>
                    {order.note ? (
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}><Ionicons name="chatbubble-ellipses" size={18} color="#FE8C00" /></View>
                            <Text style={[styles.infoSub, { flex: 1 }]}>{order.note}</Text>
                        </View>
                    ) : null}
                </Animated.View>

                {/* Actions */}
                <Animated.View entering={FadeInDown.delay(380)} style={styles.actions}>
                    {(order.status === 'delivered' || order.status === 'cancelled') && (
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={orderAgain} activeOpacity={0.85}>
                            <Ionicons name="refresh" size={16} color="#fff" />
                            <Text style={styles.primaryBtnText}>Order again</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.helpBtn, { flex: 1 }]} onPress={() => router.push('/help')} activeOpacity={0.8}>
                        <Ionicons name="help-buoy-outline" size={18} color="#181C2E" />
                        <Text style={styles.helpText}>Get help</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const shadow = {
    shadowColor: '#181C2E', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F7F7F9' },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, paddingBottom: 40, gap: 16 },

    successBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22,
        backgroundColor: '#2F9B65', marginTop: -20,
    },
    successIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    successTitle: { fontFamily: 'Quicksand-Bold', fontSize: 17, color: '#fff' },
    successBody: { fontFamily: 'Quicksand-Medium', fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

    hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 24, borderWidth: 1 },
    heroIconWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
    heroRing: { position: 'absolute', width: 60, height: 60, borderRadius: 30 },
    heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    heroTitle: { fontFamily: 'Quicksand-Bold', fontSize: 19 },
    heroBody: { fontFamily: 'Quicksand-Medium', fontSize: 13.5, color: '#4B4B55', marginTop: 3, lineHeight: 19 },
    heroMeta: { fontFamily: 'Quicksand-SemiBold', fontSize: 12, color: '#878787', marginTop: 6 },

    card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, ...shadow },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    cardTitle: { fontFamily: 'Quicksand-Bold', fontSize: 17, color: '#181C2E' },
    cardMeta: { fontFamily: 'Quicksand-SemiBold', fontSize: 13, color: '#878787' },

    trackWrap: { marginTop: 18, paddingHorizontal: 18 },
    trackLine: { position: 'absolute', top: 17, left: 18, right: 18, height: 4, borderRadius: 2, backgroundColor: '#EDEDF1' },
    trackFill: { position: 'absolute', top: 17, left: 18, height: 4, borderRadius: 2, backgroundColor: '#FE8C00' },
    trackSteps: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -18 },
    step: { width: 64, alignItems: 'center', gap: 6 },
    stepDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F3F6', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
    stepDotDone: { backgroundColor: '#FE8C00' },
    stepDotCurrent: { borderColor: '#FFE2BF', transform: [{ scale: 1.12 }] },
    stepLabel: { fontFamily: 'Quicksand-SemiBold', fontSize: 11, color: '#A3A3AD' },
    stepLabelDone: { color: '#181C2E', fontFamily: 'Quicksand-Bold' },
    trackNote: { fontFamily: 'Quicksand-Medium', fontSize: 12, color: '#878787', marginTop: 14, textAlign: 'center' },

    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECF0' },
    itemThumb: { width: 58, height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFF3E6' },
    itemName: { fontFamily: 'Quicksand-Bold', fontSize: 14.5, color: '#181C2E' },
    itemExtras: { fontFamily: 'Quicksand-Medium', fontSize: 12, color: '#878787', marginTop: 2 },
    itemQty: { fontFamily: 'Quicksand-SemiBold', fontSize: 12.5, color: '#878787', marginTop: 4 },
    itemTotal: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#181C2E' },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#878787' },
    rowValue: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#181C2E' },
    rowLabelBold: { fontFamily: 'Quicksand-Bold', fontSize: 16, color: '#181C2E' },
    rowValueBold: { fontFamily: 'Quicksand-Bold', fontSize: 20, color: '#FE8C00' },
    dashed: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#DCDCE2', marginVertical: 2 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    shareText: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#FE8C00' },
    payPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginTop: 16 },
    payPillText: { fontFamily: 'Quicksand-Bold', fontSize: 12.5, flexShrink: 1 },
    ref: { fontFamily: 'Quicksand-Medium', fontSize: 11.5, color: '#A3A3AD', marginTop: 8 },

    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    infoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF3E6', alignItems: 'center', justifyContent: 'center' },
    infoMain: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#181C2E' },
    infoSub: { fontFamily: 'Quicksand-Medium', fontSize: 13, color: '#878787', marginTop: 1 },

    actions: { flexDirection: 'row', gap: 12 },
    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 999, backgroundColor: '#FE8C00',
        shadowColor: '#FE8C00', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
    },
    primaryBtnText: { fontFamily: 'Quicksand-Bold', fontSize: 16, color: '#fff' },
    ghostBtn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F1414155', backgroundColor: '#FDECEC' },
    ghostBtnText: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#F14141' },
    helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E4E4EA' },
    helpText: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: '#181C2E' },
});
