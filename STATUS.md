# STATUS

## 2026-11-09 Workbook storefront live

- Cloud Run revision `yodla-workbook-live` serves 100% of traffic for `https://yodla.ng`. Cloud Build `efc55d50-bd9b-4d09-9ce0-d7ea02ebd003` succeeded. Image digest `sha256:1f43412c6d018c839d3b43b5510f9479b3f220ee36450b9398f99fb1f0e10a82`.
- Published 34 workbook products and three hampers in the private production shelf. Preserved the existing Jack Daniel’s URL and photo. Retained the previous shelf and removed both temporary candidate traffic tags after verification.
- Passed the build and all 53 tests. Verified the public catalogue, 37 photos, cart minimum, deposit calculation, hamper picker, Journal, and anonymous admin denial. Fresh Cloud Run logs showed no unexpected errors.
- Production checkout directs shoppers to Contact Yodla while the live Paystack key is unconfigured. Local mock payments remain available. Removed the three temporary release files and retained the reviewed registry images.

## 2026-11-09 Catalogue drink photography

- Added category-colored display backgrounds to drink photos in the shop, product details, and hamper picker. Cocktail and mocktail photos fill their cards.
- Verified all 34 catalogue images load, reviewed desktop and mobile screenshots, and passed seven catalogue and responsive-asset tests. Removed three temporary review screenshots.

## 2026-11-09 Shop minimums, visible photos, and hamper drink quantities

- Replaced the hamper drink dropdown with a searchable list with photos, quantity controls, and a selection summary. Quotes and checkout accept multiple drink lines and validate quantities against published inventory.
- Enabled cart and checkout for all 23 priced wholesale products. Shop purchases start at six listed selling units per product, with higher workbook minimums honored. Corrected the CSS selector that hid managed catalogue photos.
- All 53 tests passed. Browser checks verified 34 catalogue photos, the cart minimum, a multi-drink quote, and a priced hamper checkout preview with quantities restored on edit. The isolated local preview remains on port 4173. No new temporary workspace files required removal.

## 2026-11-09 Landing images, hamper drinks, and Journal

- Restored the four original homepage carousel images and removed Weekend from the top category strip and mobile category list.
- Show the workbook’s listed wholesale prices with a selling-unit notice where required. Package quotes and checkout select extra drinks from published inventory. Online payment for an extra drink requires a confirmed single-unit price.
- Replaced the featured Journal layout with a numbered story index. Verified the carousel, category links, hamper selector, wholesale price, Journal at 1,440, 390, and 320 pixels, and local admin. All 53 tests passed.
- The isolated preview remains running on port 4173. The workspace review found no temporary files from this pass to remove.

## 2026-11-09 Package details, Contact, and Journal

- Gifting starts with three collection links. Each package has a dedicated detail view with its illustration, included items, and package-specific extras. Priced packages use the existing checkout. Other packages accept quote requests with quantity, delivery state, contact information, and optional personalization.
- Replaced the Contact hero and wizard with a single form. Existing package inquiry links open the matching package directly. Journal now has a featured story, an archive, and article section links.
- All 53 tests passed, including structured quote validation and concurrent storage. Verified navigation and layouts at 1,440, 390, and 320 pixels. The local preview was restarted against its existing catalogue.

## 2026-11-09 Gifting collection layout

- Removed the main gifting hero and carousel. The workbook-managed page starts with a compact collection index and illustrated hamper cards with expandable contents and extras. Unpriced hampers link to their inquiry forms.
- Kept the landing carousel and verified that its images still advance. The separate Gift Club build still assembles its own hero.
- Syntax checks and 11 focused tests passed. Verified the main gifting page and inquiry link in the local browser at 1,440, 639, 390, and 320 pixels.

## 2026-11-09 Local workbook catalogue and checkout

- Added admin XLSX template, review, and atomic replacement of the wholesale, cocktail/mocktail, and gifting catalogue. The isolated preview contains 23 wholesale items, 11 menu drinks, and three hamper tiers from the supplied workbook.
- Added category links and filters, image references for 34 catalogue entries, three generated hamper illustrations, 70/30 wholesale checkout with balance collection, and separate full-payment hamper checkout.
- Local build and syntax checks passed. Automated tests passed 53/53, including invalid and stale imports, deposit verification and collection, and hamper pricing and personalization. Reimported an edited copy of the supplied workbook in a separate test shelf and verified additions, repricing, removals, and reload.
- Desktop and mobile browser checks passed. All 37 image URLs loaded. The supplied workbook and admin remained available after a full local restart. Removed 70 verified temporary files and kept the isolated preview data.
- Preview runs with `npm run dev:catalogue` at `http://localhost:4173`. The real workbook leaves selling units and customer pricing incomplete, so affected entries appear without checkout. Production services and data were outside this work.

## 2026-11-08 Wholesale + hamper work reverted

- Local Nov 7 meeting implementation (wholesale shop/drinks, hamper collections, 70/30 deposit, admin inventory, cocktail page, hamper art) was **fully undone** and never redeployed.
- Restored tracked files to `HEAD` (`df03196`); removed new files (`pages/drinks.html`, `pages/cocktails.html`, `js/wholesale-products.js`, `js/hampers.js`, `js/site-nav.js`, `js/cocktails-menu.js`, `lib/hampers.js`, `test/wholesale-commerce.test.js`, `scripts/gen-hamper-art.py`, `assets/gifting/hampers/`).
- Working tree clean after revert. Cloud Run unchanged throughout.
- Meeting notes / inventory spreadsheet remain reference only — not in code.

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
