import {Redirect, Tabs} from "expo-router";
import useAuthStore from "@/store/auth.store";
import TabBar from "@/components/TabBar";

export default function TabLayout() {
    const { isAuthenticated } = useAuthStore();

    if(!isAuthenticated) return <Redirect href="/sign-in" />

    return (
        <Tabs
            // Docked tab bar (not floating): screens end above it, so they need no extra bottom padding.
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name='index' options={{ title: 'Home' }} />
            <Tabs.Screen name='search' options={{ title: 'Search' }} />
            <Tabs.Screen name='cart' options={{ title: 'Cart' }} />
            <Tabs.Screen name='profile' options={{ title: 'Profile' }} />
        </Tabs>
    );
}
