import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth';

export const unstable_settings = { initialRouteName: 'sign-in' };

export default function AuthLayout() {
    const { session } = useAuth();
    // Signed in (e.g. right after signing in): go to the affiliate area.
    if (session) return <Redirect href="/" />;

    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FD652A' } }}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
        </Stack>
    );
}
