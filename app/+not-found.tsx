import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";

export default function NotFound() {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1 flex-center px-5 gap-4">
                <Image source={images.emptyState} className="size-52" resizeMode="contain" />
                <Text className="h3-bold text-dark-100">Page not found</Text>
                <Text className="paragraph-medium text-gray-200 text-center">
                    The page you&apos;re looking for doesn&apos;t exist or has moved.
                </Text>
                <View className="w-full mt-2">
                    <CustomButton title="Go home" onPress={() => router.replace('/')} />
                </View>
            </View>
        </SafeAreaView>
    );
}
