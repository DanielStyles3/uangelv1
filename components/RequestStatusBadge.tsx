import { Text, View } from "react-native";
import cn from "clsx";
import { ServiceRequestStatus } from "@/type";

// Kept in components/ so Tailwind's content scan picks up these class names.
const STATUS: Record<ServiceRequestStatus, { label: string; bg: string; text: string }> = {
    new:       { label: "Received",   bg: "bg-amber-100",  text: "text-amber-700" },
    contacted: { label: "Contacted",  bg: "bg-blue-100",   text: "text-blue-700" },
    quoted:    { label: "Quote sent", bg: "bg-indigo-100", text: "text-indigo-700" },
    confirmed: { label: "Confirmed",  bg: "bg-green-100",  text: "text-green-700" },
    completed: { label: "Completed",  bg: "bg-slate-100",  text: "text-slate-700" },
    cancelled: { label: "Cancelled",  bg: "bg-red-100",    text: "text-red-700" },
};

const RequestStatusBadge = ({ status }: { status: ServiceRequestStatus }) => {
    const s = STATUS[status] ?? STATUS.new;
    return (
        <View className={cn("px-3 py-1 rounded-full self-start", s.bg)}>
            <Text className={cn("small-bold", s.text)}>{s.label}</Text>
        </View>
    );
};

export default RequestStatusBadge;
