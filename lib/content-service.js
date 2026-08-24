import { getFallbackContent } from "./fallback-content.js";
import { getPublishedSnapshot } from "./content-store.js";
import { normalizeHeroSlides } from "../js/hero-carousel.js";

function withHeroSlides(content) {
  const home = content?.home || {};
  return { ...content, home: { ...home, heroSlides: normalizeHeroSlides(home) } };
}

export async function getPublishedContent() {
  try {
    return withHeroSlides(await getPublishedSnapshot());
  } catch (error) {
    console.error("Published content fallback:", error.message);
    return withHeroSlides(getFallbackContent(error.message));
  }
}

export async function getPublishedProduct(slug) {
  const content = await getPublishedContent();
  return { content, document: content.products.find((product) => product.slug === slug || product.id === slug) || null };
}

export async function getPublishedBlog(slug) {
  const content = await getPublishedContent();
  return { content, document: content.blogs.find((post) => post.slug === slug || post.id === slug) || null };
}
