const OPEN = "is-open";

function optionLabel(option) {
  return option?.label || option?.textContent?.trim() || "";
}

export function enhanceSelect(select) {
  if (!(select instanceof HTMLSelectElement) || select.dataset.customSelect === "ready") return;
  select.dataset.customSelect = "ready";
  select.classList.add("yodla-select-native");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.className = "yodla-select";
  wrap.dataset.yodlaSelect = "";
  select.parentNode.insertBefore(wrap, select);
  wrap.append(select);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "yodla-select__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  if (select.id) button.id = `${select.id}-trigger`;
  if (select.disabled) button.disabled = true;

  const list = document.createElement("ul");
  list.className = "yodla-select__list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  const sync = () => {
    const selected = select.selectedOptions[0] || select.options[0];
    button.textContent = optionLabel(selected) || "Choose";
    [...list.children].forEach((item) => {
      const active = item.dataset.value === select.value;
      item.setAttribute("aria-selected", active ? "true" : "false");
      item.classList.toggle("is-selected", active);
    });
  };

  const rebuildOptions = () => {
    list.innerHTML = "";
    [...select.options].forEach((option) => {
      const item = document.createElement("li");
      item.className = "yodla-select__option";
      item.setAttribute("role", "option");
      item.tabIndex = -1;
      item.dataset.value = option.value;
      item.textContent = optionLabel(option);
      if (option.disabled) item.setAttribute("aria-disabled", "true");
      item.addEventListener("click", () => {
        if (option.disabled) return;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
        close();
        button.focus();
      });
      list.append(item);
    });
    sync();
  };

  const close = () => {
    wrap.classList.remove(OPEN);
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    document.querySelectorAll(".yodla-select.is-open").forEach((node) => {
      if (node !== wrap) node.classList.remove(OPEN);
      const otherList = node.querySelector(".yodla-select__list");
      const otherButton = node.querySelector(".yodla-select__button");
      if (otherList) otherList.hidden = true;
      otherButton?.setAttribute("aria-expanded", "false");
    });
    wrap.classList.add(OPEN);
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    list.querySelector('[aria-selected="true"]')?.focus?.();
  };

  button.addEventListener("click", () => {
    if (wrap.classList.contains(OPEN)) close();
    else open();
  });

  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });

  list.addEventListener("keydown", (event) => {
    const items = [...list.querySelectorAll('.yodla-select__option:not([aria-disabled="true"])')];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      button.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      items[Math.min(items.length - 1, index + 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[Math.max(0, index - 1)]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.activeElement?.click();
    }
  });

  wrap.append(button, list);
  rebuildOptions();
  select.addEventListener("change", sync);
  select._yodlaRebuildOptions = rebuildOptions;
}

/** Rebuild custom-select options after the native <select> options change. */
export function refreshSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.dataset.customSelect !== "ready") {
    enhanceSelect(select);
    return;
  }
  select._yodlaRebuildOptions?.();
}

export function enhanceCustomSelects(root = document) {
  root.querySelectorAll("select:not([data-native-select])").forEach(enhanceSelect);
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-yodla-select]")) return;
  document.querySelectorAll(".yodla-select.is-open").forEach((node) => {
    node.classList.remove(OPEN);
    const list = node.querySelector(".yodla-select__list");
    const button = node.querySelector(".yodla-select__button");
    if (list) list.hidden = true;
    button?.setAttribute("aria-expanded", "false");
  });
});
