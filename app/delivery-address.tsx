import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import cn from "clsx";

import CustomHeader from "@/components/CustomHeader";
import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import StatePicker from "@/components/StatePicker";
import { deliveryFeeNote } from "@/constants";
import { getAppConfig } from "@/lib/appConfig";
import { updateProfile } from "@/lib/api";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useAuthStore from "@/store/auth.store";

import { notify } from "@/lib/notice";
/** Where we deliver. We deliver only (no pick-up). Used to fill in checkout. */
export default function DeliveryAddress() {
    const { user, setUser } = useAuthStore();

    const [form, setForm] = useState({
        address: user?.address ?? '',
        landmark: user?.landmark ?? '',
        city: user?.city ?? '',
        state: user?.state ?? '',
        deliveryPhone: formatNigerianPhone(user?.delivery_phone),
    });
    const [otherPhone, setOtherPhone] = useState(!!user?.delivery_phone);
    const [isSaving, setIsSaving] = useState(false);

    if (!user) return <Redirect href="/sign-in" />;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

    const save = async () => {
        const address = form.address.trim();
        const city = form.city.trim();
        if (!address || !city || !form.state) return notify('Delivery address', 'Please enter your street address, city/area and state.');

        let deliveryPhone: string | null = null;
        if (otherPhone) {
            deliveryPhone = normalizeNigerianPhone(form.deliveryPhone);
            if (!deliveryPhone) return notify('Phone for the rider', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');
        }

        setIsSaving(true);
        try {
            setUser(await updateProfile(user.id, {
                address, city, state: form.state,
                landmark: form.landmark.trim() || null,
                delivery_phone: deliveryPhone,
            }));
            router.back();
        } catch (e: any) {
            notify('Could not save', e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const chip = (on: boolean) => cn("px-4 py-2.5 rounded-full border", on ? "bg-dark-100 border-dark-100" : "bg-white border-gray-200");
    const chipText = (on: boolean) => cn("body-medium", on ? "text-white" : "text-dark-100");

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView className="flex-1" behavior="padding">
                <ScrollView contentContainerClassName="px-5 pt-5 pb-16 gap-6" keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Delivery address" showSearch={false} />

                    <View className="flex-row gap-3 items-center rounded-2xl p-4 -mt-4" style={{ backgroundColor: '#FFF3EC' }}>
                        <Ionicons name="bicycle-outline" size={22} color="#C43E0E" />
                        <Text className="body-medium flex-1" style={{ color: '#8A3A12' }}>
                            {getAppConfig().delivery.areaNote} Delivery: {deliveryFeeNote()}. There is no pick-up.
                        </Text>
                    </View>

                    <View className="gap-6">
                        <CustomInput label="Street address" placeholder="e.g. 12 Admiralty Way" value={form.address} onChangeText={set('address')} autoCapitalize="words" />
                        <CustomInput label="Landmark (optional)" placeholder="e.g. Opposite Mega Plaza" value={form.landmark} onChangeText={set('landmark')} autoCapitalize="sentences" />
                        <CustomInput label="City / Area" placeholder="e.g. Lekki" value={form.city} onChangeText={set('city')} autoCapitalize="words" />
                        <StatePicker value={form.state} onChange={set('state')} />
                    </View>

                    <View className="gap-3">
                        <Text className="paragraph-bold text-dark-100">Phone for the rider</Text>
                        <View className="flex-row flex-wrap gap-2">
                            <TouchableOpacity className={chip(!otherPhone)} onPress={() => setOtherPhone(false)}>
                                <Text className={chipText(!otherPhone)}>Same as my phone</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className={chip(otherPhone)} onPress={() => setOtherPhone(true)}>
                                <Text className={chipText(otherPhone)}>Another number</Text>
                            </TouchableOpacity>
                        </View>
                        {otherPhone ? (
                            <CustomInput label="Rider calls" placeholder="0803 123 4567" value={form.deliveryPhone} onChangeText={set('deliveryPhone')} keyboardType="phone-pad" />
                        ) : (
                            <Text className="body-regular text-gray-200">
                                {user.phone ? `The rider calls ${formatNigerianPhone(user.phone)}.` : 'Add your phone number in Personal details.'}
                            </Text>
                        )}
                    </View>

                    <CustomButton title="Save address" isLoading={isSaving} onPress={save} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
