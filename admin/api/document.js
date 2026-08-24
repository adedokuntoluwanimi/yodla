import { body, json } from "../lib/http.js";
import { prepare, validate } from "../lib/model.js";
import { persistStatus, saveDocument, slugTaken } from "../../lib/content-store.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." });
  try {
    const input = await body(request);
    const action = String(input.action || "save");
    if (!["save", "publish", "unpublish", "archive"].includes(action)) return json(response, 400, { error: "Unknown publishing action." });
    const document = prepare(input.document);
    const errors = validate(document, action === "publish");
    if (Object.keys(errors).length) return json(response, 422, { error: "Fix the highlighted fields before continuing.", errors });
    if (["product", "blogPost"].includes(document._type) && await slugTaken(document._type, document.slug.current, document._id)) {
      return json(response, 409, { error: "That URL slug is already in use.", errors: { slug: "Choose a unique slug." } });
    }
    const result = await saveDocument(document, action);
    const durable = result.persist?.durable ?? persistStatus().durable;
    const messages = {
      save: "Draft saved.",
      publish: durable ? "Published. The storefront will use this shelf." : "Published on this instance only. Add BLOB_READ_WRITE_TOKEN so it survives on Vercel.",
      unpublish: "Unpublished and kept as a draft.",
      archive: "Archived.",
    };
    return json(response, 200, { ok: true, action, id: document._id, persist: result.persist, message: messages[action] });
  } catch (error) {
    console.error("Admin document mutation:", error.message);
    return json(response, 500, { error: "Yodla could not save that change. Your form is still here; try again." });
  }
}
