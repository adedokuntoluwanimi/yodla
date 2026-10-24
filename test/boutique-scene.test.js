import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as RealThree from 'three';
import {createOrder,orderFrame} from '../vercel-site/boutique/boutique-order.js';
// Exercise real Three geometry, transforms and disposal with only the GPU boundary stubbed.
test('room simulation transfers exact drinks into five parcels, pays, resets and checks out again',async()=>{
 const previous=new Map();const set=(key,value)=>{previous.set(key,globalThis[key]);globalThis[key]=value;};
 let lastScene,frames=[],chimes=0;
 const element=()=>({style:{},addEventListener(){},setAttribute(){},append(){},focus(){},remove(){},getBoundingClientRect(){return {left:0,top:0,width:1200,height:800};}});
 const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),measureText:text=>({width:String(text).length*20})},{get(target,key){return target[key]||(()=>{});},set(target,key,value){target[key]=value;return true;}});
 set('document',{hidden:false,addEventListener(){},createElement:()=>({...element(),getContext:()=>context})});
 set('window',{addEventListener(){}});set('devicePixelRatio',1);set('matchMedia',()=>({matches:false}));
 set('ResizeObserver',class{observe(){}disconnect(){}});set('requestAnimationFrame',fn=>{frames.push(fn);return frames.length;});set('cancelAnimationFrame',()=>{});
 class Renderer{constructor(){this.domElement=element();this.capabilities={getMaxAnisotropy:()=>1};this.shadowMap={};}setPixelRatio(){}setSize(){}render(scene){lastScene=scene;}dispose(){}}
 class PMREM{fromScene(){return {texture:new RealThree.Texture(),dispose(){}};}dispose(){}}
 class Loader{load(){return new RealThree.Texture();}}
 set('__boutiqueThree',{...RealThree,WebGLRenderer:Renderer,PMREMGenerator:PMREM,TextureLoader:Loader});
 try{
  let source=await readFile(new URL('../vercel-site/boutique/boutique-scene.js',import.meta.url),'utf8');
  source=source.replace("import * as THREE from 'three';","const THREE=globalThis.__boutiqueThree;").replace("import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';","class RoomEnvironment extends THREE.Scene{dispose(){}};");
  for(const file of ['boutique-order','boutique-model'])source=source.replace(`'./${file}.js'`,JSON.stringify(new URL(file==='boutique-order'?'../vercel-site/boutique/boutique-order.js':'../js/boutique-model.js',import.meta.url).href));
  const {createBoutique}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const products=[{id:'red',name:'Exact Red',category:'Wine',price:5000},{id:'spirit',name:'Exact Spirit',category:'Spirit',price:7000}];
  const room=createBoutique({container:{...element(),clientWidth:1200,clientHeight:800},products,onDoorBell:()=>chimes++});
  room.setShoppingBasket([{...products[0],quantity:2}]);
  const order=createOrder({mode:'gift',recipients:Array.from({length:5},(_,i)=>({person:{name:'Recipient '+i},message:'Message '+i,lines:[{...products[i%2],quantity:2}]})),wrap:true,total:60000});
  room.enter();assert.equal(chimes,1);room.beginOrder(order);
  for(let elapsed=0;elapsed<37;elapsed+=.15){room.updateOrder(orderFrame(order,elapsed,{paid:elapsed>20,paidElapsed:Math.max(0,elapsed-20)}));frames.shift()?.(1000+elapsed*1000);lastScene.updateMatrixWorld(true);const tag=lastScene.getObjectByName('gift-tag-0');assert.equal(tag.material.toneMapped,false);assert.equal(tag.material.isMeshBasicMaterial,true);lastScene.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite));assert.ok(o.quaternion.toArray().every(Number.isFinite));});}
  assert.equal(lastScene.getObjectByName('customer-hands').visible,true);
  room.endOrder();room.beginOrder(createOrder({mode:'checkout',lines:[{...products[1],quantity:3}]}));room.updateOrder({stage:'payment',packed:3,active:null,basketProgress:1,unitProgress:0,paid:false});room.endOrder();room.leave();assert.equal(chimes,2);assert.ok(lastScene.getObjectByName('glass-entrance'));assert.ok(lastScene.getObjectByName('yodla-cup-emblem'));room.dispose();
 }finally{for(const [key,value]of previous){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
