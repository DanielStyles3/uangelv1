import { Tabs } from 'expo-router';

import TabBar from '@/components/TabBar';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
    return (
        <Tabs
            tabBar={(props) => <TabBar {...props} />}
            screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
        >
            <Tabs.Screen name="index" options={{ title: 'Earnings' }} />
            <Tabs.Screen name="referrals" options={{ title: 'Referrals' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
    );
}
