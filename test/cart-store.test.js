import test from "node:test";
import assert from "node:assert/strict";
import { addCartItem, getCartCount, getCartTotal, readCart, removeCartItem, setCartQuantity, writeCart } from "../js/cart-store.js";

function storage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key, next) => { value = next; }, value: () => value };
}

test("cart operations add, update, total and remove real products", () => {
  let cart = addCartItem([], "bottega-gold");
  cart = addCartItem(cart, "bottega-gold");
  cart = addCartItem(cart, "heineken-original");
  assert.equal(getCartCount(cart), 3);
  assert.equal(getCartTotal(cart), 87500);
  cart = setCartQuantity(cart, "heineken-original", 3);
  assert.equal(getCartCount(cart), 5);
  assert.deepEqual(removeCartItem(cart, "bottega-gold"), [{ id: "heineken-original", quantity: 3 }]);
});

test("storage reads safely and rejects stale products", () => {
  const fake = storage(JSON.stringify([{ id: "missing", quantity: 4 }, { id: "jack-daniels", quantity: 2 }]));
  assert.deepEqual(readCart(fake), [{ id: "jack-daniels", quantity: 2 }]);
  const written = writeCart([{ id: "hennessy-vs", quantity: 1 }], fake);
  assert.deepEqual(written, [{ id: "hennessy-vs", quantity: 1 }]);
  assert.match(fake.value(), /hennessy-vs/);
});
