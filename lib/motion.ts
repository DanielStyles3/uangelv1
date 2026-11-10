import { FadeIn, FadeInDown, LinearTransition, ReduceMotion } from "react-native-reanimated";

// One place for the app's entrance motion, so screens feel like one family.
// Reanimated 4 springs default to mass 4 / stiffness 900, so a low `.damping()` wobbles badly;
// duration + dampingRatio gives the same calm settle on every device.
// All of these are skipped automatically when the phone has "reduce motion" on.

/** Press-in / release spring for cards and buttons. */
export const PRESS_SPRING = { duration: 240, dampingRatio: 0.7 } as const;

/** Rise + fade for the nth block on a screen (staggered by `step` ms). */
export const riseIn = (index = 0, step = 70) =>
    FadeInDown.delay(Math.min(index, 8) * step).springify(560).dampingRatio(0.82).reduceMotion(ReduceMotion.System);

/** A small block appearing in place (confirmation notes, expanded details). */
export const popIn = () => FadeInDown.springify(380).dampingRatio(0.9).reduceMotion(ReduceMotion.System);

/** Plain quick fade, for content swapping in place. */
export const fadeIn = (delay = 0) => FadeIn.delay(delay).duration(220).reduceMotion(ReduceMotion.System);

/** Neighbours glide to their new place when something above them grows or goes. */
export const settle = () => LinearTransition.springify(420).dampingRatio(0.9).reduceMotion(ReduceMotion.System);
