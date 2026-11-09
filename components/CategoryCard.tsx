import { Fragment } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
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

const { width: SCREEN_W } = Dimensions.get("window");
// Text column = half the card (screen − 2×20 gutter) minus its padding (40 side + ~20 gap).
const TEXT_W = (SCREEN_W - 40) / 2 - 60;

/**
 * Title size that keeps the LONGEST word on one line (so "CATERING" never breaks as
 * "CATERIN G"). Bold uppercase Quicksand is roughly 0.72em per character.
 */
const titleSize = (title: string) => {
    const longest = Math.max(...title.split(/\s+/).map((w) => w.length), 1);
    return Math.max(16, Math.min(30, Math.floor(TEXT_W / (longest * 0.72))));
};

/**
 * Same design as the original Home "offer" cards (SUMMER COMBO, BURGER BASH…):
 * colored card, photo on one half, big white title + arrow on the other.
 */
const CategoryCard = ({ category, reversed = false, interactive = true }: CategoryCardProps) => {
    const title = category.name.toUpperCase();
    const fontSize = titleSize(title);

    return (
        <Pressable
            className={cn("offer-card", reversed ? 'flex-row-reverse' : 'flex-row')}
            style={{ backgroundColor: category.color ?? '#FD652A' }}
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
                        <Text
                            style={{ fontFamily: "Quicksand-Bold", fontSize, lineHeight: Math.round(fontSize * 1.15), color: "#fff" }}
                            numberOfLines={3}
                            textBreakStrategy="simple"
                        >
                            {title}
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
};

export default CategoryCard;
