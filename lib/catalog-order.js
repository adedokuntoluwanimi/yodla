import { getAvailability } from "../js/catalog.js";
import { hamperDrinkReady, hamperTotals, isHamperExtraDrink, orderMinimum, paymentSplit, purchaseReady, resolveHamperDrinks, toKobo, wordCount } from "../js/catalog-order.js";
import { catalogLocationForState, NIGERIAN_STATES } from "../js/states.js";
import { deliveryFeeForState } from "./orders.js";

const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };

export function prepareCatalogOrder(content, body, items) {
  const state = body.state || body.location || "";
  if (state && !NIGERIAN_STATES.includes(state)) fail("Choose a valid delivery state.");
  const delivery = deliveryFeeForState(state);
  if (body.hamper) {
    if (body.cartId || items?.length) fail("Hampers and wholesale items use separate checkouts.");
    const tier = content.hampers.find((item) => item.id === body.hamper.tierId);
    if (!tier?.basePrice) fail("This hamper is available by request.");
    const ids = body.hamper.addOnIds || [];
    if (!Array.isArray(ids) || ids.length > tier.addOns.length || new Set(ids).size !== ids.length) fail("Check the selected add-ons.");
    const addons = ids.map((id) => tier.addOns.find((item) => item.id === id));
    if (addons.some((item) => !item || item.price === null || isHamperExtraDrink(item))) fail("Review your extras and select any extra drink from the shop.");
    const drinks = resolveHamperDrinks(body.hamper, content.products, (drink) => hamperDrinkReady(drink)
      && (!state || getAvailability(drink, catalogLocationForState(state)) !== "unavailable"));
    if (!drinks) fail("Check your extra drink selections and quantities, or request a quote.");
    const note = String(body.hamper.note || "").trim();
    const mugText = String(body.hamper.mugText || "").trim();
    if ([note, mugText].some((value) => value.length > 500 || wordCount(value) > 10)) fail("Use up to 10 words for each personalization field.");
    if (note && !addons.some((item) => /handwritten.*note/i.test(item.name))) fail("Select the handwritten note add-on to include a note.");
    if (mugText && !addons.some((item) => /mug/i.test(item.name))) fail("Select the branded mug add-on to include mug text.");
    const lines = [
      { productId: tier.id, name: tier.name, price: tier.basePrice, quantity: 1 },
      ...addons.map((item) => ({ productId: item.id, name: item.name, price: item.price, quantity: 1 })),
      ...drinks,
    ];
    return { source: "hamper", lines, totals: hamperTotals(tier, lines.slice(1), delivery), hamper: { tierId: tier.id, included: tier.included.map((item) => item.name), addOnIds: ids, extraDrinks: drinks.map(({ productId, quantity }) => ({ productId, quantity })), note, mugText } };
  }
  if (body.gift || body.source === "gifting") fail("Choose a hamper from the gifting page.");
  if (!Array.isArray(items) || !items.length || items.length > 100) fail("Add an available item to your bag.");
  const seen = new Set();
  const lines = items.map((item) => {
    const { productId, quantity } = item || {};
    const product = content.products.find((item) => item.id === productId);
    if (!purchaseReady(product)) fail("An item in your bag is no longer available for checkout. Review your bag.");
    if (seen.has(productId)) fail("Combine repeated items before checkout.");
    seen.add(productId);
    const minimum = orderMinimum(product);
    if (!Number.isInteger(quantity) || quantity < minimum || quantity > 10000) fail(`Choose at least ${minimum} selling units for ${product.name}.`);
    if (state && getAvailability(product, catalogLocationForState(state)) === "unavailable") fail(`${product.name} is unavailable at the selected location.`);
    return { productId, name: product.name, price: product.price, quantity, unit: product.unit, packSize: product.packSize };
  });
  const subtotal = lines.reduce((total, item) => total + toKobo(item.price) * item.quantity, 0) / 100;
  const total = (toKobo(subtotal) + toKobo(delivery)) / 100;
  return { source: "wholesale", lines, totals: { subtotal, deliveryFee: delivery, total, ...paymentSplit(total) } };
}
