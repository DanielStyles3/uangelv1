import { Text, View } from "react-native";
import cn from "clsx";
import { ORDER_STATUS_LABELS } from "@/constants";
import { OrderStatus } from "@/type";

const STYLES: Record<OrderStatus, { bg: string; text: string }> = {
    awaiting_payment: { bg: "bg-orange-100", text: "text-orange-700" },
    pending:    { bg: "bg-amber-100",  text: "text-amber-700" },
    confirmed:  { bg: "bg-blue-100",   text: "text-blue-700" },
    preparing:  { bg: "bg-orange-100", text: "text-orange-700" },
    on_the_way: { bg: "bg-indigo-100", text: "text-indigo-700" },
    delivered:  { bg: "bg-green-100",  text: "text-green-700" },
    cancelled:  { bg: "bg-red-100",    text: "text-red-700" },
};

const OrderStatusBadge = ({ status }: { status: OrderStatus }) => {
    const style = STYLES[status] ?? STYLES.pending;

    return (
        <View className={cn("px-3 py-1 rounded-full self-start", style.bg)}>
            <Text className={cn("small-bold", style.text)}>{ORDER_STATUS_LABELS[status] ?? status}</Text>
        </View>
    );
};

export default OrderStatusBadge;
