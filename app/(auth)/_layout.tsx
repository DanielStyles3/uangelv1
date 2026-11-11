import { Redirect, Stack } from "expo-router";

import useAuthStore from "@/store/auth.store";

/**
 * Sign in / Sign up / Forgot password. Each screen draws itself with <AuthScreen>
 * (bold orange background, white logo, the form in a floating white card).
 */
export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore();

    if (isAuthenticated) return <Redirect href="/" />;

    return (
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: "#FD652A" } }}>
            <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
            <Stack.Screen name="sign-up" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="verify-email" />
        </Stack>
    );
}
