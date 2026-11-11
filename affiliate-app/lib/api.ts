import { supabase } from './supabase';

// Contract: supabase/affiliates.sql (shared with the shopping app). Numbers can arrive as
// strings (Postgres numeric), so callers wrap them in Number() before maths.

export type Withdrawal = {
    id: string;
    amount: number | string;
    status: 'requested' | 'paid' | 'rejected';
    admin_note: string | null;
    created_at: string;
    processed_at: string | null;
};

export type Commission = {
    id: string;
    order_id: string;
    base_amount: number | string;
    rate: number | string;
    amount: number | string;
    status: 'pending' | 'earned' | 'cancelled';
    available_at: string | null;
    created_at: string;
};

export type AffiliateSummary = {
    /** null until an admin approves the application. */
    code: string | null;
    /** pending = applied, waiting for an admin; rejected = not approved (can apply again). */
    status: 'pending' | 'active' | 'blocked' | 'rejected';
    applied_at: string;
    reviewed_at: string | null;
    /** The admin's reason, when rejected or blocked. */
    review_note: string | null;
    rate: number | string;
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    pending: number | string;
    on_hold: number | string;
    available: number | string;
    withdrawn: number | string;
    total_earned: number | string;
    referrals: number;
    active_referrals: number;
    open_withdrawal: Withdrawal | null;
    min_withdrawal: number;
};

export type Referral = {
    customer: string;
    joined_at: string;
    expires_at: string;
    orders: number | string;
    earned: number | string;
};

const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
};

/** null = signed in but not an affiliate yet. */
export const getSummary = async (): Promise<AffiliateSummary | null> => {
    const { data, error } = await supabase.rpc('affiliate_summary');
    fail(error);
    return (data as AffiliateSummary | null) ?? null;
};

export const becomeAffiliate = async () => {
    const { error } = await supabase.rpc('become_affiliate');
    fail(error);
};

export const getReferrals = async (): Promise<Referral[]> => {
    const { data, error } = await supabase.rpc('affiliate_referrals');
    fail(error);
    return (data as Referral[] | null) ?? [];
};

export const getCommissions = async (limit = 30): Promise<Commission[]> => {
    const { data, error } = await supabase
        .from('commissions')
        .select('id, order_id, base_amount, rate, amount, status, available_at, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
    fail(error);
    return (data as Commission[] | null) ?? [];
};

export type CommissionPoint = Pick<Commission, 'amount' | 'created_at'>;

/** Commissions created since `sinceIso` that still count (not cancelled): feeds the weekly chart. */
export const getCommissionsSince = async (sinceIso: string): Promise<CommissionPoint[]> => {
    const { data, error } = await supabase
        .from('commissions')
        .select('amount, created_at')
        .gte('created_at', sinceIso)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1000);
    fail(error);
    return (data as CommissionPoint[] | null) ?? [];
};

export const getWithdrawals =async (): Promise<Withdrawal[]> => {
    const { data, error } = await supabase
        .from('withdrawals')
        .select('id, amount, status, admin_note, created_at, processed_at')
        .order('created_at', { ascending: false })
        .limit(50);
    fail(error);
    return (data as Withdrawal[] | null) ?? [];
};

export const setBank = async (bankName: string, accountNumber: string, accountName: string) => {
    const { error } = await supabase.rpc('set_affiliate_bank', {
        p_bank_name: bankName,
        p_account_number: accountNumber,
        p_account_name: accountName,
    });
    fail(error);
};

export const requestWithdrawal = async (amount: number) => {
    const { data, error } = await supabase.rpc('request_withdrawal', { p_amount: amount });
    fail(error);
    return data as string;
};

// ---------- Auth ----------

export const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        throw new Error(/invalid login credentials/i.test(error.message)
            ? 'That email and password don’t match. Check them and try again.'
            : error.message);
    }
};

/** Returns true when signed straight in, false when the email must be confirmed first. */
export const signUp = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    fail(error);
    return !!data.session;
};

/** Sign-up: the 6-digit code from the confirmation email. Confirms the email and signs in. */
export const verifySignupCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) {
        throw new Error(/expired|invalid/i.test(error.message)
            ? 'That code is wrong or has expired. Check the latest email, or tap "Resend code".'
            : error.message);
    }
};

export const resendSignupCode = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    fail(error);
};

export const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    fail(error);
};

export const resetPasswordWithCode = async (email: string, code: string, password: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) {
        throw new Error(/expired|invalid/i.test(error.message)
            ? 'That code is wrong or has expired. Check the email or send a new code.'
            : error.message);
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    fail(updateError);
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    fail(error);
};
