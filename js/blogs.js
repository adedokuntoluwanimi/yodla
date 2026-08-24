export const BLOG_POSTS = [
  {
    id: "highball-for-a-full-house",
    category: "Hosting",
    readTime: "4 min read",
    title: "The highball that saves a crowded house.",
    excerpt: "One ratio, plenty of ice, and no queue forming at the kitchen counter.",
    image: "assets/products/originals/ginger-lime.jpg",
    imageId: "ginger-lime-mixer",
    introduction: "A good host drink should be generous, repeatable and difficult to get wrong while somebody is asking where the bottle opener lives.",
    sections: [
      { heading: "Start with the ratio", body: "Use one part spirit to three parts mixer. It is long enough to stay refreshing and simple enough to make without measuring every glass." },
      { heading: "Ice is an ingredient", body: "Fill the glass all the way. More ice keeps the drink colder and slows dilution; three lonely cubes do the opposite." },
      { heading: "Build a small station", body: "Put the spirit, mixer, citrus and a towel together. Guests can help themselves without turning the kitchen into a service counter." }
    ],
    pullQuote: "The best house drink gives the host their evening back."
  },
  {
    id: "wine-for-pepper-and-smoke",
    category: "Dinner",
    readTime: "5 min read",
    title: "Wine for pepper, smoke and late plates.",
    excerpt: "How to choose a bottle that stays present beside bold Nigerian food.",
    image: "assets/products/originals/midnight-red.jpg",
    imageId: "midnight-red",
    introduction: "Pairing does not need a rulebook. The useful question is whether the bottle can stay lively beside heat, smoke, sweetness and a table that keeps changing.",
    sections: [
      { heading: "Follow weight, not colour", body: "A lighter red can work better than a heavy one with grilled meat, while a textured white can handle richer sauces. Match intensity before convention." },
      { heading: "Let fruit soften heat", body: "Ripe fruit and fresh acidity are helpful beside pepper. High alcohol and aggressive oak can make heat feel louder." },
      { heading: "Serve it slightly cooler", body: "Lagos room temperature is not cellar temperature. Fifteen minutes in the fridge can make a red feel brighter and more composed." }
    ],
    pullQuote: "Choose the bottle that keeps the next bite interesting."
  },
  {
    id: "arrive-with-the-right-bottle",
    category: "Gifting",
    readTime: "3 min read",
    title: "How to arrive with the right bottle.",
    excerpt: "A practical guide to bringing something thoughtful without overthinking it.",
    image: "assets/products/originals/celebration-set.png",
    imageId: "celebration-duo",
    introduction: "The right gift bottle says you noticed the occasion. It does not need to be the most expensive thing in the room.",
    sections: [
      { heading: "Know when it will be opened", body: "Bring chilled bubbles when the toast is tonight. Choose a spirit or presentation set when the host should decide when to open it." },
      { heading: "Make the handover easy", body: "A simple note is more useful than a speech. Mention whether the bottle is ready to serve and then let the host keep hosting." },
      { heading: "Give for their taste", body: "A familiar favourite in a better presentation often lands more warmly than a rare bottle they never asked for." }
    ],
    pullQuote: "Thoughtfulness is the part people remember after the bottle is gone."
  }
];

export function getBlogPost(postId) {
  return BLOG_POSTS.find((post) => post.id === postId) || null;
}
