import {ActivityIndicator, FlatList, Text, TouchableOpacity, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {router, useLocalSearchParams} from "expo-router";

import CustomButton from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import MenuCard from "@/components/MenuCard";
import {getCategory, getMenu} from "@/lib/api";
import useFetch from "@/lib/useFetch";
import cn from "clsx";

const FALLBACK_COLOR = '#FE8C00';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function SubcategoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: sub, loading: subLoading } = useFetch({ fn: getCategory, params: { id: id ?? '' }, skip: !id });
    const { data: parent } = useFetch({
        fn: getCategory,
        params: { id: sub?.parent_id ?? '' },
        skip: !sub?.parent_id,
    });
    const { data: products, loading: productsLoading } = useFetch({
        fn: getMenu,
        params: { category: id ?? '' },
        skip: !id,
    });

    if (subLoading && !sub) {
        return (
            <SafeAreaView className="flex-1 bg-white flex-center">
                <ActivityIndicator size="large" color="#FE8C00" />
            </SafeAreaView>
        );
    }

    if (!sub) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5 pt-5">
                <CustomHeader title="Not found" />
                <View className="flex-1 items-center justify-center gap-y-3 pb-20">
                    <Text className="text-5xl">🔍</Text>
                    <Text className="paragraph-bold text-dark-100">This section doesn&apos;t exist</Text>
                    <View className="w-40">
                        <CustomButton title="Go back" onPress={goBack} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const accent = parent?.color ?? sub.color ?? FALLBACK_COLOR;
    const deliveryNote = parent?.delivery_note ?? sub.delivery_note;
    const count = products?.length ?? 0;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                data={products ?? []}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    // Original staggered grid: right column sits lower (see app/(tabs)/search.tsx).
                    <View className={cn("flex-1 max-w-[48%]", index % 2 === 1 ? 'mt-10' : 'mt-0')}>
                        <MenuCard item={item} />
                    </View>
                )}
                numColumns={2}
                columnWrapperClassName="gap-7"
                contentContainerClassName="gap-7 px-5 pt-5 pb-10"
                ListHeaderComponent={() => (
                    <View className="gap-y-3 mb-5">
                        <CustomHeader title={sub.name} />

                        <View className="-mt-6 gap-y-1">
                            {parent && (
                                <View className="flex-row flex-wrap items-center">
                                    <TouchableOpacity
                                        hitSlop={8}
                                        onPress={() => router.push({ pathname: '/category/[id]', params: { id: parent.id } })}
                                    >
                                        <Text className="body-medium" style={{ color: accent }}>{parent.name}</Text>
                                    </TouchableOpacity>
                                    <Text className="body-medium text-gray-200"> › </Text>
                                    <Text className="body-medium text-dark-100" numberOfLines={1}>{sub.name}</Text>
                                </View>
                            )}

                            <View className="flex-row items-center gap-x-2">
                                <View className="h-1 w-8 rounded-full" style={{ backgroundColor: accent }} />
                                <Text className="body-regular text-gray-200">
                                    {productsLoading ? 'Loading products…' : count === 1 ? '1 product' : `${count} products`}
                                </Text>
                            </View>
                        </View>

                        {deliveryNote && (
                            <View className="flex-row items-center gap-x-3 rounded-2xl px-4 py-3 bg-primary/10 border border-primary/30">
                                <Text className="text-xl">🚚</Text>
                                <Text className="paragraph-bold text-dark-100 flex-1">{deliveryNote}</Text>
                            </View>
                        )}
                    </View>
                )}
                ListEmptyComponent={() =>
                    productsLoading ? (
                        <View className="py-16 flex-center">
                            <ActivityIndicator size="large" color="#FE8C00" />
                        </View>
                    ) : (
                        <View className="py-16 items-center gap-y-3">
                            <Text className="text-5xl">{sub.emoji || '🛍️'}</Text>
                            <Text className="paragraph-bold text-dark-100">No products here yet</Text>
                            <Text className="body-regular text-gray-200 text-center">
                                We&apos;re stocking this section. Check back soon.
                            </Text>
                            <View className="w-40 mt-2">
                                <CustomButton title="Go back" onPress={goBack} />
                            </View>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}
