import { slugify } from "./content-model.js";

const sources = {
  "nestle-water": "https://sparnigeria.com/wp-content/uploads/2024/07/NESTLE-PURE-LIFE-DRINKING-WATER-60CL-e1722954714732.png",
  "pet-soft-drinks-coke-sprite-fanta": "https://sparnigeria.com/wp-content/uploads/2024/07/COCA-COLA-50CL-PET-e1722869809140.png",
  "can-malt": "https://sparnigeria.com/wp-content/uploads/2024/07/MALTA-GUINNESS-CAN-33CL-e1722870646345.png",
  "can-heineken": "https://sparnigeria.com/wp-content/uploads/2024/07/HEINEKEN-LAGER-BEER-SLEEK-CAN-33CL-e1722870025141.png",
  "5-alive": "https://sparnigeria.com/wp-content/uploads/2024/07/5-ALIVE-PULPY-ORANGE-FRUIT-DRINK-85CL.png",
  "martell-vs": "https://www.drinksdirect.ng/wp-content/uploads/2023/04/Martell-VS-800x800.png",
  "glenfiddich-15-years-old": "https://www.drinksdirect.ng/wp-content/uploads/2018/01/glenfiddich-15-800x800.png",
  "jameson-irish-green": "https://www.drinksdirect.ng/wp-content/uploads/2016/08/Jameson-800x800.png",
  "jameson-black-barrel": "https://www.drinksdirect.ng/wp-content/uploads/2019/11/James-Black-Barrel-800x800.png",
  "jack-daniels": "https://www.drinksdirect.ng/wp-content/uploads/2016/10/Jack-Daniels-800x800.png",
  "baileys": "https://www.drinksdirect.ng/wp-content/uploads/2016/09/Baileys-Original-800x800.png",
  "whiteley-neil": "https://www.drinksdirect.ng/wp-content/uploads/2026/01/whitley-neil-original-800x800.jpg",
  "johnnie-walker-red-label": "https://www.drinksdirect.ng/wp-content/uploads/2016/11/8-800x800.jpg",
  "can-small-stout-smooth": "https://ifeomachukwuka.ng/app/uploads/images%20(3)%20(23).jpeg",
  "can-smirnoff-white-black": "https://ifeomachukwuka.ng/app/uploads/thumb_images%20(3)%20(12)_743603573.jpeg",
  "chivita": "https://shoprite.ng/wp-content/uploads/2023/06/Juice-Chivita-1L-Apl-639.99-819.99-300x300.jpg",
  "volcan-blanco-tequila": "https://www.drinksdirect.ng/wp-content/uploads/2026/04/volcan2.jpg-800x800.jpeg",
  "cosmopolitan-vodka": "https://www.thecocktaildb.com/images/media/drink/kpsajh1504368362.jpg",
  "long-island": "https://www.thecocktaildb.com/images/media/drink/wx7hsg1504370510.jpg",
  "margarita-tequila": "https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg",
  "mojito-white": "https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg",
  "pina-colada": "https://www.thecocktaildb.com/images/media/drink/upgsue1668419912.jpg",
  "sex-on-the-beach": "https://www.thecocktaildb.com/images/media/drink/fi67641668420787.jpg",
  "tequila-sunrise": "https://www.thecocktaildb.com/images/media/drink/quqyqp1480879103.jpg",
  "can-schwepps": "https://smartiemart.com.ng/wp-content/uploads/2025/03/tonic-water.jpg",
  "red-wine": "https://shoprite.ng/wp-content/uploads/2024/03/Carlo-Rossi-Sweet-Red-750ml-300x300.jpg",
  "white-wine": "https://shoprite.ng/wp-content/uploads/2024/03/Carlo-Rossi-White-750ml-300x300.jpg",
  "edible-ice-bags": "https://static.wixstatic.com/media/d7ce09_3ad28ebec8f547c09fd7b9da8eb75a11~mv2.png/v1/fill/w_549,h_549,q_90/d7ce09_3ad28ebec8f547c09fd7b9da8eb75a11~mv2.png",
  "virgin-mojito": "https://travancorecourtcaters.com/wp-content/uploads/2026/06/Virgin-Mojito.jpg",
  "shirley-temple": "https://travancorecourtcaters.com/wp-content/uploads/2026/06/Shirley-Temple.jpg",
  "virgin-pina-colada": "https://travancorecourtcaters.com/wp-content/uploads/2026/06/Virgin-Pina-Colada.jpg",
  "sunrise": "https://travancorecourtcaters.com/wp-content/uploads/2026/06/Sunrise-Mocktail.jpg",
  "grant-whisky": "https://www.grantswhisky.com/assets/Uploads/elements/contentimage/mobile/TW-slide-1-mobile-bg.jpg",
  "disposable-cups-packs": "https://trivagenigeria.com/wp-content/uploads/2026/07/Coloured-plastic-cups-1-1-600x600.webp",
};
const representative = new Set([
  "pet-soft-drinks-coke-sprite-fanta",
  "can-malt",
  "can-schwepps",
  "can-smirnoff-white-black",
  "chivita",
  "5-alive",
  "jack-daniels",
  "baileys",
  "whiteley-neil",
  "grant-whisky",
  "red-wine",
  "white-wine",
  "edible-ice-bags",
  "disposable-cups-packs",
  "long-island",
  "mojito-white",
  "margarita-tequila",
  "pina-colada",
  "cosmopolitan-vodka",
  "sex-on-the-beach",
  "tequila-sunrise",
  "virgin-mojito",
  "shirley-temple",
  "virgin-pina-colada",
  "sunrise",
]);
const hamperItems = {
  essential: "drink-1-carlo-rossi drink-2-eva-sparkling-red-grape biscuits-royal-dansk-mc-vitie-s chocolates-cadbury-ferrero-rocher nuts-cashew-nuts sweet-treat-cookies yodla-greeting-card",
  signature: "drink-1-casillero-del-diablo drink-2-moet-chandon biscuits-fortnum-mason chocolates-ferrero-rocher-collection nuts-cashew-nuts sweet-treat-cookies beverage-twinings-tea premium-honey-nutella personalised-greeting-card",
  executive: "drink-1-veuve-cliicquot-yellow-label drink-2-jameson-black-barrel biscuits-fortnum-mason chocolates-ferrero-rocher-collection nuts-cashew-nuts sweet-treat-cookies beverage-twinings-tea premium-honey-nutella scented-candles personalised-greeting-card",
};

export function catalogPhoto(key) {
  const imageSource = sources[key];
  return imageSource ? { image: `/assets/products/catalogue/${key}.webp`, imageSource, representativeImage: representative.has(key) } : {};
}

export function hamperPhoto(tier) {
  const items = tier.included.map((item) => slugify(item.name)).sort().join(" ");
  if (hamperItems[tier.id]?.split(" ").sort().join(" ") !== items) return {};
  return { image: `/assets/gifting/hampers/${tier.id}.webp`, imageAlt: `Illustrated contents of the ${tier.name} hamper` };
}
