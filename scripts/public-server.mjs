import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve, sep } from "node:path";
import concierge from "../api/concierge.js";
import content from "../api/content.js";
import legacy from "../api/legacy.js";
import llms from "../api/llms.js";
import render from "../api/render.js";
import rss from "../api/rss.js";
import sitemap from "../api/sitemap.js";
import { getPublishedBlog, getPublishedProduct } from "../lib/content-service.js";
import { publicSiteUrl, renderContentPage, renderNotFound } from "../lib/seo-render.js";

const root = resolve("public");
const port = Number(process.env.PORT || 8080);
const types = {
  ".avif": "image/avif", ".css": "text/css; charset=utf-8", ".gif": "image/gif",
  ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp", ".xml": "application/xml; charset=utf-8",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store", ...headers });
  if (response.req?.method === "HEAD") return response.end();
  response.end(body);
}

function isInsideRoot(path) {
  const child = relative(root, path);
  return child && child !== ".." && !child.startsWith(`..${sep}`) && !resolve(path).includes(`${sep}admin${sep}`);
}

function staticFile(pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidates = [resolve(root, requested)];
  if (!extname(requested)) candidates.push(resolve(root, `${requested}.html`));
  return candidates.find((candidate) => isInsideRoot(candidate) && existsSync(candidate) && statSync(candidate).isFile());
}

const apiHandlers = new Map([
  ["/api/content", content], ["/api/concierge", concierge], ["/api/render", render],
  ["/api/sitemap", sitemap], ["/api/rss", rss], ["/api/llms", llms],
  ["/sitemap.xml", sitemap], ["/rss.xml", rss], ["/llms.txt", llms],
]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/health" || pathname === "/healthz") return send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) return send(response, 404, "Not found");

    if (pathname === "/robots.txt") {
      const body = `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${publicSiteUrl()}/sitemap.xml\n`;
      return send(response, 200, body, "text/plain; charset=utf-8");
    }

    if (pathname === "/product.html" || pathname === "/product") {
      url.searchParams.set("type", "product");
      request.url = `${pathname}?${url.searchParams}`;
      return legacy(request, response);
    }
    if (pathname === "/blog.html" || pathname === "/blog") {
      url.searchParams.set("type", "blog");
      request.url = `${pathname}?${url.searchParams}`;
      return legacy(request, response);
    }

    const apiHandler = apiHandlers.get(pathname);
    if (apiHandler) return apiHandler(request, response);

    const contentMatch = pathname.match(/^\/(products|journal)\/([^/]+)\/?$/);
    if ((request.method === "GET" || request.method === "HEAD") && contentMatch) {
      const type = contentMatch[1] === "journal" ? "blog" : "product";
      const result = type === "blog" ? await getPublishedBlog(contentMatch[2]) : await getPublishedProduct(contentMatch[2]);
      return send(response, result.document ? 200 : 404, result.document ? renderContentPage(result.document, type) : renderNotFound(type), "text/html; charset=utf-8");
    }

    if (request.method !== "GET" && request.method !== "HEAD") return send(response, 405, "Method not allowed", "text/plain; charset=utf-8", { Allow: "GET, HEAD" });
    const file = staticFile(pathname);
    if (!file) return send(response, 404, "Not found");
    const contentType = types[extname(file).toLowerCase()] || "application/octet-stream";
    const immutable = url.searchParams.has("v") && /\.(?:avif|css|ico|js|png|svg|webp)$/i.test(file);
    const cacheControl = immutable ? "public, max-age=31536000, immutable" : contentType.startsWith("text/html") ? "no-store" : "public, max-age=86400";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": cacheControl, "X-Content-Type-Options": "nosniff" });
    if (request.method === "HEAD") return response.end();
    createReadStream(file).pipe(response);
  } catch (error) {
    console.error(JSON.stringify({ severity: "ERROR", event: "request_failed", reason: error?.name || "Error" }));
    if (!response.headersSent) return send(response, 500, "Something went wrong");
    response.end();
  }
}).listen(port, "0.0.0.0", () => console.log(`Yodla public storefront listening on ${port}`));
