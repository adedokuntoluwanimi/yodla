import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rmdir, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import ExcelJS from "exceljs";
import importer from "../admin/api/catalog-import.js";
import orders from "../admin/api/orders.js";
import contact from "../api/contact.js";
import { handleCommerce } from "../api/commerce.js";
import { getPublishedContent, getPublishedProduct } from "../lib/content-service.js";
import { catalogWorkbookTemplate, parseCatalogWorkbook } from "../lib/catalog-workbook.js";
import { resetContentStore } from "../lib/content-store.js";
import { listContacts } from "../lib/subscribers.js";
import { orderMinimum, paymentSplit, purchaseReady } from "../js/catalog-order.js";

async function workbook({ update = false, invalid = false, match = true } = {}) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await catalogWorkbookTemplate());
  const wholesale = book.getWorksheet("Wholesale drinks prices");
  wholesale.getRow(5).values = [null, 1, update ? "Nestle Pure Life" : "Nestle Water", update ? 125.01 : 100, match ? "WATER" : "", "Mixers & Soft Drinks", "bottle", 1, 1];
  wholesale.getRow(6).values = update
    ? [null, 2, "Paper cups", 80, match ? "CUPS" : "", "Extras", "pack", 50, 1]
    : [null, 2, "Edible ice (bags)", 50, "ICE", "Ice Packs", "bag", 1, 1];
  if (update) wholesale.getRow(7).values = [null, 3, "Can Heineken", 200, "BEER", "Beer & Ciders", "can", 1];
  const cocktails = book.getWorksheet("Cocktails and mocktail prices");
  cocktails.getRow(5).values = [0.5, 1, "Long island", "", 500, "Vodka and lime"];
  cocktails.getRow(7).values = [0.5, 2, "Virgin mojito", "", 500, "Mint and lime"];
  cocktails.getRow(20).values = [null, 1, "Confidential costing", null, 2000];
  const gifts = book.getWorksheet("Gifting");
  for (const row of [3, 19, 35]) {
    gifts.getCell(row, 5).value = 1000;
    gifts.getRow(row + 1).values = [null, 1, "Greeting card"];
    gifts.getRow(row + 12).values = [null, 2, "Handwritten personalised note", 10];
    gifts.getRow(row + 13).values = [null, 3, "Branded mug", 100];
  }
  if (invalid) gifts.name = "Missing";
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function request(handler, data, headers = {}, method = "POST") {
  const input = Readable.from([Buffer.from(JSON.stringify(data))]);
  Object.assign(input, { method, headers: { host: "localhost", ...headers }, url: "/admin/api/catalog-import" });
  let response;
  const output = {
    headers: {},
    writeHead(status, header) { this.statusCode = status; Object.assign(this.headers, header); },
    setHeader(key, value) { this.headers[key] = value; },
    end(value) { response = JSON.parse(String(value)); },
  };
  await handler(input, output);
  return { status: output.statusCode, ...response };
}

test("workbook review is authenticated, private and atomic across edits, removals and restarts", async (t) => {
  const root = resolve("tmp");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "catalogue-test-"));
  const config = {
    YODLA_SHELF_PATH: join(directory, "shelf.json"),
    YODLA_ADMINS_PATH: join(directory, "admins.json"),
    YODLA_ORDERS_PATH: join(directory, "orders.json"),
    YODLA_CARTS_PATH: join(directory, "carts.json"),
    YODLA_CONTACTS_PATH: join(directory, "contacts.json"),
    YODLA_SHOPPER_MEMORY_PATH: join(directory, "memory.json"),
    YODLA_LOCAL_AUTH_BYPASS: "false",
    YODLA_REQUIRE_WORKBOOK: "true",
    FIREBASE_API_KEY: "test-only",
    PAYSTACK_SECRET_KEY: "",
    YODLA_LOCAL_MAIL_DISABLED: "true",
  };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  resetContentStore();
  t.after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetContentStore();
    for (const file of await readdir(directory)) await unlink(join(directory, file));
    await rmdir(directory);
  });
  const bytes = await workbook();
  const encoded = bytes.toString("base64");
  assert.equal((await request(importer, { workbook: encoded })).status, 401);
  process.env.YODLA_LOCAL_AUTH_BYPASS = "true";
  assert.equal((await request(importer, { workbook: encoded }, { "x-yodla-user-email": "guest@example.test" })).status, 403);
  assert.equal((await request(importer, { workbook: Buffer.from("invalid").toString("base64") })).status, 422);
  const invalidWorkbook = (await workbook({ invalid: true })).toString("base64");
  const invalid = await request(importer, { workbook: invalidWorkbook });
  assert.equal(invalid.errors[0].sheet, "Gifting");
  assert.equal((await request(importer, { workbook: invalidWorkbook, confirmation: invalid.token })).status, 422);
  const first = await request(importer, { workbook: encoded });
  assert.deepEqual(first.errors, []);
  assert.equal(first.changes.added.length, 7);
  assert.equal((await getPublishedContent()).products.length, 0);
  assert.equal((await request(importer, { workbook: encoded, confirmation: first.token })).published, true);
  const published = await getPublishedContent();
  assert.equal(published.products.length, 4);
  assert.equal(published.hampers.length, 3);
  assert.ok(!JSON.stringify(published).includes("Confidential costing"));
  assert.ok(!JSON.stringify(published).includes("batchQuantity"));
  assert.equal((await getPublishedProduct("bottega-gold")).document, null);
  assert.equal((await request(importer, { workbook: encoded, confirmation: first.token })).status, 409);

  const changed = (await workbook({ update: true })).toString("base64");
  const ambiguous = await request(importer, { workbook: (await workbook({ update: true, match: false })).toString("base64") });
  assert.ok(ambiguous.errors.some((item) => item.message.includes("rename")));
  const review = await request(importer, { workbook: changed });
  assert.equal(review.changes.updated[0].id, "nestle-water");
  assert.ok(review.changes.removed.some((item) => item.id === "edible-ice-bags"));
  assert.equal((await getPublishedProduct("nestle-water")).document.price, 100);
  assert.equal((await request(importer, { workbook: changed, confirmation: review.token })).published, true);
  resetContentStore();
  assert.equal((await getPublishedProduct("nestle-water")).document.price, 125.01);
  assert.equal((await getPublishedProduct("edible-ice-bags")).document, null);
  assert.equal((await getPublishedProduct("paper-cups")).document.price, 80);

  const extraDrinks = [{ productId: "nestle-water", quantity: 2 }, { productId: "can-heineken", quantity: 3 }];
  const quote = { action: "hamper_inquiry", tierId: "essential", quantity: 2, state: "Lagos", name: "Test Customer", email: "shopper@example.test", addOnIds: ["branded-mug"], extraDrinks, mugText: "Thank you" };
  assert.equal((await request(contact, { ...quote, tierId: "unknown" })).status, 404);
  assert.equal((await request(contact, { ...quote, addOnIds: ["wrong-extra"] })).status, 400);
  assert.equal((await request(contact, { ...quote, extraDrinks: [{ productId: "paper-cups", quantity: 1 }] })).status, 400);
  assert.equal((await request(contact, { ...quote, extraDrinks: [extraDrinks[0], extraDrinks[0]] })).status, 400);
  assert.equal((await request(contact, { ...quote, mugText: "one two three four five six seven eight nine ten eleven" })).status, 400);
  const submitted = await request(contact, quote);
  assert.equal(submitted.status, 200);
  const [saved] = await listContacts();
  assert.equal(saved.id, submitted.id);
  assert.deepEqual(saved.hamper, { tierId: "essential", quantity: 2, state: "Lagos", deliveryDate: "", addOnIds: ["branded-mug"], extraDrinks, note: "", mugText: "Thank you" });
  const simultaneous = await Promise.all([request(contact, { ...quote, quantity: 3 }), request(contact, { ...quote, quantity: 4 })]);
  assert.ok(simultaneous.every((reply) => reply.status === 200));
  assert.deepEqual((await listContacts()).map((entry) => entry.hamper.quantity).sort(), [2, 3, 4]);

  const commerce = (action, data) => request((req, res) => handleCommerce(req, res, action), data);
  const previousService = process.env.K_SERVICE;
  process.env.K_SERVICE = "production-test";
  try {
    assert.equal((await commerce("create_payment", {})).status, 503);
    assert.equal((await commerce("create_order", {})).status, 503);
  } finally {
    if (previousService === undefined) delete process.env.K_SERVICE;
    else process.env.K_SERVICE = previousService;
  }
  const customer = { name: "Test Customer", email: "shopper@example.test", phone: "08001234567", address: "Test Street", state: "Lagos" };
  const { cart } = await commerce("create_cart", { state: "Lagos" });
  const add = await commerce("add_to_cart", { cartId: cart.id, productId: "paper-cups" });
  assert.equal(add.cart.items[0].quantity, 6);
  assert.equal((await commerce("add_to_cart", { cartId: cart.id, productId: "paper-cups", quantity: 1 })).cart.items[0].quantity, 7);
  assert.equal((await commerce("calculate_order", { ...customer, items: [{ productId: "paper-cups", quantity: 5 }] })).status, 400);
  assert.equal((await commerce("create_payment", { ...customer, items: [{ productId: "edible-ice-bags", quantity: 1 }] })).status, 400);
  assert.equal((await commerce("create_payment", { ...customer, items: [{ productId: "nestle-water", quantity: 5 }] })).status, 400);
  const payment = await commerce("create_payment", { ...customer, items: [{ productId: "nestle-water", quantity: 6 }] });
  assert.equal(payment.payment.provider, "mock");
  assert.deepEqual(payment.order.totals, { subtotal: 750.06, deliveryFee: 2500, total: 3250.06, dueNow: 2275.04, balanceDue: 975.02 });
  const reference = payment.order.id;
  assert.equal((await request(orders, { id: reference, action: "collect_balance" })).status, 409);
  const attempts = await Promise.all([commerce("create_order", { reference }), commerce("create_order", { reference })]);
  assert.ok(attempts.every(({ order }) => order?.status === "deposit_paid"));
  assert.equal(attempts[0].order.payment.verifiedAt, attempts[1].order.payment.verifiedAt);
  const settled = await request(orders, { id: reference, action: "collect_balance" });
  assert.equal(settled.order.status, "paid");
  assert.equal((await commerce("create_order", { reference })).order.balanceCollectedAt, settled.order.balanceCollectedAt);

  const hamper = { tierId: "essential", addOnIds: ["handwritten-personalised-note", "branded-mug"], note: "Enjoy your gift", mugText: "Cheers" };
  const withDrinks = await commerce("calculate_order", { ...customer, hamper: { ...hamper, extraDrinks } });
  assert.equal(withDrinks.status, 200);
  assert.deepEqual(withDrinks.lines.slice(-2).map(({ productId, quantity }) => ({ productId, quantity })), extraDrinks);
  assert.equal(withDrinks.totals.subtotal, 1960.02);
  assert.equal((await commerce("calculate_order", { ...customer, hamper: { ...hamper, extraDrinkId: "nestle-water" } })).totals.subtotal, 1235.01);
  assert.equal((await commerce("calculate_order", { ...customer, hamper: { ...hamper, extraDrinks: [{ productId: "paper-cups", quantity: 1 }] } })).status, 400);
  assert.equal((await commerce("calculate_order", { ...customer, hamper: { ...hamper, extraDrinks: [{ productId: "nestle-water", quantity: 1.5 }] } })).status, 400);
  assert.equal((await commerce("create_payment", { ...customer, hamper: { ...hamper, note: "one two three four five six seven eight nine ten eleven" } })).status, 400);
  assert.equal((await commerce("create_payment", { ...customer, hamper: { ...hamper, mugText: "one two three four five six seven eight nine ten eleven" } })).status, 400);
  const gift = await commerce("create_payment", { ...customer, hamper });
  assert.deepEqual(gift.order.totals, { subtotal: 1110, serviceFee: 333, serviceVat: 24.98, deliveryFee: 2500, total: 3967.98 });
  assert.equal((await commerce("create_order", { reference: gift.order.id })).order.status, "paid");
});

test("priced products use six listed units by default and honor higher workbook minimums", async () => {
  const bytes = await workbook();
  const { products, errors } = await parseCatalogWorkbook(bytes);
  assert.deepEqual(errors, []);
  assert.equal(purchaseReady({ ...products[0], unit: "", packSize: null, minimumQuantity: null }), true);
  assert.equal(orderMinimum({ ...products[0], packSize: 4, unit: "pack" }), 6);
  assert.equal(orderMinimum({ ...products[0], minimumQuantity: 12 }), 12);
  assert.deepEqual(paymentSplit(0.05), { dueNow: 0.04, balanceDue: 0.01 });
});
