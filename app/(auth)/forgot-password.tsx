import { ComponentRef, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AuthInput from "@/components/AuthInput";
import CustomButton from "@/components/CustomButton";
import { resetPasswordWithCode, sendPasswordReset } from "@/lib/api";
import useAuthStore from "@/store/auth.store";

const ORANGE = "#FD652A";
const INK = "#181C2E";
const CODE_LEN = 6;
const RESEND_AFTER = 60;

/** Six boxes over one hidden input, so paste and SMS/email autofill work. */
const CodeBoxes = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
    const [focused, setFocused] = useState(false);

    return (
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Reset code">
            <View style={styles.codeRow}>
                {Array.from({ length: CODE_LEN }, (_, i) => {
                    const active = focused && i === Math.min(value.length, CODE_LEN - 1);
                    return (
                        <View key={i} style={[styles.codeBox, !!value[i] && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                            <Text style={styles.codeDigit}>{value[i] ?? ""}</Text>
                        </View>
                    );
                })}
            </View>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, CODE_LEN))}
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
        </Pressable>
    );
};

export default function ForgotPassword() {
    const { fetchAuthenticatedUser } = useAuthStore();
    const [step, setStep] = useState<"email" | "code">("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const sendCode = async () => {
        const trimmed = email.trim();
        if (!/^\S+@\S+\.\S+$/.test(trimmed)) return Alert.alert("Check your email", "Please enter the email you signed up with.");
        setBusy(true);
        try {
            await sendPasswordReset(trimmed);
            setStep("code");
            setCode("");
            setCooldown(RESEND_AFTER);
        } catch (e: any) {
            Alert.alert("Couldn't send the code", e.message);
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (code.length !== CODE_LEN) return Alert.alert("Enter the code", `Type the ${CODE_LEN}-digit code from the email.`);
        if (password.length < 6) return Alert.alert("Password too short", "Use at least 6 characters.");
        if (password !== confirm) return Alert.alert("Passwords don't match", "Type the same new password twice.");
        setBusy(true);
        try {
            await resetPasswordWithCode(email.trim(), code, password);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await fetchAuthenticatedUser(); // signed in → the auth layout sends them home
            Alert.alert("Password updated", "You're signed in with your new password.");
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            Alert.alert("Couldn't reset password", e.message);
        } finally {
            setBusy(false);
        }
    };

    if (step === "email") {
        return (
            <View style={styles.wrap}>
                <View style={{ gap: 4 }}>
                    <Text className="h1-bold text-dark-100">Forgot password?</Text>
                    <Text className="paragraph-medium text-gray-200">
                        Enter the email you signed up with and we&apos;ll send you a 6-digit code.
                    </Text>
                </View>
                <AuthInput
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
                <CustomButton title="Send code" isLoading={busy} onPress={sendCode} style="!py-4 shadow-lg shadow-primary/40" textStyle="!text-base" />
                <View style={styles.footer}>
                    <Text className="paragraph-medium text-gray-200">Remembered it?</Text>
                    <Link href="/sign-in" replace className="paragraph-bold text-primary">Sign in</Link>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            <View style={{ gap: 4 }}>
                <Text className="h1-bold text-dark-100">Check your email</Text>
                <Text className="paragraph-medium text-gray-200">
                    We sent a 6-digit code to <Text style={{ color: INK, fontFamily: "Quicksand-Bold" }}>{email.trim()}</Text>. It may take a minute; check spam too.
                </Text>
            </View>

            <CodeBoxes value={code} onChange={setCode} />

            <View style={styles.resendRow}>
                <TouchableOpacity onPress={() => { setStep("email"); setCode(""); }} hitSlop={8}>
                    <Text style={styles.linkMuted}>Change email</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={sendCode} disabled={cooldown > 0 || busy} hitSlop={8}>
                    <Text style={[styles.link, (cooldown > 0 || busy) && { color: "#A0A0AB" }]}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </Text>
                </TouchableOpacity>
            </View>

            <AuthInput label="New password" icon="lock-closed-outline" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secure textContentType="newPassword" autoComplete="new-password" />
            <AuthInput label="Confirm new password" icon="lock-closed-outline" placeholder="Type it again" value={confirm} onChangeText={setConfirm} secure textContentType="newPassword" returnKeyType="done" onSubmitEditing={save} />

            <CustomButton title="Reset password" isLoading={busy} onPress={save} style="!py-4 shadow-lg shadow-primary/40" textStyle="!text-base" />

            <View style={styles.tip}>
                <Ionicons name="shield-checkmark-outline" size={18} color={ORANGE} />
                <Text style={styles.tipText}>Never share this code. U Angel Foods will never ask you for it.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 24, paddingTop: 22, gap: 18 },
    footer: { flexDirection: "row", justifyContent: "center", gap: 6 },

    codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    codeBox: { flex: 1, height: 58, borderRadius: 16, backgroundColor: "#F5F5F7", borderWidth: 1.5, borderColor: "#E4E4EA", alignItems: "center", justifyContent: "center" },
    codeBoxFilled: { backgroundColor: "#FFF4EE", borderColor: "#FDBA9B" },
    codeBoxActive: { borderColor: ORANGE, borderWidth: 2, backgroundColor: "#fff" },
    codeDigit: { fontFamily: "Quicksand-Bold", fontSize: 24, color: INK },
    hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },

    resendRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -6 },
    link: { fontFamily: "Quicksand-Bold", fontSize: 14, color: ORANGE },
    linkMuted: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#5B5B66" },

    tip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#FFF1EA" },
    tipText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: "#9A3412" },
});
