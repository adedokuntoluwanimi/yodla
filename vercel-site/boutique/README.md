# Yodla virtual wine boutique

Branch: `feature/virtual-wine-boutique`. This replaces the preview build's entry, shop, and gifting pages. Root storefront pages and production hosting are not redeployed.

## Run

From the repository root:

```sh
npm ci
npm run build --prefix vercel-site
npm run dev --prefix vercel-site
```

Open `http://localhost:4180`. The dev server also accepts `--host` and `--port` arguments. Local preview uses the bundled catalogue and returns 503 for payment and message APIs. It cannot place an order or send an email.

## Experience

Desktop: click the floor to move, drag to look, and click bottles. No keyboard movement handlers are installed. The map also moves the camera along paths that clear furniture. Phone: tap section buttons to move to a shelf or counter. Every bottle is also accessible through the bottle list.

The personal basket uses the existing `yodla-cart-v2` contract. The Gift Atelier uses the existing version-2 `yodla-gift-draft`: up to five unique recipients, independent bottle quantities, delivery details, personal messages, optional wrapping, and notification preference. The boutique now completes its counter handover and a simulated POS payment in the room. The separate legacy checkout page remains available.

Individual recipient messages now pass through server normalization and are preferred by gift notification emails. That server change must ship with the frontend before using personalized messages in a hosted checkout. The existing Vercel API proxy still points to the current Cloud Run backend; this branch does not update that backend or its credentials.

Notifications render inside the active native dialog so they remain above its backdrop. The review payment guard allows the local recipient form to submit.

The room uses locally served Three.js, procedural walnut and marble textures, bottle geometry, brass fittings, warm lighting, and an oxblood gift counter. Bottle geometry represents catalogue products; product details and gift previews use the existing product photographs. Reduce-motion removes camera travel and the box animation. WebGL failure leaves the catalogue, recipient forms, gift preview, and checkout handoff available.

## Validation and remaining review

For the private Sites review snapshot, run `node scripts/export-boutique-preview.mjs <existing-site-checkout>` after building. This preserves the Site identity and injects the review-only guard.

Run the preview build before tests. Root release tests also expect `public/`, which `node scripts/build-static.mjs` creates from the unchanged root storefront pages.

```sh
node scripts/build-static.mjs
npm test
npm run check
node --check vercel-site/boutique/boutique.js
node --check vercel-site/boutique/boutique-scene.js
```

Automated checks cover furniture collision, every station-to-station route, five-recipient persistence and removal, independent assignments, stock changes, server totals, and recipient message limits. Browser checks covered the non-WebGL catalogue, personal basket, recipient save, bottle assignment, wrapping, and gift-checkout summary, plus the 390px responsive layout.

The available QA browser disables WebGL. Review lighting, camera framing, bottle picking, movement feel, and performance in a browser with WebGL enabled before release. Real touch-device input and payment completion remain unverified. No payment or email was sent during testing.

## Counter handover update

There is no packing modal or watch/replay action. Bringing a basket to Daniel or Nneka closes the selection dialog, moves the camera to that counter, and starts service automatically. A carried basket is visible while shopping. The immutable order ledger expands every selected quantity and retains its product ID, price, and recipient assignment. Each drink moves from the basket to a counter scan position and into the correct bag or recipient box. Rendering keeps only twelve remaining bottles and the transfer visible to bound mobile GPU load, while the full ledger drives every transfer.

Each completed gift box gets its own name and message card. Full untruncated messages and separate delivery labels remain readable through the counter’s gift-tag details. Boxes close separately as their recipient’s selection finishes. The POS appears after packing, opens a clearly labelled demo gateway, and prints a sample receipt only after simulated success. Declining or closing payment leaves the packed basket available for retry. These previews never place orders, charge cards, or send recipient emails. Checkout contact details and personal/gift baskets survive returning to shopping.

Characters have articulated fingers, connected working arms, shaped facial features, fabric and skin surfaces, collars, apron seams, and name badges. Actual Yodla logos appear on the boutique walls and counters. Bottle silhouettes vary for wine, cognac, spirits and beer, with deterministic glass and matching product labels. Product photos in the accessible room fallback and ledger use the exact chosen products.

Music remains optional and suspends while the page is hidden. Mobile checkout has no floating concierge over its controls.

Validation includes pure order sequencing, quantity and recipient integrity, payment/receipt ordering, and a room simulation using real Three geometry and transforms with the GPU renderer stubbed. The room simulation packs five recipients, checks for non-finite transforms, prints a receipt, resets, and starts a personal checkout. Browser simulation covered personal checkout, a declined payment, payment cancellation, successful payment and receipt, plus a 390-by-667 mobile layout with three recipients and personalized tags. The QA browser cannot create WebGL contexts, so full 3D appearance, camera composition, and physical touch-device performance still need device review.

## Readable cards, customer handover and entrance

The original cellar wordmark remains. Its companion emblem is a cropped SVG view of the existing wine-cup logo asset. The extra wall wordmarks have been removed. Name badges and recipient cards use larger, darker type on unlit materials with tone mapping disabled, so room lights cannot wash out their contrast. Recipient messages remain fully available in the accessible tag details.

A successful demo payment prints the receipt, then transfers each parcel into the first-person customer’s hands. Multi-recipient gifts are handed over separately. Only after the last transfer do “Shop more” and “Leave store” appear. Continuing removes the fulfilled quantities from the current browser-local selection while retaining recipient and delivery details; canceling before payment preserves everything.

The front wall beside Daniel has framed glass windows and a hinged glass door, brass handles, a push sign and a swinging mechanical bell. Entry and exit open the door and trigger a short synthesised chime. Audio is created only after a visitor action. Leaving follows a collision-safe route to the entrance and shows a goodbye screen with a re-entry button. Reduced motion shortens parcel handovers.
