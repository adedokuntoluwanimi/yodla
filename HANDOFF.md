# HANDOFF

## Production handoff (2026-11-09)

- `https://yodla.ng` is live on `yodla-workbook-live` at 100%. The supplied workbook populated the private versioned shelf with 34 products and three hampers. Use `https://yodla.ng/admin/#import` for future revisions.
- Release build `efc55d50-bd9b-4d09-9ce0-d7ea02ebd003` passed, as did 53 tests and public HTTP and browser checks. The import route rejects anonymous access. Signed-in publishing was exercised on the isolated preview.
- Configure Yodla’s live Paystack secret before enabling online payments. The live checkout routes shoppers to Contact Yodla. Review live payment verification and order email routing when the payment configuration is ready.
- For rollback, the preceding Cloud Run revision is `yodla-00023-h47` and points to the previous shelf. That revision predates the production payment guard, so include checkout behavior in any rollback decision.

## Current handoff (2026-11-09) Local catalogue preview

- The supplied workbook is published to the isolated local shelf. Open `http://localhost:4173/shop.html`, `/gifting.html`, or `/admin/#import`. Restart with `npm run dev:catalogue` if needed. Preserve `tmp/yodla-catalogue-local/` to keep the current preview.
- Drink cards, product details, and picker thumbnails use category-colored display backgrounds. The original catalogue assets remain the image source. Reviewed on desktop and mobile with seven focused tests passing.
- The gifting preview shows collection categories first, then package details and quote or checkout options. Its searchable drink picker uses published inventory and accepts multiple drinks with separate quantities. The Journal shows a numbered story index and opens full articles. The homepage uses the original four carousel images, and the category strip omits Weekend.
- The local build and checks passed with 53 automated tests. The edited-workbook reimport used a disposable shelf so the preview retains the original workbook.
- All 23 priced wholesale products can be added to the bag. The shop starts each product at six selling units and uses a generic listed-unit label when the workbook unit is blank. Add cocktail and mocktail prices in the menu’s `Customer price (NGN)` column. Add hamper base prices in `Gifting!E3`, `E26`, and `E50`, or supply complete included-item prices. Enter add-on amounts separately and confirm single-unit pricing for extra drinks sold through hamper checkout.
- Meeting follow-ups include supplier pack confirmation, the deferred custom drink builder, gateway verification, confirming the order mailbox and William’s mobile access, Journal SEO content, and event outreach. The preview uses mock payments and local contact storage.

## Current handoff: 2026-11-08 Wholesale work undone

- Reverted all local Nov 8 wholesale/hamper/admin-inventory/cocktail changes. Repo matches pre-session `HEAD` for those files; new artifacts deleted. **Not deployed.**
- Source of requirements still available: Gemini meeting notes (Nov 7) + `Yodla Inventory Sheeet Live.xlsx` in Downloads — do not re-apply unless asked.
- Live Cloud Run still prior revision (`yodla-00021-rck` era): https://yodla-fwy32oha6q-uc.a.run.app
- Working tree clean after revert (docs updated for this undo only).

### Next (priority)

1. Confirm with Tolu whether Nov 7 wholesale/hamper work should be re-planned or dropped.
2. Otherwise resume Gift Club preview QA path below (historical), or gift-deck Cloud Run redeploy if that is the focus.
3. If local `npm run dev` was left running during the undo, restart it so it serves the restored tree.

## Historical: 2026-10-11 Gift Club preview

- Latest correction: switched the separate Gift Club preview to Yodla's oxblood/ember/cream/ink palette, recolored Pip and Dot, and constrained the hero headline and speech bubble. Latest preview `dpl_E6L6f6CNvYdb5afkBfzE2CyPSQsx`: https://yodla-gift-club-f0z8lz1cc-tolu6.vercel.app .
- Build and release from `vercel-site/`: `npm run build`, `npm test`, `vercel build --scope tolu6`, then `vercel deploy --prebuilt --scope tolu6`.
- Priority if resuming Gift Club: visual desktop/mobile + keyboard/reduced-motion; gift journeys; Firebase preview domain; Paystack test/mock. Keep preview only until those pass.

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
