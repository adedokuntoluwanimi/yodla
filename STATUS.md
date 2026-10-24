# STATUS

## 2026-10-11 Gift Club brand and typography correction

- Replaced the preview's cobalt/mint palette with Yodla's original oxblood, ember, cream, and ink palette; recolored Pip and Dot character art to match.
- Reworked the hero headline's size, line height, grid width, and narrow breakpoints so its copy stays in its own area; moved the speech bubble into the illustration area and tightened other large headings and gift studio surfaces.
- Latest **preview**: `dpl_E6L6f6CNvYdb5afkBfzE2CyPSQsx`, https://yodla-gift-club-f0z8lz1cc-tolu6.vercel.app . Isolated build and 3/3 focused tests passed. The prior preview's served CSS matched the local build hash and character images returned 200; this final preview adds a smaller heading floor for very narrow screens.
- Visual browser automation remains unavailable after automatic approval rejection, so final overlap verification in a rendered browser is pending. Cloud Run remains unchanged.

## 2026-10-11 Yodla Gift Club Vercel preview

- Built a separate gifting-first customer site in `vercel-site/`; new Pip and Dot character art, animated homepage, gift intent paths, responsive gift studio, actual chosen-bottle preview, and a new visual system across 13 customer pages.
- Added `scripts/build-vercel.mjs`, isolated `dist/`, a Vercel product/journal detail function with page metadata, and explicit public API rewrites. Admin and server files are excluded from the Vercel output.
- New Vercel project: `tolu6/yodla-gift-club`. Latest **preview** deployment `dpl_DDT4dag24gYXa2AptiWNZg7wxvwP`: https://yodla-gift-club-jbz7udmzp-tolu6.vercel.app (Ready, protected, noindex). No production promotion or domain move.
- Gates: isolated build passed; `npm test` at repository root **51 pass / 0 fail**; preview GET `/`, `/products/bottega-gold`, `/journal/highball-for-a-full-house`, and `/api/content` served successfully; `/api/admins` returned 404.
- Browser automation for final visual/interaction QA was rejected by automatic approval review. Payment and Firebase sign-in on the preview remain unverified; do not promote until test or mocked purchase journeys and authorized-domain behavior are confirmed. Cloud Run was not redeployed.

## 2026-09-05 Homepage-style gift deck (local, not redeployed)

- Rebuilt `/gifting.html` as a single `section.hero.gift-deck` matching the homepage transitional hero (left copy panels + right stage + `01 / 04` controls + ember marquee).
- Panels: `0` intro → `1` people+note → `2` bottles+assign → `3` review → checkout.
- Wired in `js/main.js`: `renderGiftDeck`, `renderGiftVisual`, `giftPanelCard`, `data-gift-direction`, keyboard arrows on stage, `?step=` deep link.
- CSS: replaced old `.gift-hero` / `.gift-flow` scroll layout with dark-hero form, pick rail, assign/review styles under `.gift-deck`.
- Assets: `assets/gifting/hero-ribbon|hero-table` (webp+jpg).
- Local: `npm run dev` → `http://localhost:4173/gifting.html` (and `?step=0..3`).
- Gates: `node --check js/main.js`, `npm test` → **48 pass / 0 fail**.
- Intro screenshot looked landing-like; form steps not fully visual-QA’d in browser this session.
- **Not redeployed** after deck rewrite. Live still prior revision (`yodla-00021-rck` era) with older gift UX.

## 2026-09-05 Earlier: gift notify + contact + Ask Yodla (deployed)

- Gift model locked: notify-first (buyer pays; each recipient gets branded email; multi-email cap 5).
- Checkout sends `gift: { recipients, message, wrap, assignments?, notify }` via `api/commerce.js` + `lib/gift.js` + `lib/mail.js`.
- Contact: `pages/contact.html` night hero + 3-step intent wizard.
- Ask Yodla: page/step context, gift tools (`set_gift_details`, `add_gift_recipient`, `clear_gift_recipients`), bag sync.
- Admin order detail shows gift recipients.
- Last known successful deploys this thread: `yodla-00020-gj9`, then `yodla-00021-rck`.
- Live URL: https://yodla-fwy32oha6q-uc.a.run.app
