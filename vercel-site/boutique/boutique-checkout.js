import { icon } from './boutique-icons.js';
import { PRODUCTS } from './catalog.js';
import { readCart, getCartTotal } from './cart-store.js';
import { readGiftDraft } from './gifting.js';
import { counterMarkup, mountCounter } from './boutique-counter.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const form=document.querySelector('[data-checkout-form]');
if(form){
  const widget=document.createElement('div');widget.className='checkout-counter-widget';form.before(widget);
  let controller,timer,recipientId='';
  const render=()=>{
    controller?.dispose();
    const gift=new URLSearchParams(location.search).has('gift'),draft=readGiftDraft();
    const values=Object.fromEntries(new FormData(form));
    const person=gift?(draft.recipients.find(p=>p.id===recipientId)||draft.recipients[0]||{}):{name:[values.firstName,values.lastName].filter(Boolean).join(' '),address:values.address,state:values.city};
    const raw=gift?draft.items.filter(i=>i.recipientId===person.id).map(i=>({id:i.productId,quantity:i.quantity})):readCart();
    const lines=raw.map(i=>({...PRODUCTS.find(p=>p.id===i.id),quantity:i.quantity})).filter(i=>i.id);
    const wasOpen=widget.querySelector('details')?.open||false;
    const selection=gift && draft.recipients.length>1?`<label for="checkout-gift-person">Preview recipient<select id="checkout-gift-person">${draft.recipients.map(p=>`<option value="${esc(p.id)}" ${p.id===person.id?'selected':''}>${esc(p.name || [p.firstName,p.lastName].filter(Boolean).join(' '))}</option>`).join('')}</select></label>`:'';
    widget.innerHTML=`<details class="checkout-preparation" ${wasOpen?'open':''}><summary><span>${gift?'Gift presentation with Nneka':'Packing with Daniel'}</span><strong>View preparation</strong></summary>${selection}`+counterMarkup({mode:gift?'gift':'checkout',person,lines,message:gift?person.message||draft.message:'',wrap:gift&&draft.wrap,total:gift?lines.reduce((s,l)=>s+l.price*l.quantity,0):getCartTotal(readCart())})+'</details>';
    controller=mountCounter(widget.querySelector('.counter-experience'),{reduced:matchMedia('(prefers-reduced-motion:reduce)').matches});
  };
  const help=document.createElement('div');help.className='checkout-inline-help';help.innerHTML=`<span>Need help with your order?</span><button type="button" data-open="concierge">${icon('help')} Ask Yodla</button>`;form.after(help);
  widget.addEventListener('change',event=>{if(event.target.id==='checkout-gift-person'){recipientId=event.target.value;render();}});
  render();form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,350);});form.addEventListener('change',render);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.dispose();},{once:true});
}
