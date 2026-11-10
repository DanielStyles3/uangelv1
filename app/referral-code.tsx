import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import CustomHeader from "@/components/CustomHeader";
import CustomButton from "@/components/CustomButton";
import AuthInput from "@/components/AuthInput";
import useFetch from "@/lib/useFetch";
import { applyReferralCode, getMyReferral } from "@/lib/api";

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";

/** Profile › Referral code: shows the linked code, or lets a new customer add one. */
export default function ReferralCode() {
    const { data: referral, loading, refetch } = useFetch({ fn: getMyReferral });
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);

    const apply = async () => {
        const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (!clean) return Alert.alert("Referral code", "Enter the code your friend gave you.");
        setBusy(true);
        try {
            const name = await applyReferralCode(clean);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert("Code added", `You joined with ${name}’s code. Thank you!`);
            setCode("");
            await refetch();
        } catch (e: any) {
            Alert.alert("Couldn’t add the code", e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Referral code" showSearch={false} />

                    {loading && !referral ? (
                        <ActivityIndicator color={ORANGE} style={{ marginTop: 30 }} />
                    ) : referral ? (
                        <View style={styles.card}>
                            <View style={styles.icon}><Ionicons name="checkmark-circle" size={26} color="#15803D" /></View>
                            <Text style={styles.title}>You joined with a referral code</Text>
                            <Text style={styles.code}>{referral.code}</Text>
                            <Text style={styles.text}>Thank you for joining through a friend. Every order you place also helps feed someone in need.</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 18 }}>
                            <View style={styles.card}>
                                <View style={[styles.icon, { backgroundColor: "#FFF1EA" }]}><Ionicons name="gift" size={24} color={ORANGE} /></View>
                                <Text style={styles.title}>Did a friend invite you?</Text>
                                <Text style={styles.text}>Enter their code here. You can add one within 30 days of joining, before your first order.</Text>
                            </View>
                            <AuthInput
                                label="Referral code"
                                icon="gift-outline"
                                placeholder="e.g. ADA25"
                                value={code}
                                onChangeText={(t) => setCode(t.toUpperCase())}
                                autoCapitalize="characters"
                                returnKeyType="done"
                                onSubmitEditing={apply}
                            />
                            <CustomButton title="Add code" isLoading={busy} onPress={apply} />
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    body: { padding: 20, gap: 20 },
    card: { alignItems: "center", gap: 8, backgroundColor: "#F6F6F8", borderRadius: 22, padding: 20 },
    icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#E9F8EF", alignItems: "center", justifyContent: "center", marginBottom: 4 },
    title: { fontFamily: "Quicksand-Bold", fontSize: 17, color: INK, textAlign: "center" },
    code: { fontFamily: "Quicksand-Bold", fontSize: 26, letterSpacing: 3, color: "#C2410C" },
    text: { fontFamily: "Quicksand-Medium", fontSize: 14, lineHeight: 20, color: GREY, textAlign: "center" },
});
