import { PRODUCTS, formatMoney as money, getProduct, getAvailability } from './catalog.js';
import { loadPublishedContent, content } from './content-store.js';
import { readCart, writeCart, addCartItem, setCartQuantity, getCartCount, getCartTotal } from './cart-store.js';
import { readGiftDraft, writeGiftDraft, addGiftRecipient, removeGiftRecipient, setGiftQuantity, giftDraftError } from './gifting.js';
import { NIGERIAN_STATES, catalogLocationForState } from './states.js';
import { STATIONS, unavailableGiftLines, giftCost } from './boutique-model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeImage = value => {
  const url = new URL(value || '/assets/gifting/gift-selection.webp', location.origin);
  return ['http:', 'https:'].includes(url.protocol) ? esc(url.href) : '/assets/gifting/gift-selection.webp';
};
const dialog = $('#store-dialog'), panel = $('#panel-content');
let scene, activePanel = '', selectedProduct = '', cart = readCart(), giftStep = 'people', editingId = '', returnFocus;
const stored = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
let shoppingFor = stored('sessionStorage', 'yodla-boutique-purpose') || 'self';
let giftPerson = readGiftDraft().recipients[0]?.id || '';
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || stored('localStorage', 'yodla-boutique-motion') === 'reduced';
let toastTimer, lastVisit = '', pendingGiftProduct = '', filterQuery = '', filterCategory = 'All';
const abort = new AbortController(), events = { signal: abort.signal };

function toast(text) {
  const el = $('#toast'); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}
function setPurpose(value) { shoppingFor = value; try { sessionStorage.setItem('yodla-boutique-purpose', value); } catch {} }
function updateBasket() { cart = readCart(); $('#basket-count').textContent = getCartCount(cart); }
function heading(kicker, title, copy = '') {
  return `<div class="panel-heading"><span class="eyebrow">${kicker}</span><h2 id="panel-title" tabindex="-1">${title}</h2>${copy ? `<p>${copy}</p>` : ''}</div>`;
}
function openPanel(type, data = '') {
  activePanel = type;
  if (type === 'product') selectedProduct = data;
  if (!dialog.open) { returnFocus = document.activeElement; dialog.showModal(); }
  scene?.pause(true);
  renderPanel();
  requestAnimationFrame(() => $('#panel-title')?.focus({ preventScroll: true }));
}
function closePanel() {
  dialog.close();
}
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  activePanel = ''; scene?.pause(false); returnFocus?.focus?.({ preventScroll: true });
}, events);
$('#close-panel').addEventListener('click', closePanel, events);
dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) closePanel(); }, events);

function enter() {
  document.body.classList.add('entered');
  $('#welcome').inert = true;
  scene?.enter();
}
function visit(id) {
  if (!STATIONS[id]) return;
  document.body.classList.add('entered'); $('#welcome').inert = true;
  if (dialog.open) closePanel();
  lastVisit = id;
  if (scene) scene.visit(id); else arrive(id);
}
function arrive(id) {
  $('#store-location').innerHTML = `<span>${esc(STATIONS[id].label.toUpperCase())}</span><small>${id === 'gifts' ? 'Your thought. Their moment.' : id === 'checkout' ? 'Everything for your evening.' : 'Stay a little. Find your bottle.'}</small>`;
  if (id === 'gifts') { setPurpose('gift'); openPanel('gift'); }
  if (id === 'checkout') { setPurpose('self'); openPanel('basket'); }
  if (['wines', 'spirits'].includes(id) && matchMedia('(pointer: coarse)').matches) {
    filterCategory = 'All'; filterQuery = ''; openPanel('catalogue', id);
  }
}
function purposeControls() {
  return `<div class="dialog-actions"><button class="secondary" data-purpose="self" aria-pressed="${shoppingFor === 'self'}">${shoppingFor === 'self' ? '● ' : ''}For myself</button><button class="secondary" data-purpose="gift" aria-pressed="${shoppingFor === 'gift'}">${shoppingFor === 'gift' ? '● ' : ''}For a gift</button></div>`;
}
function productPanel() {
  const p = getProduct(selectedProduct);
  if (!p) return heading('THE CELLAR', 'Bottle unavailable', 'This bottle has left the shelf. Choose another from the bottle list.');
  const location = stored('localStorage', 'yodla-location-v2') || 'Lagos';
  const available = getAvailability(p, catalogLocationForState(location)) !== 'unavailable';
  return `${heading(esc(p.category), esc(p.name))}<img class="product-detail-image" src="${safeImage(p.image)}" alt="${esc(p.name)}"><div class="product-specs"><span>${esc(p.volume)}</span><span>${esc(p.abv)} ABV</span><span>${esc(p.subcategory)}</span></div><p class="product-description">${esc(p.description)}</p><div class="product-notes">${(p.notes || []).map(n => `<span>${esc(n)}</span>`).join('')}</div><p class="product-price">${money(p.price)}</p>${p.prototype ? '<p class="compact-note">Concept bottle from the bundled catalogue. Final availability is confirmed at checkout.</p>' : ''}${purposeControls()}${shoppingFor === 'self' ? `<label>Delivery state<select id="self-state">${NIGERIAN_STATES.map(s => `<option ${s === location ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><div class="dialog-actions"><button class="primary" data-add-self="${esc(p.id)}" ${available ? '' : 'disabled'}>${available ? 'Add to basket' : 'Unavailable in this state'} <span>+</span></button></div>` : giftProductControls(p)}<button class="quiet" data-open="catalogue">Back to the bottle list</button>`;
}
function giftProductControls(p) {
  const draft = readGiftDraft();
  if (!draft.recipients.length) return `<p class="compact-note">Start with their delivery details. We’ll keep this bottle in mind.</p><div class="dialog-actions"><button class="primary" data-start-gift="${esc(p.id)}">Take it to the Gift Atelier ↗</button></div>`;
  const person = draft.recipients.find(p => p.id === giftPerson) || draft.recipients[0]; giftPerson = person.id;
  const available = getAvailability(p, catalogLocationForState(person.state)) !== 'unavailable';
  return `${recipientSelect(draft)}<div class="dialog-actions"><button class="primary" data-add-gift="${esc(p.id)}" ${available ? '' : 'disabled'}>${available ? `Add for ${esc(person.firstName)}` : 'Unavailable in their state'} <span>+</span></button></div>`;
}
function recipientSelect(draft) {
  return `<label>Choosing for<select id="gift-person">${draft.recipients.map(p => `<option value="${esc(p.id)}" ${p.id === giftPerson ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
}
function cataloguePanel() {
  return `${heading('THE CELLAR', shoppingFor === 'gift' ? 'Find their bottle.' : 'Find your bottle.', 'The same shelf, a closer look. Choose a bottle to see the details.')}${purposeControls()}<div class="search-row"><input id="bottle-search" type="search" aria-label="Search bottles" placeholder="Search a bottle or brand" value="${esc(filterQuery)}"><select id="bottle-category" aria-label="Bottle category"><option>All</option>${[...new Set(PRODUCTS.map(p => p.category))].map(c => `<option ${c === filterCategory ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div><p id="catalogue-status" class="compact-note" aria-live="polite"></p><div id="bottle-list" class="product-list">${bottleRows()}</div>`;
}
function bottleRows() {
  const matches = PRODUCTS.filter(p => (filterCategory === 'All' || p.category === filterCategory) && `${p.name} ${p.brand}`.toLowerCase().includes(filterQuery.toLowerCase()));
  return matches.map(p => `<button class="bottle-row" data-product="${esc(p.id)}"><img src="${safeImage(p.image)}" alt="" loading="lazy"><span><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.volume)}</small><b>${money(p.price)}</b></span><span aria-hidden="true" style="flex:0">↗</span></button>`).join('') || '<p class="empty">No bottles match that search.</p>';
}
function basketPanel() {
  updateBasket();
  return `${heading('THE CHECKOUT COUNTER', 'For your evening.', 'Your personal basket. Gifts are prepared separately in the Gift Atelier.')}<div>${cart.map(line => {
    const p = getProduct(line.id);
    return `<article class="basket-line"><img src="${safeImage(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><small>${money(p.price)}</small><div class="quantity"><button data-cart-qty="${esc(p.id)}" data-delta="-1" aria-label="Reduce ${esc(p.name)}">−</button><span>${line.quantity}</span><button data-cart-qty="${esc(p.id)}" data-delta="1" aria-label="Increase ${esc(p.name)}" ${line.quantity >= 24 ? 'disabled' : ''}>+</button></div></div><b>${money(p.price * line.quantity)}</b></article>`;
  }).join('') || '<p class="empty">Your basket is waiting for a good bottle.</p>'}</div>${cart.length ? `<div class="totals"><div class="grand-total"><span>Bottles</span><span>${money(getCartTotal(cart))}</span></div></div><p class="compact-note">Delivery is calculated at checkout. Recipient must be 18 or older.</p><div class="dialog-actions"><a class="primary" href="/checkout.html">Continue to checkout ↗</a></div>` : ''}<div class="dialog-actions"><button class="secondary" data-open="catalogue">Keep browsing</button><button class="secondary" data-visit="gifts">Make a gift instead ↗</button></div><p class="compact-note">The Gift Atelier keeps its own selections. Your personal basket stays here.</p>`;
}
function peoplePanel(draft) {
  const edit = draft.recipients.find(p => p.id === editingId) || {};
  return `<p class="compact-note">Up to five people. Each gets their own bottles, delivery address, and personal message.</p>${draft.recipients.map(p => `<article class="recipient-card"><div><strong>${esc(p.name)}</strong><span><button data-edit-person="${esc(p.id)}">Edit</button><button data-remove-person="${esc(p.id)}">Remove</button></span></div><p>${esc(p.email)}<br>${esc(p.address)}, ${esc(p.state)}</p>${p.message ? `<p class="recipient-note">${esc(p.message)}</p>` : ''}</article>`).join('')}${draft.recipients.length < 5 || editingId ? `<form id="recipient-form"><div class="panel-heading"><span class="eyebrow">${editingId ? 'EDIT RECIPIENT' : `RECIPIENT ${draft.recipients.length + 1}`}</span></div><div class="form-grid">${[['firstName','First name','text'],['lastName','Last name','text'],['email','Email','email'],['phone','Phone','tel'],['address','Delivery address','text']].map(([key,label,type]) => `<label class="${key === 'address' ? 'full' : ''}">${label}<input name="${key}" type="${type}" value="${esc(edit[key])}" required maxlength="${key === 'email' ? 160 : key === 'address' ? 300 : 80}" autocomplete="${({ firstName:'given-name', lastName:'family-name', email:'email', phone:'tel', address:'street-address' })[key]}"></label>`).join('')}<label>State<select name="state" required><option value="">Choose state</option>${NIGERIAN_STATES.map(s => `<option ${s === edit.state ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Courier note<input name="note" value="${esc(edit.note)}" maxlength="500" placeholder="Gate, landmark, timing"></label><label class="full">Their personal message<textarea name="message" maxlength="500" rows="3" placeholder="A little something, just for you…">${esc(edit.message)}</textarea></label></div><div class="dialog-actions"><button class="secondary" type="submit">${editingId ? 'Save changes' : 'Add recipient'} +</button>${editingId ? '<button class="secondary" type="button" id="cancel-edit">Cancel edit</button>' : ''}</div><p class="form-status" id="recipient-status" role="status"></p></form>` : '<p class="compact-note">Five recipients added. Edit or remove a person to make changes.</p>'}<div class="dialog-actions"><button class="primary" data-gift-step="bottles" ${draft.recipients.length ? '' : 'disabled'}>Choose their bottles ↗</button></div>`;
}
function giftBottlesPanel(draft) {
  if (!draft.recipients.length) return '<p class="empty">Add a recipient first.</p>';
  if (!draft.recipients.some(p => p.id === giftPerson)) giftPerson = draft.recipients[0].id;
  const person = draft.recipients.find(p => p.id === giftPerson);
  const lines = draft.items.filter(i => i.recipientId === giftPerson);
  return `${recipientSelect(draft)}<div class="selected-bottles">${lines.map(i => `<div class="selected-line"><span>${esc(getProduct(i.productId)?.name || 'Unavailable bottle')}</span><div class="quantity"><button data-gift-qty="${esc(i.productId)}" data-delta="-1" aria-label="Reduce ${esc(getProduct(i.productId)?.name)}">−</button><span>${i.quantity}</span><button data-gift-qty="${esc(i.productId)}" data-delta="1" aria-label="Increase ${esc(getProduct(i.productId)?.name)}" ${i.quantity >= 99 ? 'disabled' : ''}>+</button></div></div>`).join('') || '<p class="empty">Choose something they’ll love.</p>'}</div><div class="dialog-actions"><button class="secondary" id="browse-store">Choose from the shelves ↗</button></div><div class="product-list">${PRODUCTS.map(p => {
    const available = getAvailability(p, catalogLocationForState(person.state)) !== 'unavailable';
    return `<button class="bottle-row" data-add-gift="${esc(p.id)}" ${available ? '' : 'disabled'}><img src="${safeImage(p.image)}" alt="" loading="lazy"><span><strong>${esc(p.name)}</strong><small>${available ? money(p.price) : `Unavailable in ${esc(person.state)}`}</small></span><b>${available ? '+' : '×'}</b></button>`;
  }).join('')}</div><div class="dialog-actions"><button class="primary" data-gift-step="wrap">Wrap &amp; review ↗</button></div>`;
}
function wrappingPanel(draft) {
  const person = draft.recipients.find(p => p.id === giftPerson) || draft.recipients[0];
  giftPerson = person?.id || '';
  const first = draft.items.find(i => i.recipientId === giftPerson), product = getProduct(first?.productId);
  const totals = giftCost(draft, PRODUCTS);
  const error = giftDraftError(draft) || (unavailableGiftLines(draft, PRODUCTS).length ? 'A bottle is unavailable for its recipient. Go back to bottles and remove or replace it.' : '');
  return `<div class="pack-preview ${draft.wrap ? 'wrapped' : ''}" id="pack-preview" aria-label="Animated gift presentation"><div class="pack-box">${product ? `<img src="${safeImage(product.image)}" alt="${esc(product.name)}">` : ''}<div class="pack-lid"></div><span class="pack-tag">For ${esc(person?.firstName || 'you')}</span></div></div><p class="gift-preview-note">${esc(person?.message || draft.message || 'A little something, chosen for you.')}</p><button class="pack-replay" id="pack-replay">Replay the wrapping</button>${draft.recipients.length > 1 ? recipientSelect(draft) : ''}<label class="check-label"><input type="checkbox" id="gift-wrap" ${draft.wrap ? 'checked' : ''}>Gift wrap, +${money(1500)}</label><label class="check-label"><input type="checkbox" id="gift-notify" ${draft.notify ? 'checked' : ''}>Email recipients after payment</label><p class="compact-note">The box is a presentation preview. The wrapping charge applies once per order.</p>${draft.recipients.map(p => `<article class="recipient-card"><div><strong>${esc(p.name)}</strong><button data-edit-person="${esc(p.id)}">Edit</button></div><p>${esc(p.address)}, ${esc(p.state)}<br>${esc(p.email)}</p>${draft.items.filter(i => i.recipientId === p.id).map(i => `<p>${esc(getProduct(i.productId)?.name || 'Unavailable bottle')} × ${i.quantity} <b>${money((getProduct(i.productId)?.price || 0) * i.quantity)}</b></p>`).join('')}${p.message || draft.message ? `<p class="recipient-note">${esc(p.message || draft.message)}</p>` : ''}</article>`).join('')}<div class="totals"><div><span>Bottles</span><span>${money(totals.subtotal)}</span></div><div><span>Delivery, ${draft.recipients.length} ${draft.recipients.length === 1 ? 'person' : 'people'}</span><span>${money(totals.delivery)}</span></div>${draft.wrap ? `<div><span>Gift wrap</span><span>${money(totals.wrapping)}</span></div>` : ''}<div class="grand-total"><span>Total</span><span>${money(totals.total)}</span></div></div>${error ? `<p class="form-status">${esc(error)}</p>` : ''}<div class="dialog-actions">${error ? '<button class="primary" data-gift-step="bottles">Review bottle selections ↗</button>' : '<a class="primary" id="gift-checkout" href="/checkout.html?gift=1">Continue to gift checkout ↗</a>'}</div><p class="compact-note">One payment covers all recipients. Recipients must be 18 or older.</p>`;
}
function giftPanel() {
  const draft = readGiftDraft();
  return `${heading('THE GIFT ATELIER', giftStep === 'people' ? 'Who’s the lucky one?' : giftStep === 'bottles' ? 'Chosen with thought.' : 'Make it theirs.', giftStep === 'wrap' ? 'One last look before it leaves your hands.' : '')}<nav class="gift-tabs" aria-label="Gift steps">${[['people','01 People'],['bottles','02 Bottles'],['wrap','03 Wrap & review']].map(([key,label]) => `<button data-gift-step="${key}" ${key === giftStep ? 'aria-current="step"' : ''}>${label}</button>`).join('')}</nav>${giftStep === 'people' ? peoplePanel(draft) : giftStep === 'bottles' ? giftBottlesPanel(draft) : wrappingPanel(draft)}`;
}
function helpPanel() {
  return `${heading('MAKE YOURSELF AT HOME', 'Take a look around.')}<div class="help-copy"><p>On a computer, click “Step inside”, then use <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys to walk. Hold and drag the scene to look around. Click a bottle to see its details.</p><p>On a phone, tap Cellar, Spirits, Gifting, or Checkout to move to that section. Choose bottles from the list.</p><p>The map and navigation buttons also work with a keyboard. The bottle list gives you access to every product without walking.</p><p>Your personal basket and gift selections stay separate. Gifts can have up to five recipients, each with their own bottles and message.</p><p>This is a concept preview. Checkout uses the existing Yodla checkout page.</p></div><div class="dialog-actions"><button class="primary" data-open="catalogue">Browse bottles ↗</button></div>`;
}
function renderPanel() {
  const scroll = dialog.scrollTop;
  try { panel.innerHTML = activePanel === 'product' ? productPanel() : activePanel === 'catalogue' ? cataloguePanel() : activePanel === 'basket' ? basketPanel() : activePanel === 'gift' ? giftPanel() : helpPanel(); }
  catch { panel.innerHTML = heading('YOUR SELECTIONS', 'Something needs a refresh.', 'Please return to the store and try again. Your saved selections will stay on this device.'); }
  dialog.scrollTop = scroll;
  if (activePanel === 'gift' && giftStep === 'wrap') animatePack();
}
let packTimer;
function animatePack() {
  clearTimeout(packTimer); const pack = $('#pack-preview');
  if (!pack) return;
  pack.classList.remove('sealed');
  if (reduced) pack.classList.add('sealed');
  else packTimer = setTimeout(() => pack.classList.add('sealed'), 500);
}
function goGiftStep(step) {
  const draft = readGiftDraft();
  if (step !== 'people' && giftDraftError(draft, false)) return toast('Add and save a recipient first.');
  if (step === 'wrap' && giftDraftError(draft)) return toast(giftDraftError(draft));
  editingId = ''; giftStep = step; activePanel = 'gift'; renderPanel(); dialog.scrollTop = 0; $('#panel-title')?.focus({ preventScroll: true });
}
function addForGift(id) {
  const draft = readGiftDraft();
  const person = draft.recipients.find(p => p.id === giftPerson) || draft.recipients[0];
  const product = getProduct(id);
  if (!person) { pendingGiftProduct = id; giftStep = 'people'; setPurpose('gift'); visit('gifts'); return; }
  if (!product || getAvailability(product, catalogLocationForState(person.state)) === 'unavailable') return toast('This bottle is unavailable in their delivery state.');
  const quantity = draft.items.find(i => i.recipientId === person.id && i.productId === id)?.quantity || 0;
  if (quantity >= 99) return toast('The maximum is 99 of each bottle per recipient.');
  try { setGiftQuantity(person.id, id, quantity + 1); renderPanel(); toast(`Added for ${person.firstName}.`); }
  catch { toast('Your gift could not be saved. Check that browser storage is enabled.'); }
}
function trySaveGift(draft) {
  try { writeGiftDraft(draft); return true; }
  catch { toast('Your gift could not be saved. Check that browser storage is enabled.'); return false; }
}

// Delegate controls so every shelf and panel uses the same basket and gift draft.
document.addEventListener('click', event => {
  const button = event.target.closest('button,a'); if (!button) return;
  const data = button.dataset;
  if (data.visit) { visit(data.visit); return; }
  if (data.open) { if (data.open === 'catalogue') { filterQuery = ''; filterCategory = 'All'; } openPanel(data.open); return; }
  if (data.product) { openPanel('product', data.product); return; }
  if (data.purpose) { setPurpose(data.purpose); renderPanel(); return; }
  if (data.addSelf) {
    const p = getProduct(data.addSelf), state = $('#self-state')?.value || 'Lagos';
    if (!p || getAvailability(p, catalogLocationForState(state)) === 'unavailable') return toast('Choose another bottle for this delivery state.');
    const existing = cart.find(i => i.id === p.id);
    if (existing?.quantity >= 24) return toast('The maximum is 24 of each bottle in your basket.');
    writeCart(addCartItem(readCart(), p.id)); updateBasket(); toast(`${p.name} added to your basket.`); return;
  }
  if (data.startGift) { pendingGiftProduct = data.startGift; giftStep = 'people'; visit('gifts'); return; }
  if (data.addGift) { addForGift(data.addGift); return; }
  if (data.giftStep) { goGiftStep(data.giftStep); return; }
  if (data.cartQty) { cart = writeCart(setCartQuantity(readCart(), data.cartQty, (readCart().find(i => i.id === data.cartQty)?.quantity || 0) + Number(data.delta))); renderPanel(); return; }
  if (data.giftQty) {
    const draft = readGiftDraft(); const line = draft.items.find(i => i.recipientId === giftPerson && i.productId === data.giftQty);
    try { setGiftQuantity(giftPerson, data.giftQty, Math.max(0, (line?.quantity || 0) + Number(data.delta))); renderPanel(); }
    catch { toast('That quantity could not be saved.'); } return;
  }
  if (data.editPerson) { editingId = data.editPerson; giftStep = 'people'; renderPanel(); $('#recipient-form')?.scrollIntoView({ block: 'start' }); $('#recipient-form input')?.focus(); return; }
  if (data.removePerson) {
    try { removeGiftRecipient(data.removePerson); editingId = ''; renderPanel(); toast('Recipient removed.'); }
    catch { toast('That change could not be saved.'); } return;
  }
  if (button.id === 'cancel-edit') { editingId = ''; renderPanel(); }
  if (button.id === 'browse-store') { setPurpose('gift'); closePanel(); toast('Choose a bottle from a shelf. Your gift is saved.'); }
  if (button.id === 'pack-replay') animatePack();
  if (button.id === 'gift-checkout') {
    const draft = readGiftDraft(); const error = giftDraftError(draft);
    if (error || unavailableGiftLines(draft, PRODUCTS).length) { event.preventDefault(); toast(error || 'Review unavailable bottles before checkout.'); }
  }
}, events);
document.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'self-state') { try { localStorage.setItem('yodla-location-v2', target.value); } catch {} renderPanel(); }
  if (target.id === 'gift-person') { giftPerson = target.value; renderPanel(); }
  if (target.id === 'bottle-category') { filterCategory = target.value; $('#bottle-list').innerHTML = bottleRows(); }
  if (target.id === 'gift-wrap' || target.id === 'gift-notify') {
    const draft = readGiftDraft(); draft[target.id === 'gift-wrap' ? 'wrap' : 'notify'] = target.checked;
    if (trySaveGift(draft)) renderPanel();
  }
}, events);
document.addEventListener('input', event => {
  if (event.target.id === 'bottle-search') { filterQuery = event.target.value; $('#bottle-list').innerHTML = bottleRows(); $('#catalogue-status').textContent = `${$('#bottle-list').querySelectorAll('button').length} bottles`; }
}, events);
document.addEventListener('submit', event => {
  if (event.target.id !== 'recipient-form') return;
  event.preventDefault();
  try {
    const result = addGiftRecipient({ ...Object.fromEntries(new FormData(event.target)), id: editingId || undefined });
    if (!result.ok) { $('#recipient-status').textContent = result.error; return; }
    giftPerson = editingId || result.draft.recipients.at(-1).id; editingId = '';
    if (pendingGiftProduct) { const id = pendingGiftProduct; pendingGiftProduct = ''; addForGift(id); }
    renderPanel(); toast('Recipient saved.');
  } catch { $('#recipient-status').textContent = 'Your gift could not be saved. Check that browser storage is enabled.'; }
}, events);
$('#enter-store').addEventListener('click', enter, events);
$('#help-button').addEventListener('click', () => openPanel('help'), events);
function setMotion() {
  document.body.classList.toggle('reduced-motion', reduced);
  $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
  $('#motion-toggle').textContent = reduced ? 'Motion reduced' : 'Reduce motion'; scene?.setReducedMotion(reduced);
}
$('#motion-toggle').addEventListener('click', () => { reduced = !reduced; try { localStorage.setItem('yodla-boutique-motion', reduced ? 'reduced' : 'full'); } catch {} setMotion(); }, events);
window.addEventListener('storage', event => {
  if (event.key === 'yodla-cart-v2') { updateBasket(); if (activePanel === 'basket') renderPanel(); }
  if (event.key === 'yodla-gift-draft' && activePanel === 'gift') renderPanel();
}, events);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { reduced = e.matches; setMotion(); }, events);
function fallback() {
  scene?.dispose(); scene = null; document.body.classList.add('fallback-mode');
  $('#loading').hidden = false; $('#loading').classList.add('error');
  $('#loading').textContent = 'The 3D view is unavailable on this device. You can still browse bottles, build gifts, and use checkout.';
  $('#enter-store').textContent = 'Browse bottles ↗'; $('#enter-store').onclick = () => openPanel('catalogue');
  $('#movement-hint').textContent = 'Use the navigation to browse and prepare your gift.';
}
async function boot() {
  updateBasket(); setMotion();
  if (matchMedia('(pointer: coarse)').matches || innerWidth <= 760) $('#movement-hint').textContent = 'Tap a section below to explore';
  await loadPublishedContent((url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(7000) }));
  if (content.meta.stale) toast('Showing the bundled catalogue. Checkout confirms current prices and stock.');
  try {
    const { createBoutique } = await import('./boutique-scene.js');
    scene = createBoutique({ container: $('#scene'), products: PRODUCTS, reduceMotion: reduced,
      onSelect: id => { document.body.classList.add('entered'); $('#welcome').inert = true; openPanel('product', id); },
      onStation: arrive,
      onHover: label => { $('#scene-label').hidden = !label; $('#scene-label').textContent = label; },
      onPosition: (x,z) => { $('#map-you').style.left = `${(x + 7) / 14 * 100}%`; $('#map-you').style.top = `${(z + 10) / 20 * 100}%`; },
    });
    $('#loading').hidden = true;
  } catch { fallback(); }
  $('#scene').addEventListener('boutique-render-error', fallback, events);
  const path = location.pathname;
  if (path.includes('gifting') || new URLSearchParams(location.search).get('area') === 'gifts') visit('gifts');
  else if (path.includes('shop')) {
    const params = new URLSearchParams(location.search);
    setPurpose(params.get('occasion') === 'Gift' ? 'gift' : 'self');
    filterCategory = params.get('category') || 'All';
    if (!PRODUCTS.some(p => p.category === filterCategory)) filterCategory = 'All';
    enter(); openPanel('catalogue');
  }
}
window.addEventListener('pagehide', () => { clearTimeout(toastTimer); clearTimeout(packTimer); scene?.dispose(); abort.abort(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
boot().catch(fallback);
