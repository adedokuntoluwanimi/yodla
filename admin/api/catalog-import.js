import { createHash } from "node:crypto";
import { body, json } from "../lib/http.js";
import { requireAdmin } from "../../lib/auth.js";
import { catalogWorkbookTemplate, parseCatalogWorkbook } from "../../lib/catalog-workbook.js";
import { reviewCatalogWorkbook } from "../../lib/content-store.js";

export default async function handler(request, response) {
  const admin = await requireAdmin(request, response);
  if (!admin) return;
  if (!admin.emailVerified || (admin.bypass && (process.env.K_SERVICE || process.env.YODLA_GCS_BUCKET))) {
    return json(response, 403, { error: "Sign in with an authorized administrator account." });
  }
  try {
    if (request.method === "GET") {
      const template = await catalogWorkbookTemplate();
      response.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="yodla-catalog-template.xlsx"',
        "Cache-Control": "private, no-store",
      });
      return response.end(Buffer.from(template));
    }
    if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." });
    const payload = await body(request, 2_700_000);
    if (typeof payload.workbook !== "string" || payload.workbook.length > 2_666_668 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.workbook)) {
      return json(response, 400, { error: "Choose a valid .xlsx workbook under 2 MB." });
    }
    const bytes = Buffer.from(payload.workbook, "base64");
    let parsed;
    try {
      parsed = await parseCatalogWorkbook(bytes);
    } catch (error) {
      return json(response, 422, { error: error.message });
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    const result = await reviewCatalogWorkbook(parsed, digest, {
      confirmation: typeof payload.confirmation === "string" ? payload.confirmation : "",
      editor: admin.email,
    });
    return json(response, 200, result);
  } catch (error) {
    if (error.status) return json(response, error.status, { error: error.message });
    if (error instanceof SyntaxError || error.message === "Request is too large") return json(response, 400, { error: "The workbook upload could not be read." });
    console.error("Catalogue import:", error.message);
    return json(response, 500, { error: "The catalogue could not be updated. Try again." });
  }
}
