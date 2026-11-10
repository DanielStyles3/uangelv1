import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';

import { IconName } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

const icon = (name: IconName, active: IconName) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
        return <Ionicons name={focused ? active : name} size={23} color={typeof color === 'string' ? color : focused ? colors.orange : colors.greyLight} />;
    };

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.orange,
                tabBarInactiveTintColor: colors.greyLight,
                tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11.5 },
                tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
                sceneStyle: { backgroundColor: colors.bg },
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Earnings', tabBarIcon: icon('wallet-outline', 'wallet') }} />
            <Tabs.Screen name="referrals" options={{ title: 'Referrals', tabBarIcon: icon('people-outline', 'people') }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
        </Tabs>
    );
}
