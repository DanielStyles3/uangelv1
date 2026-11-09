import {useEffect, useState} from "react";
import {Dimensions, Image, ImageSourcePropType, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native'
import {Redirect, Slot, router, usePathname} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import useAuthStore from "@/store/auth.store";
import useFetch from "@/lib/useFetch";
import {getAuthScreenContent} from "@/lib/api";
import {SPLASH_BACKGROUND} from "@/components/AnimatedSplash";

// NOTE: layout here uses StyleSheet (not className) on purpose: NativeWind doesn't apply
// className to Reanimated views, and these screens must look right on every device.

const { width: SCREEN_W } = Dimensions.get('window');
const COLLAGE_H = 200;

// U Angel Foods' own photos, as tilted white-framed cards that drift gently.
const CARDS: { source: ImageSourcePropType; w: number; h: number; rotate: number; x: number; y: number; z: number; float: number; delay: number }[] = [
    { source: require('../../assets/images/auth/cake.jpg'),   w: 122, h: 150, rotate: -10, x: -0.29, y: 26, z: 1, float: 2600, delay: 120 },
    { source: require('../../assets/images/auth/juice.jpg'),  w: 108, h: 144, rotate: 11,  x: 0.30,  y: 34, z: 1, float: 3000, delay: 260 },
    { source: require('../../assets/images/auth/drinks.jpg'), w: 140, h: 172, rotate: 3,   x: 0,     y: 6,  z: 2, float: 2300, delay: 0 },
];

const PhotoCard = ({ card, uri, reduceMotion }: { card: (typeof CARDS)[number]; uri?: string; reduceMotion: boolean }) => {
    // Admin photo (Admin › Website & app); the bundled photo shows until it loads or if it fails.
    const [failed, setFailed] = useState(false);
    const enter = useSharedValue(reduceMotion ? 1 : 0);
    const drift = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion) return;
        enter.value = withDelay(card.delay, withSpring(1, { damping: 11, stiffness: 120 }));
        drift.value = withDelay(card.delay + 500, withRepeat(withSequence(
            withTiming(1, { duration: card.float, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: card.float, easing: Easing.inOut(Easing.sin) }),
        ), -1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduceMotion]);

    const animated = useAnimatedStyle(() => ({
        opacity: enter.value,
        transform: [
            { translateY: (1 - enter.value) * 60 + drift.value * -8 },
            { scale: 0.7 + enter.value * 0.3 },
            { rotate: `${card.rotate + drift.value * (card.rotate > 0 ? 1.5 : -1.5)}deg` },
        ],
    }));

    return (
        <Animated.View
            style={[styles.card, {
                left: SCREEN_W / 2 + card.x * SCREEN_W - card.w / 2,
                top: card.y,
                width: card.w,
                height: card.h,
                zIndex: card.z,
            }, animated]}
        >
            <Image
                source={uri && !failed ? { uri } : card.source}
                defaultSource={card.source as number}
                onError={() => setFailed(true)}
                style={styles.cardImage}
                resizeMode="cover"
            />
        </Animated.View>
    );
};

type AuthTab = 'sign-in' | 'sign-up';

const SwitchTab = ({ id, label, active }: { id: AuthTab; label: string; active: AuthTab }) => (
    <Pressable
        style={styles.switchTab}
        onPress={() => active !== id && router.replace(id === 'sign-in' ? '/sign-in' : '/sign-up')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === id }}
    >
        <Text className="paragraph-bold" style={{ color: active === id ? '#181C2E' : '#878787' }}>{label}</Text>
    </Pressable>
);

/** Sliding pill switch between Sign in and Sign up. */
const AuthSwitch = ({ active }: { active: AuthTab }) => {
    const [width, setWidth] = useState(0);
    const x = useSharedValue(active === 'sign-in' ? 0 : 1);

    useEffect(() => {
        x.value = withSpring(active === 'sign-in' ? 0 : 1, { damping: 16, stiffness: 180 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (width / 2) }] }));

    return (
        <View
            style={styles.switch}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width - SWITCH_PAD * 2)}
            accessibilityRole="tablist"
        >
            {width > 0 && <Animated.View style={[styles.switchPill, { width: width / 2 }, pill]} />}
            <SwitchTab id="sign-in" label="Sign in" active={active} />
            <SwitchTab id="sign-up" label="Sign up" active={active} />
        </View>
    );
};

/**
 * Sign in / Sign up / Forgot password: brand-orange hero with a floating collage of
 * U Angel Foods photos, and a white sheet with a Sign in ⇄ Sign up switch + the form.
 */
export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    // Order matches CARDS: [left, right, centre].
    const { data: authContent } = useFetch({ fn: getAuthScreenContent });
    const photos = (authContent?.photos ?? []).filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u));

    const sheetY = useSharedValue(reduceMotion ? 0 : 80);
    useEffect(() => {
        if (!reduceMotion) sheetY.value = withSpring(0, { damping: 18, stiffness: 120 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduceMotion]);
    const sheetAnimated = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

    if(isAuthenticated) return <Redirect href="/" />

    const active: AuthTab | null = pathname.includes('sign-up') ? 'sign-up' : pathname.includes('sign-in') ? 'sign-in' : null;

    return (
        <View style={[styles.root, { backgroundColor: SPLASH_BACKGROUND }]}>
            <StatusBar style="light" />
            {/* Android is edge-to-edge (SDK 58): the window no longer resizes for the keyboard,
                so use padding on both platforms; the ScrollView then scrolls the focused field
                into view instead of the layout and keyboard fighting (which made it jump/blur). */}
            <KeyboardAvoidingView style={styles.root} behavior="padding">
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="none"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero: logo + floating photo collage */}
                    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
                        <View style={[styles.glow, { width: 280, height: 280, top: -110, right: -100 }]} />
                        <View style={[styles.glow, { width: 200, height: 200, top: 150, left: -90 }]} />

                        <Image
                            source={require('../../assets/images/uangel-logo-white.png')}
                            style={styles.logo}
                            resizeMode="contain"
                            accessibilityLabel="U Angel Foods"
                        />

                        <View style={styles.collage}>
                            {CARDS.map((card, i) => <PhotoCard key={i} card={card} uri={photos[i]} reduceMotion={reduceMotion} />)}
                        </View>
                    </View>

                    {/* Sheet with the form */}
                    <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }, sheetAnimated]}>
                        <View style={styles.grabber} />
                        {active && <AuthSwitch active={active} />}
                        <Slot />
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    )
}

const SWITCH_PAD = 4;

const styles = StyleSheet.create({
    root: { flex: 1 },
    hero: { alignItems: 'center', overflow: 'hidden', paddingBottom: 44 },
    glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
    logo: { width: 64, height: 64 },
    collage: { width: '100%', height: COLLAGE_H, marginTop: 4 },
    card: {
        position: 'absolute',
        borderRadius: 22,
        borderWidth: 4,
        borderColor: '#ffffff',
        backgroundColor: '#ffffff',
        shadowColor: '#7a2a0b',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
    },
    cardImage: { width: '100%', height: '100%', borderRadius: 18 },
    sheet: {
        flexGrow: 1,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        marginTop: -36,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
        elevation: 16,
    },
    grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#E4E4E8', alignSelf: 'center', marginTop: 12 },
    switch: {
        flexDirection: 'row',
        height: 50,
        marginHorizontal: 24,
        marginTop: 18,
        padding: SWITCH_PAD,
        borderRadius: 999,
        backgroundColor: '#F2F2F5',
    },
    switchPill: {
        position: 'absolute',
        top: SWITCH_PAD,
        bottom: SWITCH_PAD,
        left: SWITCH_PAD,
        borderRadius: 999,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    switchTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
