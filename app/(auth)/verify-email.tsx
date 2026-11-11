import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AuthScreen, { AuthButton } from "@/components/AuthScreen";
import CodeBoxes, { CODE_LEN } from "@/components/CodeBoxes";
import { resendSignupCode, verifySignupCode } from "@/lib/api";
import { notify } from "@/lib/notice";
import useAuthStore from "@/store/auth.store";

const INK = "#181C2E";
const ORANGE = "#FD652A";
const RESEND_AFTER = 60;

/**
 * After sign-up: type the 6-digit code from the confirmation email. Confirms the email and
 * signs in right here in the app (no link that opens the website).
 */
export default function VerifyEmail() {
    const { email = "" } = useLocalSearchParams<{ email: string }>();
    const { fetchAuthenticatedUser } = useAuthStore();
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_AFTER);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const confirm = async (value = code) => {
        if (value.length !== CODE_LEN) return notify("Enter the code", `Type the ${CODE_LEN}-digit code from the email.`);
        setBusy(true);
        try {
            await verifySignupCode(email, value);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await fetchAuthenticatedUser(); // signed in → the auth layout takes them home
            router.replace("/");
        } catch (e: any) {
            notify("Couldn’t confirm your email", e.message);
            setBusy(false);
        }
    };

    const resend = async () => {
        setBusy(true);
        try {
            await resendSignupCode(email);
            setCode("");
            setCooldown(RESEND_AFTER);
            notify("New code sent", `Check ${email}. It may take a minute; check spam too.`, undefined, { tone: "success" });
        } catch (e: any) {
            notify("Couldn’t send a new code", e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthScreen
            title={"Confirm\nyour email."}
            subtitle="One last step to create your account."
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/sign-up"))}
        >
            <Text style={styles.sentTo}>
                We sent a 6-digit code to <Text style={{ color: INK, fontFamily: "Quicksand-Bold" }}>{email}</Text>. It may take a minute; check spam too.
            </Text>

            <CodeBoxes
                value={code}
                label="Confirmation code"
                onChange={(v) => {
                    setCode(v);
                    if (v.length === CODE_LEN && !busy) confirm(v); // confirm as soon as all 6 digits are in
                }}
            />

            <View style={styles.row}>
                <TouchableOpacity onPress={() => router.replace("/sign-up")} hitSlop={8}>
                    <Text style={styles.muted}>Wrong email?</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resend} disabled={cooldown > 0 || busy} hitSlop={8}>
                    <Text style={[styles.link, (cooldown > 0 || busy) && { color: "#A0A0AB" }]}>
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </Text>
                </TouchableOpacity>
            </View>

            <AuthButton title="Confirm and continue" loading={busy} onPress={() => confirm()} />

            <View style={styles.tip}>
                <Ionicons name="mail-unread-outline" size={18} color={ORANGE} />
                <Text style={styles.tipText}>Stay in the app: just type the code from the email here.</Text>
            </View>
        </AuthScreen>
    );
}

const styles = StyleSheet.create({
    sentTo: { fontFamily: "Quicksand-SemiBold", fontSize: 14, lineHeight: 20, color: "#5B5B66" },
    row: { flexDirection: "row", justifyContent: "space-between", marginTop: -6 },
    link: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#C2410C" },
    muted: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#5B5B66" },
    tip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#FFF1EA" },
    tipText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: "#9A3412" },
});
