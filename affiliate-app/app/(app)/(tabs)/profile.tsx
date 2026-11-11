import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { CountUpNaira, Enter, PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Avatar, Button, Card, Chip, IconBubble, IconName } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { getMyProfile, MyProfile, signOut } from '@/lib/api';
import { displayName, useAuth } from '@/lib/auth';
import { errorMessage, formatDate } from '@/lib/format';
import { notify } from '@/lib/notice';
import { colors, CONTACT, fonts } from '@/lib/theme';

type Row = { icon: IconName; title: string; value?: string; onPress: () => void; tone?: 'orange' | 'green' | 'navy' };

/** Profile: who you are, your affiliate account at a glance, settings, payouts, help and the programme policy. */
export default function Profile() {
    const router = useRouter();
    const { session } = useAuth();
    const { summary, refresh } = useAffiliate();
    const [profile, setProfile] = useState<MyProfile | null>(null);
    const [busy, setBusy] = useState(false);

    // Re-read name/phone whenever the tab comes back into view (e.g. after editing them).
    useFocusEffect(
        useCallback(() => {
            let alive = true;
            getMyProfile().then((p) => alive && setProfile(p)).catch(() => {});
            return () => { alive = false; };
        }, []),
    );

    const name = profile?.name || displayName(session);
    const email = session?.user.email ?? profile?.email ?? '';
    const phone = profile?.phone ?? '';
    const version = Constants.expoConfig?.version ?? '1.0.0';
    const code = summary?.code ?? '';
    const blocked = summary?.status === 'blocked';
    const since = summary?.reviewed_at ?? summary?.applied_at ?? null;
    const hasBank = !!summary?.account_number;

    const open = (url: string, fallback: string) => Linking.openURL(url).catch(() => notify('Couldn’t open that', fallback));

    const copyCode = async () => {
        if (!code) return;
        await Clipboard.setStringAsync(code).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        notify('Code copied', `${code} is on your clipboard. Paste it anywhere to share.`, undefined, { tone: 'success' });
    };

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

    const account: Row[] = [
        { icon: 'person-outline', title: 'Personal details', value: phone ? `${name} · ${phone}` : 'Add your phone number', onPress: () => router.push('/personal') },
        { icon: 'lock-closed-outline', title: 'Change password', onPress: () => router.push('/password') },
    ];
    const money: Row[] = [
        // One place for money out: bank account, withdraw and history all live on the same screen.
        {
            icon: 'wallet-outline',
            title: 'Withdraw',
            value: hasBank ? `To ${summary?.bank_name} · ••••${String(summary?.account_number).slice(-4)}` : 'Add your bank account to get paid',
            onPress: () => router.push('/withdraw'),
            tone: 'green',
        },
        { icon: 'share-social-outline', title: 'Share my code', value: 'Link, QR code and WhatsApp', onPress: () => router.push('/share') },
    ];
    const programme: Row[] = [
        // How it works and the terms are one screen, so one row.
        { icon: 'document-text-outline', title: 'Affiliate policy', value: 'How it works and the terms', onPress: () => router.push('/policy'), tone: 'navy' },
    ];
    const help: Row[] = [
        { icon: 'logo-whatsapp', title: 'WhatsApp', value: CONTACT.whatsappDisplay, onPress: () => open(`https://wa.me/${CONTACT.whatsappIntl}`, `Message us on WhatsApp: ${CONTACT.whatsappDisplay}`), tone: 'green' },
        { icon: 'call-outline', title: 'Call us', value: CONTACT.whatsappDisplay, onPress: () => open(`tel:+${CONTACT.whatsappIntl}`, `Call us on ${CONTACT.whatsappDisplay}`) },
        { icon: 'mail-outline', title: 'Email', value: CONTACT.email, onPress: () => open(`mailto:${CONTACT.email}`, `Email us at ${CONTACT.email}`) },
    ];

    return (
        <Screen title="Profile" kicker="Your account" refreshing={false} onRefresh={() => { refresh().catch(() => {}); getMyProfile().then(setProfile).catch(() => {}); }}>
            {/* Who you are */}
            <Enter index={0}>
                <Card style={styles.me}>
                    <View style={styles.meTop}>
                        <Avatar name={name} size={64} />
                        <View style={styles.flex}>
                            <Text style={styles.name} numberOfLines={1}>{name}</Text>
                            <Text style={styles.sub} numberOfLines={1}>{email}</Text>
                            {phone ? <Text style={styles.sub} numberOfLines={1}>{phone}</Text> : null}
                        </View>
                        <PressableScale onPress={() => router.push('/personal')} style={styles.editBtn} accessibilityLabel="Edit personal details">
                            <Ionicons name="create-outline" size={18} color={colors.navy} />
                        </PressableScale>
                    </View>
                    <View style={styles.chips}>
                        <Chip large icon={blocked ? 'pause-circle-outline' : 'checkmark-circle-outline'} label={blocked ? 'On hold' : 'Active affiliate'} tone={blocked ? 'red' : 'green'} />
                        {since ? <Chip large icon="calendar-outline" label={`Since ${formatDate(since)}`} tone="orange" /> : null}
                    </View>
                    {code ? (
                        <PressableScale style={styles.code} onPress={copyCode} scaleTo={0.98} accessibilityLabel={`Your code is ${code}. Tap to copy`}>
                            <View style={styles.flex}>
                                <Text style={styles.codeLabel}>YOUR CODE</Text>
                                <Text style={styles.codeText}>{code}</Text>
                            </View>
                            <View style={styles.copy}>
                                <Ionicons name="copy-outline" size={16} color={colors.white} />
                                <Text style={styles.copyText}>Copy</Text>
                            </View>
                        </PressableScale>
                    ) : null}
                </Card>
            </Enter>

            {/* At a glance */}
            {summary ? (
                <Enter index={1}>
                    <Card style={styles.stats}>
                        <Stat label="People joined" value={<Text style={styles.statValue}>{Number(summary.referrals) || 0}</Text>} />
                        <View style={styles.vline} />
                        <Stat label="Total earned" value={<CountUpNaira value={Number(summary.total_earned) || 0} style={styles.statValue} />} />
                        <View style={styles.vline} />
                        <Stat label="Paid out" value={<CountUpNaira value={Number(summary.withdrawn) || 0} style={styles.statValue} />} />
                    </Card>
                </Enter>
            ) : null}

            <Enter index={2}><Section title="Account" rows={account} /></Enter>
            <Enter index={3}><Section title="Money" rows={money} /></Enter>
            <Enter index={4}><Section title="The programme" rows={programme} /></Enter>
            <Enter index={5}><Section title="Help" rows={help} /></Enter>

            <Enter index={6} style={styles.footer}>
                <Button title="Sign out" icon="log-out-outline" variant="outline" loading={busy} onPress={confirmSignOut} />
                <Text style={styles.version}>U Angel Affiliates · version {version}</Text>
            </Enter>
        </Screen>
    );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <View style={styles.stat}>
            {value}
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const TONE = {
    orange: { bg: colors.orangeSoft, fg: colors.orangeDark },
    green: { bg: colors.greenSoft, fg: colors.green },
    navy: { bg: colors.chip, fg: colors.navy },
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
    return (
        <View style={{ gap: 8 }}>
            <Text style={styles.section}>{title.toUpperCase()}</Text>
            <Card style={styles.list}>
                {rows.map((r, i) => {
                    const t = TONE[r.tone ?? 'orange'];
                    return (
                        <Fragment key={r.title}>
                            {i > 0 ? <View style={styles.line} /> : null}
                            <PressableScale style={styles.row} onPress={r.onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={r.value ? `${r.title}: ${r.value}` : r.title}>
                                <IconBubble name={r.icon} size={40} bg={t.bg} color={t.fg} />
                                <View style={styles.flex}>
                                    <Text style={styles.rowTitle}>{r.title}</Text>
                                    {r.value ? <Text style={styles.rowValue} numberOfLines={1}>{r.value}</Text> : null}
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.greyLight} />
                            </PressableScale>
                        </Fragment>
                    );
                })}
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    me: { gap: 14 },
    meTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    name: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
    sub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey, marginTop: 1 },
    editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    code: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.navy },
    codeLabel: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.4, color: colors.peach },
    codeText: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 3, color: colors.white, marginTop: 2 },
    copy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, paddingHorizontal: 14, height: 38, borderRadius: 999 },
    copyText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },

    stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy },
    statLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.grey, textAlign: 'center' },
    vline: { width: 1, alignSelf: 'stretch', backgroundColor: colors.line },

    section: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.3, color: colors.grey, marginLeft: 4 },
    list: { paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.navy },
    rowValue: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.grey, marginTop: 1 },
    line: { height: 1, backgroundColor: colors.line },

    footer: { gap: 12, marginTop: 4 },
    version: { textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.greyLight },
});
