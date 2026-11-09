import { BLOG_POSTS } from "./blogs.js";
import { CATEGORIES, LOCATIONS, PRODUCTS } from "./catalog.js";
import { DEFAULT_CONTENT_META, DEFAULT_HOME, DEFAULT_SITE } from "./site-content.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export const content = {
  site: clone(DEFAULT_SITE),
  home: clone(DEFAULT_HOME),
  meta: { ...DEFAULT_CONTENT_META },
  hampers: [],
  catalogueManaged: false,
};

export const STOREFRONT_NAV = [
  { label: "Shop All", href: "/shop.html" },
  { label: "Drinks", href: "/shop.html?section=drinks" },
  { label: "Gifting", href: "/gifting.html" },
  { label: "Cocktail & Mocktail Experience", href: "/shop.html?section=mixed" },
  { label: "Journal", href: "/journal.html" },
  { label: "Contact", href: "/contact.html" },
];

function replace(target, values) {
  if (!Array.isArray(values) || !values.length) return;
  target.splice(0, target.length, ...values);
}

export async function loadPublishedContent(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") return content;
  try {
    const response = await fetchImpl("/api/content", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Content request returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.products)) throw new Error("The catalogue could not be read.");
    PRODUCTS.splice(0, PRODUCTS.length, ...payload.products);
    content.catalogueManaged = Boolean(payload.catalogueManaged);
    content.hampers = Array.isArray(payload.hampers) ? payload.hampers : [];
    replace(BLOG_POSTS, payload.blogs);
    replace(CATEGORIES, payload.categories);
    replace(LOCATIONS, payload.locations);
    if (payload.site) Object.assign(content.site, payload.site);
    if (payload.home) Object.assign(content.home, payload.home);
    content.site.navigation = STOREFRONT_NAV;
    content.meta = {
      source: payload.meta?.source || "static",
      stale: Boolean(payload.meta?.stale),
      message: payload.meta?.message || "Content is up to date.",
    };
  } catch (error) {
    PRODUCTS.length = 0;
    content.hampers = [];
    content.catalogueManaged = true;
    content.site.navigation = STOREFRONT_NAV;
    content.meta = {
      source: "static",
      stale: true,
      message: "The catalogue is temporarily unavailable. Please reload to try again.",
      diagnostic: error.message,
    };
  }
  return content;
}
