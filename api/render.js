import { getPublishedBlog, getPublishedProduct } from "../lib/content-service.js";
import { requestUrl, sendText } from "../lib/http.js";
import { renderContentPage, renderNotFound } from "../lib/seo-render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET" });
  const url = requestUrl(request);
  const type = url.searchParams.get("type") === "blog" ? "blog" : "product";
  const slug = String(url.searchParams.get("slug") || "").trim();
  const result = type === "blog" ? await getPublishedBlog(slug) : await getPublishedProduct(slug);
  if (!result.document) return sendText(response, 404, renderNotFound(type), "text/html; charset=utf-8", { "Cache-Control": "no-store" });
  return sendText(response, 200, renderContentPage(result.document, type), "text/html; charset=utf-8", {
    "Cache-Control": "no-store",
    "X-Yodla-Content-Source": result.content.meta.source,
  });
}
