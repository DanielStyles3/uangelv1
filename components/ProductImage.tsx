import { useState } from "react";
import { Image } from "expo-image";

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
}

/**
 * Shows the photo (web URL), cached in memory and on disk: a photo seen once (in a list) shows
 * instantly everywhere else (the product page) and next time the app opens, even offline.
 * No URL or a broken link → the U Angel Foods brand picture.
 */
const ProductImage = ({ imageUrl, resizeMode = "contain", priority = "normal" }: ProductImageProps) => {
    // Remember WHICH url failed, so a recycled list cell that receives a different
    // url automatically gets a fresh try (no effect needed to reset it).
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const useFallback = !imageUrl || failedUrl === imageUrl;

    return (
        <Image
            source={useFallback ? FALLBACK : { uri: imageUrl }}
            // Always fill the parent frame.
            style={{ width: "100%", height: "100%" }}
            contentFit={useFallback ? "cover" : resizeMode}
            cachePolicy="memory-disk"
            recyclingKey={imageUrl ?? "fallback"}
            transition={150}
            priority={priority}
            onError={() => imageUrl && setFailedUrl(imageUrl)}
        />
    );
};

export default ProductImage;
