import {Text, TouchableOpacity, View, Platform} from 'react-native'
import {router} from "expo-router";
import {MenuItem} from "@/type";
import {useCartStore} from "@/store/cart.store";
import {formatNaira} from "@/lib/format";
import ProductImage from "@/components/ProductImage";

/**
 * Original menu card design: the image floats above the top edge of the card.
 * Web photos aren't transparent cut-outs, so the floating image is a round photo.
 * Parents use the original staggered 2-column grid (see app/(tabs)/search.tsx).
 */
const MenuCard = ({ item: { id, image_url, emoji, name, price }}: { item: MenuItem}) => {
    const { addItem } = useCartStore();

    return (
        <TouchableOpacity
            className="menu-card"
            style={Platform.OS === 'android' ? { elevation: 10, shadowColor: '#878787'}: {}}
            onPress={() => router.push({ pathname: '/menu/[id]', params: { id } })}
        >
            <View className="size-32 absolute -top-10 rounded-full overflow-hidden border-4 border-white bg-primary/10">
                <ProductImage
                    imageUrl={image_url}
                    emoji={emoji}
                    className="size-full"
                    emojiClassName="text-5xl"
                    resizeMode="cover"
                />
            </View>
            <Text className="text-center base-bold text-dark-100 mb-2" numberOfLines={1}>{name}</Text>
            <Text className="body-regular text-gray-200 mb-4">From {formatNaira(price)}</Text>
            <TouchableOpacity onPress={() => addItem({ id, name, price, image_url, emoji, customizations: []})}>
                <Text className="paragraph-bold text-primary">Add to Cart +</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    )
}
export default MenuCard
