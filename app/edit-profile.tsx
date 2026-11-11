import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";

import CustomHeader from "@/components/CustomHeader";
import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import { updateProfile } from "@/lib/api";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useAuthStore from "@/store/auth.store";

import { notify } from "@/lib/notice";
/** Personal details only: who you are. The delivery address has its own screen (delivery-address.tsx). */
export default function PersonalDetails() {
    const { user, setUser } = useAuthStore();

    const [form, setForm] = useState({
        name: user?.name ?? '',
        phone: formatNigerianPhone(user?.phone),
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!user) return <Redirect href="/sign-in" />;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        const name = form.name.trim();
        if (!name) return notify('Name', 'Please enter your name.');

        let phone: string | null = null;
        if (form.phone.trim()) {
            phone = normalizeNigerianPhone(form.phone);
            if (!phone) return notify('Phone number', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');
        }

        setIsSaving(true);
        try {
            setUser(await updateProfile(user.id, { name, phone }));
            router.back();
        } catch (e: any) {
            notify('Could not save', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView className="flex-1" behavior="padding">
                <ScrollView contentContainerClassName="px-5 pt-5 pb-16 gap-6" keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Personal details" showSearch={false} />

                    <View className="gap-6 -mt-4">
                        <CustomInput label="Full name" value={form.name} onChangeText={set('name')} autoCapitalize="words" placeholder="Your name" />
                        <View>
                            <CustomInput
                                label="Phone number"
                                placeholder="0803 123 4567"
                                value={form.phone}
                                onChangeText={set('phone')}
                                keyboardType="phone-pad"
                            />
                            <Text className="body-regular text-gray-200 pl-2 mt-1">We call this number about your orders.</Text>
                        </View>
                        <View>
                            <CustomInput label="Email" value={user.email} editable={false} />
                            <Text className="body-regular text-gray-200 pl-2 mt-1">Your sign-in email can’t be changed here.</Text>
                        </View>
                    </View>

                    <CustomButton title="Save details" isLoading={isSaving} onPress={save} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
