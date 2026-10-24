# Yodla gifting experience

This is a separate Vercel site. It shares Yodla's current catalogue, gift draft, checkout logic and public APIs, while the Cloud Run storefront and admin remain unchanged.

Run `npm run build` from this directory, then `npm run dev` for local preview at `http://localhost:4180`. The build copies approved customer assets and modules from the repository into `dist/`, adds the new pages and design layer, and excludes `admin/` and server code. `dist/` is generated and ignored.

The new `tolu6/yodla-gift-club` Vercel project is linked from this directory. Its preview is isolated from the existing `yodla` project and Cloud Run. The CLI uploads this directory without its parent, so a remote source build cannot read the shared modules. For preview releases, run `vercel build --scope tolu6` locally, followed by `vercel deploy --prebuilt --scope tolu6`. The local build packages only the customer site in `.vercel/output`. No production domain is assigned; previews are `noindex`.

Public API paths are explicitly proxied to Cloud Run through `vercel.json`. The checkout callback uses the Vercel origin. Keep this at preview until the full purchase journey is tested with Paystack test credentials or a safe mock, and Firebase accepts the preview domain for account sign-in.
