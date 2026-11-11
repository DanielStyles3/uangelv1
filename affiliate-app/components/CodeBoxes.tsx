import { ComponentRef, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const ORANGE = "#FD652A";
const INK = "#181C2E";
export const CODE_LEN = 6;

/** Six boxes over one hidden input, so paste and SMS/email autofill work (reset code, sign-up code). */
export default function CodeBoxes({ value, onChange, label = "Code" }: { value: string; onChange: (v: string) => void; label?: string }) {
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
    const [focused, setFocused] = useState(false);

    return (
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel={label}>
            <View style={styles.codeRow}>
                {Array.from({ length: CODE_LEN }, (_, i) => {
                    const active = focused && i === Math.min(value.length, CODE_LEN - 1);
                    return (
                        <View key={i} style={[styles.codeBox, !!value[i] && styles.codeBoxFilled, active && styles.codeBoxActive]}>
                            <Text style={styles.codeDigit}>{value[i] ?? ""}</Text>
                        </View>
                    );
                })}
            </View>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, CODE_LEN))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LEN}
                autoFocus
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={styles.hiddenInput}
                caretHidden
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    codeBox: { flex: 1, height: 58, borderRadius: 16, backgroundColor: "#F5F5F7", borderWidth: 1.5, borderColor: "#E4E4EA", alignItems: "center", justifyContent: "center" },
    codeBoxFilled: { backgroundColor: "#FFF4EE", borderColor: "#FDBA9B" },
    codeBoxActive: { borderColor: ORANGE, borderWidth: 2, backgroundColor: "#fff" },
    codeDigit: { fontFamily: "Quicksand-Bold", fontSize: 24, color: INK },
    hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
