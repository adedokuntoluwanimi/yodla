import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { PRODUCTS } from "../js/catalog.js";

test("every product has compact and large WebP variants", () => {
  for (const product of PRODUCTS) {
    for (const width of [480, 900]) {
      const path = `assets/products/responsive/${product.id}-${width}.webp`;
      assert.ok(existsSync(path), `${path} should exist`);
      assert.ok(statSync(path).size < 300_000, `${path} should remain mobile-friendly`);
    }
  }
});

test("interface symbols use the shared accessible SVG sprite", () => {
  const sprite = readFileSync("assets/icons.svg", "utf8");
  for (const id of ["arrow-up-right", "arrow-up", "chevron-left", "chevron-right", "check", "alert", "spark", "close", "bag", "search", "account", "location"]) {
    assert.match(sprite, new RegExp(`id="${id}"`));
  }
  const interfaceSource = ["pages/index.html", "pages/product.html", "pages/checkout.html", "pages/blog.html", "js/main.js"]
    .map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(interfaceSource, /[↗↑→←✓✦⌁×−↵]/u);
});
