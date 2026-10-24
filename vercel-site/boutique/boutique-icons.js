const paths = {
  arrow:'<path d="M6 18 18 6M6 6h12v12"/>',
  back:'<path d="m14 5-7 7 7 7M7 12h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  gift:'<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v4H3zM12 7v13"/><path d="M12 7C3 8 6 0 10 4l2 3Zm0 0c9 1 6-7 2-3l-2 3Z"/>',
  bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  music:'<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l6 6m0-6-6 6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3M12 17h.01"/>',
  motion:'<path d="M4 8h10M2 12h8M4 16h10"/><circle cx="17" cy="12" r="5"/>',
  play:'<path d="m9 5 11 7-11 7V5Z"/>',
  replay:'<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6"/>',
  location:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
};
export function icon(name, className='') {
  return `<svg class="boutique-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.arrow}</svg>`;
}
const symbols = { '↗':'arrow', '→':'arrow', '×':'close', '−':'minus', '●':'check', '✦':'check', '✳':'gift', '♡':'gift', '♥':'gift', '+':'plus' };
/** Replace interface symbols only. User messages and form values are preserved. */
export function enhanceUIIcons(root=document) {
  root.querySelectorAll('button,a,[aria-hidden="true"]').forEach(element=>{
    if(element.closest('svg,[data-user-content]'))return;
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('svg,strong,[data-user-content]'))nodes.push(walker.currentNode);
    for(const node of nodes){
      if(!/[↗→×−●✦✳♡♥+]/u.test(node.textContent))continue;
      const parts=node.textContent.split(/([↗→×−●✦✳♡♥+])/u),fragment=document.createDocumentFragment();
      for(const part of parts){if(symbols[part]){const holder=document.createElement('span');holder.innerHTML=icon(symbols[part]);fragment.append(holder.firstChild);}else fragment.append(document.createTextNode(part));}
      node.replaceWith(fragment);
    }
  });
}
