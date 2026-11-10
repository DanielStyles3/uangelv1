import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'sign-in' };

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FD652A' } }}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="forgot-password" />
        </Stack>
    );
}
