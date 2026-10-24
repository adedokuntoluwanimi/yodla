import * as THREE from 'three';
import { parcelComplete } from './boutique-order.js';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { moveWithCollision, routeToStation, canStand, STATIONS } from './boutique-model.js';

export function createBoutique({ container, products, onSelect, onStation, onPosition, onHover, onMove, onTravel, reduceMotion = false }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#30251d');
  scene.fog = new THREE.FogExp2('#30251f', .012);
  const camera = new THREE.PerspectiveCamera(58, 1, .08, 65);
  camera.position.set(0, 1.7, 8.6);
  camera.rotation.order = 'YXZ';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 1.8));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Wine boutique. Click the floor to move, drag to look, and click a bottle to choose it. Section buttons also work with Tab and Enter.');
  container.append(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  const environment = pmrem.fromScene(environmentScene, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .58;
  environmentScene.dispose();
  pmrem.dispose();
  let reduced = reduceMotion, paused = false, entered = false, disposed = false;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), interactives = [];
  const textures = [];
  let yaw = 0, pitch = -.025, drag = null, travel = null, last = performance.now(), lastRender=0, frame;

  function mapCanvas(width, height, painter) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    painter(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture); return texture;
  }
  // Deterministic grain avoids loading large decorative textures on mobile.
  let seed = 23;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const oakMap = mapCanvas(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#765038'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      ctx.strokeStyle = `rgba(${random() > .6 ? '185,140,85' : '42,22,12'},${random() * .14})`;
      ctx.lineWidth = random() * 2; ctx.beginPath(); const x = random() * w;
      ctx.moveTo(x, 0); ctx.bezierCurveTo(x + random() * 8, h / 3, x - 12, h * .7, x + 5, h); ctx.stroke();
    }
  });
  oakMap.wrapS = oakMap.wrapT = THREE.RepeatWrapping;
  const marbleMap = mapCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c8bda8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = `rgba(91,77,61,${.025 + random() * .09})`; ctx.lineWidth = random() * 3;
      ctx.beginPath(); const y = random() * h; ctx.moveTo(0, y); ctx.bezierCurveTo(150, y + 80, 290, y - 70, w, y + 130); ctx.stroke();
    }
  });
  const mat = (color, roughness = .6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const walnut = new THREE.MeshStandardMaterial({ color: '#624734', map: oakMap, bumpMap: oakMap, bumpScale:.025, roughness: .42 });
  const floorMat = new THREE.MeshStandardMaterial({ color: '#b89b78', map: oakMap, bumpMap: oakMap, bumpScale:.014, roughness: .43 });
  const plasterMap = mapCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8ab96'; ctx.fillRect(0, 0, w, h);
    for (let i=0; i<18000; i++) {
      ctx.fillStyle = `rgba(${random() > .5 ? '225,215,194' : '72,62,49'},${random()*.055})`;
      ctx.fillRect(random()*w, random()*h, 1+random()*2, 1+random()*2);
    }
  });
  const plaster = new THREE.MeshStandardMaterial({map:plasterMap, bumpMap:plasterMap, bumpScale:.025, roughness:.92});
  const wine = mat('#321823', .6), brass = mat('#987c4f', .38, .82);
  const darkWood = mat('#38271e', .56), marble = new THREE.MeshStandardMaterial({ map: marbleMap, roughness: .2, metalness:.08 });
  const black = mat('#171715', .45), paper = mat('#eee0c7', .85);
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe1a2' });
  const cream = mat('#d4c5ac', .8);
  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function cylinder(rt, rb, h, material, x, y, z, parent = scene, n = 24) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function textPanel(text, sub, width, height, { background = '#4c202c', color = '#dfc7a0', fontSize = 54 } = {}) {
    const texture = mapCanvas(1024, 256, (ctx, w, h) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center'; ctx.fillStyle = color;
      ctx.font = `${fontSize}px Georgia`; ctx.fillText(text, w / 2, sub ? 126 : 148);
      if (sub) { ctx.font = '19px Arial'; ctx.letterSpacing = '5px'; ctx.fillText(sub, w / 2, 190); }
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
  }
  function sign(text, sub, x, y, z, width = 3.2, rotation = 0) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation; scene.add(group);
    box(width + .07, .79, .035, brass, 0, 0, -.01, group);
    const panel = textPanel(text, sub, width, .72); panel.position.z = .02; group.add(panel); return group;
  }

  // Limestone envelope and a walnut coffered ceiling.
  box(14, .16, 20, darkWood, 0, -.1, 0);
  const plankGeometry = new THREE.BoxGeometry(.52, .045, 2.35);
  const planks = new THREE.InstancedMesh(plankGeometry, floorMat, 27 * 9);
  const matrix = new THREE.Matrix4(); let plank = 0;
  for (let x = 0; x < 27; x++) for (let z = 0; z < 9; z++) {
    matrix.makeTranslation(-6.76 + x * .52, -.005, -9.5 + z * 2.35 + (x % 2 ? .65 : 0));
    planks.setMatrixAt(plank, matrix); planks.setColorAt(plank++, new THREE.Color().setHSL(.08, .22, .53 + random() * .13));
  }
  planks.receiveShadow = true; planks.userData.walkable = true; scene.add(planks);
  box(.22, 4.8, 20, plaster, -7, 2.4, 0); box(.22, 4.8, 20, plaster, 7, 2.4, 0);
  box(14, 4.8, .2, plaster, 0, 2.4, -10); box(14, .18, 20, darkWood, 0, 4.5, 0);
  box(14, .24, .14, brass, 0, .13, -9.85);
  for (const x of [-6.83, 6.83]) {
    box(.12, .2, 20, darkWood, x, .15, 0);
    for (const z of [-8.8, -4.7, -.3, 4.2, 8.6]) {
      box(.3, 4.3, .26, cream, x, 2.15, z);
      box(.37, .12, .35, brass, x, .16, z);
      box(.37, .12, .35, cream, x, 4.2, z);
    }
  }
  for (const z of [-8.8, -4.5, 0, 4.5, 8.8]) {
    box(14, .18, .2, walnut, 0, 4.35, z);
    box(12.9, .02, .035, glow, 0, 4.24, z);
  }
  for (const x of [-4, 0, 4]) box(.18, .22, 20, walnut, x, 4.32, 0);

  // Recessed arch behind the cellar mark.
  box(4.4, 3.3, .12, wine, -2.7, 1.7, -9.8);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.2, .045, 8, 64, Math.PI), brass);
  arch.position.set(-2.7, 2.7, -9.67); scene.add(arch);
  for (const x of [-4.9, -.5]) box(.09, 2.7, .08, brass, x, 1.35, -9.67);
  const wordmark = textPanel('yodla', 'A BOTTLE. A MOMENT.', 3.6, 1, { fontSize: 124 });
  wordmark.position.set(-2.7, 2.3, -9.65); scene.add(wordmark);
  sign('THE CELLAR', 'EXPLORE AT YOUR OWN PACE', -2.7, 1.15, -9.63, 2.8);

  // Shelves face inward; each contains individually selectable bottle geometry.
  const bottleBodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0,0), new THREE.Vector2(.105,0), new THREE.Vector2(.115,.04),
    new THREE.Vector2(.115,.43), new THREE.Vector2(.1,.51), new THREE.Vector2(.046,.61),
    new THREE.Vector2(.043,.77), new THREE.Vector2(.047,.79), new THREE.Vector2(.047,.83),
    new THREE.Vector2(0,.83),
  ], 20);
  const shapedBodies=new Map();
  function bottleShape(product){
    const type=/jack|vodka|gin|rum/i.test(product.id)?'spirit':/hennessy/i.test(product.id)?'cognac':/heineken|malt/i.test(product.id)?'beer':'wine';
    if(!shapedBodies.has(type)){
      const profile=type==='cognac'?[[0,0],[.13,0],[.15,.08],[.15,.38],[.12,.49],[.055,.55],[.045,.7],[0,.71]]:type==='spirit'?[[0,0],[.13,0],[.135,.05],[.135,.43],[.11,.49],[.045,.54],[.043,.72],[0,.74]]:type==='beer'?[[0,0],[.095,0],[.1,.04],[.1,.32],[.075,.39],[.04,.48],[.04,.68],[0,.69]]:null;
      shapedBodies.set(type,profile?new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),type==='spirit'?4:32):bottleBodyGeometry);
    }return {geometry:shapedBodies.get(type),type};
  }
  const glass = ['#182a16', '#3c2413', '#452719', '#1d301e', '#292322', '#354431'].map(color => new THREE.MeshPhysicalMaterial({ color, roughness: .17, metalness: .15, clearcoat: 1, clearcoatRoughness: .12 }));
  const goldGlass = new THREE.MeshStandardMaterial({ color: '#b59343', roughness: .24, metalness: .85 });
  const labels = new Map();
  function labelFor(product) {
    if (!labels.has(product.id)) labels.set(product.id, mapCanvas(256, 320, (ctx, w, h) => {
      const gold = /bottega/i.test(product.id), dark = /jack|hennessy/i.test(product.id);
      ctx.fillStyle = dark ? '#211b18' : '#eadfc8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = gold ? '#aa8b4c' : '#846444'; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.textAlign = 'center'; ctx.fillStyle = dark ? '#e8d2a1' : '#4e2a28';
      ctx.font = '19px Georgia'; ctx.fillText((product.brand || 'YODLA').toUpperCase().slice(0, 19), w / 2, 65);
      ctx.font = 'bold 28px Georgia'; const words = product.name.split(' '); let lines = [''];
      for (const word of words) { const index = lines.length - 1; if ((lines[index] + word).length > 13) lines.push(word); else lines[index] += `${lines[index] ? ' ' : ''}${word}`; }
      lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, w / 2, 120 + i * 32));
      ctx.font = '17px Arial'; ctx.fillText(`${product.volume || ''} · ${product.abv || ''}`, w / 2, 280);
    }));
    return labels.get(product.id);
  }
  function bottle(product, x, y, z, parent, index = 0, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); parent.add(group);
    const shape=bottleShape(product),colorIndex=[...product.id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%glass.length;
    const body = new THREE.Mesh(shape.geometry, /bottega/i.test(product.id) ? goldGlass : /heineken/i.test(product.id)?glass[0]:glass[colorIndex]);
    if(shape.type==='spirit')body.rotation.y=Math.PI/4;
    body.castShadow = true; body.userData.productId = product.id; group.add(body); interactives.push(body);
    cylinder(.05, .05, .15, /bottega|hennessy/i.test(product.id) ? brass : black, 0, shape.type==='wine'?.77:shape.type==='beer'?.65:.7, 0, group, 24);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(shape.type==='cognac'?.152:shape.type==='spirit'?.137:shape.type==='beer'?.102:.117,shape.type==='cognac'?.152:shape.type==='spirit'?.137:shape.type==='beer'?.102:.117,.29,24,1,true,-.85,1.7), new THREE.MeshStandardMaterial({ map: labelFor(product), roughness: .74, side: THREE.DoubleSide }));
    label.position.y = .29; label.userData.productId = product.id; group.add(label); interactives.push(label);
    return group;
  }
  const left = products.filter(p => /wine|champagne/i.test(p.category));
  const right = products.filter(p => !left.includes(p));
  function shelf(side, z, index) {
    const group = new THREE.Group(); group.position.set(side * 6.52, 0, z); group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(group);
    box(3.7, 3.6, .2, darkWood, 0, 1.8, -.23, group);
    for (const x of [-1.87, 1.87]) box(.12, 3.7, .74, walnut, x, 1.85, 0, group);
    for (const y of [.36, 1.3, 2.24, 3.18]) {
      box(3.8, .07, .75, walnut, 0, y, .04, group);
      box(3.55, .02, .025, glow, 0, y - .06, .32, group);
      box(3.8, .025, .03, brass, 0, y + .02, .43, group);
    }
    const list = (side < 0 ? left : right).length ? (side < 0 ? left : right) : products;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
      const p = list[(index * 3 + row + Math.floor(col / 3)) % list.length];
      bottle(p, -1.49 + col * .49, .4 + row * .94, .12, group, row + index, .91);
    }
    const label = textPanel(side < 0 ? ['WINES & CHAMPAGNE', 'THE WINE COLLECTION', 'SPARKLING & ROSÉ'][index] : ['SPIRITS & CLASSICS', 'THE SPIRIT COLLECTION', 'BEER, MIXERS & MORE'][index], '', 3.4, .31, { background: '#36271e', fontSize: 40 });
    label.position.set(0, 3.5, .36); group.add(label);
  }
  if (!products.length) throw new Error('Catalogue unavailable');
  [-1, 1].forEach(side => [-6.45, -2, 2.45].forEach((z, i) => shelf(side, z, i)));

  // Central tasting table. A clear walking circuit runs down both sides.
  box(2.3, .92, 3.8, walnut, 0, .46, -2);
  box(2.55, .12, 4.05, marble, 0, .99, -2);
  for (const x of [-1.08, 1.08]) box(.025, .6, 3.5, brass, x, .5, -2);
  for (let i = 0; i < Math.min(products.length, 6); i++) {
    bottle(products[i], i % 2 ? .57 : -.57, 1.05, -3.1 + Math.floor(i / 2) * 1.04, scene, i, .98);
  }
  const tasting = textPanel('THE HOUSE EDIT', 'A FEW WORTH YOUR TIME', 1.35, .36, { background: '#d9c8aa', color: '#4a2d25', fontSize: 49 });
  tasting.position.set(0, 1.25, .03); tasting.rotation.x = -.25; scene.add(tasting);

  // Normal checkout at the front. Gift Atelier has a separate wrapping counter.
  box(2.8, .98, 1.15, wine, -3.95, .49, 4.85);
  box(3.06, .1, 1.35, marble, -3.95, 1.03, 4.85);
  for (const x of [-5.2, -2.7]) box(.03, .88, .03, brass, x, .5, 4.26);
  const checkoutSign = sign('CHECKOUT', 'SOMETHING FOR YOURSELF', -4, .62, 4.24, 1.95, Math.PI);
  checkoutSign.userData.station = 'checkout'; checkoutSign.traverse(o => { if (o.isMesh) { o.userData.station = 'checkout'; interactives.push(o); } });
  const terminal = box(.35, .08, .3, black, -3.35, 1.13, 4.65); terminal.rotation.x = -.15;
  terminal.userData.station = 'checkout'; interactives.push(terminal);
  const screen = box(.25, .02, .2, mat('#556b5c'), -3.35, 1.18, 4.65); screen.userData.station = 'checkout'; interactives.push(screen);
  for (let i = 0; i < 3; i++) box(.5, .36, .23, paper, -4.75 + i * .4, 1.25, 5.04);
  box(3.4, 1.02, 1.1, wine, 3.75, .51, -8.05);
  box(3.65, .12, 1.4, marble, 3.75, 1.08, -8.05);
  for (let i = 0; i < 17; i++) box(.04, .85, .045, brass, 2.2 + i * .19, .51, -7.48);
  const giftSign = sign('THE GIFT ATELIER', 'PERSONAL GIFTING & PRESENTATION', 3.6, 2.65, -9.72, 3.7);
  giftSign.traverse(o => { if (o.isMesh) { o.userData.station = 'gifts'; interactives.push(o); } });
  box(4.25, 3.65, .12, walnut, 3.65, 1.88, -9.84);
  for (let i=0;i<7;i++) box(.012,3.55,.035,brass,1.7+i*.65,1.86,-9.75);
  box(3.48,.035,1.27,brass,3.75,1.02,-8.05);
  for (let i=0;i<3;i++) {
    const seam=box(1.03,.025,.018, darkWood,2.6+i*1.13,.82,-7.482);
    seam.receiveShadow=true;
  }
  const giftBox = new THREE.Group(); giftBox.position.set(3.6, 1.15, -7.96); scene.add(giftBox);
  box(.94, .35, .6, cream, 0, .175, 0, giftBox);
  const lid = box(.97, .045, .63, wine, 0, .375, 0, giftBox);
  box(.91,.006,.57,mat('#6b4850',.85),0,.35,0,giftBox);
  // Satin loops and folded ribbon tails, rather than a painted stripe.
  const satin = new THREE.MeshPhysicalMaterial({color:'#bda57c',roughness:.48,metalness:.25,clearcoat:.25,side:THREE.DoubleSide});
  for(const side of [-1,1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(.1,.018,8,28),satin);
    loop.scale.set(1.6,.7,1);loop.rotation.set(.55,side*.35,side*.25);loop.position.set(side*.12,.46,0);giftBox.add(loop);
    const tail=box(.075,.008,.22,satin,side*.09,.411,.13,giftBox);tail.rotation.y=side*.38;
  }
  const plaque=textPanel('YODLA','',.24,.075,{background:'#321823',color:'#bda57c',fontSize:65});
  plaque.position.set(0,.24,.306);giftBox.add(plaque);
  const giftRibbonTop=box(.11, .005, .66, brass, 0, .419, 0, giftBox);
  const giftRibbonFront=box(.11, .35, .012, brass, 0, .18, .31, giftBox);
  const giftTag = textPanel('For you', '', .33, .17, { background: '#f1e3c9', color: '#572637', fontSize: 58 });
  giftTag.position.set(.34, .24, .322); giftTag.rotation.z = -.13; giftBox.add(giftTag);
  giftBox.traverse(o => { if (o.isMesh) { o.userData.station = 'gifts'; interactives.push(o); } });
  for (let i = 0; i < 3; i++) {
    const roll=cylinder(.07,.07,.26,[wine,paper,brass][i],4.65+i*.18,1.23,-8.35);
    roll.rotation.z=Math.PI/2;
  }
  cylinder(.12,.16,.025,brass,5,1.16,-8.18);
  cylinder(.012,.012,.52,brass,5,1.43,-8.18);
  const taskShade=new THREE.Mesh(new THREE.ConeGeometry(.18,.22,32,1,true),brass);
  taskShade.position.set(5,1.7,-8.18);scene.add(taskShade);
  const taskLight=new THREE.PointLight('#ffe4b9',5,3,2);taskLight.position.set(5,1.6,-8.18);scene.add(taskLight);
  box(.55, .015, .4, paper, 2.65, 1.16, -7.96);
  const scissors = box(.2, .015, .03, brass, 2.6, 1.18, -7.8); scissors.rotation.y = .5;

  const fabricMap=mapCanvas(128,128,(ctx,w,h)=>{ctx.fillStyle='#b6ac9a';ctx.fillRect(0,0,w,h);for(let x=0;x<w;x+=2){ctx.fillStyle=x%4?'#d7cebd':'#ada391';ctx.fillRect(x,0,1,h);}for(let y=0;y<h;y+=3){ctx.fillStyle='#bdb3a255';ctx.fillRect(0,y,w,1);}});
  const skinMap=mapCanvas(128,128,(ctx,w,h)=>{ctx.fillStyle='#999999';ctx.fillRect(0,0,w,h);for(let i=0;i<7000;i++){ctx.fillStyle=`rgba(40,40,40,${random()*.14})`;ctx.fillRect(random()*w,random()*h,1,1);}});
  const cashierRig={};
  function addCashier(mode,name,x,z,rotation=0){
    const host=new THREE.Group();host.position.set(x,0,z);host.rotation.y=rotation;scene.add(host);
    const skin=new THREE.MeshPhysicalMaterial({color:mode==='gift'?'#8b5c41':'#75503c',roughness:.64,clearcoat:.08,bumpMap:skinMap,bumpScale:.002}),shirt=new THREE.MeshStandardMaterial({color:'#d7cebc',map:fabricMap,bumpMap:fabricMap,bumpScale:.002,roughness:.87}),apron=mat('#321923',.8),hair=mat('#221c18',.9);
    function sphere(rx,ry,rz,material,px,py,pz,parent=host){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),material);mesh.scale.set(rx,ry,rz);mesh.position.set(px,py,pz);mesh.castShadow=true;parent.add(mesh);return mesh;}
    sphere(.27,.37,.16,shirt,0,1.15,0);
    box(.4,.5,.05,apron,0,1.11,.145,host);
    for(const side of [-1,1]){const strap=box(.035,.28,.025,apron,side*.13,1.42,.145,host);strap.rotation.z=side*.2;}
    cylinder(.065,.07,.15,skin,0,1.53,0,host);
    sphere(.132,.172,.117,skin,0,1.75,.005);
    sphere(.087,.064,.084,skin,0,1.637,.023);
    for(const side of [-1,1])sphere(.051,.038,.04,skin,side*.069,1.715,.085);
    sphere(.14,.1,.13,hair,0,1.85,-.01);
    if(mode==='gift')sphere(.11,.11,.09,hair,-.09,1.94,-.05);
    sphere(.029,.05,.025,skin,-.136,1.74,0);sphere(.029,.05,.025,skin,.136,1.74,0);
    sphere(.019,.046,.026,skin,0,1.744,.116);sphere(.025,.015,.025,skin,0,1.718,.132);
    for(const side of [-1,1]){
      sphere(.025,.013,.009,mat('#cabba5',.48),side*.049,1.778,.11);
      sphere(.009,.01,.005,mat('#38291e',.32),side*.049,1.778,.119);
      sphere(.004,.005,.003,black,side*.049,1.778,.123);
      sphere(.002,.002,.002,paper,side*.046,1.781,.126);
      const brow=box(.04,.008,.009,hair,side*.05,1.804,.111,host);brow.rotation.z=-side*.08;
    }
    const lip=mat('#694138',.72);sphere(.031,.006,.008,lip,0,1.675,.118);sphere(.029,.008,.01,lip,0,1.666,.115);
    for(const side of [-1,1]){
      sphere(.028,.007,.008,skin,side*.049,1.792,.11);
      const collar=box(.09,.11,.02,shirt,side*.07,1.47,.135,host);collar.rotation.z=side*.45;
      if(mode==='gift'){const earring=new THREE.Mesh(new THREE.TorusGeometry(.022,.004,8,20),brass);earring.position.set(side*.141,1.69,.005);host.add(earring);}
    }
    for(let i=0;i<16;i++){const lock=sphere(.018,.06,.022,hair,Math.cos(i*.5)*.112,1.862+Math.sin(i)*.012,-.016+Math.sin(i*.5)*.09);lock.rotation.z=Math.cos(i)*.3;}
    const tag=textPanel(name,'YODLA',.19,.075,{background:'#e7d9bc',color:'#3b1e27',fontSize:73});tag.position.set(.035,1.35,.184);host.add(tag);
    const arms=[];
    for(const side of [-1,1]){
      const shoulder=new THREE.Group();shoulder.position.set(side*.25,1.4,0);host.add(shoulder);
      const upper=cylinder(.065,.057,.29,shirt,0,-.12,0,shoulder,16);upper.rotation.z=side*.12;
      const elbow=new THREE.Group();elbow.position.set(0,-.26,0);shoulder.add(elbow);
      cylinder(.045,.04,.29,skin,0,-.12,0,elbow,14);sphere(.055,.07,.03,skin,0,-.27,0,elbow);
      shoulder.rotation.x=-.55;shoulder.rotation.z=side*.18;elbow.rotation.x=-.9;
      arms.push({shoulder,elbow,side});
    }
    for(const side of [-1,1])cylinder(.085,.07,.7,black,side*.11,.4,0,host,16);
    const detail=textPanel('Ready for you','',.4,.15,{background:'#f2e6cf',color:'#4d2b27',fontSize:40});detail.position.set(x,1.38,z+(rotation?-.65:.65));detail.rotation.y=rotation;scene.add(detail);
    const workingArms=[];
    for(const side of [-1,1]){
      const upper=cylinder(.06,.047,1,shirt,0,0,0,host,24);
      const fore=cylinder(.043,.031,1,skin,0,0,0,host,24);
      const hand=sphere(.039,.06,.025,skin,0,0,0);hand.visible=false;
      const fingers=[];for(let i=0;i<4;i++)fingers.push(sphere(.008,.034,.009,skin,0,0,0));
      const thumb=sphere(.012,.028,.013,skin,0,0,0);fingers.push(thumb);
      upper.visible=fore.visible=false;fingers.forEach(f=>f.visible=false);
      workingArms.push({upper,fore,hand,fingers,side});
    }
    // Tailoring, shirt placket, apron seams, cuffs, and shoulder contours.
    box(.012,.36,.008,paper,0,1.33,.159,host);
    for(let i=0;i<4;i++)sphere(.008,.008,.004,brass,0,1.45-i*.07,.17);
    box(.2,.105,.013,apron,.02,1.02,.183,host);
    for(const side of [-1,1])sphere(.075,.09,.12,shirt,side*.22,1.39,0);
    cashierRig[mode]={host,home:host.position.clone(),arms,workingArms,detail,action:0,phase:0};
  }
  addCashier('gift','Nneka',3.4,-8.9);
  addCashier('checkout','Daniel',-4,5.7,Math.PI);
  const logoTexture=new THREE.TextureLoader().load('/assets/brand/yodla-wordmark-4096-white.png');logoTexture.colorSpace=THREE.SRGBColorSpace;textures.push(logoTexture);
  for(const [x,z,rotation] of [[3.75,-7.484,0],[-3.95,4.263,Math.PI]]){
    const logo=new THREE.Mesh(new THREE.PlaneGeometry(.85,.19),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,depthWrite:false}));logo.position.set(x,.58,z);logo.rotation.y=rotation;scene.add(logo);
  }

  for(const [x,y,z,rotation] of [[-2.7,3.15,-9.64,0],[-6.86,3.85,5.9,Math.PI/2],[6.86,3.85,5.9,-Math.PI/2],[3.6,3.45,-9.64,0]]){
    const logo=new THREE.Mesh(new THREE.PlaneGeometry(2,.45),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true,depthWrite:false}));logo.position.set(x,y,z);logo.rotation.y=rotation;scene.add(logo);
  }
  // The shopper carries a woven basket. Every animation unit is copied from the order ledger.
  function makeBasket(parent){
    const g=new THREE.Group();parent.add(g);
    box(.74,.035,.43,walnut,0,.015,0,g);
    for(const side of [-1,1]){
      for(let i=0;i<5;i++)box(.75,.018,.018,brass,0,.06+i*.045,side*.22,g);
      for(let i=0;i<8;i++)box(.016,.24,.016,darkWood,-.35+i*.1,.14,side*.22,g);
      for(let i=0;i<5;i++)box(.018,.018,.44,brass,side*.37,.06+i*.045,0,g);
      const handle=new THREE.Mesh(new THREE.TorusGeometry(.26,.014,8,32,Math.PI),brass);handle.position.set(0,.27,side*.2);g.add(handle);
    }return g;
  }
  scene.add(camera);
  const carried=new THREE.Group();camera.add(carried);carried.position.set(.4,-.63,-1.05);carried.scale.setScalar(.7);
  const shoppingBasket=makeBasket(carried),shoppingDrinks=new THREE.Group();carried.add(shoppingDrinks);carried.visible=false;
  const orderRoot=new THREE.Group();scene.add(orderRoot);orderRoot.visible=false;
  let orderDrinksGroup=null,renderedPacked=-1;
  let orderData=null,orderBottleMeshes=[],orderParcels=[],counterBasket=null,pos=null,receipt=null,currentOrderFrame=null;
  const orderAssets=[];
  const baseMaterials=new Set([walnut,brass,darkWood,cream,paper,wine,black,goldGlass,...glass]);
  let lastOrderShadow='';
  function clearGroup(group){
    const disposable=new Set();group.traverse(o=>{if(o.geometry && o.geometry!==bottleBodyGeometry && ![...shapedBodies.values()].includes(o.geometry))disposable.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!baseMaterials.has(material)){material.dispose();}
      const index=interactives.indexOf(o);if(index>=0)interactives.splice(index,1);});
    disposable.forEach(g=>g.dispose());group.clear();
  }
  function setShoppingBasket(lines){
    clearGroup(shoppingDrinks);let index=0;
    for(const product of lines)for(let i=0;i<product.quantity && index<12;i++,index++){
      const drink=bottle(product,-.24+(index%4)*.16,.05,-.11+Math.floor(index/4)*.1,shoppingDrinks,index,.48);
      drink.traverse(o=>{delete o.userData.productId;const index=interactives.indexOf(o);if(index>=0)interactives.splice(index,1);});
    }
    carried.visible=Boolean(lines.length)&&!orderData;
  }
  function parcelTag(person,message){
    const texture=mapCanvas(1024,768,(ctx,w,h)=>{
      ctx.fillStyle='#f2e8d3';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#a38457';ctx.lineWidth=4;ctx.strokeRect(22,22,w-44,h-44);
      ctx.fillStyle='#532735';ctx.textAlign='center';ctx.font='52px Georgia';ctx.fillText('yodla',w/2,100);
      ctx.font='26px Arial';ctx.fillText('A GIFT FOR',w/2,175);
      const wrap=(value,max)=>{const words=String(value||'').split(/\s+/),lines=[''];for(const word of words){let i=lines.length-1;if((lines[i]+' '+word).length>max)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines;};
      ctx.font='52px Georgia';wrap(person.name||person.firstName||'You',26).slice(0,3).forEach((line,i)=>ctx.fillText(line,w/2,255+i*61,930));
      ctx.font='italic 32px Georgia';wrap(message||'A little something for you.',44).slice(0,5).forEach((line,i)=>ctx.fillText(line,w/2,470+i*43,920));
      ctx.font='20px Arial';ctx.fillText('PREPARED WITH CARE BY NNEKA',w/2,725);
    });
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.86,side:THREE.DoubleSide});orderAssets.push(material);
    return new THREE.Mesh(new THREE.PlaneGeometry(.47,.35),material);
  }
  function beginOrder(order){
    endOrder();orderData=order;orderRoot.visible=true;carried.visible=false;giftBox.visible=false;
    const rig=cashierRig[order.mode];orderRoot.position.set(rig.host.position.x,0,rig.host.position.z);orderRoot.rotation.y=rig.host.rotation.y;rig.host.translateZ(.18);
    counterBasket=makeBasket(orderRoot);counterBasket.position.set(-.55,1.13,.65);
    orderDrinksGroup=new THREE.Group();orderRoot.add(orderDrinksGroup);renderedPacked=-1;
    orderParcels=order.parcels.map((parcel,i)=>{
      const g=new THREE.Group();g.position.set(.35+(i%2)*.65,1.13,.4+Math.floor(i/2)*.36);orderRoot.add(g);
      const w=order.mode==='gift'?.62:.45,d=.45,h=order.mode==='gift'?.32:.5;
      box(w,.02,d,paper,0,0,0,g);
      box(w,h,.018,order.mode==='gift'?cream:paper,0,h/2,-d/2,g);
      for(const side of [-1,1])box(.018,h,d,order.mode==='gift'?cream:paper,side*w/2,h/2,0,g);
      box(w,h*.65,.018,order.mode==='gift'?cream:paper,0,h*.325,d/2,g);
      const top=box(w+.025,.035,d+.025,wine,0,h+.02,0,g);top.visible=false;
      const tag=parcelTag(parcel.person,parcel.message);tag.position.set(0,h*.56,d/2+.022);g.add(tag);tag.visible=false;
      const tie=new THREE.Mesh(new THREE.TorusGeometry(.055,.007,8,24),brass);tie.position.set(.17,h+.07,0);tie.rotation.x=Math.PI/2;g.add(tie);tie.visible=false;
      if(order.mode==='checkout'){
        for(const side of [-1,1]){const handle=new THREE.Mesh(new THREE.TorusGeometry(.12,.012,8,24,Math.PI),darkWood);handle.position.set(0,h,side*d/2);g.add(handle);}
        const mark=textPanel('yodla','',.3,.13,{background:'#eee0c7',color:'#4c202c',fontSize:85});mark.position.set(0,.2,d/2+.012);g.add(mark);
      }
      return {group:g,top,tag,tie};
    });
    pos=new THREE.Group();pos.position.set(0,1.18,.81);orderRoot.add(pos);pos.visible=false;
    box(.22,.055,.34,black,0,0,0,pos);const display=textPanel('PAY','DEMO',.18,.15,{background:'#b2c3ad',color:'#17251c',fontSize:76});display.rotation.x=-Math.PI/2+.38;display.position.set(0,.058,-.02);pos.add(display);
    pos.traverse(o=>{if(o.isMesh){o.userData.orderPOS=true;interactives.push(o);}});
    receipt=new THREE.Group();receipt.position.set(-.02,1.2,.98);orderRoot.add(receipt);receipt.visible=false;
    const receiptMap=mapCanvas(512,1024,(ctx,w,h)=>{
      ctx.fillStyle='#f7f2e7';ctx.fillRect(0,0,w,h);ctx.fillStyle='#332520';ctx.textAlign='center';ctx.font='54px Georgia';ctx.fillText('yodla',w/2,85);ctx.font='24px monospace';ctx.fillText('SAMPLE RECEIPT',w/2,145);ctx.font='17px monospace';ctx.fillText('SIMULATED PAYMENT / NO ORDER',w/2,185);let y=240;ctx.textAlign='left';
      for(const parcel of order.parcels){if(order.mode==='gift'){ctx.fillText('For '+parcel.person.name,24,y,460);y+=35;}for(const line of parcel.lines){ctx.fillText(line.name+' x '+line.quantity,24,y,460);y+=35;}if(y>800)break;}
      ctx.fillText('TOTAL NGN '+order.total.toLocaleString('en-NG'),24,900);ctx.fillText('THANK YOU',24,965);
    });const receiptMaterial=new THREE.MeshStandardMaterial({map:receiptMap,roughness:.95});orderAssets.push(receiptMaterial);
    const receiptLabel=new THREE.Mesh(new THREE.PlaneGeometry(.29,.58),receiptMaterial);receiptLabel.rotation.x=-Math.PI/2;receipt.add(receiptLabel);
    renderer.shadowMap.needsUpdate=true;
  }
  function positionArm(rig,arm,target){
    const shoulder=new THREE.Vector3(arm.side*.25,1.4,0);
    const wrist=rig.host.worldToLocal(target.clone());
    const delta=wrist.clone().sub(shoulder);if(delta.length()>.58)wrist.copy(shoulder).add(delta.setLength(.58));
    const elbow=shoulder.clone().lerp(wrist,.5);elbow.x+=arm.side*.095;elbow.z-=.1;
    function bone(mesh,a,b){mesh.visible=true;mesh.position.copy(a).lerp(b,.5);mesh.scale.y=a.distanceTo(b);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());}
    bone(arm.upper,shoulder,elbow);bone(arm.fore,elbow,wrist);arm.hand.visible=true;arm.hand.position.copy(wrist);arm.hand.rotation.x=-.7;
    arm.fingers.forEach((f,i)=>{f.visible=true;f.position.copy(wrist).add(new THREE.Vector3((i-1.5)*.016,-.045,.012));f.rotation.x=-.65;});
  }
  function updateOrder(state){
    if(!orderData)return;currentOrderFrame=state;
    counterBasket.position.z=.65+(1-state.basketProgress)*.65;
    const activeIndex=state.packed;
    if(renderedPacked!==activeIndex){
      clearGroup(orderDrinksGroup);
      orderBottleMeshes=orderData.units.slice(activeIndex,activeIndex+12).map((unit,i)=>{
        const mesh=bottle(unit.product,0,0,0,orderDrinksGroup,i,.52);mesh.traverse(o=>{delete o.userData.productId;const index=interactives.indexOf(o);if(index>=0)interactives.splice(index,1);});return mesh;
      });renderedPacked=activeIndex;
    }
    orderBottleMeshes.forEach((mesh,slot)=>{
      const i=activeIndex+slot,unit=orderData.units[i],parcel=orderParcels[unit.parcelIndex];
      const source=new THREE.Vector3(-.75+(slot%4)*.13,1.17,.53+Math.floor(slot/4)*.1);
      const dest=parcel.group.position.clone().add(new THREE.Vector3((i%3-1)*.12,.03,0));
      if(i<activeIndex){mesh.position.copy(dest);mesh.visible=false;}
      else if(i===activeIndex && state.stage==='packing'){
        const t=state.unitProgress;
        // Basket -> counter scan position -> open bag/box, one actual bottle at a time.
        const middle=new THREE.Vector3(-.05,1.15,.48);
        if(t<.5){const u=t*2;mesh.position.copy(source).lerp(middle,u);mesh.position.y+=Math.sin(u*Math.PI)*.24;}
        else {const u=(t-.5)*2;mesh.position.copy(middle).lerp(dest,u);mesh.position.y+=Math.sin(u*Math.PI)*.32;}
        mesh.visible=true;
      }else{mesh.position.copy(source);mesh.position.z+=(1-state.basketProgress)*.65;mesh.visible=true;}
    });
    orderParcels.forEach((parcel,i)=>{
      const complete=parcelComplete(orderData,state,i);
      parcel.top.visible=orderData.mode==='gift'&&complete;parcel.tag.visible=orderData.mode==='gift'&&complete;parcel.tie.visible=orderData.mode==='gift'&&complete&&orderData.wrap;
    });
    pos.visible=state.stage==='payment'||state.stage==='receipt';receipt.visible=state.paid;
    if(state.paid)receipt.scale.z=Math.min(1,receipt.scale.z+.035);else receipt.scale.z=.01;
    const rig=cashierRig[orderData.mode];rig.arms.forEach(a=>a.shoulder.visible=false);
    const current=orderBottleMeshes[0];
    const reachX=current&&state.stage==='packing'?THREE.MathUtils.clamp(current.position.x,-.45,.65)*.7:0;rig.host.position.x=rig.home.x+reachX*(orderData.mode==='checkout'?-1:1);
    rig.workingArms.forEach(arm=>{
      const p=current&&state.stage==='packing'?current.position.clone().add(new THREE.Vector3(arm.side*.06,.22,0)):new THREE.Vector3(arm.side*.27,1.2,.48);
      positionArm(rig,arm,orderRoot.localToWorld(p));
    });
    const shadowKey=state.stage+':'+state.packed;if(shadowKey!==lastOrderShadow){renderer.shadowMap.needsUpdate=true;lastOrderShadow=shadowKey;}
  }
  function endOrder(){
    orderData=null;currentOrderFrame=null;orderRoot.visible=false;giftBox.visible=true;clearGroup(orderRoot);orderBottleMeshes=[];orderParcels=[];
    for(let i=interactives.length-1;i>=0;i--)if(interactives[i].userData.orderPOS)interactives.splice(i,1);
    orderAssets.splice(0).forEach(m=>{if(m.map){const index=textures.indexOf(m.map);if(index>=0)textures.splice(index,1);m.map.dispose();}m.dispose();});
    for(const rig of Object.values(cashierRig)){rig.host.position.copy(rig.home);rig.arms.forEach(a=>a.shoulder.visible=true);rig.workingArms.forEach(a=>{a.upper.visible=a.fore.visible=a.hand.visible=false;a.fingers.forEach(f=>f.visible=false);});}
    renderer.shadowMap.needsUpdate=true;
  }

  // Pendant lights, warm wall wash, and soft daylight from the storefront.
  const ambient = new THREE.HemisphereLight('#ece4d5', '#30251e', .7); scene.add(ambient);
  const keyLight = new THREE.DirectionalLight('#fff0d6', 2.1); keyLight.position.set(1, 5, 8); keyLight.castShadow = true;
  const shadowSize=matchMedia('(pointer: coarse)').matches?1024:2048;
  keyLight.shadow.mapSize.set(shadowSize,shadowSize); keyLight.shadow.camera.left = -9; keyLight.shadow.camera.right = 9;
  keyLight.shadow.camera.top = 11; keyLight.shadow.camera.bottom = -11; keyLight.shadow.normalBias = .035; scene.add(keyLight);
  const backLight = new THREE.PointLight('#ffd5a0', 32, 16, 2); backLight.position.set(0, 3.6, -7); scene.add(backLight);
  for (const z of [4.5, -1.6, -7]) for (const x of [-3, 3]) {
    cylinder(.018, .018, .65, brass, x, 4, z);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.43, .35, 32, 1, true), brass); shade.position.set(x, 3.55, z); scene.add(shade);
    cylinder(.32, .32, .025, glow, x, 3.39, z);
    const light = new THREE.PointLight('#ffe0b0', 16, 7, 2); light.position.set(x, 3.2, z); scene.add(light);
  }
  // Botanical arrangement gives the limestone corner a softer edge.
  cylinder(.32, .25, .6, mat('#9c7856'), 5.55, .3, 6.9);
  const leafMat = mat('#374636', .85);
  for (let i = 0; i < 14; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), leafMat);
    leaf.scale.set(.13, .65, .055); leaf.position.set(5.55 + Math.sin(i * 2.4) * .35, 1 + random() * .9, 6.9 + Math.cos(i) * .3); leaf.rotation.z = Math.sin(i) * .7; scene.add(leaf);
  }
  const abort = new AbortController(), eventOptions = { signal: abort.signal };
  const canvas = renderer.domElement;
  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.fov = camera.aspect < .8 ? 69 : 58; camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function cast(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactives, false).find(h => h.distance < 9);
    // Furniture and walls occlude bottle hit targets.
    if (!hit) return null;
    const occlusion = raycaster.intersectObjects(scene.children, true).find(h => h.object.isMesh && !h.object.userData.productId && !h.object.userData.station && !h.object.userData.overlay && !h.object.userData.orderPOS);
    return occlusion && occlusion.distance + .04 < hit.distance ? null : hit;
  }
  canvas.addEventListener('pointerdown', e => {
    if (paused && !orderData) return;
    canvas.focus({ preventScroll: true }); if (Number.isInteger(e.pointerId)) canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, yaw, pitch, moved: false };
  }, eventOptions);
  canvas.addEventListener('pointermove', e => {
    if (paused) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      if (drag.moved) { travel = null; onTravel?.(false); yaw = drag.yaw - dx * .003; pitch = THREE.MathUtils.clamp(drag.pitch - dy * .002, -.55, .55); }
    } else if (!drag) {
      const hit = cast(e); const floor = floorTarget(e); canvas.style.cursor = hit || floor ? 'pointer' : 'grab';
      moveMarker.visible = Boolean(floor && !hit && entered);
      if (floor) moveMarker.position.set(floor.x, .045, floor.z);
      const id = hit?.object.userData.productId;
      onHover?.(id ? products.find(p => p.id === id)?.name : hit?.object.userData.station ? STATIONS[hit.object.userData.station].label : '');
    }
  }, eventOptions);
  canvas.addEventListener('pointerup', e => {
    if (orderData) { const hit=cast(e);if(hit?.object.userData.orderPOS && currentOrderFrame?.stage==='payment')container.dispatchEvent(new CustomEvent('boutique-pos'));drag=null;return; }
    if (paused) { drag = null; return; }
    const moved = drag && (drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 10);
    drag = null;
    if (moved) return;
    const hit = cast(e);
    if (hit?.object.userData.productId) onSelect?.(hit.object.userData.productId);
    else if (hit?.object.userData.station) visit(hit.object.userData.station);
    else { const floor = floorTarget(e); if (floor) moveTo(floor); }
  }, eventOptions);
  canvas.addEventListener('pointercancel', () => { drag = null; }, eventOptions);
  window.addEventListener('blur', () => { drag = null; }, eventOptions);
  document.addEventListener('visibilitychange', () => { last = performance.now(); }, eventOptions);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(true); container.dispatchEvent(new CustomEvent('boutique-render-error')); }, eventOptions);

  const markerMaterial = new THREE.MeshBasicMaterial({color:'#c6ae84',transparent:true,opacity:.8,depthWrite:false});
  const moveMarker = new THREE.Mesh(new THREE.RingGeometry(.18,.205,48),markerMaterial);
  moveMarker.rotation.x=-Math.PI/2;moveMarker.visible=false;moveMarker.userData.overlay=true;scene.add(moveMarker);
  function floorTarget(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(planks,false)[0];
    if(!hit || !canStand(hit.point.x,hit.point.z))return null;
    const blocker=raycaster.intersectObjects(scene.children,true).find(h=>h.object.isMesh && !h.object.userData.overlay && !h.object.userData.walkable);
    if(blocker && blocker.distance+.03<hit.distance)return null;
    return hit.point;
  }
  function moveTo(point, stationId='') {
    entered=true;drag=null;moveMarker.visible=false;
    const target = new THREE.Vector3(point.x,1.7,point.z);
    const route=routeToStation(camera.position,target);
    if(!route.length)return;
    const station=STATIONS[stationId];
    const look=station ? new THREE.Vector3(...station.look) : target.clone().add(new THREE.Vector3(target.x-camera.position.x,0,target.z-camera.position.z));
    const direction=look.sub(target).normalize();
    let targetYaw = direction.lengthSq() ? Math.atan2(-direction.x,-direction.z) : yaw;
    targetYaw=yaw+THREE.MathUtils.euclideanModulo(targetYaw-yaw+Math.PI,Math.PI*2)-Math.PI;
    const targetPitch=station ? Math.asin(direction.y) : -.025;
    onMove?.();
    if(reduced) {travel=null;camera.position.copy(target);yaw=targetYaw;pitch=targetPitch;if(stationId)onStation?.(stationId);return;}
    const points=[camera.position.clone(),...route.map(p=>new THREE.Vector3(p.x,1.7,p.z))];
    const unique=points.filter((p,i)=>!i || p.distanceTo(points[i-1])>.01);
    if(unique.length<2){camera.position.copy(target);yaw=targetYaw;pitch=targetPitch;if(stationId)onStation?.(stationId);onTravel?.(false);return;}
    let curve=new THREE.CatmullRomCurve3(unique,false,'catmullrom',.12);
    if(!curve.getPoints(160).every(p=>canStand(p.x,p.z)))curve=new THREE.CurvePath();
    if(curve instanceof THREE.CurvePath)for(let i=1;i<unique.length;i++)curve.add(new THREE.LineCurve3(unique[i-1],unique[i]));
    const distance=curve.getLength();
    travel={id:stationId,curve,elapsed:0,duration:Math.max(.9,Math.min(6,distance/2.7)),fromYaw:yaw,fromPitch:pitch,targetYaw,targetPitch};
    onTravel?.(true);

  }
  function visit(id) {
    const station=STATIONS[id];if(station)moveTo(new THREE.Vector3(...station.position),id);
  }
  function pause(value) {paused=value;drag=null;moveMarker.visible=false;onHover?.('');}
  function tick(now) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, .04); last = now;
    if (document.hidden) return;
    if (!paused) {
      if(travel){
        travel.elapsed=Math.min(travel.duration,travel.elapsed+dt);
        const t=travel.elapsed/travel.duration,ease=t*t*t*(t*(t*6-15)+10);
        const position=travel.curve.getPointAt(ease);camera.position.copy(position);
        yaw=THREE.MathUtils.lerp(travel.fromYaw,travel.targetYaw,ease);pitch=THREE.MathUtils.lerp(travel.fromPitch,travel.targetPitch,ease);
        if(t>=1){const id=travel.id;travel=null;onTravel?.(false);if(id)onStation?.(id);}
      }
      if (!reduced && !entered) { yaw = Math.sin(now * .0001) * .018; }
    }
    const giftPhase=cashierRig.gift.phase;
    lid.position.y=THREE.MathUtils.damp(lid.position.y,giftPhase>0 && giftPhase<.5?.72:.375,6,dt);
    giftTag.visible=giftPhase===0 || giftPhase>=.75;
    giftRibbonTop.visible=giftRibbonFront.visible=giftPhase===0 || (giftPhase>=.5 && cashierRig.gift.wrap!==false);
    for(const rig of Object.values(cashierRig)){
      rig.action=THREE.MathUtils.damp(rig.action,rig.phase,5,dt);
      rig.arms.forEach(({shoulder,elbow,side})=>{
        const busy=rig.action>0 && rig.action<.98;
        shoulder.rotation.x=-.55-rig.action*.25+(busy?Math.sin(now*.003+side)*.08:0);
        shoulder.rotation.z=side*(.18-rig.action*.16);
        elbow.rotation.x=-.9-rig.action*.45;
      });
    }
    camera.rotation.set(pitch, yaw, 0);
    onPosition?.(camera.position.x, camera.position.z);
    const frameInterval=matchMedia('(pointer: coarse)').matches?1000/30:1000/60;
    if(now-lastRender>=frameInterval){renderer.render(scene,camera);lastRender=now;}
  }
  frame = requestAnimationFrame(tick);
  return {
    visit, pause, setShoppingBasket, beginOrder, updateOrder, endOrder,
    setCounterAction(mode,progress,details={}){
      const rig=cashierRig[mode];if(!rig)return;rig.phase=progress;rig.wrap=details.wrap;renderer.shadowMap.needsUpdate=true;
      if(progress>=.75){
        const name=details.person?.name || details.person?.firstName || (mode==='gift'?'Your gift':'Your selection');
        const previous=rig.detail.material.map;
        const next=textPanel(name,'PREPARED BY '+(mode==='gift'?'NNEKA':'DANIEL'),.4,.15,{background:'#f2e6cf',color:'#4d2b27',fontSize:40});
        if(mode==='gift'){
          const label=textPanel('For '+name,String(details.message||'').slice(0,42),.33,.17,{background:'#f1e3c9',color:'#572637',fontSize:50});
          const oldLabel=giftTag.material.map;giftTag.material.map=label.material.map;giftTag.material.needsUpdate=true;oldLabel?.dispose();label.geometry.dispose();label.material.dispose();
        }
        rig.detail.material.map=next.material.map;rig.detail.material.needsUpdate=true;previous?.dispose();next.geometry.dispose();next.material.dispose();
      }
    },
    enter() { entered = true; canvas.focus({ preventScroll: true }); visit('entrance'); },
    setReducedMotion(value) { reduced = value; if (value && travel) { const end=travel.curve.getPointAt(1);const id=travel.id;travel=null;moveTo(end,id); } },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); abort.abort();
      const geometries = new Set(), materials = new Set();
      scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
