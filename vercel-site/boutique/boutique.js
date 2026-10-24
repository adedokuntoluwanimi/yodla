import { icon, enhanceUIIcons } from './boutique-icons.js';
import { createOrder, orderFrame } from './boutique-order.js';
import { createAmbientMusic, createDoorBell } from './boutique-music.js';
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
let recipientFormOpen=false, suppressFormCapture=false, pendingRemoval=null;
const formMemory=new Map();
let shelfSection='', giftQuery='';
let scene, activePanel = '', selectedProduct = '', cart = readCart(), giftStep = 'people', editingId = '', returnFocus;
const stored = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
let shoppingFor = stored('sessionStorage', 'yodla-boutique-purpose') || 'self';
let giftPerson = readGiftDraft().recipients[0]?.id || '';
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || stored('localStorage', 'yodla-boutique-motion') === 'reduced';
let pendingGiftStep = '';
let toastTimer, lastVisit = '', pendingGiftProduct = '', filterQuery = '', filterCategory = 'All';
const abort = new AbortController(), events = { signal: abort.signal };

function toast(text, kind = 'info') {
  const el = dialog.open ? $('#dialog-notice') : $('#toast');
  const other = dialog.open ? $('#toast') : $('#dialog-notice');
  other.hidden = true;
  const copy = document.createElement('span');copy.textContent = text;
  const dismiss = document.createElement('button');dismiss.type='button';dismiss.dataset.dismissNotice='';
  dismiss.setAttribute('aria-label','Dismiss notification');dismiss.innerHTML=icon('close');
  el.replaceChildren(copy,dismiss);el.dataset.kind=kind;el.setAttribute('role',kind==='error'?'alert':'status');el.hidden=false;
  clearTimeout(toastTimer);
  if(kind!=='error')toastTimer=setTimeout(()=>{el.hidden=true;},5500);
}
function setPurpose(value) { shoppingFor = value; scene?.setShoppingBasket(basketLines()); try { sessionStorage.setItem('yodla-boutique-purpose', value); } catch {} }
function updateBasket() { cart = readCart(); scene?.setShoppingBasket(basketLines()); $('#basket-count').textContent = getCartCount(cart); }
function heading(kicker, title, copy = '') {
  return `<div class="panel-heading"><span class="eyebrow">${kicker}</span><h2 id="panel-title" tabindex="-1">${title}</h2>${copy ? `<p>${copy}</p>` : ''}</div>`;
}
function openPanel(type, data = '') {
  if(orderSession)return;
  const activeNotice = !$('#toast').hidden ? $('#toast span')?.textContent : '';
  document.body.classList.add('panel-open');
  activePanel = type;
  if (type === 'product') selectedProduct = data;
  if (!dialog.open) { returnFocus = document.activeElement; dialog.showModal(); }
  scene?.pause(true);
  $('#panel-back').hidden=!['product','gift','basket'].includes(type);
  if(activeNotice)toast(activeNotice);
  renderPanel();
  requestAnimationFrame(() => $('#panel-title')?.focus({ preventScroll: true }));
}
function closePanel() {
  dialog.close();
}
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  document.body.classList.remove('panel-open');
  $('#dialog-notice').hidden=true;
  captureRecipientForm();
  activePanel = ''; scene?.pause(Boolean(orderSession?.started)); returnFocus?.focus?.({ preventScroll: true });
}, events);
$('#close-panel').addEventListener('click', closePanel, events);
dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) closePanel(); }, events);

function enter() {
  if(!scene)doorBell.ring().catch(()=>{});
  document.body.classList.add('entered');
  $('#welcome').inert = true;
  scene?.enter();
}
function visit(id) {
  if(!document.body.classList.contains('entered')){if(scene)scene.openEntrance();else doorBell.ring().catch(()=>{});}
  if(leaving)return;
  if(orderSession){toast("Finish at the counter, or return to shopping.");return;}
  if (!STATIONS[id]) return;
  document.body.classList.add('entered'); $('#welcome').inert = true;
  if (dialog.open) closePanel();
  lastVisit = id;
  document.querySelectorAll('[data-visit]').forEach(b=>b.setAttribute('aria-current',b.dataset.visit===id?'location':'false'));
  $('#travel-status').textContent=`Moving to ${STATIONS[id].label}…`;
  if (scene) scene.visit(id); else arrive(id);
}
function arrive(id) {
  if(id==='door'){showGoodbye();return;}
  if(orderSession){beginCounter();return;}
  $('#travel-status').textContent='';
  $('#store-location').innerHTML = `<span>${esc(STATIONS[id].label.toUpperCase())}</span><small>${id === 'gifts' ? 'Your thought. Their moment.' : id === 'checkout' ? 'Everything for your evening.' : 'Stay a little. Find your bottle.'}</small>`;
  if (id === 'gifts') { setPurpose('gift'); openPanel('gift'); }
  if (id === 'checkout') { setPurpose('self'); openPanel('basket'); }
  if (['wines', 'spirits'].includes(id) && (matchMedia('(pointer: coarse)').matches || innerWidth<=760)) {
    filterCategory='All';filterQuery='';shelfSection=id;openPanel('catalogue');
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
  return `${heading(esc(p.category), esc(p.name))}<img class="product-detail-image" src="${safeImage(p.image)}" alt="${esc(p.name)}"><div class="product-specs"><span>${esc(p.volume)}</span><span>${esc(p.abv)} ABV</span><span>${esc(p.subcategory)}</span></div><p class="product-description">${esc(p.description)}</p><div class="product-notes">${(p.notes || []).map(n => `<span>${esc(n)}</span>`).join('')}</div><p class="product-price">${money(p.price)}</p>${p.prototype ? '<p class="compact-note">Concept bottle from the bundled catalogue. Final availability is confirmed at checkout.</p>' : ''}${purposeControls()}${shoppingFor === 'self' ? `<label>Delivery state<select id="self-state">${NIGERIAN_STATES.map(s => `<option ${s === location ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><div class="dialog-actions"><button class="primary" data-add-self="${esc(p.id)}" ${available ? '' : 'disabled'}>${available ? 'Add to basket' : 'Unavailable in this state'} <span>+</span></button></div>` : giftProductControls(p)}<div class="dialog-actions sticky-actions"><button class="secondary" data-panel-back>Back to bottles</button><button class="secondary" data-visit="${shoppingFor==='gift'?'gifts':'checkout'}">${shoppingFor==='gift'?'Review gift':'Review basket'} ${icon('arrow')}</button></div>`;
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
  return `${heading('THE CELLAR', shoppingFor === 'gift' ? 'Find their bottle.' : 'Find your bottle.', 'The same shelf, a closer look. Choose a bottle to see the details.')}${purposeControls()}<div class="search-row"><input id="bottle-search" type="search" aria-label="Search bottles" placeholder="Search a bottle or brand" value="${esc(filterQuery)}"><select id="bottle-category" aria-label="Bottle category"><option>All</option>${[...new Set(PRODUCTS.map(p => p.category))].map(c => `<option ${c === filterCategory ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>${shelfSection ? `<button class="quiet" id="show-all-bottles">Show the full collection</button>` : ''}<p id="catalogue-status" class="compact-note" aria-live="polite"></p><div id="bottle-list" class="product-list">${bottleRows()}</div>`;
}
function bottleRows() {
  const matches = PRODUCTS.filter(p => (!shelfSection || (shelfSection==='wines' ? /wine|champagne/i.test(p.category) : !/wine|champagne/i.test(p.category))) && (filterCategory === 'All' || p.category === filterCategory) && `${p.name} ${p.brand}`.toLowerCase().includes(filterQuery.toLowerCase()));
  return matches.map(p => `<button class="bottle-row" data-product="${esc(p.id)}"><img src="${safeImage(p.image)}" alt="" loading="lazy"><span><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.volume)}</small><b>${money(p.price)}</b></span><span aria-hidden="true" style="flex:0">↗</span></button>`).join('') || '<p class="empty">No bottles match that search.</p>';
}
function basketPanel() {
  updateBasket();
  return `${heading('THE CHECKOUT COUNTER', 'For your evening.', 'Daniel will check and pack your selection. Gifts are prepared separately.')}
    ${cart.length ? '' : `<div class="cashier-welcome">${icon('bag')}<div><strong>Daniel</strong><span>Your checkout host</span></div></div>`}<div>${cart.map(line => {
    const p = getProduct(line.id);
    return `<article class="basket-line"><img src="${safeImage(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><small>${money(p.price)}</small><div class="quantity"><button data-cart-qty="${esc(p.id)}" data-delta="-1" aria-label="Reduce ${esc(p.name)}">−</button><span>${line.quantity}</span><button data-cart-qty="${esc(p.id)}" data-delta="1" aria-label="Increase ${esc(p.name)}" ${line.quantity >= 24 ? 'disabled' : ''}>+</button></div></div><b>${money(p.price * line.quantity)}</b></article>`;
  }).join('') || '<p class="empty">Your basket is waiting for a good bottle.</p>'}</div>${cart.length ? `<div class="totals"><div class="grand-total"><span>Bottles</span><span>${money(getCartTotal(cart))}</span></div></div><form id="counter-delivery" class="form-grid"><label class="full">Your name<input name="name" autocomplete="name" required value="${esc(checkoutMemory.name||'')}"></label><label>Email<input name="email" type="email" autocomplete="email" required value="${esc(checkoutMemory.email||'')}"></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required value="${esc(checkoutMemory.phone||'')}"></label><label class="full">Delivery address<input name="address" autocomplete="street-address" required value="${esc(checkoutMemory.address||'')}"></label><label class="full">Delivery state<select name="state">${NIGERIAN_STATES.map(state=>`<option ${state===(checkoutMemory.state||'Lagos')?'selected':''}>${esc(state)}</option>`).join('')}</select></label></form><p class="compact-note">Delivery: ₦2,500 in Lagos, FCT, Abuja, Oyo and Rivers; ₦4,500 elsewhere. Recipient must be 18 or older.</p><div class="dialog-actions sticky-actions"><button type="button" class="primary" data-counter-start="checkout">Bring basket to Daniel ${icon('arrow')}</button></div>` : ''}<div class="dialog-actions"><button class="secondary" data-open="catalogue">Keep browsing</button><button class="secondary" data-visit="gifts">Make a gift instead ↗</button></div><p class="compact-note">The Gift Atelier keeps its own selections. Your personal basket stays here.</p>`;
}
function captureRecipientForm(){
  if(suppressFormCapture){suppressFormCapture=false;return;}
  const form=$('#recipient-form');if(form)formMemory.set(form.dataset.draftKey,Object.fromEntries(new FormData(form)));
}
function peoplePanel(draft) {
  const key=editingId||'new';
  const edit=formMemory.get(key) || draft.recipients.find(p=>p.id===editingId) || {};
  const showForm=!draft.recipients.length || editingId || recipientFormOpen;
  return `<div class="cashier-welcome">${icon('gift')}<div><strong>Nneka</strong><span>Your gift specialist</span></div><small>Up to five recipients</small></div>
    ${draft.recipients.map(p=>`<article class="recipient-card"><div><strong>${esc(p.name)}</strong><span><button type="button" data-edit-person="${esc(p.id)}">Edit</button><button type="button" data-remove-person="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${icon('close')}</button></span></div><p>${esc(p.email)}</p><details><summary>Delivery &amp; message</summary><p data-user-content>${esc(p.address)}, ${esc(p.state)}</p>${p.message?`<p class="recipient-note" data-user-content>${esc(p.message)}</p>`:''}</details></article>`).join('')}
    ${pendingRemoval?`<div class="remove-confirm" role="alert"><p>Remove this recipient and their bottle selections?</p><button type="button" class="secondary" id="confirm-remove">Remove recipient</button><button type="button" class="secondary" id="cancel-remove">Keep recipient</button></div>`:''}
    ${!showForm && draft.recipients.length<5?`<button type="button" class="secondary add-another" id="add-another-person">${icon('plus')} Add another recipient</button>`:''}
    ${showForm && (draft.recipients.length<5 || editingId)?`<form id="recipient-form" data-draft-key="${esc(key)}"><div class="panel-heading"><span class="eyebrow">${editingId?'EDIT RECIPIENT':`RECIPIENT ${draft.recipients.length+1}`}</span></div><div class="form-grid">${[['firstName','First name','text'],['lastName','Last name','text'],['email','Email','email'],['phone','Phone','tel'],['address','Delivery address','text']].map(([field,label,type])=>`<label class="${field==='address'?'full':''}" for="person-${field}">${label}<input id="person-${field}" name="${field}" type="${type}" value="${esc(edit[field])}" required maxlength="${field==='email'?160:field==='address'?300:80}" autocomplete="${({firstName:'given-name',lastName:'family-name',email:'email',phone:'tel',address:'street-address'})[field]}" ${field==='phone'?'inputmode="tel"':''}></label>`).join('')}<label for="person-state">State<select id="person-state" name="state" required><option value="">Choose state</option>${NIGERIAN_STATES.map(state=>`<option ${state===edit.state?'selected':''}>${state}</option>`).join('')}</select></label><label for="person-note">Courier note <small>Optional</small><input id="person-note" name="note" value="${esc(edit.note)}" maxlength="500" placeholder="Gate, landmark, timing"></label><label class="full" for="person-message">Their personal message <small>Optional, 500 characters</small><textarea id="person-message" name="message" maxlength="500" rows="3" placeholder="A message to include with their gift">${esc(edit.message)}</textarea></label></div><p class="form-status" id="recipient-status" role="status"></p><div class="dialog-actions"><button type="submit" class="secondary">${editingId?'Save changes':'Save recipient'} ${icon('check')}</button>${draft.recipients.length?'<button class="secondary" type="button" id="cancel-edit">Cancel</button>':''}</div></form>`:''}
    <div class="dialog-actions sticky-actions"><button type="button" class="primary" data-save-and-continue>${showForm?'Save & choose bottles':'Choose their bottles'} ${icon('arrow')}</button></div>`;
}
function giftBottlesPanel(draft) {
  if (!draft.recipients.length) return '<p class="empty">Add a recipient first.</p>';
  if (!draft.recipients.some(p => p.id === giftPerson)) giftPerson = draft.recipients[0].id;
  const person = draft.recipients.find(p => p.id === giftPerson);
  const lines = draft.items.filter(i => i.recipientId === giftPerson);
  return `<div class="recipient-switcher">${recipientSelect(draft)}<small>${draft.recipients.filter(p=>draft.items.some(i=>i.recipientId===p.id)).length} of ${draft.recipients.length} recipients have bottles</small></div><div class="selected-bottles">${lines.map(i => `<div class="selected-line"><span>${esc(getProduct(i.productId)?.name || 'Unavailable bottle')}</span><div class="quantity"><button data-gift-qty="${esc(i.productId)}" data-delta="-1" aria-label="Reduce ${esc(getProduct(i.productId)?.name)}">−</button><span>${i.quantity}</span><button data-gift-qty="${esc(i.productId)}" data-delta="1" aria-label="Increase ${esc(getProduct(i.productId)?.name)}" ${i.quantity >= 99 ? 'disabled' : ''}>+</button></div></div>`).join('') || '<p class="empty">Choose something they’ll love.</p>'}</div><div class="dialog-actions"><button class="secondary" id="browse-store">Choose from the shelves ↗</button></div><label class="gift-search-label" for="gift-search">Find a bottle<input id="gift-search" type="search" placeholder="Search bottle or brand" value="${esc(giftQuery)}"></label><div class="product-list gift-product-list">${PRODUCTS.map(p => {
    const available = getAvailability(p, catalogLocationForState(person.state)) !== 'unavailable';
    return `<button class="bottle-row" data-search="${esc(`${p.name} ${p.brand}`.toLowerCase())}" ${giftQuery && !`${p.name} ${p.brand}`.toLowerCase().includes(giftQuery.toLowerCase())?'hidden':''} data-add-gift="${esc(p.id)}" ${available ? '' : 'disabled'}><img src="${safeImage(p.image)}" alt="" loading="lazy"><span><strong>${esc(p.name)}</strong><small>${available ? money(p.price) : `Unavailable in ${esc(person.state)}`}</small></span><b>${available ? `${draft.items.find(i=>i.recipientId===giftPerson && i.productId===p.id)?.quantity || ''} ${icon('plus')}` : 'Unavailable'}</b></button>`;
  }).join('')}</div><p class="empty" id="gift-search-empty" hidden>No bottles match your search.</p><div class="dialog-actions sticky-actions"><button class="secondary" data-gift-step="people">People</button><button class="primary" data-gift-step="wrap">Presentation &amp; review ${icon('arrow')}</button></div>`;
}
function wrappingPanel(draft) {
  const person = draft.recipients.find(p => p.id === giftPerson) || draft.recipients[0];
  giftPerson = person?.id || '';
  const first = draft.items.find(i => i.recipientId === giftPerson), product = getProduct(first?.productId);
  const totals = giftCost(draft, PRODUCTS);
  const error = giftDraftError(draft) || (unavailableGiftLines(draft, PRODUCTS).length ? 'A bottle is unavailable for its recipient. Go back to bottles and remove or replace it.' : '');
  return `${draft.recipients.length>1?recipientSelect(draft):''}
    <div class="wrap-options"><label class="check-label"><input type="checkbox" id="gift-wrap" ${draft.wrap?'checked':''}>Gift wrap <span>+${money(1500)}</span></label><label class="check-label"><input type="checkbox" id="gift-notify" ${draft.notify?'checked':''}>Email recipients after payment</label></div>

    <p class="compact-note">Each box gets its own recipient tag and personal message. Gift wrap is charged once per order.</p>${draft.recipients.map(p => `<article class="recipient-card" data-user-content><div><strong>${esc(p.name)}</strong><button data-edit-person="${esc(p.id)}">Edit</button></div><p>${esc(p.address)}, ${esc(p.state)}<br>${esc(p.email)}</p>${draft.items.filter(i => i.recipientId === p.id).map(i => `<p>${esc(getProduct(i.productId)?.name || 'Unavailable bottle')} × ${i.quantity} <b>${money((getProduct(i.productId)?.price || 0) * i.quantity)}</b></p>`).join('')}${p.message || draft.message ? `<p class="recipient-note">${esc(p.message || draft.message)}</p>` : ''}</article>`).join('')}<div class="totals"><div><span>Bottles</span><span>${money(totals.subtotal)}</span></div><div><span>Delivery, ${draft.recipients.length} ${draft.recipients.length === 1 ? 'person' : 'people'}</span><span>${money(totals.delivery)}</span></div>${draft.wrap ? `<div><span>Gift wrap</span><span>${money(totals.wrapping)}</span></div>` : ''}<div class="grand-total"><span>Total</span><span>${money(totals.total)}</span></div></div>${error ? `<p class="form-status">${esc(error)}</p>` : ''}<div class="dialog-actions sticky-actions">${error ? '<button class="primary" data-gift-step="bottles">Review bottle selections ↗</button>' : '<button class="primary" id="gift-checkout" data-counter-start="gift">Bring gifts to Nneka ↗</button>'}</div><p class="compact-note">One payment covers all recipients. Recipients must be 18 or older.</p>`;
}
function giftPanel() {
  const draft = readGiftDraft();
  return `${heading('THE GIFT ATELIER', giftStep === 'people' ? 'The recipient.' : giftStep === 'bottles' ? 'The selection.' : 'Presentation & review.', giftStep === 'wrap' ? 'Review the details of each gift before checkout.' : '')}<nav class="gift-tabs" aria-label="Gift steps">${[['people','01 People'],['bottles','02 Bottles'],['wrap','03 Wrap & review']].map(([key,label]) => `<button data-gift-step="${key}" ${key === giftStep ? 'aria-current="step"' : ''}>${label}</button>`).join('')}</nav>${giftStep === 'people' ? peoplePanel(draft) : giftStep === 'bottles' ? giftBottlesPanel(draft) : wrappingPanel(draft)}`;
}
function helpPanel() {
  return `${heading('MAKE YOURSELF AT HOME', 'Take a look around.')}<div class="help-copy"><p>Click an open spot on the floor to move there. Hold and drag to look around, then click a bottle to see its details. No movement keys are required.</p><p>Use the map or section buttons for a direct route to the cellar, Gift Atelier, or checkout. On a phone, tap a section and select bottles from its list.</p><p>The map and navigation buttons also work with a keyboard. The bottle list gives you access to every product without walking.</p><p>Your personal basket and gift selections stay separate. Gifts can have up to five recipients, each with their own bottles and message.</p><p>This is a concept preview. Checkout uses the existing Yodla checkout page.</p></div><div class="dialog-actions"><button class="primary" data-open="catalogue">Browse bottles ↗</button></div>`;
}
function renderPanel() {
  captureRecipientForm();
  const scroll=dialog.scrollTop,focused=document.activeElement;
  const identity=['data-add-gift','data-cart-qty','data-gift-qty'].find(attr=>focused?.hasAttribute?.(attr));
  const anchor=identity?{attr:identity,value:focused.getAttribute(identity),delta:focused.dataset.delta,top:focused.getBoundingClientRect().top}:null;
  try{panel.innerHTML=activePanel==='product'?productPanel():activePanel==='catalogue'?cataloguePanel():activePanel==='basket'?basketPanel():activePanel==='gift'?giftPanel():helpPanel();}
  catch{panel.innerHTML=heading('YOUR SELECTIONS','Something needs a refresh.','Return to the store and try again. Your saved selections remain on this device.');}
  enhanceUIIcons(panel);dialog.scrollTop=scroll;
  if(anchor){const match=[...panel.querySelectorAll(`[${anchor.attr}]`)].find(el=>el.getAttribute(anchor.attr)===anchor.value && el.dataset.delta===anchor.delta);if(match){dialog.scrollTop+=match.getBoundingClientRect().top-anchor.top;match.focus({preventScroll:true});}}


}
function continueGift(step){
  const form=$('#recipient-form');
  const hasInput=form && [...form.elements].some(el=>el.name && String(el.value||'').trim());
  if(giftStep==='people' && step!=='people' && form && (hasInput || !readGiftDraft().recipients.length)){
    pendingGiftStep=step;if(!form.reportValidity()){pendingGiftStep='';toast('Complete the recipient details before continuing.','error');return;}form.requestSubmit();
  }else goGiftStep(step);
}
function goGiftStep(step) {
  const draft = readGiftDraft();
  if (step !== 'people' && giftDraftError(draft, false)) return toast('Add and save a recipient first.', 'error');
  if(step==='wrap' && giftDraftError(draft)){
    const missing=draft.recipients.find(person=>!draft.items.some(item=>item.recipientId===person.id));
    if(missing){giftPerson=missing.id;giftStep='bottles';renderPanel();dialog.scrollTop=0;}
    return toast(giftDraftError(draft),'error');
  }
  captureRecipientForm();editingId = ''; giftStep = step; activePanel = 'gift'; renderPanel(); dialog.scrollTop = 0; $('#panel-title')?.focus({ preventScroll: true });
}
function addForGift(id) {
  const draft = readGiftDraft();
  const person = draft.recipients.find(p => p.id === giftPerson) || draft.recipients[0];
  const product = getProduct(id);
  if (!person) { pendingGiftProduct = id; giftStep = 'people'; setPurpose('gift'); visit('gifts'); return; }
  if (!product || getAvailability(product, catalogLocationForState(person.state)) === 'unavailable') return toast('This bottle is unavailable in their delivery state.');
  const quantity = draft.items.find(i => i.recipientId === person.id && i.productId === id)?.quantity || 0;
  if (quantity >= 99) return toast('The maximum is 99 of each bottle per recipient.');
  try { setGiftQuantity(person.id, id, quantity + 1); scene?.setShoppingBasket(basketLines()); renderPanel(); toast(`Added for ${person.firstName}.`); }
  catch { toast('Your gift could not be saved. Check that browser storage is enabled.'); }
}
function trySaveGift(draft) {
  try { writeGiftDraft(draft); return true; }
  catch { toast('Your gift could not be saved. Check that browser storage is enabled.'); return false; }
}

let orderSession=null, orderAnimation=0,leaving=false;
const checkoutMemory={};
function basketLines(){
  const raw=shoppingFor==='gift'?readGiftDraft().items.map(i=>({id:i.productId,quantity:i.quantity})):readCart();
  return raw.map(i=>({...getProduct(i.id),quantity:i.quantity})).filter(p=>p.id);
}
function startCounter(mode){
  const draft=readGiftDraft();
  if(mode==='checkout'){const form=$('#counter-delivery');if(!form?.reportValidity())return;Object.assign(checkoutMemory,Object.fromEntries(new FormData(form)));const unavailable=readCart().some(i=>getAvailability(getProduct(i.id),catalogLocationForState(checkoutMemory.state))==='unavailable');if(unavailable){toast('One of your bottles is unavailable in this delivery state. Update your selection.','error');return;}}
  if(mode==='gift'){
    const error=giftDraftError(draft) || (unavailableGiftLines(draft,PRODUCTS).length?'Review unavailable bottles first.':'');
    if(error){toast(error,'error');return;}
  }
  try{
    const order=createOrder({mode,person:checkoutMemory,lines:readCart().map(i=>({...getProduct(i.id),quantity:i.quantity})),
      recipients:draft.recipients.map(person=>({person, message:person.message||draft.message,lines:draft.items.filter(i=>i.recipientId===person.id).map(i=>({...getProduct(i.productId),quantity:i.quantity}))})),
      total:mode==='gift'?giftCost(draft,PRODUCTS).total:getCartTotal(readCart())+(['Lagos','FCT','Abuja','Oyo','Rivers'].includes(checkoutMemory.state)?2500:4500),wrap:draft.wrap});
    orderSession={order,elapsed:0,paid:false,started:false,last:0,printed:false};
    closePanel();document.body.classList.add('at-counter','entered');$('#welcome').inert=true;
    $('#counter-session').hidden=false;
    $('#counter-host-name').textContent=mode==='gift'?'Nneka · Gift specialist':'Daniel · Checkout host';
    $('#counter-status').textContent='Bringing your basket to the counter…';
    $('#counter-actions').replaceChildren();$('#counter-tags').replaceChildren();$('#counter-cancel').hidden=false;
    if(scene)scene.visit(mode==='gift'?'gifts':'checkout');else beginCounter();
  }catch(error){toast(error.message,'error');}
}
function beginCounter(){
  if(!orderSession || orderSession.started)return;
  orderSession.started=true;scene?.pause(true);scene?.beginOrder(orderSession.order);
  $('#counter-fallback').hidden=Boolean(scene);
  if(!scene)$('#counter-fallback').innerHTML='<div class="fallback-wall"><small>Simplified counter · 3D unavailable on this device</small><img src="/assets/brand/yodla-wordmark.svg" alt="Yodla"></div><div class="fallback-worktop"><div class="fallback-basket"><span>Your basket</span><div id="fallback-drinks"></div></div><div id="fallback-transfer"></div><div class="fallback-parcels" id="fallback-parcels"></div></div>';
  const order=orderSession.order;
  $('#counter-tags').innerHTML=order.mode==='gift'?order.parcels.map((p,i)=>`<details class="gift-tag-details"><summary>Gift tag · ${esc(p.person.name||p.person.firstName)}</summary><div data-user-content><strong>For ${esc(p.person.name||p.person.firstName)}</strong><p class="gift-message">${esc(p.message||'A little something for you.')}</p><small>Delivery label</small><p>${esc(p.person.address)}, ${esc(p.person.state)}</p>${p.lines.map(l=>`<p>${esc(l.name)} × ${l.quantity}</p>`).join('')}</div></details>`).join(''):'';
  orderAnimation=requestAnimationFrame(tickOrder);
}
function tickOrder(now){
  if(!orderSession)return;
  const session=orderSession;
  if(!document.hidden && session.last)session.elapsed+=Math.max(0,(now-session.last)/1000);
  session.last=now;
  const frame=orderFrame(session.order,session.elapsed,{reduced,paid:session.paid,paidElapsed:session.paid?session.elapsed-session.paidAt:0});
  session.stage=frame.stage;scene?.updateOrder(frame);
  const unit=frame.active,recipient=unit?session.order.parcels[unit.parcelIndex].person:null;
  const status=frame.stage==='placing'?'Your basket is on the counter.':frame.stage==='packing'?`${session.order.mode==='gift'?'Nneka':'Daniel'} is packing ${unit.product.name}${recipient?.name?' for '+recipient.name:''}. ${frame.packed+1} of ${session.order.units.length} drinks.`:frame.stage==='receipt'?'Demo payment complete. Your sample receipt is printing.':frame.stage==='handover'?`${session.order.mode==='gift'?'Nneka':'Daniel'} is handing you ${session.order.mode==='gift'?'the gift for '+session.order.parcels[frame.handoverIndex].person.name:'your bag'}.`:frame.stage==='complete'?'All yours. Would you like to shop more or leave?':'Everything is packed. The POS is ready.';
  if($('#counter-status').textContent!==status)$('#counter-status').textContent=status;
  if(!scene)renderCounterFallback(session.order,frame);
  if(frame.stage==='payment' && !$('#counter-pay')){
    $('#counter-actions').innerHTML=`<button class="primary" id="counter-pay">Pay at the POS · ${money(session.order.total)}</button><small>Concept payment · no charge</small>`;
    $('#counter-pay').addEventListener('click',openPayment);
  }
  if(session.paid && !session.printed){
    session.printed=true;$('#counter-actions').innerHTML=`<details class="counter-receipt"><summary>Your sample receipt</summary><article class="printed-receipt"><img class="brand-logo" src="/assets/brand/yodla-wordmark.svg" alt="Yodla"><strong>SAMPLE RECEIPT</strong><small>Simulated payment · no order placed</small>${session.order.parcels.map(p=>`<div>${session.order.mode==='gift'?`<b>For ${esc(p.person.name)}</b>`:''}${p.lines.map(l=>`<p><span>${esc(l.name)} × ${l.quantity}</span><span>${money(l.price*l.quantity)}</span></p>`).join('')}</div>`).join('')}<p><span>Delivery${session.order.mode==='gift'&&session.order.wrap?' & gift wrap':''}</span><span>${money(session.order.total-session.order.parcels.reduce((sum,p)=>sum+p.lines.reduce((s,l)=>s+l.price*l.quantity,0),0))}</span></p><p><b>Total</b><b>${money(session.order.total)}</b></p><small>Prepared by ${session.order.mode==='gift'?'Nneka':'Daniel'} · Thank you</small></article></details>`;
    $('#counter-cancel').hidden=true;
  }
  if(frame.stage==='complete'&&!$('#counter-shop-more')){
    const choices=document.createElement('div');choices.className='counter-decision';choices.innerHTML='<button class="primary" id="counter-shop-more">Shop more</button><button class="secondary" id="counter-leave">Leave store</button>';
    $('#counter-actions').append(choices);$('#counter-shop-more').addEventListener('click',()=>finishVisit(false));$('#counter-leave').addEventListener('click',()=>finishVisit(true));
  }
  if(frame.stage!=='complete')orderAnimation=requestAnimationFrame(tickOrder);
}
function renderCounterFallback(order,frame){
  // Accessible room replacement on devices that cannot create a WebGL context.
  const image=unit=>`<img src="${safeImage(unit.product.image)}" alt="${esc(unit.product.name)}">`;
  const key=`${frame.stage}:${frame.packed}`;
  if($('#counter-fallback').dataset.frame!==key){
    $('#counter-fallback').dataset.frame=key;
    $('#fallback-drinks').innerHTML=order.units.slice(frame.packed+(frame.stage==='packing'?1:0)).map(image).join('');
    $('#fallback-transfer').innerHTML=frame.stage==='packing'&&frame.active?image(frame.active):'';
    $('#fallback-parcels').innerHTML=order.parcels.map((p,index)=>`<div class="fallback-parcel ${order.mode==='gift'?'is-box':'is-bag'}"><span>${order.mode==='gift'?'For '+esc(p.person.name):'Yodla'}</span><div>${order.units.slice(0,frame.packed).filter(u=>u.parcelIndex===index).map(image).join('')}</div></div>`).join('');
  }
  $('#fallback-transfer').style.setProperty('--transfer',frame.unitProgress);
  document.querySelectorAll('.fallback-parcel').forEach((el,i)=>{
    const received=frame.stage==='complete'||frame.stage==='handover'&&i<frame.handoverIndex;
    el.classList.toggle('is-received',received);
    el.classList.toggle('is-handing-over',frame.stage==='handover'&&i===frame.handoverIndex);
  });
}
function openPayment(){
  if(!orderSession || orderSession.paid)return;
  $('#payment-total').textContent=money(orderSession.order.total);$('#payment-status').textContent='';$('#payment-dialog').showModal();
}
function endCounter(){
  cancelAnimationFrame(orderAnimation);orderSession=null;scene?.endOrder();scene?.pause(false);scene?.setShoppingBasket(basketLines());
  $('#counter-session').hidden=true;$('#counter-fallback').dataset.frame='';document.body.classList.remove('at-counter');$('#payment-dialog').close();
}
function finishVisit(exit){
  if(orderSession?.stage!=='complete')return;
  const order=orderSession.order;
  if(order.mode==='checkout'){
    let remaining=readCart();for(const line of order.parcels[0].lines){const quantity=remaining.find(i=>i.id===line.id)?.quantity||0;remaining=setCartQuantity(remaining,line.id,Math.max(0,quantity-line.quantity));}writeCart(remaining);
  }else{
    const draft=readGiftDraft();for(const parcel of order.parcels)for(const line of parcel.lines){const item=draft.items.find(i=>i.recipientId===parcel.person.id&&i.productId===line.id);if(item)item.quantity=Math.max(0,item.quantity-line.quantity);}draft.items=draft.items.filter(i=>i.quantity>0);writeGiftDraft(draft);giftStep='bottles';
  }
  endCounter();updateBasket();if(exit)leaveStore();else openPanel('catalogue');
}
function leaveStore(){
  if(orderSession)return;
  if(dialog.open)closePanel();$('#travel-status').textContent='Heading to the glass door…';leaving=true;document.body.classList.add('leaving-store');
  if(scene)scene.leave();else{doorBell.ring().catch(()=>{});showGoodbye();}
}
function showGoodbye(){
  for(const child of $('#boutique').children)if(child!==$('#store-goodbye'))child.inert=true;
  leaving=false;document.body.classList.remove('leaving-store');document.body.classList.add('outside-store');$('#store-goodbye').hidden=false;$('#goodbye-title').focus({preventScroll:true});scene?.pause(true);music.suspend();
}
$('#reenter-store').addEventListener('click',()=>{for(const child of $('#boutique').children)child.inert=child.id==='welcome';$('#store-goodbye').hidden=true;document.body.classList.remove('outside-store');scene?.pause(false);enter();if(!scene)document.querySelector('.basket-button')?.focus();music.resume().catch(()=>{});},events);
document.addEventListener('visibilitychange',()=>{if(orderSession)orderSession.last=0;},events);
$('#counter-cancel').addEventListener('click',endCounter,events);
$('#simulate-payment').addEventListener('click',()=>{if(!orderSession||orderSession.paid)return;orderSession.paid=true;orderSession.paidAt=orderSession.elapsed;$('#payment-dialog').close();$('#counter-cancel').hidden=true;$('#counter-actions').replaceChildren();$('#counter-status').textContent='Demo payment complete. Your sample receipt is printing.';},events);
$('#decline-payment').addEventListener('click',()=>{$('#payment-status').textContent='Payment declined. Your packed items are still here. Try the simulation again or close payment.';},events);

// Delegate controls so every shelf and panel uses the same basket and gift draft.
document.addEventListener('click', event => {
  const button = event.target.closest('button,a'); if (!button) return;
  const data = button.dataset;
  if(button.classList.contains('wordmark')){event.preventDefault();visit('entrance');return;}
  if (button.hasAttribute('data-dismiss-notice')) { button.parentElement.hidden=true; return; }
  if(button.hasAttribute('data-save-and-continue')){continueGift('bottles');return;}
  if(button.id==='panel-back' || button.hasAttribute('data-panel-back')){
    if(activePanel==='product'){activePanel='catalogue';renderPanel();}
    else if(activePanel==='gift' && giftStep!=='people')goGiftStep(giftStep==='wrap'?'bottles':'people');
    else closePanel();return;
  }
  if(button.id==='show-all-bottles'){shelfSection='';filterCategory='All';renderPanel();return;}
  if(button.id==='add-another-person'){recipientFormOpen=true;renderPanel();$('#person-firstName')?.focus();return;}
  if(button.id==='cancel-remove'){pendingRemoval=null;renderPanel();return;}
  if(button.id==='confirm-remove'){
    try{removeGiftRecipient(pendingRemoval);pendingRemoval=null;editingId='';renderPanel();toast('Recipient removed.');}catch{toast('That change could not be saved.','error');}return;
  }
  if(data.counterStart){event.preventDefault();startCounter(data.counterStart);return;}
  if (data.visit) { visit(data.visit); return; }
  if (data.open) { if (data.open === 'catalogue' && activePanel!=='product') { filterQuery = ''; filterCategory = 'All'; shelfSection=''; } openPanel(data.open); return; }
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
  if (data.giftStep) { if(data.giftStep!==giftStep)continueGift(data.giftStep); return; }
  if (data.cartQty) { cart = writeCart(setCartQuantity(readCart(), data.cartQty, (readCart().find(i => i.id === data.cartQty)?.quantity || 0) + Number(data.delta))); renderPanel(); return; }
  if (data.giftQty) {
    const draft = readGiftDraft(); const line = draft.items.find(i => i.recipientId === giftPerson && i.productId === data.giftQty);
    try { setGiftQuantity(giftPerson, data.giftQty, Math.max(0, (line?.quantity || 0) + Number(data.delta))); renderPanel(); }
    catch { toast('That quantity could not be saved.'); } return;
  }
  if (data.editPerson) { captureRecipientForm();editingId = data.editPerson; giftStep = 'people'; renderPanel(); $('#recipient-form')?.scrollIntoView({ block: 'start' }); $('#recipient-form input')?.focus(); return; }
  if(data.removePerson){pendingRemoval=data.removePerson;renderPanel();panel.querySelector('.remove-confirm')?.scrollIntoView({block:'nearest'});return;}
  if(button.id==='cancel-edit'){formMemory.delete(editingId||'new');suppressFormCapture=true;editingId='';recipientFormOpen=false;renderPanel();return;}
  if (button.id === 'browse-store') { setPurpose('gift'); if(innerWidth<=760 || document.body.classList.contains('fallback-mode')){shelfSection='';filterQuery='';filterCategory='All';openPanel('catalogue');}else{closePanel();toast('Choose a bottle from a shelf. Your gift is saved.');} }
  if (button.id === 'gift-checkout') {
    const draft = readGiftDraft(); const error = giftDraftError(draft);
    if (error || unavailableGiftLines(draft, PRODUCTS).length) { event.preventDefault(); toast(error || 'Review unavailable bottles before checkout.'); }
  }
}, events);
document.addEventListener('submit',event=>{if(event.target.id==='counter-delivery'){event.preventDefault();startCounter('checkout');}},events);
document.addEventListener('input',event=>{if(event.target.closest('#counter-delivery'))Object.assign(checkoutMemory,Object.fromEntries(new FormData($('#counter-delivery'))));},events);
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
  if(event.target.closest('#recipient-form'))captureRecipientForm();
  if(event.target.id==='gift-search'){giftQuery=event.target.value;panel.querySelectorAll('.gift-product-list [data-search]').forEach(row=>{row.hidden=!row.dataset.search.includes(giftQuery.toLowerCase());});const empty=$('#gift-search-empty');if(empty)empty.hidden=Boolean(panel.querySelector('.gift-product-list [data-search]:not([hidden])'));}
  if (event.target.id === 'bottle-search') { filterQuery = event.target.value; $('#bottle-list').innerHTML = bottleRows(); $('#catalogue-status').textContent = `${$('#bottle-list').querySelectorAll('button').length} bottles`; }
}, events);
document.addEventListener('submit', event => {
  if (event.target.id !== 'recipient-form') return;
  event.preventDefault();
  try {
    const result = addGiftRecipient({ ...Object.fromEntries(new FormData(event.target)), id: editingId || undefined });
    if (!result.ok) { $('#recipient-status').textContent = result.error; pendingGiftStep=''; toast(result.error,'error'); return; }
    formMemory.delete(editingId||'new');suppressFormCapture=true;recipientFormOpen=false;
    giftPerson = editingId || result.draft.recipients.at(-1).id; editingId = '';
    if (pendingGiftProduct) { const id = pendingGiftProduct; pendingGiftProduct = ''; addForGift(id); }
    renderPanel(); toast('Recipient saved.');
    if(pendingGiftStep){const next=pendingGiftStep;pendingGiftStep='';goGiftStep(next);}
  } catch { pendingGiftStep=''; const message='Your gift could not be saved. Check that browser storage is enabled.'; if($('#recipient-status'))$('#recipient-status').textContent=message;toast(message,'error'); }
}, events);
$('#enter-store').addEventListener('click', enter, events);
$('#help-button').addEventListener('click', () => openPanel('help'), events);
function setMotion() {
  document.body.classList.toggle('reduced-motion', reduced);
  $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
  $('#motion-toggle').innerHTML=icon('motion')+`<span>${reduced?'Motion reduced':'Reduce motion'}</span>`; scene?.setReducedMotion(reduced);
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
  $('#enter-store').innerHTML='Browse bottles '+icon('arrow'); $('#enter-store').onclick = () => openPanel('catalogue');
  $('#movement-hint').textContent = 'Use the navigation to browse and prepare your gift.';
}
async function boot() {
  updateBasket(); setMotion();
  if (matchMedia('(pointer: coarse)').matches || innerWidth <= 760) $('#movement-hint').textContent = 'Tap a section below to explore';
  const catalogueReady=loadPublishedContent((url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) }));
  await catalogueReady;
  if(content.meta.stale)$('#catalogue-note').textContent='Showing the bundled collection. Prices and stock are confirmed at checkout.';
  try {
    const { createBoutique } = await import('./boutique-scene.js');
    scene = createBoutique({ container: $('#scene'), products: PRODUCTS, reduceMotion: reduced,onDoorBell:()=>doorBell.ring().catch(()=>{}),
      onSelect: id => { document.body.classList.add('entered'); $('#welcome').inert = true; openPanel('product', id); },
      onStation: arrive,
      onMove: () => { document.body.classList.add('entered'); $('#welcome').inert=true; },
      onHover: label => { $('#scene-label').hidden = !label; $('#scene-label').textContent = label; },
      onTravel: moving=>{if(!moving)$('#travel-status').textContent='';},
      onPosition: (x,z) => { $('#map-you').style.left = `${(x + 7) / 14 * 100}%`; $('#map-you').style.top = `${(z + 10) / 20 * 100}%`; },
    });
    $('#loading').hidden = true;
  } catch { fallback(); }
  scene?.setShoppingBasket(basketLines());
  $('#scene').addEventListener('boutique-render-error', ()=>{fallback();if(orderSession){$('#counter-fallback').hidden=false;orderSession.started=false;beginCounter();}}, events);
  $('#scene').addEventListener('boutique-pos',openPayment,events);$('#scene').addEventListener('boutique-exit',leaveStore,events);
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
window.addEventListener('pagehide', () => { clearTimeout(toastTimer); cancelAnimationFrame(orderAnimation); music.dispose();doorBell.dispose();scene?.dispose(); abort.abort(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
const doorBell=createDoorBell();
const music=createAmbientMusic({onChange:active=>{
  $('#music-toggle').setAttribute('aria-pressed',String(active));$('#music-toggle').innerHTML=icon(active?'music':'mute')+`<span>Music ${active?'on':'off'}</span>`;
}});
$('#music-toggle').addEventListener('click',async()=>{try{await music.toggle();}catch{toast('Background music is unavailable in this browser.','error');}},events);
$('#music-volume').addEventListener('input',event=>music.setVolume(event.target.value),events);
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.suspend();else music.resume().catch(()=>{});},events);
$('#help-button').innerHTML=icon('help');$('#panel-back').innerHTML=icon('back')+'<span>Back</span>';$('#music-toggle').innerHTML=icon('mute')+'<span>Music off</span>';
enhanceUIIcons(document);
boot().catch(fallback);
