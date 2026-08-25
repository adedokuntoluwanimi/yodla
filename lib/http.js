export function sendJson(response, status, payload, headers = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
  response.end(JSON.stringify(payload));
}

export function sendText(response, status, body, contentType, headers = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
  response.end(body);
}

export async function readJson(request, limit = 4_000_000) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function requestUrl(request) {
  return new URL(request.url, `https://${request.headers.host || "yodla-fwy32oha6q-uc.a.run.app"}`);
}
