import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import cn from "clsx";

import ProductImage from "@/components/ProductImage";
import { Category } from "@/type";

interface CategoryCardProps {
    category: Category;
    /** Alternate the photo side per row, exactly like the original offer cards. */
    reversed?: boolean;
    /** false = display only (e.g. the hero on the category page): no press, no arrow. */
    interactive?: boolean;
}

/**
 * Same design as the original Home "offer" cards (SUMMER COMBO, BURGER BASH…):
 * colored card, photo on one half, big white title + arrow on the other.
 */
const CategoryCard = ({ category, reversed = false, interactive = true }: CategoryCardProps) => (
    <Pressable
        className={cn("offer-card", reversed ? 'flex-row-reverse' : 'flex-row')}
        style={{ backgroundColor: category.color ?? '#FE8C00' }}
        android_ripple={interactive ? { color: "#ffffff22" } : undefined}
        disabled={!interactive}
        onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })}
        accessibilityRole={interactive ? "button" : undefined}
        accessibilityLabel={category.name}
    >
        {() => (
            <Fragment>
                <View className="h-full w-1/2">
                    <ProductImage
                        imageUrl={category.image_url}
                        emoji={category.emoji}
                        className="size-full"
                        emojiClassName="text-7xl"
                        resizeMode="cover"
                    />
                </View>

                <View className={cn("offer-card__info", reversed ? 'pl-10' : 'pr-10')}>
                    <Text className="h1-bold text-white leading-tight" numberOfLines={3} adjustsFontSizeToFit>
                        {category.name.toUpperCase()}
                    </Text>

                    {category.delivery_note && (
                        <Text className="small-bold text-white/90">🚚 {category.delivery_note}</Text>
                    )}

                    {interactive && (
                        <View className="size-10 rounded-full bg-white/20 border border-white/40 items-center justify-center">
                            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
                        </View>
                    )}
                </View>
            </Fragment>
        )}
    </Pressable>
);

export default CategoryCard;
