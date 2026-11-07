import { Text, View } from "react-native";
import cn from "clsx";
import { PaymentInfoStripeProps } from "@/type";

/** One label/value row in a payment summary. */
const PaymentInfoStripe = ({ label, value, labelStyle, valueStyle }: PaymentInfoStripeProps) => (
    <View className="flex-between flex-row my-1">
        <Text className={cn("paragraph-medium text-gray-200", labelStyle)}>
            {label}
        </Text>
        <Text className={cn("paragraph-bold text-dark-100", valueStyle)}>
            {value}
        </Text>
    </View>
);

export default PaymentInfoStripe;
