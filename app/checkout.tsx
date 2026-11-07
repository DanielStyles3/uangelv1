import { useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import cn from "clsx";

import CustomHeader from "@/components/CustomHeader";
import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import StatePicker from "@/components/StatePicker";
import PaymentInfoStripe from "@/components/PaymentInfoStripe";
import { DELIVERY_FEE } from "@/constants";
import { formatNaira, formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import { placeOrder, updateProfile } from "@/lib/api";
import { openPayment } from "@/lib/payments";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "@/store/cart.store";
import useAuthStore from "@/store/auth.store";

export default function Checkout() {
    const { user, setUser, isAuthenticated } = useAuthStore();
    const { items, getTotalItems, getTotalPrice, clearCart } = useCartStore();

    const [form, setForm] = useState({
        address: user?.address ?? '',
        city: user?.city ?? '',
        state: user?.state ?? '',
        phone: formatNigerianPhone(user?.phone),
        note: '',
    });
    const [saveAddress, setSaveAddress] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isAuthenticated) return <Redirect href="/sign-in" />;
    if (items.length === 0 && !isSubmitting) return <Redirect href="/cart" />;

    const subtotal = getTotalPrice();
    const total = subtotal + DELIVERY_FEE;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

    const submit = async () => {
        const address = form.address.trim();
        const city = form.city.trim();
        const phone = normalizeNigerianPhone(form.phone);

        if (!address || !city || !form.state) return Alert.alert('Delivery address', 'Please enter your street address, city/area and state.');
        if (!phone) return Alert.alert('Phone number', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');

        setIsSubmitting(true);
        try {
            const orderId = await placeOrder({
                items,
                address,
                city,
                state: form.state,
                phone,
                note: form.note.trim() || undefined,
            });

            if (saveAddress && user) {
                // Best effort: the order is already placed even if this fails.
                try {
                    setUser(await updateProfile(user.id, { address, city, state: form.state, phone }));
                } catch (e) {
                    console.log('save address failed', e);
                }
            }

            // The order now exists (awaiting payment), so the cart is done with: retrying
            // payment happens from the order page, never by placing a second order.
            clearCart();

            // Opens Paystack inside the app; returns to the order page as soon as it's paid.
            openPayment(orderId);
        } catch (e: any) {
            Alert.alert('Could not place order', e.message);
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView className="flex-1" behavior="padding">
                <ScrollView contentContainerClassName="px-5 pt-5 pb-16 gap-6" keyboardShouldPersistTaps="handled">
                    <CustomHeader title="Checkout" showSearch={false} />

                    <View className="gap-6 -mt-4">
                        <Text className="h3-bold text-dark-100">Delivery address</Text>
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
                        <CustomInput
                            label="Phone number"
                            placeholder="0803 123 4567"
                            value={form.phone}
                            onChangeText={set('phone')}
                            keyboardType="phone-pad"
                        />
                        <CustomInput
                            label="Note for the rider (optional)"
                            placeholder="Landmark, gate code, etc."
                            value={form.note}
                            onChangeText={set('note')}
                            autoCapitalize="sentences"
                            multiline
                        />

                        <TouchableOpacity className="flex-row items-center gap-3" onPress={() => setSaveAddress((v) => !v)}>
                            <View className={cn("size-5 rounded border-2 flex-center", saveAddress ? "bg-primary border-primary" : "border-gray-200")}>
                                {saveAddress && <Text className="small-bold text-white">✓</Text>}
                            </View>
                            <Text className="paragraph-medium text-dark-100">Save as my default address</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Paystack is the only payment method: card, bank transfer or USSD. */}
                    <View style={{ borderRadius: 20, padding: 16, backgroundColor: '#0BA4DB14', borderWidth: 1.5, borderColor: '#0BA4DB55', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#0BA4DB', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="shield-checkmark" size={22} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text className="paragraph-bold text-dark-100">Secure payment with Paystack</Text>
                            <Text className="body-regular text-gray-200">Pay now by card, bank transfer or USSD. Your order is confirmed as soon as payment goes through.</Text>
                        </View>
                    </View>

                    <View className="border border-gray-200 p-5 rounded-2xl">
                        <Text className="h3-bold text-dark-100 mb-3">Order summary</Text>
                        {items.map((item) => (
                            <PaymentInfoStripe
                                key={[item.id, ...(item.customizations ?? []).map((c) => c.id)].join('|')}
                                label={`${item.quantity}× ${item.name}`}
                                value={formatNaira((item.price + (item.customizations ?? []).reduce((s, c) => s + c.price, 0)) * item.quantity)}
                            />
                        ))}
                        <View className="border-t border-gray-300 my-2" />
                        <PaymentInfoStripe label={`Subtotal (${getTotalItems()} items)`} value={formatNaira(subtotal)} />
                        <PaymentInfoStripe label="Delivery fee" value={formatNaira(DELIVERY_FEE)} />
                        <View className="border-t border-gray-300 my-2" />
                        <PaymentInfoStripe
                            label="Total"
                            value={formatNaira(total)}
                            labelStyle="base-bold !text-dark-100"
                            valueStyle="base-bold !text-dark-100"
                        />
                    </View>

                    <CustomButton title={`Pay ${formatNaira(total)} with Paystack`} isLoading={isSubmitting} onPress={submit} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
