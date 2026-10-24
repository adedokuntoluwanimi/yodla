import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrder,orderFrame,parcelComplete} from '../vercel-site/boutique/boutique-order.js';
const wine={id:'wine-a',name:'Wine A',price:4000,image:'/wine-a.webp',quantity:2};
const spirit={id:'spirit-b',name:'Spirit B',price:6000,image:'/spirit-b.webp',quantity:1};
test('handover preserves each exact product, quantity and recipient in sequence',()=>{
 const order=createOrder({mode:'gift',recipients:[{person:{name:'Ada'},lines:[wine]},{person:{name:'Tolu'},lines:[spirit]}]});
 assert.deepEqual(order.units.map(u=>[u.product.id,u.parcelIndex]),[['wine-a',0],['wine-a',0],['spirit-b',1]]);
 assert.equal(new Set(order.units.map(u=>u.key)).size,3);
 wine.quantity=5;assert.equal(order.units.length,3);wine.quantity=2;
 assert.equal(orderFrame(order,0).stage,'placing');
 assert.equal(orderFrame(order,1.7).active.product.id,'wine-a');
 const next=orderFrame(order,5.3);assert.equal(next.active.product.id,'spirit-b');assert.equal(parcelComplete(order,next,0),true);assert.equal(parcelComplete(order,next,1),false);
 assert.equal(orderFrame(order,8).stage,'payment');assert.equal(orderFrame(order,8).paid,false);
 assert.equal(orderFrame(order,8,{paid:true}).stage,'receipt');
});
test('checkout includes quantities without using gift selections',()=>{
 const order=createOrder({mode:'checkout',lines:[wine,spirit],person:{name:'Buyer'},total:16500});
 assert.equal(order.units.length,3);assert.equal(order.parcels.length,1);assert.equal(order.total,16500);
 assert.equal(orderFrame(order,.5,{reduced:true}).stage,'payment');
 assert.equal(orderFrame(order,2,{paid:true}).stage,'packing');
});
test('empty baskets and invalid quantities cannot start packing',()=>{
 assert.throws(()=>createOrder({mode:'checkout',lines:[]}));
 for(const quantity of [0,-1,100,NaN,1.5])assert.throws(()=>createOrder({mode:'checkout',lines:[{...wine,quantity}]}));
});

test('receipt precedes one handover per parcel and the departure decision',()=>{
 const order=createOrder({mode:'gift',recipients:[{person:{name:'Ada'},lines:[wine]},{person:{name:'Tolu'},lines:[spirit]}]});
 assert.equal(orderFrame(order,20,{paid:false,paidElapsed:100}).stage,'payment');
 assert.equal(orderFrame(order,20,{paid:true,paidElapsed:0}).stage,'receipt');
 const first=orderFrame(order,22,{paid:true,paidElapsed:2});assert.equal(first.stage,'handover');assert.equal(first.handoverIndex,0);
 const second=orderFrame(order,25,{paid:true,paidElapsed:5});assert.equal(second.stage,'handover');assert.equal(second.handoverIndex,1);
 assert.equal(orderFrame(order,30,{paid:true,paidElapsed:8}).stage,'complete');
 assert.equal(orderFrame(order,30,{paid:true,paidElapsed:1,reduced:true}).stage,'complete');
});
