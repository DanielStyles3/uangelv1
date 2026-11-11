import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useState } from "react";

import './globals.css';
import * as Sentry from '@sentry/react-native';
import useAuthStore from "@/store/auth.store";
import AnimatedSplash from "@/components/AnimatedSplash";
import { NoticeHost } from "@/lib/notice";

// Keep the native splash up until <AnimatedSplash> has drawn its first frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Set EXPO_PUBLIC_SENTRY_DSN in .env to your own Sentry project's DSN. Without it Sentry stays off.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  // Record every session while developing, but only 10% in production builds.
  replaysSessionSampleRate: __DEV__ ? 1 : 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function RootLayout() {
  const { isLoading, fetchAuthenticatedUser } = useAuthStore();

  const [fontsLoaded, error] = useFonts({
    // Names must match the fontFamily entries in tailwind.config.js exactly.
    "Quicksand-Bold": require('../assets/fonts/Quicksand-Bold.ttf'),
    "Quicksand-Medium": require('../assets/fonts/Quicksand-Medium.ttf'),
    "Quicksand-Regular": require('../assets/fonts/Quicksand-Regular.ttf'),
    "Quicksand-SemiBold": require('../assets/fonts/Quicksand-SemiBold.ttf'),
    "Quicksand-Light": require('../assets/fonts/Quicksand-Light.ttf'),
  });

  useEffect(() => {
    if(error) throw error;
  }, [error]);

  // The native splash is hidden by <AnimatedSplash> once it has drawn its first frame.
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    fetchAuthenticatedUser()
  }, [fetchAuthenticatedUser]);

  // The feedback widget needs the Sentry.wrap() provider to be mounted first,
  // so show it from an effect (after mount) rather than at module load.
  const ready = fontsLoaded && !isLoading;
  useEffect(() => {
    // Developer builds only: customers shouldn't see a floating "Report a bug" button.
    if (ready && SENTRY_DSN && __DEV__) Sentry.showFeedbackWidget();
  }, [ready]);

  return (
    <>
      {/* Dark clock/battery icons on our white screens (auth + splash set "light" while they're shown). */}
      <StatusBar style="dark" />
      {ready && <Stack screenOptions={{ headerShown: false }} />}
      {!splashDone && <AnimatedSplash ready={ready} onFinish={finishSplash} />}
      <NoticeHost />
    </>
  );
});
