const API = location.pathname.includes("/admin") ? "/admin/api" : "api";
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const split = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const linePairs = (value, fields) => String(value || "").split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.some(Boolean)).map((parts) => Object.fromEntries(fields.map((field, index) => [field, parts[index] || ""])));
const pairLines = (items, fields) => (items || []).map((item) => fields.map((field) => item[field] || "").join(" | ")).join("\n");
const money = (value) => `₦${Number(value || 0).toLocaleString("en-NG")}`;
const rootImage = (value) => {
  const image = String(value || "");
  return image && !/^(?:https?:|data:|\/)/i.test(image) ? `/${image.replace(/^\.\//, "")}` : image;
};
const imageOf = (document) => rootImage(document.imageUrl || document.previewImageUrl || (typeof document.image === "string" ? document.image : document.legacyImage) || "");

const state = { view: location.hash.slice(1) || "dashboard", documents: [], counts: {}, persist: {}, query: "", filter: "all", editing: null, archiveTarget: null, shelfMenuOpen: false };
const titles = { dashboard: ["The current edit", "On the shelf"], products: ["Inventory", "Bottles"], blogs: ["Editorial", "Journal"], homepage: ["Merchandising", "Homepage"], taxonomy: ["Delivery", "Cities"], settings: ["Global content", "Site"] };

function status(message = "", tone = "") {
  $("[data-status]").innerHTML = message ? `<p class="${tone}">${escapeHtml(message)}</p>` : "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API}/${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
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
  location.hash = view;
  $$("[data-view]").forEach((button) => button.setAttribute("aria-current", button.dataset.view === view ? "page" : "false"));
  const [kicker, title] = titles[view] || titles.dashboard;
  $("[data-kicker]").textContent = kicker;
  $("[data-title]").textContent = title;
  render();
  $("#workspace").focus();
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
  const title = isSeo ? "Search (SEO)" : "Generative engines (GEO)";
  const help = isSeo ? "Used by Google and social cards." : "Used by ChatGPT, Perplexity and similar citation engines.";
  const image = values.socialImage || "";
  return `<section class="form-panel"><h3>${title}</h3><p class="drawer-copy">${help}</p><div class="form-grid">${field(`${prefix}Title`, "Title", values.title, { maxlength: 70 })}${field(`${prefix}Description`, "Description", values.description, { textarea: true, maxlength: 180 })}${field(`${prefix}CanonicalUrl`, isSeo ? "Canonical URL" : "Citation URL", values.canonicalUrl, { type: "url" })}<label>Robots / crawl<select name="${prefix}Robots"><option>index,follow</option><option ${values.robots === "noindex,follow" ? "selected" : ""}>noindex,follow</option><option ${values.robots === "noindex,nofollow" ? "selected" : ""}>noindex,nofollow</option></select></label>${field(`${prefix}FocusKeyphrase`, "Focus keyphrase", values.focusKeyphrase)}${field(`${prefix}SecondaryKeywords`, "Secondary keywords", (values.secondaryKeywords || []).join(", "))}${field(`${prefix}Tags`, "Tags", (values.tags || []).join(", "))}${field(`${prefix}SocialTitle`, isSeo ? "Share title" : "Citation title", values.socialTitle)}${field(`${prefix}SocialDescription`, isSeo ? "Share description" : "Citation description", values.socialDescription, { textarea: true })}<label class="full">${isSeo ? "Share image" : "Citation image"}<small>JPEG, PNG or WebP up to 3 MB.</small><div class="citation-well" data-image-well="${prefix}">${image ? `<img src="${escapeHtml(image)}" alt="">` : "<span>No image selected</span>"}</div><input type="file" data-image-upload data-image-kind="${prefix}" accept="image/jpeg,image/png,image/webp"><input type="hidden" name="${prefix}SocialImage" value="${escapeHtml(image)}"></label>${field(`${prefix}Faqs`, "FAQs", pairLines(values.faqs, ["question", "answer"]), { textarea: true, full: true, help: "One per line: Question | Answer" })}<label class="checkbox"><input type="checkbox" name="${prefix}StructuredDataEnabled" ${values.structuredDataEnabled !== false ? "checked" : ""}> Structured data enabled</label><label class="checkbox"><input type="checkbox" name="${prefix}FaqEnabled" ${values.faqEnabled !== false ? "checked" : ""}> FAQ schema enabled</label></div></section>`;
}

function productForm(document) {
  const availability = Array.isArray(document.availability) ? Object.fromEntries(document.availability.map((item) => [item.location, item.status])) : document.availability || {};
  const locations = documentByType("taxonomy")?.locations || ["Lagos", "Abuja", "Ibadan", "Port Harcourt"];
  return `<section class="form-panel"><h3>Product essentials</h3><div class="form-grid">${field("name", "Product name", document.name, { required: true })}${field("id", "Stable product ID", document.id, { required: true })}${field("slug", "URL slug", document.slugValue || document.slug?.current || document.slug || document.id, { required: true })}${field("brand", "Brand", document.brand, { required: true })}${field("category", "Category", document.category, { required: true })}${field("subcategory", "Subcategory", document.subcategory)}${field("volume", "Volume", document.volume)}${field("abv", "ABV", document.abv)}${field("price", "Selling price (NGN)", document.price, { type: "number", min: 1, required: true })}${field("compareAtPrice", "Comparison price", document.compareAtPrice || "", { type: "number", min: 1 })}${field("tag", "Product badge", document.tag)}${field("featuredOrder", "Featured order", document.featuredOrder ?? 999, { type: "number", min: 0 })}${field("occasions", "Occasions", (document.occasions || []).join(", "), { full: true })}${field("description", "Description", document.description, { textarea: true, full: true })}${field("notes", "Tasting notes", (document.notes || []).join(", "), { full: true })}${field("serve", "How to serve", document.serve, { textarea: true, full: true })}${field("relatedProductIds", "Related product IDs", (document.relatedProductIds || []).join(", "), { full: true })}<label class="checkbox"><input type="checkbox" name="visible" ${document.visible !== false ? "checked" : ""}> Visible when published</label><label class="checkbox"><input type="checkbox" name="prototype" ${document.prototype ? "checked" : ""}> Fictional Yodla concept</label><label>Image treatment<select name="imageMode"><option value="light">Light shelf</option><option value="dark" ${document.imageMode === "dark" ? "selected" : ""}>Dark shelf</option><option value="transparent" ${document.imageMode === "transparent" ? "selected" : ""}>Transparent / gift set</option></select></label>${field("imageAlt", "Image alt text", document.imageAlt, { required: true })}<label class="full">Bottle image<small>JPEG, PNG or WebP up to 3 MB.</small><input type="file" data-image-upload data-image-kind="image" accept="image/jpeg,image/png,image/webp"></label><input type="hidden" name="legacyImage" value="${escapeHtml(imageOf(document))}"></div></section><section class="form-panel"><h3>Availability by city</h3><div class="availability-grid">${locations.map((location) => `<label>${escapeHtml(location)}<select name="availability:${escapeHtml(location)}"><option value="in-stock" ${availability[location] === "in-stock" ? "selected" : ""}>In stock</option><option value="low-stock" ${availability[location] === "low-stock" ? "selected" : ""}>Low stock</option><option value="unavailable" ${!availability[location] || availability[location] === "unavailable" ? "selected" : ""}>Unavailable</option></select></label>`).join("")}</div></section>${discoveryPanel("seo", document.seo || {})}${discoveryPanel("geo", document.geo || {})}`;
}

function blogForm(document) {
  return `<section class="form-panel"><h3>Article</h3><div class="form-grid">${field("title", "Title", document.title, { required: true, full: true })}${field("id", "Stable article ID", document.id, { required: true })}${field("slug", "URL slug", document.slugValue || document.slug?.current || document.slug || document.id, { required: true })}${field("category", "Category", document.category)}${field("author", "Author", document.author || "Yodla")}${field("publishedAt", "Publication date", document.publishedAt ? document.publishedAt.slice(0, 16) : "", { type: "datetime-local" })}${field("readTime", "Read time", document.readTime)}${field("excerpt", "Excerpt", document.excerpt, { textarea: true, full: true, required: true })}${field("introduction", "Introduction", document.introduction, { textarea: true, full: true })}${field("sections", "Article sections", pairLines(document.sections, ["heading", "body"]), { textarea: true, full: true, help: "One per line: Heading | Paragraph" })}${field("pullQuote", "Pull quote", document.pullQuote, { textarea: true, full: true })}${field("relatedProductIds", "Related product IDs", (document.relatedProductIds || []).join(", "), { full: true })}<label class="checkbox"><input type="checkbox" name="visible" ${document.visible !== false ? "checked" : ""}> Visible when published</label>${field("imageAlt", "Image alt text", document.imageAlt, { required: true })}<label class="full">Hero image<small>JPEG, PNG or WebP up to 3 MB.</small><input type="file" data-image-upload data-image-kind="image" accept="image/jpeg,image/png,image/webp"></label><input type="hidden" name="legacyImage" value="${escapeHtml(imageOf(document))}"></div></section>${discoveryPanel("seo", document.seo || {})}${discoveryPanel("geo", document.geo || {})}`;
}

function snippets(document) {
  const seo = document.seo || {};
  const geo = document.geo || {};
  return `<article class="snippet search"><small>Search result</small><strong>${escapeHtml(seo.title || "SEO title")}</strong><p>${escapeHtml(seo.description || "SEO description")}</p></article><article class="snippet citation"><small>AI citation</small><strong>${escapeHtml(geo.title || "GEO title")}</strong><p>${escapeHtml(geo.description || "GEO description")}</p></article>`;
}

function readiness(document) {
  const checks = document._type === "product"
    ? [["Name", document.name], ["Price", document.price], ["Description", document.description], ["Image", imageOf(document)], ["SEO title", document.seo?.title], ["SEO description", document.seo?.description], ["GEO title", document.geo?.title], ["GEO description", document.geo?.description]]
    : [["Title", document.title], ["Excerpt", document.excerpt], ["Introduction", document.introduction], ["Sections", document.sections?.length], ["Image", imageOf(document)], ["SEO title", document.seo?.title], ["SEO description", document.seo?.description], ["GEO title", document.geo?.title], ["GEO description", document.geo?.description]];
  return checks.map(([label, ready]) => `<div><span>${label}</span><b class="${ready ? "" : "missing"}">${ready ? "Ready" : "Missing"}</b></div>`).join("");
}

function editor(document) {
  const current = withGeoDefaults(document);
  const label = current.name || current.title || `New ${current._type === "product" ? "product" : "article"}`;
  const previewCard = current._type === "product"
    ? `<article class="product-card"><span class="product-card__media media--${escapeHtml(current.imageMode || "light")}">${imageOf(current) ? `<img src="${escapeHtml(imageOf(current))}" alt="">` : ""}</span><span class="product-card__meta"><span><p>${escapeHtml(current.brand || "Brand")}</p><h3>${escapeHtml(label)}</h3></span><strong>${money(current.price)}</strong></span></article>`
    : `<article class="editorial-card">${imageOf(current) ? `<img src="${escapeHtml(imageOf(current))}" alt="">` : ""}<div><span>${escapeHtml(current.category || "Journal")}</span><h2>${escapeHtml(label)}</h2></div></article>`;
  return `<form class="editor" data-editor novalidate><input type="hidden" name="_id" value="${escapeHtml(current._baseId || current._id)}"><input type="hidden" name="_type" value="${current._type}"><div class="editor-head"><div><span class="eyebrow">${escapeHtml(current._status || "New draft")}</span><h2>${escapeHtml(label)}</h2></div><button type="button" class="button button--quiet" data-close-editor>Back to list</button></div><div class="editor-grid"><div class="editor-media media--${escapeHtml(current.imageMode || "dark")}" data-image-well="image">${imageOf(current) ? `<img src="${escapeHtml(imageOf(current))}" alt="">` : "<span>Upload a bottle or story image</span>"}</div><div>${current._type === "product" ? productForm(current) : blogForm(current)}<aside class="side-panel"><section class="form-panel"><h3>Publish readiness</h3><div class="readiness">${readiness(current)}</div>${snippets(current)}<div data-preview>${previewCard}</div></section></aside><div class="actions-bar"><button type="button" class="button button--quiet" data-action="preview">Preview</button>${current._status === "published" || current._status === "modified" ? `<button type="button" class="button button--quiet" data-action="unpublish">Unpublish</button>` : ""}<button type="button" class="button button--quiet" data-action="save">Save draft</button><button type="button" class="button button--ember" data-action="publish">Publish</button>${current._baseId ? `<button type="button" class="button button--danger" data-action="archive">Archive</button>` : ""}</div></div></div></form>`;
}

function singletonForm(type) {
  const document = documentByType(type) || { _id: type, _baseId: type, _type: type, _status: "draft" };
  if (type === "taxonomy") return `<form class="editor" data-singleton><input type="hidden" name="_id" value="taxonomy"><input type="hidden" name="_type" value="taxonomy"><section class="form-panel"><h3>Catalogue structure</h3><div class="form-grid">${field("categories", "Categories", (document.categories || []).join(", "), { textarea: true, full: true })}${field("occasions", "Occasions", (document.occasions || []).join(", "), { textarea: true, full: true })}${field("locations", "Delivery cities", (document.locations || []).join(", "), { textarea: true, full: true })}</div></section>${singletonActions(document)}</form>`;
  if (type === "siteSettings") return `<form class="editor" data-singleton><input type="hidden" name="_id" value="siteSettings"><input type="hidden" name="_type" value="siteSettings"><section class="form-panel"><h3>Shared storefront content</h3><div class="form-grid">${field("announcement", "Header announcement", document.announcement)}${field("footerTagline", "Footer tagline", document.footerTagline)}${field("footerDescription", "Footer description", document.footerDescription, { textarea: true, full: true })}${field("supportEmail", "Support email", document.supportEmail, { type: "email" })}${field("supportPhone", "Support phone", document.supportPhone)}${field("responsibleDrinking", "Responsible drinking notice", document.responsibleDrinking)}${field("prototypeLabel", "Prototype label", document.prototypeLabel)}${field("navigation", "Main navigation", pairLines(document.navigation, ["label", "href"]), { textarea: true, full: true, help: "One per line: Label | URL" })}${field("socialLinks", "Social links", pairLines(document.socialLinks, ["label", "url"]), { textarea: true, full: true, help: "One per line: Network | URL" })}</div></section><section class="form-panel"><h3>Help centre</h3><div class="form-grid">${field("helpEyebrow", "Help eyebrow", document.help?.eyebrow)}${field("helpTitle", "Help title", document.help?.title)}${field("helpDescription", "Help description", document.help?.description, { textarea: true, full: true })}${field("helpSections", "Help sections", pairLines(document.help?.sections, ["key", "title", "question", "answer"]), { textarea: true, full: true, help: "One per line: Anchor | Section | Question | Answer" })}</div></section>${singletonActions(document)}</form>`;
  const hero = document.hero || {}, manifesto = document.manifesto || {};
  const slides = document.heroSlides?.length ? document.heroSlides : hero.image ? [hero] : [];
  const slideForms = slides.map((slide, index) => `<article class="hero-slide-editor"><div class="hero-slide-editor__head"><span class="eyebrow">Slide ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(slide.occasion || slide.captionStrong || "Hero image")}</strong></div><div class="hero-slide-editor__media" data-image-well="heroSlide:${index}">${slide.image ? `<img src="${escapeHtml(rootImage(slide.image))}" alt="">` : "<span>No image selected</span>"}</div><div class="form-grid"><input type="hidden" name="slide${index}Image" value="${escapeHtml(slide.image || "")}"><input type="hidden" name="slide${index}ResponsiveBase" value="${escapeHtml(slide.responsiveBase || "")}">${field(`slide${index}Id`, "Stable slide ID", slide.id, { required: true })}${field(`slide${index}Occasion`, "Occasion label", slide.occasion)}${field(`slide${index}ImageAlt`, "Image alt text", slide.imageAlt, { required: true, full: true })}${field(`slide${index}Caption`, "Caption", slide.caption)}${field(`slide${index}CaptionStrong`, "Caption title", slide.captionStrong)}${field(`slide${index}Stamp`, "Image stamp", slide.stamp)}${field(`slide${index}Href`, "Destination", slide.href, { full: true })}<label class="full">Replace slide photograph<small>JPEG, PNG or WebP up to 3 MB. The uploaded image becomes live when this page is published.</small><input type="file" data-image-upload data-image-kind="heroSlide:${index}" accept="image/jpeg,image/png,image/webp"></label></div></article>`).join("");
  return `<form class="editor" data-singleton><input type="hidden" name="_id" value="homePage"><input type="hidden" name="_type" value="homePage"><input type="hidden" name="heroSlideCount" value="${slides.length}"><section class="form-panel"><h3>Homepage message</h3><div class="form-grid">${field("heroEyebrow", "Eyebrow", hero.eyebrow)}${field("heroTitle", "Title", hero.title, { help: "Use a line break between the two headline lines." })}${field("heroDescription", "Description", hero.description, { textarea: true, full: true })}${field("heroPrimaryLabel", "Primary action label", hero.primaryLabel)}${field("heroPrimaryHref", "Primary action URL", hero.primaryHref)}</div></section><section class="form-panel"><h3>Hero gallery</h3><p class="drawer-copy">These slides are shown in this order. Uploading a replacement stores it durably and publishing makes it visible on the storefront.</p><div class="hero-slide-list">${slideForms}</div></section><section class="form-panel"><h3>Merchandising</h3><div class="form-grid">${field("featuredProductIds", "Featured product IDs", (document.featuredProductIds || []).join(", "), { full: true })}${field("occasions", "Occasion cards", pairLines(document.occasions, ["key", "eyebrow", "title", "action"]), { textarea: true, full: true, help: "One per line: Key | Eyebrow | Title | Action" })}${field("journalPromotionId", "Promoted journal ID", document.journalPromotionId)}</div></section><section class="form-panel"><h3>Manifesto</h3><div class="form-grid">${field("manifestoEyebrow", "Eyebrow", manifesto.eyebrow)}${field("manifestoTitle", "Title", manifesto.title)}${field("manifestoDescription", "Description", manifesto.description, { textarea: true, full: true })}${field("manifestoSteps", "Steps", pairLines(manifesto.steps, ["title", "body"]), { textarea: true, full: true, help: "One per line: Title | Description" })}</div></section>${singletonActions(document)}</form>`;
}

function singletonActions(document) {
  return `<div class="actions-bar"><button type="button" class="button button--quiet" data-action="save">Save draft</button><button type="button" class="button button--ember" data-action="publish">Publish</button>${document._status === "published" || document._status === "modified" ? `<button type="button" class="button button--quiet" data-action="unpublish">Unpublish</button>` : ""}</div>`;
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
  else target.innerHTML = singletonForm("siteSettings");
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
  const data = Object.fromEntries(new FormData(form));
  const existing = state.editing || documentByType(data._type) || {};
  const document = { ...existing, _id: data._id, _type: data._type };
  if (data._type === "product") Object.assign(document, { id: data.id, name: data.name, slug: data.slug, brand: data.brand, category: data.category, subcategory: data.subcategory, occasions: split(data.occasions), volume: data.volume, abv: data.abv, price: Number(data.price), compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : null, tag: data.tag, featuredOrder: Number(data.featuredOrder), description: data.description, notes: split(data.notes), serve: data.serve, relatedProductIds: split(data.relatedProductIds), visible: Boolean(data.visible), prototype: Boolean(data.prototype), imageMode: data.imageMode, imageAlt: data.imageAlt, image: data.legacyImage, legacyImage: data.legacyImage, availability: Object.fromEntries([...new FormData(form).entries()].filter(([key]) => key.startsWith("availability:")).map(([key, value]) => [key.slice(13), value])) });
  if (data._type === "blogPost") Object.assign(document, { id: data.id, title: data.title, slug: data.slug, excerpt: data.excerpt, category: data.category, author: data.author, publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : "", readTime: data.readTime, introduction: data.introduction, sections: linePairs(data.sections, ["heading", "body"]), pullQuote: data.pullQuote, relatedProductIds: split(data.relatedProductIds), visible: Boolean(data.visible), imageAlt: data.imageAlt, image: data.legacyImage, legacyImage: data.legacyImage });
  if (["product", "blogPost"].includes(data._type)) {
    document.seo = readDiscovery(data, "seo");
    document.geo = readDiscovery(data, "geo");
  }
  if (data._type === "taxonomy") Object.assign(document, { categories: split(data.categories), occasions: split(data.occasions), locations: split(data.locations) });
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

async function load(initial = true) {
  try {
    const payload = await request("content");
    state.documents = payload.documents;
    state.counts = payload.counts;
    state.persist = payload.persist || {};
    $("[data-connection]").textContent = state.persist.durable ? "Published shelf is live" : "Shelf is local to this instance";
    if (initial) status(state.persist.durable ? "Content shelf is ready." : "Shelf loaded without durable storage. Published changes may not survive a restart.", state.persist.durable ? "success" : "");
    render();
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
load();
