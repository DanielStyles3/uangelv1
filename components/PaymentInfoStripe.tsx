import { StyleSheet, Text, View } from "react-native";
import cn from "clsx";
import { PaymentInfoStripeProps } from "@/type";

/**
 * One label/value row in a payment summary. The label takes the remaining width and
 * wraps (up to 2 lines) so long product names never push the amount off the card;
 * the amount keeps its own space on the right.
 */
const PaymentInfoStripe = ({ label, value, labelStyle, valueStyle }: PaymentInfoStripeProps) => (
    <View style={styles.row}>
        <Text style={styles.label} numberOfLines={2} className={cn("paragraph-medium text-gray-200", labelStyle)}>
            {label}
        </Text>
        <Text style={styles.value} numberOfLines={1} className={cn("paragraph-bold text-dark-100", valueStyle)}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginVertical: 4 },
    label: { flex: 1, flexShrink: 1 },
    value: { flexShrink: 0, textAlign: "right" },
});

export default PaymentInfoStripe;
