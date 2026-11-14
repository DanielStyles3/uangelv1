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

/**
 * Numbered step header. The title wraps to as many lines as it needs; the Required / Optional
 * badge (and the chosen value, if given) sit on their own line under it so they never squeeze it.
 */
export const StepHeader = ({ step, title, required, right }: { step: number; title: string; required?: boolean; right?: string }) => (
    <View style={styles.head}>
        <View style={styles.stepDot}><Text style={styles.stepNum}>{step}</Text></View>
        <View style={styles.headBody}>
            <Text style={styles.title}>{title}</Text>
            {(required !== undefined || right) ? (
                <View style={styles.metaRow}>
                    {required === true && (
                        <View style={[styles.badge, styles.badgeReq]}>
                            <View style={styles.badgeDot} />
                            <Text style={[styles.badgeText, styles.badgeTextReq]}>Required</Text>
                        </View>
                    )}
                    {required === false && <Text style={styles.optional}>Optional</Text>}
                    {right ? (
                        <View style={styles.rightPill}>
                            <Ionicons name="checkmark" size={12} color="#C2410C" />
                            <Text style={styles.right}>{right}</Text>
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    </View>
);

/** Long labels (or many choices) read better as a full-width list than a cramped grid. */
const LONG_LABEL = 14;
const wantsList = (values: { name: string; hint?: string | null }[]) =>
    values.length > 6 || values.some((v) => v.name.length > LONG_LABEL || (v.hint?.length ?? 0) > 30);

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
                                            <View key={t.id} style={[styles.card, styles.tierCard, { width: tiers.length <= 3 ? `${100 / tiers.length - 2.2}%` as `${number}%` : '48.4%' }, on && styles.cardOn]}>
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
                    // Long answers get a roomy box with new lines; a long placeholder also needs a
                    // multiline box so it wraps instead of being cut (but Enter still just closes the keyboard).
                    const long = max > 80;
                    const multi = long || max > 40 || (g.placeholder ?? '').length > 28;
                    return (
                        <View key={g.id} style={styles.group}>
                            <StepHeader step={step} title={g.name} required={g.required} />
                            <View style={[styles.inputRow, multi && styles.inputRowMulti]}>
                                <Ionicons name="create-outline" size={20} color="#878787" style={multi ? { marginTop: 1 } : undefined} />
                                <TextInput
                                    value={value}
                                    onChangeText={(t) => type(g.id, long ? t : t.replace(/\n/g, ' '))}
                                    placeholder={g.placeholder ?? ''}
                                    placeholderTextColor="#A0A0AB"
                                    maxLength={max}
                                    multiline={multi}
                                    submitBehavior={multi && !long ? 'blurAndSubmit' : undefined}
                                    returnKeyType={multi && !long ? 'done' : undefined}
                                    style={[styles.input, multi && styles.inputMulti, long && { minHeight: 76 }]}
                                    accessibilityLabel={g.name}
                                />
                            </View>
                            {g.max_length ? (
                                <Text style={[styles.count, value.length >= g.max_length && { color: '#C2410C' }]}>
                                    {value.length}/{g.max_length}
                                </Text>
                            ) : null}
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
                                            <Text style={[styles.swatchName, on && { color: INK }]}>{v.name}</Text>
                                            {Number(v.price) ? <Text style={styles.swatchPrice}>+{formatNaira(v.price)}</Text> : null}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                }

                const label = (v: (typeof values)[number]) => `${v.name}${Number(v.price) ? `, plus ${formatNaira(v.price)}` : ''}`;

                // Long names or many choices: a full-width list, radio on the left, price on the right.
                if (wantsList(values)) {
                    return (
                        <View key={g.id} style={styles.group}>
                            <StepHeader step={step} title={g.name} required={g.required} />
                            <View style={styles.list}>
                                {values.map((v) => {
                                    const on = answers.picks[g.id] === v.id;
                                    return (
                                        <TouchableOpacity key={v.id} onPress={() => pick(g.id, v.id, g.required)} activeOpacity={0.85}
                                            style={[styles.row, on && styles.rowOn]}
                                            accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label(v)}>
                                            <View style={[styles.radio, on && styles.radioOn]}>
                                                {on && <View style={styles.radioDot} />}
                                            </View>
                                            <View style={styles.rowBody}>
                                                <View style={styles.rowNameLine}>
                                                    {v.colour ? <Swatch colour={v.colour} size={16} /> : null}
                                                    <Text style={styles.rowName}>{v.name}</Text>
                                                </View>
                                                {v.hint ? <Text style={styles.rowHint}>{v.hint}</Text> : null}
                                            </View>
                                            <Text style={[styles.rowPrice, !Number(v.price) && styles.rowPriceFree]}>
                                                {Number(v.price) ? `+${formatNaira(v.price)}` : 'Included'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                }

                // Short names: a grid. 3 across only when every name is really short (sizes), else 2.
                const cols = values.length <= 3 && values.every((v) => v.name.length <= 9) ? 3 : 2;
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
                                        accessibilityLabel={label(v)}>
                                        {on && (
                                            <View style={styles.cardTick}><Ionicons name="checkmark" size={12} color="#fff" /></View>
                                        )}
                                        <View style={styles.cardNameRow}>
                                            {v.colour ? <Swatch colour={v.colour} size={16} /> : null}
                                            <Text style={styles.cardName}>{v.name}</Text>
                                        </View>
                                        {v.hint ? <Text style={styles.cardHint}>{v.hint}</Text> : null}
                                        <Text style={[styles.cardPrice, !Number(v.price) && styles.rowPriceFree]}>{Number(v.price) ? `+${formatNaira(v.price)}` : 'Included'}</Text>
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
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    headBody: { flex: 1, minWidth: 0, gap: 5 },
    stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', marginTop: -1 },
    stepNum: { fontFamily: 'Quicksand-Bold', fontSize: 13, color: '#fff' },
    title: { fontFamily: 'Quicksand-Bold', fontSize: 17, lineHeight: 23, color: INK },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    badgeReq: { backgroundColor: '#FFF1EA' },
    badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
    badgeText: { fontFamily: 'Quicksand-Bold', fontSize: 11.5 },
    badgeTextReq: { color: '#C2410C' },
    optional: { fontFamily: 'Quicksand-SemiBold', fontSize: 12.5, color: '#8A8A94' },
    rightPill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    right: { flexShrink: 1, fontFamily: 'Quicksand-Bold', fontSize: 12.5, color: '#C2410C' },

    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    card: { minHeight: 88, borderRadius: 18, borderWidth: 1.5, borderColor: '#E4E4EA', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingTop: 18, paddingBottom: 12, gap: 3 },
    cardOn: { borderWidth: 2, borderColor: ORANGE, backgroundColor: '#FFF4EE' },
    cardTick: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
    cardName: { flexShrink: 1, fontFamily: 'Quicksand-Bold', fontSize: 15, lineHeight: 19, color: INK, textAlign: 'center' },
    cardHint: { fontFamily: 'Quicksand-SemiBold', fontSize: 11.5, lineHeight: 15, color: '#5B5B66', textAlign: 'center' },
    cardPrice: { fontFamily: 'Quicksand-Bold', fontSize: 12.5, color: '#C2410C', marginTop: 1 },

    list: { gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#E4E4EA', backgroundColor: '#fff' },
    rowOn: { borderColor: ORANGE, backgroundColor: '#FFF4EE' },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C9C9D1', alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: ORANGE },
    radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: ORANGE },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowName: { flex: 1, fontFamily: 'Quicksand-Bold', fontSize: 15, lineHeight: 20, color: INK },
    rowHint: { fontFamily: 'Quicksand-SemiBold', fontSize: 12, lineHeight: 16, color: '#5B5B66' },
    rowPrice: { fontFamily: 'Quicksand-Bold', fontSize: 13.5, color: '#C2410C', textAlign: 'right' },
    rowPriceFree: { color: '#8A8A94' },

    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
    swatchItem: { width: 70, alignItems: 'center', gap: 6 },
    swatchRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    swatchRingOn: { borderColor: ORANGE },
    swatchBase: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' },
    cardNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    swatchName: { fontFamily: 'Quicksand-Bold', fontSize: 11.5, color: '#5B5B66', textAlign: 'center' },
    swatchPrice: { fontFamily: 'Quicksand-Bold', fontSize: 11, color: '#C2410C' },

    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 16, backgroundColor: '#F5F5F7', borderWidth: 1.5, borderColor: '#ECECF0', paddingHorizontal: 14 },
    inputRowMulti: { alignItems: 'flex-start', paddingTop: 13, paddingBottom: 3 },
    input: { flex: 1, minWidth: 0, fontFamily: 'Quicksand-SemiBold', fontSize: 16, color: INK, paddingVertical: 12 },
    inputMulti: { minHeight: 48, paddingTop: 0, paddingBottom: 10, lineHeight: 22, textAlignVertical: 'top' },
    count: { alignSelf: 'flex-end', marginTop: -6, fontFamily: 'Quicksand-SemiBold', fontSize: 12, color: '#8A8A94' },

    numberBox: { height: 84, borderRadius: 20, backgroundColor: '#F5F5F7', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    numberBoxOn: { borderColor: ORANGE, backgroundColor: '#FFF4EE' },
    numberInput: { width: '100%', textAlign: 'center', fontFamily: 'Quicksand-Bold', fontSize: 40, color: INK, paddingVertical: 0 },
    numberNote: { fontFamily: 'Quicksand-Bold', fontSize: 14, color: '#C2410C', textAlign: 'center' },
    tierCard: { minHeight: 96 },
});
