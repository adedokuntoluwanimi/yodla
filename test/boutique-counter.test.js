import test from 'node:test';
import assert from 'node:assert/strict';
import { counterMarkup, counterSignature, wrapText, CASHIERS } from '../vercel-site/boutique/boutique-counter.js';
import { createAmbientMusic, createDoorBell } from '../vercel-site/boutique/boutique-music.js';

test('counter scene uses the selected bottles, recipient, message and delivery label safely',()=>{
  globalThis.location={origin:'https://preview.example'};
  const person={name:'Ada <Example>',address:'12 Example Street',state:'Lagos'};
  const html=counterMarkup({mode:'gift',person,lines:[{id:'bottle',name:'Actual bottle',image:'/assets/products/bottega-gold.png',quantity:2,price:38500}],message:'Happy birthday <script>alert(1)</script>',wrap:true});
  assert.match(html,/Nneka/);assert.match(html,/Ada &lt;Example&gt;/);assert.match(html,/12 Example Street/);assert.match(html,/Happy birthday &lt;script&gt;/);
  assert.match(html,/bottega-gold.png/);assert.match(html,/2 bottles/);assert.doesNotMatch(html,/<script>alert/);
  const checkout=counterMarkup({mode:'checkout',lines:[{name:'Actual bottle',id:'one',image:'/bottle.png',quantity:1}],total:38500});
  assert.match(checkout,/Daniel/);assert.match(checkout,/Actual bottle/);assert.match(checkout,/1 bottle/);
  assert.equal(CASHIERS.gift.role,'Gift specialist');delete globalThis.location;
});
test('preparation is invalidated when its recipient details or selections change',()=>{
  const original={mode:'gift',person:{name:'Ada',address:'One street'},lines:[{id:'one',quantity:1,price:50}],message:'Happy birthday',wrap:true};
  const signature=counterSignature(original);
  assert.notEqual(signature,counterSignature({...original,person:{...original.person,address:'Two street'}}));
  assert.notEqual(signature,counterSignature({...original,lines:[{id:'one',quantity:2,price:50}]}));
  assert.notEqual(signature,counterSignature({...original,message:'Thank you'}));
  assert.notEqual(signature,counterSignature({...original,wrap:false}));
});
test('long names and messages fit the limited label area',()=>{
  const lines=wrapText('Verylongrecipientnamewithoutanyspaces followed by a long message',18,3);
  assert.ok(lines.length<=3);assert.ok(lines.every(line=>line.length<=18));
});
test('background music creates no audio until explicitly enabled and disposes its timers',async()=>{
  let created=0,closed=0;const changes=[];
  const parameter={value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}};
  const node=()=>({gain:{...parameter},frequency:{...parameter},detune:{...parameter},connect(){},disconnect(){},start(){},stop(){this.onended?.();}});
  class AudioMock{constructor(){created++;this.currentTime=0;this.state='suspended';this.destination={};}createGain(){return node();}createOscillator(){return node();}createBiquadFilter(){return node();}async resume(){this.state='running';}async suspend(){this.state='suspended';}close(){closed++;}}
  globalThis.window={AudioContext:AudioMock};
  const music=createAmbientMusic({onChange:value=>changes.push(value)});
  assert.equal(created,0);assert.equal(await music.toggle(),true);assert.equal(created,1);
  music.setVolume(.8);assert.equal(await music.toggle(),false);music.dispose();
  assert.equal(closed,1);assert.deepEqual(changes,[true,false]);delete globalThis.window;
});

test('entrance bell starts only on entry, debounces and releases its audio context',async()=>{
 let contexts=0,tones=0,closed=0;
 const param={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 class AudioMock{constructor(){contexts++;this.currentTime=0;this.destination={};}async resume(){}createOscillator(){tones++;return {frequency:{...param},connect(){},disconnect(){},start(){},stop(){this.onended?.();}};}createGain(){return {gain:{...param},connect(){},disconnect(){}};}close(){closed++;}}
 globalThis.window={AudioContext:AudioMock};
 const bell=createDoorBell();assert.equal(contexts,0);assert.equal(await bell.unlock(),true);assert.equal(tones,0);assert.equal(await bell.ring(),true);assert.equal(tones,4);assert.equal(await bell.ring(),false);bell.dispose();assert.equal(closed,1);delete globalThis.window;
});
