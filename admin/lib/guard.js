import { requireAdmin } from "../../lib/auth.js";

export async function withAdmin(request, response, handler) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  request.yodlaAdmin = admin;
  return handler(request, response);
}
