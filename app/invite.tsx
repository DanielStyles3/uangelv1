import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import ScalePress from "@/components/ScalePress";
import ScreenHeader from "@/components/ScreenHeader";
import { AFFILIATES_APP_URL, formatRate, inviteLink, inviteMessage } from "@/constants/affiliate";
import { becomeAffiliate, getAffiliateSummary } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { fadeIn, riseIn } from "@/lib/motion";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";

import { notify } from "@/lib/notice";
type IconName = keyof typeof Ionicons.glyphMap;

const ORANGE = "#FD652A";
const NAVY = "#181C2E";
const GREY = "#5B5B66";
const BG = "#F6F6F8";
const GREEN = "#166534";

const tap = () => { Haptics.selectionAsync().catch(() => {}); };
const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

const STEPS: { icon: IconName; title: string; text: string }[] = [
    { icon: "share-social", title: "Send your code and link to others", text: "Share it on WhatsApp or anywhere you like." },
    { icon: "person-add", title: "Others sign up and order", text: "They enter your code when they create their account." },
    { icon: "cash", title: "You earn up to {rate} per product", text: "On the items in every order they pay for. Paid to your bank." },
];

/** The three steps, joined by a thin line. */
const HowItWorks = ({ rate }: { rate: string }) => (
    <View style={styles.card}>
        <Text style={styles.eyebrow}>HOW IT WORKS</Text>
        <View>
            {STEPS.map((step, i) => {
                const last = i === STEPS.length - 1;
                return (
                    <View key={step.title} style={styles.step}>
                        <View style={styles.stepRail}>
                            <View style={[styles.stepIcon, last && styles.stepIconOn]}>
                                <Ionicons name={step.icon} size={18} color={last ? "#fff" : ORANGE} />
                            </View>
                            {!last && <View style={styles.stepLine} />}
                        </View>
                        <View style={[styles.stepBody, last && { paddingBottom: 0 }]}>
                            <Text style={styles.stepTitle}>{step.title.replace("{rate}", rate)}</Text>
                            <Text style={styles.stepText}>{step.text}</Text>
                        </View>
                    </View>
                );
            })}
        </View>
    </View>
);

const Stat = ({ icon, value, label, hint }: { icon: IconName; value: string; label: string; hint?: string }) => (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
        <View style={styles.statIcon}><Ionicons name={icon} size={18} color={ORANGE} /></View>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
    </View>
);

/** Orange pill button with white text (the app's button style), with a press spring. */
const PrimaryButton = ({ title, icon, loading, onPress }: { title: string; icon?: ReactNode; loading?: boolean; onPress: () => void }) => (
    <ScalePress style={[styles.primary, loading && { opacity: 0.75 }]} onPress={onPress} disabled={loading} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ busy: !!loading }}>
        {loading ? <ActivityIndicator color="#fff" /> : (
            <>
                <Text style={styles.primaryText}>{title}</Text>
                {icon}
            </>
        )}
    </ScalePress>
);

/** Invite & earn: get your code, share it, and see how it's going. */
export default function Invite() {
    const insets = useSafeAreaInsets();
    const { isAuthenticated } = useAuthStore();
    const { data: summary, loading, refetch } = useFetch({ fn: getAffiliateSummary, skip: !isAuthenticated });
    const [joining, setJoining] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [copied, setCopied] = useState<"code" | "link" | null>(null);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

    if (!isAuthenticated) return <Redirect href="/sign-in" />;

    const code = summary?.code ?? null;
    const pending = summary?.status === "pending";
    const rejected = summary?.status === "rejected";
    const rate = formatRate(summary?.rate);
    const firstLoad = loading && !summary && !refreshing;

    const apply = async () => {
        tap();
        setJoining(true);
        try {
            await becomeAffiliate();
            success();
            await refetch();
        } catch (e: any) {
            notify("Couldn’t send your application", e.message);
        } finally {
            setJoining(false);
        }
    };

    const copy = async (what: "code" | "link") => {
        if (!code) return;
        try {
            await Clipboard.setStringAsync(what === "code" ? code : inviteLink(code));
            success();
            setCopied(what);
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopied(null), 1800);
        } catch {
            notify("Couldn’t copy", `Your code is ${code}.`);
        }
    };

    const moreWays = () => {
        if (!code) return;
        tap();
        Share.share({ message: inviteMessage(code) }).catch(() => {});
    };

    const shareOnWhatsApp = () => {
        if (!code) return;
        tap();
        // No WhatsApp on this phone: fall back to the normal share sheet.
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(inviteMessage(code))}`)
            .catch(() => Share.share({ message: inviteMessage(code) }).catch(() => {}));
    };

    const openAffiliatesApp = () => {
        tap();
        Linking.openURL(AFFILIATES_APP_URL).catch(() => notify("Couldn’t open the link", `Please visit ${AFFILIATES_APP_URL.replace("https://", "")} in your browser.`));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <Stack.Screen options={{ animation: "slide_from_right" }} />
            <ScrollView
                contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
            >
                <ScreenHeader title="Invite & earn" />

                {firstLoad ? (
                    <ActivityIndicator color={ORANGE} style={{ marginTop: 60 }} />
                ) : code ? (
                    <View key="code" style={styles.stack}>
                        {/* Your code */}
                        <Animated.View entering={riseIn(0)} style={styles.hero}>
                            <View style={styles.heroGlow} />
                            <View style={styles.heroGlowSmall} />
                            <Text style={styles.heroEyebrow}>YOUR INVITE CODE</Text>
                            <TouchableOpacity onPress={() => copy("code")} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Your code is ${code.split("").join(" ")}. Tap to copy`}>
                                <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{code}</Text>
                            </TouchableOpacity>
                            <Text style={styles.heroText}>People who join with it earn you up to {rate} on their orders.</Text>

                            <ScalePress style={styles.copyBtn} wrapStyle={{ alignSelf: "stretch" }} onPress={() => copy("code")} accessibilityRole="button" accessibilityLabel={copied === "code" ? "Code copied" : "Copy code"}>
                                <Ionicons name={copied === "code" ? "checkmark-circle" : "copy-outline"} size={18} color={copied === "code" ? "#15803D" : NAVY} />
                                <Text style={[styles.copyText, copied === "code" && { color: "#15803D" }]}>{copied === "code" ? "Copied" : "Copy code"}</Text>
                            </ScalePress>

                            <TouchableOpacity style={styles.link} onPress={() => copy("link")} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={copied === "link" ? "Link copied" : "Copy your invite link"}>
                                <Ionicons name="link" size={15} color="#C9CBD6" />
                                <Text style={styles.linkText} numberOfLines={1}>{copied === "link" ? "Link copied" : inviteLink(code).replace("https://", "")}</Text>
                                <Ionicons name={copied === "link" ? "checkmark" : "copy-outline"} size={15} color="#C9CBD6" />
                            </TouchableOpacity>
                        </Animated.View>

                        {summary?.status === "blocked" && (
                            <Animated.View entering={fadeIn()} style={[styles.note, styles.noteRed]}>
                                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                                <Text style={[styles.noteText, { color: "#B91C1C" }]}>Your invite code is on hold. Please contact us on WhatsApp so we can help.</Text>
                            </Animated.View>
                        )}

                        {/* Share */}
                        <Animated.View entering={riseIn(1)} style={styles.shareRow}>
                            <ScalePress wrapStyle={{ flex: 1 }} style={styles.whatsapp} onPress={shareOnWhatsApp} accessibilityRole="button" accessibilityLabel="Share on WhatsApp">
                                <Ionicons name="logo-whatsapp" size={19} color="#fff" />
                                <Text style={styles.whatsappText} numberOfLines={1}>Share on WhatsApp</Text>
                            </ScalePress>
                            <ScalePress style={styles.more} onPress={moreWays} accessibilityRole="button" accessibilityLabel="More ways to share">
                                <Ionicons name="share-social-outline" size={18} color={NAVY} />
                                <Text style={styles.moreText}>More ways</Text>
                            </ScalePress>
                        </Animated.View>

                        {/* How it's going */}
                        <Animated.View entering={riseIn(2)} style={styles.stats}>
                            <Stat icon="people" value={(summary?.referrals ?? 0).toLocaleString("en-NG")} label="People joined" />
                            <Stat
                                icon="wallet"
                                value={formatNaira(summary?.total_earned ?? 0)}
                                label="Earned so far"
                                hint={summary && summary.pending > 0 ? `+ ${formatNaira(summary.pending)} pending` : undefined}
                            />
                        </Animated.View>

                        <Animated.View entering={riseIn(3)} style={styles.note}>
                            <Ionicons name="information-circle" size={18} color="#B45309" />
                            <Text style={styles.noteText}>Customers must sign up with your code before their first order.</Text>
                        </Animated.View>

                        {/* The Affiliates app */}
                        <Animated.View entering={riseIn(4)} style={styles.card}>
                            <View style={styles.appRow}>
                                <View style={styles.appIcon}><Ionicons name="trending-up" size={22} color="#fff" /></View>
                                <Text style={styles.appTitle}>Track earnings and withdraw in the U Angel Affiliates app</Text>
                            </View>
                            <Text style={styles.appText}>See every order the people you invite place, watch your balance grow and request a payout to your bank account.</Text>
                            <PrimaryButton title="Get the Affiliates app" icon={<Ionicons name="open-outline" size={17} color="#fff" />} onPress={openAffiliatesApp} />
                        </Animated.View>

                        <Animated.View entering={riseIn(5)}>
                            <HowItWorks rate={rate} />
                        </Animated.View>
                    </View>
                ) : pending ? (
                    <View key="pending" style={styles.stack}>
                        <Animated.View entering={riseIn(0)} style={styles.hero}>
                            <View style={styles.heroGlow} />
                            <View style={styles.heroGlowSmall} />
                            <View style={[styles.giftTile, { backgroundColor: "#F59E0B" }]}><Ionicons name="hourglass" size={28} color="#fff" /></View>
                            <Text style={styles.heroTitle}>Application{"\n"}received</Text>
                            <Text style={styles.heroText}>Our team checks every application. Your code appears here as soon as you’re approved.</Text>
                        </Animated.View>

                        <Animated.View entering={riseIn(1)} style={styles.note}>
                            <Ionicons name="refresh-circle" size={18} color="#B45309" />
                            <Text style={styles.noteText}>Pull down to check for an update.</Text>
                        </Animated.View>

                        <Animated.View entering={riseIn(2)}>
                            <HowItWorks rate={rate} />
                        </Animated.View>
                    </View>
                ) : (
                    <View key="join" style={styles.stack}>
                        <Animated.View entering={riseIn(0)} style={styles.hero}>
                            <View style={styles.heroGlow} />
                            <View style={styles.heroGlowSmall} />
                            <View style={styles.giftTile}><Ionicons name="gift" size={30} color="#fff" /></View>
                            <Text style={styles.heroTitle}>Invite others,{"\n"}earn up to {rate}</Text>
                            <Text style={styles.heroText}>On their orders, paid to your bank.</Text>
                        </Animated.View>

                        {rejected && (
                            <Animated.View entering={fadeIn()} style={[styles.note, styles.noteRed]}>
                                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                                <Text style={[styles.noteText, { color: "#B91C1C" }]}>
                                    Your last application wasn’t approved.{summary?.review_note ? ` Reason: ${summary.review_note}` : ""} You can apply again below.
                                </Text>
                            </Animated.View>
                        )}

                        <Animated.View entering={riseIn(1)}>
                            <HowItWorks rate={rate} />
                        </Animated.View>

                        <Animated.View entering={riseIn(2)} style={{ gap: 10 }}>
                            <PrimaryButton title={rejected ? "Apply again" : "Apply to join"} icon={<Ionicons name="arrow-forward" size={18} color="#fff" />} loading={joining} onPress={apply} />
                            <Text style={styles.small}>Free to join. You get your code once we approve you.</Text>
                        </Animated.View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },
    body: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
    stack: { gap: 16 },

    hero: { backgroundColor: NAVY, borderRadius: 28, padding: 22, overflow: "hidden", alignItems: "center", gap: 8 },
    heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(253,101,42,0.28)", right: -70, top: -90 },
    heroGlowSmall: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(253,101,42,0.12)", left: -50, bottom: -60 },
    heroEyebrow: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.6, color: "#FFB08A" },
    heroTitle: { fontFamily: "Quicksand-Bold", fontSize: 26, lineHeight: 32, color: "#fff", textAlign: "center" },
    heroText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: "#C9CBD6", textAlign: "center", maxWidth: 280 },
    giftTile: { width: 64, height: 64, borderRadius: 22, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    code: { fontFamily: "Quicksand-Bold", fontSize: 42, lineHeight: 52, letterSpacing: 6, color: "#fff", textAlign: "center", paddingLeft: 6 },
    copyBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        height: 48, borderRadius: 999, backgroundColor: "#fff", marginTop: 8,
    },
    copyText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: NAVY },
    link: {
        flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch", height: 42, marginTop: 2,
        paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)",
    },
    linkText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, color: "#E6E7EE" },

    shareRow: { flexDirection: "row", gap: 10 },
    whatsapp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 999, backgroundColor: GREEN, paddingHorizontal: 14 },
    whatsappText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff", flexShrink: 1 },
    more: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 52, borderRadius: 999,
        backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E4EA", paddingHorizontal: 16,
    },
    moreText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: NAVY },

    stats: { flexDirection: "row", gap: 12 },
    stat: {
        flex: 1, backgroundColor: "#fff", borderRadius: 22, padding: 16, gap: 2,
        shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    },
    statIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    statValue: { fontFamily: "Quicksand-Bold", fontSize: 24, lineHeight: 30, color: NAVY },
    statLabel: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: GREY },
    statHint: { fontFamily: "Quicksand-Bold", fontSize: 11.5, color: "#C2410C", marginTop: 2 },

    note: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFF7E6", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
    noteRed: { backgroundColor: "#FEF2F2" },
    noteText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, lineHeight: 18, color: "#92400E" },

    card: {
        backgroundColor: "#fff", borderRadius: 26, padding: 18, gap: 14,
        shadowColor: NAVY, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2,
    },
    eyebrow: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.4, color: GREY },
    appRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    appIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
    appTitle: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 16, lineHeight: 21, color: NAVY },
    appText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: GREY },

    step: { flexDirection: "row", gap: 14 },
    stepRail: { alignItems: "center", width: 40 },
    stepIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    stepIconOn: { backgroundColor: ORANGE },
    stepLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: "#F3E3DA", marginVertical: 4 },
    stepBody: { flex: 1, paddingBottom: 18, paddingTop: 1, gap: 2 },
    stepTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: NAVY },
    stepText: { fontFamily: "Quicksand-Medium", fontSize: 13, lineHeight: 18, color: GREY },

    primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 999, backgroundColor: ORANGE },
    primaryText: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#fff" },
    small: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: GREY, textAlign: "center" },
});
