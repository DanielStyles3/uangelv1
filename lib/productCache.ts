import { Category, MenuItem, OptionGroup } from "@/type";

/**
 * In-memory copies of products the customer has already seen in a list (home, category, search,
 * Christmas). Tapping a product then opens its page instantly with this copy, while the page
 * refreshes it quietly in the background.
 */
const products = new Map<string, MenuItem>();
const categories = new Map<string, Category>();
const options = new Map<string, OptionGroup[]>();

export const rememberProducts = <T extends Partial<MenuItem> & { id: string }>(list: T[] | null | undefined): T[] => {
    for (const p of list ?? []) {
        // Keep the richer copy: don't let a short list row overwrite a full product.
        products.set(p.id, { ...(products.get(p.id) ?? {}), ...p } as MenuItem);
    }
    return list ?? [];
};
export const cachedProduct = (id?: string | null) => (id ? products.get(id) ?? null : null);

export const rememberCategory = (c: Category) => { categories.set(c.id, c); return c; };
export const cachedCategory = (id?: string | null) => (id ? categories.get(id) ?? null : null);

export const rememberOptions = (id: string, groups: OptionGroup[]) => { options.set(id, groups); return groups; };
export const cachedOptions = (id?: string | null) => (id ? options.get(id) ?? null : null);
