// Invite & earn (the affiliate programme, see supabase/affiliates.sql).

/** Where the "U Angel Affiliates" app is downloaded (earnings and withdrawals live there). */
export const AFFILIATES_APP_URL = 'https://uangelfoods.com/affiliates';

/** The link a friend opens to sign up with this code. */
export const inviteLink = (code: string) => `https://uangelfoods.com/r/${code}`;

/** The message sent to WhatsApp and the system share sheet. */
export const inviteMessage = (code: string) =>
    `I order my food, cakes, drinks and groceries from U Angel Foods. Sign up with my code ${code} before your first order: ${inviteLink(code)}`;

/** 0.05 -> "5%" */
export const formatRate = (rate: number | null | undefined) => `${Math.round((rate ?? 0.05) * 1000) / 10}%`;
