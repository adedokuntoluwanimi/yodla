import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";

const GCS_ORDERS = "content/yodla-orders.json";
const GCS_CARTS = "content/yodla-carts.json";

function ordersFile() {
  return process.env.YODLA_ORDERS_PATH || join(process.cwd(), "data", "orders.json");
}

function cartsFile() {
  return process.env.YODLA_CARTS_PATH || join(process.cwd(), "data", "carts.json");
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
    if (!exists) return { items: {} };
    const [bytes] = await file.download();
    return JSON.parse(bytes.toString("utf8"));
  }
  return readJsonFile(localPath, { items: {} });
}

async function saveCollection(gcsPath, localPath, payload) {
  const json = JSON.stringify(payload);
  const bucket = gcsBucket();
  if (bucket) {
    await bucket.file(gcsPath).save(json, {
      contentType: "application/json; charset=utf-8",
      resumable: false,
      metadata: { cacheControl: "no-store" },
    });
    return;
  }
  await writeJsonFile(localPath, payload);
}

export async function getCart(cartId) {
  const store = await loadCollection(GCS_CARTS, cartsFile());
  return store.items[cartId] || null;
}

export async function saveCart(cart) {
  const store = await loadCollection(GCS_CARTS, cartsFile());
  store.items[cart.id] = cart;
  await saveCollection(GCS_CARTS, cartsFile(), store);
  return cart;
}

export async function createCart({ location = "", customerId = "" } = {}) {
  const cart = {
    id: `cart_${randomUUID()}`,
    items: [],
    location,
    customerId,
    updatedAt: new Date().toISOString(),
  };
  return saveCart(cart);
}

export async function addToCart(cartId, productId, quantity = 1) {
  const cart = (await getCart(cartId)) || (await createCart());
  const existing = cart.items.find((item) => item.productId === productId);
  if (existing) existing.quantity += quantity;
  else cart.items.push({ productId, quantity });
  cart.updatedAt = new Date().toISOString();
  return saveCart(cart);
}

export async function getOrder(orderId) {
  const store = await loadCollection(GCS_ORDERS, ordersFile());
  return store.items[orderId] || null;
}

export async function findOrderByTracking(trackingCode) {
  const code = String(trackingCode || "").trim().toUpperCase();
  if (!code) return null;
  const store = await loadCollection(GCS_ORDERS, ordersFile());
  return Object.values(store.items).find((order) => String(order.trackingCode || "").toUpperCase() === code) || null;
}

export async function listOrders({ status = "", state = "", q = "", from = "", to = "" } = {}) {
  const store = await loadCollection(GCS_ORDERS, ordersFile());
  const query = String(q || "").trim().toLowerCase();
  const fromTime = from ? Date.parse(from) : NaN;
  const toTime = to ? Date.parse(to) : NaN;
  return Object.values(store.items)
    .filter((order) => {
      if (status && order.status !== status) return false;
      if (state && order.customer?.state !== state) return false;
      if (Number.isFinite(fromTime) && Date.parse(order.createdAt || 0) < fromTime) return false;
      if (Number.isFinite(toTime) && Date.parse(order.createdAt || 0) > toTime + 86_400_000) return false;
      if (!query) return true;
      const hay = `${order.id} ${order.trackingCode} ${order.customer?.email || ""} ${order.customer?.name || ""} ${order.customer?.phone || ""}`.toLowerCase();
      return hay.includes(query);
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function saveOrder(order) {
  const store = await loadCollection(GCS_ORDERS, ordersFile());
  store.items[order.id] = order;
  await saveCollection(GCS_ORDERS, ordersFile(), store);
  return order;
}

export async function createOrder(payload) {
  const order = {
    id: `ord_${randomUUID().slice(0, 8)}`,
    status: "awaiting_payment",
    trackingCode: `YD-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  return saveOrder(order);
}

export function deliveryFeeForState(state) {
  const major = new Set(["Lagos", "Abuja", "FCT", "Rivers", "Oyo"]);
  if (!state) return 2500;
  return major.has(state) ? 2500 : 4500;
}

export function calculateTotals(lines, { state = "", giftWrap = false, discountNgn = 0 } = {}) {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0);
  const deliveryFee = deliveryFeeForState(state);
  const giftFee = giftWrap ? 1500 : 0;
  const discount = Math.max(0, Number(discountNgn) || 0);
  const total = Math.max(0, subtotal + deliveryFee + giftFee - discount);
  return { subtotal, deliveryFee, giftFee, discount, total };
}
