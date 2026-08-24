# Yodla Status

## 2026-08-24 — GCP storefront release live

- Public URL: `https://yodla-fwy32oha6q-uc.a.run.app`.
- Active revision: `yodla-00005-big`, Ready, 100% traffic, no revision tags.
- Final Cloud Build: `230bd9d5-057e-4141-a9bf-f59fb40f1f62` (`SUCCESS`).
- Runtime: Cloud Run `us-central1`, 1 CPU, 512 MiB, concurrency 40, timeout 30 seconds, min 0, max 3.
- Identity: `yodla-runtime@project-9afac.iam.gserviceaccount.com` with `roles/aiplatform.user`; no key material.
- Homepage now has four original occasion photographs with manual arrows, keyboard controls, swipe support, responsive AVIF/WebP, and accessible position announcements.
- Vertex AI Gemini 2.5 Flash powers Ask Yodla with strict identity/scope controls, structured output, catalogue ID validation, disclosure sanitization, rate/concurrency limits, and deterministic fallback.
- Valid SVG, ICO, and Apple touch icons ship on static, SSR, and 404 pages.
- Production excludes admin source and returns 404 for `/admin` and `/api/admin/*`.
- Checkout remains a no-payment browser prototype; accounts and bag state remain browser-local.
- Release gates: syntax check, production build, 38 Node tests, Cloud Build/container readiness, private candidate checks, public route/API checks, and fresh revision error-log checks passed.
- Known platform exception: Cloud Run reserves some paths ending in `z`, so its frontend intercepts `/healthz`; use `/health` on the live service. The container still implements `/healthz` for local/container checks.
- Visual browser automation could not run because the local browser CLI was unavailable and the in-app browser bridge timed out; responsive behavior is covered by implementation/unit/build checks but still merits a human screenshot pass.
