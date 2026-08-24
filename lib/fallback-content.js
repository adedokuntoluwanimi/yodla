import { BLOG_POSTS } from "../js/blogs.js";
import { CATEGORIES, LOCATIONS, PRODUCTS } from "../js/catalog.js";
import { DEFAULT_HOME, DEFAULT_SITE } from "../js/site-content.js";
import { normalizeBlog, normalizeProduct } from "./content-model.js";

export function getFallbackContent(reason = "static mode") {
  return {
    products: PRODUCTS.map((product, index) => normalizeProduct({
      ...product,
      slug: product.id,
      featuredOrder: index,
      seo: { title: `${product.name} — Yodla`.slice(0, 70), description: String(product.description || "").slice(0, 180), focusKeyphrase: product.name },
      geo: { title: `${product.name} — Yodla`.slice(0, 70), description: String(product.description || "").slice(0, 180), focusKeyphrase: product.name },
    })),
    blogs: BLOG_POSTS.map((post) => normalizeBlog({
      ...post,
      slug: post.id,
      author: "Yodla",
      imageAlt: post.title,
      seo: { title: `${post.title} — Yodla Journal`.slice(0, 70), description: post.excerpt, focusKeyphrase: post.title.replace(/[.?!]$/, "") },
      geo: { title: `${post.title} — Yodla Journal`.slice(0, 70), description: post.excerpt, focusKeyphrase: post.title.replace(/[.?!]$/, "") },
    })),
    categories: [...CATEGORIES],
    locations: [...LOCATIONS],
    site: structuredClone(DEFAULT_SITE),
    home: structuredClone(DEFAULT_HOME),
    meta: { source: "static", stale: reason !== "static mode", message: reason === "static mode" ? "Showing the bundled Yodla catalogue." : "Live content is unavailable. Showing the bundled Yodla catalogue.", reason },
  };
}
