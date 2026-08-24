import { getProduct } from "./catalog.js";

export const CART_STORAGE_KEY = "yodla-cart-v2";
export const LOCATION_STORAGE_KEY = "yodla-location-v2";

function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  return value.reduce((items, candidate) => {
    const product = getProduct(candidate?.id);
    const quantity = Math.min(24, Math.max(1, Number.parseInt(candidate?.quantity, 10) || 0));
    if (!product || quantity < 1) return items;
    const existing = items.find((item) => item.id === product.id);
    if (existing) existing.quantity = Math.min(24, existing.quantity + quantity);
    else items.push({ id: product.id, quantity });
    return items;
  }, []);
}

export function readCart(storage = globalThis.localStorage) {
  try {
    return sanitizeCart(JSON.parse(storage?.getItem(CART_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function writeCart(cart, storage = globalThis.localStorage) {
  const cleanCart = sanitizeCart(cart);
  try {
    storage?.setItem(CART_STORAGE_KEY, JSON.stringify(cleanCart));
  } catch {
    // Browsing still works when storage is unavailable.
  }
  return cleanCart;
}

export function addCartItem(cart, productId, quantity = 1) {
  const next = sanitizeCart(cart);
  const product = getProduct(productId);
  if (!product) return next;
  const line = next.find((item) => item.id === productId);
  if (line) line.quantity = Math.min(24, line.quantity + Math.max(1, quantity));
  else next.push({ id: productId, quantity: Math.max(1, quantity) });
  return next;
}

export function setCartQuantity(cart, productId, quantity) {
  if (quantity < 1) return sanitizeCart(cart).filter((item) => item.id !== productId);
  return sanitizeCart(cart).map((item) => item.id === productId
    ? { ...item, quantity: Math.min(24, quantity) }
    : item);
}

export function removeCartItem(cart, productId) {
  return sanitizeCart(cart).filter((item) => item.id !== productId);
}

export function getCartCount(cart) {
  return sanitizeCart(cart).reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal(cart) {
  return sanitizeCart(cart).reduce((total, item) => total + getProduct(item.id).price * item.quantity, 0);
}
