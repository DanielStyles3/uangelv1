import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";

// Row shapes for the tables in supabase/schema.sql

export interface MenuItem {
    id: string;
    name: string;
    price: number;
    /** null until a real photo is added; show `emoji` as the placeholder instead. */
    image_url: string | null;
    emoji: string | null;
    description: string;
    calories: number | null;
    protein: number | null;
    rating: number;
    /** Always a subcategory id. */
    category_id: string | null;
    created_at: string;
}

/**
 * Two levels: main categories (parent_id === null, shown on Home as cards) and
 * subcategories (parent_id = a main category). Products belong to subcategories.
 */
export interface Category {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    emoji: string | null;
    /** Card background color, e.g. '#D33B0D' (also the fallback behind the photo). */
    color: string | null;
    /** Photo for the Home card / subcategory tile. Fall back to `emoji` if null or it fails to load. */
    image_url: string | null;
    sort_order: number;
    /** e.g. 'Standard next-day delivery' (The Local Market). */
    delivery_note: string | null;
    /** 'service' = no products; customers send a request (Catering, Events & Celebrations). */
    kind: 'products' | 'service';
    created_at: string;
}

export interface SubcategoryWithCount extends Category {
    product_count: number;
}

export interface Customization {
    id: string;
    name: string;
    price: number;
    type: string;
    created_at: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    created_at: string;
}

export type ProfileUpdate = Partial<Pick<User, 'name' | 'phone' | 'address' | 'city' | 'state'>>;

export type OrderStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
/** New orders are always 'paystack'; cash/transfer only exist on old orders. */
export type PaymentMethod = 'paystack' | 'cash' | 'transfer';

export interface OrderItem {
    id: string;
    order_id: string;
    menu_id: string | null;
    name: string;
    image_url: string | null;
    unit_price: number;
    quantity: number;
    customizations: CartCustomization[];
    line_total: number;
}

export interface Order {
    id: string;
    user_id: string;
    status: OrderStatus;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    paystack_reference: string | null;
    paid_at: string | null;
    subtotal: number;
    delivery_fee: number;
    total: number;
    delivery_address: string;
    city: string;
    state: string;
    phone: string;
    note: string | null;
    created_at: string;
    order_items?: OrderItem[];
}

export type ServiceRequestStatus = 'new' | 'contacted' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';

export interface ServiceRequest {
    id: string;
    user_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    service: string;
    event_type: string;
    full_name: string;
    phone: string;
    email: string | null;
    /** YYYY-MM-DD */
    event_date: string;
    guest_count: number;
    budget: number;
    address: string;
    city: string;
    state: string;
    details: string | null;
    status: ServiceRequestStatus;
    created_at: string;
}

export type NewServiceRequest = Omit<ServiceRequest, 'id' | 'user_id' | 'status' | 'created_at'>;

export interface PlaceOrderParams {
    items: CartItemType[];
    address: string;
    city: string;
    state: string;
    phone: string;
    /** Ignored: every order is paid online with Paystack. */
    paymentMethod?: PaymentMethod;
    note?: string;
}

export interface CartCustomization {
    id: string;
    name: string;
    price: number;
    type: string;
}

export interface CartItemType {
    id: string; // menu item id
    name: string;
    price: number;
    image_url: string | null;
    /** Placeholder when image_url is null. */
    emoji?: string | null;
    quantity: number;
    customizations?: CartCustomization[];
}

export interface CartStore {
    items: CartItemType[];
    addItem: (item: Omit<CartItemType, "quantity">, quantity?: number) => void;
    removeItem: (id: string, customizations: CartCustomization[]) => void;
    increaseQty: (id: string, customizations: CartCustomization[]) => void;
    decreaseQty: (id: string, customizations: CartCustomization[]) => void;
    clearCart: () => void;
    getTotalItems: () => number;
    getTotalPrice: () => number;
}

export interface TabBarIconProps {
    focused: boolean;
    icon: ImageSourcePropType;
    title: string;
}

export interface PaymentInfoStripeProps {
    label: string;
    value: string;
    labelStyle?: string;
    valueStyle?: string;
}

export interface CustomButtonProps {
    onPress?: () => void;
    title?: string;
    style?: string;
    leftIcon?: ReactNode;
    textStyle?: string;
    isLoading?: boolean;
}

export interface CustomHeaderProps {
    title?: string;
    /** Show the search shortcut on the right (default true). */
    showSearch?: boolean;
}

export interface CustomInputProps {
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    label: string;
    secureTextEntry?: boolean;
    keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
    autoCapitalize?: "none" | "sentences" | "words" | "characters";
    multiline?: boolean;
    editable?: boolean;
}

export interface ProfileFieldProps {
    label: string;
    value: string;
    icon: ImageSourcePropType;
}

export interface CreateUserParams {
    email: string;
    password: string;
    name: string;
}

export interface SignInParams {
    email: string;
    password: string;
}

// A type alias (not an interface) so it satisfies useFetch's Record<string, ...> constraint.
export type GetMenuParams = {
    category?: string;
    query?: string;
    limit?: number;
}
