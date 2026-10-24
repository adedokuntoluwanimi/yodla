import { icon } from './boutique-icons.js';
const form=document.querySelector('[data-checkout-form]');
if(form){
  const help=document.createElement('div');help.className='checkout-inline-help';help.innerHTML=`<span>Need help with your order?</span><button type="button" data-open="concierge">${icon('help')} Ask Yodla</button>`;form.after(help);
}
