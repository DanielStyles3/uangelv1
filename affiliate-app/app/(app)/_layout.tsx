import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { AffiliateContext } from '@/lib/affiliate';
import { AffiliateSummary, getSummary, signOut } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

type Phase =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; summary: AffiliateSummary | null };

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        let alive = true;
        getSummary()
            .then((summary) => alive && setPhase({ kind: 'ready', summary }))
            .catch((e) => alive && setPhase({ kind: 'error', message: errorMessage(e) }));
        return () => {
            alive = false;
        };
    }, []);

    const refresh = useCallback(async () => {
        const summary = await getSummary();
        setPhase({ kind: 'ready', summary });
    }, []);

    const retry = async () => {
        setRetrying(true);
        try {
            await refresh();
        } catch (e) {
            setPhase({ kind: 'error', message: errorMessage(e) });
        } finally {
            setRetrying(false);
        }
    };

    const summary = phase.kind === 'ready' ? phase.summary : null;
    const value = useMemo(() => ({ summary, refresh }), [summary, refresh]);

    if (phase.kind === 'loading') {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.orange} />
            </View>
        );
    }

    if (phase.kind === 'error') {
        return (
            <View style={styles.center}>
                <Ionicons name="cloud-offline-outline" size={44} color={colors.orange} />
                <Text style={styles.title}>Couldn’t load your account</Text>
                <Text style={styles.body}>{phase.message}</Text>
                <Button title="Try again" loading={retrying} onPress={retry} style={styles.button} />
                <Button title="Sign out" variant="ghost" onPress={() => signOut().catch(() => {})} />
            </View>
        );
    }

    const joined = !!summary;

    return (
        <AffiliateContext.Provider value={value}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Protected guard={joined}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="withdraw" />
                </Stack.Protected>
                <Stack.Protected guard={!joined}>
                    <Stack.Screen name="join" />
                </Stack.Protected>
            </Stack>
        </AffiliateContext.Provider>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, backgroundColor: colors.bg },
    title: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy, textAlign: 'center', marginTop: 6 },
    body: { fontFamily: fonts.semibold, fontSize: 14, color: colors.grey, textAlign: 'center', lineHeight: 20 },
    button: { alignSelf: 'stretch', marginTop: 10 },
});
