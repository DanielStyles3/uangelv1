import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Enter } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Button, Card, CardHeader, Chip, Field, IconBubble, Notice, SectionLabel } from '@/components/ui';
import { useAffiliate } from '@/lib/affiliate';
import { AffiliateSummary, getWithdrawals, requestWithdrawal, setBank, Withdrawal } from '@/lib/api';
import { errorMessage, formatDate, formatNaira, formatShortDate } from '@/lib/format';
import { withdrawalChip } from '@/lib/status';
import { colors, CONTACT, fonts, SPRING } from '@/lib/theme';

import { notify } from '@/lib/notice';
const MILESTONES = [5, 20, 50];

/** Amount as typed → number (commas and spaces ignored), NaN if not a number. */
const parseAmount = (text: string) => {
    const clean = text.replace(/[,\s₦]/g, '');
    return clean === '' ? NaN : Number(clean);
};

const amountText = (value: number | string) => {
    const n = Number(value);
    return n > 0 ? String(Math.round(n * 100) / 100) : '';
};

/** "10 Nov, 2:15 pm" */
const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${formatShortDate(iso)}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
};

const bankLine = (s: AffiliateSummary) => `${s.bank_name} ·· ${s.account_number?.slice(-4)}`;

export default function Payouts() {
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

    // The newest finished request, when it wasn't paid: show why.
    const latest = history?.[0];
    const rejected = !open && latest?.status === 'rejected' ? latest : null;
    const past = (history ?? []).filter((w) => w.status !== 'requested');

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([refresh(), loadHistory()]);
        } catch (e) {
            notify('Couldn’t refresh', errorMessage(e));
        } finally {
            setRefreshing(false);
        }
    };

    const cancelBankEdit = () => {
        setBankName(summary.bank_name ?? '');
        setAccountNumber(summary.account_number ?? '');
        setAccountName(summary.account_name ?? '');
        setEditingBank(false);
    };

    const saveBank = async () => {
        const bank = bankName.trim();
        const number = accountNumber.replace(/\D/g, '');
        const holder = accountName.trim();
        if (!bank) return notify('Bank name', 'Enter the name of your bank, e.g. GTBank or Opay.');
        if (number.length !== 10) return notify('Account number', 'Your account number must be 10 digits (NUBAN).');
        if (!holder) return notify('Account name', 'Enter the name on the account exactly as your bank shows it.');
        setSavingBank(true);
        try {
            await setBank(bank, number, holder);
            await refresh();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setEditingBank(false);
        } catch (e) {
            notify('Couldn’t save your bank details', errorMessage(e));
        } finally {
            setSavingBank(false);
        }
    };

    const submit = async () => {
        if (blocked) return notify('Withdrawals paused', 'Your affiliate account is on hold. Please contact us.');
        if (open) return notify('Already requested', 'You already have a withdrawal waiting to be paid.');
        if (!hasBank || editingBank) return notify('Bank details', 'Save your bank details first.');
        if (!Number.isFinite(value) || value <= 0) return notify('Amount', 'Enter how much you want to withdraw.');
        if (value < min) return notify('Amount too small', `The minimum withdrawal is ${formatNaira(min)}.`);
        if (value > available) return notify('Amount too big', `You can withdraw up to ${formatNaira(available)}.`);

        notify(
            `Withdraw ${formatNaira(value)}?`,
            `We’ll pay it into ${bankLine(summary)} (${summary.account_name}).`,
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
                            notify('Request sent', 'We’ll check it and send the money to your bank. You’ll see it marked Paid here.');
                        } catch (e) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                            notify('Couldn’t request withdrawal', errorMessage(e));
                        } finally {
                            setRequesting(false);
                        }
                    },
                },
            ],
        );
    };

    const canRequest = !blocked && hasBank && !editingBank && available >= min;
    const buttonTitle =
        available < min
            ? `You can withdraw from ${formatNaira(min)}`
            : Number.isFinite(value) && value > 0
                ? `Withdraw ${formatNaira(value)}`
                : 'Withdraw';

    const bankSection = (
        <Card style={styles.bankCard}>
            {editingBank ? (
                <>
                    <CardHeader title={hasBank ? 'Change bank account' : 'Add your bank account'} icon="business-outline" />
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
                        {hasBank ? <Button title="Cancel" variant="secondary" style={styles.flex} onPress={cancelBankEdit} /> : null}
                        <Button title={hasBank ? 'Save' : 'Save bank details'} loading={savingBank} onPress={saveBank} style={styles.flex} />
                    </View>
                </>
            ) : (
                <View style={styles.bankRow}>
                    <IconBubble name="business-outline" size={42} />
                    <View style={styles.flex}>
                        <Text style={styles.bankTitle} numberOfLines={1}>{bankLine(summary)}</Text>
                        <Text style={styles.bankSub} numberOfLines={1}>{summary.account_name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditingBank(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Change bank account">
                        <Text style={styles.link}>Change</Text>
                    </TouchableOpacity>
                </View>
            )}
        </Card>
    );

    const requestSection = open ? (
        <Card style={styles.gapLarge}>
            <View style={styles.trackerTop}>
                <View style={styles.flex}>
                    <SectionLabel>Withdrawal</SectionLabel>
                    <Text style={styles.trackerAmount}>{formatNaira(open.amount)}</Text>
                </View>
                <Chip large label="Being checked" tone="amber" />
            </View>
            <View>
                <TrackerStep state="done" title="Requested" sub={formatDateTime(open.created_at)} />
                <TrackerStep state="current" title="U Angel is checking it" sub="We review every payout before sending" />
                <TrackerStep state="todo" title="Paid by bank transfer" sub={hasBank ? `To ${bankLine(summary)}` : 'To your bank account'} last />
            </View>
            <Text style={styles.small}>You can request again once this one is done.</Text>
        </Card>
    ) : (
        <Card style={styles.gapLarge}>
            <View style={styles.trackerTop}>
                <View style={styles.flex}>
                    <SectionLabel>Withdraw</SectionLabel>
                    <View style={styles.amountRow}>
                        <Text style={styles.naira}>₦</Text>
                        <TextInput
                            value={amount}
                            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.greyLight}
                            style={styles.amountInput}
                            editable={!blocked}
                            accessibilityLabel="Amount to withdraw in naira"
                        />
                    </View>
                </View>
                {available >= min && value !== available ? (
                    <TouchableOpacity onPress={() => setAmount(amountText(available))} hitSlop={10} style={styles.fullBtn}>
                        <Text style={styles.fullText}>Use full balance</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            <Chip label={`Available ${formatNaira(available)} · minimum ${formatNaira(min)}`} tone={available >= min ? 'green' : 'grey'} />
            {Number(summary.on_hold) > 0 || Number(summary.pending) > 0 ? (
                <Text style={styles.small}>
                    {formatNaira(Number(summary.on_hold))} on hold and {formatNaira(Number(summary.pending))} pending will become available after delivery plus 7 days.
                </Text>
            ) : null}
            <Button title={buttonTitle} loading={requesting} disabled={!canRequest} onPress={submit} />
            <Text style={styles.small}>
                {!hasBank || editingBank
                    ? 'Save your bank details first, then request your withdrawal.'
                    : 'U Angel checks every request, then pays it into your bank by transfer. It shows as Paid here once the money is sent.'}
            </Text>
        </Card>
    );

    const friends = Number(summary.referrals) || 0;
    const nextGoal = MILESTONES.find((g) => friends < g);

    return (
        <Screen stack keyboard title="Withdraw" onBack={goBack} refreshing={refreshing} onRefresh={onRefresh}>
            {blocked ? (
                <Enter>
                    <Notice
                        tone="red"
                        icon="alert-circle-outline"
                        text={`Your affiliate account is on hold, so withdrawals are paused. Please contact us on WhatsApp ${CONTACT.whatsappDisplay}.`}
                    />
                </Enter>
            ) : null}

            {rejected ? (
                <Enter>
                    <Card style={styles.rejected}>
                        <View style={styles.rejectedTop}>
                            <IconBubble name="alert-circle-outline" bg={colors.redSoft} color={colors.red} />
                            <View style={styles.flex}>
                                <Text style={styles.rejectedTitle}>Your last request wasn’t paid</Text>
                                <Text style={styles.small}>
                                    {formatNaira(rejected.amount)} · requested {formatShortDate(rejected.created_at)}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.noteBox}>
                            <Text style={styles.noteLabel}>NOTE FROM U ANGEL</Text>
                            <Text style={styles.noteText}>
                                {rejected.admin_note?.trim() || 'No reason was given. Message us from the Profile tab and we’ll help.'}
                            </Text>
                        </View>
                        <Text style={styles.small}>The money is back in your available balance.</Text>
                    </Card>
                </Enter>
            ) : null}

            {/* No bank yet: ask for it first. Otherwise the request (or its tracker) leads. */}
            <Enter index={0}>{hasBank ? requestSection : bankSection}</Enter>
            <Enter index={1}>{hasBank ? bankSection : requestSection}</Enter>

            {/* Milestones: display only */}
            <Enter index={2}>
                <Card style={styles.gapLarge}>
                    <CardHeader
                        title="Milestones"
                        right={<Text style={styles.headerNote}>{friends} {friends === 1 ? 'friend' : 'friends'} joined</Text>}
                    />
                    {MILESTONES.map((goal, i) => {
                        const reached = friends >= goal;
                        const current = goal === nextGoal;
                        const name = i === 0 ? `First ${goal} friends` : `${goal} friends`;
                        return (
                            <View key={goal} style={styles.milestone}>
                                <View style={[styles.badge, reached ? styles.badgeDone : current ? styles.badgeCurrent : styles.badgeTodo]}>
                                    {reached ? (
                                        <Ionicons name="checkmark" size={18} color={colors.white} />
                                    ) : (
                                        <Text style={[styles.badgeText, current && styles.badgeTextCurrent]}>{goal}</Text>
                                    )}
                                </View>
                                <View style={styles.milestoneText}>
                                    <Text style={[styles.milestoneTitle, !reached && !current && styles.muted]}>
                                        {current ? `${name} · ${goal - friends} to go` : name}
                                    </Text>
                                    {reached ? (
                                        <Text style={styles.reached}>Reached</Text>
                                    ) : current ? (
                                        <ProgressBar ratio={friends / goal} />
                                    ) : (
                                        <Text style={styles.milestoneSub}>Coming up</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </Card>
            </Enter>

            {/* Past payouts */}
            <Enter index={3}>
                <Card style={styles.listCard}>
                    <Text style={styles.listTitle}>Past payouts</Text>
                    {historyError && !history ? (
                        <Text style={styles.listEmpty}>{historyError}</Text>
                    ) : !history ? (
                        <Text style={styles.listEmpty}>Loading…</Text>
                    ) : past.length === 0 ? (
                        <Text style={styles.listEmpty}>No payouts yet. When a withdrawal is paid, it’s listed here.</Text>
                    ) : (
                        past.map((w) => {
                            const chip = withdrawalChip(w);
                            return (
                                <View key={w.id} style={styles.historyRow}>
                                    <View style={styles.flex}>
                                        <Text style={styles.historyText}>
                                            {formatShortDate(w.created_at)} · {formatNaira(w.amount)}
                                        </Text>
                                        {w.status === 'paid' && w.processed_at ? (
                                            <Text style={styles.historySub}>Paid on {formatDate(w.processed_at)}</Text>
                                        ) : null}
                                        {w.admin_note ? <Text style={styles.historySub}>{w.admin_note}</Text> : null}
                                    </View>
                                    <Chip label={chip.label} tone={chip.tone} />
                                </View>
                            );
                        })
                    )}
                </Card>
            </Enter>
        </Screen>
    );
}

function TrackerStep({ state, title, sub, last }: { state: 'done' | 'current' | 'todo'; title: string; sub: string; last?: boolean }) {
    return (
        <View style={styles.step}>
            <View style={styles.rail}>
                <View style={[styles.dot, state === 'done' && styles.dotDone, state === 'current' && styles.dotCurrent]}>
                    {state === 'done' ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                {last ? null : <View style={[styles.railLine, state === 'done' && styles.railLineDone]} />}
            </View>
            <View style={[styles.stepText, !last && styles.stepGap]}>
                <Text style={[styles.stepTitle, state === 'todo' && styles.muted]}>{title}</Text>
                <Text style={styles.stepSub}>{sub}</Text>
            </View>
        </View>
    );
}

/** Fills once, gently, when the card appears. */
function ProgressBar({ ratio }: { ratio: number }) {
    const reduce = useReducedMotion();
    const fill = useSharedValue(0);
    const target = Math.max(0.03, Math.min(1, ratio));

    useEffect(() => {
        fill.value = reduce ? target : withDelay(260, withSpring(target, SPRING));
    }, [fill, target, reduce]);

    const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

    return (
        <View style={styles.track}>
            <Animated.View style={[styles.trackFill, style]} />
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gapLarge: { gap: 14 },
    muted: { color: colors.grey },
    small: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.grey },
    link: { fontFamily: fonts.bold, fontSize: 13, color: colors.orangeDark },

    // Tracker and request form
    trackerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    trackerAmount: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.navy },
    step: { flexDirection: 'row', gap: 14 },
    rail: { alignItems: 'center', width: 22 },
    dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D0D0D8', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    dotDone: { borderWidth: 0, backgroundColor: colors.orange },
    dotCurrent: { borderWidth: 6, borderColor: colors.orange },
    railLine: { flex: 1, width: 3, minHeight: 18, backgroundColor: colors.fieldBorder },
    railLineDone: { backgroundColor: colors.orange },
    stepText: { flex: 1 },
    stepGap: { paddingBottom: 16 },
    stepTitle: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: colors.navy },
    stepSub: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.grey },

    amountRow: { flexDirection: 'row', alignItems: 'center' },
    naira: { fontFamily: fonts.bold, fontSize: 30, color: colors.navy },
    amountInput: { flex: 1, fontFamily: fonts.bold, fontSize: 32, color: colors.navy, paddingVertical: 0, minHeight: 46 },
    fullBtn: { backgroundColor: colors.orangeSoft, borderRadius: 999, paddingHorizontal: 12, height: 36, justifyContent: 'center' },
    fullText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.orangeDark },

    // Rejected
    rejected: { borderColor: '#F7CACA' },
    rejectedTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rejectedTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
    noteBox: { backgroundColor: colors.redSoft, borderRadius: 14, padding: 12, gap: 4 },
    noteLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.red },
    noteText: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.navy },

    // Bank
    bankCard: { borderRadius: 22, gap: 14 },
    bankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bankTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.navy },
    bankSub: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.grey },
    bankButtons: { flexDirection: 'row', gap: 10 },

    // Milestones
    headerNote: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.grey },
    milestone: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    badgeDone: { backgroundColor: colors.whatsappDark },
    badgeCurrent: { backgroundColor: colors.orangeSoft },
    badgeTodo: { backgroundColor: colors.chip },
    badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.grey },
    badgeTextCurrent: { color: colors.orangeDark },
    milestoneText: { flex: 1, gap: 4 },
    milestoneTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
    milestoneSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.grey },
    reached: { fontFamily: fonts.semibold, fontSize: 12, color: colors.green },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden', marginTop: 2 },
    trackFill: { height: 8, borderRadius: 4, backgroundColor: colors.orange },

    // Past payouts
    listCard: { borderRadius: 22, paddingVertical: 6, gap: 0 },
    listTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy, paddingTop: 10, paddingBottom: 8 },
    listEmpty: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.grey, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line },
    historyText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },
    historySub: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: colors.grey },
});
