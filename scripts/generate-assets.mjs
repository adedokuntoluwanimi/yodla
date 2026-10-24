import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const responsiveDirectory = join("assets", "products", "responsive");
mkdirSync(responsiveDirectory, { recursive: true });

const heroImages = [
  ["hero-celebration", join("assets", "products", "originals", "celebration-set.png")],
  ["hero-dinner", join("assets", "products", "originals", "hero-dinner.png")],
  ["hero-hosting", join("assets", "products", "originals", "hero-hosting.png")],
  ["hero-zero", join("assets", "products", "originals", "hero-zero.png")],
];

await Promise.all(heroImages.flatMap(([name, source]) => [480, 900].flatMap((width) => {
  const image = sharp(source).resize({ width, withoutEnlargement: true });
  return [
    image.clone().avif({ quality: 58, effort: 5 }).toFile(join(responsiveDirectory, `${name}-${width}.avif`)),
    image.clone().webp({ quality: 82, effort: 5 }).toFile(join(responsiveDirectory, `${name}-${width}.webp`)),
  ];
})));

const brandDirectory = join("assets", "brand");
mkdirSync(brandDirectory, { recursive: true });
const logoSource = join("assets", "logo.png");
await sharp(logoSource).resize(180, 180, { fit: "contain", background: { r: 251, g: 248, b: 240, alpha: 1 } }).png().toFile(join(brandDirectory, "apple-touch-icon.png"));
await sharp(logoSource).resize(64, 64, { fit: "contain", background: { r: 251, g: 248, b: 240, alpha: 1 } }).png().toFile(join(brandDirectory, "favicon.png"));
const iconDirectory = mkdtempSync(join(tmpdir(), "yodla-favicon-"));
try {
  const iconPngs = await Promise.all([16, 32, 48].map(async (size) => {
    const path = join(iconDirectory, `favicon-${size}.png`);
    await sharp(logoSource).resize(size, size, { fit: "contain", background: { r: 251, g: 248, b: 240, alpha: 1 } }).png().toFile(path);
    return path;
  }));
  writeFileSync(join(brandDirectory, "favicon.ico"), await pngToIco(iconPngs));
} finally {
  rmSync(iconDirectory, { recursive: true, force: true });
}
// Keep SVG as a PNG-backed fallback link target for older build expectations.
writeFileSync(join(brandDirectory, "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="/favicon.png" width="64" height="64"/></svg>`);

console.log("Generated responsive hero images and Yodla browser icons from logo.png.");
