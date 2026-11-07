import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";

import CustomHeader from "@/components/CustomHeader";
import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import StatePicker from "@/components/StatePicker";
import { updateProfile } from "@/lib/api";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useAuthStore from "@/store/auth.store";

export default function EditProfile() {
    const { user, setUser } = useAuthStore();

    const [form, setForm] = useState({
        name: user?.name ?? '',
        phone: formatNigerianPhone(user?.phone),
        address: user?.address ?? '',
        city: user?.city ?? '',
        state: user?.state ?? '',
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!user) return <Redirect href="/sign-in" />;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        const name = form.name.trim();
        if (!name) return Alert.alert('Name', 'Please enter your name.');

        let phone: string | null = null;
        if (form.phone.trim()) {
            phone = normalizeNigerianPhone(form.phone);
            if (!phone) return Alert.alert('Phone number', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');
        }

        setIsSaving(true);
        try {
            const updated = await updateProfile(user.id, {
                name,
                phone,
                address: form.address.trim() || null,
                city: form.city.trim() || null,
                state: form.state || null,
            });
            setUser(updated);
            router.back();
        } catch (e: any) {
            Alert.alert('Could not save', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView className="flex-1" behavior="padding">
                <ScrollView contentContainerClassName="px-5 pt-5 pb-16 gap-6" keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Edit profile" showSearch={false} />

                    <View className="gap-6 -mt-4">
                        <CustomInput label="Full name" value={form.name} onChangeText={set('name')} autoCapitalize="words" placeholder="Your name" />
                        <CustomInput label="Email" value={user.email} editable={false} />
                        <CustomInput
                            label="Phone number"
                            placeholder="0803 123 4567"
                            value={form.phone}
                            onChangeText={set('phone')}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View className="gap-6">
                        <Text className="h3-bold text-dark-100">Default delivery address</Text>
                        <CustomInput
                            label="Street address"
                            placeholder="e.g. 12 Admiralty Way"
                            value={form.address}
                            onChangeText={set('address')}
                            autoCapitalize="words"
                        />
                        <CustomInput
                            label="City / Area"
                            placeholder="e.g. Lekki"
                            value={form.city}
                            onChangeText={set('city')}
                            autoCapitalize="words"
                        />
                        <StatePicker value={form.state} onChange={set('state')} />
                    </View>

                    <CustomButton title="Save changes" isLoading={isSaving} onPress={save} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
