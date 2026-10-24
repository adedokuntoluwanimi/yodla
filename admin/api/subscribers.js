import { listSubscribers } from "../../lib/subscribers.js";
import { requireAdmin } from "../../lib/auth.js";
import { sendJson } from "../../lib/http.js";
import { logError, requestId } from "../../lib/log.js";

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  const id = requestId(request);
  try {
    if (request.method !== "GET") {
      return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
    }
    const subscribers = await listSubscribers();
    return sendJson(response, 200, { subscribers, count: subscribers.length });
  } catch (error) {
    logError("admin_subscribers_failed", error, { requestId: id });
    return sendJson(response, 500, { error: "Subscribers could not be loaded right now." });
  }
}
