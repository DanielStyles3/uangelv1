import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Enter } from '@/components/motion';
import { GUTTER, ScreenHeader, useHeaderScroll } from '@/components/Screen';
import { Avatar, Button, Card, Chip, IconBubble, Notice } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { getReferrals, Referral } from '@/lib/api';
import { errorMessage, formatDate, formatNaira } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

type State = { items: Referral[]; now: number } | null;

const AVATARS = [
    { bg: colors.orangeSoft, fg: colors.orangeDark },
    { bg: colors.blueSoft, fg: colors.blue },
    { bg: colors.greenSoft, fg: colors.green },
    { bg: colors.amberSoft, fg: colors.amber },
];

export default function Referrals() {
    const router = useRouter();
    const { summary, refresh } = useAffiliate();
    const { scrollY, onScroll } = useHeaderScroll();
    const [state, setState] = useState<State>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const items = await getReferrals();
            setState({ items, now: Date.now() });
            setError(null);
        } catch (e) {
            setError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        getReferrals()
            .then((items) => alive && setState({ items, now: Date.now() }))
            .catch((e) => alive && setError(errorMessage(e)));
        return () => {
            alive = false;
        };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([load(), refresh().catch(() => {})]);
        setRefreshing(false);
    };

    const top = (
        <View style={styles.top}>
            {summary ? (
                <Enter index={0}>
                    <Card style={styles.stats}>
                        <Stat value={String(summary.referrals)} label={Number(summary.referrals) === 1 ? 'Person joined' : 'People joined'} />
                        <View style={styles.statLine} />
                        <Stat value={String(summary.active_referrals)} label="Still earning" />
                        <View style={styles.statLine} />
                        <Stat value={formatNaira(summary.total_earned)} label="Earned so far" />
                    </Card>
                </Enter>
            ) : null}
            <Enter index={1}>
                <Text style={styles.lead}>
                    People who signed up with your code{summary ? ` ${summary.code}` : ''}. You earn up to 5% on their paid orders.
                </Text>
            </Enter>
            {error ? <Notice tone="red" icon="cloud-offline-outline" text={error} /> : null}
        </View>
    );

    const empty = !state ? (
        error ? undefined : (
            <View style={styles.loading}>
                <ActivityIndicator color={colors.orange} />
            </View>
        )
    ) : (
        <Enter index={2}>
            <Card style={styles.emptyCard}>
                <IconBubble name="people-outline" size={60} />
                <Text style={styles.emptyTitle}>No referrals yet</Text>
                <Text style={styles.emptyBody}>
                    Share your code and link with people on WhatsApp, Instagram or your status. Customers must sign up in the
                    U Angel Foods app with your code before their first order, then they appear here.
                </Text>
                <Button title="Share my code" icon="share-social-outline" onPress={() => router.push('/share')} style={styles.emptyBtn} />
            </Card>
        </Enter>
    );

    return (
        <View style={styles.screen}>
            <ScreenHeader title="Referrals" kicker="People you invited" scrollY={scrollY} />
            <Animated.FlatList
                style={styles.flex}
                contentContainerStyle={styles.content}
                data={state?.items ?? []}
                keyExtractor={(item, i) => `${item.joined_at}-${i}`}
                ListHeaderComponent={top}
                ListEmptyComponent={empty}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />}
                renderItem={({ item, index }) => {
                    const avatar = AVATARS[index % AVATARS.length];
                    const orders = Number(item.orders);
                    return (
                        <Enter index={index + 2}>
                            <Card style={styles.row}>
                                <View style={styles.rowTop}>
                                    <Avatar name={item.customer} bg={avatar.bg} fg={avatar.fg} />
                                    <View style={styles.rowText}>
                                        <Text style={styles.name} numberOfLines={1}>{item.customer}</Text>
                                        <Text style={styles.sub}>Joined {formatDate(item.joined_at)}</Text>
                                    </View>
                                    <View style={styles.right}>
                                        <Text style={[styles.earned, Number(item.earned) <= 0 && styles.earnedNone]}>{formatNaira(item.earned)}</Text>
                                        <Text style={styles.sub}>earned</Text>
                                    </View>
                                </View>
                                <View style={styles.rowFoot}>
                                    <View style={styles.flex} />
                                    <Chip label={`${orders} ${orders === 1 ? 'order' : 'orders'}`} tone={orders > 0 ? 'orange' : 'grey'} />
                                </View>
                            </Card>
                        </Enter>
                    );
                }}
            />
        </View>
    );
}

function Stat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 32, gap: 12 },
    top: { gap: 12 },
    lead: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey },
    loading: { paddingVertical: 40 },

    stats: { flexDirection: 'row', alignItems: 'center', gap: 0, paddingHorizontal: 8 },
    stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
    statValue: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
    statLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey },
    statLine: { width: 1, height: 30, backgroundColor: colors.line },

    emptyCard: { alignItems: 'center', padding: 22, gap: 8 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, marginTop: 6 },
    emptyBody: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey, textAlign: 'center' },
    emptyBtn: { alignSelf: 'stretch', marginTop: 8 },

    row: { borderRadius: 22, padding: 14, gap: 12 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { flex: 1, gap: 1 },
    name: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    sub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },
    right: { alignItems: 'flex-end', gap: 1 },
    earned: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
    earnedNone: { color: colors.grey },
    rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
});
