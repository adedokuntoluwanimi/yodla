import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import content from "../api/content.js";
import documentHandler from "../api/document.js";
import preview from "../api/preview.js";
import upload from "../api/upload.js";

const root = resolve(".");
const port = Number(process.env.PORT || 4174);
const handlers = { "/api/content": content, "/api/document": documentHandler, "/api/preview": preview, "/api/upload": upload };
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (handlers[pathname]) return handlers[pathname](request, response);
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const candidate = resolve(join(root, safe || "index.html"));
  const file = candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, "index.html");
  response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Yodla Shelf is running at http://localhost:${port}`));
