import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    LayoutChangeEvent,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

import CustomHeader from "@/components/CustomHeader";
import ProductImage from "@/components/ProductImage";
import useFetch from "@/lib/useFetch";
import { getOrders } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { openPayment } from "@/lib/payments";
import type { Order, OrderStatus } from "@/type";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const C = {
    orange: "#FE8C00",
    logo: "#FD652A",
    navy: "#181C2E",
    grey: "#878787",
    bg: "#F7F7F9",
    success: "#2F9B65",
    error: "#F14141",
    white: "#FFFFFF",
    line: "#ECECF0",
};

type Tab = "active" | "past";

const ACTIVE_STATUSES: OrderStatus[] = ["awaiting_payment", "pending", "confirmed", "preparing", "on_the_way"];

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; sentence: string }> = {
    awaiting_payment: { label: "Awaiting payment", color: C.orange, bg: "#FFF3E2", sentence: "Complete payment to place your order" },
    pending: { label: "Order received", color: "#C98A00", bg: "#FFF7DB", sentence: "We've received your order" },
    confirmed: { label: "Confirmed", color: "#2F6FEB", bg: "#E8F0FE", sentence: "Your order has been confirmed" },
    preparing: { label: "Preparing", color: C.logo, bg: "#FFEDE5", sentence: "Your order is being prepared" },
    on_the_way: { label: "On the way", color: "#5B4BDB", bg: "#EEEBFF", sentence: "Your order is on its way to you" },
    delivered: { label: "Delivered", color: C.success, bg: "#E7F5EE", sentence: "Delivered — enjoy your meal!" },
    cancelled: { label: "Cancelled", color: C.error, bg: "#FDECEC", sentence: "This order was cancelled" },
};

const STEPS: { status: OrderStatus; label: string }[] = [
    { status: "confirmed", label: "Confirmed" },
    { status: "preparing", label: "Preparing" },
    { status: "on_the_way", label: "On the way" },
    { status: "delivered", label: "Delivered" },
];

const isActive = (order: Order) => ACTIVE_STATUSES.includes(order.status);

const shortId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const itemSummary = (order: Order) => {
    const items = order.order_items ?? [];
    if (items.length === 0) return "No items";
    const shown = items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(", ");
    const more = items.length - 2;
    return more > 0 ? `${shown} + ${more} more` : shown;
};

// ---------------------------------------------------------------------------
// Segmented tabs with sliding pill
// ---------------------------------------------------------------------------

const SegmentedTabs = ({
    tab,
    onChange,
    activeCount,
    pastCount,
}: {
    tab: Tab;
    onChange: (tab: Tab) => void;
    activeCount: number;
    pastCount: number;
}) => {
    const [width, setWidth] = useState(0);
    const pillWidth = width > 0 ? (width - 8) / 2 : 0;
    const translateX = useSharedValue(0);

    useEffect(() => {
        translateX.value = withTiming(tab === "active" ? 0 : pillWidth, { duration: 240 });
    }, [tab, pillWidth, translateX]);

    const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    const renderTab = (key: Tab, label: string, count: number) => {
        const selected = tab === key;
        return (
            <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                style={styles.tabButton}
                onPress={() => onChange(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
            >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
                <View style={[styles.tabCount, selected && styles.tabCountSelected]}>
                    <Text style={[styles.tabCountText, selected && styles.tabCountTextSelected]}>{count}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.tabs} onLayout={onLayout}>
            {pillWidth > 0 && <Animated.View style={[styles.tabPill, { width: pillWidth }, pillStyle]} />}
            {renderTab("active", "Active", activeCount)}
            {renderTab("past", "Past", pastCount)}
        </View>
    );
};

// ---------------------------------------------------------------------------
// Card pieces
// ---------------------------------------------------------------------------

const ThumbStack = ({ order }: { order: Order }) => {
    const items = order.order_items ?? [];
    const shown = items.slice(0, 3);
    const extra = items.length - shown.length;

    return (
        <View style={styles.thumbStack}>
            {(shown.length ? shown : [null]).map((item, i) => (
                <View key={item?.id ?? "empty"} style={[styles.thumb, i > 0 && styles.thumbOverlap, { zIndex: 10 - i }]}>
                    <ProductImage imageUrl={item?.image_url} className="size-full" resizeMode="cover" />
                </View>
            ))}
            {extra > 0 && (
                <View style={[styles.thumb, styles.thumbOverlap, styles.thumbMore]}>
                    <Text style={styles.thumbMoreText}>+{extra}</Text>
                </View>
            )}
        </View>
    );
};

const StatusPill = ({ status }: { status: OrderStatus }) => {
    const meta = STATUS_META[status];
    return (
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]} numberOfLines={1}>
                {meta.label}
            </Text>
        </View>
    );
};

const MiniProgress = ({ status }: { status: OrderStatus }) => {
    const current = STEPS.findIndex((s) => s.status === status); // -1 for 'pending'
    const meta = STATUS_META[status];

    return (
        <View style={styles.progressBox}>
            <View style={styles.progressBars}>
                {STEPS.map((step, i) => (
                    <View
                        key={step.status}
                        style={[
                            styles.progressSeg,
                            i <= current && { backgroundColor: i === current ? C.orange : "#FFC98A" },
                        ]}
                    />
                ))}
            </View>
            <View style={styles.progressLabels}>
                {STEPS.map((step, i) => (
                    <Text
                        key={step.status}
                        numberOfLines={1}
                        style={[styles.progressLabel, i === current && styles.progressLabelCurrent]}
                    >
                        {step.label}
                    </Text>
                ))}
            </View>
            <View style={styles.progressSentenceRow}>
                <Ionicons
                    name={status === "on_the_way" ? "bicycle" : status === "preparing" ? "restaurant" : "time-outline"}
                    size={14}
                    color={meta.color}
                />
                <Text style={styles.progressSentence} numberOfLines={1}>
                    {meta.sentence}
                </Text>
            </View>
        </View>
    );
};

const PaymentNotice = ({ orderId, deliveryOnly }: { orderId: string; deliveryOnly?: boolean }) => (
    <View style={styles.payNotice}>
        <Ionicons name="card-outline" size={18} color={C.orange} />
        <View style={styles.payNoticeTextWrap}>
            <Text style={styles.payNoticeTitle}>Payment pending</Text>
            <Text style={styles.payNoticeSub} numberOfLines={1}>
                {deliveryOnly ? "Pay the delivery fee to confirm" : "Pay to confirm your order"}
            </Text>
        </View>
        <TouchableOpacity style={styles.payBtn} activeOpacity={0.85} onPress={() => openPayment(orderId, 'push')} hitSlop={6}>
            <Text style={styles.payBtnText}>Pay now</Text>
        </TouchableOpacity>
    </View>
);

const OrderCard = ({ order, index }: { order: Order; index: number }) => {
    const active = isActive(order);

    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(320)}>
            <TouchableOpacity
                activeOpacity={0.9}
                style={styles.card}
                onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })}
            >
                <View style={styles.cardTop}>
                    <ThumbStack order={order} />
                    <View style={styles.cardTopText}>
                        <Text style={styles.orderNo} numberOfLines={1}>
                            {shortId(order.id)}
                        </Text>
                        <Text style={styles.orderDate} numberOfLines={1}>
                            {formatDateTime(order.created_at)}
                        </Text>
                    </View>
                    <StatusPill status={order.status} />
                </View>

                <Text style={styles.summary} numberOfLines={1}>
                    {itemSummary(order)}
                </Text>

                {order.status === "awaiting_payment" ? (
                    <PaymentNotice orderId={order.id} deliveryOnly={order.payment_method === "pay_on_delivery"} />
                ) : active ? (
                    <MiniProgress status={order.status} />
                ) : null}

                <View style={styles.divider} />

                <View style={styles.cardBottom}>
                    <View>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.total}>{formatNaira(order.total)}</Text>
                        {order.payment_method === "pay_on_delivery" && Number(order.balance_due) > 0 && (
                            <Text style={styles.podNote} numberOfLines={1}>
                                {order.balance_collected_at
                                    ? "Paid on delivery ✓"
                                    : `Pay ${formatNaira(order.balance_due)} to the rider`}
                            </Text>
                        )}
                    </View>
                    <View style={styles.viewDetails}>
                        <Text style={styles.viewDetailsText}>View details</Text>
                        <Ionicons name="chevron-forward" size={16} color={C.orange} />
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ---------------------------------------------------------------------------
// Skeleton + empty state
// ---------------------------------------------------------------------------

const SkeletonCard = () => {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(withTiming(0.45, { duration: 700 }), withTiming(1, { duration: 700 })),
            -1,
        );
    }, [opacity]);
    const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={[styles.card, pulse]}>
            <View style={styles.cardTop}>
                <View style={styles.thumbStack}>
                    <View style={[styles.thumb, styles.skel]} />
                    <View style={[styles.thumb, styles.thumbOverlap, styles.skel]} />
                </View>
                <View style={styles.cardTopText}>
                    <View style={[styles.skel, { width: 90, height: 14, borderRadius: 7 }]} />
                    <View style={[styles.skel, { width: 120, height: 10, borderRadius: 5, marginTop: 8 }]} />
                </View>
                <View style={[styles.skel, { width: 72, height: 24, borderRadius: 12 }]} />
            </View>
            <View style={[styles.skel, { height: 12, borderRadius: 6, width: "80%" }]} />
            <View style={[styles.skel, { height: 6, borderRadius: 3 }]} />
            <View style={styles.cardBottom}>
                <View style={[styles.skel, { width: 80, height: 18, borderRadius: 9 }]} />
                <View style={[styles.skel, { width: 90, height: 14, borderRadius: 7 }]} />
            </View>
        </Animated.View>
    );
};

const EmptyState = ({ tab }: { tab: Tab }) => (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.empty}>
        <View style={styles.emptyCircle}>
            <Ionicons name={tab === "active" ? "bag-handle-outline" : "receipt-outline"} size={48} color={C.orange} />
        </View>
        <Text style={styles.emptyTitle}>{tab === "active" ? "No active orders" : "No past orders yet"}</Text>
        <Text style={styles.emptyText}>
            {tab === "active"
                ? "When you place an order, you can track it right here."
                : "Orders you've received or cancelled will show up here."}
        </Text>
        <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85} onPress={() => router.replace("/search")}>
            <Ionicons name="storefront-outline" size={18} color={C.white} />
            <Text style={styles.emptyBtnText}>Start shopping</Text>
        </TouchableOpacity>
    </Animated.View>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function Orders() {
    const { data: orders, loading, refetch } = useFetch({ fn: getOrders });
    const [tab, setTab] = useState<Tab | null>(null);

    // Refresh when coming back from an order (e.g. after cancelling or paying).
    useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    const { activeOrders, pastOrders } = useMemo(() => {
        const all = orders ?? [];
        return {
            activeOrders: all.filter(isActive),
            pastOrders: all.filter((o) => !isActive(o)),
        };
    }, [orders]);

    // Until the user picks a tab: Active if it has orders, otherwise Past.
    const currentTab: Tab = tab ?? (orders && activeOrders.length === 0 && pastOrders.length > 0 ? "past" : "active");
    const data = currentTab === "active" ? activeOrders : pastOrders;
    const firstLoad = loading && !orders;

    return (
        <SafeAreaView edges={["top"]} style={styles.screen}>
            <View style={styles.headerWrap}>
                <CustomHeader title="My orders" showSearch={false} />
                <SegmentedTabs
                    tab={currentTab}
                    onChange={setTab}
                    activeCount={activeOrders.length}
                    pastCount={pastOrders.length}
                />
            </View>

            {firstLoad ? (
                <View style={styles.listContent}>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </View>
            ) : (
                <FlatList
                    key={currentTab}
                    data={data}
                    keyExtractor={(order) => order.id}
                    contentContainerStyle={[styles.listContent, data.length === 0 && styles.listEmpty]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading && !!orders}
                            onRefresh={() => refetch()}
                            tintColor={C.orange}
                            colors={[C.orange]}
                        />
                    }
                    renderItem={({ item, index }) => <OrderCard order={item} index={index} />}
                    ListEmptyComponent={<EmptyState tab={currentTab} />}
                />
            )}
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shadow = {
    shadowColor: C.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
};

const THUMB = 40;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    headerWrap: { paddingHorizontal: 20, paddingTop: 12, gap: 14, paddingBottom: 6 },

    // Tabs
    tabs: {
        flexDirection: "row",
        backgroundColor: "#EDEDF1",
        borderRadius: 16,
        padding: 4,
        position: "relative",
    },
    tabPill: {
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 4,
        borderRadius: 12,
        backgroundColor: C.white,
        ...shadow,
    },
    tabButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 10,
    },
    tabText: { fontFamily: "Quicksand-SemiBold", fontSize: 15, color: C.grey },
    tabTextSelected: { fontFamily: "Quicksand-Bold", color: C.navy },
    tabCount: {
        minWidth: 22,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: "#DCDCE2",
        alignItems: "center",
        justifyContent: "center",
    },
    tabCountSelected: { backgroundColor: C.orange },
    tabCountText: { fontFamily: "Quicksand-Bold", fontSize: 11, color: C.grey },
    tabCountTextSelected: { color: C.white },

    // List
    listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 14 },
    listEmpty: { flexGrow: 1 },

    // Card
    card: {
        backgroundColor: C.white,
        borderRadius: 22,
        padding: 16,
        gap: 12,
        ...shadow,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardTopText: { flex: 1, minWidth: 0 },
    orderNo: { fontFamily: "Quicksand-Bold", fontSize: 15, color: C.navy },
    orderDate: { fontFamily: "Quicksand-Medium", fontSize: 12, color: C.grey, marginTop: 2 },

    thumbStack: { flexDirection: "row", alignItems: "center" },
    thumb: {
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        borderWidth: 2,
        borderColor: C.white,
        backgroundColor: "#F1F1F4",
        overflow: "hidden",
    },
    thumbOverlap: { marginLeft: -14 },
    thumbMore: { backgroundColor: "#FFF3E2", alignItems: "center", justifyContent: "center", zIndex: 0 },
    thumbMoreText: { fontFamily: "Quicksand-Bold", fontSize: 11, color: C.orange },

    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        maxWidth: 140,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontFamily: "Quicksand-Bold", fontSize: 11 },

    summary: { fontFamily: "Quicksand-Medium", fontSize: 14, color: "#4A4E5E" },

    // Progress
    progressBox: { backgroundColor: C.bg, borderRadius: 14, padding: 12, gap: 8 },
    progressBars: { flexDirection: "row", gap: 4 },
    progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#E2E2E8" },
    progressLabels: { flexDirection: "row", gap: 4 },
    progressLabel: { flex: 1, fontFamily: "Quicksand-Medium", fontSize: 10, color: C.grey },
    progressLabelCurrent: { fontFamily: "Quicksand-Bold", color: C.orange },
    progressSentenceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    progressSentence: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, color: C.navy },

    // Payment notice
    payNotice: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#FFF3E2",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    payNoticeTextWrap: { flex: 1, minWidth: 0 },
    payNoticeTitle: { fontFamily: "Quicksand-Bold", fontSize: 13, color: C.orange },
    payNoticeSub: { fontFamily: "Quicksand-Medium", fontSize: 11, color: "#9A6A2E", marginTop: 1 },
    payBtn: { backgroundColor: C.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    payBtnText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: C.white },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },

    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    totalLabel: { fontFamily: "Quicksand-Medium", fontSize: 11, color: C.grey },
    total: { fontFamily: "Quicksand-Bold", fontSize: 17, color: C.navy },
    podNote: { fontFamily: "Quicksand-Bold", fontSize: 11.5, color: "#B45309", marginTop: 2 },
    viewDetails: { flexDirection: "row", alignItems: "center", gap: 2 },
    viewDetailsText: { fontFamily: "Quicksand-SemiBold", fontSize: 13, color: C.orange },

    // Skeleton
    skel: { backgroundColor: "#ECECF0" },

    // Empty
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 40, gap: 10 },
    emptyCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        backgroundColor: "#FFF3E2",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    emptyTitle: { fontFamily: "Quicksand-Bold", fontSize: 20, color: C.navy },
    emptyText: { fontFamily: "Quicksand-Medium", fontSize: 14, color: C.grey, textAlign: "center", lineHeight: 20 },
    emptyBtn: {
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: C.orange,
        borderRadius: 999,
        paddingHorizontal: 24,
        paddingVertical: 14,
    },
    emptyBtnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: C.white },
});
