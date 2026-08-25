import { loadUpload } from "../lib/persist.js";
import { sendText } from "../lib/http.js";

export default async function handler(request, response, name) {
  if (!["GET", "HEAD"].includes(request.method)) return sendText(response, 405, "Method not allowed.", "text/plain; charset=utf-8", { Allow: "GET, HEAD" });
  const upload = await loadUpload(name);
  if (!upload) return sendText(response, 404, "Not found.", "text/plain; charset=utf-8", { "Cache-Control": "no-store" });
  response.statusCode = 200;
  response.setHeader("Content-Type", upload.contentType);
  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "HEAD") return response.end();
  return response.end(upload.bytes);
}
