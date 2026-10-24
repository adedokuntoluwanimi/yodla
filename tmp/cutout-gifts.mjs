import sharp from "sharp";

const names = ["ribbon", "note", "selection", "finished"];
const srcDir = "C:/Users/Tolu/.cursor/projects/c-Users-Tolu-Documents-Ini-Yodla/assets";

function isBackdrop(r, g, b) {
  // near-white / light grey plate from image generation
  return r > 235 && g > 235 && b > 235;
}

for (const name of names) {
  const input = `${srcDir}/gift-${name}-cutout.png`;
  const output = `assets/gifting/gift-${name}-cutout.webp`;
  const { data, info } = await sharp(input)
    .resize(900, 1200, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const queue = [];

  const clear = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    const i = p * 4;
    if (data[i + 3] === 0) return;
    if (!isBackdrop(data[i], data[i + 1], data[i + 2])) return;
    data[i + 3] = 0;
    queue.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    clear(x, 0);
    clear(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    clear(0, y);
    clear(width - 1, y);
  }
  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    clear(x + 1, y);
    clear(x - 1, y);
    clear(x, y + 1);
    clear(x, y - 1);
  }

  // soft fringe on leftover near-white
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) data[i + 3] = 0;
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(output);

  const check = await sharp(output).metadata();
  console.log(name, { hasAlpha: check.hasAlpha, w: check.width, h: check.height });
}
