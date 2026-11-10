import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Button, Chip, Field, Notice } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { getWithdrawals, requestWithdrawal, setBank, Withdrawal } from '@/lib/api';
import { errorMessage, formatDate, formatNaira, formatShortDate } from '@/lib/format';
import { withdrawalChip } from '@/lib/status';
import { colors, fonts } from '@/lib/theme';

const STEPS = [
    'You request the withdrawal here',
    'U Angel checks it and pays it into your bank by transfer',
    'It shows as Paid below once the money is sent',
];

/** Amount as typed → number (commas and spaces ignored), NaN if not a number. */
const parseAmount = (text: string) => {
    const clean = text.replace(/[,\s₦]/g, '');
    return clean === '' ? NaN : Number(clean);
};

const amountText = (value: number | string) => {
    const n = Number(value);
    return n > 0 ? String(Math.round(n * 100) / 100) : '';
};

export default function Withdraw() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { summary, refresh } = useAffiliate();

    const [amount, setAmount] = useState(() => amountText(summary?.available ?? 0));
    const [editingBank, setEditingBank] = useState(() => !summary?.account_number);
    const [bankName, setBankName] = useState(summary?.bank_name ?? '');
    const [accountNumber, setAccountNumber] = useState(summary?.account_number ?? '');
    const [accountName, setAccountName] = useState(summary?.account_name ?? '');
    const [savingBank, setSavingBank] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [history, setHistory] = useState<Withdrawal[] | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadHistory = useCallback(async () => {
        try {
            setHistory(await getWithdrawals());
            setHistoryError(null);
        } catch (e) {
            setHistoryError(errorMessage(e));
        }
    }, []);

    useEffect(() => {
        let alive = true;
        getWithdrawals()
            .then((rows) => alive && setHistory(rows))
            .catch((e) => alive && setHistoryError(errorMessage(e)));
        return () => {
            alive = false;
        };
    }, []);

    if (!summary) return null;

    const available = Number(summary.available);
    const min = Number(summary.min_withdrawal) || 2000;
    const blocked = summary.status !== 'active';
    const open = summary.open_withdrawal;
    const hasBank = !!summary.account_number;
    const value = parseAmount(amount);
    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([refresh(), loadHistory()]);
        } catch (e) {
            Alert.alert('Couldn’t refresh', errorMessage(e));
        } finally {
            setRefreshing(false);
        }
    };

    const saveBank = async () => {
        const bank = bankName.trim();
        const number = accountNumber.replace(/\D/g, '');
        const holder = accountName.trim();
        if (!bank) return Alert.alert('Bank name', 'Enter the name of your bank, e.g. GTBank or Opay.');
        if (number.length !== 10) return Alert.alert('Account number', 'Your account number must be 10 digits (NUBAN).');
        if (!holder) return Alert.alert('Account name', 'Enter the name on the account exactly as your bank shows it.');
        setSavingBank(true);
        try {
            await setBank(bank, number, holder);
            await refresh();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setEditingBank(false);
        } catch (e) {
            Alert.alert('Couldn’t save your bank details', errorMessage(e));
        } finally {
            setSavingBank(false);
        }
    };

    const submit = async () => {
        if (blocked) return Alert.alert('Withdrawals paused', 'Your affiliate account is on hold. Please contact us.');
        if (open) return Alert.alert('Already requested', 'You already have a withdrawal waiting to be paid.');
        if (!hasBank || editingBank) return Alert.alert('Bank details', 'Save your bank details first.');
        if (!Number.isFinite(value) || value <= 0) return Alert.alert('Amount', 'Enter how much you want to withdraw.');
        if (value < min) return Alert.alert('Amount too small', `The minimum withdrawal is ${formatNaira(min)}.`);
        if (value > available) return Alert.alert('Amount too big', `You can withdraw up to ${formatNaira(available)}.`);

        Alert.alert(
            `Withdraw ${formatNaira(value)}?`,
            `We’ll pay it into ${summary.bank_name} ·· ${summary.account_number?.slice(-4)} (${summary.account_name}).`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Withdraw',
                    onPress: async () => {
                        setRequesting(true);
                        try {
                            await requestWithdrawal(value);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            await Promise.all([refresh(), loadHistory()]);
                            setAmount('');
                            Alert.alert('Request sent', 'We’ll check it and send the money to your bank. You’ll see it marked Paid here.');
                        } catch (e) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                            Alert.alert('Couldn’t request withdrawal', errorMessage(e));
                        } finally {
                            setRequesting(false);
                        }
                    },
                },
            ],
        );
    };

    const canRequest = !blocked && !open && hasBank && !editingBank && available >= min;
    const buttonTitle = open
        ? 'Withdrawal waiting to be paid'
        : available < min
            ? `You can withdraw from ${formatNaira(min)}`
            : Number.isFinite(value) && value > 0
                ? `Withdraw ${formatNaira(value)}`
                : 'Withdraw';

    return (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <BackButton onPress={goBack} />
                <Text style={styles.h1}>Withdraw</Text>
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} colors={[colors.orange]} />}
            >
                {blocked ? (
                    <Notice
                        tone="red"
                        icon="alert-circle-outline"
                        text="Your affiliate account is on hold, so withdrawals are paused. Please contact us on WhatsApp 0704 905 5555."
                    />
                ) : null}

                {/* Amount */}
                <View style={styles.amountBlock}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.naira}>₦</Text>
                        <TextInput
                            value={amount}
                            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.greyLight}
                            style={styles.amountInput}
                            editable={!open && !blocked}
                            accessibilityLabel="Amount to withdraw in naira"
                        />
                    </View>
                    <Chip
                        label={`Available ${formatNaira(available)} · minimum ${formatNaira(min)}`}
                        tone={available >= min ? 'green' : 'grey'}
                    />
                    {available >= min && !open && value !== available ? (
                        <TouchableOpacity onPress={() => setAmount(amountText(available))} hitSlop={8}>
                            <Text style={styles.link}>Use full balance</Text>
                        </TouchableOpacity>
                    ) : null}
                    {Number(summary.on_hold) > 0 || Number(summary.pending) > 0 ? (
                        <Text style={styles.small}>
                            {formatNaira(Number(summary.on_hold))} on hold and {formatNaira(Number(summary.pending))} pending will become available after delivery plus 7 days.
                        </Text>
                    ) : null}
                </View>

                {open ? (
                    <Notice
                        tone="amber"
                        icon="time-outline"
                        text={`You requested ${formatNaira(open.amount)} on ${formatDate(open.created_at)}. It’s waiting to be paid; you can request again once it’s done.`}
                    />
                ) : null}

                {/* Bank */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pay into</Text>
                    {editingBank ? (
                        <View style={styles.bankForm}>
                            <Field label="Bank name" icon="business-outline" placeholder="e.g. GTBank, Opay, Access" value={bankName} onChangeText={setBankName} autoCapitalize="words" />
                            <Field
                                label="Account number"
                                icon="keypad-outline"
                                placeholder="10 digits"
                                value={accountNumber}
                                onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                                keyboardType="number-pad"
                                maxLength={10}
                            />
                            <Field
                                label="Account name"
                                icon="person-outline"
                                placeholder="Name on the account"
                                value={accountName}
                                onChangeText={setAccountName}
                                autoCapitalize="characters"
                                hint="Use the name exactly as your bank shows it, or the payment may fail."
                            />
                            <View style={styles.bankButtons}>
                                {hasBank ? (
                                    <Button
                                        title="Cancel"
                                        variant="secondary"
                                        style={styles.flex}
                                        onPress={() => {
                                            setBankName(summary.bank_name ?? '');
                                            setAccountNumber(summary.account_number ?? '');
                                            setAccountName(summary.account_name ?? '');
                                            setEditingBank(false);
                                        }}
                                    />
                                ) : null}
                                <Button title="Save bank details" loading={savingBank} onPress={saveBank} style={styles.flex} />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.bankCard}>
                            <View style={styles.bankIcon}>
                                <Ionicons name="business-outline" size={20} color={colors.orange} />
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.bankTitle}>
                                    {summary.bank_name} ·· {summary.account_number?.slice(-4)}
                                </Text>
                                <Text style={styles.bankSub}>{summary.account_name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setEditingBank(true)} hitSlop={8}>
                                <Text style={styles.link}>Change</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* What happens next */}
                <View style={styles.next}>
                    <Text style={styles.kicker}>WHAT HAPPENS NEXT</Text>
                    {STEPS.map((s, i) => (
                        <View key={s} style={styles.nextRow}>
                            <View style={styles.num}>
                                <Text style={styles.numText}>{i + 1}</Text>
                            </View>
                            <Text style={styles.nextText}>{s}</Text>
                        </View>
                    ))}
                </View>

                {/* History */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Past withdrawals</Text>
                    {historyError ? (
                        <Text style={styles.small}>{historyError}</Text>
                    ) : !history ? (
                        <Text style={styles.small}>Loading…</Text>
                    ) : history.length === 0 ? (
                        <Text style={styles.small}>No withdrawals yet.</Text>
                    ) : (
                        history.map((w, i) => {
                            const chip = withdrawalChip(w);
                            return (
                                <View key={w.id} style={[styles.historyRow, i < history.length - 1 && styles.historyBorder]}>
                                    <View style={styles.flex}>
                                        <Text style={styles.historyText}>
                                            {formatShortDate(w.created_at)} · {formatNaira(w.amount)}
                                        </Text>
                                        {w.status === 'paid' && w.processed_at ? (
                                            <Text style={styles.small}>Paid on {formatDate(w.processed_at)}</Text>
                                        ) : null}
                                        {w.admin_note ? <Text style={styles.small}>{w.admin_note}</Text> : null}
                                    </View>
                                    <Chip label={chip.label} tone={chip.tone} />
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
                <Button title={buttonTitle} loading={requesting} disabled={!canRequest} onPress={submit} />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.white },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
    h1: { fontFamily: fonts.bold, fontSize: 19, color: colors.navy },
    content: { paddingHorizontal: 20, paddingTop: 14, gap: 20 },

    amountBlock: { alignItems: 'center', gap: 8 },
    amountLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.grey },
    amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    naira: { fontFamily: fonts.bold, fontSize: 40, color: colors.navy },
    amountInput: { fontFamily: fonts.bold, fontSize: 44, color: colors.navy, minWidth: 60, paddingVertical: 0, textAlign: 'center' },
    link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.orange },
    small: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.grey, textAlign: 'left' },

    section: { gap: 10 },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    bankForm: { gap: 14 },
    bankButtons: { flexDirection: 'row', gap: 10 },
    bankCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 2,
        borderColor: colors.orange,
        backgroundColor: colors.orangeTint,
        borderRadius: 18,
        padding: 14,
    },
    bankIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    bankTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    bankSub: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.grey },

    next: { backgroundColor: colors.bg, borderRadius: 18, padding: 14, gap: 12 },
    kicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.grey },
    nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
    numText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
    nextText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },

    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    historyBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
    historyText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },

    bottom: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 12,
        paddingHorizontal: 20,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
