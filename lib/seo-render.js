const SITE_URL = (process.env.PUBLIC_SITE_URL || "https://yodla-fwy32oha6q-uc.a.run.app").replace(/\/$/, "");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function addFavicons(html) {
  const links = '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';
  return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">${links}`);
}

function absoluteUrl(value) {
  if (!value) return "";
  try { return new URL(value, `${SITE_URL}/`).toString(); } catch { return ""; }
}

function faqSchema(source) {
  if (!source?.faqEnabled || !source?.faqs?.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: source.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

function schemaGraph(document, type, canonical) {
  const geo = document.geo || {};
  const seo = document.seo || {};
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Yodla", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: type === "product" ? "Shop" : "Journal", item: `${SITE_URL}/${type === "product" ? "shop.html" : "journal.html"}` },
      { "@type": "ListItem", position: 3, name: document.name || document.title, item: canonical },
    ],
  };
  const citationTitle = geo.title || document.name || document.title;
  const citationDescription = geo.description || document.description || document.excerpt;
  const citationImage = absoluteUrl(geo.socialImage || document.image);
  const primary = type === "product" ? {
    "@type": "Product",
    name: citationTitle,
    description: document.description,
    abstract: citationDescription,
    image: citationImage || absoluteUrl(document.image),
    sku: document.id,
    brand: { "@type": "Brand", name: document.brand },
    keywords: [...(geo.secondaryKeywords || []), ...(geo.tags || [])].join(", ") || undefined,
    speakable: geo.structuredDataEnabled !== false ? { "@type": "SpeakableSpecification", cssSelector: ["h1", "[data-geo-abstract]"] } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: document.price,
      availability: Object.values(document.availability || {}).some((status) => status !== "unavailable") ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonical,
    },
  } : {
    "@type": "Article",
    headline: citationTitle,
    description: document.excerpt,
    abstract: citationDescription,
    image: citationImage || absoluteUrl(document.image),
    author: { "@type": "Organization", name: document.author || "Yodla" },
    publisher: { "@type": "Organization", name: "Yodla", url: SITE_URL },
    datePublished: document.publishedAt || undefined,
    dateModified: document.updatedAt || document.publishedAt || undefined,
    keywords: [...(geo.secondaryKeywords || []), ...(geo.tags || [])].join(", ") || undefined,
    speakable: geo.structuredDataEnabled !== false ? { "@type": "SpeakableSpecification", cssSelector: ["h1", "[data-geo-abstract]"] } : undefined,
    mainEntityOfPage: canonical,
  };
  return { "@context": "https://schema.org", "@graph": [primary, breadcrumb, faqSchema(seo), geo !== seo ? faqSchema(geo) : null].filter(Boolean) };
}

function meta(document, type) {
  const title = document.seo?.title || (type === "product" ? `${document.name} — Yodla` : `${document.title} — Yodla Journal`);
  const description = document.seo?.description || document.description || document.excerpt || "Yodla — thoughtfully selected drinks for Nigerian tables, nights and celebrations.";
  const canonical = document.seo?.canonicalUrl || `${SITE_URL}/${type === "product" ? "products" : "journal"}/${document.slug}`;
  const socialTitle = document.seo?.socialTitle || title;
  const socialDescription = document.seo?.socialDescription || description;
  const socialImage = absoluteUrl(document.seo?.socialImage || document.image);
  return { title, description, canonical, socialTitle, socialDescription, socialImage, robots: document.seo?.robots || "index,follow" };
}

function renderContentPageWithoutIcons(document, type) {
  const pageMeta = meta(document, type);
  const page = type === "product" ? "product" : "blog";
  const abstract = document.geo?.description || "";
  const related = type === "product"
    ? `<section class="related section shell"><div class="section-heading"><div><span class="eyebrow">Keep looking</span><h2>Good company<br>for this bottle.</h2></div><a class="text-link" href="shop.html">Browse all</a></div><div class="product-grid product-grid--three" data-related-grid></div></section>`
    : `<section class="blog-related section shell"><div class="section-heading"><div><span class="eyebrow">Keep reading</span><h2>More useful<br>notes.</h2></div><a class="text-link" href="journal.html">All stories</a></div><div class="editorial-grid editorial-grid--related" data-blog-related></div></section>`;
  const main = type === "product"
    ? `<section class="product-detail shell" data-product-detail></section>${abstract ? `<p class="sr-only" data-geo-abstract>${escapeHtml(abstract)}</p>` : ""}${related}`
    : `<article class="blog-detail shell" data-blog-detail></article>${abstract ? `<p class="sr-only" data-geo-abstract>${escapeHtml(abstract)}</p>` : ""}${related}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="/"><title>${escapeHtml(pageMeta.title)}</title><meta name="description" content="${escapeHtml(pageMeta.description)}"><meta name="robots" content="${escapeHtml(pageMeta.robots)}"><link rel="canonical" href="${escapeHtml(pageMeta.canonical)}"><meta property="og:type" content="${type === "product" ? "product" : "article"}"><meta property="og:title" content="${escapeHtml(pageMeta.socialTitle)}"><meta property="og:description" content="${escapeHtml(pageMeta.socialDescription)}"><meta property="og:url" content="${escapeHtml(pageMeta.canonical)}">${pageMeta.socialImage ? `<meta property="og:image" content="${escapeHtml(pageMeta.socialImage)}"><meta name="twitter:card" content="summary_large_image">` : ""}<script type="application/ld+json">${safeJson(schemaGraph(document, type, pageMeta.canonical))}</script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="css/styles.css"></head><body data-page="${page}" data-content-slug="${escapeHtml(document.slug)}"><header class="site-header" data-site-header></header><main>${main}</main><footer data-site-footer></footer><script src="js/vendor/gsap.min.js"></script><script src="js/vendor/ScrollTrigger.min.js"></script><script type="module" src="js/main.js"></script></body></html>`;
}

export function renderContentPage(document, type) {
  return addFavicons(renderContentPageWithoutIcons(document, type));
}

export function renderLlmsTxt(content) {
  const lines = [
    "# Yodla",
    "> Thoughtfully selected drinks for Nigerian tables, nights and celebrations.",
    "",
    `Site: ${SITE_URL}`,
    "",
    "## Products",
  ];
  content.products.forEach((product) => {
    const geo = product.geo || {};
    lines.push(`- ${geo.title || product.name}`);
    lines.push(`  URL: ${SITE_URL}/products/${product.slug}`);
    if (geo.description) lines.push(`  ${geo.description}`);
    if (geo.focusKeyphrase) lines.push(`  Keyphrase: ${geo.focusKeyphrase}`);
    (geo.faqs || []).forEach((faq) => lines.push(`  Q: ${faq.question} A: ${faq.answer}`));
    lines.push("");
  });
  lines.push("## Journal");
  content.blogs.forEach((post) => {
    const geo = post.geo || {};
    lines.push(`- ${geo.title || post.title}`);
    lines.push(`  URL: ${SITE_URL}/journal/${post.slug}`);
    if (geo.description) lines.push(`  ${geo.description}`);
    if (geo.focusKeyphrase) lines.push(`  Keyphrase: ${geo.focusKeyphrase}`);
    (geo.faqs || []).forEach((faq) => lines.push(`  Q: ${faq.question} A: ${faq.answer}`));
    lines.push("");
  });
  return `${lines.join("\n").trim()}\n`;
}

function renderNotFoundWithoutIcons(type) {
  const label = type === "product" ? "Bottle" : "Story";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><meta name="robots" content="noindex"><title>${label} not found — Yodla</title><link rel="stylesheet" href="css/styles.css"></head><body><main class="shell section"><div class="state-card"><span class="eyebrow">${label} unavailable</span><h1>This ${label.toLowerCase()} is no longer on the shelf.</h1><p>Browse what is currently available.</p><a class="button button--dark" href="${type === "product" ? "shop.html" : "journal.html"}">Continue browsing</a></div></main></body></html>`;
}

export function renderNotFound(type) {
  return addFavicons(renderNotFoundWithoutIcons(type));
}

export function publicSiteUrl() { return SITE_URL; }
