export const ACCOUNTS_STORAGE_KEY = "yodla-accounts-v1";
export const SESSION_STORAGE_KEY = "yodla-session-v1";

export class AccountError extends Error {
  constructor(message, field = "") {
    super(message);
    this.name = "AccountError";
    this.field = field;
  }
}

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

async function digest(value, cryptoApi = globalThis.crypto) {
  const bytes = new TextEncoder().encode(value);
  const hash = await cryptoApi.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getCurrentAccount(storage = localStorage) {
  const sessionEmail = normaliseEmail(storage.getItem(SESSION_STORAGE_KEY));
  if (!sessionEmail) return null;
  const account = readJson(storage, ACCOUNTS_STORAGE_KEY, []).find(({ email }) => email === sessionEmail);
  return account ? { name: account.name, email: account.email, phone: account.phone || "" } : null;
}

export async function createAccount(values, storage = localStorage, cryptoApi = globalThis.crypto) {
  const name = String(values.name || "").trim();
  const email = normaliseEmail(values.email);
  const phone = String(values.phone || "").trim();
  const password = String(values.password || "");
  if (name.length < 2) throw new AccountError("Tell us the name you would like us to use.", "name");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new AccountError("Enter a complete email address.", "email");
  if (password.length < 8) throw new AccountError("Use at least 8 characters for this prototype password.", "password");
  const accounts = readJson(storage, ACCOUNTS_STORAGE_KEY, []);
  if (accounts.some((account) => account.email === email)) throw new AccountError("An account with this email already exists on this device.", "email");
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const saltText = [...salt].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  accounts.push({ name, email, phone, salt: saltText, passwordHash: await digest(`${saltText}:${password}`, cryptoApi) });
  storage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts.slice(-8)));
  storage.setItem(SESSION_STORAGE_KEY, email);
  return { name, email, phone };
}

export async function signIn(values, storage = localStorage, cryptoApi = globalThis.crypto) {
  const email = normaliseEmail(values.email);
  const account = readJson(storage, ACCOUNTS_STORAGE_KEY, []).find((item) => item.email === email);
  if (!account || await digest(`${account?.salt || ""}:${String(values.password || "")}`, cryptoApi) !== account.passwordHash) {
    throw new AccountError("That email and password do not match an account on this device.", "password");
  }
  storage.setItem(SESSION_STORAGE_KEY, email);
  return { name: account.name, email: account.email, phone: account.phone || "" };
}

export function signOut(storage = localStorage) {
  storage.removeItem(SESSION_STORAGE_KEY);
}
