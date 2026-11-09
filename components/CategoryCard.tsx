import { Fragment, useState } from "react";
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

/** Approximate advance width (in em) of bold uppercase Quicksand characters. */
const charEm = (c: string) =>
    /[MW]/.test(c) ? 0.98 : /[NOQGDHUC&]/.test(c) ? 0.8 : /[IJ1]/.test(c) ? 0.36 : c === ' ' ? 0.28 : /[^A-Z0-9]/.test(c) ? 0.45 : 0.72;
const wordEm = (w: string) => [...w].reduce((s, c) => s + charEm(c), 0);

/**
 * Splits the title into lines ourselves (whole words only) at a size where the longest
 * word fits, so Android can never break "REFRESHMENTS" into "REFRESHMEN / TS".
 * Each line is then drawn with numberOfLines=1 + adjustsFontSizeToFit as a safety net.
 */
const layoutTitle = (title: string, width: number) => {
    // "&" always stays with the word before it ("DRINKS &" / "REFRESHMENTS").
    const words = title.split(/\s+/).filter(Boolean).reduce<string[]>((acc, w) => {
        if (w === '&' && acc.length) acc[acc.length - 1] += ' &'; else acc.push(w);
        return acc;
    }, []);
    const longest = Math.max(...words.map(wordEm), 1);
    let size = Math.max(15, Math.min(30, Math.floor(width / (longest * 1.06))));
    for (;;) {
        const lines: string[] = [];
        for (const w of words) {
            const last = lines[lines.length - 1];
            if (last && (wordEm(last) + charEm(' ') + wordEm(w)) * size * 1.06 <= width) lines[lines.length - 1] = `${last} ${w}`;
            else lines.push(w);
        }
        if (lines.length <= 3 || size <= 15) return { size, lines };
        size -= 1;
    }
};

/**
 * Same design as the original Home "offer" cards (SUMMER COMBO, BURGER BASH…):
 * colored card, photo on one half, big white title + arrow on the other.
 */
const CategoryCard = ({ category, reversed = false, interactive = true }: CategoryCardProps) => {
    const title = category.name.toUpperCase();
    // Start from an estimate, then use the real width of the text column once measured.
    const [textW, setTextW] = useState(TEXT_W);
    const { size: fontSize, lines } = layoutTitle(title, textW);

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
                        <View
                            accessible
                            accessibilityLabel={category.name}
                            style={{ alignSelf: 'stretch' }}
                            onLayout={(e) => {
                                const w = Math.floor(e.nativeEvent.layout.width);
                                if (w > 40 && Math.abs(w - textW) > 2) setTextW(w);
                            }}
                        >
                            {lines.map((line) => (
                                <Text
                                    key={line}
                                    style={{ fontFamily: "Quicksand-Bold", fontSize, lineHeight: Math.round(fontSize * 1.15), color: "#fff" }}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                >
                                    {line}
                                </Text>
                            ))}
                        </View>

                        {category.delivery_note && (
                            <Text className="small-bold text-white/90"><Ionicons name="bicycle" size={14} color="rgba(255,255,255,0.9)" /> {category.delivery_note}</Text>
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
