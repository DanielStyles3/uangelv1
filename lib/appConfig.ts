import { useEffect, useState } from "react";

import { getSiteSetting } from "@/lib/api";
import { getCached, onShopChange, warm } from "@/lib/dataCache";

/**
 * Everything the admin can change about the app without a new build (Admin › App settings):
 * contact details, delivery fees and payment options, the Christmas campaign, wording, form
 * lists, extra checkout questions and the Help FAQ. Stored in site_settings under the key 'app'.
 * The values below are the defaults, used for anything the admin hasn't set.
 */

export type FormQuestion = {
    id: string;
    question: string;
    /** 'single' = pick one, 'multi' = pick any, 'text' = type an answer. */
    kind: "single" | "multi" | "text";
    choices: string[];
    required: boolean;
    placeholder?: string | null;
};

export type Step = { title: string; text: string };

export const DEFAULT_CONFIG = {
    contact: {
        /** Shown to customers, e.g. "0704 905 5555". WhatsApp and call links are made from it. */
        phone: "0704 905 5555",
        email: "uangelfoods@gmail.com",
        instagram: "uangelfoods",
    },
    delivery: {
        standardFee: 2000,
        /** Groceries & Essentials and The Local Market. */
        marketFee: 5000,
        areaNote: "We deliver to your door across Lagos.",
        /** Offer "Pay on delivery" (only the delivery fee is paid online). */
        payOnDelivery: true,
    },
    campaign: {
        goal: 10000,
        /** ISO date-time; the Christmas campaign hides after this. */
        endsAt: "2026-12-25T23:59:00+01:00",
    },
    texts: {
        charityLine: "This order helps feed someone in need. U Are An Angel.",
        searchHint: "Search cakes, drinks, groceries…",
        topRated: "Top Rated",
        orderAgain: "Order again",
        orderAgainSub: "Your recent favourites",
        servicesEyebrow: "CATERING & EVENTS",
        servicesTitle: "Planning something special?",
        servicesBody: "Weddings, birthdays, church & corporate. Tell us your budget and we'll call you with a quote.",
        emptyCartTitle: "Your cart is empty",
        emptyCartBody: "Cakes, drinks, market fresh and more. Add something you love.",
        checkoutPayNote: "Your order is confirmed as soon as the online payment goes through.",
        requestSentSteps: [
            { title: "We call you within 24 hours", text: "on the number you gave us" },
            { title: "You get a quote", text: "on WhatsApp, with menu options" },
            { title: "You confirm", text: "and we handle everything on the day" },
        ] as Step[],
    },
    lists: {
        /** Catering request: "What do you need?" */
        serviceNeeds: ["Food", "Drinks", "Cake", "Decor", "Chairs & canopies", "Waiters", "MC / DJ", "Food stands"],
        /** Wedding cake enquiry: quick guest numbers and tiers. */
        cakeGuests: [50, 100, 150, 200, 300, 500],
        cakeTiers: ["1 tier", "2 tiers", "3 tiers", "4+ tiers", "Not sure"],
    },
    /** Extra questions at checkout (e.g. "How did you hear about us?"). Answers are saved on the order. */
    checkoutQuestions: [] as FormQuestion[],
    /** Help & FAQ. Empty = the app's built-in list. */
    faq: [] as { q: string; a: string }[],
};

export type AppConfig = typeof DEFAULT_CONFIG;

const KEY = "shop:app-config:{}";

// Overlay the admin's values on the defaults (only values of the right type are used).
const merge = <T,>(base: T, over: unknown): T => {
    if (over == null || typeof over !== typeof base) return base;
    if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T;
    if (typeof base === "object" && base) {
        const out = { ...(base as Record<string, unknown>) };
        for (const k of Object.keys(out)) out[k] = merge(out[k], (over as Record<string, unknown>)[k]);
        return out as T;
    }
    return (typeof over === "string" ? (over.trim() ? over : base) : over) as T;
};

/** The current settings (saved copy on the phone, else defaults). Safe to call anywhere. */
export const getAppConfig = (): AppConfig => merge(DEFAULT_CONFIG, getCached<unknown>(KEY));

/** Fetch the latest settings (at launch, at most every 30s from screens, and right away when the admin saves). */
let warmedAt = 0;
export const warmAppConfig = (force = false): Promise<void> => {
    if (!force && getCached(KEY) !== undefined && Date.now() - warmedAt < 30_000) return Promise.resolve();
    warmedAt = Date.now();
    return warm(KEY, () => getSiteSetting<Partial<AppConfig>>("app"));
};

/** Settings for a screen; re-renders when the admin changes them. */
export function useAppConfig(): AppConfig {
    const [cfg, setCfg] = useState(getAppConfig);
    useEffect(() => {
        const read = () => setCfg(getAppConfig());
        const off = onShopChange(read);
        warmAppConfig().then(read);
        return off;
    }, []);
    return cfg;
}

/** "0704 905 5555" → "2347049055555" (for wa.me links). */
export const whatsappNumber = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    return d.startsWith("0") ? `234${d.slice(1)}` : d;
};
/** "0704 905 5555" → "+2347049055555" (for tel: links). */
export const telNumber = (phone: string) => `+${whatsappNumber(phone)}`;
