import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { IconName } from '@/components/ui';
import { colors, fonts, SPRING } from '@/lib/theme';

const ICONS: Record<string, { idle: IconName; active: IconName }> = {
    index: { idle: 'wallet-outline', active: 'wallet' },
    referrals: { idle: 'people-outline', active: 'people' },
    profile: { idle: 'person-circle-outline', active: 'person-circle' },
};

const BAR_HEIGHT = 66;
const PILL_HEIGHT = 50;

/** White tab bar with a soft orange pill that slides to the active tab. */
export default function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
    const reduce = useReducedMotion();
    const [width, setWidth] = useState(0);
    const slot = width / state.routes.length;
    const position = useSharedValue(state.index);

    useEffect(() => {
        position.value = reduce ? state.index : withSpring(state.index, SPRING);
    }, [state.index, reduce, position]);

    const pill = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * slot }] }));

    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    return (
        <View style={[styles.bar, { paddingBottom: insets.bottom, height: BAR_HEIGHT + insets.bottom }]}>
            <View style={styles.row} onLayout={onLayout}>
                {width > 0 ? (
                    <Animated.View style={[styles.pillSlot, { width: slot }, pill]} pointerEvents="none">
                        <View style={styles.pill} />
                    </Animated.View>
                ) : null}
                {state.routes.map((route, i) => {
                    const focused = state.index === i;
                    const label = descriptors[route.key]?.options.title ?? route.name;
                    const icons = ICONS[route.name] ?? ICONS.index;
                    const onPress = () => {
                        const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                        if (!focused && !event.defaultPrevented) {
                            Haptics.selectionAsync().catch(() => {});
                            navigateToTab(route.key);
                        }
                    };
                    return (
                        <Pressable
                            key={route.key}
                            onPress={onPress}
                            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                            accessibilityRole="tab"
                            accessibilityLabel={label}
                            accessibilityState={{ selected: focused }}
                            style={styles.item}
                        >
                            <Ionicons name={focused ? icons.active : icons.idle} size={22} color={focused ? colors.orangeDark : colors.grey} />
                            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12 },
    row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    pillSlot: { position: 'absolute', left: 0, top: (BAR_HEIGHT - 1 - PILL_HEIGHT) / 2, height: PILL_HEIGHT, alignItems: 'center' },
    pill: { width: '100%', maxWidth: 112, height: PILL_HEIGHT, borderRadius: 18, backgroundColor: colors.orangeSoft },
    item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
    label: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.grey },
    labelActive: { color: colors.orangeDark },
});
