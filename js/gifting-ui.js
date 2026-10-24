import { PRODUCTS, getProduct, getAvailability, formatMoney as money } from "./catalog.js";
import { NIGERIAN_STATES, catalogLocationForState } from "./states.js";
import { refreshSelect } from "./custom-select.js";
import {
  readGiftDraft,
  updateGiftDraft,
  addGiftRecipient,
  removeGiftRecipient,
  setGiftQuantityForTarget,
  giftDraftError,
  ALL_RECIPIENTS,
} from "./gifting.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const fee = (state) => {
  const major = new Set(["Lagos", "Abuja", "FCT", "Rivers", "Oyo"]);
  return major.has(state) ? 2500 : 4500;
};

let notify = () => {};
let picture = () => "";
let floatBottle = () => {};
let initialized = false;
let removeId = "";
let editingId = "";

export function giftTotals(draft = readGiftDraft()) {
  const subtotal = draft.items.reduce((sum, item) => sum + (getProduct(item.productId)?.price || 0) * item.quantity, 0);
  const deliveryFee = draft.recipients.reduce((sum, person) => sum + fee(person.state), 0);
  const giftFee = draft.wrap ? 1500 : 0;
  return { subtotal, deliveryFee, giftFee, total: subtotal + deliveryFee + giftFee };
}

function totalsHtml(draft) {
  const totals = giftTotals(draft);
  return `<div class="gift-costs">
    <p><span>Bottles</span><b>${money(totals.subtotal)}</b></p>
    <p><span>Delivery · ${draft.recipients.length} recipient${draft.recipients.length === 1 ? "" : "s"}</span><b>${money(totals.deliveryFee)}</b></p>
    ${draft.wrap ? `<p><span>Gift wrap</span><b>${money(totals.giftFee)}</b></p>` : ""}
    <p class="gift-costs__total"><span>Total</span><strong>${money(totals.total)}</strong></p>
  </div>`;
}

export function giftReviewHtml(draft = readGiftDraft()) {
  if (!draft.recipients.length) {
    return `<p class="gift-builder__hint">No recipients yet.</p>`;
  }
  return draft.recipients.map((person) => {
    const lines = draft.items.filter((item) => item.recipientId === person.id);
    return `<article class="gift-review-person">
      <div class="gift-person-heading"><h3>${esc(person.name)}</h3><span>${esc(person.state)}</span></div>
      <p>${esc(person.address)}<br>${esc(person.email)}<br>${esc(person.phone)}${person.note ? `<br><em>Courier: ${esc(person.note)}</em>` : ""}${person.message ? `<br><em>Personal message: ${esc(person.message)}</em>` : ""}</p>
      <ul>${lines.map((item) => {
        const product = getProduct(item.productId);
        return `<li><span>${esc(product?.name || "Unavailable bottle")} <small>× ${item.quantity}</small></span><b>${money((product?.price || 0) * item.quantity)}</b></li>`;
      }).join("") || "<li><span>No bottles yet</span><b></b></li>"}</ul>
      <p class="gift-delivery-line"><span>Delivery</span><b>${money(fee(person.state))}</b></p>
    </article>`;
  }).join("")
    + `<div class="gift-note-review">${draft.message ? `<p>“${esc(draft.message)}”</p>` : "<p>No shared note.</p>"}
      <small>${draft.notify !== false ? "Recipient emails enabled" : "Recipient emails turned off"}</small>
    </div>`
    + totalsHtml(draft);
}

export function addGiftProduct(productId) {
  const draft = readGiftDraft();
  const product = getProduct(productId);
  if (!draft.recipients.length) return notify("Add a recipient first.", "error");
  if (!product) return notify("That bottle is unavailable.", "error");

  const shoppingAll = draft.activeRecipientId === ALL_RECIPIENTS || !draft.activeRecipientId;
  const targets = shoppingAll
    ? draft.recipients
    : draft.recipients.filter((person) => person.id === draft.activeRecipientId);

  if (!targets.length) return notify("Choose a recipient first.", "error");

  const availableTargets = targets.filter((person) => {
    const location = catalogLocationForState(person.state);
    return getAvailability(product, location) !== "unavailable";
  });
  if (!availableTargets.length) {
    return notify("This bottle is unavailable for the selected recipient delivery state.", "error");
  }

  try {
    if (shoppingAll) {
      // Keep each recipient's current qty for this bottle, then +1 for everyone available.
      for (const person of availableTargets) {
        const quantity = draft.items.find((item) => item.recipientId === person.id && item.productId === productId)?.quantity || 0;
        setGiftQuantityForTarget(person.id, productId, quantity + 1);
      }
      renderGift();
      const skipped = targets.length - availableTargets.length;
      notify(skipped
        ? `Added for ${availableTargets.length} recipients (${skipped} unavailable in their state).`
        : `Added for all ${availableTargets.length} recipients.`);
      return;
    }

    const person = availableTargets[0];
    const quantity = draft.items.find((item) => item.recipientId === person.id && item.productId === productId)?.quantity || 0;
    setGiftQuantityForTarget(person.id, productId, quantity + 1);
    renderGift();
    notify(`Added for ${person.firstName || person.name}.`);
  } catch (error) {
    notify(error.message, "error");
  }
}

export function renderGift() {
  const draft = readGiftDraft();
  const list = $("[data-gift-recipients]");
  if (list) {
    list.innerHTML = draft.recipients.length
      ? draft.recipients.map((person) => `<li>
          <div class="gift-person-copy">
            <strong>${esc(person.name)}</strong>
            <small>${esc(person.email)}</small>
            <small>${esc(person.address || "Delivery details needed")}${person.state ? `, ${esc(person.state)}` : ""}</small>
          </div>
          <div class="gift-person-actions">
            <button type="button" data-recipient-edit="${esc(person.id)}">Edit</button>
            <button type="button" data-recipient-remove="${esc(person.id)}">Remove</button>
          </div>
        </li>`).join("")
      : `<li class="gift-builder__empty">No one added yet.</li>`;
  }

  const select = $("[data-gift-person]");
  if (select) {
    const shoppingAll = draft.activeRecipientId === ALL_RECIPIENTS || !draft.activeRecipientId;
    const activeId = shoppingAll
      ? ALL_RECIPIENTS
      : (draft.recipients.some((person) => person.id === draft.activeRecipientId)
        ? draft.activeRecipientId
        : ALL_RECIPIENTS);
    select.innerHTML = draft.recipients.length
      ? [
        `<option value="${ALL_RECIPIENTS}" ${activeId === ALL_RECIPIENTS ? "selected" : ""}>All recipients</option>`,
        ...draft.recipients.map((person) =>
          `<option value="${esc(person.id)}" ${activeId === person.id ? "selected" : ""}>${esc(person.name)}</option>`
        ),
      ].join("")
      : `<option value="">Add a recipient first</option>`;
    select.value = draft.recipients.length ? activeId : "";
    refreshSelect(select);
  }

  const message = $("[data-gift-message]");
  if (message && document.activeElement !== message) message.value = draft.message || "";
  const wrap = $("[data-gift-wrap]");
  if (wrap) wrap.checked = Boolean(draft.wrap);
  const notifyBox = $("[data-gift-notify]");
  if (notifyBox) notifyBox.checked = draft.notify !== false;

  const shoppingAll = draft.activeRecipientId === ALL_RECIPIENTS || !draft.activeRecipientId;
  const person = shoppingAll ? null : draft.recipients.find((entry) => entry.id === draft.activeRecipientId);
  const picks = $("[data-gift-products]");
  if (picks) {
    const giftish = PRODUCTS.filter((product) => (product.occasions || []).some((item) => /gift|hosting|toast/i.test(item)));
    const shelf = (giftish.length ? giftish : PRODUCTS).slice(0, 8);
    picks.innerHTML = shelf.map((product) => {
      let available = false;
      let actionLabel = "Add a recipient first";
      if (!draft.recipients.length) {
        available = false;
      } else if (shoppingAll) {
        available = draft.recipients.some((entry) => getAvailability(product, catalogLocationForState(entry.state)) !== "unavailable");
        actionLabel = available ? "Add for all" : "Unavailable here";
      } else if (person) {
        available = getAvailability(product, catalogLocationForState(person.state)) !== "unavailable";
        actionLabel = available ? `Add for ${person.firstName || person.name}` : "Unavailable here";
      }
      return `<article class="gift-pick-card">
        <div class="gift-pick-card__media">${picture(product, { sizes: "150px" })}</div>
        <div class="gift-pick-card__meta">
          <strong>${esc(product.name)}</strong>
          <span>${money(product.price)}</span>
          <button type="button" class="gift-add-bottle" data-gift-bottle="${esc(product.id)}" ${available ? "" : "disabled"}>
            ${esc(actionLabel)}
          </button>
        </div>
      </article>`;
    }).join("");
  }

  const assigned = $("[data-gift-assign]");
  if (assigned) {
    if (!draft.recipients.length) {
      assigned.innerHTML = `<p class="gift-builder__hint">Add recipients first, then pick bottles.</p>`;
    } else if (shoppingAll) {
      const byProduct = new Map();
      for (const item of draft.items) {
        const row = byProduct.get(item.productId) || { productId: item.productId, quantities: [] };
        row.quantities.push(item.quantity);
        byProduct.set(item.productId, row);
      }
      const rows = [...byProduct.values()];
      assigned.innerHTML = rows.length
        ? `<span class="eyebrow">For all recipients</span>${rows.map((row) => {
          const product = getProduct(row.productId);
          const minQty = Math.min(...row.quantities);
          const same = row.quantities.every((qty) => qty === minQty) && row.quantities.length === draft.recipients.length;
          return `<div class="gift-assign__row">
            <div><strong>${esc(product?.name || row.productId)}</strong><small>${same ? `× ${minQty} each` : "Mixed quantities by person"}</small></div>
            <div class="gift-quantity">
              <button type="button" data-gift-qty="${esc(row.productId)}" data-delta="-1" aria-label="Reduce ${esc(product?.name || "bottle")} for all">−</button>
              <span>${same ? minQty : "—"}</span>
              <button type="button" data-gift-qty="${esc(row.productId)}" data-delta="1" aria-label="Increase ${esc(product?.name || "bottle")} for all">+</button>
            </div>
          </div>`;
        }).join("")}`
        : `<p class="gift-builder__hint">Add bottles once — they’ll be included for every recipient.</p>`;
    } else {
      const lines = draft.items.filter((item) => item.recipientId === person.id);
      assigned.innerHTML = lines.length
        ? `<span class="eyebrow">For ${esc(person.name)}</span>${lines.map((item) => {
          const product = getProduct(item.productId);
          return `<div class="gift-assign__row">
            <strong>${esc(product?.name || item.productId)}</strong>
            <div class="gift-quantity">
              <button type="button" data-gift-qty="${esc(item.productId)}" data-delta="-1" aria-label="Reduce ${esc(product?.name || "bottle")}">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-gift-qty="${esc(item.productId)}" data-delta="1" aria-label="Increase ${esc(product?.name || "bottle")}">+</button>
            </div>
          </div>`;
        }).join("")}`
        : `<p class="gift-builder__hint">Choose bottles for ${esc(person.firstName || person.name)}. Or switch to All recipients.</p>`;
    }
  }

  const review = $("[data-gift-review]");
  if (review) {
    review.innerHTML = `${giftReviewHtml(draft)}
      <div class="gift-flow__nav">
        <button type="button" class="text-link" data-gift-goto="1">Edit recipients</button>
        <button type="button" class="text-link" data-gift-goto="2">Edit bottles</button>
      </div>`;
  }

  const summary = $("[data-gift-checkout-summary]");
  if (summary) summary.innerHTML = giftReviewHtml(draft);

  const hint = $("[data-gift-continue-hint]");
  if (hint) hint.textContent = giftDraftError(draft) || `${draft.recipients.length} recipient${draft.recipients.length === 1 ? "" : "s"} · ready for checkout.`;

  const checkout = $("[data-gift-checkout]");
  if (checkout) {
    const ready = !giftDraftError(draft);
    checkout.classList.toggle("is-disabled", !ready);
    checkout.setAttribute("aria-disabled", ready ? "false" : "true");
  }
}

function showGiftStep(step, animate = true) {
  const deck = $("[data-gift-deck]");
  if (!deck) return;
  const draft = readGiftDraft();
  let next = Math.min(3, Math.max(1, Number(step) || 1));
  if (next >= 2) {
    const error = giftDraftError(draft, next === 3);
    if (error) {
      notify(error, "error");
      next = giftDraftError(draft, false) ? 1 : 2;
    }
  }
  updateGiftDraft({ step: next });
  document.body.dataset.giftStep = String(next);

  const panels = $$("[data-gift-panel]");
  const active = panels.find((panel) => Number(panel.dataset.giftPanel) === next);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.gsap?.killTweensOf(panels);

  const reveal = () => {
    for (const panel of panels) {
      const on = panel === active;
      panel.hidden = !on;
      panel.classList.toggle("on", on);
      panel.style.opacity = "1";
      panel.style.transform = "";
    }
    $$("[data-gift-dot]").forEach((dot) => {
      dot.classList.toggle("on", Number(dot.dataset.giftDot) <= next);
    });
    const label = $("[data-gift-progress-label]");
    if (label) label.textContent = `Step ${String(next).padStart(2, "0")}`;
    renderGift();
    if (animate && active) active.querySelector("h2, input, select")?.focus?.({ preventScroll: true });
  };

  if (animate && window.gsap && !reduceMotion && active) {
    const current = panels.find((panel) => panel.classList.contains("on") && !panel.hidden);
    if (current && current !== active) {
      window.gsap.to(current, {
        opacity: 0,
        x: -24,
        duration: 0.24,
        ease: "power2.in",
        onComplete: () => {
          reveal();
          window.gsap.fromTo(active, { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" });
        },
      });
    } else {
      reveal();
      window.gsap.fromTo(active, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" });
    }
  } else {
    reveal();
  }

  if (animate) {
    deck.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

function editPerson(id) {
  const person = readGiftDraft().recipients.find((entry) => entry.id === id);
  if (!person) return;
  editingId = id;
  showGiftStep(1, true);
  const form = $("[data-gift-add]");
  if (!form) return;
  for (const key of ["firstName", "lastName", "email", "phone", "address", "state", "note"]) {
    if (form.elements[key]) form.elements[key].value = person[key] || "";
  }
  const submit = form.querySelector("[type=submit]");
  if (submit) submit.textContent = "Save recipient";
  form.elements.firstName?.focus();
}

export function initGifting(options = {}) {
  notify = options.toast || notify;
  picture = options.productPicture || picture;
  floatBottle = options.floatBottle || floatBottle;
  if (initialized) {
    renderGift();
    return;
  }
  initialized = true;

  const stateSelect = $("[data-gift-state]");
  if (stateSelect) {
    stateSelect.innerHTML = `<option value="">Choose state</option>${NIGERIAN_STATES.map((state) => `<option value="${esc(state)}">${esc(state)}</option>`).join("")}`;
  }

  // Hero imagery autoplay is owned by main.js (same path as the landing page).

  if ($("[data-gift-deck]")) {
    const params = new URLSearchParams(location.search);
    const requested = params.has("step") ? Number(params.get("step")) : readGiftDraft().step;
    const start = Number.isFinite(requested) && requested > 0 ? requested : 1;
    showGiftStep(start, false);
    if (location.hash === "#gift-builder" || (Number.isFinite(requested) && requested > 0)) {
      $("[data-gift-deck]")?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  } else {
    renderGift();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;
    const draft = readGiftDraft();

    if (target.matches("[data-gift-start]")) {
      showGiftStep(1);
      return;
    }
    if (target.matches("[data-gift-next]")) {
      showGiftStep(draft.step + 1);
      return;
    }
    if (target.matches("[data-gift-back]")) {
      showGiftStep(Math.max(1, draft.step - 1));
      return;
    }
    if (target.matches("[data-gift-goto]")) {
      showGiftStep(Number(target.dataset.giftGoto) || 1);
      return;
    }
    if (target.matches("[data-gift-checkout]")) {
      const error = giftDraftError(draft);
      if (error) {
        event.preventDefault();
        notify(error, "error");
      }
      return;
    }
    if (target.dataset.giftBottle) {
      addGiftProduct(target.dataset.giftBottle);
      return;
    }
    if (target.dataset.giftQty) {
      const productId = target.dataset.giftQty;
      const delta = Number(target.dataset.delta);
      const shoppingAll = draft.activeRecipientId === ALL_RECIPIENTS || !draft.activeRecipientId;
      try {
        if (shoppingAll) {
          const quantities = draft.recipients.map((person) => (
            draft.items.find((item) => item.recipientId === person.id && item.productId === productId)?.quantity || 0
          ));
          const base = quantities.length ? Math.min(...quantities) : 0;
          const next = Math.max(0, base + delta);
          setGiftQuantityForTarget(ALL_RECIPIENTS, productId, next);
        } else {
          const line = draft.items.find((item) => item.recipientId === draft.activeRecipientId && item.productId === productId);
          const next = Math.max(0, (line?.quantity || 0) + delta);
          setGiftQuantityForTarget(draft.activeRecipientId, productId, next);
        }
        renderGift();
      } catch (error) {
        notify(error.message, "error");
      }
      return;
    }
    if (target.dataset.recipientEdit) {
      editPerson(target.dataset.recipientEdit);
      return;
    }
    if (target.dataset.recipientRemove) {
      removeId = target.dataset.recipientRemove;
      $("[data-gift-remove-dialog]")?.showModal?.();
      return;
    }
    if (target.matches("[data-remove-cancel]")) {
      $("[data-gift-remove-dialog]")?.close?.();
      return;
    }
    if (target.matches("[data-remove-confirm]")) {
      removeGiftRecipient(removeId);
      removeId = "";
      $("[data-gift-remove-dialog]")?.close?.();
      renderGift();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-gift-person]")) {
      updateGiftDraft({ activeRecipientId: event.target.value });
      renderGift();
      return;
    }
    if (event.target.matches("[data-gift-notify]")) {
      updateGiftDraft({ notify: event.target.checked });
      renderGift();
      return;
    }
    if (event.target.matches("[data-gift-wrap]")) {
      updateGiftDraft({ wrap: event.target.checked });
      renderGift();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-gift-message]")) {
      updateGiftDraft({ message: event.target.value });
    }
  });

  document.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-gift-add]")) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const result = addGiftRecipient({ ...data, id: editingId || undefined });
    const status = $("[data-gift-add-status]");
    if (!result.ok) {
      if (status) status.textContent = result.error;
      notify(result.error, "error");
      return;
    }
    editingId = "";
    event.target.reset();
    const submit = event.target.querySelector("[type=submit]");
    if (submit) submit.textContent = "Add recipient";
    if (status) status.textContent = "Recipient saved.";
    renderGift();
  });
}
