import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconBubble } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { getReferrals, Referral } from '@/lib/api';
import { errorMessage, formatDate, formatNaira, initials } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

type State = { items: Referral[]; now: number } | null;

const AVATARS = [
    { bg: colors.orangeSoft, fg: colors.orangeDark },
    { bg: colors.blueSoft, fg: colors.blue },
    { bg: colors.greenSoft, fg: colors.green },
    { bg: colors.amberSoft, fg: colors.amber },
];

export default function Referrals() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { summary } = useAffiliate();
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
        await load();
        setRefreshing(false);
    };

    const header = (
        <View style={styles.header}>
            <Text style={styles.h1}>Your referrals</Text>
            <Text style={styles.lead}>
                Friends who signed up with your code{summary ? ` ${summary.code}` : ''}. You earn on their paid orders for 12 months from the day they joined.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );

    const empty = !state ? (
        error ? undefined : (
            <View style={styles.loading}>
                <ActivityIndicator color={colors.orange} />
            </View>
        )
    ) : (
        <View style={styles.emptyCard}>
            <IconBubble name="people-outline" size={56} />
            <Text style={styles.emptyTitle}>No referrals yet</Text>
            <Text style={styles.emptyBody}>
                Share your code or link on WhatsApp, Instagram or your status. Your friend must sign up in the U Angel Foods app
                with your code before their first order, then they appear here.
            </Text>
            <Button title="Share my code" icon="share-social-outline" onPress={() => router.push('/')} style={styles.emptyBtn} />
        </View>
    );

    return (
        <FlatList
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
            data={state?.items ?? []}
            keyExtractor={(item, i) => `${item.joined_at}-${i}`}
            ListHeaderComponent={header}
            ListEmptyComponent={empty}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />}
            renderItem={({ item, index }) => {
                const active = new Date(item.expires_at).getTime() > (state?.now ?? 0);
                const avatar = AVATARS[index % AVATARS.length];
                const orders = Number(item.orders);
                return (
                    <View style={styles.row}>
                        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
                            <Text style={[styles.avatarText, { color: avatar.fg }]}>{initials(item.customer)}</Text>
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.name}>{item.customer}</Text>
                            <Text style={styles.sub}>Joined {formatDate(item.joined_at)}</Text>
                            <View style={styles.metaRow}>
                                <Ionicons name={active ? 'time-outline' : 'stop-circle-outline'} size={13} color={active ? colors.green : colors.greyLight} />
                                <Text style={[styles.meta, { color: active ? colors.green : colors.greyLight }]}>
                                    {active ? `Earning until ${formatDate(item.expires_at)}` : `Ended ${formatDate(item.expires_at)}`}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.right}>
                            <Text style={styles.earned}>{formatNaira(item.earned)}</Text>
                            <Chip label={`${orders} ${orders === 1 ? 'order' : 'orders'}`} tone={orders > 0 ? 'orange' : 'grey'} />
                        </View>
                    </View>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
    header: { gap: 6, marginBottom: 6 },
    h1: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },
    lead: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey },
    error: { fontFamily: fonts.bold, fontSize: 13, color: colors.red, marginTop: 4 },
    loading: { paddingVertical: 40 },

    emptyCard: { backgroundColor: colors.white, borderRadius: 22, padding: 22, alignItems: 'center', gap: 10 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy, marginTop: 4 },
    emptyBody: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.grey, textAlign: 'center' },
    emptyBtn: { alignSelf: 'stretch', marginTop: 6 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 18, padding: 14 },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.bold, fontSize: 14 },
    rowText: { flex: 1, gap: 2 },
    name: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    sub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { fontFamily: fonts.bold, fontSize: 12 },
    right: { alignItems: 'flex-end', gap: 6 },
    earned: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
});
