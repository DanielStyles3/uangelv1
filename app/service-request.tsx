import { ReactNode, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

import EventCalendar, { datesLabel, durationLabel, toISODate } from "@/components/EventCalendar";
import StatePicker from "@/components/StatePicker";
import ProductImage from "@/components/ProductImage";
import { createServiceRequest, getCategory, getSubcategories } from "@/lib/api";
import { formatNaira, formatNigerianPhone, normalizeNigerianPhone } from "@/lib/format";
import useFetch from "@/lib/useFetch";
import useAuthStore from "@/store/auth.store";

import { notify } from "@/lib/notice";
type IconName = keyof typeof Ionicons.glyphMap;

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";
const LINE = "#E8E8EE";
const BG = "#F6F6F8";
const PURPLE = "#6B21A8";
const isCustomName = (n?: string | null) => !!n && n.trim().toLowerCase() === "customised event";
const NEEDS: [IconName, string][] = [
    ["restaurant", "Food"], ["wine", "Drinks"], ["gift", "Cake"], ["balloon", "Decor"],
    ["umbrella", "Chairs & canopies"], ["people", "Waiters"], ["mic", "MC / DJ"], ["storefront", "Food stands"],
];
const TIMES: [IconName, string, string][] = [["sunny", "Morning", "Before 12pm"], ["partly-sunny", "Afternoon", "12pm – 4pm"], ["moon", "Evening", "After 4pm"]];
const PLACES: [IconName, string][] = [["home", "Indoor"], ["leaf", "Outdoor"], ["help-circle", "Not sure yet"]];
const STEP_TITLES = ["Your event", "Guests & budget", "Venue", "Your details"];

const digitsOnly = (s: string) => s.replace(/[^\d]/g, "");
type DateMode = "one" | "range" | "specific";
const DATE_MODES: [DateMode, string, IconName][] = [["one", "One day", "today"], ["range", "Date range", "calendar"], ["specific", "Specific dates", "apps"]];
/** Quick lengths for long contracts (end = start + n days - 1). */
const LENGTHS: [string, (d: Date) => Date][] = [
    ["1 week", (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)],
    ["1 month", (d) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate() - 1)],
    ["3 months", (d) => new Date(d.getFullYear(), d.getMonth() + 3, d.getDate() - 1)],
    ["6 months", (d) => new Date(d.getFullYear(), d.getMonth() + 6, d.getDate() - 1)],
    ["1 year", (d) => new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1)],
];
const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
    <View style={{ gap: 10 }}>
        <View style={{ gap: 2 }}>
            <Text style={styles.label}>{title}</Text>
            {hint ? <Text style={styles.labelHint}>{hint}</Text> : null}
        </View>
        {children}
    </View>
);

/** Input with a leading icon. */
const IconInput = ({ icon, ...props }: { icon: IconName } & TextInputProps) => {
    const [focused, setFocused] = useState(false);
    return (
        <View style={[styles.inputBox, focused && styles.inputFocused, props.multiline && { alignItems: "flex-start", paddingTop: 12 }]}>
            <Ionicons name={icon} size={18} color={focused ? ORANGE : "#9A9AA3"} />
            <TextInput
                placeholderTextColor="#A0A0AB"
                {...props}
                onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
                onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
                style={[styles.inputText, props.multiline && { minHeight: 84, textAlignVertical: "top" }]}
            />
        </View>
    );
};

/** Tappable option card with an icon (time of day, venue, needs). */
const OptionCard = ({ icon, label, sub, on, onPress, style, check }: {
    icon: IconName; label: string; sub?: string; on: boolean; onPress: () => void; style?: object; check?: boolean;
}) => (
    <TouchableOpacity style={[styles.opt, on && styles.optOn, style]} onPress={onPress} activeOpacity={0.85}
        accessibilityRole={check ? "checkbox" : "radio"} accessibilityState={{ checked: on }}>
        <View style={[styles.optIcon, on && { backgroundColor: ORANGE }]}>
            <Ionicons name={icon} size={18} color={on ? "#fff" : ORANGE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.optLabel} numberOfLines={1}>{label}</Text>
            {sub ? <Text style={styles.optSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {check && (
            <View style={[styles.check, on && styles.checkOn]}>{on && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
        )}
    </TouchableOpacity>
);

/**
 * Catering / event request in 4 steps: event → guests & budget → venue → details & review.
 * Opened with categoryId (Catering, or Catering › Events) and optionally subcategoryId (the chosen type).
 */
export default function ServiceRequestScreen() {
    const { categoryId, subcategoryId } = useLocalSearchParams<{ categoryId: string; subcategoryId?: string }>();
    const { user, isAuthenticated } = useAuthStore();
    const insets = useSafeAreaInsets();

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
        // One day; a date range (a week of catering, a one-year contract…: first + last day);
        // or specific separate days (e.g. every Friday in December).
        dateMode: "one" as DateMode,
        endDate: null as Date | null,
        dates: [] as Date[],
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
    const isCustom = isCustomName(picked?.name);
    const eventName = isCustom ? (form.customName.trim() || picked?.name || "Customised Event") : (picked?.name ?? "");
    const guests = Number(digitsOnly(form.guests)) || 0;
    const budget = Number(digitsOnly(form.budget)) || 0;
    const heroImage = option?.image_url || chosenType?.image_url || category?.image_url || null;

    // Cheap checks, so no memo needed (the React Compiler couldn't preserve one here).
    const valid = [
        !!picked && (!isCustom || !!form.customName.trim())
            && (form.dateMode === "specific" ? form.dates.length > 0 : !!form.date && (form.dateMode !== "range" || !!form.endDate)),
        guests > 0 && budget > 0,
        !!form.address.trim() && !!form.city.trim() && !!form.state,
        !!form.fullName.trim() && !!normalizeNigerianPhone(form.phone),
    ];

    if (!isAuthenticated) return <Redirect href="/sign-in" />;

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
    const tap = () => Haptics.selectionAsync().catch(() => {});
    const toggleNeed = (n: string) => {
        tap();
        set("needs", form.needs.includes(n) ? form.needs.filter((x) => x !== n) : [...form.needs, n]);
    };

    const explainMissing = () => {
        const msg = [
            !picked ? "Please choose your type of event."
                : isCustom && !form.customName.trim() ? "Please tell us what you’re celebrating."
                : form.dateMode === "specific" ? "Please tap every day you need us on the calendar."
                : !form.date ? (form.dateMode === "range" ? "Please tap the first day on the calendar." : "Please pick the date of your event.")
                : "Please tap the last day on the calendar, or choose a length like 1 month.",
            !guests ? "Please enter the number of guests." : "Please enter your budget in naira.",
            "Please enter the venue address, city/area and state.",
            !form.fullName.trim() ? "Please enter your full name." : "Please enter a valid Nigerian phone number, e.g. 0803 123 4567.",
        ][step];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        notify(STEP_TITLES[step], msg);
    };

    const next = () => {
        if (!valid[step]) return explainMissing();
        tap();
        if (step < 3) setStep(step + 1); else submit();
    };

    const submit = async () => {
        const specific = form.dateMode === "specific";
        const firstDay = specific ? form.dates[0] : form.date;
        if (!category || !picked || !firstDay) return;
        const phone = normalizeNigerianPhone(form.phone);
        if (!phone) return notify("Phone number", "Please enter a valid Nigerian phone number, e.g. 0803 123 4567.");
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
                event_date: toISODate(firstDay),
                end_date: form.dateMode === "range" && form.endDate ? toISODate(form.endDate) : null,
                event_dates: specific ? form.dates.map(toISODate) : null,
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
            notify("Could not send request", e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    /* ---------------- Sent ---------------- */
    if (submitted) {
        const first = form.fullName.trim().split(" ")[0];
        return (
            <SafeAreaView style={[styles.screen, { backgroundColor: BG }]}>
                <ScrollView contentContainerStyle={styles.done}>
                    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.doneBadge}>
                        <Ionicons name="checkmark" size={46} color="#fff" />
                    </Animated.View>
                    <Animated.View entering={FadeInDown.delay(150)} style={{ alignItems: "center", gap: 6 }}>
                        <Text style={styles.doneTitle}>Request sent!</Text>
                        <Text style={styles.doneText}>Thank you{first ? `, ${first}` : ""}. We’ve got your {eventName.toLowerCase()} request.</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(260)} style={styles.doneCard}>
                        <Text style={styles.doneCardTitle}>WHAT HAPPENS NEXT</Text>
                        {([
                            ["call", "We call you within 24 hours", `on ${formatNigerianPhone(form.phone)}`],
                            ["logo-whatsapp", "You get a quote", "on WhatsApp, with menu options"],
                            ["checkmark-done", "You confirm", "and we handle everything on the day"],
                        ] as [IconName, string, string][]).map(([icon, b, t], i, all) => (
                            <View key={b} style={styles.tlRow}>
                                <View style={{ alignItems: "center" }}>
                                    <View style={styles.tlIcon}><Ionicons name={icon} size={16} color={ORANGE} /></View>
                                    {i < all.length - 1 && <View style={styles.tlLine} />}
                                </View>
                                <View style={{ flex: 1, paddingBottom: i < all.length - 1 ? 14 : 0 }}>
                                    <Text style={styles.tlTitle}>{b}</Text>
                                    <Text style={styles.tlText}>{t}</Text>
                                </View>
                            </View>
                        ))}
                    </Animated.View>

                    <TouchableOpacity style={[styles.btn, { backgroundColor: ORANGE }]} onPress={() => router.replace("/requests")}>
                        <Text style={[styles.btnText, { color: "#fff" }]}>View my requests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#fff", borderWidth: 1, borderColor: LINE }]} onPress={() => router.replace("/")}>
                        <Text style={styles.btnText}>Back to home</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    /* ---------------- Form ---------------- */
    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                {/* Hero: photo of the chosen type + title */}
                <View style={styles.hero}>
                    {heroImage ? <ProductImage imageUrl={heroImage} className="size-full" resizeMode="cover" size="full" /> : null}
                    <View style={styles.heroShade} />
                    <TouchableOpacity style={styles.back} onPress={() => (step ? setStep(step - 1) : router.back())} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={20} color={INK} />
                    </TouchableOpacity>
                    <View style={styles.heroText}>
                        <Text style={styles.heroEyebrow}>{(category?.parent_id ? "Catering" : category?.name ?? "Catering").toUpperCase()} REQUEST</Text>
                        <Text style={styles.heroTitle} numberOfLines={2}>{eventName || "Tell us about your event"}</Text>
                    </View>
                </View>

                {/* Stepper */}
                <View style={styles.stepper}>
                    {STEP_TITLES.map((t, i) => {
                        const done = i < step, cur = i === step;
                        return (
                            <TouchableOpacity key={t} style={styles.stepItem} disabled={i >= step} onPress={() => setStep(i)} accessibilityLabel={`Step ${i + 1}: ${t}`}>
                                <View style={styles.stepTrack}>
                                    <View style={[styles.stepBar, { opacity: i === 0 ? 0 : 1 }, i <= step && styles.stepBarOn]} />
                                    <View style={[styles.stepDot, (done || cur) && styles.stepDotOn]}>
                                        {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[styles.stepNum, cur && { color: "#fff" }]}>{i + 1}</Text>}
                                    </View>
                                    <View style={[styles.stepBar, { opacity: i === STEP_TITLES.length - 1 ? 0 : 1 }, i < step && styles.stepBarOn]} />
                                </View>
                                <Text style={[styles.stepLabel, (done || cur) && { color: INK }]} numberOfLines={1}>{t}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Animated.View key={step} entering={FadeIn.duration(220)} style={{ gap: 22 }}>
                        {step === 0 && (
                            <>
                                <Section title="What are you planning?" hint="Pick one, then choose the date.">
                                    <View style={styles.typeGrid}>
                                        {(eventTypes ?? []).map((t) => {
                                            const on = t.id === typeId;
                                            return (
                                                <TouchableOpacity key={t.id} style={[styles.typeTile, on && styles.typeTileOn]} activeOpacity={0.88}
                                                    onPress={() => { tap(); setTypeId(t.id); setOptionId(undefined); }}
                                                    accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t.name}>
                                                    <View style={styles.typePhoto}>
                                                        <ProductImage imageUrl={t.image_url} className="size-full" resizeMode="cover" />
                                                        {on && <View style={styles.typeCheck}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                                                    </View>
                                                    <Text style={[styles.typeName, on && { color: ORANGE }]} numberOfLines={2}>{t.name}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </Section>

                                {hasOptions && (
                                    <Animated.View entering={FadeInDown.springify().damping(16)}>
                                        <Section title={`Which kind of ${chosenType!.name.toLowerCase()}?`}>
                                            <View style={styles.chips}>
                                                {options!.map((o) => {
                                                    const on = o.id === optionId;
                                                    return (
                                                        <TouchableOpacity key={o.id} style={[styles.chip, on && styles.chipOn]} onPress={() => { tap(); setOptionId(o.id); }}
                                                            accessibilityRole="radio" accessibilityState={{ checked: on }}>
                                                            {on && <Ionicons name="checkmark-circle" size={15} color={ORANGE} />}
                                                            <Text style={[styles.chipText, on && { color: ORANGE }]}>{o.name}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </Section>
                                    </Animated.View>
                                )}

                                {isCustom && (
                                    <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.customBox}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                            <Ionicons name="sparkles" size={16} color={PURPLE} />
                                            <Text style={styles.customTitle}>Tell us about your event</Text>
                                        </View>
                                        <IconInput icon="create-outline" value={form.customName} onChangeText={(v) => set("customName", v)} maxLength={60}
                                            placeholder="e.g. Naming ceremony, graduation party" accessibilityLabel="What are you celebrating?" />
                                    </Animated.View>
                                )}

                                <Section title="When?" hint="One event, a run of days (up to a year), or separate days.">
                                    <View style={styles.seg}>
                                        {DATE_MODES.map(([mode, label, icon]) => {
                                            const on = form.dateMode === mode;
                                            return (
                                                <TouchableOpacity key={mode} style={[styles.segBtn, on && styles.segOn]} activeOpacity={0.85}
                                                    onPress={() => { tap(); setForm((p) => ({ ...p, dateMode: mode, endDate: mode === "range" ? p.endDate : null })); }}
                                                    accessibilityRole="radio" accessibilityState={{ checked: on }}>
                                                    <Ionicons name={icon} size={15} color={on ? "#fff" : GREY} />
                                                    <Text style={[styles.segText, on && { color: "#fff" }]} numberOfLines={1}>{label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <Text style={styles.labelHint}>
                                        {form.dateMode === "range" ? "Tap the first day, then the last day. Every day in between is included."
                                            : form.dateMode === "specific" ? "Tap every day you need us. Tap a day again to remove it."
                                            : "Tap the day of your event."}
                                    </Text>
                                    <EventCalendar
                                        range={form.dateMode === "range"}
                                        multi={form.dateMode === "specific"}
                                        start={form.date}
                                        end={form.endDate}
                                        dates={form.dates}
                                        onChange={(s, e) => setForm((p) => ({ ...p, date: s, endDate: e }))}
                                        onDatesChange={(d) => set("dates", d)}
                                        emptyText={form.dateMode === "range" ? "Tap the first day, then the last day" : form.dateMode === "specific" ? "Tap every day you need us" : "Pick the date of your event"}
                                    />
                                    {form.dateMode === "specific" && form.dates.length > 0 && (
                                        <TouchableOpacity onPress={() => { tap(); set("dates", []); }} hitSlop={8} style={{ alignSelf: "flex-end" }}>
                                            <Text style={styles.ticketEdit}>Clear dates</Text>
                                        </TouchableOpacity>
                                    )}
                                    {form.dateMode === "range" && (
                                        <View style={{ gap: 8 }}>
                                            <Text style={styles.labelHint}>{form.date ? "Or choose how long:" : "Pick the first day, then choose how long:"}</Text>
                                            <View style={styles.chips}>
                                                {LENGTHS.map(([label, toEnd]) => {
                                                    const on = !!form.date && !!form.endDate && toEnd(form.date).getTime() === form.endDate.getTime();
                                                    return (
                                                        <TouchableOpacity key={label} style={[styles.chip, on && styles.chipOn, !form.date && { opacity: 0.45 }]} disabled={!form.date}
                                                            onPress={() => { tap(); if (form.date) set("endDate", toEnd(form.date)); }}>
                                                            <Text style={[styles.chipText, on && { color: ORANGE }]}>{label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}
                                </Section>
                                <Section title="Time of day">
                                    <View style={styles.row3}>
                                        {TIMES.map(([icon, t, sub]) => (
                                            <TouchableOpacity key={t} style={[styles.timeCard, form.time === t && styles.optOn]} onPress={() => { tap(); set("time", t); }}
                                                accessibilityRole="radio" accessibilityState={{ checked: form.time === t }}>
                                                <Ionicons name={icon} size={22} color={form.time === t ? ORANGE : "#9A9AA3"} />
                                                <Text style={styles.timeLabel}>{t}</Text>
                                                <Text style={styles.timeSub}>{sub}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </Section>
                            </>
                        )}

                        {step === 1 && (
                            <>
                                <Section title="How many guests?" hint="An estimate is fine. We’ll confirm on the call.">
                                    <View style={styles.guestCard}>
                                        <TouchableOpacity style={styles.guestBtn} onPress={() => { tap(); set("guests", String(Math.max(1, guests - 10))); }} accessibilityLabel="10 fewer guests">
                                            <Ionicons name="remove" size={22} color={INK} />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1, alignItems: "center" }}>
                                            <TextInput style={styles.guestInput} value={form.guests} onChangeText={(v) => set("guests", digitsOnly(v))}
                                                keyboardType="numeric" placeholder="0" placeholderTextColor="#C4C4CC" accessibilityLabel="Number of guests" />
                                            <Text style={styles.guestUnit}>guests</Text>
                                        </View>
                                        <TouchableOpacity style={[styles.guestBtn, { backgroundColor: ORANGE, borderColor: ORANGE }]} onPress={() => { tap(); set("guests", String(guests + 10)); }} accessibilityLabel="10 more guests">
                                            <Ionicons name="add" size={22} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.chips}>
                                        {[50, 100, 200, 300, 500].map((n) => (
                                            <TouchableOpacity key={n} style={[styles.chip, guests === n && styles.chipOn]} onPress={() => { tap(); set("guests", String(n)); }}>
                                                <Text style={[styles.chipText, guests === n && { color: ORANGE }]}>{n}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </Section>

                                <Section title="Your budget">
                                    <View style={styles.budgetBox}>
                                        <Text style={styles.naira}>₦</Text>
                                        <TextInput style={styles.budgetInput} value={budget ? budget.toLocaleString("en-NG") : ""} onChangeText={(v) => set("budget", digitsOnly(v))}
                                            keyboardType="numeric" placeholder="1,500,000" placeholderTextColor="#C4C4CC" accessibilityLabel="Budget in naira" />
                                    </View>
                                    {budget > 0 && guests > 0 && (
                                        <View style={styles.hint}>
                                            <Ionicons name="calculator" size={14} color="#15803D" />
                                            <Text style={styles.hintText}>About {formatNaira(Math.round(budget / guests))} per guest</Text>
                                        </View>
                                    )}
                                </Section>

                                <Section title="What do you need?" hint="Tick everything that applies.">
                                    <View style={styles.grid2}>
                                        {NEEDS.map(([icon, n]) => (
                                            <OptionCard key={n} icon={icon} label={n} on={form.needs.includes(n)} onPress={() => toggleNeed(n)} style={styles.half} check />
                                        ))}
                                    </View>
                                </Section>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <Section title="Where is the event?" hint="So we can plan delivery and set-up.">
                                    <IconInput icon="location-outline" value={form.address} onChangeText={(v) => set("address", v)} autoCapitalize="words"
                                        placeholder="Venue or street address, e.g. Eko Hotel" accessibilityLabel="Venue address" />
                                    <IconInput icon="map-outline" value={form.city} onChangeText={(v) => set("city", v)} autoCapitalize="words"
                                        placeholder="City / area, e.g. Lekki" accessibilityLabel="City or area" />
                                    <StatePicker value={form.state} onChange={(v) => set("state", v)} />
                                </Section>
                                <Section title="Indoor or outdoor?">
                                    <View style={styles.row3}>
                                        {PLACES.map(([icon, p]) => (
                                            <TouchableOpacity key={p} style={[styles.timeCard, form.place === p && styles.optOn]} onPress={() => { tap(); set("place", p); }}
                                                accessibilityRole="radio" accessibilityState={{ checked: form.place === p }}>
                                                <Ionicons name={icon} size={22} color={form.place === p ? ORANGE : "#9A9AA3"} />
                                                <Text style={styles.timeLabel} numberOfLines={1}>{p}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </Section>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <Section title="How can we reach you?">
                                    <IconInput icon="person-outline" value={form.fullName} onChangeText={(v) => set("fullName", v)} autoCapitalize="words" placeholder="Your full name" accessibilityLabel="Your name" />
                                    <IconInput icon="call-outline" value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="Phone, e.g. 0803 123 4567" accessibilityLabel="Phone" />
                                    <IconInput icon="mail-outline" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" placeholder="Email (optional)" accessibilityLabel="Email" />
                                    <IconInput icon="chatbox-ellipses-outline" value={form.details} onChangeText={(v) => set("details", v)} multiline maxLength={1000}
                                        placeholder="Anything else? Theme, menu ideas, dietary needs… (optional)" accessibilityLabel="Other details" />
                                </Section>

                                <Section title="Your request">
                                    <View style={styles.ticket}>
                                        <View style={styles.ticketHead}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.ticketEyebrow}>EVENT</Text>
                                                <Text style={styles.ticketTitle} numberOfLines={2}>{eventName}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => setStep(0)} hitSlop={8}><Text style={styles.ticketEdit}>Edit</Text></TouchableOpacity>
                                        </View>
                                        <View style={styles.ticketCut}>
                                            <View style={[styles.notch, { left: -10 }]} />
                                            <View style={styles.dash} />
                                            <View style={[styles.notch, { right: -10 }]} />
                                        </View>
                                        {([
                                            ["calendar-outline", "When", form.dateMode === "specific"
                                                ? (form.dates.length ? `${form.dates.length} date${form.dates.length === 1 ? "" : "s"}: ${datesLabel(form.dates, 6)} · ${form.time}` : "—")
                                                : !form.date ? "—"
                                                : form.dateMode === "range" && form.endDate
                                                    ? `${shortDate(form.date)} – ${shortDate(form.endDate)} (${durationLabel(form.date, form.endDate)}) · ${form.time}`
                                                    : `${shortDate(form.date)} · ${form.time}`, 0],
                                            ["people-outline", "Guests", `${guests} guests`, 1],
                                            ["wallet-outline", "Budget", formatNaira(budget), 1],
                                            ["list-outline", "Needs", form.needs.join(", ") || "—", 1],
                                            ["location-outline", "Venue", `${[form.address, form.city, form.state].filter(Boolean).join(", ")} · ${form.place}`, 2],
                                        ] as [IconName, string, string, number][]).map(([icon, k, v, to]) => (
                                            <View key={k} style={styles.ticketRow}>
                                                <Ionicons name={icon} size={17} color={ORANGE} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.ticketKey}>{k}</Text>
                                                    <Text style={styles.ticketVal}>{v}</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => setStep(to)} hitSlop={8} accessibilityLabel={`Edit ${k}`}>
                                                    <Text style={styles.ticketEdit}>Edit</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </Section>
                            </>
                        )}
                    </Animated.View>
                </ScrollView>

                <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                    <TouchableOpacity style={[styles.footGo, (!valid[step] || isSubmitting) && styles.footGoOff]} onPress={next} disabled={isSubmitting} activeOpacity={0.9}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.footGoText}>{isSubmitting ? "Sending…" : step === 3 ? "Send request" : "Continue"}</Text>
                            {step < 3 && <Text style={styles.footGoSub}>Next: {STEP_TITLES[step + 1]}</Text>}
                        </View>
                        <View style={styles.footArrow}>
                            <Ionicons name={step === 3 ? "paper-plane" : "arrow-forward"} size={18} color={(!valid[step] || isSubmitting) ? "#9A9AA3" : ORANGE} />
                        </View>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff" },

    hero: { height: 150, marginHorizontal: 16, marginTop: 6, borderRadius: 24, overflow: "hidden", backgroundColor: "#991B1B", justifyContent: "flex-end" },
    heroShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundImage: "linear-gradient(to bottom, rgba(10,12,24,0.15) 0%, rgba(10,12,24,0.75) 100%)" },
    back: { position: "absolute", top: 12, left: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    heroText: { padding: 16, gap: 2 },
    heroEyebrow: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.4, color: "rgba(255,255,255,0.85)" },
    heroTitle: { fontFamily: "Quicksand-Bold", fontSize: 22, lineHeight: 27, color: "#fff" },

    stepper: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 14, paddingBottom: 6 },
    stepItem: { flex: 1, alignItems: "center", gap: 6 },
    stepTrack: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
    stepBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: LINE },
    stepBarOn: { backgroundColor: ORANGE },
    stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F0F0F4", alignItems: "center", justifyContent: "center" },
    stepDotOn: { backgroundColor: ORANGE },
    stepNum: { fontFamily: "Quicksand-Bold", fontSize: 12, color: GREY },
    stepLabel: { fontFamily: "Quicksand-Bold", fontSize: 11, color: "#A0A0AB" },

    body: { padding: 16, paddingBottom: 32 },
    label: { fontFamily: "Quicksand-Bold", fontSize: 17, color: INK },
    labelHint: { fontFamily: "Quicksand-Medium", fontSize: 13, color: GREY },

    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    typeTile: { width: "31.5%", borderRadius: 18, padding: 5, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff", gap: 6 },
    typeTileOn: { borderColor: ORANGE, borderWidth: 2, backgroundColor: "#FFF4EE" },
    typePhoto: { height: 72, borderRadius: 13, overflow: "hidden", backgroundColor: "#FFF3E6" },
    typeCheck: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
    typeName: { fontFamily: "Quicksand-Bold", fontSize: 12, lineHeight: 15, color: INK, textAlign: "center", paddingHorizontal: 2, paddingBottom: 4, minHeight: 34 },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    chipOn: { borderColor: ORANGE, backgroundColor: "#FFF4EE" },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },

    customBox: { backgroundColor: "#F5EDFC", borderRadius: 18, padding: 14, gap: 10 },
    customTitle: { fontFamily: "Quicksand-Bold", fontSize: 14, color: PURPLE },

    seg: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 999, backgroundColor: BG },
    segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 999 },
    segOn: { backgroundColor: ORANGE },
    segText: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: GREY, flexShrink: 1 },

    row3: { flexDirection: "row", gap: 8 },
    timeCard: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 18, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff" },
    timeLabel: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK, marginTop: 2 },
    timeSub: { fontFamily: "Quicksand-SemiBold", fontSize: 11, color: GREY },

    opt: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff" },
    optOn: { borderColor: ORANGE, borderWidth: 2, backgroundColor: "#FFF4EE" },
    optIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    optLabel: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },
    optSub: { fontFamily: "Quicksand-SemiBold", fontSize: 11.5, color: GREY },
    check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "#D6D6DD", alignItems: "center", justifyContent: "center" },
    checkOn: { backgroundColor: ORANGE, borderColor: ORANGE },
    grid2: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    half: { width: "48.6%" },

    guestCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: BG },
    guestBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: LINE, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    guestInput: { fontFamily: "Quicksand-Bold", fontSize: 34, color: INK, textAlign: "center", minWidth: 100, paddingVertical: 0 },
    guestUnit: { fontFamily: "Quicksand-Bold", fontSize: 12, color: GREY, marginTop: -2 },

    budgetBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: LINE, borderRadius: 18, paddingHorizontal: 16, backgroundColor: "#fff" },
    naira: { fontFamily: "Quicksand-Bold", fontSize: 24, color: ORANGE },
    budgetInput: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 24, color: INK, paddingVertical: 12 },
    hint: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#E8F7EE", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
    hintText: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: "#15803D" },

    inputBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: LINE, borderRadius: 16, paddingHorizontal: 14, backgroundColor: "#fff", minHeight: 52 },
    inputFocused: { borderColor: ORANGE, backgroundColor: "#FFFBF8" },
    inputText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 15, color: INK, paddingVertical: 12 },

    ticket: { borderRadius: 22, backgroundColor: "#fff", borderWidth: 1.5, borderColor: LINE, overflow: "hidden" },
    ticketHead: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: INK, padding: 16 },
    ticketEyebrow: { fontFamily: "Quicksand-Bold", fontSize: 10.5, letterSpacing: 1.2, color: "#FFB08A" },
    ticketTitle: { fontFamily: "Quicksand-Bold", fontSize: 18, color: "#fff", marginTop: 2 },
    ticketCut: { height: 20, justifyContent: "center", backgroundColor: "#fff" },
    notch: { position: "absolute", top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1.5, borderColor: LINE },
    dash: { marginHorizontal: 18, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: LINE },
    ticketRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
    ticketKey: { fontFamily: "Quicksand-SemiBold", fontSize: 11.5, color: GREY },
    ticketVal: { fontFamily: "Quicksand-Bold", fontSize: 14, lineHeight: 19, color: INK, marginTop: 1 },
    ticketEdit: { fontFamily: "Quicksand-Bold", fontSize: 13, color: ORANGE },

    foot: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "#fff" },
    footGo: {
        flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 999, backgroundColor: ORANGE, paddingLeft: 24, paddingRight: 8, height: 60,
        shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    footGoOff: { backgroundColor: "#C9CAD3", shadowOpacity: 0 },
    footGoText: { fontFamily: "Quicksand-Bold", fontSize: 16, color: "#fff" },
    footGoSub: { fontFamily: "Quicksand-SemiBold", fontSize: 11.5, color: "rgba(255,255,255,0.85)" },
    footArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

    done: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
    doneBadge: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#2F9B65", alignItems: "center", justifyContent: "center", shadowColor: "#2F9B65", shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    doneTitle: { fontFamily: "Quicksand-Bold", fontSize: 26, color: INK },
    doneText: { fontFamily: "Quicksand-Medium", fontSize: 15, lineHeight: 21, color: GREY, textAlign: "center" },
    doneCard: { alignSelf: "stretch", backgroundColor: "#fff", borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: LINE },
    doneCardTitle: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1.2, color: GREY },
    tlRow: { flexDirection: "row", gap: 12 },
    tlIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    tlLine: { flex: 1, width: 2, backgroundColor: "#FFD9C8", marginTop: 4 },
    tlTitle: { fontFamily: "Quicksand-Bold", fontSize: 14.5, color: INK },
    tlText: { fontFamily: "Quicksand-Medium", fontSize: 13, color: GREY, marginTop: 1 },
    btn: { alignSelf: "stretch", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    btnText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
});
