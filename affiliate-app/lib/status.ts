import type { ChipTone } from '@/components/ui';

import type { Commission, Withdrawal } from './api';
import { formatShortDate } from './format';

/** Chip for a commission: Pending → On hold until <date> → Available (or Cancelled). */
export const commissionChip = (c: Commission, now: number): { label: string; tone: ChipTone; detail: string } => {
    if (c.status === 'cancelled') return { label: 'Cancelled', tone: 'red', detail: 'Order cancelled or refunded' };
    if (c.status === 'pending') return { label: 'Pending', tone: 'amber', detail: 'Paid · waiting for delivery' };
    const at = c.available_at ? new Date(c.available_at).getTime() : 0;
    if (at > now) return { label: `On hold until ${formatShortDate(c.available_at)}`, tone: 'blue', detail: 'Delivered' };
    return { label: 'Available', tone: 'green', detail: 'Delivered' };
};

export const withdrawalChip = (w: Withdrawal): { label: string; tone: ChipTone } => {
    if (w.status === 'paid') return { label: 'Paid', tone: 'green' };
    if (w.status === 'rejected') return { label: 'Not paid', tone: 'red' };
    return { label: 'Waiting to be paid', tone: 'amber' };
};
