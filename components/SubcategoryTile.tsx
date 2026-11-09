import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import ProductImage from "@/components/ProductImage";
import { SubcategoryWithCount } from "@/type";

const { width: SCREEN_W } = Dimensions.get("window");
export const TILE_W = (SCREEN_W - 40 - 14) / 2;

const countLabel = (n: number) => (n === 0 ? "Coming soon" : n === 1 ? "1 item" : `${n} items`);

/**
 * Photo-first subcategory tile: big rounded photo, dark band at the bottom with the
 * name in white, a count pill and an arrow. Service subcategories (Catering, Events)
 * open their options or the quote form instead of a product list.
 */
const SubcategoryTile = ({ sub, isService, index = 0, accent = "#FD652A" }: {
    sub: SubcategoryWithCount; isService: boolean; index?: number; accent?: string;
}) => {
    const open = () => {
        if (!isService) return router.push({ pathname: "/subcategory/[id]", params: { id: sub.id } });
        if (sub.child_count) return router.push({ pathname: "/category/[id]", params: { id: sub.id } }); // e.g. Catering › Events
        router.push({ pathname: "/service-request", params: { categoryId: sub.parent_id ?? "", subcategoryId: sub.id } });
    };

    const pill = isService ? (sub.child_count ? "See options" : "Get a quote") : countLabel(sub.product_count);

    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(16)}>
            <TouchableOpacity
                style={styles.tile}
                activeOpacity={0.88}
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`${sub.name}, ${pill}`}
            >
                <ProductImage imageUrl={sub.image_url} className="size-full" resizeMode="cover" />

                {/* Soft fade + darker band so the white text always reads on any photo */}
                <View style={styles.fade} />
                <View style={styles.band} />

                <View style={[styles.pill, isService && { backgroundColor: accent }]}>
                    <Text style={[styles.pillText, isService && { color: "#fff" }]}>{pill}</Text>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.name} numberOfLines={2}>{sub.name}</Text>
                    <View style={styles.arrow}>
                        <Ionicons name="arrow-forward" size={15} color="#181C2E" />
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    tile: {
        width: TILE_W,
        height: TILE_W * 1.18,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: "#FFF3E6",
        shadowColor: "#181C2E", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%", backgroundColor: "rgba(10,12,24,0.18)" },
    band: { position: "absolute", left: 0, right: 0, bottom: 0, height: "38%", backgroundColor: "rgba(10,12,24,0.45)" },
    pill: {
        position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.92)",
    },
    pillText: { fontFamily: "Quicksand-Bold", fontSize: 11, color: "#181C2E" },
    footer: { position: "absolute", left: 12, right: 10, bottom: 12, flexDirection: "row", alignItems: "flex-end", gap: 8 },
    name: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 15, lineHeight: 19, color: "#fff" },
    arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});

export default SubcategoryTile;
