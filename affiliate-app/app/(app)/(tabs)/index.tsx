import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, IconBubble, Notice, SectionLabel } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { Commission, getCommissions } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatNaira, formatRate, formatShortDate } from '@/lib/format';
import { commissionChip } from '@/lib/status';
import { colors, fonts, referralLink, shareMessage } from '@/lib/theme';

type Earnings = { items: Commission[]; now: number } | null;

export default function Dashboard() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { session } = useAuth();
    const { summary, refresh } = useAffiliate();
    const [earnings, setEarnings] = useState<Earnings>(null);
    const [earningsError, setEarningsError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);

    const loadEarnings = useCallback(async () => {
        try {
            const items = await getCommissions();
            setEarnings({ items, now: Date.now() });
            setEarningsError(null);
        } catch (e) {
            setEarningsError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        getCommissions()
            .then((items) => alive && setEarnings({ items, now: Date.now() }))
            .catch((e) => alive && setEarningsError(errorMessage(e)));
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
            await Promise.all([refresh(), loadEarnings()]);
        } catch (e) {
            Alert.alert('Couldn’t refresh', errorMessage(e));
        } finally {
            setRefreshing(false);
        }
    };

    if (!summary) return null;

    const code = summary.code;
    const link = referralLink(code);
    const blocked = summary.status !== 'active';

    const copyCode = async () => {
        await Clipboard.setStringAsync(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setCopied(true);
    };

    const copyLink = async () => {
        await Clipboard.setStringAsync(link);
        Haptics.selectionAsync().catch(() => {});
        Alert.alert('Link copied', link);
    };

    const shareWhatsApp = async () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareMessage(code))}`;
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Couldn’t open WhatsApp', 'Copy your link and paste it into WhatsApp instead.');
        }
    };

    const shareOther = async () => {
        try {
            await Share.share({ message: shareMessage(code) });
        } catch {
            // Share sheet dismissed or unavailable: nothing to do.
        }
    };

    const firstName = displayName(session).split(' ')[0];

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />}
        >
            <View style={styles.headerRow}>
                <View style={styles.flex}>
                    <Text style={styles.hello}>Hi {firstName}</Text>
                    <Text style={styles.h1}>Earn with U Angel</Text>
                </View>
                <Chip label={blocked ? 'On hold' : 'Active'} tone={blocked ? 'red' : 'green'} />
            </View>

            {blocked ? (
                <Notice
                    tone="red"
                    icon="alert-circle-outline"
                    text="Your affiliate account is on hold, so new orders won’t earn and withdrawals are paused. Please contact us from the Profile tab."
                />
            ) : null}

            {/* Balance */}
            <View style={styles.balance}>
                <View style={styles.balanceGlow} />
                <View style={styles.balanceTop}>
                    <View style={styles.flex}>
                        <Text style={styles.balanceKicker}>AVAILABLE TO WITHDRAW</Text>
                        <Text style={styles.balanceAmount} adjustsFontSizeToFit numberOfLines={1}>
                            {formatNaira(summary.available)}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.withdrawBtn} onPress={() => router.push('/withdraw')} activeOpacity={0.85}>
                        <Text style={styles.withdrawText}>Withdraw</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.balanceGrid}>
                    <BalanceTile label="Pending (not delivered yet)" value={summary.pending} />
                    <BalanceTile label="On hold (7 days after delivery)" value={summary.on_hold} />
                    <BalanceTile label="Paid out so far" value={summary.withdrawn} />
                    <BalanceTile label="Total earned" value={summary.total_earned} />
                </View>
                {summary.open_withdrawal ? (
                    <View style={styles.openRequest}>
                        <Ionicons name="time-outline" size={16} color={colors.peach} />
                        <Text style={styles.openRequestText}>
                            {formatNaira(summary.open_withdrawal.amount)} withdrawal waiting to be paid
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* Code & link */}
            <Card>
                <SectionLabel>Your code & link</SectionLabel>
                <View style={styles.codeRow}>
                    <TouchableOpacity style={styles.codeBox} onPress={copyCode} activeOpacity={0.7} accessibilityLabel={`Your code ${code}. Tap to copy`}>
                        <Text style={styles.codeText} adjustsFontSizeToFit numberOfLines={1}>{code}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.copyBtn} onPress={copyCode} accessibilityLabel="Copy code">
                        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={colors.orange} />
                    </TouchableOpacity>
                </View>
                {copied ? <Text style={styles.copied}>Code copied</Text> : null}
                <TouchableOpacity onPress={copyLink} style={styles.linkRow} hitSlop={6}>
                    <Ionicons name="link-outline" size={16} color={colors.grey} />
                    <Text style={styles.linkText} numberOfLines={1}>{link.replace('https://', '')}</Text>
                    <Text style={styles.linkCopy}>Copy link</Text>
                </TouchableOpacity>
                <View style={styles.shareRow}>
                    <TouchableOpacity style={[styles.shareBtn, styles.shareWhatsApp]} onPress={shareWhatsApp} activeOpacity={0.85}>
                        <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
                        <Text style={[styles.shareText, { color: colors.white }]}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.shareBtn} onPress={shareOther} activeOpacity={0.85}>
                        <Ionicons name="share-social-outline" size={18} color={colors.navy} />
                        <Text style={styles.shareText}>Share</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.note}>
                    Your friend must sign up in the U Angel Foods app with your code before their first order.
                </Text>
            </Card>

            {/* Stats */}
            <View style={styles.stats}>
                <Stat value={String(summary.referrals)} label="Referrals" />
                <Stat value={String(summary.active_referrals)} label="Still earning" />
                <Stat value={formatRate(summary.rate)} label="Your rate" />
            </View>

            {/* Recent earnings */}
            <Card style={styles.listCard}>
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Recent earnings</Text>
                    <TouchableOpacity onPress={() => router.push('/referrals')} hitSlop={8}>
                        <Text style={styles.seeAll}>Referrals</Text>
                    </TouchableOpacity>
                </View>
                {earningsError ? (
                    <Text style={styles.empty}>{earningsError}</Text>
                ) : !earnings ? (
                    <Text style={styles.empty}>Loading…</Text>
                ) : earnings.items.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <IconBubble name="sparkles-outline" />
                        <Text style={styles.empty}>
                            No earnings yet. Share your code: when a friend you referred pays for an order, it shows here.
                        </Text>
                    </View>
                ) : (
                    earnings.items.map((c) => {
                        const chip = commissionChip(c, earnings.now);
                        const cancelled = c.status === 'cancelled';
                        return (
                            <View key={c.id} style={styles.item}>
                                <IconBubble
                                    name={cancelled ? 'close' : c.status === 'pending' ? 'time-outline' : 'checkmark'}
                                    bg={cancelled ? colors.redSoft : c.status === 'pending' ? colors.amberSoft : colors.greenSoft}
                                    color={cancelled ? colors.red : c.status === 'pending' ? colors.amber : colors.green}
                                />
                                <View style={styles.itemText}>
                                    <Text style={styles.itemTitle}>Order · {formatNaira(c.base_amount)}</Text>
                                    <Text style={styles.itemSub}>
                                        {chip.detail} · {formatShortDate(c.created_at)}
                                    </Text>
                                    <Chip label={chip.label} tone={chip.tone} />
                                </View>
                                <Text
                                    style={[
                                        styles.itemAmount,
                                        { color: cancelled ? colors.greyLight : c.status === 'pending' ? colors.amber : colors.green },
                                        cancelled && styles.strike,
                                    ]}
                                >
                                    +{formatNaira(c.amount)}
                                </Text>
                            </View>
                        );
                    })
                )}
            </Card>
        </ScrollView>
    );
}

function BalanceTile({ label, value }: { label: string; value: number | string }) {
    return (
        <View style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileValue}>{formatNaira(value)}</Text>
        </View>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
    flex: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hello: { fontFamily: fonts.semibold, fontSize: 14, color: colors.grey },
    h1: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },

    balance: { backgroundColor: colors.navy, borderRadius: 26, padding: 18, gap: 14, overflow: 'hidden' },
    balanceGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(253,101,42,0.22)',
        right: -60,
        top: -80,
    },
    balanceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    balanceKicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.peach },
    balanceAmount: { fontFamily: fonts.bold, fontSize: 32, color: colors.white, marginTop: 2 },
    withdrawBtn: { backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
    withdrawText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
    balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
    tileLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.navyMuted },
    tileValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
    openRequest: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    openRequestText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.peach },

    codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    codeBox: {
        flex: 1,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.orangeBorder,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    codeText: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 3, color: colors.orangeDark },
    copyBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
    copied: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.green, marginTop: -6 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },
    linkCopy: { fontFamily: fonts.bold, fontSize: 13, color: colors.orange },
    shareRow: { flexDirection: 'row', gap: 8 },
    shareBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: colors.chip,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    shareWhatsApp: { backgroundColor: colors.whatsapp },
    shareText: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
    note: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.grey },

    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
    statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
    statLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey },

    listCard: { paddingVertical: 6, gap: 0 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    listTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    seeAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.orange },
    emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 16 },
    empty: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey, textAlign: 'center', paddingVertical: 10 },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
    itemText: { flex: 1, gap: 4 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
    itemSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },
    itemAmount: { fontFamily: fonts.bold, fontSize: 14 },
    strike: { textDecorationLine: 'line-through' },
});
