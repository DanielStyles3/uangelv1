import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { cleanOptionName, optionColour, RAINBOW, rainbowBands } from "@/lib/colours";
import { formatNaira } from "@/lib/format";
import { CartCustomization, OptionGroup } from "@/type";

const ORANGE = "#FD652A";
const INK = "#181C2E";

/** A round colour sample; rainbow is drawn as stripes. */
const Swatch = ({ colour, size }: { colour: string; size: number }) =>
    colour === RAINBOW ? (
        <View style={[styles.swatchBase, { width: size, height: size, borderRadius: size / 2, flexDirection: 'row' }]}>
            {rainbowBands.map((c) => <View key={c} style={{ flex: 1, backgroundColor: c }} />)}
        </View>
    ) : (
        <View style={[styles.swatchBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: colour }]} />
    );

/** What the customer has chosen: option value per 'single' group, text per 'text' group. */
export type OptionAnswers = { picks: Record<string, string>; texts: Record<string, string> };

// ---------------------------------------------------------------------------
// Number cakes: the customer types a number; one number-shaped cake per digit. The admin prices
// each digit count with choices named "1 digit", "2 digits"… (same rule as the server).
// ---------------------------------------------------------------------------
const digitsOf = (name: string) => Number(/^\s*(\d+)/.exec(name)?.[1] ?? NaN);
export const digitTiers = (g: OptionGroup) =>
    g.option_values
        .map((v) => ({ ...v, digits: digitsOf(v.name) }))
        .filter((v) => Number.isFinite(v.digits) && v.digits > 0)
        .sort((a, b) => a.digits - b.digits);
/** "007" → "7"; anything that isn't digits → "". */
const cleanNumber = (s: string) => {
    const t = s.trim();
    if (!/^\d+$/.test(t)) return '';
    return t.replace(/^0+(?=\d)/, '');
};
const numberTier = (g: OptionGroup, typed: string) => {
    const n = cleanNumber(typed);
    return n ? digitTiers(g).find((t) => t.digits === n.length) : undefined;
};
const cakesLabel = (k: number) => `${k} number-shaped cake${k === 1 ? '' : 's'}`;

/** Questions customers can actually answer: a "choose one" question with no choices yet is skipped. */
export const answerableGroups = (groups: OptionGroup[]) =>
    groups.filter((g) => g.kind !== 'single' || (g.option_values?.length ?? 0) > 0);

/** Names of required questions that are still unanswered (or a number we can't make). */
export const missingRequired = (groups: OptionGroup[], a: OptionAnswers): string[] =>
    groups
        .filter((g) => {
            const typed = (a.texts[g.id] ?? '').trim();
            if (g.kind === 'number') return (g.required || !!typed) && !numberTier(g, typed);
            return g.required && (g.kind === 'single' ? !a.picks[g.id] : !typed);
        })
        .map((g) => (g.kind === 'number' ? 'the number' : g.name));

/** The answers as cart lines (priced options, the number, text), in question order. */
export const answersToCart = (groups: OptionGroup[], a: OptionAnswers): CartCustomization[] =>
    groups.flatMap((g): CartCustomization[] => {
        if (g.kind === 'single') {
            const v = g.option_values.find((x) => x.id === a.picks[g.id]);
            return v ? [{ id: v.id, name: `${g.name}: ${cleanOptionName(v.name)}`, price: Number(v.price), type: 'option' }] : [];
        }
        if (g.kind === 'number') {
            const n = cleanNumber(a.texts[g.id] ?? '');
            const tier = numberTier(g, n);
            return tier ? [{ id: g.id, name: `Number: ${n} (${cakesLabel(n.length)})`, price: Number(tier.price), type: 'number', text: n }] : [];
        }
        const text = (a.texts[g.id] ?? '').trim();
        return text ? [{ id: g.id, name: `${g.name}: "${text}"`, price: 0, type: 'text', text }] : [];
    });

/** Numbered step header: "1  Size ............ Required". */
export const StepHeader = ({ step, title, required, right }: { step: number; title: string; required?: boolean; right?: string }) => (
    <View style={styles.head}>
        <View style={styles.stepDot}><Text style={styles.stepNum}>{step}</Text></View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {right ? <Text style={styles.right} numberOfLines={1}>{right}</Text> : null}
        {required !== undefined && (
            <Text style={[styles.badge, required && styles.badgeReq]}>{required ? 'Required' : 'Optional'}</Text>
        )}
    </View>
);

/**
 * "Make it yours" steps on the product page (size, flavour, message…), numbered from
 * `startStep`. Renders nothing for products without options.
 */
export default function ProductOptions({ groups, answers, onChange, startStep = 1 }: {
    groups: OptionGroup[];
    answers: OptionAnswers;
    onChange: (a: OptionAnswers) => void;
    startStep?: number;
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
        <View style={{ gap: 26 }}>
            {groups.map((g, gi) => {
                const step = startStep + gi;
                // Colour from the swatch, or worked out from the name ("🟢 Green" → green); names without emoji.
                const values = g.option_values.map((v) => ({ ...v, name: cleanOptionName(v.name), colour: optionColour(v.name, v.swatch) }));
                const swatches = g.kind === 'single' && values.length > 0 && values.every((v) => !!v.colour);
                const chosen = g.kind === 'single' ? values.find((v) => v.id === answers.picks[g.id]) : undefined;

                if (g.kind === 'number') {
                    const tiers = digitTiers(g);
                    const maxDigits = tiers.length ? tiers[tiers.length - 1].digits : 2;
                    const typed = cleanNumber(answers.texts[g.id] ?? '');
                    const tier = numberTier(g, typed);
                    return (
                        <View key={g.id} style={styles.group}>
                            <StepHeader step={step} title={g.name} required={g.required} />
                            <View style={[styles.numberBox, typed && tier ? styles.numberBoxOn : null]}>
                                <TextInput
                                    value={answers.texts[g.id] ?? ''}
                                    // Digits only, never longer than the biggest number the bakers make.
                                    onChangeText={(t) => type(g.id, t.replace(/\D/g, '').slice(0, maxDigits))}
                                    placeholder={g.placeholder || (maxDigits > 1 ? 'e.g. 5 or 25' : 'e.g. 5')}
                                    placeholderTextColor="#B5B5BF"
                                    keyboardType="number-pad"
                                    maxLength={maxDigits}
                                    style={styles.numberInput}
                                    accessibilityLabel={g.name}
                                />
                            </View>
                            {typed ? (
                                <Text style={[styles.numberNote, !tier && { color: '#B91C1C' }]}>
                                    {tier
                                        ? `${typed} → ${cakesLabel(typed.length)}${Number(tier.price) ? ` · +${formatNaira(tier.price)}` : ''}`
                                        : `We make numbers up to ${maxDigits} digit${maxDigits === 1 ? '' : 's'}`}
                                </Text>
                            ) : null}
                            {tiers.length > 0 && (
                                <View style={styles.cardGrid}>
                                    {tiers.map((t) => {
                                        const on = !!tier && tier.id === t.id;
                                        return (
                                            <View key={t.id} style={[styles.card, styles.tierCard, { width: tiers.length <= 3 ? `${100 / tiers.length - 2}%` as `${number}%` : '48.4%' }, on && styles.cardOn]}>
                                                {on && <View style={styles.cardTick}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                                                <Text style={styles.cardName}>{t.digits === 1 ? 'Single digit' : t.digits === 2 ? 'Two digits' : `${t.digits} digits`}</Text>
                                                <Text style={styles.cardHint}>{t.digits === 1 ? 'e.g. 5' : t.digits === 2 ? 'e.g. 25' : `e.g. ${'1'.padEnd(t.digits, '0')}`} · {cakesLabel(t.digits)}</Text>
                                                <Text style={styles.cardPrice}>{Number(t.price) ? `+${formatNaira(t.price)}` : 'Included'}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    );
                }

                if (g.kind === 'text') {
                    const max = g.max_length ?? 300;
                    const value = answers.texts[g.id] ?? '';
                    const long = max > 80;
                    return (
                        <View key={g.id} style={styles.group}>
                            <StepHeader step={step} title={g.name} required={g.required} />
                            <View style={[styles.inputRow, long && { alignItems: 'flex-start', paddingTop: 12 }]}>
                                <Ionicons name="create-outline" size={20} color="#878787" />
                                <TextInput
                                    value={value}
                                    onChangeText={(t) => type(g.id, t)}
                                    placeholder={g.placeholder ?? ''}
                                    placeholderTextColor="#A0A0AB"
                                    maxLength={max}
                                    multiline={long}
                                    style={[styles.input, long && { minHeight: 70, textAlignVertical: 'top' }]}
                                    accessibilityLabel={g.name}
                                />
                                {g.max_length ? <Text style={styles.count}>{value.length}/{g.max_length}</Text> : null}
                            </View>
                        </View>
                    );
                }

                if (swatches) {
                    return (
                        <View key={g.id} style={styles.group}>
                            <StepHeader step={step} title={g.name} required={g.required} right={chosen?.name} />
                            <View style={styles.swatchRow}>
                                {values.map((v) => {
                                    const on = answers.picks[g.id] === v.id;
                                    return (
                                        <TouchableOpacity key={v.id} onPress={() => pick(g.id, v.id, g.required)} style={styles.swatchItem}
                                            accessibilityRole="radio" accessibilityState={{ checked: on }}
                                            accessibilityLabel={`${v.name}${Number(v.price) ? `, plus ${formatNaira(v.price)}` : ''}`}>
                                            <View style={[styles.swatchRing, on && styles.swatchRingOn]}>
                                                <Swatch colour={v.colour!} size={40} />
                                            </View>
                                            <Text style={[styles.swatchName, on && { color: INK }]} numberOfLines={2}>{v.name}</Text>
                                            {Number(v.price) ? <Text style={styles.swatchPrice}>+{formatNaira(v.price)}</Text> : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                }

                // Cards: 3 across for short lists (sizes), 2 across otherwise.
                const cols = values.length <= 3 ? 3 : 2;
                return (
                    <View key={g.id} style={styles.group}>
                        <StepHeader step={step} title={g.name} required={g.required} />
                        <View style={styles.cardGrid}>
                            {values.map((v) => {
                                const on = answers.picks[g.id] === v.id;
                                return (
                                    <TouchableOpacity key={v.id} onPress={() => pick(g.id, v.id, g.required)} activeOpacity={0.85}
                                        style={[styles.card, { width: cols === 3 ? '31.6%' : '48.4%' }, on && styles.cardOn]}
                                        accessibilityRole="radio" accessibilityState={{ checked: on }}
                                        accessibilityLabel={`${v.name}${Number(v.price) ? `, plus ${formatNaira(v.price)}` : ''}`}>
                                        {on && (
                                            <View style={styles.cardTick}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                                        )}
                                        <View style={styles.cardNameRow}>
                                            {v.colour ? <Swatch colour={v.colour} size={16} /> : null}
                                            <Text style={styles.cardName} numberOfLines={2}>{v.name}</Text>
                                        </View>
                                        {v.hint ? <Text style={styles.cardHint} numberOfLines={2}>{v.hint}</Text> : null}
                                        <Text style={styles.cardPrice}>{Number(v.price) ? `+${formatNaira(v.price)}` : 'Included'}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    group: { gap: 12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
    stepNum: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#fff' },
    title: { flex: 1, fontFamily: 'Quicksand-Bold', fontSize: 17, color: INK },
    right: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#5B5B66', maxWidth: 120 },
    badge: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#5B5B66', backgroundColor: '#F3F3F6', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    badgeReq: { color: '#C2410C', backgroundColor: '#FFF1EA' },

    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    card: { minHeight: 88, borderRadius: 18, borderWidth: 1.5, borderColor: '#E4E4EA', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 10, gap: 3 },
    cardOn: { borderWidth: 2, borderColor: ORANGE, backgroundColor: '#FFF4EE' },
    cardTick: { position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
    cardName: { fontFamily: 'Quicksand-Bold', fontSize: 15, color: INK, textAlign: 'center' },
    cardHint: { fontFamily: 'Quicksand-SemiBold', fontSize: 11.5, color: '#5B5B66', textAlign: 'center' },
    cardPrice: { fontFamily: 'Quicksand-Bold', fontSize: 12.5, color: '#C2410C' },

    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatchItem: { width: 70, alignItems: 'center', gap: 6 },
    swatchRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: ORANGE },
    swatchBase: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    swatchName: { fontFamily: 'Quicksand-Bold', fontSize: 11.5, color: '#5B5B66', textAlign: 'center' },
    swatchPrice: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#C2410C' },

    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 16, backgroundColor: '#F5F5F7', paddingHorizontal: 14 },
    input: { flex: 1, fontFamily: 'Quicksand-SemiBold', fontSize: 16, color: INK, paddingVertical: 10 },
    count: { fontFamily: 'Quicksand-SemiBold', fontSize: 12, color: '#5B5B66' },

    numberBox: { height: 84, borderRadius: 20, backgroundColor: '#F5F5F7', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    numberBoxOn: { borderColor: ORANGE, backgroundColor: '#FFF4EE' },
    numberInput: { width: '100%', textAlign: 'center', fontFamily: 'Quicksand-Bold', fontSize: 40, color: INK, paddingVertical: 0 },
    numberNote: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#C2410C', textAlign: 'center' },
    tierCard: { minHeight: 96 },
});
