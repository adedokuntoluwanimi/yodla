import { cataloguePhotoStyle, formatMoney } from "./catalog.js";
import { hamperDrinkReady, hamperTotals, isHamperExtraDrink, isHamperInventoryDrink, lagosCalendarDate, MAX_HAMPER_DRINK_QUANTITY, resolveHamperDrinks, wordCount } from "./catalog-order.js";
import { NIGERIAN_STATES } from "./states.js";

const draftKey = "yodla-hamper-v1";
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const arrow = '<svg class="ui-icon" aria-hidden="true"><use href="assets/icons.svg#arrow-up-right"></use></svg>';
export const hamperUrl = (id) => `/gifting.html?package=${encodeURIComponent(id)}`;

export function readHamperDraft() {
  try { return JSON.parse(sessionStorage.getItem(draftKey) || "null"); } catch { return null; }
}

export function clearHamperDraft() {
  try { sessionStorage.removeItem(draftKey); } catch {}
}

export function getHamperSelection(hampers, products, draft = readHamperDraft()) {
  const tier = hampers.find((item) => item.id === draft?.tierId);
  if (!tier?.basePrice || !Array.isArray(draft.addOnIds)) return null;
  const addons = draft.addOnIds.map((id) => tier.addOns.find((item) => item.id === id));
  if (addons.some((item) => !item || item.price === null || isHamperExtraDrink(item))) return null;
  const drinks = resolveHamperDrinks(draft, products, hamperDrinkReady);
  return drinks ? { tier, addons: [...addons, ...drinks], draft } : null;
}

export function orderTotalsMarkup(totals) {
  const row = (label, amount) => `<div class="checkout-total"><span>${label}</span><strong>${amount === null ? "At checkout" : formatMoney(amount)}</strong></div>`;
  return row("Subtotal", totals.subtotal)
    + (totals.serviceFee === undefined ? "" : row("Service fee · 30%", totals.serviceFee) + row("VAT on service fee · 7.5%", totals.serviceVat))
    + row("Delivery", totals.deliveryFee)
    + row(totals.deliveryFee === null ? "Total before delivery" : "Order total", totals.total)
    + (totals.dueNow === undefined ? "" : row("Pay now · 70%", totals.dueNow) + row("Due on delivery · 30%", totals.balanceDue));
}

function hamperPhoto(tier, eager) {
  return tier.image ? `<figure class="hamper-card__photo"><img src="${escape(tier.image)}" alt="${escape(tier.imageAlt)}" width="1200" height="900" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}><figcaption>Collection illustration</figcaption></figure>` : "";
}

export function renderHamperBuilder(target, hampers, products, toast) {
  const params = new URLSearchParams(location.search);
  const id = params.get("package") || location.hash.match(/^#hamper-([\w-]+)$/)?.[1];
  const tier = hampers.find((item) => item.id === id);
  target.classList.add("gift-flow--collections");
  if (tier) {
    renderPackage(target, tier, products.filter(isHamperInventoryDrink), !tier.basePrice || params.get("mode") === "inquiry", toast);
    return;
  }
  target.innerHTML = `<div class="shell">
    <header class="hamper-intro">
      <div><span class="eyebrow">The Yodla gift edit</span><h1>Gift hampers</h1></div>
      <div class="hamper-intro__note"><p>Choose a collection to see what’s inside and make it your own.</p></div>
    </header>
    ${id ? '<p role="status">That collection is unavailable. Browse the current collections below.</p>' : ""}
    <div class="hamper-grid">${hampers.map((item, index) => `<article class="hamper-card">
      <a class="hamper-card__link" href="${hamperUrl(item.id)}">
        ${hamperPhoto(item, index === 0)}
        <div class="hamper-card__body"><span class="hamper-card__edition">Collection ${String(index + 1).padStart(2, "0")}</span>
          <h2>${escape(item.name.replace(/ Collection$/, ""))}</h2>
          <span class="hamper-card__action">Explore package ${arrow}</span>
        </div>
      </a></article>`).join("") || '<div class="state-card"><h2>Hamper collections are temporarily unavailable.</h2><a class="text-link" href="contact.html?intent=gifting">Contact Yodla about gifting</a></div>'}</div></div>`;
}

function drinkPicker(drinks, inquiry) {
  return `<fieldset class="hamper-drinks"><legend>Extra drinks</legend>
    <p>${inquiry ? "Choose your drinks and quantities for the whole request." : "Build your own mix of drinks to send with this hamper."}</p>
    <ul class="hamper-drinks__selection" data-drink-selection hidden></ul>
    <p class="sr-only" data-drink-announcement role="status"></p>
    <details class="hamper-drinks__browse">
      <summary>Browse drinks <span>${drinks.length} choices</span></summary>
      <label class="hamper-drinks__search">Find a drink<input type="search" data-drink-search placeholder="Search by name or category" autocomplete="off"></label>
      <ul class="hamper-drinks__list" aria-label="Drinks from the shop">
        ${drinks.map((item) => {
          const ready = hamperDrinkReady(item);
          const name = escape(item.name);
          const price = ready ? `${formatMoney(item.price)} per ${item.unit === "each" ? "drink" : item.unit}`
            : (item.price > 0 ? `${formatMoney(item.price)} wholesale · hamper price on request` : "Price on request");
          return `<li data-drink-row="${escape(item.id)}">
            ${item.image ? `<span class="hamper-drinks__photo" data-catalogue-photo="${cataloguePhotoStyle(item)}" data-drink-category="${escape(item.category)}"><img src="${escape(item.image)}" alt="" width="56" height="56" loading="lazy"></span>` : '<span class="hamper-drinks__placeholder" aria-hidden="true">Y</span>'}
            <div class="hamper-drinks__label"><strong>${name}</strong><small>${price}</small></div>
            ${ready || inquiry ? `<div class="hamper-drinks__stepper" role="group" aria-label="Quantity for ${name}"><button type="button" data-drink-change="-1" aria-label="Remove one ${name}" disabled><svg class="ui-icon" aria-hidden="true"><use href="assets/icons.svg#minus"></use></svg></button><span data-drink-quantity>0</span><button type="button" data-drink-change="1" aria-label="Add one ${name}">+</button></div>` : '<small class="hamper-drinks__quote">Quote only</small>'}
          </li>`;
        }).join("")}
      </ul>
      <p class="hamper-drinks__search-empty" data-drink-empty hidden>No drinks match your search.</p>
    </details>
  </fieldset>`;
}

function renderPackage(target, tier, drinks, inquiry, toast) {
  const existing = readHamperDraft();
  const choices = tier.addOns.filter((item) => !isHamperExtraDrink(item));
  const availability = (item) => !inquiry && item.price === null ? "disabled" : "";
  const price = (item) => `<small>${item.price === null ? "By request" : formatMoney(item.price)}</small>`;
  document.title = `${tier.name} — Yodla Gifting`;
  target.innerHTML = `<div class="shell">
    <nav class="package-back" aria-label="Gifting"><a class="text-link" href="/gifting.html">Back to collections</a></nav>
    <header class="package-heading"><div><span class="eyebrow">Yodla gift hampers</span><h1>${escape(tier.name)}</h1></div>
      <div class="package-heading__action"><p><strong>${tier.basePrice ? formatMoney(tier.basePrice) : "Price on request"}</strong><small>Typical delivery in 24–48 hours</small></p>
      <a class="button button--dark" href="#package-options">${inquiry ? "Request a quote" : "Choose extras"}</a></div></header>
    <div class="package-layout">
      <div class="package-overview">${hamperPhoto(tier, true)}
        <section class="package-contents"><div><h2>Inside the box</h2><span>${tier.included.length} items</span></div>
        <ul>${tier.included.map((item) => `<li>${escape(item.name)}</li>`).join("")}</ul></section>
      </div>
      <section class="package-panel" id="package-options" aria-labelledby="package-form-title">
        <h2 id="package-form-title">${inquiry ? "Request a quote" : "Make it yours"}</h2>
        <p>${inquiry ? "Tell us how many you need, where they’re going, and which extras you’d like." : "Choose any extras here. You’ll add delivery and contact details at checkout."}</p>
        <form class="yodla-form" data-package-form>
          ${inquiry ? `<fieldset><legend>Delivery request</legend>
            <div class="field-pair"><label>Number of hampers<input name="quantity" type="number" inputmode="numeric" min="1" max="1000" value="1" required></label>
            <label>Preferred delivery date <small>Optional</small><input name="deliveryDate" type="date" min="${lagosCalendarDate()}"></label></div>
            <label>Delivery state<select name="state" required><option value="">Choose a state</option>${NIGERIAN_STATES.map((state) => `<option>${escape(state)}</option>`).join("")}</select></label>
          </fieldset>` : ""}
          ${choices.length ? `<fieldset><legend>Optional extras</legend>
            <div class="package-options">${choices.map((item) => `<label class="hamper-option"><input type="checkbox" name="addon" value="${escape(item.id)}" ${availability(item)}><span>${escape(item.name)} ${price(item)}</span></label>`).join("")}</div>
          </fieldset>` : ""}
          ${drinks.length ? drinkPicker(drinks, inquiry) : ""}
          <label data-hamper-note hidden>Handwritten note <small>Optional, up to 10 words</small><textarea name="note" maxlength="500" rows="2" disabled></textarea></label>
          <label data-hamper-mug hidden>Mug text <small>Optional, up to 10 words</small><input name="mugText" maxlength="500" disabled></label>
          ${inquiry ? `<fieldset><legend>Your contact details</legend>
            <div class="field-pair"><label>Name<input name="name" autocomplete="name" maxlength="100" required></label>
            <label>Email<input name="email" type="email" autocomplete="email" maxlength="160" required></label></div>
            <label>Phone <small>Optional</small><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>
            <label>Anything else? <small>Optional</small><textarea name="message" maxlength="1200" rows="3"></textarea></label>
          </fieldset>` : '<div class="package-totals" data-hamper-totals aria-live="polite"></div>'}
          <p data-package-status role="status" hidden></p>
          <button type="submit" class="button button--dark button--wide">${inquiry ? "Send quote request" : "Continue to checkout"} ${arrow}</button>
          ${tier.basePrice ? `<a class="text-link" href="${hamperUrl(tier.id)}${inquiry ? "" : "&mode=inquiry"}">${inquiry ? "Back to online checkout options" : "Request a quote for a custom order"}</a>` : ""}
        </form>
      </section>
    </div></div>`;
  const form = target.querySelector("[data-package-form]");
  const quantities = new Map();
  const drinkRows = [...form.querySelectorAll("[data-drink-row]")];
  if (existing?.tierId === tier.id && Array.isArray(existing.addOnIds)) {
    for (const input of form.querySelectorAll("[name=addon]:enabled")) input.checked = existing.addOnIds.includes(input.value);
    const savedDrinks = resolveHamperDrinks(existing, drinks, inquiry ? isHamperInventoryDrink : hamperDrinkReady);
    for (const drink of savedDrinks || []) quantities.set(drink.productId, drink.quantity);
    form.elements.note.value = existing.note || "";
    form.elements.mugText.value = existing.mugText || "";
  }
  function update() {
    const values = new FormData(form);
    const addOnIds = values.getAll("addon");
    const selected = choices.filter((item) => addOnIds.includes(item.id));
    const extraDrinks = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
    const chosenDrinks = resolveHamperDrinks({ extraDrinks }, drinks);
    for (const [field, selector, pattern] of [["note", "[data-hamper-note]", /handwritten.*note/i], ["mugText", "[data-hamper-mug]", /mug/i]]) {
      const enabled = selected.some((item) => pattern.test(item.name));
      form.querySelector(selector).hidden = !enabled;
      form.elements[field].disabled = !enabled;
      form.elements[field].setCustomValidity(wordCount(form.elements[field].value) > 10 ? "Use up to 10 words." : "");
    }
    const drinkSelection = form.querySelector("[data-drink-selection]");
    if (drinkSelection) {
      drinkSelection.hidden = !chosenDrinks.length;
      drinkSelection.innerHTML = chosenDrinks.map(({ name, quantity }) => `<li>${escape(name)} <strong>Qty ${quantity}</strong></li>`).join("");
    }
    const summary = form.querySelector("[data-hamper-totals]");
    if (summary) summary.innerHTML = orderTotalsMarkup({ ...hamperTotals(tier, [...selected, ...chosenDrinks]), deliveryFee: null });
    const personalization = new FormData(form);
    return { tierId: tier.id, addOnIds, extraDrinks, note: personalization.get("note") || "", mugText: personalization.get("mugText") || "" };
  }
  function updateDrinkRow(row) {
    const count = row.querySelector("[data-drink-quantity]");
    if (!count) return;
    const quantity = quantities.get(row.dataset.drinkRow) || 0;
    const remove = row.querySelector('[data-drink-change="-1"]');
    const add = row.querySelector('[data-drink-change="1"]');
    count.textContent = quantity;
    row.classList.toggle("is-selected", quantity > 0);
    remove.disabled = quantity === 0;
    add.disabled = quantity === MAX_HAMPER_DRINK_QUANTITY;
  }
  for (const row of drinkRows) updateDrinkRow(row);
  form.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drink-change]");
    if (!button) return;
    const row = button.closest("[data-drink-row]");
    const id = row.dataset.drinkRow;
    const quantity = (quantities.get(id) || 0) + Number(button.dataset.drinkChange);
    if (quantity && !quantities.has(id) && quantities.size === 100) {
      form.querySelector("[data-drink-announcement]").textContent = "Choose up to 100 different drinks.";
      return;
    }
    if (quantity) quantities.set(id, quantity);
    else quantities.delete(id);
    updateDrinkRow(row);
    if (button.disabled) row.querySelector("[data-drink-change]:enabled").focus();
    form.querySelector("[data-drink-announcement]").textContent = `${drinks.find((item) => item.id === id).name}, quantity ${quantity}.`;
    update();
  });
  const search = form.querySelector("[data-drink-search]");
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  search?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    for (const [index, row] of drinkRows.entries()) row.hidden = !`${drinks[index].name} ${drinks[index].category}`.toLowerCase().includes(query);
    form.querySelector("[data-drink-empty]").hidden = drinkRows.some((row) => !row.hidden);
  });
  form.addEventListener("change", update);
  form.addEventListener("input", (event) => {
    if (["note", "mugText"].includes(event.target.name)) event.target.setCustomValidity(wordCount(event.target.value) > 10 ? "Use up to 10 words." : "");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const draft = update();
    if (!form.reportValidity()) return;
    if (inquiry) {
      await submitQuote(form, draft);
      return;
    }
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
      location.assign("/checkout.html?hamper=1");
    } catch {
      toast("Allow browser storage to continue to checkout.", "error");
    }
  });
  update();
}

async function submitQuote(form, draft) {
  const button = form.querySelector("button[type=submit]");
  if (button.disabled) return;
  const status = form.querySelector("[data-package-status]");
  const { name, email, phone, state, quantity, deliveryDate, message } = Object.fromEntries(new FormData(form));
  button.disabled = true;
  status.hidden = false;
  status.className = "";
  status.textContent = "Sending your request…";
  let sent = false;
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hamper_inquiry", ...draft, name, email, phone, state, quantity: Number(quantity), deliveryDate, message }),
    });
    const result = await response.json();
    if (!response.ok) {
      status.className = "inline-status--error";
      status.textContent = result.error || "Your request could not be sent. Please try again.";
      return;
    }
    sent = true;
    const receipt = document.createElement("div");
    receipt.className = "package-receipt";
    receipt.tabIndex = -1;
    receipt.innerHTML = `<h3>Request received</h3><p>Reference ${escape(result.id)}. We’ll reply to the email you provided.</p><a class="text-link" href="/gifting.html">Back to collections</a>`;
    form.replaceWith(receipt);
    receipt.focus();
  } catch {
    status.className = "inline-status--error";
    status.textContent = "Your request could not be sent. Please try again.";
  } finally {
    if (!sent) button.disabled = false;
  }
}
