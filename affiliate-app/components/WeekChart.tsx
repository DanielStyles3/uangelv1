import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { Card, CardHeader } from '@/components/ui';
import type { CommissionPoint } from '@/lib/api';
import { formatNaira } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHART_HEIGHT = 110;
const MIN_BAR = 8;

export type WeekDay = { start: number; label: string; total: number; today: boolean };

/** Midnight (phone time) six days before `now`: the first day the chart shows. */
export const weekStart = (now: number) => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return d;
};

/** The last 7 days (today last), each with the sum of the commissions created that day. */
export const buildWeek = (points: CommissionPoint[], now: number): WeekDay[] => {
    const first = weekStart(now);
    const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(first);
        d.setDate(first.getDate() + i);
        return { start: d.getTime(), label: DAY_NAMES[d.getDay()], total: 0, today: i === 6 };
    });
    for (const p of points) {
        const d = new Date(p.created_at);
        if (Number.isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        const day = days.find((x) => x.start === d.getTime());
        const amount = Number(p.amount);
        if (day && Number.isFinite(amount)) day.total += amount;
    }
    return days;
};

type BarTone = 'today' | 'picked' | 'soft' | 'muted';

function Bar({ height, index, tone }: { height: number; index: number; tone: BarTone }) {
    const reduce = useReducedMotion();
    const grow = useSharedValue(0);

    useEffect(() => {
        grow.value = reduce
            ? withTiming(1, { duration: 220 })
            : withDelay(index * 60, withSpring(1, { mass: 1, damping: 15, stiffness: 150 }));
    }, [grow, index, reduce]);

    const style = useAnimatedStyle(() => (reduce ? { height, opacity: grow.value } : { height: height * grow.value }));

    return <Animated.View style={[styles.bar, tone === 'today' && styles.barToday, tone === 'picked' && styles.barPicked, tone === 'muted' && styles.barMuted, style]} />;
}

/** "This week": seven bars, today in orange. Tap a bar to read that day's amount. */
export default function WeekChart({ days, error }: { days: WeekDay[] | null; error?: string | null }) {
    const [picked, setPicked] = useState(6);

    const total = days ? days.reduce((sum, d) => sum + d.total, 0) : 0;
    const max = days ? Math.max(...days.map((d) => d.total)) : 0;
    const empty = !!days && total <= 0;
    const day = days?.[picked];

    return (
        <Card>
            <CardHeader
                title="This week"
                right={days && !empty ? <Text style={styles.total}>{formatNaira(total)} earned</Text> : null}
            />

            {/* key: the bars grow in once, when the numbers arrive */}
            <View style={styles.chart} key={days ? 'loaded' : 'loading'}>
                {(days ?? PLACEHOLDER).map((d, i) => {
                    const height = d.total > 0 && max > 0 ? Math.max(MIN_BAR, (d.total / max) * CHART_HEIGHT) : MIN_BAR;
                    return (
                        <Pressable
                            key={d.start}
                            style={styles.column}
                            onPress={() => setPicked(i)}
                            disabled={!days || empty}
                            accessibilityRole="button"
                            accessibilityLabel={`${d.today ? 'Today' : d.label}: ${formatNaira(d.total)}`}
                        >
                            <Bar
                                height={height}
                                index={i}
                                tone={d.total <= 0 ? 'muted' : d.today ? 'today' : i === picked ? 'picked' : 'soft'}
                            />
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.labels}>
                {(days ?? PLACEHOLDER).map((d, i) => (
                    <Text key={d.start} style={[styles.label, !!days && !empty && i === picked && styles.labelPicked, d.today && styles.labelToday]}>
                        {d.label}
                    </Text>
                ))}
            </View>

            {error ? (
                <Text style={styles.caption}>{error}</Text>
            ) : !days ? (
                <Text style={styles.caption}>Adding up your week…</Text>
            ) : empty ? (
                <Text style={styles.caption}>
                    Nothing yet this week. Share your code and your first earnings will show up here.
                </Text>
            ) : day ? (
                <Text style={styles.caption}>
                    {day.today ? 'Today' : day.label} · <Text style={styles.captionStrong}>{formatNaira(day.total)}</Text>
                </Text>
            ) : null}
        </Card>
    );
}

// Shown while loading: seven low, grey bars with blank labels.
const PLACEHOLDER: WeekDay[] = Array.from({ length: 7 }, (_, i) => ({ start: i, label: ' ', total: 0, today: false }));

const styles = StyleSheet.create({
    total: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: CHART_HEIGHT + 6 },
    column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { borderRadius: 8, backgroundColor: colors.bar },
    barToday: { backgroundColor: colors.orange },
    barPicked: { backgroundColor: colors.navy },
    barMuted: { backgroundColor: colors.track },
    labels: { flexDirection: 'row', gap: 10 },
    label: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, color: colors.grey },
    labelToday: { color: colors.orangeDark },
    labelPicked: { color: colors.navy },
    caption: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 18, color: colors.grey, textAlign: 'center' },
    captionStrong: { fontFamily: fonts.bold, color: colors.navy },
});
