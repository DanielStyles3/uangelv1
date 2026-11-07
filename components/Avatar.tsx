import { StyleSheet, Text, View } from "react-native";

// Brand-friendly backgrounds; a name always gets the same one.
const COLORS = ["#181C2E", "#9D174D", "#6B21A8", "#166534", "#9A3412", "#0F766E", "#1E3A8A"];

export const initialsOf = (name?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0][0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return (first + last).toUpperCase();
};

const colorFor = (name?: string | null) => {
    const s = name ?? "";
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
    return COLORS[Math.abs(hash) % COLORS.length];
};

interface AvatarProps {
    name?: string | null;
    /** Diameter in px. */
    size?: number;
    /** White ring around the avatar (px). */
    ring?: number;
}

/**
 * Initials avatar (e.g. "DS" for Daniel Styles) on a colour derived from the name.
 * Sized with explicit styles so it renders identically on every device.
 */
const Avatar = ({ name, size = 64, ring = 0 }: AvatarProps) => (
    <View
        style={[
            styles.circle,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colorFor(name),
                borderWidth: ring,
            },
        ]}
        accessibilityLabel={`${name ?? "User"} avatar`}
    >
        <Text
            style={[styles.text, { fontSize: Math.round(size * 0.36), letterSpacing: size * 0.01 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
        >
            {initialsOf(name)}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    circle: { alignItems: "center", justifyContent: "center", borderColor: "#ffffff", overflow: "hidden" },
    text: { color: "#ffffff", fontFamily: "Quicksand-Bold", includeFontPadding: false, textAlign: "center" },
});

export default Avatar;
