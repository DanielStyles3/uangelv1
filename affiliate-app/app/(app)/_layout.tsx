import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, Text, View } from 'react-native';

import brandLogo from '@/assets/images/uangel-affiliates-logo-white.png';

import { Button } from '@/components/ui';
import { AffiliateContext } from '@/lib/affiliate';
import { useAuth } from '@/lib/auth';
import { AffiliateSummary, getSummary, signOut } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { clearOrderCache } from '@/lib/orders';
import { colors, fonts } from '@/lib/theme';

type Phase =
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; summary: AffiliateSummary | null };

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
    const { session } = useAuth();
    const segments = useSegments();
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
    const [retrying, setRetrying] = useState(false);
    const signedIn = !!session;
    // A different sign-in state: start from "loading" so no previous account's data shows
    // (adjusted while rendering, not in an effect).
    const [prevSignedIn, setPrevSignedIn] = useState(signedIn);
    if (prevSignedIn !== signedIn) {
        setPrevSignedIn(signedIn);
        setPhase({ kind: 'loading' });
    }

    useEffect(() => {
        clearOrderCache(); // never show one account's customers' orders to another
        if (!signedIn) return;
        let alive = true;
        getSummary()
            .then((summary) => alive && setPhase({ kind: 'ready', summary }))
            .catch((e) => alive && setPhase({ kind: 'error', message: errorMessage(e) }));
        return () => {
            alive = false;
        };
    }, [signedIn]);

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

    // Signed out → Sign in.
    if (!signedIn) return <Redirect href="/sign-in" />;

    if (phase.kind === 'loading') {
        // Brand screen (same orange as the splash) instead of a spinner while the account loads.
        return (
            <View style={styles.brand} accessibilityLabel="Loading your account">
                <StatusBar style="light" />
                <Image source={brandLogo} style={styles.brandLogo} resizeMode="contain" />
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

    // Approved (active, or blocked later) = joined. Not applied, waiting or not approved → the Join screen.
    const joined = !!summary && (summary.status === 'active' || summary.status === 'blocked');
    const onJoin = (segments as string[]).includes('join');
    // Not an affiliate yet → Join. Already joined but on Join → Earnings.
    if (!joined && !onJoin) return <Redirect href="/join" />;
    if (joined && onJoin) return <Redirect href="/" />;

    return (
        <AffiliateContext.Provider value={value}>
            {/* Share, Payouts, a customer's orders and an order's breakdown slide in from the right over the tabs,
                which keep their state underneath. */}
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="share" options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: colors.white } }} />
                <Stack.Screen name="withdraw" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="customer/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="order/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="personal" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="password" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="policy" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="join" options={{ animation: 'fade' }} />
            </Stack>
        </AffiliateContext.Provider>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, backgroundColor: colors.bg },
    brand: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orange },
    brandLogo: { width: 220, height: 220 },
    title: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy, textAlign: 'center', marginTop: 6 },
    body: { fontFamily: fonts.semibold, fontSize: 14, color: colors.grey, textAlign: 'center', lineHeight: 20 },
    button: { alignSelf: 'stretch', marginTop: 10 },
});
