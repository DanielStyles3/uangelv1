import {ActivityIndicator, FlatList, Platform, Text, TouchableOpacity, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {router, useLocalSearchParams} from "expo-router";
import cn from "clsx";

import CategoryCard from "@/components/CategoryCard";
import CustomButton from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import ProductImage from "@/components/ProductImage";
import {getCategory, getSubcategories} from "@/lib/api";
import useFetch from "@/lib/useFetch";
import {SubcategoryWithCount} from "@/type";

const productCountLabel = (count: number) =>
    count === 0 ? 'Coming soon' : count === 1 ? '1 product' : `${count} products`;

/**
 * Same design as the menu cards: white card with a round photo floating over the top edge.
 * Service categories (Catering, Events) have no products: the tile opens the request form.
 */
const SubcategoryTile = ({ sub, isService }: { sub: SubcategoryWithCount; isService: boolean }) => (
    <TouchableOpacity
        className="menu-card"
        style={Platform.OS === 'android' ? { elevation: 10, shadowColor: '#878787' } : {}}
        onPress={() =>
            isService
                ? (sub.child_count
                    // e.g. Catering › Events: show the event types first
                    ? router.push({ pathname: '/category/[id]', params: { id: sub.id } })
                    : router.push({ pathname: '/service-request', params: { categoryId: sub.parent_id ?? '', subcategoryId: sub.id } }))
                : router.push({ pathname: '/subcategory/[id]', params: { id: sub.id } })
        }
        accessibilityRole="button"
        accessibilityLabel={isService ? `${sub.name}, request a quote` : `${sub.name}, ${productCountLabel(sub.product_count)}`}
    >
        <View className="size-32 absolute -top-10 rounded-full overflow-hidden border-4 border-white bg-primary/10">
            <ProductImage
                imageUrl={sub.image_url}
                emoji={sub.emoji}
                className="size-full"
                emojiClassName="text-5xl"
                resizeMode="cover"
            />
        </View>
        <Text className="text-center base-bold text-dark-100 mb-2" numberOfLines={2}>{sub.name}</Text>
        {isService ? (
            <Text className="paragraph-bold text-primary mt-2">{sub.child_count ? 'See options →' : 'Request a quote →'}</Text>
        ) : (
            <>
                <Text className="body-regular text-gray-200 mb-4">{productCountLabel(sub.product_count)}</Text>
                <Text className="paragraph-bold text-primary">Shop now →</Text>
            </>
        )}
    </TouchableOpacity>
);

export default function CategoryScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: category, loading: categoryLoading } = useFetch({ fn: getCategory, params: { id: id ?? '' }, skip: !id });
    const { data: subcategories, loading: subsLoading } = useFetch({ fn: getSubcategories, params: { parentId: id ?? '' }, skip: !id });

    if (categoryLoading && !category) {
        return (
            <SafeAreaView className="flex-1 bg-white flex-center">
                <ActivityIndicator size="large" color="#FE8C00" />
            </SafeAreaView>
        );
    }

    if (!category) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5 pt-5">
                <CustomHeader title="Category" />
                <View className="flex-1 items-center justify-center gap-y-3 pb-20">
                    <Text className="text-5xl">🔍</Text>
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
                    // Original staggered grid: right column sits lower.
                    <View className={cn("flex-1 max-w-[48%]", index % 2 === 1 ? 'mt-10' : 'mt-0')}>
                        <SubcategoryTile sub={item} isService={isService} />
                    </View>
                )}
                numColumns={2}
                columnWrapperClassName="gap-7"
                contentContainerClassName="gap-7 px-5 pt-5 pb-10"
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
                            <ActivityIndicator size="large" color="#FE8C00" />
                        </View>
                    ) : (
                        <View className="py-10 items-center gap-y-2">
                            <Text className="text-4xl">🧺</Text>
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
