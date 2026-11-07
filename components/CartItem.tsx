import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from "react-native-reanimated";

import { useCartStore } from "@/store/cart.store";
import { CartItemType } from "@/type";
import { formatNaira } from "@/lib/format";
import ProductImage from "@/components/ProductImage";

const tap = () => Haptics.selectionAsync().catch(() => {});

/** One cart line: photo, name + add-ons, unit price, − qty + stepper, line total, remove. */
const CartItem = ({ item, index = 0 }: { item: CartItemType; index?: number }) => {
    const { increaseQty, decreaseQty, removeItem } = useCartStore();
    const customizations = item.customizations ?? [];

    const unitPrice = item.price + customizations.reduce((sum, c) => sum + c.price, 0);
    const lineTotal = unitPrice * item.quantity;

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 60).springify().damping(16)}
            exiting={FadeOutLeft.duration(220)}
            layout={LinearTransition.springify().damping(18)}
            style={styles.card}
        >
            <View style={styles.photo}>
                <ProductImage imageUrl={item.image_url} className="size-full" resizeMode="cover" />
            </View>

            <View style={styles.body}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                    <Pressable
                        hitSlop={10}
                        onPress={() => { tap(); removeItem(item.id, customizations); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.name}`}
                        style={styles.remove}
                    >
                        <Ionicons name="close" size={16} color="#8A8A94" />
                    </Pressable>
                </View>

                {customizations.length > 0 && (
                    <Text style={styles.addons} numberOfLines={2}>+ {customizations.map((c) => c.name).join(", ")}</Text>
                )}
                <Text style={styles.unit}>{formatNaira(unitPrice)} each</Text>

                <View style={styles.bottomRow}>
                    <View style={styles.stepper}>
                        <Pressable
                            style={styles.stepBtn}
                            onPress={() => { tap(); decreaseQty(item.id, customizations); }}
                            accessibilityRole="button"
                            accessibilityLabel={item.quantity === 1 ? `Remove ${item.name}` : `Decrease ${item.name}`}
                        >
                            <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color="#181C2E" />
                        </Pressable>
                        <Text style={styles.qty}>{item.quantity}</Text>
                        <Pressable
                            style={[styles.stepBtn, styles.stepBtnPlus]}
                            onPress={() => { tap(); increaseQty(item.id, customizations); }}
                            accessibilityRole="button"
                            accessibilityLabel={`Increase ${item.name}`}
                        >
                            <Ionicons name="add" size={16} color="#fff" />
                        </Pressable>
                    </View>
                    <Text style={styles.total}>{formatNaira(lineTotal)}</Text>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: "row",
        gap: 14,
        padding: 12,
        marginBottom: 12,
        borderRadius: 22,
        backgroundColor: "#fff",
        shadowColor: "#181C2E",
        shadowOpacity: 0.07,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
    },
    photo: { width: 92, height: 92, borderRadius: 18, overflow: "hidden", backgroundColor: "#FFF3E6" },
    body: { flex: 1, justifyContent: "space-between" },
    topRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    name: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 15, color: "#181C2E", lineHeight: 19 },
    remove: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F3F3F6", alignItems: "center", justifyContent: "center" },
    addons: { fontFamily: "Quicksand-Medium", fontSize: 12, color: "#878787", marginTop: 2 },
    unit: { fontFamily: "Quicksand-Medium", fontSize: 12, color: "#878787", marginTop: 2 },
    bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F3F3F6", borderRadius: 999, padding: 3 },
    stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    stepBtnPlus: { backgroundColor: "#FE8C00" },
    qty: { minWidth: 16, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 15, color: "#181C2E" },
    total: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#FE8C00" },
});

export default CartItem;
