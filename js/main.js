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
import { accountFromUser, authorizedFetch, signOutUser, waitForAuth } from "./firebase-auth.js";
import { content, loadPublishedContent } from "./content-store.js";
import { heroPositionLabel, nextHeroIndex, normalizeHeroSlides } from "./hero-carousel.js";
import { enhanceCustomSelects } from "./custom-select.js";
import { NIGERIAN_STATES } from "./states.js";
import {
  readGiftDraft,
  writeGiftDraft,
  clearGiftDraft,
  giftDraftError,
  GIFT_SLIDES,
} from "./gifting.js";
import { initGifting, giftReviewHtml, renderGift as renderGiftUi } from "./gifting-ui.js";

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

function renderHeroSlide(index, { announce = true, animate = true } = {}) {
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
  const applyMedia = () => {
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
    if (stamp) stamp.innerHTML = escapeHtml(slide.stamp || "Selected for the moment").replace(/\n/g, "<br>");
    if (position) position.textContent = `${String(state.heroSlide + 1).padStart(2, "0")} / ${String(heroSlides.length).padStart(2, "0")}`;
    if (announce && live) live.textContent = heroPositionLabel(state.heroSlide, heroSlides.length, slide);
  };
  const movingParts = $$(".hero-orbit, .hero-slide-link, .hero-caption, .hero-stamp", stage);
  if (animate && gsap && !reduceMotion && movingParts.length) {
    gsap.killTweensOf(movingParts);
    gsap.to(movingParts, {
      opacity: 0,
      x: -28,
      duration: .28,
      ease: "power2.in",
      onComplete: () => {
        applyMedia();
        gsap.fromTo(movingParts, { opacity: 0, x: 36 }, {
          opacity: 1,
          x: 0,
          duration: .55,
          stagger: .03,
          ease: "power3.out",
          onComplete: floatHeroBottle,
        });
      },
    });
  } else {
    applyMedia();
    floatHeroBottle();
  }
}

function moveHero(delta) {
  renderHeroSlide(nextHeroIndex(state.heroSlide, delta, heroSlides.length));
  restartHeroAutoplay();
}

let heroAutoplayTimer = null;

function stopHeroAutoplay() {
  if (heroAutoplayTimer) {
    window.clearInterval(heroAutoplayTimer);
    heroAutoplayTimer = null;
  }
}

function restartHeroAutoplay() {
  stopHeroAutoplay();
  const stage = $("[data-hero-carousel]");
  if (!stage || heroSlides.length < 2 || reduceMotion) return;
  heroAutoplayTimer = window.setInterval(() => moveHero(1), 5200);
}

function startHeroAutoplay() {
  const stage = $("[data-hero-carousel]");
  if (!stage || heroSlides.length < 2) return;
  restartHeroAutoplay();
  stage.addEventListener("pointerenter", stopHeroAutoplay);
  stage.addEventListener("pointerleave", restartHeroAutoplay);
  stage.addEventListener("focusin", stopHeroAutoplay);
  stage.addEventListener("focusout", (event) => {
    if (!stage.contains(event.relatedTarget)) restartHeroAutoplay();
  });
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
  const citySelect = $("[data-checkout-form] select[name='city'], [data-checkout-form] select[name='state']");
  if (citySelect) citySelect.innerHTML = `<option value="">Choose state</option>${NIGERIAN_STATES.map((location) => `<option>${escapeHtml(location)}</option>`).join("")}`;
  if (citySelect) enhanceCustomSelects(citySelect.closest("form") || document);
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
  content.site.navigation = [
    { label: "Shop all", href: "shop.html" },
    { label: "Gifting", href: "gifting.html" },
    { label: "Journal", href: "journal.html" },
  ];
  if (Array.isArray(content.home?.occasions)) {
    content.home.occasions = content.home.occasions.map((item) => (
      String(item.key).toLowerCase() === "hosting"
        ? { ...item, key: "Gift", eyebrow: item.eyebrow || "Arrive properly", title: item.title?.includes("coming") ? "Gifting that lands" : item.title, action: item.action || "Choose a gift" }
        : item
    ));
  }
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
    const isGift = String(item.key).toLowerCase() === "gift";
    card.href = isGift ? "gifting.html" : `shop.html?occasion=${encodeURIComponent(item.key)}`;
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
      <div class="header-actions">
        <span data-account-slot>${accountControlMarkup()}</span>
        <label class="header-search"><span class="sr-only">Search products</span><span class="search-icon" aria-hidden="true"></span><input type="search" data-header-search data-global-search placeholder="Search bottles" autocomplete="off"><div class="header-results" data-search-results hidden></div></label>
        <button class="icon-button header-search-toggle" data-open="search" aria-label="Search"><span class="search-icon"></span></button>
      </div>
    </div>
    <nav class="category-rail shell" aria-label="Product categories">${CATEGORIES.filter((item) => item !== "All").map((item) => `<a href="shop.html?category=${encodeURIComponent(item)}">${item}</a>`).join("")}<a href="shop.html?occasion=Weekend">Weekend</a></nav>`;

  const supportEmail = content.site.supportEmail || "hello@yodla.ng";
  const instagram = (content.site.socialLinks || []).find((link) => /instagram/i.test(link.label || link.url || ""))?.url
    || "https://www.instagram.com/yodla.ng/";
  const footer = $("[data-site-footer]");
  if (footer) footer.innerHTML = `
    <div class="footer-callout shell"><p>${escapeHtml(content.site.footerTagline)}</p><a href="shop.html">Stock the moment ${icon("arrow-up-right")}</a></div>
    <div class="footer-grid shell"><div><a class="wordmark wordmark--footer" href="index.html">YODLA<span>.</span></a><p>${escapeHtml(content.site.footerDescription)}</p></div><div><h2>Browse</h2><a href="shop.html">All drinks</a><a href="shop.html?category=Wines">Wines</a><a href="shop.html?category=Spirits">Spirits</a><a href="shop.html?category=Extras">Extras</a></div><div><h2>Help</h2><a href="help.html#delivery">Delivery</a><a href="help.html#returns">Returns</a><a href="contact.html">Contact</a><a href="${escapeHtml(instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a><a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a><a href="account.html">Account</a></div><div><h2>Stay in the mix</h2><form class="newsletter" data-newsletter><label class="sr-only" for="newsletter-email">Email address</label><input id="newsletter-email" name="email" type="email" placeholder="you@email.com" required><button type="submit">Join</button></form><small data-newsletter-status>Useful pours, no noise.</small></div></div>
    <div class="footer-bottom shell"><span>© 2026 Yodla</span><span>${escapeHtml(content.site.responsibleDrinking)}</span><span>${escapeHtml(content.site.prototypeLabel)}</span></div>`;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="backdrop" data-backdrop hidden></div>
    <aside class="drawer drawer--cart" data-drawer="cart" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="cart-title"><div class="drawer-head"><div><span class="eyebrow">Your selection</span><h2 id="cart-title">Bag <em data-cart-count>${getCartCount(state.cart)}</em></h2></div><button class="close-button" data-close aria-label="Close bag">${icon("close")}</button></div><div class="drawer-body" data-cart-surface="drawer"></div></aside>
    <aside class="drawer" data-drawer="search" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="search-title"><div class="drawer-head"><div><span class="eyebrow">Find your bottle</span><h2 id="search-title">Search</h2></div><button class="close-button" data-close aria-label="Close search">${icon("close")}</button></div><div class="drawer-body"><label class="search-field"><span class="sr-only">Search products</span><input type="search" data-global-search placeholder="Try gin, wine or Hennessy" autocomplete="off">${icon("enter")}</label><div class="search-results" data-search-results><div class="state-card state-card--quiet"><p>Search by drink, style or tasting note.</p></div></div></div></aside>
    <aside class="drawer drawer--small" data-drawer="location" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="location-title"><div class="drawer-head"><div><span class="eyebrow">Delivery</span><h2 id="location-title">Where are we pouring?</h2></div><button class="close-button" data-close aria-label="Close location">${icon("close")}</button></div><div class="drawer-body"><p class="drawer-copy">Availability is checked against your delivery city.</p><div class="location-list">${LOCATIONS.map((location) => `<button data-location="${location}" class="location-option ${state.location === location ? "is-active" : ""}"><span>${location}</span><span>${state.location === location ? "Selected" : "Choose"}</span></button>`).join("")}</div></div></aside>
    <aside class="drawer drawer--small" data-drawer="account" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="account-title"><div class="drawer-head"><div><span class="eyebrow">Your Yodla</span><h2 id="account-title">Account</h2></div><button class="close-button" data-close aria-label="Close account">${icon("close")}</button></div><div class="drawer-body" data-account-view></div></aside>
    <aside class="drawer drawer--small drawer--concierge" data-drawer="concierge" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="concierge-title"><div class="drawer-head concierge-head"><img src="assets/logo.png" alt=""><div><span class="eyebrow">Yodla</span><h2 id="concierge-title">Ask Yodla</h2></div><button type="button" class="text-button concierge-clear" data-clear-chat>Clear chat</button><button class="close-button" data-close aria-label="Close Ask Yodla">${icon("close")}</button></div><div class="drawer-body concierge-body"><div class="chat-messages" data-chat-messages aria-live="polite"><div class="chat-message chat-message--host"><p>Tell me the occasion, what you enjoy, or your budget. I’ll suggest bottles from this Yodla shelf.</p></div></div><div class="chat-prompts"><button data-chat-prompt="A gift under ₦50,000">Gift under ₦50k</button><button data-chat-prompt="Drinks for a dinner">Dinner picks</button><button data-chat-prompt="Something alcohol-free">Alcohol-free</button></div><form class="chat-form" data-chat-form><label for="chat-message">Your question</label><div><input id="chat-message" name="message" maxlength="500" autocomplete="off" placeholder="What should I bring?"><button aria-label="Send question">${icon("arrow-up")}</button></div><small>Ask about an occasion, budget, bottle style, or how to serve it.</small></form></div></aside>
    <aside class="drawer drawer--small drawer--menu" data-drawer="menu" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Menu"><div class="drawer-head"><span class="wordmark">YODLA<span>.</span></span><button class="close-button" data-close aria-label="Close menu">${icon("close")}</button></div><div class="menu-body"><div class="menu-quick-actions">${state.account ? `<button data-signout>${icon("account")}<span>Sign out</span></button>` : `<a data-menu-account href="${loginHref()}">${icon("account")}<span>Account</span></a>`}<button data-open="search">${icon("search")}<span>Search</span></button><button data-open="location">${icon("location")}<span>${state.location || "Delivery"}</span></button></div><nav class="menu-nav" aria-label="Primary navigation"><a href="shop.html"><span>01</span>Shop all</a><a href="gifting.html"><span>02</span>Gifting</a><a href="journal.html"><span>03</span>Journal</a><a href="contact.html"><span>04</span>Contact</a><a href="help.html"><span>05</span>Help</a></nav><section class="menu-categories" aria-labelledby="menu-categories-title"><span class="eyebrow" id="menu-categories-title">Browse by category</span><div>${CATEGORIES.filter((item) => item !== "All").map((item) => `<a href="shop.html?category=${encodeURIComponent(item)}">${item}</a>`).join("")}<a href="shop.html?occasion=Weekend">Weekend</a></div></section></div></aside>
    <button class="floating-concierge" data-open="concierge" aria-label="Ask Yodla for a drink recommendation"><img src="assets/logo.png" alt=""><span>Ask Yodla</span></button>
    <button class="floating-bag" data-open="cart" aria-label="Open bag">
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path class="floating-bag__handle" d="M21 25v-5c0-7 4.5-11 11-11s11 4 11 11v5"/><path class="floating-bag__body" d="M13 24h38l-3 31H16z"/><path class="floating-bag__fold" d="M13 24c8 4 30 4 38 0"/></svg>
      <b data-cart-count>${getCartCount(state.cart)}</b><span class="sr-only">items in bag</span>
    </button>
    <div class="handoff-modal" data-handoff-modal hidden>
      <div class="handoff-modal__panel" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
        <img src="assets/logo.png" alt="">
        <h2 id="handoff-title">Finish faster with Ask Yodla</h2>
        <p>Ask Yodla can complete your order in chat — confirm details, answer questions, and take payment without leaving the conversation.</p>
        <button type="button" class="button button--ember button--wide" data-handoff-continue>Continue in Ask Yodla</button>
        <button type="button" class="text-button handoff-modal__dismiss" data-handoff-dismiss>Not now</button>
      </div>
    </div>
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`);
}

function productCard(product, index = 0) {
  const availability = getAvailability(product, state.location);
  return `<article class="product-card reveal" style="--index:${index}">
    <a class="product-card__media media--${product.imageMode}" href="${productUrl(product.id)}">
      <span class="product-card__tag">${product.tag || product.category || "Yodla"}</span>${productPicture(product)}<span class="product-card__view">View bottle ${icon("arrow-up-right")}</span>
    </a>
    <div class="product-card__meta"><div><p>${product.brand} · ${product.subcategory}</p><h3><a href="${productUrl(product.id)}">${product.name}</a></h3><small class="availability availability--${availability}">${availabilityCopy[availability]}</small></div><div class="product-card__buy"><strong>${formatMoney(product.price)}</strong><button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag"><span>+</span></button></div></div>
  </article>`;
}

function accountInitials(account) {
  const parts = String(account?.name || account?.email || "?").trim().split(/[\s._@-]+/).filter(Boolean);
  const letters = `${parts[0]?.[0] || ""}${parts[1]?.[0] || parts[0]?.[1] || ""}`.toUpperCase();
  return (letters || "?").slice(0, 2);
}

function loginHref(next = `${location.pathname}${location.search}` || "/index.html") {
  const path = next.startsWith("/") ? next : `/${next}`;
  return `login.html?next=${encodeURIComponent(path.startsWith("/admin") ? "/index.html" : path)}`;
}

function accountControlMarkup() {
  if (state.account) {
    return `<div class="account-menu" data-account-menu>
      <button type="button" class="icon-button account-button account-button--avatar" data-account-toggle aria-expanded="false" aria-haspopup="true" aria-label="Account menu for ${escapeHtml(state.account.name)}">
        <span class="account-avatar" aria-hidden="true">${escapeHtml(accountInitials(state.account))}</span>
      </button>
      <div class="account-dropdown" data-account-dropdown hidden>
        <p>${escapeHtml(state.account.name)}</p>
        <small>${escapeHtml(state.account.email)}</small>
        <button type="button" data-signout>Sign out</button>
      </div>
    </div>`;
  }
  return `<a class="icon-button account-button" href="${loginHref()}" aria-label="Sign in to your account"><span class="account-icon" aria-hidden="true"></span></a>`;
}

function closeAccountMenu() {
  $$("[data-account-dropdown]").forEach((menu) => { menu.hidden = true; });
  $$("[data-account-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
}

function accountMarkup() {
  if (state.account) {
    return `<div class="account-welcome"><span class="account-monogram">${escapeHtml(accountInitials(state.account))}</span><span class="eyebrow">Signed in</span><h2>Hello, ${escapeHtml(state.account.name.split(" ")[0])}.</h2><p>${escapeHtml(state.account.email)}</p><a class="button button--dark button--wide" href="shop.html">Browse the shelves</a><button class="text-link account-signout" data-signout>Sign out</button></div>`;
  }
  return `<div class="account-welcome"><span class="eyebrow">Your Yodla</span><h2>Sign in or continue as guest.</h2><p>Browse and checkout without an account, or sign in to save your details.</p><a class="button button--ember button--wide" href="${loginHref()}">Sign in / Create account</a><a class="button button--dark button--wide" href="shop.html">Continue as guest</a></div>`;
}

function renderAccount() {
  $$("[data-account-view]").forEach((target) => { target.innerHTML = accountMarkup(); });
  const slot = $("[data-account-slot]");
  if (slot) slot.innerHTML = accountControlMarkup();
  const menuAccount = $("[data-menu-account]");
  if (menuAccount) {
    menuAccount.outerHTML = state.account
      ? `<button data-signout>${icon("account")}<span>Sign out</span></button>`
      : `<a data-menu-account href="${loginHref()}">${icon("account")}<span>Account</span></a>`;
  }
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
    status.innerHTML = `<p class="inline-status inline-status--error">${escapeHtml(friendlyMessage(error, "We could not complete that request. Try again."))}</p>`;
    if (error.field) form.elements[error.field]?.focus();
  }
}

function friendlyMessage(error, fallback = "Something went wrong. Please try again.") {
  const raw = String(error?.message || error || "").trim();
  if (!raw) return fallback;
  if (raw.length > 140 || /stack|at\s+\S+\s*\(|TypeError|SyntaxError|ReferenceError|ECONN|ENOENT|fetch failed|Unexpected token/i.test(raw)) return fallback;
  return raw;
}

function readChatUi() {
  try {
    const entries = JSON.parse(localStorage.getItem("yodla-concierge-ui") || "[]");
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function writeChatUi(entries) {
  try {
    localStorage.setItem("yodla-concierge-ui", JSON.stringify(entries.slice(-40)));
  } catch {
    // ignore
  }
}

function readOrderDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem("yodla-order-draft") || "null");
    return draft && typeof draft === "object" ? draft : null;
  } catch {
    return null;
  }
}

function writeOrderDraft(draft) {
  try {
    if (draft) localStorage.setItem("yodla-order-draft", JSON.stringify(draft));
    else localStorage.removeItem("yodla-order-draft");
  } catch {
    // ignore
  }
}

function buildOrderDraft() {
  const form = $("[data-checkout-form]");
  const data = form ? Object.fromEntries(new FormData(form)) : {};
  const account = state.account || {};
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || account.name || "";
  const customer = {
    name,
    email: String(data.email || account.email || "").trim(),
    phone: String(data.phone || account.phone || "").trim(),
    address: String(data.address || "").trim(),
    state: String(data.city || data.state || state.location || "").trim(),
    note: String(data.note || "").trim(),
  };
  const items = state.cart.map((line) => {
    const product = getProduct(line.id);
    return {
      productId: line.id,
      name: product?.name || "",
      price: product?.price || 0,
      quantity: line.quantity,
    };
  });
  const missing = ["name", "email", "phone", "address", "state"].filter((field) => !customer[field]);
  return { items, customer, missing };
}

function appendChatMessage(text, role, productIds = [], extras = {}) {
  const target = $("[data-chat-messages]");
  if (!target) return null;
  const message = document.createElement("div");
  message.className = `chat-message chat-message--${role}`;
  const copy = document.createElement("p");
  copy.textContent = text;
  message.append(copy);
  if (role === "user" || role === "host") {
    const actions = document.createElement("div");
    actions.className = "chat-msg-actions";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "chat-msg-action";
    copyBtn.dataset.copyChat = "true";
    copyBtn.textContent = "Copy";
    actions.append(copyBtn);
    if (role === "user") {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chat-msg-action";
      editBtn.dataset.editChat = "true";
      editBtn.textContent = "Edit";
      actions.append(editBtn);
    }
    message.append(actions);
  }
  const products = productIds.map(getProduct).filter(Boolean);
  if (products.length) {
    const links = document.createElement("div");
    links.className = "chat-products";
    products.forEach((product) => {
      const row = document.createElement("div");
      row.className = "chat-product-row";
      const link = document.createElement("a");
      link.href = productUrl(product.id);
      link.textContent = `${product.name} · ${formatMoney(product.price)}`;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "chat-add";
      add.dataset.add = product.id;
      add.textContent = "Add to bag";
      row.append(link, add);
      links.append(row);
    });
    message.append(links);
  }
  if (extras.paymentUrl) {
    const pay = document.createElement("a");
    pay.className = "button button--ember chat-pay";
    pay.href = extras.paymentUrl;
    pay.textContent = "Pay & place order";
    message.append(pay);
  }
  if (extras.trackingCode) {
    const track = document.createElement("p");
    track.className = "chat-tracking";
    track.textContent = `Tracking: ${extras.trackingCode}`;
    message.append(track);
  }
  target.append(message);
  target.scrollTop = target.scrollHeight;
  if (extras.persist !== false && (role === "user" || role === "host")) {
    writeChatUi([
      ...readChatUi(),
      {
        role,
        text,
        productIds: productIds || [],
        paymentUrl: extras.paymentUrl || "",
        trackingCode: extras.trackingCode || "",
        orderComplete: Boolean(extras.orderComplete),
      },
    ]);
  }
  return message;
}

function restoreChatUi() {
  const entries = readChatUi();
  const target = $("[data-chat-messages]");
  if (!target || !entries.length) return;
  target.innerHTML = "";
  entries.forEach((entry) => {
    appendChatMessage(entry.text, entry.role === "model" ? "host" : entry.role, entry.productIds || [], {
      paymentUrl: entry.paymentUrl,
      trackingCode: entry.trackingCode,
      orderComplete: entry.orderComplete,
      persist: false,
    });
  });
}

function clearChat() {
  localStorage.removeItem("yodla-concierge-ui");
  localStorage.removeItem("yodla-concierge-history");
  localStorage.removeItem("yodla-concierge-session");
  localStorage.removeItem("yodla-order-draft");
  state.chatHistory = [];
  const target = $("[data-chat-messages]");
  if (target) {
    target.innerHTML = `<div class="chat-message chat-message--host"><p>Tell me the occasion, what you enjoy, or your budget. I’ll suggest bottles from this Yodla shelf.</p></div>`;
  }
  toast("Chat cleared.");
}

function readChatHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("yodla-concierge-history") || "[]");
    return Array.isArray(history) ? history.slice(-8) : [];
  } catch {
    return [];
  }
}

function writeChatHistory(history) {
  try {
    localStorage.setItem("yodla-concierge-history", JSON.stringify(history.slice(-10)));
  } catch {
    // ignore
  }
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
    const sessionId = localStorage.getItem("yodla-concierge-session") || `web_${crypto.randomUUID()}`;
    localStorage.setItem("yodla-concierge-session", sessionId);
    const history = readChatHistory();
    const orderDraft = readOrderDraft();
    let shopperKey = "";
    try {
      shopperKey = localStorage.getItem("yodla-shopper-key") || "";
      if (!shopperKey) {
        shopperKey = state.account?.email || `guest_${crypto.randomUUID()}`;
        localStorage.setItem("yodla-shopper-key", shopperKey);
      } else if (state.account?.email && shopperKey.startsWith("guest_")) {
        shopperKey = state.account.email;
        localStorage.setItem("yodla-shopper-key", shopperKey);
      }
    } catch {
      shopperKey = state.account?.email || "";
    }
    const gift = readGiftDraft();
    const response = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId,
        history,
        orderDraft,
        gift: gift.recipients.length || gift.message || gift.wrap || gift.items?.length
          ? {
            version: 2,
            recipients: gift.recipients,
            items: gift.items || [],
            message: gift.message,
            wrap: gift.wrap,
            notify: gift.notify !== false,
            activeRecipientId: gift.activeRecipientId || "",
          }
          : null,
        location: state.location || "",
        page: page === "gifting" ? `gifting:step${document.body.dataset.giftStep || gift.step || 1}` : page,
        shopperKey,
        account: state.account ? { name: state.account.name || "", email: state.account.email || "" } : null,
        bag: state.cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(friendlyMessage(payload.error, "Ask Yodla could not answer that."));
    loading?.remove();
    if (Array.isArray(payload.gift?.recipients)) {
      writeGiftDraft({
        version: 2,
        recipients: payload.gift.recipients,
        items: payload.gift.items || gift.items || [],
        message: payload.gift.message || gift.message || "",
        wrap: Boolean(payload.gift.wrap ?? gift.wrap),
        notify: payload.gift.notify !== false,
        activeRecipientId: payload.gift.activeRecipientId || gift.activeRecipientId || "",
        step: gift.step || Number(document.body.dataset.giftStep) || 1,
      });
      renderGiftFlow();
      renderCheckoutSummary();
    }
    if (Array.isArray(payload.bagSync) && payload.bagSync.length) {
      for (const item of payload.bagSync) {
        if (!item?.productId) continue;
        state.cart = addCartItem(state.cart, item.productId, Number(item.quantity || 1));
      }
      writeCart(state.cart);
      renderCart();
    }
    appendChatMessage(payload.reply, "host", payload.productIds || [], {
      paymentUrl: payload.paymentUrl,
      trackingCode: payload.trackingCode,
      orderComplete: payload.orderComplete,
    });
    writeChatHistory([
      ...history,
      { role: "user", text: message },
      { role: "model", text: payload.reply, productIds: payload.productIds || [] },
    ]);
    if (payload.orderComplete) {
      const reference = payload.orderId || payload.reference || payload.trackingCode;
      if (reference) {
        window.location.assign(`checkout.html?payment=mock&reference=${encodeURIComponent(reference)}`);
        return;
      }
    }
  } catch (error) {
    loading?.remove();
    appendChatMessage(`${friendlyMessage(error, "Ask Yodla hit a snag.")} Please try again.`, "error");
  } finally {
    form.querySelector("button").disabled = false;
    input.focus();
  }
}

function cartMarkup() {
  if (!state.cart.length) return `<div class="cart-empty state-card"><span class="state-icon">${icon("bag")}</span><h3>Your bag has room.</h3><p>Start with a bottle for dinner, a gift, or the weekend.</p><a class="button button--dark" href="shop.html">Explore the shelves</a></div>`;
  return `<div class="cart-lines">${state.cart.map((line) => {
    const product = getProduct(line.id);
    return `<article class="cart-line" data-cart-line="${line.id}"><a href="${productUrl(line.id)}" class="cart-line__image">${productPicture(product, { decorative: true, sizes: "120px" })}</a><div class="cart-line__copy"><div><p>${product.brand} · ${product.amount || product.volume || ""}</p><h3>${product.name}</h3></div><div class="cart-line__bottom"><div class="quantity"><button data-quantity="${line.id}" data-change="-1" aria-label="Reduce ${product.name}">${icon("minus")}</button><span aria-live="polite">${line.quantity}</span><button data-quantity="${line.id}" data-change="1" aria-label="Increase ${product.name}">+</button></div><strong>${formatMoney(product.price * line.quantity)}</strong></div><button class="remove-link" data-remove="${line.id}">Remove</button></div></article>`;
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
  item.innerHTML = `<span>${icon(tone === "success" ? "check" : "alert")}</span><p>${escapeHtml(friendlyMessage(message, tone === "error" ? "Something went wrong. Please try again." : String(message || "")))}</p>`;
  region.append(item);
  if (gsap && !reduceMotion) gsap.fromTo(item, { y: 18, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .35, ease: "back.out(1.6)" });
  window.setTimeout(() => {
    if (gsap && !reduceMotion) gsap.to(item, { y: -8, opacity: 0, duration: .25, onComplete: () => item.remove() });
    else item.remove();
  }, 2600);
}

function handoffDismissed() {
  try {
    return sessionStorage.getItem("yodla-handoff-dismissed") === "1";
  } catch {
    return false;
  }
}

function dismissHandoff() {
  try {
    sessionStorage.setItem("yodla-handoff-dismissed", "1");
  } catch {
    // ignore
  }
  const modal = $("[data-handoff-modal]");
  if (modal) modal.hidden = true;
}

function showHandoff() {
  if (handoffDismissed() || !state.cart.length) return;
  const modal = $("[data-handoff-modal]");
  if (!modal || !modal.hidden) return;
  modal.hidden = false;
}

function continueHandoff() {
  const draft = buildOrderDraft();
  writeOrderDraft(draft);
  dismissHandoff();
  openDrawer("concierge");
  const itemSummary = draft.items.map((item) => `${item.quantity} x ${item.name || "bottle"}`).join(", ") || "your bag";
  const missing = draft.missing.length ? ` I still need ${draft.missing.join(", ")}.` : " I have your delivery details when you’re ready.";
  appendChatMessage(`I can finish this order in chat. Bag: ${itemSummary}.${missing}`, "host");
}

function openDrawer(name) {
  if (state.drawer) {
    const previous = $(`[data-drawer="${state.drawer}"]`);
    previous?.classList.remove("is-open");
    previous?.setAttribute("aria-hidden", "true");
    if (previous) {
      previous.style.transform = "";
      previous.style.opacity = "";
      previous.style.left = "";
      previous.style.top = "";
      previous.style.right = "";
      previous.style.bottom = "";
    }
    state.drawer = null;
  }
  const drawer = $(`[data-drawer="${name}"]`);
  const backdrop = $("[data-backdrop]");
  if (!drawer || !backdrop) return;
  state.previousFocus = document.activeElement;
  state.drawer = name;
  backdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
  drawer.style.transform = "translate3d(0,0,0)";
  drawer.style.opacity = "1";
  drawer.style.visibility = "visible";
  drawer.style.left = "0";
  drawer.style.top = "0";
  drawer.style.right = "auto";
  drawer.style.bottom = "0";
  drawer.classList.add("is-open");
  setPageInert(true);
  document.body.classList.add("drawer-open");
  window.requestAnimationFrame(() => backdrop.classList.add("is-visible"));
  window.setTimeout(() => $(name === "search" ? "[data-global-search]" : "button, a, input", drawer)?.focus(), 80);
  if (name === "cart" && state.cart.length) window.setTimeout(showHandoff, 420);
}

function closeDrawer(restoreFocus = true) {
  if (!state.drawer) return;
  const name = state.drawer;
  const drawer = $(`[data-drawer="${name}"]`);
  const backdrop = $("[data-backdrop]");
  state.drawer = null;
  drawer?.classList.remove("is-open");
  backdrop?.classList.remove("is-visible");
  window.setTimeout(() => {
    if (state.drawer) return;
    drawer?.setAttribute("aria-hidden", "true");
    if (drawer) {
      drawer.style.transform = "";
      drawer.style.opacity = "";
      drawer.style.visibility = "";
      drawer.style.left = "";
      drawer.style.top = "";
      drawer.style.right = "";
      drawer.style.bottom = "";
    }
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.style.opacity = "";
      backdrop.classList.remove("is-visible");
    }
    setPageInert(false);
    document.body.classList.remove("drawer-open");
    if (restoreFocus) state.previousFocus?.focus?.();
  }, reduceMotion ? 0 : 320);
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
  if (page === "gifting") renderGiftFlow();
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
  const targets = $$("[data-search-results]");
  if (!targets.length) return;
  const results = filterProducts({ query }).slice(0, 6);
  const markup = !query.trim()
    ? `<div class="state-card state-card--quiet"><p>Search by drink, style or tasting note.</p></div>`
    : !results.length
      ? `<div class="state-card"><span class="state-icon">?</span><h3>No matching bottles.</h3><p>Try a broader word like wine, gin or citrus.</p></div>`
      : results.map((product) => `<a class="search-result" href="${productUrl(product.id)}">${productPicture(product, { decorative: true, sizes: "70px" })}<span><small>${product.category} · ${product.volume}</small><strong>${product.name}</strong><em>${formatMoney(product.price)}</em></span>${icon("arrow-up-right")}</a>`).join("");
  targets.forEach((target) => { target.innerHTML = markup; });
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

function isGiftCheckout() {
  return page === "checkout" && new URLSearchParams(location.search).get("gift") === "1";
}

function configureGiftCheckoutUi() {
  if (page !== "checkout") return;
  const giftMode = isGiftCheckout();
  document.body.dataset.checkoutMode = giftMode ? "gift" : "personal";
  const title = $("[data-checkout-title]");
  const lede = $("[data-checkout-lede]");
  const delivery = $("[data-checkout-delivery-fieldset]");
  const buyer = $("[data-gift-buyer-fieldset]");
  const bagSummary = $("[data-checkout-summary]");
  const giftSummary = $("[data-gift-checkout-summary]");
  const legal = $("[data-checkout-legal]");

  if (title) title.textContent = giftMode ? "Pay for this gift." : "Delivery details.";
  if (lede) {
    lede.textContent = giftMode
      ? "You’re the buyer. Recipients keep the delivery details you already set — they get the note after payment."
      : "Checkout as a guest or while signed in. Paystack is used when configured; otherwise mock payment completes the order.";
  }
  if (delivery) {
    delivery.hidden = giftMode;
    $$("input, select", delivery).forEach((field) => {
      field.required = !giftMode;
      field.disabled = giftMode;
    });
  }
  if (buyer) {
    buyer.hidden = !giftMode;
    $$("input", buyer).forEach((field) => {
      field.required = giftMode;
      field.disabled = !giftMode;
    });
  }
  if (bagSummary) bagSummary.hidden = giftMode;
  if (giftSummary) giftSummary.hidden = !giftMode;
  if (legal) {
    legal.textContent = giftMode
      ? "By continuing, you confirm each gift recipient is 18 or older."
      : "By continuing, you confirm the recipient is 18 or older. Guests can order without signing in.";
  }
}

function renderCheckoutSummary() {
  if (isGiftCheckout()) {
    const giftSummary = $("[data-gift-checkout-summary]");
    if (!giftSummary) return;
    const draft = readGiftDraft();
    const error = giftDraftError(draft);
    giftSummary.innerHTML = error
      ? `<div class="state-card"><p>${escapeHtml(error)}</p><a class="text-link" href="gifting.html">Back to gifting</a></div>`
      : `${giftReviewHtml(draft)}<p class="checkout-gift__note"><a class="text-link" href="gifting.html">Edit gift</a></p>`;
    return;
  }
  const target = $("[data-checkout-summary]");
  if (!target) return;
  if (!state.cart.length) {
    target.innerHTML = `<div class="state-card"><h3>Your bag is empty.</h3><p>Add a bottle before checking out.</p><a class="button button--dark" href="shop.html">Shop drinks</a></div>`;
    return;
  }
  target.innerHTML = `${state.cart.map((line) => {
    const product = getProduct(line.id);
    return `<div class="checkout-line">${productPicture(product, { decorative: true, sizes: "58px" })}<span><strong>${product.name}</strong><small>Qty ${line.quantity}</small></span><b>${formatMoney(product.price * line.quantity)}</b></div>`;
  }).join("")}<div class="checkout-total"><span>Total (excl. delivery)</span><strong>${formatMoney(getCartTotal(state.cart))}</strong></div>`;
}

function renderGiftingPage() {
  initGifting({
    toast,
    productPicture,
    floatBottle: floatHeroBottle,
  });
  if (page !== "gifting") return;
  heroSlides = GIFT_SLIDES.map((slide, index) => ({
    id: `gift-hero-${index + 1}`,
    image: `${slide.image}?v=cutout4`,
    imageAlt: slide.imageAlt,
    caption: slide.caption,
    captionStrong: slide.captionStrong,
    stamp: slide.stamp,
    occasion: slide.label,
    href: "#gift-builder",
    responsiveBase: "",
  }));
  if ($("[data-hero-carousel]") && heroSlides.length) {
    renderHeroSlide(0, { announce: false, animate: false });
  }
  const prompts = $(".chat-prompts");
  if (prompts) {
    prompts.innerHTML = `<button data-chat-prompt="I'm on gifting — what's next?">What's next?</button><button data-chat-prompt="I want to send a gift to a few people">Gift to a few people</button><button data-chat-prompt="A gift under ₦50,000">Gift under ₦50k</button>`;
  }
}

function renderGiftFlow() {
  if (page === "gifting") renderGiftUi();
}

function initContactWizard() {
  const form = $("[data-contact-wizard]");
  if (!form) return;
  let step = 1;
  const params = new URLSearchParams(location.search);
  const intentParam = params.get("intent") || "";
  const intentMap = { gifts: "Gifts", gift: "Gifts", orders: "Orders", delivery: "Delivery", press: "Press", other: "Other" };
  const prefill = intentMap[String(intentParam).toLowerCase()];
  if (prefill) {
    const radio = form.querySelector(`input[name="intent"][value="${prefill}"]`);
    if (radio) radio.checked = true;
  }

  const showStep = (next) => {
    step = next;
    $$("[data-contact-stage]", form).forEach((stage) => {
      const active = Number(stage.dataset.contactStage) === step;
      stage.hidden = !active;
      stage.classList.toggle("on", active);
      if (active && gsap && !reduceMotion) {
        gsap.fromTo(stage, { opacity: 0, x: 22 }, { opacity: 1, x: 0, duration: 0.32, ease: "power2.out" });
      }
      if (active) {
        const legend = $("legend", stage);
        legend?.focus?.();
      }
    });
    $$("[data-contact-dot]", form).forEach((dot) => {
      dot.classList.toggle("on", Number(dot.dataset.contactDot) <= step);
    });
    const label = $("[data-contact-step-label]", form);
    if (label) label.textContent = `Step ${step} of 3`;
    if (step === 3) renderContactReview(form);
  };

  form.addEventListener("click", (event) => {
    if (event.target.closest("[data-contact-next]")) {
      event.preventDefault();
      if (step === 1) {
        const intent = form.querySelector("input[name='intent']:checked");
        if (!intent) return toast("Choose what this is about.", "error");
        const subject = form.elements.subject;
        if (subject && !subject.value) subject.value = intent.value;
        showStep(2);
        return;
      }
      if (step === 2) {
        if (!form.elements.name.value.trim() || !form.elements.email.checkValidity()) {
          form.elements.name.reportValidity();
          form.elements.email.reportValidity();
          return;
        }
        showStep(3);
      }
    }
    if (event.target.closest("[data-contact-back]")) {
      event.preventDefault();
      showStep(Math.max(1, step - 1));
    }
  });
  showStep(prefill ? 2 : 1);
}

function renderContactReview(form) {
  const review = $("[data-contact-review]", form);
  if (!review) return;
  const intent = form.querySelector("input[name='intent']:checked")?.value || "Other";
  review.innerHTML = `<div><dt>About</dt><dd>${escapeHtml(intent)}</dd></div><div><dt>From</dt><dd>${escapeHtml(form.elements.name.value)} · ${escapeHtml(form.elements.email.value)}</dd></div>`;
}

function syncBagFromConcierge(payload) {
  if (!payload?.cartId || !Array.isArray(payload.bagItems)) return;
  // Optional: if server returns product ids via actions — bag sync uses client add buttons primarily.
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

function checkoutReferenceFromParams(params = new URLSearchParams(location.search)) {
  return params.get("reference") || params.get("trxref") || "";
}

function isCheckoutPaymentReturn(params = new URLSearchParams(location.search)) {
  const reference = checkoutReferenceFromParams(params);
  if (!reference) return false;
  return params.get("payment") === "mock"
    || params.get("payment") === "paystack"
    || params.get("paid") === "1"
    || params.has("trxref");
}

function showCheckoutSuccess(order, reference, { clearGift = false } = {}) {
  const checkoutView = $("[data-checkout-view]");
  if (!checkoutView) return;
  const code = order?.trackingCode || reference || "";
  const recipients = order?.gift?.recipients || (clearGift ? readGiftDraft().recipients : []) || [];
  const giftLine = recipients.length
    ? `<p>Gift note sent to ${recipients.map((person) => escapeHtml(person.name || person.email)).join(", ")}.</p>`
    : "";
  checkoutView.classList.add("checkout-page--success");
  checkoutView.innerHTML = `<div class="success-state"><div class="success-mark">${icon("check")}</div><span class="eyebrow">Order ${escapeHtml(code)}</span><h1>The good part is on its way.</h1><p>Payment confirmed. Keep your tracking code <strong>${escapeHtml(code)}</strong> for delivery updates.</p>${giftLine}<a class="button button--dark" href="shop.html">Keep browsing</a>${recipients.length ? `<a class="text-link" href="gifting.html">Send another gift</a>` : ""}</div>`;
  if (clearGift) clearGiftDraft();
  try {
    const paidUrl = clearGift
      ? `checkout.html?gift=1&paid=1&reference=${encodeURIComponent(reference || order?.id || "")}`
      : `checkout.html?paid=1&reference=${encodeURIComponent(reference || order?.id || "")}`;
    history.replaceState({}, "", paidUrl);
  } catch { /* ignore */ }
}

function showCheckoutConfirming(reference) {
  const checkoutView = $("[data-checkout-view]");
  if (!checkoutView) return;
  checkoutView.classList.add("checkout-page--success");
  checkoutView.innerHTML = `<div class="success-state"><div class="success-mark"><span class="spinner"></span></div><span class="eyebrow">Order ${escapeHtml(reference || "")}</span><h1>Confirming your order…</h1><p>Payment is in. We’re locking in delivery now.</p></div>`;
}

function showCheckoutConfirmError(message) {
  const checkoutView = $("[data-checkout-view]");
  if (!checkoutView) return;
  checkoutView.classList.add("checkout-page--success");
  const backHref = isGiftCheckout() ? "checkout.html?gift=1" : "checkout.html";
  checkoutView.innerHTML = `<div class="success-state"><div class="success-mark">${icon("alert")}</div><span class="eyebrow">Payment</span><h1>We could not confirm that order.</h1><p>${escapeHtml(message || "Nothing further was charged. Try checkout again.")}</p><a class="button button--ember" href="${backHref}">Back to delivery details</a></div>`;
}

async function confirmPaidOrder(reference, { clearGift = isGiftCheckout() } = {}) {
  const confirm = await authorizedFetch("/api/commerce/create_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  const orderPayload = await confirm.json().catch(() => ({}));
  if (!confirm.ok) throw new Error(friendlyMessage(orderPayload.error, "Order could not be confirmed."));
  if (!clearGift) {
    state.cart = [];
    writeCart(state.cart);
    renderCart();
  }
  showCheckoutSuccess(orderPayload.order, reference, { clearGift });
  return orderPayload.order;
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

async function submitCheckout(form) {
  const button = $("button[type=submit]", form);
  const status = $("[data-checkout-status]");
  const giftMode = isGiftCheckout();
  const gift = readGiftDraft();

  if (giftMode) {
    const error = giftDraftError(gift);
    if (error) return toast(error, "error");
  } else if (!state.cart.length) {
    return toast("Your bag is empty.", "error");
  }
  if (!form.reportValidity()) return;

  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Starting payment`;
  status.innerHTML = `<div class="inline-status inline-status--loading"><span class="spinner"></span><p>Checking stock and preparing payment…</p></div>`;
  try {
    const data = Object.fromEntries(new FormData(form));
    if (new URLSearchParams(location.search).get("state") === "failure") throw new Error("We could not confirm that order.");

    let paymentBody;
    if (giftMode) {
      paymentBody = {
        email: data.email,
        phone: data.phone,
        name: `${data.giftFirstName || data.firstName || ""} ${data.giftLastName || data.lastName || ""}`.trim(),
        address: "",
        state: gift.recipients[0]?.state || "",
        note: gift.message || "",
        giftWrap: Boolean(gift.wrap),
        gift: {
          version: 2,
          recipients: gift.recipients,
          items: gift.items,
          message: gift.message,
          wrap: Boolean(gift.wrap),
          notify: gift.notify !== false,
          activeRecipientId: gift.activeRecipientId || "",
        },
        source: "gifting",
        callbackUrl: `${location.origin}/checkout.html?gift=1`,
      };
    } else {
      const createCart = await authorizedFetch("/api/commerce/create_cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: data.city || data.state }),
      });
      const cartPayload = await createCart.json().catch(() => ({}));
      if (!createCart.ok) throw new Error(friendlyMessage(cartPayload.error, "Cart could not be created."));
      for (const line of state.cart) {
        const add = await authorizedFetch("/api/commerce/add_to_cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId: cartPayload.cart.id, productId: line.id, quantity: line.quantity }),
        });
        if (!add.ok) {
          const payload = await add.json().catch(() => ({}));
          throw new Error(friendlyMessage(payload.error, "A bottle could not be added."));
        }
      }
      paymentBody = {
        cartId: cartPayload.cart.id,
        email: data.email,
        phone: data.phone,
        name: `${data.firstName} ${data.lastName}`.trim(),
        address: data.address,
        state: data.city || data.state,
        note: data.note || "",
        giftWrap: false,
        source: "checkout",
        callbackUrl: `${location.origin}/checkout.html`,
      };
    }

    const paymentResponse = await authorizedFetch("/api/commerce/create_payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentBody),
    });
    const paymentPayload = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok) throw new Error(friendlyMessage(paymentPayload.error, "Payment could not start."));
    const reference = paymentPayload.order?.id || paymentPayload.payment?.reference;
    const mockPayment = paymentPayload.payment?.provider === "mock"
      || !String(paymentPayload.payment?.authorization_url || "").includes("paystack");
    if (mockPayment) {
      showCheckoutConfirming(reference);
      await confirmPaidOrder(reference, { clearGift: giftMode });
      return;
    }
    window.location.assign(paymentPayload.payment.authorization_url);
  } catch (error) {
    if ($("[data-checkout-form]") && button && status) {
      button.disabled = false;
      button.innerHTML = `Pay & place order ${icon("arrow-up-right")}`;
      status.innerHTML = `<div class="inline-status inline-status--error"><b>!</b><p><strong>${escapeHtml(friendlyMessage(error, "Checkout could not finish."))}</strong><br>Nothing was charged. Check the details and try again.</p></div>`;
      return;
    }
    showCheckoutConfirmError(friendlyMessage(error, "Checkout could not finish."));
  }
}

function animateReveals() {
  if (!gsap || reduceMotion) return;
  $$(".reveal:not([data-animated])").forEach((element) => {
    element.dataset.animated = "true";
    if (window.ScrollTrigger) gsap.from(element, { scrollTrigger: { trigger: element, start: "top 90%", once: true }, y: 28, opacity: 0, duration: .65, delay: Number(element.style.getPropertyValue("--index") || 0) * .035, ease: "power3.out" });
  });
}

function floatHeroBottle() {
  const bottle = $(".hero-bottle");
  if (!bottle || !gsap || reduceMotion) return;
  gsap.killTweensOf(bottle);
  gsap.fromTo(bottle, { y: 6, rotate: -1.2 }, {
    y: -10,
    rotate: 1.4,
    duration: 2.8,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
}

function startPageMotion() {
  if (!gsap || reduceMotion) return;
  gsap.from(".site-header__main > *", { y: -12, opacity: 0, stagger: .05, duration: .45, ease: "power2.out" });
  gsap.from(".hero-copy > *, .page-intro > *, .gift-hero__copy > *, .contact-hero__copy > *", { y: 30, opacity: 0, stagger: .075, duration: .75, ease: "power3.out" });
  const bottle = $(".hero-bottle, .gift-hero__stage img");
  if (bottle) {
    gsap.fromTo(bottle, { y: 32, rotate: -4, opacity: 0 }, {
      y: 0,
      rotate: 0,
      opacity: 1,
      duration: 1.05,
      ease: "power4.out",
      onComplete: floatHeroBottle,
    });
  }
  animateReveals();
}

async function handleNewsletter(form) {
  const input = $("input[type='email'], input[name='email'], input", form);
  const status = $("[data-newsletter-status]", form.closest(".footer-grid") || form.parentElement) || form.querySelector("[data-newsletter-status]");
  if (!input?.checkValidity()) return input?.reportValidity();
  const button = $("button", form);
  if (button) button.disabled = true;
  if (status) status.textContent = "Joining…";
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "newsletter", email: input.value.trim(), source: "footer" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(friendlyMessage(payload.error, "Could not join the list."));
    input.value = "";
    if (status) status.textContent = payload.message || "You’re on the Yodla list.";
  } catch (error) {
    if (status) status.textContent = friendlyMessage(error, "Could not join the list. Try again.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleContact(form) {
  const status = $("[data-contact-status]", form) || $("[data-contact-status]");
  const button = $("button[type='submit']", form);
  if (!form.reportValidity()) return;
  if (button) button.disabled = true;
  if (status) status.innerHTML = `<p class="inline-status"><span class="spinner"></span>Sending…</p>`;
  try {
    const data = Object.fromEntries(new FormData(form));
    const intent = data.intent || "Other";
    const subject = data.subject || intent;
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "contact",
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: `[${intent}] ${subject}`,
        intent,
        message: data.message,
        subscribe: Boolean(data.subscribe),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(friendlyMessage(payload.error, "Message could not be sent."));
    form.reset();
    if (status) status.innerHTML = `<p class="inline-status">${escapeHtml(payload.message || "Message sent. We’ll be in touch.")}</p>`;
  } catch (error) {
    if (status) status.innerHTML = `<p class="inline-status inline-status--error">${escapeHtml(friendlyMessage(error, "Message could not be sent. Try again."))}</p>`;
  } finally {
    if (button) button.disabled = false;
  }
}

function updateFabElevate() {
  if (page !== "home") return;
  const controls = $(".hero-controls");
  const bag = $(".floating-bag");
  const concierge = $(".floating-concierge");
  if (!controls || !bag) return;
  const rect = controls.getBoundingClientRect();
  const zoneLeft = window.innerWidth - 140;
  const zoneTop = window.innerHeight - 220;
  const nearFabs = rect.right > zoneLeft && rect.bottom > zoneTop && rect.top < window.innerHeight && rect.left < window.innerWidth;
  bag.classList.toggle("floating--elevated", nearFabs);
  concierge?.classList.toggle("floating--elevated", nearFabs);
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
  const accountToggle = event.target.closest("[data-account-toggle]");
  const copyChat = event.target.closest("[data-copy-chat]");
  const editChat = event.target.closest("[data-edit-chat]");
  if (heroSwipeHandled && event.target.closest("[data-hero-link]")) {
    event.preventDefault();
    heroSwipeHandled = false;
    return;
  }
  if (accountToggle) {
    const menu = accountToggle.closest("[data-account-menu]");
    const dropdown = menu?.querySelector("[data-account-dropdown]");
    const openMenu = dropdown?.hidden;
    closeAccountMenu();
    if (dropdown && openMenu) {
      dropdown.hidden = false;
      accountToggle.setAttribute("aria-expanded", "true");
    }
    return;
  }
  if (!event.target.closest("[data-account-menu]")) closeAccountMenu();
  if (event.target.closest("[data-clear-chat]")) {
    clearChat();
    return;
  }
  if (event.target.closest("[data-handoff-continue]")) {
    continueHandoff();
    return;
  }
  if (event.target.closest("[data-handoff-dismiss]")) {
    dismissHandoff();
    return;
  }
  const giftAsk = event.target.closest("[data-gift-ask]");
  if (giftAsk) {
    const seed = giftAsk.dataset.chatSeed || "I want to send a gift to a few people";
    window.setTimeout(() => {
      const form = $("[data-chat-form]");
      if (form?.elements?.message && !form.elements.message.value) form.elements.message.value = seed;
    }, 350);
  }
  if (copyChat) {
    const bubble = copyChat.closest(".chat-message");
    const text = $("p", bubble)?.textContent || "";
    navigator.clipboard?.writeText(text).then(() => toast("Copied."), () => toast("Could not copy.", "error"));
    return;
  }
  if (editChat) {
    const bubble = editChat.closest(".chat-message");
    const text = $("p", bubble)?.textContent || "";
    const form = $("[data-chat-form]");
    if (form) {
      form.elements.message.value = text;
      form.elements.message.focus();
    }
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
    closeAccountMenu();
    signOutUser().catch(() => {});
    signOut();
    state.account = null;
    state.accountMode = "signin";
    renderAccount();
    toast("Signed out.");
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
  if (event.target.matches("[data-global-search]")) {
    renderSearch(event.target.value);
    const panel = event.target.closest(".header-search")?.querySelector("[data-search-results]");
    if (panel) panel.hidden = !String(event.target.value || "").trim();
  }
  if (event.target.matches("[data-shop-search]")) { state.filters.query = event.target.value; renderShop(); }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-shop-sort]")) { state.filters.sort = event.target.value; renderShop(); }
  if (event.target.matches("[data-price-filter]")) { state.filters.price = event.target.value; renderShop(); }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-newsletter]")) { event.preventDefault(); await handleNewsletter(event.target); }
  if (event.target.matches("[data-contact-form]")) { event.preventDefault(); await handleContact(event.target); }
  if (event.target.matches("[data-checkout-form]")) { event.preventDefault(); submitCheckout(event.target); }
  if (event.target.matches("[data-account-form]")) { event.preventDefault(); await submitAccount(event.target); }
  if (event.target.matches("[data-chat-form]")) { event.preventDefault(); await submitChat(event.target); }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAccountMenu();
    if (!$("[data-handoff-modal]")?.hidden) dismissHandoff();
    else closeDrawer();
  }
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
  try {
    const user = await waitForAuth();
    if (user) state.account = accountFromUser(user) || getCurrentAccount();
  } catch {
    state.account = getCurrentAccount();
  }
  shell();
  restoreChatUi();
  const params = new URLSearchParams(location.search);
  const paymentReturn = page === "checkout" && isCheckoutPaymentReturn(params);
  if (paymentReturn) {
    const reference = checkoutReferenceFromParams(params);
    showCheckoutConfirming(reference);
    try {
      await confirmPaidOrder(reference);
    } catch (error) {
      showCheckoutConfirmError(friendlyMessage(error, "Order could not be confirmed."));
    }
  } else {
    applyManagedContent();
  }
  if (page === "shop") readShopUrl();
  renderFeatured();
  renderJournal();
  renderBlogPage();
  renderShop();
  renderProductPage();
  renderGiftingPage();
  renderCart();
  if (!paymentReturn) {
    configureGiftCheckoutUi();
    renderCheckoutSummary();
    configureCheckoutSummary();
    enhanceCustomSelects(document);
  }
  initContactWizard();
  renderAccount();
  configureMobileDisclosures();
  startHeroAutoplay();
  updateFabElevate();
  window.addEventListener("scroll", updateFabElevate, { passive: true });
  window.addEventListener("resize", updateFabElevate);
  // Checkout already shows delivery fields and its order review; leave optional help closed.
  window.requestAnimationFrame(startPageMotion);
}

boot();
