import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Remembers what screens loaded, so they open with content straight away and refresh quietly.
 *  - Every fetch is kept in memory (instant when you go back to a screen).
 *  - Fetches with a name (`key`) are also saved on the phone, so the shop shows instantly
 *    the next time the app opens, even before the network answers (or with no network).
 *  - Keys starting with "me:" belong to the signed-in customer and are wiped on sign-out.
 */
const STORAGE_KEY = "data-cache-v1";
const MAX_SAVED_CHARS = 1_500_000;   // keep the saved copy small (well under AsyncStorage limits)

const memory = new Map<string, unknown>();
const saved = new Set<string>();          // keys that should be written to the phone
const inFlight = new Map<string, Promise<unknown>>();
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const getCached = <T>(key: string): T | undefined => memory.get(key) as T | undefined;

export const setCached = (key: string, value: unknown, persist: boolean) => {
    memory.set(key, value);
    if (!persist) return;
    saved.add(key);
    scheduleSave();
};

const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        const out: Record<string, unknown> = {};
        for (const k of saved) if (memory.has(k)) out[k] = memory.get(k);
        let text = JSON.stringify(out);
        if (text.length > MAX_SAVED_CHARS) {
            // Too big: keep only the shop-wide data (home, categories), drop the rest.
            const slim: Record<string, unknown> = {};
            for (const k of Object.keys(out)) if (k.startsWith("shop:")) slim[k] = out[k];
            text = JSON.stringify(slim);
        }
        AsyncStorage.setItem(STORAGE_KEY, text).catch(() => {});
    }, 800);
};

/** Load the saved copy into memory. Called once while the splash is showing. */
export const hydrateDataCache = async () => {
    if (hydrated) return;
    hydrated = true;
    try {
        const text = await AsyncStorage.getItem(STORAGE_KEY);
        if (!text) return;
        const data = JSON.parse(text) as Record<string, unknown>;
        for (const [k, v] of Object.entries(data)) {
            if (!memory.has(k)) memory.set(k, v);   // anything fetched meanwhile is newer
            saved.add(k);
        }
    } catch {
        // A broken saved copy is simply ignored.
    }
};

/** Run a fetch once even if several screens ask for the same thing at the same time. */
export const dedupe = <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const p = run().finally(() => inFlight.delete(key));
    inFlight.set(key, p);
    return p;
};

/** Start loading something before its screen opens (e.g. Home while the splash plays). */
export const warm = <T>(key: string, run: () => Promise<T>) =>
    dedupe(key, run).then((v) => setCached(key, v, true)).catch(() => {});

/** Forget the signed-in customer's data (orders, stats…) on sign-out. */
export const clearPersonalCache = () => {
    for (const k of [...memory.keys()]) if (k.startsWith("me:") || k.startsWith("fn:")) memory.delete(k);
    for (const k of [...saved]) if (k.startsWith("me:")) saved.delete(k);
    scheduleSave();
};
