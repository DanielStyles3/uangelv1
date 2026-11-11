import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

/**
 * Branded pop-up messages: a drop-in replacement for React Native's grey Alert.alert.
 *   notify("Password updated", "You're signed in with your new password.");
 *   notify("Sign out?", "You can sign back in any time.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress }]);
 * The icon and colours are picked from the wording (or pass { tone }). Mount <NoticeHost /> once at the app root.
 */

export type NoticeButton = { text?: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
export type NoticeTone = "success" | "error" | "danger" | "warning" | "confirm" | "info";
type Notice = { id: number; title: string; message?: string; buttons: NoticeButton[]; tone: NoticeTone };

const ORANGE = "#FD652A";
const NAVY = "#181C2E";
const GREY = "#5B5B66";

const TONES: Record<NoticeTone, { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string; ring: string }> = {
    success: { icon: "checkmark", fg: "#fff", bg: "#16A34A", ring: "#DCFCE7" },
    error: { icon: "close", fg: "#fff", bg: "#DC2626", ring: "#FEE2E2" },
    danger: { icon: "warning", fg: "#fff", bg: "#DC2626", ring: "#FEE2E2" },
    warning: { icon: "alert", fg: "#fff", bg: "#F59E0B", ring: "#FEF3C7" },
    confirm: { icon: "help", fg: "#fff", bg: ORANGE, ring: "#FFE8DD" },
    info: { icon: "information", fg: "#fff", bg: NAVY, ring: "#E8E9F0" },
};

const ERROR_WORDS = /couldn|can[’']?t|cannot|error|failed|wrong|invalid|not (be )?(found|available|sent|saved)|unavailable|expired|no internet|offline|denied|problem/i;
const SUCCESS_WORDS = /updated|saved|sent|success|done|copied|welcome|thank|added|applied|submitted|received|confirmed|paid|deleted|removed|all set|on its way|requested/i;

function guessTone(title: string, message: string | undefined, buttons: NoticeButton[]): NoticeTone {
    if (buttons.some((b) => b.style === "destructive")) return "danger";
    if (ERROR_WORDS.test(title)) return "error";
    if (buttons.length > 1 || /\?\s*$/.test(title)) return "confirm";
    if (SUCCESS_WORDS.test(title)) return "success";
    if (ERROR_WORDS.test(message ?? "")) return "error";
    return "warning"; // "Check your email", "Enter the code", "One more thing"…
}

// ---------- tiny store: a queue of notices ----------
let queue: Notice[] = [];
let nextId = 1;
const listeners = new Set<(q: Notice[]) => void>();
const emit = () => listeners.forEach((l) => l(queue));

/** Show a branded pop-up. Same arguments as Alert.alert, plus an optional tone. */
export function notify(title: string, message?: string, buttons?: NoticeButton[], options?: { tone?: NoticeTone }) {
    const list = buttons && buttons.length ? buttons : [{ text: "OK" }];
    const tone = options?.tone ?? guessTone(title, message, list);
    queue = [...queue, { id: nextId++, title: title === "Error" ? "Something went wrong" : title, message, buttons: list, tone }];
    emit();
}

function dismiss(id: number) {
    queue = queue.filter((n) => n.id !== id);
    emit();
}

/** The friendlier word for a lone "OK". */
const label = (b: NoticeButton, only: boolean, tone: NoticeTone) =>
    b.text && !(only && /^ok$/i.test(b.text)) ? b.text : tone === "success" ? "Great" : tone === "error" ? "Okay" : "Got it";

export function NoticeHost() {
    const [items, setItems] = useState<Notice[]>(queue);
    useEffect(() => {
        listeners.add(setItems);
        return () => { listeners.delete(setItems); };
    }, []);

    const current = items[0];

    useEffect(() => {
        if (!current) return;
        if (current.tone === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        else if (current.tone === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        else Haptics.selectionAsync().catch(() => {});
    }, [current]);

    if (!current) return null;

    const t = TONES[current.tone];
    const only = current.buttons.length === 1;
    const cancel = current.buttons.find((b) => b.style === "cancel");
    // Two buttons sit side by side (cancel first); three or more stack.
    const ordered = current.buttons.length === 2 && cancel ? [cancel, ...current.buttons.filter((b) => b !== cancel)] : current.buttons;
    const row = ordered.length === 2;

    const press = (b?: NoticeButton) => {
        dismiss(current.id);
        b?.onPress?.();
    };
    // Android back / tapping outside: same as Cancel, or the only button.
    const back = () => press(cancel ?? (only ? current.buttons[0] : undefined));

    return (
        <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={back}>
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={cancel || only ? back : undefined} accessibilityLabel="Close" />
                <Animated.View key={current.id} entering={ZoomIn.springify().damping(16).stiffness(220)} style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
                    <View style={[styles.ring, { backgroundColor: t.ring }]}>
                        <View style={[styles.icon, { backgroundColor: t.bg }]}>
                            <Ionicons name={t.icon} size={30} color={t.fg} />
                        </View>
                    </View>

                    <Text style={styles.title}>{current.title}</Text>
                    {current.message ? <Text style={styles.message}>{current.message}</Text> : null}

                    <View style={[styles.buttons, row && styles.buttonsRow]}>
                        {ordered.map((b, i) => {
                            const isCancel = b.style === "cancel";
                            const isDanger = b.style === "destructive";
                            const primary = !isCancel && (only || i === ordered.length - 1 || isDanger);
                            const bg = isDanger ? "#DC2626" : primary ? (current.tone === "success" ? NAVY : ORANGE) : "#F2F2F5";
                            return (
                                // TouchableOpacity with a plain style: NativeWind drops Pressable's style function,
                                // which left these buttons without a background (white "Leave" text on white).
                                <TouchableOpacity
                                    key={`${b.text}-${i}`}
                                    onPress={() => press(b)}
                                    activeOpacity={0.85}
                                    style={[styles.btn, row ? styles.btnRow : null, { backgroundColor: bg }]}
                                    accessibilityRole="button"
                                >
                                    <Text style={[styles.btnText, { color: primary || isDanger ? "#fff" : NAVY }]} numberOfLines={1}>
                                        {label(b, only, current.tone)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(24,28,46,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
    card: {
        width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 30, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 20,
        alignItems: "center", shadowColor: NAVY, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 24,
    },
    ring: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    icon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
    title: { fontFamily: "Quicksand-Bold", fontSize: 20, lineHeight: 26, color: NAVY, textAlign: "center" },
    message: { fontFamily: "Quicksand-SemiBold", fontSize: 14.5, lineHeight: 21, color: GREY, textAlign: "center", marginTop: 8 },
    buttons: { alignSelf: "stretch", gap: 10, marginTop: 22 },
    buttonsRow: { flexDirection: "row" },
    btn: { height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    btnRow: { flex: 1 },
    btnText: { fontFamily: "Quicksand-Bold", fontSize: 15.5 },
});
