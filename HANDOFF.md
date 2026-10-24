# HANDOFF

## Current handoff: 2026-10-11 Gift Club preview

- Latest correction: switched the separate Gift Club preview to Yodla's oxblood/ember/cream/ink palette, recolored Pip and Dot, and constrained the hero headline and speech bubble to stop the screenshot's word collisions. Latest preview `dpl_E6L6f6CNvYdb5afkBfzE2CyPSQsx`: https://yodla-gift-club-f0z8lz1cc-tolu6.vercel.app . Build and 3/3 focused tests passed; the prior preview's served CSS matched the local build hash. Rendered browser check still pending because automatic approval review rejected browser automation.
- Completed a separate gifting-first customer site under `vercel-site/` with a colorful design, animated Pip and Dot characters, gift-intent paths, live recipient/note/wrapping/actual-bottle preview, and a site-wide design layer. Build output excludes admin and server source.
- New Vercel project `tolu6/yodla-gift-club`; latest **preview** `dpl_DDT4dag24gYXa2AptiWNZg7wxvwP`: https://yodla-gift-club-jbz7udmzp-tolu6.vercel.app . It is Ready, protected and noindex. Existing Cloud Run service was not redeployed; no domain moved.
- Build and release from `vercel-site/`: `npm run build`, `npm test`, `vercel build --scope tolu6`, then `vercel deploy --prebuilt --scope tolu6`. Plain remote CLI deploy fails because the uploaded subtree lacks `../scripts/build-vercel.mjs`.
- Validation: root `npm test` 51/51 passed, isolated `npm test` 3/3 passed, new JS syntax passed, preview GET `/`, product detail, journal detail, and content API succeeded; `/api/admins` was 404. Browser automation for final visual and interaction QA was rejected by automatic approval review.
- Priority next: visually review desktop/mobile and keyboard/reduced-motion, test single and five-recipient journeys plus editing/removal/unavailable bottle, confirm Firebase preview domain, and run Paystack test or safe mock checkout return/failure/self-purchase. Keep preview only until those checks pass. Do not use live payment credentials for preview testing.
- Worktree remains very dirty with many unrelated user changes and untracked `CAC/`, `tmp/`; no commit or push was made. Do not stage unrelated files or deploy Cloud Run for this redesign.

## Historical handoff below (superseded for current next steps)

## Just finished (local)

- Homepage-style transitional gift deck: `pages/gifting.html` + `renderGiftDeck` / `renderGiftVisual` in `js/main.js` + `.gift-deck` CSS.
- Carousel controls (`data-gift-direction`), keyboard on `[data-gift-visual]`, `?step=` support.
- Intro panel visually aligned with landing hero (local screenshot `tmp/gift-shots/step0.png`).
- `npm test` green (48). Dev server was used at `http://localhost:4173`.

## Not done

- Redeploy gift-deck rewrite to Cloud Run (live still older gift UX from `yodla-00021-rck`).
- Full visual pass on steps 1–3 (people form, bottle rail, review) at desktop + mobile; tighten if panels overflow the hero.
- Optional: swipe on gift stage like homepage hero; more distinct stage images per step if ribbon/table feel repetitive.
- Git commit / push — **not requested**; working tree is very dirty (gifting + commerce + contact + admin + CAC untracked).

## Next (priority)

1. Open `http://localhost:4173/gifting.html` and click through Build → people → bottles → review; fix any layout/motion gaps vs homepage.
2. `npm test` + `npm run check` (or at least `node --check js/main.js`).
3. Deploy when approved: `gcloud run deploy yodla --source . --region us-central1 --project project-9afac --quiet`
4. Live verify `https://yodla-fwy32oha6q-uc.a.run.app/gifting.html` + one gift checkout path if Paystack test keys available.
5. Only then commit if asked (exclude `.env*`, `CAC/`, `tmp/`, `data/carts.json` if secret-ish).

## Verify commands

```powershell
npm test
node --check js/main.js
npm run dev
# browser: /gifting.html  /gifting.html?step=1  /contact.html
```

## Gotchas for next agent

- Gift step index is **0-based** (intro=0). Old “step 1 of 3” copy maps to panels 1–3.
- Concierge page string: `gifting:step${dataset.giftStep}`.
- Do not regress notify-first multi-recipient mail contract in `lib/gift.js` / `lib/mail.js`.
- Ignore unrelated dirty files unless the task needs them; do not commit CAC PDFs.
