import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Fragment, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Enter, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Avatar, Button, Card, CardHeader, Chip, IconBubble, IconName } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { signOut } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatRate } from '@/lib/format';
import { colors, CONTACT, fonts } from '@/lib/theme';

import { notify } from '@/lib/notice';
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

const TERMS: { icon: IconName; text: string }[] = [
    { icon: 'people-circle-outline', text: 'No self-referrals: you can’t use your own code, or create extra accounts to use it.' },
    { icon: 'megaphone-outline', text: 'No spam, misleading claims or paid ads using the U Angel Foods name without our permission.' },
    { icon: 'close-circle-outline', text: 'Cancelled or refunded orders don’t earn, and earnings already made on them are removed.' },
    { icon: 'shield-outline', text: 'We may put an account on hold and withhold earnings if we see abuse.' },
    { icon: 'notifications-outline', text: 'Rates and terms may change; we’ll tell you in the app before they do.' },
];

export default function Profile() {
    const { session } = useAuth();
    const { summary } = useAffiliate();
    const [busy, setBusy] = useState(false);

    const name = displayName(session);
    const email = session?.user.email ?? '';
    const version = Constants.expoConfig?.version ?? '1.0.0';

    const open = (url: string, fallback: string) =>
        Linking.openURL(url).catch(() => notify('Couldn’t open that', fallback));

    const confirmSignOut = () =>
        notify('Sign out?', 'You can sign back in at any time.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out',
                style: 'destructive',
                onPress: async () => {
                    setBusy(true);
                    try {
                        await signOut();
                    } catch (e) {
                        notify('Couldn’t sign out', errorMessage(e));
                        setBusy(false);
                    }
                },
            },
        ]);

    return (
        <Screen title="Profile" kicker="Your account">
            <Enter index={0}>
                <Card style={styles.me}>
                    <View style={styles.meTop}>
                        <Avatar name={name} size={60} />
                        <View style={styles.flex}>
                            <Text style={styles.name} numberOfLines={1}>{name}</Text>
                            <Text style={styles.email} numberOfLines={1}>{email}</Text>
                        </View>
                    </View>
                    {summary ? (
                        <View style={styles.chips}>
                            <Chip large icon="pricetag-outline" label={`Code ${summary.code}`} tone="orange" />
                            <Chip large icon="trending-up-outline" label={`${formatRate(summary.rate)} rate`} tone="green" />
                        </View>
                    ) : null}
                </Card>
            </Enter>

            <Enter index={1}>
                <Card style={styles.rowsCard}>
                    <CardHeader title="How it works" icon="bulb-outline" />
                    <Rows rows={HOW_IT_WORKS} />
                </Card>
            </Enter>

            <Enter index={2}>
                <Card style={styles.rowsCard}>
                    <CardHeader title="Affiliate terms" icon="document-text-outline" />
                    <Rows rows={TERMS} soft />
                </Card>
            </Enter>

            <Enter index={3}>
                <Card style={styles.rowsCard}>
                    <CardHeader title="Questions? Talk to us" icon="chatbubbles-outline" />
                    <View>
                        <ContactRow
                            icon="logo-whatsapp"
                            color={colors.whatsapp}
                            bg={colors.greenSoft}
                            title="WhatsApp"
                            value={CONTACT.whatsappDisplay}
                            onPress={() => open(`https://wa.me/${CONTACT.whatsappIntl}`, `Message us on WhatsApp: ${CONTACT.whatsappDisplay}`)}
                        />
                        <View style={styles.line} />
                        <ContactRow
                            icon="mail-outline"
                            color={colors.orangeDark}
                            bg={colors.orangeSoft}
                            title="Email"
                            value={CONTACT.email}
                            onPress={() => open(`mailto:${CONTACT.email}`, `Email us at ${CONTACT.email}`)}
                        />
                    </View>
                </Card>
            </Enter>

            <Enter index={4} style={styles.footer}>
                <Button title="Sign out" icon="log-out-outline" variant="outline" loading={busy} onPress={confirmSignOut} />
                <Text style={styles.version}>U Angel Affiliates · version {version}</Text>
            </Enter>
        </Screen>
    );
}

function Rows({ rows, soft }: { rows: { icon: IconName; text: string }[]; soft?: boolean }) {
    return (
        <View>
            {rows.map((row, i) => (
                <Fragment key={row.text}>
                    {i > 0 ? <View style={styles.line} /> : null}
                    <View style={styles.row}>
                        <IconBubble
                            name={row.icon}
                            size={34}
                            bg={soft ? colors.chip : colors.orangeSoft}
                            color={soft ? colors.grey : colors.orangeDark}
                        />
                        <Text style={styles.rowText}>{row.text}</Text>
                    </View>
                </Fragment>
            ))}
        </View>
    );
}

function ContactRow({ icon, color, bg, title, value, onPress }: {
    icon: IconName;
    color: string;
    bg: string;
    title: string;
    value: string;
    onPress: () => void;
}) {
    return (
        <PressableScale style={styles.contact} onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${title}: ${value}`}>
            <IconBubble name={icon} size={40} bg={bg} color={color} />
            <View style={styles.flex}>
                <Text style={styles.contactTitle}>{title}</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.greyLight} />
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    me: { gap: 14 },
    meTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    name: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
    email: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey, marginTop: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },

    rowsCard: { gap: 6 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 },
    rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 20, color: colors.navy },
    line: { height: 1, backgroundColor: colors.line },

    contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    contactTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.navy },
    contactValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },

    footer: { gap: 12, marginTop: 4 },
    version: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.greyLight },
});
