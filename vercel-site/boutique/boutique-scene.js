import * as THREE from 'three';
import { RoomEnvironment } from './vendor/three/RoomEnvironment.js';
import { moveWithCollision, routeToStation, canStand, STATIONS } from './boutique-model.js';

export function createBoutique({ container, products, onSelect, onStation, onPosition, onHover, onMove, reduceMotion = false }) {
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
  let yaw = 0, pitch = -.025, drag = null, travel = null, last = performance.now(), frame;

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
    const body = new THREE.Mesh(bottleBodyGeometry, /bottega/i.test(product.id) ? goldGlass : glass[index % glass.length]);
    body.castShadow = true; body.userData.productId = product.id; group.add(body); interactives.push(body);
    cylinder(.05, .05, .15, /bottega|hennessy/i.test(product.id) ? brass : black, 0, .77, 0, group, 16);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(.117, .117, .29, 16, 1, true, -.85, 1.7), new THREE.MeshStandardMaterial({ map: labelFor(product), roughness: .74, side: THREE.DoubleSide }));
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
  const checkoutSign = sign('CHECKOUT', 'SOMETHING FOR YOURSELF', -4, 1.45, 4.75, 1.95, Math.PI);
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
  box(.11, .005, .66, brass, 0, .419, 0, giftBox);
  box(.11, .35, .012, brass, 0, .18, .31, giftBox);
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

  // Pendant lights, warm wall wash, and soft daylight from the storefront.
  const ambient = new THREE.HemisphereLight('#ece4d5', '#30251e', .7); scene.add(ambient);
  const keyLight = new THREE.DirectionalLight('#fff0d6', 2.1); keyLight.position.set(1, 5, 8); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.camera.left = -9; keyLight.shadow.camera.right = 9;
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
    const occlusion = raycaster.intersectObjects(scene.children, true).find(h => h.object.isMesh && !h.object.userData.productId && !h.object.userData.station && !h.object.userData.overlay);
    return occlusion && occlusion.distance + .04 < hit.distance ? null : hit;
  }
  canvas.addEventListener('pointerdown', e => {
    if (paused) return;
    canvas.focus({ preventScroll: true }); if (Number.isInteger(e.pointerId)) canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, yaw, pitch, moved: false };
  }, eventOptions);
  canvas.addEventListener('pointermove', e => {
    if (paused) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      if (drag.moved) { travel = null; yaw = drag.yaw - dx * .003; pitch = THREE.MathUtils.clamp(drag.pitch - dy * .002, -.55, .55); }
    } else if (!drag) {
      const hit = cast(e); const floor = floorTarget(e); canvas.style.cursor = hit || floor ? 'pointer' : 'grab';
      moveMarker.visible = Boolean(floor && !hit && entered);
      if (floor) moveMarker.position.set(floor.x, .045, floor.z);
      const id = hit?.object.userData.productId;
      onHover?.(id ? products.find(p => p.id === id)?.name : hit?.object.userData.station ? STATIONS[hit.object.userData.station].label : '');
    }
  }, eventOptions);
  canvas.addEventListener('pointerup', e => {
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
    travel={id:stationId,points:[camera.position.clone(),...route.map(p=>new THREE.Vector3(p.x,1.7,p.z))],index:1,targetYaw,targetPitch};
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
      if (travel) {
        const destination = travel.points[travel.index]; const distance = camera.position.distanceTo(destination);
        const step = dt * 5.2;
        if (distance <= step) {
          camera.position.copy(destination); travel.index++;
          if (travel.index >= travel.points.length) { const id = travel.id; yaw = travel.targetYaw; pitch = travel.targetPitch; travel = null; if (id) onStation?.(id); }
        } else {
          const next = camera.position.clone().lerp(destination, step / distance);
          const allowed = moveWithCollision(camera.position, next.x - camera.position.x, next.z - camera.position.z);
          camera.position.set(allowed.x, 1.7, allowed.z);
          yaw += (travel.targetYaw - yaw) * Math.min(1, dt * 3); pitch += (travel.targetPitch - pitch) * Math.min(1, dt * 3);

        }
      }
      if (!reduced && !entered) { yaw = Math.sin(now * .0001) * .018; }
    }
    camera.rotation.set(pitch, yaw, 0);
    onPosition?.(camera.position.x, camera.position.z);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);
  return {
    visit, pause,
    enter() { entered = true; canvas.focus({ preventScroll: true }); visit('entrance'); },
    setReducedMotion(value) { reduced = value; if (value && travel) { const end=travel.points.at(-1);const id=travel.id;travel=null;moveTo(end,id); } },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); abort.abort();
      const geometries = new Set(), materials = new Set();
      scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
