# Yodla storefront redesign

This prototype borrows the useful commerce conventions of drinks.ng—browseable categories, product discovery, location-aware availability and a quick bag—without copying its visual identity or content.

## Direction

- Editorial Nigerian nightlife rather than a generic marketplace aesthetic.
- Oxblood, ember orange, cream and ink create a recognisable Yodla palette.
- Bricolage Grotesque carries expressive headlines; Manrope and DM Mono keep commerce information precise.
- Product imagery is deliberately integrated into dark, photographic stages instead of repeated white cards.
- Motion has hierarchy: page reveals are quiet, while adding a bottle creates a clear fly-to-bag confirmation.

## Prototype behaviour

- Twelve distinct catalogue products and twelve distinct images.
- Search, category, price, sorting, occasion links and delivery-city availability.
- Persistent local cart and location, quantity controls, animated removal, cart drawer and full bag page.
- Skeleton catalogue loading, empty searches and filters, unavailable stock, checkout processing, failure and success states.
- Checkout is intentionally non-transactional and is labelled as a prototype. Add `?state=failure` to `checkout.html` to inspect its failure state.
- Mobile layouts are touch-first from 320px, with full-screen drawers, safe-area handling, a sticky product purchase bar and a bottom-right SVG bag that receives the add-to-cart animation.
- The Journal includes a real article index and individual responsive blog pages driven by `js/blogs.js`.

## Original generated assets

Eight fictional Yodla product concepts were generated with the built-in image generation workflow and optimized into `assets/products/originals`. The other four products retain the supplied repository photography. Fictional products are marked in catalogue data and on their detail pages.

Every catalogue image also has 480px and 900px WebP variants under `assets/products/responsive` for responsive delivery while preserving the original files as fallbacks.
