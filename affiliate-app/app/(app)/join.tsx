import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Enter } from '@/components/motion';
import { Button, IconBubble, IconName, SectionLabel } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { becomeAffiliate, signOut } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatDate } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

const STEPS: { icon: IconName; title: string; body: string; green?: boolean }[] = [
    {
        icon: 'share-social-outline',
        title: 'Share your link or code',
        body: 'WhatsApp, Instagram, your status, anywhere.',
    },
    {
        icon: 'bag-handle-outline',
        title: 'Friends sign up and order',
        body: 'Your friend must sign up in the U Angel Foods app with your code before their first order. You then earn on their orders for 12 months.',
    },
    {
        icon: 'card-outline',
        title: 'You earn after delivery',
        body: '5% of the food total of every paid order. Withdraw to any Nigerian bank from ₦2,000.',
        green: true,
    },
];

/** Where the application stands, shown in a card at the top of the Join screen. */
function StatusCard({ status, appliedAt, note }: { status: 'pending' | 'rejected'; appliedAt?: string; note?: string | null }) {
    const pending = status === 'pending';
    return (
        <Enter index={0} style={[styles.statusCard, pending ? styles.statusPending : styles.statusRejected]}>
            <View style={styles.statusTop}>
                <IconBubble
                    name={pending ? 'hourglass-outline' : 'close-circle-outline'}
                    bg={pending ? colors.amberSoft : colors.redSoft}
                    color={pending ? colors.amber : colors.red}
                />
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.statusTitle}>{pending ? 'Application received' : 'Not approved this time'}</Text>
                    <Text style={styles.statusSub}>
                        {pending
                            ? `Sent ${appliedAt ? formatDate(appliedAt) : 'just now'} · waiting for review`
                            : 'You can fix this and apply again below.'}
                    </Text>
                </View>
            </View>
            {pending ? (
                <Text style={styles.statusBody}>
                    Our team checks every application. As soon as you’re approved, your code appears here and you can start sharing.
                </Text>
            ) : note ? (
                <View style={styles.reason}>
                    <Text style={styles.reasonLabel}>REASON</Text>
                    <Text style={styles.reasonText}>{note}</Text>
                </View>
            ) : null}
        </Enter>
    );
}

export default function Join() {
    const insets = useSafeAreaInsets();
    const { session } = useAuth();
    const { summary, refresh } = useAffiliate();
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState(false);

    const firstName = displayName(session).split(' ')[0];
    const state: 'new' | 'pending' | 'rejected' =
        summary?.status === 'pending' ? 'pending' : summary?.status === 'rejected' ? 'rejected' : 'new';

    // Waiting for approval: check again whenever they come back to the app.
    useEffect(() => {
        if (state !== 'pending') return;
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') refresh().catch(() => {});
        });
        return () => sub.remove();
    }, [state, refresh]);

    const join = async () => {
        if (!agreed) return Alert.alert('One more thing', 'Please tick the box to agree to the affiliate terms.');
        setBusy(true);
        try {
            await becomeAffiliate();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await refresh(); // now pending: this screen shows "Application received"
        } catch (e) {
            Alert.alert('Couldn’t send your application', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const check = async () => {
        setChecking(true);
        try {
            await refresh(); // approved → the layout opens the dashboard
        } catch (e) {
            Alert.alert('Couldn’t check just now', errorMessage(e));
        } finally {
            setChecking(false);
        }
    };

    const confirmSignOut = () =>
        Alert.alert('Sign out?', 'You can sign back in at any time.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => signOut().catch(() => {}) },
        ]);

    return (
        <View style={styles.screen}>
            <StatusBar style="light" />
            {/* Solid strip behind the status bar, so scrolled content never shows under the clock. */}
            <View style={[styles.statusStrip, { height: insets.top }]} />
            <ScrollView
                contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
                showsVerticalScrollIndicator={false}
                refreshControl={state === 'pending' ? <RefreshControl refreshing={checking} onRefresh={check} tintColor={colors.white} colors={[colors.orange]} /> : undefined}
            >
                <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
                    <View style={styles.circle} />
                    <View style={styles.headerTop}>
                        <Text style={styles.hello}>Hi {firstName}</Text>
                        <TouchableOpacity onPress={confirmSignOut} style={styles.signOut} accessibilityLabel="Sign out">
                            <Ionicons name="log-out-outline" size={20} color={colors.navy} />
                        </TouchableOpacity>
                    </View>
                    <Enter index={0} style={styles.headerText}>
                        <Text style={styles.kicker}>U ANGEL AFFILIATES</Text>
                        <Text style={styles.h1}>Share the food.{'\n'}Earn. Feed someone.</Text>
                        <Text style={styles.lead}>Earn 5% on every order placed with your code, paid to your bank.</Text>
                    </Enter>
                </View>

                {state !== 'new' ? (
                    <StatusCard status={state} appliedAt={summary?.applied_at} note={summary?.review_note} />
                ) : null}

                <Enter index={1} style={[styles.howCard, state !== 'new' && styles.howCardBelow]}>
                    <SectionLabel>How it works</SectionLabel>
                    {STEPS.map((s) => (
                        <View key={s.title} style={styles.step}>
                            <IconBubble
                                name={s.icon}
                                bg={s.green ? colors.greenSoft : colors.orangeSoft}
                                color={s.green ? colors.green : colors.orange}
                            />
                            <View style={styles.stepText}>
                                <Text style={styles.stepTitle}>{s.title}</Text>
                                <Text style={styles.stepBody}>{s.body}</Text>
                            </View>
                        </View>
                    ))}
                </Enter>

                <Enter index={2} style={styles.heart}>
                    <Ionicons name="heart" size={18} color={colors.orange} />
                    <Text style={styles.heartText}>Every order you bring in helps feed someone in need.</Text>
                </Enter>

                {state !== 'pending' ? (
                    <TouchableOpacity
                        style={styles.terms}
                        onPress={() => setAgreed((a) => !a)}
                        activeOpacity={0.7}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: agreed }}
                    >
                        <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.orange : colors.greyLight} />
                        <Text style={styles.termsText}>
                            I agree to the affiliate terms: no self-referrals, no spam, earnings paid after delivery.
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
                {state === 'pending' ? (
                    <>
                        <Button title="Check my application" variant="outline" icon="refresh" loading={checking} onPress={check} />
                        <Text style={styles.bottomNote}>We’ll let you in as soon as you’re approved.</Text>
                    </>
                ) : (
                    <>
                        <Button title={state === 'rejected' ? 'Apply again' : 'Apply to join'} loading={busy} disabled={!agreed} onPress={join} />
                        <Text style={styles.bottomNote}>Free to join. You get your code once we approve you.</Text>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.white },
    statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.orange, zIndex: 2 },
    header: { backgroundColor: colors.orange, paddingHorizontal: 20, paddingBottom: 72, gap: 18, overflow: 'hidden' },
    circle: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(255,255,255,0.1)',
        right: -90,
        top: -110,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hello: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
    signOut: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    headerText: { gap: 8 },
    kicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: 'rgba(255,255,255,0.88)' },
    h1: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, color: colors.white },
    lead: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 21, color: 'rgba(255,255,255,0.92)' },

    howCard: {
        marginTop: -48,
        marginHorizontal: 20,
        backgroundColor: colors.white,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: 18,
        gap: 14,
        boxShadow: '0px 10px 24px rgba(24, 28, 46, 0.10)',
    },
    howCardBelow: { marginTop: 16 },

    statusCard: {
        marginTop: -48,
        marginHorizontal: 20,
        backgroundColor: colors.white,
        borderRadius: 24,
        borderWidth: 1.5,
        padding: 18,
        gap: 12,
        boxShadow: '0px 10px 24px rgba(24, 28, 46, 0.10)',
    },
    statusPending: { borderColor: '#FCD34D' },
    statusRejected: { borderColor: '#FCA5A5' },
    statusTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
    statusSub: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.grey },
    statusBody: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.grey },
    reason: { backgroundColor: colors.redSoft, borderRadius: 14, padding: 12, gap: 4 },
    reasonLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: colors.red },
    reasonText: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.navy },

    step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    stepText: { flex: 1, gap: 2 },
    stepTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    stepBody: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.grey },

    heart: {
        marginTop: 18,
        marginHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.orangeSoft,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    heartText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.orangeText },

    terms: { marginTop: 16, marginHorizontal: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    termsText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey },

    bottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 12,
        paddingHorizontal: 20,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 10,
    },
    bottomNote: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },
});
