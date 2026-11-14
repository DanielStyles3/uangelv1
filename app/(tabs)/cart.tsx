import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {router} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {FadeIn, FadeInUp} from "react-native-reanimated";

import {useCartStore} from "@/store/cart.store";
import useAuthStore from "@/store/auth.store";
import CartItem from "@/components/CartItem";
import ProductImage from "@/components/ProductImage";
import {images, standardDeliveryFee} from "@/constants";
import {formatNaira} from "@/lib/format";
import {getCampaignProducts, getMenu, getProductsNeedingChoices} from "@/lib/api";
import useFetch from "@/lib/useFetch";
import useDeliveryFee from "@/lib/useDeliveryFee";
import {getAppConfig} from "@/lib/appConfig";
import {CartItemType, MenuItem} from "@/type";

import { notify } from "@/lib/notice";
const cartItemKey = (item: CartItemType) =>
    [item.id, ...(item.customizations ?? []).map((c) => c.id).sort()].join('|');

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <View style={styles.row}>
        <Text style={bold ? styles.rowLabelBold : styles.rowLabel}>{label}</Text>
        <Text style={bold ? styles.rowValueBold : styles.rowValue}>{value}</Text>
    </View>
);

/** Small "quick add" product card for the suggestions row. */
const SuggestionCard = ({ item }: { item: MenuItem }) => {
    const { addItem } = useCartStore();
    return (
        <Pressable style={styles.sugCard} onPress={() => router.push({ pathname: '/menu/[id]', params: { id: item.id } })}>
            <View style={styles.sugPhoto}>
                <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
            </View>
            <Text style={styles.sugName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.sugBottom}>
                <Text style={styles.sugPrice}>{formatNaira(item.price)}</Text>
                <Pressable
                    style={styles.sugAdd}
                    hitSlop={8}
                    onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        // Cakes need a size/flavour first: open their page instead.
                        if ((await getProductsNeedingChoices()).has(item.id)) return router.push({ pathname: '/menu/[id]', params: { id: item.id } });
                        addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url, emoji: item.emoji, customizations: [] });
                    }}
                    accessibilityLabel={`Add ${item.name} to cart`}
                >
                    <Ionicons name="add" size={18} color="#fff" />
                </Pressable>
            </View>
        </Pressable>
    );
};

const Suggestions = ({ title, items }: { title: string; items: MenuItem[] }) =>
    items.length === 0 ? null : (
        <View style={{ marginTop: 26 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <FlatList
                data={items}
                keyExtractor={(p) => p.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -20 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}
                renderItem={({ item }) => <SuggestionCard item={item} />}
            />
        </View>
    );

const Cart = () => {
    const { items, getTotalItems, getTotalPrice, clearCart, saveCartForLater } = useCartStore();
    const { user } = useAuthStore();
    const { data: menu } = useFetch({ fn: getMenu, params: { limit: 12 } });

    const { fee: rawFee, ready: feeReady } = useDeliveryFee(items.map((i) => i.id));
    // Christmas pre-order only: nothing is delivered to the buyer, so no address, no delivery fee
    // and no pay-on-delivery (same rule as checkout and the server).
    const { data: packs } = useFetch({ fn: getCampaignProducts });
    const packIds = new Set((packs ?? []).map((p) => p.id));
    const givingOnly = packIds.size > 0 && items.length > 0 && items.every((i) => packIds.has(i.id));
    const deliveryFee = givingOnly ? 0 : rawFee;

    const totalItems = getTotalItems();
    const subtotal = getTotalPrice();
    const total = subtotal + deliveryFee;
    const inCart = new Set(items.map((i) => i.id));
    const suggestions = (menu ?? []).filter((m) => !inCart.has(m.id)).slice(0, 8);
    const address = [user?.address, user?.city, user?.state].filter(Boolean).join(', ');

    const confirmClear = () =>
        notify('Clear cart', 'Remove all items from your cart?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearCart },
        ]);

    const saveForLater = () =>
        notify('Save this cart for later?', 'We’ll keep it in My orders → Active. Open it any time to carry on where you stopped.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Save cart',
                onPress: () => {
                    saveCartForLater();
                    setTimeout(() => notify('Cart saved', 'Find it in Profile → My orders → Active.', [
                        { text: 'Keep shopping', style: 'cancel' },
                        { text: 'View saved', onPress: () => router.push('/orders') },
                    ], { tone: 'success' }), 300);
                },
            },
        ]);

    // ---------- Empty state ----------
    if (items.length === 0) {
        return (
            <SafeAreaView style={styles.screen} edges={['top']}>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                    <Text style={styles.title}>My Cart</Text>
                    <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
                        <View style={styles.emptyArt}>
                            <Image source={images.emptyState} style={{ width: 170, height: 170 }} resizeMode="contain" />
                        </View>
                        <Text style={styles.emptyTitle}>{getAppConfig().texts.emptyCartTitle}</Text>
                        <Text style={styles.emptyBody}>{getAppConfig().texts.emptyCartBody}</Text>
                        <Pressable style={styles.primaryBtn} onPress={() => router.push('/search')}>
                            <Text style={styles.primaryBtnText}>Start shopping</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                        </Pressable>
                    </Animated.View>
                    <Suggestions title="Popular right now" items={suggestions} />
                </ScrollView>
            </SafeAreaView>
        );
    }

    // ---------- Cart ----------
    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {/* flex: 1 so the scroll area never pushes the checkout bar off-screen */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.title}>My Cart</Text>
                        <View style={styles.countPill}>
                            <Text style={styles.countText}>{totalItems} item{totalItems === 1 ? '' : 's'}</Text>
                        </View>
                    </View>
                    <Pressable onPress={confirmClear} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="trash-outline" size={16} color="#F14141" />
                        <Text style={styles.clear}>Clear</Text>
                    </Pressable>
                </View>

                {/* Save for later: parks this cart in My orders → Active */}
                <TouchableOpacity onPress={saveForLater} style={styles.saveRow} activeOpacity={0.8} accessibilityRole="button">
                    <View style={styles.saveIcon}><Ionicons name="bookmark" size={16} color="#FD652A" /></View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.saveTitle}>Not ready to order?</Text>
                        <Text style={styles.saveSub}>Save this cart and come back to it later</Text>
                    </View>
                    <Text style={styles.saveCta}>Save</Text>
                </TouchableOpacity>

                {/* Items */}
                <View style={{ marginTop: 16 }}>
                    {items.map((item, i) => <CartItem key={cartItemKey(item)} item={item} index={i} />)}
                </View>

                {/* Delivering to (not for Christmas pre-orders: we give the food out for you) */}
                {givingOnly ? (
                    <View style={styles.giving}>
                        <View style={styles.givingIcon}><Ionicons name="heart" size={18} color="#fff" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.givingTitle}>Christmas pre-order</Text>
                            <Text style={styles.givingText}>Nothing is delivered to you. U Angel Foods gives this food to someone in need on your behalf.</Text>
                        </View>
                    </View>
                ) : (
                <Pressable style={styles.deliver} onPress={() => router.push('/delivery-address')}>
                    <View style={styles.deliverIcon}>
                        <Ionicons name="location" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.deliverLabel}>DELIVERING TO</Text>
                        <Text style={styles.deliverValue} numberOfLines={2}>{address || 'Add your delivery address'}</Text>
                    </View>
                    <Text style={styles.deliverChange}>{address ? 'Change' : 'Add'}</Text>
                </Pressable>
                )}

                {/* Summary */}
                <Animated.View entering={FadeInUp.delay(150)} style={styles.summary}>
                    <Text style={styles.sectionTitle}>Order summary</Text>
                    <View style={{ marginTop: 10, gap: 10 }}>
                        <Row label={`Subtotal (${totalItems} item${totalItems === 1 ? '' : 's'})`} value={formatNaira(subtotal)} />
                        {!givingOnly && <Row label="Delivery fee" value={feeReady ? formatNaira(deliveryFee) : '…'} />}
                        <View style={styles.divider} />
                        <Row label="Total" value={feeReady || givingOnly ? formatNaira(total) : '…'} bold />
                    </View>
                    {!givingOnly && feeReady && deliveryFee > standardDeliveryFee() && (
                        <Text style={styles.feeNote}>{formatNaira(deliveryFee)} delivery: one fee per order, the highest among your items.</Text>
                    )}
                    <View style={styles.payNote}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#2F9B65" />
                        <Text style={styles.payNoteText}>
                            {givingOnly ? 'Secure online payment with Paystack. No delivery fee.' : 'Pay online with Paystack, or pay on delivery (delivery fee online first)'}
                        </Text>
                    </View>
                </Animated.View>

                <Suggestions title="You might also like" items={suggestions} />
            </ScrollView>

            {/* Sticky checkout bar */}
            <View style={styles.checkoutBar}>
                <View>
                    <Text style={styles.barLabel}>Total</Text>
                    <Text style={styles.barTotal}>{feeReady || givingOnly ? formatNaira(total) : '…'}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.primaryBtn, styles.barBtn]}
                    activeOpacity={0.85}
                    onPress={() => router.push('/checkout')}
                >
                    <Text style={styles.primaryBtnText}>Checkout</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#FAFAFA' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: 'Quicksand-Bold', fontSize: 26, color: '#181C2E' },
    countPill: { backgroundColor: '#FFF1E0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    countText: { fontFamily: 'Quicksand-Bold', fontSize: 12, color: '#FD652A' },
    clear: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#F14141' },
    saveRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14,
        borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#FFE1D3',
    },
    saveIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#FFF1EA', alignItems: 'center', justifyContent: 'center' },
    saveTitle: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#181C2E' },
    saveSub: { fontFamily: 'Quicksand-Medium', fontSize: 12.5, color: '#878787', marginTop: 1 },
    saveCta: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#FD652A' },
    sectionTitle: { fontFamily: 'Quicksand-Bold', fontSize: 18, color: '#181C2E' },

    deliver: {
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, padding: 14,
        borderRadius: 20, backgroundColor: '#181C2E',
    },
    giving: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, padding: 14, borderRadius: 20, backgroundColor: '#FDECEC' },
    givingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#C8102E', alignItems: 'center', justifyContent: 'center' },
    givingTitle: { fontFamily: 'Quicksand-Bold', fontSize: 14.5, color: '#991B1B' },
    givingText: { fontFamily: 'Quicksand-SemiBold', fontSize: 13, lineHeight: 18, color: '#7F1D1D', marginTop: 2 },
    deliverIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FD652A', alignItems: 'center', justifyContent: 'center' },
    deliverLabel: { fontFamily: 'Quicksand-Bold', fontSize: 10, letterSpacing: 1.5, color: '#FD652A' },
    deliverValue: { fontFamily: 'Quicksand-SemiBold', fontSize: 14, color: '#fff', marginTop: 2 },
    deliverChange: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: 'rgba(255,255,255,0.7)' },

    summary: {
        marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: '#fff',
        shadowColor: '#181C2E', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowLabel: { fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#878787' },
    rowValue: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#181C2E' },
    rowLabelBold: { fontFamily: 'Quicksand-Bold', fontSize: 17, color: '#181C2E' },
    rowValueBold: { fontFamily: 'Quicksand-Bold', fontSize: 19, color: '#FD652A' },
    divider: { height: 1, backgroundColor: '#EFEFF2', marginVertical: 2 },
    payNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: '#EAF7F0' },
    payNoteText: { flex: 1, fontFamily: 'Quicksand-SemiBold', fontSize: 12.5, color: '#2F9B65' },
    feeNote: { fontFamily: 'Quicksand-Medium', fontSize: 12, color: '#878787', marginTop: 10 },

    sugCard: {
        width: 150, padding: 10, borderRadius: 20, backgroundColor: '#fff',
        shadowColor: '#181C2E', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    },
    sugPhoto: { height: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF3E6' },
    sugName: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#181C2E', marginTop: 8, minHeight: 34 },
    sugBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    sugPrice: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#FD652A' },
    sugAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FD652A', alignItems: 'center', justifyContent: 'center' },

    empty: { alignItems: 'center', marginTop: 30, paddingHorizontal: 10 },
    emptyArt: { width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFF1E0', alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontFamily: 'Quicksand-Bold', fontSize: 22, color: '#181C2E', marginTop: 20 },
    emptyBody: { fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#878787', textAlign: 'center', marginTop: 6, lineHeight: 20 },

    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        height: 54, paddingHorizontal: 26, marginTop: 20, borderRadius: 999, backgroundColor: '#FD652A',
        shadowColor: '#FD652A', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    primaryBtnText: { fontFamily: 'Quicksand-Bold', fontSize: 16, color: '#fff' },

    checkoutBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff',
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E6E6EA',
    },
    barLabel: { fontFamily: 'Quicksand-Medium', fontSize: 12, color: '#878787' },
    barTotal: { fontFamily: 'Quicksand-Bold', fontSize: 20, color: '#181C2E' },
    barBtn: { flex: 1, marginTop: 0 },
});

export default Cart
