import { Image } from "expo-image";

/**
 * Small copies of the catalogue photos. When the admin uploads a photo to
 *   …/storage/v1/object/public/catalog/products/123-cake.webp
 * it also saves a ~25 KB copy (about 420px) at
 *   …/storage/v1/object/public/catalog/thumbs/products/123-cake.webp.webp
 * Lists and cards use the small copy; the product page shows it first, then the full photo.
 */
const CATALOG = "/storage/v1/object/public/catalog/";

export const thumbUrl = (url?: string | null): string | null => {
    if (!url) return null;
    const i = url.indexOf(CATALOG);
    if (i < 0 || url.includes(`${CATALOG}thumbs/`)) return url;
    const path = url.slice(i + CATALOG.length).split("?")[0];
    return `${url.slice(0, i)}${CATALOG}thumbs/${path}.webp`;
};

/** Download photos in the background so they're already on the phone when the screen shows them. */
export const prefetchThumbs = (urls: (string | null | undefined)[]) => {
    const list = [...new Set(urls.map(thumbUrl).filter((u): u is string => !!u))];
    if (list.length) Image.prefetch(list, "memory-disk").catch(() => {});
};
