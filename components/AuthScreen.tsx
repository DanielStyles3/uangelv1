import { ReactNode } from "react";
import { ActivityIndicator, Dimensions, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const ORANGE = "#FD652A";
const NAVY = "#181C2E";
const { width: W } = Dimensions.get("window");

interface AuthScreenProps {
    /** Big white heading; use "\n" for a line break. */
    title: string;
    subtitle: string;
    /** Shows a round back button (and a smaller logo) instead of the big logo. */
    onBack?: () => void;
    /** The form, inside the floating white card. */
    children: ReactNode;
    /** Shown under the card, on the orange. */
    footer?: ReactNode;
}

/**
 * Bold orange auth screen: white logo, large heading, the form in a floating white card.
 * Handles the status bar, safe areas, keyboard and scrolling for Sign in, Sign up and Forgot password.
 * StyleSheet only (NativeWind classes are unreliable on Reanimated views).
 */
export default function AuthScreen({ title, subtitle, onBack, children, footer }: AuthScreenProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.root}>
            <StatusBar style="light" />
            {/* Soft shapes behind everything */}
            <View style={[styles.blob, { width: W * 1.08, height: W * 1.08, right: -W * 0.44, top: -W * 0.4, backgroundColor: "#FF7A45" }]} />
            <View style={[styles.ring, { width: W * 0.78, height: W * 0.78, left: -W * 0.4, top: W * 0.3 }]} />
            <View style={[styles.blob, { width: W * 0.92, height: W * 0.92, left: -W * 0.32, bottom: -W * 0.52, backgroundColor: "#F0531A" }]} />

            {/* Android is edge-to-edge: pad for the keyboard and let the ScrollView bring the field into view. */}
            <KeyboardAvoidingView style={styles.flex} behavior="padding">
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + (onBack ? 16 : 34), paddingBottom: insets.bottom + 34 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
                        {onBack ? (
                            <View style={styles.topRow}>
                                <TouchableOpacity style={styles.back} onPress={onBack} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Back">
                                    <Ionicons name="chevron-back" size={22} color={NAVY} />
                                </TouchableOpacity>
                                <Image source={require("../assets/images/uangel-logo-white.png")} style={styles.logoSmall} resizeMode="contain" accessibilityLabel="U Angel Foods" />
                            </View>
                        ) : (
                            <Image source={require("../assets/images/uangel-logo-white.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="U Angel Foods" />
                        )}
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.subtitle}>{subtitle}</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.duration(450).delay(90)} style={styles.card}>
                        {children}
                    </Animated.View>

                    {footer ? (
                        <Animated.View entering={FadeIn.duration(400).delay(260)} style={styles.footer}>
                            {footer}
                        </Animated.View>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

/** The card's main button: navy pill with an orange arrow (orange would vanish on this screen). */
export const AuthButton = ({ title, onPress, loading = false }: { title: string; onPress: () => void; loading?: boolean }) => (
    <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.85 }]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading, busy: loading }}
    >
        {loading ? <ActivityIndicator color="#fff" /> : (
            <>
                <Text style={styles.buttonText}>{title}</Text>
                <Ionicons name="arrow-forward" size={20} color={ORANGE} />
            </>
        )}
    </TouchableOpacity>
);

/** White pill under the card (e.g. "Create an account"). */
export const AuthGhostButton = ({ title, onPress }: { title: string; onPress: () => void }) => (
    <TouchableOpacity style={styles.ghost} onPress={onPress} activeOpacity={0.88} accessibilityRole="button">
        <Text style={styles.ghostText}>{title}</Text>
    </TouchableOpacity>
);

export const authStyles = StyleSheet.create({
    /** Dark text on the orange background. */
    onOrange: { fontFamily: "Quicksand-Bold", fontSize: 15, color: NAVY, textAlign: "center" },
    onOrangeSmall: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: NAVY, textAlign: "center" },
    /** White link on the orange background. */
    linkOnOrange: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#fff", textDecorationLine: "underline" },
    /** Orange-brown link inside the white card. */
    link: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#C2410C" },
    hint: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, lineHeight: 17, color: "#5B5B66", marginLeft: 4 },
    small: { fontFamily: "Quicksand-SemiBold", fontSize: 12, lineHeight: 17, color: "#5B5B66", textAlign: "center" },
});

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: ORANGE, overflow: "hidden" },
    flex: { flex: 1 },
    blob: { position: "absolute", borderRadius: 9999 },
    ring: { position: "absolute", borderRadius: 9999, borderWidth: 2, borderColor: "rgba(255,255,255,0.28)" },

    header: { paddingHorizontal: 26, gap: 14 },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    back: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    logo: { width: 92, height: 92, marginLeft: -8, marginBottom: 6 },
    logoSmall: { width: 58, height: 58 },
    title: { fontFamily: "Quicksand-Bold", fontSize: 42, lineHeight: 45, color: "#fff" },
    subtitle: { fontFamily: "Quicksand-Bold", fontSize: 16, color: NAVY },

    card: {
        marginHorizontal: 18, marginTop: 36, backgroundColor: "#fff", borderRadius: 34, paddingHorizontal: 22, paddingVertical: 30, gap: 20,
        shadowColor: "#782800", shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 18 }, elevation: 14,
    },
    footer: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 26, paddingTop: 36, gap: 16 },

    button: { height: 58, borderRadius: 999, backgroundColor: NAVY, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
    buttonText: { fontFamily: "Quicksand-Bold", fontSize: 17, color: "#fff" },
    ghost: { height: 56, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    ghostText: { fontFamily: "Quicksand-Bold", fontSize: 16, color: NAVY },
});
