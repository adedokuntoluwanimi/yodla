# CONTEXT

## Live workbook storefront (2026-11-09)

- `https://yodla.ng` serves `yodla-workbook-live` on Cloud Run in `project-9afac`, `us-central1`. The durable shelf is `gs://project-9afac-yodla-content/content/yodla-shelf-workbook-v1.json`, selected by `YODLA_GCS_SHELF_OBJECT` with `YODLA_REQUIRE_WORKBOOK=true`. The previous `content/yodla-shelf.json` and revision `yodla-00023-h47` remain available for rollback.
- Production payments require a live Paystack secret. `api/runtime-config.js` exposes the availability flag. The payment API rejects attempts while unavailable and the checkout page links to Contact Yodla. Production admin uses Firebase authentication.
- Cloud Run static pages and product and Journal detail routes use the built CSS and module fingerprint. The deployed fingerprint is `cc799772a3db4d5a`.

## Local workbook-managed storefront (2026-11-09)

- Run `npm run dev:catalogue` to start the isolated loopback preview. It stores its shelf, orders, carts, and admin state under `tmp/yodla-catalogue-local/` and uses mock payments and local admin access. Publishing a workbook there does not use Cloud Storage or send email.
- Admin at `/admin/#import` accepts the three original workbook tabs. Preview the add/update/unpublish diff and explicitly confirm publication. Use SKU or the matching ID column for renames. The catalogue exposes only the published workbook set and keeps recipe costing and batch counts private.
- The shop accepts published, priced products and uses the workbook amount per listed selling unit. When the selling unit is blank, display it as a listed unit. Orders start at six units per item, honor any higher workbook minimum, and save the 70% deposit and 30% balance. Hampers use the approved 7/9/10 item tiers, priced add-ons, separate 10-word fields, 30% service fee, 7.5% VAT on that fee, and 24–48 hour delivery.
- Online reference photos are stored in `assets/products/catalogue/` with provenance in `lib/catalog-photos.js`. `cataloguePhotoStyle` in `js/catalog.js` classifies the bundled drink photos for the CSS display treatment. Generated illustrations under `assets/gifting/hampers/` attach only when the fixed item list matches the illustration.
- The main gifting page lists the collections at `/gifting.html`. `?package=<tier-id>` opens package details, and `&mode=inquiry` opens a quote even for a priced package. `js/hamper-ui.js` renders both views. The homepage carousel uses its original editorial images separately from inventory product thumbnails.
- Package quotes use the existing contact store and include structured package, quantity, destination, selected extras, and personalization. `extraDrinks` carries drink IDs and quantities from the searchable inventory picker. Hamper checkout requires a confirmed single-unit price and calculates totals from current prices. The isolated preview saves submissions locally with email disabled.

## Note (2026-11-08)

- A local wholesale/hamper/admin-inventory implementation was started from the Nov 7 meeting notes and inventory spreadsheet, then **fully reverted** before any Cloud Run deploy. Main-site contracts below are the restored pre-wholesale state.

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
- Homepage hero pattern: full-bleed night stage, left copy, right orbit and bottle, `01 / 04` controls, and ember marquee.

## Legacy bottle gifting contract

- The unmanaged catalogue uses the `#gift-builder` flow in `pages/gifting.html` for people, bottles, and review.
- Draft: `localStorage` key `yodla-gift-draft` — version 2 `{ recipients[], items[], message, wrap, notify, activeRecipientId, step }`.
- Steps `1–3` in the builder (people / bottles / review). Cap **5** recipients. Distinct emails required.
- Buyer pays once at `checkout.html?gift=1`; personal bag checkout stays separate.
- Deep link: `/gifting.html?step=1..3` or `/gifting.html#gift-builder`.

## Contact

- `pages/contact.html` + `api/contact.js` — 3-step wizard (intent → details → message/review).

## Key files

| Path | Role |
| --- | --- |
| `pages/gifting.html` | Gift builder markup |
| `js/gifting.js` | Legacy gift draft and step helpers |
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
