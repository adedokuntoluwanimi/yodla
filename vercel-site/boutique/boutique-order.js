// One immutable unit per selected drink. The room and accessible view share this ledger.
export function createOrder({mode,recipients=[],lines=[],person={},total=0,wrap=false}) {
  const parcels=mode==='gift'?recipients:[{person,lines}];
  const units=parcels.flatMap((parcel,parcelIndex)=>parcel.lines.flatMap(line=>{
    const quantity=Number(line.quantity);
    if(!line.id || !Number.isInteger(quantity) || quantity<1 || quantity>99)throw new Error('Invalid basket quantity');
    return Array.from({length:quantity},(_,index)=>({product:{...line,quantity:1},parcelIndex,key:`${parcelIndex}:${line.id}:${index}`}));
  }));
  if(!units.length)throw new Error('Choose a drink first');
  return {mode,parcels:parcels.map(p=>({person:{...p.person},lines:p.lines.map(l=>({...l})),message:p.message||p.person?.message||''})),units,total,wrap};
}
export function orderFrame(order,elapsed,{reduced=false,paid=false,paidElapsed=0}={}) {
  const placement=reduced?0:1.6,transfer=reduced?.08:1.8;
  const progress=Math.max(0,(elapsed-placement)/transfer);
  const packed=Math.min(order.units.length,Math.floor(progress));
  const active=packed<order.units.length?order.units[packed]:null;
  const printTime=reduced?.15:1.6,handoverTime=reduced?.15:2.6;
  const handoverIndex=Math.min(order.parcels.length-1,Math.max(0,Math.floor((paidElapsed-printTime)/handoverTime)));
  const handoverProgress=Math.max(0,Math.min(1,(paidElapsed-printTime-handoverIndex*handoverTime)/handoverTime));
  const stage=elapsed<placement?'placing':packed<order.units.length?'packing':!paid?'payment':paidElapsed<printTime?'receipt':paidElapsed<printTime+order.parcels.length*handoverTime?'handover':'complete';
  return {stage,packed,active,unitProgress:stage==='packing'?progress-packed:0,basketProgress:Math.min(1,elapsed/Math.max(placement,.001)),paid,handoverIndex,handoverProgress};
}
export function parcelComplete(order,frame,index){
  return order.units.every((unit,i)=>unit.parcelIndex!==index || i<frame.packed);
}
