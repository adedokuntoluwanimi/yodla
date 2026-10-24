const CONTENT_URL = "https://yodla-fwy32oha6q-uc.a.run.app/api/content";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

export function findDetail(content, kind, slug) {
  const list = kind === "product" ? content?.products : content?.blogs;
  return Array.isArray(list) ? list.find((item) => item.slug === slug && item.status !== "draft") : null;
}

export function renderDetailPage(document, kind, origin = "") {
  const product = kind === "product";
  const title = document.seo?.title || `${document.name || document.title} — Yodla`;
  const description = document.seo?.description || document.description || document.excerpt || "A Yodla selection for a thoughtful gift.";
  const path = product ? "products" : "journal";
  const page = product ? "product" : "blog";
  const url = origin ? `${origin}/${path}/${encodeURIComponent(document.slug)}` : "";
  const image = document.seo?.socialImage || document.image || "";
  const imageUrl = image && origin && !/^https?:\/\//i.test(image) ? `${origin}/${image.replace(/^\//, "")}` : image;
  const heading = escapeHtml(document.name || document.title);
  const excerpt = escapeHtml(description);
  const main = product
    ? `<section class="product-detail shell" data-product-detail><div class="detail-loading"><span class="eyebrow">Yodla bottles</span><h1>${heading}</h1><p>${excerpt}</p></div></section><section class="related section shell"><div class="section-heading"><div><span class="eyebrow">Good company</span><h2>More to give.</h2></div><a class="text-link" href="/shop.html?occasion=Gift">Browse gifts</a></div><div class="product-grid product-grid--three" data-related-grid></div></section>`
    : `<article class="blog-detail shell" data-blog-detail><header class="blog-hero"><span class="eyebrow">Yodla journal</span><h1>${heading}</h1><p>${excerpt}</p></header></article><section class="blog-related section shell"><div class="section-heading"><div><span class="eyebrow">Keep reading</span><h2>More good notes.</h2></div><a class="text-link" href="/journal.html">The journal</a></div><div class="editorial-grid editorial-grid--related" data-blog-related></div></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><meta name="description" content="${excerpt}"><meta property="og:type" content="${product ? "product" : "article"}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${excerpt}">${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ""}${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ""}<link rel="icon" href="/favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Syne:wght@500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/gift-club.css"></head><body data-page="${page}" data-content-slug="${escapeHtml(document.slug)}"><header class="site-header" data-site-header></header><main>${main}</main><footer data-site-footer></footer><script src="/js/vendor/gsap.min.js"></script><script src="/js/vendor/ScrollTrigger.min.js"></script><script type="module" src="/js/main.js"></script><script type="module" src="/js/experience.js"></script></body></html>`;
}

export default async function handler(request, response) {
  const kind = request.query.kind;
  const slug = request.query.slug;
  if (request.method !== "GET" || !["product", "blog"].includes(kind) || !/^[a-z0-9-]{1,120}$/.test(slug || "")) {
    response.status(404).send("Not found");
    return;
  }
  try {
    const upstream = await fetch(CONTENT_URL, { headers: { Accept: "application/json" } });
    if (!upstream.ok) throw new Error(`Content returned ${upstream.status}`);
    const content = await upstream.json();
    const document = findDetail(content, kind, slug);
    if (!document) {
      response.status(404).send("Not found");
      return;
    }
    const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").replace(/[^a-zA-Z0-9.:-]/g, "");
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).send(renderDetailPage(document, kind, host ? `https://${host}` : ""));
  } catch (error) {
    console.error("Gift experience detail error:", error);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(503).send('<!doctype html><title>Yodla is taking a moment</title><main style="font:16px sans-serif;max-width:38rem;margin:12vh auto;padding:1rem"><h1>We can’t show this page just now.</h1><p>Please try again shortly, or browse the bottles.</p><a href="/shop.html">Browse bottles</a></main>');
  }
}
