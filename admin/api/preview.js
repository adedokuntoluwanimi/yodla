import { body, json } from "../lib/http.js";
import { prepare, validate } from "../lib/model.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return json(response, 405, { error: "Method not allowed." });
  try {
    const document = prepare((await body(request)).document);
    return json(response, 200, { document, warnings: validate(document, true) });
  } catch {
    return json(response, 400, { error: "That draft could not be previewed." });
  }
}
