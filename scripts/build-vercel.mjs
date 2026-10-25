import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "vercel-site");
const output = join(site, "dist");
const pages = ["index", "gifting", "shop", "product", "bag", "checkout", "journal", "blog", "account", "login", "contact", "help", "404"];
const version = "boutique-2";

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
mkdirSync(join(output, "assets"));
for (const directory of ["brand", "gifting", "products"]) cpSync(join(root, "assets", directory), join(output, "assets", directory), { recursive: true, force: true });
cpSync(join(site, "art"), join(output, "assets", "characters"), { recursive: true, force: true });
for (const file of ["icons.svg", "logo.png"]) cpSync(join(root, "assets", file), join(output, "assets", file));
cpSync(join(root, "css"), join(output, "css"), { recursive: true, force: true });
mkdirSync(join(output, "js"));
for (const file of readdirSync(join(root, "js")).filter((name) => name.endsWith(".js") && name !== "concierge-api.js")) {
  cpSync(join(root, "js", file), join(output, "js", file));
}
cpSync(join(root, "js", "vendor"), join(output, "js", "vendor"), { recursive: true, force: true });
for (const name of ["favicon.svg", "favicon.ico", "favicon.png", "apple-touch-icon.png"]) {
  const source = join(root, "assets", "brand", name);
  if (existsSync(source)) cpSync(source, join(output, name));
}
cpSync(join(site, "gift-club.css"), join(output, "css", "gift-club.css"));
cpSync(join(site, "experience.js"), join(output, "js", "experience.js"));

// The boutique is isolated to this branch's customer preview build.
mkdirSync(join(output, "js", "vendor", "three"), { recursive: true });
for (const file of ["three.module.js", "three.core.js"]) {
  cpSync(join(root, "node_modules", "three", "build", file.replace(".js", ".min.js")), join(output, "js", "vendor", "three", file));
}
cpSync(join(root, "node_modules", "three", "build", "three.core.min.js"), join(output, "js", "vendor", "three", "three.core.min.js"));
cpSync(join(root, "node_modules", "three", "examples", "jsm", "environments", "RoomEnvironment.js"), join(output, "js", "vendor", "three", "RoomEnvironment.js"));
cpSync(join(root, "node_modules", "three", "examples", "jsm", "utils", "BufferGeometryUtils.js"), join(output, "js", "vendor", "three", "BufferGeometryUtils.js"));
cpSync(join(root, "node_modules", "three", "LICENSE"), join(output, "js", "vendor", "three", "LICENSE.txt"));
for (const file of ["boutique.js", "boutique-scene.js", "boutique-performance.js", "boutique-icons.js", "boutique-music.js", "boutique-checkout.js", "boutique-order.js", "preview-only.js"]) cpSync(join(site, "boutique", file), join(output, "js", file));
cpSync(join(site, "boutique", "boutique.css"), join(output, "css", "boutique.css"));
cpSync(join(site, "boutique", "boutique-counter.css"), join(output, "css", "boutique-counter.css"));

for (const name of pages) {
  if (["index", "shop", "gifting"].includes(name)) {
    writeFileSync(join(output, `${name}.html`), readFileSync(join(site, "boutique", "store.html"), "utf8"));
    continue;
  }
  const custom = join(site, "pages", `${name}.html`);
  const source = existsSync(custom) ? custom : join(root, "pages", `${name}.html`);
  let html = readFileSync(source, "utf8");
  if (name === "product" || name === "blog") html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><base href="/">');
  if (name === "gifting") {
    html = html.replace(/<section class="hero" data-gift-hero>[\s\S]*?<\/section>/, readFileSync(join(site, "gifting-hero.html"), "utf8"));
    html = html.replace('<div class="shell gift-flow__inner">', `<div class="shell gift-flow__inner">${readFileSync(join(site, "gifting-preview.html"), "utf8")}`);
    html = html.replace("Gifting that<br><em>lands.</em>", "Let’s make<br><em>their moment.</em>");
  }
  if (name === "shop") {
    html = html.replace("Find your<br><em>next good pour.</em>", "Find their<br><em>kind of good.</em>")
      .replace("A focused edit for dinners, gifts, fridges and the nights without a plan.", "The bottles worth giving, sharing, and keeping for yourself. Find a good match here.")
      .replace("The shelves", "The giftable edit");
  }
  if (name === "account") {
    html = html.replace("Create or manage your Yodla prototype account.", "Keep your Yodla details close for easier gifting and checkout.")
      .replace("A good host<br><em>remembers.</em>", "Good gifts<br><em>start here.</em>")
      .replace("Save your details on this device for a quicker prototype checkout.", "Keep your details ready for the next person you want to surprise.");
  }
  if (name === "bag") html = html.replace("Everything coming to the table, in one place.", "Your picks, all in one place. Sending a gift? Make one in the gift studio.");
  if (name === "journal") html = html.replace("Useful notes for<br><em>better gatherings.</em>", "Little notes for<br><em>big feelings.</em>");
  html = html.replace("</head>", '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Syne:wght@500;600;700;800&display=swap" rel="stylesheet"></head>');
  html = html.replace("</head>", `<link rel="icon" href="/favicon.png" type="image/png"><link rel="stylesheet" href="/css/gift-club.css?v=${version}"></head>`);
  html = html.replace("</body>", `<script type="module" src="/js/experience.js?v=${version}"></script></body>`);
  if (name === "checkout") html = html.replace("</head>", '<link rel="stylesheet" href="/css/boutique-counter.css"></head>').replace("</body>", '<script type="module" src="/js/boutique-checkout.js"></script></body>');
  writeFileSync(join(output, `${name}.html`), html);
}

for (const file of readdirSync(join(output, "assets", "gifting"))) {
  if (file.endsWith(".tmp")) rmSync(join(output, "assets", "gifting", file));
}

writeFileSync(join(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
console.log(`Built ${pages.length} customer pages in ${output}`);
