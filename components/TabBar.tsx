import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { Tabs } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { useCartStore } from "@/store/cart.store";

const ORANGE = "#FD652A";
const INACTIVE = "#8A8A94";
const INDICATOR_W = 28;

// expo-router's own tab navigator props (state, emitter, navigateToTab…), derived from <Tabs tabBar>.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type IconName = keyof typeof Ionicons.glyphMap;
const ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
    index:   { active: "home",         inactive: "home-outline",         label: "Home" },
    search:  { active: "search",       inactive: "search-outline",       label: "Search" },
    cart:    { active: "bag-handle",   inactive: "bag-handle-outline",   label: "Cart" },
    profile: { active: "person",       inactive: "person-outline",       label: "Profile" },
};

const TabButton = ({ name, focused, onPress, onLongPress, badge }: {
    name: string; focused: boolean; onPress: () => void; onLongPress: () => void; badge?: number;
}) => {
    const meta = ICONS[name] ?? { active: "ellipse", inactive: "ellipse-outline", label: name };
    const scale = useSharedValue(1);

    // Little bounce whenever this tab becomes active.
    useEffect(() => {
        if (focused) scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focused]);

    const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${meta.label}, ${badge} items` : meta.label}
        >
            <Animated.View style={iconStyle}>
                <Ionicons name={focused ? meta.active : meta.inactive} size={24} color={focused ? ORANGE : INACTIVE} />
                {badge ? (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                    </View>
                ) : null}
            </Animated.View>
            <Text style={[styles.label, { color: focused ? ORANGE : INACTIVE, fontFamily: focused ? "Quicksand-Bold" : "Quicksand-SemiBold" }]}>
                {meta.label}
            </Text>
        </Pressable>
    );
};

/**
 * Docked bottom tab bar (replaces the old floating pill): white bar with a hairline top
 * border, a short orange indicator that slides to the active tab, filled/outline Ionicons,
 * a bounce on select and a live cart badge.
 */
const TabBar = ({ state, emitter, navigateToTab }: TabBarProps) => {
    const insets = useSafeAreaInsets();
    const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
    const [width, setWidth] = useState(0);
    const tabWidth = width / state.routes.length;

    const x = useSharedValue(0);
    useEffect(() => {
        if (tabWidth) x.value = withSpring(state.index * tabWidth + (tabWidth - INDICATOR_W) / 2, { damping: 16, stiffness: 170 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.index, tabWidth]);
    const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

    return (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {width > 0 && <Animated.View style={[styles.indicator, indicatorStyle]} />}

            {state.routes.map((route, index) => {
                const focused = state.index === index;
                const onPress = () => {
                    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                };
                const onLongPress = () => { emitter.emit({ type: "tabLongPress", target: route.key }); };

                return (
                    <TabButton
                        key={route.key}
                        name={route.name}
                        focused={focused}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        badge={route.name === "cart" && cartCount > 0 ? cartCount : undefined}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E6E6EA",
        paddingTop: 10,
    },
    indicator: {
        position: "absolute",
        top: 0,
        left: 0,
        width: INDICATOR_W,
        height: 3,
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        backgroundColor: ORANGE,
    },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
    label: { fontSize: 11.5, letterSpacing: 0.2 },
    badge: {
        position: "absolute",
        top: -5,
        right: -11,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#FD652A",
        borderWidth: 2,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    badgeText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Quicksand-Bold" },
});

export default TabBar;
