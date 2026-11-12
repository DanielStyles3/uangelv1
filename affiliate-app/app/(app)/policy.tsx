import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Enter } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Card, CardHeader, IconBubble, IconName } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

const HOW_IT_WORKS: { icon: IconName; title: string; text: string }[] = [
    { icon: 'share-social-outline', title: 'Share your code and link', text: 'Send it to family, friends and followers: WhatsApp, Instagram, your status, anywhere.' },
    { icon: 'person-add-outline', title: 'Customers must sign up with it', text: 'They enter your code (or open your link) when they create their U Angel Foods account. It can’t be added later, and their email must be confirmed.' },
    { icon: 'link-outline', title: 'They’re linked to you for good', text: 'Every order they pay for earns you commission, for as long as they shop with us.' },
    { icon: 'pricetags-outline', title: 'You earn up to 5% per product', text: 'Each product has its own rate (up to 5%), depending on its margin. Delivery fees and Christmas giving packs don’t earn.' },
    { icon: 'search-outline', title: 'We review every order', text: 'After delivery, U Angel Foods checks the order and confirms your commission. Until then you see an estimate (“Being reviewed”).' },
    { icon: 'time-outline', title: 'Ready 7 days after delivery', text: 'Confirmed commission becomes available to withdraw 7 days after the order is delivered.' },
    { icon: 'business-outline', title: 'Withdraw to your bank', text: 'From ₦2,000, to any Nigerian bank account, one request at a time. We send it by bank transfer.' },
];

const TERMS: { icon: IconName; text: string }[] = [
    { icon: 'people-circle-outline', text: 'No self-referrals: you can’t use your own code, or create extra accounts to use it.' },
    { icon: 'megaphone-outline', text: 'No spam, misleading claims or paid ads using the U Angel Foods name without our permission.' },
    { icon: 'close-circle-outline', text: 'Cancelled or refunded orders don’t earn, and commission recorded on them is removed.' },
    { icon: 'calculator-outline', text: 'Commission rates vary by product (up to 5%) and are confirmed by U Angel Foods for each order. The confirmed amount is final.' },
    { icon: 'shield-outline', text: 'We may put an account on hold and withhold earnings if we see abuse.' },
    { icon: 'notifications-outline', text: 'Rates and terms may change; we’ll tell you in the app before they do.' },
];

function HowItWorks() {
    return (
        <Card style={styles.card}>
            <CardHeader title="How it works" icon="bulb-outline" />
            {HOW_IT_WORKS.map((s, i) => (
                <Fragment key={s.title}>
                    {i > 0 ? <View style={styles.line} /> : null}
                    <View style={styles.row}>
                        <IconBubble name={s.icon} size={36} />
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.title}>{s.title}</Text>
                            <Text style={styles.text}>{s.text}</Text>
                        </View>
                    </View>
                </Fragment>
            ))}
        </Card>
    );
}

function Terms() {
    return (
        <Card style={styles.card}>
            <CardHeader title="Rules" icon="document-text-outline" />
            {TERMS.map((t, i) => (
                <Fragment key={t.text}>
                    {i > 0 ? <View style={styles.line} /> : null}
                    <View style={styles.row}>
                        <IconBubble name={t.icon} size={34} bg={colors.chip} color={colors.grey} />
                        <Text style={[styles.text, { flex: 1, color: colors.navy }]}>{t.text}</Text>
                    </View>
                </Fragment>
            ))}
        </Card>
    );
}

/** The affiliate policy: one screen with how the programme works, then the rules. */
export default function Policy() {
    const router = useRouter();
    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

    return (
        <Screen stack title="Affiliate policy" onBack={goBack}>
            <Enter index={0}><HowItWorks /></Enter>
            <Enter index={1}><Terms /></Enter>
        </Screen>
    );
}

const styles = StyleSheet.create({
    card: { gap: 4 },
    row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
    num: { fontFamily: fonts.bold, fontSize: 11, color: colors.greyLight, marginTop: 4 },
    title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.navy },
    text: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey },
    line: { height: 1, backgroundColor: colors.line },
});
