import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('review deployment allows recipient saves while blocking external submissions', () => {
  let submit;
  vm.runInNewContext(readFileSync('vercel-site/boutique/preview-only.js','utf8'), {
    document:{querySelector:()=>null},
    window:{addEventListener:(type,listener)=>{if(type==='submit')submit=listener;}},
  });
  const dispatch = id => {
    const event={target:{id},defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    submit(event);return event;
  };
  const recipient=dispatch('recipient-form');
  assert.equal(recipient.defaultPrevented,false);
  assert.equal(recipient.stopped,false);
  for(const id of ['checkout-form','newsletter-form','contact-form']){
    const action=dispatch(id);assert.equal(action.defaultPrevented,true);assert.equal(action.stopped,true);
  }
});
