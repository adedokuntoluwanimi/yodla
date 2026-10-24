import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { CATEGORIES, LOCATIONS, PRODUCTS } from "../js/catalog.js";
import { BLOG_POSTS } from "../js/blogs.js";
import { DEFAULT_HOME, DEFAULT_SITE } from "../js/site-content.js";

const root = resolve("dist");
const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const port = Number(process.env.PORT || option("--port") || 4180);
const host = option("--host") || "127.0.0.1";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".txt": "text/plain" };

createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/api/content") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ products: PRODUCTS, blogs: BLOG_POSTS, categories: CATEGORIES, locations: LOCATIONS, site: DEFAULT_SITE, home: DEFAULT_HOME }));
    return;
  }
  if (pathname === "/api/runtime-config") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ local_auth_bypass: false, firebase: {} }));
    return;
  }
  if (pathname.startsWith("/api/")) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Payments and messages are unavailable in local visual preview." }));
    return;
  }
  const requested = pathname === "/" ? "index.html" : pathname.startsWith("/products/") ? "product.html" : pathname.startsWith("/journal/") && pathname !== "/journal.html" ? "blog.html" : pathname.slice(1);
  const file = resolve(root, requested);
  const relative = file.slice(root.length);
  if ((relative && !relative.startsWith(sep)) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": `${types[extname(file)] || "application/octet-stream"}${[".html", ".js", ".css", ".txt"].includes(extname(file)) ? "; charset=utf-8" : ""}` });
  createReadStream(file).pipe(response);
}).listen(port, host, () => console.log(`Yodla gift experience preview: http://localhost:${port}`));
