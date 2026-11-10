// Formatting helpers. Written by hand (not Intl) so they look the same on every Android phone.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** ₦12,345 or ₦12,345.50 */
export const formatNaira = (amount: number | string | null | undefined) => {
    const value = Number(amount ?? 0);
    const safe = Number.isFinite(value) ? value : 0;
    const negative = safe < 0;
    const kobo = Math.round(Math.abs(safe) * 100);
    const whole = Math.floor(kobo / 100);
    const rest = kobo % 100;
    const text = withCommas(String(whole)) + (rest ? `.${String(rest).padStart(2, '0')}` : '');
    return `${negative ? '-' : ''}₦${text}`;
};

/** 12 Nov 2026 */
export const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** 12 Nov (adds the year only when it isn't this year) */
export const formatShortDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
};

/** 0.05 → "5%", 0.075 → "7.5%" */
export const formatRate = (rate: number | string | null | undefined) => {
    const pct = Math.round(Number(rate ?? 0) * 1000) / 10;
    return `${pct}%`;
};

/** "Ada Okafor" → "AO" */
export const initials = (name: string) => {
    const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
};

/** Turns any thrown value (Supabase errors included) into a readable message. */
export const errorMessage = (e: unknown, fallback = 'Something went wrong. Please try again.') => {
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
        const msg = (e as { message: string }).message.trim();
        if (/network request failed|failed to fetch/i.test(msg)) return 'No internet connection. Check your data or Wi-Fi and try again.';
        return msg || fallback;
    }
    return fallback;
};
