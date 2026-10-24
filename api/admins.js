import { addAdminEmail, loadAdmins, removeAdminEmail } from "../lib/admins.js";
import { requireAdmin } from "../lib/auth.js";
import { readJson, sendJson } from "../lib/http.js";

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  try {
    if (request.method === "GET") {
      return sendJson(response, 200, { emails: await loadAdmins() });
    }
    if (request.method === "POST") {
      const body = await readJson(request, 4_000);
      const emails = await addAdminEmail(body.email);
      return sendJson(response, 200, { emails });
    }
    if (request.method === "DELETE") {
      const body = await readJson(request, 4_000);
      const emails = await removeAdminEmail(body.email);
      return sendJson(response, 200, { emails });
    }
    return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, POST, DELETE" });
  } catch (error) {
    return sendJson(response, error.status || 400, { error: error.message || "Admin update failed." });
  }
}
