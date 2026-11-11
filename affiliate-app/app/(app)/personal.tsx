import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Enter } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Card, Field, Notice } from '@/components/ui';
import { getMyProfile, updateMyProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/format';
import { notify } from '@/lib/notice';
import { colors, fonts } from '@/lib/theme';

/** Nigerian phone → "0803 123 4567"-style, or null if it isn't one. */
function cleanPhone(raw: string): string | null {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('234')) d = '0' + d.slice(3);
    if (d.length === 10 && !d.startsWith('0')) d = '0' + d;
    return /^0[789][01]\d{8}$/.test(d) ? d : null;
}

/** Edit name and phone (shared with the U Angel Foods app: same account). */
export default function Personal() {
    const router = useRouter();
    const { session } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        getMyProfile()
            .then((p) => {
                if (!alive) return;
                setName(p?.name ?? '');
                setPhone(p?.phone ?? '');
                setLoaded(true);
            })
            .catch(() => alive && setLoaded(true));
        return () => { alive = false; };
    }, []);

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

    const save = async () => {
        const n = name.trim().replace(/\s+/g, ' ');
        if (n.length < 2) return notify('Your name', 'Please enter your full name.');
        const p = phone.trim() ? cleanPhone(phone) : null;
        if (phone.trim() && !p) return notify('Phone number', 'Please enter a valid Nigerian number, e.g. 0803 123 4567.');
        setBusy(true);
        try {
            await updateMyProfile(n, p);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            notify('Saved', 'Your details are up to date.', [{ text: 'Great', onPress: goBack }], { tone: 'success' });
        } catch (e) {
            notify('Couldn’t save', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen stack keyboard title="Personal details" onBack={goBack}>
            <Enter index={0}>
                <Card style={styles.card}>
                    <Field label="Full name" icon="person-outline" value={name} onChangeText={setName} placeholder="e.g. Ada Okafor" autoCapitalize="words" autoComplete="name" editable={loaded} />
                    <Field label="Phone number" icon="call-outline" value={phone} onChangeText={setPhone} placeholder="0803 123 4567" keyboardType="phone-pad" autoComplete="tel" editable={loaded} />
                    <View style={styles.emailBox}>
                        <Text style={styles.emailLabel}>Email</Text>
                        <Text style={styles.emailValue}>{session?.user.email ?? ''}</Text>
                    </View>
                    <Button title="Save changes" icon="checkmark" loading={busy} onPress={save} />
                </Card>
            </Enter>
            <Enter index={1}>
                <Notice icon="information-circle-outline" text="These are the same details as your U Angel Foods account. We use your phone number to reach you about payouts." />
            </Enter>
        </Screen>
    );
}

const styles = StyleSheet.create({
    card: { gap: 16 },
    emailBox: { gap: 4, padding: 14, borderRadius: 16, backgroundColor: colors.field },
    emailLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.grey },
    emailValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.navy },
});
