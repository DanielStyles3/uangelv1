# U Angel Foods — promotional website

Static landing page (no build step): `index.html`, `css/styles.css`, `js/main.js`, `assets/`.
"Our story" page: `about.html` (+ `css/about.css`, `js/about.js`, loaded after the shared CSS/JS). Its copy is the client's exact wording — don't rephrase it.
Motion uses GSAP 3.12.5 + ScrollTrigger (cdnjs) and Lenis 1.1.13 (jsdelivr), all pinned via CDN.

## Preview locally

```powershell
npx serve website        # from the project root, then open the printed URL (e.g. http://localhost:3000)
```

Any static server works (`python -m http.server` inside `website/`, VS Code Live Server, ...).
The intro loader plays once per browser session; open a new tab/window (or clear sessionStorage) to see it again.
Visitors with "reduce motion" enabled get a fully static page.

## Deploy

- **Netlify:** drag the `website` folder onto https://app.netlify.com/drop
- **Vercel:** `cd website` then `npx vercel deploy` (add `--prod` for production)
- Any static host (GitHub Pages, Cloudflare Pages, S3) also works — just upload the folder.

## Before launch (placeholders / TODO)

- App Store / Google Play buttons say "Coming soon" — swap in real store links (`index.html`, `#app` section).
- Footer contact links (Phone, WhatsApp, Instagram) are `href="#"` placeholders — marked with `<!-- TODO -->`.
- `og:image` / `twitter:image` are relative paths; once the domain is known, make them absolute and add `<link rel="canonical">`.
- Category photos are loaded from the live catalog (Supabase storage / Unsplash URLs).
