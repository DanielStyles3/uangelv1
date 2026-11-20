import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const ORANGE = "#FD652A";

/**
 * How many of an extra: an "Add" pill at 0, then  −  n  +  (the − is a bin at 1).
 * + stops at `max`.
 */
export default function QtyStepper({ value, max, onChange, label }: {
    value: number;
    max: number;
    onChange: (n: number) => void;
    /** What is being counted, for screen readers ("Birthday Candles"). */
    label: string;
}) {
    const set = (n: number) => {
        Haptics.selectionAsync().catch(() => {});
        onChange(Math.max(0, Math.min(max, n)));
    };

    if (value <= 0) {
        return (
            <TouchableOpacity onPress={() => set(1)} style={styles.add} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add ${label}`}>
                <Ionicons name="add" size={16} color="#C2410C" />
                <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
        );
    }
    const atMax = value >= max;
    return (
        <View style={styles.pill}>
            <TouchableOpacity onPress={() => set(value - 1)} style={styles.btn} hitSlop={4} accessibilityRole="button"
                accessibilityLabel={value === 1 ? `Remove ${label}` : `One less ${label}`}>
                <Ionicons name={value === 1 ? "trash-outline" : "remove"} size={value === 1 ? 16 : 18} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.num} accessibilityLiveRegion="polite">{value}</Text>
            <TouchableOpacity onPress={() => set(value + 1)} disabled={atMax} style={styles.btn} hitSlop={4} accessibilityRole="button"
                accessibilityLabel={atMax ? `Most you can add of ${label}` : `One more ${label}`} accessibilityState={{ disabled: atMax }}>
                <Ionicons name="add" size={18} color={atMax ? "rgba(255,255,255,0.45)" : "#fff"} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    add: { height: 38, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: ORANGE, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 4 },
    addText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: "#C2410C" },
    pill: { height: 38, borderRadius: 999, backgroundColor: ORANGE, flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
    btn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    num: { minWidth: 20, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff" },
});
