import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    Extrapolation, FadeInDown, FadeInUp, FadeOutDown, interpolate,
    useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from "react-native-reanimated";

import useFetch from "@/lib/useFetch";
import { getCategory, getMenu, getMenuItem, getMenuItemCustomizations, getProductOptions } from "@/lib/api";
import ProductOptions, { answersToCart, missingRequired, OptionAnswers } from "@/components/ProductOptions";
import { useCartStore } from "@/store/cart.store";
import { deliveryFeeForCategory } from "@/constants";
import { formatNaira } from "@/lib/format";
import ProductImage from "@/components/ProductImage";
import { CartCustomization, Customization, MenuItem } from "@/type";

type IconName = keyof typeof Ionicons.glyphMap;

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_W * 0.92);
const ORANGE = "#FD652A";

// Icons for the seeded add-ons/extras (no emoji); anything else gets a sparkle.
const CUSTOMIZATION_ICON: Record<string, IconName> = {
    "birthday candles": "flame-outline",
    "edible photo topper": "image-outline",
    "extra frosting": "ice-cream-outline",
    "gift message card": "mail-outline",
    "extra ice": "snow-outline",
    "chilled delivery": "thermometer-outline",
    "cake knife & plates set": "restaurant-outline",
    "gift box packaging": "gift-outline",
    "balloons bundle": "balloon-outline",
    "extra server/waiter": "people-outline",
    "disposable plates & cutlery pack": "fast-food-outline",
    "chairs & tables setup": "grid-outline",
};
const iconFor = (name: string): IconName => CUSTOMIZATION_ICON[name.trim().toLowerCase()] ?? "sparkles-outline";

const InfoChip = ({ icon, label }: { icon: IconName; label: string }) => (
    <View style={styles.chip}>
        <Ionicons name={icon} size={15} color={ORANGE} />
        <Text style={styles.chipText}>{label}</Text>
    </View>
);

const OptionCard = ({ item, selected, onPress }: { item: Customization; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.option, selected && styles.optionSelected]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${item.name}, plus ${formatNaira(item.price)}`}
    >
        <View style={[styles.optionIcon, selected && { backgroundColor: ORANGE }]}>
            <Ionicons name={iconFor(item.name)} size={20} color={selected ? "#fff" : ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.optionName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.optionPrice}>{Number(item.price) > 0 ? `+${formatNaira(item.price)}` : "Free"}</Text>
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
            {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
    </TouchableOpacity>
);

const OptionSection = ({ title, hint, data, selectedIds, onToggle }: {
    title: string; hint: string; data: Customization[]; selectedIds: Set<string>; onToggle: (c: Customization) => void;
}) => data.length === 0 ? null : (
    <View style={styles.section}>
        <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionHint}>{hint}</Text>
        </View>
        <View style={{ gap: 10 }}>
            {data.map((c) => <OptionCard key={c.id} item={c} selected={selectedIds.has(c.id)} onPress={() => onToggle(c)} />)}
        </View>
    </View>
);

const SimilarCard = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
        style={styles.similar}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: "/menu/[id]", params: { id: item.id } })}
    >
        <View style={styles.similarPhoto}>
            <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
        </View>
        <Text style={styles.similarName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.similarPrice}>{formatNaira(item.price)}</Text>
    </TouchableOpacity>
);

export default function ProductDetails() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { addItem, getTotalItems } = useCartStore();

    const { data: item, loading } = useFetch({ fn: getMenuItem, params: { id } });
    const { data: customizations } = useFetch({ fn: getMenuItemCustomizations, params: { id } });
    const { data: optionGroups } = useFetch({ fn: getProductOptions, params: { id } });
    const [answers, setAnswers] = useState<OptionAnswers>({ picks: {}, texts: {} });

    // Product → its subcategory → main category (which carries the delivery note).
    const subcategoryId = item?.category_id ?? "";
    const { data: subcategory } = useFetch({ fn: getCategory, params: { id: subcategoryId }, skip: !subcategoryId });
    const parentId = subcategory?.parent_id ?? "";
    const { data: parentCategory } = useFetch({ fn: getCategory, params: { id: parentId }, skip: !parentId });
    const { data: similarRaw } = useFetch({ fn: getMenu, params: { category: subcategoryId, limit: 10 }, skip: !subcategoryId });

    const [selected, setSelected] = useState<Customization[]>([]);
    const [quantity, setQuantity] = useState(1);
    const [expanded, setExpanded] = useState(false);
    const [added, setAdded] = useState(false);
    const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

    // Scroll-driven hero (parallax + pull-to-zoom) and a top bar that fades in.
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
    const heroStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: interpolate(scrollY.value, [-HERO_H, 0, HERO_H], [-HERO_H / 2, 0, HERO_H * 0.5], Extrapolation.CLAMP) },
            { scale: interpolate(scrollY.value, [-HERO_H, 0], [2, 1], Extrapolation.CLAMP) },
        ],
    }));
    const barStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [HERO_H * 0.45, HERO_H * 0.7], [0, 1], Extrapolation.CLAMP),
    }));

    const btnScale = useSharedValue(1);
    const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

    const selectedIds = useMemo(() => new Set(selected.map((c) => c.id)), [selected]);
    const toppings = (customizations ?? []).filter((c) => c.type === "topping");
    const sides = (customizations ?? []).filter((c) => c.type === "side");
    const similar = (similarRaw ?? []).filter((m) => m.id !== id).slice(0, 8);

    const toggle = (c: Customization) => {
        Haptics.selectionAsync().catch(() => {});
        setSelected((prev) => (prev.some((s) => s.id === c.id) ? prev.filter((s) => s.id !== c.id) : [...prev, c]));
    };

    if (loading || !item) {
        return (
            <View style={[styles.screen, styles.center]}>
                {loading ? <ActivityIndicator color={ORANGE} size="large" /> : (
                    <>
                        <Ionicons name="fast-food-outline" size={44} color="#C4C4CC" />
                        <Text style={styles.sectionTitle}>Item not found</Text>
                        <TouchableOpacity style={styles.addBtn} onPress={() => router.back()}>
                            <Text style={styles.addBtnText}>Go back</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    }

    const mainCategory = subcategory && !subcategory.parent_id ? subcategory : parentCategory;
    const deliveryNote = mainCategory?.delivery_note || "Same-day delivery";
    const groups = optionGroups ?? [];
    const optionLines = answersToCart(groups, answers);
    const unitPrice = Number(item.price)
        + selected.reduce((sum, c) => sum + Number(c.price), 0)
        + optionLines.reduce((sum, c) => sum + c.price, 0);
    const total = unitPrice * quantity;
    const longDescription = (item.description ?? "").length > 140;
    const cartCount = getTotalItems();

    const soldOut = item.is_available === false;

    const handleAddToCart = () => {
        if (soldOut) return;
        const missing = missingRequired(groups, answers);
        if (missing.length) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            return Alert.alert('Almost there', `Please choose a ${missing.map((m) => m.toLowerCase()).join(' and a ')} for your cake.`);
        }
        const cartCustomizations: CartCustomization[] = [
            ...optionLines,
            ...selected.map((c) => ({ id: c.id, name: c.name, price: Number(c.price), type: c.type })),
        ];
        addItem({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url, emoji: item.emoji, customizations: cartCustomizations }, quantity);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        btnScale.set(withSequence(withSpring(0.94, { damping: 10, stiffness: 400 }), withSpring(1, { damping: 8 })));
        setAdded(true);
        if (addedTimer.current) clearTimeout(addedTimer.current);
        addedTimer.current = setTimeout(() => setAdded(false), 3500);
    };

    return (
        <View style={styles.screen}>
            {/* Hero photo (behind the scrolling sheet) */}
            <Animated.View style={[styles.hero, heroStyle]}>
                <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
                <View style={styles.heroShade} />
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: HERO_H - 32, paddingBottom: 140 + insets.bottom }}
            >
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    {/* Title block */}
                    <Animated.View entering={FadeInDown.delay(80).springify().damping(16)}>
                        {(subcategory || mainCategory) && (
                            <TouchableOpacity
                                style={styles.crumb}
                                onPress={() => subcategory && router.push({ pathname: "/subcategory/[id]", params: { id: subcategory.id } })}
                                hitSlop={6}
                            >
                                <Text style={styles.crumbText} numberOfLines={1}>
                                    {[mainCategory?.name, subcategory?.parent_id ? subcategory.name : null].filter(Boolean).join("  ›  ")}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.price}>{groups.length ? `From ${formatNaira(item.price)}` : formatNaira(item.price)}</Text>
                    </Animated.View>

                    {/* Info chips */}
                    <Animated.View entering={FadeInDown.delay(140).springify().damping(16)} style={styles.chips}>
                        <InfoChip icon="time-outline" label={deliveryNote} />
                        <InfoChip icon="bicycle-outline" label={`${formatNaira(deliveryFeeForCategory(mainCategory?.name))} delivery`} />
                        {item.calories != null && <InfoChip icon="flame-outline" label={`${item.calories} kcal`} />}
                        {item.protein != null && <InfoChip icon="barbell-outline" label={`${item.protein}g protein`} />}
                    </Animated.View>

                    {/* Description */}
                    {item.description ? (
                        <Animated.View entering={FadeInDown.delay(200).springify().damping(16)} style={styles.section}>
                            <Text style={styles.sectionTitle}>About this item</Text>
                            <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>{item.description}</Text>
                            {longDescription && (
                                <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8}>
                                    <Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    ) : null}

                    {/* Mission note */}
                    <Animated.View entering={FadeInDown.delay(240).springify().damping(16)} style={styles.mission}>
                        <Ionicons name="heart" size={18} color="#FD652A" />
                        <Text style={styles.missionText}>Every purchase helps fund our outreach programs. U Are An Angel.</Text>
                    </Animated.View>

                    <ProductOptions groups={groups} answers={answers} onChange={setAnswers} />

                    <OptionSection title="Add-ons" hint="Optional" data={toppings} selectedIds={selectedIds} onToggle={toggle} />
                    <OptionSection title="Extras" hint="Optional" data={sides} selectedIds={selectedIds} onToggle={toggle} />

                    {/* Similar items */}
                    {similar.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>More from {subcategory?.name ?? "this category"}</Text>
                            <FlatList
                                data={similar}
                                keyExtractor={(m) => m.id}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginHorizontal: -20, marginTop: 12 }}
                                contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                                renderItem={({ item: m }) => <SimilarCard item={m} />}
                            />
                        </View>
                    )}
                </View>
            </Animated.ScrollView>

            {/* Top bar: always-visible round buttons + a title bar that fades in on scroll */}
            <Animated.View style={[styles.topBarBg, { height: insets.top + 60 }, barStyle]}>
                <Text style={[styles.topBarTitle, { marginTop: insets.top + 18 }]} numberOfLines={1}>{item.name}</Text>
            </Animated.View>
            <View style={[styles.topButtons, { top: insets.top + 10 }]} pointerEvents="box-none">
                <TouchableOpacity style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color="#181C2E" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.roundBtn} onPress={() => router.push("/cart")} accessibilityLabel={`Cart, ${cartCount} items`}>
                    <Ionicons name="bag-handle-outline" size={21} color="#181C2E" />
                    {cartCount > 0 && (
                        <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>
                    )}
                </TouchableOpacity>
            </View>

            {/* "Added" snackbar */}
            {added && (
                <Animated.View entering={FadeInUp.springify().damping(15)} exiting={FadeOutDown} style={[styles.snack, { bottom: 104 + insets.bottom }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#2F9B65" />
                    <Text style={styles.snackText}>Added to cart</Text>
                    <TouchableOpacity onPress={() => router.push("/cart")} hitSlop={8}>
                        <Text style={styles.snackAction}>View cart</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Sticky bottom bar */}
            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.stepper}>
                    <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => { Haptics.selectionAsync().catch(() => {}); setQuantity((q) => Math.max(1, q - 1)); }}
                        accessibilityLabel="Decrease quantity"
                    >
                        <Ionicons name="remove" size={18} color="#181C2E" />
                    </TouchableOpacity>
                    <Text style={styles.qty}>{quantity}</Text>
                    <TouchableOpacity
                        style={[styles.stepBtn, styles.stepBtnPlus]}
                        onPress={() => { Haptics.selectionAsync().catch(() => {}); setQuantity((q) => Math.min(50, q + 1)); }}
                        accessibilityLabel="Increase quantity"
                    >
                        <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>

                <Animated.View style={[{ flex: 1 }, btnStyle]}>
                    <TouchableOpacity
                        style={[styles.addBtn, soldOut && { backgroundColor: '#B4B5C0' }]}
                        onPress={handleAddToCart}
                        activeOpacity={0.88}
                        disabled={soldOut}
                        accessibilityState={{ disabled: soldOut }}
                    >
                        <Ionicons name={soldOut ? "close-circle-outline" : "bag-add"} size={18} color="#fff" />
                        <Text style={styles.addBtnText}>{soldOut ? 'Sold out right now' : `Add to cart · ${formatNaira(total)}`}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    center: { alignItems: "center", justifyContent: "center", gap: 12 },

    hero: { position: "absolute", top: 0, left: 0, right: 0, height: HERO_H, backgroundColor: "#FFF3E6" },
    heroShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.08)" },

    sheet: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingTop: 10,
        minHeight: 600,
    },
    grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#E4E4EA", alignSelf: "center", marginBottom: 16 },

    crumb: { alignSelf: "flex-start", backgroundColor: "#FFF3E6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 10 },
    crumbText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: ORANGE },
    name: { fontFamily: "Quicksand-Bold", fontSize: 26, lineHeight: 32, color: "#181C2E" },
    price: { fontFamily: "Quicksand-Bold", fontSize: 24, color: ORANGE, marginTop: 6 },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
    chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F6F6F8" },
    chipText: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: "#181C2E" },

    section: { marginTop: 26 },
    sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
    sectionTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: "#181C2E" },
    sectionHint: { fontFamily: "Quicksand-SemiBold", fontSize: 12, color: "#A3A3AD" },
    description: { fontFamily: "Quicksand-Medium", fontSize: 14.5, lineHeight: 22, color: "#5B5B66", marginTop: 8 },
    readMore: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: ORANGE, marginTop: 6 },

    mission: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, padding: 14, borderRadius: 18, backgroundColor: "#FFF1EA" },
    missionText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, color: "#9A3412" },

    option: {
        flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18,
        backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#EDEDF1",
    },
    optionSelected: { borderColor: ORANGE, backgroundColor: "#FFF8F0" },
    optionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#FFF3E6", alignItems: "center", justifyContent: "center" },
    optionName: { fontFamily: "Quicksand-Bold", fontSize: 14.5, color: "#181C2E" },
    optionPrice: { fontFamily: "Quicksand-SemiBold", fontSize: 13, color: "#878787", marginTop: 2 },
    check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: "#D6D6DD", alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: ORANGE, borderColor: ORANGE },

    similar: { width: 140 },
    similarPhoto: { width: 140, height: 110, borderRadius: 18, overflow: "hidden", backgroundColor: "#FFF3E6" },
    similarName: { fontFamily: "Quicksand-Bold", fontSize: 13, color: "#181C2E", marginTop: 8, minHeight: 34 },
    similarPrice: { fontFamily: "Quicksand-Bold", fontSize: 13, color: ORANGE, marginTop: 2 },

    topBarBg: {
        position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#fff", alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6EA",
    },
    topBarTitle: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#181C2E", maxWidth: SCREEN_W - 140 },
    topButtons: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
    roundBtn: {
        width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    cartBadge: {
        position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
        backgroundColor: "#FD652A", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center",
    },
    cartBadgeText: { fontFamily: "Quicksand-Bold", fontSize: 9.5, color: "#fff" },

    snack: {
        position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "#181C2E", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
        shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },
    snackText: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 14, color: "#fff" },
    snackAction: { fontFamily: "Quicksand-Bold", fontSize: 14, color: ORANGE },

    bottomBar: {
        position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 14,
        paddingHorizontal: 20, paddingTop: 12, backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E6EA",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F3F3F6", borderRadius: 999, padding: 4 },
    stepBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    stepBtnPlus: { backgroundColor: ORANGE },
    qty: { minWidth: 18, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 17, color: "#181C2E" },
    addBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 999,
        backgroundColor: ORANGE, paddingHorizontal: 16,
        shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    addBtnText: { fontFamily: "Quicksand-Bold", fontSize: 15.5, color: "#fff" },
});
