import { listOrders, getOrder, findOrderByTracking } from "../../lib/orders.js";
import { requireAdmin } from "../../lib/auth.js";
import { readJson, sendJson, requestUrl } from "../../lib/http.js";
import { logError, requestId } from "../../lib/log.js";

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  const id = requestId(request);
  try {
    const url = requestUrl(request);
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
    return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
  } catch (error) {
    logError("admin_orders_failed", error, { requestId: id });
    return sendJson(response, error.status || 500, { error: "Orders could not be loaded right now." });
  }
}
