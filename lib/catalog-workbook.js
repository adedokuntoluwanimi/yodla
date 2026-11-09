import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { slugify } from "./content-model.js";
import { catalogPhoto, hamperPhoto } from "./catalog-photos.js";

const SHEETS = ["Wholesale drinks prices", "Cocktails and mocktail prices", "Gifting"];
const TIERS = ["essential", "signature", "executive"];
const CATEGORIES = ["Mixers & Soft Drinks", "Beer & Ciders", "Spirits", "Cognac", "Whisky", "Wines", "Ice Packs", "Extras"];
const DEFAULT_CATEGORIES = [0, 0, 0, 0, 1, 1, 2, 0, 0, 3, 4, 2, 4, 4, 4, 2, 2, 5, 5, 4, 4, 6, 7];
const KNOWN_CATEGORIES = new Map([
  "Nestle Water", "Pet Soft Drinks (Coke, Sprite, Fanta)", "Can Malt", "Can Schwepps", "Can Small Stout (Smooth)",
  "Can Heineken", "Can Smirnoff (White & Black)", "5 Alive", "Chivita", "Martell Vs", "Glenfiddich 15 Years Old",
  "Volcan Blanco | Tequila", "Jameson (Irish green)", "Jameson (Black barrel)", "Jack Daniels", "Baileys", "Whiteley Neil",
  "Red Wine", "White Wine", "Johnnie Walker Red Label", "Grant Whisky", "Edible ice (bags)", "Disposable cups (packs)",
].map((name, index) => [slugify(name), CATEGORIES[DEFAULT_CATEGORIES[index]]]));
const text = (value) => typeof value === "string" ? value.trim() : "";
const blank = (value) => value === null || value === undefined || value === "";
const normalized = (value) => text(value).toLowerCase();
const optionalFields = ["SKU", "Category", "Selling unit", "Pack size", "Minimum quantity", "Customer price (NGN)", "Match product ID"];

// Bound the inflated workbook before handing the archive to ExcelJS.
function validateArchive(bytes) {
  const maxBytes = 2_000_000;
  if (bytes.length > maxBytes || bytes.length < 22 || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error("Choose a valid .xlsx file under 2 MB.");
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length) break;
  }
  if (end < Math.max(0, bytes.length - 65557)) throw new Error("The workbook archive is incomplete.");
  const count = bytes.readUInt16LE(end + 10);
  const directoryStart = bytes.readUInt32LE(end + 16);
  let offset = directoryStart;
  let expanded = 0;
  if (count > 200 || offset + bytes.readUInt32LE(end + 12) !== end) throw new Error("The workbook archive is too complex.");
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("The workbook archive is invalid.");
    const method = bytes.readUInt16LE(offset + 10);
    const packedSize = bytes.readUInt32LE(offset + 20);
    const fileSize = bytes.readUInt32LE(offset + 24);
    expanded += fileSize;
    if (expanded > 12_000_000) throw new Error("The workbook expands beyond the import limit.");
    const nameLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (/vbaProject|externalLinks/i.test(name)) throw new Error("Use an .xlsx workbook without macros or external links.");
    const local = bytes.readUInt32LE(offset + 42);
    if (local + 30 > directoryStart || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("The workbook archive is invalid.");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + packedSize > directoryStart || ![0, 8].includes(method)) throw new Error("The workbook archive is invalid.");
    try {
      const size = method === 0 ? packedSize : inflateRawSync(bytes.subarray(start, start + packedSize), { maxOutputLength: Math.max(1, fileSize) }).length;
      if (size !== fileSize) throw new Error("Unexpected expanded size.");
    } catch {
      throw new Error("The workbook contains an invalid or oversized entry.");
    }
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw new Error("The workbook archive is invalid.");
}

export async function parseCatalogWorkbook(bytes) {
  validateArchive(bytes);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(bytes);
  } catch {
    throw new Error("This workbook could not be opened. Save a fresh .xlsx copy and try again.");
  }
  const errors = [];
  const products = [];
  const hampers = [];
  const keys = new Set();
  const sheets = SHEETS.map((name) => {
    const sheet = book.worksheets.find((candidate) => normalized(candidate.name) === normalized(name));
    if (!sheet) errors.push({ sheet: name, row: 0, message: "This tab is required." });
    else if (sheet.rowCount > 2000 || sheet.columnCount > 32) errors.push({ sheet: name, row: 0, message: "Keep this tab within 2,000 rows and 32 columns." });
    return sheet;
  });
  if (errors.length) return { products, hampers, errors };
  const issue = (row, message) => errors.push({ sheet: row.worksheet.name, row: row.number, message });
  const readNumber = (row, value, label, { whole = false, zero = false } = {}) => {
    if (blank(value)) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < (zero ? 0 : whole ? 1 : 0.01)
      || value > (whole ? 10000 : 100_000_000) || (whole ? !Number.isInteger(value) : Math.abs(Math.round(value * 100) - value * 100) > 0.00001)) {
      issue(row, `${label} must be a ${whole ? "whole number" : "numeric NGN amount"}.`);
      return null;
    }
    return value;
  };
  function addProduct(row, kind, fields, category, description = "") {
    const name = text(row.getCell(3).value);
    if (!name || name.length > 160 || !slugify(name)) return issue(row, "Enter a product name of up to 160 characters.");
    const field = (key) => fields.has(key) ? row.getCell(fields.get(key)).value : null;
    const rawSku = field("sku");
    const sku = Number.isSafeInteger(rawSku) ? String(rawSku) : text(rawSku);
    if (!blank(rawSku) && !sku) issue(row, "Enter the SKU as text or a whole number.");
    const matchId = text(field("match product id"));
    const sourceKey = `${kind}:${slugify(name)}`;
    const sellingPrice = field("customer price (ngn)");
    const price = readNumber(row, blank(sellingPrice) && kind === "wholesale" ? row.getCell(4).value : sellingPrice, "Customer price");
    const unit = normalized(field("selling unit")) || (kind === "wholesale" ? "" : "serving");
    const packSize = readNumber(row, field("pack size"), "Pack size", { whole: true });
    const minimumQuantity = readNumber(row, field("minimum quantity"), "Minimum quantity", { whole: true });
    const providedCategory = text(field("category"));
    if (sku.length > 80 || matchId.length > 100) issue(row, "Shorten the SKU or matching product ID.");
    if (unit && !["bottle", "can", "case", "pack", "bag", "serving", "each"].includes(unit)) issue(row, "Use bottle, can, case, pack, bag, serving, or each for the selling unit.");
    if (providedCategory && !CATEGORIES.includes(providedCategory) && kind === "wholesale") issue(row, "Use a category from the template.");
    if (keys.has(sourceKey) || (sku && keys.has(`sku:${sku.toLowerCase()}`))) issue(row, "Duplicate name or SKU.");
    keys.add(sourceKey);
    if (sku) keys.add(`sku:${sku.toLowerCase()}`);
    products.push({
      name, sku, matchId, sourceKey, sourceSheet: row.worksheet.name, sourceRow: row.number,
      catalogKind: kind, category: kind === "wholesale" ? providedCategory || category : category,
      description, price, unit, packSize, minimumQuantity, ...catalogPhoto(slugify(name)),
    });
  }
  function headers(row, start) {
    return new Map(row.values.slice(start).map((value, index) => [normalized(value), index + start]).filter(([key]) => key));
  }
  const [wholesale, cocktails, gifting] = sheets;
  const wholesaleHeader = wholesale.getRow(4);
  if (normalized(wholesaleHeader.getCell(3).value) !== "item" || normalized(wholesaleHeader.getCell(4).value) !== "price (ngn)") issue(wholesaleHeader, "Expected Item and Price (NGN) in columns C and D.");
  const wholesaleFields = headers(wholesaleHeader, 5);
  wholesale.eachRow((row, number) => {
    if (number > 4 && row.values.slice(2).some((value) => !blank(value))) {
      addProduct(row, "wholesale", wholesaleFields, KNOWN_CATEGORIES.get(slugify(row.getCell(3).value)) || "Extras");
    }
  });
  if (!products.length) issue(wholesaleHeader, "Add at least one wholesale item.");
  const cocktailHeader = cocktails.getRow(4);
  if (normalized(cocktailHeader.getCell(3).value) !== "cocktails") issue(cocktailHeader, "Expected Cocktails in column C.");
  const cocktailFields = headers(cocktailHeader, 7);
  let kind = "cocktail";
  for (let number = 5; number <= cocktails.rowCount; number++) {
    const row = cocktails.getRow(number);
    if (normalized(row.getCell(3).value) === "mocktails") {
      kind = "mocktail";
      continue;
    }
    if (blank(row.getCell(2).value) && blank(row.getCell(3).value)) break;
    addProduct(row, kind, cocktailFields, kind === "cocktail" ? "Cocktails" : "Mocktails", text(row.getCell(6).value));
  }
  for (const menu of ["cocktail", "mocktail"]) {
    if (!products.some((item) => item.catalogKind === menu)) issue(cocktailHeader, `Add at least one ${menu}.`);
  }
  let tier;
  let additions = false;
  gifting.eachRow((row) => {
    const name = text(row.getCell(3).value);
    const heading = name.match(/^Class\s+[123]:\s*(essential|signature|executive)\s+collection$/i);
    if (heading) {
      const id = heading[1].toLowerCase();
      if (hampers.some((item) => item.id === id)) issue(row, "This hamper tier is listed more than once.");
      tier = {
        id, name: `${id[0].toUpperCase()}${id.slice(1)} Collection`, included: [], addOns: [],
        basePrice: readNumber(row, row.getCell(5).value, "Hamper base price"), sourceRow: row.number,
      };
      hampers.push(tier);
      additions = false;
    } else if (/^pool of additions/i.test(name)) {
      additions = true;
    } else if (tier && !blank(row.getCell(2).value)) {
      if (!name || !slugify(name)) return issue(row, "Enter an item or add-on name.");
      const list = additions ? tier.addOns : tier.included;
      const id = slugify(name);
      if (list.some((item) => item.id === id)) issue(row, "This item is already listed in the tier.");
      list.push({ id, name, price: readNumber(row, row.getCell(4).value, "Item price", { zero: additions }) });
    }
  });
  for (const id of TIERS) {
    const tier = hampers.find((item) => item.id === id);
    if (!tier?.included.length) issue(gifting.getRow(tier?.sourceRow || 3), `Add the fixed items for the ${id} tier.`);
    if (tier && tier.basePrice === null && tier.included.every((item) => item.price > 0)) {
      tier.basePrice = tier.included.reduce((total, item) => total + Math.round(item.price * 100), 0) / 100;
    }
    if (tier) Object.assign(tier, hamperPhoto(tier));
  }
  return { products, hampers, errors };
}

export async function catalogWorkbookTemplate() {
  const book = new ExcelJS.Workbook();
  const wholesale = book.addWorksheet(SHEETS[0]);
  wholesale.getRow(4).values = [null, "S/n", "Item", "Price (NGN)", ...optionalFields];
  wholesale.getColumn(5).numFmt = "@";
  const cocktails = book.addWorksheet(SHEETS[1]);
  cocktails.getRow(4).values = [null, "S/n", "Cocktails", "Yodla name", "Number of units", "Details", ...optionalFields];
  cocktails.getColumn(7).numFmt = "@";
  cocktails.getCell("C6").value = "Mocktails";
  const gifting = book.addWorksheet(SHEETS[2]);
  TIERS.forEach((tier, index) => {
    const start = 3 + index * 16;
    gifting.getRow(start).values = [null, "S/n", `Class ${index + 1}: ${tier[0].toUpperCase()}${tier.slice(1)} collection`, "Price (NGN)"];
    gifting.getCell(start - 1, 5).value = "Optional base price in the tier heading below";
    gifting.getCell(start + 11, 3).value = "Pool of additions at an increased cost";
  });
  const guide = book.addWorksheet("Guide");
  guide.addRows([
    ["Use the three catalogue tabs. Copy the layout or upload the original workbook."],
    ["Use one numbered row per item, including consecutive cocktail rows before the Mocktails heading."],
    ["Use a stable SKU or enter the existing ID in Match product ID when renaming an item."],
    ["Shop orders start at six selling units per product. Enter a higher minimum when needed. Pack size is the number of pieces in a selling unit."],
    ["When the wholesale selling unit is blank, the listed price applies to one listed unit. Entries without a customer price appear without checkout."],
    ["Categories", ...CATEGORIES],
  ]);
  for (const sheet of book.worksheets) {
    sheet.getColumn(3).width = 46;
    sheet.getColumn(5).width = 28;
    sheet.getColumn(6).width = 34;
  }
  return book.xlsx.writeBuffer();
}
