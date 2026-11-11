import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import AuthShell from '@/components/AuthShell';
import { Button, Field, Notice } from '@/components/ui';
import { signIn, signUp } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

import { notify } from '@/lib/notice';
type Mode = 'signin' | 'signup';

export default function SignIn() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>('signin');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

    const isSignUp = mode === 'signup';

    const submit = async () => {
        const mail = email.trim().toLowerCase();
        if (isSignUp && name.trim().length < 2) return notify('Your name', 'Please enter your full name.');
        if (!/^\S+@\S+\.\S+$/.test(mail)) return notify('Check your email', 'Please enter a valid email address.');
        if (password.length < 6) return notify('Password too short', 'Use at least 6 characters.');

        setBusy(true);
        try {
            if (isSignUp) {
                const signedIn = await signUp(name.trim(), mail, password);
                if (!signedIn) setConfirmEmail(mail);
            } else {
                await signIn(mail, password);
            }
            // Signed in: the root layout swaps to the affiliate screens by itself.
        } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            notify(isSignUp ? 'Couldn’t create your account' : 'Couldn’t sign you in', errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const switchMode = (next: Mode) => {
        setMode(next);
        setConfirmEmail(null);
    };

    if (confirmEmail) {
        return (
            <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${confirmEmail}. Open it, then come back and sign in.`}>
                <Notice icon="mail-unread-outline" text="It may take a minute to arrive. Check your spam or promotions folder too." />
                <Button title="I’ve confirmed, sign in" onPress={() => switchMode('signin')} />
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title={isSignUp ? 'Create your account' : 'Welcome back'}
            subtitle={
                isSignUp
                    ? 'One account for U Angel Foods and U Angel Affiliates.'
                    : 'Sign in with your U Angel Foods account to start earning.'
            }
        >
            <View style={styles.switcher}>
                {(['signin', 'signup'] as const).map((m) => (
                    <TouchableOpacity
                        key={m}
                        onPress={() => switchMode(m)}
                        style={[styles.switchTab, mode === m && styles.switchTabActive]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === m }}
                    >
                        <Text style={[styles.switchText, mode === m && styles.switchTextActive]}>
                            {m === 'signin' ? 'Sign in' : 'Sign up'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {isSignUp ? (
                <Field
                    label="Full name"
                    icon="person-outline"
                    placeholder="e.g. Ada Okafor"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                />
            ) : null}
            <Field
                label="Email"
                icon="mail-outline"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
            />
            <Field
                label="Password"
                icon="lock-closed-outline"
                placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                value={password}
                onChangeText={setPassword}
                secure
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                returnKeyType="go"
                onSubmitEditing={submit}
            />

            {!isSignUp ? (
                <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgot} hitSlop={8}>
                    <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
            ) : null}

            <Button title={isSignUp ? 'Create account' : 'Sign in'} loading={busy} onPress={submit} />

            <View style={styles.footer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.grey} />
                <Text style={styles.footerText}>
                    {isSignUp
                        ? 'Already shop with U Angel Foods? Sign in with the same email instead.'
                        : 'New here? Tap Sign up. It takes a minute.'}
                </Text>
            </View>
        </AuthShell>
    );
}

const styles = StyleSheet.create({
    switcher: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 999, padding: 4 },
    switchTab: { flex: 1, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    switchTabActive: { backgroundColor: colors.white, elevation: 2, shadowColor: colors.navy, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    switchText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.grey },
    switchTextActive: { color: colors.navy },
    forgot: { alignSelf: 'flex-end', marginTop: -6 },
    link: { fontFamily: fonts.bold, fontSize: 14, color: colors.orange },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    footerText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.grey, textAlign: 'center' },
});
