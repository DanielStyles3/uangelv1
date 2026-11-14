import { useEffect, useState } from "react";

import { Catalog, catalog, warmCatalog } from "@/lib/catalog";
import { onShopChange } from "@/lib/dataCache";

/**
 * The whole shop (categories at every level + products), straight from what's saved on the phone,
 * updated live when the admin changes something. Loads it once if this is the very first launch.
 */
export default function useCatalog(): Catalog | undefined {
    const [snap, setSnap] = useState<Catalog | undefined>(() => catalog());

    useEffect(() => {
        let alive = true;
        const read = () => { if (alive) setSnap(catalog()); };
        const off = onShopChange(read);
        // Fresh copy in the background (and the first copy ever, if there's none yet).
        warmCatalog().then(read);
        return () => { alive = false; off(); };
    }, []);

    return snap;
}
