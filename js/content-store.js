import { BLOG_POSTS } from "./blogs.js";
import { CATEGORIES, LOCATIONS, PRODUCTS } from "./catalog.js";
import { DEFAULT_CONTENT_META, DEFAULT_HOME, DEFAULT_SITE } from "./site-content.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

export const content = {
  site: clone(DEFAULT_SITE),
  home: clone(DEFAULT_HOME),
  meta: { ...DEFAULT_CONTENT_META },
};

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
    replace(PRODUCTS, payload.products);
    replace(BLOG_POSTS, payload.blogs);
    replace(CATEGORIES, payload.categories);
    replace(LOCATIONS, payload.locations);
    if (payload.site) Object.assign(content.site, payload.site);
    if (payload.home) Object.assign(content.home, payload.home);
    content.meta = {
      source: payload.meta?.source || "static",
      stale: Boolean(payload.meta?.stale),
      message: payload.meta?.message || "Content is up to date.",
    };
  } catch (error) {
    content.meta = {
      source: "static",
      stale: true,
      message: "Live catalogue updates are temporarily unavailable. Showing the last bundled shelf.",
      diagnostic: error.message,
    };
  }
  return content;
}
