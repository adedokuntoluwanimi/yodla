import { getPublishedContent } from "../lib/content-service.js";
import { sendText } from "../lib/http.js";
import { publicSiteUrl } from "../lib/seo-render.js";

const xmlEscape = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]));

export default async function handler(request, response) {
  if (request.method !== "GET") return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET" });
  const content = await getPublishedContent();
  const base = publicSiteUrl();
  const items = content.blogs.map((post) => `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(`${base}/journal/${post.slug}`)}</link><guid>${xmlEscape(`${base}/journal/${post.slug}`)}</guid><description>${xmlEscape(post.excerpt)}</description>${post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : ""}</item>`).join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Yodla Journal</title><link>${xmlEscape(base)}</link><description>Useful notes for better gatherings.</description>${items}</channel></rss>`;
  return sendText(response, 200, body, "application/rss+xml; charset=utf-8", { "Cache-Control": "no-store" });
}
