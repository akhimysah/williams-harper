// Le Quartier 3D — Domaine Red Stone. Open-world walk / drive in the estate.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from './vendor/BufferGeometryUtils.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

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
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe0ea, 90, 320);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);
const rig = new THREE.Group(); scene.add(rig); // VR: the visitor's body; the headset camera rides inside

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
for (const [k, c] of [['signA', '#b08d57'], ['signB', '#2f4a6e'], ['signC', '#c4643f'], ['signD', '#3f6340']]) MAT[k] = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 });
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
function solid(x0, x1, z0, z1, h, kind) { solids.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h, kind, r: 0 }); }
// rotated box: centre, half extents along its local u / v, rotation ry (local u = (cos, -sin), local v = (sin, cos))
function solidR(cx, cz, hu, hv, ry, h, kind) {
  const c = Math.cos(ry), s = Math.sin(ry), ex = Math.abs(hu * c) + Math.abs(hv * s), ez = Math.abs(hu * s) + Math.abs(hv * c);
  solids.push({ x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez, cx, cz, hu, hv, c, s, r: ry, h, kind });
}
const toLocal = (S, px, pz) => { const dx = px - S.cx, dz = pz - S.cz; return [dx * S.c - dz * S.s, dx * S.s + dz * S.c]; };
const toWorld = (S, u, v) => [u * S.c + v * S.s, -u * S.s + v * S.c];
function solidPush(S, px, pz, R) { // push vector moving the circle (px, pz, R) out of S, or null
  if (!S.r) {
    if (px + R <= S.x0 || px - R >= S.x1 || pz + R <= S.z0 || pz - R >= S.z1) return null;
    const l = px + R - S.x0, r = S.x1 - (px - R), t = pz + R - S.z0, b = S.z1 - (pz - R), m = Math.min(l, r, t, b);
    return m === l ? [-l, 0] : m === r ? [r, 0] : m === t ? [0, -t] : [0, b];
  }
  const [u, v] = toLocal(S, px, pz);
  if (Math.abs(u) >= S.hu + R || Math.abs(v) >= S.hv + R) return null;
  const l = u + R + S.hu, r = S.hu - (u - R), t = v + R + S.hv, b = S.hv - (v - R), m = Math.min(l, r, t, b);
  return toWorld(S, ...(m === l ? [-l, 0] : m === r ? [r, 0] : m === t ? [0, -t] : [0, b]));
}
function solidContains(S, px, pz, m = 0) {
  if (!S.r) return px > S.x0 - m && px < S.x1 + m && pz > S.z0 - m && pz < S.z1 + m;
  const [u, v] = toLocal(S, px, pz); return Math.abs(u) < S.hu + m && Math.abs(v) < S.hv + m;
}
function solidClosest(S, px, pz) {
  if (!S.r) return [clamp(px, S.x0, S.x1), clamp(pz, S.z0, S.z1), (S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2];
  const [u, v] = toLocal(S, px, pz), [wx, wz] = toWorld(S, clamp(u, -S.hu, S.hu), clamp(v, -S.hv, S.hv)); return [S.cx + wx, S.cz + wz, S.cx, S.cz];
}
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

// ---------------------------------------------------------------------------------------------
// Site plan traced from the Williams & Harper masterplan (brochure key): the Chloé block in the
// middle, crossed diagonally by the park; the shops' round plaza and the garden with its pond to
// the west; the roundabout, the parking and the shared space south of the block; the Céline villas
// along the south front, bending along the oblique road; the Margaux villas in two groups, south-west
// and east. Coordinates in metres, x east, z south, origin at the north-west corner of the Chloé block.
const VILLAS = { 'Chloé': 'villa-chloe.html', 'Céline': 'villa-celine.html', 'Margaux': 'villa-margaux.html' };
const LD = 28, LW = 23.75, BW = 190, BD = 156;
const WORLD = { x0: -300, x1: 300, z0: -210, z1: 330 };
const SITE_POLY = [[-40, -12], [262, -12], [262, 100], [232, 150], [188, 196], [132, 232], [72, 246], [-20, 246], [-90, 252], [-130, 292], [-200, 286], [-224, 200], [-206, 108], [-160, 58], [-100, 18]];
const GARDEN_POLY = [[-22, 10], [-22, 155], [-200, 155], [-206, 108], [-160, 58], [-100, 18]];
function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const bboxOf = q => [Math.min(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[0])), Math.max(...q.map(p => p[1]))];
const ROADS = [
  { name: 'Avenue Red Stone', p0: [WORLD.x0 - 20, -6], p1: [WORLD.x1 + 20, -6], w: 10, ai: true, wrap: true },
  { name: 'Rue Harper', p0: [-16, WORLD.z0 - 20], p1: [-16, 161], w: 10, ai: true },
  { name: 'Allée du Lac', p0: [WORLD.x0 - 20, 161], p1: [84, 161], w: 10, ai: true },
  { name: 'Rue Margaux', p0: [196, -6], p1: [196, 80], w: 10, ai: true },
  { name: 'Allée des Pins', p0: [-16, 60], p1: [196, 60], w: 8, ai: true },
  { name: 'Allée des Palmiers', p0: [-16, 124], p1: [123.5, 124], w: 8, ai: true },
  { name: 'Allée Céline', p0: [84, 161], p1: [196, 56], w: 10, ai: false },
  { name: 'Impasse Margaux', p0: [-150, 161], p1: [-150, 262], w: 6, ai: false },
];
for (const rd of ROADS) {
  const [x0, z0] = rd.p0, [x1, z1] = rd.p1;
  rd.L = Math.hypot(x1 - x0, z1 - z0); rd.dx = (x1 - x0) / rd.L; rd.dz = (z1 - z0) / rd.L;
  rd.ang = Math.atan2(rd.dx, rd.dz); rd.axis = Math.abs(rd.dx) > 0.99 ? 'x' : Math.abs(rd.dz) > 0.99 ? 'z' : null; rd.xings = [];
}
const XINGS = [];
for (let i = 0; i < ROADS.length; i++) for (let j = i + 1; j < ROADS.length; j++) {
  const a = ROADS[i], b = ROADS[j], den = a.dx * b.dz - a.dz * b.dx; if (Math.abs(den) < 1e-6) continue;
  const qx = b.p0[0] - a.p0[0], qz = b.p0[1] - a.p0[1];
  const ta = (qx * b.dz - qz * b.dx) / den, tb = (qx * a.dz - qz * a.dx) / den;
  if (ta < -0.5 || ta > a.L + 0.5 || tb < -0.5 || tb > b.L + 0.5) continue;
  const X = { x: a.p0[0] + a.dx * ta, z: a.p0[1] + a.dz * ta, ai: a.ai && b.ai, axisX: !!(a.axis && b.axis && a.axis !== b.axis), a, b };
  XINGS.push(X); a.xings.push({ t: ta, other: b, to: tb, X }); b.xings.push({ t: tb, other: a, to: ta, X });
}
const DIAG = ROADS.find(r => r.name === 'Allée Céline'), DN = [-DIAG.dz, DIAG.dx]; // DN: normal pointing south-east
const diagDist = (x, z) => (x - DIAG.p0[0]) * DN[0] + (z - DIAG.p0[1]) * DN[1];
function nearestRoad(x, z) {
  let best = null;
  for (const rd of ROADS) {
    const px = x - rd.p0[0], pz = z - rd.p0[1], t = clamp(px * rd.dx + pz * rd.dz, 0, rd.L), d = Math.hypot(px - rd.dx * t, pz - rd.dz * t);
    if (!best || d < best.d) best = { r: rd, t, d, x: rd.p0[0] + rd.dx * t, z: rd.p0[1] + rd.dz * t };
  }
  return best;
}
const nearRoad = (x, z, m) => { const n = nearestRoad(x, z); return n.d < n.r.w / 2 + m; };

put('grass', new THREE.BoxGeometry(WORLD.x1 - WORLD.x0 + 60, 0.2, WORLD.z1 - WORLD.z0 + 60).translate((WORLD.x0 + WORLD.x1) / 2, -0.1, (WORLD.z0 + WORLD.z1) / 2));
// street lamps
function lamp(lx, lz, ax, az) {
  put('lamp', new THREE.CylinderGeometry(0.07, 0.11, 5.2, 6), mat4(lx, 2.6, lz));
  box('lamp', Math.min(lx, lx + ax * 1.4) - 0.07, Math.max(lx, lx + ax * 1.4) + 0.07, 5.1, 5.25, Math.min(lz, lz + az * 1.4) - 0.07, Math.max(lz, lz + az * 1.4) + 0.07);
  const hx = lx + ax * 1.4, hz = lz + az * 1.4;
  box('lamp', hx - 0.3, hx + 0.3, 5.0, 5.15, hz - 0.22, hz + 0.22);
  box('bulb', hx - 0.24, hx + 0.24, 4.93, 5.0, hz - 0.17, hz + 0.17);
  solid(lx - 0.15, lx + 0.15, lz - 0.15, lz + 0.15, 5);
  lampPos.push([hx, hz]);
}
// roads: asphalt, centre dashes, lamps
for (const rd of ROADS) {
  const M = mat4((rd.p0[0] + rd.p1[0]) / 2, 0, (rd.p0[1] + rd.p1[1]) / 2, 0, rd.ang), hw = rd.w / 2;
  box('asphalt', -hw, hw, 0, 0.02 + (rd.axis === 'z' ? 0.001 : rd.axis ? 0 : 0.002), -rd.L / 2 - hw, rd.L / 2 + hw, M);
  for (let t = 4; t < rd.L - 4; t += 8) if (!rd.xings.some(x => Math.abs(x.t - t - 1.5) < 10)) box('line', -0.1, 0.1, 0.02, 0.035, t - rd.L / 2, t - rd.L / 2 + 3, M);
  if (rd.w >= 10) for (let t = 12, side = 1; t < rd.L - 10; t += 17, side = -side) {
    if (rd.xings.some(x => Math.abs(x.t - t) < 11)) continue;
    const p = V(side * (hw + 0.7), 0, t - rd.L / 2).applyMatrix4(M);
    lamp(p.x, p.z, -side * Math.cos(rd.ang), side * Math.sin(rd.ang));
  }
}
// crosswalks + traffic lights at the crossings of the straight roads
for (const X of XINGS) {
  if (!X.axisX) continue;
  const rx = X.x, rz = X.z, xr = X.a.axis === 'x' ? X.a : X.b, zr = X.a.axis === 'z' ? X.a : X.b;
  const ox = zr.w / 2 + 1.5, oz = xr.w / 2 + 1.5, tx = (rx - xr.p0[0]) * xr.dx, tz = (rz - zr.p0[1]) * zr.dz;
  for (const sx of [-1, 1]) if (tx + sx * ox > 0 && tx + sx * ox < xr.L) for (let k = -xr.w / 2 + 1; k <= xr.w / 2 - 1; k++) box('line', rx + sx * ox - 1, rx + sx * ox + 1, 0.021, 0.036, rz + k - 0.22, rz + k + 0.22);
  for (const sz of [-1, 1]) if (tz + sz * oz > 0 && tz + sz * oz < zr.L) for (let k = -zr.w / 2 + 1; k <= zr.w / 2 - 1; k++) box('line', rx + k - 0.22, rx + k + 0.22, 0.022, 0.037, rz + sz * oz - 1, rz + sz * oz + 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = rx + sx * (ox + 0.9), pz = rz + sz * (oz + 0.9);
    put('lamp', new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), mat4(px, 2.1, pz));
    solid(px - 0.2, px + 0.2, pz - 0.2, pz + 0.2, 4.2);
    for (const [ax, o1, o2] of [['x', 0, 0], ['z', 0.38 * -sx, 0.38 * -sz]]) {
      const hx = px + o1, hz = pz + o2;
      box('lamp', hx - 0.17, hx + 0.17, 3.35, 4.35, hz - 0.17, hz + 0.17);
      box('tl' + ax + 'r', hx - 0.2, hx + 0.2, 4.05, 4.27, hz - 0.2, hz + 0.2);
      box('tl' + ax + 'a', hx - 0.2, hx + 0.2, 3.75, 3.97, hz - 0.2, hz + 0.2);
      box('tl' + ax + 'g', hx - 0.2, hx + 0.2, 3.45, 3.67, hz - 0.2, hz + 0.2);
    }
  }
}

function lot(lx, front, dir, vname, sc = 1) { return lotAt(lx, front, dir > 0 ? 0 : Math.PI, vname, sc); }
// a lot with its front line at (lx, lz), facing -local z, rotated by ry, scaled by sc in plan
function lotAt(lx, lz, ry, vname, sc = 1) {
  const B = mat4(lx, 0, lz, 0, ry, 0, sc, 1, sc);
  const s = rnd() < 0.5 ? 1 : -1;
  const lb = (k, u0, u1, y0, y1, v0, v1) => box(k, s * u0, s * u1, y0, y1, v0, v1, B);
  const W = (u, v) => V(s * u, 0, v).applyMatrix4(B);
  const quad = (u0, u1, v0, v1) => [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)].map(p => [p.x, p.z]);
  const ls = (u0, u1, v0, v1, h, kind) => { const c = W((u0 + u1) / 2, (v0 + v1) / 2); solidR(c.x, c.z, Math.abs(u1 - u0) / 2 * sc, (v1 - v0) / 2 * sc, ry, h, kind); };
  const hw = LW / 2;
  lb('fence', -hw, -hw + 0.1, 0, 1.6, 0.3, LD); lb('fence', hw - 0.1, hw, 0, 1.6, 0.3, LD); lb('fence', -hw, hw, 0, 1.6, LD - 0.1, LD);
  ls(-hw, -hw + 0.1, 0.3, LD, 1.7); ls(hw - 0.1, hw, 0.3, LD, 1.7); ls(-hw, hw, LD - 0.1, LD, 1.7);
  const vurl = VILLAS[vname];
  const record = extra => { const poly = quad(-hw, hw, 0, LD), bb = bboxOf(poly); doors.push(extra.door); lots.push({ x0: bb[0], z0: bb[1], x1: bb[2], z1: bb[3], poly, name: vname, n: lots.length + 1, ...extra }); };
  if (vname === 'Céline') return celine(ry, s, B, lb, W, quad, ls, vname, vurl, record);
  if (vname === 'Margaux') return margaux(ry, s, B, lb, W, quad, ls, vname, vurl, record);
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
  pools.push(quad(-7, 1, 20, 24.5)); ls(-7.5, 1.5, 19.5, 25, 0.3, 'pool');
  for (const u of [2.4, 3.6]) { lb('table', u, u + 0.75, 0, 0.35, 20.5, 22.5); }
  const t = W(-9.3, 3.2); tree(t.x, t.z, 0.8 + rnd() * 0.4);
  const p = W(8.6, 24.5); rnd() < 0.6 ? palm(p.x, p.z, 5 + rnd() * 2.5) : tree(p.x, p.z, 0.9);
  if (rnd() < 0.5) { const c = W(7, 3.2); parkedSpots.push([c.x, c.z, ry + (rnd() < 0.5 ? 0 : Math.PI)]); }
  const d = W(2.15, 4.6);
  const door = { x: d.x, z: d.z, name: vname, url: vurl, n: lots.length + 1 };
  record({ door, green, roof: W(1, 11), pool: W(-3, 22.2), house: quad(-8, 4, 6, 16), poolR: quad(-7, 1, 20, 24.5) });
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
// Villa Margaux, after the architect's renders: wide symmetric two-storey villa, a double-height glass
// atrium in the middle (gold spiral stair, hanging gold discs) between two light marble pillars, dark
// marble pylons with gold lines at both ends, glass balconies, deep wood soffits with LED lines, an
// infinity pool across the whole front with a black marble water feature and stepping stones.
function margaux(ry, s, B, lb, W, rect, ls, vname, vurl, record) {
  const P3 = (u, y, v) => V(s * u, y, v);
  const sc = Math.hypot(B.elements[0], B.elements[2]) || 1.5;
  // front: low dark wall with a gate, lawn with stepping stones, rocks, clipped bushes and pines
  lb('marbleD', -11.8, 6.4, 0, 0.45, 0, 0.35); ls(-11.8, 6.4, 0, 0.35, 0.45); lb('led', -11.8, 6.4, 0.36, 0.39, -0.02, 0);
  lb('marbleD', 9.4, 11.8, 0, 0.45, 0, 0.35); ls(9.4, 11.8, 0, 0.35, 0.45);
  for (let v = 1.2; v < 8.6; v += 1.4) { const p = W(7.9, v); put('marbleL', new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), mat4(p.x, 0.025, p.z)); }
  for (const [u, v, r] of [[-8.6, 3.2, 0.75], [-7.4, 3.9, 0.45], [3.6, 2.4, 0.55], [10.2, 7.6, 0.8], [-10.8, 8.4, 0.5], [9.8, 8.6, 0.45]]) { const p = W(u, v); put('rock', new THREE.IcosahedronGeometry(r, 0), mat4(p.x, r * 0.5, p.z, rnd(), rnd() * 6, 0, 1.4, 0.75, 1)); }
  for (const [u, v, r] of [[-5.2, 5.4, 0.5], [-2.6, 6.8, 0.42], [1.4, 4.2, 0.55], [4.6, 7.4, 0.45], [-9.4, 5.8, 0.4], [10.6, 4.6, 0.45], [6.2, 8.8, 0.38], [0.4, 8.4, 0.4]]) { const p = W(u, v); put('leaf', new THREE.IcosahedronGeometry(r, 1), mat4(p.x, r * 0.8, p.z)); }
  { const a = W(-11.2, 1.4); pine(a.x, a.z, 14); const b = W(11.2, 2.2); pine(b.x, b.z, 12); }
  // infinity pool across the whole front: light stone coping, LED under the far edge, stepping stones, dark water feature
  lb('marbleL', -11.2, 11.2, 0, 0.2, 9.2, 9.5); lb('marbleL', -11.2, 11.2, 0, 0.2, 13.2, 13.5);
  lb('marbleL', -11.2, -10.9, 0, 0.2, 9.5, 13.2); lb('marbleL', 10.9, 11.2, 0, 0.2, 9.5, 13.2);
  lb('led', -11.2, 11.2, 0.12, 0.16, 9.17, 9.2);
  lb('waterC', -10.9, 10.9, -1.2, 0.17, 9.5, 13.2);
  pools.push(rect(-10.9, 10.9, 9.5, 13.2)); ls(-11.2, 11.2, 9.2, 13.5, 0.3, 'pool');
  for (const u of [-6.3, -4.5, -2.7, 2.7, 4.5, 6.3]) { lb('marbleL', u - 0.55, u + 0.55, 0.14, 0.24, 10.8, 11.9); ls(u - 0.55, u + 0.55, 10.8, 11.9, 0.3, 'pool'); }
  lb('marbleD', -1.7, 1.7, 0, 0.95, 12.4, 13.5); ls(-1.7, 1.7, 12.4, 13.5, 0.95); lb('water', -1.5, 1.5, 0.75, 0.9, 12.55, 13.35); lb('led', -1.7, 1.7, 0.85, 0.9, 12.37, 12.4);
  // stone terrace behind the pool; sun deck at the left front
  lb('stoneT', -11.4, 11.4, 0, 0.22, 13.5, 16.2);
  lb('stoneT', -11.4, -6.8, 0, 0.22, 7.6, 9.2);
  for (const u of [-10.6, -8.9]) { lb('sofa', u, u + 1.3, 0.22, 0.55, 7.9, 9.0); lb('sofa', u, u + 1.3, 0.55, 1.05, 7.9, 8.2); ls(u, u + 1.3, 7.9, 9.0, 0.6); }
  // dining on the left under rattan pendants, lounge on the right with the gold discs
  { const c = W(-7.2, 14.9); put('table', new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20), mat4(c.x, 0.75, c.z)); put('lamp', new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), mat4(c.x, 0.48, c.z)); solid(c.x - 1, c.x + 1, c.z - 1, c.z + 1, 0.8);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; put('parasol', new THREE.CylinderGeometry(0.28, 0.24, 0.5, 10), mat4(c.x + Math.cos(a) * 1.35, 0.5, c.z + Math.sin(a) * 1.35)); } }
  for (const [u, v] of [[-8.3, 14.6], [-6.1, 14.6]]) { const p = P3(u, 2.75, v).applyMatrix4(B); put('parasol', new THREE.ConeGeometry(0.8, 0.45, 14), mat4(p.x, p.y, p.z)); put('metal', new THREE.CylinderGeometry(0.01, 0.01, 1.0, 3), mat4(p.x, p.y + 0.7, p.z)); }
  lb('sofa', 4.6, 9.6, 0.22, 0.62, 14.9, 15.9); lb('sofa', 4.6, 9.6, 0.62, 1.15, 15.55, 15.9); for (let u = 4.75; u < 9.2; u += 0.75) lb('sofa', u, u + 0.6, 0.62, 0.8, 14.95, 15.5); ls(4.6, 9.6, 14.9, 15.9, 0.65);
  lb('marbleD', 5.8, 7.8, 0.22, 0.56, 13.8, 14.5); ls(5.8, 7.8, 13.8, 14.5, 0.56);
  for (const [u, y, r] of [[8.4, 2.5, 0.55], [9.3, 2.0, 0.4], [7.7, 1.75, 0.3]]) { const p = P3(u, y, 15.95).applyMatrix4(B); put('gold', new THREE.CylinderGeometry(r, r, 0.06, 20).rotateX(Math.PI / 2), mat4(p.x, p.y, p.z, 0, ry)); }
  // ---- the house: travertine piers and bands, dark marble pylons, glass between, wood soffits ----
  const H1 = 3.9, H2 = 7.8;
  for (const sgn of [-1, 1]) {
    const u0 = sgn < 0 ? -10 : 4.4, u1 = sgn < 0 ? -4.4 : 10, uo = sgn < 0 ? u0 : u1; // uo: outer end
    // ground floor: covered terrace, glass wall at v = 16 between stone piers
    lb('glassC', u0 + 0.9, u1 - 0.9, 0.22, H1, 16, 16.1); for (let u = u0 + 0.9; u <= u1 - 1; u += 1.5) lb('metal', u, u + 0.07, 0.22, H1, 15.92, 16);
    lb('marbleL', u0, u0 + 0.9, 0, H1, 15.5, 16.5); lb('marbleL', u1 - 0.9, u1, 0, H1, 15.5, 16.5);
    lb('floorIn', u0, u1, 0.22, 0.25, 16.1, 25.3); lb('marbleL', u0, u1, 0.22, H1, 25.3, 25.5); lb('woodIn', uo - (sgn < 0 ? 0 : 0.2), uo + (sgn < 0 ? 0.2 : 0), 0.22, H2, 16.1, 25.3);
    lb('woodIn', u0, u1, H1 - 0.08, H1, 16.1, 25.3);
    // floor band: dark fascia under the upper floor, wood soffit over the terrace, LED line
    lb('woodS', u0 - 0.5, u1 + 0.5, H1, H1 + 0.16, 13.3, 25.6);
    lb('marbleD', u0 - 0.5, u1 + 0.5, H1 + 0.16, H1 + 0.6, 13.3, 25.6); lb('led', u0 - 0.5, u1 + 0.5, H1 + 0.4, H1 + 0.46, 13.27, 13.3);
    // upper floor: travertine piers, reflective glass, travertine spandrel, glass balcony rail
    lb('marbleL', u0 - 0.5, u0 + 1.2, H1 + 0.6, H2, 14.2, 25.6); lb('marbleL', u1 - 1.2, u1 + 0.5, H1 + 0.6, H2, 14.2, 25.6);
    lb('marbleL', u0 + 1.2, u1 - 1.2, H1 + 0.6, H1 + 1.0, 14.3, 14.6);
    lb('glass', u0 + 1.2, u1 - 1.2, H1 + 1.0, H2, 14.5, 14.6); for (let u = u0 + 1.2; u <= u1 - 1.3; u += 1.6) lb('metal', u, u + 0.07, H1 + 1.0, H2, 14.42, 14.5);
    lb('floorIn', u0, u1, H1 + 0.6, H1 + 0.63, 14.6, 25.3); lb('marbleL', u0, u1, H1 + 0.6, H2, 25.3, 25.5);
    lb('metal', u0 - 0.5, u1 + 0.5, H1 + 0.6, H1 + 0.7, 13.3, 13.42);
    lb('rail', u0 - 0.4, u1 + 0.4, H1 + 0.7, H1 + 1.75, 13.32, 13.38);
    ls(u0, u1, 16, 25.5, H2 + 0.8);
    for (const uu of [u0 + 1.6, u1 - 1.6]) { const p = P3(uu, 0, 13.9).applyMatrix4(B); put('table', new THREE.CylinderGeometry(0.32, 0.26, 0.6, 10), mat4(p.x, H1 + 0.9, p.z)); put('leaf', new THREE.IcosahedronGeometry(0.6, 1), mat4(p.x, H1 + 1.6, p.z)); }
  }
  lb('metal', -9.6, -5.2, 0.22, 3.4, 24.9, 25.3); for (let y = 0.7; y < 3.3; y += 0.62) lb('led', -9.4, -5.4, y, y + 0.03, 24.85, 24.9); // lit shelves (left wing)
  lb('sofa', 5.0, 9.4, H1 + 0.63, H1 + 1.05, 21.5, 22.4); lb('sofa', 5.0, 9.4, H1 + 1.05, H1 + 1.5, 22.1, 22.4);
  // central atrium: double-height glass between two big travertine piers; gold spiral stair and hanging discs
  lb('glassC', -2.8, 2.8, 0.22, H2 + 0.7, 15.7, 15.8); for (let u = -2.8; u <= 2.7; u += 1.4) lb('metal', u, u + 0.07, 0.22, H2 + 0.7, 15.62, 15.7);
  lb('marbleL', -2.8, 2.8, 0.22, H2 + 0.7, 25.3, 25.5); lb('floorIn', -2.8, 2.8, 0.22, 0.25, 15.8, 25.3); lb('woodIn', -2.8, 2.8, H2 + 0.62, H2 + 0.7, 15.8, 25.3);
  ls(-2.8, 2.8, 15.8, 25.5, H2 + 1.6);
  { const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => { const t = i / 24, a = t * Math.PI * 2.2; return P3(0.3 + Math.cos(a) * 1.4, 0.4 + t * 4.0, 20.5 + Math.sin(a) * 1.4); }));
    put('gold', new THREE.TubeGeometry(curve, 80, 0.12, 8, false), B);
    for (let i = 0; i < 14; i++) { const t = i / 14, a = t * Math.PI * 2.2, p = P3(0.3 + Math.cos(a) * 0.9, 0.4 + t * 4.0, 20.5 + Math.sin(a) * 0.9).applyMatrix4(B); put('gold', new THREE.BoxGeometry(1.0 * sc, 0.05, 0.4 * sc), mat4(p.x, p.y, p.z, 0, ry - a - Math.PI / 2)); }
    put('marbleL', new THREE.CylinderGeometry(0.25 * sc, 0.25 * sc, 7.6, 12), mat4(...P3(0.3, 4.0, 20.5).applyMatrix4(B).toArray())); }
  for (const [u, y, v, r] of [[-0.9, 6.0, 18.5, 0.5], [-0.3, 5.2, 18.1, 0.42], [-1.2, 4.6, 18.9, 0.32], [-0.5, 3.9, 18.3, 0.26]]) { const p = P3(u, y, v).applyMatrix4(B); put('gold', new THREE.CylinderGeometry(r, r, 0.05, 20), mat4(p.x, p.y, p.z, 0.5, rnd() * 3, 0.3)); put('metal', new THREE.CylinderGeometry(0.008, 0.008, H2 + 0.6 - y, 3), mat4(p.x, (H2 + 0.6 + y) / 2, p.z)); }
  const pier = (u0, u1, v0, v1, h) => { lb('marbleL', u0, u1, 0, h, v0, v1); ls(u0, u1, v0, v1, h); lb('gold', (u0 + u1) / 2 - 0.02, (u0 + u1) / 2 + 0.02, 0.3, h - 0.3, v0 - 0.04, v0); };
  pier(-4.4, -2.8, 14.6, 16.6, H2 + 1.6); pier(2.8, 4.4, 14.6, 16.6, H2 + 1.6);
  // dark marble pylons at both ends, standing forward of the façade, with vertical gold lines
  const pylon = (u0, u1, v0, v1, h) => { lb('marbleD', u0, u1, 0, h, v0, v1); ls(u0, u1, v0, v1, h); for (const u of [(u0 * 2 + u1) / 3, (u0 + u1 * 2) / 3]) { lb('gold', u - 0.02, u + 0.02, 0.4, h - 0.4, v0 - 0.04, v0); lb('gold', u - 0.02, u + 0.02, 0.4, h - 0.4, v1, v1 + 0.04); } lb('led', u0 - 0.03, u1 + 0.03, h - 0.5, h - 0.45, v0 - 0.03, v0); };
  pylon(-11.7, -10.3, 14.2, 16.8, H2 + 0.75); pylon(10.3, 11.1, 13.4, 17.2, H2 + 0.75); pylon(11.3, 11.9, 13.8, 17.2, H2 + 0.75);
  lb('marbleD', 10.6, 11.6, 0, H1 - 0.3, 11.8, 12.9); ls(10.6, 11.6, 11.8, 12.9, H1 - 0.3); lb('gold', 11.08, 11.12, 0.3, H1 - 0.6, 11.76, 11.8); // dark monolith at the right of the pool
  // roofs: deep wood soffits, thick black fascia with LED lines; the atrium volume rises above the wings
  const roof = (u0, u1, vf, y0, y1) => {
    lb('woodS', u0, u1, y0, y0 + 0.2, vf, 26.3); lb('marbleD', u0, u1, y0 + 0.2, y1, vf, 26.3);
    lb('led', u0, u1, y0 + 0.42, y0 + 0.48, vf - 0.03, vf); lb('led', u0 - 0.03, u0, y0 + 0.42, y0 + 0.48, vf, 26.3); lb('led', u1, u1 + 0.03, y0 + 0.42, y0 + 0.48, vf, 26.3);
    lb('slab2', u0 + 0.3, u1 - 0.3, y1, y1 + 0.05, vf + 0.3, 26);
  };
  roof(-12.1, -3.8, 12.8, H2, H2 + 0.75); roof(3.8, 12.1, 12.8, H2, H2 + 0.75); roof(-4.8, 4.8, 12.2, H2 + 0.75, H2 + 1.6);
  lb('marbleL', -4.4, 4.4, H2, H2 + 0.75, 14.6, 26.2); // stone upstand of the atrium between the two roofs
  { const p = W(-10.6, 13.0); bananaPlant(p.x, p.z, 1.2); const q = W(-9.4, 16.8); bananaPlant(q.x, q.z, 1); }
  const d = W(0, 15.1);
  const door = { x: d.x, z: d.z, name: vname, url: vurl, n: lots.length + 1 };
  record({ door, green: false, roof: W(0, 20), pool: W(-5, 11.3), house: rect(-10, 10, 16, 25.5), poolR: rect(-10.9, 10.9, 9.5, 13.2), margaux: true });
}
function celine(ry, s, B, lb, W, rect, ls, vname, vurl, record) {
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
  pools.push(rect(-10.5, 9.2, 6.5, 12.8)); ls(-10.8, 9.5, 6.2, 13.1, 0.3, 'pool');
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
  record({ door, green: false, roof: W(0, 20), pool: W(-4, 9.7), house: rect(-10.2, 10, 16, 25.5), poolR: rect(-10.5, 9.2, 6.5, 12.8), celine: true });
}
// The Chloé block: 8 columns, 5 rows served by the avenue, two internal lanes and the south road;
// the south-east corner is cut by the oblique road and the park runs through it diagonally.
const ROWS = [[0, 1], [56, -1], [64, 1], [120, -1], [128, 1]];
const parkCL = z => 88 - 0.5625 * (z - 28);
const inParkBand = (x, z) => z > 28 && z < BD && Math.abs(x - parkCL(z)) < 13;
ROWS.forEach(([front, dir], r) => {
  const z0 = dir > 0 ? front : front - LD, z1 = z0 + LD, zc = (z0 + z1) / 2;
  for (let c = 0; c < 8; c++) {
    const x0 = c * LW, x1 = x0 + LW, xc = x0 + LW / 2;
    if (diagDist(x1, z1) > -7 || diagDist(x1, z0) > -7) continue;
    if (r > 0 && Math.abs(xc - parkCL(zc)) < 20) continue;
    lot(xc, front, dir, r === 0 && c === 0 ? 'Céline' : 'Chloé'); // the show villa sits at the corner
  }
});
// sidewalks around the block
box('side', -2, 0, 0, 0.1, -2, BD + 2); box('side', 0, BW, 0, 0.1, -2, 0); box('side', 0, 84, 0, 0.1, BD, BD + 2); box('side', BW, BW + 1, 0, 0.1, 0, 56);
{ const M = mat4((DIAG.p0[0] + DIAG.p1[0]) / 2, 0, (DIAG.p0[1] + DIAG.p1[1]) / 2, 0, DIAG.ang); box('side', 5, 7, 0, 0.1, -DIAG.L / 2, DIAG.L / 2 - 6, M); }
for (let z = 8; z < 150; z += 18) palm(-6, z, 6 + rnd() * 2);

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
// the park: a diagonal green band through the Chloé block, down to the shared space south of the road
ribbon('sand', [[90, 29], [80, 46], [70, 66], [60, 84], [50, 100], [38, 118], [28, 136], [18, 154]], 3);
for (let k = -4; k <= 4; k++) box('line', 16 + k - 0.22, 16 + k + 0.22, 0.021, 0.036, BD, BD + 10); // crossing to the shared space
ribbon('sand', [[16, 167], [26, 172], [38, 176]], 2.6, 0.065);
const ponds = [];
const pond = (x, z, rx, rz) => {
  put('coping', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), mat4(x, 0.07, z, 0, 0, 0, rx + 1, 1, rz + 1));
  put('water', new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), mat4(x, 0.09, z, 0, 0, 0, rx, 1, rz));
  solid(x - rx * 0.8, x + rx * 0.8, z - rz * 0.8, z + rz * 0.8, 0.6);
  ponds.push([x, z, rx, rz]);
};
pond(46, 100, 7, 4);
box('deck', 36, 41, 0.1, 0.35, 99, 101.5); solid(36, 41, 99, 101.5, 0.35);
const plaza = (cx, cz, r, n) => {
  put('pave', new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), mat4(cx, 0.07, cz));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * r * 0.62, z = cz + Math.sin(a) * r * 0.62;
    put('table', new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), mat4(x, 0.75, z));
    put('lamp', new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat4(x, 1.2, z));
    put(i % 2 ? 'parasol' : 'parasol2', new THREE.ConeGeometry(1.5, 0.55, 10), mat4(x, 2.45, z));
    for (let j = 0; j < 3; j++) { const b = a + j * 2.1; put('table', new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), mat4(x + Math.cos(b) * 0.95, 0.22, z + Math.sin(b) * 0.95)); }
    solid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0.8);
  }
  put('wood', new THREE.CylinderGeometry(1.8, 1.8, 0.45, 20), mat4(cx, 0.22, cz)); solid(cx - 1.5, cx + 1.5, cz - 1.5, cz + 1.5, 0.45);
  tree(cx, cz, 1.3);
};
const bench = (x, z, r) => {
  put('wood', new THREE.BoxGeometry(2.2, 0.12, 0.6).translate(0, 0.5, 0), mat4(x, 0, z, 0, r));
  put('wood', new THREE.BoxGeometry(2.2, 0.5, 0.1).translate(0, 0.8, 0.28), mat4(x, 0, z, 0, r));
};
for (const [x, z, r] of [[84, 40, 0.6], [56, 90, 0.5], [34, 126, 0.4], [26, 146, 0.5]]) bench(x, z, r);
for (let i = 0; i < 44; i++) {
  const z = 30 + rnd() * 124, x = parkCL(z) + (rnd() - 0.5) * 24;
  if (Math.abs(z - 60) < 5.5 || Math.abs(z - 124) < 5.5 || Math.hypot((x - 46) / 8, (z - 100) / 5) < 1 || (z > 64 && z < 72 && x > 57 && x < 74)) continue;
  if (Math.abs(x - parkCL(z)) < 2.2) continue;
  rnd() < 0.35 ? palm(x, z, 5 + rnd() * 3) : tree(x, z, 0.7 + rnd() * 0.5);
}
for (let x = 59; x <= 72; x += 3.25) { box('wood', x - 0.15, x + 0.15, 0, 2.8, 66, 66.3); box('wood', x - 0.15, x + 0.15, 0, 2.8, 70.2, 70.5); solid(x - 0.2, x + 0.2, 65.9, 66.4, 2.8); solid(x - 0.2, x + 0.2, 70.1, 70.6, 2.8); }
for (let x = 58.7; x <= 72.4; x += 0.6) box('wood', x, x + 0.12, 2.8, 2.95, 65.7, 70.9);

// roundabout
put('asphalt', new THREE.CircleGeometry(11, 48).rotateX(-Math.PI / 2), mat4(-16, 0.025, 161));
put('coping', new THREE.CircleGeometry(4.6, 32).rotateX(-Math.PI / 2), mat4(-16, 0.03, 161));
put('leaf2', new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2), mat4(-16, 0.08, 161));
solid(-18.8, -13.2, 158.2, 163.8, 0.3); palm(-16, 161, 7);
// parking south of the road, the shared space (espace commun) next to it
box('asphalt', -8, 28, 0, 0.022, 167, 183); box('curb', -8.1, 28.1, 0, 0.13, 183, 183.3);
for (let x = -8; x <= 28; x += 3.2) { box('line', x, x + 0.1, 0.022, 0.034, 167, 173); if (x + 1.6 < 14 && rnd() < 0.55) parkedSpots.push([x + 1.6, 170.5, rnd() < 0.5 ? 0 : Math.PI]); }
plaza(46, 177, 8, 5);
// the shops: a round plaza ringed by five pavilions, café tables in the middle
{
  const cx = -44, cz = 124;
  put('pave', new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2), mat4(cx, 0.07, cz));
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i / 5 * Math.PI * 2, px = cx + Math.cos(a) * 10.5, pz = cz + Math.sin(a) * 10.5, ry = Math.atan2(-Math.cos(a), -Math.sin(a));
    const M = mat4(px, 0, pz, 0, ry), bx = (k, u0, u1, y0, y1, v0, v1) => box(k, u0, u1, y0, y1, v0, v1, M);
    bx('wall', -3.2, 3.2, 0, 3.6, -2.6, 2.6); bx('slab', -3.6, 3.6, 3.6, 3.9, -3, 3); bx('marbleD', -3.6, 3.6, 3.9, 4.2, -3, 3);
    bx('glassLit', -2.8, 2.8, 0.1, 2.9, 2.6, 2.7); bx(['signA', 'signB', 'signC', 'signD', 'signB'][i], -2.6, 2.6, 3.0, 3.5, 2.7, 2.78); bx('woodS', -3.2, 3.2, 2.9, 3.0, 2.6, 4.2);
    solidR(px, pz, 3.2, 2.6, ry, 4);
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4, x = cx + Math.cos(a) * 4.5, z = cz + Math.sin(a) * 4.5;
    put('table', new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16), mat4(x, 0.75, z)); put('lamp', new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), mat4(x, 1.2, z));
    put(i % 2 ? 'parasol' : 'parasol2', new THREE.ConeGeometry(1.5, 0.55, 10), mat4(x, 2.45, z));
    for (let j = 0; j < 3; j++) { const b = a + j * 2.1; put('table', new THREE.CylinderGeometry(0.2, 0.2, 0.45, 8), mat4(x + Math.cos(b) * 0.95, 0.22, z + Math.sin(b) * 0.95)); }
    solid(x - 0.6, x + 0.6, z - 0.6, z + 0.6, 0.8);
  }
  for (let i = 0; i < 5; i++) { const a = 0.5 + (i + 0.5) / 5 * Math.PI * 2; palm(cx + Math.cos(a) * 13.5, cz + Math.sin(a) * 13.5, 6 + rnd() * 2); }
}
// agency kiosk (mission giver), by the roundabout
box('wall', -62, -58, 0, 2.8, 146, 148); box('slab', -62.5, -57.5, 2.8, 3, 145.5, 148.5); box('wood', -61.8, -58.2, 0, 1.1, 148, 148.2); solid(-62, -58, 146, 148.2, 3);
// the garden west of the block: winding path, the pond and its jetty, benches
ribbon('sand', [[-28, 150], [-50, 128], [-85, 132], [-118, 112], [-112, 82], [-140, 60], [-170, 70]], 3);
ribbon('sand', [[-58, 128], [-70, 108], [-96, 90]], 2.4, 0.065);
pond(-100, 100, 15, 9);
box('deck', -86, -80, 0.1, 0.35, 98.5, 100.5); solid(-86, -80, 98.5, 100.5, 0.35);
for (const [x, z, r] of [[-70, 120, 0.4], [-130, 95, -0.3], [-150, 70, 0.6], [-40, 140, -0.5]]) bench(x, z, r);
for (let i = 0; i < 50; i++) {
  const x = -200 + rnd() * 176, z = 14 + rnd() * 140;
  if (!inPoly(GARDEN_POLY, x, z) || Math.hypot((x + 100) / 17, (z - 100) / 11) < 1 || Math.hypot(x + 44, z - 124) < 16 || Math.hypot(x + 60, z - 147) < 5) continue;
  if (nearRoad(x, z, 3)) continue;
  rnd() < 0.4 ? palm(x, z, 5 + rnd() * 3) : tree(x, z, 0.8 + rnd() * 0.5);
}

// Céline villas along the south front: three on the road, three along the oblique road
lotAt(-56, 166, 0, 'Céline', 1.6); lotAt(4, 185, 0, 'Céline', 1.6); lotAt(46, 185, 0, 'Céline', 1.6);
{ const ry = Math.atan2(DN[0], DN[1]); for (const t of [30, 72, 114]) lotAt(DIAG.p0[0] + DIAG.dx * t + DN[0] * 6, DIAG.p0[1] + DIAG.dz * t + DN[1] * 6, ry, 'Céline', 1.6); }
// Margaux villas: two to the east, two to the south-west
lotAt(222, 0, 0, 'Margaux', 1.5); lotAt(203, 66, Math.PI / 2, 'Margaux', 1.5);
lotAt(-110, 166, 0, 'Margaux', 1.5); lotAt(-154, 236, -Math.PI / 2, 'Margaux', 1.5);

// pines outside the site, a few trees in the unbuilt margins inside
for (let i = 0; i < 420; i++) {
  const x = WORLD.x0 + rnd() * (WORLD.x1 - WORLD.x0), z = WORLD.z0 + rnd() * (WORLD.z1 - WORLD.z0);
  if (inPoly(SITE_POLY, x, z) || nearRoad(x, z, 8)) continue;
  rnd() < 0.8 ? pine(x, z, 8 + rnd() * 7) : palm(x, z, 6 + rnd() * 3);
}
for (let i = 0; i < 90; i++) {
  const x = -220 + rnd() * 480, z = -12 + rnd() * 300;
  if (!inPoly(SITE_POLY, x, z) || inPoly(GARDEN_POLY, x, z) || nearRoad(x, z, 4)) continue;
  if (x > -3 && x < 192 && z > -3 && z < BD + 1) continue;
  if (lots.some(l => x > l.x0 - 2 && x < l.x1 + 2 && z > l.z0 - 2 && z < l.z1 + 2)) continue;
  if ((x > -10 && x < 30 && z > 165 && z < 185) || Math.hypot(x - 46, z - 177) < 10 || Math.hypot(x + 16, z - 161) < 13) continue;
  rnd() < 0.5 ? pine(x, z, 7 + rnd() * 5) : tree(x, z, 0.9 + rnd() * 0.5);
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
  for (let i = Math.floor(s.x0 / GS); i <= Math.floor(s.x1 / GS); i++) for (let j = Math.floor(s.z0 / GS); j <= Math.floor(s.z1 / GS); j++) {
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
  if (kind === 5) { const g = carGeos(hex, 1); return (carGeoCache[key] = { ...g, hero: true }); } // G63 placeholder until the model loads
  if (kind >= 3) return (carGeoCache[key] = (kind === 3 ? buildRS6 : build911)(hex));
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
/* ---- hand-built hero cars: Audi RS6-R ABT (kind 3) and Porsche 911 Cabriolet 992 (kind 4) ---- */
const zeroUV = g => { g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
// smooth lofted body: cross-sections (rounded superellipse) along the length, closed at both ends
function profileFn(pts) {
  const S = new THREE.SplineCurve(pts.map(([z, y]) => new THREE.Vector2(z, y))).getPoints(300);
  return z => {
    if (z <= S[0].x) return S[0].y; if (z >= S[S.length - 1].x) return S[S.length - 1].y;
    let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].x < z) lo = m; else hi = m; }
    const a = S[lo], b = S[hi]; return a.y + (b.y - a.y) * (z - a.x) / ((b.x - a.x) || 1);
  };
}
function loft({ z0, z1, N = 80, K = 18, top, bot, hw, col, n = 5, endR = 0.3, bump }) {
  const pos = [], cols = [], idx = [], c = new THREE.Color(), R = 2 * K;
  for (let i = 0; i <= N; i++) {
    const z = z0 + (z1 - z0) * i / N, dEnd = Math.min(z - z0, z1 - z);
    const e = dEnd < endR ? Math.sqrt(Math.max(0, 1 - ((endR - dEnd) / endR) ** 2)) : 1;
    const yt = top(z), yb = bot(z), ym = (yt + yb) / 2, hh = (yt - yb) / 2 * (0.25 + 0.75 * e);
    for (let j = 0; j < R; j++) {
      const a = -Math.PI / 2 + Math.PI * 2 * j / R, ca = Math.cos(a), sa = Math.sin(a);
      const sx = Math.sign(ca) * Math.abs(ca) ** (2 / n), sy = Math.sign(sa) * Math.abs(sa) ** (2 / n);
      let y = ym + hh * sy; const x = sx * hw(z, y) * e;
      if (bump) y += bump(z) * smooth(0.45, 0.95, Math.abs(sx)) * Math.max(0, sy);
      pos.push(x, y, z); c.set(col(z, y, sx)); cols.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + (j + 1) % R, cc = (i + 1) * R + j, d = (i + 1) * R + (j + 1) % R;
    idx.push(a, b, cc, b, d, cc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
  g.computeVertexNormals(); zeroUV(g);
  return g.toNonIndexed();
}
const archBot = (zf, zr, wy, R, base = 0.3) => z => {
  let y = base;
  for (const zw of [zf, zr]) if (Math.abs(z - zw) < R) y = Math.max(y, wy + Math.sqrt(R * R - (z - zw) ** 2) * 0.96);
  return y;
};
function heroWheel(wr, rimCol, spokeCol, spokes, twin) {
  const parts = [];
  parts.push(colorGeo(new THREE.CylinderGeometry(wr, wr, 0.3, 24).rotateZ(Math.PI / 2), '#121212'));
  parts.push(colorGeo(new THREE.CylinderGeometry(wr * 0.74, wr * 0.74, 0.31, 24).rotateZ(Math.PI / 2), '#202022'));
  parts.push(colorGeo(new THREE.TorusGeometry(wr * 0.74, 0.025, 6, 28).rotateY(Math.PI / 2).translate(0.155, 0, 0), rimCol));
  parts.push(colorGeo(new THREE.TorusGeometry(wr * 0.74, 0.025, 6, 28).rotateY(Math.PI / 2).translate(-0.155, 0, 0), rimCol));
  for (const side of [-1, 1]) {
    parts.push(colorGeo(new THREE.CylinderGeometry(wr * 0.16, wr * 0.16, 0.04, 10).rotateZ(Math.PI / 2).translate(side * 0.15, 0, 0), rimCol));
    for (let i = 0; i < spokes; i++) for (const off of twin ? [-0.09, 0.09] : [0]) {
      const a = i / spokes * Math.PI * 2 + off, g = new THREE.BoxGeometry(0.03, wr * 0.62, twin ? 0.045 : 0.06);
      g.translate(0, wr * 0.42, 0); g.rotateX(a); g.translate(side * 0.155, 0, 0); parts.push(colorGeo(g, spokeCol));
    }
  }
  return mergeGeometries(parts);
}
function finishHero(parts, lights, wheelGeo, wp, L, caliper) {
  const head = mergeGeometries(lights.head), tail = mergeGeometries(lights.tail);
  for (const [x, y, z] of wp) { const c = new THREE.BoxGeometry(0.08, 0.2, 0.32); c.translate(x * 0.86, y + 0.08, z + 0.12); parts.push(colorGeo(c, caliper)); }
  const body = mergeGeometries(parts);
  const stat = mergeGeometries([...parts, ...wp.map(([x, y, z]) => wheelGeo.clone().translate(x, y, z)),
    ...lights.head.map(g => colorGeo(g.clone(), '#d9d5c8')), ...lights.tail.map(g => colorGeo(g.clone(), '#5a1414'))]);
  return { body, stat, wheelGeo, wp, head, tail, L, hero: true };
}
function buildRS6(hex) {
  const L = 5.0, wr = 0.38, zf = 1.5, zr = -1.45, R = 0.47, P = [], lights = { head: [], tail: [] };
  const box = (w, h, l, x, y, z, col, rx = 0, arr = P) => { const g = new THREE.BoxGeometry(w, h, l); if (rx) g.rotateX(rx); g.translate(x, y, z); arr.push(colorGeo(g, col)); };
  const taper = z => 1 - 0.1 * smooth(1.75, 2.55, z) - 0.07 * smooth(1.9, 2.6, -z);
  const flare = (z, y) => 1 + 0.045 * (Math.exp(-(((z - zf) / 0.6) ** 2)) + Math.exp(-(((z - zr) / 0.6) ** 2))) * (1 - smooth(0.8, 1.0, y));
  const bodyFn = (z, y) => taper(z) * flare(z, y) * (1 - 0.08 * smooth(0.78, 1.05, y)) * (1 - 0.05 * (1 - smooth(0.3, 0.5, y)));
  const body = loft({ z0: -2.55, z1: 2.55, top: profileFn([[-2.55, 0.9], [-2.3, 1.05], [-0.5, 1.06], [0.95, 1.04], [1.6, 0.97], [2.3, 0.84], [2.55, 0.66]]),
    bot: archBot(zf, zr, wr, R, 0.3), hw: (z, y) => 0.98 * taper(z) * flare(z, y) * (1 - 0.08 * smooth(0.78, 1.05, y)) * (1 - 0.06 * (1 - smooth(0.3, 0.5, y))),
    col: (z, y) => y < 0.37 ? '#151515' : hex, bump: z => 0.035 * (Math.exp(-(((z - zf) / 0.55) ** 2)) + Math.exp(-(((z - zr) / 0.55) ** 2))), endR: 0.35 });
  P.push(body);
  const gTop = profileFn([[-2.45, 1.02], [-2.3, 1.3], [-1.95, 1.44], [-0.6, 1.47], [0.4, 1.4], [1.0, 1.02]]);
  P.push(loft({ z0: -2.45, z1: 1.0, N: 70, top: gTop, bot: () => 0.98, n: 6, endR: 0.06,
    hw: (z, y) => 0.98 * taper(z) * 0.92 * (1 - 0.24 * smooth(1.0, 1.5, y)),
    col: (z, y) => (y > gTop(z) - 0.03 && z < 0.36 && z > -2.05) ? hex : (Math.abs(z + 0.6) < 0.07 || Math.abs(z + 1.55) < 0.07 || y < 1.03) ? '#111111' : '#141b21' }));
  for (const sx of [-1, 1]) {
    box(0.05, 0.05, 2.6, sx * 0.6, 1.5, -0.9, '#1a1a1a'); // roof rails
    box(0.16, 0.12, 0.26, sx * 1.02, 1.1, 0.78, '#111'); // mirrors
    box(0.05, 0.12, 1.9, sx * 0.99, 0.36, 0.02, '#151515'); // ABT side skirts
    box(0.5, 0.09, 0.12, sx * 0.6, 0.82, 2.37, '#0e1114', -0.25); // headlight housings
    box(0.46, 0.025, 0.04, sx * 0.6, 0.79, 2.43, '#fff', 0, lights.head); // LED signature
    box(0.08, 0.06, 0.04, sx * 0.84, 0.8, 2.38, '#fff', 0, lights.head);
    box(0.5, 0.09, 0.05, sx * 0.6, 0.93, -2.41, '#fff', 0, lights.tail);
    const ex = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14).rotateX(Math.PI / 2); ex.scale(1.7, 1, 1); ex.translate(sx * 0.6, 0.42, -2.36); P.push(colorGeo(ex, '#2b2b2b'));
    box(0.2, 0.18, 0.06, sx * 0.8, 0.5, 2.5, '#0f0f0f'); // side intakes
  }
  box(0.7, 0.025, 0.04, 0, 0.93, -2.43, '#2a2a2a'); // tail light bridge
  const hex6 = new THREE.Shape(); [[-0.55, 0.38], [0.55, 0.38], [0.66, 0.6], [0.46, 0.8], [-0.46, 0.8], [-0.66, 0.6]].forEach(([x, y], i) => i ? hex6.lineTo(x, y) : hex6.moveTo(x, y));
  const gr = new THREE.ExtrudeGeometry(hex6, { depth: 0.08, bevelEnabled: false }); gr.translate(0, 0, 2.47); gr.deleteAttribute('uv'); P.push(colorGeo(zeroUV(gr), '#0d0d0d'));
  for (let y = 0.44; y < 0.78; y += 0.07) box(1.1, 0.012, 0.02, 0, y, 2.56, '#3a3a3a');
  box(1.8, 0.035, 0.22, 0, 0.32, 2.3, '#121212'); // carbon splitter
  box(1.3, 0.12, 0.2, 0, 0.36, -2.28, '#121212'); // diffuser
  box(1.3, 0.04, 0.3, 0, 1.45, -2.25, '#141414', 0.15); // roof spoiler
  const wheelGeo = heroWheel(wr, '#2a2b2e', '#3c3e42', 10, false);
  const wp = [[0.88, wr, zf], [-0.88, wr, zf], [0.88, wr, zr], [-0.88, wr, zr]];
  return finishHero(P, lights, wheelGeo, wp, L, '#c3202a');
}
function build911(hex) {
  const L = 4.52, wr = 0.36, zf = 1.18, zr = -1.27, R = 0.44, P = [], lights = { head: [], tail: [] };
  const box = (w, h, l, x, y, z, col, rx = 0, arr = P) => { const g = new THREE.BoxGeometry(w, h, l); if (rx) g.rotateX(rx); g.translate(x, y, z); arr.push(colorGeo(g, col)); };
  const taper = z => 1 - 0.15 * smooth(1.5, 2.3, z) - 0.09 * smooth(1.8, 2.32, -z);
  const hips = (z, y) => 1 + 0.06 * smooth(-0.3, -1.0, z) * (1 - smooth(0.8, 1.05, y));
  const bodyFn = (z, y) => taper(z) * hips(z, y) * (1 - 0.1 * smooth(0.68, 1.0, y)) * (1 - 0.05 * (1 - smooth(0.3, 0.5, y)));
  P.push(loft({ z0: -2.3, z1: 2.3, top: profileFn([[-2.3, 0.7], [-2.2, 0.86], [-1.85, 0.97], [-1.3, 1.02], [-0.75, 0.96], [0.4, 0.93], [1.0, 0.89], [1.6, 0.8], [2.05, 0.72], [2.3, 0.56]]),
    bot: archBot(zf, zr, wr, R, 0.3), hw: (z, y) => 0.93 * taper(z) * hips(z, y) * (1 - 0.1 * smooth(0.68, 1.0, y)) * (1 - 0.06 * (1 - smooth(0.3, 0.5, y))),
    col: (z, y) => y < 0.36 ? '#151515' : hex, endR: 0.4,
    bump: z => 0.09 * smooth(0.9, 1.4, z) * (1 - smooth(2.05, 2.3, z)) + 0.07 * smooth(-0.6, -1.0, z) * (1 - smooth(-1.9, -2.2, z)) }));
  // open cockpit: leather tub, dash, seats, steering wheel
  box(1.36, 0.03, 1.6, 0, 0.955, -0.05, '#2b211b');
  box(1.4, 0.16, 0.24, 0, 1.0, 0.72, '#151515');
  for (const sx of [-1, 1]) {
    box(0.5, 0.16, 0.5, sx * 0.36, 0.98, -0.12, '#8b5a3c');
    const back = new THREE.BoxGeometry(0.5, 0.62, 0.12); back.translate(0, 0.31, 0); back.rotateX(-0.22); back.translate(sx * 0.36, 0.98, -0.42); P.push(colorGeo(back, '#8b5a3c'));
    box(0.3, 0.2, 0.1, sx * 0.36, 1.62, -0.6, '#7a4d33');
    box(0.12, 0.1, 0.24, sx * 0.97, 0.98, 0.62, hex); // mirrors
    // round headlights
    const hl = new THREE.SphereGeometry(0.17, 16, 12); hl.scale(1, 1, 0.55); hl.rotateX(-0.35); hl.translate(sx * 0.58, 0.8, 1.98); lights.head.push(colorGeo(hl, '#fff'));
    box(0.22, 0.08, 0.04, sx * 0.5, 0.45, 2.2, '#0f0f0f');
    const ex = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12).rotateX(Math.PI / 2); ex.scale(1.5, 1, 1); ex.translate(sx * 0.2, 0.38, -2.2); P.push(colorGeo(ex, '#2b2b2b'));
  }
  const sw = new THREE.TorusGeometry(0.17, 0.025, 6, 18); sw.rotateX(-0.35); sw.translate(0.36, 1.12, 0.48); P.push(colorGeo(sw, '#111'));
  // windshield + frame
  const ws = new THREE.BoxGeometry(1.34, 0.55, 0.02); ws.rotateX(-1.0); ws.translate(0, 1.13, 0.76); P.push(colorGeo(ws, '#24323b'));
  const fr = new THREE.BoxGeometry(1.38, 0.045, 0.045); fr.translate(0, 1.36, 0.6); P.push(colorGeo(fr, '#111'));
  for (const sx of [-1, 1]) { const a = new THREE.BoxGeometry(0.045, 0.55, 0.045); a.rotateX(-1.0); a.translate(sx * 0.68, 1.13, 0.76); P.push(colorGeo(a, '#111')); }
  box(1.5, 0.045, 0.03, 0, 0.82, -2.205, '#fff', 0, lights.tail); // light bar
  for (const sx of [-1, 1]) box(0.3, 0.09, 0.03, sx * 0.6, 0.8, -2.19, '#fff', 0, lights.tail);
  for (let z = -1.45; z > -1.85; z -= 0.07) box(0.9, 0.02, 0.03, 0, 1.0 + (z + 1.45) * 0.2, z, '#111'); // engine grille
  const wheelGeo = heroWheel(wr, '#c9cbcf', '#d5d7da', 5, true);
  const wp = [[0.82, wr, zf], [-0.82, wr, zf], [0.86, wr, zr], [-0.86, wr, zr]];
  return finishHero(P, lights, wheelGeo, wp, L, '#c8a02a');
}
MAT.carGloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.45 });
const CAR_NAMES = { 3: 'Audi RS6-R ABT', 4: 'Porsche 911 Cabriolet', 5: 'Mercedes-AMG G63' };
const paintCache = {};
function paintMat(base, hex) {
  const k = base.name + hex;
  if (!paintCache[k]) { const m = base.clone(); m.color.set(hex); m.metalness = 0.55; m.roughness = 0.28; paintCache[k] = m; }
  return paintCache[k];
}
// detailed models (Sketchfab, see credits in the pause menu), decimated and re-oriented with Blender
// merge the body's many small parts into one mesh per material (paint kept apart so it can be recoloured)
function compactModel(root, paint) {
  for (const n of ['body', 'wheel_LF', 'wheel_RF', 'wheel_LB', 'wheel_RB']) compactNode(root, root.getObjectByName(n), paint);
}
function compactNode(root, body, paint) {
  if (!body || body.isMesh) return;
  root.updateMatrixWorld(true);
  const meshes = []; body.traverse(o => { if (o.isMesh) meshes.push(o); });
  const inv = body.matrixWorld.clone().invert(), groups = new Map();
  for (const m of meshes) {
    const mt = m.material;
    const plain = !mt.map && !mt.normalMap && !mt.emissiveMap && !mt.roughnessMap && !mt.metalnessMap && !mt.transparent && !paint.includes(mt.name) && (!mt.emissive || mt.emissive.getHex() === 0);
    const k = plain ? `vc|${Math.round(mt.metalness)}|${Math.round(mt.roughness * 3)}|${mt.side}`
      : [mt.color?.getHexString(), mt.metalness, mt.roughness, mt.transparent, mt.opacity, mt.map?.uuid || '', mt.normalMap?.uuid || '', mt.emissive?.getHexString(), mt.emissiveMap?.uuid || '', mt.side, paint.includes(mt.name) ? mt.name : ''].join('|');
    let g = m.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    for (const at of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(at)) g.deleteAttribute(at);
    if (plain) { // bake the flat colour into vertex colours so all plain parts share one material
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = mt.color.r; a[i * 3 + 1] = mt.color.g; a[i * 3 + 2] = mt.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!mt.map && !mt.normalMap && !mt.emissiveMap && !mt.roughnessMap && !mt.metalnessMap && !mt.aoMap) g.deleteAttribute('uv');
    if (!groups.has(k)) groups.set(k, { mt: plain ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: Math.round(mt.metalness), roughness: Math.max(0.15, Math.round(mt.roughness * 3) / 3), side: mt.side }) : mt, geos: [] });
    groups.get(k).geos.push(g);
  }
  for (const m of meshes) m.parent.remove(m);
  for (const { mt, geos } of groups.values()) {
    const sig = gg => Object.keys(gg.attributes).sort().join();
    const base = sig(geos[0]), same = geos.filter(gg => sig(gg) === base);
    const merged = mergeGeometries(same.map(gg => gg.index ? gg.toNonIndexed() : gg));
    if (!merged) { for (const gg of geos) body.add(new THREE.Mesh(gg, mt)); continue; }
    body.add(new THREE.Mesh(merged, mt));
    for (const gg of geos) if (sig(gg) !== base) body.add(new THREE.Mesh(gg, mt));
  }
}
const CAR_MODELS = { 3: { url: 'models/audi-rs6.glb', paint: ['BKit2_Paint_Geo_lodASG1'] }, 4: { url: 'models/porsche911.glb', paint: ['body'] }, 5: { url: 'models/g63.glb', paint: ['bodypaint'] } };
const cars = [];
class Car {
  constructor(x, z, h, hex, kind = 0) {
    this.x = x; this.z = z; this.h = h; this.vx = 0; this.vz = 0; this.along = 0; this.steer = 0;
    this.kind = kind; this.hex = hex; this.ai = null; this.knock = 0; this.honk = 0;
    const G = carGeos(hex, kind); this.G = G; this.half = G.L / 2;
    this.g = new THREE.Group(); scene.add(this.g);
    const bm = G.hero ? MAT.carGloss : MAT.car;
    this.stat = new THREE.Mesh(G.stat, bm); this.stat.castShadow = true;
    this.dynG = new THREE.Group();
    this.body = new THREE.Mesh(G.body, bm); this.body.castShadow = true;
    this.headM = new THREE.Mesh(G.head, MAT.head); this.tailM = new THREE.Mesh(G.tail, MAT.tail);
    this.dynG.add(this.body, this.headM, this.tailM);
    this.wheels = G.wp.map(([wx, wy, wz]) => { const p = new THREE.Group(); p.position.set(wx, wy, wz); const m = new THREE.Mesh(G.wheelGeo, MAT.car); m.castShadow = true; p.add(m); this.dynG.add(p); return p; });
    this.dyn = null; this.setDyn(false); this.sync(); cars.push(this);
  }
  // swap the procedural body for the detailed Sketchfab model once it has loaded
  useModel(tpl) {
    const m = tpl.scene.clone(true);
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material && tpl.paint.includes(o.material.name)) o.material = paintMat(o.material, this.hex);
    });
    this.modelWheels = ['wheel_LF', 'wheel_RF', 'wheel_LB', 'wheel_RB'].map(n => {
      const w = m.getObjectByName(n), p = new THREE.Group(); p.position.copy(w.position); w.position.set(0, 0, 0);
      m.add(p); p.add(w); return p;
    });
    this.setDyn(true);
    this.procG = this.dynG; this.procWheels = this.wheels; this.modelG = m;
    this.model = true; this.lod = null; this.setLod(true);
  }
  // detailed model up close, light procedural body far away
  setLod(near) {
    if (this.lod === near) return; this.lod = near;
    this.g.remove(near ? this.procG : this.modelG); this.g.add(near ? this.modelG : this.procG);
    const from = near ? this.procWheels : this.modelWheels, to = near ? this.modelWheels : this.procWheels;
    to.forEach((w, i) => { w.rotation.y = from[i].rotation.y; });
    this.wheels = to;
  }
  setDyn(on) { if (on === this.dyn) return; this.dyn = on; this.g.remove(on ? this.stat : this.dynG); this.g.add(on ? this.dynG : this.stat); }
  sync() { this.g.position.set(this.x, 0, this.z); this.g.rotation.y = this.h; }
  get fx() { return Math.sin(this.h); } get fz() { return Math.cos(this.h); }
  circles() { const o = this.half - 0.85, fx = this.fx, fz = this.fz; return [[this.x + fx * o, this.z + fz * o], [this.x, this.z], [this.x - fx * o, this.z - fz * o]]; }
  speed() { return Math.hypot(this.vx, this.vz); }
}
for (const [x, z, h] of parkedSpots) new Car(x, z, h, pick(CAR_COLORS), rnd() < 0.25 ? 1 : 0);
new Car(15.2, 170.5, 0, '#a51c24', 4); // race car, at the parking next to the course marker
new Car(18.4, 170.5, 0, '#8a8d8f', 3);
new Car(21.6, 170.5, 0, '#d9d6cf', 4);
new Car(24.8, 170.5, 0, '#141414', 5);

// traffic AI
function laneFor(dx, dz, roadCoord) { return roadCoord + (dx ? dx * 2.5 * 1 : -dz * 2.5); }
// right-hand traffic: heading +x drives on z+2.5, heading +z drives on x-2.5
function spawnTraffic(n) {
  const segs = []; for (const rd of ROADS) if (rd.ai) for (let k = 0; k < Math.max(1, Math.round(Math.min(rd.L, 400) / 70)); k++) segs.push(rd);
  for (let i = 0; i < n; i++) {
    const rd = pick(segs), dir = rnd() < 0.5 ? 1 : -1, along = 10 + rnd() * (rd.L - 20), laneOff = rd.w >= 10 ? 2.5 : 1.9;
    const fx = rd.dx * dir, fz = rd.dz * dir, rx = -fz, rz = fx;
    const hk = i % 8 === 1 ? 3 : i % 8 === 4 ? 4 : i % 8 === 6 ? 5 : rnd() < 0.3 ? 1 : 0;
    const c = new Car(rd.p0[0] + rd.dx * along + rx * laneOff, rd.p0[1] + rd.dz * along + rz * laneOff, Math.atan2(fx, fz), hk === 3 ? pick(['#8a8d8f', '#1f1f1f', '#2f4a6e']) : hk === 4 ? pick(['#a51c24', '#d9d6cf', '#c9a227']) : hk === 5 ? pick(['#141414', '#e9e7e2', '#4b5244']) : pick(CAR_COLORS), hk);
    c.ai = { seg: rd, dir, dx: fx, dz: fz, v: 8, cruise: 9 + rnd() * 4, prev: 0 }; c.setDyn(true);
  }
}
spawnTraffic(16);
{
  const loader = new GLTFLoader();
  for (const [kind, def] of Object.entries(CAR_MODELS)) {
    loader.load(def.url, gltf => {
      compactModel(gltf.scene, def.paint);
      const tpl = { scene: gltf.scene, paint: def.paint };
      for (const c of cars) if (c.kind === +kind) c.useModel(tpl);
      if (sketch) applySketch();
    }, undefined, () => { /* keep the procedural car if the model fails to load */ });
  }
}

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
function ringPath(x0, x1, z0, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = (x1 - x0) / 2 - 1, hd = (z1 - z0) / 2 - 1, P = 2 * (hw * 2 + hd * 2);
  return { len: P, loop: true, at(s) {
    s = ((s % P) + P) % P;
    if (s < hw * 2) return [cx - hw + s, cz - hd, 1, 0];
    s -= hw * 2; if (s < hd * 2) return [cx + hw, cz - hd + s, 0, 1];
    s -= hd * 2; if (s < hw * 2) return [cx + hw - s, cz + hd, -1, 0];
    s -= hw * 2; return [cx - hw, cz + hd - s, 0, -1];
  } };
}
const linePath = (x0, x1, z) => ({ len: x1 - x0, loop: false, at(s) { return [x0 + clamp(s, 0, x1 - x0), z, 1, 0]; } });
function curvePath(curve) {
  const len = curve.getLength();
  return { len, loop: false, at(s) { const t = clamp(s / len, 0, 1), p = curve.getPointAt(t), tg = curve.getTangentAt(t); return [p.x, p.z, tg.x, tg.z]; } };
}
const pedPaths = [];
pedPaths.push(ringPath(-2, 192, -2, 158), linePath(0, 188, 58), linePath(0, 118, 122), linePath(-80, 70, 168.5), linePath(-30, 190, -8.5));
for (const c of parkCurves) pedPaths.push(curvePath(c));
for (let i = 0; i < 44; i++) {
  const path = pedPaths[i % pedPaths.length];
  const p = makePerson({ skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT), pants: pick(PANTS), long: rnd() < 0.4 });
  peds.push({ p, path, s: rnd() * path.len, dir: rnd() < 0.5 ? 1 : -1, v: 1.1 + rnd() * 0.5, phase: rnd() * 6, off: 0, offT: 0, y: 0, vy: 0, down: 0, x: 0, z: 0, h: 0, wait: 0 });
}

/* ================= hero ================= */
const hero = makePerson({ skin: '#c99b7a', hair: '#2a1d16', shirt: '#b08d57', pants: '#2d2b29', unique: true });
const P = { x: -36, z: 150, y: 0, vy: 0, heading: Math.PI, phase: 0, speed: 0, down: 0, car: null, swim: false };
let yaw = -1.2, pitch = 0.3, camDist = 6.5, lastMouse = -10;

/* ================= collectibles & markers ================= */
const KEY_SPOTS = [[38.5, 100, 1.4], [46, 177, 1.6], [-81, 99.5, 1.4], [-44, 124, 1.6], [250, 20, 1.1], [-185, 270, 1.1], [100, 60, 1.1], [-16, -160, 1.1], [270, -6, 1.1], [-250, 161, 1.1], [150, 212, 1.1]];
const goldMat = new THREE.MeshStandardMaterial({ color: '#d8b25a', metalness: 0.9, roughness: 0.25, emissive: '#6b4a10', emissiveIntensity: 0.5 });
const keyGeo = (() => {
  const ring = new THREE.TorusGeometry(0.22, 0.06, 8, 20), shaft = new THREE.BoxGeometry(0.06, 0.5, 0.06).translate(0, -0.45, 0);
  const t1 = new THREE.BoxGeometry(0.16, 0.06, 0.06).translate(0.08, -0.62, 0), t2 = new THREE.BoxGeometry(0.12, 0.06, 0.06).translate(0.06, -0.48, 0);
  return mergeGeometries([ring, shaft, t1, t2].map(g => g.index ? g.toNonIndexed() : g));
})();
const keys3d = [];
{
  const poolLot = lots.filter(l => l.celine)[3] || lots[0];
  const spots = [...KEY_SPOTS, [poolLot.pool.x, poolLot.pool.z, 0.7]];
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
const VISIT = [['Chloé', 10], ['Céline', 3], ['Margaux', 2]].map(([n, k]) => doors.filter(d => d.name === n)[k] || doors.find(d => d.name === n));
const RACE_CP = [[-16, 161], [-16, 60], [-16, -6], [90, -6], [196, -6], [196, 58], [140, 116], [84, 161], [30, 161]];
const MISSIONS = {
  visite: { title: 'Visite privée', start: [-60, 143], reward: 25000, time: 240, color: '#f2c230', letter: 'V' },
  course: { title: 'Contre-la-montre', start: [12, 177.5], reward: 15000, time: 95, color: '#5fb3e0', letter: 'C', needCar: true }
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
  else subtitle(`Passez les <b>${RACE_CP.length} points de contrôle</b> avant la fin du temps. Pied au plancher.`, 6);
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
  if (sketch) {
    inked = true;
    const meshes = []; scene.traverse(o => { if (o.isMesh && !o.userData.noInk && !o.userData.inked && o.userData.key !== 'grass') meshes.push(o); });
    meshes.forEach(m => m.userData.inked = true);
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
note('Espace commun', 46, 3.4, 177); note('Le bassin', -100, 1.2, 100); note('Pergola', 65, 3.3, 68); note('Agence', -60, 3.4, 147); note('Commerces', -44, 6, 124); note('Le parc', 50, 4, 100); note('Rond-point', -16, 8, 161);
for (const l of lots.filter(l => l.green).filter((_, i) => i % 6 === 0)) note('Toit végétalisé', l.roof.x, 7.4, l.roof.z);
for (const l of lots.filter((_, i) => i % 7 === 3)) note('Piscine privée', l.pool.x, 1, l.pool.z);

/* ================= maps ================= */
const MX0 = WORLD.x0, MZ0 = WORLD.z0, MW = WORLD.x1 - WORLD.x0, MH = WORLD.z1 - WORLD.z0, MPX = 2;
const mapImg = document.createElement('canvas'); mapImg.width = MW * MPX; mapImg.height = MH * MPX;
{
  const c = mapImg.getContext('2d'); c.scale(MPX, MPX); c.translate(-MX0, -MZ0);
  const poly = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
  c.fillStyle = '#34402f'; c.fillRect(MX0, MZ0, MW, MH);
  c.fillStyle = '#3f4c3a'; poly(SITE_POLY); c.fill();
  c.fillStyle = '#4b6b40'; poly(GARDEN_POLY); c.fill(); poly([[parkCL(28) - 13, 28], [parkCL(28) + 13, 28], [parkCL(BD) + 13, BD], [parkCL(BD) - 13, BD]]); c.fill();
  c.lineCap = 'butt'; c.strokeStyle = '#7b7d80';
  for (const rd of ROADS) { c.lineWidth = rd.w; c.beginPath(); c.moveTo(rd.p0[0], rd.p0[1]); c.lineTo(rd.p1[0], rd.p1[1]); c.stroke(); }
  c.fillStyle = '#7b7d80'; c.beginPath(); c.arc(-16, 161, 11, 0, 7); c.fill(); c.fillStyle = '#4b6b40'; c.beginPath(); c.arc(-16, 161, 4, 0, 7); c.fill();
  c.fillStyle = '#6a6c70'; c.fillRect(-8, 167, 36, 16);
  c.fillStyle = '#8c8a83'; c.fillRect(-2, -2, 2, BD + 4); c.fillRect(0, -2, BW, 2); c.fillRect(0, BD, 84, 2);
  for (const l of lots) { c.fillStyle = '#4e5b47'; poly(l.poly); c.fill(); c.fillStyle = '#d9d4c7'; poly(l.house); c.fill(); c.fillStyle = '#5ec8df'; poly(l.poolR); c.fill(); }
  c.fillStyle = '#4aa3c2'; for (const [x, z, rx, rz] of ponds) { c.beginPath(); c.ellipse(x, z, rx, rz, 0, 0, 7); c.fill(); }
  c.strokeStyle = '#c9b98f'; c.lineWidth = 2.6; for (const cv of parkCurves) { c.beginPath(); cv.getPoints(60).forEach((p, i) => i ? c.lineTo(p.x, p.z) : c.moveTo(p.x, p.z)); c.stroke(); }
  c.fillStyle = '#cfc6b4'; for (const [x, z, r] of [[46, 177, 8], [-44, 124, 14]]) { c.beginPath(); c.arc(x, z, r, 0, 7); c.fill(); }
  c.fillStyle = '#d9d4c7'; for (let i = 0; i < 5; i++) { const a = 0.5 + i / 5 * Math.PI * 2; c.beginPath(); c.arc(-44 + Math.cos(a) * 10.5, 124 + Math.sin(a) * 10.5, 3.2, 0, 7); c.fill(); }
}
const mm = $('minimap'), mmx = mm.getContext('2d'), MMR = mm.width / 2;
const RG = (() => { // road graph: nodes at every crossing and road end
  const nodes = [], idx = new Map(), key = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
  const node = (x, z) => { const k = key(x, z); if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ x, z, adj: [] }); } return idx.get(k); };
  const link = (a, b) => { if (a === b) return; const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); nodes[a].adj.push([b, d]); nodes[b].adj.push([a, d]); };
  for (const rd of ROADS) {
    const ts = [...new Set([0, rd.L, ...rd.xings.map(x => +clamp(x.t, 0, rd.L).toFixed(1))])].sort((a, b) => a - b);
    rd.nodes = ts.map(t => [t, node(rd.p0[0] + rd.dx * t, rd.p0[1] + rd.dz * t)]);
    for (let i = 1; i < rd.nodes.length; i++) link(rd.nodes[i - 1][1], rd.nodes[i][1]);
  }
  return { nodes };
})();
function routeTo(tx, tz, fx, fz) {
  const s = nearestRoad(fx, fz), e = nearestRoad(tx, tz), N = RG.nodes.length, S = N, E = N + 1;
  const extra = [[], []];
  [[s, 0], [e, 1]].forEach(([p, k]) => {
    const ns = p.r.nodes; let lo = ns[0], hi = ns[ns.length - 1];
    for (const n of ns) if (n[0] <= p.t + 1e-6) lo = n;
    for (let i = ns.length - 1; i >= 0; i--) if (ns[i][0] >= p.t - 1e-6) hi = ns[i];
    extra[k] = [[lo[1], Math.abs(p.t - lo[0])], [hi[1], Math.abs(hi[0] - p.t)]];
    if (s.r === e.r) extra[k].push([k ? S : E, Math.abs(s.t - e.t)]);
  });
  const adjOf = i => { const out = i < N ? [...RG.nodes[i].adj] : [...extra[i - N]]; for (const [j, lst] of [[S, extra[0]], [E, extra[1]]]) if (i !== j) for (const [k, d] of lst) if (k === i) out.push([j, d]); return out; };
  const dist = new Array(N + 2).fill(1e9), prev = new Array(N + 2).fill(-1), used = new Array(N + 2).fill(false);
  const pos = i => i < N ? [RG.nodes[i].x, RG.nodes[i].z] : i === S ? [s.x, s.z] : [e.x, e.z];
  dist[S] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < N + 2; i++) if (!used[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] >= 1e9) break; used[u] = true; if (u === E) break;
    for (const [v, d] of adjOf(u)) if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  const path = [[tx, tz]]; let u = E; while (u >= 0) { path.push(pos(u)); u = prev[u]; } path.push([fx, fz]);
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
  const [e, f] = T(MX0, MZ0);
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
  const s = Math.min(bigmap.width / (MW * MPX), bigmap.height / (MH * MPX)), w = MW * MPX * s, h = MH * MPX * s, ox = (bigmap.width - w) / 2, oy = (bigmap.height - h) / 2;
  bmx.clearRect(0, 0, bigmap.width, bigmap.height); bmx.drawImage(mapImg, ox, oy, w, h);
  const T = (x, z) => [ox + (x - MX0) * MPX * s, oy + (z - MZ0) * MPX * s];
  bmx.font = `${12 * devicePixelRatio}px Jost, sans-serif`; bmx.fillStyle = 'rgba(255,255,255,.75)'; bmx.textAlign = 'center';
  for (const rd of ROADS) {
    if (rd.w < 8) continue;
    const mx = clamp((rd.p0[0] + rd.p1[0]) / 2, WORLD.x0 + 60, WORLD.x1 - 60), mz = clamp((rd.p0[1] + rd.p1[1]) / 2, WORLD.z0 + 40, WORLD.z1 - 40);
    const [x, y] = T(mx, mz); let a = Math.atan2(rd.dz, rd.dx); if (a > Math.PI / 2 || a < -Math.PI / 2) a += Math.PI;
    bmx.save(); bmx.translate(x, y); bmx.rotate(a); bmx.fillText(rd.name, 0, -4 * devicePixelRatio); bmx.restore();
  }
  for (const [t, x, z] of [['Villas Chloé', 150, 30], ['Le parc', 52, 96], ['Commerces', -44, 108], ['Le jardin', -120, 70], ['Villas Céline', 60, 236], ['Villas Céline', 165, 170], ['Villas Margaux', -140, 215], ['Villas Margaux', 232, 95]]) { const [a, b] = T(x, z); bmx.fillText(t, a, b); }
  if (route) { bmx.strokeStyle = route.c; bmx.lineWidth = 4 * devicePixelRatio; bmx.beginPath(); route.p.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? bmx.lineTo(a, b) : bmx.moveTo(a, b); }); bmx.stroke(); }
  for (const bl of blipList()) { const [x, y] = T(bl.x, bl.z); drawBlip(bmx, x, y, bl, devicePixelRatio); }
  const [px, py] = T(P.car ? P.car.x : P.x, P.car ? P.car.z : P.z);
  bmx.save(); bmx.translate(px, py); bmx.rotate(-(P.car ? P.car.h : P.heading) + Math.PI); const k = devicePixelRatio * 1.2;
  bmx.fillStyle = '#fff'; bmx.strokeStyle = '#111'; bmx.lineWidth = 2; bmx.beginPath(); bmx.moveTo(0, -11 * k); bmx.lineTo(8 * k, 9 * k); bmx.lineTo(0, 4 * k); bmx.lineTo(-8 * k, 9 * k); bmx.closePath(); bmx.fill(); bmx.stroke(); bmx.restore();
  bigmap._T = { ox, oy, s };
}
bigmap.addEventListener('click', e => {
  const r = bigmap.getBoundingClientRect(), T = bigmap._T; if (!T) return;
  const x = ((e.clientX - r.left) * devicePixelRatio - T.ox) / (MPX * T.s) + MX0, z = ((e.clientY - r.top) * devicePixelRatio - T.oy) / (MPX * T.s) + MZ0;
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
  if (e.code === 'KeyV') { camDist = camDist === 0 ? 6.5 : camDist < 5 ? 0 : camDist < 8 ? 10 : 4.2; hint(camDist === 0 ? 'Vue à la première personne (V pour changer)' : 'Vue à la troisième personne', 2); }
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
  if (document.pointerLockElement === canvas) { yaw -= e.movementX * 0.0024; pitch = clamp(pitch + e.movementY * 0.002, camDist === 0 ? -1.2 : -0.15, 1.2); lastMouse = performance.now() / 1000; return; }
  if (!drag || drag.id !== e.pointerId) return;
  yaw -= (e.clientX - drag.x) * 0.0055; pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, -0.15, 1.2);
  drag.x = e.clientX; drag.y = e.clientY; lastMouse = performance.now() / 1000;
});
canvas.addEventListener('pointerup', () => drag = null); canvas.addEventListener('pointercancel', () => drag = null);
canvas.addEventListener('wheel', e => { if (camDist === 0) { if (e.deltaY > 0) camDist = 2.6; } else { camDist = Math.min(22, camDist * (1 + e.deltaY * 0.001)); if (camDist < 2.3) camDist = 0; } e.preventDefault(); }, { passive: false });
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
    if (nearMission.needCar) { hint('Il vous faut une voiture : la <b>Porsche 911</b> rouge est garée juste à côté. Montez avec <kbd>F</kbd> puis revenez sur le marqueur.', 6); return; }
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
  if (CAR_NAMES[c.kind]) { $('area-k').textContent = 'Véhicule'; $('area-n').textContent = CAR_NAMES[c.kind]; $('area').classList.add('on'); areaT = 3; lastZone = ''; }
  hint('<kbd>Z</kbd> accélérer · <kbd>S</kbd> freiner · <kbd>Espace</kbd> frein à main · <kbd>H</kbd> klaxon · <kbd>R</kbd> radio · <kbd>F</kbd> descendre', 7, 'drive');
}

/* ================= simulation ================= */
const R = 0.35, qbuf = [], qbuf2 = [];
function heroCollide() {
  let ground = 0;
  for (let pass = 0; pass < 2; pass++) for (const s of query(P.x, P.z, 1.2, qbuf)) {
    if (s.h <= P.y + 0.4) continue;
    const p = solidPush(s, P.x, P.z, R); if (p) { P.x += p[0]; P.z += p[1]; }
  }
  for (const s of query(P.x, P.z, 0.5, qbuf)) if (s.kind !== 'pool' && s.h <= P.y + 0.4 && solidContains(s, P.x, P.z, 0.1)) ground = Math.max(ground, s.h);
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
  P.x = clamp(P.x, WORLD.x0 + 15, WORLD.x1 - 15); P.z = clamp(P.z, WORLD.z0 + 15, WORLD.z1 - 15);
  return ground;
}
function inQuad(q, x, z) {
  let sgn = 0;
  for (let i = 0; i < 4; i++) { const [ax, az] = q[i], [bx, bz] = q[(i + 1) % 4], c = (bx - ax) * (z - az) - (bz - az) * (x - ax); if (c === 0) continue; if (sgn === 0) sgn = Math.sign(c); else if (Math.sign(c) !== sgn) return false; }
  return true;
}
function inPool(x, z) { for (const p of pools) if (inQuad(p, x, z)) return true; return false; }

const vrIn = { f: 0, s: 0, run: false, thr: 0, brk: 0, st: 0, on: false };
function updateFoot(dt) {
  let f = 0, s = 0;
  if (press('KeyW') || press('ArrowUp')) f += 1;
  if (press('KeyS') || press('ArrowDown')) f -= 1;
  if (press('KeyD') || press('ArrowRight')) s += 1;
  if (press('KeyA') || press('ArrowLeft')) s -= 1;
  if (joy) { f = -jv.y; s = jv.x; }
  if (vrIn.on) { f = vrIn.f; s = vrIn.s; }
  const mag = Math.min(1, Math.hypot(f, s));
  const run = press('ShiftLeft') || press('ShiftRight') || runToggle || (joy && mag > 0.95) || vrIn.run;
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
      if (s.h < 0.25) continue;
      const [qx, qz, mx, mz] = solidClosest(s, cx, cz); let dx = cx - qx, dz = cz - qz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-4) { dx = cx - mx; dz = cz - mz; d = Math.hypot(dx, dz) || 1; }
      const nx = dx / d, nz = dz / d, push = r - Math.hypot(cx - qx, cz - qz);
      c.x += nx * push; c.z += nz * push; cx += nx * push; cz += nz * push;
      const imp = c.vx * nx + c.vz * nz;
      if (imp < 0) { c.vx -= nx * imp * 1.35; c.vz -= nz * imp * 1.35; hit = Math.max(hit, -imp); }
    }
  }
  // world bounds
  c.x = clamp(c.x, WORLD.x0 + 15, WORLD.x1 - 15); c.z = clamp(c.z, WORLD.z0 + 15, WORLD.z1 - 15);
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
  if (vrIn.on) { thr = vrIn.thr; brk = vrIn.brk; st = vrIn.st; }
  const hand = press('Space');
  const fx = c.fx, fz = c.fz;
  let along = c.vx * fx + c.vz * fz;
  const sport = c.kind >= 2, maxF = c.kind === 4 ? 52 : c.kind === 3 ? 50 : c.kind === 5 ? 44 : sport ? 46 : 36, acc = c.kind === 4 ? 15 : c.kind === 3 ? 14 : sport ? 13 : 9.5;
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
  for (let i = 0; i < 4; i++) { const w = c.wheels[i]; w.children[0].rotation.x += c.along * dt / 0.37; if (i < 2) w.rotation.y = c.steer; }
  if (c.kind === 4 && !c.model) { // procedural cabriolet: the driver stays visible (the Sketchfab model has its soft top up)
    hero.root.visible = true;
    hero.root.position.set(c.x + c.fz * 0.36 - c.fx * 0.22, -0.02, c.z - c.fx * 0.36 - c.fz * 0.22); hero.root.position.y = c.model ? -0.4 : 0.1; hero.root.rotation.y = c.h;
    animatePerson(hero, 0, 0); hero.legL.rotation.x = hero.legR.rotation.x = -1.45; hero.armL.rotation.x = hero.armR.rotation.x = -1.15;
    hero.armL.rotation.z = -0.25; hero.armR.rotation.z = 0.25; hero.body.position.y = 0;
  }
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
    const rd = ai.seg, dir = ai.dir, fx0 = rd.dx * dir, fz0 = rd.dz * dir, rx = -fz0, rz = fx0;
    ai.dx = fx0; ai.dz = fz0;
    const pxr = c.x - rd.p0[0], pzr = c.z - rd.p0[1];
    let along = pxr * rd.dx + pzr * rd.dz, lat = pxr * rx + pzr * rz; // lat: offset to the right of travel
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
    // next crossing ahead: lights, then maybe a turn
    let next = null; for (const X of rd.xings) { const d = (X.t - along) * dir; if (d > -0.5 && (next === null || d < next.d)) next = { X, d }; }
    if (next) {
      if (next.X.X.ai) { const ls = lightState(rd.axis === 'x', t); if (ls !== 'g' && next.d > 7.5 && next.d < 22) target = Math.min(target, Math.max(0, (next.d - 9.5) * 1.2)); }
      if (ai.cool > 0) ai.cool -= dt;
      else if (ai.prev > 0 && next.d <= 0.3 && ai.lastTurn !== next.X.X) {
        ai.lastTurn = next.X.X;
        const o = next.X.other;
        if (o.ai && rnd() < 0.45) {
          const opts = [1, -1].filter(sg => { const tt = next.X.to + sg * 25; return tt > 0 && tt < o.L; });
          if (opts.length) { ai.seg = o; ai.dir = pick(opts); ai.prev = 99; ai.cool = 2.5; continue; }
        }
      }
      ai.prev = next.d;
    }
    ai.v = damp(ai.v, target, target < ai.v ? 5 : 1.2, dt);
    along += dir * ai.v * dt;
    const laneOff = rd.w >= 10 ? 2.5 : 1.9;
    lat += clamp(laneOff - lat, -ai.v * 0.55 * dt, ai.v * 0.55 * dt);
    if (along < 0 || along > rd.L) {
      if (rd.wrap) along = (along + rd.L) % rd.L;
      else { ai.dir = -ai.dir; along = clamp(along, 0, rd.L); lat = -lat; ai.prev = 99; ai.lastTurn = null; }
    }
    const nx = rd.p0[0] + rd.dx * along + rx * lat, nz = rd.p0[1] + rd.dz * along + rz * lat;
    const mx = nx - c.x, mz = nz - c.z; c.x = nx; c.z = nz;
    if (mx * mx + mz * mz > 1e-6) c.h += wrapA(Math.atan2(mx, mz) - c.h) * Math.min(1, dt * 8);
    c.vx = mx / dt; c.vz = mz / dt;
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
  for (const l of lots) if (x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1 && inQuad(l.poly, x, z)) return [`Lot n° ${l.n}`, `Villa ${l.name}`];
  if (Math.hypot(x + 16, z - 161) < 11) return ['Domaine Red Stone', 'Le rond-point'];
  const rd = nearestRoad(x, z); if (rd.d < rd.r.w / 2 + 0.5) return ['Domaine Red Stone', rd.r.name];
  if (inParkBand(x, z)) return Math.hypot(x - 65, z - 68) < 9 ? ['Le parc', 'La pergola'] : ['Domaine Red Stone', 'Le parc'];
  if (x > -8 && x < 28 && z > 167 && z < 183) return ['Domaine Red Stone', 'Parking'];
  if (Math.hypot(x - 46, z - 177) < 9) return ['Domaine Red Stone', 'Espace commun'];
  if (Math.hypot(x + 44, z - 124) < 15) return ['Domaine Red Stone', 'Les commerces'];
  if (inPoly(GARDEN_POLY, x, z)) return ['Domaine Red Stone', 'Le jardin'];
  if (x > -2 && x < 192 && z > -2 && z < 158) return ['Domaine Red Stone', 'Villas Chloé'];
  if (!inPoly(SITE_POLY, x, z)) return ['Les abords', 'La pinède'];
  return ['Domaine Red Stone', 'Le domaine'];
}

/* ================= main loop ================= */
const clock = new THREE.Clock();
const look = V(0, 0, 0), camPos = V(0, 0, 0), tmp = V(0, 0, 0);
let lastZone = '', areaT = 0, simT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (renderer.xr.isPresenting) { readVR(dt); if (paused) setPause(false); }
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
  for (const c of cars) if (c.model) c.setLod(c === P.car || (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2 < 6400);
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
  const car = P.car, xr = renderer.xr.isPresenting, fp = xr || (camDist === 0 && started);
  if (fp) hero.root.visible = false;
  const lookY = car ? 1.3 : P.y + (P.swim ? 1.0 : 1.55);
  look.set(car ? car.x : P.x, lookY, car ? car.z : P.z);
  const now = performance.now() / 1000;
  if (car && !xr && now - lastMouse > 1.4 && Math.abs(car.along) > 1) { const back = car.along >= 0 ? car.h + Math.PI : car.h; yaw += wrapA(back - yaw) * Math.min(1, dt * (fp ? 6 : 2.5)); pitch = damp(pitch, fp ? 0 : 0.22, 1.5, dt); }
  if (!started) yaw += dt * 0.06;
  if (xr) { // the rig stands where the hero stands (or sits in the car); the headset does the looking
    if (car) { rig.position.set(car.x + car.fz * 0.36 - car.fx * 0.2, 0.42, car.z - car.fx * 0.36 - car.fz * 0.2); rig.rotation.y = car.h + Math.PI; }
    else { rig.position.set(P.x, P.y + (P.swim ? -0.5 : 0), P.z); }
    const hd = new THREE.Vector3(); renderer.xr.getCamera().getWorldDirection(hd); yaw = Math.atan2(-hd.x, -hd.z);
    sky.position.copy(rig.position); stars.position.copy(rig.position);
  } else if (fp) { // first person: eyes at 1.62 m, or in the driver's seat
    if (car) camera.position.set(car.x + car.fz * 0.36 + car.fx * 0.25, 1.18, car.z - car.fx * 0.36 + car.fz * 0.25);
    else camera.position.set(P.x, P.y + (P.swim ? 0.9 : 1.62) + (P.speed > 0.5 ? Math.sin(P.phase * 2) * 0.025 : 0), P.z);
    if (shake > 0) { camera.position.y += (Math.random() - 0.5) * shake * 0.3; shake = Math.max(0, shake - dt * 2.5); }
    camera.lookAt(camera.position.x - Math.sin(yaw) * Math.cos(pitch), camera.position.y - Math.sin(pitch), camera.position.z - Math.cos(yaw) * Math.cos(pitch));
    const fovF = car ? 70 + clamp(Math.abs(car.along) * 0.3, 0, 12) : 72;
    if (Math.abs(camera.fov - fovF) > 0.05) { camera.fov = damp(camera.fov, fovF, 3, dt); camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position); stars.position.copy(camera.position);
  }
  const dist = car ? 8.2 + Math.abs(car.along) * 0.06 : camDist;
  if (!fp) {
  const cx = Math.sin(yaw) * Math.cos(pitch), cy = Math.sin(pitch), cz = Math.cos(yaw) * Math.cos(pitch);
  let d = dist;
  for (let t = 0.6; t < dist; t += 0.35) {
    const x = look.x + cx * t, y = look.y + cy * t, z = look.z + cz * t;
    if (y < 0.2) { d = Math.max(0.8, t - 0.2); break; }
    let blocked = false; for (const s of query(x, z, 0.4, qbuf)) if (s.h > y && s.h > 2 && solidContains(s, x, z, 0.3)) { blocked = true; break; }
    if (blocked) { d = Math.max(0.8, t - 0.4); break; }
  }
  camPos.set(look.x + cx * d, look.y + cy * d, look.z + cz * d);
  camera.position.lerp(camPos, started ? Math.min(1, dt * (car ? 8 : 12)) : 1);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.5; camera.position.y += (Math.random() - 0.5) * shake * 0.5; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(look);
  const fov = car ? 58 + clamp(Math.abs(car.along) * 0.45, 0, 16) : 58;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  }

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

/* ================= VR ================= */
let vrSnap = 0;
const vrBtn = $('b-vr');
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { vrBtn.hidden = !ok; $('vr-intro').hidden = !ok; }).catch(() => {});
async function enterVR() {
  if (renderer.xr.getSession()) { renderer.xr.getSession().end(); return; }
  try {
    const sess = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(sess);
    if (!started) go.click();
  } catch (e) { hint('La VR n\'a pas pu démarrer : ' + e.message, 5); }
}
vrBtn.onclick = enterVR;
$('go-vr').onclick = enterVR; $('b-fp').onclick = () => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
renderer.xr.addEventListener('sessionstart', () => {
  suppressPause = true; document.exitPointerLock?.(); setPause(false);
  rig.add(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  rig.rotation.y = P.car ? P.car.h + Math.PI : P.heading + Math.PI; vrIn.on = true; vrBtn.setAttribute('aria-pressed', 'true');
  audio.init();
});
renderer.xr.addEventListener('sessionend', () => {
  scene.add(camera); vrIn.on = false; vrIn.f = vrIn.s = vrIn.thr = vrIn.brk = vrIn.st = 0; vrBtn.setAttribute('aria-pressed', 'false');
  camera.fov = 58; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); hero.root.visible = !P.car;
});
const vrBtnState = {};
function readVR(dt) {
  const sess = renderer.xr.getSession(); if (!sess) return;
  const hd = new THREE.Vector3(); renderer.xr.getCamera().getWorldDirection(hd); hd.y = 0; hd.normalize();
  vrIn.f = vrIn.s = vrIn.thr = vrIn.brk = vrIn.st = 0; vrIn.run = false;
  for (const src of sess.inputSources) {
    const g = src.gamepad; if (!g) continue;
    const ax = g.axes.length >= 4 ? g.axes[2] : g.axes[0] || 0, ay = g.axes.length >= 4 ? g.axes[3] : g.axes[1] || 0;
    const b = i => !!(g.buttons[i] && g.buttons[i].pressed);
    if (src.handedness === 'left') {
      if (P.car) { vrIn.thr = clamp(-ay, 0, 1); vrIn.brk = clamp(ay, 0, 1); vrIn.st = -ax; }
      else if (Math.abs(ax) > 0.12 || Math.abs(ay) > 0.12) { vrIn.f = -ay; vrIn.s = ax; }
      vrIn.run = b(0);
      if (b(4) && !vrBtnState.x) toggleCar(); vrBtnState.x = b(4);
    } else {
      if (P.car) { vrIn.st = vrIn.st || -ax; if (b(0)) hornHeld = true; else if (vrBtnState.horn) hornHeld = false; vrBtnState.horn = b(0); }
      if (Math.abs(ax) > 0.7 && vrSnap === 0) { vrSnap = Math.sign(ax); rig.rotation.y -= vrSnap * Math.PI / 6; } else if (Math.abs(ax) < 0.3) vrSnap = 0;
      if (b(0) && !vrBtnState.trig && !P.car) act(); vrBtnState.trig = b(0);
      if (b(4) && !vrBtnState.a) toggleCar(); vrBtnState.a = b(4);
      if (b(1) && !vrBtnState.grip) wantJump = true; vrBtnState.grip = b(1);
      if (b(5) && !vrBtnState.b) radioNext(); vrBtnState.b = b(5);
    }
  }
}

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
renderer.setAnimationLoop(frame);
go.disabled = false; go.textContent = 'Jouer';
