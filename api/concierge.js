import { getConciergeResponse } from "../js/concierge-api.js";
import { getPublishedContent } from "../lib/content-service.js";
import { readJson, sendJson } from "../lib/http.js";

function clientKey(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket?.remoteAddress || "anonymous";
}

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST", "Cache-Control": "no-store" });
  try {
    const body = await readJson(request, 2_000);
    const content = await getPublishedContent();
    const result = await getConciergeResponse(body.message, { products: content.products, clientKey: clientKey(request) });
    return sendJson(response, result.status, result.payload, { "Cache-Control": "no-store" });
  } catch {
    return sendJson(response, 400, { error: "That request could not be read. Please try again." }, { "Cache-Control": "no-store" });
  }
}
