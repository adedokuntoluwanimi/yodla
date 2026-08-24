import test from "node:test";
import assert from "node:assert/strict";
import { catalogueReply } from "../js/concierge.js";
import { getProduct } from "../js/catalog.js";

test("concierge respects a category and budget using real catalogue products", () => {
  const result = catalogueReply("Suggest wine under ₦25,000 for dinner");
  assert.equal(result.mode, "catalogue");
  assert.ok(result.productIds.length > 0);
  result.productIds.forEach((id) => {
    const product = getProduct(id);
    assert.equal(product.category, "Wines");
    assert.ok(product.price <= 25000);
  });
});

test("concierge always returns usable catalogue links", () => {
  const result = catalogueReply("something surprising");
  assert.ok(result.productIds.every((id) => getProduct(id)));
});
