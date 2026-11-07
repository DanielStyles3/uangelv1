// Formatting / validation helpers for a Nigerian audience.

/** ₦4,500 or ₦4,500.50 */
export const formatNaira = (amount: number | string | null | undefined) => {
    const value = Number(amount ?? 0);
    const hasKobo = Math.round(value * 100) % 100 !== 0;

    return `₦${value.toLocaleString('en-NG', {
        minimumFractionDigits: hasKobo ? 2 : 0,
        maximumFractionDigits: 2,
    })}`;
};

/** Accepts 08031234567, 8031234567, +2348031234567, 2348031234567 (spaces/dashes ignored). */
export const normalizeNigerianPhone = (input: string): string | null => {
    const digits = input.replace(/[\s()-]/g, '');
    const match = digits.match(/^(?:\+?234|0)?([789][01]\d{8})$/);
    return match ? `+234${match[1]}` : null;
};

/** +2348031234567 -> 0803 123 4567 */
export const formatNigerianPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const normalized = normalizeNigerianPhone(phone);
    if (!normalized) return phone;
    const local = `0${normalized.slice(4)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
};

export const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
