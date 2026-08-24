# Yodla Handoff

## Live release

- Service: `yodla` in `project-9afac`, `us-central1`.
- URL: `https://yodla-fwy32oha6q-uc.a.run.app`.
- Revision: `yodla-00005-big`, 100% traffic, Ready.
- Cloud Build: `230bd9d5-057e-4141-a9bf-f59fb40f1f62` (`SUCCESS`).
- Release source commit: `37b7d90` (`Ship Yodla Cloud Run storefront`), pushed to `origin/main` on 2026-08-24.
- Runtime: 1 CPU, 512 MiB, concurrency 40, timeout 30 seconds, min 0/max 3.
- Service account: `yodla-runtime@project-9afac.iam.gserviceaccount.com`; only `roles/aiplatform.user` was added.

## Verified

- `/`, shop, bag, account, checkout, content API, concierge, product/journal SSR, sitemap, RSS, `llms.txt`, robots, and `/health` return expected public responses.
- `/admin` and `/api/admin/*` return 404.
- Canonical/feed URLs point to the Cloud Run service.
- Favicon SVG/ICO/Apple assets return the correct MIME types.
- Real Vertex tests passed for catalogue/budget recommendations, disclosure, prompt injection, unrelated requests, invented products, and explicit-detail limits; all returned IDs were on the shelf and replies stayed below 90 words.
- No ERROR or 5xx entries were found for the final revision immediately after release verification.

## Remaining prototype boundaries

- Checkout takes no payment and creates no durable order.
- Accounts, bag, and delivery-form state are browser-local.
- Admin/CMS, durable publishing, real authentication, payment collection, and order persistence are not deployed.
- Some Yodla Studio products and imagery are fictional concepts and should remain labelled honestly.
- Cloud Run intercepts `/healthz` because it reserves some paths ending in `z`; use `/health` live.

## Recommended next checks

1. Perform a human visual pass at wide, tablet, and narrow widths because automated browser bridges were unavailable in this session.
2. If a custom domain is introduced, update `PUBLIC_SITE_URL`, redeploy, and recheck canonical/feed output.
3. Add durable commerce and authenticated admin only as separately scoped releases.
