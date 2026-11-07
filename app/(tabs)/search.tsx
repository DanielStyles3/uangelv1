import {FlatList, Text, View} from 'react-native'
import {SafeAreaView} from "react-native-safe-area-context";
import useFetch from "@/lib/useFetch";
import {getCategories, getMenu} from "@/lib/api";
import {useLocalSearchParams} from "expo-router";
import CartButton from "@/components/CartButton";
import MenuCard from "@/components/MenuCard";
import cn from "clsx";

import Filter from "@/components/Filter";
import SearchBar from "@/components/SearchBar";

const Search = () => {
    const { category, query } = useLocalSearchParams<{query?: string; category?: string}>()

    // useFetch refetches automatically whenever category/query change.
    const { data, loading } = useFetch({ fn: getMenu, params: { category, query, limit: 6 } });
    const { data: categories } = useFetch({ fn: getCategories });

    return (
        <SafeAreaView className="bg-white h-full">
            <FlatList
                data={data ?? []}
                renderItem={({ item, index }) => {
                    const isFirstRightColItem = index % 2 === 0;

                    return (
                        <View className={cn("flex-1 max-w-[48%]", !isFirstRightColItem ? 'mt-10': 'mt-0')}>
                            <MenuCard item={item} />
                        </View>
                    )
                }}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperClassName="gap-7"
                contentContainerClassName="gap-7 px-5 pb-10"
                ListHeaderComponent={() => (
                    <View className="my-5 gap-5">
                        <View className="flex-between flex-row w-full">
                            <View className="flex-start">
                                <Text className="small-bold uppercase text-primary">Search</Text>
                                <View className="flex-start flex-row gap-x-1 mt-0.5">
                                    <Text className="paragraph-semibold text-dark-100">Cakes, drinks, groceries & more</Text>
                                </View>
                            </View>

                            <CartButton />
                        </View>

                        <SearchBar />

                        <Filter categories={categories} />
                    </View>
                )}
                ListEmptyComponent={() => !loading && <Text className="paragraph-medium text-gray-200 text-center">No results</Text>}
            />
        </SafeAreaView>
    )
}

export default Search
