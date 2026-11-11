import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Enter, PressableScale } from '@/components/motion';
import { GUTTER, ScreenHeader, useHeaderScroll } from '@/components/Screen';
import { Avatar, Card, Chip, IconBubble, Notice, SectionLabel } from '@/components/ui';
import { CustomerOrder } from '@/lib/api';
import { errorMessage, formatDate, formatDateTime, formatNaira } from '@/lib/format';
import { cachedCustomerOrders, loadCustomerOrders } from '@/lib/orders';
import { commissionStatus, orderStatusChip } from '@/lib/status';
import { cardShadow, colors, fonts } from '@/lib/theme';

type State = { orders: CustomerOrder[]; now: number } | null;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Commission that still counts (not cancelled) across a customer's orders. */
const totalEarned = (orders: CustomerOrder[]) =>
    orders.reduce((sum, o) => (o.commission && o.commission.status !== 'cancelled' ? sum + (Number(o.commission.amount) || 0) : sum), 0);

/** One referred customer: when they joined, what they've ordered and what each order earned you. */
export default function CustomerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ id: string; name?: string; joined?: string; orders?: string; earned?: string; spent?: string }>();
    const customerId = one(params.id);
    const name = one(params.name) || 'Customer';
    const joined = one(params.joined);
    const { scrollY, onScroll } = useHeaderScroll();
    const [state, setState] = useState<State>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const orders = await loadCustomerOrders(customerId);
            setState({ orders, now: Date.now() });
            setError(null);
        } catch (e) {
            setError(errorMessage(e));
        }
    }, [customerId]);

    useEffect(() => {
        let alive = true;
        const cached = cachedCustomerOrders(customerId);
        // Show what we already have at once (as a resolved promise, not a setState in the effect body), then refresh.
        if (cached) Promise.resolve().then(() => alive && setState({ orders: cached, now: Date.now() }));
        loadCustomerOrders(customerId)
            .then((orders) => alive && setState({ orders, now: Date.now() }))
            .catch((e) => alive && setError(errorMessage(e)));
        return () => {
            alive = false;
        };
    }, [customerId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/referrals'));

    const openOrder = (o: CustomerOrder) => {
        Haptics.selectionAsync().catch(() => {});
        router.push({ pathname: '/order/[id]', params: { id: o.order_id, customer: customerId, name } });
    };

    const orders = state?.orders;
    const orderCount = orders ? orders.length : Number(one(params.orders)) || 0;
    const earned = orders ? totalEarned(orders) : Number(one(params.earned)) || 0;
    const spent = orders ? orders.reduce((s, o) => s + (Number(o.spent ?? o.items_total) || 0), 0) : Number(one(params.spent)) || 0;

    const top = (
        <View style={styles.top}>
            <Enter index={0}>
                <Card style={styles.hero}>
                    <View style={styles.heroTop}>
                        <Avatar name={name} size={52} bg={colors.orangeSoft} fg={colors.orangeDark} />
                        <View style={styles.flex}>
                            <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
                            <Text style={styles.sub}>{joined ? `Joined ${formatDate(joined)}` : 'Signed up with your code'}</Text>
                        </View>
                    </View>
                    <View style={styles.stats}>
                        <Stat value={String(orderCount)} label={orderCount === 1 ? 'Paid order' : 'Paid orders'} />
                        <View style={styles.statLine} />
                        <Stat value={formatNaira(spent)} label="Total spent" />
                        <View style={styles.statLine} />
                        <Stat value={formatNaira(earned)} label="Your commission" green={earned > 0} />
                    </View>
                </Card>
            </Enter>
            {error ? <Notice tone="red" icon="cloud-offline-outline" text={error} /> : null}
            {orders && orders.length > 0 ? (
                <Enter index={1}>
                    <SectionLabel>Orders</SectionLabel>
                </Enter>
            ) : null}
        </View>
    );

    const empty = !state ? (
        error ? undefined : (
            <View style={styles.loading}>
                <ActivityIndicator color={colors.orange} />
            </View>
        )
    ) : (
        <Enter index={1}>
            <Card style={styles.emptyCard}>
                <IconBubble name="receipt-outline" size={60} />
                <Text style={styles.emptyTitle}>No orders yet</Text>
                <Text style={styles.emptyBody}>No orders yet. When they pay for an order, it shows here.</Text>
            </Card>
        </Enter>
    );

    return (
        <View style={styles.screen}>
            <ScreenHeader title={name} kicker="Referred customer" onBack={goBack} scrollY={scrollY} />
            <Animated.FlatList
                style={styles.flex}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
                data={orders ?? []}
                keyExtractor={(o) => o.order_id}
                ListHeaderComponent={top}
                ListEmptyComponent={empty}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />}
                renderItem={({ item, index }) => (
                    <Enter index={index + 2}>
                        <OrderCard order={item} now={state?.now ?? 0} onPress={() => openOrder(item)} />
                    </Enter>
                )}
            />
        </View>
    );
}

function OrderCard({ order, now, onPress }: { order: CustomerOrder; now: number; onPress: () => void }) {
    const c = order.commission;
    const status = commissionStatus(c, now);
    const orderChip = orderStatusChip(order.status);
    const cancelled = c?.status === 'cancelled';
    const spent = Number(order.spent ?? order.items_total) || 0;

    // Amounts only: for the customer's privacy, affiliates never see what was ordered.
    return (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Order ${order.ref}, spent ${formatNaira(spent)}. ${status.text}`}>
            <Card style={styles.order}>
                <View style={styles.orderTop}>
                    <View style={styles.flex}>
                        <Text style={styles.orderDate}>{formatDateTime(order.paid_at ?? order.created_at)}</Text>
                        <Text style={styles.sub}>#{order.ref} · {orderChip.label}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.orderTotal}>{formatNaira(spent)}</Text>
                        <Text style={styles.sub}>spent</Text>
                    </View>
                </View>
                <View style={styles.orderFoot}>
                    <View style={styles.chipWrap}>
                        <Chip label={status.text} tone={status.tone} icon={status.icon} />
                    </View>
                    {c ? (
                        <Text style={[styles.amount, { color: cancelled ? colors.greyLight : colors.green }, cancelled && styles.strike]}>
                            +{formatNaira(c.amount)}
                        </Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color={colors.greyLight} />
                </View>
            </Card>
        </PressableScale>
    );
}

function Stat({ value, label, green }: { value: string; label: string; green?: boolean }) {
    return (
        <View style={styles.stat}>
            <Text style={[styles.statValue, green && styles.statGreen]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: GUTTER, paddingTop: 6, gap: 12 },
    top: { gap: 12 },
    loading: { paddingVertical: 40 },
    sub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },

    hero: { borderRadius: 24, gap: 14 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroName: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
    stats: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
    statValue: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
    statGreen: { color: colors.green },
    statLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey },
    statLine: { width: 1, height: 30, backgroundColor: colors.line },

    emptyCard: { alignItems: 'center', padding: 22, gap: 8 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, marginTop: 6 },
    emptyBody: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey, textAlign: 'center' },

    order: { borderRadius: 22, padding: 14, gap: 10, ...cardShadow },
    orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    orderDate: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    orderTotal: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    items: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey },
    orderFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
    chipWrap: { flex: 1, flexShrink: 1 },
    amount: { fontFamily: fonts.bold, fontSize: 14 },
    strike: { textDecorationLine: 'line-through' },
});
