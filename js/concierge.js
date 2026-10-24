import { PRODUCTS, formatMoney } from "./catalog.js";

const CATEGORY_TERMS = new Map([
  ["champagne", "Champagne"], ["whisky", "Whisky"], ["whiskey", "Whisky"],
  ["cognac", "Cognac"], ["wine", "Wines"], ["sparkling", "Sparkling Wines"],
  ["beer", "Beer & Ciders"], ["cider", "Beer & Ciders"], ["mixer", "Mixers & Soft Drinks"],
  ["soft drink", "Mixers & Soft Drinks"], ["gift", "Extras"], ["spirit", "Spirits"],
]);

export function catalogueReply(message, catalogue = PRODUCTS) {
  const query = String(message || "").trim().slice(0, 500).toLowerCase();
  const budgetMatch = query.match(/(?:₦|ngn|n)?\s?([\d,]{4,})/i);
  const budget = budgetMatch ? Number(budgetMatch[1].replaceAll(",", "")) : Infinity;
  const category = [...CATEGORY_TERMS].find(([term]) => query.includes(term))?.[1];
  const occasion = ["Dinner", "Gifting", "Gift", "Toast", "Weekend"].find((item) => query.includes(item.toLowerCase()));
  const giftish = /\bgift|gifting|for (?:her|him|them|ada|tunde|mum|mom|dad)\b/i.test(query);
  let matches = catalogue.filter((product) => product.price <= budget)
    .filter((product) => !category || product.category === category)
    .filter((product) => !occasion || product.occasions.includes(occasion) || (giftish && product.occasions.some((item) => /gift/i.test(item))));
  if (!matches.length && giftish) {
    matches = catalogue.filter((product) => product.price <= budget && product.occasions.some((item) => /gift/i.test(item)));
  }
  if (!matches.length) matches = catalogue.filter((product) => product.price <= budget);
  if (!matches.length) matches = [...catalogue].sort((a, b) => a.price - b.price);
  const products = matches.slice(0, 3);
  const names = products.map((product) => `${product.name} (${formatMoney(product.price)})`).join(", ");
  const next = giftish
    ? " Tell me who it’s for (name + email) — one person or a few — and I’ll keep guiding until checkout."
    : " Tell me your city or ask to add one to the bag when you’re ready.";
  return {
    reply: `I would start with ${names}.${next}`,
    mode: giftish ? "gift" : "catalogue",
    productIds: products.map(({ id }) => id),
  };
}
