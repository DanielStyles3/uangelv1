import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
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
} from 'react-native-reanimated';

import logo from '@/assets/images/uangel-logo-white.png';
import { IconName } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

// Same colour as the native splash (app.json), so the hand-off is invisible.
const { width: SCREEN_W } = Dimensions.get('window');
const LOGO = Math.min(220, SCREEN_W * 0.56);
const ORBIT = LOGO + 96;
const BADGE = 42;
const MIN_VISIBLE_MS = 2600;
const EXIT_MS = 650;

const ORBITERS: { icon: IconName; angle: number }[] = [
    { icon: 'cash', angle: -90 },
    { icon: 'heart', angle: 30 },
    { icon: 'share-social', angle: 150 },
];

const spring = (toValue: number, damping = 12, stiffness = 140) => withSpring(toValue, { damping, stiffness, mass: 1 });

type Props = {
    /** True once fonts and the saved session have loaded. */
    ready: boolean;
    /** Called after the exit animation; unmount the splash then. */
    onFinish: () => void;
};

/**
 * Motion splash for U Angel Affiliates: the white logo springs in over brand orange, coin,
 * heart and share badges orbit it while ripples pulse outwards, the "Affiliates" pill and
 * tagline rise in, then the whole splash swells and fades away into the app.
 * With "reduce motion" on it is a plain fade.
 */
export default function AnimatedSplash({ ready, onFinish }: Props) {
    const reduceMotion = useReducedMotion();
    const [minTimePassed, setMinTimePassed] = useState(false);

    const glow = useSharedValue(0);
    const logoS = useSharedValue(0.3);
    const logoO = useSharedValue(0);
    const logoR = useSharedValue(-12);
    const orbitIn = useSharedValue(0);
    const orbit = useSharedValue(0);
    const pillY = useSharedValue(24);
    const pillO = useSharedValue(0);
    const tagO = useSharedValue(0);
    const ring1 = useSharedValue(0);
    const ring2 = useSharedValue(0);
    const bob = useSharedValue(0);
    const exit = useSharedValue(0);

    useEffect(() => {
        const timer = setTimeout(() => setMinTimePassed(true), reduceMotion ? 700 : MIN_VISIBLE_MS);

        if (reduceMotion) {
            logoS.value = 1;
            logoR.value = 0;
            pillY.value = 0;
            orbitIn.value = 1;
            glow.value = 1;
            logoO.value = withTiming(1, { duration: 300 });
            pillO.value = withTiming(1, { duration: 300 });
            tagO.value = withTiming(1, { duration: 300 });
            return () => clearTimeout(timer);
        }

        const ease = Easing.out(Easing.cubic);
        glow.value = withTiming(1, { duration: 1100, easing: ease });

        // 1) Logo springs in with a little twist
        logoO.value = withDelay(120, withTiming(1, { duration: 260 }));
        logoS.value = withDelay(120, spring(1, 8, 160));
        logoR.value = withDelay(120, spring(0, 10));
        // Gentle float once it lands
        bob.value = withDelay(1200, withRepeat(withSequence(
            withTiming(-6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ), -1));

        // 2) Coin / heart / share badges pop out and orbit
        orbitIn.value = withDelay(650, spring(1, 9, 150));
        orbit.value = withDelay(650, withRepeat(withTiming(360, { duration: 7000, easing: Easing.linear }), -1, false));

        // 3) "Affiliates" pill, then the tagline
        pillO.value = withDelay(900, withTiming(1, { duration: 350 }));
        pillY.value = withDelay(900, spring(0, 12));
        tagO.value = withDelay(1250, withTiming(1, { duration: 500 }));

        // 4) Ripples pulse outwards while the app loads
        const pulse = () => withRepeat(withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }), -1, false);
        ring1.value = withDelay(1100, pulse());
        ring2.value = withDelay(2050, pulse());

        return () => clearTimeout(timer);
        // Shared values are stable refs; run the timeline once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduceMotion]);

    // Exit: swell and fade into the app.
    useEffect(() => {
        if (!ready || !minTimePassed) return;
        exit.value = withTiming(1, { duration: EXIT_MS - 50, easing: Easing.in(Easing.cubic) });
        const t = setTimeout(onFinish, EXIT_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, minTimePassed, onFinish]);

    const rootStyle = useAnimatedStyle(() => ({
        opacity: 1 - exit.value,
        transform: [{ scale: reduceMotion ? 1 : 1 + exit.value * 0.18 }],
    }));
    const glowAStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.4 + glow.value * 0.6 }] }));
    const glowBStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.3 + glow.value * 0.7 }] }));
    const logoStyle = useAnimatedStyle(() => ({
        opacity: logoO.value,
        transform: [{ translateY: bob.value }, { scale: logoS.value }, { rotate: `${logoR.value}deg` }],
    }));
    const orbitStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, orbitIn.value),
        transform: [{ rotate: `${orbit.value}deg` }, { scale: 0.6 + orbitIn.value * 0.4 }],
    }));
    // Keeps each badge upright while the ring turns.
    const uprightStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-orbit.value}deg` }] }));
    const pillStyle = useAnimatedStyle(() => ({ opacity: pillO.value, transform: [{ translateY: pillY.value }] }));
    const tagStyle = useAnimatedStyle(() => ({ opacity: tagO.value, transform: [{ translateY: (1 - tagO.value) * 10 }] }));
    const ring1Style = useAnimatedStyle(() => ({
        opacity: (1 - ring1.value) * 0.45,
        transform: [{ scale: 0.7 + ring1.value * 1.2 }],
    }));
    const ring2Style = useAnimatedStyle(() => ({
        opacity: (1 - ring2.value) * 0.45,
        transform: [{ scale: 0.7 + ring2.value * 1.2 }],
    }));

    const radius = ORBIT / 2;

    return (
        <Animated.View
            style={[styles.root, rootStyle]}
            // First frame drawn: drop the plain orange native splash underneath.
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
            pointerEvents={ready && minTimePassed ? 'none' : 'auto'}
            accessibilityLabel="U Angel Affiliates is loading"
        >
            <StatusBar style="light" />

            <Animated.View style={[styles.glow, styles.glowA, glowAStyle]} />
            <Animated.View style={[styles.glow, styles.glowB, glowBStyle]} />

            <View style={styles.stage}>
                <Animated.View style={[styles.ring, ring1Style]} />
                <Animated.View style={[styles.ring, ring2Style]} />

                <Animated.View style={[styles.orbit, orbitStyle]}>
                    <View style={styles.orbitTrack} />
                    {ORBITERS.map(({ icon, angle }) => {
                        const rad = (angle * Math.PI) / 180;
                        return (
                            <View
                                key={icon}
                                style={[
                                    styles.badgeSlot,
                                    {
                                        left: radius + radius * Math.cos(rad) - BADGE / 2,
                                        top: radius + radius * Math.sin(rad) - BADGE / 2,
                                    },
                                ]}
                            >
                                <Animated.View style={[styles.badge, uprightStyle]}>
                                    <Ionicons name={icon} size={20} color={colors.orange} />
                                </Animated.View>
                            </View>
                        );
                    })}
                </Animated.View>

                <Animated.View style={logoStyle}>
                    <Image source={logo} style={styles.logo} resizeMode="contain" />
                </Animated.View>
            </View>

            <Animated.View style={[styles.pill, pillStyle]}>
                <Ionicons name="sparkles" size={14} color={colors.orange} />
                <Text style={styles.pillText}>AFFILIATES</Text>
            </Animated.View>
            <Animated.View style={tagStyle}>
                <Text style={styles.tagline}>Share. Earn. Feed someone.</Text>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.orange,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        overflow: 'hidden',
    },
    glow: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.10)' },
    glowA: { width: SCREEN_W * 1.3, height: SCREEN_W * 1.3, top: -SCREEN_W * 0.45, right: -SCREEN_W * 0.5 },
    glowB: { width: SCREEN_W * 1.1, height: SCREEN_W * 1.1, bottom: -SCREEN_W * 0.4, left: -SCREEN_W * 0.45 },

    stage: { width: ORBIT + BADGE, height: ORBIT + BADGE, alignItems: 'center', justifyContent: 'center' },
    ring: {
        position: 'absolute',
        width: LOGO,
        height: LOGO,
        borderRadius: LOGO / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
    },
    orbit: { position: 'absolute', width: ORBIT, height: ORBIT },
    orbitTrack: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: ORBIT / 2,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.35)',
    },
    badgeSlot: { position: 'absolute', width: BADGE, height: BADGE },
    badge: {
        width: BADGE,
        height: BADGE,
        borderRadius: BADGE / 2,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.navy,
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
    },
    logo: { width: LOGO, height: LOGO },

    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.white,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginTop: 4,
    },
    pillText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 3, color: colors.orange },
    tagline: { fontFamily: fonts.bold, fontSize: 16, color: 'rgba(255,255,255,0.95)', marginTop: 14 },
});
