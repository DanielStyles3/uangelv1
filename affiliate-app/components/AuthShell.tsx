import { StatusBar } from 'expo-status-bar';
import { ComponentRef, ReactNode, useEffect, useRef } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import logo from '@/assets/images/uangel-affiliates-logo-white.png';
import { Enter } from '@/components/motion';
import { colors, fonts } from '@/lib/theme';

/** Orange header with the logo, then a white rounded sheet holding the form. */
export default function AuthShell({ title, subtitle, top, children }: {
    title: string;
    subtitle: string;
    top?: ReactNode;
    children: ReactNode;
}) {
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const offsetY = useRef(0);

    // When the keyboard opens, scroll just enough that the field being typed in (and a bit below it)
    // sits above the keyboard.
    useEffect(() => {
        const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
            setTimeout(() => {
                const input = TextInput.State.currentlyFocusedInput();
                if (!input) return;
                input.measureInWindow((_x, y, _w, h) => {
                    const keyboardTop = e.endCoordinates.screenY;
                    const overlap = y + h + 90 - keyboardTop;   // 90px room for the next field or button
                    if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
                });
            }, Platform.OS === 'ios' ? 250 : 80);
        });
        return () => sub.remove();
    }, []);

    return (
        // Android draws edge to edge (the window no longer shrinks for the keyboard), so pad on both platforms.
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <StatusBar style="light" />
            {/* Solid strip behind the status bar, so the white sheet never scrolls under the clock. */}
            <View style={[styles.statusStrip, { height: insets.top }]} />
            <ScrollView
                ref={scrollRef}
                onScroll={(ev) => { offsetY.current = ev.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={32}
                style={styles.flex}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <View style={styles.circle} />
                    {top}
                    <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="U Angel Foods" />
                    <Text style={styles.kicker}>U ANGEL AFFILIATES</Text>
                </View>
                <Enter style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
                    <View style={styles.titles}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.subtitle}>{subtitle}</Text>
                    </View>
                    {children}
                </Enter>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.orange },
    scroll: { flexGrow: 1 },
    statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.orange, zIndex: 2 },
    header: { alignItems: 'center', paddingBottom: 34, overflow: 'hidden' },
    circle: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(255,255,255,0.1)',
        right: -90,
        top: -110,
    },
    logo: { width: 120, height: 120 },
    kicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: 'rgba(255,255,255,0.88)', marginTop: 4 },
    sheet: {
        flexGrow: 1,
        backgroundColor: colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 26,
        gap: 18,
    },
    titles: { gap: 4 },
    title: { fontFamily: fonts.bold, fontSize: 26, color: colors.navy },
    subtitle: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 21, color: colors.grey },
});
