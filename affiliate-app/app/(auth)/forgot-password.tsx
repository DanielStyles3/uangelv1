import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import AuthShell from '@/components/AuthShell';
import { BackButton, Button, Field, Notice } from '@/components/ui';
import { resetPasswordWithCode, sendPasswordReset } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

const CODE_LEN = 6;
const RESEND_AFTER = 60;

/** Six boxes over one hidden input, so paste and email autofill work. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
    const [focused, setFocused] = useState(false);

    return (
        <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} accessibilityLabel="Reset code">
            <View style={styles.codeRow}>
                {Array.from({ length: CODE_LEN }, (_, i) => {
                    const active = focused && i === Math.min(value.length, CODE_LEN - 1);
                    return (
                        <View key={i} style={[styles.codeBox, !!value[i] && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                            <Text style={styles.codeDigit}>{value[i] ?? ''}</Text>
                        </View>
                    );
                })}
            </View>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, CODE_LEN))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LEN}
                autoFocus
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={styles.hiddenInput}
                caretHidden
            />
        </TouchableOpacity>
    );
}

export default function ForgotPassword() {
    const router = useRouter();
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

    const sendCode = async () => {
        const mail = email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(mail)) return Alert.alert('Check your email', 'Please enter the email you signed up with.');
        setBusy(true);
        try {
            await sendPasswordReset(mail);
            setStep('code');
            setCode('');
            setCooldown(RESEND_AFTER);
        } catch (e) {
            Alert.alert('Couldn’t send the code', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (code.length !== CODE_LEN) return Alert.alert('Enter the code', `Type the ${CODE_LEN}-digit code from the email.`);
        if (password.length < 6) return Alert.alert('Password too short', 'Use at least 6 characters.');
        if (password !== confirm) return Alert.alert('Passwords don’t match', 'Type the same new password twice.');
        setBusy(true);
        try {
            await resetPasswordWithCode(email.trim().toLowerCase(), code, password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert('Password updated', 'You’re signed in with your new password.');
            // The code signs the person in, so the root layout moves on by itself.
        } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            Alert.alert('Couldn’t reset your password', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const back = (
        <View style={styles.backRow}>
            <BackButton light onPress={goBack} />
        </View>
    );

    if (step === 'email') {
        return (
            <AuthShell
                top={back}
                title="Forgot password?"
                subtitle="Enter the email you signed up with and we’ll send you a 6-digit code."
            >
                <Field
                    label="Email"
                    icon="mail-outline"
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={sendCode}
                />
                <Button title="Send code" loading={busy} onPress={sendCode} />
            </AuthShell>
        );
    }

    return (
        <AuthShell
            top={back}
            title="Check your email"
            subtitle={`We sent a 6-digit code to ${email.trim()}. It may take a minute; check spam too.`}
        >
            <CodeBoxes value={code} onChange={setCode} />

            <View style={styles.resendRow}>
                <TouchableOpacity onPress={() => { setStep('email'); setCode(''); }} hitSlop={8}>
                    <Text style={styles.linkMuted}>Change email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendCode} disabled={cooldown > 0 || busy} hitSlop={8}>
                    <Text style={[styles.link, (cooldown > 0 || busy) && { color: colors.greyLight }]}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Field label="New password" icon="lock-closed-outline" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secure textContentType="newPassword" autoComplete="new-password" />
            <Field label="Confirm new password" icon="lock-closed-outline" placeholder="Type it again" value={confirm} onChangeText={setConfirm} secure textContentType="newPassword" returnKeyType="done" onSubmitEditing={save} />

            <Button title="Reset password" loading={busy} onPress={save} />

            <Notice icon="shield-checkmark-outline" text="Never share this code. U Angel Foods will never ask you for it." />
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    backRow: { alignSelf: 'stretch', paddingHorizontal: 20, marginBottom: -20 },
    codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    codeBox: {
        flex: 1,
        height: 58,
        borderRadius: 16,
        backgroundColor: colors.field,
        borderWidth: 1.5,
        borderColor: colors.fieldBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeBoxFilled: { backgroundColor: colors.orangeTint, borderColor: colors.orangeBorder },
    codeBoxActive: { borderColor: colors.orange, borderWidth: 2, backgroundColor: colors.white },
    codeDigit: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
    link: { fontFamily: fonts.bold, fontSize: 14, color: colors.orange },
    linkMuted: { fontFamily: fonts.bold, fontSize: 14, color: colors.grey },
});
