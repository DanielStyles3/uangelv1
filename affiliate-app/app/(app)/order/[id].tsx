import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Enter } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Card, CardHeader, Chip, IconBubble, Notice } from '@/components/ui';
import { CustomerOrder } from '@/lib/api';
import { errorMessage, formatDateTime, formatNaira, formatRate } from '@/lib/format';
import { cachedOrder, loadCustomerOrders } from '@/lib/orders';
import { commissionExplainer, commissionState, commissionStatus, orderStatusChip } from '@/lib/status';
import { cardShadow, colors, fonts } from '@/lib/theme';

/** order = null: loaded, but this order isn't one of the customer's (or isn't yours to see). */
type State = { order: CustomerOrder | null; now: number } | null;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Bolt-style breakdown of one order: what was bought and how the commission on it adds up. */
export default function OrderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id: string; customer: string; name?: string }>();
    const orderId = one(params.id);
    const customerId = one(params.customer);
    const name = one(params.name);
    const [state, setState] = useState<State>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const orders = await loadCustomerOrders(customerId);
            setState({ order: orders.find((o) => o.order_id === orderId) ?? null, now: Date.now() });
            setError(null);
        } catch (e) {
            setError(errorMessage(e));
        }
    }, [customerId, orderId]);

    useEffect(() => {
        let alive = true;
        if (!customerId) {
            Promise.resolve().then(() => alive && setState({ order: null, now: Date.now() }));
            return () => {
                alive = false;
            };
        }
        // Opened from the customer's list: show the cached order at once, then refresh it.
        const cached = cachedOrder(customerId, orderId);
        if (cached) Promise.resolve().then(() => alive && setState({ order: cached, now: Date.now() }));
        loadCustomerOrders(customerId)
            .then((orders) => alive && setState({ order: orders.find((o) => o.order_id === orderId) ?? null, now: Date.now() }))
            .catch((e) => alive && setError(errorMessage(e)));
        return () => {
            alive = false;
        };
    }, [customerId, orderId]);

    const onRefresh = async () => {
        if (!customerId) return;
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
    const order = state?.order;

    return (
        <Screen
            stack
            title={order ? `Order #${order.ref}` : 'Order'}
            kicker={name || undefined}
            onBack={goBack}
            refreshing={refreshing}
            onRefresh={customerId ? onRefresh : undefined}
        >
            {error && !order ? <Notice tone="red" icon="cloud-offline-outline" text={error} /> : null}
            {!state ? (
                error ? null : (
                    <View style={styles.loading}>
                        <ActivityIndicator color={colors.orange} />
                    </View>
                )
            ) : !order ? (
                <Enter>
                    <Card style={styles.emptyCard}>
                        <IconBubble name="receipt-outline" size={60} />
                        <Text style={styles.emptyTitle}>Order not found</Text>
                        <Text style={styles.emptyBody}>We couldn’t find this order. Pull down to try again, or go back.</Text>
                        <Button title="Go back" variant="secondary" onPress={goBack} style={styles.emptyBtn} />
                    </Card>
                </Enter>
            ) : (
                <OrderDetail order={order} now={state.now} />
            )}
        </Screen>
    );
}

function OrderDetail({ order, now }: { order: CustomerOrder; now: number }) {
    const c = order.commission;
    const status = commissionStatus(c, now);
    const st = commissionState(c, now);
    const estimate = st === 'waiting' || st === 'reviewing';
    const cancelled = st === 'cancelled';
    const orderChip = orderStatusChip(order.status);
    const items = order.items ?? [];
    const commissionItems = c?.items ?? [];

    return (
        <>
            {/* Top: when, which order, where it is */}
            <Enter index={0}>
                <Card style={styles.head}>
                    <IconBubble name="receipt-outline" size={46} />
                    <View style={styles.flex}>
                        <Text style={styles.headDate}>{formatDateTime(order.paid_at ?? order.created_at)}</Text>
                        <Text style={styles.sub}>Order #{order.ref}</Text>
                    </View>
                    <Chip label={orderChip.label} tone={orderChip.tone} large />
                </Card>
            </Enter>

            {/* What they ordered */}
            <Enter index={1}>
                <Card style={styles.section}>
                    <CardHeader title="What they ordered" icon="bag-handle-outline" />
                    <View style={styles.rows}>
                        {items.length === 0 ? (
                            <Text style={styles.muted}>No item details for this order.</Text>
                        ) : (
                            items.map((it, i) => (
                                <View key={`${it.name}-${i}`} style={styles.row}>
                                    <Text style={styles.rowName}>
                                        {it.name} <Text style={styles.qty}>× {Number(it.quantity) || 1}</Text>
                                    </Text>
                                    <Text style={styles.rowValue}>{formatNaira(it.line_total)}</Text>
                                </View>
                            ))
                        )}
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Items total</Text>
                        <Text style={styles.totalValue}>{formatNaira(order.items_total)}</Text>
                    </View>
                </Card>
            </Enter>

            {/* Your commission */}
            <Enter index={2}>
                <Card style={styles.section}>
                    <CardHeader title="Your commission" icon="wallet-outline" />
                    {c ? (
                        <>
                            <View style={styles.rows}>
                                {commissionItems.length === 0 ? (
                                    <View style={styles.row}>
                                        <Text style={styles.rowName}>
                                            Order <Text style={styles.qty}>· on {formatNaira(c.base_amount)}</Text>
                                        </Text>
                                        <Text style={styles.rowValue}>{formatNaira(c.amount)}</Text>
                                    </View>
                                ) : (
                                    commissionItems.map((it, i) => {
                                        const qty = Number(it.quantity) || 1;
                                        return (
                                            <View key={`${it.name}-${i}`} style={styles.row}>
                                                <View style={styles.flex}>
                                                    <Text style={styles.rowName}>
                                                        {it.name}
                                                        {qty > 1 ? <Text style={styles.qty}> × {qty}</Text> : null}
                                                    </Text>
                                                    <Text style={styles.rowSub}>
                                                        {formatRate(it.rate)} of {formatNaira(it.line_total)}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.rowValue, Number(it.amount) > 0 ? styles.earn : styles.noEarn]}>
                                                    {formatNaira(it.amount)}
                                                </Text>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                            <View style={styles.totalRow}>
                                <View style={styles.flex}>
                                    <Text style={styles.totalLabel}>Total commission</Text>
                                    {estimate ? <Text style={styles.rowSub}>Estimate</Text> : null}
                                </View>
                                <Text
                                    style={[styles.commissionTotal, { color: cancelled ? colors.greyLight : colors.green }, cancelled && styles.strike]}
                                >
                                    {formatNaira(c.amount)}
                                </Text>
                            </View>
                        </>
                    ) : null}
                    <View style={styles.stateBox}>
                        <Chip label={status.text} tone={status.tone} icon={status.icon} />
                        <Text style={styles.stateText}>{commissionExplainer(c, now)}</Text>
                    </View>
                    {c?.note ? <Notice icon="chatbubble-ellipses-outline" text={`Note from U Angel Foods: ${c.note}`} /> : null}
                </Card>
            </Enter>

            <Enter index={3}>
                <Text style={styles.footer}>
                    Delivery fees and Christmas giving packs don’t earn commission. Rates vary by product, up to 5%.
                </Text>
            </Enter>
        </>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    loading: { paddingVertical: 40 },
    sub: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.grey },
    muted: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },

    emptyCard: { alignItems: 'center', padding: 22, gap: 8 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, marginTop: 6 },
    emptyBody: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey, textAlign: 'center' },
    emptyBtn: { alignSelf: 'stretch', marginTop: 8 },

    head: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, ...cardShadow },
    headDate: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },

    section: { borderRadius: 22, gap: 12, ...cardShadow },
    rows: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    rowName: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.navy },
    qty: { fontFamily: fonts.semibold, color: colors.grey },
    rowSub: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: colors.grey },
    rowValue: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.navy },
    earn: { color: colors.green },
    noEarn: { color: colors.greyLight },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    totalLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    totalValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
    commissionTotal: { fontFamily: fonts.bold, fontSize: 20 },
    strike: { textDecorationLine: 'line-through' },

    stateBox: { borderRadius: 16, padding: 12, gap: 8, backgroundColor: colors.bg },
    stateText: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.grey },

    footer: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.grey, textAlign: 'center', paddingHorizontal: 12 },
});
