import { body, json } from "../lib/http.js";
import { storeImage } from "../../lib/content-store.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(request, response) {
  if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." });
  try {
    const input = await body(request);
    if (!ALLOWED.has(input.contentType)) return json(response, 415, { error: "Upload a JPEG, PNG, or WebP image." });
    const bytes = Buffer.from(String(input.data || ""), "base64");
    if (!bytes.length || bytes.length > 3_000_000) return json(response, 413, { error: "Choose an image smaller than 3 MB." });
    const stored = await storeImage(bytes, input.contentType, String(input.filename || "yodla-image"));
    return json(response, 200, { image: stored.url, url: stored.url, kind: input.kind || "image" });
  } catch (error) {
    console.error("Admin image upload:", error.message);
    return json(response, 500, { error: "The image could not be uploaded. Try a smaller file." });
  }
}
