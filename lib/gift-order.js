import { normalizeGiftPayload } from "./gift.js";
import { recipientError } from "../js/gifting.js";
import { NIGERIAN_STATES, catalogLocationForState } from "../js/states.js";
import { getAvailability } from "../js/catalog.js";
import { deliveryFeeForState } from "./orders.js";

export function prepareGiftOrder(raw, products) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (raw?.version !== 2 || !Array.isArray(raw.recipients) || !raw.recipients.length || raw.recipients.length > 5) fail("Add between one and five gift recipients.");
  const gift = normalizeGiftPayload(raw);
  const ids = new Set(), emails = new Set();
  for (const person of gift.recipients) {
    const error = recipientError(person);
    if (error) fail(error);
    if (!person.id || ids.has(person.id) || emails.has(person.email)) fail("Each recipient must have a unique identity and email.");
    if (!NIGERIAN_STATES.includes(person.state)) fail("Choose a valid delivery state.");
    ids.add(person.id); emails.add(person.email);
  }
  if (gift.recipients.length !== raw.recipients.length) fail("Check the recipient emails for duplicates or errors.");
  if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > 500) fail("Choose bottles for your recipients.");
  const lines = [], seen = new Set();
  for (const item of raw.items) {
    const person = gift.recipients.find((entry) => entry.id === item.recipientId);
    const product = products.find((entry) => entry.id === item.productId);
    if (!person || !product) fail("A selected bottle or recipient is no longer available.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) fail("Choose quantities between 1 and 99.");
    const key = `${person.id}:${product.id}`;
    if (seen.has(key)) fail("Combine duplicate bottle selections for each recipient.");
    seen.add(key);
    if (getAvailability(product, catalogLocationForState(person.state)) === "unavailable") fail(`${product.name} is unavailable in ${person.state}. Choose another bottle.`);
    if (!Number.isFinite(product.price) || product.price <= 0) fail("A selected bottle cannot be purchased right now.");
    lines.push({ recipientId: person.id, productId: product.id, name: product.name, price: product.price, quantity: item.quantity });
  }
  for (const person of gift.recipients) if (!lines.some((line) => line.recipientId === person.id)) fail(`Choose a bottle for ${person.name}.`);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = gift.recipients.reduce((sum, person) => sum + deliveryFeeForState(person.state), 0);
  const giftFee = gift.wrap ? 1500 : 0;
  return { gift: { ...gift, items: lines.map(({ recipientId, productId, quantity }) => ({ recipientId, productId, quantity })) }, lines, totals: { subtotal, deliveryFee, giftFee, discount: 0, total: subtotal + deliveryFee + giftFee } };
}
