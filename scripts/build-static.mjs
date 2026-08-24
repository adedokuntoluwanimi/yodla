import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const output = "public";
const assetVersion = "20260824-1";
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const directory of ["assets", "css", "js"]) cpSync(directory, join(output, directory), { recursive: true, force: true });
for (const file of readdirSync(".").filter((name) => name.endsWith(".html") || ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "robots.txt"].includes(name))) {
  cpSync(file, join(output, file), { force: true });
  if (file.endsWith(".html")) {
    const outputPath = join(output, file);
    const html = readFileSync(outputPath, "utf8")
      .replace("</head>", `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="yodla-build" content="${assetVersion}"></head>`)
      .replaceAll("css/styles.css", `css/styles.css?v=${assetVersion}`)
      .replaceAll("js/main.js", `js/main.js?v=${assetVersion}`)
      .replaceAll("assets/icons.svg#", `assets/icons.svg?v=${assetVersion}#`);
    writeFileSync(outputPath, html);
  }
}
