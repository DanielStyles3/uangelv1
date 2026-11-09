import {Text, FlatList, TouchableOpacity, Platform} from 'react-native'
import {Category} from "@/type";
import {router, useLocalSearchParams} from "expo-router";
import cn from "clsx";

const Filter = ({ categories }: { categories?: Category[] | null }) => {
    // Derive the active chip from the URL so it stays correct when another screen
    // (e.g. an offer on Home) navigates here with ?category=...
    const { category } = useLocalSearchParams<{ category?: string }>();
    const active = category || 'all';

    const handlePress = (id: string) => {
        router.setParams({ category: id === 'all' ? undefined : id });
    };

    const filterData: { id: string; name: string }[] = [
        { id: 'all', name: 'All' },
        // Service categories (Catering, Events) have no products to search.
        ...(categories ?? [])
            .filter((c) => c.kind !== 'service')
            .map((c) => ({ id: c.id, name: c.name })),
    ];

    return (
        <FlatList
            data={filterData}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-x-2 pb-3"
            renderItem={({ item }) => (
                <TouchableOpacity
                    className={cn('filter', active === item.id ? 'bg-amber-500' : 'bg-white')}
                    style={Platform.OS === 'android' ? { elevation: 5, shadowColor: '#878787'} : {}}
                    onPress={() => handlePress(item.id)}
                >
                    <Text className={cn('body-medium', active === item.id ? 'text-white' : 'text-gray-200')}>{item.name}</Text>
                </TouchableOpacity>
            )}
        />
    )
}
export default Filter
