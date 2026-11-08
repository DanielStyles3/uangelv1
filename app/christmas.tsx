import { useEffect, useState } from "react";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import ProductImage from "@/components/ProductImage";
import { CAMPAIGN_END, CAMPAIGN_FLYER, CAMPAIGN_GOAL, campaignLive } from "@/constants/campaign";
import { getCampaignProgress, getHomeProducts } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import useFetch from "@/lib/useFetch";

const RED = "#C8102E";
const INK = "#181C2E";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = (SCREEN_W - 40 - 12) / 2;

const POINTS: [string, string, string, string][] = [
    ["🍲", "#FDECEC", "Your pre-order feeds someone", "Every pre-order helps provide food during the Xmas period for the less privileged."],
    ["🚚", "#FFF5DB", "Delivered next day", "All pre-orders are delivered the day after you order."],
    ["🎁", "#EAF7EF", "Make a difference together", "Let’s make this Christmas brighter for the less privileged."],
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
    const { data: count } = useFetch({ fn: getCampaignProgress });
    const { data: products } = useFetch({ fn: getHomeProducts });
    const left = useCountdown();
    const live = campaignLive();
    const done = count ?? 0;
    const favourites = (products ?? []).filter((p) => p.is_available !== false).slice(0, 6);

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <View style={styles.head}>
                <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={20} color={INK} />
                </TouchableOpacity>
                <Text style={styles.headTitle}>Christmas pre-order</Text>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <Image
                    source={CAMPAIGN_FLYER}
                    style={styles.flyer}
                    resizeMode="cover"
                    accessibilityLabel="Christmas flyer: we want to get 10,000 pre-orders between now and the 15th of December. All pre-orders are delivered next day, to provide food during the Xmas period for the less privileged."
                />

                <View style={styles.progress}>
                    <Text style={styles.count}>
                        {done.toLocaleString("en-NG")} <Text style={styles.countOf}>of {CAMPAIGN_GOAL.toLocaleString("en-NG")} pre-orders</Text>
                    </Text>
                    <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, (done / CAMPAIGN_GOAL) * 100))}%` }]} /></View>
                    {live ? (
                        <View style={styles.cd}>
                            {([[left.d, "days"], [left.h, "hours"], [left.m, "mins"]] as [number, string][]).map(([n, l]) => (
                                <View key={l} style={styles.cdBox}>
                                    <Text style={styles.cdNum}>{l === "days" ? n : String(n).padStart(2, "0")}</Text>
                                    <Text style={styles.cdLabel}>{l}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.thanks}>The campaign has ended. Thank you for every pre-order!</Text>
                    )}
                </View>

                <View style={{ gap: 10 }}>
                    {POINTS.map(([e, bg, t, s]) => (
                        <View key={t} style={styles.point}>
                            <View style={[styles.pointIcon, { backgroundColor: bg }]}><Text style={{ fontSize: 18 }}>{e}</Text></View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pointTitle}>{t}</Text>
                                <Text style={styles.pointText}>{s}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {favourites.length > 0 && (
                    <View style={{ gap: 12 }}>
                        <Text style={styles.h2}>Pre-order favourites</Text>
                        <View style={styles.grid}>
                            {favourites.map((p) => (
                                <Pressable key={p.id} style={styles.card} onPress={() => router.push({ pathname: "/menu/[id]", params: { id: p.id } })} accessibilityLabel={p.name}>
                                    <View style={styles.cardImg}><ProductImage imageUrl={p.image_url} className="size-full" resizeMode="cover" /></View>
                                    <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                                    <Text style={styles.cardPrice}>{formatNaira(p.price)}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {live && (
                <View style={styles.foot}>
                    <TouchableOpacity style={styles.cta} onPress={() => router.push("/search")} accessibilityRole="button">
                        <Text style={styles.ctaText}>Start my pre-order</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center" },
    headTitle: { fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    body: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
    flyer: { width: "100%", aspectRatio: 1, borderRadius: 22 },
    progress: { borderWidth: 1.5, borderColor: "#F5C6CC", backgroundColor: "#FFF6F7", borderRadius: 18, padding: 14, gap: 10 },
    count: { fontFamily: "Quicksand-Bold", fontSize: 26, color: RED },
    countOf: { fontFamily: "Quicksand-SemiBold", fontSize: 14, color: "#4B4F63" },
    bar: { height: 10, borderRadius: 5, backgroundColor: "#F8D7DB", overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 5, backgroundColor: RED },
    cd: { flexDirection: "row", gap: 8 },
    cdBox: { flex: 1, backgroundColor: RED, borderRadius: 12, paddingVertical: 6, alignItems: "center" },
    cdNum: { fontFamily: "Quicksand-Bold", fontSize: 20, color: "#fff" },
    cdLabel: { fontFamily: "Quicksand-SemiBold", fontSize: 11, color: "rgba(255,255,255,0.85)" },
    thanks: { fontFamily: "Quicksand-Bold", fontSize: 14, color: INK },
    point: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    pointIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    pointTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    pointText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, color: "#4B4F63", marginTop: 2 },
    h2: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    card: { width: CARD_W, padding: 8, borderRadius: 18, backgroundColor: "#fff", shadowColor: INK, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    cardImg: { height: 110, borderRadius: 12, overflow: "hidden", backgroundColor: "#FFF3E6" },
    cardName: { fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, marginTop: 8, minHeight: 34 },
    cardPrice: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: "#FE8C00" },
    foot: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, borderTopWidth: 1, borderTopColor: "#ECECF1", backgroundColor: "#fff" },
    cta: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: RED, borderRadius: 999, paddingVertical: 15 },
    ctaText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff" },
});
