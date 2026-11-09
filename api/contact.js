import { addSubscriber, saveContact } from "../lib/subscribers.js";
import { notifyHello, sendContactAck, escapeHtml } from "../lib/mail.js";
import { readJson, sendJson } from "../lib/http.js";
import { logError, requestId } from "../lib/log.js";
import { getPublishedContent } from "../lib/content-service.js";
import { isHamperExtraDrink, lagosCalendarDate, resolveHamperDrinks, wordCount } from "../js/catalog-order.js";
import { NIGERIAN_STATES } from "../js/states.js";

async function submitHamperInquiry(body, response, requestId) {
  const content = await getPublishedContent();
  const tier = content.hampers?.find((item) => item.id === body.tierId);
  if (!tier) return sendJson(response, 404, { error: "This collection is no longer available. Go back to the collections to choose another." });
  const read = (key) => typeof body[key] === "string" ? body[key].trim() : "";
  const name = read("name"), email = read("email").toLowerCase(), phone = read("phone");
  const state = read("state"), date = read("deliveryDate"), quantity = body.quantity;
  const note = read("note"), mugText = read("mugText"), message = read("message");
  if (!name || name.length > 100 || email.length > 160 || !/^\S+@\S+\.\S+$/.test(email) || phone.length > 40) {
    return sendJson(response, 400, { error: "Enter your name and a valid email so we can reply." });
  }
  if (!NIGERIAN_STATES.includes(state) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    return sendJson(response, 400, { error: "Choose a delivery state and enter between 1 and 1,000 hampers." });
  }
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
    || new Date(date).toISOString().slice(0, 10) !== date || date < lagosCalendarDate())) {
    return sendJson(response, 400, { error: "Choose a valid preferred delivery date from today onward." });
  }
  const ids = body.addOnIds;
  const selected = Array.isArray(ids) ? tier.addOns.filter((item) => ids.includes(item.id)) : [];
  if (!Array.isArray(ids) || selected.length !== ids.length || selected.some(isHamperExtraDrink)) {
    return sendJson(response, 400, { error: "Review the extras for this package and choose any extra drink from the shop." });
  }
  const drinks = resolveHamperDrinks(body, content.products);
  if (!drinks) return sendJson(response, 400, { error: "Check your extra drink selections and quantities." });
  if (message.length > 1200 || [note, mugText].some((value) => value.length > 500 || wordCount(value) > 10)
    || (note && !selected.some((item) => /handwritten.*note/i.test(item.name)))
    || (mugText && !selected.some((item) => /mug/i.test(item.name)))) {
    return sendJson(response, 400, { error: "Check your message and use up to 10 words for each selected personalization." });
  }
  const subject = `Hamper quote · ${tier.name}`;
  const details = [
    `${quantity} × ${tier.name}`, `Delivery state: ${state}`, date && `Preferred date: ${date}`,
    selected.length && `Extras: ${selected.map((item) => item.name).join(", ")}`,
    drinks.length && `Extra drinks: ${drinks.map(({ name, quantity }) => `${quantity} × ${name}`).join(", ")}`,
    note && `Gift note: ${note}`, mugText && `Mug text: ${mugText}`, message,
  ].filter(Boolean);
  const contact = await saveContact({
    name, email, phone, subject, message: details.join("\n"), intent: "Gifts",
    hamper: { tierId: tier.id, quantity, state, deliveryDate: date, addOnIds: ids, extraDrinks: drinks.map(({ productId, quantity }) => ({ productId, quantity })), note, mugText },
  });
  await notifyHello({
    subject,
    bodyHtml: `<p>${escapeHtml(contact.id)} · ${escapeHtml(name)} · ${escapeHtml(email)}${phone ? ` · ${escapeHtml(phone)}` : ""}</p>${details.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}`,
    bodyText: `${contact.id} · ${name} · ${email}${phone ? ` · ${phone}` : ""}\n${details.join("\n")}`,
    replyTo: email,
  }).catch((error) => logError("hamper_inquiry_notify_failed", error, { requestId, contactId: contact.id }));
  return sendJson(response, 200, { ok: true, id: contact.id });
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }
  const id = requestId(request);
  try {
    const body = await readJson(request, 8_000);
    const action = String(body.action || "contact");
    if (action === "hamper_inquiry") return await submitHamperInquiry(body, response, id);
    if (action === "newsletter" || action === "subscribe") {
      const entry = await addSubscriber({ email: body.email, name: body.name || "", source: body.source || "newsletter" });
      await notifyHello({
        subject: "New journal subscriber",
        bodyHtml: `<p>${escapeHtml(entry.email)} joined from ${escapeHtml(entry.source)}.</p>`,
        bodyText: `${entry.email} joined from ${entry.source}.`,
        replyTo: entry.email,
      }).catch((error) => logError("newsletter_notify_failed", error, { requestId: id }));
      return sendJson(response, 200, { ok: true, message: "You’re on the list. Welcome." });
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const subject = String(body.subject || "Website message").trim();
    const message = String(body.message || "").trim();
    if (!name || !email || !message) {
      return sendJson(response, 400, { error: "Name, email, and message are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return sendJson(response, 400, { error: "Enter a valid email." });
    }
    const contact = await saveContact({ name, email, phone, subject, message, subscribe: Boolean(body.subscribe) });
    if (body.subscribe) {
      await addSubscriber({ email, name, source: "contact" });
    }
    await notifyHello({
      subject: `Contact: ${subject}`,
      bodyHtml: `<p><strong>${escapeHtml(name)}</strong> · ${escapeHtml(email)}${phone ? ` · ${escapeHtml(phone)}` : ""}</p><p>Intent: ${escapeHtml(String(body.intent || "Other"))}</p><p>${escapeHtml(message)}</p>`,
      bodyText: `${name} <${email}> [${body.intent || "Other"}]: ${message}`,
      replyTo: email,
    });
    await sendContactAck({ to: email, name }).catch((error) => logError("contact_ack_failed", error, { requestId: id }));
    return sendJson(response, 200, { ok: true, id: contact.id, message: "Message sent. We’ll be in touch." });
  } catch (error) {
    logError("contact_failed", error, { requestId: id });
    return sendJson(response, error.status || 500, { error: error.status === 400 ? error.message : "That message could not be sent. Try again." });
  }
}
