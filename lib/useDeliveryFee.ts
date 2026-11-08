import { useEffect, useState } from "react";
import { DELIVERY_FEE } from "@/constants";
import { getDeliveryFee } from "@/lib/api";

// Fee per set of products, so Cart → Checkout doesn't ask the server twice.
const cache = new Map<string, number>();

/**
 * The delivery fee for these products (₦2,000, or ₦5,000 with groceries / Local Market
 * items), as worked out by the server. `ready` is false until it's known; `fee` is then
 * the standard fee as a placeholder. Display only: place_order() charges the real fee.
 */
export default function useDeliveryFee(menuIds: string[]): { fee: number; ready: boolean } {
    const key = [...new Set(menuIds)].sort().join(',');
    const [result, setResult] = useState<{ key: string; fee: number } | null>(null);

    useEffect(() => {
        if (!key || cache.has(key)) return;
        let alive = true;
        getDeliveryFee(key.split(','))
            .then((fee) => {
                cache.set(key, fee);
                if (alive) setResult({ key, fee });
            })
            .catch((e) => console.log('delivery fee lookup failed', e));
        return () => { alive = false; };
    }, [key]);

    const known = cache.get(key) ?? (result?.key === key ? result.fee : undefined);
    return { fee: known ?? DELIVERY_FEE, ready: known !== undefined };
}
