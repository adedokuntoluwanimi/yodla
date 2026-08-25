import { normalizeBlog, normalizeProduct } from "./content-model.js";
import { getFallbackContent } from "./fallback-content.js";
import { loadShelf, persistStatus, saveShelf, saveUpload } from "./persist.js";

export { persistStatus };

const records = new Map();
let loaded = false;
let loadedAt = 0;

function now() {
  return new Date().toISOString();
}

function slugOf(document) {
  return document?.slug?.current || document?.slug || "";
}

function seedFromFallback() {
  records.clear();
  const content = getFallbackContent();
  const stamp = now();
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
      _updatedAt: stamp,
    },
    draft: null,
  });
  records.set("siteSettings", { published: { _id: "siteSettings", _type: "siteSettings", ...content.site, _updatedAt: stamp }, draft: null });
  records.set("homePage", { published: { _id: "homePage", _type: "homePage", ...content.home, _updatedAt: stamp }, draft: null });
}

function hydrate(payload) {
  records.clear();
  Object.entries(payload.records || {}).forEach(([id, group]) => records.set(id, group));
}

function serialize() {
  return { records: Object.fromEntries(records), updatedAt: now() };
}

async function persist() {
  return saveShelf(serialize());
}

export async function ensureLoaded({ force = false } = {}) {
  const stale = Date.now() - loadedAt > 4000;
  const remoteStore = process.env.VERCEL || process.env.YODLA_GCS_BUCKET;
  if (loaded && !force && !(remoteStore && stale)) return;
  const saved = await loadShelf();
  if (saved?.records) hydrate(saved);
  else {
    seedFromFallback();
    if (persistStatus().driver === "gcs") await persist();
  }
  loaded = true;
  loadedAt = Date.now();
}

export function resetContentStore() {
  records.clear();
  loaded = false;
  loadedAt = 0;
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

export async function saveDocument(document, action) {
  await ensureLoaded({ force: Boolean(process.env.YODLA_GCS_BUCKET) });
  const id = document._id;
  const current = records.get(id) || { published: null, draft: null };
  const stamped = { ...document, _id: id, _updatedAt: now() };
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
  records.set(id, current);
  loadedAt = Date.now();
  const persistInfo = await persist();
  return { document: view({ id, ...current }), persist: persistInfo };
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
  return {
    products: products.length ? products : fallback.products,
    blogs: blogs.length ? blogs : fallback.blogs,
    categories: taxonomy?.categories?.length ? ["All", ...taxonomy.categories.filter((item) => item !== "All")] : fallback.categories,
    locations: taxonomy?.locations?.length ? taxonomy.locations : fallback.locations,
    site: site || fallback.site,
    home: home || fallback.home,
    meta: {
      source: persistInfo.driver,
      stale: !persistInfo.durable,
      message: persistInfo.durable ? "Showing the published Yodla shelf." : "Live publish cannot persist on this host yet. Showing this instance of the shelf.",
    },
  };
}
