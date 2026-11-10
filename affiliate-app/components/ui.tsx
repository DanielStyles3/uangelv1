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

import { colors, fonts } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Button ----------

type ButtonProps = {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost';
    icon?: IconName;
    style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, loading, disabled, variant = 'primary', icon, style }: ButtonProps) {
    const off = disabled || loading;
    const primary = variant === 'primary';
    const textColor = primary ? colors.white : variant === 'secondary' ? colors.navy : colors.orange;
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={off}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!off, busy: !!loading }}
            style={[
                styles.button,
                primary && styles.buttonPrimary,
                variant === 'secondary' && styles.buttonSecondary,
                variant === 'ghost' && styles.buttonGhost,
                disabled && !loading && styles.buttonDisabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <View style={styles.buttonInner}>
                    {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
                    <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
                </View>
            )}
        </TouchableOpacity>
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

const TONES: Record<ChipTone, { bg: string; fg: string }> = {
    green: { bg: colors.greenSoft, fg: colors.green },
    amber: { bg: colors.amberSoft, fg: colors.amber },
    blue: { bg: colors.blueSoft, fg: colors.blue },
    red: { bg: colors.redSoft, fg: colors.red },
    grey: { bg: colors.chip, fg: colors.grey },
    orange: { bg: colors.orangeSoft, fg: colors.orangeDark },
};

export function Chip({ label, tone }: { label: string; tone: ChipTone }) {
    const t = TONES[tone];
    return (
        <View style={[styles.chip, { backgroundColor: t.bg }]}>
            <Text style={[styles.chipText, { color: t.fg }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

// ---------- Layout bits ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
    return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

export function IconBubble({ name, bg = colors.orangeSoft, color = colors.orange, size = 36 }: {
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

export function Notice({ icon, text, tone = 'orange' }: { icon: IconName; text: string; tone?: ChipTone }) {
    const t = TONES[tone];
    return (
        <View style={[styles.notice, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={18} color={t.fg} />
            <Text style={[styles.noticeText, { color: tone === 'orange' ? colors.orangeText : t.fg }]}>{text}</Text>
        </View>
    );
}

export function BackButton({ onPress, light }: { onPress: () => void; light?: boolean }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityLabel="Back"
            style={[styles.back, { backgroundColor: light ? colors.white : colors.chip }]}
        >
            <Ionicons name="chevron-back" size={22} color={colors.navy} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: { height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    buttonPrimary: {
        backgroundColor: colors.orange,
        shadowColor: colors.orange,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    buttonSecondary: { backgroundColor: colors.chip },
    buttonGhost: { backgroundColor: 'transparent', height: 44 },
    buttonDisabled: { opacity: 0.45, elevation: 0, shadowOpacity: 0 },
    buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttonText: { fontFamily: fonts.bold, fontSize: 16 },

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
    fieldHint: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },

    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
    chipText: { fontFamily: fonts.bold, fontSize: 11.5 },

    card: { backgroundColor: colors.white, borderRadius: 22, padding: 16, gap: 12 },
    sectionLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.grey },
    bubble: { alignItems: 'center', justifyContent: 'center' },

    notice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
    noticeText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },

    back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
