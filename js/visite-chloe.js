// Villa Chloé — visite immersive à l'échelle 1 : clavier/souris, tactile, et WebXR (casque Quest, téléphone compatible).
// Volumes d'après les plans de vente (cuisine / séjour / double hauteur / salon-cheminée / suites), matières d'après les rendus
// de l'architecte : pierre anthracite, pylônes de marbre gris aux lignes de bronze, sous-faces en lames de bois, LED chaudes,
// bassin en mosaïque, mobilier cuir vert et cognac, bibliothèque noire aux fonds cuivre, cheminée linéaire, sculpture dorée.
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
let seed = 20261011; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const isTouch = matchMedia('(pointer:coarse)').matches;
const lowEnd = isTouch || navigator.hardwareConcurrency <= 4;

// ---------------------------------------------------------------- rendu
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);

// ciel : dégradé crépusculaire (ou jour), halo du soleil
const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: V(-0.7, 0.18, 0.5).normalize() } };
const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, mid, hor, sunDir; varying vec3 vP;
    void main(){ float h = clamp(vP.y, -0.04, 1.0); vec3 c = mix(hor, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.85, h));
      float s = max(dot(normalize(vP), sunDir), 0.0); c += hor * pow(s, 10.0) * 0.55 + vec3(1.0, 0.85, 0.65) * pow(s, 220.0) * 1.5;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` });
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 40, 20), skyMat); scene.add(sky);
scene.fog = new THREE.Fog('#000000', 90, 420);
const hemi = new THREE.HemisphereLight('#ffffff', '#000000', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 1); sun.castShadow = true; sun.shadow.mapSize.set(lowEnd ? 2048 : 4096, lowEnd ? 2048 : 4096);
{ const c = sun.shadow.camera; c.left = c.bottom = -34; c.right = c.top = 34; c.near = 1; c.far = 200; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; }
scene.add(sun); scene.add(sun.target);
const pmrem = new THREE.PMREMGenerator(renderer);
function buildEnv() { const s = new THREE.Scene(); s.add(new THREE.Mesh(sky.geometry, skyMat)); const g = new THREE.Mesh(new THREE.CylinderGeometry(500, 500, 2, 24), new THREE.MeshBasicMaterial({ color: '#2a2724' })); g.position.y = -3; s.add(g); const t = pmrem.fromScene(s, 0.03, 0.1, 1200).texture; if (scene.environment) scene.environment.dispose(); scene.environment = t; }

// ---------------------------------------------------------------- textures procédurales
function tex(draw, size = 512, rep = 1, srgb = true) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const noise = (g, n, count, col, a0, a1, r0, r1) => { for (let i = 0; i < count; i++) { g.fillStyle = col.replace('A', (a0 + rnd() * (a1 - a0)).toFixed(3)); const r = r0 + rnd() * (r1 - r0); g.beginPath(); g.arc(rnd() * n, rnd() * n, r, 0, 7); g.fill(); } };
const veins = (g, n, count, col, w0, w1, a0, a1, wander = 60) => { g.lineCap = 'round'; for (let i = 0; i < count; i++) { g.strokeStyle = col.replace('A', (a0 + rnd() * (a1 - a0)).toFixed(2)); g.lineWidth = w0 + rnd() * (w1 - w0); g.beginPath(); let x = rnd() * n, y = -10; g.moveTo(x, y); while (y < n + 10) { const nx = x + (rnd() - 0.5) * wander, ny = y + 20 + rnd() * 50; g.quadraticCurveTo(x + (rnd() - 0.5) * 40, (y + ny) / 2, nx, ny); x = nx; y = ny; } g.stroke(); } };
const T = {
  stone: tex((g, n) => { g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, n, n); noise(g, n, 90, 'rgba(70,72,78,A)', 0.05, 0.16, 20, 90); noise(g, n, 2500, 'rgba(0,0,0,A)', 0.05, 0.25, 0.5, 2); veins(g, n, 5, 'rgba(120,122,128,A)', 0.4, 1.2, 0.08, 0.22, 40); g.fillStyle = '#121214'; g.fillRect(0, 0, n, 3); g.fillRect(0, 0, 3, n); g.fillRect(0, n / 2 - 1, n, 3); g.fillRect(n / 2 - 1, 0, 3, n); }),
  marbleG: tex((g, n) => { g.fillStyle = '#8a8c8f'; g.fillRect(0, 0, n, n); noise(g, n, 120, 'rgba(165,167,170,A)', 0.08, 0.2, 15, 70); noise(g, n, 120, 'rgba(70,72,76,A)', 0.06, 0.14, 15, 60); veins(g, n, 10, 'rgba(50,52,56,A)', 0.5, 2.2, 0.15, 0.45); veins(g, n, 6, 'rgba(225,226,228,A)', 0.4, 1.2, 0.1, 0.3); }),
  marbleW: tex((g, n) => { g.fillStyle = '#d9d6d0'; g.fillRect(0, 0, n, n); noise(g, n, 100, 'rgba(190,186,178,A)', 0.08, 0.2, 20, 80); veins(g, n, 9, 'rgba(120,118,112,A)', 0.4, 1.8, 0.12, 0.4); veins(g, n, 4, 'rgba(170,160,140,A)', 0.4, 1.0, 0.1, 0.25); }),
  marbleB: tex((g, n) => { g.fillStyle = '#151517'; g.fillRect(0, 0, n, n); noise(g, n, 60, 'rgba(40,40,44,A)', 0.1, 0.3, 20, 80); veins(g, n, 9, 'rgba(230,230,232,A)', 0.4, 2.4, 0.2, 0.7, 70); veins(g, n, 10, 'rgba(200,200,205,A)', 0.3, 0.8, 0.1, 0.35, 50); }),
  plaster: tex((g, n) => { g.fillStyle = '#b3afa7'; g.fillRect(0, 0, n, n); noise(g, n, 400, 'rgba(150,146,138,A)', 0.04, 0.12, 10, 60); noise(g, n, 400, 'rgba(205,201,194,A)', 0.04, 0.1, 10, 60); noise(g, n, 3000, 'rgba(90,86,80,A)', 0.02, 0.08, 0.5, 2); }),
  tile: tex((g, n) => { g.fillStyle = '#8d8983'; g.fillRect(0, 0, n, n); noise(g, n, 300, 'rgba(120,116,110,A)', 0.04, 0.12, 8, 50); noise(g, n, 300, 'rgba(165,161,154,A)', 0.04, 0.1, 8, 50); noise(g, n, 2500, 'rgba(60,58,54,A)', 0.02, 0.08, 0.5, 2); g.fillStyle = '#5e5b56'; g.fillRect(0, 0, n, 2); g.fillRect(0, 0, 2, n); }),
  slats: tex((g, n) => { g.fillStyle = '#1a1411'; g.fillRect(0, 0, n, n); const w = n / 12; for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${24 + rnd() * 6},${42 + rnd() * 12}%,${30 + rnd() * 9}%)`; g.fillRect(i * w, 0, w * 0.72, n); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`; g.fillRect(i * w + rnd() * w * 0.72, 0, 1, n); } } }),
  fence: tex((g, n) => { g.fillStyle = '#17120f'; g.fillRect(0, 0, n, n); const w = n / 8; for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(${22 + rnd() * 6},${35 + rnd() * 10}%,${22 + rnd() * 7}%)`; g.fillRect(i * w, 0, w * 0.66, n); for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.12})`; g.fillRect(i * w + rnd() * w * 0.66, 0, 1, n); } } }),
  walnut: tex((g, n) => { g.fillStyle = '#4a3222'; g.fillRect(0, 0, n, n); for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.15})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = rnd() * n; g.moveTo(x, 0); g.bezierCurveTo(x + 8, n / 3, x - 8, 2 * n / 3, x + 3, n); g.stroke(); } noise(g, n, 200, 'rgba(120,80,50,A)', 0.05, 0.15, 5, 30); }),
  mosaic: tex((g, n) => { const pal = ['#1e8fb5', '#2aa3c4', '#38b6cf', '#1679a3', '#47c3d6', '#2b9cbc', '#5fd0dd', '#1a6f93']; g.fillStyle = '#9fd3df'; g.fillRect(0, 0, n, n); const s = n / 24; for (let y = 0; y < n; y += s) for (let x = 0; x < n; x += s) { g.fillStyle = pal[Math.floor(rnd() * pal.length)]; g.fillRect(x + 1, y + 1, s - 2, s - 2); } }),
  lawn: tex((g, n) => { g.fillStyle = '#5f8a3c'; g.fillRect(0, 0, n, n); for (let i = 0; i < 7000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(40,80,30,${0.1 + rnd() * 0.2})` : `rgba(140,190,90,${0.08 + rnd() * 0.16})`; const r = 1.5 + rnd() * 6; g.beginPath(); g.arc(rnd() * n, rnd() * n, r, 0, 7); g.fill(); } for (let i = 0; i < 12000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '35,65,25' : '170,205,110'},0.3)`; g.fillRect(rnd() * n, rnd() * n, 1, 2 + rnd() * 3); } }),
  pebble: tex((g, n) => { g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { const v = 205 + rnd() * 45; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 6 + rnd() * 9, 4 + rnd() * 6, rnd() * 3, 0, 7); g.fill(); g.strokeStyle = 'rgba(80,75,70,0.45)'; g.lineWidth = 1; g.stroke(); } }),
  gravelD: tex((g, n) => { g.fillStyle = '#2f3134'; g.fillRect(0, 0, n, n); for (let i = 0; i < 1400; i++) { const v = 40 + rnd() * 45; g.fillStyle = `rgb(${v},${v + 1},${v + 4})`; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 4 + rnd() * 7, 3 + rnd() * 5, rnd() * 3, 0, 7); g.fill(); } }),
  paver: tex((g, n) => { g.fillStyle = '#4d4f52'; g.fillRect(0, 0, n, n); noise(g, n, 200, 'rgba(100,102,106,A)', 0.05, 0.15, 10, 50); noise(g, n, 2000, 'rgba(0,0,0,A)', 0.04, 0.16, 0.5, 2); g.fillStyle = '#2a2b2d'; g.fillRect(0, 0, n, 4); g.fillRect(0, 0, 4, n); }),
  curtain: tex((g, n) => { for (let x = 0; x < n; x++) { const k = 0.5 + 0.5 * Math.sin(x / n * Math.PI * 14); const v = Math.round(130 + k * 55); g.fillStyle = `rgb(${v + 12},${v + 2},${v - 14})`; g.fillRect(x, 0, 1, n); } noise(g, n, 1500, 'rgba(0,0,0,A)', 0.02, 0.06, 0.5, 2); }),
  lattice: tex((g, n) => { g.fillStyle = '#1b1613'; g.fillRect(0, 0, n, n); const s = n / 16; for (let y = 0; y < n; y += s) for (let x = 0; x < n; x += s) { const d = Math.hypot(x / n - 0.5, y / n - 0.5); const on = (Math.sin(x / n * 9 + Math.sin(y / n * 5) * 2) + Math.cos(y / n * 7)) > -0.2 || d < 0.1; if (on) { g.fillStyle = `hsl(${26 + rnd() * 6},${45 + rnd() * 10}%,${34 + rnd() * 10}%)`; g.fillRect(x + 2, y + 2, s - 4, s - 4); } } }),
  asphalt: tex((g, n) => { g.fillStyle = '#4a4c50'; g.fillRect(0, 0, n, n); noise(g, n, 4000, 'rgba(0,0,0,A)', 0.04, 0.16, 0.5, 2); noise(g, n, 1500, 'rgba(140,142,146,A)', 0.03, 0.1, 0.5, 2); }),
  leather: tex((g, n) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n); noise(g, n, 4000, 'rgba(0,0,0,A)', 0.02, 0.07, 0.5, 2.5); const w = n / 6; for (let i = 1; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * w - 2, 0, 4, n); } }),
  ripple: tex((g, n) => { g.fillStyle = '#8080ff'; g.fillRect(0, 0, n, n); for (let i = 0; i < 600; i++) { const x = rnd() * n, y = rnd() * n, r = 8 + rnd() * 36; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${110 + rnd() * 40},${110 + rnd() * 40},255,0.55)`); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }, 512, 1, false),
  fall: tex((g, n) => { g.fillStyle = '#000000'; g.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; g.lineWidth = 1 + rnd() * 2; const x = rnd() * n; g.beginPath(); g.moveTo(x, rnd() * n); g.lineTo(x + (rnd() - 0.5) * 4, rnd() * n); g.stroke(); } }, 256, 1, false),
};
T.ripple.repeat.set(6, 6); T.fall.repeat.set(1, 3);

// ---------------------------------------------------------------- matières (clé → matériau ; unit = taille d'un motif en mètres)
const std = (o, unit = 1) => { const m = new THREE.MeshStandardMaterial(o); m.userData.unit = unit; return m; };
const M = {
  stone: std({ map: T.stone, roughness: 0.55, metalness: 0.08, envMapIntensity: 0.6 }, 2.4),
  marbleG: std({ map: T.marbleG, roughness: 0.28, metalness: 0.04, envMapIntensity: 1.0 }, 2.0),
  marbleW: std({ map: T.marbleW, roughness: 0.32, metalness: 0.03, envMapIntensity: 0.8 }, 2.2),
  marbleB: std({ map: T.marbleB, roughness: 0.18, metalness: 0.08, envMapIntensity: 1.2 }, 1.6),
  plaster: std({ map: T.plaster, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }, 3),
  tile: std({ map: T.tile, roughness: 0.45, metalness: 0.02, envMapIntensity: 0.6 }, 1.2),
  slats: std({ map: T.slats, roughness: 0.7, metalness: 0, envMapIntensity: 0.4 }, 1.0),
  fence: std({ map: T.fence, roughness: 0.8, metalness: 0 }, 1.0),
  walnut: std({ map: T.walnut, roughness: 0.5, metalness: 0.02, envMapIntensity: 0.6 }, 1.0),
  mosaic: std({ map: T.mosaic, roughness: 0.25, metalness: 0.05, envMapIntensity: 0.8 }, 0.6),
  lawn: std({ map: T.lawn, roughness: 1, metalness: 0 }, 3),
  pebble: std({ map: T.pebble, roughness: 0.85 }, 0.5),
  gravelD: std({ map: T.gravelD, roughness: 0.9 }, 0.7),
  paver: std({ map: T.paver, roughness: 0.8, metalness: 0.02 }, 1.5),
  curtain: std({ map: T.curtain, roughness: 1, metalness: 0 }, 1.0),
  lattice: std({ map: T.lattice, roughness: 0.75, metalness: 0 }, 1.0),
  asphalt: std({ map: T.asphalt, roughness: 0.95 }, 3),
  bronze: std({ color: '#a8803f', roughness: 0.32, metalness: 0.95, envMapIntensity: 1.3 }),
  gold: std({ color: '#e2b85e', roughness: 0.18, metalness: 1, envMapIntensity: 1.6 }),
  frame: std({ color: '#111214', roughness: 0.4, metalness: 0.7, envMapIntensity: 0.8 }),
  steelBk: std({ color: '#171819', roughness: 0.55, metalness: 0.5 }),
  copper: std({ color: '#8a4a2c', roughness: 0.6, metalness: 0.25 }),
  leatherG: std({ map: T.leather, color: '#1d3a27', roughness: 0.32, metalness: 0.05, envMapIntensity: 1.1 }, 0.9),
  leatherC: std({ map: T.leather, color: '#9d5b2b', roughness: 0.38, metalness: 0.05, envMapIntensity: 1.0 }, 0.9),
  fabric: std({ color: '#e4ddcf', roughness: 1, metalness: 0 }),
  fabricD: std({ color: '#4a4745', roughness: 1, metalness: 0 }),
  linen: std({ color: '#efeae0', roughness: 1 }),
  leaf: new THREE.MeshLambertMaterial({ color: '#3c6b2c' }),
  leaf2: new THREE.MeshLambertMaterial({ color: '#5c8f3a' }),
  palm: new THREE.MeshLambertMaterial({ color: '#4f8a3a', side: THREE.DoubleSide }),
  pine: new THREE.MeshLambertMaterial({ color: '#2f5a33' }),
  trunk: std({ color: '#5a4634', roughness: 0.95 }),
  rock: new THREE.MeshStandardMaterial({ color: '#4b4d50', roughness: 0.9, flatShading: true }),
  rockD: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.7, flatShading: true, envMapIntensity: 0.5 }),
  jar: std({ color: '#0e0f11', roughness: 0.15, metalness: 0.3, envMapIntensity: 1.4 }),
  mirror: std({ color: '#07080a', roughness: 0.03, metalness: 0.4, envMapIntensity: 1.8 }),
  white: std({ color: '#f1efe9', roughness: 0.8 }),
  book: std({ color: '#f3f0ea', roughness: 0.9 }),
  pot: std({ color: '#262626', roughness: 0.6 }),
  mountain: new THREE.MeshLambertMaterial({ color: '#3a4766' }),
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.45) }),
  ledCool: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 2.6) }),
  bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.8) }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#b9d2da', transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false }),
  railGlass: new THREE.MeshPhysicalMaterial({ color: '#8fa9b0', transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false }),
  water: new THREE.MeshPhysicalMaterial({ color: '#2fa9c4', transparent: true, opacity: 0.86, roughness: 0.04, metalness: 0.1, normalMap: T.ripple, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.6, emissive: '#0a4a5e', emissiveIntensity: 0.35 }),
  waterDark: new THREE.MeshPhysicalMaterial({ color: '#0d1a20', transparent: true, opacity: 0.92, roughness: 0.03, metalness: 0.3, normalMap: T.ripple, normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 1.8 }),
  fall: new THREE.MeshBasicMaterial({ color: '#dfeef5', transparent: true, opacity: 0.55, alphaMap: T.fall, side: THREE.DoubleSide, depthWrite: false }),
  flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.5, 0.3), transparent: true, opacity: 0.85 }),
};
M.water.userData.unit = 4; M.waterDark.userData.unit = 3;
const NO_SHADOW = new Set(['glass', 'railGlass', 'water', 'waterDark', 'fall', 'led', 'ledCool', 'bulb', 'lawn', 'asphalt', 'mountain', 'curtain']);

// ---------------------------------------------------------------- géométrie fusionnée par matière, collisions, sols
const buckets = {}, solids = [], floors = [];
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
function planarUV(geo, unit) { // projection planaire selon la normale : motif continu à l'échelle réelle
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; } uv[i * 2] = u / unit; uv[i * 2 + 1] = v / unit; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function put(key, geo, m) { if (m) geo.applyMatrix4(m); if (geo.index) geo = geo.toNonIndexed(); const mat = M[key]; if (!mat) throw new Error('mat ' + key); if ((mat.map || mat.normalMap) && mat.userData.unit) planarUV(geo, mat.userData.unit); (buckets[key] ||= []).push(geo); }
function solid(x0, x1, z0, z1, y0 = 0, y1 = 3.5) { solids.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 }); }
function floor(x0, x1, z0, z1, y, fn) { floors.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y, fn }); }
function box(key, x0, x1, y0, y1, z0, z1, s = false) { const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0); if (w < 1e-4 || h < 1e-4 || d < 1e-4) return; put(key, new THREE.BoxGeometry(w, h, d), mat4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); if (s) solid(x0, x1, z0, z1, y0, y1); }
function cyl(key, x, y0, y1, z, r0, r1 = r0, seg = 18, s = false) { put(key, new THREE.CylinderGeometry(r0, r1, y1 - y0, seg), mat4(x, (y0 + y1) / 2, z)); if (s) { const r = Math.max(r0, r1); solid(x - r, x + r, z - r, z + r, y0, y1); } }
function sph(key, x, y, z, r, detail = 2, sy = 1, sx = 1, sz = 1) { put(key, new THREE.IcosahedronGeometry(r, detail), mat4(x, y, z, 0, 0, 0, sx, sy, sz)); }
const WT = 0.3;
// mur : axe 'x' (le long de x, à z = c) ou 'z' ; out = +1 → la face extérieure regarde vers +axe perpendiculaire, 0 → cloison intérieure
function wall(axis, c, a0, a1, y0, y1, out = 0, outKey = 'stone', inKey = 'plaster') {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  const B = (k, p0, p1) => axis === 'x' ? box(k, lo, hi, y0, y1, p0, p1) : box(k, p0, p1, y0, y1, lo, hi);
  if (!out) B(inKey, c - WT / 2, c + WT / 2);
  else if (out > 0) { B(outKey, c + WT / 2 - 0.12, c + WT / 2); B(inKey, c - WT / 2, c + WT / 2 - 0.12); }
  else { B(outKey, c - WT / 2, c - WT / 2 + 0.12); B(inKey, c - WT / 2 + 0.12, c + WT / 2); }
  axis === 'x' ? solid(lo, hi, c - WT / 2, c + WT / 2, y0, y1) : solid(c - WT / 2, c + WT / 2, lo, hi, y0, y1);
}
// vitrage : cadre alu noir, meneaux, vantaux ; open = plages ouvertes (baie coulissante entrouverte, passage libre)
function glazing(axis, c, a0, a1, y0, y1, o = {}) {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1), L = hi - lo, bar = 0.06;
  const B = (u0, u1, v0, v1, key = 'frame', d = 0.09) => axis === 'x' ? box(key, u0, u1, v0, v1, c - d / 2, c + d / 2) : box(key, c - d / 2, c + d / 2, v0, v1, u0, u1);
  B(lo, hi, y0, y0 + bar); B(lo, hi, y1 - bar, y1); B(lo, lo + bar, y0, y1); B(hi - bar, hi, y0, y1);
  const n = o.mullions ?? Math.max(1, Math.round(L / 1.45)); for (let i = 1; i < n; i++) { const u = lo + L * i / n; B(u - 0.025, u + 0.025, y0, y1, 'frame', 0.08); }
  if (o.transom) B(lo, hi, o.transom - 0.03, o.transom + 0.03, 'frame', 0.08);
  let segs = [[lo + bar, hi - bar]]; for (const [oa, ob] of (o.open || [])) segs = segs.flatMap(([s0, s1]) => [[s0, Math.min(s1, oa)], [Math.max(s0, ob), s1]].filter(([p, q]) => q - p > 0.05));
  for (const [s0, s1] of segs) { B(s0, s1, y0 + bar, y1 - bar, 'glass', 0.02); axis === 'x' ? solid(s0, s1, c - 0.1, c + 0.1, y0, y1) : solid(c - 0.1, c + 0.1, s0, s1, y0, y1); }
  for (const [oa, ob] of (o.open || [])) { // vantail coulissé : verre doublé à côté de l'ouverture
    const w = ob - oa, s0 = ob, s1 = Math.min(hi - bar, ob + w); if (s1 - s0 > 0.1) B(s0, s1, y0 + bar, y1 - bar, 'glass', 0.02 + (axis === 'x' ? 0.06 : 0.06));
  }
}
function railing(axis, c, a0, a1, y, h = 1.1) { // garde-corps verre + main courante alu
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  if (axis === 'x') { box('railGlass', lo, hi, y + 0.05, y + h - 0.02, c - 0.012, c + 0.012); box('frame', lo, hi, y + h - 0.02, y + h + 0.03, c - 0.03, c + 0.03); solid(lo, hi, c - 0.08, c + 0.08, y, y + h); }
  else { box('railGlass', c - 0.012, c + 0.012, y + 0.05, y + h - 0.02, lo, hi); box('frame', c - 0.03, c + 0.03, y + h - 0.02, y + h + 0.03, lo, hi); solid(c - 0.08, c + 0.08, lo, hi, y, y + h); }
}
function ledRing(x0, x1, z0, z1, y, t = 0.04) { box('led', x0, x1, y, y + t, z0 - 0.015, z0); box('led', x0, x1, y, y + t, z1, z1 + 0.015); box('led', x0 - 0.015, x0, y, y + t, z0, z1); box('led', x1, x1 + 0.015, y, y + t, z0, z1); }
function pylon(x0, x1, z0, z1, y0, y1) { // pylône de marbre gris, lignes de bronze éclairées sur chaque face
  box('marbleG', x0, x1, y0, y1, z0, z1, true);
  const faces = [[x0, 'x', -1], [x1, 'x', 1], [z0, 'z', -1], [z1, 'z', 1]];
  for (const [c, ax, s] of faces) { const lo = ax === 'x' ? z0 : x0, hi = ax === 'x' ? z1 : x1, L = hi - lo; for (const f of [0.33, 0.67]) { const u = lo + L * f; if (ax === 'x') { box('bronze', c + (s > 0 ? 0 : -0.03), c + (s > 0 ? 0.03 : 0), y0 + 0.3, y1 - 0.25, u - 0.025, u + 0.025); box('led', c + (s > 0 ? 0.005 : -0.012), c + (s > 0 ? 0.012 : -0.005), y0 + 0.3, y1 - 0.25, u + 0.025, u + 0.04); } else { box('bronze', u - 0.025, u + 0.025, y0 + 0.3, y1 - 0.25, c + (s > 0 ? 0 : -0.03), c + (s > 0 ? 0.03 : 0)); box('led', u + 0.025, u + 0.04, y0 + 0.3, y1 - 0.25, c + (s > 0 ? 0.005 : -0.012), c + (s > 0 ? 0.012 : -0.005)); } } }
}
