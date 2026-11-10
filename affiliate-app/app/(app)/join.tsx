import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconBubble, IconName, SectionLabel } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { becomeAffiliate, signOut } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { colors, fonts, shadow } from '@/lib/theme';

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

export default function Join() {
    const insets = useSafeAreaInsets();
    const { session } = useAuth();
    const { refresh } = useAffiliate();
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState(false);

    const firstName = displayName(session).split(' ')[0];

    const join = async () => {
        if (!agreed) return Alert.alert('One more thing', 'Please tick the box to agree to the affiliate terms.');
        setBusy(true);
        try {
            await becomeAffiliate();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await refresh(); // the layout now shows the dashboard
        } catch (e) {
            Alert.alert('Couldn’t join just now', errorMessage(e));
            setBusy(false);
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
            <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} bounces={false}>
                <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
                    <View style={styles.circle} />
                    <View style={styles.headerTop}>
                        <Text style={styles.hello}>Hi {firstName}</Text>
                        <TouchableOpacity onPress={confirmSignOut} style={styles.signOut} accessibilityLabel="Sign out">
                            <Ionicons name="log-out-outline" size={20} color={colors.navy} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.kicker}>U ANGEL AFFILIATES</Text>
                        <Text style={styles.h1}>Share the food.{'\n'}Earn. Feed someone.</Text>
                        <Text style={styles.lead}>Earn 5% on every order placed with your code, paid to your bank.</Text>
                    </View>
                </View>

                <View style={styles.howCard}>
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
                </View>

                <View style={styles.heart}>
                    <Ionicons name="heart" size={18} color={colors.orange} />
                    <Text style={styles.heartText}>Every order you bring in helps feed someone in need.</Text>
                </View>

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
            </ScrollView>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
                <Button title="Join and get my code" loading={busy} disabled={!agreed} onPress={join} />
                <Text style={styles.bottomNote}>Free to join. You get your code straight away.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.white },
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
        padding: 18,
        gap: 14,
        ...shadow,
        shadowOpacity: 0.12,
        shadowRadius: 20,
    },
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
    heartText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.orangeText },

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
