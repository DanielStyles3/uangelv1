import { getHomeProducts, HomeProduct } from "@/lib/api";
import { emitShopChange, getCached, warm } from "@/lib/dataCache";
import { prefetchThumbs } from "@/lib/images";
import { supabase } from "@/lib/supabase";
import { Category, MenuItem, OptionGroup, SubcategoryWithCount } from "@/type";

/**
 * One snapshot of the whole shop (every category at every level + every product), loaded while
 * the splash plays and saved on the phone. Category and section pages draw themselves from it
 * instantly, with no spinner, and the screen's own fetch then refreshes it quietly.
 */
export type Catalog = {
    categories: (Category & { product_count: number })[];
    products: HomeProduct[];
    /** "Customise" questions by product id (cakes: size, flavour…). Products with none aren't listed. */
    options?: Record<string, OptionGroup[]>;
};

export const CATALOG_KEY = "shop:catalog:{}";

const CATEGORY_COLUMNS = 'id, name, description, parent_id, emoji, color, image_url, sort_order, delivery_note, kind, enquiry_only, created_at';

export const loadCatalog = async (): Promise<Catalog> => {
    const [cats, products, opts] = await Promise.all([
        supabase.from("categories").select(`${CATEGORY_COLUMNS}, menu (count)`).order("sort_order"),
        getHomeProducts(),
        supabase.from("option_groups")
            .select("id, menu_id, name, kind, required, max_length, placeholder, sort_order, option_values (id, group_id, name, price, hint, swatch, sort_order)")
            .order("sort_order"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    const categories = ((cats.data ?? []) as unknown as (Category & { menu: { count: number }[] })[])
        .map(({ menu, ...c }) => ({ ...c, product_count: menu?.[0]?.count ?? 0 }));

    // Choices per product; only trusted when the query worked (otherwise the page fetches its own).
    let options: Record<string, OptionGroup[]> | undefined;
    if (!opts.error) {
        options = {};
        for (const g of (opts.data ?? []) as OptionGroup[]) {
            (options[g.menu_id] ??= []).push({ ...g, option_values: [...(g.option_values ?? [])].sort((a, b) => a.sort_order - b.sort_order) });
        }
    }
    return { categories, products, options };
};

/**
 * Load (or refresh) the snapshot and pull every small photo onto the phone. Screens call this when
 * they open; it only really fetches if the copy is over 30s old (or `force`, for live changes).
 */
let warmedAt = 0;
export const warmCatalog = (force = false): Promise<void> => {
    if (!force && catalog() && Date.now() - warmedAt < 30_000) return Promise.resolve();
    warmedAt = Date.now();
    return warm(CATALOG_KEY, loadCatalog).then(() => {
        const c = catalog();
        if (c) prefetchThumbs([...c.categories.map((x) => x.image_url), ...c.products.map((p) => p.image_url)]);
    });
};

export const catalog = () => getCached<Catalog>(CATALOG_KEY);

/**
 * Live shop: when the admin adds or edits a product, category, choice or promotion, refresh the
 * snapshot and every open shop screen within a couple of seconds (no pull-to-refresh needed).
 */
let listening = false;
export const listenForShopChanges = () => {
    if (listening) return;
    listening = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const changed = () => {
        if (timer) clearTimeout(timer);
        // Several rows usually change together (a product + its photo + its choices): wait a moment.
        timer = setTimeout(() => {
            timer = null;
            warmCatalog(true).finally(emitShopChange);
        }, 1500);
    };
    let channel = supabase.channel("shop-changes");
    for (const table of ["menu", "categories", "option_groups", "option_values", "promotions"]) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, changed);
    }
    channel.subscribe();
};

export const snapCategory = (id?: string | null): Category | undefined =>
    id ? catalog()?.categories.find((c) => c.id === id) : undefined;

export const snapSubcategories = (parentId?: string | null): SubcategoryWithCount[] | undefined => {
    const c = catalog();
    if (!c || !parentId) return undefined;
    const children = c.categories.filter((x) => x.parent_id === parentId);
    return children.map((x) => ({
        ...x,
        child_count: c.categories.filter((y) => y.parent_id === x.id).length,
    })) as SubcategoryWithCount[];
};

/** The main categories, in display order (Home circles, Search chips). */
export const snapMainCategories = (): Category[] | undefined => {
    const c = catalog();
    if (!c) return undefined;
    return c.categories.filter((x) => !x.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
};

/** Search results straight from the snapshot (same rules as getMenu: category, name contains, A–Z). */
export const snapSearch = (category?: string, query?: string, limit?: number): MenuItem[] | undefined => {
    const c = catalog();
    if (!c) return undefined;
    let list: MenuItem[] = category ? snapMenu(category) ?? [] : [...c.products].sort((a, b) => a.name.localeCompare(b.name));
    const q = query?.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return limit ? list.slice(0, limit) : list;
};

/** A product's choices from the snapshot ([] = none), or undefined when the snapshot can't tell. */
export const snapOptions = (menuId?: string | null): OptionGroup[] | undefined => {
    const c = catalog();
    if (!menuId || !c?.options || !c.products.some((p) => p.id === menuId)) return undefined;
    return c.options[menuId] ?? [];
};

export const snapProduct =(id?: string | null): MenuItem | undefined =>
    id ? catalog()?.products.find((p) => p.id === id) : undefined;

/** Every product, best-rated first (Home rows). */
export const snapProducts = (): HomeProduct[] | undefined => catalog()?.products;

/** Products of a category and everything inside it (any depth), A–Z like the server. */
export const snapMenu = (categoryId?: string | null): MenuItem[] | undefined => {
    const c = catalog();
    if (!c || !categoryId) return undefined;
    const ids = treeIds(c, categoryId);
    return c.products
        .filter((p) => p.category_id && ids.has(p.category_id))
        .sort((a, b) => a.name.localeCompare(b.name));
};

// ---------------------------------------------------------------------------
// Tree helpers (any depth): Local Market › Fruits & Vegetables › Fruits › Bananas
// ---------------------------------------------------------------------------

/** A category and all the categories inside it. */
export const treeIds = (c: Catalog, id: string): Set<string> => {
    const out = new Set([id]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const x of c.categories) {
            if (x.parent_id && out.has(x.parent_id) && !out.has(x.id)) { out.add(x.id); grew = true; }
        }
    }
    return out;
};

/** From the top: [main, …, the category itself]. */
export const pathTo = (c: Catalog, id?: string | null): Category[] => {
    const byId = new Map(c.categories.map((x) => [x.id, x]));
    const out: Category[] = [];
    let cur = id ? byId.get(id) : undefined;
    for (let i = 0; cur && i < 10; i++) {
        out.unshift(cur);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return out;
};

export const snapPath = (id?: string | null): Category[] | undefined => {
    const c = catalog();
    return c && id ? pathTo(c, id) : undefined;
};

/** Children in display order. */
export const childrenOf = (c: Catalog, id: string) =>
    c.categories.filter((x) => x.parent_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));

/** Products sitting directly in this category (not in the ones inside it). */
export const productsIn = (c: Catalog, id: string) =>
    c.products.filter((p) => p.category_id === id).sort((a, b) => a.name.localeCompare(b.name));

/** How many products are in this category or anywhere inside it (empty branches are hidden). */
export const countIn = (c: Catalog, id: string) => {
    const ids = treeIds(c, id);
    return c.products.reduce((n, p) => n + (p.category_id && ids.has(p.category_id) ? 1 : 0), 0);
};
