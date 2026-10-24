import { getAvailability } from './catalog.js';
import { catalogLocationForState } from './states.js';

// All coordinates are metres. Keep the camera capsule out of furniture.
export const ROOM = { minX: -6.1, maxX: 6.1, minZ: -8.9, maxZ: 9.1 };
export const OBSTACLES = [
  { minX: -1.35, maxX: 1.35, minZ: -4.1, maxZ: 0.1 },
  { minX: -5.5, maxX: -2.4, minZ: 4.1, maxZ: 5.6 },
  { minX: 1.9, maxX: 5.6, minZ: -8.8, maxZ: -7.1 },
];
export const STATIONS = {
  door: { label: 'Glass entrance', position: [0, 1.7, 8.35], look: [0, 1.7, 10.5] },
  entrance: { label: 'Entrance', position: [0, 1.7, 7.6], look: [0, 1.7, -6] },
  wines: { label: 'The wine wall', position: [-3.9, 1.7, -2], look: [-6.5, 1.8, -3] },
  spirits: { label: 'Spirits & sparkle', position: [3.9, 1.7, 1], look: [6.5, 1.8, -1] },
  gifts: { label: 'Gift Atelier', position: [3.6, 1.7, -5.8], look: [3.6, 1.4, -8.3] },
  checkout: { label: 'Checkout counter', position: [-3.9, 1.7, 2.6], look: [-3.9, 1.2, 4.9] },
};

export function canStand(x, z, radius = .28) {
  if (![x,z,radius].every(Number.isFinite) || radius < 0) return false;
  if (x < ROOM.minX + radius || x > ROOM.maxX - radius || z < ROOM.minZ + radius || z > ROOM.maxZ - radius) return false;
  return !OBSTACLES.some(b => x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius);
}

export function moveWithCollision(position, dx, dz) {
  // Substeps prevent tunnelling if a tab resumes after a long frame.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .1));
  let { x, z } = position;
  for (let i = 0; i < steps; i++) {
    if (canStand(x + dx / steps, z)) x += dx / steps;
    if (canStand(x, z + dz / steps)) z += dz / steps;
  }
  return { x, z };
}

/** Find a furniture-safe route for tap navigation and map shortcuts. */
export function routeToStation(start, end) {
  if (!start || !end || !canStand(start.x,start.z) || !canStand(end.x,end.z)) return [];
  const clear = (a, b) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x, b.z-a.z) / .08));
    for (let i=0; i<=steps; i++) if (!canStand(a.x+(b.x-a.x)*i/steps, a.z+(b.z-a.z)*i/steps)) return false;
    return true;
  };
  if (clear(start,end)) return [end];
  const size=.4, nodes=[];
  for (let x=-5.6; x<=5.6; x+=size) for (let z=-8.4; z<=8.8; z+=size) {
    if (canStand(x,z)) nodes.push({x,z,score:Infinity,cost:Infinity,parent:null});
  }
  const nearest = point => nodes.filter(n => clear(point,n)).sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
  const first=nearest(start), last=nearest(end);
  if (!first || !last) return [];
  first.cost=0; first.score=Math.hypot(first.x-last.x,first.z-last.z);
  const open=[first], closed=new Set();
  while (open.length) {
    open.sort((a,b)=>a.score-b.score); const node=open.shift();
    if (node===last) {
      const path=[end]; let cursor=node;
      while (cursor) { path.unshift({x:cursor.x,z:cursor.z}); cursor=cursor.parent; }
      // Smooth only when the entire segment clears the same collision geometry.
      const result=[]; let from=start, index=0;
      while(index<path.length) {
        let next=index;
        for(let i=path.length-1;i>=index;i--) if(clear(from,path[i])) {next=i;break;}
        result.push(path[next]);from=path[next];index=next+1;
      }
      return result;
    }
    closed.add(node);
    for (const next of nodes) {
      if (closed.has(next) || Math.abs(next.x-node.x)>size+.01 || Math.abs(next.z-node.z)>size+.01 || !clear(node,next)) continue;
      const cost=node.cost+Math.hypot(next.x-node.x,next.z-node.z);
      if(cost>=next.cost) continue;
      next.parent=node;next.cost=cost;next.score=cost+Math.hypot(next.x-last.x,next.z-last.z);
      if(!open.includes(next))open.push(next);
    }
  }
  return [];
}

export function unavailableGiftLines(draft, products) {
  return draft.items.filter(item => {
    const product = products.find(p => p.id === item.productId);
    const person = draft.recipients.find(p => p.id === item.recipientId);
    return !product || !person || !Number.isFinite(product.price) || product.price <= 0
      || getAvailability(product, catalogLocationForState(person.state)) === 'unavailable';
  });
}

export function giftCost(draft, products) {
  const subtotal = draft.items.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0);
  const delivery = draft.recipients.reduce((sum, p) => sum + (['Lagos', 'FCT', 'Abuja', 'Oyo', 'Rivers'].includes(p.state) ? 2500 : 4500), 0);
  const wrapping = draft.wrap ? 1500 : 0;
  return { subtotal, delivery, wrapping, total: subtotal + delivery + wrapping };
}
