import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const output = "public";
const modules = readdirSync("js").filter((name) => name.endsWith(".js")).sort();
const hash = createHash("sha256").update(readFileSync("css/styles.css"));
for (const name of modules) hash.update(name).update(readFileSync(join("js", name)));
const assetVersion = hash.digest("hex").slice(0, 16);
const brandIcons = ["favicon.svg", "favicon.ico", "favicon.png", "apple-touch-icon.png"];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const directory of ["assets", "css", "js"]) cpSync(directory, join(output, directory), { recursive: true, force: true });
const versionedModules = join(output, "js", assetVersion);
mkdirSync(versionedModules, { recursive: true });
for (const file of modules) cpSync(join("js", file), join(versionedModules, file));
writeFileSync(join(output, "asset-version.txt"), assetVersion);
mkdirSync(join(output, "admin"), { recursive: true });
for (const file of ["index.html", "app.js", "styles.css"]) cpSync(join("admin", file), join(output, "admin", file), { force: true });
for (const file of brandIcons) cpSync(join("assets", "brand", file), join(output, file), { force: true });
if (existsSync("robots.txt")) cpSync("robots.txt", join(output, "robots.txt"), { force: true });
for (const file of readdirSync("pages").filter((name) => name.endsWith(".html"))) {
  const outputPath = join(output, file);
  cpSync(join("pages", file), outputPath, { force: true });
  const html = readFileSync(outputPath, "utf8")
    .replace("</head>", `<link rel="icon" href="/favicon.png" type="image/png"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="yodla-build" content="${assetVersion}"></head>`)
    .replaceAll("css/styles.css", `css/styles.css?v=${assetVersion}`)
    .replaceAll("js/main.js", `js/${assetVersion}/main.js`)
    .replaceAll("assets/icons.svg#", `assets/icons.svg?v=${assetVersion}#`);
  writeFileSync(outputPath, html);
}
