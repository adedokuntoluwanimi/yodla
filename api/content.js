import { getPublishedContent } from "../lib/content-service.js";
import { sendJson } from "../lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
  const payload = await getPublishedContent();
  return sendJson(response, 200, payload, {
    "Cache-Control": "no-store",
    "X-Yodla-Content-Source": payload.meta.source,
  });
}
