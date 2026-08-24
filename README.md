# Yodla storefront

A responsive drinks storefront deployed publicly on Cloud Run. The Yodla-branded publishing shelf remains local-only for future work.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:4173`. Product and article routes are rendered with SEO metadata on the server. Local development retains the admin prototype at `http://localhost:4173/admin`.

## Production

`npm run build` creates a public-only `public/` directory, and `npm start` serves the production application on `PORT`. The Docker image excludes `admin/` and `api/admin/`; both URL families return 404 in production.

The live service is `https://yodla-fwy32oha6q-uc.a.run.app`. Crawlable outputs include `/products/<slug>`, `/journal/<slug>`, `/sitemap.xml`, `/rss.xml`, and `/llms.txt`. Legacy product and blog query URLs redirect to canonical routes.

## Content

The public site reads a published shelf snapshot. If none is stored, it uses the bundled catalogue in `js/catalog.js` and `js/blogs.js`. Admin source can edit content locally, but durable production publishing is intentionally not deployed.

## Ask Yodla

Production uses Gemini 2.5 Flash through Vertex AI and the Cloud Run service account—there is no API key or service-account key. The public response exposes only `reply` and validated catalogue `productIds`. Local development uses deterministic catalogue recommendations unless `YODLA_VERTEX_ENABLED=true` and Application Default Credentials are available.

## Prototype boundaries

- Account data is stored only in the current browser; do not use a real or reused password.
- Checkout does not take payment or create a delivery.
- Some Yodla Studio catalogue products and imagery are fictional concepts.
- Location availability is status content, not a live quantity feed.
- Admin source is local-only and is not included in the production image.

## Checks

```powershell
npm run check
npm run build
npm test
```

## Main files

- `js/main.js` — storefront rendering and interactions
- `js/hero-carousel.js` — gallery normalization, wrapping, and announcements
- `js/concierge-api.js` — constrained Vertex AI concierge and deterministic fallback
- `lib/content-store.js` — published shelf snapshot
- `lib/seo-render.js` — SEO tags, GEO JSON-LD, and `llms.txt`
- `scripts/public-server.mjs` — public-only production server
- `admin/` — local-only publishing prototype excluded from production
