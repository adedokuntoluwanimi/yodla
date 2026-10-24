import { PRODUCTS, formatMoney } from "/js/catalog.js";
import { readGiftDraft, updateGiftMessage } from "/js/gifting.js";
import { giftTotals } from "/js/gifting-ui.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const paths = {
  person: [
    { label: "For my partner", detail: "For your favourite person", value: "partner", image: "gift-note-cutout.webp" },
    { label: "For a friend", detail: "Because they just get you", value: "friend", image: "gift-selection-cutout.webp" },
    { label: "For my people", detail: "A thoughtful thank you, times a few", value: "team", image: "gift-finished-cutout.webp" },
  ],
  occasion: [
    { label: "A birthday", detail: "Another year worth raising a glass to", value: "birthday", image: "gift-finished-cutout.webp" },
    { label: "A big win", detail: "For the news you can’t stop smiling about", value: "congratulations", image: "gift-selection-cutout.webp" },
    { label: "A thank you", detail: "The words and the bottle", value: "thank-you", image: "gift-note-cutout.webp" },
  ],
  mood: [
    { label: "A little sparkle", detail: "Let the occasion shine", value: "sparkle", image: "gift-finished-cutout.webp" },
    { label: "Something classic", detail: "A choice they’ll keep coming back to", value: "classic", image: "gift-ribbon-cutout.webp" },
    { label: "A soft landing", detail: "A quiet, lovely kind of gift", value: "quiet", image: "gift-note-cutout.webp" },
  ],
};

function renderPaths(type) {
  const panel = $("[data-intent-panel]");
  if (!panel || !paths[type]) return;
  panel.innerHTML = paths[type].map((item, index) => `
    <a class="gift-path-card" href="gifting.html?${encodeURIComponent(type)}=${encodeURIComponent(item.value)}#gift-builder">
      <span class="gift-path-card__number">${String(index + 1).padStart(2, "0")}</span>
      <img src="assets/gifting/${item.image}" alt="" loading="lazy" width="900" height="1200">
      <span class="gift-path-card__copy"><small>${escapeHtml(item.detail)}</small><strong>${escapeHtml(item.label)}</strong><em>Make this gift <span aria-hidden="true">↗</span></em></span>
    </a>`).join("");
  $$('[data-intent-tab]').forEach((tab) => {
    const active = tab.dataset.intentTab === type;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
}

function initPaths() {
  const tabs = $$('[data-intent-tab]');
  if (!tabs.length) return;
  renderPaths("person");
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => renderPaths(tab.dataset.intentTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      renderPaths(tabs[next].dataset.intentTab);
    });
  });
}

function initQuickNote() {
  const input = $("[data-quick-note]");
  const preview = $("[data-quick-note-preview]");
  const count = $("[data-quick-note-count]");
  const save = $("[data-quick-note-save]");
  if (!input || !preview || !count || !save) return;
  input.value = readGiftDraft().message || "";
  const refresh = () => {
    preview.textContent = input.value.trim() || "Your words make it theirs.";
    count.textContent = `${input.value.length} / 500`;
  };
  input.addEventListener("input", refresh);
  save.addEventListener("click", () => {
    updateGiftMessage(input.value);
    location.assign("gifting.html#gift-builder");
  });
  refresh();
}

function giftIntent() {
  const params = new URLSearchParams(location.search);
  const type = ["person", "occasion", "mood"].find((key) => params.has(key));
  if (!type) return null;
  const choice = paths[type].find((item) => item.value === params.get(type));
  return choice ? { type, ...choice } : null;
}

function rankGiftCards(intent) {
  if (!intent) return;
  const shelf = $("[data-gift-products]");
  if (!shelf) return;
  const matches = (product) => {
    const text = `${product.category || ""} ${(product.occasions || []).join(" ")} ${product.name || ""}`.toLowerCase();
    if (intent.value === "sparkle" || intent.value === "birthday" || intent.value === "congratulations") return /sparkling|champagne|celebrat|toast|birthday/.test(text);
    if (intent.value === "classic" || intent.value === "partner") return /whisky|cognac|wine|dinner|romantic/.test(text);
    if (intent.value === "quiet" || intent.value === "friend") return /wine|zero|soft|gin|mixers/.test(text);
    return /gift|hosting|celebrat/.test(text);
  };
  const cards = $$(".gift-pick-card", shelf);
  const ranked = cards.map((card, index) => {
    const product = PRODUCTS.find((item) => item.id === $("[data-gift-bottle]", card)?.dataset.giftBottle);
    return { card, index, recommended: Boolean(product && matches(product)) };
  });
  if (!ranked.some((item) => item.recommended)) return;
  ranked.sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.index - b.index);
  if (ranked.some((item, index) => cards[index] !== item.card)) shelf.replaceChildren(...ranked.map((item) => item.card));
  ranked.forEach(({ card, recommended }) => {
    card.classList.toggle("gift-pick-card--recommended", recommended);
    let tag = $(".gift-pick-card__match", card);
    if (recommended && !tag) {
      tag = document.createElement("small");
      tag.className = "gift-pick-card__match";
      tag.textContent = "A lovely fit";
      $(".gift-pick-card__meta", card)?.prepend(tag);
    } else if (!recommended) tag?.remove();
  });
}

function renderGiftPreview() {
  const preview = $(".gift-live-preview");
  if (!preview) return;
  const draft = readGiftDraft();
  const person = $("[data-gift-preview-person]", preview);
  const message = $("[data-gift-preview-message]", preview);
  const count = $("[data-gift-preview-count]", preview);
  const total = $("[data-gift-preview-total]", preview);
  const image = $("[data-gift-preview-image]", preview);
  const bottleName = $("[data-gift-preview-bottle-name]", preview);
  const bottles = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const active = draft.recipients.find((item) => item.id === draft.activeRecipientId);
  person.textContent = active?.firstName || (draft.recipients.length > 1 ? `${draft.recipients.length} lovely people` : draft.recipients[0]?.firstName || "Someone special");
  message.textContent = draft.message.trim() || "Good things deserve to be shared.";
  count.textContent = `${bottles} ${bottles === 1 ? "bottle" : "bottles"} · ${draft.recipients.length} ${draft.recipients.length === 1 ? "person" : "people"}`;
  total.textContent = formatMoney(giftTotals(draft).total);
  const chosen = draft.items.find((item) => item.recipientId === active?.id) || draft.items[0];
  const product = PRODUCTS.find((item) => item.id === chosen?.productId);
  const asset = product?.image || `assets/gifting/${draft.step === 1 ? "gift-note-cutout.webp" : draft.step === 2 ? "gift-selection-cutout.webp" : "gift-finished-cutout.webp"}`;
  if (!image.src.endsWith(asset)) image.src = asset;
  image.alt = product ? product.name : "";
  image.classList.toggle("gift-live-preview__bottle--chosen", Boolean(product));
  if (bottleName) {
    bottleName.hidden = !product;
    bottleName.textContent = product?.name || "";
  }
  preview.classList.toggle("gift-live-preview--wrapped", draft.wrap);
}

function initGiftPreview() {
  if (!$(".gift-live-preview")) return;
  const intent = giftIntent();
  const summary = $("[data-gift-intent-summary]");
  if (intent && summary) summary.textContent = `STARTING WITH ${intent.label.toUpperCase()}`;
  renderGiftPreview();
  const queue = () => requestAnimationFrame(() => { renderGiftPreview(); rankGiftCards(intent); });
  document.addEventListener("click", queue);
  document.addEventListener("input", queue);
  document.addEventListener("change", queue);
  document.addEventListener("submit", queue);
  ["[data-gift-recipients]", "[data-gift-assign]", "[data-gift-products]"].forEach((selector) => {
    const target = $(selector);
    if (target) new MutationObserver(queue).observe(target, { childList: true, subtree: true });
  });
  queue();
}

function retuneShell() {
  const header = $("[data-site-header]");
  if (header && !header.dataset.giftRetuned && $(".desktop-nav", header)) {
    const nav = $(".desktop-nav", header);
    nav.innerHTML = '<a href="gifting.html">Make a gift</a><a href="shop.html?occasion=Gift">Giftable bottles</a><a href="shop.html">Shop for yourself</a><a href="journal.html">Journal</a>';
    header.dataset.giftRetuned = "true";
  }
  const footer = $("[data-site-footer]");
  if (footer && !footer.dataset.giftRetuned && $(".footer-callout", footer)) {
    $(".footer-callout p", footer).textContent = "Make their moment.";
    const link = $(".footer-callout a", footer);
    link.href = "gifting.html#gift-builder";
    link.firstChild.textContent = "Create a gift ";
    const description = $(".footer-grid > div:first-child p", footer);
    if (description) description.textContent = "Thoughtful bottles for the people and moments that matter.";
    const prototype = $(".footer-bottom span:last-child", footer);
    if (prototype) prototype.textContent = "Gifting, made personal";
    footer.dataset.giftRetuned = "true";
  }
}

initPaths();
initQuickNote();
initGiftPreview();
retuneShell();
const shellObserver = new MutationObserver(retuneShell);
shellObserver.observe(document.body, { childList: true, subtree: true });
