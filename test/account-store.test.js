import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { ACCOUNTS_STORAGE_KEY, createAccount, getCurrentAccount, signIn, signOut } from "../js/account-store.js";

function storageMock() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

test("prototype accounts are hashed, signed in and removable from the session", async () => {
  const storage = storageMock();
  const account = await createAccount({ name: "Ada Okafor", email: "ADA@example.com", phone: "0800", password: "goodnight42" }, storage, webcrypto);
  assert.equal(account.email, "ada@example.com");
  assert.ok(!storage.getItem(ACCOUNTS_STORAGE_KEY).includes("goodnight42"));
  assert.equal(getCurrentAccount(storage).name, "Ada Okafor");
  signOut(storage);
  assert.equal(getCurrentAccount(storage), null);
  assert.equal((await signIn({ email: "ada@example.com", password: "goodnight42" }, storage, webcrypto)).phone, "0800");
});

test("duplicate accounts and short passwords are rejected", async () => {
  const storage = storageMock();
  await assert.rejects(createAccount({ name: "Ada", email: "ada@example.com", password: "short" }, storage, webcrypto), /at least 8/);
  await createAccount({ name: "Ada", email: "ada@example.com", password: "long-enough" }, storage, webcrypto);
  await assert.rejects(createAccount({ name: "Ada", email: "ADA@example.com", password: "long-enough" }, storage, webcrypto), /already exists/);
});
