import type { ChipTone, IconName } from '@/components/ui';

import type { Commission, Withdrawal } from './api';
import { formatShortDate } from './format';

/**
 * Where a commission is on its way to being withdrawable, in plain words:
 * Pending (paid, waiting for delivery) → On hold until <date> → Available (or Cancelled).
 */
export const commissionStatus = (c: Commission, now: number): { text: string; tone: ChipTone; icon: IconName } => {
    if (c.status === 'cancelled') return { text: 'Cancelled · order cancelled or refunded', tone: 'red', icon: 'close' };
    if (c.status === 'pending') return { text: 'Pending · paid, waiting for delivery', tone: 'amber', icon: 'time-outline' };
    const at = c.available_at ? new Date(c.available_at).getTime() : 0;
    if (at > now) return { text: `On hold until ${formatShortDate(c.available_at)}`, tone: 'blue', icon: 'hourglass-outline' };
    return { text: 'Available to withdraw', tone: 'green', icon: 'checkmark' };
};

export const withdrawalChip = (w: Withdrawal): { label: string; tone: ChipTone } => {
    if (w.status === 'paid') return { label: 'Paid', tone: 'green' };
    if (w.status === 'rejected') return { label: 'Not paid', tone: 'red' };
    return { label: 'Being checked', tone: 'amber' };
};
