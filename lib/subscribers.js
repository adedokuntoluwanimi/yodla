import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

const GCS_SUBSCRIBERS = "content/yodla-subscribers.json";
const GCS_CONTACTS = "content/yodla-contacts.json";
let contactWrites = Promise.resolve();

function subscribersFile() {
  return process.env.YODLA_SUBSCRIBERS_PATH || join(process.cwd(), "data", "subscribers.json");
}

function contactsFile() {
  return process.env.YODLA_CONTACTS_PATH || join(process.cwd(), "data", "contacts.json");
}

let storage;
function gcsBucket() {
  if (!process.env.YODLA_GCS_BUCKET) return null;
  storage ||= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
  return storage.bucket(process.env.YODLA_GCS_BUCKET);
}

async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function loadCollection(gcsPath, localPath) {
  const bucket = gcsBucket();
  if (bucket) {
    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();
    if (!exists) return { items: [] };
    const [bytes] = await file.download();
    const parsed = JSON.parse(bytes.toString("utf8"));
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  }
  return readJsonFile(localPath, { items: [] });
}

async function saveCollection(gcsPath, localPath, payload, generation) {
  const json = JSON.stringify(payload, null, 2);
  const bucket = gcsBucket();
  if (bucket) {
    await bucket.file(gcsPath).save(json, {
      contentType: "application/json; charset=utf-8",
      resumable: false,
      ...(generation === undefined ? {} : { preconditionOpts: { ifGenerationMatch: generation } }),
      metadata: { cacheControl: "no-store" },
    });
    return;
  }
  await writeJsonFile(localPath, payload);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function listSubscribers() {
  const store = await loadCollection(GCS_SUBSCRIBERS, subscribersFile());
  return store.items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function addSubscriber({ email, name = "", source = "newsletter" }) {
  const normalized = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    throw Object.assign(new Error("Enter a valid email."), { status: 400 });
  }
  const store = await loadCollection(GCS_SUBSCRIBERS, subscribersFile());
  const existing = store.items.find((item) => item.email === normalized);
  if (existing) return existing;
  const entry = {
    id: `sub_${randomUUID().slice(0, 8)}`,
    email: normalized,
    name: String(name || "").trim(),
    source,
    createdAt: new Date().toISOString(),
  };
  store.items.push(entry);
  await saveCollection(GCS_SUBSCRIBERS, subscribersFile(), store);
  return entry;
}

export async function saveContact(payload) {
  const entry = {
    id: `msg_${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  const write = contactWrites.then(async () => {
    const bucket = gcsBucket();
    if (!bucket) {
      const path = contactsFile();
      const temporary = `${path}.${randomUUID()}.tmp`;
      const store = await loadCollection(GCS_CONTACTS, path);
      try {
        await writeJsonFile(temporary, { items: [entry, ...store.items].slice(0, 500) });
        await rename(temporary, path);
      } finally {
        await unlink(temporary).catch(() => {});
      }
      return entry;
    }
    const file = bucket.file(GCS_CONTACTS);
    for (let attempt = 0; attempt < 4; attempt++) {
      let generation = 0;
      let items = [];
      try {
        const [metadata] = await file.getMetadata();
        generation = metadata.generation;
        const [bytes] = await bucket.file(GCS_CONTACTS, { generation }).download();
        items = JSON.parse(bytes.toString("utf8")).items || [];
      } catch (error) {
        if (Number(error.code) !== 404) throw error;
        if (generation) continue;
      }
      try {
        await saveCollection(GCS_CONTACTS, contactsFile(), { items: [entry, ...items].slice(0, 500) }, generation);
        return entry;
      } catch (error) {
        if (Number(error.code) !== 412) throw error;
      }
    }
    throw new Error("Contact storage changed during submission.");
  });
  contactWrites = write.catch(() => {});
  return write;
}

export async function listContacts() {
  const store = await loadCollection(GCS_CONTACTS, contactsFile());
  return store.items;
}
