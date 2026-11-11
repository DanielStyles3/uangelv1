import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Enter } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Card, Field, Notice } from '@/components/ui';
import { changePassword } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { notify } from '@/lib/notice';

/** Change password (the same password signs you in to U Angel Foods too). */
export default function Password() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

    const save = async () => {
        if (password.length < 6) return notify('Password too short', 'Use at least 6 characters.');
        if (password !== confirm) return notify('Passwords don’t match', 'Type the same new password twice.');
        setBusy(true);
        try {
            await changePassword(password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            notify('Password changed', 'Use your new password next time you sign in, in both apps.', [{ text: 'Great', onPress: goBack }], { tone: 'success' });
        } catch (e) {
            notify('Couldn’t change your password', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen stack keyboard title="Change password" onBack={goBack}>
            <Enter index={0}>
                <Card style={styles.card}>
                    <Field label="New password" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure autoComplete="new-password" textContentType="newPassword" />
                    <Field label="Confirm new password" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder="Type it again" secure autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={save} />
                    <Button title="Change password" icon="checkmark" loading={busy} onPress={save} />
                </Card>
            </Enter>
            <Enter index={1}>
                <Notice icon="shield-checkmark-outline" text="This is the same password for U Angel Foods and U Angel Affiliates." />
            </Enter>
        </Screen>
    );
}

const styles = StyleSheet.create({
    card: { gap: 16 },
});
