import { normalizeBlog, normalizeProduct, slugify } from "./content-model.js";
import { getFallbackContent } from "./fallback-content.js";
import { loadShelf, persistStatus, saveShelf, saveUpload } from "./persist.js";
import { createHash } from "node:crypto";
import { purchaseReady } from "../js/catalog-order.js";

export { persistStatus };

const records = new Map();
let loaded = false;
let loadedAt = 0;
let workbook = null;
let generation;
let writes = Promise.resolve();

function writeShelf(operation) {
  const next = writes.then(operation);
  writes = next.catch(() => {});
  return next.catch((error) => {
    if (Number(error.code) === 412) throw Object.assign(new Error("The catalogue changed. Review the workbook again."), { status: 409 });
    throw error;
  });
}

function now() {
  return new Date().toISOString();
}

function slugOf(document) {
  return document?.slug?.current || document?.slug || "";
}

function seedFromFallback() {
  records.clear();
  const content = getFallbackContent();
  const stamp = new Date(0).toISOString();
  content.products.forEach((product) => {
    records.set(product.id, {
      published: { ...product, _id: product.id, _type: "product", slug: { _type: "slug", current: product.slug || product.id }, legacyImage: product.image, imageAlt: product.imageAlt || product.name, visible: true, seo: product.seo || {}, geo: product.geo || {}, _updatedAt: stamp },
      draft: null,
    });
  });
  content.blogs.forEach((post) => {
    records.set(post.id, {
      published: { ...post, _id: post.id, _type: "blogPost", slug: { _type: "slug", current: post.slug || post.id }, legacyImage: post.image, imageAlt: post.imageAlt || post.title, visible: true, seo: post.seo || {}, geo: post.geo || {}, _updatedAt: stamp },
      draft: null,
    });
  });
  records.set("taxonomy", {
    published: {
      _id: "taxonomy",
      _type: "taxonomy",
      categories: content.categories.filter((item) => item !== "All"),
      locations: content.locations,
      occasions: [...new Set(content.products.flatMap((product) => product.occasions || []))],
      subcategories: [...new Set(content.products.map((product) => product.subcategory).filter(Boolean))],
      abvValues: [...new Set(content.products.map((product) => product.abv).filter(Boolean))],
      _updatedAt: stamp,
    },
    draft: null,
  });
  records.set("siteSettings", { published: { _id: "siteSettings", _type: "siteSettings", ...content.site, _updatedAt: stamp }, draft: null });
  records.set("homePage", { published: { _id: "homePage", _type: "homePage", ...content.home, _updatedAt: stamp }, draft: null });
}

function hydrate(payload) {
  records.clear();
  workbook = payload.workbook || null;
  Object.entries(payload.records || {}).forEach(([id, group]) => records.set(id, group));
}

function serialize(next = records, nextWorkbook = workbook) {
  return { records: Object.fromEntries(next), workbook: nextWorkbook, updatedAt: now() };
}

export async function ensureLoaded({ force = false } = {}) {
  const stale = Date.now() - loadedAt > 4000;
  const remoteStore = process.env.VERCEL || process.env.YODLA_GCS_BUCKET;
  if (loaded && !force && !(remoteStore && stale)) return;
  const { payload: saved, generation: currentGeneration } = await loadShelf({ versioned: true });
  generation = currentGeneration;
  if (saved?.records) hydrate(saved);
  else {
    workbook = null;
    seedFromFallback();
  }
  loaded = true;
  loadedAt = Date.now();
}

export function resetContentStore() {
  records.clear();
  loaded = false;
  loadedAt = 0;
  workbook = null;
}

function view(group) {
  const document = group.draft || group.published;
  return {
    ...document,
    _baseId: group.id,
    _status: document.archived ? "archived" : group.draft ? (group.published ? "modified" : "draft") : "published",
    _publishedAt: group.published?._updatedAt || null,
    slugValue: slugOf(document),
    imageUrl: document.imageUrl || document.previewImageUrl || (typeof document.image === "string" ? document.image : document.legacyImage) || "",
  };
}

export async function listDocuments() {
  await ensureLoaded();
  const documents = [...records.entries()].map(([id, group]) => view({ id, ...group }));
  return {
    documents,
    persist: persistStatus(),
    counts: {
      products: documents.filter((item) => item._type === "product").length,
      blogs: documents.filter((item) => item._type === "blogPost").length,
      drafts: documents.filter((item) => item._status !== "published").length,
    },
  };
}

export async function slugTaken(type, slug, id) {
  await ensureLoaded({ force: Boolean(process.env.YODLA_GCS_BUCKET) });
  return [...records.entries()].some(([recordId, group]) => {
    if (recordId === id) return false;
    const document = group.draft || group.published;
    return document?._type === type && slugOf(document) === slug;
  });
}

export async function isManagedProduct(id) {
  await ensureLoaded();
  return Boolean(workbook?.productIds.includes(id));
}

export async function saveDocument(document, action) {
  return writeShelf(async () => {
    await ensureLoaded({ force: true });
    const id = document._id;
    const current = { ...(records.get(id) || { published: null, draft: null }) };
    const managed = current.published || current.draft;
    if (workbook && document._type === "product" && action === "publish" && !workbook.productIds.includes(id)) {
      throw Object.assign(new Error("Add this product through Import spreadsheet before publishing it."), { status: 409 });
    }
    const stamped = { ...managed, ...document, _id: id, _updatedAt: now() };
    if (workbook && managed?.sourceKey) {
      for (const key of ["id", "slug", "name", "price", "sku", "sourceKey", "catalogKind", "unit", "packSize", "minimumQuantity", "category"]) stamped[key] = managed[key];
    }
    if (action === "save") current.draft = stamped;
    else if (action === "publish") {
      current.published = { ...stamped, archived: false, publishedAt: stamped.publishedAt || now() };
      current.draft = null;
    } else if (action === "unpublish") {
      current.draft = stamped;
      current.published = null;
    } else if (action === "archive") {
      current.draft = { ...stamped, archived: true };
      if (current.published) current.published = { ...current.published, archived: true, _updatedAt: now() };
    } else {
      throw new Error("Unknown publishing action.");
    }
    const next = new Map(records);
    next.set(id, current);
    const persistInfo = await saveShelf(serialize(next), { generation });
    records.set(id, current);
    loadedAt = Date.now();
    return { document: view({ id, ...current }), persist: persistInfo };
  });
}

export async function reviewCatalogWorkbook(parsed, digest, { confirmation, editor } = {}) {
  return writeShelf(async () => {
    await ensureLoaded({ force: true });
    const catalogue = [...records.entries()].filter(([, group]) => (group.published || group.draft)?._type === "product");
    const next = new Map(records);
    const errors = [...parsed.errors];
    const changes = { added: [], updated: [], removed: [], inquiry: [], unchanged: [] };
    const claimed = new Set();
    const unresolved = [];
    const valid = catalogue.map(([id, group]) => ({ id, group, item: group.published || group.draft }));
    for (const product of parsed.products) {
      const previous = valid.find(({ id, item }) => product.matchId ? id === product.matchId
        : product.sku && item.sku?.toLowerCase() === product.sku.toLowerCase())
        || (!product.matchId && valid.find(({ item }) => item.sourceKey === product.sourceKey || (!item.sourceKey && slugify(item.name) === slugify(product.name))));
      const issue = (message) => errors.push({ sheet: product.sourceSheet, row: product.sourceRow, message });
      if (product.matchId && !previous) { issue("Match product ID does not identify an existing product."); continue; }
      if (previous && claimed.has(previous.id)) { issue("Another row already matches this product."); continue; }
      if (previous?.item.catalogKind && previous.item.catalogKind !== product.catalogKind) { issue("Match a product from the same catalogue section."); continue; }
      const { matchId, sourceRow, sourceSheet, ...fields } = product;
      let id = previous?.id || slugify(product.name);
      const taken = (key) => records.has(key) || claimed.has(key) || valid.some(({ item }) => slugOf(item) === key);
      if (!previous && taken(id)) id = `${product.catalogKind}-${id}`;
      if (!previous && taken(id)) { issue("This item needs a distinct name or an explicit matching ID."); continue; }
      if (!previous && !product.sku) unresolved.push(product);
      claimed.add(id);
      const existing = previous?.item;
      const document = {
        ...existing, ...fields, _id: id, id, _type: "product", slug: existing?.slug || { current: id }, sku: product.sku || existing?.sku || "", archived: false, visible: true,
        brand: existing?.brand || "", description: product.description || existing?.description || "",
        image: existing?.image || existing?.imageUrl || existing?.legacyImage || product.image || "",
        imageAlt: existing?.imageAlt || product.imageAlt || product.name,
        imageSource: existing?.imageSource || product.imageSource || "",
        representativeImage: existing?.representativeImage ?? product.representativeImage ?? false,
        _updatedAt: now(),
      };
      const compare = ({ _updatedAt, ...item }) => JSON.stringify(item);
      const entry = { id, name: product.name, section: product.category };
      if (existing && compare(existing) !== compare(document)) {
        const fields = { name: "Name", category: "Category", price: "Price (NGN)", unit: "Selling unit", packSize: "Pack size", minimumQuantity: "Minimum" };
        entry.details = Object.entries(fields).filter(([key]) => (existing[key] ?? "") !== (document[key] ?? ""))
          .map(([key, label]) => `${label} ${existing[key] || "—"} → ${document[key] || "—"}`);
      } else if (!existing && product.price) entry.details = [`Listed price ₦${product.price.toLocaleString("en-NG")}`];
      if (!previous || !previous.group.published || existing.archived || existing.visible === false) changes.added.push(entry);
      else if (compare(existing) !== compare(document)) changes.updated.push(entry);
      else changes.unchanged.push(entry);
      if (!purchaseReady(document)) changes.inquiry.push({ ...entry, details: [product.price ? "Use serving as the menu item’s selling unit." : "Customer price is missing."] });
      next.set(id, { published: document, draft: previous?.group.draft || null });
    }
    for (const { id, group, item } of valid) {
      if (claimed.has(id) || !group.published || item.archived || item.visible === false) continue;
      changes.removed.push({ id, name: item.name, section: item.category });
      next.set(id, { published: null, draft: group.draft || { ...item, archived: true } });
    }
    // A new row without a stable key could be a rename when another managed row disappears.
    if (workbook) {
      for (const item of unresolved) {
        if (changes.removed.some((removed) => records.get(removed.id)?.published?.catalogKind === item.catalogKind)) {
          errors.push({ sheet: item.sourceSheet, row: item.sourceRow, message: "Enter the old product ID for a rename, or a new SKU for a new item." });
        }
      }
    }
    const hampers = parsed.hampers.map(({ sourceRow, ...tier }) => tier);
    for (const tier of hampers) {
      const old = workbook?.hampers.find((item) => item.id === tier.id);
      const entry = { id: tier.id, name: tier.name, section: "Gifting", details: [`${tier.included.length} included items · ${tier.addOns.length} optional additions`] };
      changes[!old ? "added" : JSON.stringify(old) === JSON.stringify(tier) ? "unchanged" : "updated"].push(entry);
      if (!tier.basePrice) changes.inquiry.push(entry);
      for (const item of tier.addOns.filter((item) => item.price === null)) changes.inquiry.push({ id: item.id, name: `${tier.name} · ${item.name}`, section: "Gifting" });
    }
    const baseline = JSON.stringify({ records: catalogue, workbook, generation });
    const token = createHash("sha256").update(baseline).update(digest).digest("hex");
    if (confirmation) {
      if (confirmation !== token) throw Object.assign(new Error("The workbook or catalogue changed. Review it again."), { status: 409 });
      if (errors.length) throw Object.assign(new Error("Fix the workbook issues before publishing."), { status: 422 });
      const nextWorkbook = { revision: token, publishedAt: now(), editor, productIds: [...claimed], hampers };
      await saveShelf(serialize(next, nextWorkbook), { generation });
      hydrate(serialize(next, nextWorkbook));
      loadedAt = Date.now();
    }
    return { token, errors, changes, published: Boolean(confirmation) };
  });
}

export async function storeImage(bytes, contentType, filename) {
  return saveUpload(bytes, contentType, filename);
}

export async function getPublishedSnapshot() {
  await ensureLoaded({ force: Boolean(process.env.VERCEL || process.env.YODLA_GCS_BUCKET) });
  const published = [...records.values()].map((group) => group.published).filter((document) => document && !document.archived && document.visible !== false);
  const imageOf = (item) => (typeof item.image === "string" ? item.image : item.legacyImage || item.imageUrl || "");
  const products = published.filter((item) => item._type === "product").map((item) => normalizeProduct({ ...item, image: imageOf(item) }));
  const blogs = published.filter((item) => item._type === "blogPost").map((item) => normalizeBlog({ ...item, image: imageOf(item) }));
  const taxonomy = records.get("taxonomy")?.published;
  const site = records.get("siteSettings")?.published;
  const home = records.get("homePage")?.published;
  const fallback = getFallbackContent();
  const persistInfo = persistStatus();
  const managed = Boolean(workbook || process.env.YODLA_REQUIRE_WORKBOOK === "true");
  const categories = taxonomy?.categories?.length ? taxonomy.categories : fallback.categories;
  const visibleProducts = managed ? products.filter((item) => workbook?.productIds.includes(item.id)) : products.length ? products : fallback.products;
  const publicHome = home || fallback.home;
  return {
    products: visibleProducts,
    catalogueManaged: managed,
    hampers: (workbook?.hampers || []).map((tier) => ({ ...tier, included: tier.included.map(({ id, name }) => ({ id, name })) })),
    catalogueRevision: workbook?.revision || null,
    blogs: blogs.length ? blogs : fallback.blogs,
    categories: [...new Set(["All", ...categories, ...(managed ? ["Cocktails", "Mocktails", "Ice Packs", ...products.map((product) => product.category)] : [])])],
    locations: taxonomy?.locations?.length ? taxonomy.locations : fallback.locations,
    site: site || fallback.site,
    home: managed ? { ...publicHome, featuredProductIds: (publicHome.featuredProductIds || []).filter((id) => visibleProducts.some((item) => item.id === id)) } : publicHome,
    meta: {
      source: persistInfo.driver,
      stale: !persistInfo.durable,
      message: persistInfo.durable ? "Showing the published Yodla shelf." : "Live publish cannot persist on this host yet. Showing this instance of the shelf.",
    },
  };
}
