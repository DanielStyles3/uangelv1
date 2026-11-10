import { ReactNode } from "react";
import { StyleProp, TouchableOpacity, TouchableOpacityProps, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { PRESS_SPRING as SPRING } from "@/lib/motion";

interface ScalePressProps extends Omit<TouchableOpacityProps, "style" | "children"> {
    children: ReactNode;
    /** The look of the button / card itself (background, padding, radius…). */
    style?: StyleProp<ViewStyle>;
    /** How it sits in its parent (flex, alignSelf, margins). */
    wrapStyle?: StyleProp<ViewStyle>;
    /** How far it shrinks while pressed. */
    scaleTo?: number;
}


/**
 * A touchable that gently shrinks while pressed and springs back on release.
 * Uses StyleSheet styles only (NativeWind's className is unreliable on Reanimated views);
 * with "reduce motion" on it only dims, like a normal TouchableOpacity.
 */
const ScalePress = ({ children, style, wrapStyle, scaleTo = 0.97, onPressIn, onPressOut, activeOpacity = 0.9, ...rest }: ScalePressProps) => {
    const reduceMotion = useReducedMotion();
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View style={[wrapStyle, animated]}>
            <TouchableOpacity
                {...rest}
                activeOpacity={activeOpacity}
                style={style}
                onPressIn={(e) => {
                    if (!reduceMotion) scale.set(withSpring(scaleTo, SPRING));
                    onPressIn?.(e);
                }}
                onPressOut={(e) => {
                    if (!reduceMotion) scale.set(withSpring(1, SPRING));
                    onPressOut?.(e);
                }}
            >
                {children}
            </TouchableOpacity>
        </Animated.View>
    );
};

export default ScalePress;
