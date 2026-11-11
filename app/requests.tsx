import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import ScalePress from "@/components/ScalePress";
import ScreenHeader from "@/components/ScreenHeader";
import useFetch from "@/lib/useFetch";
import { cancelServiceRequest, getCategories, getServiceRequests } from "@/lib/api";
import { formatNaira, formatNigerianPhone } from "@/lib/format";
import { popIn, riseIn, settle } from "@/lib/motion";
import { ServiceRequest, ServiceRequestStatus } from "@/type";

import { notify } from "@/lib/notice";
import { datesLabel, durationLabel } from "@/components/EventCalendar";
const ORANGE = "#FD652A";
const RUST = "#C2410C";   // orange text on light backgrounds (readable)
const INK = "#181C2E";
const GREY = "#5B5B66";
const BG = "#F6F6F8";
const SUPPORT_PHONE = "+2347049055555";
const TAB_PAD = 4;

type Tab = "active" | "past";

const CANCELLABLE = new Set<ServiceRequestStatus>(["new", "contacted", "quoted"]);
const PAST = new Set<ServiceRequestStatus>(["completed", "cancelled"]);

/** Chip label and colours per status, plus the "what happens next" note. */
const STATUS: Record<ServiceRequestStatus, { label: string; tint: string; fg: string; note: string }> = {
    new:       { label: "Received",   tint: "#FFF7E6", fg: "#B45309", note: "We’ve got your request. Our team will reach out within 24 hours." },
    contacted: { label: "Contacted",  tint: "#EAF2FF", fg: "#1D4ED8", note: "We’ve been in touch and are putting your menu and quote together." },
    quoted:    { label: "Quote sent", tint: "#EEF0FF", fg: "#4338CA", note: "Your quote is ready. Reply on WhatsApp or call us to confirm." },
    confirmed: { label: "Confirmed",  tint: "#E9F8EF", fg: "#15803D", note: "You’re booked! We’ll be in touch before the day." },
    completed: { label: "Completed",  tint: "#F1F5F9", fg: "#334155", note: "Thank you for celebrating with U Angel Foods." },
    cancelled: { label: "Cancelled",  tint: "#FEF2F2", fg: "#B91C1C", note: "This request was cancelled." },
};
const STEPS: ServiceRequestStatus[] = ["new", "contacted", "quoted", "confirmed"];

const tap = () => { Haptics.selectionAsync().catch(() => {}); };

const eventDate = (ymd: string) => new Date(`${ymd}T00:00:00`);
const daysUntil = (ymd: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((eventDate(ymd).getTime() - today.getTime()) / 86400000);
};
const countdown = (ymd: string) => {
    const d = daysUntil(ymd);
    if (Number.isNaN(d)) return "";
    if (d < 0) return "Date passed";
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d < 21) return `In ${d} days`;
    if (d < 60) return `In ${Math.round(d / 7)} weeks`;
    return `In ${Math.round(d / 30)} months`;
};
/** "8 Nov" (with the year when it isn't this year). */
const shortDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
};
const reference = (r: ServiceRequest) => r.id.slice(0, 8).toUpperCase();

const whatsapp = (r: ServiceRequest) => {
    tap();
    const text = `Hello U Angel Foods, I'm following up on my ${r.event_type} request for ${eventDate(r.event_date).toDateString()} (ref ${reference(r)}).`;
    Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace("+", "")}?text=${encodeURIComponent(text)}`).catch(() =>
        notify("WhatsApp not available", "Please call us on 0704 905 5555."));
};
const call = () => {
    tap();
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => notify("Couldn’t start the call", "Please call us on 0704 905 5555."));
};

const Chip = ({ text }: { text: string }) => (
    <View style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{text}</Text></View>
);

/** Received → Contacted → Quote sent → Confirmed. */
const Tracker = ({ status }: { status: ServiceRequestStatus }) => {
    const finished = status === "completed";
    const reached = finished ? STEPS.length - 1 : STEPS.indexOf(status);
    return (
        <View style={styles.tracker} accessible accessibilityLabel={`Progress: ${STATUS[status].label}, step ${reached + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => {
                const done = i <= reached;
                const current = i === reached && !finished;
                return (
                    <View key={s} style={styles.trackStep}>
                        <View style={styles.trackRow}>
                            <View style={[styles.trackLine, i === 0 && styles.trackLineHidden, i <= reached && styles.trackLineOn]} />
                            <View style={[styles.trackDot, done && styles.trackDotOn, current && styles.trackDotCurrent]}>
                                {done && !current && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                            <View style={[styles.trackLine, i === STEPS.length - 1 && styles.trackLineHidden, i < reached && styles.trackLineOn]} />
                        </View>
                        <Text style={[styles.trackLabel, done && { color: INK }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{STATUS[s].label}</Text>
                    </View>
                );
            })}
        </View>
    );
};

const RequestCard = ({ request, index, onCancelled }: { request: ServiceRequest; index: number; onCancelled: () => void }) => {
    const [isCancelling, setIsCancelling] = useState(false);
    const [open, setOpen] = useState(false);
    const s = STATUS[request.status] ?? STATUS.new;
    const date = eventDate(request.event_date);
    const past = PAST.has(request.status);
    const when = past ? "" : countdown(request.event_date);
    const location = [request.address, request.city, request.state].filter(Boolean).join(", ");
    const contact = [request.full_name, formatNigerianPhone(request.phone)].filter(Boolean).join(" · ");

    const confirmCancel = () =>
        notify("Cancel this request?", `Your ${request.event_type} request will be cancelled.`, [
            { text: "Keep it", style: "cancel" },
            {
                text: "Cancel request", style: "destructive",
                onPress: async () => {
                    setIsCancelling(true);
                    try {
                        await cancelServiceRequest(request.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                        onCancelled();
                    } catch (e: any) {
                        notify("Couldn’t cancel", e.message);
                    } finally {
                        setIsCancelling(false);
                    }
                },
            },
        ]);

    return (
        <Animated.View entering={riseIn(index)} layout={settle()} style={styles.card}>
            {/* Date tile, service, title, status */}
            <View style={styles.top}>
                <View style={[styles.dateTile, past && styles.dateTilePast]} accessible accessibilityLabel={date.toDateString()}>
                    <Text style={[styles.dateMonth, past && { color: GREY }]}>{date.toLocaleDateString("en-NG", { month: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.dateDay, past && { color: GREY }]}>{date.getDate()}</Text>
                    <Text style={styles.dateWeek}>{date.toLocaleDateString("en-NG", { weekday: "short" })}</Text>
                </View>
                <View style={styles.headText}>
                    <Text style={styles.service} numberOfLines={1}>{request.service}</Text>
                    <Text style={styles.title} numberOfLines={2}>{request.event_type}</Text>
                    <View style={styles.metaRow}>
                        <View style={[styles.badge, { backgroundColor: s.tint }]}>
                            <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
                        </View>
                        {when ? <Text style={styles.countdown}>{when}</Text> : null}
                    </View>
                </View>
            </View>

            {/* What happens next */}
            <View style={[styles.note, { backgroundColor: s.tint }]}>
                <Text style={[styles.noteText, { color: s.fg }]}>{s.note}</Text>
            </View>

            {request.status !== "cancelled" && <Tracker status={request.status} />}

            {request.quote_amount ? (
                <View style={styles.quote}>
                    <View>
                        <Text style={styles.quoteLabel}>YOUR QUOTE</Text>
                        <Text style={styles.quoteValue}>{formatNaira(request.quote_amount)}</Text>
                    </View>
                    <Text style={styles.quoteBudget}>Budget {formatNaira(request.budget)}</Text>
                </View>
            ) : null}

            <View style={styles.chips}>
                {request.event_dates && request.event_dates.length > 1 ? (
                    <Chip text={`${request.event_dates.length} dates: ${datesLabel(request.event_dates.map(eventDate), 3)}`} />
                ) : null}
                {request.end_date ? (
                    <Chip text={`Until ${eventDate(request.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${durationLabel(eventDate(request.event_date), eventDate(request.end_date))}`} />
                ) : null}
                <Chip text={`${request.guest_count.toLocaleString("en-NG")} guests`} />
                {!request.quote_amount && Number(request.budget) > 0 && <Chip text={`Budget ${formatNaira(request.budget)}`} />}
                {request.event_time ? <Chip text={request.event_time} /> : null}
            </View>
            {location ? <Text style={styles.location}>{location}</Text> : null}

            {/* Everything else, on request */}
            <TouchableOpacity
                style={styles.toggle}
                onPress={() => { tap(); setOpen((o) => !o); }}
                activeOpacity={0.7}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
            >
                <Text style={styles.toggleText}>{open ? "Hide details" : "More details"}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={RUST} />
            </TouchableOpacity>

            {open && (
                <Animated.View entering={popIn()} style={styles.details}>
                    {request.venue_type ? (
                        <View style={styles.detailRow}>
                            <Text style={styles.smallLabel}>VENUE</Text>
                            <Text style={styles.detailValue}>{request.venue_type}</Text>
                        </View>
                    ) : null}
                    {request.needs?.length ? (
                        <View style={{ gap: 8 }}>
                            <Text style={styles.smallLabel}>YOU NEED</Text>
                            <View style={styles.chips}>
                                {request.needs.map((n) => <View key={n} style={styles.needChip}><Text style={styles.needText}>{n}</Text></View>)}
                            </View>
                        </View>
                    ) : null}
                    {request.details ? (
                        <View style={{ gap: 6 }}>
                            <Text style={styles.smallLabel}>YOUR NOTE</Text>
                            <Text style={styles.detailText}>{request.details}</Text>
                        </View>
                    ) : null}
                    {contact ? (
                        <View style={styles.detailRow}>
                            <Text style={styles.smallLabel}>CONTACT</Text>
                            <Text style={styles.detailValue} numberOfLines={2}>{contact}</Text>
                        </View>
                    ) : null}
                </Animated.View>
            )}

            {!past && (
                <View style={styles.actions}>
                    <ScalePress wrapStyle={{ flex: 1 }} style={styles.waBtn} onPress={() => whatsapp(request)} accessibilityRole="button" accessibilityLabel="WhatsApp us">
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={styles.waText}>WhatsApp us</Text>
                    </ScalePress>
                    <ScalePress style={styles.callBtn} onPress={call} accessibilityRole="button" accessibilityLabel="Call U Angel Foods">
                        <Ionicons name="call-outline" size={18} color={INK} />
                    </ScalePress>
                </View>
            )}

            <View style={styles.footer}>
                <Text style={styles.sent} numberOfLines={1}>Ref {reference(request)} · Sent {shortDate(request.created_at)}</Text>
                {CANCELLABLE.has(request.status) && (
                    <TouchableOpacity onPress={confirmCancel} disabled={isCancelling} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel this request">
                        {isCancelling ? <ActivityIndicator size="small" color="#B91C1C" /> : <Text style={styles.cancel}>Cancel</Text>}
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

/** Active | Past, with a white pill that slides under the chosen tab. */
const TabSwitch = ({ tab, counts, onChange }: { tab: Tab; counts: Record<Tab, number>; onChange: (tab: Tab) => void }) => {
    const reduceMotion = useReducedMotion();
    const [width, setWidth] = useState(0);
    const x = useSharedValue(tab === "active" ? 0 : 1);
    const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (width / 2) }] }));

    const select = (next: Tab) => {
        if (next === tab) return;
        tap();
        const to = next === "active" ? 0 : 1;
        x.set(reduceMotion ? to : withSpring(to, { duration: 320, dampingRatio: 0.85 }));
        onChange(next);
    };

    return (
        <View style={styles.tabs} onLayout={(e) => setWidth(e.nativeEvent.layout.width - TAB_PAD * 2)} accessibilityRole="tablist">
            {width > 0 && <Animated.View style={[styles.tabPill, { width: width / 2 }, pill]} />}
            {(["active", "past"] as const).map((id) => {
                const on = tab === id;
                return (
                    <TouchableOpacity key={id} style={styles.tab} onPress={() => select(id)} activeOpacity={0.8} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${id === "active" ? "Active" : "Past"}, ${counts[id]}`}>
                        <Text style={[styles.tabText, on && styles.tabTextOn]}>{id === "active" ? "Active" : "Past"}</Text>
                        <View style={[styles.tabCount, on && styles.tabCountOn]}>
                            <Text style={[styles.tabCountText, on && { color: "#fff" }]}>{counts[id]}</Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

/** The customer's catering / event requests: Active and Past tabs, rich status cards. */
export default function Requests() {
    const insets = useSafeAreaInsets();
    const { data: requests, loading, refetch } = useFetch({ fn: getServiceRequests });
    const { data: categories } = useFetch({ fn: getCategories });
    const [tab, setTab] = useState<Tab>("active");
    const [refreshing, setRefreshing] = useState(false);

    // Fresh statuses when coming back to this page (e.g. after sending a new request).
    useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    // Active: soonest event first. Past: most recently sent first (the order they arrive in).
    const { active, past } = useMemo(() => {
        // Cancelled requests drop off the customer's list (the admin keeps the record).
        const all = (requests ?? []).filter((r) => r.status !== "cancelled");
        return {
            active: all.filter((r) => !PAST.has(r.status)).sort((a, b) => a.event_date.localeCompare(b.event_date)),
            past: all.filter((r) => PAST.has(r.status)),
        };
    }, [requests]);
    const total = active.length + past.length;
    const shown = tab === "active" ? active : past;

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    // "New request" opens the Catering category (or the first service category).
    const newRequest = () => {
        tap();
        const services = (categories ?? []).filter((c) => c.kind === "service");
        const catering = services.find((c) => /cater/i.test(c.name)) ?? services[0];
        if (catering) router.push({ pathname: "/category/[id]", params: { id: catering.id } });
        else router.push("/");
    };

    const emptyPast = tab === "past" && total > 0;

    return (
        <SafeAreaView style={styles.screen} edges={["top"]}>
            <Stack.Screen options={{ animation: "slide_from_right" }} />
            <FlatList
                data={shown}
                keyExtractor={(r) => r.id}
                contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <ScreenHeader title="My requests" />
                        {total > 0 ? <TabSwitch tab={tab} counts={{ active: active.length, past: past.length }} onChange={setTab} /> : null}
                    </View>
                }
                renderItem={({ item, index }) => <RequestCard request={item} index={index} onCancelled={refetch} />}
                ListEmptyComponent={
                    loading && !requests ? (
                        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
                    ) : (
                        <Animated.View key={emptyPast ? "past" : "none"} entering={riseIn(0)} style={styles.empty}>
                            <View style={styles.emptyIcon}><Ionicons name={emptyPast ? "time-outline" : "sparkles"} size={34} color={ORANGE} /></View>
                            <Text style={styles.emptyTitle}>
                                {emptyPast ? "No past requests" : total > 0 ? "No active requests" : "Planning something special?"}
                            </Text>
                            <Text style={styles.emptyText}>
                                {emptyPast
                                    ? "Completed requests will show here."
                                    : total > 0
                                        ? "Tap New request when you’re planning your next event."
                                        : "Corporate catering, food stands, birthdays, weddings and church events. Tell us what you need and we’ll send you a quote."}
                            </Text>
                        </Animated.View>
                    )
                }
            />

            {/* New request */}
            <View style={[styles.fabWrap, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
                <Animated.View entering={riseIn(3)}>
                    <ScalePress style={styles.fab} onPress={newRequest} scaleTo={0.95} accessibilityRole="button" accessibilityLabel="New request">
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.fabText}>New request</Text>
                    </ScalePress>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },
    list: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
    header: { gap: 14 },

    tabs: { flexDirection: "row", backgroundColor: "#E8E8EE", borderRadius: 999, padding: TAB_PAD },
    tabPill: {
        position: "absolute", top: TAB_PAD, left: TAB_PAD, height: 40, borderRadius: 999, backgroundColor: "#fff",
        shadowColor: INK, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 999 },
    tabText: { fontFamily: "Quicksand-Bold", fontSize: 14, color: GREY },
    tabTextOn: { color: INK },
    tabCount: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#D6D6DE", alignItems: "center", justifyContent: "center" },
    tabCountOn: { backgroundColor: ORANGE },
    tabCountText: { fontFamily: "Quicksand-Bold", fontSize: 11, color: GREY },

    card: {
        backgroundColor: "#fff", borderRadius: 26, padding: 16, gap: 14,
        shadowColor: INK, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 14 },
    dateTile: { width: 64, paddingVertical: 8, borderRadius: 18, backgroundColor: "#FFF1EA", alignItems: "center" },
    dateTilePast: { backgroundColor: "#EEF0F4" },
    dateMonth: { fontFamily: "Quicksand-Bold", fontSize: 11, letterSpacing: 1, color: RUST },
    dateDay: { fontFamily: "Quicksand-Bold", fontSize: 26, lineHeight: 30, color: INK },
    dateWeek: { fontFamily: "Quicksand-SemiBold", fontSize: 11, color: GREY },
    headText: { flex: 1, minWidth: 0, gap: 4 },
    service: { fontFamily: "Quicksand-Bold", fontSize: 11.5, letterSpacing: 0.4, color: GREY, textTransform: "uppercase" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 18, lineHeight: 23, color: INK },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontFamily: "Quicksand-Bold", fontSize: 11.5 },
    countdown: { fontFamily: "Quicksand-Bold", fontSize: 12, color: RUST },

    note: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    noteText: { fontFamily: "Quicksand-SemiBold", fontSize: 13, lineHeight: 18 },

    tracker: { flexDirection: "row" },
    trackStep: { flex: 1, alignItems: "center", gap: 6 },
    trackRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
    trackLine: { flex: 1, height: 3, backgroundColor: "#E4E4EA" },
    trackLineOn: { backgroundColor: ORANGE },
    trackLineHidden: { opacity: 0 },
    trackDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D0D0D8", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    trackDotOn: { backgroundColor: ORANGE, borderColor: ORANGE },
    trackDotCurrent: { backgroundColor: "#fff", borderColor: ORANGE, borderWidth: 5 },
    trackLabel: { fontFamily: "Quicksand-Bold", fontSize: 10.5, color: GREY },

    quote: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: INK, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
    quoteLabel: { fontFamily: "Quicksand-Bold", fontSize: 10.5, letterSpacing: 1, color: "#FFB08A" },
    quoteValue: { fontFamily: "Quicksand-Bold", fontSize: 22, color: "#fff", marginTop: 1 },
    quoteBudget: { fontFamily: "Quicksand-SemiBold", fontSize: 12, color: "#C9CBD6" },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: BG, maxWidth: "100%" },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 12.5, color: INK },
    location: { fontFamily: "Quicksand-SemiBold", fontSize: 13.5, lineHeight: 19, color: "#4B4B55" },

    toggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
    toggleText: { fontFamily: "Quicksand-Bold", fontSize: 13, color: RUST },
    details: { gap: 14, backgroundColor: BG, borderRadius: 18, padding: 14 },
    detailRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
    detailValue: { flex: 1, fontFamily: "Quicksand-Bold", fontSize: 13, color: INK, textAlign: "right" },
    detailText: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: "#4B4B55" },
    smallLabel: { fontFamily: "Quicksand-Bold", fontSize: 10.5, letterSpacing: 1, color: GREY },
    needChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E4E4EA" },
    needText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: INK },

    actions: { flexDirection: "row", gap: 10 },
    waBtn: { height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#166534" },
    waText: { fontFamily: "Quicksand-Bold", fontSize: 14.5, color: "#fff" },
    callBtn: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: BG, borderWidth: 1, borderColor: "#E4E4EA" },

    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "#F0F0F3", paddingTop: 12 },
    sent: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 11.5, color: GREY },
    cancel: { fontFamily: "Quicksand-Bold", fontSize: 13, color: "#B91C1C" },

    empty: { alignItems: "center", gap: 10, marginTop: 40, paddingHorizontal: 12 },
    emptyIcon: { width: 84, height: 84, borderRadius: 28, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center", marginBottom: 6 },
    emptyTitle: { fontFamily: "Quicksand-Bold", fontSize: 19, color: INK, textAlign: "center" },
    emptyText: { fontFamily: "Quicksand-Medium", fontSize: 14, lineHeight: 21, color: GREY, textAlign: "center" },

    fabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", pointerEvents: "box-none" },
    fab: {
        flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 24, borderRadius: 999, backgroundColor: ORANGE,
        shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
    },
    fabText: { fontFamily: "Quicksand-Bold", fontSize: 15, color: "#fff" },
});
