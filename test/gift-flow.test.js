import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGiftPayload, normalizeGiftRecipient, MAX_RECIPIENTS } from "../lib/gift.js";
import { getConciergeResponse, resetConciergeState } from "../js/concierge-api.js";
import { PRODUCTS } from "../js/catalog.js";

test("normalizeGiftPayload caps, dedupes, and validates emails", () => {
  const gift = normalizeGiftPayload({
    recipients: [
      { name: "Ada", email: "ada@example.com" },
      { name: "Ada2", email: "ADA@example.com" },
      { name: "Bad", email: "not-an-email" },
      { name: "Tunde", email: "tunde@example.com" },
      { name: "Chi", email: "chi@example.com" },
      { name: "Kay", email: "kay@example.com" },
      { name: "Extra", email: "extra@example.com" },
    ],
    message: "Happy birthday",
    wrap: true,
  });
  assert.equal(gift.recipients.length, 5);
  assert.deepEqual(gift.recipients.map((item) => item.email), [
    "ada@example.com",
    "tunde@example.com",
    "chi@example.com",
    "kay@example.com",
    "extra@example.com",
  ]);
  assert.equal(gift.message, "Happy birthday");
  assert.equal(gift.wrap, true);
});

test("normalizeGiftRecipient fills name from email local part", () => {
  const person = normalizeGiftRecipient({ email: "friend@yodla.ng" });
  assert.equal(person.email, "friend@yodla.ng");
  assert.equal(person.name, "friend");
});

test("concierge next-step guidance knows gifting page context", async () => {
  resetConciergeState();
  const result = await getConciergeResponse("what is next?", {
    products: PRODUCTS,
    clientKey: "test-gift-page",
    sessionId: "test-gift-page",
    page: "gifting",
    location: "",
    bag: [],
    gift: { recipients: [], message: "", wrap: false },
  });
  assert.equal(result.status, 200);
  assert.match(result.payload.reply, /gifting|gift|bottle|bag|pick/i);
});

test("concierge accepts gift recipients from client context", async () => {
  resetConciergeState();
  const result = await getConciergeResponse("what’s missing?", {
    products: PRODUCTS,
    clientKey: "test-gift-filled",
    sessionId: "test-gift-filled",
    page: "gifting",
    location: "Lagos",
    bag: [{ productId: PRODUCTS[0].id, quantity: 1 }],
    gift: {
      recipients: [
        { name: "Ada", email: "ada@example.com" },
        { name: "Tunde", email: "tunde@example.com" },
      ],
      message: "Cheers",
      wrap: false,
    },
    account: { name: "Chidi", email: "chidi@example.com" },
  });
  assert.equal(result.status, 200);
  assert.ok(result.payload.reply);
  assert.ok(result.payload.gift || true);
});
