/**
 * Colour options (cake colour themes etc.): the admin may add a value with only a name, or with an
 * emoji typed in front ("🟢 Green"). We strip the emoji and work out the swatch from the name,
 * so every colour shows the same way in the app.
 */

/** Special swatch: drawn as stripes, not one colour. */
export const RAINBOW = "rainbow";

const RAINBOW_BANDS = ["#F87171", "#FB923C", "#FBBF24", "#4ADE80", "#60A5FA", "#A78BFA"];
export const rainbowBands = RAINBOW_BANDS;

// Longest names first so "light blue" wins over "blue".
const NAMED: [string, string][] = ([
    ["vanilla cream", "#F5E6B8"], ["chocolate brown", "#8B5A3C"], ["baby blue", "#BFDBFE"], ["light blue", "#BFDBFE"],
    ["sky blue", "#7DD3FC"], ["navy blue", "#1E3A8A"], ["royal blue", "#2563EB"], ["baby pink", "#FBCFE8"],
    ["hot pink", "#EC4899"], ["light pink", "#FBCFE8"], ["rose gold", "#E8B4A0"], ["lilac", "#D8B4FE"],
    ["lavender", "#DDD6FE"], ["mint", "#A7F3D0"], ["teal", "#2DD4BF"], ["turquoise", "#5EEAD4"],
    ["peach", "#FDBA8C"], ["coral", "#FB7185"], ["maroon", "#9F1239"], ["burgundy", "#881337"],
    ["wine", "#7F1D1D"], ["navy", "#1E3A8A"], ["cream", "#FFF4D6"], ["ivory", "#FFFBEB"], ["beige", "#E7D7B8"],
    ["champagne", "#F3E5C0"], ["nude", "#E8C4A8"], ["brown", "#8B5A3C"], ["chocolate", "#7B4A2E"],
    ["caramel", "#C68A4E"], ["silver", "#CBD5E1"], ["grey", "#9CA3AF"], ["gray", "#9CA3AF"],
    ["gold", "#FBBF24"], ["white", "#FFFFFF"], ["black", "#1F2937"], ["red", "#F87171"], ["pink", "#F9A8C8"],
    ["orange", "#FB923C"], ["yellow", "#FDE047"], ["green", "#4ADE80"], ["blue", "#93C5FD"],
    ["purple", "#C4B5FD"], ["violet", "#A78BFA"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

/** "🟢 Green" → "Green". Removes emoji, symbols and spaces from the start of the name. */
export const cleanOptionName = (name: string) =>
    name.replace(/^[^A-Za-z0-9À-ɏ]+/, "").trim() || name.trim();

/** The swatch for an option: rainbow, its own colour, or one worked out from its name; null if it isn't a colour. */
export function optionColour(name: string, swatch?: string | null): string | null {
    const n = cleanOptionName(name).toLowerCase();
    if (/rainbow|multi.?colou?r/.test(n)) return RAINBOW;
    if (swatch && /^#[0-9a-f]{6}$/i.test(swatch)) return swatch;
    for (const [word, hex] of NAMED) if (new RegExp(`\\b${word}\\b`).test(n)) return hex;
    return null;
}
