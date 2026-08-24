import test from "node:test";
import assert from "node:assert/strict";
import { heroPositionLabel, nextHeroIndex, normalizeHeroSlides } from "../js/hero-carousel.js";

test("legacy homepage hero becomes the first carousel slide", () => {
  const legacy = { hero: { imageProductId: "celebration-duo", captionStrong: "Celebration Duo" } };
  const slides = normalizeHeroSlides(legacy);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].id, "celebration-duo");
  assert.equal(slides[0].captionStrong, "Celebration Duo");
});

test("carousel arrows wrap in both directions", () => {
  assert.equal(nextHeroIndex(3, 1, 4), 0);
  assert.equal(nextHeroIndex(0, -1, 4), 3);
  assert.equal(nextHeroIndex(1, 1, 4), 2);
});

test("accessible carousel announcement includes position and occasion", () => {
  assert.equal(heroPositionLabel(1, 4, { captionStrong: "Dinner, poured slowly" }), "Slide 2 of 4: Dinner, poured slowly");
});
