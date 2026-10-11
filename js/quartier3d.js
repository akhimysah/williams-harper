// Le Quartier 3D — Domaine Red Stone. Open-world walk / drive in the estate.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer:coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = 20261011;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const fmtMoney = n => '€ ' + Math.round(n).toString().padStart(7, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ================= save ================= */
const SAVE_KEY = 'wh-quartier-v2';
let save = { money: 0, keys: [], done: {} };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(save, s); } catch { /* private mode */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };

/* ================= renderer ================= */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe0ea, 90, 320);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight('#f4f1ea', '#6f7c58', 1);
const sun = new THREE.DirectionalLight('#fff3df', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);

/* environment map for reflections (glass, water, gold, cars) */
{
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  const eg = new THREE.SphereGeometry(10, 32, 16), pos = eg.attributes.position, col = [];
  const top = new THREE.Color('#78aee3'), hor = new THREE.Color('#e6eef2'), low = new THREE.Color('#56653f'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10; c.copy(hor).lerp(y > 0 ? top : low, Math.min(1, Math.abs(y) * (y > 0 ? 1.3 : 4))); col.push(c.r, c.g, c.b); }
  eg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  es.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sunBlob = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 4.5) })); sunBlob.position.set(-5, 6, 4); es.add(sunBlob);
  scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
}
/* sky dome + stars */
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: V(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow; varying vec3 vP;
  void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0., 1.); vec3 c = mix(hor, top, pow(h, .5));
    float s = max(dot(d, normalize(sunDir)), 0.); c += sunCol * (pow(s, 900.) * 6. + pow(s, 10.) * .3 * glow);
    if (d.y < 0.) c = hor; gl_FragColor = vec4(c, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
}));
sky.frustumCulled = false; sky.renderOrder = -2; sky.userData.noSketch = sky.userData.noInk = true;
scene.add(sky);
const starGeo = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 900; i++) { const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * r * 760, y * 760, Math.sin(a) * r * 760); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
stars.frustumCulled = false; stars.renderOrder = -1; stars.userData.noSketch = stars.userData.noInk = true;
scene.add(stars);

/* ================= materials ================= */
const C = {
  grass: '#ffffff', asphalt: '#55585e', line: '#efece3', side: '#d6d0c2', pave: '#cfc6b4', sand: '#dacba9',
  wall: '#f3f1ec', wall2: '#e7e2d8', slab: '#d4d0c8', slab2: '#b7b2a9', wood: '#9a6b45', deck: '#a77a52',
  groof: '#6f8f4a', coping: '#e8e3d8', fence: '#8a7f72', trunk: '#6b4f37', leaf: '#6f9150', leaf2: '#88a65d',
  ptrunk: '#8c7558', palm: '#5e8a3e', pine: '#3f6340', table: '#f0ece4', parasol: '#ebdfc6', parasol2: '#c4643f',
  lamp: '#33363a', curb: '#bdb6a8'
};
const MAT = {};
for (const [k, c] of Object.entries(C)) MAT[k] = new THREE.MeshLambertMaterial({ color: c });
{ // grass: tiled procedural texture
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#7d9a58'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(60,90,40,${0.08 + rnd() * 0.12})` : `rgba(170,190,110,${0.06 + rnd() * 0.1})`; const r = 2 + rnd() * 9; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, r, 0, 7); g.fill(); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '50,75,35' : '190,205,130'},0.25)`; g.fillRect(rnd() * 256, rnd() * 256, 1, 2 + rnd() * 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 60); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  MAT.grass.map = t;
}
function canvasTex(size, draw, rx = 1, ry = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function marble(base, vein, blot) {
  return (g, n) => {
    g.fillStyle = base; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) { g.fillStyle = blot.replace('A', (0.04 + rnd() * 0.08).toFixed(2)); g.beginPath(); g.arc(rnd() * n, rnd() * n, 10 + rnd() * 50, 0, 7); g.fill(); }
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = vein.replace('A', (0.15 + rnd() * 0.35).toFixed(2)); g.lineWidth = 0.6 + rnd() * 2.2;
      g.beginPath(); let x = rnd() * n, y = 0; g.moveTo(x, y);
      while (y < n) { const nx = x + (rnd() - 0.5) * 60, ny = y + 15 + rnd() * 40; g.quadraticCurveTo(x + (rnd() - 0.5) * 40, (y + ny) / 2, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
  };
}
MAT.marbleL = new THREE.MeshLambertMaterial({ map: canvasTex(256, marble('#e6e4df', 'rgba(110,112,118,A)', 'rgba(150,150,155,A)')) });
MAT.marbleD = new THREE.MeshStandardMaterial({ map: canvasTex(256, marble('#3b3c40', 'rgba(225,225,228,A)', 'rgba(15,15,18,A)')), roughness: 0.35, metalness: 0.1 });
MAT.woodS = new THREE.MeshLambertMaterial({ map: canvasTex(128, (g, n) => { for (let x = 0; x < n; x += 4) { g.fillStyle = `hsl(${28 + rnd() * 6},${45 + rnd() * 15}%,${42 + rnd() * 12}%)`; g.fillRect(x, 0, 4, n); g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(x + 3, 0, 1, n); } }, 4, 1) });
MAT.stoneT = new THREE.MeshLambertMaterial({ map: canvasTex(128, (g, n) => { g.fillStyle = '#9d9b97'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 32) for (let x = 0; x < n; x += 64) { g.fillStyle = `hsl(30,3%,${52 + rnd() * 10}%)`; g.fillRect(x + ((y / 32) % 2) * 32 + 1, y + 1, 62, 30); } }, 6, 2) });
MAT.waterC = new THREE.MeshStandardMaterial({ map: canvasTex(256, (g, n) => {
  const pal = ['#1e8fb5', '#2aa3c4', '#38b6cf', '#1679a3', '#47c3d6', '#2b9cbc', '#5fd0dd'];
  g.fillStyle = '#9fd3df'; g.fillRect(0, 0, n, n);
  for (let y = 0; y < n; y += 16) for (let x = 0; x < n; x += 16) { g.fillStyle = pal[Math.floor(rnd() * pal.length)]; g.fillRect(x + 1, y + 1, 14, 14); }
}, 12, 4), color: '#bfe6ef', roughness: 0.08, metalness: 0.05, emissive: '#06384a', emissiveIntensity: 0.35 });
MAT.glassC = new THREE.MeshStandardMaterial({ color: '#a9bcc6', roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0.32, depthWrite: false });
MAT.woodIn = new THREE.MeshLambertMaterial({ map: MAT.woodS.map, emissiveMap: MAT.woodS.map, emissive: '#ffffff', emissiveIntensity: 0.45 });
MAT.floorIn = new THREE.MeshLambertMaterial({ map: MAT.marbleL.map, emissive: '#6b5a44', emissiveIntensity: 0.35 });
MAT.rail = new THREE.MeshStandardMaterial({ color: '#d7ecef', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false });
MAT.gold = new THREE.MeshStandardMaterial({ color: '#e0b25a', roughness: 0.22, metalness: 1, emissive: '#3a2506', emissiveIntensity: 0.4 });
MAT.led = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
MAT.flame = new THREE.MeshBasicMaterial({ color: '#ff9a3c' });
MAT.metal = new THREE.MeshLambertMaterial({ color: '#1d1e21' });
MAT.sofa = new THREE.MeshLambertMaterial({ color: '#efe9de' });
MAT.rock = new THREE.MeshLambertMaterial({ color: '#6f6d6a', flatShading: true });
MAT.glass = new THREE.MeshStandardMaterial({ color: '#3b4a55', roughness: 0.15, metalness: 0.6 });
MAT.glassLit = new THREE.MeshStandardMaterial({ color: '#3b4a55', roughness: 0.15, metalness: 0.6, emissive: '#ffc77a', emissiveIntensity: 0 });
MAT.water = new THREE.MeshStandardMaterial({ color: '#4fb6cc', roughness: 0.08, metalness: 0.1, emissive: '#0b3d4a', emissiveIntensity: 0.4 });
MAT.bulb = new THREE.MeshBasicMaterial({ color: '#efe8d6' });
for (const ax of ['x', 'z']) for (const c of ['r', 'a', 'g']) MAT['tl' + ax + c] = new THREE.MeshBasicMaterial({ color: '#222' });
MAT.car = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 });
MAT.head = new THREE.MeshBasicMaterial({ color: '#d8d4c8' });
MAT.tail = new THREE.MeshBasicMaterial({ color: '#5a1010' });
MAT.brake = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
const NO_SHADOW = new Set(['led', 'flame', 'rail', 'waterC', 'stoneT', 'glassC', 'floorIn', 'asphalt', 'line', 'side', 'pave', 'sand', 'water', 'grass', 'bulb', 'curb', 'tlxr', 'tlxa', 'tlxg', 'tlzr', 'tlza', 'tlzg']);
const matCache = {};
const lam = hex => (matCache[hex] ||= new THREE.MeshLambertMaterial({ color: hex }));

/* ================= world builder ================= */
const buckets = {};
const solids = [];            // [x0,z0,x1,z1,h]
const pools = [];             // [x0,z0,x1,z1]
const doors = [];
const lots = [];
const lampPos = [];
const parkedSpots = [];
function put(key, geo, m) { if (m) geo.applyMatrix4(m); if (geo.index) geo = geo.toNonIndexed(); (buckets[key] ||= []).push(geo); }
function box(key, x0, x1, y0, y1, z0, z1, m) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); put(key, g, m);
}
function solid(x0, x1, z0, z1, h, kind) { solids.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), h, kind]); }
function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(sx, sy, sz));
}

function tree(x, z, s = 1) {
  put('trunk', new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.6 * s, 6), mat4(x, 1.3 * s, z));
  put(rnd() < 0.5 ? 'leaf' : 'leaf2', new THREE.IcosahedronGeometry(1.7 * s, 1), mat4(x, 3.5 * s, z, 0, rnd() * 6, 0, 1, 0.85, 1));
  put('leaf', new THREE.IcosahedronGeometry(1.1 * s, 0), mat4(x + 0.8 * s, 2.9 * s, z + 0.4 * s, 0, rnd() * 6));
  solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 4);
}
function palm(x, z, h = 6) {
  const lean = (rnd() - 0.5) * 0.12;
  put('ptrunk', new THREE.CylinderGeometry(0.14, 0.24, h, 7), mat4(x, h / 2, z, lean, 0, lean));
  const top = V(x + Math.sin(lean) * h / 2, h, z - Math.sin(lean) * h / 2);
  const n = 11, a0 = rnd() * 6;
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * Math.PI * 2;
    const g = new THREE.BoxGeometry(2.8, 0.04, 0.42); g.translate(1.4, 0, 0);
    put('palm', g, new THREE.Matrix4().makeTranslation(top.x, top.y, top.z).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationZ(-0.5 - rnd() * 0.35)));
  }
  solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 4);
}
function pine(x, z, h = 9) {
  put('trunk', new THREE.CylinderGeometry(0.15, 0.3, h * 0.35, 6), mat4(x, h * 0.17, z));
  for (let i = 0; i < 4; i++) {
    const r = (1 - i / 4.6) * h * 0.28, y = h * 0.25 + i * h * 0.18;
    put('pine', new THREE.ConeGeometry(r, h * 0.32, 8), mat4(x, y + h * 0.16, z, 0, rnd() * 6));
  }
  solid(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 4);
}

const BX = [-130, 0, 130], BZ = [-70, 0, 70];
const RX = [-195, -65, 65, 195], RZ = [-105, -35, 35, 105];
const ROADX = ['Rue Harper', 'Rue Chloé', 'Rue Céline', 'Rue Margaux'];
const ROADZ = ['Allée des Pins', 'Avenue Red Stone', 'Avenue des Palmiers', 'Allée du Lac'];
const VILLAS = [['Chloé', 'villa-chloe.html'], ['Céline', 'villa-celine.html'], ['Margaux', 'villa-margaux.html']];
const LW = 23.2, LD = 28, EXT = 250, ZEXT = 150;
const nearInt = (v, list, d) => list.some(r => Math.abs(v - r) < d);

put('grass', new THREE.BoxGeometry(EXT * 2 + 120, 0.2, 420).translate(0, -0.1, 0));
for (const z of RZ) {
  box('asphalt', -EXT - 20, EXT + 20, 0, 0.02, z - 5, z + 5);
  for (let x = -EXT; x < EXT; x += 8) if (!nearInt(x + 1.5, RX, 10)) box('line', x, x + 3, 0.02, 0.03, z - 0.1, z + 0.1);
}
for (const x of RX) {
  box('asphalt', x - 5, x + 5, 0, 0.021, -ZEXT - 20, ZEXT + 20);
  for (let z = -ZEXT; z < ZEXT; z += 8) if (!nearInt(z + 1.5, RZ, 10)) box('line', x - 0.1, x + 0.1, 0.02, 0.031, z, z + 3);
}
// crosswalks + traffic lights
for (const rx of RX) for (const rz of RZ) {
  for (const sx of [-1, 1]) for (let k = -4; k <= 4; k++) box('line', rx + sx * 6.5, rx + sx * 8.5, 0.021, 0.032, rz + k - 0.22, rz + k + 0.22);
  for (const sz of [-1, 1]) for (let k = -4; k <= 4; k++) box('line', rx + k - 0.22, rx + k + 0.22, 0.022, 0.033, rz + sz * 6.5, rz + sz * 8.5);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = rx + sx * 6.1, pz = rz + sz * 6.1;
    put('lamp', new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), mat4(px, 2.1, pz));
    solid(px - 0.2, px + 0.2, pz - 0.2, pz + 0.2, 4.2);
    for (const [ax, ox, oz] of [['x', 0, 0], ['z', 0.38 * -sx, 0.38 * -sz]]) {
      const hx = px + ox, hz = pz + oz;
      box('lamp', hx - 0.17, hx + 0.17, 3.35, 4.35, hz - 0.17, hz + 0.17);
      box('tl' + ax + 'r', hx - 0.2, hx + 0.2, 4.05, 4.27, hz - 0.2, hz + 0.2);
      box('tl' + ax + 'a', hx - 0.2, hx + 0.2, 3.75, 3.97, hz - 0.2, hz + 0.2);
      box('tl' + ax + 'g', hx - 0.2, hx + 0.2, 3.45, 3.67, hz - 0.2, hz + 0.2);
    }
  }
}
// street lamps on every road
function lamp(lx, lz, ax, az) {
  put('lamp', new THREE.CylinderGeometry(0.07, 0.11, 5.2, 6), mat4(lx, 2.6, lz));
  box('lamp', Math.min(lx, lx + ax * 1.4) - 0.07, Math.max(lx, lx + ax * 1.4) + 0.07, 5.1, 5.25, Math.min(lz, lz + az * 1.4) - 0.07, Math.max(lz, lz + az * 1.4) + 0.07);
  const hx = lx + ax * 1.4, hz = lz + az * 1.4;
  box('lamp', hx - 0.3, hx + 0.3, 5.0, 5.15, hz - 0.22, hz + 0.22);
  box('bulb', hx - 0.24, hx + 0.24, 4.93, 5.0, hz - 0.17, hz + 0.17);
  solid(lx - 0.15, lx + 0.15, lz - 0.15, lz + 0.15, 5);
  lampPos.push([hx, hz]);
}
for (const z of RZ) for (let x = -EXT + 10; x <= EXT - 10; x += 34) if (!nearInt(x, RX, 11)) { lamp(x, z - 5.7, 0, 1); lamp(x + 17, z + 5.7, 0, -1); }
for (const x of RX) for (let z = -ZEXT + 10; z <= ZEXT - 10; z += 34) if (!nearInt(z, RZ, 11) && !nearInt(z + 17, RZ, 11)) { lamp(x - 5.7, z, 1, 0); lamp(x + 5.7, z + 17, -1, 0); }

function block(cx, cz) {
  box('side', cx - 60, cx + 60, 0, 0.1, cz - 30, cz - 28); box('side', cx - 60, cx + 60, 0, 0.1, cz + 28, cz + 30);
  box('side', cx - 60, cx - 58, 0, 0.1, cz - 28, cz + 28); box('side', cx + 58, cx + 60, 0, 0.1, cz - 28, cz + 28);
  box('curb', cx - 60.1, cx + 60.1, 0, 0.13, cz - 30.1, cz - 29.95); box('curb', cx - 60.1, cx + 60.1, 0, 0.13, cz + 29.95, cz + 30.1);
  box('curb', cx - 60.1, cx - 59.95, 0, 0.13, cz - 30, cz + 30); box('curb', cx + 59.95, cx + 60.1, 0, 0.13, cz - 30, cz + 30);
}

function lot(lx, front, dir, idx) {
  const ry = dir > 0 ? 0 : Math.PI, B = mat4(lx, 0, front, 0, ry);
  const s = rnd() < 0.5 ? 1 : -1;
  const lb = (k, u0, u1, y0, y1, v0, v1) => box(k, s * u0, s * u1, y0, y1, v0, v1, B);
  const W = (u, v) => V(s * u, 0, v).applyMatrix4(B);
  const rect = (u0, u1, v0, v1) => { const a = W(u0, v0), b = W(u1, v1); return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)]; };
  const ls = (u0, u1, v0, v1, h) => { const r = rect(u0, u1, v0, v1); solid(r[0], r[2], r[1], r[3], h); };
  const [vname, vurl] = VILLAS[idx % 3];
  if (vname === 'Céline') return celine(ry, s, B, lb, W, rect, ls, vname, vurl);
  const gl = rnd() < 0.65 ? 'glassLit' : 'glass';

  lb('wall2', -11.6, 4.5, 0, 0.9, 0, 0.25); ls(-11.6, 4.5, 0, 0.25, 0.9);
  lb('wall2', 9.5, 11.6, 0, 0.9, 0, 0.25); ls(9.5, 11.6, 0, 0.25, 0.9);
  lb('pave', 5, 9, 0, 0.05, 0, 6);
  lb('pave', 1.2, 3.2, 0, 0.05, 0.25, 6);
  lb('wall', -8, 4, 0, 3.1, 6, 16); ls(-8, 4, 6, 16, 6.9);
  lb(gl, -6.5, -1.5, 0.4, 2.7, 5.94, 6);
  lb('wood', 1.5, 2.8, 0, 2.45, 5.94, 6);
  lb(gl, -7, 3, 0.3, 2.8, 16, 16.06);
  lb('wood', 4, 4.06, 0, 3.1, 7, 15);
  lb('slab', -9, 5, 3.1, 3.4, 5, 16.6);
  lb('wall', -5, 7, 3.4, 6.4, 7, 15.5);
  for (let u = -4.85; u < 1; u += 0.3) lb('wood', u, u + 0.13, 3.4, 6.4, 6.84, 7);
  lb(gl, 1.6, 6.4, 3.7, 6.05, 6.94, 7);
  lb(gl, -4, 6, 3.7, 6.1, 15.5, 15.56);
  lb('glass', 7, 7.06, 3.9, 5.9, 8.5, 13.5);
  lb('slab', -6, 8, 6.4, 6.7, 6, 16.5);
  const green = rnd() < 0.75;
  lb(green ? 'groof' : 'slab2', -5.6, 7.6, 6.7, 6.82, 6.4, 16.1);
  lb('deck', -8, 4, 0, 0.15, 16, 19.5);
  // pool: coping ring + water (swimmable)
  lb('coping', -7.5, 1.5, 0, 0.2, 19.5, 20); lb('coping', -7.5, 1.5, 0, 0.2, 24.5, 25);
  lb('coping', -7.5, -7, 0, 0.2, 20, 24.5); lb('coping', 1, 1.5, 0, 0.2, 20, 24.5);
  lb('water', -7, 1, -1.2, 0.18, 20, 24.5);
  pools.push(rect(-7, 1, 20, 24.5)); { const pr = rect(-7.5, 1.5, 19.5, 25); solid(pr[0], pr[2], pr[1], pr[3], 0.3, 'pool'); }
  for (const u of [2.4, 3.6]) { lb('table', u, u + 0.75, 0, 0.35, 20.5, 22.5); }
  const t = W(-9.3, 3.2); tree(t.x, t.z, 0.8 + rnd() * 0.4);
  const p = W(8.6, 24.5); rnd() < 0.6 ? palm(p.x, p.z, 5 + rnd() * 2.5) : tree(p.x, p.z, 0.9);
  if (rnd() < 0.5) { const c = W(7, 3.2); parkedSpots.push([c.x, c.z, ry + (rnd() < 0.5 ? 0 : Math.PI)]); }
  const d = W(2.15, 4.6);
  const door = { x: d.x, z: d.z, name: vname, url: vurl, n: lots.length + 1 };
  doors.push(door);
  const r = rect(-11.6, 11.6, 0, LD);
  lots.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], name: vname, n: lots.length + 1, door, green, roof: W(1, 11), pool: W(-3, 22.2), house: rect(-8, 4, 6, 16), upper: rect(-5, 7, 7, 15.5), poolR: rect(-7, 1, 20, 24.5) });
}
// Villa Céline, after the architect's renders: L-shaped two-storey glass villa, black marble bands with
// warm LED lines, wood soffits, marble pillars, mosaic pool facing the garden with the gold sculpture.
function bananaPlant(x, z, sc = 1) {
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + rnd(), g = new THREE.BoxGeometry(0.42 * sc, 0.03, 1.5 * sc); g.translate(0, 0, 0.75 * sc);
    put('leaf2', g, new THREE.Matrix4().makeTranslation(x, 0.25, z).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeRotationX(-0.75 - rnd() * 0.4)));
  }
  put('trunk', new THREE.CylinderGeometry(0.06, 0.09, 0.8 * sc, 5), mat4(x, 0.4 * sc, z));
}
function celine(ry, s, B, lb, W, rect, ls, vname, vurl) {
  const P3 = (u, y, v) => V(s * u, y, v);
  // front: low black stone wall with a gate, stepping stones over the lawn
  lb('marbleD', -11.6, 7.4, 0, 0.45, 0, 0.35); ls(-11.6, 7.4, 0, 0.35, 0.45);
  lb('led', -11.6, 7.4, 0.36, 0.39, -0.02, 0);
  for (let i = 0, v = 0.9; v < 12.4; i++, v += 1.05) { const u = 9.4 + (i % 2) * 0.9; put('rock', new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), mat4(...P3(u, 0.03, v).applyMatrix4(B).toArray())); }
  for (const [u, v] of [[-2, 2.2], [-0.8, 3.1], [0.6, 3.8], [2.1, 4.4], [3.6, 4.9], [5.2, 5.3]]) { const p = W(u, v); put('rock', new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12), mat4(p.x, 0.025, p.z)); }
  for (const [u, v, r] of [[-5.6, 3.4, 0.7], [-4.7, 3.9, 0.45], [-6.3, 4.1, 0.38], [4.2, 2.2, 0.5]]) { const p = W(u, v); put('rock', new THREE.IcosahedronGeometry(r, 0), mat4(p.x, r * 0.55, p.z, rnd(), rnd() * 6, 0, 1.3, 0.8, 1)); }
  for (const [u, v, r] of [[-8.5, 4.6, 0.55], [-2.8, 5.3, 0.45], [1.5, 5.7, 0.5], [6.8, 3.6, 0.6], [-9.6, 5.6, 0.4], [7.6, 5.4, 0.42]]) { const p = W(u, v); put('leaf', new THREE.IcosahedronGeometry(r, 1), mat4(p.x, r * 0.8, p.z)); }
  { const p = W(-8.6, 2.6); bananaPlant(p.x, p.z, 1.2); const q = W(5.6, 5.6); bananaPlant(q.x, q.z, 1); }
  { const p = W(-10.6, 1.4); pine(p.x, p.z, 13); }
  // pool (mosaic) with black marble coping
  lb('marbleD', -10.8, 9.5, 0, 0.22, 6.2, 6.5); lb('marbleD', -10.8, 9.5, 0, 0.22, 12.8, 13.1);
  lb('marbleD', -10.8, -10.5, 0, 0.22, 6.5, 12.8); lb('marbleD', 9.2, 9.5, 0, 0.22, 6.5, 12.8);
  lb('led', -10.8, 9.5, 0.16, 0.2, 6.17, 6.2);
  lb('waterC', -10.5, 9.2, -1.2, 0.17, 6.5, 12.8);
  pools.push(rect(-10.5, 9.2, 6.5, 12.8)); { const pr = rect(-10.8, 9.5, 6.2, 13.1); solid(pr[0], pr[2], pr[1], pr[3], 0.3, 'pool'); }
  // island + gold sculpture
  lb('marbleD', -2.3, 0.3, 0, 0.5, 8.6, 10.9); ls(-2.3, 0.3, 8.6, 10.9, 0.5);
  lb('led', -2.33, 0.33, 0.42, 0.46, 8.57, 10.93);
  const cx = -1, cv = 9.75;
  const tube = (pts, r) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([u, y, v]) => P3(cx + u, y, cv + v)));
    put('gold', new THREE.TubeGeometry(curve, 90, r, 8, false), B);
  };
  tube([[0, 0.5, 0], [0.3, 1.0, 0.25], [-0.3, 1.6, 0], [0.3, 2.1, -0.25], [0.7, 2.6, 0.1], [0.15, 3.05, 0.35], [-0.5, 2.85, 0.05], [-1.2, 2.5, -0.2], [-2.0, 2.75, 0.1], [-2.7, 2.5, 0.25]], 0.24);
  tube([[0.1, 0.5, 0.1], [-0.35, 1.2, 0], [0.15, 1.9, 0.25], [0.9, 2.25, 0.05], [1.7, 2.15, -0.15], [2.3, 2.35, 0]], 0.15);
  // freestanding marble pillar at the pool corner
  const pillar = (u0, u1, v0, v1, h) => {
    lb('marbleL', u0, u1, 0, h, v0, v1); ls(u0, u1, v0, v1, h);
    lb('marbleD', u0 + 0.3, u1 - 0.3, 0.3, h - 0.3, v0 - 0.03, v0);
    lb('gold', (u0 + u1) / 2 - 0.02, (u0 + u1) / 2 + 0.02, 0.3, h - 0.3, v0 - 0.05, v0 - 0.03);
  };
  pillar(-11.4, -10.6, 5.4, 6.2, 6.6);
  // terrace + lounges with fire tables
  lb('stoneT', -10.8, 10.6, 0, 0.22, 13.1, 16.1);
  const lounge = (u0, u1) => {
    lb('sofa', u0, u1, 0.22, 0.62, 14.7, 15.6); lb('sofa', u0, u1, 0.62, 1.15, 15.25, 15.6);
    for (let u = u0 + 0.1; u < u1 - 0.5; u += 0.75) lb('sofa', u, u + 0.6, 0.62, 0.8, 14.75, 15.2);
    ls(u0, u1, 14.7, 15.6, 0.62);
    const m = (u0 + u1) / 2;
    lb('marbleL', m - 0.9, m + 0.9, 0.22, 0.6, 13.4, 14.1); ls(m - 0.9, m + 0.9, 13.4, 14.1, 0.6);
    for (let k = -2; k <= 2; k++) { const p = P3(m + k * 0.3, 0.75, 13.75).applyMatrix4(B); put('flame', new THREE.ConeGeometry(0.1, 0.32 + (k % 2 ? 0.1 : 0), 6), mat4(p.x, p.y, p.z)); }
    for (const du of [-1.6, 1.6]) { const p = P3(m + du, 0.22, 13.8).applyMatrix4(B); put('sofa', new THREE.CylinderGeometry(0.42, 0.36, 0.75, 12), mat4(p.x, 0.6, p.z)); }
  };
  lounge(-9.4, -5.4); lounge(2.6, 7.8);
  // glass core (warm interior) + mullions
  lb('glassC', -10.2, 10, 0.22, 3.7, 16.1, 25.5); ls(-10.2, 10, 16.1, 25.5, 9);
  lb('glassC', -10.2, 10, 4.4, 7.3, 16.8, 25.5);
  for (let u = -10.1; u <= 9.95; u += 1.6) { lb('metal', u, u + 0.07, 0.22, 3.7, 16.02, 16.1); lb('metal', u, u + 0.07, 4.4, 7.3, 16.72, 16.8); }
  // interior seen through the glass: warm wood walls, marble floors, lit shelves, stairs, sofas, pendants
  for (const [y0, y1, vb] of [[0.22, 3.6, 25.3], [4.4, 7.3, 25.3]]) {
    lb('woodIn', -10.1, 9.9, y0, y1, vb, vb + 0.15);
    lb('woodIn', -10.1, -9.95, y0, y1, 16.2, 25.3); lb('woodIn', 9.75, 9.9, y0, y1, 16.2, 25.3);
    lb('floorIn', -10.1, 9.9, y0, y0 + 0.02, 16.1, 25.3);
    lb('woodIn', -10.1, 9.9, y1 - 0.06, y1, 16.1, 25.3);
  }
  lb('woodIn', -1.9, 0.3, 0.22, 7.3, 21, 21.2); // stair wall
  for (let i = 0; i < 10; i++) lb('marbleL', -1.8, 0.2, 0.22 + i * 0.4, 0.34 + i * 0.4, 17.2 + i * 0.35, 17.6 + i * 0.35);
  for (const [u0, u1] of [[-9.6, -6.4], [4.2, 7.4]]) {
    lb('metal', u0, u1, 0.22, 3.4, 24.9, 25.3);
    for (let y = 0.7; y < 3.3; y += 0.62) { lb('led', u0 + 0.05, u1 - 0.05, y, y + 0.03, 24.85, 24.9); lb('table', u0 + 0.3 + rnd() * (u1 - u0 - 0.8), u0 + 0.5 + rnd() * 0.3 + (u1 - u0 - 0.8) * 0.5, y + 0.03, y + 0.38, 24.95, 25.2); }
  }
  lb('sofa', -8.5, -3.5, 0.22, 0.65, 21.5, 22.4); lb('sofa', -8.5, -3.5, 0.65, 1.1, 22.1, 22.4);
  lb('sofa', 3.5, 8.8, 4.42, 4.85, 21.5, 22.4); lb('sofa', 3.5, 8.8, 4.85, 5.3, 22.1, 22.4);
  for (const [u, v, y] of [[-3.2, 18, 3.1], [-2.6, 18.6, 2.6], [-3.6, 19.1, 2.85], [-2.9, 19.7, 2.4], [-3.4, 18.3, 2.2]]) { const p = P3(u, y, v).applyMatrix4(B); put('led', new THREE.SphereGeometry(0.16, 10, 8), mat4(p.x, p.y, p.z)); put('metal', new THREE.CylinderGeometry(0.008, 0.008, 3.55 - y, 3), mat4(p.x, (3.55 + y) / 2, p.z)); }
  // middle bands: black marble fascia over wood soffit, warm LED line, glass balustrade
  const band = (u0, u1, vf, y0, y1) => {
    lb('woodS', u0, u1, y0, y0 + 0.14, vf, 25.8);
    lb('marbleD', u0, u1, y0 + 0.14, y1, vf, 25.8);
    lb('led', u0, u1, y0 + 0.36, y0 + 0.41, vf - 0.03, vf);
    lb('rail', u0 + 0.05, u1 - 0.05, y1, y1 + 1.0, vf + 0.02, vf + 0.08);
  };
  band(-10.9, 0.3, 14.6, 3.6, 4.4); band(1.8, 10.9, 13.3, 3.6, 4.4);
  for (const [u, v] of [[-9.6, 15.2], [-4.4, 15.2], [3.0, 13.9], [9.6, 13.9]]) { const p = P3(u, 0, v).applyMatrix4(B); put('table', new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), mat4(p.x, 4.65, p.z)); put('leaf', new THREE.IcosahedronGeometry(0.5, 1), mat4(p.x, 5.2, p.z)); }
  // central wood slat tower
  lb('woodS', 0.3, 1.8, 0, 8.2, 15.95, 25.6); ls(0.3, 1.8, 15.95, 25.6, 9);
  for (let u = 0.34; u < 1.78; u += 0.22) lb('wood', u, u + 0.1, 0, 8.2, 15.8, 15.95);
  // roofs: deep wood soffits, black fascia, LED line
  const roof = (u0, u1, vf, y0, y1, side) => {
    lb('woodS', u0, u1, y0, y0 + 0.2, vf, 26.3);
    lb('marbleD', u0, u1, y0 + 0.2, y1, vf, 26.3);
    lb('led', u0, u1, y0 + 0.42, y0 + 0.48, vf - 0.03, vf);
    lb('led', side, side + (side < 0 ? -0.03 : 0.03), y0 + 0.42, y0 + 0.48, vf, 26.3);
    lb('slab2', u0 + 0.3, u1 - 0.3, y1, y1 + 0.05, vf + 0.3, 26);
  };
  roof(-11.4, 0.8, 13.8, 7.3, 8.0, -11.4); roof(0.8, 11.4, 12.6, 7.7, 8.5, 11.4);
  // marble pillars carrying the roofs
  pillar(-11.2, -10.2, 13.9, 14.9, 7.3); pillar(9.6, 10.5, 12.7, 13.6, 7.7); pillar(-0.2, 0.3, 13.9, 14.6, 7.3);
  const d = W(1.05, 15.1);
  const door = { x: d.x, z: d.z, name: vname, url: vurl, n: lots.length + 1 };
  doors.push(door);
  const r = rect(-11.6, 11.6, 0, LD);
  lots.push({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], name: vname, n: lots.length + 1, door, green: false, roof: W(0, 20), pool: W(-4, 9.7), house: rect(-10.2, 10, 16, 25.5), upper: rect(-10.2, 10, 16.8, 25.5), poolR: rect(-10.5, 9.2, 6.5, 12.8), celine: true });
}
function fence(x0, z0, x1, z1) {
  const t = 0.1;
  if (x0 === x1) box('fence', x0 - t / 2, x0 + t / 2, 0, 1.6, z0, z1); else box('fence', x0, x1, 0, 1.6, z0 - t / 2, z0 + t / 2);
  solid(x0 - t, x1 + t, z0 - t, z1 + t, 1.7);
}
let villaIdx = 0;
for (const cz of BZ) for (const cx of BX) {
  block(cx, cz);
  if (cx === 0 && cz === 0) continue;
  for (let i = 0; i < 5; i++) {
    const lx = cx - 58 + LW / 2 + i * LW;
    lot(lx, cz - 28, 1, villaIdx++);
    lot(lx, cz + 28, -1, villaIdx++);
  }
  for (let k = 0; k <= 5; k++) { const x = cx - 58 + k * LW; fence(x, cz - 27.8, x, cz + 27.8); }
  fence(cx - 58, cz, cx + 58, cz);
  for (let k = 1; k < 5; k++) { const x = cx - 58 + k * LW; palm(x, cz - 29, 6 + rnd() * 2); palm(x, cz + 29, 6 + rnd() * 2); }
}

// central park
const parkCurves = [];
function ribbon(key, pts, w, y = 0.06) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)));
  parkCurves.push(curve);
  const N = 120, pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N), tg = curve.getTangentAt(i / N), n = V(-tg.z, 0, tg.x).multiplyScalar(w / 2);
    pos.push(p.x + n.x, y, p.z + n.z, p.x - n.x, y, p.z - n.z); nor.push(0, 1, 0, 0, 1, 0); uv.push(0, i / N, 1, i / N);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  put(key, g);
}
ribbon('sand', [[-58, -18], [-40, -12], [-22, -19], [-6, -12], [-2, 2], [8, 14], [26, 16], [40, 8], [58, 14]], 3.2);
ribbon('sand', [[14, -28], [22, -16], [28, -10], [24, 4], [12, 12], [4, 28]], 2.6, 0.065);
ribbon('sand', [[-58, 20], [-44, 14], [-30, 18], [-16, 22], [-4, 28]], 2.4, 0.062);
const ponds = [];
const pond = (x, z, rx, rz) => {
  put('coping', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), mat4(x, 0.07, z, 0, 0, 0, rx + 1, 1, rz + 1));
  put('water', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), mat4(x, 0.09, z, 0, 0, 0, rx, 1, rz));
  solid(x - rx * 0.8, x + rx * 0.8, z - rz * 0.8, z + rz * 0.8, 0.6);
  ponds.push([x, z, rx, rz]);
};
pond(-30, 4, 13, 7); pond(-12, 8, 5, 4);
box('deck', -20, -14, 0.1, 0.35, 0.5, 2.6); solid(-20, -14, 0.5, 2.6, 0.35);
put('pave', new THREE.CircleGeometry(10, 40).rotateX(-Math.PI / 2), mat4(32, 0.07, -8));
for (let i = 0; i < 7; i++) {
  const a = i / 7 * Math.PI * 2, x = 32 + Math.cos(a) * 6, z = -8 + Math.sin(a) * 6;
  put('table', new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), mat4(x, 0.75, z));
  put('lamp', new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat4(x, 1.2, z));
  put(i % 2 ? 'parasol' : 'parasol2', new THREE.ConeGeometry(1.5, 0.55, 10), mat4(x, 2.45, z));
  for (let j = 0; j < 3; j++) { const b = a + j * 2.1; put('table', new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), mat4(x + Math.cos(b) * 0.95, 0.22, z + Math.sin(b) * 0.95)); }
  solid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0.8);
}
put('wood', new THREE.CylinderGeometry(1.8, 1.8, 0.45, 20), mat4(32, 0.22, -8)); solid(30.5, 33.5, -9.5, -6.5, 0.45);
tree(32, -8, 1.3);
for (const [x, z, r] of [[-40, -9, 0.3], [-10, -16, -0.2], [6, 18, 0.5], [44, 12, -0.3], [-22, 20, 0.1]]) {
  put('wood', new THREE.BoxGeometry(2.2, 0.12, 0.6).translate(0, 0.5, 0), mat4(x, 0, z, 0, r));
  put('wood', new THREE.BoxGeometry(2.2, 0.5, 0.1).translate(0, 0.8, 0.28), mat4(x, 0, z, 0, r));
}
for (let i = 0; i < 46; i++) {
  const x = -55 + rnd() * 110, z = -25 + rnd() * 50;
  if (Math.hypot((x + 30) / 15, (z - 4) / 9) < 1 || Math.hypot(x - 32, z + 8) < 12 || Math.hypot(x + 12, z - 8) < 6 || Math.hypot(x - 23, z + 2) < 4) continue;
  rnd() < 0.35 ? palm(x, z, 5 + rnd() * 3) : tree(x, z, 0.8 + rnd() * 0.6);
}
for (let x = -50; x <= -36; x += 3.5) { box('wood', x - 0.15, x + 0.15, 0, 2.8, -26.5, -26.2); box('wood', x - 0.15, x + 0.15, 0, 2.8, -22.5, -22.2); solid(x - 0.2, x + 0.2, -26.6, -26.1, 2.8); solid(x - 0.2, x + 0.2, -22.6, -22.1, 2.8); }
for (let x = -50.3; x <= -35.7; x += 0.6) box('wood', x, x + 0.12, 2.8, 2.95, -27, -21.7);
// agency kiosk (mission giver)
box('wall', 19, 23, 0, 2.8, -6.5, -4.5); box('slab', 18.5, 23.5, 2.8, 3, -7, -4); box('wood', 19.2, 22.8, 0, 1.1, -4.5, -4.3);
solid(19, 23, -6.5, -4.3, 3);

for (let i = 0; i < 280; i++) {
  const x = (rnd() * 2 - 1) * 290, z = (rnd() * 2 - 1) * 195;
  if (Math.abs(x) < 202 && Math.abs(z) < 112) continue;
  if (RX.some(r => Math.abs(x - r) < 8) || RZ.some(r => Math.abs(z - r) < 8)) continue;
  if (Math.abs(z) > 112 && Math.abs(z) < 132 && Math.abs(Math.abs(x) - 130) < 34) continue;
  rnd() < 0.8 ? pine(x, z, 8 + rnd() * 7) : palm(x, z, 6 + rnd() * 3);
}
const parkings = [[-130, -122], [130, 122]];
for (const [px, pz] of parkings) {
  box('asphalt', px - 30, px + 30, 0, 0.02, pz - 7, pz + 7);
  for (let x = px - 28; x <= px + 28; x += 3.2) { box('line', x, x + 0.1, 0.02, 0.03, pz - 7, pz - 1); if (rnd() < 0.5) parkedSpots.push([x + 1.6, pz - 4, rnd() < 0.5 ? 0 : Math.PI]); }
}

const worldMeshes = [];
for (const [k, list] of Object.entries(buckets)) {
  const mesh = new THREE.Mesh(mergeGeometries(list), MAT[k]);
  mesh.receiveShadow = true; mesh.castShadow = !NO_SHADOW.has(k);
  mesh.matrixAutoUpdate = false; mesh.userData.key = k;
  scene.add(mesh); worldMeshes.push(mesh);
}

/* spatial grid for solids */
const GS = 16, grid = new Map();
const gk = (i, j) => i * 1000 + j;
solids.forEach((s, n) => {
  for (let i = Math.floor(s[0] / GS); i <= Math.floor(s[2] / GS); i++) for (let j = Math.floor(s[1] / GS); j <= Math.floor(s[3] / GS); j++) {
    const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(n);
  }
});
let qStamp = 0; const stamp = new Uint32Array(solids.length);
function query(x, z, r, out = []) {
  out.length = 0; qStamp++;
  for (let i = Math.floor((x - r) / GS); i <= Math.floor((x + r) / GS); i++) for (let j = Math.floor((z - r) / GS); j <= Math.floor((z + r) / GS); j++) {
    const l = grid.get(gk(i, j)); if (!l) continue;
    for (const n of l) if (stamp[n] !== qStamp) { stamp[n] = qStamp; out.push(solids[n]); }
  }
  return out;
}

/* ================= vehicles ================= */
const CAR_COLORS = ['#c94b3a', '#2f4a6e', '#e8e6e0', '#2c2c2c', '#b08d57', '#5f6f52', '#8d99a6', '#1f3b33', '#7a1f2b', '#d9cfb8'];
function colorGeo(geo, hex) {
  if (geo.index) geo = geo.toNonIndexed();
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
const carGeoCache = {};
const CAR_KINDS = [
  { L: 4.3, wr: 0.36, light: 0.62, lower: [[-2.15, 0.3], [2.15, 0.3], [2.2, 0.6], [2.05, 0.82], [1.1, 0.92], [-1.6, 0.95], [-2.15, 0.9], [-2.22, 0.6]],
    cabin: [[1.15, 0.9], [0.35, 1.32], [-0.85, 1.32], [-1.55, 0.93]], roof: [[0.38, 1.29], [-0.86, 1.29], [-0.84, 1.36], [0.32, 1.36]] },
  { L: 4.5, wr: 0.42, light: 0.82, lower: [[-2.25, 0.42], [2.25, 0.42], [2.3, 0.75], [2.2, 1.0], [1.3, 1.1], [-2.2, 1.12], [-2.3, 0.8]],
    cabin: [[1.3, 1.08], [0.7, 1.6], [-2.15, 1.62], [-2.2, 1.1]], roof: [[0.72, 1.57], [-2.17, 1.57], [-2.15, 1.66], [0.68, 1.66]] },
  { L: 4.5, wr: 0.36, light: 0.5, lower: [[-2.25, 0.25], [2.25, 0.25], [2.3, 0.5], [2.1, 0.66], [1.0, 0.78], [-1.7, 0.82], [-2.25, 0.8], [-2.3, 0.5]],
    cabin: [[1.05, 0.76], [0.1, 1.12], [-0.9, 1.12], [-1.75, 0.8]], roof: [[0.12, 1.09], [-0.92, 1.09], [-0.9, 1.15], [0.08, 1.15]], spoiler: true }
];
function extrudeSide(pts, w, col) {
  const sh = new THREE.Shape(); pts.forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2);
  g.deleteAttribute('uv'); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return colorGeo(g, col);
}
function carGeos(hex, kind) {
  const key = hex + kind;
  if (carGeoCache[key]) return carGeoCache[key];
  const K = CAR_KINDS[kind], L = K.L, wr = K.wr;
  const parts = [], lights = [], wheelsStatic = [];
  const b = (arr, w, h, l, x, y, z, col) => { const g = new THREE.BoxGeometry(w, h, l); g.translate(x, y, z); arr.push(colorGeo(g, col)); };
  parts.push(extrudeSide(K.lower, 1.86, hex));
  parts.push(extrudeSide(K.cabin, 1.6, '#1b242b'));
  parts.push(extrudeSide(K.roof, 1.64, hex));
  b(parts, 1.9, 0.16, L - 0.2, 0, K.lower[0][1] + 0.05, 0, '#1c1c1c');
  b(parts, 1.7, 0.1, 0.12, 0, K.light - 0.2, L / 2 + 0.02, '#1c1c1c');
  if (K.spoiler) { b(parts, 1.7, 0.06, 0.32, 0, 1.0, -L / 2 + 0.25, '#1c1c1c'); b(parts, 0.06, 0.2, 0.1, 0.6, 0.9, -L / 2 + 0.25, '#1c1c1c'); b(parts, 0.06, 0.2, 0.1, -0.6, 0.9, -L / 2 + 0.25, '#1c1c1c'); }
  for (const sx of [-1, 1]) {
    b(lights, 0.42, 0.12, 0.06, sx * 0.6, K.light, L / 2 - 0.01, '#ffffff');
    b(lights, 0.44, 0.11, 0.06, sx * 0.62, K.light + 0.04, -L / 2 + 0.03, '#ffffff');
    b(parts, 0.1, 0.09, 0.2, sx * 0.98, K.cabin[0][1] + 0.08, K.cabin[0][0] - 0.25, hex);
  }
  const wheel = colorGeo(new THREE.CylinderGeometry(wr, wr, 0.28, 16).rotateZ(Math.PI / 2), '#1b1b1b');
  const hub = colorGeo(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.3, 8).rotateZ(Math.PI / 2), '#a7a9ad');
  const wheelGeo = mergeGeometries([wheel, hub]);
  const wp = [[0.86, wr, L * 0.31], [-0.86, wr, L * 0.31], [0.86, wr, -L * 0.31], [-0.86, wr, -L * 0.31]];
  for (const [x, y, z] of wp) wheelsStatic.push(wheelGeo.clone().translate(x, y, z));
  const lightCols = lights.map((g, i) => colorGeo(g.clone(), i % 2 ? '#5a1414' : '#d9d5c8'));
  const head = mergeGeometries(lights.filter((_, i) => i % 2 === 0)), tail = mergeGeometries(lights.filter((_, i) => i % 2 === 1));
  const body = mergeGeometries(parts);
  const stat = mergeGeometries([...parts, ...wheelsStatic, ...lightCols]);
  return (carGeoCache[key] = { body, stat, wheelGeo, wp, head, tail, L });
}
const cars = [];
class Car {
  constructor(x, z, h, hex, kind = 0) {
    this.x = x; this.z = z; this.h = h; this.vx = 0; this.vz = 0; this.along = 0; this.steer = 0;
    this.kind = kind; this.hex = hex; this.ai = null; this.knock = 0; this.honk = 0;
    const G = carGeos(hex, kind); this.G = G; this.half = G.L / 2;
    this.g = new THREE.Group(); scene.add(this.g);
    this.stat = new THREE.Mesh(G.stat, MAT.car); this.stat.castShadow = true;
    this.dynG = new THREE.Group();
    this.body = new THREE.Mesh(G.body, MAT.car); this.body.castShadow = true;
    this.headM = new THREE.Mesh(G.head, MAT.head); this.tailM = new THREE.Mesh(G.tail, MAT.tail);
    this.dynG.add(this.body, this.headM, this.tailM);
    this.wheels = G.wp.map(([wx, wy, wz]) => { const p = new THREE.Group(); p.position.set(wx, wy, wz); const m = new THREE.Mesh(G.wheelGeo, MAT.car); m.castShadow = true; p.add(m); this.dynG.add(p); return p; });
    this.dyn = null; this.setDyn(false); this.sync(); cars.push(this);
  }
  setDyn(on) { if (on === this.dyn) return; this.dyn = on; this.g.remove(on ? this.stat : this.dynG); this.g.add(on ? this.dynG : this.stat); }
  sync() { this.g.position.set(this.x, 0, this.z); this.g.rotation.y = this.h; }
  get fx() { return Math.sin(this.h); } get fz() { return Math.cos(this.h); }
  circles() { const o = this.half - 0.85, fx = this.fx, fz = this.fz; return [[this.x + fx * o, this.z + fz * o], [this.x, this.z], [this.x - fx * o, this.z - fz * o]]; }
  speed() { return Math.hypot(this.vx, this.vz); }
}
for (const [x, z, h] of parkedSpots) new Car(x, z, h, pick(CAR_COLORS), rnd() < 0.25 ? 1 : 0);
new Car(104, 112.5, Math.PI / 2, '#b08d57', 2);
new Car(14, -29.2, Math.PI / 2, '#1f1d1a', 2);

// traffic AI
function laneFor(dx, dz, roadCoord) { return roadCoord + (dx ? dx * 2.5 * 1 : -dz * 2.5); }
// right-hand traffic: heading +x drives on z+2.5, heading +z drives on x-2.5
function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const axisX = i % 2 === 0, list = axisX ? RZ : RX, road = list[Math.floor(i / 2) % 4], dir = rnd() < 0.5 ? 1 : -1;
    const along = (rnd() * 2 - 1) * (axisX ? EXT - 20 : ZEXT - 20);
    const dx = axisX ? dir : 0, dz = axisX ? 0 : dir;
    const lane = laneFor(dx, dz, road);
    const c = new Car(axisX ? along : lane, axisX ? lane : along, Math.atan2(dx, dz), pick(CAR_COLORS), rnd() < 0.3 ? 1 : 0);
    c.ai = { dx, dz, lane, v: 8, cruise: 9 + rnd() * 4, prev: 0 }; c.setDyn(true);
  }
}
spawnTraffic(26);

/* ================= people ================= */
const SKIN = ['#f1c9a5', '#c99b7a', '#8d5a3b', '#5c3a26', '#e0b48f'];
const HAIR = ['#2a1d16', '#5a3b22', '#c9a46a', '#141414', '#8b8b8b'];
const SHIRT = ['#b08d57', '#2f4a6e', '#c94b3a', '#f3f1ec', '#3f6340', '#7a5c8c', '#d9a441', '#2c2c2c', '#9ec1cf'];
const PANTS = ['#2d2b29', '#3b4a63', '#c8bfae', '#5b4636', '#1f1f1f'];
const G_TORSO = new THREE.CapsuleGeometry(0.21, 0.42, 4, 10), G_HEAD = new THREE.SphereGeometry(0.16, 16, 12);
const G_HAIR = new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), G_LONG = new THREE.BoxGeometry(0.3, 0.32, 0.12);
const G_LEG = new THREE.CapsuleGeometry(0.085, 0.73, 3, 8), G_ARM = new THREE.CapsuleGeometry(0.06, 0.5, 3, 8);
const G_EYE = new THREE.SphereGeometry(0.022, 6, 4), EYE_MAT = new THREE.MeshBasicMaterial({ color: '#1a1410' });
const G_SHOE = new THREE.BoxGeometry(0.13, 0.08, 0.26).translate(0, -0.02, 0.05), G_HAND = new THREE.SphereGeometry(0.055, 8, 6), G_NECK = new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8);
function makePerson(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sk = lam(o.skin), sh = o.unique ? new THREE.MeshLambertMaterial({ color: o.shirt }) : lam(o.shirt), pa = lam(o.pants), ha = lam(o.hair), so = lam(o.shoes || '#f3f1ec');
  const torso = new THREE.Mesh(G_TORSO, sh); torso.position.y = 1.32; torso.scale.z = 0.72; body.add(torso);
  const head = new THREE.Mesh(G_HEAD, sk); head.position.y = 1.83; body.add(head);
  const hair = new THREE.Mesh(G_HAIR, ha); hair.position.set(0, 1.85, -0.015); hair.rotation.x = -0.25; body.add(hair);
  if (o.long) { const l = new THREE.Mesh(G_LONG, ha); l.position.set(0, 1.68, -0.12); body.add(l); }
  const neck = new THREE.Mesh(G_NECK, sk); neck.position.y = 1.68; body.add(neck);
  for (const ex of [-0.055, 0.055]) { const e = new THREE.Mesh(G_EYE, EYE_MAT); e.position.set(ex, 1.85, 0.145); body.add(e); }
  const limb = (geo, len, mat, extra) => { const p = new THREE.Group(), m = new THREE.Mesh(geo, mat); m.position.y = -len / 2; p.add(m); extra.position.y = -len; p.add(extra); return p; };
  const legL = limb(G_LEG, 0.9, pa, new THREE.Mesh(G_SHOE, so)), legR = limb(G_LEG, 0.9, pa, new THREE.Mesh(G_SHOE, so));
  legL.position.set(0.11, 0.95, 0); legR.position.set(-0.11, 0.95, 0);
  const armL = limb(G_ARM, 0.62, sh, new THREE.Mesh(G_HAND, sk)), armR = limb(G_ARM, 0.62, sh, new THREE.Mesh(G_HAND, sk));
  armL.position.set(0.29, 1.56, 0); armR.position.set(-0.29, 1.56, 0);
  body.add(legL, legR, armL, armR);
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(root);
  return { root, body, legL, legR, armL, armR, sh };
}
function animatePerson(p, phase, amp, st = {}) {
  const sw = Math.sin(phase) * amp;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw * 0.9; p.armR.rotation.x = sw * 0.9;
  p.armL.rotation.z = 0.08; p.armR.rotation.z = -0.08;
  p.body.position.y = Math.abs(Math.cos(phase)) * 0.06 * amp; p.body.rotation.x = 0; p.body.rotation.z = 0;
  if (st.air) { p.legL.rotation.x = -0.5; p.legR.rotation.x = 0.3; p.armL.rotation.x = p.armR.rotation.x = -2.4; }
  if (st.swim) { const s = Math.sin(phase * 0.8); p.armL.rotation.x = p.armR.rotation.x = -1.6; p.armL.rotation.z = 0.6 + s * 0.6; p.armR.rotation.z = -0.6 - s * 0.6; p.legL.rotation.x = s * 0.4; p.legR.rotation.x = -s * 0.4; }
  if (st.down) { p.body.rotation.x = -Math.PI / 2 * st.down; p.body.position.y = 0.25 * st.down; }
  if (st.wave) { p.armR.rotation.x = -2.7; p.armR.rotation.z = -0.3 + Math.sin(phase * 3) * 0.3; }
}

// pedestrians: around block sidewalks + park paths
const peds = [];
function ringPath(cx, cz) {
  const hw = 59, hd = 29, P = 2 * (hw * 2 + hd * 2);
  return { len: P, loop: true, at(s) {
    s = ((s % P) + P) % P;
    if (s < hw * 2) return [cx - hw + s, cz - hd, 1, 0];
    s -= hw * 2; if (s < hd * 2) return [cx + hw, cz - hd + s, 0, 1];
    s -= hd * 2; if (s < hw * 2) return [cx + hw - s, cz + hd, -1, 0];
    s -= hw * 2; return [cx - hw, cz + hd - s, 0, -1];
  } };
}
function curvePath(curve) {
  const len = curve.getLength();
  return { len, loop: false, at(s) { const t = clamp(s / len, 0, 1), p = curve.getPointAt(t), tg = curve.getTangentAt(t); return [p.x, p.z, tg.x, tg.z]; } };
}
const pedPaths = [];
for (const cz of BZ) for (const cx of BX) pedPaths.push(ringPath(cx, cz));
for (const c of parkCurves) pedPaths.push(curvePath(c));
for (let i = 0; i < 44; i++) {
  const path = pedPaths[i % pedPaths.length];
  const p = makePerson({ skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT), pants: pick(PANTS), long: rnd() < 0.4 });
  peds.push({ p, path, s: rnd() * path.len, dir: rnd() < 0.5 ? 1 : -1, v: 1.1 + rnd() * 0.5, phase: rnd() * 6, off: 0, offT: 0, y: 0, vy: 0, down: 0, x: 0, z: 0, h: 0, wait: 0 });
}

/* ================= hero ================= */
const hero = makePerson({ skin: '#c99b7a', hair: '#2a1d16', shirt: '#b08d57', pants: '#2d2b29', unique: true });
const P = { x: 26, z: 3, y: 0, vy: 0, heading: Math.PI, phase: 0, speed: 0, down: 0, car: null, swim: false };
let yaw = 0.35, pitch = 0.3, camDist = 6.5, lastMouse = -10;

/* ================= collectibles & markers ================= */
const KEY_SPOTS = [[-15, 1.5], [-43, -24.4], [32, -8], [-150, -121], [150, 121], [-232, -142], [238, 150], [65, 0], [-245, 35], [250, -110], [0, -150]];
const goldMat = new THREE.MeshStandardMaterial({ color: '#d8b25a', metalness: 0.9, roughness: 0.25, emissive: '#6b4a10', emissiveIntensity: 0.5 });
const keyGeo = (() => {
  const ring = new THREE.TorusGeometry(0.22, 0.06, 8, 20), shaft = new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(0, -0.45, 0);
  const t1 = new THREE.BoxGeometry(0.16, 0.06, 0.06).translate(0.08, -0.62, 0), t2 = new THREE.BoxGeometry(0.12, 0.06, 0.06).translate(0.06, -0.48, 0);
  return mergeGeometries([ring, shaft, t1, t2].map(g => g.index ? g.toNonIndexed() : g));
})();
const keys3d = [];
{
  const poolLot = lots[23];
  const spots = [...KEY_SPOTS.map(([x, z]) => [x, z, x === 32 ? 1.6 : 1.1]), [poolLot.pool.x, poolLot.pool.z, 0.7]];
  spots.forEach(([x, z, y], i) => {
    const m = new THREE.Mesh(keyGeo, goldMat); m.position.set(x, y, z); m.userData.noInk = true; m.castShadow = true;
    m.visible = !save.keys.includes(i); scene.add(m); keys3d.push({ m, i, x, z, y });
  });
}
const markerMat = new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const arrowMat = new THREE.MeshBasicMaterial({ color: '#f2c230' });
function makeMarker(x, z, color) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.4, 32, 1, true), color ? markerMat.clone() : markerMat); cyl.position.y = 0.7;
  const arr = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), color ? new THREE.MeshBasicMaterial({ color }) : arrowMat); arr.rotation.x = Math.PI; arr.position.y = 2.6;
  if (color) cyl.material.color.set(color);
  g.add(cyl, arr); g.position.set(x, 0, z); g.traverse(o => { o.userData.noInk = o.userData.noSketch = true; });
  scene.add(g); return g;
}
const beamMat = new THREE.MeshBasicMaterial({ color: '#b46ddc', transparent: true, opacity: 0.35, depthWrite: false });
const waypointBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 120, 12, 1, true), beamMat);
waypointBeam.position.y = 60; waypointBeam.visible = false; waypointBeam.userData.noInk = waypointBeam.userData.noSketch = true; scene.add(waypointBeam);
const cpMat = new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
const checkpoint = new THREE.Group();
{ const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.25, 8, 40), cpMat); ring.position.y = 4.4; const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 4.5; checkpoint.add(ring, beam); }
checkpoint.visible = false; checkpoint.traverse(o => { o.userData.noInk = o.userData.noSketch = true; }); scene.add(checkpoint);
let waypoint = null;

/* ================= missions ================= */
const VISIT = [doors[13], doors[42], doors[59]];
const RACE_CP = [[65, 105], [65, 35], [-65, 35], [-65, -35], [-195, -35], [-195, -105], [65, -105], [195, -105], [195, 35], [195, 105], [130, 105]];
const MISSIONS = {
  visite: { title: 'Visite privée', start: [23, -2.2], reward: 25000, time: 240, color: '#f2c230', letter: 'V' },
  course: { title: 'Contre-la-montre', start: [96, 113], reward: 15000, time: 95, color: '#5fb3e0', letter: 'C', needCar: true }
};
for (const [id, m] of Object.entries(MISSIONS)) m.marker = makeMarker(m.start[0], m.start[1], m.color), m.id = id;
let mission = null; // {m, step, t}
function missionTarget() {
  if (!mission) return null;
  if (mission.m.id === 'visite') { const d = VISIT[mission.step]; return { x: d.x, z: d.z, r: 2.6, label: `Villa ${d.name}`, d }; }
  const c = RACE_CP[mission.step]; return { x: c[0], z: c[1], r: 7, label: `Point ${mission.step + 1}/${RACE_CP.length}` };
}
function startMission(m) {
  mission = { m, step: 0, t: m.time };
  for (const mm of Object.values(MISSIONS)) mm.marker.visible = false;
  banner(m.title, 'Mission');
  audio.sfx('start');
  if (m.id === 'visite') subtitle(`Un client veut visiter trois villas. Conduisez-le d'abord à la <b>Villa ${VISIT[0].name}</b>, lot n° ${VISIT[0].n}.`, 7);
  else subtitle('Passez les <b>11 points de contrôle</b> avant la fin du temps. Pied au plancher.', 6);
  updateCheckpoint();
}
function updateCheckpoint() {
  const t = missionTarget();
  checkpoint.visible = !!t && mission.m.id === 'course';
  if (t) checkpoint.position.set(t.x, 0, t.z);
  if (t && mission.m.id === 'course') { const n = RACE_CP[mission.step + 1]; checkpoint.children[0].rotation.y = n ? Math.atan2(n[0] - t.x, n[1] - t.z) : 0; }
}
function endMission(ok) {
  const m = mission.m; mission = null; checkpoint.visible = false; $('timer').textContent = '';
  for (const mm of Object.values(MISSIONS)) mm.marker.visible = true;
  if (ok) { addMoney(m.reward); save.done[m.id] = (save.done[m.id] || 0) + 1; persist(); banner('Mission réussie', `+ ${m.reward.toLocaleString('fr-FR')} € de commission`, true); audio.sfx('passed'); }
  else { banner('Mission échouée', 'Le temps est écoulé', false, true); audio.sfx('fail'); }
}

/* ================= HUD helpers ================= */
let moneyShown = save.money;
function addMoney(n) { save.money += n; persist(); }
let bannerT = 0;
function banner(t, s, gold = false, red = false) {
  const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s || '';
  b.className = 'on' + (gold ? ' gold' : '') + (red ? ' red' : ''); bannerT = 4;
}
let subT = 0;
function subtitle(html, sec = 5) { $('sub').innerHTML = html; $('sub').classList.add('on'); subT = sec; }
let hintT = 0, hintKey = '';
function hint(text, sec = 5, key = text) { if (hintKey === key && hintT > 0.3) { hintT = Math.max(hintT, sec); return; } hintKey = key; $('hint').innerHTML = text; $('hint').classList.add('on'); hintT = sec; }
const bubbles = [];
function say(text, obj, yOff = 2.3) {
  const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text; $('bubbles').appendChild(el);
  bubbles.push({ el, obj, yOff, t: 2.2 });
}

/* ================= audio (synthesised) ================= */
const audio = (() => {
  let ctx = null, master, noiseBuf, eng, radioGain, ambGain, muted = false;
  const st = { station: 1, nextBeat: 0, beat: 0 };
  const STATIONS = [null,
    { name: 'Red Stone FM', bpm: 84, wave: 'triangle', prog: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36], kick: false, scale: [65, 67, 69, 72, 74, 76] },
    { name: 'Atlas Nights', bpm: 112, wave: 'sawtooth', prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 64]], bass: [45, 41, 43, 40], kick: true, scale: [69, 72, 74, 76, 79, 81] },
    { name: 'Marrakech Jazz', bpm: 96, wave: 'sine', prog: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 61, 64, 67]], bass: [38, 43, 36, 45], kick: false, scale: [62, 65, 67, 69, 72, 74] }];
  const mtof = n => 440 * 2 ** ((n - 69) / 12);
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // wind bed
    const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.035; w.connect(wf).connect(ambGain).connect(master); w.start();
    // engine
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g).connect(master); o1.start(); o2.start();
    eng = { o1, o2, f, g };
    radioGain = ctx.createGain(); radioGain.gain.value = 0; radioGain.connect(master);
    st.nextBeat = ctx.currentTime + 0.1;
    setInterval(schedule, 60);
  }
  function env(node, t, a, peak, dur) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function noise(dur, freq, q, vol, type = 'bandpass', dest = master, t = ctx.currentTime) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.005, vol, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type = 'sine', dest = master, t = ctx.currentTime, a = 0.01, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, a, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function schedule() {
    const S = STATIONS[st.station];
    if (!S) { st.nextBeat = ctx.currentTime + 0.1; return; }
    const spb = 60 / S.bpm / 2; // eighth notes
    while (st.nextBeat < ctx.currentTime + 0.25) {
      const t = st.nextBeat, b = st.beat, bar = Math.floor(b / 8) % 4, e = b % 8;
      if (e === 0) for (const n of S.prog[bar]) tone(mtof(n), spb * 7.6, 0.022, S.wave, radioGain, t, 0.25);
      if (e === 0 || e === 3 || e === 4 || (e === 6 && S.kick)) tone(mtof(S.bass[bar] - 12 + (e === 6 ? 7 : 0)), spb * 1.6, 0.09, 'triangle', radioGain, t, 0.01);
      if (S.kick && e % 2 === 0) tone(130, 0.16, 0.22, 'sine', radioGain, t, 0.002, 42);
      if (e % 2 === 1 || S.kick) noise(0.035, 8000, 0.8, 0.03, 'highpass', radioGain, t);
      if (e === 4) noise(0.12, 1800, 0.7, S.kick ? 0.08 : 0.04, 'bandpass', radioGain, t);
      if (Math.random() < 0.32) tone(mtof(S.scale[Math.floor(Math.random() * S.scale.length)]), spb * 1.8, 0.035, 'sine', radioGain, t, 0.01);
      st.nextBeat += spb; st.beat++;
    }
  }
  let hornNodes = null;
  return {
    init, STATIONS, get on() { return !!ctx; },
    get station() { return st.station; },
    nextStation() { st.station = (st.station + 1) % STATIONS.length; return STATIONS[st.station]; },
    toggleMute() { if (!ctx) return; muted = !muted; master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05); return muted; },
    step(vol = 0.18) { if (ctx) noise(0.07, 700 + Math.random() * 500, 1.1, vol); },
    splash() { if (ctx) noise(0.35, 1200, 0.6, 0.12); },
    update(inCar, rpm, throttle, night, dt) {
      if (!ctx) return;
      const t = ctx.currentTime;
      eng.o1.frequency.setTargetAtTime(38 + rpm * 95, t, 0.05); eng.o2.frequency.setTargetAtTime(19 + rpm * 47, t, 0.05);
      eng.f.frequency.setTargetAtTime(260 + rpm * 900 + throttle * 300, t, 0.08);
      eng.g.gain.setTargetAtTime(inCar ? 0.03 + throttle * 0.045 : 0, t, 0.1);
      radioGain.gain.setTargetAtTime(inCar && STATIONS[st.station] ? 0.8 : 0, t, 0.3);
      ambGain.gain.setTargetAtTime(inCar ? 0.015 : 0.035, t, 0.4);
      if (!night && Math.random() < dt * 0.7) { const f0 = 2600 + Math.random() * 1800; for (let i = 0; i < 2 + Math.random() * 3; i++) tone(f0 * (1 + Math.random() * 0.2), 0.08, 0.018, 'sine', master, t + i * 0.11, 0.01, f0 * 1.35); }
      if (night && Math.random() < dt * 2.2) for (let i = 0; i < 3; i++) tone(4400, 0.03, 0.01, 'sine', master, t + i * 0.05);
    },
    horn(on) {
      if (!ctx) return;
      if (on && !hornNodes) { const g = ctx.createGain(); g.gain.value = 0.07; g.connect(master); hornNodes = [392, 494].map(f => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.frequency.value = 1800; o.connect(lp).connect(g); o.start(); return o; }); hornNodes.g = g; }
      if (!on && hornNodes) { hornNodes.forEach(o => o.stop()); hornNodes.g.disconnect(); hornNodes = null; }
    },
    honkFar() { if (ctx) { tone(415, 0.25, 0.025, 'square'); tone(523, 0.25, 0.02, 'square'); } },
    crash(i) { if (ctx) { noise(0.5, 280, 0.6, clamp(i / 14, 0.05, 0.6), 'lowpass'); noise(0.2, 2400, 1, clamp(i / 30, 0.02, 0.2)); } },
    sfx(kind) {
      if (!ctx) return; const t = ctx.currentTime;
      if (kind === 'key') [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.25, 0.08, 'triangle', master, t + i * 0.07));
      if (kind === 'cp') [880, 1318].forEach((f, i) => tone(f, 0.18, 0.08, 'triangle', master, t + i * 0.06));
      if (kind === 'start') [523, 659, 784].forEach((f, i) => tone(f, 0.4, 0.06, 'triangle', master, t + i * 0.12));
      if (kind === 'passed') { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 0.07, 'triangle', master, t + i * 0.12)); [261, 329, 392].forEach(f => tone(f, 1.6, 0.05, 'sawtooth', master, t + 0.5, 0.05)); }
      if (kind === 'fail') [392, 349, 311, 261].forEach((f, i) => tone(f, 0.5, 0.07, 'sawtooth', master, t + i * 0.18));
      if (kind === 'door') { noise(0.12, 500, 0.8, 0.15); noise(0.08, 300, 0.8, 0.2, 'lowpass', master, t + 0.25); }
    }
  };
})();

/* ================= look: day/night + sketch ================= */
let tod = 17.4, timeScale = 1 / 30, sketch = false, dayF = 1;
const cSky = { dayTop: new THREE.Color('#3f86d4'), dayHor: new THREE.Color('#b9d6ea'), duskTop: new THREE.Color('#41598a'), duskHor: new THREE.Color('#f2a66a'), nightTop: new THREE.Color('#03060d'), nightHor: new THREE.Color('#141c2c') };
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), sunCol = new THREE.Color();
const sunDir = V(0, 1, 0);
const lampLights = [];
for (let i = 0; i < 8; i++) { const l = new THREE.PointLight('#ffd49a', 0, 24, 1.5); scene.add(l); lampLights.push(l); }
const headLight = new THREE.SpotLight('#fff2d8', 0, 55, 0.55, 0.5, 1.2); const headTarget = new THREE.Object3D();
scene.add(headLight, headTarget); headLight.target = headTarget;

function updateSky() {
  const a = (tod - 6) / 12 * Math.PI, s = Math.sin(a);
  sunDir.set(-Math.cos(a) * 0.85, s, 0.45).normalize();
  const day = smooth(-0.12, 0.3, s), dusk = (1 - smooth(0.05, 0.42, s)) * smooth(-0.3, 0.02, s);
  dayF = day;
  tmpC.copy(cSky.nightTop).lerp(cSky.dayTop, day).lerp(cSky.duskTop, dusk * 0.7);
  tmpC2.copy(cSky.nightHor).lerp(cSky.dayHor, day).lerp(cSky.duskHor, dusk * 0.85);
  sunCol.set('#fff1dc').lerp(tmpC.set('#ff9a52'), clamp(1 - s * 2.4, 0, 1));
  if (sketch) { skyU.top.value.set('#efebe1'); skyU.hor.value.set('#efebe1'); scene.fog.color.set('#efebe1'); }
  else {
    skyU.top.value.copy(cSky.nightTop).lerp(cSky.dayTop, day).lerp(cSky.duskTop, dusk * 0.7);
    skyU.hor.value.copy(tmpC2); scene.fog.color.copy(tmpC2);
  }
  skyU.sunDir.value.copy(sunDir); skyU.sunCol.value.copy(sunCol).multiplyScalar(sketch ? 0 : smooth(-0.1, 0.05, s)); skyU.glow.value = 1 + dusk * 2;
  stars.material.opacity = sketch ? 0 : (1 - smooth(-0.2, 0.05, s)) * 0.9;
  const moon = s < 0;
  const ld = moon ? V(0.35, 0.85, -0.4).normalize() : sunDir;
  sun.position.set(P.x + ld.x * 120, ld.y * 120, P.z + ld.z * 120); sun.target.position.set(P.x, 0, P.z);
  if (sketch) { sun.intensity = 0.9; hemi.intensity = 1.9; sun.color.set('#ffffff'); }
  else {
    sun.intensity = moon ? 0.28 * (1 - day) : 0.25 + 2.3 * smooth(0, 0.35, s);
    sun.color.copy(moon ? tmpC.set('#9fb4e0') : sunCol);
    hemi.intensity = 0.22 + 0.9 * day;
    hemi.color.set('#f4f1ea').lerp(tmpC.set('#8aa0c8'), 1 - day);
  }
  const night = 1 - day;
  MAT.glassLit.emissiveIntensity = sketch ? 0 : night * 1.4;
  MAT.bulb.color.set(night > 0.5 && !sketch ? '#ffe2a8' : '#e6e0d0');
  MAT.head.color.set(night > 0.5 && !sketch ? '#fffbe8' : '#d8d4c8');
  MAT.tail.color.set(night > 0.5 && !sketch ? '#ff3a24' : '#5a1010');
  MAT.water.emissiveIntensity = 0.4 + night * 0.9;
  MAT.waterC.emissiveIntensity = 0.35 + night * 1.1;
  MAT.led.color.set(sketch ? '#e6e0d0' : night > 0.5 ? '#ffe2b0' : '#ffd9a0');
  for (const m of [MAT.glass, MAT.glassLit, MAT.water, MAT.glassC, MAT.rail, MAT.gold, MAT.marbleD, MAT.car]) m.envMapIntensity = 0.12 + 0.88 * day;
  MAT.waterC.envMapIntensity = 0.1 + 0.4 * day;
  MAT.woodIn.emissiveIntensity = sketch ? 0 : 0.4 + night * 0.5; MAT.floorIn.emissiveIntensity = sketch ? 0 : 0.3 + night * 0.4;
  renderer.toneMappingExposure = sketch ? 1 : 1 + night * 0.25;
  return night;
}
const paper = new THREE.MeshBasicMaterial({ color: '#f6f2e9' }), paperGround = new THREE.MeshBasicMaterial({ color: '#efebe1' });
const ink = new THREE.LineBasicMaterial({ color: '#2b2722' });
const edgeCache = new Map();
let inked = false;
function applySketch() {
  document.body.classList.toggle('sketch', sketch);
  if (sketch && !inked) {
    inked = true;
    const meshes = []; scene.traverse(o => { if (o.isMesh && !o.userData.noInk && o.userData.key !== 'grass') meshes.push(o); });
    for (const m of meshes) {
      let eg = edgeCache.get(m.geometry); if (!eg) { eg = new THREE.EdgesGeometry(m.geometry, 24); edgeCache.set(m.geometry, eg); }
      const l = new THREE.LineSegments(eg, ink); l.userData.ink = true; l.raycast = () => {}; m.add(l);
    }
  }
  scene.traverse(o => {
    if (o.userData.ink) o.visible = sketch;
    else if (o.isMesh && !o.userData.noSketch) { o.userData.mat ??= o.material; o.material = sketch ? (o.userData.key === 'grass' ? paperGround : paper) : o.userData.mat; }
  });
  [...keys3d.map(k => k.m)].forEach(m => m.material = goldMat);
  sun.castShadow = !sketch;
  $('b-sketch').setAttribute('aria-pressed', sketch);
}

/* ================= annotations (sketch) ================= */
const notes = [];
function note(text, x, y, z) { const el = document.createElement('div'); el.className = 'note'; el.textContent = text; $('notes').appendChild(el); notes.push({ el, p: V(x, y, z) }); }
note('Espace commun', 32, 3.4, -8); note('Le lac', -30, 1.2, 4); note('Pergola', -43, 3.3, -24); note('Agence', 21, 3.4, -5.5);
for (const l of lots.filter(l => l.green).filter((_, i) => i % 6 === 0)) note('Toit végétalisé', l.roof.x, 7.4, l.roof.z);
for (const l of lots.filter((_, i) => i % 7 === 3)) note('Piscine privée', l.pool.x, 1, l.pool.z);

/* ================= maps ================= */
const OX = 290, OZ = 200, MPX = 2;
const mapImg = document.createElement('canvas'); mapImg.width = OX * 2 * MPX; mapImg.height = OZ * 2 * MPX;
{
  const c = mapImg.getContext('2d'); c.scale(MPX, MPX); c.translate(OX, OZ);
  c.fillStyle = '#34402f'; c.fillRect(-OX, -OZ, OX * 2, OZ * 2);
  c.fillStyle = '#3f4c3a'; c.fillRect(-202, -112, 404, 224);
  c.fillStyle = '#4b6b40'; c.fillRect(-58, -28, 116, 56);
  for (const cz of BZ) for (const cx of BX) { c.fillStyle = '#8c8a83'; c.fillRect(cx - 60, cz - 30, 120, 2); c.fillRect(cx - 60, cz + 28, 120, 2); c.fillRect(cx - 60, cz - 30, 2, 60); c.fillRect(cx + 58, cz - 30, 2, 60); }
  c.fillStyle = '#7b7d80'; for (const z of RZ) c.fillRect(-EXT - 20, z - 5, EXT * 2 + 40, 10); for (const x of RX) c.fillRect(x - 5, -ZEXT - 20, 10, ZEXT * 2 + 40);
  c.fillStyle = '#6a6c70'; for (const [px, pz] of parkings) c.fillRect(px - 30, pz - 7, 60, 14);
  for (const l of lots) { c.fillStyle = '#4e5b47'; c.fillRect(l.x0 + 0.5, l.z0 + 0.5, l.x1 - l.x0 - 1, l.z1 - l.z0 - 1); c.fillStyle = '#d9d4c7'; c.fillRect(l.house[0], l.house[1], l.house[2] - l.house[0], l.house[3] - l.house[1]); c.fillStyle = '#5ec8df'; c.fillRect(l.poolR[0], l.poolR[1], l.poolR[2] - l.poolR[0], l.poolR[3] - l.poolR[1]); }
  c.fillStyle = '#4aa3c2'; for (const [x, z, rx, rz] of ponds) { c.beginPath(); c.ellipse(x, z, rx, rz, 0, 0, 7); c.fill(); }
  c.strokeStyle = '#c9b98f'; c.lineWidth = 2.6; for (const cv of parkCurves) { c.beginPath(); cv.getPoints(60).forEach((p, i) => i ? c.lineTo(p.x, p.z) : c.moveTo(p.x, p.z)); c.stroke(); }
  c.fillStyle = '#cfc6b4'; c.beginPath(); c.arc(32, -8, 10, 0, 7); c.fill();
}
const mm = $('minimap'), mmx = mm.getContext('2d'), MMR = mm.width / 2;
function routeTo(tx, tz, fx, fz) {
  // shortest path on the road grid: from -> nearest road point -> intersections -> target road point -> target
  const nodes = []; for (const x of RX) for (const z of RZ) nodes.push([x, z]);
  const proj = (x, z) => {
    let best = null;
    for (let j = 0; j < 4; j++) { const px = clamp(x, RX[0], RX[3]), d = Math.hypot(x - px, z - RZ[j]); if (!best || d < best.d) { let i = 0; while (i < 2 && RX[i + 1] < px) i++; best = { d, p: [px, RZ[j]], a: i * 4 + j, b: (i + 1) * 4 + j }; } }
    for (let i = 0; i < 4; i++) { const pz = clamp(z, RZ[0], RZ[3]), d = Math.hypot(x - RX[i], z - pz); if (d < best.d) { let j = 0; while (j < 2 && RZ[j + 1] < pz) j++; best = { d, p: [RX[i], pz], a: i * 4 + j, b: i * 4 + j + 1 }; } }
    return best;
  };
  const s = proj(fx, fz), e = proj(tx, tz);
  const N = 18, dist = new Array(N).fill(1e9), prev = new Array(N).fill(-1), used = new Array(N).fill(false);
  const pos = i => i < 16 ? nodes[i] : i === 16 ? s.p : e.p;
  const adj = i => {
    const out = [];
    if (i < 16) { const a = Math.floor(i / 4), b = i % 4; if (a > 0) out.push(i - 4); if (a < 3) out.push(i + 4); if (b > 0) out.push(i - 1); if (b < 3) out.push(i + 1); if (i === e.a || i === e.b) out.push(17); if (i === s.a || i === s.b) out.push(16); }
    if (i === 16) { out.push(s.a, s.b); if ((s.a === e.a && s.b === e.b)) out.push(17); }
    if (i === 17) out.push(e.a, e.b);
    return out;
  };
  dist[16] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < N; i++) if (!used[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= 1e9) break; used[u] = true; if (u === 17) break;
    for (const v of adj(u)) { const [ax, az] = pos(u), [bx, bz] = pos(v), d = dist[u] + Math.abs(ax - bx) + Math.abs(az - bz); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
  }
  const path = [[tx, tz]]; let u = 17; while (u >= 0) { path.push(pos(u)); u = prev[u]; } path.push([fx, fz]);
  return path.reverse();
}
let route = null, routeT = 0;
function blipList() {
  const out = [];
  const t = missionTarget();
  if (t) out.push({ x: t.x, z: t.z, c: mission.m.color, kind: 'target' });
  else for (const m of Object.values(MISSIONS)) out.push({ x: m.start[0], z: m.start[1], c: m.color, letter: m.letter });
  for (const k of keys3d) if (k.m.visible) out.push({ x: k.x, z: k.z, c: '#d8b25a', kind: 'key' });
  if (waypoint) out.push({ x: waypoint[0], z: waypoint[1], c: '#b46ddc', kind: 'wp' });
  return out;
}
function drawBlip(ctx, x, y, b, s = 1) {
  ctx.fillStyle = b.c; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * s;
  if (b.letter) { ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.font = `700 ${11 * s}px Jost, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.letter, x, y + 0.5); }
  else if (b.kind === 'key') { ctx.beginPath(); ctx.arc(x, y, 4.5 * s, 0, 7); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, 7); ctx.fill(); ctx.stroke(); }
}
function drawMinimap() {
  const S = (P.car ? 1.05 : 1.6) * (mm.width / 420), R = MMR;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const px = P.car ? P.car.x : P.x, pz = P.car ? P.car.z : P.z;
  const T = (wx, wz) => [R + S * (rx * (wx - px) + rz * (wz - pz)), R + S * (-fx * (wx - px) - fz * (wz - pz))];
  mmx.setTransform(1, 0, 0, 1, 0, 0); mmx.clearRect(0, 0, mm.width, mm.height);
  mmx.save(); mmx.beginPath(); mmx.arc(R, R, R - 3, 0, 7); mmx.clip();
  const a = S * rx / MPX, b = S * -fx / MPX, c = S * rz / MPX, d = S * -fz / MPX;
  const [e, f] = T(-OX, -OZ);
  mmx.setTransform(a, b, c, d, e, f); mmx.drawImage(mapImg, 0, 0); mmx.setTransform(1, 0, 0, 1, 0, 0);
  if (route) { mmx.strokeStyle = route.c; mmx.lineWidth = 5 * (mm.width / 420) * 1.6; mmx.lineJoin = 'round'; mmx.beginPath(); route.p.forEach(([x, z], i) => { const [sx, sy] = T(x, z); i ? mmx.lineTo(sx, sy) : mmx.moveTo(sx, sy); }); mmx.stroke(); }
  // traffic dots
  mmx.fillStyle = 'rgba(240,240,240,.55)'; for (const c of cars) if (c.ai) { const [sx, sy] = T(c.x, c.z); mmx.fillRect(sx - 2, sy - 2, 4, 4); }
  mmx.restore();
  for (const bl of blipList()) {
    let [sx, sy] = T(bl.x, bl.z); const dx = sx - R, dy = sy - R, l = Math.hypot(dx, dy), max = R - 14;
    if (l > max) { if (bl.kind === 'key') continue; sx = R + dx / l * max; sy = R + dy / l * max; }
    drawBlip(mmx, sx, sy, bl, mm.width / 420 * 1.6);
  }
  // player arrow
  const ph = P.car ? P.car.h : P.heading, ang = Math.atan2(rx * Math.sin(ph) + rz * Math.cos(ph), fx * Math.sin(ph) + fz * Math.cos(ph));
  mmx.save(); mmx.translate(R, R); mmx.rotate(ang); const k = mm.width / 420 * 1.6;
  mmx.fillStyle = '#fff'; mmx.strokeStyle = '#111'; mmx.lineWidth = 2;
  mmx.beginPath(); mmx.moveTo(0, -11 * k); mmx.lineTo(8 * k, 9 * k); mmx.lineTo(0, 4 * k); mmx.lineTo(-8 * k, 9 * k); mmx.closePath(); mmx.fill(); mmx.stroke(); mmx.restore();
  // north marker
  const nAng = Math.atan2(-rz, fz); // direction of world -z on screen
  const nX = R + Math.sin(nAng) * (R - 13), nY = R + Math.cos(nAng) * (R - 13);
  mmx.fillStyle = '#1f1d1a'; mmx.beginPath(); mmx.arc(nX, nY, 11 * k * 0.7, 0, 7); mmx.fill();
  mmx.fillStyle = '#fff'; mmx.font = `600 ${12 * k * 0.7}px Jost, sans-serif`; mmx.textAlign = 'center'; mmx.textBaseline = 'middle'; mmx.fillText('N', nX, nY + 1);
}
const bigmap = $('bigmap'), bmx = bigmap.getContext('2d');
function drawBigmap() {
  const r = bigmap.getBoundingClientRect(); bigmap.width = r.width * devicePixelRatio; bigmap.height = r.height * devicePixelRatio;
  const s = Math.min(bigmap.width / (OX * 2 * MPX), bigmap.height / (OZ * 2 * MPX)), w = OX * 2 * MPX * s, h = OZ * 2 * MPX * s, ox = (bigmap.width - w) / 2, oy = (bigmap.height - h) / 2;
  bmx.clearRect(0, 0, bigmap.width, bigmap.height); bmx.drawImage(mapImg, ox, oy, w, h);
  const T = (x, z) => [ox + (x + OX) * MPX * s, oy + (z + OZ) * MPX * s];
  bmx.font = `${12 * devicePixelRatio}px Jost, sans-serif`; bmx.fillStyle = 'rgba(255,255,255,.75)'; bmx.textAlign = 'center';
  RZ.forEach((z, i) => { const [x, y] = T(-232, z); bmx.fillText(ROADZ[i], x, y - 7 * devicePixelRatio); });
  RX.forEach((xx, i) => { const [x, y] = T(xx, -128); bmx.save(); bmx.translate(x, y); bmx.fillText(ROADX[i], 0, 0); bmx.restore(); });
  { const [x, y] = T(0, 0); bmx.fillText('Parc central', x, y - 20 * devicePixelRatio); }
  if (route) { bmx.strokeStyle = route.c; bmx.lineWidth = 4 * devicePixelRatio; bmx.beginPath(); route.p.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? bmx.lineTo(a, b) : bmx.moveTo(a, b); }); bmx.stroke(); }
  for (const bl of blipList()) { const [x, y] = T(bl.x, bl.z); drawBlip(bmx, x, y, bl, devicePixelRatio); }
  const [px, py] = T(P.car ? P.car.x : P.x, P.car ? P.car.z : P.z);
  bmx.save(); bmx.translate(px, py); bmx.rotate(-(P.car ? P.car.h : P.heading) + Math.PI); const k = devicePixelRatio * 1.2;
  bmx.fillStyle = '#fff'; bmx.strokeStyle = '#111'; bmx.lineWidth = 2; bmx.beginPath(); bmx.moveTo(0, -11 * k); bmx.lineTo(8 * k, 9 * k); bmx.lineTo(0, 4 * k); bmx.lineTo(-8 * k, 9 * k); bmx.closePath(); bmx.fill(); bmx.stroke(); bmx.restore();
  bigmap._T = { ox, oy, s };
}
bigmap.addEventListener('click', e => {
  const r = bigmap.getBoundingClientRect(), T = bigmap._T; if (!T) return;
  const x = ((e.clientX - r.left) * devicePixelRatio - T.ox) / (MPX * T.s) - OX, z = ((e.clientY - r.top) * devicePixelRatio - T.oy) / (MPX * T.s) - OZ;
  if (waypoint && Math.hypot(waypoint[0] - x, waypoint[1] - z) < 12) waypoint = null; else waypoint = [x, z];
  routeT = 0; drawBigmap();
});

/* ================= input ================= */
const keys = new Set();
let started = false, paused = false, wantJump = false, runToggle = false, hornHeld = false;
const press = code => keys.has(code);
addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!paused) setPause(true); else if (performance.now() - pausedAt > 350) setPause(false); e.preventDefault(); return; }
  if (e.code === 'KeyM') { setPause(!paused, true); return; }
  if (paused) return;
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
  keys.add(e.code);
  if (e.code === 'Space') { wantJump = true; e.preventDefault(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'KeyF' || e.code === 'Enter') toggleCar();
  if (e.code === 'KeyE') act();
  if (e.code === 'KeyH') hornHeld = true;
  if (e.code === 'KeyC') { sketch = !sketch; applySketch(); }
  if (e.code === 'KeyN') { tod = dayF > 0.5 ? 22 : 10; hint(dayF > 0.5 ? 'La nuit tombe sur le domaine.' : 'Le jour se lève.', 2.5); }
  if (e.code === 'KeyT') { timeScale = timeScale > 0.1 ? 1 / 30 : 1; hint(timeScale > 0.1 ? 'Accéléré du temps : activé (T)' : 'Temps normal', 2.5); }
  if (e.code === 'KeyR' && P.car) radioNext();
  if (e.code === 'KeyV') { camDist = camDist < 5 ? 6.5 : camDist < 8 ? 10 : 4.2; }
  if (e.code === 'KeyO') { const m = audio.toggleMute(); hint(m ? 'Son coupé (O)' : 'Son activé', 2); }
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyH') hornHeld = false; });
addEventListener('blur', () => { keys.clear(); hornHeld = false; });

let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (!started || paused) return;
  if (!isTouch && e.pointerType === 'mouse' && !document.pointerLockElement) { canvas.requestPointerLock?.()?.catch?.(() => {}); }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (document.pointerLockElement === canvas) { yaw -= e.movementX * 0.0024; pitch = clamp(pitch + e.movementY * 0.002, -0.15, 1.2); lastMouse = performance.now() / 1000; return; }
  if (!drag || drag.id !== e.pointerId) return;
  yaw -= (e.clientX - drag.x) * 0.0055; pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, -0.15, 1.2);
  drag.x = e.clientX; drag.y = e.clientY; lastMouse = performance.now() / 1000;
});
canvas.addEventListener('pointerup', () => drag = null); canvas.addEventListener('pointercancel', () => drag = null);
canvas.addEventListener('wheel', e => { camDist = clamp(camDist * (1 + e.deltaY * 0.001), 2.5, 22); e.preventDefault(); }, { passive: false });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && started && !paused && !suppressPause) setPause(true); suppressPause = false; });
let suppressPause = false;

// touch
const stick = $('stick'), knob = $('knob'), knobDot = knob.firstElementChild;
let joy = null, jv = { x: 0, y: 0 };
stick.addEventListener('pointerdown', e => { joy = { id: e.pointerId, x: e.clientX, y: e.clientY }; stick.setPointerCapture(e.pointerId); knob.style.display = 'block'; knob.style.left = e.clientX - 55 + 'px'; knob.style.top = e.clientY - 55 + 'px'; });
stick.addEventListener('pointermove', e => {
  if (!joy || joy.id !== e.pointerId) return;
  let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const l = Math.hypot(dx, dy), r = 50;
  if (l > r) { dx *= r / l; dy *= r / l; }
  jv = { x: dx / r, y: dy / r }; knobDot.style.transform = `translate(${dx}px,${dy}px)`;
});
const endJoy = () => { joy = null; jv = { x: 0, y: 0 }; knob.style.display = 'none'; knobDot.style.transform = ''; };
stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
const holdBtn = (id, down, up) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); down(); }); b.addEventListener('pointerup', () => up?.()); b.addEventListener('pointerleave', () => up?.()); };
holdBtn('m-jump', () => { wantJump = true; keys.add('Space'); }, () => keys.delete('Space'));
holdBtn('m-car', () => toggleCar());
holdBtn('m-act', () => act());
holdBtn('m-horn', () => hornHeld = true, () => hornHeld = false);
holdBtn('m-run', () => { runToggle = !runToggle; $('m-run').setAttribute('aria-pressed', runToggle); });
holdBtn('m-map', () => setPause(true, true));

let pausedAt = 0;
function setPause(on, mapOnly = false) {
  if (on && !paused) pausedAt = performance.now();
  paused = on; $('pause').classList.toggle('on', on); $('pause').classList.toggle('maponly', mapOnly);
  if (on) { keys.clear(); hornHeld = false; audio.horn(false); audio.update(false, 0, 0, false, 0); suppressPause = true; document.exitPointerLock?.(); requestAnimationFrame(drawBigmap); }
  else { suppressPause = false; if (!isTouch) canvas.requestPointerLock?.()?.catch?.(() => {}); }
}
$('p-resume').onclick = () => setPause(false);
$('p-reset').onclick = () => { if (confirm('Effacer votre progression (argent, clés) ?')) { save = { money: 0, keys: [], done: {} }; moneyShown = 0; persist(); keys3d.forEach(k => k.m.visible = true); setPause(false); } };
$('b-sketch').onclick = () => { sketch = !sketch; applySketch(); };
$('b-map').onclick = () => setPause(true, true);

/* ================= actions ================= */
let nearDoor = null, nearCar = null, nearMission = null;
function radioNext() { const s = audio.nextStation(); showRadio(s ? s.name : 'Radio coupée'); }
let radioT = 0;
function showRadio(name) { $('radio').textContent = name; $('radio').classList.add('on'); radioT = 2.5; }
function act() {
  if (P.car) return;
  if (nearMission && !mission) {
    if (nearMission.needCar) { hint('Il vous faut une voiture : la <b>berline dorée</b> est garée juste à côté. Montez avec <kbd>F</kbd> puis revenez sur le marqueur.', 6); return; }
    startMission(nearMission); return;
  }
  if (nearDoor) { suppressPause = true; document.exitPointerLock?.(); audio.sfx('door'); window.open(nearDoor.url, '_blank', 'noopener'); }
}
function distToCar(c, x, z) {
  const fx = c.fx, fz = c.fz, dx = x - c.x, dz = z - c.z, along = clamp(dx * fx + dz * fz, -c.half, c.half);
  return Math.hypot(dx - fx * along, dz - fz * along);
}
function toggleCar() {
  if (P.car) {
    const c = P.car, lx = c.fz, lz = -c.fx; // driver side (left)
    P.x = c.x + lx * 1.7; P.z = c.z + lz * 1.7; P.y = 0; P.vy = 0; P.heading = c.h;
    hero.root.visible = true; c.tailM.material = MAT.tail; P.car = null; headLight.intensity = 0;
    audio.sfx('door'); heroCollide();
    return;
  }
  if (!nearCar) return;
  wantJump = false;
  const c = nearCar;
  if (c.ai) { say(pick(['Hé ! Ma voiture !', 'Mais… !', 'Prenez-la, je vais à pied…', 'Faites attention à elle !']), c, 2.4); c.ai = null; }
  c.setDyn(true); P.car = c; hero.root.visible = false; c.along = c.vx * c.fx + c.vz * c.fz;
  audio.sfx('door');
  yaw = c.h + Math.PI; lastMouse = -10;
  if (audio.station) showRadio(audio.STATIONS[audio.station].name);
  hint('<kbd>Z</kbd> accélérer · <kbd>S</kbd> freiner · <kbd>Espace</kbd> frein à main · <kbd>H</kbd> klaxon · <kbd>R</kbd> radio · <kbd>F</kbd> descendre', 7, 'drive');
}

/* ================= simulation ================= */
const R = 0.35, qbuf = [], qbuf2 = [];
function heroCollide() {
  let ground = 0;
  for (let pass = 0; pass < 2; pass++) for (const s of query(P.x, P.z, 1.2, qbuf)) {
    if (s[4] <= P.y + 0.4) continue;
    if (P.x + R <= s[0] || P.x - R >= s[2] || P.z + R <= s[1] || P.z - R >= s[3]) continue;
    const l = P.x + R - s[0], r = s[2] - (P.x - R), t = P.z + R - s[1], b = s[3] - (P.z - R), m = Math.min(l, r, t, b);
    if (m === l) P.x -= l; else if (m === r) P.x += r; else if (m === t) P.z -= t; else P.z += b;
  }
  for (const s of query(P.x, P.z, 0.5, qbuf)) if (s[5] !== 'pool' && s[4] <= P.y + 0.4 && P.x > s[0] - 0.1 && P.x < s[2] + 0.1 && P.z > s[1] - 0.1 && P.z < s[3] + 0.1) ground = Math.max(ground, s[4]);
  for (const c of cars) {
    if (Math.abs(c.x - P.x) > 4 || Math.abs(c.z - P.z) > 4) continue;
    const fx = c.fx, fz = c.fz, dx = P.x - c.x, dz = P.z - c.z, al = dx * fx + dz * fz, lat = dx * fz - dz * fx;
    const ha = c.half + R, hl = 0.93 + R;
    if (Math.abs(al) < ha && Math.abs(lat) < hl) {
      if (P.y > 1.25) { ground = Math.max(ground, 1.4); continue; }
      const pa = ha - Math.abs(al), pl = hl - Math.abs(lat);
      if (pa < pl) { P.x += fx * Math.sign(al) * pa; P.z += fz * Math.sign(al) * pa; } else { P.x += fz * Math.sign(lat) * pl; P.z += -fx * Math.sign(lat) * pl; }
      const sp = c.speed(); if (sp > 6 && !P.down) { P.down = 2.2; P.vy = 4; say('Aïe !', hero.root, 2.2); audio.crash(sp); }
    }
  }
  for (const p of peds) { const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz); if (d < 0.6 && d > 0.001) { P.x = p.x + dx / d * 0.6; P.z = p.z + dz / d * 0.6; } }
  P.x = clamp(P.x, -285, 285); P.z = clamp(P.z, -195, 195);
  return ground;
}
function inPool(x, z) { for (const p of pools) if (x > p[0] && x < p[2] && z > p[1] && z < p[3]) return true; return false; }

function updateFoot(dt) {
  let f = 0, s = 0;
  if (press('KeyW') || press('ArrowUp')) f += 1;
  if (press('KeyS') || press('ArrowDown')) f -= 1;
  if (press('KeyD') || press('ArrowRight')) s += 1;
  if (press('KeyA') || press('ArrowLeft')) s -= 1;
  if (joy) { f = -jv.y; s = jv.x; }
  const mag = Math.min(1, Math.hypot(f, s));
  const run = press('ShiftLeft') || press('ShiftRight') || runToggle || (joy && mag > 0.95);
  const swimming = P.swim;
  let target = P.down > 0 ? 0 : mag * (swimming ? 2.2 : run ? 7.6 : 3.6);
  P.speed = damp(P.speed, target, 8, dt);
  if (mag > 0.05 && P.down <= 0) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const want = Math.atan2(fx * f + rx * s, fz * f + rz * s);
    P.heading += wrapA(want - P.heading) * Math.min(1, dt * 12);
  }
  P.x += Math.sin(P.heading) * P.speed * dt; P.z += Math.cos(P.heading) * P.speed * dt;
  let ground = heroCollide();
  const pool = ground < 0.05 && inPool(P.x, P.z);
  if (pool) ground = -1.15;
  const onGround = P.y <= ground + 0.02;
  if (wantJump && onGround && !swimming && P.down <= 0) { P.vy = 5.6; }
  wantJump = false;
  P.vy -= 16 * dt; P.y += P.vy * dt;
  if (P.y < ground) { if (!P.swim && pool && P.vy < -2) audio.splash(); P.y = ground; P.vy = 0; }
  if (pool && P.y < 0.1 && !P.swim) { P.swim = true; audio.splash(); hint('Petite baignade dans une piscine privée.', 3, 'swim'); }
  if (!pool) P.swim = false;
  if (P.down > 0) P.down -= dt;
  // animation
  const moving = P.speed > 0.3;
  const lastPhase = P.phase;
  P.phase += dt * (P.speed * 2.1 + 0.001);
  if (moving && onGround && !P.swim && Math.floor(lastPhase / Math.PI) !== Math.floor(P.phase / Math.PI)) audio.step(run ? 0.22 : 0.14);
  const downT = P.down > 0 ? clamp(Math.min(P.down, 2.2 - P.down) * 4, 0, 1) : 0;
  animatePerson(hero, P.swim ? clock.elapsedTime * 4 : P.phase, moving ? Math.min(0.9, P.speed * 0.16) : 0, { air: !onGround && !P.swim && P.y > ground + 0.3, swim: P.swim, down: downT });
  if (!moving && !P.swim && !downT) hero.body.position.y = Math.sin(clock.elapsedTime * 1.8) * 0.008;
  hero.root.position.set(P.x, P.y, P.z); hero.root.rotation.y = P.heading;
}

const carCirc = [];
function carSolids(c) {
  let hit = 0;
  const cs = c.circles(), r = 0.95;
  for (const [cx0, cz0] of cs) {
    let cx = cx0, cz = cz0;
    for (const s of query(cx, cz, r + 0.5, qbuf2)) {
      if (s[4] < 0.25) continue;
      const qx = clamp(cx, s[0], s[2]), qz = clamp(cz, s[1], s[3]); let dx = cx - qx, dz = cz - qz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-4) { dx = cx - (s[0] + s[2]) / 2; dz = cz - (s[1] + s[3]) / 2; d = Math.hypot(dx, dz) || 1; }
      const nx = dx / d, nz = dz / d, push = r - Math.hypot(cx - qx, cz - qz);
      c.x += nx * push; c.z += nz * push; cx += nx * push; cz += nz * push;
      const imp = c.vx * nx + c.vz * nz;
      if (imp < 0) { c.vx -= nx * imp * 1.35; c.vz -= nz * imp * 1.35; hit = Math.max(hit, -imp); }
    }
  }
  // world bounds
  c.x = clamp(c.x, -285, 285); c.z = clamp(c.z, -195, 195);
  return hit;
}
function carCars(c) {
  let hit = 0;
  for (const o of cars) {
    if (o === c || Math.abs(o.x - c.x) > 7 || Math.abs(o.z - c.z) > 7) continue;
    for (const [ax, az] of c.circles()) for (const [bx, bz] of o.circles()) {
      const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz);
      if (d >= 1.8 || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, pen = 1.8 - d;
      c.x += nx * pen * 0.5; c.z += nz * pen * 0.5; o.x -= nx * pen * 0.5; o.z -= nz * pen * 0.5;
      const rel = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz;
      if (rel < 0) {
        c.vx -= nx * rel * 0.7; c.vz -= nz * rel * 0.7; o.vx += nx * rel * 0.6; o.vz += nz * rel * 0.6;
        hit = Math.max(hit, -rel);
        if (-rel > 2) { o.knock = 2.5; if (o.ai && o.honk <= 0) { o.honk = 3; say(pick(['Hé !', 'Mais enfin !', 'Regardez devant vous !', 'Ma carrosserie !']), o, 2.4); audio.honkFar(); } }
        o.setDyn(true); o.sync();
      }
    }
  }
  return hit;
}
let shake = 0;
function updateDrive(c, dt) {
  let thr = 0, brk = 0, st = 0;
  if (press('KeyW') || press('ArrowUp')) thr = 1;
  if (press('KeyS') || press('ArrowDown')) brk = 1;
  if (press('KeyA') || press('ArrowLeft')) st += 1;
  if (press('KeyD') || press('ArrowRight')) st -= 1;
  if (joy) { thr = clamp(-jv.y * 1.3, 0, 1); brk = clamp(jv.y * 1.3, 0, 1); st = -jv.x; }
  const hand = press('Space');
  const fx = c.fx, fz = c.fz;
  let along = c.vx * fx + c.vz * fz;
  const sport = c.kind === 2, maxF = sport ? 46 : 36, acc = sport ? 13 : 9.5;
  if (thr) along += acc * (1 - Math.max(0, along) / maxF) * dt * (along < -0.5 ? 2.2 : 1);
  if (brk) along -= (along > 0.5 ? 22 : 7) * dt;
  along = Math.max(along, -10);
  if (!thr && !brk) along -= Math.sign(along) * Math.min(Math.abs(along), (1.5 + Math.abs(along) * 0.08) * dt);
  if (hand) along -= Math.sign(along) * Math.min(Math.abs(along), 7 * dt);
  const maxSteer = 0.62 / (1 + Math.abs(along) * 0.045);
  c.steer = damp(c.steer, st * maxSteer, 9, dt);
  const yawRate = along * Math.tan(c.steer) / 2.7 * (hand ? 1.55 : 1);
  c.h += yawRate * dt;
  const nfx = Math.sin(c.h), nfz = Math.cos(c.h);
  const grip = hand ? 1.4 : 9;
  c.vx = damp(c.vx, nfx * along, grip, dt) ; c.vz = damp(c.vz, nfz * along, grip, dt);
  // keep forward speed from being eaten by the grip blend
  const a2 = c.vx * nfx + c.vz * nfz; c.vx += nfx * (along - a2) * 0.6; c.vz += nfz * (along - a2) * 0.6;
  c.x += c.vx * dt; c.z += c.vz * dt;
  const h1 = carSolids(c), h2 = carCars(c), hit = Math.max(h1, h2);
  if (hit > 2.5) { audio.crash(hit); shake = Math.min(1, hit / 12); }
  c.along = c.vx * nfx + c.vz * nfz;
  for (let i = 0; i < 4; i++) { const w = c.wheels[i]; w.children[0].rotation.x += c.along * dt / 0.36; if (i < 2) w.rotation.y = c.steer; }
  c.tailM.material = brk && c.along > 0.5 ? MAT.brake : MAT.tail;
  c.sync();
  // drift smoke-ish sound
  const slip = Math.abs(c.vx * nfz - c.vz * nfx);
  if (slip > 5 && Math.random() < dt * 8) audio.step(0.05 + slip * 0.01);
  const kmh = Math.abs(c.along) * 3.6;
  const gears = [0, 22, 45, 72, 105, 140, 999]; let g = 1; while (kmh > gears[g] && g < 6) g++;
  const rpm = c.along < -0.3 ? Math.min(1, kmh / 25) : clamp((kmh - gears[g - 1]) / (gears[g] - gears[g - 1]), 0.05, 1) * 0.8 + 0.15;
  audio.update(true, rpm, thr || brk ? 1 : 0, dayF < 0.5, dt);
  $('kmh').textContent = Math.round(kmh); $('gear').textContent = c.along < -0.3 ? 'R' : Math.abs(c.along) < 0.3 ? 'N' : g;
  P.x = c.x; P.z = c.z;
  if (hornHeld) audio.horn(true); else audio.horn(false);
}

function lightState(axisX, t) {
  const tc = t % 24;
  if (axisX) return tc < 10 ? 'g' : tc < 12 ? 'a' : 'r';
  return tc >= 12 && tc < 22 ? 'g' : tc >= 22 ? 'a' : 'r';
}
function updateTraffic(dt, t) {
  for (const c of cars) {
    if (c === P.car) continue;
    if (c.honk > 0) c.honk -= dt;
    const ai = c.ai;
    if (!ai || c.knock > 0) {
      if (c.knock > 0) c.knock -= dt;
      const sp = c.speed();
      if (sp > 0.05) {
        c.vx = damp(c.vx, 0, 2.2, dt); c.vz = damp(c.vz, 0, 2.2, dt);
        c.x += c.vx * dt; c.z += c.vz * dt; c.h += (c.vx * c.fz - c.vz * c.fx) * 0.02 * dt;
        carSolids(c); carCars(c); c.sync();
        if (ai) { ai.v = 0; }
      } else { c.vx = c.vz = 0; }
      continue;
    }
    const axisX = ai.dx !== 0, sgn = axisX ? ai.dx : ai.dz;
    const along = axisX ? c.x : c.z, lat = axisX ? c.z : c.x;
    // obstacles ahead
    let target = ai.cruise;
    const fx = ai.dx, fz = ai.dz;
    let blockedBy = 0;
    const check = (ox, oz, w) => { const rx = ox - c.x, rz = oz - c.z, a = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx); if (a > 0 && a < 14 && l < w) { const v = Math.max(0, (a - 6) * 1.4); if (v < target) { target = v; blockedBy = 1; } } };
    if (!P.car) check(P.x, P.z, 1.6); else check(P.car.x, P.car.z, 1.8);
    if (!(ai.force > 0)) for (const o of cars) {
      if (o === c || o === P.car || Math.abs(o.x - c.x) > 16 || Math.abs(o.z - c.z) > 16) continue;
      // only follow cars going our way; crossing traffic is handled by the lights
      if (o.ai && !o.knock && o.ai.dx * fx + o.ai.dz * fz < 0.7) continue;
      check(o.x, o.z, 1.8);
    }
    if (ai.force > 0) ai.force -= dt;
    ai.stuck = blockedBy && ai.v < 0.4 && Math.hypot(P.x - c.x, P.z - c.z) > 10 ? (ai.stuck || 0) + dt : 0;
    if (ai.stuck > 6) { ai.force = 2.5; ai.stuck = 0; }
    if (!P.car && target < 1 && Math.hypot(P.x - c.x, P.z - c.z) < 9 && c.honk <= 0) { c.honk = 4; audio.honkFar(); if (rnd() < 0.5) say(pick(['Pardon !', 'On traverse ?', 'Bip bip !']), c, 2.4); }
    // traffic light
    const list = axisX ? RX : RZ;
    let next = null; for (const v of list) { const d = (v - along) * sgn; if (d > -0.5 && (next === null || d < next.d)) next = { v, d }; }
    if (next) {
      const ls = lightState(axisX, t);
      if (ls !== 'g' && next.d > 7.5 && next.d < 22) target = Math.min(target, Math.max(0, (next.d - 9.5) * 1.2));
      // turning decision when crossing the centre
      if (ai.cool > 0) ai.cool -= dt;
      else if (ai.prev > 0 && next.d <= 0.3 && ai.lastTurn !== next.v) {
        ai.lastTurn = next.v; const r = rnd();
        if (r < 0.4) {
          const right = r < 0.2; // right turn: dir becomes right vector (-dz, dx)
          const ndx = right ? -ai.dz : ai.dz, ndz = right ? ai.dx : -ai.dx;
          const roadCoord = axisX ? next.v : next.v; // the crossing road sits at this coordinate
          ai.dx = ndx; ai.dz = ndz; ai.lane = laneFor(ndx, ndz, roadCoord); ai.prev = 99; ai.cool = 2.5;
          continue;
        }
      }
      ai.prev = next.d;
    }
    ai.v = damp(ai.v, target, target < ai.v ? 5 : 1.2, dt);
    const ox = c.x, oz = c.z;
    if (axisX) { c.x += sgn * ai.v * dt; c.z += clamp(ai.lane - lat, -ai.v * 0.55 * dt, ai.v * 0.55 * dt); }
    else { c.z += sgn * ai.v * dt; c.x += clamp(ai.lane - lat, -ai.v * 0.55 * dt, ai.v * 0.55 * dt); }
    const mx = c.x - ox, mz = c.z - oz;
    if (mx * mx + mz * mz > 1e-6) c.h += wrapA(Math.atan2(mx, mz) - c.h) * Math.min(1, dt * 8);
    c.vx = mx / dt; c.vz = mz / dt;
    if (axisX && Math.abs(c.x) > EXT + 15) { c.x = -Math.sign(c.x) * (EXT + 14); ai.lastTurn = null; ai.prev = 99; }
    if (!axisX && Math.abs(c.z) > ZEXT + 15) { c.z = -Math.sign(c.z) * (ZEXT + 14); ai.lastTurn = null; ai.prev = 99; }
    for (const w of c.wheels) w.children[0].rotation.x += ai.v * dt / 0.36;
    c.sync();
  }
}
function updatePeds(dt) {
  const pc = P.car, sp = pc ? pc.speed() : 0;
  for (const p of peds) {
    const [x, z, tx, tz] = p.path.at(p.s);
    let block = false;
    // stop for the hero on foot right ahead
    const hx = (pc ? pc.x : P.x) - p.x, hz = (pc ? pc.z : P.z) - p.z, hd = Math.hypot(hx, hz);
    if (!pc && hd < 1.4 && (hx * tx + hz * tz) * p.dir > 0) block = true;
    // dodge a speeding car
    if (pc && sp > 5 && hd < 9 && p.down <= 0 && p.offT <= 0) {
      const ahead = (-hx) * pc.vx + (-hz) * pc.vz;
      if (ahead > 0) { p.offT = 1.6; p.vy = 4.2; p.off = (p.off > 0 ? -1 : 1) * 2.2; if (rnd() < 0.6) say(pick(['Attention !', 'Doucement !', 'Oh là !', 'Hé !', 'Ralentissez !']), p.p.root); }
    }
    if (pc && hd < 1.6 && sp > 4 && p.down <= 0) { p.down = 2.4; p.vy = 3; say(pick(['Aïe…', 'Mon dos !', 'Ça va, ça va…']), p.p.root); }
    if (p.wait > 0) { p.wait -= dt; block = true; }
    if (!block && p.down <= 0) {
      p.s += p.dir * p.v * dt;
      if (!p.path.loop && (p.s > p.path.len || p.s < 0)) { p.dir *= -1; p.s = clamp(p.s, 0, p.path.len); p.wait = 1 + rnd() * 3; }
    }
    if (p.offT > 0) p.offT -= dt; else p.off = damp(p.off, 0, 1.5, dt);
    if (p.down > 0) p.down -= dt;
    p.vy -= 16 * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) p.vy = 0;
    const nx = -tz, nz = tx;
    p.x = x + nx * p.off; p.z = z + nz * p.off;
    if (!block && p.down <= 0) p.h = Math.atan2(tx * p.dir, tz * p.dir);
    const moving = !block && p.down <= 0;
    p.phase += dt * (moving ? p.v * 2.1 : 0);
    // cheap culling of the animation for far peds
    const far = Math.abs(p.x - P.x) > 90 || Math.abs(p.z - P.z) > 90;
    p.p.root.visible = !far;
    if (far) continue;
    const downT = p.down > 0 ? clamp(Math.min(p.down, 2.4 - p.down) * 4, 0, 1) : 0;
    animatePerson(p.p, p.phase, moving ? 0.5 : 0, { air: p.y > 0.2, down: downT, wave: !moving && !downT && p.wait > 0 && hd < 6 });
    p.p.root.position.set(p.x, p.y + 0.1, p.z); p.p.root.rotation.y = p.h;
  }
}

/* ================= zones ================= */
function zoneOf(x, z) {
  if (Math.abs(x) < 60 && Math.abs(z) < 30) return Math.hypot(x - 32, z + 8) < 11 ? ['Parc central', 'Espace commun'] : ['Domaine Red Stone', 'Parc central'];
  for (const l of lots) if (x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1) return [`Lot n° ${l.n}`, `Villa ${l.name}`];
  for (let i = 0; i < 4; i++) if (Math.abs(z - RZ[i]) < 5) return ['Domaine Red Stone', ROADZ[i]];
  for (let i = 0; i < 4; i++) if (Math.abs(x - RX[i]) < 5) return ['Domaine Red Stone', ROADX[i]];
  for (const [px, pz] of parkings) if (Math.abs(x - px) < 31 && Math.abs(z - pz) < 8) return ['Domaine Red Stone', 'Parking visiteurs'];
  if (Math.abs(x) > 200 || Math.abs(z) > 110) return ['Les abords', 'La pinède'];
  return ['Domaine Red Stone', 'Le quartier'];
}

/* ================= main loop ================= */
const clock = new THREE.Clock();
const look = V(0, 0, 0), camPos = V(0, 0, 0), tmp = V(0, 0, 0);
let lastZone = '', areaT = 0, simT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (paused) return;
  simT += dt;
  if (started) tod = (tod + dt * timeScale) % 24;
  const night = updateSky();
  $('clock').textContent = `${String(Math.floor(tod)).padStart(2, '0')}:${String(Math.floor(tod % 1 * 60)).padStart(2, '0')}`;

  // traffic lights
  const lx = lightState(true, simT), lz = lightState(false, simT);
  for (const [ax, s] of [['x', lx], ['z', lz]]) { MAT['tl' + ax + 'r'].color.set(s === 'r' ? '#ff2a1a' : '#3a1210'); MAT['tl' + ax + 'a'].color.set(s === 'a' ? '#ffb31a' : '#3a2a10'); MAT['tl' + ax + 'g'].color.set(s === 'g' ? '#37e07a' : '#10301c'); }

  if (started) { if (P.car) updateDrive(P.car, dt); else { updateFoot(dt); audio.update(false, 0, 0, night > 0.5, dt); audio.horn(false); } }
  updateTraffic(dt, simT);
  updatePeds(dt);

  // collectibles
  for (const k of keys3d) {
    if (!k.m.visible) continue;
    k.m.rotation.y += dt * 2; k.m.position.y = k.y + Math.sin(simT * 2 + k.i) * 0.15;
    if (started && Math.hypot(k.x - P.x, k.z - P.z) < 1.6 && Math.abs((P.y + 1) - k.m.position.y) < 1.8) {
      k.m.visible = false; save.keys.push(k.i); addMoney(5000); persist(); audio.sfx('key');
      const n = save.keys.length;
      if (n === keys3d.length) { addMoney(50000); banner('Toutes les clés', '+ 50 000 € · le domaine n\'a plus de secrets', true); audio.sfx('passed'); }
      else hint(`Clé dorée trouvée : <b>${n}/${keys3d.length}</b> · + 5 000 €`, 3.5, 'key' + n);
    }
  }
  // missions
  for (const m of Object.values(MISSIONS)) { m.marker.children[1].position.y = 2.6 + Math.sin(simT * 3) * 0.2; m.marker.children[1].rotation.y += dt * 2; }
  nearMission = null;
  if (!mission && started) for (const m of Object.values(MISSIONS)) {
    if (Math.hypot(m.start[0] - P.x, m.start[1] - P.z) < (P.car ? 4 : 1.8)) {
      if (m.needCar && P.car) { startMission(m); break; }
      nearMission = m;
      hint(m.needCar ? `<b>${m.title}</b> — montez dans une voiture puis revenez ici.` : `Appuyez sur <kbd>E</kbd> pour lancer <b>${m.title}</b>.`, 0.5, 'mission' + m.id);
    }
  }
  if (mission) {
    mission.t -= dt;
    const t = missionTarget(), left = Math.max(0, mission.t);
    $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    $('timer').classList.toggle('low', left < 15);
    if (Math.hypot(t.x - P.x, t.z - P.z) < t.r) {
      mission.step++; audio.sfx('cp');
      if (mission.m.id === 'visite') {
        if (mission.step >= VISIT.length) endMission(true);
        else { const d = VISIT[mission.step]; subtitle(`Le client a adoré. Direction la <b>Villa ${d.name}</b>, lot n° ${d.n}.`, 6); }
      } else if (mission.step >= RACE_CP.length) endMission(true);
      if (mission) updateCheckpoint();
    } else if (mission.t <= 0) endMission(false);
  }
  checkpoint.children[0].rotation.z += dt * 0.5;
  // waypoint
  if (waypoint) { waypointBeam.visible = true; waypointBeam.position.set(waypoint[0], 60, waypoint[1]); if (Math.hypot(waypoint[0] - P.x, waypoint[1] - P.z) < 8) { waypoint = null; audio.sfx('cp'); hint('Vous êtes arrivé.', 2); } }
  else waypointBeam.visible = false;
  routeT -= dt;
  if (routeT <= 0) {
    routeT = 0.4;
    const t = missionTarget(), dest = t ? [t.x, t.z, mission.m.color] : waypoint ? [waypoint[0], waypoint[1], '#b46ddc'] : null;
    route = dest ? { p: routeTo(dest[0], dest[1], P.x, P.z), c: dest[2] } : null;
  }

  // proximity prompts
  nearDoor = null; nearCar = null;
  if (started && !P.car) {
    let best = 2.6; for (const d of doors) { const dd = Math.hypot(d.x - P.x, d.z - P.z); if (dd < best) { best = dd; nearDoor = d; } }
    let bc = 2.4; for (const c of cars) { if (Math.abs(c.x - P.x) > 5 || Math.abs(c.z - P.z) > 5) continue; const d = distToCar(c, P.x, P.z); if (d < bc) { bc = d; nearCar = c; } }
  }
  const pr = $('prompt');
  if (nearCar) { pr.innerHTML = `<b>F</b>${nearCar.ai ? 'Emprunter cette voiture' : 'Conduire'}`; pr.classList.add('on'); }
  else if (nearDoor) { pr.innerHTML = `<b>E</b>Découvrir la Villa ${nearDoor.name}`; pr.classList.add('on'); }
  else pr.classList.remove('on');
  $('m-car').textContent = P.car ? 'Sortir' : 'Voiture';
  document.body.classList.toggle('driving', !!P.car);

  // zone
  if (started) {
    const [k, n] = zoneOf(P.x, P.z), key = k + n;
    if (key !== lastZone) { lastZone = key; $('area-k').textContent = k; $('area-n').textContent = n; $('area').classList.add('on'); areaT = 3.5; }
    if ((areaT -= dt) <= 0) $('area').classList.remove('on');
  }

  // camera
  const car = P.car;
  const lookY = car ? 1.3 : P.y + (P.swim ? 1.0 : 1.55);
  look.set(car ? car.x : P.x, lookY, car ? car.z : P.z);
  const now = performance.now() / 1000;
  if (car && now - lastMouse > 1.4 && Math.abs(car.along) > 1) { const back = car.along >= 0 ? car.h + Math.PI : car.h; yaw += wrapA(back - yaw) * Math.min(1, dt * 2.5); pitch = damp(pitch, 0.22, 1.5, dt); }
  if (!started) yaw += dt * 0.06;
  const dist = car ? 8.2 + Math.abs(car.along) * 0.06 : camDist;
  const cx = Math.sin(yaw) * Math.cos(pitch), cy = Math.sin(pitch), cz = Math.cos(yaw) * Math.cos(pitch);
  let d = dist;
  for (let t = 0.6; t < dist; t += 0.35) {
    const x = look.x + cx * t, y = look.y + cy * t, z = look.z + cz * t;
    if (y < 0.2) { d = Math.max(0.8, t - 0.2); break; }
    let blocked = false; for (const s of query(x, z, 0.4, qbuf)) if (s[4] > y && s[4] > 2 && x > s[0] - 0.3 && x < s[2] + 0.3 && z > s[1] - 0.3 && z < s[3] + 0.3) { blocked = true; break; }
    if (blocked) { d = Math.max(0.8, t - 0.4); break; }
  }
  camPos.set(look.x + cx * d, look.y + cy * d, look.z + cz * d);
  camera.position.lerp(camPos, started ? Math.min(1, dt * (car ? 8 : 12)) : 1);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(look);
  const fov = car ? 58 + clamp(Math.abs(car.along) * 0.45, 0, 16) : 58;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position); stars.position.copy(camera.position);

  // night lights
  if (night > 0.45 && !sketch) {
    const px = P.x, pz = P.z;
    const near = lampPos.map(p => [p, (p[0] - px) ** 2 + (p[1] - pz) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, lampLights.length);
    lampLights.forEach((l, i) => { l.position.set(near[i][0][0], 4.7, near[i][0][1]); l.intensity = 45 * (night - 0.45) / 0.55; });
  } else lampLights.forEach(l => l.intensity = 0);
  if (car && night > 0.45 && !sketch) {
    headLight.intensity = 140; headLight.position.set(car.x + car.fx * 2.2, 0.9, car.z + car.fz * 2.2);
    headTarget.position.set(car.x + car.fx * 14, 0, car.z + car.fz * 14);
  } else headLight.intensity = 0;

  // HUD
  if (moneyShown !== save.money) { moneyShown = damp(moneyShown, save.money, 4, dt); if (Math.abs(moneyShown - save.money) < 1) moneyShown = save.money; }
  $('money').textContent = fmtMoney(moneyShown);
  $('keys-n').textContent = `${save.keys.length}/${keys3d.length}`;
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('on');
  if (subT > 0 && (subT -= dt) <= 0) $('sub').classList.remove('on');
  if (hintT > 0 && (hintT -= dt) <= 0) { $('hint').classList.remove('on'); hintKey = ''; }
  if (radioT > 0 && (radioT -= dt) <= 0) $('radio').classList.remove('on');
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    const o = b.obj.g || b.obj; tmp.setFromMatrixPosition(o.matrixWorld); tmp.y += b.yOff; tmp.project(camera);
    if (b.t <= 0 || tmp.z > 1) { if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); } else b.el.style.display = 'none'; continue; }
    b.el.style.display = 'block'; b.el.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px'; b.el.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px'; b.el.style.opacity = Math.min(1, b.t * 2);
  }
  if (sketch) for (const nt of notes) {
    const dd = nt.p.distanceTo(camera.position); tmp.copy(nt.p).project(camera);
    const vis = dd < 70 && tmp.z < 1; nt.el.style.display = vis ? 'block' : 'none';
    if (vis) { nt.el.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px'; nt.el.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px'; nt.el.style.opacity = Math.min(1, (70 - dd) / 20); }
  }
  drawMinimap();
  renderer.render(scene, camera);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (paused) drawBigmap(); });

/* ================= intro ================= */
const intro = $('intro'), go = $('go');
intro.querySelectorAll('.sw button').forEach(b => b.onclick = () => {
  intro.querySelectorAll('.sw button').forEach(x => x.setAttribute('aria-pressed', x === b));
  hero.sh.color.set(b.dataset.c);
});
go.onclick = () => {
  started = true; intro.classList.add('gone'); audio.init();
  if (!isTouch) canvas.requestPointerLock?.()?.catch?.(() => {});
  setTimeout(() => banner('Domaine Red Stone', 'Bienvenue dans le quartier'), 400);
  setTimeout(() => subtitle(save.money ? `Bon retour. Votre commission : <b>${fmtMoney(save.money)}</b>.` : 'L\'agence vous attend au <b>marqueur jaune</b>, juste devant vous. Ou partez explorer : 12 clés dorées sont cachées dans le domaine.', 7), 2600);
  hint(isTouch ? 'Joystick : marcher · glisser à droite : regarder · <b>Voiture</b> près d\'un véhicule pour conduire.' : '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> marcher · <kbd>Maj</kbd> courir · <kbd>F</kbd> monter dans une voiture · <kbd>M</kbd> carte · <kbd>Échap</kbd> pause', 9, 'intro');
};
document.querySelectorAll('[data-help]').forEach(el => el.hidden = isTouch);
camera.position.set(P.x + 10, 8, P.z + 10);
hero.root.position.set(P.x, 0, P.z); hero.root.rotation.y = P.heading;
applySketch();
requestAnimationFrame(frame);
go.disabled = false; go.textContent = 'Jouer';
