import { ReactNode, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    ReduceMotion,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { formatNaira } from '@/lib/format';
import { SPRING } from '@/lib/theme';

const STAGGER_MS = 60;
const MAX_STAGGERED = 8; // later items come in together, so long lists never feel slow

/**
 * A section that enters with a short fade + slide, staggered by `index`.
 * Reduce-motion: no movement, just a quick fade.
 */
export function Enter({ index = 0, children, style }: {
    index?: number;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    const reduce = useReducedMotion();
    const delay = Math.min(index, MAX_STAGGERED) * STAGGER_MS;
    const entering = reduce
        ? FadeIn.delay(delay).duration(220).reduceMotion(ReduceMotion.Never)
        : FadeInDown.delay(delay).springify().mass(SPRING.mass).damping(SPRING.damping).stiffness(SPRING.stiffness);
    return (
        <Animated.View entering={entering} style={style}>
            {children}
        </Animated.View>
    );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    /** How far it shrinks while pressed. */
    scaleTo?: number;
};

/** Press feedback: springs down to ~0.97 while held. Reduce-motion: dims instead of moving. */
export function PressableScale({ style, children, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
    const reduce = useReducedMotion();
    const pressed = useSharedValue(0);

    const animated = useAnimatedStyle(() =>
        reduce
            ? { opacity: 1 - pressed.value * 0.25 }
            : { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] },
    );

    const pressIn = (e: GestureResponderEvent) => {
        pressed.value = reduce ? withTiming(1, { duration: 80 }) : withSpring(1, { ...SPRING, stiffness: 420, damping: 28 });
        onPressIn?.(e);
    };
    const pressOut = (e: GestureResponderEvent) => {
        pressed.value = reduce ? withTiming(0, { duration: 120 }) : withSpring(0, SPRING);
        onPressOut?.(e);
    };

    return (
        <AnimatedPressable {...rest} onPressIn={pressIn} onPressOut={pressOut} style={[style, animated]}>
            {children}
        </AnimatedPressable>
    );
}

/** A naira amount that counts up to `value` (and on to a new value after a refresh). */
export function CountUpNaira({ value, style, duration = 900 }: {
    value: number;
    style?: StyleProp<TextStyle>;
    duration?: number;
}) {
    const reduce = useReducedMotion();
    const [shown, setShown] = useState(0);
    const last = useRef(0);

    useEffect(() => {
        if (reduce) return;
        const from = last.current;
        if (from === value) return;
        const start = Date.now();
        let frame = 0;
        const tick = () => {
            const t = Math.min(1, (Date.now() - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const next = t === 1 ? value : Math.round(from + (value - from) * eased);
            last.current = next;
            setShown(next);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, reduce, duration]);

    return (
        <Text style={style} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={formatNaira(value)}>
            {formatNaira(reduce ? value : shown)}
        </Text>
    );
}
