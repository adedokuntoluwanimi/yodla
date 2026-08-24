import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

function shelfFile() {
  return process.env.YODLA_SHELF_PATH || join(process.cwd(), "data", "shelf.json");
}
const UPLOAD_DIR = join(process.cwd(), "assets", "uploads");
const BLOB_SHELF = "yodla-shelf.json";

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export function persistStatus() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return { durable: true, driver: "blob" };
  if (process.env.VERCEL) return { durable: false, driver: "ephemeral" };
  return { durable: true, driver: "file" };
}

async function blobApi() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    return await import("@vercel/blob");
  } catch {
    return null;
  }
}

async function readFileSafe(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function loadShelf() {
  const blob = await blobApi();
  if (blob) {
    try {
      const { blobs } = await blob.list({ prefix: BLOB_SHELF, token: process.env.BLOB_READ_WRITE_TOKEN });
      const match = blobs.find((item) => item.pathname === BLOB_SHELF || item.pathname.endsWith(BLOB_SHELF));
      if (match?.url) {
        const response = await fetch(match.url);
        if (response.ok) return await response.json();
      }
    } catch (error) {
      console.error("Blob shelf read:", error.message);
    }
  }
  const bytes = await readFileSafe(shelfFile());
  return bytes ? JSON.parse(bytes.toString("utf8")) : null;
}

export async function saveShelf(payload) {
  const json = JSON.stringify(payload);
  const blob = await blobApi();
  if (blob) {
    await blob.put(BLOB_SHELF, json, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return persistStatus();
  }
  await mkdir(dirname(shelfFile()), { recursive: true });
  await writeFile(shelfFile(), json);
  return persistStatus();
}

export async function saveUpload(bytes, contentType, filename = "yodla-image") {
  const extension = EXT[contentType] || extname(filename) || ".jpg";
  const safe = String(filename || "yodla-image").replace(/[^A-Za-z0-9._-]/g, "-").replace(/\.[^.]+$/, "");
  const name = `${Date.now()}-${safe}${extension}`;
  const blob = await blobApi();
  if (blob) {
    const stored = await blob.put(`uploads/${name}`, bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: stored.url, pathname: stored.pathname };
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), bytes);
  return { url: `assets/uploads/${name}`, pathname: `assets/uploads/${name}` };
}
