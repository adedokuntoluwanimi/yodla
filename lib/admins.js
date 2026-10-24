import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Storage } from "@google-cloud/storage";

const SEED_ADMIN = "adedokunt96@gmail.com";
const GCS_ADMINS = "content/yodla-admins.json";

function adminsFile() {
  return process.env.YODLA_ADMINS_PATH || join(process.cwd(), "data", "admins.json");
}

let storage;

function gcsBucket() {
  if (!process.env.YODLA_GCS_BUCKET) return null;
  storage ||= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
  return storage.bucket(process.env.YODLA_GCS_BUCKET);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function withSeed(emails) {
  const set = new Set((emails || []).map(normalizeEmail).filter(Boolean));
  set.add(SEED_ADMIN);
  return [...set].sort();
}

async function readFileSafe(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function loadAdmins() {
  const bucket = gcsBucket();
  if (bucket) {
    const file = bucket.file(GCS_ADMINS);
    const [exists] = await file.exists();
    if (!exists) {
      const seeded = withSeed([]);
      await saveAdmins(seeded);
      return seeded;
    }
    const [bytes] = await file.download();
    const parsed = JSON.parse(bytes.toString("utf8"));
    return withSeed(Array.isArray(parsed?.emails) ? parsed.emails : parsed);
  }
  const raw = await readFileSafe(adminsFile());
  if (!raw) {
    const seeded = withSeed([]);
    await saveAdmins(seeded);
    return seeded;
  }
  const parsed = JSON.parse(raw);
  return withSeed(Array.isArray(parsed?.emails) ? parsed.emails : parsed);
}

export async function saveAdmins(emails) {
  const payload = { emails: withSeed(emails), updatedAt: new Date().toISOString() };
  const json = JSON.stringify(payload, null, 2);
  const bucket = gcsBucket();
  if (bucket) {
    await bucket.file(GCS_ADMINS).save(json, {
      contentType: "application/json; charset=utf-8",
      resumable: false,
      metadata: { cacheControl: "no-store" },
    });
    return payload;
  }
  await mkdir(dirname(adminsFile()), { recursive: true });
  await writeFile(adminsFile(), json);
  return payload;
}

export async function isAdminEmail(email) {
  const admins = await loadAdmins();
  return admins.includes(normalizeEmail(email));
}

export async function addAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw Object.assign(new Error("Enter a valid email."), { status: 400 });
  const emails = await loadAdmins();
  if (emails.includes(normalized)) return emails;
  return (await saveAdmins([...emails, normalized])).emails;
}

export async function removeAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (normalized === SEED_ADMIN) throw Object.assign(new Error("The primary admin cannot be removed."), { status: 400 });
  const emails = await loadAdmins();
  return (await saveAdmins(emails.filter((item) => item !== normalized))).emails;
}

export { SEED_ADMIN, normalizeEmail };
