# CONTEXT

## Separate Gift Club preview (current)

- Vercel project `tolu6/yodla-gift-club`; latest preview: https://yodla-gift-club-f0z8lz1cc-tolu6.vercel.app . Separate from the existing root `yodla` Vercel link and live Cloud Run service.
- Source: `vercel-site/`; build: `scripts/build-vercel.mjs`; output: `vercel-site/dist/`. Character art: `vercel-site/art/`. Design: `vercel-site/gift-club.css` and `vercel-site/experience.js`.
- The Vercel build copies customer modules and assets from the parent repository. CLI uploads omit the parent, so run `vercel build --scope tolu6` then `vercel deploy --prebuilt --scope tolu6` from `vercel-site/`. A plain remote CLI build fails to find `../scripts/build-vercel.mjs`.
- Explicit rewrites in `vercel-site/vercel.json` forward only public content, runtime config, concierge, contact, commerce, and uploads to Cloud Run. Product and journal detail URLs use `vercel-site/api/detail.js`; unknown admin API routes return 404.
- Preview is protected and `noindex`. Checkout callbacks use `location.origin`. Payment and Firebase sign-in on this preview remain unverified; Cloud Run remains live and unchanged.
- Gift Club visual direction: Yodla oxblood, ember, cream, and ink; Syne, Outfit, Space Mono; animated Pip and Dot characters, recolored to the brand palette. Older gifting style notes below describe the separate Cloud Run site.

## Service

- GCP project: `project-9afac`
- Region: `us-central1`
- Service: `yodla`
- Live: https://yodla-fwy32oha6q-uc.a.run.app
- Content bucket: `project-9afac-yodla-content`
- Runtime SA: `yodla-runtime@project-9afac.iam.gserviceaccount.com`
- Local: `npm run dev` → `http://localhost:4173`

## Stack

- Node storefront + Cloud Run (`scripts/dev-server.mjs` / `scripts/public-server.mjs`).
- Sources in `pages/`; build flattens to `public/`.
- Vanilla JS + GSAP; admin at `/admin/`; shelf GCS JSON (local `data/shelf.json` fallback).
- Paystack commerce; Firebase Auth for shopper account surfaces; Vertex optional for Ask Yodla.

## Product rules

- App-branded toasts/modals only — no `alert` / `confirm` / `prompt`.
- No raw stack traces or provider strings in UI.
- No fake controls; working or clearly disabled.
- Brand: oxblood / ember / cream / ink; Bricolage + Manrope + DM Mono.
- Homepage hero pattern: full-bleed night stage, left copy, right orbit+bottle, `01 / 04` controls, ember marquee — gifting should match this transitional feel.

## Gifting (current contract)

- Page: `pages/gifting.html` — homepage-style **hero** (intro only + autoplaying cutout imagery) and a separate **`#gift-builder`** flow below for people → bottles → review.
- Draft: `localStorage` key `yodla-gift-draft` — version 2 `{ recipients[], items[], message, wrap, notify, activeRecipientId, step }`.
- Steps `1–3` in the builder (people / bottles / review). Cap **5** recipients. Distinct emails required.
- Buyer pays once at `checkout.html?gift=1`; personal bag checkout stays separate.
- Hero carousel is independent of form step (autoplay + arrows/swipe).
- Deep link: `/gifting.html?step=1..3` or `/gifting.html#gift-builder`.

## Contact

- `pages/contact.html` + `api/contact.js` — 3-step wizard (intent → details → message/review).

## Key files

| Path | Role |
| --- | --- |
| `pages/gifting.html` | Hero gift deck markup |
| `js/gifting.js` | Draft CRUD, `GIFT_SLIDES`, step helpers |
| `js/main.js` | `renderGiftDeck` / visual / events |
| `lib/gift.js` | Server normalize gift payload |
| `lib/mail.js` | Branded gift emails |
| `api/commerce.js` | Checkout + gift attach |
| `api/concierge.js` / `js/concierge-api.js` | Ask Yodla gift tools + context |
| `pages/contact.html` | Contact wizard |
| `assets/gifting/` | Gift hero photos (not homepage celebration duo) |
| `test/gift-flow.test.js` | Gift normalize + concierge gift context |

## Gotchas

- Do not use homepage celebration duo imagery on gifting — dedicated `assets/gifting/*`.
- Live revision may lag local gift-deck rewrite; verify `/gifting.html` after deploy.
- Prefer `/health` on live `run.app` (Cloud Run intercepts some `*z` paths).
- Never commit `.env.local` / secrets; CAC PDFs in `CAC/` are local business docs — do not treat as app source.
