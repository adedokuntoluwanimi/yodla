import { withAdmin } from "../lib/guard.js";
import { json } from "../lib/http.js";
import { listDocuments } from "../../lib/content-store.js";

export default async function handler(request, response) {
  return withAdmin(request, response, async () => {
    if (request.method !== "GET") return json(response, 405, { error: "Method not allowed." });
    try {
      return json(response, 200, await listDocuments());
    } catch (error) {
      console.error("Admin content load:", error.message);
      return json(response, 502, { error: "Yodla could not load the content shelf. Try again." });
    }
  });
}
