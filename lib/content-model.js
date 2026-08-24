const STOCK_STATES = new Set(["in-stock", "low-stock", "unavailable"]);
const ROBOTS_VALUES = new Set(["index,follow", "noindex,follow", "noindex,nofollow"]);

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function normalizeStringList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

export function normalizeDiscovery(value = {}) {
  return {
    title: String(value.title || "").trim().slice(0, 70),
    description: String(value.description || "").trim().slice(0, 180),
    canonicalUrl: String(value.canonicalUrl || "").trim(),
    robots: ROBOTS_VALUES.has(value.robots) ? value.robots : "index,follow",
    focusKeyphrase: String(value.focusKeyphrase || "").trim().slice(0, 120),
    secondaryKeywords: normalizeStringList(value.secondaryKeywords),
    tags: normalizeStringList(value.tags),
    socialTitle: String(value.socialTitle || "").trim().slice(0, 80),
    socialDescription: String(value.socialDescription || "").trim().slice(0, 200),
    socialImage: typeof value.socialImage === "string" ? value.socialImage : value.socialImage || null,
    faqEnabled: value.faqEnabled !== false,
    structuredDataEnabled: value.structuredDataEnabled !== false,
    faqs: Array.isArray(value.faqs)
      ? value.faqs.map((faq) => ({ question: String(faq.question || "").trim(), answer: String(faq.answer || "").trim() })).filter((faq) => faq.question && faq.answer)
      : [],
  };
}

export function normalizeSeo(value = {}) {
  return normalizeDiscovery(value);
}

export function normalizeGeo(value = {}) {
  return normalizeDiscovery(value);
}

function normalizeAvailability(value = {}) {
  if (Array.isArray(value)) return Object.fromEntries(value.map((entry) => [String(entry.location || "").trim(), STOCK_STATES.has(entry.status) ? entry.status : "unavailable"]).filter(([location]) => location));
  return Object.fromEntries(Object.entries(value).map(([location, status]) => [
    String(location).trim(),
    STOCK_STATES.has(status) ? status : "unavailable",
  ]).filter(([location]) => location));
}

function baseDocument(value, type) {
  const title = String(value.title || value.name || "").trim();
  return {
    _id: String(value._id || value.id || slugify(title)).replace(/^drafts\./, ""),
    _type: type,
    slug: slugify(value.slug?.current || value.slug || value.id || title),
    archived: Boolean(value.archived),
    seo: normalizeSeo(value.seo),
    geo: normalizeGeo(value.geo),
  };
}

export function normalizeProduct(value = {}) {
  const base = baseDocument(value, "product");
  return {
    ...base,
    id: String(value.id || base._id).trim(),
    name: String(value.name || "").trim(),
    brand: String(value.brand || "").trim(),
    category: String(value.category || "").trim(),
    subcategory: String(value.subcategory || "").trim(),
    occasions: normalizeStringList(value.occasions),
    volume: String(value.volume || "").trim(),
    abv: String(value.abv || "").trim(),
    price: Math.max(0, Number(value.price) || 0),
    compareAtPrice: value.compareAtPrice ? Math.max(0, Number(value.compareAtPrice) || 0) : null,
    description: String(value.description || "").trim(),
    notes: normalizeStringList(value.notes),
    serve: String(value.serve || "").trim(),
    tag: String(value.tag || "").trim(),
    image: value.image || value.legacyImage || "",
    imageAlt: String(value.imageAlt || value.name || "").trim(),
    imageMode: ["light", "dark", "transparent"].includes(value.imageMode) ? value.imageMode : "light",
    featuredOrder: Number.isFinite(Number(value.featuredOrder)) ? Number(value.featuredOrder) : 999,
    visible: value.visible !== false,
    prototype: Boolean(value.prototype),
    relatedProductIds: normalizeStringList(value.relatedProductIds),
    availability: normalizeAvailability(value.availability),
  };
}

export function normalizeBlog(value = {}) {
  const base = baseDocument(value, "blogPost");
  return {
    ...base,
    id: String(value.id || base._id).trim(),
    title: String(value.title || "").trim(),
    excerpt: String(value.excerpt || "").trim(),
    category: String(value.category || "Journal").trim(),
    author: String(value.author || "Yodla").trim(),
    publishedAt: value.publishedAt || "",
    updatedAt: value.updatedAt || "",
    readTime: String(value.readTime || "").trim(),
    introduction: String(value.introduction || "").trim(),
    sections: Array.isArray(value.sections)
      ? value.sections.map((section) => ({ heading: String(section.heading || "").trim(), body: String(section.body || "").trim() })).filter((section) => section.heading && section.body)
      : [],
    pullQuote: String(value.pullQuote || "").trim(),
    image: value.image || value.legacyImage || "",
    imageAlt: String(value.imageAlt || value.title || "").trim(),
    imageId: String(value.imageId || "").trim(),
    relatedProductIds: normalizeStringList(value.relatedProductIds),
    visible: value.visible !== false,
  };
}

export function validateDocument(value, { publish = false } = {}) {
  const errors = {};
  const type = value?._type;
  const document = type === "product" ? normalizeProduct(value) : type === "blogPost" ? normalizeBlog(value) : value;
  if (!type) errors._type = "Choose a content type.";
  if (!document?.slug) errors.slug = "Add a URL slug.";
  if (type === "product") {
    if (!document.name) errors.name = "Add the product name.";
    if (!document.brand) errors.brand = "Add the brand.";
    if (!document.category) errors.category = "Choose a category.";
    if (!document.price) errors.price = "Add a price greater than zero.";
    if (publish && !document.description) errors.description = "Add a description before publishing.";
    if (publish && !document.image) errors.image = "Upload or select an image before publishing.";
    if (document.compareAtPrice && document.compareAtPrice <= document.price) errors.compareAtPrice = "The comparison price must be higher than the selling price.";
  }
  if (type === "blogPost") {
    if (!document.title) errors.title = "Add the article title.";
    if (!document.excerpt) errors.excerpt = "Add a short excerpt.";
    if (publish && !document.introduction) errors.introduction = "Add an introduction before publishing.";
    if (publish && !document.sections?.length) errors.sections = "Add at least one complete section before publishing.";
    if (publish && !document.image) errors.image = "Upload or select a hero image before publishing.";
  }
  if (publish && (type === "product" || type === "blogPost")) {
    if (!document.seo?.title) errors.seoTitle = "Add an SEO title before publishing.";
    if (!document.seo?.description) errors.seoDescription = "Add an SEO description before publishing.";
    if (!document.geo?.title) errors.geoTitle = "Add a GEO title before publishing.";
    if (!document.geo?.description) errors.geoDescription = "Add a GEO description before publishing.";
  }
  if (publish && document?.seo?.canonicalUrl) {
    try { new URL(document.seo.canonicalUrl); } catch { errors.canonicalUrl = "Use a complete canonical URL beginning with https://."; }
  }
  if (publish && document?.geo?.canonicalUrl) {
    try { new URL(document.geo.canonicalUrl); } catch { errors.geoCanonicalUrl = "Use a complete GEO citation URL beginning with https://."; }
  }
  return { valid: !Object.keys(errors).length, errors, document };
}
