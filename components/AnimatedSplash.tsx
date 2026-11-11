import { useEffect, useState } from "react";
import { Dimensions, Image, ImageSourcePropType, StyleSheet } from "react-native";
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
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

// Same colour as the native splash (app.json), so the hand-off is invisible.
export const SPLASH_BACKGROUND = "#FD652A";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const LOGO = Math.min(300, SCREEN_W * 0.78);
const MIN_VISIBLE_MS = 2700;   // let the whole build-up play at least once
const EXIT_MS = 900;

// The logo cut into aligned layers (each is the full canvas with only its part kept).
const PARTS = {
    u: require("../assets/images/splash/u.png"),
    a: require("../assets/images/splash/a.png"),
    dot: require("../assets/images/splash/dot.png"),
    dish: require("../assets/images/splash/dish.png"),
    text: require("../assets/images/splash/text.png"),
} satisfies Record<string, ImageSourcePropType>;

const spring = (toValue: number, damping = 12, stiffness = 140) => withSpring(toValue, { damping, stiffness, mass: 1 });

const Layer = ({ source, style }: { source: ImageSourcePropType; style: object }) => (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
        <Image source={source} style={{ width: LOGO, height: LOGO }} resizeMode="contain" />
    </Animated.View>
);

interface AnimatedSplashProps {
    /** True once fonts + the signed-in user have loaded. */
    ready: boolean;
    /** Called after the exit animation; unmount the splash then. */
    onFinish: () => void;
}

/**
 * Motion splash: the U Angel Foods logo builds itself piece by piece (U rises, the A
 * swings in, the i-dot drops and bounces, the served dish pops and its lid peeks),
 * then the orange lifts away like a curtain once the app is ready.
 */
const AnimatedSplash = ({ ready, onFinish }: AnimatedSplashProps) => {
    const reduceMotion = useReducedMotion();
    const [minTimePassed, setMinTimePassed] = useState(false);

    // Background glows
    const glowA = useSharedValue(0);
    const glowB = useSharedValue(0);
    // Logo pieces
    const uY = useSharedValue(90), uO = useSharedValue(0);
    const aX = useSharedValue(110), aR = useSharedValue(14), aO = useSharedValue(0);
    const dotY = useSharedValue(-SCREEN_H * 0.45), dotO = useSharedValue(0);
    const dishS = useSharedValue(0), dishR = useSharedValue(-28), dishLift = useSharedValue(0);
    const textY = useSharedValue(26), textO = useSharedValue(0);
    // Exit
    const logoExit = useSharedValue(1);
    const curtainY = useSharedValue(0);

    useEffect(() => {
        const timer = setTimeout(() => setMinTimePassed(true), reduceMotion ? 800 : MIN_VISIBLE_MS);

        if (reduceMotion) {
            // Respect "reduce motion": just show the finished logo.
            [uO, aO, dotO, textO].forEach((v) => (v.value = withTiming(1, { duration: 300 })));
            uY.value = 0; aX.value = 0; aR.value = 0; dotY.value = 0; dishS.value = 1; dishR.value = 0; textY.value = 0;
            glowA.value = 1; glowB.value = 1;
            return () => clearTimeout(timer);
        }

        const ease = Easing.out(Easing.cubic);
        glowA.value = withTiming(1, { duration: 1100, easing: ease });
        glowB.value = withDelay(180, withTiming(1, { duration: 1200, easing: ease }));

        // 1) U rises
        uO.value = withDelay(150, withTiming(1, { duration: 320 }));
        uY.value = withDelay(150, spring(0, 13));
        // 2) A swings in from the right
        aO.value = withDelay(380, withTiming(1, { duration: 320 }));
        aX.value = withDelay(380, spring(0, 14));
        aR.value = withDelay(380, spring(0, 11));
        // 3) i-dot drops and bounces
        dotO.value = withDelay(700, withTiming(1, { duration: 150 }));
        dotY.value = withDelay(700, spring(0, 7, 170));
        // 4) Dish pops in, then its lid "peeks" every couple of seconds
        dishS.value = withDelay(1100, spring(1, 7, 200));
        dishR.value = withDelay(1100, spring(0, 9));
        dishLift.value = withDelay(1650, withRepeat(withSequence(
            withTiming(-LOGO * 0.035, { duration: 220, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 260, easing: Easing.bounce }),
            withTiming(0, { duration: 1400 }),
        ), -1));
        // 5) Name
        textO.value = withDelay(1300, withTiming(1, { duration: 450 }));
        textY.value = withDelay(1300, withTiming(0, { duration: 550, easing: ease }));

        return () => clearTimeout(timer);
        // Shared values are stable refs; run the timeline once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduceMotion]);

    // Exit: logo settles back, then the orange lifts away like a curtain.
    useEffect(() => {
        if (!ready || !minTimePassed) return;
        logoExit.value = withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) });
        curtainY.value = withDelay(220, withTiming(-SCREEN_H - 80, { duration: 620, easing: Easing.inOut(Easing.cubic) }));
        const t = setTimeout(onFinish, EXIT_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, minTimePassed, onFinish]);

    const curtainStyle = useAnimatedStyle(() => ({ transform: [{ translateY: curtainY.value }] }));
    const glowAStyle = useAnimatedStyle(() => ({ opacity: glowA.value * 0.9, transform: [{ scale: 0.4 + glowA.value * 0.6 }] }));
    const glowBStyle = useAnimatedStyle(() => ({ opacity: glowB.value * 0.9, transform: [{ scale: 0.3 + glowB.value * 0.7 }] }));
    const logoGroupStyle = useAnimatedStyle(() => ({
        opacity: logoExit.value,
        transform: [{ scale: 0.88 + logoExit.value * 0.12 }],
    }));
    const uStyle = useAnimatedStyle(() => ({ opacity: uO.value, transform: [{ translateY: uY.value }] }));
    const aStyle = useAnimatedStyle(() => ({ opacity: aO.value, transform: [{ translateX: aX.value }, { rotate: `${aR.value}deg` }] }));
    const dotStyle = useAnimatedStyle(() => ({ opacity: dotO.value, transform: [{ translateY: dotY.value }] }));
    // The dish sits at ~(63%, 40%) of the logo; pivot the pop/rotation around it.
    const dishStyle = useAnimatedStyle(() => {
        const cx = LOGO * (0.635 - 0.5), cy = LOGO * (0.4 - 0.5);
        return {
            opacity: Math.min(1, dishS.value * 2),
            transform: [
                { translateX: cx }, { translateY: cy + dishLift.value },
                { scale: dishS.value }, { rotate: `${dishR.value}deg` },
                { translateX: -cx }, { translateY: -cy },
            ],
        };
    });
    const textStyle = useAnimatedStyle(() => ({ opacity: textO.value, transform: [{ translateY: textY.value }] }));

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}
            // First frame drawn: drop the (plain orange) native splash underneath.
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
            pointerEvents={ready && minTimePassed ? "none" : "auto"}
            accessibilityLabel="U Angel Foods is loading"
        >
            <StatusBar style="light" />

            {/* Soft background glows */}
            <Animated.View style={[styles.glow, styles.glowA, glowAStyle]} />
            <Animated.View style={[styles.glow, styles.glowB, glowBStyle]} />

            {/* Logo, assembled from aligned layers */}
            <Animated.View style={[{ width: LOGO, height: LOGO }, logoGroupStyle]}>
                <Layer source={PARTS.u} style={uStyle} />
                <Layer source={PARTS.a} style={aStyle} />
                <Layer source={PARTS.dot} style={dotStyle} />
                <Layer source={PARTS.dish} style={dishStyle} />
                <Layer source={PARTS.text} style={textStyle} />
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    curtain: {
        backgroundColor: SPLASH_BACKGROUND,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        overflow: "hidden",
        borderBottomLeftRadius: 48,
        borderBottomRightRadius: 48,
    },
    glow: {
        position: "absolute",
        borderRadius: 9999,
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    glowA: { width: SCREEN_W * 1.3, height: SCREEN_W * 1.3, top: -SCREEN_W * 0.45, right: -SCREEN_W * 0.5 },
    glowB: { width: SCREEN_W * 1.1, height: SCREEN_W * 1.1, bottom: -SCREEN_W * 0.4, left: -SCREEN_W * 0.45 },
});

export default AnimatedSplash;
