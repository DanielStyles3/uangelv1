import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { FormQuestion } from "@/lib/appConfig";

const ORANGE = "#FD652A";
const INK = "#181C2E";

export type FormAnswers = Record<string, string | string[]>;

export const answerText = (q: FormQuestion, a: FormAnswers) => {
    const v = a[q.id];
    return Array.isArray(v) ? v.join(", ") : (v ?? "").trim();
};

/** The first required question that's still unanswered, if any. */
export const firstMissing = (qs: FormQuestion[], a: FormAnswers) => qs.find((q) => q.required && !answerText(q, a));

/** [{question, answer}] for saving (empty answers left out). */
export const answersForSave = (qs: FormQuestion[], a: FormAnswers) =>
    qs.map((q) => ({ question: q.question, answer: answerText(q, a) })).filter((x) => x.answer);

/**
 * Questions the admin added (Admin › App settings): pick one, pick any, or a box to type in.
 */
export default function FormQuestions({ questions, answers, onChange }: {
    questions: FormQuestion[];
    answers: FormAnswers;
    onChange: (a: FormAnswers) => void;
}) {
    if (!questions.length) return null;
    return (
        <View style={{ gap: 18 }}>
            {questions.map((q) => (
                <View key={q.id} style={{ gap: 8 }}>
                    <Text style={styles.q}>
                        {q.question}
                        <Text style={styles.opt}>{q.required ? "" : "  (optional)"}{q.kind === "multi" ? "  · tick all that apply" : ""}</Text>
                    </Text>
                    {q.kind === "text" ? (
                        <TextInput
                            value={(answers[q.id] as string) ?? ""}
                            onChangeText={(v) => onChange({ ...answers, [q.id]: v })}
                            placeholder={q.placeholder ?? ""}
                            placeholderTextColor="#A0A0AB"
                            multiline
                            maxLength={1000}
                            style={styles.input}
                            accessibilityLabel={q.question}
                        />
                    ) : (
                        <View style={styles.chips}>
                            {q.choices.map((c) => {
                                const cur = answers[q.id];
                                const on = q.kind === "multi" ? Array.isArray(cur) && cur.includes(c) : cur === c;
                                return (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.chip, on && styles.chipOn]}
                                        onPress={() => {
                                            Haptics.selectionAsync().catch(() => {});
                                            if (q.kind !== "multi") return onChange({ ...answers, [q.id]: cur === c && !q.required ? "" : c });
                                            const list = Array.isArray(cur) ? cur : [];
                                            onChange({ ...answers, [q.id]: list.includes(c) ? list.filter((x) => x !== c) : [...list, c] });
                                        }}
                                        accessibilityRole={q.kind === "multi" ? "checkbox" : "radio"}
                                        accessibilityState={{ checked: on }}
                                    >
                                        {on && <Ionicons name="checkmark-circle" size={15} color={ORANGE} />}
                                        <Text style={[styles.chipText, on && { color: ORANGE }]}>{c}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    q: { fontFamily: "Quicksand-Bold", fontSize: 15, color: INK },
    opt: { fontFamily: "Quicksand-SemiBold", fontSize: 12.5, color: "#878787" },
    input: { minHeight: 70, borderRadius: 14, backgroundColor: "#F5F5F7", paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Quicksand-SemiBold", fontSize: 15, color: INK, textAlignVertical: "top" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    // Long choices wrap inside the chip (never wider than the screen).
    chip: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: "#E4E4EA", backgroundColor: "#fff" },
    chipOn: { borderColor: ORANGE, backgroundColor: "#FFF4EE" },
    chipText: { flexShrink: 1, fontFamily: "Quicksand-Bold", fontSize: 13.5, lineHeight: 18, color: INK },
});
