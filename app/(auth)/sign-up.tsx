import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {router} from "expo-router";
import {useEffect, useState} from "react";
import * as Sentry from '@sentry/react-native'
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";
import {useDebounce} from "use-debounce";

import AuthInput from "@/components/AuthInput";
import AuthScreen, {AuthButton, authStyles} from "@/components/AuthScreen";
import {checkReferralCode, createUser} from "@/lib/api";
import {popIn} from "@/lib/motion";
import useAuthStore from "@/store/auth.store";

import { notify } from "@/lib/notice";
/** Affiliate codes are 4 to 12 capital letters / digits (supabase/affiliates.sql). */
const MIN_CODE = 4;
const cleanCode = (text: string) => text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const SignUp = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', referral: '' });
    const { fetchAuthenticatedUser } = useAuthStore();

    // Live referral check: once typing stops (and the code is long enough) ask the server,
    // and remember which code the answer is for so a stale answer is never shown.
    const code = cleanCode(form.referral);
    const [settledCode] = useDebounce(code, 500);
    const [check, setCheck] = useState<{ code: string; valid: boolean; firstName: string | null; failed?: boolean } | null>(null);

    useEffect(() => {
        if (settledCode.length < MIN_CODE) return;
        let stale = false;
        checkReferralCode(settledCode)
            .then((result) => {
                if (stale) return;
                setCheck({ code: settledCode, ...result });
                if (result.valid) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            })
            .catch(() => { if (!stale) setCheck({ code: settledCode, valid: false, firstName: null, failed: true }); });
        return () => { stale = true; };
    }, [settledCode]);

    const codeState: 'empty' | 'short' | 'checking' | 'valid' | 'invalid' | 'offline' =
        !code ? 'empty'
        : code.length < MIN_CODE ? 'short'
        : check?.code !== code ? 'checking'
        : check.failed ? 'offline'
        : check.valid ? 'valid' : 'invalid';

    const submit = async () => {
        const { name, email, password } = form;
        const referral = code;

        if(!name || !email || !password) return notify('A few details missing', 'Please fill in your name, email address and password.');
        if(password.length < 6) return notify('Password too short', 'Use at least 6 characters.');

        setIsSubmitting(true)

        try {
            // Check the referral code first: a wrong code would otherwise be silently ignored.
            if (referral) {
                const { valid } = await checkReferralCode(referral);
                if (!valid) {
                    notify('Referral code', `"${referral}" isn’t a valid code. Check it with your friend, or leave it empty.`);
                    return;
                }
            }
            const { needsEmailConfirmation } = await createUser({ email: email.trim(), password, name: name.trim(), referralCode: referral || undefined });

            if (needsEmailConfirmation) {
                notify(
                    'Check your email',
                    'We sent you a confirmation link. Confirm your email, then sign in.',
                    [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
                );
                return;
            }

            await fetchAuthenticatedUser();

            router.replace('/');
        } catch(error: any) {
            notify('Couldn’t create your account', error.message);
            Sentry.captureException(error);
        } finally {
            setIsSubmitting(false);
        }
    }

    const goSignIn = () => (router.canGoBack() ? router.back() : router.replace('/sign-in'));

    return (
        <AuthScreen
            title={"Join\nU Angel Foods."}
            subtitle="It takes less than a minute."
            onBack={goSignIn}
            footer={
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                    <Text style={authStyles.onOrange}>Already have an account?</Text>
                    <TouchableOpacity onPress={goSignIn} hitSlop={10} accessibilityRole="link">
                        <Text style={authStyles.linkOnOrange}>Sign in</Text>
                    </TouchableOpacity>
                </View>
            }
        >
            <AuthInput
                label="Full name"
                icon="person-outline"
                placeholder="e.g. Ada Okafor"
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
            />
            <AuthInput
                label="Email"
                icon="mail-outline"
                placeholder="you@example.com"
                value={form.email}
                onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
            />
            <View style={{ gap: 8 }}>
                <AuthInput
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                    secure
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                />
                {form.password.length > 0 && form.password.length < 6 && (
                    <Text style={[authStyles.hint, { color: '#B91C1C' }]}>{6 - form.password.length} more character{6 - form.password.length === 1 ? '' : 's'} needed</Text>
                )}
            </View>

            <View style={{ gap: 10 }}>
                <AuthInput
                    label="Referral code (optional)"
                    icon="gift-outline"
                    placeholder="e.g. ADA25"
                    value={form.referral}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, referral: cleanCode(text) }))}
                    autoCapitalize="characters"
                    returnKeyType="go"
                    onSubmitEditing={submit}
                    maxLength={12}
                    code
                    tone={codeState === 'valid' ? 'success' : codeState === 'invalid' ? 'error' : undefined}
                    right={
                        codeState === 'checking' ? <ActivityIndicator size="small" color="#9A9AA3" />
                        : codeState === 'valid' ? <Ionicons name="checkmark-circle" size={22} color="#15803D" />
                        : codeState === 'invalid' ? <Ionicons name="close-circle" size={22} color="#DC2626" />
                        : null
                    }
                />
                {codeState === 'valid' ? (
                    <Animated.View key="valid" entering={popIn()} style={[styles.note, styles.noteGreen]} accessibilityLiveRegion="polite">
                        <View style={styles.tick}><Ionicons name="checkmark" size={15} color="#fff" /></View>
                        <Text style={[styles.noteText, { color: '#166534' }]}>{check?.firstName || 'Your friend'} invited you. Code accepted.</Text>
                    </Animated.View>
                ) : codeState === 'invalid' ? (
                    <Animated.View key="invalid" entering={popIn()} style={[styles.note, styles.noteRed]} accessibilityLiveRegion="polite">
                        <Ionicons name="alert-circle" size={22} color="#DC2626" />
                        <Text style={[styles.noteText, { color: '#B91C1C' }]}>We don’t know the code “{code}”. Check it with your friend, or leave it empty.</Text>
                    </Animated.View>
                ) : codeState === 'checking' ? (
                    <Text style={styles.hint}>Checking your code…</Text>
                ) : codeState === 'offline' ? (
                    <Text style={styles.hint}>We couldn’t check the code just now. We’ll check it again when you create your account.</Text>
                ) : codeState === 'short' ? (
                    <Text style={styles.hint}>Codes are 4 to 12 letters and numbers.</Text>
                ) : null}
            </View>

            <AuthButton title="Create account" loading={isSubmitting} onPress={submit} />

            <Text style={authStyles.small}>
                By creating an account you agree to receive order and delivery updates from U Angel Foods.
            </Text>
        </AuthScreen>
    )
}
const styles = StyleSheet.create({
    note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
    noteGreen: { backgroundColor: '#E9F8EF' },
    noteRed: { backgroundColor: '#FEF2F2' },
    noteText: { flex: 1, fontFamily: 'Quicksand-Bold', fontSize: 13, lineHeight: 18 },
    tick: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center' },
    hint: { fontFamily: 'Quicksand-SemiBold', fontSize: 12.5, lineHeight: 17, color: '#5B5B66', marginLeft: 4 },
});

export default SignUp
