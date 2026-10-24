import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { findDetail, renderDetailPage } from "../api/detail.js";

const content = {
  products: [{ slug: "gift-bottle", name: "A great bottle", description: "A bottle to share.", image: "assets/products/example.webp" }],
  blogs: [{ slug: "little-note", title: "The little note", excerpt: "Write from the heart." }],
};

test("detail routes find the intended product or story", () => {
  assert.equal(findDetail(content, "product", "gift-bottle")?.name, "A great bottle");
  assert.equal(findDetail(content, "blog", "little-note")?.title, "The little note");
  assert.equal(findDetail(content, "product", "missing"), undefined);
});

test("detail HTML has its own metadata and gift club assets", () => {
  const html = renderDetailPage({ ...content.products[0], name: '<Bottle & note>' }, "product", "https://preview.example");
  assert.match(html, /&lt;Bottle &amp; note&gt;/);
  assert.match(html, /<meta property="og:url" content="https:\/\/preview\.example\/products\/gift-bottle">/);
  assert.match(html, /css\/gift-club\.css/);
  assert.match(html, /data-content-slug="gift-bottle"/);
  assert.doesNotMatch(html, /<Bottle & note>/);
});

test("Vercel output contains the customer experience and excludes admin code", () => {
  const output = join(import.meta.dirname, "..", "dist");
  for (const name of ["index.html", "gifting.html", "shop.html", "checkout.html", "css/gift-club.css", "assets/characters/pip.webp", "assets/characters/dot.webp"]) {
    assert.equal(existsSync(join(output, name)), true, `${name} is required`);
  }
  for (const name of ["admin", "assets/uploads", "js/concierge-api.js"]) assert.equal(existsSync(join(output, name)), false, `${name} must stay private`);
  const home = readFileSync(join(output, "index.html"), "utf8");
  const gifting = readFileSync(join(output, "gifting.html"), "utf8");
  assert.match(home, /id="scene"/);
  assert.match(home, /boutique.js/);
  assert.equal(existsSync(join(output, "js/vendor/three/three.core.js")), true);
  assert.equal(existsSync(join(output, "css/boutique.css")), true);
  assert.match(gifting, /Gift Atelier/);
  assert.match(gifting, /id="store-dialog"/);
});
