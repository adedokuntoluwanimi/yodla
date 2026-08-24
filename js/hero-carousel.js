export function normalizeHeroSlides(home = {}) {
  const slides = Array.isArray(home.heroSlides) ? home.heroSlides.filter(Boolean) : [];
  if (slides.length) return slides.map((slide, index) => ({ ...slide, id: slide.id || `hero-${index + 1}` }));
  if (!home.hero) return [];
  return [{ ...home.hero, id: home.hero.id || home.hero.imageProductId || "hero-legacy" }];
}

export function nextHeroIndex(current, delta, total) {
  if (!Number.isInteger(total) || total < 1) return 0;
  return ((Number(current) + Number(delta || 0)) % total + total) % total;
}

export function heroPositionLabel(index, total, slide = {}) {
  const name = slide.captionStrong || slide.occasion || "Yodla selection";
  return `Slide ${index + 1} of ${total}: ${name}`;
}
