import { Ionicons } from "@expo/vector-icons";
import {ActivityIndicator, FlatList, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {router, useLocalSearchParams} from "expo-router";

import CategoryCard from "@/components/CategoryCard";
import CustomButton from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import SubcategoryTile from "@/components/SubcategoryTile";
import {getCategory, getSubcategories} from "@/lib/api";
import useFetch from "@/lib/useFetch";

export default function CategoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: category, loading: categoryLoading } = useFetch({ fn: getCategory, params: { id: id ?? '' }, skip: !id });
    const { data: subcategories, loading: subsLoading } = useFetch({ fn: getSubcategories, params: { parentId: id ?? '' }, skip: !id });

    if (categoryLoading && !category) {
        return (
            <SafeAreaView className="flex-1 bg-white flex-center">
                <ActivityIndicator size="large" color="#FD652A" />
            </SafeAreaView>
        );
    }

    if (!category) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5 pt-5">
                <CustomHeader title="Category" />
                <View className="flex-1 items-center justify-center gap-y-3 pb-20">
                    <Ionicons name="search-outline" size={52} color="#C4C4CC" />
                    <Text className="paragraph-bold text-dark-100">Category not found</Text>
                    <View className="w-40">
                        <CustomButton title="Go home" onPress={() => router.replace('/')} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const isService = category.kind === 'service';

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                data={subcategories ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <SubcategoryTile sub={item} isService={isService} index={index} accent={category.color ?? '#FD652A'} />
                )}
                numColumns={2}
                columnWrapperStyle={{ gap: 14 }}
                contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
                ListHeaderComponent={() => (
                    <View className="mb-5">
                        <CustomHeader title={category.name} />

                        {/* Same card as on Home, display-only. */}
                        <View className="-mt-8">
                            <CategoryCard category={category} interactive={false} />
                        </View>

                        {category.description && (
                            <Text className="paragraph-medium text-gray-200 mt-1">{category.description}</Text>
                        )}

                        <View className="mt-5">
                            {isService ? (
                                <CustomButton
                                    title="Request a quote"
                                    onPress={() => router.push({ pathname: '/service-request', params: { categoryId: category.id } })}
                                />
                            ) : (
                                <CustomButton
                                    title={`Browse all ${category.name}`}
                                    onPress={() => router.push({ pathname: '/search', params: { category: category.id } })}
                                />
                            )}
                        </View>

                        {(subcategories?.length ?? 0) > 0 && (
                            <Text className="h3-bold text-dark-100 mt-8">
                                {isService ? 'What are you planning?' : 'Shop by type'}
                            </Text>
                        )}
                    </View>
                )}
                ListEmptyComponent={() =>
                    subsLoading ? (
                        <View className="py-10 flex-center">
                            <ActivityIndicator size="large" color="#FD652A" />
                        </View>
                    ) : (
                        <View className="py-10 items-center gap-y-2">
                            <Ionicons name="basket-outline" size={44} color="#C4C4CC" />
                            <Text className="paragraph-bold text-dark-100">No sections here yet</Text>
                            <Text className="body-regular text-gray-200 text-center">
                                Check back soon, or browse everything in {category.name}.
                            </Text>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}
