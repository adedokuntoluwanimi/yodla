import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Storage } from "@google-cloud/storage";

const GCS_MEMORY = "content/yodla-shopper-memory.json";

function memoryFile() {
  return process.env.YODLA_SHOPPER_MEMORY_PATH || join(process.cwd(), "data", "shopper-memory.json");
}

let storage;
function gcsBucket() {
  if (!process.env.YODLA_GCS_BUCKET) return null;
  storage ||= new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined });
  return storage.bucket(process.env.YODLA_GCS_BUCKET);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function emptyMemory(key) {
  return {
    key,
    purchases: [],
    recipients: [],
    preferredCategories: [],
    preferredOccasions: [],
    updatedAt: new Date().toISOString(),
  };
}

async function loadStore() {
  const bucket = gcsBucket();
  if (bucket) {
    const file = bucket.file(GCS_MEMORY);
    const [exists] = await file.exists();
    if (!exists) return { profiles: {} };
    const [bytes] = await file.download();
    const parsed = JSON.parse(bytes.toString("utf8"));
    return { profiles: parsed?.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {} };
  }
  try {
    const parsed = JSON.parse(await readFile(memoryFile(), "utf8"));
    return { profiles: parsed?.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {} };
  } catch {
    return { profiles: {} };
  }
}

async function saveStore(store) {
  const payload = JSON.stringify({ profiles: store.profiles || {}, updatedAt: new Date().toISOString() });
  const bucket = gcsBucket();
  if (bucket) {
    await bucket.file(GCS_MEMORY).save(payload, {
      contentType: "application/json; charset=utf-8",
      resumable: false,
      metadata: { cacheControl: "no-store" },
    });
    return;
  }
  await mkdir(dirname(memoryFile()), { recursive: true });
  await writeFile(memoryFile(), payload);
}

export async function loadShopperMemory(keyValue) {
  const key = normalizeKey(keyValue);
  if (!key) return emptyMemory("");
  const store = await loadStore();
  return store.profiles[key] || emptyMemory(key);
}

export function shopperMemoryContext(memory) {
  if (!memory?.key) {
    return { hasHistory: false, purchases: [], recipients: [], preferredCategories: [], preferredOccasions: [] };
  }
  return {
    hasHistory: Boolean(memory.purchases?.length || memory.recipients?.length),
    purchases: (memory.purchases || []).slice(0, 8).map((entry) => ({
      at: entry.at,
      productNames: entry.productNames || [],
      categories: entry.categories || [],
      occasions: entry.occasions || [],
      forRecipient: entry.forRecipient || "",
      gift: Boolean(entry.gift),
    })),
    recipients: (memory.recipients || []).slice(0, 6).map((entry) => ({
      name: entry.name || "",
      state: entry.state || "",
      phone: entry.phone ? "on file" : "",
      address: entry.address ? "on file" : "",
      occasions: entry.occasions || [],
      lastGiftAt: entry.lastGiftAt || "",
      preferredCategories: entry.preferredCategories || [],
    })),
    preferredCategories: memory.preferredCategories || [],
    preferredOccasions: memory.preferredOccasions || [],
  };
}

export async function rememberShopperOrder(keyValue, order = {}, { gift = false, recipientName = "" } = {}) {
  const key = normalizeKey(keyValue);
  if (!key) return null;
  const store = await loadStore();
  const memory = store.profiles[key] || emptyMemory(key);
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const productNames = lines.map((line) => line.name).filter(Boolean);
  const categories = [...new Set(lines.map((line) => line.category).filter(Boolean))];
  const occasions = [...new Set((lines.flatMap((line) => line.occasions || [])).filter(Boolean))];
  const customer = order.customer || {};
  const giftLike = gift
    || /gift|for\s+\w+/i.test(String(order.customer?.note || ""))
    || occasions.some((item) => /gift/i.test(item));
  const recipient = String(recipientName || (giftLike ? customer.name : "") || "").trim();

  memory.purchases = [
    {
      at: order.paidAt || order.createdAt || new Date().toISOString(),
      productIds: lines.map((line) => line.productId).filter(Boolean),
      productNames,
      categories,
      occasions,
      forRecipient: recipient,
      gift: giftLike,
      trackingCode: order.trackingCode || "",
    },
    ...(memory.purchases || []),
  ].slice(0, 20);

  for (const category of categories) {
    if (!memory.preferredCategories.includes(category)) memory.preferredCategories.push(category);
  }
  for (const occasion of occasions) {
    if (!memory.preferredOccasions.includes(occasion)) memory.preferredOccasions.push(occasion);
  }
  memory.preferredCategories = memory.preferredCategories.slice(0, 12);
  memory.preferredOccasions = memory.preferredOccasions.slice(0, 12);

  if (recipient) {
    const existing = (memory.recipients || []).find((entry) => normalizeKey(entry.name) === normalizeKey(recipient));
    if (existing) {
      existing.state = customer.state || existing.state || "";
      existing.phone = customer.phone || existing.phone || "";
      existing.address = customer.address || existing.address || "";
      existing.lastGiftAt = order.paidAt || order.createdAt || new Date().toISOString();
      existing.occasions = [...new Set([...(existing.occasions || []), ...occasions])].slice(0, 8);
      existing.preferredCategories = [...new Set([...(existing.preferredCategories || []), ...categories])].slice(0, 8);
    } else {
      memory.recipients = [
        {
          name: recipient,
          state: customer.state || "",
          phone: customer.phone || "",
          address: customer.address || "",
          occasions,
          preferredCategories: categories,
          lastGiftAt: order.paidAt || order.createdAt || new Date().toISOString(),
        },
        ...(memory.recipients || []),
      ].slice(0, 12);
    }
  }

  memory.updatedAt = new Date().toISOString();
  store.profiles[key] = memory;
  await saveStore(store);
  return memory;
}
