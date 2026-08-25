import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import adminContent from "../admin/api/content.js";
import adminDocument from "../admin/api/document.js";
import adminPreview from "../admin/api/preview.js";
import adminUpload from "../admin/api/upload.js";
import { getConciergeResponse } from "../js/concierge-api.js";
import { getPublishedBlog, getPublishedContent, getPublishedProduct } from "../lib/content-service.js";
import { renderContentPage, renderLlmsTxt, renderNotFound } from "../lib/seo-render.js";

const root = resolve(".");
const port = Number(process.env.PORT || 4173);
const types = {
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function concierge(request, response) {
  try {
    const body = await readJson(request);
    const content = await getPublishedContent();
    const result = await getConciergeResponse(body.message, { products: content.products });
    return sendJson(response, result.status, result.payload);
  } catch (error) {
    console.error("Concierge request error:", error.message);
    return sendJson(response, 400, { error: "That request could not be read. Please try again." });
  }
}

const adminHandlers = {
  "/admin/api/content": adminContent,
  "/admin/api/document": adminDocument,
  "/admin/api/preview": adminPreview,
  "/admin/api/upload": adminUpload,
};

createServer(async (request, response) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  if (adminHandlers[parsedUrl.pathname]) return adminHandlers[parsedUrl.pathname](request, response);
  if (parsedUrl.pathname === "/admin" || parsedUrl.pathname === "/admin/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return createReadStream(join(root, "admin", "index.html")).pipe(response);
  }
  if (parsedUrl.pathname.startsWith("/admin/")) {
    const adminFile = resolve(join(root, "admin", parsedUrl.pathname.slice("/admin/".length)));
    if (adminFile.startsWith(resolve(join(root, "admin"))) && existsSync(adminFile) && statSync(adminFile).isFile()) {
      response.writeHead(200, { "Content-Type": types[extname(adminFile).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      return createReadStream(adminFile).pipe(response);
    }
  }
  if (request.method === "GET" && parsedUrl.pathname === "/api/content") {
    return sendJson(response, 200, await getPublishedContent());
  }
  if (request.method === "GET" && (parsedUrl.pathname === "/llms.txt" || parsedUrl.pathname === "/api/llms")) {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(renderLlmsTxt(await getPublishedContent()));
    return;
  }
  if (request.method === "POST" && new URL(request.url, `http://${request.headers.host}`).pathname === "/api/concierge") {
    await concierge(request, response);
    return;
  }
  const contentMatch = parsedUrl.pathname.match(/^\/(products|journal)\/([^/]+)\/?$/);
  if (request.method === "GET" && contentMatch) {
    const type = contentMatch[1] === "journal" ? "blog" : "product";
    const slug = decodeURIComponent(contentMatch[2]);
    const result = type === "blog" ? await getPublishedBlog(slug) : await getPublishedProduct(slug);
    response.writeHead(result.document ? 200 : 404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(result.document ? renderContentPage(result.document, type) : renderNotFound(type));
    return;
  }
  const requestPath = decodeURIComponent(parsedUrl.pathname);
  const safePath = normalize(requestPath).replace(/^([/\\])+/, "");
  const brandIcons = new Set(["favicon.svg", "favicon.ico", "apple-touch-icon.png"]);
  const brandFile = brandIcons.has(safePath) ? resolve(join(root, "assets", "brand", safePath)) : null;
  const pageName = requestPath === "/" || !extname(requestPath) ? "index.html" : safePath.endsWith(".html") ? safePath : null;
  const pageFile = pageName ? resolve(join(root, "pages", pageName)) : null;
  const rootCandidate = resolve(join(root, safePath || "index.html"));
  const file = [brandFile, pageFile, rootCandidate].find((candidate) => candidate && candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()) || null;

  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Yodla is running at http://localhost:${port}`));
