import { useEffect, useState } from "react";
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import ProductImage from "@/components/ProductImage";
import { CAMPAIGN_END, CAMPAIGN_FLYER, CAMPAIGN_GOAL, campaignLive } from "@/constants/campaign";
import { getCampaignProduct, getCampaignProgress } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import useFetch from "@/lib/useFetch";

type IconName = keyof typeof Ionicons.glyphMap;

const RED = "#C8102E";
const RED_DEEP = "#991B1B";
const GOLD = "#F5B301";
const INK = "#181C2E";
const { width: SCREEN_W } = Dimensions.get("window");
const GUTTER = 20;
// Explicit pixel sizes (not % + aspectRatio) so Android never stretches or crops the flyer.
const FLYER = SCREEN_W - GUTTER * 2 - 24;
const CARD_W = (SCREEN_W - GUTTER * 2 - 12) / 2;

const POINTS: { icon: IconName; tint: string; color: string; title: string; text: string }[] = [
    { icon: "restaurant", tint: "#FDECEC", color: RED, title: "Cooked food for the homeless", text: "We give cooked food to the homeless and handicapped during the Xmas period." },
    { icon: "basket", tint: "#EAF7EF", color: "#15803D", title: "Food for orphans and widows", text: "We provide orphans and widows with uncooked food." },
    { icon: "heart", tint: "#FFF5DB", color: "#B45309", title: "Given out the next day", text: "We take your pre-order to someone in need the day after you order. No delivery fee for you." },
];

function useCountdown() {
    const calc = () => {
        const mins = Math.max(0, Math.floor((CAMPAIGN_END - Date.now()) / 60000));
        return { d: Math.floor(mins / 1440), h: Math.floor(mins / 60) % 24, m: mins % 60 };
    };
    const [left, setLeft] = useState(calc);
    useEffect(() => { const t = setInterval(() => setLeft(calc()), 30000); return () => clearInterval(t); }, []);
    return left;
}

/** Christmas pre-order campaign: flyer, live progress towards 10,000, countdown, favourites. */
export default function Christmas() {
    const insets = useSafeAreaInsets();
    const { data: count } = useFetch({ fn: getCampaignProgress });
    const { data: pack } = useFetch({ fn: getCampaignProduct });
    const left = useCountdown();
    const live = campaignLive();
    const done = count ?? 0;
    const pct = Math.min(100, (done / CAMPAIGN_GOAL) * 100);
    // The Christmas Food Pack (a special product: no delivery, counts toward the goal).
    const openPack = () => (pack ? router.push({ pathname: "/menu/[id]", params: { id: pack.id } }) : router.push("/search"));

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <View style={styles.head}>
                <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={20} color={INK} />
                </TouchableOpacity>
                <Text style={styles.headTitle}>Christmas pre-order</Text>
            </View>

            <ScrollView
                contentContainerStyle={[styles.body, { paddingBottom: (live ? 110 : 32) + insets.bottom }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero: festive card with the full, uncropped flyer */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
                    <View style={[styles.glow, { top: -70, right: -60 }]} />
                    <View style={[styles.glow, { bottom: -80, left: -70, backgroundColor: "rgba(245,179,1,0.18)" }]} />
                    <View style={styles.eyebrowPill}>
                        <Ionicons name="sparkles" size={12} color={RED_DEEP} />
                        <Text style={styles.eyebrow}>CHRISTMAS 2026 CAMPAIGN</Text>
                    </View>
                    <Text style={styles.heroTitle}>Help us reach{"\n"}10,000 pre-orders</Text>
                    <Text style={styles.heroText}>Between now and 25 December. Every order feeds someone in need.</Text>
                    <Image
                        source={CAMPAIGN_FLYER}
                        style={styles.flyer}
                        resizeMode="contain"
                        accessibilityLabel="Christmas flyer: we want to get 10,000 pre-orders between now and the 25th of December. All pre-orders are delivered next day, to provide food during the Xmas period for the less privileged."
                    />
                </Animated.View>

                {/* Progress + countdown */}
                <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.progress}>
                    <View style={styles.progressTop}>
                        <Text style={styles.count}>{done.toLocaleString("en-NG")}</Text>
                        <Text style={styles.countOf}>of {CAMPAIGN_GOAL.toLocaleString("en-NG")} pre-orders</Text>
                    </View>
                    <View style={styles.bar}>
                        <View style={[styles.barFill, { width: `${Math.max(2, pct)}%` }]} />
                    </View>
                    <Text style={styles.pct}>{pct < 1 && done > 0 ? "<1" : Math.floor(pct)}% of our goal</Text>
                    {live ? (
                        <View style={styles.cd}>
                            {([[left.d, "Days"], [left.h, "Hours"], [left.m, "Mins"]] as [number, string][]).map(([n, l]) => (
                                <View key={l} style={styles.cdBox}>
                                    <Text style={styles.cdNum}>{l === "Days" ? n : String(n).padStart(2, "0")}</Text>
                                    <Text style={styles.cdLabel}>{l}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.thanks}>The campaign has ended. Thank you for every pre-order!</Text>
                    )}
                </Animated.View>

                {/* Why it matters */}
                <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.points}>
                    {POINTS.map((p, i) => (
                        <View key={p.title} style={[styles.point, i < POINTS.length - 1 && styles.pointDivider]}>
                            <View style={[styles.pointIcon, { backgroundColor: p.tint }]}>
                                <Ionicons name={p.icon} size={20} color={p.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pointTitle}>{p.title}</Text>
                                <Text style={styles.pointText}>{p.text}</Text>
                            </View>
                        </View>
                    ))}
                </Animated.View>

                {/* The Christmas Food Pack */}
                {pack && (
                    <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ gap: 12 }}>
                        <Text style={styles.h2}>Your pre-order</Text>
                        <TouchableOpacity style={styles.pack} activeOpacity={0.88} onPress={openPack} accessibilityRole="button" accessibilityLabel={`${pack.name}, ${formatNaira(pack.price)}`}>
                            <View style={styles.packImg}>
                                <ProductImage imageUrl={pack.image_url} className="size-full" resizeMode="cover" />
                            </View>
                            <View style={{ padding: 16, gap: 8 }}>
                                <Text style={styles.packName}>{pack.name}</Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                    <View style={styles.packTag}><Ionicons name="checkmark-circle" size={13} color="#15803D" /><Text style={styles.packTagText}>No delivery fee</Text></View>
                                    <View style={styles.packTag}><Ionicons name="heart" size={13} color="#15803D" /><Text style={styles.packTagText}>Feeds someone in need</Text></View>
                                </View>
                                <View style={styles.cardBottom}>
                                    <Text style={styles.packPrice}>{formatNaira(pack.price)}</Text>
                                    <View style={styles.packBtn}><Text style={styles.packBtnText}>Pre-order</Text><Ionicons name="arrow-forward" size={15} color="#fff" /></View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Sticky CTA — padded above Android's navigation bar so it's never covered/washed out */}
            {live && (
                <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
                    <TouchableOpacity style={styles.cta} onPress={openPack} activeOpacity={0.88} accessibilityRole="button">
                        <Ionicons name="gift" size={18} color="#fff" />
                        <Text style={styles.ctaText}>Start my pre-order</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const shadow = { shadowColor: INK, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#FAFAFB" },
    head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: "#FAFAFB" },
    back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow },
    headTitle: { fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    body: { paddingHorizontal: GUTTER, paddingTop: 4, gap: 16 },

    hero: { backgroundColor: RED, borderRadius: 26, padding: 12, paddingTop: 18, overflow: "hidden", alignItems: "center" },
    glow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.10)" },
    eyebrowPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: GOLD, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
    eyebrow: { fontFamily: "Quicksand-Bold", fontSize: 10.5, letterSpacing: 1.2, color: RED_DEEP },
    heroTitle: { fontFamily: "Quicksand-Bold", fontSize: 26, lineHeight: 31, color: "#fff", textAlign: "center", marginTop: 12 },
    heroText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.88)", textAlign: "center", marginTop: 6, marginBottom: 14, paddingHorizontal: 10 },
    flyer: { width: FLYER, height: FLYER, borderRadius: 18, backgroundColor: "#fff" },

    progress: { backgroundColor: "#fff", borderRadius: 22, padding: 16, gap: 10, ...shadow },
    progressTop: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
    count: { fontFamily: "Quicksand-Bold", fontSize: 30, color: RED },
    countOf: { fontFamily: "Quicksand-SemiBold", fontSize: 14, color: "#4B4F63" },
    bar: { height: 12, borderRadius: 6, backgroundColor: "#F8D7DB", overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 6, backgroundColor: RED },
    pct: { fontFamily: "Quicksand-SemiBold", fontSize: 12, color: "#878787" },
    cd: { flexDirection: "row", gap: 8, marginTop: 4 },
    cdBox: { flex: 1, backgroundColor: INK, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
    cdNum: { fontFamily: "Quicksand-Bold", fontSize: 22, color: "#fff" },
    cdLabel: { fontFamily: "Quicksand-SemiBold", fontSize: 11, color: GOLD, marginTop: 1 },
    thanks: { fontFamily: "Quicksand-Bold", fontSize: 14, color: INK },

    points: { backgroundColor: "#fff", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 4, ...shadow },
    point: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 14 },
    pointDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#ECECF1" },
    pointIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    pointTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    pointText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: "#4B4F63", marginTop: 2 },

    h2Row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    h2: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },
    seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: "#FD652A" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    card: { width: CARD_W, padding: 8, borderRadius: 18, backgroundColor: "#fff", ...shadow },
    cardImg: { height: 112, borderRadius: 12, overflow: "hidden", backgroundColor: "#FFF3E6" },
    cardName: { fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, marginTop: 8, minHeight: 34 },
    pack: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", ...shadow },
    packImg: { width: "100%", height: FLYER * 0.62, backgroundColor: "#FDECEC" },
    packName: { fontFamily: "Quicksand-Bold", fontSize: 18, lineHeight: 23, color: INK },
    packTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E9F8EF", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    packTagText: { fontFamily: "Quicksand-Bold", fontSize: 11.5, color: "#15803D" },
    packPrice: { fontFamily: "Quicksand-Bold", fontSize: 20, color: RED },
    packBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: RED, paddingHorizontal: 16, height: 40, borderRadius: 999 },
    packBtnText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#fff" },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    cardPrice: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: "#FD652A" },
    cardAdd: { width: 28, height: 28, borderRadius: 14, backgroundColor: RED, alignItems: "center", justifyContent: "center" },

    foot: {
        position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 12,
        backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#ECECF1",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
    },
    cta: {
        flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: RED,
        borderRadius: 999, height: 56,
        shadowColor: RED, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
    },
    ctaText: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#fff" },
});
