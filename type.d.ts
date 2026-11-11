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
    /** false = sold out: still shown, but can't be added to the cart. */
    is_available?: boolean;
    /** Christmas giving pack: no delivery to the buyer, hidden from normal lists. */
    is_campaign?: boolean;
    /** Set in Admin › Products. null = the category's standard fee / delivery note. */
    delivery_fee?: number | string | null;
    delivery_note?: string | null;
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
    /** Products here are made to order (Wedding Cakes): "Send an enquiry" instead of Add to cart. */
    enquiry_only?: boolean;
    created_at: string;
}

/** A Home banner from the admin Promotions page (only live ones reach the app). */
export interface Promotion {
    id: string;
    eyebrow: string | null;
    title: string;
    cta: string;
    image_url: string;
    color: string;
    /** 'category' → category page, 'product' → product page, 'service' → request form. */
    link_type: 'none' | 'category' | 'product' | 'service';
    link_id: string | null;
}

export interface SubcategoryWithCount extends Category {
    /** Options under this one (Catering › Events has the event types). */
    child_count?: number;
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
    /** Delivery extras: a landmark for the rider, and the rider's call number (null = use `phone`). */
    landmark?: string | null;
    delivery_phone?: string | null;
    created_at: string;
}

export type ProfileUpdate = Partial<Pick<User, 'name' | 'phone' | 'address' | 'city' | 'state' | 'landmark' | 'delivery_phone'>>;

export type OrderStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
/**
 * 'paystack' = everything paid online; 'pay_on_delivery' = delivery fee paid online,
 * the items paid to the rider. cash/transfer only exist on old orders.
 */
export type PaymentMethod = 'paystack' | 'pay_on_delivery' | 'cash' | 'transfer';
/** What the customer can choose at checkout. */
export type CheckoutPaymentMethod = 'paystack' | 'pay_on_delivery';

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
    /** Charged via Paystack: the total, or only the delivery fee for pay on delivery. null on old orders (= total). */
    online_amount: number | null;
    /** Pay on delivery: what the rider collects (the subtotal); 0 otherwise. */
    balance_due: number;
    balance_collected_at: string | null;
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
    /** Last day, for catering over several days (a week, a month, a year…). null = one day. */
    end_date?: string | null;
    /** "Specific dates": every chosen day (event_date is the first). null otherwise. */
    event_dates?: string[] | null;
    guest_count: number;
    budget: number;
    address: string;
    city: string;
    state: string;
    details: string | null;
    /** 'Morning' | 'Afternoon' | 'Evening' */
    event_time?: string | null;
    /** 'Indoor' | 'Outdoor' | 'Not sure yet' */
    venue_type?: string | null;
    /** What the customer needs, e.g. ['Food', 'Drinks', 'Decor']. */
    needs?: string[];
    /** The amount the business quoted (set in the admin). */
    quote_amount?: number | null;
    status: ServiceRequestStatus;
    created_at: string;
}

export type NewServiceRequest = Omit<ServiceRequest, 'id' | 'user_id' | 'status' | 'created_at' | 'quote_amount'>;

export interface PlaceOrderParams {
    items: CartItemType[];
    address: string;
    city: string;
    state: string;
    phone: string;
    /** Default 'paystack' (pay everything now). */
    paymentMethod?: CheckoutPaymentMethod;
    note?: string;
}

export interface CartCustomization {
    id: string;
    name: string;
    price: number;
    /** 'topping' | 'side' (add-ons), 'option' (a chosen option value), 'text' (id = option group id). */
    type: string;
    /** For type 'text': what the customer typed (e.g. the message on the cake). */
    text?: string;
}

/** "Customise your cake": a question on a product (Size, Flavour, Message on the cake…). */
export interface OptionGroup {
    id: string;
    menu_id: string;
    name: string;
    /** 'single' = pick one value; 'text' = type something. */
    kind: 'single' | 'text';
    required: boolean;
    max_length: number | null;
    placeholder: string | null;
    sort_order: number;
    option_values: OptionValue[];
}

export interface OptionValue {
    id: string;
    group_id: string;
    name: string;
    price: number;
    hint: string | null;
    swatch: string | null;
    sort_order: number;
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

/** A cart the customer chose to keep for later (My orders → Active). Stored on the phone. */
export interface SavedCart {
    id: string;
    savedAt: string;
    items: CartItemType[];
}

export interface CartStore {
    items: CartItemType[];
    savedCarts: SavedCart[];
    /** Keeps the current cart in My orders → Active and empties the cart. */
    saveCartForLater: () => void;
    /** Puts a saved cart back into the cart (replacing what's there) and removes it from the saved list. */
    restoreSavedCart: (id: string) => void;
    deleteSavedCart: (id: string) => void;
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
