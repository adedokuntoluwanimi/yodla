import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

let configPromise;
let app;
let auth;
let googleProvider;
let localBypass = null;

const LOCAL_DEV_USER = Object.freeze({
  uid: "local-dev",
  email: "adedokunt96@gmail.com",
  displayName: "Local Admin",
  emailVerified: true,
  getIdToken: async () => "local-dev",
});

async function runtimeConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/runtime-config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Configuration unavailable."))));
  }
  return configPromise;
}

export async function isLocalAuthBypass() {
  if (localBypass !== null) return localBypass;
  try {
    const config = await runtimeConfig();
    localBypass = !!config.local_auth_bypass;
  } catch {
    localBypass = true;
  }
  return localBypass;
}

async function clients() {
  if (auth) return { app, auth };
  const config = await runtimeConfig();
  const firebase = config?.firebase || {};
  if (!firebase.apiKey || !firebase.authDomain || !firebase.projectId || !firebase.appId) {
    throw new Error("Secure sign-in is temporarily unavailable.");
  }
  app = initializeApp(firebase);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
  return { app, auth };
}

export async function waitForAuth() {
  if (await isLocalAuthBypass()) return LOCAL_DEV_USER;
  const { auth: client } = await clients();
  await client.authStateReady();
  return client.currentUser;
}

export async function waitForRestoredAuth(timeoutMs = 12000) {
  if (await isLocalAuthBypass()) return LOCAL_DEV_USER;
  const { auth: client } = await clients();
  await client.authStateReady();
  if (client.currentUser) return client.currentUser;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { unsubscribe(); } catch { /* ignore */ }
      resolve(user || null);
    };
    const unsubscribe = onAuthStateChanged(client, (user) => { if (user) finish(user); });
    const timer = setTimeout(() => finish(client.currentUser), Math.max(0, timeoutMs));
  });
}

export async function getIdToken() {
  if (await isLocalAuthBypass()) return "local-dev";
  const user = (await clients()).auth.currentUser;
  return user ? user.getIdToken() : null;
}

export async function authorizedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = await getIdToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (await isLocalAuthBypass()) headers.set("x-yodla-user-email", LOCAL_DEV_USER.email);
  return fetch(url, { ...options, headers });
}

export async function signInWithEmail(email, password) {
  const { auth: client } = await clients();
  return (await signInWithEmailAndPassword(client, email, password)).user;
}

export async function signUpWithEmail({ name, email, password }) {
  const { auth: client } = await clients();
  const credential = await createUserWithEmailAndPassword(client, email, password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential.user;
}

export async function signInWithGoogle() {
  const { auth: client } = await clients();
  return (await signInWithPopup(client, googleProvider)).user;
}

export async function signOutUser() {
  if (await isLocalAuthBypass()) return;
  const { auth: client } = await clients();
  await signOut(client);
}

export function accountFromUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Guest",
    email: String(user.email || "").toLowerCase(),
    phone: "",
  };
}

export { onAuthStateChanged };
