import { firebaseWebConfig, localAuthBypassEnabled } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET" });
  const firebase = firebaseWebConfig();
  return sendJson(response, 200, {
    firebase,
    local_auth_bypass: localAuthBypassEnabled(),
    paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY || "",
  });
}
