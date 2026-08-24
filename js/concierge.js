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
  const occasion = ["Dinner", "Hosting", "Gift", "Toast", "Weekend"].find((item) => query.includes(item.toLowerCase()));
  let matches = catalogue.filter((product) => product.price <= budget)
    .filter((product) => !category || product.category === category)
    .filter((product) => !occasion || product.occasions.includes(occasion));
  if (!matches.length) matches = catalogue.filter((product) => product.price <= budget);
  if (!matches.length) matches = [...catalogue].sort((a, b) => a.price - b.price);
  const products = matches.slice(0, 3);
  const names = products.map((product) => `${product.name} (${formatMoney(product.price)})`).join(", ");
  return {
    reply: `I would start with ${names}. These are real items in this prototype catalogue; open one below for the full details.`,
    mode: "catalogue",
    productIds: products.map(({ id }) => id),
  };
}
