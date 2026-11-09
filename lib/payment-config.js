export const paymentsUnavailable = "Online payment is temporarily unavailable. Contact Yodla to arrange your order.";

export function paymentsAvailable() {
  const hosted = process.env.K_SERVICE || process.env.VERCEL_ENV === "production";
  return !hosted || /^sk_live_\S+$/.test(process.env.PAYSTACK_SECRET_KEY || "");
}
