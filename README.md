# Yodla storefront

A responsive drinks storefront on Cloud Run, with a public publishing shelf at `/admin/` that writes durable content and uploads to a private GCS bucket.

Live: https://yodla-fwy32oha6q-uc.a.run.app

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:4173`. Product and journal routes are server-rendered with SEO/GEO metadata. Admin is at `http://localhost:4173/admin/`.

## Production

```powershell
npm run build
npm start
```

`npm run build` writes `public/` (storefront + admin). Cloud Run serves that via `scripts/public-server.mjs`.

| Item | Value |
| --- | --- |
| GCP project | `project-9afac` |
| Region | `us-central1` |
| Service | `yodla` |
| Content bucket | `project-9afac-yodla-content` |
| Runtime identity | `yodla-runtime@project-9afac.iam.gserviceaccount.com` |

Set at least:

```
PUBLIC_SITE_URL=https://yodla-fwy32oha6q-uc.a.run.app
GOOGLE_CLOUD_PROJECT=project-9afac
YODLA_GCS_BUCKET=project-9afac-yodla-content
YODLA_VERTEX_ENABLED=true
GEMINI_MODEL=gemini-2.5-flash
```

See `.env.example`. Never commit real secrets.

## Content and admin

- Published shelf and uploads live in GCS (`content/yodla-shelf.json` and `uploads/`).
- Locally, without `YODLA_GCS_BUCKET`, the shelf is `data/shelf.json` and uploads land in `assets/uploads/`.
- `/admin/` is intentionally unauthenticated until someone adds the guide below. Treat every publish as live.

## Ask Yodla

Production uses Gemini 2.5 Flash through Vertex AI and the Cloud Run service account (no API key). Locally it stays on deterministic catalogue recommendations unless Vertex ADC is enabled.

## Prototype boundaries

- Checkout takes no payment and creates no durable order.
- Accounts, bag, and delivery forms are browser-local.
- Some catalogue products and imagery are fictional concepts.
- Location availability is status content, not live inventory.

## Checks

```powershell
npm run check
npm run build
npm test
```

## Protecting `/admin` (for collaborators)

`/admin/` and `/admin/api/*` can change live catalogue content. Add authentication before sharing the URL widely. Preferred options for this Cloud Run + Node server:

### Option A — HTTP Basic Auth on admin routes (smallest change)

1. Agree a shared username/password with the repo owner; store them as Cloud Run secrets, for example `ADMIN_USER` and `ADMIN_PASSWORD`.
2. In `scripts/public-server.mjs` (and the matching paths in `scripts/dev-server.mjs` if you want local parity), reject unauthenticated requests whose path starts with `/admin` or `/api/admin`:
   - Read the `Authorization` header.
   - Decode Basic credentials and compare to the env vars with a constant-time check.
   - On failure, respond `401` with `WWW-Authenticate: Basic realm="Yodla Shelf"`.
3. Keep `/health` and the public storefront routes open.
4. Redeploy Cloud Run after the change.
5. Remove or soften the “Public admin — no sign-in is enabled” banner in `admin/index.html` once auth is live.

Do not put the password in git, client JS, or chat logs.

### Option B — Google Identity-Aware Proxy (IAP)

1. In Google Cloud Console, enable IAP for the `yodla` Cloud Run service (or put a HTTPS load balancer in front and enable IAP there).
2. Add the collaborator’s Google account under IAP access (or a Google Group).
3. Confirm the storefront remains publicly invokable if you only want `/admin` gated—IAP is usually whole-service, so use Option A or a separate admin service if you need public shop + private shelf.
4. Document who has access in your team notes, not in this repo.

### Option C — Separate private admin service

1. Split admin into its own Cloud Run service that is not publicly invokable.
2. Grant the collaborator `roles/run.invoker` (or use IAP on that service only).
3. Point the admin UI at the private service URL; keep the public storefront on the existing `yodla` service reading the same GCS shelf.

### After auth ships

1. Rotate any credentials that were shared in plain text.
2. Run `npm test` and a manual publish/upload check on a staging revision before promoting traffic.
3. Update the admin banner so it no longer claims the shelf is public.

## Main files

- `js/main.js` — storefront rendering and interactions
- `js/hero-carousel.js` — gallery behaviour
- `js/concierge-api.js` — Vertex concierge + fallback
- `lib/content-store.js` — published shelf snapshot
- `lib/persist.js` — GCS / local file persistence
- `lib/seo-render.js` — SEO tags, GEO JSON-LD, `llms.txt`
- `scripts/public-server.mjs` — production HTTP server
- `admin/` — publishing UI
- `api/uploads.js` — same-origin upload reads
- `DESIGN-NOTES.md` — visual and product direction
