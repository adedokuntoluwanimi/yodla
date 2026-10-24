import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, moveWithCollision, STATIONS, unavailableGiftLines, giftCost } from '../js/boutique-model.js';
import { addGiftRecipient, readGiftDraft, setGiftQuantity, removeGiftRecipient } from '../js/gifting.js';
import { normalizeGiftPayload } from '../lib/gift.js';
import { PRODUCTS } from '../js/catalog.js';
import { prepareGiftOrder } from '../lib/gift-order.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
}
test('walking cannot cross the table, counters, or room boundary, including long frames', () => {
  assert.equal(canStand(0, -2), false);
  assert.equal(canStand(-4, 4.8), false);
  assert.equal(canStand(3.5, -8), false);
  assert.equal(canStand(7, 0), false);
  for (const station of Object.values(STATIONS)) assert.equal(canStand(station.position[0], station.position[2]), true);
  const blocked = moveWithCollision({x:0,z:2}, 0, -10);
  assert.ok(blocked.z > 0);
  const slide = moveWithCollision({x:1.7,z:-2}, -1, -1);
  assert.ok(slide.x >= 1.63 && slide.z < -2);
});
test('five-recipient gift survives reload, assigns bottles independently, and removes only the intended person', () => {
  globalThis.localStorage = memoryStorage();
  for (let i = 0; i < 5; i++) {
    assert.equal(addGiftRecipient({ id:`person-${i}`, firstName:`Friend${i}`, lastName:'Example', email:`friend${i}@example.com`, phone:'08000000000', address:'Example address', state:'Lagos', message:`Your own note ${i}` }).ok, true);
    setGiftQuantity(`person-${i}`, PRODUCTS[i % 4].id, i+1);
  }
  assert.equal(addGiftRecipient({ firstName:'Sixth', lastName:'Example', email:'six@example.com', phone:'08000000000', address:'Example address', state:'Lagos' }).ok, false);
  assert.equal(addGiftRecipient({ firstName:'Duplicate', lastName:'Example', email:'FRIEND0@example.com', phone:'08000000000', address:'Example address', state:'Lagos' }).ok, false);
  const restored = readGiftDraft();
  assert.equal(restored.recipients.length, 5);
  assert.equal(restored.items.length, 5);
  assert.equal(restored.recipients[3].message, 'Your own note 3');
  const order = prepareGiftOrder(restored, PRODUCTS);
  assert.equal(order.gift.recipients[3].message, 'Your own note 3');
  assert.deepEqual(giftCost(restored, PRODUCTS), { subtotal:order.totals.subtotal, delivery:order.totals.deliveryFee, wrapping:order.totals.giftFee, total:order.totals.total });
  removeGiftRecipient('person-2');
  assert.equal(readGiftDraft().items.some(i=>i.recipientId==='person-2'), false);
  assert.equal(readGiftDraft().items.length, 4);
  delete globalThis.localStorage;
});
test('stock changes and removed products block gift checkout; personal messages are bounded and preserved', () => {
  const draft={ recipients:[{id:'one',state:'Rivers',email:'one@example.com',message:'x'.repeat(700)}],items:[{recipientId:'one',productId:'bottega-gold',quantity:1}],wrap:true };
  assert.equal(unavailableGiftLines(draft,PRODUCTS).length,1);
  assert.equal(unavailableGiftLines({...draft,recipients:[{...draft.recipients[0],state:'Lagos'}]},PRODUCTS).length,0);
  assert.equal(unavailableGiftLines(draft,[]).length,1);
  const clean=normalizeGiftPayload(draft);
  assert.equal(clean.recipients[0].message.length,500);
});

test('tap navigation routes around furniture between every station', async () => {
  const { routeToStation } = await import('../js/boutique-model.js');
  for (const a of Object.values(STATIONS)) for (const b of Object.values(STATIONS)) {
    let current={x:a.position[0],z:a.position[2]};
    const end={x:b.position[0],z:b.position[2]};
    const route=routeToStation(current,end);
    assert.ok(route.length,`${a.label} to ${b.label} has a route`);
    for(const target of route){
      const distance=Math.hypot(target.x-current.x,target.z-current.z),steps=Math.max(1,Math.ceil(distance/.08));
      for(let i=0;i<=steps;i++) assert.ok(canStand(current.x+(target.x-current.x)*i/steps,current.z+(target.z-current.z)*i/steps));
      current=target;
    }
    assert.deepEqual(current,end);
  }
});

test('recipient IDs also work on HTTP development previews', () => {
  globalThis.localStorage = memoryStorage();
  const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const result=addGiftRecipient({ firstName:'Preview',lastName:'Example',email:'preview@example.com',phone:'08000000000',address:'Example address',state:'Lagos' });
    assert.equal(result.ok,true);
    assert.match(result.draft.recipients[0].id,/^gift-[a-f0-9]{32}$/);
  } finally {
    if (uuid) Object.defineProperty(crypto,'randomUUID',uuid); else delete crypto.randomUUID;
    delete globalThis.localStorage;
  }
});

test('invalid pointer destinations cannot create a navigation route', async () => {
  const {routeToStation}=await import('../js/boutique-model.js');
  assert.equal(canStand(undefined,0),false);
  assert.equal(canStand(0,NaN),false);
  assert.deepEqual(routeToStation({x:0,z:7},{x:NaN,z:0}),[]);
  assert.deepEqual(routeToStation(null,{x:0,z:7}),[]);
});
