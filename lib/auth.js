import { createRequire } from "node:module";
import { isAdminEmail, normalizeEmail } from "./admins.js";

const require = createRequire(import.meta.url);
let adminApp;
let auth;

function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);
}

export function localAuthBypassEnabled() {
  return process.env.YODLA_LOCAL_AUTH_BYPASS === "true" || !firebaseWebConfig().apiKey;
}

export function firebaseWebConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "",
    appId: process.env.FIREBASE_APP_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  };
}

function getAuth() {
  if (auth) return auth;
  if (!firebaseConfigured()) return null;
  try {
    const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
    const { getAuth: getFirebaseAuth } = require("firebase-admin/auth");
    if (!getApps().length) {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      });
    }
    auth = getFirebaseAuth();
    return auth;
  } catch (error) {
    console.error("Firebase Admin unavailable:", error.message);
    return null;
  }
}

export async function verifyRequestUser(request) {
  if (localAuthBypassEnabled()) {
    const email = normalizeEmail(request.headers["x-yodla-user-email"] || process.env.YODLA_LOCAL_ADMIN_EMAIL || "adedokunt96@gmail.com");
    return { uid: "local-dev", email, name: "Local Dev", emailVerified: true, bypass: true };
  }
  const header = String(request.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const client = getAuth();
  if (!client) return null;
  try {
    const decoded = await client.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: normalizeEmail(decoded.email),
      name: decoded.name || "",
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(request, response) {
  const user = await verifyRequestUser(request);
  if (!user?.email) {
    response.writeHead(401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Sign in required." }));
    return null;
  }
  if (!(await isAdminEmail(user.email))) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Admin access required." }));
    return null;
  }
  return user;
}
