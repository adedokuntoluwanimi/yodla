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
    const body = await readJson(request, 16_000);
    const content = await getPublishedContent();
    const result = await getConciergeResponse(body.message, {
      products: content.products,
      clientKey: clientKey(request),
      sessionId: body.sessionId || clientKey(request),
      history: Array.isArray(body.history) ? body.history : [],
      orderDraft: body.orderDraft || null,
      bag: Array.isArray(body.bag) ? body.bag : undefined,
      location: body.location || "",
      page: body.page || "",
      account: body.account && typeof body.account === "object" ? body.account : null,
      shopperKey: body.shopperKey || body.account?.email || "",
      gift: body.gift && typeof body.gift === "object" ? body.gift : null,
    });
    return sendJson(response, result.status, result.payload, { "Cache-Control": "no-store" });
  } catch {
    return sendJson(response, 400, { error: "That request could not be read. Please try again." }, { "Cache-Control": "no-store" });
  }
}
