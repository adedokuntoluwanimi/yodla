import nodemailer from "nodemailer";
import { publicSiteUrl } from "./seo-render.js";
import { logError, logInfo } from "./log.js";
import { loadAdmins } from "./admins.js";

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || publicSiteUrl() || "https://yodla.ng").replace(/\/$/, "");
}

function mailbox(kind) {
  const map = {
    orders: {
      user: process.env.SMTP_ORDERS_USER || "orders@yodla.ng",
      pass: process.env.SMTP_ORDERS_PASS || "",
    },
    hello: {
      user: process.env.SMTP_HELLO_USER || "hello@yodla.ng",
      pass: process.env.SMTP_HELLO_PASS || "",
    },
    noreply: {
      user: process.env.SMTP_NOREPLY_USER || "noreply@yodla.ng",
      pass: process.env.SMTP_NOREPLY_PASS || "",
    },
  };
  return map[kind] || map.noreply;
}

function createTransport(kind) {
  const creds = mailbox(kind);
  if (!creds.pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true") !== "false";
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.yodla.ng",
    port,
    secure,
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2", servername: process.env.SMTP_HOST || "mail.yodla.ng" },
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
  ));
}

function brandedHtml({ title, eyebrow, bodyHtml, ctaLabel = "", ctaHref = "" }) {
  const logo = `${siteUrl()}/assets/logo.png`;
  const cta = ctaLabel && ctaHref
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:14px 22px;background:#ef5d2c;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">${escapeHtml(ctaLabel)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f0e5;color:#14120f;font-family:Manrope,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#171016;border-radius:24px;padding:28px;color:#f5f0e5">
      <img src="${logo}" alt="Yodla" width="56" height="56" style="border-radius:50%;background:#fff;display:block">
      <p style="font:500 11px/1.2 'DM Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#ef5d2c;margin:22px 0 10px">${escapeHtml(eyebrow)}</p>
      <h1 style="font-family:'Bricolage Grotesque',Georgia,serif;font-size:34px;line-height:.95;letter-spacing:-.04em;margin:0 0 16px">${escapeHtml(title)}</h1>
      <div style="color:#d7cbbd;line-height:1.65;font-size:15px">${bodyHtml}</div>
      ${cta}
    </div>
    <p style="text-align:center;color:#706a60;font-size:12px;margin-top:18px">Drink responsibly · 18+ · <a href="${siteUrl()}" style="color:#4b111f">yodla.ng</a></p>
  </div>
</body></html>`;
}

function orderLinesHtml(order) {
  return (order.lines || [])
    .map((line) => `<li>${escapeHtml(line.name)} x ${escapeHtml(line.quantity)} — ₦${Number(line.price || 0).toLocaleString("en-NG")}</li>`)
    .join("");
}

function orderTotal(order) {
  return Number(order.totals?.total || 0).toLocaleString("en-NG");
}

async function sendMail({ kind, to, subject, html, text, replyTo }) {
  const transport = createTransport(kind);
  const from = mailbox(kind).user;
  if (!transport) {
    logError("mail_skipped", new Error(`SMTP password missing for ${kind}`), { to, subject, kind });
    return { skipped: true };
  }
  try {
    const info = await transport.sendMail({
      from: `"Yodla" <${from}>`,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || mailbox("hello").user,
    });
    logInfo("mail_sent", { kind, to, subject, messageId: info?.messageId || "" });
    return { ok: true, messageId: info?.messageId || "" };
  } catch (error) {
    logError("mail_send_failed", error, {
      to,
      subject,
      kind,
      code: error?.code || "",
      responseCode: error?.responseCode || "",
      command: error?.command || "",
    });
    throw Object.assign(new Error("That email could not be sent right now."), { status: 502, cause: error });
  }
}

export async function sendOrderReceipt(order) {
  const email = order?.customer?.email;
  if (!email) {
    logError("mail_skipped", new Error("Order has no customer email"), { orderId: order?.id || "" });
    return { skipped: true };
  }
  const lines = orderLinesHtml(order);
  const total = orderTotal(order);
  const html = brandedHtml({
    eyebrow: "Order confirmed",
    title: "The good part is on its way.",
    bodyHtml: `<p>Hi ${escapeHtml(order.customer?.name || "there")},</p>
      <p>Payment is confirmed. Tracking code <strong style="color:#fff">${escapeHtml(order.trackingCode || order.id)}</strong>.</p>
      <ul style="padding-left:18px;margin:16px 0">${lines}</ul>
      <p>Total: <strong style="color:#fff">₦${total}</strong></p>`,
    ctaLabel: "Back to Yodla",
    ctaHref: siteUrl(),
  });
  return sendMail({
    kind: "orders",
    to: email,
    subject: `Yodla order ${order.trackingCode || order.id}`,
    html,
    text: `Your Yodla order ${order.trackingCode || order.id} is confirmed. Total ₦${total}.`,
  });
}

export async function notifyAdminsOfOrder(order) {
  let admins = [];
  try {
    admins = await loadAdmins();
  } catch (error) {
    logError("admin_list_failed", error, { orderId: order?.id || "" });
    admins = [process.env.YODLA_LOCAL_ADMIN_EMAIL || "adedokunt96@gmail.com"].filter(Boolean);
  }
  const unique = [...new Set(admins.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) {
    logError("mail_skipped", new Error("No admin emails to notify"), { orderId: order?.id || "" });
    return { skipped: true, sent: 0 };
  }
  const lines = orderLinesHtml(order);
  const total = orderTotal(order);
  const customer = order.customer || {};
  const subject = `New Yodla order ${order.trackingCode || order.id}`;
  const html = brandedHtml({
    eyebrow: "New paid order",
    title: "Someone just checked out.",
    bodyHtml: `<p>Tracking <strong style="color:#fff">${escapeHtml(order.trackingCode || order.id)}</strong> · ₦${total}</p>
      <p>${escapeHtml(customer.name || "Guest")} · ${escapeHtml(customer.email || "no email")} · ${escapeHtml(customer.phone || "no phone")}</p>
      <p>${escapeHtml(customer.address || "")}${customer.state ? `, ${escapeHtml(customer.state)}` : ""}</p>
      <ul style="padding-left:18px;margin:16px 0">${lines || "<li>No line items</li>"}</ul>`,
    ctaLabel: "Open admin",
    ctaHref: `${siteUrl()}/admin/`,
  });
  const text = `New Yodla order ${order.trackingCode || order.id}. Total ₦${total}. ${customer.name || ""} ${customer.email || ""}`;
  const results = await Promise.allSettled(unique.map((to) => sendMail({
    kind: "orders",
    to,
    subject,
    html,
    text,
    replyTo: customer.email || mailbox("hello").user,
  })));
  const sent = results.filter((result) => result.status === "fulfilled" && !result.value?.skipped).length;
  const failed = results.length - sent;
  logInfo("admin_order_notify", { orderId: order?.id || "", admins: unique.length, sent, failed });
  return { ok: failed === 0, sent, failed, admins: unique.length };
}

export async function sendGiftNotification({ order, recipient, message, buyerName }) {
  const email = String(recipient?.email || "").trim().toLowerCase();
  if (!email) return { skipped: true };
  const bottles = (order?.lines || [])
    .filter((line) => order?.gift?.version !== 2 || line.recipientId === recipient.id)
    .map((line) => {
      const qty = Number(line.quantity || 1);
      const name = escapeHtml(line.name || "Bottle");
      return qty > 1 ? `${name} × ${qty}` : name;
    })
    .filter(Boolean);
  const bottleList = bottles.length
    ? `<p style="margin:18px 0 8px;color:#e9decc"><strong style="color:#fff">What’s coming to you</strong></p>
      <ul style="padding-left:18px;margin:0 0 16px">${bottles.map((name) => `<li>${name}</li>`).join("")}</ul>`
    : "";
  const note = String(message || order?.gift?.message || "").trim();
  const fromName = String(buyerName || order?.customer?.name || "Someone").trim() || "Someone";
  const recipientName = String(recipient?.name || "").trim() || "there";
  const delivery = [recipient?.address, recipient?.state].filter(Boolean).map((part) => escapeHtml(part)).join(", ");
  const html = brandedHtml({
    eyebrow: "A gift was ordered for you",
    title: `${fromName} ordered you a gift.`,
    bodyHtml: `<p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong style="color:#fff">${escapeHtml(fromName)}</strong> just ordered a Yodla gift for you — not a link to buy, an actual order placed in your name.</p>
      ${note ? `<p style="margin:18px 0;padding:16px 18px;background:rgba(255,255,255,.06);border-radius:14px;color:#f5f0e5"><span style="display:block;font:500 11px/1.2 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#ef5d2c;margin-bottom:8px">Their note</span>“${escapeHtml(note)}”</p>` : ""}
      ${bottleList}
      ${delivery ? `<p style="margin:16px 0 0">Delivery is headed to <strong style="color:#fff">${delivery}</strong>.</p>` : "<p style=\"margin:16px 0 0\">We’ll deliver it using the details they shared for you.</p>"}
      <p style="margin:16px 0 0">Sit tight — the good part is on its way. Drink responsibly, and enjoy the pour.</p>`,
    ctaLabel: "Explore Yodla",
    ctaHref: siteUrl(),
  });
  const kind = mailbox("noreply").pass ? "noreply" : "orders";
  const textBottles = bottles.length ? ` Bottles: ${bottles.join(", ")}.` : "";
  const textNote = note ? ` Their note: “${note}”.` : "";
  return sendMail({
    kind,
    to: email,
    subject: `${fromName} ordered a gift for you on Yodla`,
    html,
    text: `Hi ${recipientName}, ${fromName} ordered a Yodla gift for you.${textNote}${textBottles}${delivery ? ` Delivery: ${recipient.address || ""}${recipient.state ? `, ${recipient.state}` : ""}.` : ""}`,
    replyTo: order?.customer?.email || mailbox("hello").user,
  });
}

export async function sendGiftEmails(order) {
  const recipients = Array.isArray(order?.gift?.recipients) ? order.gift.recipients : [];
  if (!recipients.length || order?.gift?.notify === false) return { skipped: true, sent: 0 };
  const seen = new Set();
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const email = String(recipient?.email || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    try {
      const result = await sendGiftNotification({
        order,
        recipient,
        message: order.gift?.message || "",
        buyerName: order.customer?.name || "",
      });
      if (result?.skipped) continue;
      sent += 1;
    } catch (error) {
      failed += 1;
      logError("gift_email_failed", error, { orderId: order?.id || "", to: email });
    }
  }
  logInfo("gift_emails", { orderId: order?.id || "", recipients: seen.size, sent, failed });
  return { ok: failed === 0, sent, failed };
}

export async function sendOrderEmails(order) {
  const receipt = await sendOrderReceipt(order).catch((error) => {
    logError("order_receipt_failed", error, { orderId: order?.id || "" });
    return { ok: false, error: true };
  });
  const gifts = await sendGiftEmails(order).catch((error) => {
    logError("gift_emails_failed", error, { orderId: order?.id || "" });
    return { ok: false, error: true };
  });
  const admins = await notifyAdminsOfOrder(order).catch((error) => {
    logError("order_admin_notify_failed", error, { orderId: order?.id || "" });
    return { ok: false, error: true };
  });
  return { receipt, gifts, admins };
}

export async function notifyHello({ subject, bodyHtml, bodyText, replyTo }) {
  return sendMail({
    kind: "hello",
    to: mailbox("hello").user,
    subject,
    html: brandedHtml({ eyebrow: "Yodla inbox", title: subject, bodyHtml }),
    text: bodyText || subject,
    replyTo,
  });
}

export async function sendContactAck({ to, name }) {
  if (!to) return { skipped: true };
  return sendMail({
    kind: "hello",
    to,
    subject: "We got your note — Yodla",
    html: brandedHtml({
      eyebrow: "Thanks for writing",
      title: "We’ll be in touch.",
      bodyHtml: `<p>Hi ${escapeHtml(name || "there")},</p><p>Your message reached the Yodla team. We read every note.</p>`,
      ctaLabel: "Browse the shelves",
      ctaHref: `${siteUrl()}/shop.html`,
    }),
    text: "We received your message to Yodla.",
  });
}

export { brandedHtml, escapeHtml, siteUrl };
