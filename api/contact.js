import { addSubscriber, saveContact } from "../lib/subscribers.js";
import { notifyHello, sendContactAck, escapeHtml } from "../lib/mail.js";
import { readJson, sendJson } from "../lib/http.js";
import { logError, requestId } from "../lib/log.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }
  const id = requestId(request);
  try {
    const body = await readJson(request, 8_000);
    const action = String(body.action || "contact");
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
