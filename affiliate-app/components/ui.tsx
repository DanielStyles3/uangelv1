import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ComponentRef, ReactNode, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

import { PressableScale } from '@/components/motion';
import { initials } from '@/lib/format';
import { cardShadow, colors, fonts } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Button ----------

type ButtonProps = {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'whatsapp';
    icon?: IconName;
    style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, style }: ButtonProps) {
    const off = disabled || loading;
    const textColor =
        variant === 'primary' || variant === 'whatsapp' ? colors.white : variant === 'ghost' ? colors.orange : colors.navy;
    return (
        <PressableScale
            onPress={onPress}
            disabled={off}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ disabled: !!off, busy: !!loading }}
            style={style}
        >
            <View
                style={[
                    styles.button,
                    variant === 'primary' && styles.buttonPrimary,
                    variant === 'whatsapp' && styles.buttonWhatsApp,
                    variant === 'secondary' && styles.buttonSecondary,
                    variant === 'outline' && styles.buttonOutline,
                    variant === 'ghost' && styles.buttonGhost,
                    disabled && !loading && styles.buttonDisabled,
                ]}
            >
                {loading ? (
                    <ActivityIndicator color={textColor} />
                ) : (
                    <View style={styles.buttonInner}>
                        {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
                        <Text style={[styles.buttonText, variant === 'outline' && styles.buttonTextSmall, { color: textColor }]} numberOfLines={1}>
                            {title}
                        </Text>
                    </View>
                )}
            </View>
        </PressableScale>
    );
}

// ---------- Text field ----------

type FieldProps = TextInputProps & {
    label: string;
    icon?: IconName;
    secure?: boolean;
    hint?: string;
};

export function Field({ label, icon, secure, hint, style, ...rest }: FieldProps) {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);
    const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

    return (
        <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TouchableOpacity
                activeOpacity={1}
                onPress={() => inputRef.current?.focus()}
                style={[styles.field, focused && styles.fieldFocused]}
            >
                {icon ? <Ionicons name={icon} size={18} color={focused ? colors.orange : colors.greyLight} /> : null}
                <TextInput
                    ref={inputRef}
                    placeholderTextColor={colors.greyLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    {...rest}
                    secureTextEntry={secure ? hidden : false}
                    onFocus={(e) => {
                        setFocused(true);
                        rest.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        rest.onBlur?.(e);
                    }}
                    style={[styles.input, style]}
                />
                {secure ? (
                    <TouchableOpacity
                        onPress={() => setHidden((h) => !h)}
                        hitSlop={10}
                        accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
                    >
                        <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.grey} />
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>
            {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
        </View>
    );
}

// ---------- Chip ----------

export type ChipTone = 'green' | 'amber' | 'blue' | 'red' | 'grey' | 'orange';

export const TONES: Record<ChipTone, { bg: string; fg: string }> = {
    green: { bg: colors.greenSoft, fg: colors.green },
    amber: { bg: colors.amberSoft, fg: colors.amber },
    blue: { bg: colors.blueSoft, fg: colors.blue },
    red: { bg: colors.redSoft, fg: colors.red },
    grey: { bg: colors.chip, fg: colors.grey },
    orange: { bg: colors.orangeSoft, fg: colors.orangeDark },
};

export function Chip({ label, tone, icon, large }: { label: string; tone: ChipTone; icon?: IconName; large?: boolean }) {
    const t = TONES[tone];
    return (
        <View style={[styles.chip, large && styles.chipLarge, { backgroundColor: t.bg }]}>
            {icon ? <Ionicons name={icon} size={large ? 14 : 12} color={t.fg} /> : null}
            <Text style={[styles.chipText, large && styles.chipTextLarge, { color: t.fg }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

// ---------- Layout bits ----------

/** White, rounded, hairline border, soft shadow: every section on a grey page sits in one of these. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

/** Card heading: bold title on the left, optional note or action on the right. */
export function CardHeader({ title, right, icon }: { title: string; right?: ReactNode; icon?: IconName }) {
    return (
        <View style={styles.cardHeader}>
            {icon ? <IconBubble name={icon} size={34} /> : null}
            <Text style={styles.cardTitle}>{title}</Text>
            {right}
        </View>
    );
}

export function SectionLabel({ children }: { children: string }) {
    return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

export function IconBubble({ name, bg = colors.orangeSoft, color = colors.orangeDark, size = 36 }: {
    name: IconName;
    bg?: string;
    color?: string;
    size?: number;
}) {
    return (
        <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 3, backgroundColor: bg }]}>
            <Ionicons name={name} size={size / 2} color={color} />
        </View>
    );
}

export function Avatar({ name, size = 44, bg = colors.orange, fg = colors.white }: {
    name: string;
    size?: number;
    bg?: string;
    fg?: string;
}) {
    return (
        <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: fg }}>{initials(name)}</Text>
        </View>
    );
}

export function Notice({ icon, text, tone = 'orange' }: { icon: IconName; text: string; tone?: ChipTone }) {
    const t = TONES[tone];
    return (
        <View style={[styles.notice, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={18} color={tone === 'orange' ? colors.orangeText : t.fg} style={styles.noticeIcon} />
            <Text style={[styles.noticeText, { color: tone === 'orange' ? colors.orangeText : t.fg }]}>{text}</Text>
        </View>
    );
}

export function BackButton({ onPress, light }: { onPress: () => void; light?: boolean }) {
    return (
        <PressableScale
            onPress={onPress}
            scaleTo={0.92}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.back, light ? styles.backLight : styles.backGrey]}
        >
            <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    button: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    buttonPrimary: { backgroundColor: colors.orange, boxShadow: '0px 8px 16px rgba(253, 101, 42, 0.28)' },
    buttonWhatsApp: { backgroundColor: colors.whatsappDark },
    buttonSecondary: { backgroundColor: colors.chip },
    buttonOutline: { height: 50, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.fieldBorder, paddingHorizontal: 12 },
    buttonGhost: { backgroundColor: 'transparent', height: 44 },
    buttonDisabled: { opacity: 0.45, boxShadow: 'none' },
    buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttonText: { fontFamily: fonts.bold, fontSize: 16, flexShrink: 1 },
    buttonTextSmall: { fontSize: 14 },

    fieldWrap: { gap: 6 },
    fieldLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 54,
        borderRadius: 16,
        backgroundColor: colors.field,
        borderWidth: 1.5,
        borderColor: colors.fieldBorder,
        paddingHorizontal: 14,
    },
    fieldFocused: { borderColor: colors.orange, backgroundColor: colors.white },
    input: { flex: 1, height: '100%', fontFamily: fonts.semibold, fontSize: 15, color: colors.navy, paddingVertical: 0 },
    fieldHint: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: colors.grey },

    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    chipLarge: { paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center' },
    chipText: { fontFamily: fonts.bold, fontSize: 11.5 },
    chipTextLarge: { fontSize: 12 },

    card: {
        backgroundColor: colors.white,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: 16,
        gap: 12,
        ...cardShadow,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
    sectionLabel: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.1, color: colors.grey },
    bubble: { alignItems: 'center', justifyContent: 'center' },

    notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
    noticeIcon: { marginTop: 1 },
    noticeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18 },

    back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    backLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder },
    backGrey: { backgroundColor: colors.chip },
});
