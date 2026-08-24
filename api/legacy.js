import { getPublishedBlog, getPublishedProduct } from "../lib/content-service.js";
import { requestUrl, sendText } from "../lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET" });
  const url = requestUrl(request);
  const type = url.searchParams.get("type") === "blog" ? "blog" : "product";
  const id = String(url.searchParams.get("id") || "");
  const result = type === "blog" ? await getPublishedBlog(id) : await getPublishedProduct(id);
  const fallback = type === "blog" ? "/journal.html" : "/shop.html";
  response.statusCode = result.document ? 308 : 302;
  response.setHeader("Location", result.document ? `/${type === "blog" ? "journal" : "products"}/${encodeURIComponent(result.document.slug)}` : fallback);
  response.setHeader("Cache-Control", "no-store");
  response.end();
}
