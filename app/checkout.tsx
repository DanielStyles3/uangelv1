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
import { getCampaignProducts, placeOrder, updateProfile } from "@/lib/api";
import useFetch from "@/lib/useFetch";
import { openPayment } from "@/lib/payments";
import useDeliveryFee from "@/lib/useDeliveryFee";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "@/store/cart.store";
import useAuthStore from "@/store/auth.store";
import { CheckoutPaymentMethod } from "@/type";

/** One choice in the Payment section (radio card). */
const PaymentOption = ({ icon, title, body, selected, onPress }: {
    icon: keyof typeof Ionicons.glyphMap; title: string; body: string; selected: boolean; onPress: () => void;
}) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        style={{
            borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5,
            backgroundColor: selected ? '#0BA4DB14' : '#fff', borderColor: selected ? '#0BA4DB' : '#E4E4EA',
        }}
    >
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: selected ? '#0BA4DB' : '#F3F3F6', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color={selected ? '#fff' : '#878787'} />
        </View>
        <View style={{ flex: 1 }}>
            <Text className="paragraph-bold text-dark-100">{title}</Text>
            <Text className="body-regular text-gray-200">{body}</Text>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? '#0BA4DB' : '#C4C4CC', alignItems: 'center', justifyContent: 'center' }}>
            {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0BA4DB' }} />}
        </View>
    </TouchableOpacity>
);

export default function Checkout() {
    const { user, setUser, isAuthenticated } = useAuthStore();
    const { items, getTotalItems, getTotalPrice, clearCart } = useCartStore();

    const [form, setForm] = useState({
        address: user?.address ?? '',
        landmark: user?.landmark ?? '',
        city: user?.city ?? '',
        state: user?.state ?? '',
        // The rider's number: the delivery phone if set, otherwise the personal phone.
        phone: formatNigerianPhone(user?.delivery_phone || user?.phone),
        note: '',
    });
    const [saveAddress, setSaveAddress] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('paystack');
    const { fee: deliveryFee, ready: feeReady } = useDeliveryFee(items.map((i) => i.id));
    // Christmas giving: a cart with ONLY the Christmas Food Pack isn't delivered to the buyer,
    // so no address, no delivery fee and no pay-on-delivery (the server enforces the same).
    const { data: packs } = useFetch({ fn: getCampaignProducts });
    const packIds = new Set((packs ?? []).map((p) => p.id));
    const givingOnly = packIds.size > 0 && items.length > 0 && items.every((i) => packIds.has(i.id));
    const [handle, setHandle] = useState('');

    if (!isAuthenticated) return <Redirect href="/sign-in" />;
    if (items.length === 0 && !isSubmitting) return <Redirect href="/cart" />;

    const subtotal = getTotalPrice();
    const total = subtotal + deliveryFee;
    const payOnDelivery = !givingOnly && paymentMethod === 'pay_on_delivery';
    // What Paystack charges now (the server works out the real amounts).
    const payNow = payOnDelivery ? deliveryFee : total;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

    const submit = async () => {
        const address = form.address.trim();
        const city = form.city.trim();
        const phone = normalizeNigerianPhone(form.phone);

        if (!givingOnly && (!address || !city || !form.state)) return Alert.alert('Delivery address', 'Please enter your street address, city/area and state.');
        if (!phone) return Alert.alert('Phone number', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');

        const landmark = form.landmark.trim();

        setIsSubmitting(true);
        try {
            // Giving orders: the dedication and optional social handle go in the order note (admin sees it).
            const tag = handle.trim().replace(/^@*/, '');
            const givingNote = [
                form.note.trim() ? `Dedication: ${form.note.trim()}` : '',
                tag ? `Social media: @${tag}` : '',
            ].filter(Boolean).join(' · ');
            const orderId = await placeOrder(givingOnly
                ? { items, address: '', city: '', state: '', phone, note: givingNote || undefined, paymentMethod: 'paystack' }
                : {
                    items,
                    address: landmark ? `${address} (Landmark: ${landmark})` : address,
                    city,
                    state: form.state,
                    phone,
                    note: form.note.trim() || undefined,
                    paymentMethod,
                });

            if (!givingOnly && saveAddress && user) {
                // Best effort: the order is already placed even if this fails.
                try {
                    // Saves to Delivery address only; the personal phone (Personal details) is left alone.
                    setUser(await updateProfile(user.id, {
                        address, city, state: form.state, landmark: landmark || null,
                        delivery_phone: phone === user.phone ? null : phone,
                    }));
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

                    {givingOnly ? (
                        <View className="gap-5 -mt-4">
                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#FDECEC', borderRadius: 20, padding: 16 }}>
                                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#C8102E', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="heart" size={20} color="#fff" />
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text className="paragraph-bold text-dark-100">Christmas giving: no delivery to you</Text>
                                    <Text className="body-regular text-gray-200">
                                        Your pre-order feeds the less privileged: cooked food for the homeless and handicapped, uncooked food for orphans and widows. We give it out the next day. No address or delivery fee needed.
                                    </Text>
                                </View>
                            </View>
                            <CustomInput
                                label="Your phone (for your receipt)"
                                placeholder="0803 123 4567"
                                value={form.phone}
                                onChangeText={set('phone')}
                                keyboardType="phone-pad"
                            />
                            <CustomInput
                                label="Dedication (optional)"
                                placeholder="e.g. In memory of Mama, or from the Okafor family"
                                value={form.note}
                                onChangeText={set('note')}
                                autoCapitalize="sentences"
                                multiline
                            />
                            <View style={{ gap: 6 }}>
                                <CustomInput
                                    label="Your social media handle (optional)"
                                    placeholder="e.g. @ada.okafor on Instagram, X or TikTok"
                                    value={handle}
                                    onChangeText={setHandle}
                                    autoCapitalize="none"
                                />
                                <Text className="body-regular text-gray-200">So we can tag and thank you when we share photos from the giving.</Text>
                            </View>
                        </View>
                    ) : (
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
                            label="Landmark (optional)"
                            placeholder="e.g. Opposite Mega Plaza"
                            value={form.landmark}
                            onChangeText={set('landmark')}
                            autoCapitalize="sentences"
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
                            label="Phone for the rider"
                            placeholder="0803 123 4567"
                            value={form.phone}
                            onChangeText={set('phone')}
                            keyboardType="phone-pad"
                        />
                        <CustomInput
                            label="Note for the rider (optional)"
                            placeholder="Gate code, best time to call, etc."
                            value={form.note}
                            onChangeText={set('note')}
                            autoCapitalize="sentences"
                            multiline
                        />

                        <TouchableOpacity className="flex-row items-center gap-3" onPress={() => setSaveAddress((v) => !v)}>
                            <View className={cn("size-5 rounded border-2 flex-center", saveAddress ? "bg-primary border-primary" : "border-gray-200")}>
                                {saveAddress && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <Text className="paragraph-medium text-dark-100">Save as my default address</Text>
                        </TouchableOpacity>
                    </View>
                    )}

                    {/* Pay everything now, or pay the delivery fee now and the items to the rider.
                        Online payments go through Paystack: card, bank transfer or USSD. */}
                    <View className="gap-3">
                        <Text className="h3-bold text-dark-100">Payment</Text>
                        <PaymentOption
                            icon="shield-checkmark"
                            title="Pay everything now"
                            body={`Pay ${feeReady ? formatNaira(total) : 'the full amount'} with Paystack: card, bank transfer or USSD.`}
                            selected={!payOnDelivery}
                            onPress={() => setPaymentMethod('paystack')}
                        />
                        {!givingOnly && <PaymentOption
                            icon="bicycle"
                            title="Pay on delivery"
                            body={feeReady
                                ? `Pay ${formatNaira(deliveryFee)} delivery now with Paystack, then ${formatNaira(subtotal)} to the rider (cash or transfer).`
                                : `Pay the delivery fee now with Paystack, then ${formatNaira(subtotal)} to the rider (cash or transfer).`}
                            selected={payOnDelivery}
                            onPress={() => setPaymentMethod('pay_on_delivery')}
                        />}
                        <Text className="body-regular text-gray-200">Your order is confirmed as soon as the online payment goes through.</Text>
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
                        <PaymentInfoStripe label={`Subtotal (${getTotalItems()} item${getTotalItems() === 1 ? '' : 's'})`} value={formatNaira(subtotal)} />
                        <PaymentInfoStripe label="Delivery fee" value={givingOnly ? 'Free' : feeReady ? formatNaira(deliveryFee) : '…'} />
                        {feeReady && deliveryFee > DELIVERY_FEE && (
                            <Text className="body-regular text-gray-200">{formatNaira(deliveryFee)} delivery for orders with groceries or Local Market items.</Text>
                        )}
                        <View className="border-t border-gray-300 my-2" />
                        <PaymentInfoStripe
                            label="Total"
                            value={feeReady ? formatNaira(total) : '…'}
                            labelStyle="base-bold !text-dark-100"
                            valueStyle="base-bold !text-dark-100"
                        />
                        {payOnDelivery && (
                            <>
                                <PaymentInfoStripe label="Pay now (delivery)" value={feeReady ? formatNaira(deliveryFee) : '…'} />
                                <PaymentInfoStripe label="Pay the rider on delivery" value={formatNaira(subtotal)} />
                            </>
                        )}
                    </View>

                    <CustomButton
                        title={feeReady ? `Pay ${formatNaira(payNow)} now with Paystack` : 'Pay now with Paystack'}
                        isLoading={isSubmitting}
                        onPress={submit}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
