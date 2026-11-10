import { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface ScreenHeaderProps {
    title: string;
    /** Back button colour: white on tinted pages, soft grey on white pages. */
    buttonColor?: string;
    right?: ReactNode;
}

/** Back button in a round tile with the page title beside it (StyleSheet only). */
const ScreenHeader = ({ title, buttonColor = "#FFFFFF", right }: ScreenHeaderProps) => {
    const router = useRouter();

    return (
        <View style={styles.row}>
            <TouchableOpacity
                style={[styles.back, { backgroundColor: buttonColor }]}
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Back"
            >
                <Ionicons name="chevron-back" size={22} color="#181C2E" />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
            {right}
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    title: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 20, color: "#181C2E" },
});

export default ScreenHeader;
