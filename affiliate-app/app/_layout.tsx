import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnimatedSplash from '@/components/AnimatedSplash';
import { AuthProvider, useAuth } from '@/lib/auth';
import { NoticeHost } from '@/lib/notice';
import { colors } from '@/lib/theme';

// Keep the plain orange native splash up until <AnimatedSplash> has drawn its first frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
    const { ready: authReady } = useAuth();
    const [splashDone, setSplashDone] = useState(false);
    const finishSplash = useCallback(() => setSplashDone(true), []);

    const ready = fontsReady && authReady;

    return (
        <>
            {/* Dark icons on our light screens (orange screens and the splash switch to "light"). */}
            <StatusBar style="dark" />
            {ready ? (
                // The app opens at "/" (the Earnings tab). Each group's layout redirects:
                // (app) → /sign-in when signed out, /join when not an affiliate yet;
                // (auth) → / once signed in.
                <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="(auth)" />
                </Stack>
            ) : null}
            {!splashDone ? <AnimatedSplash ready={ready} onFinish={finishSplash} /> : null}
            <NoticeHost />
        </>
    );
}

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        'Quicksand-Bold': require('../assets/fonts/Quicksand-Bold.ttf'),
        'Quicksand-SemiBold': require('../assets/fonts/Quicksand-SemiBold.ttf'),
        'Quicksand-Medium': require('../assets/fonts/Quicksand-Medium.ttf'),
    });

    return (
        <SafeAreaProvider>
            <AuthProvider>
                {/* If a font fails to load, carry on with the system font rather than hang. */}
                <RootNavigator fontsReady={fontsLoaded || !!fontError} />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
