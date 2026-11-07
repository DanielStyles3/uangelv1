import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");
const SLIDE_W = SCREEN_W - 40;   // matches the screen's px-5 gutter
const AUTO_MS = 4500;

export interface PromoSlide {
    id: string;
    eyebrow: string;
    title: string;
    cta: string;
    image: ImageSourcePropType;
    color: string;
    onPress: () => void;
}

/** Auto-advancing promo banners (photo + bold copy) with pill-style page dots. */
const PromoCarousel = ({ slides }: { slides: PromoSlide[] }) => {
    const listRef = useRef<FlatList<PromoSlide>>(null);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused || slides.length < 2) return;
        const t = setTimeout(() => {
            const next = (index + 1) % slides.length;
            listRef.current?.scrollToOffset({ offset: next * (SLIDE_W + 12), animated: true });
            setIndex(next);
        }, AUTO_MS);
        return () => clearTimeout(t);
    }, [index, paused, slides.length]);

    return (
        <View>
            <FlatList
                ref={listRef}
                data={slides}
                keyExtractor={(s) => s.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SLIDE_W + 12}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12 }}
                onScrollBeginDrag={() => setPaused(true)}
                onMomentumScrollEnd={(e) => {
                    setIndex(Math.round(e.nativeEvent.contentOffset.x / (SLIDE_W + 12)));
                    setPaused(false);
                }}
                renderItem={({ item }) => (
                    <Pressable onPress={item.onPress} style={[styles.slide, { backgroundColor: item.color }]} accessibilityRole="button" accessibilityLabel={item.title}>
                        <View style={styles.copy}>
                            <Text style={styles.eyebrow}>{item.eyebrow}</Text>
                            <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
                            <View style={styles.cta}>
                                <Text style={[styles.ctaText, { color: item.color }]}>{item.cta}</Text>
                                <Ionicons name="arrow-forward" size={14} color={item.color} />
                            </View>
                        </View>
                        <View style={styles.photoWrap}>
                            <Image source={item.image} style={styles.photo} resizeMode="cover" />
                        </View>
                        {/* soft decorative circle */}
                        <View style={styles.circle} />
                    </Pressable>
                )}
            />

            <View style={styles.dots}>
                {slides.map((s, i) => (
                    <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    slide: {
        width: SLIDE_W,
        height: 170,
        borderRadius: 26,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
    },
    copy: { flex: 1, paddingLeft: 20, paddingRight: 8, gap: 6, zIndex: 2 },
    eyebrow: { color: "rgba(255,255,255,0.85)", fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
    title: { color: "#fff", fontFamily: "Quicksand-Bold", fontSize: 20, lineHeight: 24 },
    cta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: "#fff",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        marginTop: 4,
    },
    ctaText: { fontFamily: "Quicksand-Bold", fontSize: 12 },
    photoWrap: {
        width: 130,
        height: 150,
        marginRight: 14,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: "#fff",
        overflow: "hidden",
        transform: [{ rotate: "4deg" }],
        zIndex: 2,
    },
    photo: { width: "100%", height: "100%" },
    circle: {
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: "rgba(255,255,255,0.10)",
        right: -60,
        top: -70,
    },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E2E2E8" },
    dotActive: { width: 20, backgroundColor: "#FE8C00" },
});

export default PromoCarousel;
