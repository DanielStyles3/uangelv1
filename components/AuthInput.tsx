import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ORANGE = "#FE8C00";

interface AuthInputProps {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    /** Password field: hides text and shows an eye toggle. */
    secure?: boolean;
    keyboardType?: TextInputProps["keyboardType"];
    autoCapitalize?: TextInputProps["autoCapitalize"];
    autoComplete?: TextInputProps["autoComplete"];
    textContentType?: TextInputProps["textContentType"];
    returnKeyType?: TextInputProps["returnKeyType"];
    onSubmitEditing?: () => void;
}

/**
 * Filled, rounded input with a leading icon, orange focus ring and (for passwords) a show/hide eye.
 * Uses StyleSheet so it renders identically regardless of NativeWind's compiled CSS.
 */
const AuthInput = ({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    secure = false,
    keyboardType = "default",
    autoCapitalize = "none",
    autoComplete,
    textContentType,
    returnKeyType,
    onSubmitEditing,
}: AuthInputProps) => {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(secure);

    return (
        <View style={styles.wrapper}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.box, focused && styles.boxFocused]}>
                <Ionicons name={icon} size={20} color={focused ? ORANGE : "#9A9AA3"} />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#A9A9B2"
                    secureTextEntry={hidden}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    autoComplete={autoComplete}
                    textContentType={textContentType}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    accessibilityLabel={label}
                />
                {secure && (
                    <Pressable
                        onPress={() => setHidden((h) => !h)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={hidden ? "Show password" : "Hide password"}
                    >
                        <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color="#9A9AA3" />
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { width: "100%" },
    label: {
        fontFamily: "Quicksand-Bold",
        fontSize: 13,
        color: "#181C2E",
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.3,
    },
    box: {
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        backgroundColor: "#F5F5F7",
        borderWidth: 1.5,
        borderColor: "transparent",
    },
    // Only colors change on focus: toggling elevation/shadow on Android re-creates the
    // native view layer around the TextInput, which can make the keyboard flicker/close.
    boxFocused: {
        backgroundColor: "#FFFFFF",
        borderColor: ORANGE,
    },
    input: {
        flex: 1,
        height: "100%",
        marginLeft: 12,
        fontFamily: "Quicksand-SemiBold",
        fontSize: 16,
        color: "#181C2E",
    },
});

export default AuthInput;
