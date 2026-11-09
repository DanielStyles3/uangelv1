import { useState } from "react";
import { FlatList, Image, Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import cn from "clsx";
import { Ionicons } from "@expo/vector-icons";
import { images, NIGERIAN_STATES } from "@/constants";

interface StatePickerProps {
    label?: string;
    value?: string | null;
    onChange: (state: string) => void;
}

/** Field that opens a list of Nigeria's 36 states + FCT. */
const StatePicker = ({ label = "State", value, onChange }: StatePickerProps) => {
    const [open, setOpen] = useState(false);

    return (
        <View className="w-full">
            <Text className="label">{label}</Text>

            <TouchableOpacity
                onPress={() => setOpen(true)}
                className="flex-row items-center justify-between rounded-lg p-3 w-full border-b border-gray-300"
            >
                <Text className={cn("text-base font-quicksand-semibold", value ? "text-dark-100" : "text-gray-100")}>
                    {value || "Select your state"}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#878787" />
            </TouchableOpacity>

            <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100/20">
                        <Text className="h3-bold text-dark-100">Select state</Text>
                        <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                            <Text className="paragraph-bold text-primary">Close</Text>
                        </Pressable>
                    </View>

                    <FlatList
                        data={NIGERIAN_STATES}
                        keyExtractor={(item) => item}
                        contentContainerClassName="pb-10"
                        renderItem={({ item }) => {
                            const selected = item === value;
                            return (
                                <TouchableOpacity
                                    className={cn("flex-row items-center justify-between px-5 py-4", selected && "bg-primary/10")}
                                    onPress={() => {
                                        onChange(item);
                                        setOpen(false);
                                    }}
                                >
                                    <Text className={cn("paragraph-semibold", selected ? "text-primary" : "text-dark-100")}>{item}</Text>
                                    {selected && <Image source={images.check} className="size-4" resizeMode="contain" tintColor="#FD652A" />}
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export default StatePicker;
