import { useCallback, useEffect, useRef, useState } from "react";

import { dedupe, getCached, onShopChange, setCached } from "@/lib/dataCache";
import { notify } from "@/lib/notice";

type Params = Record<string, string | number | undefined>;

interface UseFetchOptions<T, P extends Params> {
    fn: (params: P) => Promise<T>;
    params?: P;
    skip?: boolean;
    /**
     * Name for this data so it's also saved on the phone and shows instantly next launch.
     * "shop:…" for the catalogue, "me:…" for the signed-in customer's own data (wiped on sign-out).
     * Without a key the data is still remembered in memory while the app is open.
     */
    key?: string;
    /** Something to show straight away when nothing is cached yet (e.g. from the shop snapshot). */
    initial?: () => T | undefined;
}

interface UseFetchReturn<T, P> {
    data: T | null;
    /** True only while there is NOTHING to show yet (first ever load). Refreshes are silent. */
    loading: boolean;
    error: string | null;
    refetch: (newParams?: P) => Promise<void>;
}

// Unnamed fetches get a per-function id so their results can still be remembered in memory.
const fnIds = new WeakMap<object, number>();
let nextFnId = 1;
const fnId = (fn: object) => {
    let id = fnIds.get(fn);
    if (!id) { id = nextFnId++; fnIds.set(fn, id); }
    return id;
};

/**
 * Stale-while-revalidate: returns the last known data immediately (memory, the copy saved on the
 * phone, or `initial`), then refreshes it in the background. Screens only see `loading` when they
 * have nothing at all to show, and background refresh failures stay quiet when there is data.
 */
const useFetch = <T, P extends Params>({
    fn,
    params = {} as P,
    skip = false,
    key,
    initial,
}: UseFetchOptions<T, P>): UseFetchReturn<T, P> => {
    const base = key ?? `fn:${fnId(fn)}`;
    const cacheKey = `${base}:${JSON.stringify(params)}`;
    const persist = !!key;
    const known = (): T | undefined => getCached<T>(cacheKey) ?? (skip ? undefined : initial?.());

    const [data, setData] = useState<T | null>(() => known() ?? null);
    const [busy, setBusy] = useState(() => !skip && data === null);
    const [error, setError] = useState<string | null>(null);

    // Params changed (a new search, or a parent id that just arrived): show what we already
    // know for them at once (React's "adjust state while rendering" pattern).
    const [shownKey, setShownKey] = useState(cacheKey);
    if (shownKey !== cacheKey) {
        setShownKey(cacheKey);
        const now = known();
        if (now !== undefined) setData(now);
    }

    // For the async fetch: which key is on screen, and whether something is already shown.
    const live = useRef({ key: cacheKey, hasData: data != null });
    useEffect(() => { live.current = { key: cacheKey, hasData: data != null }; });

    const fetchData = useCallback(
        async (fetchParams: P, k: string) => {
            // No "loading" flip here: a screen with nothing to show already starts as loading,
            // and screens with data refresh silently.
            const hadData = getCached(k) !== undefined || live.current.hasData;
            try {
                const result = await dedupe(k, () => fn({ ...fetchParams }));
                setCached(k, result, persist);
                setError(null);
                if (live.current.key === k) setData(result);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "An unknown error occurred";
                setError(message);
                // Only bother the customer when there's nothing on screen to fall back on.
                if (!hadData) notify("Couldn’t load this", message);
            } finally {
                setBusy(false);
            }
        },
        [fn, persist]
    );

    useEffect(() => {
        live.current = { key: cacheKey, hasData: live.current.hasData };
        // Fetching on mount / when params change is what this hook is for; state is only set after the await.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!skip) fetchData(params, cacheKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skip, cacheKey, fetchData]);

    // Shop data refreshes live when the admin changes the catalogue.
    useEffect(() => {
        if (skip || !key?.startsWith("shop:")) return;
        return onShopChange(() => { fetchData(params, cacheKey); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skip, key, cacheKey, fetchData]);

    const refetch = async (newParams?: P) => {
        const p = newParams ?? params;
        await fetchData(p, newParams ? `${base}:${JSON.stringify(p)}` : cacheKey);
    };

    return { data, loading: busy && data == null, error, refetch };
};

export default useFetch;
