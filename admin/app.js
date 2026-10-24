import { authorizedFetch, signOutUser, waitForRestoredAuth, accountFromUser } from "/js/firebase-auth.js";
import { enhanceCustomSelects } from "/js/custom-select.js";
import { CATEGORIES, NIGERIAN_STATES } from "/js/states.js";

const API = location.pathname.includes("/admin") ? "/admin/api" : "api";
const DEFAULT_OCCASIONS = ["Dinner", "Gift", "Gifting", "Weekend", "Toast"];
const DEFAULT_SUBCATEGORIES = ["Prosecco", "Cognac", "Tennessee whisky", "Lager", "Red wine", "Sparkling rosé", "Gin", "Rum", "Vodka", "Sparkling mixer", "Malt drink", "Gift set"];
const DEFAULT_ABV = ["0%", "5%", "11%", "12%", "13.5%", "40%", "43%", "Mixed"];
const ORDER_STATUSES = ["awaiting_payment", "paid", "fulfilled", "cancelled", "refunded"];
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const split = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const linePairs = (value, fields) => String(value || "").split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.some(Boolean)).map((parts) => Object.fromEntries(fields.map((field, index) => [field, parts[index] || ""])));
const pairLines = (items, fields) => (items || []).map((item) => fields.map((field) => item[field] || "").join(" | ")).join("\n");
const money = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;
const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
};
const rootImage = (value) => {
  const image = String(value || "");
  return image && !/^(?:https?:|data:|\/)/i.test(image) ? `/${image.replace(/^\.\//, "")}` : image;
};
const imageOf = (document) => rootImage(document.imageUrl || document.previewImageUrl || (typeof document.image === "string" ? document.image : document.legacyImage) || "");

const state = {
  view: location.hash.slice(1) || "dashboard",
  documents: [],
  counts: {},
  persist: {},
  query: "",
  filter: "all",
  editing: null,
  archiveTarget: null,
  shelfMenuOpen: false,
  orders: [],
  orderFilters: { q: "", status: "", state: "", from: "", to: "" },
  selectedOrderId: null,
  subscribers: [],
};
const titles = {
  dashboard: ["The current edit", "On the shelf"],
  products: ["Inventory", "Bottles"],
  blogs: ["Editorial", "Journal"],
  homepage: ["Merchandising", "Homepage"],
  taxonomy: ["Delivery", "States"],
  orders: ["Orders", "Fulfilment"],
  subscribers: ["Audience", "Subscribers"],
  settings: ["Global content", "Site"],
  admins: ["Access", "Admins"],
};

function status(message = "", tone = "") {
  $("[data-status]").innerHTML = message ? `<p class="${tone}">${escapeHtml(message)}</p>` : "";
}

async function request(path, options = {}) {
  const response = await authorizedFetch(`${API}/${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    localStorage.setItem("yodlaPostLoginRedirect", "/admin/");
    window.location.assign("/login.html?next=/admin/");
    throw new Error(payload.error || "Admin sign-in required.");
  }
  if (!response.ok) {
    const error = new Error(payload.error || "The request could not be completed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function documentByType(type, id = null) {
  return state.documents.find((item) => item._type === type && (!id || item._baseId === id)) || null;
}

function emptyDiscovery() {
  return { title: "", description: "", canonicalUrl: "", robots: "index,follow", focusKeyphrase: "", secondaryKeywords: [], tags: [], socialTitle: "", socialDescription: "", socialImage: "", faqs: [], faqEnabled: true, structuredDataEnabled: true };
}

function withGeoDefaults(document) {
  const seo = { ...emptyDiscovery(), ...(document.seo || {}) };
  const geo = { ...emptyDiscovery(), ...(document.geo || {}) };
  const unused = !geo.title && !geo.description && !geo.focusKeyphrase;
  return { ...document, seo, geo: unused ? { ...seo, socialImage: geo.socialImage || seo.socialImage } : geo };
}

function newDocument(type) {
  const stamp = Date.now();
  if (type === "product") return withGeoDefaults({ _id: `product-${stamp}`, _type: "product", id: `product-${stamp}`, name: "", brand: "", category: "", subcategory: "", occasions: [], volume: "", abv: "", price: "", description: "", notes: [], serve: "", tag: "", image: "", imageAlt: "", imageMode: "light", featuredOrder: 999, visible: true, prototype: false, relatedProductIds: [], availability: {}, seo: {}, geo: {} });
  return withGeoDefaults({ _id: `article-${stamp}`, _type: "blogPost", id: `article-${stamp}`, title: "", excerpt: "", category: "Journal", author: "Yodla", readTime: "", introduction: "", sections: [], pullQuote: "", image: "", imageAlt: "", relatedProductIds: [], visible: true, seo: {}, geo: {} });
}

function setShelfOpen(open, { restoreFocus = true } = {}) {
  const drawer = $("[data-shelf-menu]");
  const backdrop = $("[data-shelf-backdrop]");
  const toggle = $("[data-open-shelf]");
  if (!drawer) return;
  state.shelfMenuOpen = open;
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  toggle?.setAttribute("aria-expanded", open ? "true" : "false");
  if (backdrop) backdrop.hidden = !open;
  document.body.classList.toggle("drawer-open", open);
  if (open) ($(".menu-nav [data-view][aria-current=page]", drawer) || $(".menu-nav [data-view]", drawer))?.focus();
  else if (restoreFocus) toggle?.focus();
}

function setView(view) {
  state.view = view;
  state.editing = null;
  if (view !== "orders") state.selectedOrderId = null;
  location.hash = view;
  $$("[data-view]").forEach((button) => button.setAttribute("aria-current", button.dataset.view === view ? "page" : "false"));
  const [kicker, title] = titles[view] || titles.dashboard;
  $("[data-kicker]").textContent = kicker;
  $("[data-title]").textContent = title;
  render();
  $("#workspace").focus();
  if (view === "orders") loadOrders();
  if (view === "subscribers") loadSubscribers();
}

function renderDashboard() {
  const published = state.documents.filter((item) => item._status === "published").length;
  const drafts = state.documents.filter((item) => item._status !== "published").length;
  const persistNote = state.persist?.durable
    ? "Published bottles and stories appear on the public storefront."
    : "Durable storage is not configured, so published changes may not survive a restart.";
  return `<div class="metric-grid"><article class="metric"><span>On the shelf</span><strong>${published}</strong></article><article class="metric"><span>Drafts waiting</span><strong>${drafts}</strong></article><article class="metric"><span>Delivery cities</span><strong>${documentByType("taxonomy")?.locations?.length || 0}</strong></article></div><section class="pulse-panel"><div><span class="eyebrow">Shelf pulse</span><h2>${drafts ? `${drafts} draft${drafts === 1 ? " is" : "s are"} waiting.` : "The public shelf is settled."}</h2><p>${escapeHtml(persistNote)}</p></div><button class="button button--ember" data-view="${drafts ? "products" : "homepage"}">${drafts ? "Review content" : "Edit homepage"}</button></section>`;
}

function toolbar(noun) {
  return `<div class="content-toolbar"><input type="search" data-content-search value="${escapeHtml(state.query)}" placeholder="Search ${noun}s" aria-label="Search ${noun}s"><select data-status-filter aria-label="Filter by publishing status"><option value="all">All statuses</option><option value="published" ${state.filter === "published" ? "selected" : ""}>Published</option><option value="modified" ${state.filter === "modified" ? "selected" : ""}>Modified</option><option value="draft" ${state.filter === "draft" ? "selected" : ""}>Draft only</option><option value="archived" ${state.filter === "archived" ? "selected" : ""}>Archived</option></select></div>`;
}

function filtered(type) {
  return state.documents.filter((item) => item._type === type)
    .filter((item) => state.filter === "all" || item._status === state.filter)
    .filter((item) => `${item.name || item.title} ${item.brand || item.category}`.toLowerCase().includes(state.query.toLowerCase()));
}

function productList() {
  const documents = filtered("product");
  return `${toolbar("bottle")}${documents.length ? `<div class="product-grid admin-product-grid">${documents.map((item) => `<button class="product-card" data-edit="${escapeHtml(item._baseId)}"><span class="product-card__media media--${escapeHtml(item.imageMode || "light")}"><span class="product-card__tag">${escapeHtml(item._status)}</span>${imageOf(item) ? `<img src="${escapeHtml(imageOf(item))}" alt="">` : ""}</span><span class="product-card__meta"><span><p>${escapeHtml(item.brand || "")} · ${escapeHtml(item.category || "")}</p><h3>${escapeHtml(item.name || "Untitled bottle")}</h3></span><span class="product-card__buy"><strong>${money(item.price)}</strong></span></span></button>`).join("")}</div>` : `<div class="empty-state"><span class="eyebrow">Empty shelf</span><h2>No bottles match.</h2><p>Clear the search or add the first bottle.</p></div>`}`;
}

function blogList() {
  const documents = filtered("blogPost");
  return `${toolbar("story")}${documents.length ? `<div class="editorial-grid">${documents.map((item) => `<button class="editorial-card" data-edit="${escapeHtml(item._baseId)}">${imageOf(item) ? `<img src="${escapeHtml(imageOf(item))}" alt="">` : ""}<div><span>${escapeHtml(item._status)} · ${escapeHtml(item.category || "Journal")}</span><h2>${escapeHtml(item.title || "Untitled story")}</h2></div></button>`).join("")}</div>` : `<div class="empty-state"><span class="eyebrow">Empty journal</span><h2>No stories match.</h2><p>Clear the search or add the first story.</p></div>`}`;
}

function field(name, label, value = "", options = {}) {
  const attrs = `${options.required ? "required" : ""} ${options.type ? `type="${options.type}"` : ""} ${options.min != null ? `min="${options.min}"` : ""} ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}`;
  const control = options.textarea ? `<textarea name="${name}" ${attrs} ${options.rows ? `rows="${options.rows}"` : ""}>${escapeHtml(value)}</textarea>` : `<input name="${name}" value="${escapeHtml(value)}" ${attrs}>`;
  return `<label class="${options.full ? "full" : ""}">${escapeHtml(label)}${options.help ? `<small>${escapeHtml(options.help)}</small>` : ""}${control}<span class="field-error" data-error="${name}"></span></label>`;
}

function discoveryPanel(kind, values) {
  const isSeo = kind === "seo";
  const prefix = isSeo ? "seo" : "geo";
  const title = isSeo ? "SEO" : "GEO / AI citation";
  const help = isSeo ? "Search listing copy for this page." : "Citation-friendly copy for AI and assistants.";
  return `<section class="form-panel"><h3>${title}</h3><p class="drawer-copy">${help}</p><div class="form-grid">${field(`${prefix}Title`, "Title", values.title, { maxlength: 70 })}${field(`${prefix}Description`, "Description", values.description, { textarea: true, maxlength: 180 })}${field(`${prefix}CanonicalUrl`, isSeo ? "Canonical URL" : "Citation URL", values.canonicalUrl, { type: "url" })}<label>Robots / crawl<select name="${prefix}Robots"><option>index,follow</option><option ${values.robots === "noindex,follow" ? "selected" : ""}>noindex,follow</option><option ${values.robots === "noindex,nofollow" ? "selected" : ""}>noindex,nofollow</option></select></label>${field(`${prefix}FocusKeyphrase`, "Focus keyphrase", values.focusKeyphrase)}${field(`${prefix}SecondaryKeywords`, "Secondary keywords", (values.secondaryKeywords || []).join(", "))}${field(`${prefix}Tags`, "Tags", (values.tags || []).join(", "))}${field(`${prefix}SocialTitle`, isSeo ? "Share title" : "Citation title", values.socialTitle)}${field(`${prefix}SocialDescription`, isSeo ? "Share description" : "Citation description", values.socialDescription, { textarea: true })}<label class="checkbox"><input type="checkbox" name="${prefix}FaqEnabled" ${values.faqEnabled !== false ? "checked" : ""}> Include FAQ schema</label><label class="checkbox"><input type="checkbox" name="${prefix}StructuredDataEnabled" ${values.structuredDataEnabled !== false ? "checked" : ""}> Include structured data</label>${field(`${prefix}Faqs`, "FAQs", pairLines(values.faqs, ["question", "answer"]), { textarea: true, full: true, help: "One per line: Question | Answer" })}</div></section>`;
}

function taxonomyOptions() {
  const taxonomy = documentByType("taxonomy") || {};
  const categories = (taxonomy.categories || []).map((item) => String(item).trim()).filter((item) => item && item !== "All");
  const occasions = (taxonomy.occasions || []).map((item) => String(item).trim()).filter(Boolean);
  const subcategories = (taxonomy.subcategories || []).map((item) => String(item).trim()).filter(Boolean);
  const abvValues = (taxonomy.abvValues || taxonomy.abv || []).map((item) => String(item).trim()).filter(Boolean);
  return {
    categories: categories.length ? categories : CATEGORIES.filter((item) => item !== "All"),
    occasions: occasions.length ? occasions : DEFAULT_OCCASIONS,
    subcategories: subcategories.length ? subcategories : DEFAULT_SUBCATEGORIES,
    abvValues: abvValues.length ? abvValues : DEFAULT_ABV,
  };
}

function selectControl(name, label, options, value, { required = false } = {}) {
  const list = options || [];
  if (!list.length) return field(name, label, value, { required });
  const hasCurrent = value && !list.includes(value);
  return `<label>${escapeHtml(label)}<select name="${escapeHtml(name)}" ${required ? "required" : ""}><option value="">Choose ${escapeHtml(label.toLowerCase())}</option>${list.map((item) => `<option value="${escapeHtml(item)}" ${value === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}${hasCurrent ? `<option value="${escapeHtml(value)}" selected>${escapeHtml(value)}</option>` : ""}</select><span class="field-error" data-error="${escapeHtml(name)}"></span></label>`;
}

function productForm(document) {
  const availability = Array.isArray(document.availability) ? Object.fromEntries(document.availability.map((item) => [item.location, item.status])) : document.availability || {};
  const selectedState = Object.keys(availability)[0] || "";
  const selectedStatus = availability[selectedState] || "in-stock";
  const states = NIGERIAN_STATES;
  const { categories, occasions, subcategories, abvValues } = taxonomyOptions();
  const selectedOccasions = new Set(document.occasions || []);
  const categoryControl = selectControl("category", "Category", categories, document.category, { required: true });
  const subcategoryControl = selectControl("subcategory", "Subcategory", subcategories, document.subcategory);
  const abvControl = selectControl("abv", "ABV", abvValues, document.abv);
  const occasionsControl = occasions.length
    ? `<div class="full occasion-checks"><span>Occasions</span><div class="checkbox-row">${occasions.map((item) => `<label class="checkbox"><input type="checkbox" name="occasions" value="${escapeHtml(item)}" ${selectedOccasions.has(item) ? "checked" : ""}> ${escapeHtml(item)}</label>`).join("")}</div>${(document.occasions || []).filter((item) => !occasions.includes(item)).map((item) => `<input type="hidden" name="occasions" value="${escapeHtml(item)}">`).join("")}<span class="field-error" data-error="occasions"></span></div>`
    : field("occasions", "Occasions", (document.occasions || []).join(", "), { full: true });
  return `<section class="form-panel"><h3>Product essentials</h3><div class="form-grid">${field("name", "Product name", document.name, { required: true })}${field("id", "Stable product ID", document.id, { required: true })}${field("slug", "URL slug", document.slugValue || document.slug?.current || document.slug || document.id, { required: true })}${field("brand", "Brand", document.brand, { required: true })}${categoryControl}${subcategoryControl}${field("amount", "Amount", document.amount || document.volume || "")}${abvControl}${field("price", "Selling price (NGN)", document.price, { type: "number", min: 1, required: true })}${occasionsControl}${field("description", "Description", document.description, { textarea: true, full: true })}${field("notes", "Tasting notes", (document.notes || []).join(", "), { full: true })}${field("serve", "How to serve", document.serve, { textarea: true, full: true })}${field("relatedProductIds", "Related product IDs", (document.relatedProductIds || []).join(", "), { full: true })}<label class="checkbox"><input type="checkbox" name="visible" ${document.visible !== false ? "checked" : ""}> Visible when published</label><label>Image treatment<select name="imageMode"><option value="light">Light shelf</option><option value="dark" ${document.imageMode === "dark" ? "selected" : ""}>Dark shelf</option><option value="transparent" ${document.imageMode === "transparent" ? "selected" : ""}>Transparent / gift set</option></select></label>${field("imageAlt", "Image alt text", document.imageAlt, { required: true })}<label class="full">Bottle image<small>JPEG, PNG or WebP up to 3 MB.</small><input type="file" data-image-upload data-image-kind="image" accept="image/jpeg,image/png,image/webp"></label><input type="hidden" name="legacyImage" value="${escapeHtml(imageOf(document))}"></div></section><section class="form-panel"><h3>Availability by state</h3><div class="form-grid"><label>State<select name="availabilityState"><option value="">Choose state</option>${states.map((entry) => `<option ${selectedState === entry ? "selected" : ""}>${escapeHtml(entry)}</option>`).join("")}</select></label><label>Stock status<select name="availabilityStatus"><option value="in-stock" ${selectedStatus === "in-stock" ? "selected" : ""}>In stock</option><option value="low-stock" ${selectedStatus === "low-stock" ? "selected" : ""}>Low stock</option><option value="unavailable" ${selectedStatus === "unavailable" ? "selected" : ""}>Unavailable</option></select></label></div></section>${discoveryPanel("seo", document.seo || {})}${discoveryPanel("geo", document.geo || {})}`;
}

function blogForm(document) {
  return `<section class="form-panel"><h3>Article</h3><div class="form-grid">${field("title", "Title", document.title, { required: true, full: true })}${field("id", "Stable article ID", document.id, { required: true })}${field("slug", "URL slug", document.slugValue || document.slug?.current || document.slug || document.id, { required: true })}${field("category", "Category", document.category)}${field("author", "Author", document.author || "Yodla")}${field("publishedAt", "Publication date", document.publishedAt ? document.publishedAt.slice(0, 16) : "", { type: "datetime-local" })}${field("readTime", "Read time", document.readTime)}${field("excerpt", "Excerpt", document.excerpt, { textarea: true, full: true, required: true })}${field("introduction", "Introduction", document.introduction, { textarea: true, full: true })}${field("sections", "Article sections", pairLines(document.sections, ["heading", "body"]), { textarea: true, full: true, help: "One per line: Heading | Paragraph" })}${field("pullQuote", "Pull quote", document.pullQuote, { textarea: true, full: true })}${field("relatedProductIds", "Related product IDs", (document.relatedProductIds || []).join(", "), { full: true })}<label class="checkbox"><input type="checkbox" name="visible" ${document.visible !== false ? "checked" : ""}> Visible when published</label></div></section>${discoveryPanel("seo", document.seo || {})}${discoveryPanel("geo", document.geo || {})}`;
}

function snippets(document) {
  const seo = document.seo || {};
  const geo = document.geo || {};
  return `<article class="snippet search"><small>Search result</small><strong>${escapeHtml(seo.title || "SEO title")}</strong><p>${escapeHtml(seo.description || "SEO description")}</p></article><article class="snippet citation"><small>AI citation</small><strong>${escapeHtml(geo.title || "GEO title")}</strong><p>${escapeHtml(geo.description || "GEO description")}</p></article>`;
}

function readiness(document) {
  const checks = document._type === "product"
    ? [["Name", document.name], ["Price", document.price], ["Description", document.description], ["Image", imageOf(document)], ["SEO title", document.seo?.title], ["SEO description", document.seo?.description], ["GEO title", document.geo?.title], ["GEO description", document.geo?.description]]
    : [["Title", document.title], ["Excerpt", document.excerpt], ["Introduction", document.introduction], ["Sections", document.sections?.length], ["SEO title", document.seo?.title], ["SEO description", document.seo?.description], ["GEO title", document.geo?.title], ["GEO description", document.geo?.description]];
  return checks.map(([label, ready]) => `<div><span>${label}</span><b class="${ready ? "" : "missing"}">${ready ? "Ready" : "Missing"}</b></div>`).join("");
}

function editor(document) {
  const current = withGeoDefaults(document);
  const label = current.name || current.title || `New ${current._type === "product" ? "product" : "article"}`;
  const previewCard = current._type === "product"
    ? `<article class="product-card"><span class="product-card__media media--${escapeHtml(current.imageMode || "light")}">${imageOf(current) ? `<img src="${escapeHtml(imageOf(current))}" alt="">` : ""}</span><span class="product-card__meta"><span><p>${escapeHtml(current.brand || "Brand")}</p><h3>${escapeHtml(label)}</h3></span><strong>${money(current.price)}</strong></span></article>`
    : `<article class="editorial-card"><div><span>${escapeHtml(current.category || "Journal")}</span><h2>${escapeHtml(label)}</h2></div></article>`;
  const mediaWell = current._type === "product"
    ? `<div class="editor-media media--${escapeHtml(current.imageMode || "dark")}" data-image-well="image">${imageOf(current) ? `<img src="${escapeHtml(imageOf(current))}" alt="">` : "<span>Upload a bottle image</span>"}</div>`
    : "";
  return `<form class="editor" data-editor novalidate><input type="hidden" name="_id" value="${escapeHtml(current._baseId || current._id)}"><input type="hidden" name="_type" value="${current._type}"><div class="editor-head"><div><span class="eyebrow">${escapeHtml(current._status || "New draft")}</span><h2>${escapeHtml(label)}</h2></div><button type="button" class="button button--quiet" data-close-editor>Back to list</button></div><div class="editor-grid">${mediaWell}<div>${current._type === "product" ? productForm(current) : blogForm(current)}<aside class="side-panel"><section class="form-panel"><h3>Publish readiness</h3><div class="readiness">${readiness(current)}</div>${snippets(current)}<div data-preview>${previewCard}</div></section></aside><div class="actions-bar"><button type="button" class="button button--quiet" data-action="preview">Preview</button>${current._status === "published" || current._status === "modified" ? `<button type="button" class="button button--quiet" data-action="unpublish">Unpublish</button>` : ""}<button type="button" class="button button--quiet" data-action="save">Save draft</button><button type="button" class="button button--ember" data-action="publish">Publish</button>${current._baseId ? `<button type="button" class="button button--danger" data-action="archive">Archive</button>` : ""}</div></div></div></form>`;
}

function singletonForm(type) {
  const document = documentByType(type) || { _id: type, _baseId: type, _type: type, _status: "draft" };
  if (type === "taxonomy") {
    const subcategories = (document.subcategories || []).length ? document.subcategories : DEFAULT_SUBCATEGORIES;
    const abvValues = (document.abvValues || []).length ? document.abvValues : DEFAULT_ABV;
    return `<form class="editor" data-singleton><input type="hidden" name="_id" value="taxonomy"><input type="hidden" name="_type" value="taxonomy"><section class="form-panel"><h3>Catalogue structure</h3><p class="drawer-copy">These lists power the bottle form dropdowns. Add a value here, publish, then it appears when editing bottles.</p><div class="form-grid">${field("categories", "Categories", (document.categories || []).join(", "), { textarea: true, full: true, help: "Comma-separated. Used for the Category dropdown." })}${field("subcategories", "Subcategories", subcategories.join(", "), { textarea: true, full: true, help: "Comma-separated. Used for the Subcategory dropdown." })}${field("abvValues", "ABV values", abvValues.join(", "), { textarea: true, full: true, help: "Comma-separated. Used for the ABV dropdown (e.g. 0%, 40%, Mixed)." })}${field("occasions", "Occasions", (document.occasions || []).join(", "), { textarea: true, full: true })}${field("locations", "Delivery states", (document.locations || []).join(", "), { textarea: true, full: true, help: "Comma-separated Nigerian states used for availability." })}</div></section>${singletonActions(document)}</form>`;
  }
  if (type === "siteSettings") return `<form class="editor" data-singleton><input type="hidden" name="_id" value="siteSettings"><input type="hidden" name="_type" value="siteSettings"><section class="form-panel"><h3>Shared storefront content</h3><div class="form-grid">${field("announcement", "Header announcement", document.announcement)}${field("footerTagline", "Footer tagline", document.footerTagline)}${field("footerDescription", "Footer description", document.footerDescription, { textarea: true, full: true })}${field("supportEmail", "Support email", document.supportEmail, { type: "email" })}${field("supportPhone", "Support phone", document.supportPhone)}${field("responsibleDrinking", "Responsible drinking notice", document.responsibleDrinking)}${field("prototypeLabel", "Prototype label", document.prototypeLabel)}${field("navigation", "Main navigation", pairLines(document.navigation, ["label", "href"]), { textarea: true, full: true, help: "One per line: Label | URL" })}${field("socialLinks", "Social links", pairLines(document.socialLinks, ["label", "url"]), { textarea: true, full: true, help: "One per line: Network | URL" })}</div></section><section class="form-panel"><h3>Help centre</h3><div class="form-grid">${field("helpEyebrow", "Help eyebrow", document.help?.eyebrow)}${field("helpTitle", "Help title", document.help?.title)}${field("helpDescription", "Help description", document.help?.description, { textarea: true, full: true })}${field("helpSections", "Help sections", pairLines(document.help?.sections, ["key", "title", "question", "answer"]), { textarea: true, full: true, help: "One per line: Anchor | Section | Question | Answer" })}</div></section>${singletonActions(document)}</form>`;
  const hero = document.hero || {}, manifesto = document.manifesto || {};
  const slides = document.heroSlides?.length ? document.heroSlides : hero.image ? [hero] : [];
  const slideForms = slides.map((slide, index) => `<article class="hero-slide-editor"><div class="hero-slide-editor__head"><span class="eyebrow">Slide ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(slide.occasion || slide.captionStrong || "Hero image")}</strong></div><div class="hero-slide-editor__media" data-image-well="heroSlide:${index}">${slide.image ? `<img src="${escapeHtml(rootImage(slide.image))}" alt="">` : "<span>No image selected</span>"}</div><div class="form-grid"><input type="hidden" name="slide${index}Image" value="${escapeHtml(slide.image || "")}"><input type="hidden" name="slide${index}ResponsiveBase" value="${escapeHtml(slide.responsiveBase || "")}">${field(`slide${index}Id`, "Stable slide ID", slide.id, { required: true })}${field(`slide${index}Occasion`, "Occasion label", slide.occasion)}${field(`slide${index}ImageAlt`, "Image alt text", slide.imageAlt, { required: true, full: true })}${field(`slide${index}Caption`, "Caption", slide.caption)}${field(`slide${index}CaptionStrong`, "Caption title", slide.captionStrong)}${field(`slide${index}Stamp`, "Image stamp", slide.stamp)}${field(`slide${index}Href`, "Destination", slide.href, { full: true })}<label class="full">Replace slide photograph<small>JPEG, PNG or WebP up to 3 MB. The uploaded image becomes live when this page is published.</small><input type="file" data-image-upload data-image-kind="heroSlide:${index}" accept="image/jpeg,image/png,image/webp"></label></div></article>`).join("");
  return `<form class="editor" data-singleton><input type="hidden" name="_id" value="homePage"><input type="hidden" name="_type" value="homePage"><input type="hidden" name="heroSlideCount" value="${slides.length}"><section class="form-panel"><h3>Homepage message</h3><div class="form-grid">${field("heroEyebrow", "Eyebrow", hero.eyebrow)}${field("heroTitle", "Title", hero.title, { help: "Use a line break between the two headline lines." })}${field("heroDescription", "Description", hero.description, { textarea: true, full: true })}${field("heroPrimaryLabel", "Primary action label", hero.primaryLabel)}${field("heroPrimaryHref", "Primary action URL", hero.primaryHref)}</div></section><section class="form-panel"><h3>Hero gallery</h3><p class="drawer-copy">These slides are shown in this order. Uploading a replacement stores it durably and publishing makes it visible on the storefront.</p><div class="hero-slide-list">${slideForms}</div></section><section class="form-panel"><h3>Merchandising</h3><div class="form-grid">${field("featuredProductIds", "Featured product IDs", (document.featuredProductIds || []).join(", "), { full: true })}${field("occasions", "Occasion cards", pairLines(document.occasions, ["key", "eyebrow", "title", "action"]), { textarea: true, full: true, help: "One per line: Key | Eyebrow | Title | Action" })}${field("journalPromotionId", "Promoted journal ID", document.journalPromotionId)}</div></section><section class="form-panel"><h3>Manifesto</h3><div class="form-grid">${field("manifestoEyebrow", "Eyebrow", manifesto.eyebrow)}${field("manifestoTitle", "Title", manifesto.title)}${field("manifestoDescription", "Description", manifesto.description, { textarea: true, full: true })}${field("manifestoSteps", "Steps", pairLines(manifesto.steps, ["title", "body"]), { textarea: true, full: true, help: "One per line: Title | Description" })}</div></section>${singletonActions(document)}</form>`;
}

function singletonActions(document) {
  return `<div class="actions-bar"><button type="button" class="button button--quiet" data-action="save">Save draft</button><button type="button" class="button button--ember" data-action="publish">Publish</button>${document._status === "published" || document._status === "modified" ? `<button type="button" class="button button--quiet" data-action="unpublish">Unpublish</button>` : ""}</div>`;
}

function ordersToolbar() {
  const filters = state.orderFilters;
  return `<form class="content-toolbar orders-toolbar" data-orders-filter>
    <input type="search" name="q" value="${escapeHtml(filters.q)}" placeholder="Search tracking, email, name" aria-label="Search orders">
    <select name="status" aria-label="Filter by status"><option value="">All statuses</option>${ORDER_STATUSES.map((item) => `<option value="${item}" ${filters.status === item ? "selected" : ""}>${escapeHtml(item.replace(/_/g, " "))}</option>`).join("")}</select>
    <select name="state" aria-label="Filter by state"><option value="">All states</option>${NIGERIAN_STATES.map((item) => `<option value="${escapeHtml(item)}" ${filters.state === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select>
    <input type="date" name="from" value="${escapeHtml(filters.from)}" aria-label="From date">
    <input type="date" name="to" value="${escapeHtml(filters.to)}" aria-label="To date">
    <button class="button button--dark" type="submit">Apply</button>
  </form>`;
}

function orderDetail(order) {
  if (!order) return "";
  const lines = (order.lines || []).map((line) => `<tr><td>${escapeHtml(line.name || line.productId || "—")}</td><td>${escapeHtml(line.quantity || 0)}</td><td>${money(line.price)}</td><td>${money(Number(line.price || 0) * Number(line.quantity || 0))}</td></tr>`).join("") || `<tr><td colspan="4">No line items.</td></tr>`;
  const customer = order.customer || {};
  const payment = order.payment || {};
  const totals = order.totals || {};
  return `<aside class="order-detail" data-order-detail>
    <div class="order-detail__head"><div><span class="eyebrow">${escapeHtml(order.status || "order")}</span><h2>${escapeHtml(order.trackingCode || order.id)}</h2></div><button type="button" class="button button--quiet" data-close-order>Close</button></div>
    <div class="order-detail__grid">
      <section><h3>Customer</h3><p>${escapeHtml(customer.name || "—")}<br>${escapeHtml(customer.email || "")}<br>${escapeHtml(customer.phone || "")}</p></section>
      <section><h3>Address</h3><p>${escapeHtml(customer.address || "—")}<br>${escapeHtml(customer.state || "")}${customer.note ? `<br><em>${escapeHtml(customer.note)}</em>` : ""}</p></section>
      <section><h3>Payment</h3><p>${escapeHtml(payment.provider || "—")}<br>Ref: ${escapeHtml(payment.reference || "—")}<br>${escapeHtml(payment.verificationStatus || order.status || "")}</p></section>
      <section><h3>Totals</h3><p>Subtotal ${money(totals.subtotal)}<br>Delivery ${money(totals.deliveryFee)}<br>${totals.giftFee ? `Gift wrap ${money(totals.giftFee)}<br>` : ""}${totals.discount ? `Discount −${money(totals.discount)}<br>` : ""}<strong>Total ${money(totals.total ?? order.total)}</strong></p></section>
      ${order.gift?.recipients?.length ? `<section><h3>Gift notify</h3><p>${(order.gift.recipients || []).map((person) => `${escapeHtml(person.name || "—")} · ${escapeHtml(person.email || "")}`).join("<br>")}${order.gift.message ? `<br><em>${escapeHtml(order.gift.message)}</em>` : ""}</p></section>` : ""}
    </div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Line</th></tr></thead><tbody>${lines}</tbody></table></div>
  </aside>`;
}

function ordersPanel() {
  const selected = state.orders.find((item) => item.id === state.selectedOrderId) || null;
  const rows = state.orders.map((order) => {
    const customer = order.customer || {};
    const active = order.id === state.selectedOrderId ? " is-active" : "";
    return `<tr class="order-row${active}" data-order-id="${escapeHtml(order.id)}" tabindex="0">
      <td>${escapeHtml(order.trackingCode || order.id || "—")}</td>
      <td>${escapeHtml(customer.name || customer.email || "—")}</td>
      <td>${escapeHtml(customer.state || "—")}</td>
      <td><span class="status-chip">${escapeHtml((order.status || "—").replace(/_/g, " "))}</span></td>
      <td>${money(order.totals?.total ?? order.total)}</td>
      <td>${escapeHtml(formatDate(order.createdAt))}</td>
    </tr>`;
  }).join("");
  return `${ordersToolbar()}${state.orders.length
    ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Tracking</th><th>Customer</th><th>State</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></div>${orderDetail(selected)}`
    : `<div class="empty-state"><span class="eyebrow">Fulfilment</span><h2>No orders match.</h2><p>Adjust the filters or wait for the first checkout.</p></div>`}`;
}

function subscribersPanel() {
  const rows = state.subscribers.map((item) => `<tr>
    <td>${escapeHtml(item.email || "—")}</td>
    <td>${escapeHtml(item.name || "—")}</td>
    <td>${escapeHtml(item.source || "—")}</td>
    <td>${escapeHtml(formatDate(item.createdAt))}</td>
  </tr>`).join("");
  return state.subscribers.length
    ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Email</th><th>Name</th><th>Source</th><th>Joined</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty-state"><span class="eyebrow">Audience</span><h2>No subscribers yet.</h2><p>Newsletter signups will appear here.</p></div>`;
}

function render() {
  const actions = $("[data-workspace-actions]");
  actions.innerHTML = ["products", "blogs"].includes(state.view) && !state.editing ? `<button class="button button--ember" data-new="${state.view === "products" ? "product" : "blogPost"}">Add ${state.view === "products" ? "bottle" : "story"}</button>` : "";
  const target = $("[data-workspace]");
  target.setAttribute("aria-busy", "false");
  if (state.editing) target.innerHTML = editor(state.editing);
  else if (state.view === "dashboard") target.innerHTML = renderDashboard();
  else if (state.view === "products") target.innerHTML = productList();
  else if (state.view === "blogs") target.innerHTML = blogList();
  else if (state.view === "homepage") target.innerHTML = singletonForm("homePage");
  else if (state.view === "taxonomy") target.innerHTML = singletonForm("taxonomy");
  else if (state.view === "orders") target.innerHTML = ordersPanel();
  else if (state.view === "subscribers") target.innerHTML = subscribersPanel();
  else if (state.view === "admins") target.innerHTML = adminsPanel();
  else target.innerHTML = singletonForm("siteSettings");
  queueMicrotask(() => enhanceCustomSelects(target));
}

function readDiscovery(data, prefix) {
  return {
    title: data[`${prefix}Title`],
    description: data[`${prefix}Description`],
    canonicalUrl: data[`${prefix}CanonicalUrl`],
    robots: data[`${prefix}Robots`],
    focusKeyphrase: data[`${prefix}FocusKeyphrase`],
    secondaryKeywords: split(data[`${prefix}SecondaryKeywords`]),
    tags: split(data[`${prefix}Tags`]),
    socialTitle: data[`${prefix}SocialTitle`],
    socialDescription: data[`${prefix}SocialDescription`],
    socialImage: data[`${prefix}SocialImage`],
    faqs: linePairs(data[`${prefix}Faqs`], ["question", "answer"]),
    structuredDataEnabled: Boolean(data[`${prefix}StructuredDataEnabled`]),
    faqEnabled: Boolean(data[`${prefix}FaqEnabled`]),
  };
}

function formDocument(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const existing = state.editing || documentByType(data._type) || {};
  const document = { ...existing, _id: data._id, _type: data._type };
  if (data._type === "product") {
    const rawOccasions = formData.getAll("occasions").map((item) => String(item).trim()).filter(Boolean);
    Object.assign(document, {
      id: data.id,
      name: data.name,
      slug: data.slug,
      brand: data.brand,
      category: data.category,
      subcategory: data.subcategory,
      occasions: rawOccasions.length > 1 ? [...new Set(rawOccasions)] : split(rawOccasions[0] || ""),
      amount: data.amount,
      volume: data.amount,
      abv: data.abv,
      price: Number(data.price),
      description: data.description,
      notes: split(data.notes),
      serve: data.serve,
      relatedProductIds: split(data.relatedProductIds),
      visible: Boolean(data.visible),
      imageMode: data.imageMode,
      imageAlt: data.imageAlt,
      image: data.legacyImage,
      legacyImage: data.legacyImage,
      availability: data.availabilityState ? { [data.availabilityState]: data.availabilityStatus || "in-stock" } : {},
    });
  }
  if (data._type === "blogPost") Object.assign(document, { id: data.id, title: data.title, slug: data.slug, excerpt: data.excerpt, category: data.category, author: data.author, publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : "", readTime: data.readTime, introduction: data.introduction, sections: linePairs(data.sections, ["heading", "body"]), pullQuote: data.pullQuote, relatedProductIds: split(data.relatedProductIds), visible: Boolean(data.visible), imageAlt: "", image: "", legacyImage: "" });
  if (["product", "blogPost"].includes(data._type)) {
    document.seo = readDiscovery(data, "seo");
    document.geo = readDiscovery(data, "geo");
  }
  if (data._type === "taxonomy") Object.assign(document, { categories: split(data.categories), subcategories: split(data.subcategories), abvValues: split(data.abvValues), occasions: split(data.occasions), locations: split(data.locations) });
  if (data._type === "siteSettings") Object.assign(document, { announcement: data.announcement, footerTagline: data.footerTagline, footerDescription: data.footerDescription, supportEmail: data.supportEmail, supportPhone: data.supportPhone, responsibleDrinking: data.responsibleDrinking, prototypeLabel: data.prototypeLabel, navigation: linePairs(data.navigation, ["label", "href"]), socialLinks: linePairs(data.socialLinks, ["label", "url"]), help: { eyebrow: data.helpEyebrow, title: data.helpTitle, description: data.helpDescription, sections: linePairs(data.helpSections, ["key", "title", "question", "answer"]) } });
  if (data._type === "homePage") {
    const heroSlides = Array.from({ length: Number(data.heroSlideCount || 0) }, (_, index) => ({
      id: data[`slide${index}Id`], occasion: data[`slide${index}Occasion`], image: data[`slide${index}Image`], responsiveBase: data[`slide${index}ResponsiveBase`], imageAlt: data[`slide${index}ImageAlt`], caption: data[`slide${index}Caption`], captionStrong: data[`slide${index}CaptionStrong`], stamp: data[`slide${index}Stamp`], href: data[`slide${index}Href`],
    }));
    Object.assign(document, { hero: { ...document.hero, eyebrow: data.heroEyebrow, title: data.heroTitle, description: data.heroDescription, primaryLabel: data.heroPrimaryLabel, primaryHref: data.heroPrimaryHref }, heroSlides, featuredProductIds: split(data.featuredProductIds), occasions: linePairs(data.occasions, ["key", "eyebrow", "title", "action"]), journalPromotionId: data.journalPromotionId, manifesto: { eyebrow: data.manifestoEyebrow, title: data.manifestoTitle, description: data.manifestoDescription, steps: linePairs(data.manifestoSteps, ["title", "body"]) } });
  }
  return document;
}

function showErrors(form, errors = {}) {
  $$("[data-error]", form).forEach((target) => { target.textContent = errors[target.dataset.error] || ""; const input = form.elements[target.dataset.error]; if (input) input.setAttribute("aria-invalid", errors[target.dataset.error] ? "true" : "false"); });
  const first = Object.keys(errors)[0];
  if (first && form.elements[first]) form.elements[first].focus();
}

async function mutate(action, form) {
  const button = $(`[data-action="${action}"]`, form);
  const document = formDocument(form);
  if (action === "preview") {
    button.disabled = true;
    try {
      const payload = await request("preview", { method: "POST", body: JSON.stringify({ document }) });
      const warning = Object.keys(payload.warnings || {}).length ? `${Object.keys(payload.warnings).length} publish item(s) still need attention.` : "Ready to publish.";
      status(warning, Object.keys(payload.warnings || {}).length ? "error" : "success");
    } catch (error) { status(error.message, "error"); } finally { button.disabled = false; }
    return;
  }
  if (action === "archive") {
    state.archiveTarget = { document, form };
    $("[data-confirm-dialog]").showModal();
    return;
  }
  button.disabled = true;
  status(`${action === "publish" ? "Publishing" : "Saving"}…`);
  try {
    const payload = await request("document", { method: "POST", body: JSON.stringify({ action, document }) });
    status(payload.message, "success");
    await load(false);
    state.editing = state.documents.find((item) => item._baseId === (document._baseId || document._id)) || null;
    render();
  } catch (error) {
    showErrors(form, error.payload?.errors);
    status(error.message, "error");
  } finally { button.disabled = false; }
}

async function upload(file, kind, form, input) {
  if (!file) return;
  if (input) input.disabled = true;
  status("Uploading image…");
  try {
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const payload = await request("upload", { method: "POST", body: JSON.stringify({ filename: file.name, contentType: file.type, data, kind }) });
    if (kind.startsWith("heroSlide:")) {
      const index = Number(kind.split(":")[1]);
      const image = form.elements[`slide${index}Image`];
      const responsiveBase = form.elements[`slide${index}ResponsiveBase`];
      if (image) image.value = payload.url;
      if (responsiveBase) responsiveBase.value = "";
      const well = $(`[data-image-well="${kind}"]`, form);
      if (well) well.innerHTML = `<img src="${escapeHtml(payload.url)}" alt="">`;
    } else if (kind === "image") {
      state.editing.image = payload.url;
      state.editing.imageUrl = payload.url;
      state.editing.legacyImage = payload.url;
      const hidden = form.elements.legacyImage;
      if (hidden) hidden.value = payload.url;
      const well = $('[data-image-well="image"]');
      if (well) well.innerHTML = `<img src="${escapeHtml(payload.url)}" alt="">`;
    } else {
      state.editing[kind] = { ...(state.editing[kind] || {}), socialImage: payload.url };
      const hidden = form.elements[`${kind}SocialImage`];
      if (hidden) hidden.value = payload.url;
      const well = $(`[data-image-well="${kind}"]`);
      if (well) well.innerHTML = `<img src="${escapeHtml(payload.url)}" alt="">`;
    }
    status("Image uploaded. Save or publish to keep it on the shelf.", "success");
  } catch (error) { status(error.message, "error"); } finally { if (input) input.disabled = false; }
}


function adminsPanel() {
  const emails = state.adminEmails || [];
  return `<section class="form-panel"><h3>Shelf admins</h3><p class="drawer-copy">Only these emails can publish. Primary admin cannot be removed.</p><form data-admin-form class="form-grid"><label class="full">Add admin email<input name="email" type="email" required placeholder="name@email.com"></label><button class="button button--ember" type="submit">Add admin</button></form><div class="admin-email-list">${emails.map((email) => `<div class="admin-email-row"><span>${escapeHtml(email)}</span>${email === "adedokunt96@gmail.com" ? "<small>Primary</small>" : `<button type="button" class="text-link" data-remove-admin="${escapeHtml(email)}">Remove</button>`}</div>`).join("") || "<p>No admins loaded yet.</p>"}</div></section>`;
}

async function loadAdmins() {
  try {
    const payload = await request("admins");
    state.adminEmails = payload.emails || [];
  } catch {
    state.adminEmails = [];
  }
}

async function loadOrders() {
  const filters = state.orderFilters;
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.state) params.set("state", filters.state);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  status("Loading orders…");
  try {
    const payload = await request(`orders${query ? `?${query}` : ""}`);
    state.orders = payload.orders || [];
    if (state.selectedOrderId && !state.orders.some((item) => item.id === state.selectedOrderId)) {
      state.selectedOrderId = null;
    }
    status(`${state.orders.length} order${state.orders.length === 1 ? "" : "s"} loaded.`, "success");
    if (state.view === "orders") render();
  } catch (error) {
    status(error.message || "Orders could not be loaded right now.", "error");
    if (state.view === "orders") render();
  }
}

async function loadSubscribers() {
  status("Loading subscribers…");
  try {
    const payload = await request("subscribers");
    state.subscribers = payload.subscribers || [];
    status(`${state.subscribers.length} subscriber${state.subscribers.length === 1 ? "" : "s"} loaded.`, "success");
    if (state.view === "subscribers") render();
  } catch (error) {
    status(error.message || "Subscribers could not be loaded right now.", "error");
    if (state.view === "subscribers") render();
  }
}

async function load(initial = true) {
  try {
    const payload = await request("content");
    state.documents = payload.documents;
    state.counts = payload.counts;
    state.persist = payload.persist || {};
    $("[data-connection]").textContent = state.persist.durable ? "Published shelf is live" : "Shelf is local to this instance";
    if (initial) status(state.persist.durable ? "Content shelf is ready." : "Shelf loaded without durable storage. Published changes may not survive a restart.", state.persist.durable ? "success" : "");
    render();
    if (state.view === "orders") loadOrders();
    if (state.view === "subscribers") loadSubscribers();
  } catch (error) {
    $("[data-workspace]").innerHTML = `<div class="empty-state"><span class="eyebrow">Shelf unavailable</span><h2>Content could not be loaded.</h2><p>${escapeHtml(error.message)}</p><button class="button button--dark" data-retry>Try again</button></div>`;
  }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-open-shelf]")) return setShelfOpen(true);
  if (event.target.closest("[data-close-shelf]") || event.target.closest("[data-shelf-backdrop]")) return setShelfOpen(false);
  const view = event.target.closest("[data-view]");
  if (view) {
    const fromMenu = Boolean(view.closest("[data-shelf-menu]"));
    setView(view.dataset.view);
    if (fromMenu) setShelfOpen(false, { restoreFocus: false });
    return;
  }
  if (event.target.closest("[data-retry]")) return load();
  const create = event.target.closest("[data-new]");
  if (create) { state.editing = newDocument(create.dataset.new); return render(); }
  const edit = event.target.closest("[data-edit]");
  if (edit) { state.editing = withGeoDefaults(state.documents.find((item) => item._baseId === edit.dataset.edit)); return render(); }
  if (event.target.closest("[data-close-editor]")) { state.editing = null; return render(); }
  if (event.target.closest("[data-close-order]")) { state.selectedOrderId = null; return render(); }
  const orderRow = event.target.closest("[data-order-id]");
  if (orderRow) {
    state.selectedOrderId = orderRow.dataset.orderId;
    return render();
  }
  const action = event.target.closest("[data-action]");
  if (action) return mutate(action.dataset.action, action.closest("form"));
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-content-search]")) { state.query = event.target.value; render(); $("[data-content-search]")?.focus(); }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-status-filter]")) { state.filter = event.target.value; render(); }
  if (event.target.matches("[data-image-upload]")) upload(event.target.files[0], event.target.dataset.imageKind, event.target.closest("form"), event.target);
});

$("[data-confirm-dialog]").addEventListener("close", async (event) => {
  if (event.target.returnValue !== "confirm" || !state.archiveTarget) return state.archiveTarget = null;
  const { document, form } = state.archiveTarget;
  state.archiveTarget = null;
  try {
    const payload = await request("document", { method: "POST", body: JSON.stringify({ action: "archive", document }) });
    status(payload.message, "success");
    state.editing = null;
    await load(false);
  } catch (error) { showErrors(form, error.payload?.errors); status(error.message, "error"); }
});

window.addEventListener("hashchange", () => setView(location.hash.slice(1) || "dashboard"));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.shelfMenuOpen) setShelfOpen(false);
});
window.matchMedia("(max-width: 850px)").addEventListener("change", (event) => {
  if (!event.matches && state.shelfMenuOpen) setShelfOpen(false, { restoreFocus: false });
});
async function bootAdmin() {
  const user = await waitForRestoredAuth();
  if (!user) {
    localStorage.setItem("yodlaPostLoginRedirect", "/admin/");
    window.location.assign("/login.html?next=/admin/");
    return;
  }
  state.adminUser = accountFromUser(user);
  const banner = document.querySelector(".admin-exposure");
  if (banner) banner.innerHTML = `<strong>Signed in as ${escapeHtml(state.adminUser.email)}</strong><span>Publishes change the live storefront.</span><button type="button" class="text-link" data-admin-signout>Sign out</button>`;
  const [kicker, title] = titles[state.view] || titles.dashboard;
  $("[data-kicker]").textContent = kicker;
  $("[data-title]").textContent = title;
  $$("[data-view]").forEach((button) => button.setAttribute("aria-current", button.dataset.view === state.view ? "page" : "false"));
  await load();
  await loadAdmins();
  if (state.view === "admins") render();
}

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-orders-filter]")) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.orderFilters = {
      q: String(data.q || "").trim(),
      status: String(data.status || ""),
      state: String(data.state || ""),
      from: String(data.from || ""),
      to: String(data.to || ""),
    };
    return loadOrders();
  }
  if (!event.target.matches("[data-admin-form]")) return;
  event.preventDefault();
  const email = event.target.elements.email.value.trim();
  try {
    const payload = await request("admins", { method: "POST", body: JSON.stringify({ email }) });
    state.adminEmails = payload.emails || [];
    status("Admin added.", "success");
    render();
  } catch (error) {
    status(error.message, "error");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const orderRow = event.target.closest("[data-order-id]");
  if (!orderRow || event.target !== orderRow) return;
  event.preventDefault();
  state.selectedOrderId = orderRow.dataset.orderId;
  render();
});

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-admin-signout]")) {
    await signOutUser();
    window.location.assign("/login.html?next=/admin/");
  }
  const remove = event.target.closest("[data-remove-admin]");
  if (remove) {
    try {
      const payload = await request("admins", { method: "DELETE", body: JSON.stringify({ email: remove.dataset.removeAdmin }) });
      state.adminEmails = payload.emails || [];
      status("Admin removed.", "success");
      render();
    } catch (error) {
      status(error.message, "error");
    }
  }
});

bootAdmin();
