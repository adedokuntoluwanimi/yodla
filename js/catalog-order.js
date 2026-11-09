export function purchaseReady(product) {
  return Boolean(product && Number.isFinite(product.price) && product.price > 0
    && (!product.catalogKind || product.catalogKind === "wholesale" || product.unit === "serving"));
}

export function orderMinimum(product) {
  if (!product?.catalogKind) return 1;
  return Math.max(6, product.minimumQuantity || 1);
}

export function toKobo(amount) {
  return Math.round(amount * 100);
}

const majorDeliveryStates = new Set(["Lagos", "Abuja", "FCT", "Rivers", "Oyo"]);

export function deliveryFeeForState(state) {
  return !state || majorDeliveryStates.has(state) ? 2500 : 4500;
}

export function paymentSplit(total) {
  const totalKobo = toKobo(total);
  const deposit = Math.round(totalKobo * 70 / 100);
  return { dueNow: deposit / 100, balanceDue: (totalKobo - deposit) / 100 };
}

export function wordCount(value) {
  return String(value || "").trim().split(/\s+/u).filter(Boolean).length;
}

export function isHamperExtraDrink(item) {
  return /additional.*(?:wine|drink|bottle)/i.test(item.name);
}

export function isHamperInventoryDrink(item) {
  return item?.catalogKind === "wholesale" && !["Ice Packs", "Extras"].includes(item.category);
}

export function hamperDrinkReady(item) {
  return isHamperInventoryDrink(item) && item.price > 0 && item.packSize === 1 && ["bottle", "can", "each"].includes(item.unit);
}

export const MAX_HAMPER_DRINK_QUANTITY = 1000;

export function resolveHamperDrinks(selection, products, eligible = isHamperInventoryDrink) {
  const lines = selection.extraDrinks === undefined
    ? (selection.extraDrinkId ? [{ productId: selection.extraDrinkId, quantity: 1 }] : [])
    : selection.extraDrinks;
  if (!Array.isArray(lines) || lines.length > 100) return null;
  const seen = new Set();
  const drinks = [];
  for (const line of lines) {
    const { productId, quantity } = line || {};
    const item = products.find((product) => product.id === productId);
    if (!eligible(item) || seen.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_HAMPER_DRINK_QUANTITY) return null;
    seen.add(productId);
    drinks.push({ productId, quantity, name: item.name, price: item.price });
  }
  return drinks;
}

export function lagosCalendarDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", dateStyle: "short" }).format(new Date());
}

export function hamperTotals(tier, addons, deliveryFee = 0) {
  const subtotal = toKobo(tier.basePrice) + addons.reduce((sum, item) => sum + toKobo(item.price) * (item.quantity ?? 1), 0);
  const serviceFee = Math.round(subtotal * 30 / 100);
  const serviceVat = Math.round(serviceFee * 75 / 1000);
  return {
    subtotal: subtotal / 100, serviceFee: serviceFee / 100, serviceVat: serviceVat / 100, deliveryFee,
    total: (subtotal + serviceFee + serviceVat + toKobo(deliveryFee)) / 100,
  };
}
