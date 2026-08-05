/**
 * Yodla — Coming Soon Page
 * Configuration and form handling
 */

// ---- Configuration ----
// Update these values before launch

const CONFIG = {
  // Replace with your Formspree form ID from https://formspree.io
  // Example: "https://formspree.io/f/xyzabcde"
  formspreeEndpoint: "https://formspree.io/f/YOUR_FORM_ID",

  social: [
    {
      name: "Instagram",
      url: "https://www.instagram.com/yodla.ng/",
      icon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
    },
  ],
};

// ---- Social links ----

function renderSocialLinks() {
  const container = document.getElementById("social-links");
  if (!container) return;

  CONFIG.social.forEach(({ name, url, icon }) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "social__link";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `Follow Yodla on ${name}`);
    a.innerHTML = icon;
    li.appendChild(a);
    container.appendChild(li);
  });
}

// ---- Email form ----

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setStatus(el, message, type) {
  el.textContent = message;
  el.className = "notify-form__status";
  if (type) el.classList.add(`notify-form__status--${type}`);
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const emailInput = form.querySelector("#email");
  const statusEl = document.getElementById("form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const email = emailInput.value.trim();

  if (!isValidEmail(email)) {
    setStatus(statusEl, "Please enter a valid email address.", "error");
    emailInput.focus();
    return;
  }

  if (CONFIG.formspreeEndpoint.includes("YOUR_FORM_ID")) {
    setStatus(statusEl, "Thanks! We'll notify you when we launch.", "success");
    form.reset();
    return;
  }

  submitBtn.disabled = true;
  setStatus(statusEl, "Sending...", null);

  try {
    const response = await fetch(CONFIG.formspreeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      setStatus(statusEl, "You're on the list! We'll be in touch.", "success");
      form.reset();
    } else {
      const data = await response.json().catch(() => ({}));
      const msg = data.error || "Something went wrong. Please try again.";
      setStatus(statusEl, msg, "error");
    }
  } catch {
    setStatus(statusEl, "Network error. Please check your connection.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// ---- Panel toggle ----

function openPanel() {
  const panel = document.getElementById("notify-panel");
  const backdrop = document.getElementById("panel-backdrop");
  const trigger = document.getElementById("signpost-trigger");

  if (!panel || !backdrop) return;

  backdrop.hidden = false;
  panel.hidden = false;

  requestAnimationFrame(() => {
    backdrop.classList.add("is-visible");
    panel.classList.add("is-visible");
  });

  trigger?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";

  const emailInput = document.getElementById("email");
  setTimeout(() => emailInput?.focus(), 350);
}

function closePanel() {
  const panel = document.getElementById("notify-panel");
  const backdrop = document.getElementById("panel-backdrop");
  const trigger = document.getElementById("signpost-trigger");

  if (!panel || !backdrop) return;

  backdrop.classList.remove("is-visible");
  panel.classList.remove("is-visible");

  trigger?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";

  setTimeout(() => {
    backdrop.hidden = true;
    panel.hidden = true;
    trigger?.focus();
  }, 300);
}

function initPanel() {
  const trigger = document.getElementById("signpost-trigger");
  const closeBtn = document.getElementById("panel-close");
  const backdrop = document.getElementById("panel-backdrop");

  trigger?.addEventListener("click", openPanel);
  closeBtn?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    const panel = document.getElementById("notify-panel");
    if (e.key === "Escape" && panel && !panel.hidden) {
      closePanel();
    }
  });
}

// ---- Scene fit (centered, full scene visible) ----

function initSceneFit() {
  const svg = document.querySelector(".scene__svg");
  if (!svg) return;

  const update = () => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    document.body.classList.toggle("is-mobile", isMobile);
  };

  update();
  window.addEventListener("resize", update);
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
  renderSocialLinks();
  initPanel();
  initSceneFit();

  const form = document.getElementById("notify-form");
  if (form) {
    form.addEventListener("submit", handleSubmit);
  }
});
