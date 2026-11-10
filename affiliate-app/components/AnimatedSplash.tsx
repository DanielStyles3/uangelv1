import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import logo from '@/assets/images/uangel-logo-white.png';
import { IconName } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

/*
 * U Angel Affiliates motion splash — one short story, "Share → Earn → Feed":
 *   0.00s  logo springs in on brand orange (same orange as the native splash: seamless hand-off)
 *   0.45s  three chips (share, coin, heart) shoot out from behind the logo into a row
 *   0.95s  "U Angel Affiliates" slides up out of a mask
 *   1.35s  a "5%" badge pops with a ring burst
 *   exit   chips drop away and the logo zooms through the screen, revealing the app (≈0.6s)
 * Robust by design: drawn above everything (zIndex + Android elevation), the native splash is
 * hidden on first layout with a timer fallback, and it always finishes (hard cap) so it can
 * never get stuck. Reduce-motion: a simple fade.
 */

const { width: W, height: H } = Dimensions.get('window');
const LOGO = Math.min(150, W * 0.38);
const CHIP = 54;
const MIN_MS = 2200;      // shortest time on screen
const HARD_CAP_MS = 6000; // always leave by then, even if the app isn't ready
const EXIT_MS = 620;

const CHIPS: { icon: IconName; label: string; x: number }[] = [
    { icon: 'share-social', label: 'Share', x: -1 },
    { icon: 'cash', label: 'Earn', x: 0 },
    { icon: 'heart', label: 'Feed', x: 1 },
];
const CHIP_GAP = Math.min(104, W * 0.26);
const ROW_H = 92;          // chip + label
const LOGO_GAP = 30;       // space between logo and chip row
// How far above its row a chip starts: the logo's centre.
const CHIP_FROM = LOGO / 2 + LOGO_GAP + ROW_H / 2;

type Props = { ready: boolean; onFinish: () => void };

export default function AnimatedSplash({ ready, onFinish }: Props) {
    const reduce = useReducedMotion();
    const [minPassed, setMinPassed] = useState(false);
    const [capPassed, setCapPassed] = useState(false);

    const intro = useSharedValue(0);   // logo
    const chips = useSharedValue(0);   // chips fly out (0→1)
    const word = useSharedValue(0);    // wordmark
    const badge = useSharedValue(0);   // 5% badge
    const burst = useSharedValue(0);   // ring burst
    const exit = useSharedValue(0);    // zoom-through

    useEffect(() => {
        const t1 = setTimeout(() => setMinPassed(true), reduce ? 600 : MIN_MS);
        const t2 = setTimeout(() => setCapPassed(true), HARD_CAP_MS);
        // Fallback in case onLayout never fires: never leave the native splash up.
        const t3 = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1200);

        if (reduce) {
            intro.value = withTiming(1, { duration: 250 });
            chips.value = 1;
            word.value = 1;
            badge.value = 1;
        } else {
            intro.value = withDelay(80, withSpring(1, { damping: 11, stiffness: 150 }));
            chips.value = withDelay(450, withSpring(1, { damping: 13, stiffness: 110 }));
            word.value = withDelay(950, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
            badge.value = withDelay(1350, withSpring(1, { damping: 8, stiffness: 180 }));
            burst.value = withDelay(1350, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }));
        }
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        // Shared values are stable; the timeline runs once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduce]);

    const leaving = (ready && minPassed) || capPassed;
    useEffect(() => {
        if (!leaving) return;
        exit.value = reduce
            ? withTiming(1, { duration: 250 })
            : withSequence(withTiming(0.12, { duration: 120 }), withTiming(1, { duration: EXIT_MS - 120, easing: Easing.in(Easing.cubic) }));
        const t = setTimeout(onFinish, reduce ? 260 : EXIT_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaving]);

    // Background fades during the second half of the exit, so the app shows through the zooming logo.
    const bgStyle = useAnimatedStyle(() => ({ opacity: interpolate(exit.value, [0, 0.45, 1], [1, 1, 0]) }));
    const glowStyle = useAnimatedStyle(() => ({
        opacity: intro.value * 0.9 * (1 - exit.value),
        transform: [{ scale: 0.6 + intro.value * 0.4 }],
    }));
    const logoStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, intro.value * 1.4) * interpolate(exit.value, [0, 0.7, 1], [1, 1, 0]),
        transform: [
            { scale: (0.4 + intro.value * 0.6) * (reduce ? 1 : interpolate(exit.value, [0, 0.12, 1], [1, 0.92, 9])) },
            { rotate: `${(1 - intro.value) * -14}deg` },
        ],
    }));
    const wordStyle = useAnimatedStyle(() => ({
        opacity: word.value * (1 - Math.min(1, exit.value * 3)),
        transform: [{ translateY: (1 - word.value) * 34 }],
    }));
    const badgeStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, badge.value) * (1 - Math.min(1, exit.value * 3)),
        transform: [{ scale: badge.value }, { rotate: `${(1 - badge.value) * 30}deg` }],
    }));
    const burstStyle = useAnimatedStyle(() => ({
        opacity: (1 - burst.value) * 0.8 * (burst.value > 0 ? 1 : 0),
        transform: [{ scale: 0.6 + burst.value * 1.8 }],
    }));

    return (
        <View
            style={styles.root}
            pointerEvents={leaving ? 'none' : 'auto'}
            // First frame drawn: drop the native splash underneath (no flash: same orange).
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
            accessible
            accessibilityLabel="U Angel Affiliates is loading"
        >
            <StatusBar style="light" />
            <Animated.View style={[styles.bg, bgStyle]} />

            <View style={styles.center} pointerEvents="none">
                {/* Soft glow behind the logo */}
                <Animated.View style={[styles.glow, glowStyle]} />

                <Animated.View style={[styles.logoWrap, logoStyle]}>
                    <Image source={logo} style={styles.logo} resizeMode="contain" />
                </Animated.View>

                {/* Chips start behind the logo and fly down into their own row */}
                <View style={styles.chipRow}>
                    {CHIPS.map((c, i) => (
                        <Chip key={c.label} index={i} x={c.x} icon={c.icon} label={c.label} p={chips} exit={exit} />
                    ))}
                </View>

                {/* Wordmark slides up out of a mask */}
                <View style={styles.mask}>
                    <Animated.View style={[styles.wordRow, wordStyle]}>
                        <Text style={styles.word} numberOfLines={1}>
                            U Angel <Text style={styles.wordBold}>Affiliates</Text>
                        </Text>
                    </Animated.View>
                </View>

                {/* 5% badge with a ring burst */}
                <View style={styles.badgeStage}>
                    <Animated.View style={[styles.burst, burstStyle]} />
                    <Animated.View style={[styles.badge, badgeStyle]}>
                        <Text style={styles.badgeText} numberOfLines={1}>
                            <Text style={styles.badgeBig}>5%</Text>{'  '}on every order
                        </Text>
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

/** One chip: starts hidden behind the logo, arcs out to its slot in the row below. */
function Chip({ index, x, icon, label, p, exit }: {
    index: number; x: number; icon: IconName; label: string;
    p: SharedValue<number>; exit: SharedValue<number>;
}) {
    const style = useAnimatedStyle(() => {
        // Stagger: each chip starts a little later along the same progress value.
        const t = Math.max(0, Math.min(1, p.value * 1.3 - index * 0.15));
        const arc = Math.sin(t * Math.PI) * -36;      // lift on the way, then settle in the row
        const drop = exit.value * 140;                 // fall away on exit
        return {
            opacity: Math.min(1, t * 2.2) * (1 - Math.min(1, exit.value * 2.5)),
            transform: [
                { translateX: x * CHIP_GAP * t },
                { translateY: -CHIP_FROM * (1 - t) + arc + drop },
                { scale: 0.35 + t * 0.65 },
                { rotate: `${(1 - t) * x * 40}deg` },
            ],
        };
    });
    return (
        <Animated.View style={[styles.chipWrap, style]}>
            <View style={styles.chip}><Ionicons name={icon} size={24} color={colors.orange} /></View>
            <Text style={styles.chipLabel}>{label}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1000, elevation: 1000, // above the navigator on Android too
    },
    bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.orange },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: H * 0.03 },
    glow: {
        position: 'absolute', width: W * 1.1, height: W * 1.1, borderRadius: W,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 70%)',
        top: H / 2 - W * 0.85,
    },
    logoWrap: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    logo: { width: LOGO, height: LOGO },

    // The row the chips land in (they're absolutely placed inside it and animate from the logo).
    chipRow: { width: W, height: ROW_H, marginTop: LOGO_GAP, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    chipWrap: { position: 'absolute', alignItems: 'center', gap: 6, width: 90 },
    chip: {
        width: CHIP, height: CHIP, borderRadius: CHIP / 2, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#7A2A0B', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    // Fixed widths + centred text on every label here: the splash can draw before Quicksand has
    // loaded, and Android doesn't re-measure text when the font arrives (it clipped "Share" to "Shar").
    chipLabel: { width: 90, textAlign: 'center', fontFamily: fonts.bold, fontSize: 13, color: colors.white },

    mask: { overflow: 'hidden', marginTop: 26, paddingVertical: 4 },
    wordRow: { width: W, alignItems: 'center' },
    word: { width: W - 32, textAlign: 'center', fontFamily: fonts.medium, fontSize: 26, color: 'rgba(255,255,255,0.92)' },
    wordBold: { fontFamily: fonts.bold, color: colors.white },

    badgeStage: { marginTop: 18, alignItems: 'center', justifyContent: 'center' },
    burst: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.white },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 999,
        paddingHorizontal: 16, paddingVertical: 8,
        shadowColor: '#7A2A0B', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    badgeText: { width: 190, textAlign: 'center', fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
    badgeBig: { fontFamily: fonts.bold, fontSize: 20, color: colors.orange },
});
