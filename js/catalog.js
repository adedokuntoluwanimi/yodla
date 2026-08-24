export const LOCATIONS = ["Lagos", "Abuja", "Ibadan", "Port Harcourt"];

export const CATEGORIES = [
  "All",
  "Champagne",
  "Whisky",
  "Cognac",
  "Wines",
  "Sparkling Wines",
  "Spirits",
  "Beer & Ciders",
  "Mixers & Soft Drinks",
  "Extras",
];

export const PRODUCTS = [
  {
    id: "bottega-gold",
    name: "Bottega Gold Prosecco",
    brand: "Bottega",
    category: "Champagne",
    subcategory: "Prosecco",
    volume: "75cl",
    abv: "11%",
    price: 38500,
    compareAtPrice: 42000,
    image: "assets/products/bottega-gold.png",
    imageMode: "light",
    tag: "A proper toast",
    occasions: ["Toast", "Hosting", "Gift"],
    description: "Bright, fragrant and easy to pour when the room is ready for a toast.",
    notes: ["Pear", "White flowers", "Soft citrus"],
    serve: "Serve well chilled in a flute or white-wine glass.",
    availability: { Lagos: "in-stock", Abuja: "low-stock", Ibadan: "in-stock", "Port Harcourt": "unavailable" }
  },
  {
    id: "hennessy-vs",
    name: "Hennessy Very Special",
    brand: "Hennessy",
    category: "Cognac",
    subcategory: "Cognac",
    volume: "70cl",
    abv: "40%",
    price: 67000,
    image: "assets/products/hennessy-vs.jpg",
    imageMode: "light",
    tag: "Host's choice",
    occasions: ["Hosting", "Gift", "Weekend"],
    description: "A familiar, full-bodied cognac for generous pours and late conversations.",
    notes: ["Oak", "Vanilla", "Roasted fruit"],
    serve: "Pour neat, over one cube, or lengthen with ginger.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "low-stock", "Port Harcourt": "in-stock" }
  },
  {
    id: "jack-daniels",
    name: "Jack Daniel's Old No. 7",
    brand: "Jack Daniel's",
    category: "Whisky",
    subcategory: "Tennessee whisky",
    volume: "70cl",
    abv: "40%",
    price: 42000,
    image: "assets/products/jack-daniels.png",
    imageMode: "dark",
    tag: "Tennessee classic",
    occasions: ["Hosting", "Weekend", "Gift"],
    description: "Smooth Tennessee whiskey with enough character for a simple highball.",
    notes: ["Caramel", "Charred oak", "Banana"],
    serve: "Try with cola, soda or one large cube of ice.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "in-stock", "Port Harcourt": "low-stock" }
  },
  {
    id: "heineken-original",
    name: "Heineken Original Lager",
    brand: "Heineken",
    category: "Beer & Ciders",
    subcategory: "Lager",
    volume: "6 x 33cl",
    abv: "5%",
    price: 10500,
    image: "assets/products/heineken.jpg",
    imageMode: "light",
    tag: "Serve cold",
    occasions: ["Weekend", "Hosting"],
    description: "A crisp six-pack for the fridge, the match and the people still on their way.",
    notes: ["Crisp malt", "Light hops", "Clean finish"],
    serve: "Keep cold and open when everyone arrives.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "in-stock", "Port Harcourt": "in-stock" }
  },
  {
    id: "midnight-red",
    name: "Midnight Red Reserve",
    brand: "Yodla Cellar",
    category: "Wines",
    subcategory: "Red wine",
    volume: "75cl",
    abv: "13.5%",
    price: 24500,
    image: "assets/products/originals/midnight-red.jpg",
    imageMode: "dark",
    tag: "Dinner after dark",
    occasions: ["Dinner", "Hosting"],
    description: "A prototype cellar selection imagined for peppered meat, candlelight and unhurried dinners.",
    notes: ["Black cherry", "Cocoa", "Warm spice"],
    serve: "Open twenty minutes before dinner and pour just below room temperature.",
    availability: { Lagos: "in-stock", Abuja: "low-stock", Ibadan: "unavailable", "Port Harcourt": "unavailable" },
    prototype: true
  },
  {
    id: "lagos-sunset-rose",
    name: "Lagos Sunset Sparkling Rosé",
    brand: "Yodla Cellar",
    category: "Sparkling Wines",
    subcategory: "Sparkling rosé",
    volume: "75cl",
    abv: "12%",
    price: 21000,
    image: "assets/products/originals/sunset-rose.jpg",
    imageMode: "dark",
    tag: "First glass at six",
    occasions: ["Dinner", "Toast", "Weekend"],
    description: "A dry, coral-toned sparkling rosé made for warm evenings and food that keeps arriving.",
    notes: ["Wild strawberry", "Pink citrus", "Mineral finish"],
    serve: "Chill well, then let it breathe for five minutes in the glass.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "low-stock", "Port Harcourt": "unavailable" },
    prototype: true
  },
  {
    id: "palm-botanical-gin",
    name: "Palm Botanical Gin",
    brand: "Yodla Studio",
    category: "Spirits",
    subcategory: "Gin",
    volume: "70cl",
    abv: "43%",
    price: 31500,
    image: "assets/products/originals/botanical-gin.jpg",
    imageMode: "dark",
    tag: "Built for tonic",
    occasions: ["Hosting", "Weekend", "Gift"],
    description: "A fictional small-batch gin concept with a bright botanical profile and a clean finish.",
    notes: ["Juniper", "Lime leaf", "Alligator pepper"],
    serve: "One part gin, three parts tonic, plenty of ice and a lime peel.",
    availability: { Lagos: "low-stock", Abuja: "in-stock", Ibadan: "unavailable", "Port Harcourt": "low-stock" },
    prototype: true
  },
  {
    id: "copper-palm-rum",
    name: "Copper Palm Aged Rum",
    brand: "Yodla Studio",
    category: "Spirits",
    subcategory: "Rum",
    volume: "70cl",
    abv: "40%",
    price: 36000,
    image: "assets/products/originals/copper-rum.jpg",
    imageMode: "dark",
    tag: "Slow, warm pour",
    occasions: ["Weekend", "Gift", "Hosting"],
    description: "A fictional amber rum concept with rounded spice and a polished after-dinner character.",
    notes: ["Burnt sugar", "Orange peel", "Nutmeg"],
    serve: "Pour neat or build a short drink with ginger and bitters.",
    availability: { Lagos: "in-stock", Abuja: "low-stock", Ibadan: "unavailable", "Port Harcourt": "in-stock" },
    prototype: true
  },
  {
    id: "indigo-vodka",
    name: "Indigo Night Vodka",
    brand: "Yodla Studio",
    category: "Spirits",
    subcategory: "Vodka",
    volume: "70cl",
    abv: "40%",
    price: 29000,
    image: "assets/products/originals/indigo-vodka.jpg",
    imageMode: "dark",
    tag: "Clean after midnight",
    occasions: ["Hosting", "Weekend"],
    description: "A fictional architectural vodka concept for crisp highballs and a crowded ice bucket.",
    notes: ["Clean grain", "Soft mineral", "Dry finish"],
    serve: "Chill hard and pair with soda, citrus or a dry mixer.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "low-stock", "Port Harcourt": "unavailable" },
    prototype: true
  },
  {
    id: "ginger-lime-mixer",
    name: "Ginger + Lime Sparkler",
    brand: "Yodla Mixers",
    category: "Mixers & Soft Drinks",
    subcategory: "Sparkling mixer",
    volume: "4 x 25cl",
    abv: "0%",
    price: 7200,
    image: "assets/products/originals/ginger-lime.jpg",
    imageMode: "dark",
    tag: "Brighten the pour",
    occasions: ["Hosting", "Weekend"],
    description: "A fictional alcohol-free mixer concept with ginger heat, lime lift and fine bubbles.",
    notes: ["Fresh ginger", "Lime zest", "Dry sparkle"],
    serve: "Pour over ice alone or use to lengthen dark spirits.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "in-stock", "Port Harcourt": "low-stock" },
    prototype: true
  },
  {
    id: "malt-reserve",
    name: "Malt Reserve",
    brand: "Yodla Zero",
    category: "Mixers & Soft Drinks",
    subcategory: "Malt drink",
    volume: "6 x 33cl",
    abv: "0%",
    price: 8900,
    image: "assets/products/originals/malt-reserve.jpg",
    imageMode: "dark",
    tag: "A richer zero",
    occasions: ["Dinner", "Hosting", "Weekend"],
    description: "A fictional full-flavoured malt concept for guests who want something celebratory without alcohol.",
    notes: ["Roasted malt", "Caramel", "Cocoa husk"],
    serve: "Serve properly cold in a tall glass.",
    availability: { Lagos: "in-stock", Abuja: "in-stock", Ibadan: "in-stock", "Port Harcourt": "in-stock" },
    prototype: true
  },
  {
    id: "celebration-duo",
    name: "The Celebration Duo",
    brand: "Yodla Gifting",
    category: "Extras",
    subcategory: "Gift set",
    volume: "2 bottles",
    abv: "Mixed",
    price: 92000,
    image: "assets/products/originals/celebration-set.png",
    imageMode: "transparent",
    tag: "Arrive properly",
    occasions: ["Gift", "Toast"],
    description: "A fictional presentation-set concept pairing a sparkling bottle with a warm amber spirit.",
    notes: ["Celebration", "Presentation case", "Two pours"],
    serve: "Gift unopened. Chill the sparkling bottle before the first toast.",
    availability: { Lagos: "low-stock", Abuja: "unavailable", Ibadan: "unavailable", "Port Harcourt": "unavailable" },
    prototype: true
  }
];

export function formatMoney(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

export function getProduct(productId) {
  return PRODUCTS.find((product) => product.id === productId) || null;
}

export function getAvailability(product, location) {
  if (!location) return "choose-location";
  return product.availability[location] || "unavailable";
}

export function filterProducts(filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const minimum = Number(filters.minimum || 0);
  const maximum = Number(filters.maximum || Number.MAX_SAFE_INTEGER);
  const category = filters.category || "All";
  const occasion = filters.occasion || "";
  const location = filters.location || "";

  return PRODUCTS.filter((product) => {
    const searchable = `${product.name} ${product.brand} ${product.category} ${product.subcategory} ${product.notes.join(" ")}`.toLowerCase();
    return (category === "All" || product.category === category)
      && (!occasion || product.occasions.includes(occasion))
      && (!query || searchable.includes(query))
      && product.price >= minimum
      && product.price <= maximum
      && (!location || getAvailability(product, location) !== "unavailable");
  });
}

export function sortProducts(products, sort = "featured") {
  const copy = [...products];
  if (sort === "price-asc") return copy.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") return copy.sort((a, b) => b.price - a.price);
  if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}
