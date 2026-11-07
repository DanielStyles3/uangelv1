import { useRouter } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";

import { CustomHeaderProps } from "@/type";
import {images} from "@/constants";
import {Ionicons} from "@expo/vector-icons";

const CustomHeader = ({ title, showSearch = true }: CustomHeaderProps) => {
    const router = useRouter();

    return (
        <View className="custom-header">
            <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                hitSlop={12}
            >
                <Ionicons name="chevron-back" size={24} color="#181C2E" />
            </TouchableOpacity>

            {title && <Text className="base-semibold text-dark-100">{title}</Text>}

            {showSearch ? (
                <TouchableOpacity onPress={() => router.push('/search')} hitSlop={12}>
                    <Image source={images.search} className="size-5" resizeMode="contain" />
                </TouchableOpacity>
            ) : (
                <View className="size-5" />
            )}
        </View>
    );
};

export default CustomHeader;
