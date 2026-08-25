import {
  CATEGORIES,
  LOCATIONS,
  PRODUCTS,
  filterProducts,
  formatMoney,
  getAvailability,
  getProduct,
  sortProducts,
} from "./catalog.js";
import {
  addCartItem,
  getCartCount,
  getCartTotal,
  LOCATION_STORAGE_KEY,
  readCart,
  removeCartItem,
  setCartQuantity,
  writeCart,
} from "./cart-store.js";
import { BLOG_POSTS, getBlogPost } from "./blogs.js";
import { createAccount, getCurrentAccount, signIn, signOut } from "./account-store.js";
import { content, loadPublishedContent } from "./content-store.js";
import { heroPositionLabel, nextHeroIndex, normalizeHeroSlides } from "./hero-carousel.js";

const gsap = window.gsap;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (gsap && window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

const state = {
  cart: readCart(),
  location: localStorage.getItem(LOCATION_STORAGE_KEY) || "",
  filters: { category: "All", occasion: "", query: "", price: "all", sort: "featured" },
  drawer: null,
  previousFocus: null,
  account: getCurrentAccount(),
  accountMode: "signup",
  chatHistory: [],
  heroSlide: 0,
};

let heroSlides = [];
let heroPointerStart = null;
let heroSwipeHandled = false;

const page = document.body.dataset.page || "home";
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const productUrl = (id) => {
  const product = getProduct(id);
  return product?.slug ? `products/${encodeURIComponent(product.slug)}` : `product.html?id=${encodeURIComponent(id)}`;
};
const blogUrl = (post) => post?.slug ? `journal/${encodeURIComponent(post.slug)}` : `blog.html?id=${encodeURIComponent(post?.id || "")}`;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const icon = (name, className = "") => `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#${name}"></use></svg>`;
const availabilityCopy = {
  "in-stock": "Ready for delivery",
  "low-stock": "Only a few left",
  unavailable: "Unavailable here",
  "choose-location": "Choose delivery location",
};

function productPicture(product, options = {}) {
  const sizes = options.sizes || "(max-width: 390px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 50vw, 25vw";
  const loading = options.eager ? "eager" : "lazy";
  const fetchPriority = options.eager ? "high" : "auto";
  const alt = options.decorative ? "" : (product.imageAlt || product.name);
  if (/^https?:\/\//i.test(product.image || "")) return `<img class="${options.className || "product-picture"}" src="${escapeHtml(product.image)}" alt="${escapeHtml(alt)}" loading="${loading}" fetchpriority="${fetchPriority}" width="900" height="1100">`;
  return `<picture class="${options.className || "product-picture"}">
    <source type="image/webp" srcset="assets/products/responsive/${product.id}-480.webp 480w, assets/products/responsive/${product.id}-900.webp 900w" sizes="${sizes}">
    <img src="${product.image}" alt="${alt}" loading="${loading}" fetchpriority="${fetchPriority}" width="900" height="1100">
  </picture>`;
}

function heroSlideMedia(slide) {
  const product = getProduct(slide.imageProductId);
  return {
    image: slide.image || product?.image || "",
    alt: slide.imageAlt || product?.imageAlt || product?.name || "Yodla drink selection",
    responsiveBase: slide.responsiveBase || (!/^https?:\/\//i.test(product?.image || "") ? product?.id : ""),
  };
}

function renderHeroSlide(index, { announce = true } = {}) {
  const stage = $("[data-hero-carousel]");
  if (!stage || !heroSlides.length) return;
  state.heroSlide = nextHeroIndex(index, 0, heroSlides.length);
  const slide = heroSlides[state.heroSlide];
  const media = heroSlideMedia(slide);
  const image = $(".hero-bottle", stage);
  const avif = $("[data-hero-avif]", stage);
  const webp = $("[data-hero-webp]", stage);
  const link = $("[data-hero-link]", stage);
  const caption = $(".hero-caption", stage);
  const stamp = $(".hero-stamp", stage);
  const position = $("[data-hero-position]", stage);
  const live = $("[data-hero-live]", stage);
  const version = "20260824-2";
  if (media.responsiveBase) {
    avif?.removeAttribute("hidden");
    webp?.removeAttribute("hidden");
    if (avif) avif.srcset = `assets/products/responsive/${media.responsiveBase}-480.avif?v=${version} 480w, assets/products/responsive/${media.responsiveBase}-900.avif?v=${version} 900w`;
    if (webp) webp.srcset = `assets/products/responsive/${media.responsiveBase}-480.webp?v=${version} 480w, assets/products/responsive/${media.responsiveBase}-900.webp?v=${version} 900w`;
  } else {
    avif?.setAttribute("hidden", "");
    webp?.setAttribute("hidden", "");
    avif?.removeAttribute("srcset");
    webp?.removeAttribute("srcset");
  }
  if (image) {
    image.src = media.image;
    image.alt = media.alt;
    image.loading = state.heroSlide === 0 ? "eager" : "lazy";
    image.fetchPriority = state.heroSlide === 0 ? "high" : "auto";
  }
  if (link) {
    link.href = slide.href || "shop.html";
    link.setAttribute("aria-label", `Browse ${slide.captionStrong || slide.occasion || "this Yodla selection"}`);
  }
  if (caption) caption.innerHTML = `${escapeHtml(slide.caption || "Selected for the moment")}<br><b>${escapeHtml(slide.captionStrong || slide.occasion || "Yodla selection")}</b>`;
  if (stamp) stamp.textContent = slide.stamp || "Selected for the moment";
  if (position) position.textContent = `${String(state.heroSlide + 1).padStart(2, "0")} / ${String(heroSlides.length).padStart(2, "0")}`;
  if (announce && live) live.textContent = heroPositionLabel(state.heroSlide, heroSlides.length, slide);
  if (gsap && !reduceMotion && image) gsap.fromTo(image, { x: state.heroSlide ? 24 : 0, opacity: 0 }, { x: 0, opacity: 1, duration: .42, ease: "power3.out" });
}

function moveHero(delta) {
  renderHeroSlide(nextHeroIndex(state.heroSlide, delta, heroSlides.length));
}

function setPageInert(isInert) {
  $$('[data-site-header], main, [data-site-footer]').forEach((element) => {
    element.inert = isInert;
    if (isInert) element.setAttribute("aria-hidden", "true");
    else element.removeAttribute("aria-hidden");
  });
}

function applyManagedContent() {
  if (content.meta.stale) {
    const header = $("[data-site-header]");
    header?.insertAdjacentHTML("afterend", `<div class="content-notice" role="status"><span>${escapeHtml(content.meta.message)}</span></div>`);
  }
  const citySelect = $("[data-checkout-form] select[name='city']");
  if (citySelect) citySelect.innerHTML = `<option value="">Choose city</option>${LOCATIONS.map((location) => `<option>${escapeHtml(location)}</option>`).join("")}`;
  if (page === "help" && content.site.help) {
    const help = content.site.help;
    $(".page-intro .eyebrow").textContent = help.eyebrow;
    $(".page-intro h1").textContent = help.title;
    $(".page-intro p").textContent = help.description;
    const nav = $(".help-layout nav");
    const list = $(".faq-list");
    if (nav) nav.innerHTML = help.sections.map((section) => `<a href="#${escapeHtml(section.key)}">${escapeHtml(section.title)}</a>`).join("");
    if (list) list.innerHTML = help.sections.map((section, index) => `<article id="${escapeHtml(section.key)}"><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${escapeHtml(section.title)}</h2><details ${index === 0 ? "open" : ""}><summary>${escapeHtml(section.question)}<b>+</b></summary><p>${escapeHtml(section.answer)}</p></details></div></article>`).join("");
  }
  if (page !== "home") return;
  const { hero, occasions, manifesto, journalPromotionId } = content.home;
  const heroCopy = $(".hero-copy");
  if (heroCopy && hero) {
    $(".eyebrow", heroCopy).textContent = hero.eyebrow;
    const titleParts = String(hero.title || "").split("\n");
    $("h1", heroCopy).innerHTML = `${escapeHtml(titleParts[0] || "")}<br><em>${escapeHtml(titleParts.slice(1).join(" ") || "")}</em>`;
    $("p", heroCopy).textContent = hero.description;
    const primary = $(".hero-actions a", heroCopy);
    if (primary) { primary.href = hero.primaryHref || "shop.html"; primary.childNodes[0].textContent = `${hero.primaryLabel || "Browse the shelves"} `; }
  }
  heroSlides = normalizeHeroSlides(content.home);
  renderHeroSlide(0, { announce: false });
  $$(".occasion-card").forEach((card, index) => {
    const item = occasions?.[index];
    if (!item) return;
    card.href = `shop.html?occasion=${encodeURIComponent(item.key)}`;
    $("small", card).textContent = item.eyebrow;
    $("h3", card).textContent = item.title;
    const action = $("b", card);
    if (action) action.childNodes[0].textContent = `${item.action} `;
  });
  if (manifesto) {
    $(".manifesto-copy .eyebrow").textContent = manifesto.eyebrow;
    const heading = $(".manifesto-copy h2");
    const parts = String(manifesto.title || "").split("\n");
    if (heading) heading.innerHTML = `${escapeHtml(parts[0] || "")}<br><em>${escapeHtml(parts.slice(1).join(" ") || "")}</em>`;
    $(".manifesto-copy p").textContent = manifesto.description;
    $$(".manifesto-steps article").forEach((article, index) => {
      const step = manifesto.steps?.[index];
      if (!step) return;
      $("h3", article).textContent = step.title;
      $("p", article).textContent = step.body;
    });
  }
  const promotion = BLOG_POSTS.find((post) => post.id === journalPromotionId || post.slug === journalPromotionId);
  if (promotion) {
    const image = $(".journal-image img");
    if (image) { image.src = promotion.image; image.alt = promotion.imageAlt || promotion.title; }
    $(".journal-strip h2").textContent = promotion.title;
    $(".journal-strip p").textContent = promotion.excerpt;
    const link = $(".journal-strip a");
    if (link) link.href = blogUrl(promotion);
  }
}

function shell() {
  document.body.insertAdjacentHTML("afterbegin", `<a class="skip-link" href="#main-content">Skip to main content</a>`);
  const main = $("main");
  if (main) {
    main.id ||= "main-content";
    main.tabIndex = -1;
  }
  const header = $("[data-site-header]");
  if (header) header.innerHTML = `
    <div class="utility-bar"><button class="text-button" data-open="location">${state.location ? `Delivering to <strong>${state.location}</strong>` : "Set your delivery location"}${icon("arrow-up-right")}</button><p>${escapeHtml(content.site.announcement)}</p></div>
    <div class="site-header__main shell">
      <button class="icon-button menu-button" data-open="menu" aria-label="Open menu"><span></span><span></span></button>
      <a class="wordmark" href="index.html" aria-label="Yodla home">YODLA<span>.</span></a>
      <nav class="desktop-nav" aria-label="Main navigation">${content.site.navigation.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}</nav>
      <div class="header-actions"><button class="icon-button account-button" data-open="account" aria-label="${state.account ? `Open account for ${state.account.name}` : "Create or sign in to an account"}"><span class="account-icon" aria-hidden="true"></span></button><button class="icon-button" data-open="search" aria-label="Search"><span class="search-icon"></span></button><button class="bag-button" data-open="cart" aria-label="Open bag"><span>Bag</span><b data-cart-count>${getCartCount(state.cart)}</b></button></div>
    </div>
    <nav class="category-rail shell" aria-label="Product categories">${CATEGORIES.filter((item) => item !== "All").map((item) => `<a href="shop.html?category=${encodeURIComponent(item)}">${item}</a>`).join("")}<a href="shop.html?occasion=Weekend">Weekend</a></nav>`;

  const footer = $("[data-site-footer]");
  if (footer) footer.innerHTML = `
    <div class="footer-callout shell"><p>${escapeHtml(content.site.footerTagline)}</p><a href="shop.html">Stock the moment ${icon("arrow-up-right")}</a></div>
    <div class="footer-grid shell"><div><a class="wordmark wordmark--footer" href="index.html">YODLA<span>.</span></a><p>${escapeHtml(content.site.footerDescription)}</p></div><div><h2>Browse</h2><a href="shop.html">All drinks</a><a href="shop.html?category=Wines">Wines</a><a href="shop.html?category=Spirits">Spirits</a><a href="shop.html?category=Extras">Extras</a></div><div><h2>Help</h2><a href="help.html#delivery">Delivery</a><a href="help.html#returns">Returns</a><a href="help.html#contact">Contact</a><a href="account.html">Account</a></div><div><h2>Stay in the mix</h2><form class="newsletter" data-newsletter><label class="sr-only" for="newsletter-email">Email address</label><input id="newsletter-email" type="email" placeholder="you@email.com" required><button>Join</button></form><small>Useful pours, no noise.</small></div></div>
    <div class="footer-bottom shell"><span>© 2026 Yodla</span><span>${escapeHtml(content.site.responsibleDrinking)}</span><span>${escapeHtml(content.site.prototypeLabel)}</span></div>`;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="backdrop" data-backdrop hidden></div>
    <aside class="drawer drawer--cart" data-drawer="cart" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="cart-title"><div class="drawer-head"><div><span class="eyebrow">Your selection</span><h2 id="cart-title">Bag <em data-cart-count>${getCartCount(state.cart)}</em></h2></div><button class="close-button" data-close aria-label="Close bag">${icon("close")}</button></div><div class="drawer-body" data-cart-surface="drawer"></div></aside>
    <aside class="drawer" data-drawer="search" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="search-title"><div class="drawer-head"><div><span class="eyebrow">Find your bottle</span><h2 id="search-title">Search</h2></div><button class="close-button" data-close aria-label="Close search">${icon("close")}</button></div><div class="drawer-body"><label class="search-field"><span class="sr-only">Search products</span><input type="search" data-global-search placeholder="Try gin, wine or Hennessy" autocomplete="off">${icon("enter")}</label><div class="search-results" data-search-results><div class="state-card state-card--quiet"><p>Search by drink, style or tasting note.</p></div></div></div></aside>
    <aside class="drawer drawer--small" data-drawer="location" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="location-title"><div class="drawer-head"><div><span class="eyebrow">Delivery</span><h2 id="location-title">Where are we pouring?</h2></div><button class="close-button" data-close aria-label="Close location">${icon("close")}</button></div><div class="drawer-body"><p class="drawer-copy">Availability is checked against your delivery city.</p><div class="location-list">${LOCATIONS.map((location) => `<button data-location="${location}" class="location-option ${state.location === location ? "is-active" : ""}"><span>${location}</span><span>${state.location === location ? "Selected" : "Choose"}</span></button>`).join("")}</div></div></aside>
    <aside class="drawer drawer--small" data-drawer="account" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="account-title"><div class="drawer-head"><div><span class="eyebrow">Your Yodla</span><h2 id="account-title">Account</h2></div><button class="close-button" data-close aria-label="Close account">${icon("close")}</button></div><div class="drawer-body" data-account-view></div></aside>
    <aside class="drawer drawer--small drawer--concierge" data-drawer="concierge" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="concierge-title"><div class="drawer-head concierge-head"><img src="assets/logo.png" alt=""><div><span class="eyebrow">Yodla host</span><h2 id="concierge-title">Ask Yodla</h2></div><button class="close-button" data-close aria-label="Close Ask Yodla">${icon("close")}</button></div><div class="drawer-body concierge-body"><div class="chat-messages" data-chat-messages aria-live="polite"><div class="chat-message chat-message--host"><p>Tell me the occasion, what you enjoy, or your budget. I’ll suggest bottles from this Yodla shelf.</p></div></div><div class="chat-prompts"><button data-chat-prompt="A gift under ₦50,000">Gift under ₦50k</button><button data-chat-prompt="Drinks for a dinner">Dinner picks</button><button data-chat-prompt="Something alcohol-free">Alcohol-free</button></div><form class="chat-form" data-chat-form><label for="chat-message">Your question</label><div><input id="chat-message" name="message" maxlength="500" autocomplete="off" placeholder="What should I bring?"><button aria-label="Send question">${icon("arrow-up")}</button></div><small>Ask about an occasion, budget, bottle style, or how to serve it.</small></form></div></aside>
    <aside class="drawer drawer--small drawer--menu" data-drawer="menu" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Menu"><div class="drawer-head"><span class="wordmark">YODLA<span>.</span></span><button class="close-button" data-close aria-label="Close menu">${icon("close")}</button></div><div class="menu-body"><div class="menu-quick-actions"><button data-open="search">${icon("search")}<span>Search</span></button><button data-open="account">${icon("account")}<span>Account</span></button><button data-open="location">${icon("location")}<span>${state.location || "Delivery"}</span></button></div><nav class="menu-nav" aria-label="Primary navigation"><a href="shop.html"><span>01</span>Shop all</a><a href="shop.html?occasion=Hosting"><span>02</span>Hosting</a><a href="journal.html"><span>03</span>Journal</a><a href="help.html"><span>04</span>Help</a></nav><section class="menu-categories" aria-labelledby="menu-categories-title"><span class="eyebrow" id="menu-categories-title">Browse by category</span><div>${CATEGORIES.filter((item) => item !== "All").map((item) => `<a href="shop.html?category=${encodeURIComponent(item)}">${item}</a>`).join("")}<a href="shop.html?occasion=Weekend">Weekend</a></div></section></div></aside>
    <button class="floating-concierge" data-open="concierge" aria-label="Ask Yodla for a drink recommendation"><img src="assets/logo.png" alt=""><span>Ask Yodla</span></button>
    <button class="floating-bag" data-open="cart" aria-label="Open bag">
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="floating-bag__handle" d="M21 25v-5c0-7 4.5-11 11-11s11 4 11 11v5"/><path class="floating-bag__body" d="M13 24h38l-3 31H16z"/><path class="floating-bag__fold" d="M13 24c8 4 30 4 38 0"/></svg>
      <b data-cart-count>${getCartCount(state.cart)}</b><span class="sr-only">items in bag</span>
    </button>
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`);
}

function productCard(product, index = 0) {
  const availability = getAvailability(product, state.location);
  return `<article class="product-card reveal" style="--index:${index}">
    <a class="product-card__media media--${product.imageMode}" href="${productUrl(product.id)}">
      <span class="product-card__tag">${product.tag}</span>${productPicture(product)}<span class="product-card__view">View bottle ${icon("arrow-up-right")}</span>
    </a>
    <div class="product-card__meta"><div><p>${product.brand} · ${product.subcategory}</p><h3><a href="${productUrl(product.id)}">${product.name}</a></h3><small class="availability availability--${availability}">${availabilityCopy[availability]}</small></div><div class="product-card__buy"><strong>${formatMoney(product.price)}</strong><button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag"><span>+</span></button></div></div>
  </article>`;
}

function accountMarkup() {
  if (state.account) return `<div class="account-welcome"><span class="account-monogram">${escapeHtml(state.account.name.slice(0, 1).toUpperCase())}</span><span class="eyebrow">Signed in on this device</span><h2>Hello, ${escapeHtml(state.account.name.split(" ")[0])}.</h2><p>${escapeHtml(state.account.email)}</p><p class="prototype-note">Your prototype account and session are stored only in this browser. They are not synced to a server.</p><a class="button button--dark button--wide" href="shop.html">Browse the shelves</a><button class="text-link account-signout" data-signout>Sign out on this device</button></div>`;
  const signup = state.accountMode === "signup";
  return `<div class="auth-switch" role="tablist" aria-label="Account options"><button role="tab" aria-selected="${signup}" class="${signup ? "is-active" : ""}" data-auth-mode="signup">Create account</button><button role="tab" aria-selected="${!signup}" class="${!signup ? "is-active" : ""}" data-auth-mode="signin">Sign in</button></div>
    <form class="account-form" data-account-form="${signup ? "signup" : "signin"}" novalidate>
      <div><span class="eyebrow">${signup ? "A quicker next visit" : "Welcome back"}</span><h2>${signup ? "Make this shelf yours." : "Return to your shelf."}</h2><p>${signup ? "Save contact details for this prototype checkout." : "Use an account previously created in this browser."}</p></div>
      ${signup ? `<label>Full name<input name="name" autocomplete="name" required minlength="2" placeholder="How should we address you?"></label>` : ""}
      <label>Email<input type="email" name="email" autocomplete="email" required placeholder="you@email.com"></label>
      ${signup ? `<label>Phone <small>Optional</small><input type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="0800 000 0000"></label>` : ""}
      <label>Password<input type="password" name="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8" placeholder="At least 8 characters"></label>
      <div class="form-status" data-account-status aria-live="polite"></div>
      <button class="button button--ember button--wide" type="submit">${signup ? "Create prototype account" : "Sign in"} ${icon("arrow-up-right")}</button>
      <p class="prototype-note"><strong>Prototype privacy note:</strong> this account exists only on this device. Do not use a real or reused password.</p>
    </form>`;
}

function renderAccount() {
  $$('[data-account-view]').forEach((target) => { target.innerHTML = accountMarkup(); });
  $$(".account-button").forEach((button) => button.setAttribute("aria-label", state.account ? `Open account for ${state.account.name}` : "Create or sign in to an account"));
  prefillCheckout();
}

function prefillCheckout() {
  const form = $("[data-checkout-form]");
  if (!form || !state.account) return;
  const names = state.account.name.trim().split(/\s+/);
  const values = { email: state.account.email, phone: state.account.phone, firstName: names[0], lastName: names.slice(1).join(" ") };
  Object.entries(values).forEach(([name, value]) => { if (value && !form.elements[name]?.value) form.elements[name].value = value; });
}

async function submitAccount(form) {
  const status = $("[data-account-status]", form);
  const button = $("button[type='submit']", form);
  if (!form.reportValidity()) return;
  button.disabled = true;
  status.innerHTML = `<p class="inline-status"><span class="spinner"></span>Checking your details…</p>`;
  try {
    const values = Object.fromEntries(new FormData(form));
    state.account = form.dataset.accountForm === "signup" ? await createAccount(values) : await signIn(values);
    renderAccount();
    toast(form.dataset.accountForm === "signup" ? "Your prototype account is ready." : "Welcome back to Yodla.");
  } catch (error) {
    button.disabled = false;
    status.innerHTML = `<p class="inline-status inline-status--error">${error.message || "We could not complete that request. Try again."}</p>`;
    if (error.field) form.elements[error.field]?.focus();
  }
}

function appendChatMessage(text, role, productIds = []) {
  const target = $("[data-chat-messages]");
  if (!target) return null;
  const message = document.createElement("div");
  message.className = `chat-message chat-message--${role}`;
  const copy = document.createElement("p");
  copy.textContent = text;
  message.append(copy);
  const products = productIds.map(getProduct).filter(Boolean);
  if (products.length) {
    const links = document.createElement("div");
    links.className = "chat-products";
    products.forEach((product) => {
      const link = document.createElement("a");
      link.href = productUrl(product.id);
      link.textContent = `${product.name} · ${formatMoney(product.price)}`;
      links.append(link);
    });
    message.append(links);
  }
  target.append(message);
  target.scrollTop = target.scrollHeight;
  return message;
}

async function submitChat(form) {
  const input = form.elements.message;
  const message = input.value.trim();
  if (!message) return input.focus();
  appendChatMessage(message, "user");
  input.value = "";
  const loading = appendChatMessage("Looking across the Yodla shelf…", "loading");
  form.querySelector("button").disabled = true;
  try {
    const response = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The Yodla host could not answer that.");
    loading?.remove();
    appendChatMessage(payload.reply, "host", payload.productIds);
  } catch (error) {
    loading?.remove();
    appendChatMessage(`${error.message} Please try again.`, "error");
  } finally {
    form.querySelector("button").disabled = false;
    input.focus();
  }
}

function cartMarkup() {
  if (!state.cart.length) return `<div class="cart-empty state-card"><span class="state-icon">${icon("bag")}</span><h3>Your bag has room.</h3><p>Start with a bottle for dinner, a gift, or the weekend.</p><a class="button button--dark" href="shop.html">Explore the shelves</a></div>`;
  return `<div class="cart-lines">${state.cart.map((line) => {
    const product = getProduct(line.id);
    return `<article class="cart-line" data-cart-line="${line.id}"><a href="${productUrl(line.id)}" class="cart-line__image">${productPicture(product, { decorative: true, sizes: "120px" })}</a><div class="cart-line__copy"><div><p>${product.brand} · ${product.volume}</p><h3>${product.name}</h3></div><div class="cart-line__bottom"><div class="quantity"><button data-quantity="${line.id}" data-change="-1" aria-label="Reduce ${product.name}">${icon("minus")}</button><span aria-live="polite">${line.quantity}</span><button data-quantity="${line.id}" data-change="1" aria-label="Increase ${product.name}">+</button></div><strong>${formatMoney(product.price * line.quantity)}</strong></div><button class="remove-link" data-remove="${line.id}">Remove</button></div></article>`;
  }).join("")}</div><div class="cart-summary"><div><span>Subtotal</span><strong>${formatMoney(getCartTotal(state.cart))}</strong></div><p>Delivery is calculated after your address.</p><a class="button button--ember button--wide" href="checkout.html">Continue to checkout ${icon("arrow-up-right")}</a></div>`;
}

function renderCart() {
  $$('[data-cart-count]').forEach((node) => { node.textContent = getCartCount(state.cart); });
  $$('[data-cart-surface]').forEach((node) => { node.innerHTML = cartMarkup(); });
  writeCart(state.cart);
  renderCheckoutSummary();
}

function toast(message, tone = "success") {
  const region = $(".toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast toast--${tone}`;
  item.innerHTML = `<span>${icon(tone === "success" ? "check" : "alert")}</span><p>${message}</p>`;
  region.append(item);
  if (gsap && !reduceMotion) gsap.fromTo(item, { y: 18, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .35, ease: "back.out(1.6)" });
  window.setTimeout(() => {
    if (gsap && !reduceMotion) gsap.to(item, { y: -8, opacity: 0, duration: .25, onComplete: () => item.remove() });
    else item.remove();
  }, 2600);
}

function openDrawer(name) {
  if (state.drawer) {
    const previous = $(`[data-drawer="${state.drawer}"]`);
    if (gsap) gsap.killTweensOf(previous);
    previous?.classList.remove("is-open");
    previous?.setAttribute("aria-hidden", "true");
    if (previous) previous.style.transform = "";
    state.drawer = null;
  }
  const drawer = $(`[data-drawer="${name}"]`);
  const backdrop = $("[data-backdrop]");
  if (!drawer || !backdrop) return;
  state.previousFocus = document.activeElement;
  state.drawer = name;
  backdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("is-open");
  setPageInert(true);
  document.body.classList.add("drawer-open");
  if (gsap && !reduceMotion) {
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: .25 });
    gsap.fromTo(drawer, { xPercent: 104 }, { xPercent: 0, duration: .56, ease: "power4.out" });
    gsap.fromTo($$(".drawer-head, .drawer-body > *", drawer), { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: .045, delay: .14, duration: .35 });
  } else drawer.style.transform = "translateX(0)";
  window.setTimeout(() => $(name === "search" ? "[data-global-search]" : "button, a, input", drawer)?.focus(), 80);
}

function closeDrawer(restoreFocus = true) {
  if (!state.drawer) return;
  const drawer = $(`[data-drawer="${state.drawer}"]`);
  const backdrop = $("[data-backdrop]");
  const complete = () => {
    drawer?.classList.remove("is-open");
    drawer?.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.hidden = true;
    setPageInert(false);
    document.body.classList.remove("drawer-open");
    if (restoreFocus) state.previousFocus?.focus?.();
    if (state.drawer === drawer?.dataset.drawer) state.drawer = null;
  };
  if (gsap && !reduceMotion) gsap.to(drawer, { xPercent: 104, duration: .38, ease: "power3.in", onComplete: complete });
  else complete();
}

function flyToBag(button, product) {
  const source = button.closest(".product-card, .product-detail")?.querySelector("img");
  const target = $(".floating-bag");
  if (!source || !target || reduceMotion || !gsap) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const clone = source.cloneNode();
  Object.assign(clone.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, objectFit: "contain", zIndex: 120, pointerEvents: "none", borderRadius: "16px" });
  document.body.append(clone);
  gsap.timeline({ onComplete: () => clone.remove() })
    .to(clone, { left: to.left + to.width / 2 - 25, top: to.top + to.height / 2 - 25, width: 50, height: 50, rotation: 8, scale: .7, duration: .72, ease: "power3.inOut" })
    .to(clone, { opacity: 0, scale: .15, duration: .16 }, "-=.08")
    .fromTo(target, { scale: 1, rotate: 0 }, { scale: 1.14, rotate: -5, duration: .14, yoyo: true, repeat: 1, ease: "power2.out" }, "-=.1")
    .fromTo($(".floating-bag__handle", target), { y: 0 }, { y: -4, duration: .16, yoyo: true, repeat: 1, ease: "power2.out" }, "<");
}

function addToCart(productId, button) {
  const product = getProduct(productId);
  if (!product) return;
  if (getAvailability(product, state.location) === "unavailable") return toast(`${product.name} is not available in ${state.location}.`, "error");
  state.cart = addCartItem(state.cart, productId);
  renderCart();
  flyToBag(button, product);
  toast(`${product.name} is in your bag.`);
}

function adjustQuantity(productId, change, button) {
  const current = state.cart.find((line) => line.id === productId);
  if (!current) return;
  state.cart = setCartQuantity(state.cart, productId, current.quantity + change);
  renderCart();
  const line = $(`[data-cart-line="${productId}"]`);
  if (line && gsap && !reduceMotion) gsap.fromTo(line, { backgroundColor: "rgba(239, 93, 44, .16)" }, { backgroundColor: "transparent", duration: .65 });
  button?.closest(".quantity")?.querySelector("span")?.animate?.([{ transform: "translateY(-3px)" }, { transform: "translateY(0)" }], { duration: 180 });
}

function removeFromCart(productId, button) {
  const line = button.closest("[data-cart-line]");
  const surfaceName = button.closest("[data-cart-surface]")?.dataset.cartSurface;
  const finish = () => {
    state.cart = removeCartItem(state.cart, productId);
    renderCart();
    toast("Removed from your bag.");
    const surface = $(`[data-cart-surface="${surfaceName}"]`);
    $("[data-quantity], .cart-summary a, .cart-empty a", surface)?.focus();
  };
  if (line && gsap && !reduceMotion) gsap.to(line, { x: 45, opacity: 0, height: 0, marginBottom: 0, duration: .38, ease: "power2.in", onComplete: finish });
  else finish();
}

function renderSearch(query) {
  const target = $("[data-search-results]");
  if (!target) return;
  const results = filterProducts({ query }).slice(0, 6);
  if (!query.trim()) return target.innerHTML = `<div class="state-card state-card--quiet"><p>Search by drink, style or tasting note.</p></div>`;
  if (!results.length) return target.innerHTML = `<div class="state-card"><span class="state-icon">?</span><h3>No matching bottles.</h3><p>Try a broader word like wine, gin or citrus.</p></div>`;
  target.innerHTML = results.map((product) => `<a class="search-result" href="${productUrl(product.id)}">${productPicture(product, { decorative: true, sizes: "70px" })}<span><small>${product.category} · ${product.volume}</small><strong>${product.name}</strong><em>${formatMoney(product.price)}</em></span>${icon("arrow-up-right")}</a>`).join("");
}

function skeletons(target, amount = 4) {
  target.innerHTML = Array.from({ length: amount }, () => `<div class="product-skeleton"><span></span><i></i><i></i><i></i></div>`).join("");
}

function renderFeatured() {
  const grid = $("[data-featured-grid]");
  if (!grid) return;
  skeletons(grid);
  const featured = content.home.featuredProductIds.map(getProduct).filter(Boolean);
  window.setTimeout(() => { grid.innerHTML = (featured.length ? featured : PRODUCTS.slice(0, 4)).map(productCard).join(""); animateReveals(); }, 500);
}

function blogCard(post, featured = false) {
  const imageProduct = { id: post.imageId, name: post.title, image: post.image, imageAlt: post.imageAlt };
  return `<article class="editorial-card ${featured ? "editorial-card--lead" : ""} reveal">
    <a class="editorial-card__image" href="${blogUrl(post)}">${productPicture(imageProduct, { sizes: featured ? "(max-width: 767px) 100vw, 65vw" : "(max-width: 767px) 100vw, 35vw" })}</a>
    <div><span>${post.category} · ${post.readTime}</span><h2><a href="${blogUrl(post)}">${post.title}</a></h2><p>${post.excerpt}</p><a href="${blogUrl(post)}">Read the story ${icon("arrow-up-right")}</a></div>
  </article>`;
}

function renderJournal() {
  const target = $("[data-blog-grid]");
  if (!target) return;
  target.innerHTML = BLOG_POSTS.map((post, index) => blogCard(post, index === 0)).join("");
}

function renderBlogPage() {
  const target = $("[data-blog-detail]");
  if (!target) return;
  const requestedSlug = document.body.dataset.contentSlug || decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
  const post = BLOG_POSTS.find((item) => item.slug === requestedSlug) || getBlogPost(new URLSearchParams(location.search).get("id")) || BLOG_POSTS[0];
  const imageProduct = { id: post.imageId, name: post.title, image: post.image };
  document.title = `${post.title} — Yodla Journal`;
  target.innerHTML = `<header class="blog-hero"><nav class="breadcrumbs"><a href="journal.html">Journal</a><span>/</span><span>${post.category}</span></nav><span class="eyebrow">${post.category} · ${post.readTime}</span><h1>${post.title}</h1><p>${post.excerpt}</p></header><figure class="blog-hero__image">${productPicture(imageProduct, { eager: true, sizes: "100vw" })}</figure><div class="blog-body"><aside><span>Yodla notes</span><p>Useful ideas for better bottles, easier hosting and more generous tables.</p><a href="shop.html">Shop the shelves ${icon("arrow-up-right")}</a></aside><article><p class="blog-intro">${post.introduction}</p>${post.sections.map((section) => `<section><h2>${section.heading}</h2><p>${section.body}</p></section>`).join("")}<blockquote>${post.pullQuote}</blockquote><div class="blog-end"><span>Drink thoughtfully. Host generously.</span><a href="journal.html">Back to the journal</a></div></article></div>`;
  const related = $("[data-blog-related]");
  if (related) related.innerHTML = BLOG_POSTS.filter((item) => item.id !== post.id).map(blogCard).join("");
}

function readShopUrl() {
  const params = new URLSearchParams(location.search);
  const category = params.get("category") || "All";
  state.filters.category = CATEGORIES.includes(category) ? category : "All";
  state.filters.occasion = params.get("occasion") || "";
}

function shopFilters() {
  const price = { all: [0, Infinity], under25: [0, 25000], "25to50": [25000, 50000], over50: [50000, Infinity] }[state.filters.price];
  return { ...state.filters, minimum: price[0], maximum: price[1], location: state.location };
}

function renderShop() {
  const grid = $("[data-catalogue-grid]");
  if (!grid) return;
  const categoryPanel = $(".filter-panel > div:first-child");
  if (categoryPanel) categoryPanel.innerHTML = `<h2>Drink</h2>${CATEGORIES.map((category) => `<button data-filter-category="${escapeHtml(category)}" class="${state.filters.category === category ? "is-active" : ""}"><span>${escapeHtml(category)}</span></button>`).join("")}`;
  const products = sortProducts(filterProducts(shopFilters()), state.filters.sort);
  $$('[data-filter-category]').forEach((button) => button.classList.toggle("is-active", button.dataset.filterCategory === state.filters.category));
  const count = $("[data-result-count]");
  if (count) count.textContent = `${products.length} ${products.length === 1 ? "bottle" : "bottles"}`;
  if (!products.length) grid.innerHTML = `<div class="state-card catalogue-empty"><span class="state-icon">${icon("bag")}</span><h3>Nothing on this shelf yet.</h3><p>Clear a filter or change your delivery city to see more.</p><button class="button button--dark" data-clear-filters>Clear filters</button></div>`;
  else grid.innerHTML = products.map(productCard).join("");
  animateReveals();
}

function renderProductPage() {
  const target = $("[data-product-detail]");
  if (!target) return;
  const requestedSlug = document.body.dataset.contentSlug || decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
  const product = PRODUCTS.find((item) => item.slug === requestedSlug) || getProduct(new URLSearchParams(location.search).get("id")) || PRODUCTS[0];
  const availability = getAvailability(product, state.location);
  target.innerHTML = `<div class="product-detail__media media--${product.imageMode}"><span class="floating-note">${product.tag}</span>${productPicture(product, { eager: true, sizes: "(max-width: 1023px) 100vw, 55vw" })}<span class="media-index">Y / ${String(PRODUCTS.indexOf(product) + 1).padStart(2, "0")}</span></div><div class="product-detail__copy"><nav class="breadcrumbs"><a href="shop.html">Shop</a><span>/</span><a href="shop.html?category=${encodeURIComponent(product.category)}">${product.category}</a></nav><span class="eyebrow">${product.brand} · ${product.subcategory}</span><h1>${product.name}</h1><p class="product-lede">${product.description}</p><div class="product-facts"><span>${product.volume}</span><span>${product.abv} ABV</span><span>${product.prototype ? "Yodla concept" : "Original brand"}</span></div><div class="product-price"><strong>${formatMoney(product.price)}</strong>${product.compareAtPrice ? `<del>${formatMoney(product.compareAtPrice)}</del>` : ""}</div><div class="availability-panel availability--${availability}"><i></i><span><strong>${availabilityCopy[availability]}</strong><small>${state.location ? `Availability checked for ${state.location}` : "Set a city for live availability"}</small></span><button data-open="location">${state.location ? "Change" : "Choose"}</button></div><button class="button button--ember button--wide button--large product-primary-action" data-add="${product.id}" ${availability === "unavailable" ? "disabled" : ""}>Add to bag <span>+</span></button><div class="detail-sections"><details open><summary>Tasting notes <span>+</span></summary><p>${product.notes.join(" · ")}</p></details><details><summary>How to serve <span>+</span></summary><p>${product.serve}</p></details><details><summary>Delivery & returns <span>+</span></summary><p>Delivery timing is confirmed at checkout. Unopened products can be returned under our help policy.</p></details></div></div><div class="mobile-purchase-bar"><span><small>${product.name}</small><strong>${formatMoney(product.price)}</strong></span><button class="button button--ember" data-add="${product.id}" ${availability === "unavailable" ? "disabled" : ""}>${availability === "unavailable" ? "Unavailable" : "Add to bag"}<b>+</b></button></div>`;
  const related = $("[data-related-grid]");
  if (related) related.innerHTML = PRODUCTS.filter((item) => item.id !== product.id && (item.category === product.category || item.occasions.some((occasion) => product.occasions.includes(occasion)))).slice(0, 3).map(productCard).join("");
}

function renderCheckoutSummary() {
  const target = $("[data-checkout-summary]");
  if (!target) return;
  if (!state.cart.length) return target.innerHTML = `<div class="state-card"><h3>Your bag is empty.</h3><p>Add a bottle before checking out.</p><a class="button button--dark" href="shop.html">Shop drinks</a></div>`;
  target.innerHTML = `${state.cart.map((line) => { const product = getProduct(line.id); return `<div class="checkout-line">${productPicture(product, { decorative: true, sizes: "58px" })}<span><strong>${product.name}</strong><small>Qty ${line.quantity}</small></span><b>${formatMoney(product.price * line.quantity)}</b></div>`; }).join("")}<div class="checkout-total"><span>Total</span><strong>${formatMoney(getCartTotal(state.cart))}</strong></div>`;
}

function configureCheckoutSummary() {
  const panel = $("[data-order-panel]");
  if (!panel) return;
  const narrow = window.matchMedia("(max-width: 860px)");
  const apply = () => {
    if (narrow.matches) panel.removeAttribute("open");
    else panel.setAttribute("open", "");
  };
  apply();
  narrow.addEventListener?.("change", apply);
}

function configureMobileDisclosures() {
  const narrow = window.matchMedia("(max-width: 767px)");
  const apply = () => {
    $$(".detail-sections details").forEach((details, index) => {
      if (narrow.matches) details.removeAttribute("open");
      else if (index === 0) details.setAttribute("open", "");
    });
  };
  apply();
  narrow.addEventListener?.("change", apply);
}

function submitCheckout(form) {
  const button = $("button[type=submit]", form);
  const status = $("[data-checkout-status]");
  if (!state.cart.length) return toast("Your bag is empty.", "error");
  if (!form.reportValidity()) return;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Confirming order`;
  status.innerHTML = `<div class="inline-status inline-status--loading"><span class="spinner"></span><p>Checking your details and reserving the bottles…</p></div>`;
  window.setTimeout(() => {
    if (new URLSearchParams(location.search).get("state") === "failure") {
      button.disabled = false;
      button.innerHTML = `Place prototype order ${icon("arrow-up-right")}`;
      status.innerHTML = `<div class="inline-status inline-status--error"><b>!</b><p><strong>We could not confirm that order.</strong><br>Nothing was charged. Check the highlighted details and try again.</p></div>`;
      return;
    }
    state.cart = [];
    writeCart(state.cart);
    renderCart();
    $("[data-checkout-view]").innerHTML = `<div class="success-state"><div class="success-mark">${icon("check")}</div><span class="eyebrow">Order received</span><h1>The good part is on its way.</h1><p>This is a working prototype confirmation. A real checkout would now send payment and delivery details.</p><a class="button button--dark" href="shop.html">Keep browsing</a></div>`;
    if (gsap && !reduceMotion) gsap.from(".success-state > *", { y: 20, opacity: 0, stagger: .09, duration: .5, ease: "power3.out" });
  }, 1300);
}

function animateReveals() {
  if (!gsap || reduceMotion) return;
  $$(".reveal:not([data-animated])").forEach((element) => {
    element.dataset.animated = "true";
    if (window.ScrollTrigger) gsap.from(element, { scrollTrigger: { trigger: element, start: "top 90%", once: true }, y: 28, opacity: 0, duration: .65, delay: Number(element.style.getPropertyValue("--index") || 0) * .035, ease: "power3.out" });
  });
}

function startPageMotion() {
  if (!gsap || reduceMotion) return;
  gsap.from(".site-header__main > *", { y: -12, opacity: 0, stagger: .05, duration: .45, ease: "power2.out" });
  gsap.from(".hero-copy > *, .page-intro > *", { y: 30, opacity: 0, stagger: .075, duration: .75, ease: "power3.out" });
  const bottle = $(".hero-bottle");
  if (bottle) gsap.fromTo(bottle, { y: 32, rotate: -4, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1.05, ease: "power4.out" });
  animateReveals();
}

function handleNewsletter(form) {
  const input = $("input", form);
  if (!input.checkValidity()) return;
  toast("You're on the Yodla list.");
  input.value = "";
}

document.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open]");
  const add = event.target.closest("[data-add]");
  const quantity = event.target.closest("[data-quantity]");
  const remove = event.target.closest("[data-remove]");
  const locationButton = event.target.closest("[data-location]");
  const category = event.target.closest("[data-filter-category]");
  const authMode = event.target.closest("[data-auth-mode]");
  const chatPrompt = event.target.closest("[data-chat-prompt]");
  const heroDirection = event.target.closest("[data-hero-direction]");
  if (heroSwipeHandled && event.target.closest("[data-hero-link]")) {
    event.preventDefault();
    heroSwipeHandled = false;
    return;
  }
  if (open) openDrawer(open.dataset.open);
  if (event.target.closest("[data-close], [data-backdrop]")) closeDrawer();
  if (add) addToCart(add.dataset.add, add);
  if (quantity) adjustQuantity(quantity.dataset.quantity, Number(quantity.dataset.change), quantity);
  if (remove) removeFromCart(remove.dataset.remove, remove);
  if (locationButton) {
    state.location = locationButton.dataset.location;
    localStorage.setItem(LOCATION_STORAGE_KEY, state.location);
    closeDrawer();
    shellLocationRefresh();
    renderShop();
    renderProductPage();
    renderCart();
    toast(`Delivery set to ${state.location}.`);
  }
  if (category) { state.filters.category = category.dataset.filterCategory; renderShop(); }
  if (authMode) { state.accountMode = authMode.dataset.authMode; renderAccount(); }
  if (event.target.closest("[data-signout]")) {
    signOut();
    state.account = null;
    state.accountMode = "signin";
    renderAccount();
    toast("Signed out on this device.");
  }
  if (chatPrompt) {
    const form = $("[data-chat-form]");
    if (form) { form.elements.message.value = chatPrompt.dataset.chatPrompt; submitChat(form); }
  }
  if (heroDirection) moveHero(Number(heroDirection.dataset.heroDirection));
  if (event.target.closest("[data-clear-filters]")) {
    state.filters = { category: "All", occasion: "", query: "", price: "all", sort: "featured" };
    const query = $("[data-shop-search]"); if (query) query.value = "";
    renderShop();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-global-search]")) renderSearch(event.target.value);
  if (event.target.matches("[data-shop-search]")) { state.filters.query = event.target.value; renderShop(); }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-shop-sort]")) { state.filters.sort = event.target.value; renderShop(); }
  if (event.target.matches("[data-price-filter]")) { state.filters.price = event.target.value; renderShop(); }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-newsletter]")) { event.preventDefault(); handleNewsletter(event.target); }
  if (event.target.matches("[data-checkout-form]")) { event.preventDefault(); submitCheckout(event.target); }
  if (event.target.matches("[data-account-form]")) { event.preventDefault(); await submitAccount(event.target); }
  if (event.target.matches("[data-chat-form]")) { event.preventDefault(); await submitChat(event.target); }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
  if (event.target.closest?.("[data-hero-carousel]") && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    moveHero(event.key === "ArrowLeft" ? -1 : 1);
  }
  if (event.key === "Tab" && state.drawer) {
    const drawer = $(`[data-drawer="${state.drawer}"]`);
    const focusable = $$("a, button, input, select, [tabindex]:not([tabindex='-1'])", drawer).filter((item) => !item.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("[data-hero-carousel]")) return;
  heroSwipeHandled = false;
  heroPointerStart = { x: event.clientX, y: event.clientY };
});

document.addEventListener("pointerup", (event) => {
  if (!heroPointerStart || !event.target.closest("[data-hero-carousel]")) return;
  const deltaX = event.clientX - heroPointerStart.x;
  const deltaY = event.clientY - heroPointerStart.y;
  heroPointerStart = null;
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  heroSwipeHandled = true;
  moveHero(deltaX < 0 ? 1 : -1);
});

document.addEventListener("pointercancel", () => {
  heroPointerStart = null;
  heroSwipeHandled = false;
});

function shellLocationRefresh() {
  const button = $(".utility-bar [data-open='location']");
  if (button) button.innerHTML = `Delivering to <strong>${state.location}</strong>${icon("arrow-up-right")}`;
}

async function boot() {
  await loadPublishedContent();
  state.cart = readCart();
  shell();
  applyManagedContent();
  if (page === "shop") readShopUrl();
  renderFeatured();
  renderJournal();
  renderBlogPage();
  renderShop();
  renderProductPage();
  renderCart();
  renderCheckoutSummary();
  renderAccount();
  configureCheckoutSummary();
  configureMobileDisclosures();
  window.requestAnimationFrame(startPageMotion);
}

boot();
