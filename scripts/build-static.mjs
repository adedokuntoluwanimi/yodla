import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const output = "public";
const assetVersion = "20260825-1";
const brandIcons = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"];
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const directory of ["assets", "css", "js"]) cpSync(directory, join(output, directory), { recursive: true, force: true });
mkdirSync(join(output, "admin"), { recursive: true });
for (const file of ["index.html", "app.js", "styles.css"]) cpSync(join("admin", file), join(output, "admin", file), { force: true });
for (const file of brandIcons) cpSync(join("assets", "brand", file), join(output, file), { force: true });
if (existsSync("robots.txt")) cpSync("robots.txt", join(output, "robots.txt"), { force: true });
for (const file of readdirSync("pages").filter((name) => name.endsWith(".html"))) {
  const outputPath = join(output, file);
  cpSync(join("pages", file), outputPath, { force: true });
  const html = readFileSync(outputPath, "utf8")
    .replace("</head>", `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="yodla-build" content="${assetVersion}"></head>`)
    .replaceAll("css/styles.css", `css/styles.css?v=${assetVersion}`)
    .replaceAll("js/main.js", `js/main.js?v=${assetVersion}`)
    .replaceAll("assets/icons.svg#", `assets/icons.svg?v=${assetVersion}#`);
  writeFileSync(outputPath, html);
}
