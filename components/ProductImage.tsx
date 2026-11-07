import { useState } from "react";
import { Image } from "react-native";

// Brand picture shown when there's no photo (or it fails to load) — no emoji placeholders.
const FALLBACK = require("../assets/images/app-icon.png");

interface ProductImageProps {
    imageUrl?: string | null;
    /** @deprecated kept for compatibility; pictures are used instead of emoji now. */
    emoji?: string | null;
    /** Tailwind classes for the box, e.g. "size-32" or "absolute inset-0 size-full". */
    className?: string;
    /** @deprecated no longer used (no emoji fallback). */
    emojiClassName?: string;
    resizeMode?: "contain" | "cover";
}

/**
 * Shows the photo (web URL). If there's no URL or it fails to load (offline, link
 * removed), shows the U Angel Foods brand picture instead.
 */
const ProductImage = ({ imageUrl, className = "size-32", resizeMode = "contain" }: ProductImageProps) => {
    // Remember WHICH url failed, so a recycled list cell that receives a different
    // url automatically gets a fresh try (no effect needed to reset it).
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const useFallback = !imageUrl || failedUrl === imageUrl;

    return (
        <Image
            source={useFallback ? FALLBACK : { uri: imageUrl }}
            className={className}
            // Always fill the parent frame, even if NativeWind's className doesn't apply on a device.
            style={{ width: '100%', height: '100%' }}
            resizeMode={useFallback ? "cover" : resizeMode}
            onError={() => imageUrl && setFailedUrl(imageUrl)}
        />
    );
};

export default ProductImage;
