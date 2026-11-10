import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import ScalePress from "@/components/ScalePress";

const ORANGE = "#FD652A";
const NAVY = "#181C2E";

/** Home: the navy "Invite friends, earn 5%" card. The whole card is one button. */
const InviteCard = ({ onPress }: { onPress: () => void }) => (
    <ScalePress
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Invite friends, earn 5% on everything they order for 12 months. Get my code"
    >
        <View style={styles.glow} />
        <View style={styles.tile}>
            <Ionicons name="gift" size={30} color="#fff" />
        </View>

        <View style={styles.chip}><Text style={styles.chipText}>NEW</Text></View>
        <Text style={styles.title}>Invite friends,{"\n"}earn 5%</Text>
        <Text style={styles.body}>On everything they order for 12 months.</Text>
        <View style={styles.cta}>
            <Text style={styles.ctaText}>Get my code</Text>
            <Ionicons name="arrow-forward" size={16} color={NAVY} />
        </View>
    </ScalePress>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: NAVY, borderRadius: 26, padding: 18, overflow: "hidden", gap: 8,
    },
    glow: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(253,101,42,0.28)", right: -60, top: -70 },
    tile: {
        position: "absolute", right: 18, bottom: 16, width: 64, height: 64, borderRadius: 22,
        backgroundColor: ORANGE, alignItems: "center", justifyContent: "center",
    },
    chip: { alignSelf: "flex-start", backgroundColor: ORANGE, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 10.5, letterSpacing: 1.2, color: "#fff" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 21, lineHeight: 26, color: "#fff" },
    body: { fontFamily: "Quicksand-Medium", fontSize: 13, lineHeight: 18, color: "#C9CBD6", maxWidth: 220 },
    cta: {
        alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
        height: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: "#fff",
    },
    ctaText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: NAVY },
});

export default InviteCard;
