import { listOrders, getOrder, findOrderByTracking, saveOrder, withOrderLock } from "../../lib/orders.js";
import { requireAdmin } from "../../lib/auth.js";
import { readJson, sendJson, requestUrl } from "../../lib/http.js";
import { logError, requestId } from "../../lib/log.js";

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  const id = requestId(request);
  try {
    const url = requestUrl(request);
    if (request.method === "POST") {
      if (!admin.emailVerified || (admin.bypass && (process.env.K_SERVICE || process.env.YODLA_GCS_BUCKET))) return sendJson(response, 403, { error: "Sign in as an administrator." });
      const body = await readJson(request, 4000);
      if (body.action !== "collect_balance" || typeof body.id !== "string") return sendJson(response, 400, { error: "Choose an order with a balance." });
      return await withOrderLock(body.id, async () => {
        const order = await getOrder(body.id);
        if (!order || order.source !== "wholesale") return sendJson(response, 404, { error: "Wholesale order not found." });
        if (order.balanceCollectedAt) return sendJson(response, 200, { order });
        if (order.status !== "deposit_paid" || !order.payment?.verifiedAt) return sendJson(response, 409, { error: "Confirm the deposit before collecting a balance." });
        order.paidAt = order.balanceCollectedAt = new Date().toISOString();
        order.balanceCollectedBy = admin.email;
        order.status = "paid";
        await saveOrder(order);
        return sendJson(response, 200, { order });
      });
    }
    if (request.method === "GET") {
      const orderId = url.searchParams.get("id") || "";
      const tracking = url.searchParams.get("tracking") || "";
      if (orderId || tracking) {
        const order = orderId ? await getOrder(orderId) : await findOrderByTracking(tracking);
        if (!order) return sendJson(response, 404, { error: "That order could not be found." });
        return sendJson(response, 200, { order });
      }
      const orders = await listOrders({
        status: url.searchParams.get("status") || "",
        state: url.searchParams.get("state") || "",
        q: url.searchParams.get("q") || "",
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || "",
      });
      return sendJson(response, 200, { orders, count: orders.length });
    }
    return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, POST" });
  } catch (error) {
    logError("admin_orders_failed", error, { requestId: id });
    return sendJson(response, error.status || 500, { error: "Orders could not be loaded right now." });
  }
}
