import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

test("production build contains the storefront and public no-auth admin", () => {
  assert.ok(existsSync("public/admin/index.html"));
  assert.ok(existsSync("public/admin/app.js"));
  assert.ok(existsSync("public/admin/styles.css"));
  assert.equal(existsSync("public/api/admin"), false);
  assert.ok(existsSync("public/checkout.html"));
  assert.match(readFileSync("public/checkout.html", "utf8"), /no payment will be taken/i);
  assert.match(readFileSync("public/admin/index.html", "utf8"), /Public admin — no sign-in is enabled/);
  const adminApp = readFileSync("public/admin/app.js", "utf8");
  assert.match(adminApp, /heroSlides/);
  assert.match(adminApp, /data-image-kind="heroSlide:/);
  assert.match(adminApp, /responsiveBase\.value = ""/);
});

test("production server retains container healthz and a Cloud Run-safe health endpoint", () => {
  const server = readFileSync("scripts/public-server.mjs", "utf8");
  assert.match(server, /pathname === "\/health" \|\| pathname === "\/healthz"/);
  assert.match(server, /"\/admin\/api\/document", adminDocument/);
  assert.match(server, /import uploads from "\.\.\/api\/uploads\.js"/);
});

test("valid favicon assets and links are present on every built page", () => {
  const ico = readFileSync("assets/brand/favicon.ico");
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.ok(statSync("assets/brand/apple-touch-icon.png").size > 1_000);
  assert.ok(existsSync("public/favicon.ico"));
  assert.ok(existsSync("public/favicon.svg"));
  assert.ok(existsSync("public/apple-touch-icon.png"));
  for (const file of ["account", "bag", "blog", "checkout", "help", "index", "journal", "product", "shop"]) {
    const html = readFileSync(`public/${file}.html`, "utf8");
    assert.match(html, /href="\/favicon\.svg"/);
    assert.match(html, /href="\/favicon\.ico"/);
    assert.match(html, /href="\/apple-touch-icon\.png"/);
  }
  const admin = readFileSync("public/admin/index.html", "utf8");
  assert.match(admin, /href="\/favicon\.svg"/);
  assert.match(admin, /href="\/favicon\.ico"/);
  assert.match(admin, /href="\/apple-touch-icon\.png"/);
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
