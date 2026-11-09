import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { formatNaira } from "@/lib/format";
import { CartCustomization, OptionGroup } from "@/type";

const ORANGE = "#FD652A";
const PINK = "#9D174D";

/** What the customer has chosen: option value per 'single' group, text per 'text' group. */
export type OptionAnswers = { picks: Record<string, string>; texts: Record<string, string> };

/** Names of required questions that are still unanswered. */
export const missingRequired = (groups: OptionGroup[], a: OptionAnswers): string[] =>
    groups
        .filter((g) => g.required && (g.kind === 'single' ? !a.picks[g.id] : !(a.texts[g.id] ?? '').trim()))
        .map((g) => g.name);

/** The answers as cart lines (priced options + text), in question order. */
export const answersToCart = (groups: OptionGroup[], a: OptionAnswers): CartCustomization[] =>
    groups.flatMap((g): CartCustomization[] => {
        if (g.kind === 'single') {
            const v = g.option_values.find((x) => x.id === a.picks[g.id]);
            return v ? [{ id: v.id, name: `${g.name}: ${v.name}`, price: Number(v.price), type: 'option' }] : [];
        }
        const text = (a.texts[g.id] ?? '').trim();
        return text ? [{ id: g.id, name: `${g.name}: "${text}"`, price: 0, type: 'text', text }] : [];
    });

/** "Customise your cake" on the product page. Renders nothing for products without options. */
export default function ProductOptions({ groups, answers, onChange }: {
    groups: OptionGroup[];
    answers: OptionAnswers;
    onChange: (a: OptionAnswers) => void;
}) {
    if (!groups.length) return null;

    const pick = (groupId: string, valueId: string, required: boolean) => {
        Haptics.selectionAsync().catch(() => {});
        const same = answers.picks[groupId] === valueId;
        const picks = { ...answers.picks };
        if (same && !required) delete picks[groupId]; else picks[groupId] = valueId;
        onChange({ ...answers, picks });
    };
    const type = (groupId: string, text: string) => onChange({ ...answers, texts: { ...answers.texts, [groupId]: text } });

    return (
        <View style={styles.wrap}>
            <View style={styles.banner}>
                <Ionicons name="color-palette-outline" size={22} color={PINK} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.bannerTitle}>Customise your cake</Text>
                    <Text style={styles.bannerText}>Pick your size, flavour and design. The price updates as you go.</Text>
                </View>
            </View>

            {groups.map((g) => {
                const swatches = g.kind === 'single' && g.option_values.every((v) => !!v.swatch);
                return (
                    <View key={g.id} style={styles.group}>
                        <View style={styles.groupHead}>
                            <Text style={styles.groupName}>{g.name}</Text>
                            <Text style={[styles.badge, g.required && styles.badgeReq]}>{g.required ? 'Required' : 'Optional'}</Text>
                        </View>

                        {g.kind === 'text' ? (
                            <View>
                                <TextInput
                                    value={answers.texts[g.id] ?? ''}
                                    onChangeText={(t) => type(g.id, t)}
                                    placeholder={g.placeholder ?? ''}
                                    placeholderTextColor="#A0A0AB"
                                    maxLength={g.max_length ?? 300}
                                    multiline={(g.max_length ?? 300) > 80}
                                    style={[styles.input, (g.max_length ?? 300) > 80 && { minHeight: 80, textAlignVertical: 'top' }]}
                                    accessibilityLabel={g.name}
                                />
                                {g.max_length ? (
                                    <Text style={styles.count}>{(answers.texts[g.id] ?? '').length}/{g.max_length}</Text>
                                ) : null}
                            </View>
                        ) : swatches ? (
                            <View style={styles.swatchRow}>
                                {g.option_values.map((v) => {
                                    const on = answers.picks[g.id] === v.id;
                                    return (
                                        <TouchableOpacity key={v.id} onPress={() => pick(g.id, v.id, g.required)} style={styles.swatchItem}
                                            accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={v.name}>
                                            <View style={[styles.swatch, { backgroundColor: v.swatch! }, on && styles.swatchOn]} />
                                            <Text style={styles.swatchName} numberOfLines={2}>{v.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.optRow}>
                                {g.option_values.map((v) => {
                                    const on = answers.picks[g.id] === v.id;
                                    return (
                                        <TouchableOpacity key={v.id} onPress={() => pick(g.id, v.id, g.required)} activeOpacity={0.85}
                                            style={[styles.opt, on && styles.optOn]}
                                            accessibilityRole="radio" accessibilityState={{ checked: on }}
                                            accessibilityLabel={`${v.name}${Number(v.price) ? `, plus ${formatNaira(v.price)}` : ''}`}>
                                            <Text style={styles.optName}>{v.name}</Text>
                                            <Text style={[styles.optSub, on && { color: '#B35F00' }]}>
                                                {Number(v.price) ? `+${formatNaira(v.price)}` : 'Included'}{v.hint ? ` · ${v.hint}` : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 18, marginTop: 24 },
    banner: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FBE7EF', borderRadius: 18, padding: 14 },
    bannerTitle: { fontFamily: 'Quicksand-Bold', fontSize: 16, color: PINK },
    bannerText: { fontFamily: 'Quicksand-Medium', fontSize: 12.5, color: '#7a2347', marginTop: 2 },
    group: { gap: 10 },
    groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    groupName: { fontFamily: 'Quicksand-Bold', fontSize: 16, color: '#181C2E' },
    badge: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#878787', backgroundColor: '#F5F5F7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
    badgeReq: { color: '#C43E0E', backgroundColor: '#FFF1EA' },
    optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opt: { borderWidth: 1.5, borderColor: '#ECECF1', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
    optOn: { borderColor: ORANGE, backgroundColor: '#FFF3E6' },
    optName: { fontFamily: 'Quicksand-Bold', fontSize: 13.5, color: '#181C2E' },
    optSub: { fontFamily: 'Quicksand-SemiBold', fontSize: 11.5, color: '#878787', marginTop: 1 },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    swatchItem: { width: 62, alignItems: 'center', gap: 5 },
    swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
    swatchOn: { borderColor: ORANGE },
    swatchName: { fontFamily: 'Quicksand-SemiBold', fontSize: 11, color: '#4B4F63', textAlign: 'center' },
    input: { borderWidth: 1.5, borderColor: '#ECECF1', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Quicksand-Medium', fontSize: 14, color: '#181C2E', backgroundColor: '#fff' },
    count: { fontFamily: 'Quicksand-SemiBold', fontSize: 11, color: '#878787', textAlign: 'right', marginTop: 4 },
});
