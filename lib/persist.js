import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { Storage } from "@google-cloud/storage";

function shelfFile() {
  return process.env.YODLA_SHELF_PATH || join(process.cwd(), "data", "shelf.json");
}
const UPLOAD_DIR = join(process.cwd(), "assets", "uploads");
function shelfObject() {
  return process.env.YODLA_GCS_SHELF_OBJECT || "content/yodla-shelf.json";
}

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export function persistStatus() {
  if (process.env.YODLA_GCS_BUCKET) return { durable: true, driver: "gcs" };
  return { durable: true, driver: "file" };
}

let storage;

function gcsBucket() {
  if (!process.env.YODLA_GCS_BUCKET) return null;
  storage ||= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
  return storage.bucket(process.env.YODLA_GCS_BUCKET);
}

async function readFileSafe(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function loadShelf({ versioned = false } = {}) {
  const bucket = gcsBucket();
  if (bucket) {
    const file = bucket.file(shelfObject());
    let metadata;
    try {
      [metadata] = await file.getMetadata();
    } catch (error) {
      if (Number(error.code) !== 404) throw error;
      return versioned ? { payload: null, generation: 0 } : null;
    }
    const [bytes] = await bucket.file(shelfObject(), { generation: metadata.generation }).download();
    const payload = JSON.parse(bytes.toString("utf8"));
    return versioned ? { payload, generation: metadata.generation } : payload;
  }
  const bytes = await readFileSafe(shelfFile());
  const payload = bytes ? JSON.parse(bytes.toString("utf8")) : null;
  return versioned ? { payload } : payload;
}

export async function saveShelf(payload, { generation } = {}) {
  const json = JSON.stringify(payload);
  const bucket = gcsBucket();
  if (bucket) {
    await bucket.file(shelfObject()).save(json, {
      contentType: "application/json; charset=utf-8",
      resumable: false,
      ...(generation === undefined ? {} : { preconditionOpts: { ifGenerationMatch: generation } }),
      metadata: { cacheControl: "no-store" },
    });
    return persistStatus();
  }
  await mkdir(dirname(shelfFile()), { recursive: true });
  const temporary = `${shelfFile()}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, json);
    await rename(temporary, shelfFile());
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return persistStatus();
}

export async function saveUpload(bytes, contentType, filename = "yodla-image") {
  const extension = EXT[contentType] || extname(filename) || ".jpg";
  const safe = String(filename || "yodla-image").replace(/[^A-Za-z0-9._-]/g, "-").replace(/\.[^.]+$/, "");
  const name = `${Date.now()}-${safe}${extension}`;
  const bucket = gcsBucket();
  if (bucket) {
    const pathname = `uploads/${name}`;
    await bucket.file(pathname).save(bytes, {
      contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
    return { url: `/api/uploads/${encodeURIComponent(name)}`, pathname };
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), bytes);
  return { url: `assets/uploads/${name}`, pathname: `assets/uploads/${name}` };
}

export async function loadUpload(nameValue) {
  const name = String(nameValue || "");
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  const bucket = gcsBucket();
  if (bucket) {
    const file = bucket.file(`uploads/${name}`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [[bytes], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);
    return { bytes, contentType: metadata.contentType || "application/octet-stream" };
  }
  const bytes = await readFileSafe(join(UPLOAD_DIR, name));
  if (!bytes) return null;
  const type = Object.entries(EXT).find(([, extension]) => extension === extname(name).toLowerCase())?.[0];
  return { bytes, contentType: type || "application/octet-stream" };
}
