import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CountUpNaira, Enter, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Card, CardHeader, Chip, IconBubble, Notice, TONES } from '@/components/ui';
import WeekChart, { buildWeek, WeekDay, weekStart } from '@/components/WeekChart';
import { useAffiliate } from '@/lib/affiliate';
import { Commission, getCommissions, getCommissionsSince } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatNaira, formatShortDate } from '@/lib/format';
import { commissionStatus } from '@/lib/status';
import { cardShadow, colors, fonts } from '@/lib/theme';

import { notify } from '@/lib/notice';
type Earnings = { items: Commission[]; now: number } | null;

const PREVIEW = 5; // rows shown before "See all"

const loadWeek = async (): Promise<WeekDay[]> => {
    const now = Date.now();
    return buildWeek(await getCommissionsSince(weekStart(now).toISOString()), now);
};

export default function EarningsTab() {
    const router = useRouter();
    const { session } = useAuth();
    const { summary, refresh } = useAffiliate();
    const [earnings, setEarnings] = useState<Earnings>(null);
    const [earningsError, setEarningsError] = useState<string | null>(null);
    const [week, setWeek] = useState<WeekDay[] | null>(null);
    const [weekError, setWeekError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const loadEarnings = useCallback(async () => {
        try {
            const items = await getCommissions();
            setEarnings({ items, now: Date.now() });
            setEarningsError(null);
        } catch (e) {
            setEarningsError(errorMessage(e));
        }
    }, []);

    const reloadWeek = useCallback(async () => {
        try {
            setWeek(await loadWeek());
            setWeekError(null);
        } catch (e) {
            setWeekError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        getCommissions()
            .then((items) => alive && setEarnings({ items, now: Date.now() }))
            .catch((e) => alive && setEarningsError(errorMessage(e)));
        loadWeek()
            .then((days) => alive && setWeek(days))
            .catch((e) => alive && setWeekError(errorMessage(e)));
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(t);
    }, [copied]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([refresh(), loadEarnings(), reloadWeek()]);
        } catch (e) {
            notify('Couldn’t refresh', errorMessage(e));
        } finally {
            setRefreshing(false);
        }
    };

    if (!summary) return null;

    const code = summary.code ?? ''; // always set once approved (only approved affiliates reach this screen)
    const blocked = summary.status !== 'active';
    const firstName = displayName(session).split(' ')[0];
    const open = summary.open_withdrawal;

    const copyCode = async () => {
        try {
            await Clipboard.setStringAsync(code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setCopied(true);
        } catch {
            notify('Couldn’t copy', `Your code is ${code}.`);
        }
    };

    const openShare = () => {
        Haptics.selectionAsync().catch(() => {});
        router.push('/share');
    };

    const items = earnings?.items ?? [];
    const visible = showAll ? items : items.slice(0, PREVIEW);

    return (
        <Screen
            kicker={`Hello, ${firstName}`}
            title="Earnings"
            right={<Chip large label={blocked ? 'On hold' : 'Active'} tone={blocked ? 'red' : 'green'} />}
            refreshing={refreshing}
            onRefresh={onRefresh}
        >
            {blocked ? (
                <Enter>
                    <Notice
                        tone="red"
                        icon="alert-circle-outline"
                        text="Your affiliate account is on hold, so new orders won’t earn and withdrawals are paused. Please contact us from the Profile tab."
                    />
                </Enter>
            ) : null}

            {/* Balance */}
            <Enter index={0}>
                <View style={styles.balance}>
                    <View style={styles.balanceGlow} />
                    <View style={styles.balanceTop}>
                        <View style={styles.flex}>
                            <Text style={styles.balanceKicker}>AVAILABLE TO WITHDRAW</Text>
                            <CountUpNaira value={Number(summary.available) || 0} style={styles.balanceAmount} />
                        </View>
                        <PressableScale
                            style={styles.withdrawBtn}
                            onPress={() => router.push('/withdraw')}
                            accessibilityRole="button"
                            accessibilityLabel="Withdraw"
                        >
                            <Text style={styles.withdrawText}>Withdraw</Text>
                        </PressableScale>
                    </View>
                    <View style={styles.tiles}>
                        <BalanceTile label="Pending" value={summary.pending} />
                        <BalanceTile label="On hold" value={summary.on_hold} />
                        <BalanceTile label="Paid out" value={summary.withdrawn} />
                    </View>
                    {open ? (
                        <TouchableOpacity style={styles.openRequest} onPress={() => router.push('/withdraw')} activeOpacity={0.7}>
                            <Ionicons name="time-outline" size={16} color={colors.peach} />
                            <Text style={styles.openRequestText}>{formatNaira(open.amount)} withdrawal is being checked</Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.peach} />
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.balanceFoot}>
                            Pending is paid but not delivered yet. On hold clears 7 days after delivery.
                        </Text>
                    )}
                </View>
            </Enter>

            {/* This week */}
            <Enter index={1}>
                <WeekChart days={week} error={week ? null : weekError} />
            </Enter>

            {/* Your code */}
            <Enter index={2}>
                <Card style={styles.codeCard}>
                    <View style={styles.flex}>
                        <Text style={styles.codeKicker}>YOUR CODE</Text>
                        <Text style={styles.codeText} numberOfLines={1} adjustsFontSizeToFit selectable>
                            {code}
                        </Text>
                    </View>
                    <PressableScale
                        style={[styles.pill, copied ? styles.pillDone : styles.pillGrey]}
                        onPress={copyCode}
                        accessibilityRole="button"
                        accessibilityLabel={copied ? 'Code copied' : 'Copy code'}
                    >
                        {copied ? <Ionicons name="checkmark" size={15} color={colors.green} /> : null}
                        <Text style={[styles.pillText, copied && styles.pillTextDone]}>{copied ? 'Copied' : 'Copy'}</Text>
                    </PressableScale>
                    <PressableScale style={[styles.pill, styles.pillNavy]} onPress={openShare} accessibilityRole="button" accessibilityLabel="Share your code">
                        <Ionicons name="share-social" size={15} color={colors.white} />
                        <Text style={[styles.pillText, styles.pillTextLight]}>Share</Text>
                    </PressableScale>
                </Card>
            </Enter>

            {/* Recent earnings */}
            <Enter index={3}>
                <Card style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <CardHeader
                            title="Recent earnings"
                            right={
                                items.length > PREVIEW ? (
                                    <TouchableOpacity onPress={() => setShowAll((s) => !s)} hitSlop={10}>
                                        <Text style={styles.seeAll}>{showAll ? 'Show fewer' : 'See all'}</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    </View>
                    {earningsError && !earnings ? (
                        <Text style={styles.empty}>{earningsError}</Text>
                    ) : !earnings ? (
                        <Text style={styles.empty}>Loading your earnings…</Text>
                    ) : items.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <IconBubble name="sparkles-outline" size={48} />
                            <Text style={styles.emptyTitle}>No earnings yet</Text>
                            <Text style={styles.empty}>
                                Share your code. When a friend you referred pays for an order, it shows here.
                            </Text>
                        </View>
                    ) : (
                        visible.map((c) => {
                            const status = commissionStatus(c, earnings.now);
                            const tone = TONES[status.tone];
                            const cancelled = c.status === 'cancelled';
                            return (
                                <View key={c.id} style={styles.item}>
                                    <IconBubble name={status.icon} bg={tone.bg} color={tone.fg} />
                                    <View style={styles.itemText}>
                                        <Text style={styles.itemTitle}>Order · {formatNaira(c.base_amount)}</Text>
                                        <Text style={[styles.itemStatus, { color: tone.fg }]}>{status.text}</Text>
                                        <Text style={styles.itemDate}>{formatShortDate(c.created_at)}</Text>
                                    </View>
                                    <Text style={[styles.itemAmount, { color: cancelled ? colors.greyLight : tone.fg }, cancelled && styles.strike]}>
                                        +{formatNaira(c.amount)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </Card>
            </Enter>
        </Screen>
    );
}

function BalanceTile({ label, value }: { label: string; value: number | string }) {
    return (
        <View style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatNaira(value)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    balance: {
        backgroundColor: colors.navy,
        borderRadius: 26,
        padding: 18,
        gap: 14,
        overflow: 'hidden',
        boxShadow: '0px 10px 22px rgba(24, 28, 46, 0.18)',
    },
    balanceGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(253,101,42,0.24)',
        right: -60,
        top: -80,
    },
    balanceTop: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    balanceKicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.2, color: colors.peach },
    balanceAmount: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, color: colors.white, marginTop: 2 },
    withdrawBtn: { height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
    withdrawText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
    tiles: { flexDirection: 'row', gap: 8 },
    tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 10, gap: 2 },
    tileLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.navyMuted },
    tileValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
    openRequest: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    openRequestText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.peach },
    balanceFoot: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 16, color: colors.navyMuted },

    codeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
    codeKicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.grey },
    codeText: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: 3, color: colors.orangeDark },
    pill: { height: 44, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    pillGrey: { backgroundColor: colors.chip },
    pillDone: { backgroundColor: colors.greenSoft },
    pillNavy: { backgroundColor: colors.navy, paddingHorizontal: 16 },
    pillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
    pillTextDone: { color: colors.green },
    pillTextLight: { color: colors.white },

    listCard: { borderRadius: 22, paddingVertical: 6, paddingHorizontal: 14, gap: 0, ...cardShadow },
    listHeader: { paddingTop: 10, paddingBottom: 8 },
    seeAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.orangeDark },
    emptyBox: { alignItems: 'center', gap: 4, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.line },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy, marginTop: 8 },
    empty: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey, textAlign: 'center', paddingBottom: 10, paddingHorizontal: 8 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
    itemText: { flex: 1, gap: 1 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
    itemStatus: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 17 },
    itemDate: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey },
    itemAmount: { fontFamily: fonts.bold, fontSize: 14 },
    strike: { textDecorationLine: 'line-through' },
});
