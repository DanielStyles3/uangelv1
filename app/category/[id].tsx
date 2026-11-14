import { useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import CategoryCard from "@/components/CategoryCard";
import CustomButton from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import ProductImage from "@/components/ProductImage";
import SubcategoryTile from "@/components/SubcategoryTile";
import { getCategory, getProductsNeedingChoices, getSubcategories } from "@/lib/api";
import { Catalog, childrenOf, countIn, pathTo, productsIn, snapCategory, snapSubcategories, treeIds } from "@/lib/catalog";
import { formatNaira } from "@/lib/format";
import useCatalog from "@/lib/useCatalog";
import useFetch from "@/lib/useFetch";
import { useCartStore } from "@/store/cart.store";
import { Category, MenuItem } from "@/type";

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GUTTER = 16;
const COLS = 3;
const GAP = 10;
const CARD_W = (Dimensions.get("window").width - GUTTER * 2 - GAP * (COLS - 1)) / COLS;

/**
 * A main category. Shop categories browse like a supermarket aisle:
 *   tabs (subcategories) → chips (groups inside a tab) → sections (headings) → products.
 *   e.g. The Local Market: [Fruits & Vegetables] [Meat…] → (Fruits) (Vegetables) (Herbs) → Bananas / Citrus…
 * Levels that don't exist are simply skipped, and empty branches are hidden.
 * Service categories (Catering) keep their request-a-quote page.
 * `sel` (optional) opens straight at a subcategory/group/section inside it.
 */
export default function CategoryScreen() {
    const { id, sel } = useLocalSearchParams<{ id: string; sel?: string }>();
    const snap = useCatalog();
    const main = snap?.categories.find((c) => c.id === id);

    if (main?.kind === "service") return <ServiceCategory id={id} />;
    if (!snap) return <View style={styles.screen} />;
    if (!main) return <ServiceCategory id={id} />;   // unknown here yet: the classic page fetches it
    return <ShopCategory snap={snap} main={main} sel={sel} />;
}

type Section = { key: string; title: string | null; items: MenuItem[] };
type Row = { key: string; kind: "header"; title: string } | { key: string; kind: "row"; items: MenuItem[] };

function ShopCategory({ snap, main, sel }: { snap: Catalog; main: Category; sel?: string }) {
    const insets = useSafeAreaInsets();
    const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
    const addItem = useCartStore((s) => s.addItem);
    const listRef = useRef<FlatList<Row>>(null);

    // Only branches that actually hold products.
    const live = (c: Category) => countIn(snap, c.id) > 0;
    const tabs = useMemo(() => childrenOf(snap, main.id).filter(live), [snap, main.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Start where we were sent (a subcategory, group or section), else the first tab.
    const start = useMemo(() => {
        const path = sel ? pathTo(snap, sel) : [];
        return { tab: path[1]?.id, chip: path[2]?.id };
    }, [snap, sel]);
    const [tabId, setTabId] = useState<string | undefined>(start.tab);
    const [chipId, setChipId] = useState<string | undefined>(start.chip);
    const [sheet, setSheet] = useState(false);

    const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
    const chips = useMemo(() => {
        if (!tab) return [];
        const list = childrenOf(snap, tab.id).filter(live).map((c) => ({ id: c.id, name: c.name }));
        // Products placed straight in the tab (not in one of its groups) get their own chip.
        if (list.length && productsIn(snap, tab.id).length) list.push({ id: `${tab.id}:more`, name: `More ${tab.name}` });
        return list;
    }, [snap, tab]); // eslint-disable-line react-hooks/exhaustive-deps
    const chip = chips.find((c) => c.id === chipId) ?? chips[0];

    // What's on screen: the chosen group (or the tab when it has none), as sections of products.
    const sections: Section[] = useMemo(() => {
        if (!tab && !tabs.length) {
            // A category with products but no subcategories at all.
            return [{ key: main.id, title: null, items: productsIn(snap, main.id) }];
        }
        if (!tab) return [];
        if (chip?.id === `${tab.id}:more`) return [{ key: chip.id, title: null, items: productsIn(snap, tab.id) }];
        const node = chip ? chip.id : tab.id;
        const subs = childrenOf(snap, node).filter(live);
        if (!subs.length) {
            const ids = treeIds(snap, node);
            return [{ key: node, title: null, items: snap.products.filter((p) => p.category_id && ids.has(p.category_id)).sort((a, b) => a.name.localeCompare(b.name)) }];
        }
        const own = productsIn(snap, node);
        return [
            ...(own.length ? [{ key: `${node}:own`, title: null, items: own }] : []),
            ...subs.map((s) => {
                const ids = treeIds(snap, s.id);
                return { key: s.id, title: s.name, items: snap.products.filter((p) => p.category_id && ids.has(p.category_id)).sort((a, b) => a.name.localeCompare(b.name)) };
            }),
        ];
    }, [snap, main.id, tabs.length, tab, chip]); // eslint-disable-line react-hooks/exhaustive-deps

    // Flatten into rows of 3 for a fast list.
    const rows: Row[] = useMemo(() => sections.flatMap((s) => {
        const out: Row[] = s.title ? [{ key: `h:${s.key}`, kind: "header", title: s.title }] : [];
        for (let i = 0; i < s.items.length; i += COLS) out.push({ key: `r:${s.key}:${i}`, kind: "row", items: s.items.slice(i, i + COLS) });
        return out;
    }), [sections]);

    const choose = (t?: string, c?: string) => {
        Haptics.selectionAsync().catch(() => {});
        setTabId(t); setChipId(c);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
    };

    const quickAdd = async (item: MenuItem) => {
        // Cakes etc. need a size/flavour first: open their page instead.
        if ((await getProductsNeedingChoices()).has(item.id)) {
            return router.push({ pathname: "/menu/[id]", params: { id: item.id } });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        addItem({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url, emoji: item.emoji, customizations: [] });
    };

    const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
    const empty = countIn(snap, main.id) === 0;

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.round} onPress={back} accessibilityLabel="Back"><Ionicons name="chevron-back" size={22} color={INK} /></TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{main.name}</Text>
                <TouchableOpacity style={styles.round} onPress={() => router.push({ pathname: "/search", params: { category: main.id } })} accessibilityLabel={`Search ${main.name}`}>
                    <Ionicons name="search" size={20} color={INK} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.round} onPress={() => router.push("/cart")} accessibilityLabel={`Cart, ${cartCount} items`}>
                    <Ionicons name="bag-handle-outline" size={20} color={INK} />
                    {cartCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? "99+" : cartCount}</Text></View>}
                </TouchableOpacity>
            </View>

            {/* Tabs: the subcategories */}
            {tabs.length > 0 && (
                <View style={styles.tabsWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                        {tabs.map((t) => {
                            const on = t.id === tab?.id;
                            return (
                                <TouchableOpacity key={t.id} onPress={() => !on && choose(t.id, undefined)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                                    <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{t.name}</Text>
                                    <View style={[styles.tabLine, on && { backgroundColor: INK }]} />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Chips: groups inside the tab */}
            {chips.length > 0 && (
                <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {chips.map((c) => {
                            const on = c.id === chip?.id;
                            return (
                                <TouchableOpacity key={c.id} onPress={() => !on && choose(tab?.id, c.id)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                                    <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{c.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Sections and products */}
            <FlatList
                ref={listRef}
                data={rows}
                keyExtractor={(r) => r.key}
                renderItem={({ item: r }) => r.kind === "header"
                    ? <Text style={styles.section}>{r.title}</Text>
                    : (
                        <View style={styles.row}>
                            {r.items.map((p) => <ProductTile key={p.id} item={p} onAdd={quickAdd} />)}
                        </View>
                    )}
                contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 110 + insets.bottom }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                windowSize={9}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyIcon}><Ionicons name="basket-outline" size={34} color={ORANGE} /></View>
                        <Text style={styles.emptyTitle}>{empty ? "Coming soon" : "Nothing here yet"}</Text>
                        <Text style={styles.emptyText}>We&apos;re stocking {main.name}. Check back soon.</Text>
                    </View>
                }
            />

            {/* Jump anywhere in the category */}
            {tabs.length > 1 && (
                <TouchableOpacity style={[styles.fab, { bottom: 24 + insets.bottom }]} onPress={() => setSheet(true)} activeOpacity={0.9} accessibilityLabel="All categories">
                    <Ionicons name="grid-outline" size={18} color={INK} />
                    <Text style={styles.fabText}>Categories</Text>
                </TouchableOpacity>
            )}

            <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
                <Pressable style={styles.backdrop} onPress={() => setSheet(false)} />
                <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
                    <View style={styles.grip} />
                    <Text style={styles.sheetTitle}>{main.name}</Text>
                    <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.6 }} showsVerticalScrollIndicator={false}>
                        {tabs.map((t) => {
                            const groups = childrenOf(snap, t.id).filter(live);
                            return (
                                <View key={t.id} style={{ marginBottom: 14 }}>
                                    <TouchableOpacity onPress={() => { setSheet(false); choose(t.id, undefined); }}>
                                        <Text style={[styles.sheetTab, t.id === tab?.id && { color: ORANGE }]}>{t.name}</Text>
                                    </TouchableOpacity>
                                    {groups.map((g) => (
                                        <TouchableOpacity key={g.id} style={styles.sheetRow} onPress={() => { setSheet(false); choose(t.id, g.id); }}>
                                            <Text style={styles.sheetRowText}>{g.name}</Text>
                                            <Text style={styles.sheetCount}>{countIn(snap, g.id)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function ProductTile({ item, onAdd }: { item: MenuItem; onAdd: (p: MenuItem) => void }) {
    const soldOut = item.is_available === false;
    return (
        <Pressable style={styles.tile} onPress={() => router.push({ pathname: "/menu/[id]", params: { id: item.id } })} accessibilityLabel={`${item.name}, ${formatNaira(item.price)}${soldOut ? ", sold out" : ""}`}>
            <View style={[styles.tileImg, soldOut && { opacity: 0.45 }]}>
                <ProductImage imageUrl={item.image_url} resizeMode="cover" />
                {!soldOut && (
                    <TouchableOpacity style={styles.plus} onPress={() => onAdd(item)} hitSlop={6} accessibilityLabel={`Add ${item.name} to cart`}>
                        <Ionicons name="add" size={20} color={INK} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.tilePrice}>{soldOut ? "Sold out" : formatNaira(item.price)}</Text>
        </Pressable>
    );
}

/** Catering & co: the classic page (card + request types). */
function ServiceCategory({ id }: { id: string }) {
    const { data: category, loading: categoryLoading } = useFetch({ fn: getCategory, params: { id: id ?? '' }, skip: !id, key: 'shop:category', initial: () => snapCategory(id) });
    const { data: subcategories, loading: subsLoading } = useFetch({ fn: getSubcategories, params: { parentId: id ?? '' }, skip: !id, key: 'shop:subcategories', initial: () => snapSubcategories(id) });

    if (categoryLoading && !category) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5 pt-5">
                <CustomHeader title="" />
                <View style={{ height: 160, borderRadius: 24, backgroundColor: '#F5F5F7', marginTop: 8 }} />
            </SafeAreaView>
        );
    }

    if (!category) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5 pt-5">
                <CustomHeader title="Category" />
                <View className="flex-1 items-center justify-center gap-y-3 pb-20">
                    <Ionicons name="search-outline" size={52} color="#C4C4CC" />
                    <Text className="paragraph-bold text-dark-100">Category not found</Text>
                    <View className="w-40">
                        <CustomButton title="Go home" onPress={() => router.replace('/')} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const isService = category.kind === 'service';

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                data={subcategories ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <SubcategoryTile sub={item} isService={isService} index={index} accent={category.color ?? ORANGE} />
                )}
                numColumns={2}
                columnWrapperStyle={{ gap: 14 }}
                contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
                ListHeaderComponent={() => (
                    <View className="mb-5">
                        <CustomHeader title={category.name} />
                        <View className="-mt-8">
                            <CategoryCard category={category} interactive={false} />
                        </View>
                        {category.description && (
                            <Text className="paragraph-medium text-gray-200 mt-1">{category.description}</Text>
                        )}
                        <View className="mt-5">
                            {isService ? (
                                <CustomButton title="Request a quote" onPress={() => router.push({ pathname: '/service-request', params: { categoryId: category.id } })} />
                            ) : (
                                <CustomButton title={`Browse all ${category.name}`} onPress={() => router.push({ pathname: '/search', params: { category: category.id } })} />
                            )}
                        </View>
                        {(subcategories?.length ?? 0) > 0 && (
                            <Text className="h3-bold text-dark-100 mt-8">{isService ? 'What are you planning?' : 'Shop by type'}</Text>
                        )}
                    </View>
                )}
                ListEmptyComponent={() =>
                    subsLoading ? null : (
                        <View className="py-10 items-center gap-y-2">
                            <Ionicons name="basket-outline" size={44} color="#C4C4CC" />
                            <Text className="paragraph-bold text-dark-100">No sections here yet</Text>
                            <Text className="body-regular text-gray-200 text-center">Check back soon, or browse everything in {category.name}.</Text>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },

    header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10 },
    headerTitle: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 18, color: INK, textAlign: "center" },
    round: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F3F3F6", alignItems: "center", justifyContent: "center" },
    badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: ORANGE, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
    badgeText: { fontFamily: "Quicksand-Bold", fontSize: 9.5, color: "#fff" },

    tabsWrap: { borderBottomWidth: 1, borderBottomColor: "#ECECF0" },
    tabs: { paddingHorizontal: GUTTER, gap: 22 },
    tab: { paddingTop: 6 },
    tabText: { fontFamily: "Quicksand-SemiBold", fontSize: 15, color: "#5B5B66", paddingBottom: 10 },
    tabTextOn: { fontFamily: "Quicksand-Bold", color: INK },
    tabLine: { height: 3, borderRadius: 2, backgroundColor: "transparent" },

    chips: { paddingHorizontal: GUTTER, paddingVertical: 12, gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: "#F3F3F6" },
    chipOn: { backgroundColor: ORANGE },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },
    chipTextOn: { color: "#fff" },

    section: { fontFamily: "Quicksand-Bold", fontSize: 20, color: INK, marginTop: 18, marginBottom: 12 },
    row: { flexDirection: "row", gap: GAP, marginBottom: 16 },
    tile: { width: CARD_W },
    tileImg: { width: "100%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#F5F5F7" },
    plus: {
        position: "absolute", right: 6, bottom: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    tileName: { fontFamily: "Quicksand-SemiBold", fontSize: 13, lineHeight: 17, color: INK, marginTop: 8, minHeight: 34 },
    tilePrice: { fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, marginTop: 2 },

    empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 30, gap: 10 },
    emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#FFF1E0", alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },
    emptyText: { fontFamily: "Quicksand-Medium", fontSize: 14, color: "#878787", textAlign: "center" },

    fab: {
        position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 999,
        paddingHorizontal: 18, paddingVertical: 13, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    fabText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },

    backdrop: { flex: 1, backgroundColor: "rgba(10,12,24,0.45)" },
    sheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10 },
    grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#E2E2E8", marginBottom: 12 },
    sheetTitle: { fontFamily: "Quicksand-Bold", fontSize: 20, color: INK, marginBottom: 14 },
    sheetTab: { fontFamily: "Quicksand-Bold", fontSize: 16, color: INK, paddingVertical: 6 },
    sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, paddingLeft: 12 },
    sheetRowText: { fontFamily: "Quicksand-SemiBold", fontSize: 14.5, color: "#3A3A44" },
    sheetCount: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: "#9A9AA3" },
});
