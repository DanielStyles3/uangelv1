import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import {
    Category,
    CreateUserParams,
    Customization,
    GetMenuParams,
    MenuItem,
    NewServiceRequest,
    Order,
    ServiceRequest,
    PlaceOrderParams,
    ProfileUpdate,
    SignInParams,
    SubcategoryWithCount,
    User,
} from "@/type";

// Also embed the product's subcategory photo: products without their own photo
// (until the admin uploads one) show their subcategory's picture instead.
const MENU_COLUMNS = 'id, name, description, image_url, emoji, price, rating, calories, protein, category_id, created_at, categories(image_url)';

type MenuRow = MenuItem & { categories?: { image_url: string | null } | null };
const withFallbackPhoto = ({ categories, ...item }: MenuRow): MenuItem => ({
    ...item,
    image_url: item.image_url ?? categories?.image_url ?? null,
});
const CATEGORY_COLUMNS = 'id, name, description, parent_id, emoji, color, image_url, sort_order, delivery_note, kind, created_at';
const PROFILE_COLUMNS = 'id, name, email, avatar, phone, address, city, state, created_at';
const ORDER_COLUMNS = 'id, user_id, status, payment_method, payment_status, paystack_reference, paid_at, subtotal, delivery_fee, total, delivery_address, city, state, phone, note, created_at';

// Supabase returns { data, error }; turn errors into thrown Errors so callers can try/catch.
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
    if (error) throw new Error(error.message);
    if (data === null) throw new Error('No data returned');
    return data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const createUser = async ({ email, password, name }: CreateUserParams) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Read by the handle_new_user() trigger in supabase/schema.sql to fill profiles.name.
        options: { data: { name } },
    });

    if (error) throw new Error(error.message);

    // With "Confirm email" enabled in Supabase, sign-up succeeds but no session is returned yet.
    return { needsEmailConfirmation: !data.session };
}

export const signIn = async ({ email, password }: SignInParams) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
}

/** Emails a reset link that opens the app's /reset-password screen. */
export const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // fastfood://reset-password in builds, exp://.../--/reset-password in Expo Go.
        // Both schemes are in the project's Auth redirect allow list.
        redirectTo: Linking.createURL('/reset-password'),
    });
    if (error) throw new Error(error.message);
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

    return unwrap(
        await supabase
            .from('profiles')
            .upsert({ id: authUser.id, name: fallbackName, email: authUser.email ?? '' })
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
    let request = supabase.from('menu').select(MENU_COLUMNS).order('name');

    if (category) {
        const { data: children, error } = await supabase.from('categories').select('id').eq('parent_id', category);
        if (error) throw new Error(error.message);
        request = request.in('category_id', [category, ...(children ?? []).map((c) => c.id)]);
    }
    if (query) request = request.ilike('name', `%${query.replace(/[%_]/g, '\\$&')}%`);
    if (limit) request = request.limit(Number(limit));

    return (unwrap(await request) as unknown as MenuRow[]).map(withFallbackPhoto);
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

    return rows.map(({ menu, ...category }) => ({ ...category, product_count: menu?.[0]?.count ?? 0 }));
}

// ---------------------------------------------------------------------------
// Orders (writes go through the place_order / cancel_order database functions)
// ---------------------------------------------------------------------------

/** Creates the order as 'awaiting_payment'; pay it with openPayment() (lib/payments.ts → app/pay.tsx). */
export const placeOrder = async ({ items, address, city, state, phone, note }: PlaceOrderParams): Promise<string> => {
    const { data, error } = await supabase.rpc('place_order', {
        p_items: items.map((item) => ({
            menu_id: item.id,
            quantity: item.quantity,
            customization_ids: (item.customizations ?? []).map((c) => c.id),
        })),
        p_address: address,
        p_city: city,
        p_state: state,
        p_phone: phone,
        p_payment_method: 'paystack',
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
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('service_requests').select('id', { count: 'exact', head: true }),
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
