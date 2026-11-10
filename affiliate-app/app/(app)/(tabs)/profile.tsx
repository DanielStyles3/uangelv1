import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, IconBubble, IconName, SectionLabel } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { signOut } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatRate, initials } from '@/lib/format';
import { colors, CONTACT, fonts } from '@/lib/theme';

const HOW_IT_WORKS: { icon: IconName; text: string }[] = [
    { icon: 'share-social-outline', text: 'Share your code or link with friends, family and followers.' },
    {
        icon: 'person-add-outline',
        text: 'Your friend must sign up in the U Angel Foods app with your code before their first order. Codes can’t be added to existing customers.',
    },
    { icon: 'calendar-outline', text: 'Each friend is linked to you for 12 months from the day they sign up.' },
    {
        icon: 'cash-outline',
        text: 'You earn your rate on the food total of every order they pay for. Delivery fees and Christmas giving packs don’t count.',
    },
    {
        icon: 'time-outline',
        text: 'Earnings show as Pending once the order is paid, then go On hold when it’s delivered. They become available to withdraw 7 days after delivery.',
    },
    {
        icon: 'business-outline',
        text: 'Withdraw from ₦2,000 to any Nigerian bank account, one request at a time. We check it and send the money by bank transfer.',
    },
];

const TERMS = [
    'No self-referrals: you can’t use your own code, or create extra accounts to use it.',
    'No spam, misleading claims or paid ads using the U Angel Foods name without our permission.',
    'Cancelled or refunded orders don’t earn, and earnings already made on them are removed.',
    'We may put an account on hold and withhold earnings if we see abuse.',
    'Rates and terms may change; we’ll tell you in the app before they do.',
];

export default function Profile() {
    const insets = useSafeAreaInsets();
    const { session } = useAuth();
    const { summary } = useAffiliate();
    const [busy, setBusy] = useState(false);

    const name = displayName(session);
    const email = session?.user.email ?? '';
    const version = Constants.expoConfig?.version ?? '1.0.0';

    const open = (url: string, fallback: string) =>
        Linking.openURL(url).catch(() => Alert.alert('Couldn’t open that', fallback));

    const confirmSignOut = () =>
        Alert.alert('Sign out?', 'You can sign back in at any time.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out',
                style: 'destructive',
                onPress: async () => {
                    setBusy(true);
                    try {
                        await signOut();
                    } catch (e) {
                        Alert.alert('Couldn’t sign out', errorMessage(e));
                        setBusy(false);
                    }
                },
            },
        ]);

    return (
        <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
            <Text style={styles.h1}>Profile</Text>

            <Card style={styles.me}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(name)}</Text>
                </View>
                <View style={styles.flex}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.email} numberOfLines={1}>{email}</Text>
                    {summary ? (
                        <Text style={styles.code}>
                            Code {summary.code} · {formatRate(summary.rate)} rate
                        </Text>
                    ) : null}
                </View>
            </Card>

            <Card>
                <SectionLabel>How it works</SectionLabel>
                {HOW_IT_WORKS.map((row) => (
                    <View key={row.icon} style={styles.row}>
                        <IconBubble name={row.icon} size={32} />
                        <Text style={styles.rowText}>{row.text}</Text>
                    </View>
                ))}
            </Card>

            <Card>
                <SectionLabel>Affiliate terms</SectionLabel>
                {TERMS.map((t) => (
                    <View key={t} style={styles.term}>
                        <View style={styles.bullet} />
                        <Text style={styles.rowText}>{t}</Text>
                    </View>
                ))}
            </Card>

            <Card style={styles.contactCard}>
                <SectionLabel>Questions? Talk to us</SectionLabel>
                <ContactRow
                    icon="logo-whatsapp"
                    color={colors.whatsapp}
                    title="WhatsApp"
                    value={CONTACT.whatsappDisplay}
                    onPress={() => open(`https://wa.me/${CONTACT.whatsappIntl}`, `Message us on WhatsApp: ${CONTACT.whatsappDisplay}`)}
                />
                <ContactRow
                    icon="mail-outline"
                    color={colors.orange}
                    title="Email"
                    value={CONTACT.email}
                    onPress={() => open(`mailto:${CONTACT.email}`, `Email us at ${CONTACT.email}`)}
                />
            </Card>

            <Button title="Sign out" icon="log-out-outline" variant="secondary" loading={busy} onPress={confirmSignOut} />
            <Text style={styles.version}>U Angel Affiliates · version {version}</Text>
        </ScrollView>
    );
}

function ContactRow({ icon, color, title, value, onPress }: {
    icon: IconName;
    color: string;
    title: string;
    value: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.contact} onPress={onPress} activeOpacity={0.7}>
            <Ionicons name={icon} size={22} color={color} />
            <View style={styles.flex}>
                <Text style={styles.contactTitle}>{title}</Text>
                <Text style={styles.contactValue}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.greyLight} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
    flex: { flex: 1 },
    h1: { fontFamily: fonts.bold, fontSize: 22, color: colors.navy },

    me: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
    name: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
    email: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },
    code: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.orangeDark, marginTop: 2 },

    row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.navy },
    term: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange, marginTop: 7 },

    contactCard: { gap: 4 },
    contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    contactTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.navy },
    contactValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },

    version: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.greyLight },
});
