const TYPES = new Set(["product", "blogPost", "siteSettings", "homePage", "taxonomy"]);
const STOCK = new Set(["in-stock", "low-stock", "unavailable"]);

export function slugify(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

const strings = (value) => [...new Set((Array.isArray(value) ? value : String(value || "").split(",")).map((item) => String(item).trim()).filter(Boolean))];

function discovery(value = {}) {
  return {
    title: String(value.title || "").trim().slice(0, 70), description: String(value.description || "").trim().slice(0, 180), canonicalUrl: String(value.canonicalUrl || "").trim(),
    robots: ["index,follow", "noindex,follow", "noindex,nofollow"].includes(value.robots) ? value.robots : "index,follow",
    focusKeyphrase: String(value.focusKeyphrase || "").trim().slice(0, 120), secondaryKeywords: strings(value.secondaryKeywords), tags: strings(value.tags),
    socialTitle: String(value.socialTitle || "").trim().slice(0, 80), socialDescription: String(value.socialDescription || "").trim().slice(0, 200),
    socialImage: typeof value.socialImage === "string" ? value.socialImage : "", faqEnabled: value.faqEnabled !== false, structuredDataEnabled: value.structuredDataEnabled !== false,
    faqs: Array.isArray(value.faqs) ? value.faqs.map((item) => ({ _key: item._key || crypto.randomUUID(), question: String(item.question || "").trim(), answer: String(item.answer || "").trim() })).filter((item) => item.question && item.answer) : [],
  };
}

export function prepare(value = {}) {
  const type = value._type;
  if (!TYPES.has(type)) throw new Error("Unsupported content type");
  const id = String(value._id || value.id || type).replace(/^drafts\./, "").replace(/[^A-Za-z0-9._-]/g, "-");
  const { _baseId, _status, _publishedAt, _createdAt, _updatedAt, _rev, imageUrl, socialImageUrl, slugValue, previewImageUrl, ...clean } = value;
  const common = { ...clean, _id: id, _type: type, archived: Boolean(value.archived) };
  if (type === "product") {
    const availability = Array.isArray(value.availability) ? value.availability : Object.entries(value.availability || {}).map(([location, status]) => ({ location, status }));
    const image = typeof value.image === "string" ? value.image : value.legacyImage || "";
    return { ...common, id: String(value.id || id), name: String(value.name || "").trim(), slug: { _type: "slug", current: slugify(value.slug?.current || value.slug || value.id || value.name) }, brand: String(value.brand || "").trim(), category: String(value.category || "").trim(), subcategory: String(value.subcategory || "").trim(), occasions: strings(value.occasions), volume: String(value.volume || "").trim(), abv: String(value.abv || "").trim(), price: Math.max(0, Number(value.price) || 0), compareAtPrice: value.compareAtPrice ? Math.max(0, Number(value.compareAtPrice) || 0) : null, description: String(value.description || "").trim(), notes: strings(value.notes), serve: String(value.serve || "").trim(), tag: String(value.tag || "").trim(), image, legacyImage: image, imageAlt: String(value.imageAlt || value.name || "").trim(), imageMode: ["light", "dark", "transparent"].includes(value.imageMode) ? value.imageMode : "light", featuredOrder: Number(value.featuredOrder) || 999, visible: value.visible !== false, prototype: Boolean(value.prototype), relatedProductIds: strings(value.relatedProductIds), availability: availability.map((entry) => ({ _key: entry._key || slugify(entry.location), location: String(entry.location || "").trim(), status: STOCK.has(entry.status) ? entry.status : "unavailable" })).filter((entry) => entry.location), seo: discovery(value.seo), geo: discovery(value.geo) };
  }
  if (type === "blogPost") {
    const image = typeof value.image === "string" ? value.image : value.legacyImage || "";
    return { ...common, id: String(value.id || id), title: String(value.title || "").trim(), slug: { _type: "slug", current: slugify(value.slug?.current || value.slug || value.id || value.title) }, excerpt: String(value.excerpt || "").trim(), category: String(value.category || "Journal").trim(), author: String(value.author || "Yodla").trim(), publishedAt: value.publishedAt || "", updatedAt: value.updatedAt || new Date().toISOString(), readTime: String(value.readTime || "").trim(), introduction: String(value.introduction || "").trim(), sections: Array.isArray(value.sections) ? value.sections.map((item) => ({ _key: item._key || crypto.randomUUID(), heading: String(item.heading || "").trim(), body: String(item.body || "").trim() })).filter((item) => item.heading && item.body) : [], pullQuote: String(value.pullQuote || "").trim(), image, legacyImage: image, imageAlt: String(value.imageAlt || value.title || "").trim(), imageId: String(value.imageId || "").trim(), relatedProductIds: strings(value.relatedProductIds), visible: value.visible !== false, seo: discovery(value.seo), geo: discovery(value.geo) };
  }
  return common;
}

export function validate(document, publish = false) {
  const errors = {};
  if (document._type === "product") {
    if (!document.name) errors.name = "Add a product name.";
    if (!document.brand) errors.brand = "Add a brand.";
    if (!document.category) errors.category = "Choose a category.";
    if (!document.price) errors.price = "Add a price greater than zero.";
    if (publish && !document.description) errors.description = "Add a description before publishing.";
    if (publish && !document.image && !document.legacyImage) errors.image = "Add an image before publishing.";
    if (document.compareAtPrice && document.compareAtPrice <= document.price) errors.compareAtPrice = "Comparison price must be higher than the selling price.";
  }
  if (document._type === "blogPost") {
    if (!document.title) errors.title = "Add an article title.";
    if (!document.excerpt) errors.excerpt = "Add an excerpt.";
    if (publish && !document.introduction) errors.introduction = "Add an introduction before publishing.";
    if (publish && !document.sections.length) errors.sections = "Add at least one article section.";
    if (publish && !document.image && !document.legacyImage) errors.image = "Add a hero image before publishing.";
  }
  if (publish && ["product", "blogPost"].includes(document._type)) {
    if (!document.seo?.title) errors.seoTitle = "Add an SEO title before publishing.";
    if (!document.seo?.description) errors.seoDescription = "Add an SEO description before publishing.";
    if (!document.geo?.title) errors.geoTitle = "Add a GEO title before publishing.";
    if (!document.geo?.description) errors.geoDescription = "Add a GEO description before publishing.";
  }
  if (publish && document.seo?.canonicalUrl) try { new URL(document.seo.canonicalUrl); } catch { errors.canonicalUrl = "Use a complete canonical URL."; }
  if (publish && document.geo?.canonicalUrl) try { new URL(document.geo.canonicalUrl); } catch { errors.geoCanonicalUrl = "Use a complete GEO citation URL."; }
  return errors;
}
