import { useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import ProductImage from "@/components/ProductImage";
import { getCategory, getMenu, getProductsNeedingChoices, getSubcategories } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import useFetch from "@/lib/useFetch";
import { useCartStore } from "@/store/cart.store";
import { MenuItem } from "@/type";

const { width: SCREEN_W } = Dimensions.get("window");
const GUTTER = 20;
const CARD_W = (SCREEN_W - GUTTER * 2 - 14) / 2;
const BANNER_H = 250;
const ORANGE = "#FD652A";
const INK = "#181C2E";

type Sort = "popular" | "low" | "high";
const SORTS: { key: Sort; label: string }[] = [
    { key: "popular", label: "Popular" },
    { key: "low", label: "Price ↑" },
    { key: "high", label: "Price ↓" },
];

const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

/** Modern product card: square photo, name, price and a round quick-add button. */
const ProductCard = ({ item, index }: { item: MenuItem; index: number }) => {
    const { addItem } = useCartStore();
    const soldOut = item.is_available === false;

    const quickAdd = async () => {
        // Cakes etc. need a size/flavour first: open their page instead.
        if ((await getProductsNeedingChoices()).has(item.id)) {
            return router.push({ pathname: "/menu/[id]", params: { id: item.id } });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        addItem({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url, emoji: item.emoji, customizations: [] });
    };

    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 50).springify().damping(16)}>
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => router.push({ pathname: "/menu/[id]", params: { id: item.id } })}
                accessibilityLabel={`${item.name}, ${formatNaira(item.price)}${soldOut ? ", sold out" : ""}`}
            >
                <View style={[styles.cardImg, soldOut && { opacity: 0.45 }]}>
                    <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
                </View>
                {soldOut && (
                    <View style={styles.soldOut}><Text style={styles.soldOutText}>Sold out</Text></View>
                )}
                <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.cardBottom}>
                    <Text style={styles.cardPrice}>{formatNaira(item.price)}</Text>
                    {!soldOut && (
                        <TouchableOpacity style={styles.add} onPress={quickAdd} hitSlop={8} accessibilityLabel={`Add ${item.name} to cart`}>
                            <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function SubcategoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
    const [sort, setSort] = useState<Sort>("popular");

    const { data: sub, loading: subLoading } = useFetch({ fn: getCategory, params: { id: id ?? "" }, skip: !id });
    const parentId = sub?.parent_id ?? "";
    const { data: parent } = useFetch({ fn: getCategory, params: { id: parentId }, skip: !parentId });
    const { data: siblings } = useFetch({ fn: getSubcategories, params: { parentId }, skip: !parentId });
    const { data: products, loading: productsLoading } = useFetch({ fn: getMenu, params: { category: id ?? "" }, skip: !id });

    const sorted = useMemo(() => {
        const list = [...(products ?? [])];
        // Available items first, then by the chosen price order.
        list.sort((a, b) => {
            const av = a.is_available === false ? 1 : 0, bv = b.is_available === false ? 1 : 0;
            if (av !== bv) return av - bv;
            if (sort === "low") return Number(a.price) - Number(b.price);
            if (sort === "high") return Number(b.price) - Number(a.price);
            return 0;
        });
        return list;
    }, [products, sort]);

    if (subLoading && !sub) {
        return <View style={[styles.screen, styles.center]}><ActivityIndicator size="large" color={ORANGE} /></View>;
    }

    if (!sub) {
        return (
            <View style={[styles.screen, styles.center, { padding: 24, gap: 12 }]}>
                <Ionicons name="search-outline" size={44} color="#C4C4CC" />
                <Text style={styles.emptyTitle}>This section doesn&apos;t exist</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={goBack}><Text style={styles.emptyBtnText}>Go back</Text></TouchableOpacity>
            </View>
        );
    }

    const accent = parent?.color ?? sub.color ?? ORANGE;
    const deliveryNote = parent?.delivery_note ?? sub.delivery_note;
    const count = products?.length ?? 0;
    const otherSubs = (siblings ?? []).filter((s) => s.product_count > 0 || s.id === sub.id);

    const header = (
        <View>
            {/* Photo banner */}
            <View style={styles.banner}>
                <ProductImage imageUrl={sub.image_url} className="size-full" resizeMode="cover" />
                <View style={styles.bannerFade} />
                <View style={styles.bannerBand} />
                <View style={[styles.bannerContent, { paddingTop: insets.top }]}>
                    {parent && (
                        <TouchableOpacity
                            style={[styles.crumb, { backgroundColor: accent }]}
                            onPress={() => router.push({ pathname: "/category/[id]", params: { id: parent.id } })}
                            hitSlop={6}
                        >
                            <Text style={styles.crumbText} numberOfLines={1}>{parent.name}</Text>
                            <Ionicons name="chevron-forward" size={12} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.title} numberOfLines={2}>{sub.name}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaPill}>
                            <Ionicons name="grid-outline" size={13} color="#fff" />
                            <Text style={styles.metaText}>{productsLoading ? "Loading…" : count === 1 ? "1 item" : `${count} items`}</Text>
                        </View>
                        {deliveryNote && (
                            <View style={styles.metaPill}>
                                <Ionicons name="time-outline" size={13} color="#fff" />
                                <Text style={styles.metaText}>{deliveryNote}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Sheet start: sibling subcategories + sort */}
            <View style={styles.sheetTop}>
                {otherSubs.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sibRow} style={{ marginHorizontal: -GUTTER }}>
                        {otherSubs.map((s) => {
                            const active = s.id === sub.id;
                            return (
                                <TouchableOpacity
                                    key={s.id}
                                    style={[styles.sib, active && { backgroundColor: INK, borderColor: INK }]}
                                    onPress={() => !active && router.replace({ pathname: "/subcategory/[id]", params: { id: s.id } })}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.sibImg}>
                                        <ProductImage imageUrl={s.image_url} className="size-full" resizeMode="cover" />
                                    </View>
                                    <Text style={[styles.sibText, active && { color: "#fff" }]} numberOfLines={1}>{s.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                <View style={styles.sortRow}>
                    <Text style={styles.sortLabel}>Sort</Text>
                    {SORTS.map((s) => (
                        <TouchableOpacity
                            key={s.key}
                            style={[styles.sortChip, sort === s.key && styles.sortChipOn]}
                            onPress={() => { Haptics.selectionAsync().catch(() => {}); setSort(s.key); }}
                        >
                            <Text style={[styles.sortText, sort === s.key && { color: "#fff" }]}>{s.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.screen}>
            <FlatList
                data={sorted}
                keyExtractor={(item) => item.id}
                numColumns={2}
                renderItem={({ item, index }) => <ProductCard item={item} index={index} />}
                columnWrapperStyle={{ gap: 14, paddingHorizontal: GUTTER }}
                contentContainerStyle={{ gap: 14, paddingBottom: 32 + insets.bottom }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    productsLoading ? (
                        <View style={{ paddingVertical: 50 }}><ActivityIndicator size="large" color={ORANGE} /></View>
                    ) : (
                        <View style={[styles.center, { paddingVertical: 50, paddingHorizontal: 30, gap: 10 }]}>
                            <View style={styles.emptyIcon}><Ionicons name="basket-outline" size={34} color={ORANGE} /></View>
                            <Text style={styles.emptyTitle}>No products here yet</Text>
                            <Text style={styles.emptyText}>We&apos;re stocking this section. Check back soon.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={goBack}><Text style={styles.emptyBtnText}>Go back</Text></TouchableOpacity>
                        </View>
                    )
                }
            />

            {/* Floating back + cart buttons over the banner */}
            <View style={[styles.topButtons, { top: insets.top + 10 }]} pointerEvents="box-none">
                <TouchableOpacity style={styles.roundBtn} onPress={goBack} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={INK} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.roundBtn} onPress={() => router.push("/cart")} accessibilityLabel={`Cart, ${cartCount} items`}>
                    <Ionicons name="bag-handle-outline" size={21} color={INK} />
                    {cartCount > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const shadow = { shadowColor: INK, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 };

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#F7F7F9" },
    center: { alignItems: "center", justifyContent: "center" },

    banner: { height: BANNER_H, backgroundColor: "#FFF3E6" },
    bannerFade: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(10,12,24,0.22)" },
    bannerBand: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(10,12,24,0.35)" },
    bannerContent: { position: "absolute", left: GUTTER, right: GUTTER, bottom: 34, gap: 8 },
    crumb: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    crumbText: { fontFamily: "Quicksand-Bold", fontSize: 11.5, color: "#fff" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 28, lineHeight: 33, color: "#fff" },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metaPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)" },
    metaText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: "#fff" },

    sheetTop: { backgroundColor: "#F7F7F9", borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, paddingTop: 18, paddingHorizontal: GUTTER, paddingBottom: 6, gap: 14 },
    sibRow: { paddingHorizontal: GUTTER, gap: 8 },
    sib: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 4, paddingRight: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8E8EE" },
    sibImg: { width: 30, height: 30, borderRadius: 15, overflow: "hidden", backgroundColor: "#FFF3E6" },
    sibText: { fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, maxWidth: 170 },

    sortRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sortLabel: { fontFamily: "Quicksand-Bold", fontSize: 13, color: "#878787", marginRight: 2 },
    sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8E8EE" },
    sortChipOn: { backgroundColor: ORANGE, borderColor: ORANGE },
    sortText: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: INK },

    card: { width: CARD_W, padding: 8, borderRadius: 22, backgroundColor: "#fff", ...shadow },
    cardImg: { width: "100%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#FFF3E6" },
    soldOut: { position: "absolute", top: 16, left: 16, backgroundColor: INK, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    soldOutText: { fontFamily: "Quicksand-Bold", fontSize: 11, color: "#fff" },
    cardName: { fontFamily: "Quicksand-Bold", fontSize: 13.5, lineHeight: 18, color: INK, marginTop: 10, marginHorizontal: 4, minHeight: 36 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginHorizontal: 4, marginBottom: 2 },
    cardPrice: { fontFamily: "Quicksand-Bold", fontSize: 15, color: ORANGE },
    add: { width: 34, height: 34, borderRadius: 17, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },

    topButtons: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
    roundBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    badge: {
        position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
        backgroundColor: "#FD652A", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center",
    },
    badgeText: { fontFamily: "Quicksand-Bold", fontSize: 9.5, color: "#fff" },

    emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#FFF1E0", alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },
    emptyText: { fontFamily: "Quicksand-Medium", fontSize: 14, color: "#878787", textAlign: "center" },
    emptyBtn: { marginTop: 8, backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13 },
    emptyBtnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff" },
});
