import type { ChipTone, IconName } from '@/components/ui';

import type { CommissionStatus, OrderStatus, Withdrawal } from './api';
import { formatDate, formatShortDate } from './format';

/** The fields a commission's state depends on (a commissions row or an order's commission). */
type CommissionLike = {
    status: CommissionStatus;
    available_at: string | null;
    reviewed_at: string | null;
};

export type CommissionState = 'none' | 'waiting' | 'reviewing' | 'confirmed' | 'ready' | 'cancelled';

export const commissionState = (c: CommissionLike | null | undefined, now: number): CommissionState => {
    if (!c) return 'none';
    if (c.status === 'cancelled') return 'cancelled';
    if (c.status === 'pending') return 'waiting';
    if (!c.reviewed_at) return 'reviewing';
    const at = c.available_at ? new Date(c.available_at).getTime() : 0;
    return at > now ? 'confirmed' : 'ready';
};

/**
 * Where a commission is on its way to being withdrawable, in plain words:
 * Waiting for delivery → Being reviewed (U Angel Foods checks it) → Confirmed · ready on <date> → Ready to withdraw
 * (or Cancelled). `null` = the order earns no commission.
 */
export const commissionStatus = (c: CommissionLike | null | undefined, now: number): { text: string; tone: ChipTone; icon: IconName } => {
    switch (commissionState(c, now)) {
        case 'none':
            return { text: 'No commission', tone: 'grey', icon: 'remove-circle-outline' };
        case 'cancelled':
            return { text: 'Cancelled (order cancelled or refunded)', tone: 'red', icon: 'close' };
        case 'waiting':
            return { text: 'Waiting for delivery', tone: 'amber', icon: 'time-outline' };
        case 'reviewing':
            return { text: 'Being reviewed', tone: 'blue', icon: 'search-outline' };
        case 'confirmed':
            return { text: `Confirmed · ready on ${formatShortDate(c?.available_at)}`, tone: 'blue', icon: 'hourglass-outline' };
        default:
            return { text: 'Ready to withdraw', tone: 'green', icon: 'checkmark' };
    }
};

/** A longer explanation of the commission's state, for the order detail screen. */
export const commissionExplainer = (c: CommissionLike | null | undefined, now: number): string => {
    switch (commissionState(c, now)) {
        case 'none':
            return 'This order has nothing that earns commission (for example, only Christmas giving packs).';
        case 'cancelled':
            return 'The order was cancelled or refunded, so this commission no longer counts.';
        case 'waiting':
            return 'The order is paid but not delivered yet. This amount is an estimate until it’s delivered and checked.';
        case 'reviewing':
            return 'U Angel Foods checks every order’s margin and confirms your commission. It’s an estimate until then.';
        case 'confirmed':
            return `Confirmed on ${formatDate(c?.reviewed_at)}. Withdrawable from ${formatDate(c?.available_at)}.`;
        default:
            return `Confirmed on ${formatDate(c?.reviewed_at)}. It’s in your balance, ready to withdraw.`;
    }
};

export const orderStatusChip = (s: OrderStatus): { label: string; tone: ChipTone } => {
    switch (s) {
        case 'delivered':
            return { label: 'Delivered', tone: 'green' };
        case 'cancelled':
            return { label: 'Cancelled', tone: 'red' };
        case 'on_the_way':
            return { label: 'On the way', tone: 'blue' };
        case 'preparing':
            return { label: 'Preparing', tone: 'amber' };
        case 'confirmed':
            return { label: 'Confirmed', tone: 'amber' };
        default:
            return { label: 'Order placed', tone: 'grey' };
    }
};

export const withdrawalChip = (w: Withdrawal): { label: string; tone: ChipTone } => {
    if (w.status === 'paid') return { label: 'Paid', tone: 'green' };
    if (w.status === 'rejected') return { label: 'Not paid', tone: 'red' };
    return { label: 'Being checked', tone: 'amber' };
};
