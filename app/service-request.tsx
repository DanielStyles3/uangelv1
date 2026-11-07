import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import cn from "clsx";

import CustomHeader from "@/components/CustomHeader";
import CustomInput from "@/components/CustomInput";
import CustomButton from "@/components/CustomButton";
import StatePicker from "@/components/StatePicker";
import { images } from "@/constants";
import { createServiceRequest, getCategory, getSubcategories } from "@/lib/api";
import { formatNaira, formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";

/** "25/12/2026" -> "2026-12-25" if it's a real date that isn't in the past, else null. */
const parseEventDate = (input: string): string | null => {
    const match = input.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!match) return null;
    const [, d, m, y] = match.map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');

/**
 * Request form for service categories (Catering, Events & Celebrations): there are no
 * products to buy, so the customer describes the event and budget and we follow up.
 */
export default function ServiceRequestScreen() {
    const { categoryId, subcategoryId } = useLocalSearchParams<{ categoryId: string; subcategoryId?: string }>();
    const { user, isAuthenticated } = useAuthStore();

    const { data: category } = useFetch({ fn: getCategory, params: { id: categoryId ?? '' }, skip: !categoryId });
    const { data: eventTypes } = useFetch({ fn: getSubcategories, params: { parentId: categoryId ?? '' }, skip: !categoryId });

    const [eventTypeId, setEventTypeId] = useState<string | undefined>(subcategoryId);
    const [form, setForm] = useState({
        fullName: user?.name ?? '',
        phone: formatNigerianPhone(user?.phone),
        email: user?.email ?? '',
        eventDate: '',
        guests: '',
        budget: '',
        address: user?.address ?? '',
        city: user?.city ?? '',
        state: user?.state ?? '',
        details: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!isAuthenticated) return <Redirect href="/sign-in" />;

    const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
    const eventType = eventTypes?.find((t) => t.id === eventTypeId);
    const budgetValue = Number(digitsOnly(form.budget) || 0);

    const submit = async () => {
        if (!category) return;
        if (!eventType) return Alert.alert('Event type', 'Please choose what kind of event this is.');
        if (!form.fullName.trim()) return Alert.alert('Name', 'Please enter your full name.');

        const phone = normalizeNigerianPhone(form.phone);
        if (!phone) return Alert.alert('Phone number', 'Please enter a valid Nigerian phone number, e.g. 0803 123 4567.');

        const eventDate = parseEventDate(form.eventDate);
        if (!eventDate) return Alert.alert('Event date', 'Please enter the event date as DD/MM/YYYY (today or later).');

        const guests = Number(digitsOnly(form.guests));
        if (!guests || guests < 1) return Alert.alert('Guests', 'Please enter the number of guests.');

        if (!budgetValue) return Alert.alert('Budget', 'Please enter your budget in naira.');

        if (!form.address.trim() || !form.city.trim() || !form.state) {
            return Alert.alert('Event location', 'Please enter the event address, city/area and state.');
        }

        setIsSubmitting(true);
        try {
            await createServiceRequest({
                category_id: category.id,
                subcategory_id: eventType.id,
                service: category.name,
                event_type: eventType.name,
                full_name: form.fullName.trim(),
                phone,
                email: form.email.trim() || null,
                event_date: eventDate,
                guest_count: guests,
                budget: budgetValue,
                address: form.address.trim(),
                city: form.city.trim(),
                state: form.state,
                details: form.details.trim() || null,
            });
            setSubmitted(true);
        } catch (e: any) {
            Alert.alert('Could not send request', e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView className="flex-1 bg-white px-5">
                <View className="flex-1 flex-center gap-4">
                    <Image source={images.success} className="size-40" resizeMode="contain" />
                    <Text className="h3-bold text-dark-100 text-center">Request sent!</Text>
                    <Text className="paragraph-medium text-gray-200 text-center">
                        Thank you{form.fullName ? `, ${form.fullName.trim().split(' ')[0]}` : ''}. Our team will call you on{' '}
                        {formatNigerianPhone(form.phone)} to discuss your {eventType?.name.toLowerCase()} and send a quote.
                    </Text>
                    <View className="w-full gap-3 mt-4">
                        <CustomButton title="View my requests" onPress={() => router.replace('/requests')} />
                        <CustomButton
                            title="Back to home"
                            onPress={() => router.replace('/')}
                            style="!bg-white border border-primary"
                            textStyle="!text-primary"
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView className="flex-1" behavior="padding">
                <ScrollView contentContainerClassName="px-5 pt-5 pb-16 gap-6" keyboardShouldPersistTaps="handled">
                    <CustomHeader title={category ? `${category.name} request` : 'Request a quote'} showSearch={false} />

                    <Text className="paragraph-medium text-gray-200 -mt-8">
                        Tell us about your event and budget. We&apos;ll get back to you with a quote, usually within 24 hours.
                    </Text>

                    <View className="gap-3">
                        <Text className="h3-bold text-dark-100">Event type</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {(eventTypes ?? []).map((t) => {
                                const selected = t.id === eventTypeId;
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        onPress={() => setEventTypeId(t.id)}
                                        className={cn("px-4 py-2.5 rounded-full border", selected ? "bg-primary border-primary" : "bg-white border-gray-200")}
                                    >
                                        <Text className={cn("body-medium", selected ? "text-white" : "text-dark-100")}>
                                            {t.emoji ? `${t.emoji} ` : ''}{t.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View className="gap-6">
                        <Text className="h3-bold text-dark-100">Your details</Text>
                        <CustomInput label="Full name" placeholder="Your name" value={form.fullName} onChangeText={set('fullName')} autoCapitalize="words" />
                        <CustomInput label="Phone number" placeholder="0803 123 4567" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
                        <CustomInput label="Email (optional)" placeholder="you@example.com" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
                    </View>

                    <View className="gap-6">
                        <Text className="h3-bold text-dark-100">Event details</Text>
                        <CustomInput label="Event date" placeholder="DD/MM/YYYY" value={form.eventDate} onChangeText={set('eventDate')} keyboardType="numeric" />
                        <CustomInput label="Number of guests" placeholder="e.g. 150" value={form.guests} onChangeText={(v) => set('guests')(digitsOnly(v))} keyboardType="numeric" />
                        <View>
                            <CustomInput label="Budget (₦)" placeholder="e.g. 1500000" value={form.budget} onChangeText={(v) => set('budget')(digitsOnly(v))} keyboardType="numeric" />
                            {budgetValue > 0 && <Text className="body-medium text-primary pl-2 mt-1">{formatNaira(budgetValue)}</Text>}
                        </View>
                    </View>

                    <View className="gap-6">
                        <Text className="h3-bold text-dark-100">Event location</Text>
                        <CustomInput label="Venue / street address" placeholder="e.g. 12 Admiralty Way" value={form.address} onChangeText={set('address')} autoCapitalize="words" />
                        <CustomInput label="City / Area" placeholder="e.g. Lekki" value={form.city} onChangeText={set('city')} autoCapitalize="words" />
                        <StatePicker value={form.state} onChange={set('state')} />
                    </View>

                    <CustomInput
                        label="Anything else? (optional)"
                        placeholder="Theme, menu ideas, indoor/outdoor, time of day…"
                        value={form.details}
                        onChangeText={set('details')}
                        autoCapitalize="sentences"
                        multiline
                    />

                    <CustomButton title="Send request" isLoading={isSubmitting} onPress={submit} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
