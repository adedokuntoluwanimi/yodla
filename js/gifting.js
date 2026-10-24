const GIFT_STORAGE_KEY = "yodla-gift-draft";
export const MAX_RECIPIENTS = 5;
export const ALL_RECIPIENTS = "__all__";
export const GIFT_SLIDES = ["ribbon", "note", "selection", "finished"].map((name, i) => ({
  label: ["Intro", "People", "Bottles", "Review"][i],
  image: `assets/gifting/gift-${name}-cutout.webp`,
  imageAlt: [
    "Ribbon-wrapped wine bottle",
    "Personal gift card and wine",
    "A curated bottle selection",
    "Finished wine gift arrangement",
  ][i],
  caption: [
    "A little thought, beautifully bottled",
    "For the people who matter",
    "Their taste. Your thoughtfulness.",
    "Every detail, considered",
  ][i],
  captionStrong: [
    "Make their moment",
    "Make it personal",
    "Find their pour",
    "Ready for their doorstep",
  ][i],
  stamp: "Selected\nwith\ncare",
}));

export function normalizeDraft(raw = {}) {
  const recipients = (Array.isArray(raw.recipients) ? raw.recipients : []).slice(0, 5).map((person, index) => ({
    ...person,
    message: String(person.message || "").slice(0, 500),
    id: person.id || `legacy-${index}-${person.email}`,
    firstName: person.firstName || String(person.name || "").split(" ")[0],
    lastName: person.lastName || String(person.name || "").split(" ").slice(1).join(" "),
    name: person.name || `${person.firstName || ""} ${person.lastName || ""}`.trim(),
    email: String(person.email || "").trim().toLowerCase(),
  }));
  const activeRecipientId = raw.activeRecipientId === ALL_RECIPIENTS
    || recipients.some((person) => person.id === raw.activeRecipientId)
    ? (raw.activeRecipientId || ALL_RECIPIENTS)
    : (recipients.length ? ALL_RECIPIENTS : "");
  return {
    version: 2,
    recipients,
    items: raw.version === 2 && Array.isArray(raw.items)
      ? raw.items.filter((item) => recipients.some((person) => person.id === item.recipientId)
        && Number.isInteger(item.quantity)
        && item.quantity > 0
        && item.quantity <= 99)
      : [],
    message: String(raw.message || "").slice(0, 500),
    wrap: Boolean(raw.wrap),
    notify: raw.notify !== false,
    activeRecipientId,
    step: Math.min(3, Math.max(1, Number(raw.step) || 1)),
  };
}

export function readGiftDraft() {
  try {
    return normalizeDraft(JSON.parse(localStorage.getItem(GIFT_STORAGE_KEY) || "null") || {});
  } catch {
    return normalizeDraft();
  }
}

export function writeGiftDraft(draft) {
  const next = normalizeDraft(draft);
  localStorage.setItem(GIFT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearGiftDraft() {
  localStorage.removeItem(GIFT_STORAGE_KEY);
}

export function updateGiftDraft(patch) {
  return writeGiftDraft({ ...readGiftDraft(), ...patch });
}

export function setGiftStep(step) {
  return updateGiftDraft({ step });
}

export function updateGiftMessage(message) {
  return updateGiftDraft({ message });
}

export function updateGiftWrap(wrap) {
  return updateGiftDraft({ wrap });
}

export function recipientError(person) {
  if (!person.firstName?.trim() || !person.lastName?.trim()) return "Add first and last name.";
  if (!/^\S+@\S+\.\S+$/.test(person.email || "")) return "Enter a valid email.";
  if ((person.phone || "").replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  if (!person.address?.trim() || !person.state) return "Add the delivery address and state.";
  return "";
}

export function giftDraftError(draft, items = true) {
  if (!draft.recipients.length) return "Add at least one recipient.";
  for (const person of draft.recipients) {
    const error = recipientError(person);
    if (error) return `${person.name}: ${error}`;
    if (items && !draft.items.some((item) => item.recipientId === person.id)) {
      return `Choose a bottle for ${person.name}.`;
    }
  }
  return "";
}

export function addGiftRecipient(data) {
  const draft = readGiftDraft();
  const person = {
    ...data,
    id: data.id || (crypto.randomUUID?.() || `gift-${Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("")}`),
    email: String(data.email || "").trim().toLowerCase(),
    name: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
  };
  const error = recipientError(person);
  if (error) return { ok: false, error };
  if (draft.recipients.some((entry) => entry.email === person.email && entry.id !== person.id)) {
    return { ok: false, error: "That email is already added." };
  }
  const existing = draft.recipients.some((entry) => entry.id === person.id);
  if (!existing && draft.recipients.length >= 5) return { ok: false, error: "You can gift up to 5 people." };
  draft.recipients = existing
    ? draft.recipients.map((entry) => (entry.id === person.id ? person : entry))
    : [...draft.recipients, person];
  if (draft.activeRecipientId !== ALL_RECIPIENTS) draft.activeRecipientId = person.id;
  return { ok: true, draft: writeGiftDraft(draft) };
}

export function removeGiftRecipient(id) {
  const draft = readGiftDraft();
  draft.recipients = draft.recipients.filter((person) => person.id !== id);
  draft.items = draft.items.filter((item) => item.recipientId !== id);
  if (draft.activeRecipientId === id) {
    draft.activeRecipientId = draft.recipients.length > 1 ? ALL_RECIPIENTS : (draft.recipients[0]?.id || "");
  }
  return writeGiftDraft(draft);
}

export function setGiftQuantity(recipientId, productId, quantity) {
  const draft = readGiftDraft();
  if (!draft.recipients.some((person) => person.id === recipientId)) throw new Error("Choose a recipient first.");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error("Choose a quantity from 0 to 99.");
  draft.items = draft.items.filter((item) => item.recipientId !== recipientId || item.productId !== productId);
  if (quantity) draft.items.push({ recipientId, productId, quantity });
  return writeGiftDraft(draft);
}

/** Add or change quantity for one person, or every recipient when target is ALL_RECIPIENTS. */
export function setGiftQuantityForTarget(targetId, productId, quantity) {
  const draft = readGiftDraft();
  if (!draft.recipients.length) throw new Error("Add a recipient first.");
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error("Choose a quantity from 0 to 99.");
  const targets = targetId === ALL_RECIPIENTS
    ? draft.recipients
    : draft.recipients.filter((person) => person.id === targetId);
  if (!targets.length) throw new Error("Choose a recipient first.");
  let items = draft.items.filter((item) => !(
    item.productId === productId && targets.some((person) => person.id === item.recipientId)
  ));
  if (quantity) {
    for (const person of targets) items.push({ recipientId: person.id, productId, quantity });
  }
  draft.items = items;
  return writeGiftDraft(draft);
}
