import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const ORANGE = "#FD652A";
const INK = "#181C2E";
const GREY = "#5B5B66";
const LINE = "#E8E8EE";
const BG = "#F6F6F8";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const long = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** "3 days", "2 weeks", "6 months", "1 year" between two dates (inclusive). */
export function durationLabel(start: Date, end: Date) {
    const days = Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1;
    if (days >= 360) { const y = Math.round(days / 365); return `${y} year${y === 1 ? "" : "s"}`; }
    if (days >= 28) { const m = Math.round(days / 30.4); return `${m} month${m === 1 ? "" : "s"}`; }
    if (days >= 7 && days % 7 === 0) { const w = days / 7; return `${w} week${w === 1 ? "" : "s"}`; }
    return `${days} day${days === 1 ? "" : "s"}`;
}

/** "Fri 5 Dec, Fri 12 Dec and Sat 20 Dec" (first few, then "+ N more"). */
export function datesLabel(dates: Date[], max = 4) {
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const shown = dates.slice(0, max).map(fmt);
    if (dates.length > max) return `${shown.join(", ")} + ${dates.length - max} more`;
    return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown.join("");
}

/**
 * Month calendar; past days can't be picked.
 * range = false: one date. range = true: tap the first day, then the last day.
 * multi = true: tap as many separate days as you like (tap again to remove); uses dates/onDatesChange.
 */
export default function EventCalendar({ start, end, range = false, multi = false, dates = [], onChange, onDatesChange, emptyText }: {
    start: Date | null;
    end?: Date | null;
    range?: boolean;
    multi?: boolean;
    dates?: Date[];
    onChange: (start: Date | null, end: Date | null) => void;
    onDatesChange?: (dates: Date[]) => void;
    emptyText?: string;
}) {
    const today = startOfDay(new Date());
    const [view, setView] = useState(() => { const b = start ?? today; return new Date(b.getFullYear(), b.getMonth(), 1); });
    const first = (view.getDay() + 6) % 7; // Monday first
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const canPrev = view > new Date(today.getFullYear(), today.getMonth(), 1);
    const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7) cells.push(null);

    const picked = new Set(dates.map((x) => x.getTime()));
    const pick = (d: Date) => {
        Haptics.selectionAsync().catch(() => {});
        if (multi) {
            const t = d.getTime();
            const next = picked.has(t) ? dates.filter((x) => x.getTime() !== t) : [...dates, d];
            return onDatesChange?.(next.sort((a, b) => a.getTime() - b.getTime()));
        }
        if (!range) return onChange(d, null);
        // First tap (or a new range): the start. Second tap: the end (or a new start if earlier).
        if (!start || end) return onChange(d, null);
        if (d.getTime() < start.getTime()) return onChange(d, null);
        if (d.getTime() === start.getTime()) return onChange(start, null);
        onChange(start, d);
    };

    const note = multi
        ? (dates.length ? `${dates.length} date${dates.length === 1 ? "" : "s"}: ${datesLabel(dates, 3)}` : (emptyText ?? "Tap every day you need us"))
        : !start
        ? (emptyText ?? (range ? "Tap the first day, then the last day" : "Pick the date"))
        : range && end
            ? `${long(start)} – ${long(end)} · ${durationLabel(start, end)}`
            : range
                ? `From ${long(start)} · now tap the last day`
                : start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

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
                        const t = date.getTime();
                        const past = date < today;
                        const isStart = !multi && !!start && start.getTime() === t;
                        const isEnd = !multi && !!end && end.getTime() === t;
                        const inside = !multi && !!start && !!end && t > start.getTime() && t < end.getTime();
                        const sel = multi ? picked.has(t) : isStart || isEnd;
                        const isToday = t === today.getTime();
                        return (
                            <TouchableOpacity key={i} style={styles.calCell} disabled={past} onPress={() => pick(date)}
                                accessibilityLabel={date.toDateString()} accessibilityState={{ selected: sel || inside, disabled: past }}>
                                {/* Band joining the first and last day */}
                                {(inside || (isStart && !!end) || (isEnd && !!start)) && (
                                    <View style={[styles.band, isStart && { left: "50%" }, isEnd && { right: "50%" }]} />
                                )}
                                <View style={[styles.calDot, sel && styles.calSel, isToday && !sel && styles.calToday]}>
                                    <Text style={[styles.calDay, past && { color: "#CFCFD6" }, sel && { color: "#fff" }, inside && { color: "#C2410C" }]}>{d}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
            <View style={[styles.calNote, (multi ? dates.length > 0 : !!start) && { backgroundColor: "#FFF1EA" }]}>
                <Ionicons name="calendar" size={15} color={(multi ? dates.length > 0 : !!start) ? ORANGE : GREY} />
                <Text style={[styles.calNoteText, (multi ? dates.length > 0 : !!start) && { color: INK }]}>{note}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cal: { borderWidth: 1.5, borderColor: LINE, borderRadius: 20, padding: 12, backgroundColor: "#fff" },
    calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 },
    calNav: { width: 32, height: 32, borderRadius: 16, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
    calTitle: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    calRow: { flexDirection: "row" },
    calDow: { flex: 1, textAlign: "center", fontFamily: "Quicksand-Bold", fontSize: 11, color: "#A0A0AB", paddingBottom: 4 },
    calCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
    band: { position: "absolute", left: 0, right: 0, top: "12%", bottom: "12%", backgroundColor: "#FFE8DD" },
    calDot: { width: "86%", aspectRatio: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    calSel: { backgroundColor: ORANGE },
    calToday: { borderWidth: 1.5, borderColor: ORANGE },
    calDay: { fontFamily: "Quicksand-SemiBold", fontSize: 14, color: INK },
    calNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: BG },
    calNoteText: { flexShrink: 1, fontFamily: "Quicksand-Bold", fontSize: 13, color: GREY, textAlign: "center" },
});
