import { supabase } from "@/lib/supabase";
import {
    Category,
    CreateUserParams,
    Customization,
    GetMenuParams,
    MenuItem,
    NewServiceRequest,
    OptionGroup,
    Order,
    Promotion,
    ServiceRequest,
    PlaceOrderParams,
    ProfileUpdate,
    SignInParams,
    SubcategoryWithCount,
    User,
} from "@/type";

// Also embed the product's subcategory photo: products without their own photo
// (until the admin uploads one) show their subcategory's picture instead.
const MENU_COLUMNS = 'id, name, description, image_url, emoji, price, rating, calories, protein, is_available, is_campaign, category_id, delivery_fee, delivery_note, created_at, categories(image_url)';

type MenuRow = MenuItem & { categories?: { image_url: string | null } | null };
const withFallbackPhoto = ({ categories, ...item }: MenuRow): MenuItem => ({
    ...item,
    image_url: item.image_url ?? categories?.image_url ?? null,
});
const CATEGORY_COLUMNS = 'id, name, description, parent_id, emoji, color, image_url, sort_order, delivery_note, kind, enquiry_only, created_at';
const PROFILE_COLUMNS = 'id, name, email, avatar, phone, address, city, state, landmark, delivery_phone, created_at';
const ORDER_COLUMNS = 'id, user_id, status, payment_method, payment_status, paystack_reference, paid_at, subtotal, delivery_fee, total, online_amount, balance_due, balance_collected_at, delivery_address, city, state, phone, note, created_at';

// Supabase returns { data, error }; turn errors into thrown Errors so callers can try/catch.
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
    if (error) throw new Error(error.message);
    if (data === null) throw new Error('No data returned');
    return data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const createUser = async ({ email, password, name, referralCode }: CreateUserParams & { referralCode?: string }) => {
    const code = (referralCode ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Read by the handle_new_user() trigger: profiles.name, and the affiliate referral
        // (supabase/affiliates.sql) — a code here links the new customer to the affiliate.
        options: { data: code ? { name, referral_code: code } : { name } },
    });

    if (error) throw new Error(error.message);

    // With "Confirm email" enabled in Supabase, sign-up succeeds but no session is returned yet.
    return { needsEmailConfirmation: !data.session };
}

/** Sign-up: the 6-digit code from the confirmation email. Confirms the email and signs in. */
export const verifySignupCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Check the latest email, or tap "Resend code".' : error.message);
}

/** Sends the sign-up confirmation email (with a new code) again. */
export const resendSignupCode = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
}

/** Is this affiliate code real? Returns the affiliate's first name (or null) when valid. */
export const checkReferralCode = async (code: string): Promise<{ valid: boolean; firstName: string | null }> => {
    const { data, error } = await supabase.rpc('referral_code_info', { p_code: code });
    if (error) throw new Error(error.message);
    const row = (data as { valid: boolean; first_name: string | null }[] | null)?.[0];
    return { valid: !!row?.valid, firstName: row?.first_name ?? null };
}

/** The signed-in customer's referral (null if none). */
export const getMyReferral = async (): Promise<{ code: string; created_at: string } | null> => {
    const { data } = await supabase.from('referrals').select('code, created_at').maybeSingle();
    return (data as { code: string; created_at: string } | null) ?? null;
}

/** Add a referral code after signing up (new customers only; the server checks the rules). */
export const applyReferralCode = async (code: string): Promise<string> => {
    const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code });
    if (error) throw new Error(error.message);
    return data as string;
}

/** What the Invite screen needs from affiliate_summary() (supabase/affiliates.sql). */
export interface AffiliateSummary {
    /** null until an admin approves the application. */
    code: string | null;
    /** pending = applied, waiting for an admin; rejected = not approved (can apply again). */
    status: 'pending' | 'active' | 'blocked' | 'rejected';
    /** The admin's reason when not approved. */
    review_note: string | null;
    /** Commission rate as a fraction, e.g. 0.05 for 5%. */
    rate: number;
    /** From paid orders that are not delivered yet. */
    pending: number;
    on_hold: number;
    available: number;
    withdrawn: number;
    /** Everything earned from delivered orders, withdrawn or not. */
    total_earned: number;
    /** Friends who signed up with the code. */
    referrals: number;
}

/** The signed-in customer's affiliate application / invite code and earnings, or null when they haven't applied. */
export const getAffiliateSummary = async (): Promise<AffiliateSummary | null> => {
    const { data, error } = await supabase.rpc('affiliate_summary');
    if (error) throw new Error(error.message);
    const s = data as Partial<AffiliateSummary> | null;
    if (!s?.status) return null;
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const status = (['pending', 'active', 'blocked', 'rejected'] as const).find((x) => x === s.status) ?? 'pending';
    return {
        code: status === 'active' || status === 'blocked' ? s.code ?? null : null,
        status,
        review_note: s.review_note ?? null,
        rate: num(s.rate) || 0.05,
        pending: num(s.pending),
        on_hold: num(s.on_hold),
        available: num(s.available),
        withdrawn: num(s.withdrawn),
        total_earned: num(s.total_earned),
        referrals: num(s.referrals),
    };
}

/** Applies to the affiliate programme (or re-applies after a rejection). An admin approves it; the code comes then. */
export const becomeAffiliate = async (): Promise<void> => {
    const { error } = await supabase.rpc('become_affiliate');
    if (error) throw new Error(error.message);
}

export const signIn = async ({ email, password }: SignInParams) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
}

/** Emails a 6-digit password reset code (Supabase "Reset password" template uses {{ .Token }}). */
export const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
}

/** Checks the emailed code, then sets the new password (the code signs the user in). */
export const resetPasswordWithCode = async (email: string, code: string, password: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) {
        throw new Error(/expired|invalid/i.test(error.message)
            ? 'That code is wrong or has expired. Check the email or send a new code.'
            : error.message);
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw new Error(updateError.message);
}

/**
 * Signs the user in from the link in the reset email. Handles both the implicit flow
 * (#access_token=...&refresh_token=...) and the PKCE flow (?code=...).
 */
export const createSessionFromUrl = async (url: string) => {
    const [beforeHash, hash = ''] = url.split('#');
    const query = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
    const params = new URLSearchParams(`${query}&${hash}`);

    const errorDescription = params.get('error_description');
    if (errorDescription) throw new Error(errorDescription.replace(/\+/g, ' '));

    const code = params.get('code');
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw new Error(error.message);
        return true;
    }

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw new Error(error.message);
        return true;
    }

    return false;
}

export const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const authUser = session.user;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', authUser.id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (profile) return profile as User;

    // Profile is normally created by the sign-up trigger; recover if it's missing
    // (e.g. the user signed up before the trigger existed).
    const fallbackName = (authUser.user_metadata?.name as string | undefined) || authUser.email?.split('@')[0] || 'User';

    // Plain insert (not upsert): customers can't UPDATE id/email on profiles.
    return unwrap(
        await supabase
            .from('profiles')
            .insert({ id: authUser.id, name: fallbackName, email: authUser.email ?? '' })
            .select(PROFILE_COLUMNS)
            .single()
    ) as User;
}

export const updateProfile = async (userId: string, changes: ProfileUpdate): Promise<User> => {
    return unwrap(
        await supabase.from('profiles').update(changes).eq('id', userId).select(PROFILE_COLUMNS).single()
    ) as User;
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/**
 * `category` may be a subcategory id (its products) or a main category id
 * (products in all of its subcategories).
 */
export const getMenu = async ({ category, query, limit }: GetMenuParams): Promise<MenuItem[]> => {
    // The Christmas giving pack is only reached from the Christmas page, never listed.
    let request = supabase.from('menu').select(MENU_COLUMNS).eq('is_campaign', false).order('name');

    if (category) {
        const { data: children, error } = await supabase.from('categories').select('id').eq('parent_id', category);
        if (error) throw new Error(error.message);
        request = request.in('category_id', [category, ...(children ?? []).map((c) => c.id)]);
    }
    if (query) request = request.ilike('name', `%${query.replace(/[%_]/g, '\\$&')}%`);
    if (limit) request = request.limit(Number(limit));

    return (unwrap(await request) as unknown as MenuRow[]).map(withFallbackPhoto);
}

/**
 * Live Home banners, in the admin's order. Never throws: on any error (e.g. the table
 * doesn't exist yet) it returns [] and Home falls back to its built-in banners.
 */
export const getPromotions = async (): Promise<Promotion[]> => {
    const { data, error } = await supabase
        .from('promotions')
        .select('id, eyebrow, title, cta, image_url, color, link_type, link_id')
        .order('sort_order')
        .limit(8);
    if (error) return [];
    return (data ?? []) as Promotion[];
}

/** Admin-editable content (Admin › Website & app / Promotions). Null if missing or offline. */
export type ChristmasBanner = { enabled?: boolean; eyebrow?: string; title?: string; cta?: string; image_url?: string };
export type AuthScreenContent = { photos?: string[] };

export const getSiteSetting = async <T,>(key: string): Promise<T | null> => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
    if (error || !data) return null;
    return data.value as T;
}

export const getChristmasBanner = () => getSiteSetting<ChristmasBanner>('christmas_banner');
export const getAuthScreenContent = () => getSiteSetting<AuthScreenContent>('app_auth');

/** Christmas pre-order campaign: paid orders so far (0 if unavailable). */
export const getCampaignProgress = async (): Promise<number> => {
    const { data, error } = await supabase.rpc('campaign_progress');
    if (error) return 0;
    return Number(data) || 0;
}

export type HomeProduct = MenuItem & { main_category_id: string | null };

/**
 * Every product, best-rated first, tagged with its MAIN category — one request that
 * feeds Home's "Top rated" row and its per-category rows.
 */
export const getHomeProducts = async (): Promise<HomeProduct[]> => {
    type Row = MenuItem & { categories?: { image_url: string | null; parent_id: string | null } | null };
    const rows = unwrap(
        await supabase.from('menu')
            .select('id, name, description, image_url, emoji, price, rating, calories, protein, is_available, category_id, created_at, categories(image_url, parent_id)')
            .eq('is_campaign', false)
            .order('rating', { ascending: false, nullsFirst: false })
            .order('name')
            .limit(500)
    ) as unknown as Row[];

    return rows.map(({ categories, ...item }) => ({
        ...item,
        image_url: item.image_url ?? categories?.image_url ?? null,
        // Products sit in a subcategory; its parent is the main category (or it IS one).
        main_category_id: categories?.parent_id ?? item.category_id,
    }));
}

/**
 * Christmas pre-order products (menu.is_campaign, set in Admin › Products): no delivery,
 * shown only on the Christmas page, each one bought counts toward the goal. Cheapest first.
 */
export const getCampaignProducts = async (): Promise<MenuItem[]> => {
    const { data, error } = await supabase.from('menu').select(MENU_COLUMNS).eq('is_campaign', true).order('price');
    if (error || !data) return [];
    return (data as unknown as MenuRow[]).map(withFallbackPhoto);
}

export const getMenuItem = async ({ id }: { id: string }): Promise<MenuItem> => {
    return withFallbackPhoto(unwrap(
        await supabase.from('menu').select(MENU_COLUMNS).eq('id', id).single()
    ) as unknown as MenuRow);
}

// Only the toppings/sides linked to this menu item via menu_customizations.
export const getMenuItemCustomizations = async ({ id }: { id: string }): Promise<Customization[]> => {
    const rows = unwrap(
        await supabase
            .from('menu_customizations')
            .select('customizations (id, name, price, type, created_at)')
            .eq('menu_id', id)
    ) as unknown as { customizations: Customization | null }[];

    return rows
        .map((row) => row.customizations)
        .filter((c): c is Customization => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Customise your cake" questions for a product, in order (empty for most products). */
export const getProductOptions = async ({ id }: { id: string }): Promise<OptionGroup[]> => {
    const { data, error } = await supabase
        .from('option_groups')
        .select('id, menu_id, name, kind, required, max_length, placeholder, sort_order, option_values (id, group_id, name, price, hint, swatch, sort_order)')
        .eq('menu_id', id)
        .order('sort_order');
    if (error) return [];   // e.g. before schema.sql adds the tables: the product just has no options
    return ((data ?? []) as OptionGroup[]).map((g) => ({
        ...g,
        option_values: [...(g.option_values ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }));
}

/**
 * Ids of products that need choices before they can go in the cart (e.g. cakes: size, flavour).
 * Quick "+" buttons open the product page for these instead of adding straight away.
 */
let requiredOptionIds: Promise<Set<string>> | null = null;
export const getProductsNeedingChoices = (): Promise<Set<string>> => {
    if (!requiredOptionIds) {
        requiredOptionIds = (async () => {
            const [opts, enquiry] = await Promise.all([
                supabase.from('option_groups').select('menu_id').eq('required', true),
                // Made-to-order products (Wedding Cakes): "+" opens the page with "Send an enquiry".
                supabase.from('menu').select('id, categories!inner(enquiry_only)').eq('categories.enquiry_only', true),
            ]);
            if (opts.error) { requiredOptionIds = null; return new Set<string>(); }
            return new Set([
                ...(opts.data ?? []).map((r: { menu_id: string }) => r.menu_id),
                ...(enquiry.data ?? []).map((r: { id: string }) => r.id),
            ]);
        })();
    }
    return requiredOptionIds;
}

/** The 7 main categories (Home cards, Search filter chips), in display order. */
export const getCategories = async (): Promise<Category[]> => {
    return unwrap(
        await supabase.from('categories').select(CATEGORY_COLUMNS).is('parent_id', null).order('sort_order')
    ) as Category[];
}

export const getCategory = async ({ id }: { id: string }): Promise<Category> => {
    return unwrap(
        await supabase.from('categories').select(CATEGORY_COLUMNS).eq('id', id).single()
    ) as Category;
}

/** Subcategories of a main category, each with how many products it has. */
export const getSubcategories = async ({ parentId }: { parentId: string }): Promise<SubcategoryWithCount[]> => {
    const rows = unwrap(
        await supabase
            .from('categories')
            .select(`${CATEGORY_COLUMNS}, menu (count)`)
            .eq('parent_id', parentId)
            .order('sort_order')
    ) as unknown as (Category & { menu: { count: number }[] })[];

    // How many options sit under each one (e.g. Catering › Events › Wedding Parties).
    const ids = rows.map((r) => r.id);
    const childCount: Record<string, number> = {};
    if (ids.length) {
        const { data } = await supabase.from('categories').select('parent_id').in('parent_id', ids);
        (data ?? []).forEach((c: { parent_id: string }) => { childCount[c.parent_id] = (childCount[c.parent_id] ?? 0) + 1; });
    }

    return rows.map(({ menu, ...category }) => ({
        ...category,
        product_count: menu?.[0]?.count ?? 0,
        child_count: childCount[category.id] ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Orders (writes go through the place_order / cancel_order database functions)
// ---------------------------------------------------------------------------

/**
 * Delivery fee for a cart: ₦5,000 if any product is from Groceries & Essentials or
 * The Local Market, else ₦2,000. For display; place_order() charges the real fee.
 */
export const getDeliveryFee = async (menuIds: string[]): Promise<number> => {
    const { data, error } = await supabase.rpc('delivery_fee_for', { p_menu_ids: menuIds });
    if (error) throw new Error(error.message);
    return Number(data);
}

/**
 * Creates the order as 'awaiting_payment'; pay it with openPayment() (lib/payments.ts → app/pay.tsx).
 * 'pay_on_delivery': only the delivery fee is paid online; the items are paid to the rider.
 */
export const placeOrder = async ({ items, address, city, state, phone, note, paymentMethod = 'paystack' }: PlaceOrderParams): Promise<string> => {
    const { data, error } = await supabase.rpc('place_order', {
        p_items: items.map((item) => {
            const all = item.customizations ?? [];
            return {
                menu_id: item.id,
                quantity: item.quantity,
                customization_ids: all.filter((c) => c.type !== 'option' && c.type !== 'text').map((c) => c.id),
                option_ids: all.filter((c) => c.type === 'option').map((c) => c.id),
                texts: all.filter((c) => c.type === 'text').map((c) => ({ group_id: c.id, text: c.text ?? '' })),
            };
        }),
        p_address: address,
        p_city: city,
        p_state: state,
        p_phone: phone,
        p_payment_method: paymentMethod,
        p_note: note ?? null,
    });

    if (error) throw new Error(error.message);
    return data as string;
}

export const getOrders = async (): Promise<Order[]> => {
    return unwrap(
        await supabase
            .from('orders')
            .select(`${ORDER_COLUMNS}, order_items (id, menu_id, name, quantity, image_url)`)
            .order('created_at', { ascending: false })
    ) as unknown as Order[];
}

export const getOrder = async ({ id }: { id: string }): Promise<Order> => {
    return unwrap(
        await supabase
            .from('orders')
            .select(`${ORDER_COLUMNS}, order_items (id, order_id, menu_id, name, image_url, unit_price, quantity, customizations, line_total)`)
            .eq('id', id)
            .single()
    ) as unknown as Order;
}

/** Counts for the Profile stats card (RLS limits both to the signed-in user). */
export const getProfileStats = async (): Promise<{ orders: number; requests: number }> => {
    const [orders, requests] = await Promise.all([
        // Same as the lists the customer sees: no unpaid checkouts, nothing cancelled.
        supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '(awaiting_payment,cancelled)'),
        supabase.from('service_requests').select('id', { count: 'exact', head: true }).neq('status', 'cancelled'),
    ]);
    if (orders.error) throw new Error(orders.error.message);
    if (requests.error) throw new Error(requests.error.message);
    return { orders: orders.count ?? 0, requests: requests.count ?? 0 };
}

// ---------------------------------------------------------------------------
// Service requests (Catering, Events & Celebrations)
// ---------------------------------------------------------------------------

export const createServiceRequest = async (request: NewServiceRequest): Promise<string> => {
    const { data, error } = await supabase.from('service_requests').insert(request).select('id').single();
    if (error) throw new Error(error.message);
    return data.id as string;
}

export const getServiceRequests = async (): Promise<ServiceRequest[]> => {
    return unwrap(
        await supabase.from('service_requests').select('*').order('created_at', { ascending: false })
    ) as ServiceRequest[];
}

export const cancelServiceRequest = async (id: string) => {
    const { error } = await supabase.rpc('cancel_service_request', { p_request_id: id });
    if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Paystack (via Edge Functions; the secret key never touches the app)
// ---------------------------------------------------------------------------

const invokeFn = async <T>(name: string, body: object): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
        // Surface the function's own { error } message when there is one.
        let message = error.message;
        try {
            const ctx = (error as { context?: Response }).context;
            const parsed = ctx ? await ctx.json() : null;
            if (parsed?.error) message = parsed.error;
        } catch {}
        throw new Error(message);
    }
    return data as T;
};

/** Permanently deletes the signed-in account (delete-account Edge Function), then clears the local session. */
export const deleteAccount = async () => {
    await invokeFn<{ deleted: boolean }>('delete-account', {});
    await supabase.auth.signOut({ scope: 'local' });
}

export const startPayment = (orderId: string, callbackUrl: string) =>
    invokeFn<{ authorization_url: string; reference: string }>('paystack-init', { order_id: orderId, callback_url: callbackUrl });

export const verifyPayment = (reference: string) =>
    invokeFn<{ status: 'paid' | 'already_paid' | 'pending' | 'failed'; order_id: string }>('paystack-verify', { reference });

export const cancelOrder = async (id: string) => {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: id });
    if (error) throw new Error(error.message);
}
