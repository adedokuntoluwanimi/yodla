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

The personal basket uses the existing `yodla-cart-v2` contract. The Gift Atelier uses the existing version-2 `yodla-gift-draft`: up to five unique recipients, independent bottle quantities, delivery details, personal messages, optional wrapping, and notification preference. Each checkout link uses its existing normal or `?gift=1` flow.

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

## Counter and mobile review update

Nneka hosts gifting and Daniel hosts checkout. The 3D staff have name badges and articulated arms. Responsive SVG preparation scenes use the selected products and attach the recipient, message, and delivery details to the gift; checkout adds the selected lines and total to its receipt. Preparation supports replay, direct stage selection, instant completion, and reduced motion. Yodla’s supplied wordmark appears in the store, on counters, bags, and cards. Interface symbols use SVG.

Optional music is an original browser-synthesised ambient sequence. It starts only on the visitor’s explicit request, includes a volume control, and suspends while the page is hidden.

Mobile improvements include sticky actions, compact saved recipients, preservation of unfinished recipient details during navigation, bottle search, stable focus/scroll when quantities change, guidance to recipients with missing bottles, and confirmation before removing recipients. The final checkout makes preparation optional, hides the floating bag and concierge launchers, offers Ask Yodla in normal page flow, and no longer opens the handoff drawer automatically.

QA used desktop and a 390-by-667 CSS viewport, including recipient entry, missing-bottle guidance, personalisation, wrapping, and checkout. WebGL remains disabled in the available QA browser, so physical staff appearance, 3D picking, and camera feel need a WebGL-enabled device review. Touch gestures, an actual phone keyboard, and subjective music quality have not been device-tested.
