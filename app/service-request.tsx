import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import StatePicker from "@/components/StatePicker";
import { images } from "@/constants";
import { createServiceRequest, getCategory, getSubcategories } from "@/lib/api";
import { formatNaira, formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";

const ORANGE = "#FD652A";
const INK = "#181C2E";
const PURPLE = "#6B21A8";
const CUSTOM = "Customised event";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NEEDS: [string, string][] = [["🍲", "Food"], ["🥤", "Drinks"], ["🎂", "Cake"], ["🎈", "Decor"], ["🪑", "Chairs & canopies"], ["🧑‍🍳", "Waiters"], ["🎤", "MC / DJ"], ["🍢", "Food stands"]];
const TIMES = ["Morning", "Afternoon", "Evening"];
const PLACES = ["Indoor", "Outdoor", "Not sure yet"];
const STEP_TITLES = ["Your event", "Guests & budget", "Where is it?", "Your details"];

const digitsOnly = (s: string) => s.replace(/[^\d]/g, "");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Month calendar; past days can't be picked. */
function Calendar({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
    const today = startOfDay(new Date());
    const [view, setView] = useState(() => { const b = value ?? today; return new Date(b.getFullYear(), b.getMonth(), 1); });
    const first = (view.getDay() + 6) % 7; // Monday first
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);

    return (
        <View style={styles.cal}>
            <View style={styles.calHead}>
                <TouchableOpacity style={[styles.calNav, !canPrev && { opacity: 0.3 }]} disabled={!canPrev}
                    onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} accessibilityLabel="Previous month">
                    <Ionicons name="chevron-back" size={16} color={INK} />
                </TouchableOpacity>
                <Text style={styles.calTitle}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
                <TouchableOpacity style={styles.calNav} onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} accessibilityLabel="Next month">
                    <Ionicons name="chevron-forward" size={16} color={INK} />
                </TouchableOpacity>
            </View>
            <View style={styles.calRow}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <Text key={i} style={styles.calDow}>{d}</Text>)}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
                <View key={r} style={styles.calRow}>
                    {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                        if (!d) return <View key={i} style={styles.calCell} />;
                        const date = new Date(view.getFullYear(), view.getMonth(), d);
                        const past = date < today;
                        const sel = !!value && value.getTime() === date.getTime();
                        return (
                            <TouchableOpacity key={i} style={[styles.calCell, sel && styles.calSel]} disabled={past}
                                onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(date); }}
                                accessibilityLabel={date.toDateString()} accessibilityState={{ selected: sel, disabled: past }}>
                                <Text style={[styles.calDay, past && { color: "#CFCFD6" }, sel && { color: "#fff" }]}>{d}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
            <Text style={styles.calNote}>
                {value ? value.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Pick the date of your event."}
            </Text>
        </View>
    );
}

const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}>
        <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={{ gap: 8 }}>
        <Text style={styles.label}>{label}</Text>
        {children}
    </View>
);

/**
 * Catering / event request in 4 steps: event → guests & budget → venue → details & review.
 * Opened with categoryId (Catering, or Catering › Events) and optionally subcategoryId (the chosen type).
 */
export default function ServiceRequestScreen() {
    const { categoryId, subcategoryId } = useLocalSearchParams<{ categoryId: string; subcategoryId?: string }>();
    const { user, isAuthenticated } = useAuthStore();

    const { data: category } = useFetch({ fn: getCategory, params: { id: categoryId ?? "" }, skip: !categoryId });
    const { data: eventTypes } = useFetch({ fn: getSubcategories, params: { parentId: categoryId ?? "" }, skip: !categoryId });

    const [typeId, setTypeId] = useState<string | undefined>(subcategoryId);
    const [optionId, setOptionId] = useState<string | undefined>();
    // Options under the chosen type (Catering › Events › Wedding Parties…).
    const { data: options } = useFetch({ fn: getSubcategories, params: { parentId: typeId ?? "" }, skip: !typeId });

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        customName: "",
        date: null as Date | null,
        time: "Afternoon",
        guests: "",
        budget: "",
        needs: ["Food", "Drinks"] as string[],
        address: user?.address ?? "",
        city: user?.city ?? "",
        state: user?.state ?? "",
        place: "Indoor",
        fullName: user?.name ?? "",
        phone: formatNigerianPhone(user?.phone),
        email: user?.email ?? "",
        details: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const chosenType = eventTypes?.find((t) => t.id === typeId);
    const hasOptions = !!chosenType?.child_count && (options?.length ?? 0) > 0;
    const option = hasOptions ? options?.find((o) => o.id === optionId) : undefined;
    const picked = hasOptions ? option : chosenType;            // the most specific choice
    const isCustom = picked?.name === CUSTOM;
    const eventName = isCustom ? (form.customName.trim() || CUSTOM) : (picked?.name ?? "");
    const guests = Number(digitsOnly(form.guests)) || 0;
    const budget = Number(digitsOnly(form.budget)) || 0;

    // Cheap checks, so no memo needed (the React Compiler couldn't preserve one here).
    const valid = [
        !!picked && (!isCustom || !!form.customName.trim()) && !!form.date,
        guests > 0 && budget > 0,
        !!form.address.trim() && !!form.city.trim() && !!form.state,
        !!form.fullName.trim() && !!normalizeNigerianPhone(form.phone),
    ];

    if (!isAuthenticated) return <Redirect href="/sign-in" />;

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
    const toggleNeed = (n: string) => {
        Haptics.selectionAsync().catch(() => {});
        set("needs", form.needs.includes(n) ? form.needs.filter((x) => x !== n) : [...form.needs, n]);
    };

    const explainMissing = () => {
        const msg = [
            !picked ? "Please choose your type of event." : isCustom && !form.customName.trim() ? "Please tell us what you’re celebrating." : "Please pick the date of your event.",
            !guests ? "Please enter the number of guests." : "Please enter your budget in naira.",
            "Please enter the venue address, city/area and state.",
            !form.fullName.trim() ? "Please enter your full name." : "Please enter a valid Nigerian phone number, e.g. 0803 123 4567.",
        ][step];
        Alert.alert(STEP_TITLES[step], msg);
    };

    const next = () => {
        if (!valid[step]) return explainMissing();
        Haptics.selectionAsync().catch(() => {});
        if (step < 3) setStep(step + 1); else submit();
    };

    const submit = async () => {
        if (!category || !picked || !form.date) return;
        const phone = normalizeNigerianPhone(form.phone);
        if (!phone) return Alert.alert("Phone number", "Please enter a valid Nigerian phone number, e.g. 0803 123 4567.");
        setIsSubmitting(true);
        try {
            // Service = the top-level service (Catering), even when the request starts under Catering › Events.
            const service = category.parent_id ? "Catering" : category.name;
            await createServiceRequest({
                category_id: category.parent_id ?? category.id,
                subcategory_id: picked.id,
                service,
                event_type: eventName,
                full_name: form.fullName.trim(),
                phone,
                email: form.email.trim() || null,
                event_date: toISODate(form.date),
                guest_count: guests,
                budget,
                address: form.address.trim(),
                city: form.city.trim(),
                state: form.state,
                details: form.details.trim() || null,
                event_time: form.time,
                venue_type: form.place,
                needs: form.needs,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setSubmitted(true);
        } catch (e: any) {
            Alert.alert("Could not send request", e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.screen}>
                <ScrollView contentContainerStyle={styles.done}>
                    <Image source={images.success} style={{ width: 140, height: 140 }} resizeMode="contain" />
                    <Text style={styles.doneTitle}>Request sent!</Text>
                    <Text style={styles.doneText}>
                        Thank you{form.fullName ? `, ${form.fullName.trim().split(" ")[0]}` : ""}. Here’s what happens next for your {eventName.toLowerCase()}:
                    </Text>
                    <View style={styles.timeline}>
                        {[
                            ["We call you within 24 hours", `on ${formatNigerianPhone(form.phone)}.`],
                            ["You get a quote", "on WhatsApp, with menu options."],
                            ["Confirm", "and we handle the rest on the day."],
                        ].map(([b, t], i) => (
                            <View key={b} style={styles.tlRow}>
                                <View style={styles.tlNum}><Text style={styles.tlNumText}>{i + 1}</Text></View>
                                <Text style={styles.tlText}><Text style={{ fontFamily: "Quicksand-Bold" }}>{b}</Text> {t}</Text>
                            </View>
                        ))}
                    </View>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: ORANGE }]} onPress={() => router.replace("/requests")}>
                        <Text style={[styles.btnText, { color: "#fff" }]}>View my requests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#F5F5F7" }]} onPress={() => router.replace("/")}>
                        <Text style={styles.btnText}>Back to home</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    const typeChips = (eventTypes ?? []).map((t) => (
        <Chip key={t.id} label={`${t.emoji ? `${t.emoji} ` : ""}${t.name}`} on={t.id === typeId}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setTypeId(t.id); setOptionId(undefined); }} />
    ));

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                {/* Header + progress */}
                <View style={styles.head}>
                    <TouchableOpacity style={styles.back} onPress={() => (step ? setStep(step - 1) : router.back())} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={20} color={INK} />
                    </TouchableOpacity>
                    <Text style={styles.headTitle} numberOfLines={1}>{eventName ? `${eventName} request` : category ? `${category.name} request` : "Request a quote"}</Text>
                </View>
                <View style={styles.prog}>
                    {[0, 1, 2, 3].map((i) => <View key={i} style={[styles.progBar, i <= step && { backgroundColor: ORANGE }]} />)}
                </View>
                <Text style={styles.stepLabel}>Step <Text style={{ color: INK }}>{step + 1}</Text> of 4 · {STEP_TITLES[step]}</Text>

                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    {step === 0 && (
                        <>
                            <View>
                                <Text style={styles.q}>What are you planning?</Text>
                                <Text style={styles.qSub}>Pick one, then choose the date.</Text>
                            </View>
                            <View style={styles.chips}>{typeChips}</View>
                            {hasOptions && (
                                <Field label={`Which kind of ${chosenType!.name.toLowerCase()}?`}>
                                    <View style={styles.chips}>
                                        {options!.map((o) => (
                                            <Chip key={o.id} label={`${o.emoji ? `${o.emoji} ` : ""}${o.name}`} on={o.id === optionId}
                                                onPress={() => { Haptics.selectionAsync().catch(() => {}); setOptionId(o.id); }} />
                                        ))}
                                    </View>
                                </Field>
                            )}
                            {isCustom && (
                                <View style={styles.customBox}>
                                    <Text style={styles.customTitle}>Tell us about your event</Text>
                                    <TextInput style={styles.input} value={form.customName} onChangeText={(v) => set("customName", v)} maxLength={60}
                                        placeholder="e.g. Naming ceremony, graduation party" placeholderTextColor="#A0A0AB" accessibilityLabel="What are you celebrating?" />
                                </View>
                            )}
                            <Field label="Date"><Calendar value={form.date} onChange={(d) => set("date", d)} /></Field>
                            <Field label="Time of day">
                                <View style={styles.chips}>{TIMES.map((t) => <Chip key={t} label={t} on={form.time === t} onPress={() => set("time", t)} />)}</View>
                            </Field>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <View>
                                <Text style={styles.q}>How many guests, and your budget?</Text>
                                <Text style={styles.qSub}>An estimate is fine. We’ll confirm on the call.</Text>
                            </View>
                            <Field label="Guests">
                                <View style={styles.stepper}>
                                    <TouchableOpacity style={styles.stepBtn} onPress={() => set("guests", String(Math.max(1, guests - 10)))} accessibilityLabel="10 fewer guests">
                                        <Ionicons name="remove" size={20} color={INK} />
                                    </TouchableOpacity>
                                    <TextInput style={[styles.input, styles.stepInput]} value={form.guests} onChangeText={(v) => set("guests", digitsOnly(v))}
                                        keyboardType="numeric" placeholder="0" placeholderTextColor="#A0A0AB" accessibilityLabel="Number of guests" />
                                    <TouchableOpacity style={styles.stepBtn} onPress={() => set("guests", String(guests + 10))} accessibilityLabel="10 more guests">
                                        <Ionicons name="add" size={20} color={INK} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.chips}>
                                    {[50, 100, 200, 300, 500].map((n) => <Chip key={n} label={String(n)} on={guests === n} onPress={() => set("guests", String(n))} />)}
                                </View>
                            </Field>
                            <Field label="Budget (₦)">
                                <TextInput style={styles.input} value={budget ? budget.toLocaleString("en-NG") : ""} onChangeText={(v) => set("budget", digitsOnly(v))}
                                    keyboardType="numeric" placeholder="e.g. 1,500,000" placeholderTextColor="#A0A0AB" accessibilityLabel="Budget in naira" />
                                {budget > 0 && guests > 0 && (
                                    <Text style={styles.hint}>About {formatNaira(Math.round(budget / guests))} per guest</Text>
                                )}
                            </Field>
                            <Field label="What do you need?">
                                <View style={styles.needs}>
                                    {NEEDS.map(([e, n]) => {
                                        const on = form.needs.includes(n);
                                        return (
                                            <TouchableOpacity key={n} style={[styles.need, on && styles.chipOn]} onPress={() => toggleNeed(n)}
                                                accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                                                <Text style={{ fontSize: 16 }}>{e}</Text>
                                                <Text style={styles.chipText} numberOfLines={1}>{n}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </Field>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <View>
                                <Text style={styles.q}>Where is the event?</Text>
                                <Text style={styles.qSub}>So we can plan delivery and set-up.</Text>
                            </View>
                            <Field label="Venue / street address">
                                <TextInput style={styles.input} value={form.address} onChangeText={(v) => set("address", v)} autoCapitalize="words"
                                    placeholder="e.g. Eko Hotel, Victoria Island" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <Field label="City / area">
                                <TextInput style={styles.input} value={form.city} onChangeText={(v) => set("city", v)} autoCapitalize="words"
                                    placeholder="e.g. Lekki" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <StatePicker value={form.state} onChange={(v) => set("state", v)} />
                            <Field label="Indoor or outdoor?">
                                <View style={styles.chips}>{PLACES.map((p) => <Chip key={p} label={p} on={form.place === p} onPress={() => set("place", p)} />)}</View>
                            </Field>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <View>
                                <Text style={styles.q}>Almost done</Text>
                                <Text style={styles.qSub}>Check your request, then send it.</Text>
                            </View>
                            <Field label="Your name">
                                <TextInput style={styles.input} value={form.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" placeholder="Your name" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <Field label="Phone (we’ll call you)">
                                <TextInput style={styles.input} value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="0803 123 4567" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <Field label="Email (optional)">
                                <TextInput style={styles.input} value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <Field label="Anything else? (optional)">
                                <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} value={form.details} onChangeText={(v) => set("details", v)}
                                    multiline maxLength={1000} placeholder="Theme, menu ideas, dietary needs…" placeholderTextColor="#A0A0AB" />
                            </Field>
                            <Field label="Your request">
                                <View style={styles.review}>
                                    {([
                                        ["Event", eventName, 0],
                                        ["When", form.date ? `${form.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${form.time.toLowerCase()}` : "—", 0],
                                        ["Guests", String(guests), 1],
                                        ["Budget", formatNaira(budget), 1],
                                        ["Needs", form.needs.join(", ") || "—", 1],
                                        ["Venue", `${[form.address, form.city, form.state].filter(Boolean).join(", ")} · ${form.place.toLowerCase()}`, 2],
                                    ] as [string, string, number][]).map(([k, v, to], i) => (
                                        <View key={k} style={[styles.reviewRow, i > 0 && styles.reviewDivider]}>
                                            <Text style={styles.reviewKey}>{k}</Text>
                                            <Text style={styles.reviewVal}>{v}</Text>
                                            <TouchableOpacity onPress={() => setStep(to)} hitSlop={8} accessibilityLabel={`Edit ${k}`}>
                                                <Text style={styles.edit}>Edit</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </Field>
                        </>
                    )}
                </ScrollView>

                <View style={styles.foot}>
                    {step > 0 && (
                        <TouchableOpacity style={styles.footBack} onPress={() => setStep(step - 1)} accessibilityLabel="Previous step">
                            <Ionicons name="chevron-back" size={20} color={INK} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.footGo, (!valid[step] || isSubmitting) && { backgroundColor: "#C9CAD3" }]} onPress={next} disabled={isSubmitting}>
                        <Text style={styles.footGoText}>{isSubmitting ? "Sending…" : step === 3 ? "Send request" : "Continue"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },
    head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center" },
    headTitle: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    prog: { flexDirection: "row", gap: 6, paddingHorizontal: 16 },
    progBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#ECECF1" },
    stepLabel: { fontFamily: "Quicksand-Bold", fontSize: 12, color: "#878787", paddingHorizontal: 16, paddingTop: 8 },
    body: { padding: 16, paddingBottom: 32, gap: 18 },
    q: { fontFamily: "Quicksand-Bold", fontSize: 21, color: INK },
    qSub: { fontFamily: "Quicksand-Medium", fontSize: 13.5, color: "#878787", marginTop: 4 },
    label: { fontFamily: "Quicksand-Bold", fontSize: 14, color: INK },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderWidth: 1.5, borderColor: "#ECECF1", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
    chipOn: { borderColor: ORANGE, backgroundColor: "#FFF3E6" },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK, flexShrink: 1 },
    input: { borderWidth: 1.5, borderColor: "#ECECF1", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontFamily: "Quicksand-Medium", fontSize: 15, color: INK, backgroundColor: "#fff" },
    customBox: { backgroundColor: "#F2E8FB", borderRadius: 16, padding: 12, gap: 8 },
    customTitle: { fontFamily: "Quicksand-Bold", fontSize: 14, color: PURPLE },
    cal: { borderWidth: 1.5, borderColor: "#ECECF1", borderRadius: 16, padding: 10 },
    calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
    calNav: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center" },
    calTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    calRow: { flexDirection: "row" },
    calDow: { flex: 1, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 11, color: "#878787", paddingBottom: 4 },
    calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
    calSel: { backgroundColor: ORANGE },
    calDay: { fontFamily: "Quicksand-SemiBold", fontSize: 14, color: INK },
    calNote: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: "#878787", marginTop: 6, textAlign: "center" },
    stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: "#ECECF1", alignItems: "center", justifyContent: "center" },
    stepInput: { width: 100, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 18 },
    hint: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: "#16A34A", backgroundColor: "#E8F7EE", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, overflow: "hidden", alignSelf: "flex-start" },
    needs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    need: { width: "48%", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#ECECF1", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10 },
    review: { borderWidth: 1.5, borderColor: "#ECECF1", borderRadius: 16 },
    reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    reviewDivider: { borderTopWidth: 1, borderTopColor: "#ECECF1" },
    reviewKey: { width: 62, fontFamily: "Quicksand-SemiBold", fontSize: 13, color: "#878787" },
    reviewVal: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 13, color: INK },
    edit: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: ORANGE },
    foot: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: "#ECECF1", backgroundColor: "#fff" },
    footBack: { width: 52, borderRadius: 999, backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center" },
    footGo: { flex: 1, borderRadius: 999, backgroundColor: ORANGE, paddingVertical: 15, alignItems: "center" },
    footGoText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff" },
    done: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
    doneTitle: { fontFamily: "Quicksand-Bold", fontSize: 24, color: INK },
    doneText: { fontFamily: "Quicksand-Medium", fontSize: 15, color: "#4B4F63", textAlign: "center" },
    timeline: { alignSelf: "stretch", gap: 10, marginVertical: 6 },
    tlRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    tlNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
    tlNumText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: "#fff" },
    tlText: { flex: 1, fontFamily: "Quicksand-Medium", fontSize: 14, color: INK, lineHeight: 20 },
    btn: { alignSelf: "stretch", borderRadius: 999, paddingVertical: 15, alignItems: "center" },
    btnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
});
