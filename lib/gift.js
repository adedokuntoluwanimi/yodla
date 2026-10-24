const MAX_RECIPIENTS = 5;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidGiftEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

export function normalizeGiftRecipient(entry = {}) {
  const name = String(entry.name || "").trim().slice(0, 80);
  const email = normalizeEmail(entry.email).slice(0, 160);
  if (!email || !EMAIL_RE.test(email)) return null;
  return { ...Object.fromEntries(["id", "firstName", "lastName", "phone", "address", "state", "note", "message"].map(key => [key, String(entry[key] || "").trim().slice(0, (key === "note" || key === "message") ? 500 : 300)])), name: name || [entry.firstName, entry.lastName].filter(Boolean).join(" ") || email.split("@")[0], email };
}

export function normalizeGiftPayload(raw = {}) {
  const source = Array.isArray(raw?.recipients) ? raw.recipients : (Array.isArray(raw) ? raw : []);
  const seen = new Set();
  const recipients = [];
  for (const entry of source) {
    const normalized = normalizeGiftRecipient(entry);
    if (!normalized || seen.has(normalized.email)) continue;
    seen.add(normalized.email);
    recipients.push(normalized);
    if (recipients.length >= MAX_RECIPIENTS) break;
  }
  return {
    version: raw?.version,
    items: Array.isArray(raw?.items) ? raw.items : [],
    activeRecipientId: String(raw?.activeRecipientId || ""),
    recipients,
    message: String(raw?.message || "").trim().slice(0, 500),
    notify: raw?.notify !== false,
    wrap: Boolean(raw?.wrap ?? raw?.giftWrap),
  };
}

export { MAX_RECIPIENTS };
