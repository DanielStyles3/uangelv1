import { CartCustomization, CartStore } from "@/type";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const MAX_SAVED = 10;

function areCustomizationsEqual(
    a: CartCustomization[] = [],
    b: CartCustomization[] = []
): boolean {
    if (a.length !== b.length) return false;

    const aSorted = [...a].sort((x, y) => x.id.localeCompare(y.id));
    const bSorted = [...b].sort((x, y) => x.id.localeCompare(y.id));

    // Text options count too: two cakes with different messages are different cart lines.
    return aSorted.every((item, idx) => item.id === bSorted[idx].id && (item.text ?? '') === (bSorted[idx].text ?? ''));
}

// Kept on the phone, so the cart survives closing the app and is still there when the
// customer comes back from the payment page to change something.
export const useCartStore = create<CartStore>()(persist((set, get) => ({
    items: [],
    savedCarts: [],

    saveCartForLater: () => {
        const items = get().items;
        if (!items.length) return;
        const saved = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, savedAt: new Date().toISOString(), items };
        set({ savedCarts: [saved, ...get().savedCarts].slice(0, MAX_SAVED), items: [] });
    },

    restoreSavedCart: (id) => {
        const saved = get().savedCarts.find((c) => c.id === id);
        if (!saved) return;
        set({ items: saved.items, savedCarts: get().savedCarts.filter((c) => c.id !== id) });
    },

    deleteSavedCart: (id) => set({ savedCarts: get().savedCarts.filter((c) => c.id !== id) }),

    addItem: (item, quantity = 1) => {
        const customizations = item.customizations ?? [];

        const existing = get().items.find(
            (i) =>
                i.id === item.id &&
                areCustomizationsEqual(i.customizations ?? [], customizations)
        );

        if (existing) {
            set({
                items: get().items.map((i) =>
                    i.id === item.id &&
                    areCustomizationsEqual(i.customizations ?? [], customizations)
                        ? { ...i, quantity: i.quantity + quantity }
                        : i
                ),
            });
        } else {
            set({
                items: [...get().items, { ...item, quantity, customizations }],
            });
        }
    },

    removeItem: (id, customizations = []) => {
        set({
            items: get().items.filter(
                (i) =>
                    !(
                        i.id === id &&
                        areCustomizationsEqual(i.customizations ?? [], customizations)
                    )
            ),
        });
    },

    increaseQty: (id, customizations = []) => {
        set({
            items: get().items.map((i) =>
                i.id === id &&
                areCustomizationsEqual(i.customizations ?? [], customizations)
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
            ),
        });
    },

    decreaseQty: (id, customizations = []) => {
        set({
            items: get()
                .items.map((i) =>
                    i.id === id &&
                    areCustomizationsEqual(i.customizations ?? [], customizations)
                        ? { ...i, quantity: i.quantity - 1 }
                        : i
                )
                .filter((i) => i.quantity > 0),
        });
    },

    clearCart: () => set({ items: [] }),

    getTotalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),

    getTotalPrice: () =>
        get().items.reduce((total, item) => {
            const base = item.price;
            const customPrice =
                item.customizations?.reduce(
                    (s: number, c: CartCustomization) => s + c.price,
                    0
                ) ?? 0;
            return total + item.quantity * (base + customPrice);
        }, 0),
}), {
    name: "uangel-cart",
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => ({ items: s.items, savedCarts: s.savedCarts }),
}));
