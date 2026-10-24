import {
  accountFromUser,
  authorizedFetch,
  isLocalAuthBypass,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  waitForAuth,
} from "./firebase-auth.js";

const byId = (id) => document.getElementById(id);
const notice = byId("notice");
const loading = byId("authLoading");
const form = byId("authForm");

function showNotice(message, kind = "error") {
  notice.className = `notice ${kind}`;
  notice.textContent = message;
}

function clearNotice() {
  notice.className = "notice";
  notice.textContent = "";
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? "Please wait…" : label;
}

function showAuthForms(tab = "signin") {
  const signup = tab === "signup";
  byId("signinTab").classList.toggle("active", !signup);
  byId("signupTab").classList.toggle("active", signup);
  byId("signinForm").classList.toggle("hide", signup);
  byId("signupForm").classList.toggle("hide", !signup);
  byId("formTitle").textContent = signup ? "Make this shelf yours." : "Welcome back";
  byId("formCaption").textContent = signup ? "Create an account, or keep shopping as a guest." : "Sign in to your Yodla account.";
  clearNotice();
}

function safePath(value, fallback = "/index.html") {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

function resolveRedirect() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("next");
  const fromStore = localStorage.getItem("yodlaPostLoginRedirect");
  localStorage.removeItem("yodlaPostLoginRedirect");
  // Query wins so storefront never inherits a leftover /admin/ redirect.
  if (fromQuery != null) return safePath(fromQuery, "/index.html");
  if (fromStore) return safePath(fromStore, "/index.html");
  return "/index.html";
}

async function redirectAfterAuth() {
  const next = resolveRedirect();
  if (next.startsWith("/admin")) {
    try {
      const response = await authorizedFetch("/api/admins");
      if (!response.ok) {
        window.location.assign("/index.html");
        return;
      }
    } catch {
      window.location.assign("/index.html");
      return;
    }
  }
  window.location.assign(next);
}

byId("signinTab").addEventListener("click", () => showAuthForms("signin"));
byId("signupTab").addEventListener("click", () => showAuthForms("signup"));

byId("signinForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  const button = byId("signinButton");
  setBusy(button, true, "Sign in");
  try {
    await signInWithEmail(byId("signinEmail").value.trim(), byId("signinPassword").value);
    await redirectAfterAuth();
  } catch (error) {
    showNotice(error.message || "Sign in failed.");
  } finally {
    setBusy(button, false, "Sign in");
  }
});

byId("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice();
  const button = byId("signupButton");
  setBusy(button, true, "Create account");
  try {
    await signUpWithEmail({
      name: byId("signupName").value.trim(),
      email: byId("signupEmail").value.trim(),
      password: byId("signupPassword").value,
    });
    await redirectAfterAuth();
  } catch (error) {
    showNotice(error.message || "Could not create that account.");
  } finally {
    setBusy(button, false, "Create account");
  }
});

async function google() {
  clearNotice();
  try {
    await signInWithGoogle();
    await redirectAfterAuth();
  } catch (error) {
    showNotice(error.message || "Google sign-in failed.");
  }
}

byId("googleSignin").addEventListener("click", google);
byId("googleSignup").addEventListener("click", google);

async function boot() {
  try {
    if (await isLocalAuthBypass()) {
      showNotice("Local auth bypass is on. Continue as the seeded admin or open the storefront.", "success");
    }
    const user = await waitForAuth();
    if (user && accountFromUser(user)) {
      await redirectAfterAuth();
      return;
    }
  } catch {
    showNotice("Sign-in is unavailable right now. You can still browse as a guest.");
  }
  loading.classList.add("hide");
  form.classList.remove("hide");
  showAuthForms(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin");
}

boot();
