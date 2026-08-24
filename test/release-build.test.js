import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

test("production build contains only public storefront files", () => {
  assert.equal(existsSync("public/admin"), false);
  assert.equal(existsSync("public/api/admin"), false);
  assert.ok(existsSync("public/checkout.html"));
  assert.match(readFileSync("public/checkout.html", "utf8"), /no payment will be taken/i);
});

test("production server retains container healthz and a Cloud Run-safe health endpoint", () => {
  const server = readFileSync("scripts/public-server.mjs", "utf8");
  assert.match(server, /pathname === "\/health" \|\| pathname === "\/healthz"/);
});

test("valid favicon assets and links are present on every built page", () => {
  const ico = readFileSync("favicon.ico");
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.ok(statSync("apple-touch-icon.png").size > 1_000);
  for (const file of ["account", "bag", "blog", "checkout", "help", "index", "journal", "product", "shop"]) {
    const html = readFileSync(`public/${file}.html`, "utf8");
    assert.match(html, /href="\/favicon\.svg"/);
    assert.match(html, /href="\/favicon\.ico"/);
    assert.match(html, /href="\/apple-touch-icon\.png"/);
  }
});

test("four responsive hero image sets and non-autoplay controls ship", () => {
  for (const name of ["hero-celebration", "hero-dinner", "hero-hosting", "hero-zero"]) {
    for (const width of [480, 900]) {
      for (const extension of ["avif", "webp"]) assert.ok(existsSync(`public/assets/products/responsive/${name}-${width}.${extension}`));
    }
  }
  const html = readFileSync("public/index.html", "utf8");
  assert.match(html, /data-hero-direction="-1"/);
  assert.match(html, /data-hero-direction="1"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(readFileSync("js/main.js", "utf8"), /setInterval\([^)]*hero/i);
  assert.match(readFileSync("css/styles.css", "utf8"), /prefers-reduced-motion:reduce/);
});
