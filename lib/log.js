import { randomUUID } from "node:crypto";

export function requestId(request) {
  return request?.headers?.["x-request-id"] || randomUUID().slice(0, 8);
}

export function logError(event, error, extra = {}) {
  console.error(JSON.stringify({
    severity: "ERROR",
    event,
    message: error?.message || String(error || "Unknown error"),
    stack: error?.stack || undefined,
    ...extra,
  }));
}

export function logInfo(event, extra = {}) {
  console.log(JSON.stringify({ severity: "INFO", event, ...extra }));
}

export function friendlyError(fallback = "Something went wrong. Please try again.") {
  return fallback;
}
