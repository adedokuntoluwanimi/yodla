import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, PRODUCTS, filterProducts, formatMoney, getAvailability, sortProducts } from "../js/catalog.js";

test("the catalogue has twelve distinct products and images", () => {
  assert.equal(PRODUCTS.length, 12);
  assert.equal(new Set(PRODUCTS.map(({ id }) => id)).size, 12);
  assert.equal(new Set(PRODUCTS.map(({ image }) => image)).size, 12);
});

test("catalogue filters combine category, price, query and location", () => {
  const result = filterProducts({ category: "Wines", query: "cherry", maximum: 25000, location: "Lagos" });
  assert.deepEqual(result.map(({ id }) => id), ["midnight-red"]);
});

test("each drinks category has at least one catalogue item", () => {
  CATEGORIES.filter((category) => category !== "All").forEach((category) => {
    assert.ok(PRODUCTS.some((product) => product.category === category), `${category} should not be empty`);
  });
});

test("unavailable products are excluded for a selected location", () => {
  assert.equal(getAvailability(PRODUCTS.find(({ id }) => id === "celebration-duo"), "Abuja"), "unavailable");
  assert.ok(!filterProducts({ location: "Abuja" }).some(({ id }) => id === "celebration-duo"));
});

test("sorting and Nigerian currency formatting are stable", () => {
  const prices = sortProducts(PRODUCTS.slice(0, 3), "price-asc").map(({ price }) => price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal(formatMoney(38500), "₦38,500");
});
