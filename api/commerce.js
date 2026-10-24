import { getPublishedContent } from "../lib/content-service.js";
import { verifyRequestUser } from "../lib/auth.js";
import { readJson, sendJson } from "../lib/http.js";
import { sendOrderEmails } from "../lib/mail.js";
import { rememberShopperOrder } from "../lib/shopper-memory.js";
import { logError, requestId } from "../lib/log.js";
import {
  addToCart,
  calculateTotals,
  createCart,
  createOrder,
  findOrderByTracking,
  getCart,
  getOrder,
  saveCart,
  saveOrder,
} from "../lib/orders.js";
import { prepareGiftOrder } from "../lib/gift-order.js";
import { normalizeGiftPayload } from "../lib/gift.js";

function productMap(products) {
  return new Map(products.map((product) => [product.id, product]));
}

function cartLines(cart, products) {
  const map = productMap(products);
  return (cart?.items || []).map((item) => {
    const product = map.get(item.productId);
    if (!product) return null;
    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      amount: product.amount || product.volume || "",
      availability: product.availability || {},
    };
  }).filter(Boolean);
}

async function initializePaystack({ email, amount, reference, callbackUrl, metadata }) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return {
      provider: "mock",
      reference,
      authorization_url: `${callbackUrl || "/checkout.html"}?payment=mock&reference=${encodeURIComponent(reference)}`,
      access_code: "mock",
    };
  }
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.data?.authorization_url) {
    throw Object.assign(new Error(payload?.message || "Payment could not be started."), { status: 502 });
  }
  return { provider: "paystack", ...payload.data };
}

async function verifyPaystack(reference) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return { status: "success", reference, provider: "mock" };
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await response.json();
  if (!response.ok || payload?.data?.status !== "success") {
    throw Object.assign(new Error(payload?.message || "Payment was not successful."), { status: 402 });
  }
  return payload.data;
}

export async function handleCommerce(request, response, action) {
  const id = requestId(request);
  try {
    const user = await verifyRequestUser(request);
    const content = await getPublishedContent();
    const products = content.products || [];

    if (action === "search_products" && request.method === "POST") {
      const body = await readJson(request, 8_000);
      const query = String(body.query || "").toLowerCase();
      const budget = Number(body.budget || 0);
      const occasion = String(body.occasion || "").toLowerCase();
      const state = String(body.state || body.location || "");
      const matches = products.filter((product) => {
        const hay = `${product.name} ${product.brand} ${product.category} ${product.notes?.join(" ") || ""} ${(product.occasions || []).join(" ")}`.toLowerCase();
        if (query && !hay.includes(query) && !query.split(/\s+/).every((part) => hay.includes(part))) return false;
        if (budget && product.price > budget) return false;
        if (occasion && !(product.occasions || []).some((item) => String(item).toLowerCase().includes(occasion))) return false;
        if (state) {
          const availability = product.availability || {};
          const status = availability[state] || availability[Object.keys(availability)[0]];
          if (status === "unavailable") return false;
        }
        return true;
      }).slice(0, 8).map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        amount: product.amount || product.volume,
        occasions: product.occasions,
        why: `Fits ${occasion || "your request"} at ₦${product.price.toLocaleString("en-NG")}.`,
      }));
      return sendJson(response, 200, { products: matches });
    }

    if (action === "get_product_details" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      const product = products.find((item) => item.id === body.productId);
      if (!product) return sendJson(response, 404, { error: "Product not found." });
      return sendJson(response, 200, { product });
    }

    if (action === "check_inventory" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      const product = products.find((item) => item.id === body.productId);
      if (!product) return sendJson(response, 404, { error: "Product not found." });
      const state = String(body.state || body.location || "");
      const availability = product.availability || {};
      const status = availability[state] || (Object.values(availability)[0] || "unavailable");
      return sendJson(response, 200, { productId: product.id, state, status });
    }

    if (action === "check_delivery" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      const state = String(body.state || body.location || "");
      if (!state) return sendJson(response, 400, { error: "Choose a delivery state." });
      return sendJson(response, 200, {
        state,
        deliverable: true,
        fee: calculateTotals([], { state }).deliveryFee,
        eta: "1–3 days depending on city traffic and stock.",
      });
    }

    if (action === "create_cart" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      const cart = await createCart({ location: body.state || body.location || "", customerId: user?.uid || body.customerId || "" });
      return sendJson(response, 200, { cart });
    }

    if (action === "add_to_cart" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      if (!body.productId) return sendJson(response, 400, { error: "productId is required." });
      const cart = await addToCart(body.cartId, body.productId, Number(body.quantity || 1));
      return sendJson(response, 200, { cart, lines: cartLines(cart, products) });
    }

    if (action === "calculate_order" && request.method === "POST") {
      const body = await readJson(request, 8_000);
      const isGift = body.source === "gifting" || body.gift?.version === 2;
      const preparedGift = isGift ? prepareGiftOrder(body.gift, products) : null;
      if (isGift && (!String(body.name || "").trim() || !/^\S+@\S+\.\S+$/.test(body.email || "") || String(body.phone || "").replace(/\D/g, "").length < 7)) return sendJson(response, 400, { error: "Add your name, valid email, and phone number." });
      const cart = !isGift && body.cartId ? await getCart(body.cartId) : null;
      const lines = preparedGift ? preparedGift.lines : cart ? cartLines(cart, products) : (body.items || []).map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        return product ? { productId: product.id, name: product.name, price: product.price, quantity: item.quantity || 1 } : null;
      }).filter(Boolean);
      const totals = preparedGift?.totals || calculateTotals(lines, {
        state: body.state || body.location || cart?.location || "",
        giftWrap: Boolean(body.giftWrap),
        discountNgn: body.discountNgn,
      });
      return sendJson(response, 200, { lines, totals });
    }

    if (action === "create_customer" && request.method === "POST") {
      const body = await readJson(request, 8_000);
      const customer = {
        id: user?.uid || `guest_${Date.now()}`,
        name: body.name || user?.name || "Guest",
        email: body.email || user?.email || "",
        phone: body.phone || "",
        state: body.state || body.location || "",
        address: body.address || "",
        guest: !user,
      };
      return sendJson(response, 200, { customer });
    }

    if (action === "create_payment" && request.method === "POST") {
      const body = await readJson(request, 100_000);
      const isGift = body.source === "gifting" || body.gift?.version === 2;
      const preparedGift = isGift ? prepareGiftOrder(body.gift, products) : null;
      if (isGift && (!String(body.name || "").trim() || !/^\S+@\S+\.\S+$/.test(body.email || "") || String(body.phone || "").replace(/\D/g, "").length < 7)) {
        return sendJson(response, 400, { error: "Add your name, valid email, and phone number." });
      }
      const cart = !isGift && body.cartId ? await getCart(body.cartId) : null;
      const lines = preparedGift
        ? preparedGift.lines
        : cart
          ? cartLines(cart, products)
          : (body.items || []).map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            return product ? { productId: product.id, name: product.name, price: product.price, quantity: item.quantity || 1 } : null;
          }).filter(Boolean);
      if (!lines.length) return sendJson(response, 400, { error: isGift ? "Choose bottles for your recipients." : "Cart is empty." });
      const gift = preparedGift?.gift || normalizeGiftPayload(body.gift || {});
      const giftWrap = Boolean(body.giftWrap || gift.wrap);
      const totals = preparedGift?.totals || calculateTotals(lines, {
        state: body.state || body.location || "",
        giftWrap,
        discountNgn: body.discountNgn,
      });
      const order = await createOrder({
        customer: {
          uid: user?.uid || "",
          name: body.name || user?.name || "Guest",
          email: body.email || user?.email || "",
          phone: body.phone || "",
          address: body.address || "",
          state: body.state || body.location || "",
          note: body.note || gift.message || "",
        },
        lines,
        totals,
        giftWrap,
        gift: gift.recipients.length ? gift : null,
        cartId: cart?.id || "",
        source: body.source || (isGift ? "gifting" : "checkout"),
      });
      const payment = await initializePaystack({
        email: order.customer.email || "guest@yodla.ng",
        amount: totals.total,
        reference: order.id,
        callbackUrl: body.callbackUrl || `${process.env.PUBLIC_SITE_URL || ""}/checkout.html`,
        metadata: { orderId: order.id, trackingCode: order.trackingCode },
      });
      order.payment = { provider: payment.provider, reference: payment.reference || order.id };
      await saveOrder(order);
      return sendJson(response, 200, { order, payment });
    }

    if (action === "create_order" && request.method === "POST") {
      const body = await readJson(request, 8_000);
      const reference = body.reference || body.orderId;
      const order = await getOrder(reference);
      if (!order) return sendJson(response, 404, { error: "Order not found." });
      const alreadyPaid = order.status === "paid" && order.paidAt;
      if (!alreadyPaid) {
        const verification = await verifyPaystack(reference);
        if (verification.provider !== "mock" && (verification.currency !== "NGN" || verification.amount !== Math.round(order.totals.total * 100))) throw Object.assign(new Error("Payment amount could not be confirmed."), { status: 402 });
        order.status = "paid";
        order.paidAt = new Date().toISOString();
        order.payment = { ...(order.payment || {}), verificationStatus: verification.status, verifiedAt: order.paidAt };
        await saveOrder(order);
        if (order.cartId) {
          const cart = await getCart(order.cartId);
          if (cart) {
            cart.items = [];
            await saveCart(cart);
          }
        }
        // Don't block the shopper success page on SMTP / memory writes.
        void sendOrderEmails(order).catch((error) => {
          logError("order_emails_failed", error, { requestId: id, orderId: order.id });
        });
        void (async () => {
          try {
            const key = order.customer?.email || order.customer?.uid || "";
            if (!key) return;
            const enriched = {
              ...order,
              lines: (order.lines || []).map((line) => {
                const product = products.find((entry) => entry.id === line.productId);
                return {
                  ...line,
                  category: product?.category || "",
                  occasions: product?.occasions || [],
                };
              }),
            };
            const giftRecipients = order.gift?.recipients || [];
            await rememberShopperOrder(key, enriched, {
              gift: Boolean(giftRecipients.length) || /gift/i.test(String(order.customer?.note || "")),
              recipientName: giftRecipients[0]?.name || order.customer?.name || "",
            });
          } catch (error) {
            logError("shopper_memory_failed", error, { requestId: id, orderId: order.id });
          }
        })();
      }
      return sendJson(response, 200, { order });
    }

    if (action === "get_order_status" && request.method === "POST") {
      const body = await readJson(request, 4_000);
      const order = (await getOrder(body.orderId || body.reference))
        || (await findOrderByTracking(body.trackingCode || body.orderId || body.reference));
      if (!order) return sendJson(response, 404, { error: "That order could not be found." });
      return sendJson(response, 200, {
        orderId: order.id,
        status: order.status,
        trackingCode: order.trackingCode,
        totals: order.totals,
        customer: { name: order.customer?.name, state: order.customer?.state },
      });
    }

    return sendJson(response, 404, { error: "That request is not available." });
  } catch (error) {
    logError("commerce_failed", error, { requestId: id, action });
    const status = error.status || 400;
    const message = status >= 500
      ? "That request could not be completed. Try again."
      : (error.message && !/stack|at\s+\//i.test(error.message) ? error.message : "That request could not be completed. Try again.");
    return sendJson(response, status, { error: message });
  }
}

export default async function handler(request, response, actionFromPath) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const action = actionFromPath || url.pathname.split("/").filter(Boolean).at(-1);
  return handleCommerce(request, response, action);
}
