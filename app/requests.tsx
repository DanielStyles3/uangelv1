import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import CustomHeader from "@/components/CustomHeader";
import CustomButton from "@/components/CustomButton";
import useFetch from "@/lib/useFetch";
import { cancelServiceRequest, getServiceRequests } from "@/lib/api";
import { formatDateTime, formatNaira } from "@/lib/format";
import { images } from "@/constants";
import { ServiceRequest, ServiceRequestStatus } from "@/type";

type IconName = keyof typeof Ionicons.glyphMap;

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";
const BG = "#F6F6F8";

const formatEventDate = (ymd: string) =>
    new Date(`${ymd}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const CANCELLABLE = new Set<ServiceRequestStatus>(["new", "contacted", "quoted"]);

const STATUS: Record<ServiceRequestStatus, { label: string; bg: string; fg: string; icon: IconName }> = {
    new:       { label: "Received",   bg: "#FEF3C7", fg: "#B45309", icon: "mail-unread-outline" },
    contacted: { label: "Contacted",  bg: "#DBEAFE", fg: "#1D4ED8", icon: "call-outline" },
    quoted:    { label: "Quote sent", bg: "#E0E7FF", fg: "#4338CA", icon: "document-text-outline" },
    confirmed: { label: "Confirmed",  bg: "#DCFCE7", fg: "#15803D", icon: "checkmark-circle-outline" },
    completed: { label: "Completed",  bg: "#F1F5F9", fg: "#334155", icon: "ribbon-outline" },
    cancelled: { label: "Cancelled",  bg: "#FEE2E2", fg: "#B91C1C", icon: "close-circle-outline" },
};

/** Received → Contacted → Quote sent → Confirmed */
const STEPS: ServiceRequestStatus[] = ["new", "contacted", "quoted", "confirmed"];

const Detail = ({ icon, label, value }: { icon: IconName; label: string; value: string }) => (
    <View style={styles.detail}>
        <View style={styles.detailIcon}><Ionicons name={icon} size={17} color={ORANGE} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
        </View>
    </View>
);

const Progress = ({ status }: { status: ServiceRequestStatus }) => {
    const reached = status === "completed" ? STEPS.length - 1 : STEPS.indexOf(status);
    return (
        <View style={styles.progress}>
            {STEPS.map((s, i) => {
                const done = i <= reached;
                return (
                    <View key={s} style={styles.progressStep}>
                        <View style={styles.progressTrack}>
                            {i > 0 && <View style={[styles.progressLine, done && styles.progressLineOn]} />}
                            <View style={[styles.progressDot, done && styles.progressDotOn]}>
                                {done && <Ionicons name="checkmark" size={10} color="#fff" />}
                            </View>
                            {i < STEPS.length - 1 && <View style={[styles.progressLine, i < reached && styles.progressLineOn]} />}
                        </View>
                        <Text style={[styles.progressLabel, done && { color: INK }]} numberOfLines={1}>{STATUS[s].label}</Text>
                    </View>
                );
            })}
        </View>
    );
};

const RequestCard = ({ request, index, onCancelled }: { request: ServiceRequest; index: number; onCancelled: () => void }) => {
    const [isCancelling, setIsCancelling] = useState(false);
    const s = STATUS[request.status] ?? STATUS.new;
    const isEvent = /event/i.test(request.service);

    const confirmCancel = () =>
        Alert.alert("Cancel request", "Are you sure you want to cancel this request?", [
            { text: "Keep it", style: "cancel" },
            {
                text: "Cancel request",
                style: "destructive",
                onPress: async () => {
                    setIsCancelling(true);
                    try {
                        await cancelServiceRequest(request.id);
                        onCancelled();
                    } catch (e: any) {
                        Alert.alert("Error", e.message);
                    } finally {
                        setIsCancelling(false);
                    }
                },
            },
        ]);

    return (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 70).springify().damping(16)} style={styles.card}>
            {/* Header */}
            <View style={styles.head}>
                <View style={styles.headIcon}>
                    <Ionicons name={isEvent ? "sparkles-outline" : "restaurant-outline"} size={22} color={ORANGE} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={2}>{request.event_type}</Text>
                    <Text style={styles.service} numberOfLines={1}>{request.service}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={13} color={s.fg} />
                    <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
                </View>
            </View>

            {request.status !== "cancelled" && <Progress status={request.status} />}

            {/* Quote from the team */}
            {request.quote_amount ? (
                <View style={styles.quote}>
                    <Ionicons name="pricetag" size={16} color="#4338CA" />
                    <Text style={styles.quoteText}>Our quote: <Text style={{ fontFamily: "Quicksand-Bold" }}>{formatNaira(request.quote_amount)}</Text></Text>
                </View>
            ) : null}

            {/* Details */}
            <View style={styles.grid}>
                <Detail icon="calendar-outline" label="Date" value={formatEventDate(request.event_date)} />
                <Detail icon="people-outline" label="Guests" value={`${request.guest_count} guests`} />
                <Detail icon="wallet-outline" label="Budget" value={formatNaira(request.budget)} />
                <Detail icon="time-outline" label="Time" value={request.event_time || "To be agreed"} />
            </View>
            <View style={styles.location}>
                <Ionicons name="location-outline" size={17} color={GREY} />
                <Text style={styles.locationText} numberOfLines={2}>{[request.address, request.city, request.state].filter(Boolean).join(", ")}</Text>
            </View>

            {request.needs?.length ? (
                <View style={styles.chips}>
                    {request.needs.map((n) => (
                        <View key={n} style={styles.chip}><Text style={styles.chipText}>{n}</Text></View>
                    ))}
                </View>
            ) : null}

            {request.details ? <Text style={styles.notes} numberOfLines={3}>“{request.details}”</Text> : null}

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.sent}>Sent {formatDateTime(request.created_at)}</Text>
                {CANCELLABLE.has(request.status) && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={confirmCancel} disabled={isCancelling} activeOpacity={0.8}>
                        {isCancelling ? <ActivityIndicator size="small" color="#B91C1C" /> : (
                            <>
                                <Ionicons name="close" size={15} color="#B91C1C" />
                                <Text style={styles.cancelText}>Cancel</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

/** The customer's catering / event requests and their status. */
export default function Requests() {
    const { data: requests, loading, refetch } = useFetch({ fn: getServiceRequests });

    useFocusEffect(useCallback(() => { refetch(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <SafeAreaView style={styles.screen}>
            <FlatList
                data={requests ?? []}
                keyExtractor={(r) => r.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading && !!requests} onRefresh={() => refetch()} tintColor={ORANGE} />}
                ListHeaderComponent={
                    <View style={{ gap: 6 }}>
                        <CustomHeader title="My requests" showSearch={false} />
                        {(requests?.length ?? 0) > 0 && (
                            <Text style={styles.intro}>Our team will call or WhatsApp you about each request. Pull down to refresh.</Text>
                        )}
                    </View>
                }
                renderItem={({ item, index }) => <RequestCard request={item} index={index} onCancelled={() => refetch()} />}
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
                    ) : (
                        <View style={styles.empty}>
                            <Image source={images.emptyState} style={{ width: 200, height: 200 }} resizeMode="contain" />
                            <Text className="h3-bold text-dark-100">No requests yet</Text>
                            <Text className="paragraph-medium text-gray-200 text-center">
                                Planning an event? Request catering or event services from the home page.
                            </Text>
                            <View style={{ alignSelf: "stretch", marginTop: 16 }}>
                                <CustomButton title="Go to home" onPress={() => router.replace("/")} />
                            </View>
                        </View>
                    )
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: BG },
    list: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
    intro: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 19, color: GREY, marginBottom: 4 },
    empty: { alignItems: "center", gap: 10, marginTop: 30 },

    card: {
        backgroundColor: "#fff", borderRadius: 24, padding: 16, gap: 14,
        borderWidth: 1, borderColor: "#EDEDF1",
        shadowColor: INK, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    },
    head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    headIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 17, lineHeight: 22, color: INK },
    service: { fontFamily: "Quicksand-SemiBold", fontSize: 13, color: GREY, marginTop: 1 },
    badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
    badgeText: { fontFamily: "Quicksand-Bold", fontSize: 11.5 },

    progress: { flexDirection: "row", backgroundColor: BG, borderRadius: 16, paddingVertical: 10 },
    progressStep: { flex: 1, alignItems: "center", gap: 6 },
    progressTrack: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", justifyContent: "center" },
    progressLine: { flex: 1, height: 2, backgroundColor: "#DADAE0" },
    progressLineOn: { backgroundColor: ORANGE },
    progressDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#DADAE0", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
    progressDotOn: { backgroundColor: ORANGE, borderColor: ORANGE },
    progressLabel: { fontFamily: "Quicksand-Bold", fontSize: 10.5, color: "#A0A0AB" },

    quote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF0FF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    quoteText: { fontFamily: "Quicksand-SemiBold", fontSize: 14, color: "#312E81" },

    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
    detail: { width: "50%", flexDirection: "row", alignItems: "center", gap: 9, paddingRight: 6 },
    detailIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#FFF1EA", alignItems: "center", justifyContent: "center" },
    detailLabel: { fontFamily: "Quicksand-SemiBold", fontSize: 11.5, color: GREY },
    detailValue: { fontFamily: "Quicksand-Bold", fontSize: 13.5, color: INK },

    location: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: BG, borderRadius: 14, padding: 11 },
    locationText: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 13, lineHeight: 18, color: "#4B4B55" },

    chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "#E4E4EA" },
    chipText: { fontFamily: "Quicksand-Bold", fontSize: 12, color: INK },

    notes: { fontFamily: "Quicksand-Medium", fontSize: 13.5, lineHeight: 20, color: GREY, fontStyle: "italic" },

    footer: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
        borderTopWidth: 1, borderTopColor: "#F0F0F3", paddingTop: 12,
    },
    sent: { flex: 1, fontFamily: "Quicksand-SemiBold", fontSize: 12, color: GREY },
    cancelBtn: {
        flexDirection: "row", alignItems: "center", gap: 4, minWidth: 92, justifyContent: "center",
        paddingHorizontal: 14, height: 36, borderRadius: 999, borderWidth: 1.5, borderColor: "#FCA5A5", backgroundColor: "#FEF2F2",
    },
    cancelText: { fontFamily: "Quicksand-Bold", fontSize: 13, color: "#B91C1C" },
});
