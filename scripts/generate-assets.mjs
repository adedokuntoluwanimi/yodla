import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const faviconSource = readFileSync(join(brandDirectory, "favicon.svg"));
await sharp(faviconSource).resize(180, 180).png().toFile(join(brandDirectory, "apple-touch-icon.png"));
const iconDirectory = mkdtempSync(join(tmpdir(), "yodla-favicon-"));
try {
  const iconPngs = await Promise.all([16, 32, 48].map(async (size) => {
    const path = join(iconDirectory, `favicon-${size}.png`);
    await sharp(faviconSource).resize(size, size).png().toFile(path);
    return path;
  }));
  writeFileSync(join(brandDirectory, "favicon.ico"), await pngToIco(iconPngs));
} finally {
  rmSync(iconDirectory, { recursive: true, force: true });
}

console.log("Generated responsive hero images and Yodla browser icons.");
