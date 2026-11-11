import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    Extrapolation, FadeInDown, FadeInUp, FadeOutDown, interpolate,
    useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSequence, withSpring,
} from "react-native-reanimated";

import useFetch from "@/lib/useFetch";
import { getCategory, getMenu, getMenuItem, getMenuItemCustomizations, getProductOptions } from "@/lib/api";
import ProductOptions, { answersToCart, missingRequired, OptionAnswers, StepHeader } from "@/components/ProductOptions";
import { useCartStore } from "@/store/cart.store";
import { deliveryFeeForCategory } from "@/constants";
import { formatNaira } from "@/lib/format";
import ProductImage from "@/components/ProductImage";
import { CartCustomization, Customization, MenuItem } from "@/type";

type IconName = keyof typeof Ionicons.glyphMap;

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_W * 0.95);
const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";

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

/** One of the three info tiles under the price. */
const InfoTile = ({ icon, value, label }: { icon: IconName; value: string; label: string }) => (
    <View style={styles.tile}>
        <Ionicons name={icon} size={20} color={ORANGE} />
        <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </View>
);

/** Add-on / extra as a tappable card with an icon and a checkbox (2 per row). */
const AddonCard = ({ item, selected, onPress }: { item: Customization; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.addon, selected && styles.addonOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${item.name}, ${Number(item.price) > 0 ? `plus ${formatNaira(item.price)}` : "free"}`}
    >
        <View style={[styles.addonIcon, selected && { backgroundColor: ORANGE }]}>
            <Ionicons name={iconFor(item.name)} size={19} color={selected ? "#fff" : ORANGE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.addonName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.addonPrice}>{Number(item.price) > 0 ? `+${formatNaira(item.price)}` : "Free"}</Text>
        </View>
        <View style={[styles.check, selected && styles.checkOn]}>
            {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
    </TouchableOpacity>
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
    const { addItem, getTotalItems, getTotalPrice } = useCartStore();

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

    // Where the "Make it yours" steps start inside the sheet (for scroll-to).
    const [optionsY, setOptionsY] = useState(0);
    const scrollRef = useAnimatedRef<Animated.ScrollView>();

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
    const addons = customizations ?? [];
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
    const accent = mainCategory?.color ?? ORANGE;
    const deliveryNote = mainCategory?.delivery_note || "Same-day delivery";
    const deliveryShort = /next/i.test(deliveryNote) ? "Next day" : "Same day";
    const deliveryFee = deliveryFeeForCategory(mainCategory?.name);
    const groups = optionGroups ?? [];
    const optionLines = answersToCart(groups, answers);
    const unitPrice = Number(item.price)
        + selected.reduce((sum, c) => sum + Number(c.price), 0)
        + optionLines.reduce((sum, c) => sum + c.price, 0);
    const total = unitPrice * quantity;
    const longDescription = (item.description ?? "").length > 140;
    const cartCount = getTotalItems();
    const soldOut = item.is_available === false;
    const missing = missingRequired(groups, answers);
    const hasChoices = groups.length > 0 || addons.length > 0;
    const pricedOptions = groups.some((g) => g.option_values?.some((v) => Number(v.price) > 0));

    // Third info tile: real nutrition when we have it, otherwise how payment works.
    const thirdTile: { icon: IconName; value: string; label: string } =
        item.calories != null ? { icon: "flame-outline", value: `${item.calories} kcal`, label: "Energy" }
        : item.protein != null ? { icon: "barbell-outline", value: `${item.protein}g`, label: "Protein" }
        : { icon: "shield-checkmark-outline", value: "Paystack", label: "Secure pay" };

    const choiceSummary = [
        ...optionLines.map((c) => c.name),
        ...(selected.length ? [`+ ${selected.map((c) => c.name).join(", ")}`] : []),
    ];

    const scrollToOptions = () => {
        scrollRef.current?.scrollTo({ y: Math.max(0, HERO_H - 32 + optionsY - 90), animated: true });
    };

    const share = () => {
        Share.share({ message: `${item.name} – ${formatNaira(item.price)} on U Angel Foods. Every order helps feed someone in need.` }).catch(() => {});
    };

    const handleAddToCart = () => {
        if (soldOut) return;
        if (missing.length) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            return scrollToOptions();
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
        addedTimer.current = setTimeout(() => setAdded(false), 4000);
    };

    return (
        <View style={styles.screen}>
            {/* Hero photo (behind the scrolling sheet) */}
            <Animated.View style={[styles.hero, heroStyle]}>
                <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
                <View style={styles.heroShade} />
            </Animated.View>

            <Animated.ScrollView
                ref={scrollRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingTop: HERO_H - 32, paddingBottom: 150 + insets.bottom }}
            >
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    {/* Title block */}
                    <Animated.View entering={FadeInDown.delay(60).springify().damping(16)} style={{ gap: 8 }}>
                        {(subcategory || mainCategory) && (
                            <TouchableOpacity
                                style={[styles.crumb, { backgroundColor: `${accent}1F` }]}
                                onPress={() => subcategory && router.push({ pathname: "/subcategory/[id]", params: { id: subcategory.id } })}
                                hitSlop={6}
                            >
                                <Text style={[styles.crumbText, { color: accent }]} numberOfLines={1}>
                                    {[mainCategory?.name, subcategory?.parent_id ? subcategory.name : null].filter(Boolean).join("  ›  ")}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <Text style={styles.name}>{item.name}</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.price}>{pricedOptions ? `From ${formatNaira(item.price)}` : formatNaira(item.price)}</Text>
                            {pricedOptions && <Text style={styles.priceNote}>price depends on your choices</Text>}
                        </View>
                        {soldOut && (
                            <View style={styles.soldOutPill}>
                                <Ionicons name="close-circle" size={14} color="#B91C1C" />
                                <Text style={styles.soldOutText}>Sold out right now</Text>
                            </View>
                        )}
                    </Animated.View>

                    {/* Info tiles */}
                    <Animated.View entering={FadeInDown.delay(110).springify().damping(16)} style={styles.tiles}>
                        {item.is_campaign ? (
                            <>
                                <InfoTile icon="heart-outline" value="Next day" label="Given out" />
                                <InfoTile icon="card-outline" value="Online" label="Payment" />
                                <InfoTile icon="people-outline" value="Less privileged" label="Who it feeds" />
                            </>
                        ) : (
                            <>
                                <InfoTile icon="time-outline" value={deliveryShort} label="Delivery" />
                                <InfoTile icon="bicycle-outline" value={formatNaira(deliveryFee)} label="Delivery fee" />
                                <InfoTile icon={thirdTile.icon} value={thirdTile.value} label={thirdTile.label} />
                            </>
                        )}
                    </Animated.View>

                    {/* Description */}
                    {item.description ? (
                        <Animated.View entering={FadeInDown.delay(160).springify().damping(16)}>
                            <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>{item.description}</Text>
                            {longDescription && (
                                <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8}>
                                    <Text style={styles.readMore}>{expanded ? "Show less" : "Read more"}</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    ) : null}

                    {/* Mission */}
                    <Animated.View entering={FadeInDown.delay(200).springify().damping(16)} style={styles.mission}>
                        <Ionicons name="heart" size={18} color={ORANGE} />
                        <Text style={styles.missionText}>This order helps feed someone in need. U Are An Angel.</Text>
                    </Animated.View>

                    {/* "Make it yours" entry card → scrolls to the steps */}
                    {hasChoices && !soldOut && (
                        <Animated.View entering={FadeInDown.delay(240).springify().damping(16)}>
                            <TouchableOpacity style={styles.makeCard} onPress={scrollToOptions} activeOpacity={0.85}>
                                <View style={styles.makeIcon}><Ionicons name="sparkles" size={19} color="#fff" /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.makeTitle}>Make it yours</Text>
                                    <Text style={styles.makeText} numberOfLines={1}>
                                        {groups.length ? groups.map((g) => g.name.toLowerCase()).join(", ") + (addons.length ? " & add-ons" : "") : "Add-ons & extras"}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-down" size={18} color={GREY} />
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {/* Steps */}
                    {hasChoices && (
                        <View style={styles.steps} onLayout={(e) => setOptionsY(e.nativeEvent.layout.y)}>
                            <ProductOptions groups={groups} answers={answers} onChange={setAnswers} startStep={1} />

                            {addons.length > 0 && (
                                <View style={{ gap: 12 }}>
                                    <StepHeader step={groups.length + 1} title="Add-ons & extras" required={false} />
                                    <View style={styles.addonGrid}>
                                        {addons.map((c) => (
                                            <AddonCard key={c.id} item={c} selected={selectedIds.has(c.id)} onPress={() => toggle(c)} />
                                        ))}
                                    </View>
                                </View>
                            )}

                            {choiceSummary.length > 0 && (
                                <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.summary}>
                                    <Text style={styles.summaryLabel}>YOUR CHOICES</Text>
                                    {choiceSummary.map((line) => (
                                        <Text key={line} style={styles.summaryLine}>{line}</Text>
                                    ))}
                                </Animated.View>
                            )}
                        </View>
                    )}

                    {/* Similar items */}
                    {similar.length > 0 && (
                        <View style={{ marginTop: 28 }}>
                            <View style={styles.sectionHead}>
                                <Text style={styles.sectionTitle}>More from {subcategory?.name ?? "this category"}</Text>
                            </View>
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

            {/* Top bar: title bar that fades in on scroll + always-visible round buttons */}
            <Animated.View style={[styles.topBarBg, { height: insets.top + 64 }, barStyle]}>
                <Text style={[styles.topBarTitle, { marginTop: insets.top + 20 }]} numberOfLines={1}>{item.name}</Text>
            </Animated.View>
            <View style={[styles.topButtons, { top: insets.top + 10 }]} pointerEvents="box-none">
                <TouchableOpacity style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={22} color={INK} />
                </TouchableOpacity>
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity style={styles.roundBtn} onPress={share} accessibilityLabel="Share">
                        <Ionicons name="share-outline" size={20} color={INK} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.roundBtn} onPress={() => router.push("/cart")} accessibilityLabel={`Cart, ${cartCount} items`}>
                        <Ionicons name="bag-handle-outline" size={21} color={INK} />
                        {cartCount > 0 && (
                            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* "Added" snackbar */}
            {added && (
                <Animated.View entering={FadeInUp.springify().damping(15)} exiting={FadeOutDown} style={[styles.snack, { bottom: 100 + insets.bottom }]}>
                    <View style={styles.snackTick}><Ionicons name="checkmark" size={16} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.snackText}>Added to cart</Text>
                        <Text style={styles.snackSub}>{cartCount} item{cartCount === 1 ? "" : "s"} · {formatNaira(getTotalPrice())} so far</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push("/cart")} hitSlop={10}>
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
                        <Ionicons name="remove" size={18} color={INK} />
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
                        style={[styles.addBtn, soldOut ? styles.addBtnOff : missing.length ? styles.addBtnNeedsChoice : null]}
                        onPress={handleAddToCart}
                        activeOpacity={0.88}
                        disabled={soldOut}
                        accessibilityState={{ disabled: soldOut }}
                    >
                        <Ionicons name={soldOut ? "close-circle-outline" : missing.length ? "arrow-down-circle-outline" : "bag-add"} size={18} color="#fff" />
                        <Text style={styles.addBtnText} numberOfLines={1}>
                            {soldOut ? "Sold out right now"
                                : missing.length ? `Choose ${missing[0].toLowerCase()} to continue`
                                : `Add to cart · ${formatNaira(total)}`}
                        </Text>
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
    heroShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.06)" },

    sheet: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, gap: 18, minHeight: 600 },
    grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: "#E4E4EA", alignSelf: "center", marginBottom: -4 },

    crumb: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    crumbText: { fontFamily: "Quicksand-Bold", fontSize: 12 },
    name: { fontFamily: "Quicksand-Bold", fontSize: 25, lineHeight: 31, color: INK },
    priceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
    price: { fontFamily: "Quicksand-Bold", fontSize: 24, color: "#C2410C" },
    priceNote: { fontFamily: "Quicksand-SemiBold", fontSize: 13, color: GREY },
    soldOutPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#FDECEC", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    soldOutText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: "#B91C1C" },

    tiles: { flexDirection: "row", gap: 8 },
    tile: { flex: 1, backgroundColor: "#F6F6F8", borderRadius: 16, paddingVertical: 11, paddingHorizontal: 6, alignItems: "center", gap: 3 },
    tileValue: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },
    tileLabel: { fontFamily: "Quicksand-SemiBold", fontSize: 11, color: GREY },

    description: { fontFamily: "Quicksand-Medium", fontSize: 14.5, lineHeight: 22, color: "#4B4B55" },
    readMore: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: ORANGE, marginTop: 4 },

    mission: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 16, backgroundColor: "#FFF1EA" },
    missionText: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 13, color: "#9A3412" },

    makeCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#FDBA9B" },
    makeIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
    makeTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    makeText: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: GREY, marginTop: 1 },

    steps: { gap: 26, marginTop: 10 },
    addonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    addon: { width: "48.6%", minHeight: 66, flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: "#E4E4EA", backgroundColor: "#fff" },
    addonOn: { borderWidth: 2, borderColor: ORANGE, backgroundColor: "#FFF4EE" },
    addonIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    addonName: { fontFamily: "Quicksand-Bold", fontSize: 13, lineHeight: 16, color: INK },
    addonPrice: { fontFamily: "Quicksand-Bold", fontSize: 12, color: "#C2410C", marginTop: 2 },
    check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: "#D6D6DD", alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: ORANGE, borderColor: ORANGE },

    summary: { backgroundColor: "#F6F6F8", borderRadius: 18, padding: 14, gap: 4 },
    summaryLabel: { fontFamily: "Quicksand-Bold", fontSize: 11.5, letterSpacing: 0.8, color: GREY, marginBottom: 2 },
    summaryLine: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },

    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },

    similar: { width: 140 },
    similarPhoto: { width: 140, height: 110, borderRadius: 18, overflow: "hidden", backgroundColor: "#FFF3E6" },
    similarName: { fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, marginTop: 8, minHeight: 34 },
    similarPrice: { fontFamily: "Quicksand-Bold", fontSize: 13, color: "#C2410C", marginTop: 2 },

    topBarBg: {
        position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#fff", alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E6E6EA",
    },
    topBarTitle: { fontFamily: "Quicksand-Bold", fontSize: 16, color: INK, maxWidth: SCREEN_W - 180 },
    topButtons: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
    roundBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
    },
    cartBadge: {
        position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
        backgroundColor: ORANGE, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center",
    },
    cartBadgeText: { fontFamily: "Quicksand-Bold", fontSize: 9.5, color: "#fff" },

    snack: {
        position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: INK, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13,
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    },
    snackTick: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#2F9B65", alignItems: "center", justifyContent: "center" },
    snackText: { fontFamily: "Quicksand-Bold", fontSize: 14.5, color: "#fff" },
    snackSub: { fontFamily: "Quicksand-SemiBold", fontSize: 12, color: "#C9CBD6", marginTop: 1 },
    snackAction: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#FFB08A" },

    bottomBar: {
        position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 20, paddingTop: 12, backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E6EA",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
    },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F3F3F6", borderRadius: 999, padding: 4 },
    stepBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    stepBtnPlus: { backgroundColor: ORANGE },
    qty: { minWidth: 16, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    addBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 999,
        backgroundColor: ORANGE, paddingHorizontal: 14,
        shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    addBtnNeedsChoice: { backgroundColor: INK, shadowColor: INK, shadowOpacity: 0.2 },
    addBtnOff: { backgroundColor: "#B4B5C0", shadowOpacity: 0 },
    addBtnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff", flexShrink: 1 },
});
