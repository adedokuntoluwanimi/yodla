import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepare as prepareAdminDocument, validate as validateAdminDocument } from "../admin/lib/model.js";
import { getPublishedContent } from "../lib/content-service.js";
import { listDocuments as listLiveDocuments, resetContentStore, saveDocument } from "../lib/content-store.js";
import { getFallbackContent } from "../lib/fallback-content.js";
import { normalizeBlog, normalizeProduct, validateDocument } from "../lib/content-model.js";
import { renderContentPage, renderLlmsTxt } from "../lib/seo-render.js";
import { listDocuments } from "../lib/demo-store.js";

test("fallback content preserves the complete Luna storefront dataset", () => {
  const content = getFallbackContent();
  assert.equal(content.products.length, 12);
  assert.equal(content.blogs.length, 3);
  assert.ok(content.categories.includes("Beer & Ciders"));
  assert.deepEqual(content.locations, ["Lagos", "Abuja", "Ibadan", "Port Harcourt"]);
  assert.equal(content.home.featuredProductIds.length, 4);
  assert.equal(content.site.help.sections.length, 3);
});

test("demo shelf loads the bundled catalogue without a CMS", async () => {
  const { documents, counts } = await listDocuments();
  assert.equal(counts.products, 12);
  assert.equal(counts.blogs, 3);
  assert.ok(documents.some((item) => item._type === "homePage" && item._status === "published"));
});

test("published snapshot is reused by the storefront content API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "yodla-shelf-"));
  process.env.YODLA_SHELF_PATH = join(directory, "shelf.json");
  resetContentStore();
  const prepared = prepareAdminDocument({
    _type: "product",
    id: "live-bottle",
    name: "Live Bottle",
    brand: "Yodla",
    category: "Wines",
    price: 15000,
    slug: "live-bottle",
    description: "A bottle published from the shelf.",
    image: "assets/products/bottle.jpg",
    seo: { title: "Live Bottle SEO", description: "Buy Live Bottle from Yodla." },
    geo: { title: "Live Bottle GEO", description: "A citation-ready bottle for generative engines." },
  });
  await saveDocument(prepared, "publish");
  resetContentStore();
  const content = await getPublishedContent();
  assert.ok(content.products.some((product) => product.id === "live-bottle" && product.geo.title === "Live Bottle GEO"));
  await rm(directory, { recursive: true, force: true });
  delete process.env.YODLA_SHELF_PATH;
  resetContentStore();
});

test("republishing an archived document restores it to the storefront", async () => {
  const directory = await mkdtemp(join(tmpdir(), "yodla-archive-"));
  process.env.YODLA_SHELF_PATH = join(directory, "shelf.json");
  resetContentStore();
  const product = prepareAdminDocument({ _id: "restorable", _type: "product", id: "restorable", name: "Restorable", brand: "Yodla", category: "Wines", price: 12000, slug: "restorable", description: "A complete bottle.", image: "assets/products/bottle.jpg" });
  await saveDocument(product, "publish");
  await saveDocument(product, "archive");
  assert.equal((await listLiveDocuments()).documents.find((item) => item._baseId === "restorable")._status, "archived");
  await saveDocument({ ...product, archived: true }, "publish");
  const content = await getPublishedContent();
  assert.ok(content.products.some((item) => item.id === "restorable"));
  await rm(directory, { recursive: true, force: true });
  delete process.env.YODLA_SHELF_PATH;
  resetContentStore();
});

test("products with array availability normalize stock and SEO fields", () => {
  const product = normalizeProduct({
    _id: "test-bottle", _type: "product", name: "Test Bottle", brand: "Yodla", category: "Spirits", price: 12000,
    slug: "test-bottle", image: "assets/products/test.jpg", availability: [{ location: "Lagos", status: "in-stock" }, { location: "Abuja", status: "invalid" }],
    seo: { secondaryKeywords: "hosting, nigeria, hosting", tags: ["gift", "gift"] },
    geo: { title: "Test Bottle GEO", description: "A GEO description." },
  });
  assert.equal(product.availability.Lagos, "in-stock");
  assert.equal(product.availability.Abuja, "unavailable");
  assert.deepEqual(product.seo.secondaryKeywords, ["hosting", "nigeria"]);
  assert.deepEqual(product.seo.tags, ["gift"]);
  assert.equal(product.geo.title, "Test Bottle GEO");
});

test("publish validation blocks incomplete products and articles", () => {
  const product = validateDocument({ _type: "product", id: "draft", name: "Draft", brand: "Yodla", category: "Wines", price: 1000 }, { publish: true });
  assert.equal(product.valid, false);
  assert.ok(product.errors.description);
  assert.ok(product.errors.image);
  assert.ok(product.errors.seoTitle);
  assert.ok(product.errors.geoTitle);
  const blog = validateDocument({ _type: "blogPost", id: "draft-story", title: "Draft", excerpt: "Short" }, { publish: true });
  assert.ok(blog.errors.introduction);
  assert.ok(blog.errors.sections);
});

test("admin preparation removes UI metadata and preserves publishable fields", () => {
  const document = prepareAdminDocument({ _id: "drafts.test", _baseId: "test", _status: "modified", _type: "product", id: "test", name: "Bottle", brand: "Yodla", category: "Wines", price: 5000, slug: "bottle", slugValue: "bottle", imageUrl: "preview", availability: { Lagos: "low-stock" } });
  assert.equal(document._id, "test");
  assert.equal(document._status, undefined);
  assert.equal(document.imageUrl, undefined);
  assert.equal(document.slug.current, "bottle");
  assert.deepEqual(document.availability.map(({ location, status }) => ({ location, status })), [{ location: "Lagos", status: "low-stock" }]);
  assert.deepEqual(validateAdminDocument(document, false), {});
});

test("server-rendered product pages contain canonical, SEO and GEO data", () => {
  const product = normalizeProduct({ id: "structured-bottle", name: "Structured Bottle", brand: "Yodla", category: "Wines", slug: "structured-bottle", price: 22000, description: "A bottle with complete metadata.", image: "assets/products/bottle.jpg", availability: { Lagos: "in-stock" }, seo: { title: "Structured Bottle in Nigeria", description: "Buy Structured Bottle from Yodla.", faqs: [{ question: "How should it be served?", answer: "Serve chilled." }] }, geo: { title: "Structured Bottle GEO", description: "A citation-ready Nigerian wine." } });
  const html = renderContentPage(product, "product");
  assert.match(html, /<link rel="canonical" href="https:\/\/yodla-fwy32oha6q-uc\.a\.run\.app\/products\/structured-bottle">/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /Structured Bottle GEO/);
  assert.match(html, /data-geo-abstract/);
  assert.match(html, /data-content-slug="structured-bottle"/);
});

test("llms.txt includes GEO citations", () => {
  const content = getFallbackContent();
  const text = renderLlmsTxt(content);
  assert.match(text, /# Yodla/);
  assert.match(text, /## Products/);
  assert.match(text, /## Journal/);
});

test("server-rendered journal pages contain article metadata without draft content", () => {
  const post = normalizeBlog({ id: "useful-story", title: "A useful story", slug: "useful-story", excerpt: "Useful notes.", introduction: "Start here.", sections: [{ heading: "One", body: "Body" }], image: "assets/story.jpg", seo: { robots: "index,follow" } });
  const html = renderContentPage(post, "blog");
  assert.match(html, /"@type":"Article"/);
  assert.match(html, /<meta name="robots" content="index,follow">/);
  assert.doesNotMatch(html, /drafts\./);
});
