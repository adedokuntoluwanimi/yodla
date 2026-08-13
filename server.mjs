import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 4173);
const types = {
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp"
};

createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const safePath = normalize(requestPath).replace(/^([/\\])+/, "");
  const candidate = resolve(join(root, safePath || "index.html"));
  const file = candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : requestPath === "/" || !extname(requestPath) ? join(root, "index.html") : null;

  if (!file || !existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Yodla is running at http://localhost:${port}`));
