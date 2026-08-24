import { getPublishedContent } from "../lib/content-service.js";
import { sendText } from "../lib/http.js";
import { publicSiteUrl } from "../lib/seo-render.js";

const xmlEscape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]));

export default async function handler(request, response) {
  if (request.method !== "GET") return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET" });
  const content = await getPublishedContent();
  const base = publicSiteUrl();
  const urls = ["/", "/shop.html", "/journal.html", "/help.html"]
    .concat(content.products.map((product) => `/products/${product.slug}`))
    .concat(content.blogs.map((post) => `/journal/${post.slug}`));
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((path) => `<url><loc>${xmlEscape(`${base}${path}`)}</loc></url>`).join("")}</urlset>`;
  return sendText(response, 200, body, "application/xml; charset=utf-8", { "Cache-Control": "no-store" });
}
