import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

/** Page gutter used by every screen. */
export const GUTTER = 20;

/** Tracks how far a list has scrolled, so the header can draw a hairline once content slides under it. */
export function useHeaderScroll() {
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });
    return { scrollY, onScroll };
}

type HeaderProps = {
    title: string;
    /** Small line above the title, e.g. "Hello, Ada". */
    kicker?: string;
    right?: ReactNode;
    onBack?: () => void;
    scrollY?: SharedValue<number>;
    white?: boolean;
};

/**
 * Solid header that owns the top safe area. It sits outside the scroll view, so scrolled
 * content can never show under the phone's status bar.
 */
export function ScreenHeader({ title, kicker, right, onBack, scrollY, white }: HeaderProps) {
    const insets = useSafeAreaInsets();
    const line = useAnimatedStyle(() => ({
        opacity: scrollY ? interpolate(scrollY.value, [0, 14], [0, 1], 'clamp') : 0,
    }));

    return (
        <View style={[styles.header, white && styles.white, { paddingTop: insets.top + 10 }]}>
            <View style={styles.headerRow}>
                {onBack ? <BackButton onPress={onBack} light={!white} /> : null}
                <View style={styles.titles}>
                    {kicker ? <Text style={styles.kicker} numberOfLines={1}>{kicker}</Text> : null}
                    <Text style={onBack ? styles.titleSmall : styles.title} numberOfLines={1} accessibilityRole="header">
                        {title}
                    </Text>
                </View>
                {right}
            </View>
            <Animated.View style={[styles.headerLine, line]} />
        </View>
    );
}

type ScreenProps = Omit<HeaderProps, 'scrollY'> & {
    children: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
    /** Pushed screens (not tabs) also clear the bottom safe area. */
    stack?: boolean;
    /** Screens with text inputs. */
    keyboard?: boolean;
};

/** Header + scrolling body with the shared gutters and spacing. */
export function Screen({ children, refreshing, onRefresh, stack, keyboard, ...header }: ScreenProps) {
    const insets = useSafeAreaInsets();
    const { scrollY, onScroll } = useHeaderScroll();

    const body = (
        <View style={[styles.screen, header.white && styles.white]}>
            <ScreenHeader {...header} scrollY={scrollY} />
            <Animated.ScrollView
                style={styles.flex}
                contentContainerStyle={[styles.content, { paddingBottom: (stack ? insets.bottom : 0) + 32 }]}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    onRefresh ? (
                        <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />
                    ) : undefined
                }
            >
                {children}
            </Animated.ScrollView>
        </View>
    );

    if (!keyboard) return body;
    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {body}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.bg },
    white: { backgroundColor: colors.white },
    header: { backgroundColor: colors.bg, paddingHorizontal: GUTTER, paddingBottom: 10, zIndex: 2 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46 },
    titles: { flex: 1 },
    kicker: { fontFamily: fonts.semibold, fontSize: 13, color: colors.grey },
    title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, color: colors.navy },
    titleSmall: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.navy },
    headerLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.border },
    content: { paddingHorizontal: GUTTER, paddingTop: 6, gap: 14 },
});
