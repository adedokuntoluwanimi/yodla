import { getPublishedContent } from "../lib/content-service.js";
import { sendText } from "../lib/http.js";
import { renderLlmsTxt } from "../lib/seo-render.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET" });
  const content = await getPublishedContent();
  return sendText(response, 200, renderLlmsTxt(content), "text/plain; charset=utf-8", { "Cache-Control": "no-store" });
}
