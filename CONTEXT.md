# Yodla Context

- Repository: `C:\Users\Tolu\Documents\Ini\Yodla`.
- GCP project: `project-9afac`; region: `us-central1`; Cloud Run service: `yodla`.
- Production URL: `https://yodla-fwy32oha6q-uc.a.run.app`; active revision: `yodla-00005-big`.
- `PUBLIC_SITE_URL` is set to that exact URL for canonical links, sitemap, RSS, robots, JSON-LD, and `/llms.txt`.
- Runtime identity is `yodla-runtime@project-9afac.iam.gserviceaccount.com`, limited to `roles/aiplatform.user`.
- Ask Yodla uses Vertex AI in `global` with `gemini-2.5-flash`, Application Default Credentials, and no API key.
- Production is built by `scripts/build-static.mjs` and served by `scripts/public-server.mjs`; `Dockerfile`, `.dockerignore`, and `.gcloudignore` exclude admin and local state.
- Admin source remains available through `npm run dev` only. Production `/admin` and `/api/admin/*` are intentionally 404.
- Bundled catalogue is the production fallback. No durable CMS publishing, real authentication, orders, payment provider, or payment secrets are present.
- Key paths: `.better-web-ui.md`, `js/hero-carousel.js`, `js/concierge-api.js`, `scripts/generate-assets.mjs`, `scripts/public-server.mjs`, `lib/seo-render.js`, and `test/`.
