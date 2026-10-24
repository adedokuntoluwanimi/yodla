import { icon } from './boutique-icons.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imagePath=value=>{try{const url=new URL(value,location.origin);return /^https?:$/.test(url.protocol)?escape(url.href):'';}catch{return '';}};
export const CASHIERS={gift:{name:'Nneka',role:'Gift specialist'},checkout:{name:'Daniel',role:'Checkout host'}};
export function wrapText(value,limit=28,maxLines=3){
  const words=String(value||'').trim().split(/\s+/).flatMap(word=>Array.from(word).length>limit?Array.from({length:Math.ceil(Array.from(word).length/limit)},(_,i)=>Array.from(word).slice(i*limit,(i+1)*limit).join('')):[word]),lines=[''];
  for(const word of words){const i=lines.length-1;if((lines[i]+' '+word).trim().length>limit && lines[i])lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}
  return lines.slice(0,maxLines).map((line,i)=>i===maxLines-1 && lines.length>maxLines?line.slice(0,limit-1)+'…':line);
}
export function counterSignature({mode,person={},lines=[],message='',wrap=false}) {
  return JSON.stringify({mode,person,lines:lines.map(l=>[l.id,l.name,l.quantity,l.price]),message,wrap});
}
export function counterMarkup({mode='gift',person={},lines=[],message='',wrap=false,total=0}) {
  const cashier=CASHIERS[mode],gift=mode==='gift';
  const name=person.name || [person.firstName,person.lastName].filter(Boolean).join(' ') || (gift?'Your recipient':'Your selection');
  const address=[person.address,person.state].filter(Boolean).join(', ');
  const steps=gift?['Place bottles',wrap?'Wrap & tie':'Pack with care','Attach your card','Ready to review']:['Scan bottles','Prepare the bag','Attach receipt','Ready to review'];
  const labelLines=wrapText(name,23,2),noteLines=wrapText(message|| (gift?'Chosen with care, from you.':'Thank you for shopping with Yodla.'),33,3);
  return `<section class="counter-experience" data-counter-mode="${mode}" data-phase="0" aria-label="${gift?'Gift preparation with Nneka':'Checkout preparation with Daniel'}">
    <div class="counter-host"><span class="host-avatar" aria-hidden="true">${icon(gift?'gift':'bag')}</span><div><strong>${cashier.name}</strong><span>${cashier.role}</span></div><span class="host-badge">YODLA</span></div>
    <div class="counter-stage"><svg viewBox="0 0 640 370" role="img" aria-label="${cashier.name} ${gift?'preparing the gift for '+escape(name):'scanning and bagging your selected bottles'}">
      <defs><linearGradient id="${mode}-wall" x2="0" y2="1"><stop stop-color="#dbd0bd"/><stop offset="1" stop-color="#baab91"/></linearGradient><linearGradient id="${mode}-stone" x2="0" y2="1"><stop stop-color="#e7dece"/><stop offset="1" stop-color="#b5a58b"/></linearGradient><linearGradient id="${mode}-box" x2="1" y2=".8"><stop stop-color="#71394b"/><stop offset="1" stop-color="#331823"/></linearGradient><linearGradient id="${mode}-apron" x2="1" y2="1"><stop stop-color="#48212f"/><stop offset="1" stop-color="#21121a"/></linearGradient><filter id="${mode}-shadow"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <rect width="640" height="370" rx="4" fill="url(#${mode}-wall)"/>
      <path d="M0 70H640M35 0V260M605 0V260" stroke="#99886b" stroke-opacity=".35"/>
      <rect x="365" y="23" width="218" height="51" rx="1" fill="#35231f" stroke="#a88b5d"/><image href="/assets/brand/yodla-wordmark-4096-white.png" x="433" y="32" width="81" height="23"/><text x="474" y="66" text-anchor="middle" fill="#c8b18b" font-size="7" letter-spacing="2">${gift?'GIFT ATELIER':'THE CHECKOUT COUNTER'}</text>
      <g class="cashier-body"><path d="M69 138Q99 120 144 139L170 241H49Z" fill="#e5dccb"/><path d="m84 140 15 18 15-18 26 10 11 104H65l8-104Z" fill="url(#${mode}-apron)"/><path d="M88 124v25q13 14 25 0v-25" fill="#82543b"/><ellipse cx="101" cy="95" rx="33" ry="42" fill="#9b6849"/>
      <path d="M69 97Q53 43 99 45Q148 43 136 97L128 78Q95 80 77 68Z" fill="#231b19"/>${gift?'<ellipse cx="75" cy="56" rx="24" ry="18" fill="#231b19"/>':''}<path d="M78 90q8-5 15-1m14 0q8-5 15 1" fill="none" stroke="#34231e" stroke-width="2"/><ellipse cx="87" cy="96" rx="2" ry="2.5" fill="#241b17"/><ellipse cx="116" cy="96" rx="2" ry="2.5" fill="#241b17"/><path d="m102 98-3 12 7 1m-16 10q12 9 25-1" fill="none" stroke="#64382f" stroke-width="1.6"/>
      <rect x="84" y="163" width="52" height="21" rx="2" fill="#e8dbc1" stroke="#bda376"/><text x="110" y="177" text-anchor="middle" font-family="Arial" font-size="10" fill="#3f2522">${cashier.name}</text><image href="/assets/brand/yodla-wordmark-4096-white.png" x="84" y="202" width="42" height="14"/>
      <g class="cashier-arm arm-left"><path d="M69 150Q43 179 63 211L210 245" fill="none" stroke="#ded4c2" stroke-width="23" stroke-linecap="round"/><path d="m160 233 58 14" stroke="#996448" stroke-width="18" stroke-linecap="round"/><ellipse cx="225" cy="250" rx="17" ry="9" fill="#996448"/></g>
      <g class="cashier-arm arm-right"><path d="M140 150Q170 173 164 206L311 236" fill="none" stroke="#ded4c2" stroke-width="23" stroke-linecap="round"/><path d="m258 224 53 12" stroke="#996448" stroke-width="18" stroke-linecap="round"/><ellipse cx="318" cy="239" rx="17" ry="9" fill="#996448"/></g></g>
      <path d="M0 260 640 238V294L0 315Z" fill="url(#${mode}-stone)"/><path d="m0 273 640-24M0 288 640-24" stroke="#9b8c75" stroke-opacity=".3"/><path d="M0 310 640 289V370H0Z" fill="#3b2426"/><path d="M0 317 640 296" stroke="#b3925f" stroke-width="3"/>
      <ellipse cx="390" cy="281" rx="139" ry="14" fill="#4d3828" opacity=".2" filter="url(#${mode}-shadow)"/>
      <g class="counter-bottles">${lines.slice(0,3).map((line,i)=>`<image href="${imagePath(line.image)}" x="${260+i*63}" y="131" width="69" height="136" preserveAspectRatio="xMidYMid meet"/>`).join('')}</g>
      ${gift?`<g class="counter-parcel"><path d="m281 233 151-10 65 24-152 12Z" fill="#6d3949"/><path d="m281 233 64 26v63l-64-29Z" fill="#40202b"/><path d="m345 259 152-12v63l-152 12Z" fill="url(#${mode}-box)"/><g class="parcel-lid"><path d="m276 229 156-11 72 26-159 15Z" fill="#784253"/><path d="m345 259 159-15v12l-159 14-69-29v-12Z" fill="#542532"/></g><g class="parcel-ribbon" ${wrap?'':'style="display:none"'}><path d="m365 224 48 21v72l-20 2v-70l-48-22Z" fill="#c6ab79"/><path d="m385 234q-63-39-48-2 10 18 48 2Zm0 0q49-49 50-15 0 20-50 15Z" fill="none" stroke="#c6ab79" stroke-width="9"/></g><g class="parcel-card"><path d="m428 252 132 12-7 77-132-12Z" fill="#fff9ed" stroke="#b7a17d"/><image href="/assets/brand/yodla-wordmark-4096.png" x="440" y="268" width="42" height="10"/>${labelLines.slice(0,1).map(line=>`<text x="438" y="293" fill="#3c2529" font-family="Georgia" font-size="10">${escape(line)}</text>`).join('')}${noteLines.slice(0,2).map((line,i)=>`<text x="436" y="${308+i*10}" fill="#725d47" font-size="7">${escape(line)}</text>`).join('')}<text x="435" y="333" fill="#725d47" font-size="7">${escape(wrapText(address||'Personal gift',25,1)[0])}</text></g></g>`:`<g class="checkout-scanner"><rect x="247" y="252" width="69" height="21" rx="4" fill="#272522"/><path d="m264 254 36-2" stroke="#f09983" stroke-width="3" class="scanner-light"/></g><g class="checkout-bag"><path d="m353 200 104-11 57 24-111 15Z" fill="#a78c62"/><path d="m353 200 50 28v103l-50-30Z" fill="#a8875b"/><path d="m403 228 111-15v105l-111 13Z" fill="#c7ac7d"/><path d="M421 230v-32q23-41 48-4v32" fill="none" stroke="#705735" stroke-width="4"/><image href="/assets/brand/yodla-wordmark-4096.png" x="423" y="263" width="65" height="20"/></g><g class="parcel-card"><path d="m498 241 97 5-4 97-97-5Z" fill="#fffaf0" stroke="#bdaa88"/><text x="507" y="265" font-size="10" fill="#372b22">YODLA · REVIEW</text>${lines.slice(0,3).map((line,i)=>`<text x="504" y="${280+i*11}" font-size="6.5" fill="#6e5940">${escape((line.name||'Bottle').slice(0,15))} x${line.quantity}</text>`).join('')}<text x="507" y="321" font-size="10" fill="#372b22">${escape(new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(total))}</text></g>`}
    </svg></div>
    <div class="counter-personalisation" data-user-content><div><span>${gift?'PREPARED FOR':'ORDER REVIEW'}</span><strong>${escape(name)}</strong>${address?`<p>${escape(address)}</p>`:''}</div>${message?`<blockquote>${escape(message)}</blockquote>`:''}<small>${lines.reduce((sum,l)=>sum+l.quantity,0)} ${lines.reduce((sum,l)=>sum+l.quantity,0)===1?'bottle':'bottles'}${lines.length>3?' · all selections included':''}</small></div>
    <p class="counter-status" role="status" aria-live="polite">${gift?'Nneka is ready to prepare this gift.':'Daniel is ready to check your selection.'}</p>
    <ol class="counter-steps" aria-label="${gift?'Gift preparation':'Checkout preparation'}">${steps.map((label,i)=>`<li><button type="button" data-counter-step="${i+1}" aria-label="Show stage: ${label}"><span>${i+1}</span>${label}</button></li>`).join('')}</ol>
    <div class="counter-actions"><button type="button" class="secondary" data-counter-start>${icon('play')}${gift?'Watch Nneka prepare it':'Watch Daniel pack it'}</button><button type="button" class="quiet" data-counter-finish>Show finished ${gift?'gift':'bag'}</button></div>
  </section>`;
}
export function mountCounter(element,{reduced=false,onFrame=()=>{},initial=0,onComplete=()=>{}}={}) {
  if(!element)return {dispose(){},finish(){}};
  let frame=0,started=0,running=false,phase=initial;
  const gift=element.dataset.counterMode==='gift';
  const statuses=gift?['Nneka is ready to prepare this gift.','Nneka is placing your selected bottles.','Nneka is preparing the presentation.','Nneka is attaching your personal card and recipient details.','Your gift preview is ready. Review the details below.']:['Daniel is ready to check your selection.','Daniel is scanning the selected bottles.','Daniel is placing your bottles in the bag.','Daniel is attaching your itemised order review.','Your bag preview is ready. Continue to delivery details.'];
  function setPhase(value){
    phase=Math.max(0,Math.min(4,value));element.dataset.phase=String(phase);element.querySelector('.counter-status').textContent=statuses[phase];
    element.querySelectorAll('[data-counter-step]').forEach(button=>{button.setAttribute('aria-current',Number(button.dataset.counterStep)===phase?'step':'false');button.classList.toggle('complete',Number(button.dataset.counterStep)<phase);});
    onFrame(phase/4);if(phase===4)onComplete();
    const start=element.querySelector('[data-counter-start]');start.innerHTML=icon(phase?'replay':'play')+(phase?'Replay preparation':gift?'Watch Nneka prepare it':'Watch Daniel pack it');
  }
  function stop(){cancelAnimationFrame(frame);running=false;element.classList.remove('is-preparing');}
  function finish(){stop();setPhase(4);}
  function tick(time){if(!running)return;const elapsed=time-started;const next=Math.min(4,1+Math.floor(elapsed/1900));if(next!==phase)setPhase(next);if(elapsed>=7600){finish();return;}frame=requestAnimationFrame(tick);}
  function start(){stop();element.scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});if(reduced){finish();return;}running=true;started=performance.now();element.classList.add('is-preparing');setPhase(1);frame=requestAnimationFrame(tick);}
  function click(event){const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-counter-start'))start();if(button.hasAttribute('data-counter-finish'))finish();if(button.dataset.counterStep){stop();setPhase(Number(button.dataset.counterStep));}}
  element.addEventListener('click',click);setPhase(reduced?4:initial);
  return {finish,dispose(){stop();element.removeEventListener('click',click);}};
}
