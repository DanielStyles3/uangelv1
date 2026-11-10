import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import ScalePress from "@/components/ScalePress";
import { inviteMessage } from "@/constants/affiliate";
import { AffiliateSummary } from "@/lib/api";
import { formatNaira } from "@/lib/format";

const ORANGE = "#FD652A";
const NAVY = "#181C2E";

/**
 * Profile: the navy "Invite friends, earn 5%" card.
 * With a code: shows it with a Share button and what's been earned. Without: "Get my code".
 * Tapping the card opens the Invite screen.
 */
const ProfileInviteCard = ({ summary: raw }: { summary: AffiliateSummary | null }) => {
    const open = () => router.push("/invite");
    // Only approved affiliates have a code; waiting / not approved show a status line instead.
    const summary = raw?.code ? raw : null;
    const code = summary?.code ?? "";
    const pending = raw?.status === "pending";
    const share = () => {
        if (!code) return open();
        Haptics.selectionAsync().catch(() => {});
        Share.share({ message: inviteMessage(code) }).catch(() => {});
    };
    const friends = summary?.referrals ?? 0;

    return (
        <ScalePress
            style={styles.card}
            onPress={open}
            accessibilityRole="button"
            accessibilityLabel="Invite friends, earn 5% on everything they order for 12 months"
        >
            <View style={styles.glow} />

            <View style={styles.top}>
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.eyebrow}>INVITE &amp; EARN</Text>
                    <Text style={styles.title}>Invite friends,{"\n"}earn 5%</Text>
                </View>
                {summary ? (
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={styles.small}>Earned so far</Text>
                        <Text style={styles.earned}>{formatNaira(summary.total_earned)}</Text>
                    </View>
                ) : (
                    <View style={styles.tile}><Ionicons name="gift" size={24} color="#fff" /></View>
                )}
            </View>

            {summary ? (
                <View style={styles.row}>
                    <View style={styles.codeBox}><Text style={styles.code} numberOfLines={1}>{code}</Text></View>
                    <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Share my code">
                        <Ionicons name="share-social" size={16} color="#fff" />
                        <Text style={styles.shareText}>Share</Text>
                    </TouchableOpacity>
                </View>
            ) : pending ? (
                <View style={styles.waiting}>
                    <Ionicons name="hourglass-outline" size={16} color="#FCD34D" />
                    <Text style={styles.waitingText}>Application received · waiting for approval</Text>
                </View>
            ) : (
                <View style={styles.cta}>
                    <Text style={styles.ctaText}>{raw?.status === "rejected" ? "Apply again" : "Apply to join"}</Text>
                    <Ionicons name="arrow-forward" size={16} color={NAVY} />
                </View>
            )}

            <Text style={styles.small}>
                {summary
                    ? `${friends} friend${friends === 1 ? "" : "s"} joined · on everything they order for 12 months`
                    : pending
                        ? "Your code appears here once you’re approved."
                        : "On everything they order for 12 months."}
            </Text>
        </ScalePress>
    );
};

const styles = StyleSheet.create({
    card: { backgroundColor: NAVY, borderRadius: 26, padding: 18, overflow: "hidden", gap: 12 },
    glow: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(253,101,42,0.28)", right: -60, top: -80 },
    top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    eyebrow: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.2, color: "#FFB08A" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 20, lineHeight: 25, color: "#fff" },
    small: { fontFamily: "Quicksand-SemiBold", fontSize: 12, color: "#C9CBD6" },
    earned: { fontFamily: "Quicksand-Bold", fontSize: 18, color: "#fff" },
    tile: { width: 52, height: 52, borderRadius: 18, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    codeBox: {
        flex: 1, height: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.45)",
        alignItems: "center", justifyContent: "center", paddingHorizontal: 10,
    },
    code: { fontFamily: "Quicksand-Bold", fontSize: 18, letterSpacing: 4, color: "#fff" },
    shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 46, paddingHorizontal: 18, borderRadius: 999, backgroundColor: ORANGE },
    shareText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#fff" },
    cta: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "#fff" },
    ctaText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: NAVY },
    waiting: {
        flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 14,
        backgroundColor: "rgba(252,211,77,0.12)", borderWidth: 1, borderColor: "rgba(252,211,77,0.4)",
    },
    waitingText: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 13, color: "#FDE68A" },
});

export default ProfileInviteCard;
