import { resolve } from "node:path";

const data = resolve("tmp/yodla-catalogue-local");
for (const key of ["YODLA_GCS_BUCKET", "PAYSTACK_SECRET_KEY", "SMTP_ORDERS_PASS", "SMTP_HELLO_PASS", "SMTP_NOREPLY_PASS", "FIREBASE_API_KEY", "K_SERVICE"]) {
  delete process.env[key];
}
Object.assign(process.env, {
  PORT: "4173",
  YODLA_BIND_HOST: "127.0.0.1",
  PUBLIC_SITE_URL: "http://localhost:4173",
  YODLA_LOCAL_AUTH_BYPASS: "true",
  YODLA_REQUIRE_WORKBOOK: "true",
  YODLA_VERTEX_ENABLED: "false",
  YODLA_LOCAL_MAIL_DISABLED: "true",
  YODLA_ADMINS_PATH: resolve(data, "admins.json"),
  YODLA_SHELF_PATH: resolve(data, "shelf.json"),
  YODLA_ORDERS_PATH: resolve(data, "orders.json"),
  YODLA_CARTS_PATH: resolve(data, "carts.json"),
  YODLA_SHOPPER_MEMORY_PATH: resolve(data, "shopper-memory.json"),
  YODLA_SUBSCRIBERS_PATH: resolve(data, "subscribers.json"),
  YODLA_CONTACTS_PATH: resolve(data, "contacts.json"),
});

await import("./dev-server.mjs");
