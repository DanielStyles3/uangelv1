import { useState } from "react";
import { KeyboardAvoidingView, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import EventCalendar, { toISODate } from "@/components/EventCalendar";
import ProductImage from "@/components/ProductImage";
import StatePicker from "@/components/StatePicker";
import { supportWhatsApp } from "@/constants";
import { getAppConfig } from "@/lib/appConfig";
import { createServiceRequest, getCategory, getMenuItem } from "@/lib/api";
import { formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import { notify } from "@/lib/notice";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";

type IconName = keyof typeof Ionicons.glyphMap;

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";
const LINE = "#E8E8EE";
const BG = "#F6F6F8";
// Quick picks from Admin › App settings.
const guestsList = () => getAppConfig().lists.cakeGuests;
const tiersList = () => getAppConfig().lists.cakeTiers;
const digitsOnly = (s: string) => s.replace(/[^\d]/g, "");

/**
 * Wedding cake enquiry (made to order, no online payment): date, guests, tiers, design ideas,
 * delivery area and contact. Saved as a request (Admin › Requests, the customer's My requests);
 * the design and invoice are agreed on WhatsApp and paid by bank transfer.
 * Opened with ?productId= (the cake they liked).
 */
export default function CakeEnquiry() {
    const { productId } = useLocalSearchParams<{ productId?: string }>();
    const { user, isAuthenticated } = useAuthStore();
    const insets = useSafeAreaInsets();

    const { data: product } = useFetch({ fn: getMenuItem, params: { id: productId ?? "" }, skip: !productId });
    const subId = product?.category_id ?? "";
    const { data: sub } = useFetch({ fn: getCategory, params: { id: subId }, skip: !subId });

    const [date, setDate] = useState<Date | null>(null);
    const [guests, setGuests] = useState("");
    const [tiers, setTiers] = useState("Not sure");
    const [budget, setBudget] = useState("");
    const [ideas, setIdeas] = useState("");
    const [area, setArea] = useState(user?.address ?? "");
    const [city, setCity] = useState(user?.city ?? "");
    const [state, setState] = useState(user?.state ?? "Lagos");
    const [name, setName] = useState(user?.name ?? "");
    const [phone, setPhone] = useState(formatNigerianPhone(user?.phone));
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    if (!isAuthenticated) return <Redirect href="/sign-in" />;

    const tap = () => Haptics.selectionAsync().catch(() => {});
    const guestCount = Number(digitsOnly(guests)) || 0;
    const budgetNum = Number(digitsOnly(budget)) || 0;
    const cakeName = product?.name ?? "Wedding cake";
    const whatsapp = () =>
        Linking.openURL(`https://wa.me/${supportWhatsApp()}?text=${encodeURIComponent(
            `Hello U Angel Foods, I just sent a wedding cake enquiry (${cakeName}${date ? `, for ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}). Can we talk about the design?`,
        )}`).catch(() => {});

    const send = async () => {
        const tel = normalizeNigerianPhone(phone);
        const missing = !date ? "Please pick the date you need the cake."
            : !guestCount ? "About how many guests will the cake serve?"
            : !city.trim() || !state ? "Please tell us where to deliver (area, city and state)."
            : !name.trim() ? "Please enter your name."
            : !tel ? "Please enter a valid Nigerian phone number, e.g. 0803 123 4567."
            : null;
        if (missing) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            return notify("A few details missing", missing);
        }
        setBusy(true);
        try {
            await createServiceRequest({
                category_id: sub?.parent_id ?? sub?.id ?? null,
                subcategory_id: sub?.id ?? null,
                service: "Cakes",
                event_type: `Wedding cake: ${cakeName}`,
                full_name: name.trim(),
                phone: tel!,
                email: user?.email ?? null,
                event_date: toISODate(date!),
                end_date: null,
                guest_count: guestCount,
                budget: budgetNum,
                address: area.trim() || city.trim(),
                city: city.trim(),
                state,
                details: [
                    `Cake: ${cakeName}`,
                    `Tiers: ${tiers}`,
                    budgetNum ? null : "Budget: not given",
                    ideas.trim() ? `Design ideas: ${ideas.trim()}` : null,
                ].filter(Boolean).join("\n"),
                event_time: null,
                venue_type: null,
                needs: ["Cake"],
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setSent(true);
        } catch (e: any) {
            notify("Couldn’t send your enquiry", e.message);
        } finally {
            setBusy(false);
        }
    };

    /* ---------------- Sent ---------------- */
    if (sent) {
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: BG }]}>
                <ScrollView contentContainerStyle={styles.done}>
                    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneBadge}>
                        <Ionicons name="checkmark" size={46} color="#fff" />
                    </Animated.View>
                    <Animated.View entering={FadeInDown.delay(150)} style={{ alignItems: "center", gap: 6 }}>
                        <Text style={styles.doneTitle}>Enquiry sent!</Text>
                        <Text style={styles.doneText}>Thank you{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}. We’ll message you on WhatsApp to design your cake together.</Text>
                    </Animated.View>
                    <Animated.View entering={FadeInDown.delay(260)} style={styles.card}>
                        <Text style={styles.eyebrow}>WHAT HAPPENS NEXT</Text>
                        {([
                            ["logo-whatsapp", "We design it with you", `On WhatsApp (${formatNigerianPhone(phone)}), until it’s exactly what you want`],
                            ["receipt", "You get an invoice", "Pay by bank transfer"],
                            ["checkmark-done", "We confirm and start baking", "Your receipt comes on WhatsApp"],
                        ] as [IconName, string, string][]).map(([icon, t, s], i, all) => (
                            <View key={t} style={styles.tlRow}>
                                <View style={{ alignItems: "center" }}>
                                    <View style={styles.tlIcon}><Ionicons name={icon} size={16} color={ORANGE} /></View>
                                    {i < all.length - 1 && <View style={styles.tlLine} />}
                                </View>
                                <View style={{ flex: 1, paddingBottom: i < all.length - 1 ? 14 : 0 }}>
                                    <Text style={styles.tlTitle}>{t}</Text>
                                    <Text style={styles.tlText}>{s}</Text>
                                </View>
                            </View>
                        ))}
                    </Animated.View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#1FA855" }]} onPress={whatsapp}>
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={[styles.btnText, { color: "#fff" }]}>Chat with us now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#fff", borderWidth: 1, borderColor: LINE }]} onPress={() => router.replace("/requests")}>
                        <Text style={styles.btnText}>View my requests</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    /* ---------------- Form ---------------- */
    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <View style={styles.head}>
                    <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={20} color={INK} />
                    </TouchableOpacity>
                    <Text style={styles.headTitle}>Wedding cake enquiry</Text>
                </View>

                <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* The cake they liked */}
                    <View style={styles.cake}>
                        <View style={styles.cakeImg}>
                            {product ? <ProductImage imageUrl={product.image_url} className="size-full" resizeMode="cover" /> : null}
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.eyebrow}>INSPIRED BY</Text>
                            <Text style={styles.cakeName} numberOfLines={2}>{cakeName}</Text>
                            <Text style={styles.cakeSub}>We’ll design yours with you on WhatsApp.</Text>
                        </View>
                    </View>

                    <Field title="When do you need it?">
                        <EventCalendar start={date} onChange={(s) => setDate(s)} emptyText="Pick the wedding date" />
                    </Field>

                    <Field title="How many guests should it serve?">
                        <View style={styles.chips}>
                            {guestsList().map((n) => (
                                <TouchableOpacity key={n} style={[styles.chip, guestCount === n && styles.chipOn]} onPress={() => { tap(); setGuests(String(n)); }}>
                                    <Text style={[styles.chipText, guestCount === n && { color: ORANGE }]}>{n}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Input icon="people-outline" value={guests} onChangeText={(v) => setGuests(digitsOnly(v))} keyboardType="numeric" placeholder="Or type a number, e.g. 250" />
                    </Field>

                    <Field title="Tiers">
                        <View style={styles.chips}>
                            {tiersList().map((t) => (
                                <TouchableOpacity key={t} style={[styles.chip, tiers === t && styles.chipOn]} onPress={() => { tap(); setTiers(t); }}>
                                    <Text style={[styles.chipText, tiers === t && { color: ORANGE }]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Field>

                    <Field title="Design ideas" hint="Colours, flavours, theme, flowers… You can also send photos on WhatsApp.">
                        <TextInput
                            value={ideas}
                            onChangeText={setIdeas}
                            multiline
                            maxLength={1000}
                            textAlignVertical="top"
                            placeholder="e.g. White and gold, 3 tiers, vanilla and red velvet, fresh roses on top"
                            placeholderTextColor="#A0A0AB"
                            style={styles.area}
                        />
                    </Field>

                    <Field title="Budget (optional)">
                        <View style={styles.budgetBox}>
                            <Text style={styles.naira}>₦</Text>
                            <TextInput style={styles.budgetInput} value={budgetNum ? budgetNum.toLocaleString("en-NG") : ""} onChangeText={(v) => setBudget(digitsOnly(v))}
                                keyboardType="numeric" placeholder="250,000" placeholderTextColor="#C4C4CC" accessibilityLabel="Budget in naira" />
                        </View>
                    </Field>

                    <Field title="Where should we deliver?">
                        <Input icon="location-outline" value={area} onChangeText={setArea} autoCapitalize="words" placeholder="Venue or address (optional for now)" />
                        <Input icon="map-outline" value={city} onChangeText={setCity} autoCapitalize="words" placeholder="City / area, e.g. Lekki" />
                        <StatePicker value={state} onChange={setState} />
                    </Field>

                    <Field title="Your details">
                        <Input icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your full name" />
                        <Input icon="logo-whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="WhatsApp number, e.g. 0803 123 4567" />
                    </Field>

                    <View style={styles.payNote}>
                        <Ionicons name="information-circle" size={18} color="#B45309" />
                        <Text style={styles.payNoteText}>No payment now. Once we agree the design, we send an invoice on WhatsApp and you pay by bank transfer.</Text>
                    </View>
                </ScrollView>

                <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                    <TouchableOpacity style={styles.waRound} onPress={whatsapp} accessibilityLabel="Chat with us on WhatsApp">
                        <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.go, busy && { opacity: 0.7 }]} onPress={send} disabled={busy} activeOpacity={0.9}>
                        <Ionicons name="paper-plane" size={18} color="#fff" />
                        <Text style={styles.goText}>{busy ? "Sending…" : "Send enquiry"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const Field = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <View style={{ gap: 10 }}>
        <View style={{ gap: 2 }}>
            <Text style={styles.label}>{title}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {children}
    </View>
);

const Input = ({ icon, ...props }: { icon: IconName } & React.ComponentProps<typeof TextInput>) => (
    <View style={styles.inputBox}>
        <Ionicons name={icon} size={18} color="#9A9AA3" />
        <TextInput placeholderTextColor="#A0A0AB" {...props} style={styles.inputText} />
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    back: { width: 38, height: 38, borderRadius: 19, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
    headTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: INK },
    body: { paddingHorizontal: 16, gap: 22 },

    cake: { flexDirection: "row", gap: 14, alignItems: "center", padding: 12, borderRadius: 22, backgroundColor: "#FFF8F4", borderWidth: 1, borderColor: "#FFE1D3" },
    cakeImg: { width: 78, height: 78, borderRadius: 16, overflow: "hidden", backgroundColor: "#FFE8DD" },
    cakeName: { fontFamily: "Quicksand-Bold", fontSize: 16, lineHeight: 21, color: INK },
    cakeSub: { fontFamily: "Quicksand-Medium", fontSize: 12.5, color: GREY },
    eyebrow: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.2, color: GREY },

    label: { fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    hint: { fontFamily: "Quicksand-Medium", fontSize: 13, color: GREY },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    chipOn: { borderColor: ORANGE, backgroundColor: "#FFF4EE" },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },
    area: { minHeight: 120, borderWidth: 1.5, borderColor: LINE, borderRadius: 18, padding: 14, fontFamily: "Quicksand-Medium", fontSize: 15, lineHeight: 21, color: INK, backgroundColor: "#FAFAFB" },
    inputBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: LINE, borderRadius: 16, paddingHorizontal: 14, backgroundColor: "#fff", minHeight: 52 },
    inputText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 15, color: INK, paddingVertical: 12 },
    budgetBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: LINE, borderRadius: 18, paddingHorizontal: 16, backgroundColor: "#fff" },
    naira: { fontFamily: "Quicksand-Bold", fontSize: 22, color: ORANGE },
    budgetInput: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 22, color: INK, paddingVertical: 12 },
    payNote: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 16, backgroundColor: "#FFF7E6" },
    payNoteText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, lineHeight: 18, color: "#92400E" },

    foot: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "#fff" },
    waRound: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1FA855", alignItems: "center", justifyContent: "center" },
    go: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 56, borderRadius: 999, backgroundColor: ORANGE },
    goText: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#fff" },

    done: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    doneBadge: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#2F9B65", alignItems: "center", justifyContent: "center" },
    doneTitle: { fontFamily: "Quicksand-Bold", fontSize: 26, color: INK },
    doneText: { fontFamily: "Quicksand-Medium", fontSize: 15, lineHeight: 21, color: GREY, textAlign: "center" },
    card: { alignSelf: "stretch", backgroundColor: "#fff", borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: LINE },
    tlRow: { flexDirection: "row", gap: 12 },
    tlIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    tlLine: { flex: 1, width: 2, backgroundColor: "#FFD9C8", marginTop: 4 },
    tlTitle: { fontFamily: "Quicksand-Bold", fontSize: 14.5, color: INK },
    tlText: { fontFamily: "Quicksand-Medium", fontSize: 13, color: GREY, marginTop: 1 },
    btn: { alignSelf: "stretch", flexDirection: "row", gap: 8, justifyContent: "center", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    btnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
});
