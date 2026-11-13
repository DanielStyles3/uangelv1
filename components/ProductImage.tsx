import { useState } from "react";
import { Image } from "expo-image";

import { thumbUrl } from "@/lib/images";

// Brand picture shown when there's no photo (or it fails to load) — no emoji placeholders.
const FALLBACK = require("../assets/images/app-icon.png");

interface ProductImageProps {
    imageUrl?: string | null;
    /** @deprecated kept for compatibility; pictures are used instead of emoji now. */
    emoji?: string | null;
    /** @deprecated sizing comes from the parent frame (the image always fills it). */
    className?: string;
    /** @deprecated no longer used (no emoji fallback). */
    emojiClassName?: string;
    resizeMode?: "contain" | "cover";
    /** Load this one before the others (e.g. the big photo on a product page). */
    priority?: "low" | "normal" | "high";
    /**
     * "thumb" (default): the small copy, for cards and lists, loads in a blink.
     * "full": the full photo for big heroes; the small copy (usually already on the phone
     * from the list) shows instantly while it loads.
     */
    size?: "thumb" | "full";
}

/**
 * Shows the photo, cached in memory and on disk: a photo seen once shows instantly everywhere
 * else and next time the app opens, even offline. Missing small copy → the full photo;
 * no URL or a broken link → the U Angel Foods brand picture.
 */
const ProductImage = ({ imageUrl, resizeMode = "contain", priority = "normal", size = "thumb" }: ProductImageProps) => {
    const small = thumbUrl(imageUrl);
    // Which URLs failed, so a recycled list cell that gets a different photo tries afresh.
    const [failed, setFailed] = useState<{ url: string | null | undefined; level: number }>({ url: null, level: 0 });
    const level = failed.url === imageUrl ? failed.level : 0;   // 0 = preferred, 1 = full photo, 2 = brand picture

    const preferred = size === "full" ? imageUrl : small;
    const uri = !imageUrl || level >= 2 ? null : level === 1 ? imageUrl : preferred;

    return (
        <Image
            source={uri ? { uri } : FALLBACK}
            placeholder={size === "full" && small && small !== imageUrl && uri ? { uri: small } : undefined}
            placeholderContentFit={resizeMode}
            // Always fill the parent frame.
            style={{ width: "100%", height: "100%" }}
            contentFit={uri ? resizeMode : "cover"}
            cachePolicy="memory-disk"
            recyclingKey={imageUrl ?? "fallback"}
            transition={size === "full" ? 0 : 120}
            priority={priority}
            onError={() => {
                if (!imageUrl) return;
                // Small copy missing → try the full photo; full photo broken → brand picture.
                const next = uri === imageUrl ? 2 : 1;
                setFailed({ url: imageUrl, level: Math.max(level, next) });
            }}
        />
    );
};

export default ProductImage;
