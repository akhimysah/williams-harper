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
  marbleB: std({ map: T.marbleB, roughness: 0.22, metalness: 0.08, envMapIntensity: 0.7 }, 1.6),
  plaster: std({ map: T.plaster, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }, 3),
  ceiling: std({ map: T.plaster, roughness: 0.95, metalness: 0, emissive: '#5a524a', emissiveIntensity: 0.35 }, 3),
  tile: std({ map: T.tile, roughness: 0.45, metalness: 0.02, envMapIntensity: 0.6 }, 1.2),
  slats: std({ map: T.slats, roughness: 0.7, metalness: 0, envMapIntensity: 0.4 }, 1.0),
  fence: std({ map: T.fence, roughness: 0.8, metalness: 0 }, 1.0),
  walnut: std({ map: T.walnut, roughness: 0.5, metalness: 0.02, envMapIntensity: 0.6 }, 1.0),
  mosaic: std({ map: T.mosaic, roughness: 0.25, metalness: 0.05, envMapIntensity: 0.8 }, 0.6),
  lawn: std({ map: T.lawn, roughness: 1, metalness: 0 }, 3),
  pebble: std({ map: T.pebble, roughness: 0.85 }, 0.5),
  gravelD: std({ map: T.gravelD, roughness: 0.9 }, 0.7),
  paver: std({ map: T.paver, roughness: 0.8, metalness: 0.02 }, 1.5),
  curtain: std({ map: T.curtain, roughness: 1, metalness: 0, side: THREE.DoubleSide }, 1.0),
  woodBall: std({ map: T.slats, roughness: 0.6, metalness: 0 }, 0.22),
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
  flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.3, 0.03), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
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
  for (const tr of (o.transoms || (o.transom ? [o.transom] : []))) B(lo, hi, tr - 0.03, tr + 0.03, 'frame', 0.08);
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

// ---------------------------------------------------------------- mobilier et végétation
const PI = Math.PI;
function sofa(x, z, w, d, ry, key = 'fabric', h = 0.42) { // canapé droit : assise, dossier, accoudoirs, coussins
  const g = []; const add = (geo, lx, ly, lz) => { geo.applyMatrix4(mat4(lx, ly, lz)); g.push(geo); };
  add(new THREE.BoxGeometry(w, h - 0.1, d), 0, 0.1 + (h - 0.1) / 2, 0); add(new THREE.BoxGeometry(w, 0.45, 0.22), 0, h + 0.22, -d / 2 + 0.11);
  add(new THREE.BoxGeometry(0.22, 0.25, d), -w / 2 + 0.11, h + 0.12, 0); add(new THREE.BoxGeometry(0.22, 0.25, d), w / 2 - 0.11, h + 0.12, 0);
  const n = Math.max(1, Math.round((w - 0.5) / 0.85)); for (let i = 0; i < n; i++) { add(new THREE.BoxGeometry((w - 0.5) / n - 0.04, 0.12, d - 0.3), -(w - 0.5) / 2 + (w - 0.5) / n * (i + 0.5), h + 0.06, 0.04); add(new THREE.BoxGeometry((w - 0.5) / n - 0.16, 0.42, 0.14), -(w - 0.5) / 2 + (w - 0.5) / n * (i + 0.5), h + 0.36, -d / 2 + 0.3); }
  const geo = mergeGeometries(g.map(x => x.toNonIndexed())); put(key, geo, mat4(x, 0.15, z, 0, ry)); solid(x - w / 2 - 0.1, x + w / 2 + 0.1, z - d / 2 - 0.1, z + d / 2 + 0.1, 0, 1.0);
  cyl('frame', x - w / 2 + 0.2, 0.15, 0.25, z - d / 2 + 0.2, 0.02); cyl('frame', x + w / 2 - 0.2, 0.15, 0.25, z - d / 2 + 0.2, 0.02); cyl('frame', x - w / 2 + 0.2, 0.15, 0.25, z + d / 2 - 0.2, 0.02); cyl('frame', x + w / 2 - 0.2, 0.15, 0.25, z + d / 2 - 0.2, 0.02);
}
function ottoman(x, z, w, d, key, h = 0.42, y = 0.15) { box(key, x - w / 2, x + w / 2, y + 0.1, y + h, z - d / 2, z + d / 2, true); box('frame', x - w / 2 + 0.05, x + w / 2 - 0.05, y, y + 0.1, z - d / 2 + 0.05, z + d / 2 - 0.05); const n = Math.round(w / 0.42); for (let i = 1; i < n; i++) box('steelBk', x - w / 2 + w * i / n - 0.006, x - w / 2 + w * i / n + 0.006, y + h - 0.004, y + h + 0.004, z - d / 2 + 0.02, z + d / 2 - 0.02); }
function table(x, z, w, d, h, topKey, legKey = 'frame', y = 0.15, tt = 0.05) { box(topKey, x - w / 2, x + w / 2, y + h - tt, y + h, z - d / 2, z + d / 2); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(legKey, x + sx * (w / 2 - 0.08) - 0.025, x + sx * (w / 2 - 0.08) + 0.025, y, y + h - tt, z + sz * (d / 2 - 0.08) - 0.025, z + sz * (d / 2 - 0.08) + 0.025); solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h); }
function chair(x, z, ry, seatKey = 'fabricD', y = 0.15) { const g = []; const add = (geo, lx, ly, lz) => { geo.applyMatrix4(mat4(lx, ly, lz)); g.push(geo); }; add(new THREE.BoxGeometry(0.5, 0.06, 0.5), 0, 0.45, 0); add(new THREE.BoxGeometry(0.5, 0.45, 0.05), 0, 0.72, -0.22); put(seatKey, mergeGeometries(g.map(a => a.toNonIndexed())), mat4(x, y, z, 0, ry)); const f = []; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 6); c.applyMatrix4(mat4(sx * 0.22, 0.22, sz * 0.22)); f.push(c.toNonIndexed()); } put('frame', mergeGeometries(f), mat4(x, y, z, 0, ry)); }
// banquette / pouf capitonné à boudins (cuir vert, cognac, bouclé crème) ; back = dossier à boudins verticaux
function tufted(x, z, w, d, ry, key, h = 0.42, back = false, y = F0) {
  const g = []; const add = (geo, lx, ly, lz, rz = 0) => { geo.applyMatrix4(mat4(lx, ly, lz, 0, 0, rz)); g.push(geo.toNonIndexed()); };
  add(new THREE.BoxGeometry(w - 0.1, h - 0.3, d - 0.1), 0, 0.12 + (h - 0.3) / 2, 0);
  const r = 0.095, n = Math.max(2, Math.round(w / (r * 2.05))); for (let i = 0; i < n; i++) add(new THREE.CapsuleGeometry(r, d - 2 * r - 0.04, 3, 10), -w / 2 + r + 0.02 + i * (w - 2 * r - 0.04) / (n - 1), h - r, 0, PI / 2);
  if (back) { const m = Math.max(2, Math.round(w / (r * 2.05))); for (let i = 0; i < m; i++) { const c = new THREE.CapsuleGeometry(r, 0.42, 3, 10); c.applyMatrix4(mat4(-w / 2 + r + 0.02 + i * (w - 2 * r - 0.04) / (m - 1), h + 0.26, -d / 2 + r + 0.02)); g.push(c.toNonIndexed()); } }
  put(key, mergeGeometries(g), mat4(x, y, z, 0, ry)); box('frame', x - w / 2 + 0.06, x + w / 2 - 0.06, y, y + 0.12, z - d / 2 + 0.06, z + d / 2 - 0.06);
  const c_ = Math.cos(ry), s_ = Math.sin(ry), ex = Math.abs(c_) * w / 2 + Math.abs(s_) * d / 2, ez = Math.abs(s_) * w / 2 + Math.abs(c_) * d / 2; solid(x - ex, x + ex, z - ez, z + ez, y, y + h + 0.3);
}
// fauteuil tressé cuir vert sur piètement noyer
function armchair(x, z, ry, y = F0) { const g = (key, geo, lx, ly, lz, r = [0, 0, 0]) => put(key, geo, mat4(x, y, z, 0, ry).multiply(mat4(lx, ly, lz, r[0], r[1], r[2])));
  g('leatherG', new THREE.BoxGeometry(0.62, 0.1, 0.6), 0, 0.42, 0.02); g('leatherG', new THREE.BoxGeometry(0.62, 0.62, 0.08), 0, 0.78, -0.3, [-0.12, 0, 0]);
  for (const sx of [-1, 1]) { g('walnut', new THREE.BoxGeometry(0.05, 0.05, 0.66), sx * 0.33, 0.62, 0); g('walnut', new THREE.BoxGeometry(0.05, 0.64, 0.05), sx * 0.33, 0.32, 0.3); g('walnut', new THREE.BoxGeometry(0.05, 1.05, 0.05), sx * 0.33, 0.52, -0.3, [-0.12, 0, 0]); }
  solid(x - 0.4, x + 0.4, z - 0.4, z + 0.4, y, y + 1.0); }
// lampe à poser noire en dôme, lampadaire fin noir à tête inclinée
function domeLamp(x, y, z, r = 0.16) { put('jar', new THREE.SphereGeometry(r, 18, 10, 0, PI * 2, 0, PI * 0.5), mat4(x, y + 0.22, z)); cyl('frame', x, y, y + 0.22, z, 0.012, 0.012, 6); cyl('jar', x, y, y + 0.015, z, r * 0.55, r * 0.55, 16); put('bulb', new THREE.SphereGeometry(r * 0.5, 10, 8), mat4(x, y + 0.2, z)); }
function floorLamp(x, z, ry, y = F0, h = 2.3) { put('frame', new THREE.CylinderGeometry(0.16, 0.16, 0.025, 16), mat4(x, y + 0.012, z)); put('frame', new THREE.CylinderGeometry(0.011, 0.011, h, 6), mat4(x, y + h / 2, z, 0, 0, 0.03)); put('frame', new THREE.CylinderGeometry(0.11, 0.07, 0.18, 14), mat4(x + Math.sin(ry) * 0.2, y + h - 0.02, z + Math.cos(ry) * 0.2, 0.5, ry, 0)); put('bulb', new THREE.SphereGeometry(0.035, 8, 6), mat4(x + Math.sin(ry) * 0.24, y + h - 0.1, z + Math.cos(ry) * 0.24)); }
// rideau en plis : ruban sinusoïdal du sol au plafond
function curtain(axis, c, a0, a1, y0, y1, amp = 0.07, period = 0.34) {
  const lo = Math.min(a0, a1), hi = Math.max(a0, a1), N = Math.max(8, Math.round((hi - lo) / 0.04)); const pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const u = lo + (hi - lo) * i / N, v = c + amp * Math.sin(u / period * PI * 2); const p0 = axis === 'x' ? [u, y0, v] : [v, y0, u], p1 = axis === 'x' ? [u, y1, v] : [v, y1, u]; pos.push(...p0, ...p1); if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); put('curtain', geo, null);
  const rail = axis === 'x' ? box('frame', lo, hi, y1, y1 + 0.03, c - 0.02, c + 0.02) : box('frame', c - 0.02, c + 0.02, y1, y1 + 0.03, lo, hi);
}
function bed(x, z, ry, w = 2.0, l = 2.2) { const g = (key, geo, lx, ly, lz) => put(key, geo, mat4(x, 0, z, 0, ry).multiply(mat4(lx, ly, lz)));
  g('walnut', new THREE.BoxGeometry(w + 0.2, 0.25, l + 0.1), 0, 4.33, 0); g('linen', new THREE.BoxGeometry(w, 0.28, l - 0.15), 0, 4.6, 0.05); g('fabricD', new THREE.BoxGeometry(w, 0.12, 0.9), 0, 4.8, 0.55);
  g('walnut', new THREE.BoxGeometry(w + 0.6, 1.2, 0.08), 0, 4.8, -l / 2 - 0.02); g('linen', new THREE.BoxGeometry(w / 2 - 0.15, 0.16, 0.45), -w / 4, 4.82, -l / 2 + 0.35); g('linen', new THREE.BoxGeometry(w / 2 - 0.15, 0.16, 0.45), w / 4, 4.82, -l / 2 + 0.35);
  g('walnut', new THREE.BoxGeometry(0.5, 0.45, 0.45), -w / 2 - 0.45, 4.42, -l / 2 + 0.3); g('walnut', new THREE.BoxGeometry(0.5, 0.45, 0.45), w / 2 + 0.45, 4.42, -l / 2 + 0.3);
  g('bulb', new THREE.SphereGeometry(0.1, 10, 8), -w / 2 - 0.45, 4.85, -l / 2 + 0.3); g('bulb', new THREE.SphereGeometry(0.1, 10, 8), w / 2 + 0.45, 4.85, -l / 2 + 0.3);
  const c = Math.cos(ry), s = Math.sin(ry), hw = (w + 1.4) / 2, hl = (l + 0.2) / 2, ex = Math.abs(c) * hw + Math.abs(s) * hl, ez = Math.abs(s) * hw + Math.abs(c) * hl; solid(x - ex, x + ex, z - ez, z + ez, 4.2, 5.2); }
function wardrobe(x0, x1, z0, z1, y = 4.2) { box('walnut', x0, x1, y, y + 2.6, z0, z1, true); const along = (x1 - x0) > (z1 - z0); const n = Math.round((along ? x1 - x0 : z1 - z0) / 0.6); for (let i = 1; i < n; i++) { if (along) box('steelBk', x0 + (x1 - x0) * i / n - 0.005, x0 + (x1 - x0) * i / n + 0.005, y + 0.05, y + 2.55, z0 - 0.004, z1 + 0.004); else box('steelBk', x0 - 0.004, x1 + 0.004, y + 0.05, y + 2.55, z0 + (z1 - z0) * i / n - 0.005, z0 + (z1 - z0) * i / n + 0.005); } box('led', x0, x1, y + 2.6, y + 2.62, z0 - 0.02, z0); }
function plant(x, z, y, s = 1, n = 7) { cyl('pot', x, y, y + 0.5 * s, z, 0.22 * s, 0.18 * s, 14); cyl('trunk', x, y + 0.5 * s, y + 0.9 * s, z, 0.03 * s); for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + rnd(), r = 0.5 * s + rnd() * 0.3 * s, h = 1.0 * s + rnd() * 0.8 * s; put('palm', new THREE.SphereGeometry(0.11 * s, 6, 5), mat4(x + Math.cos(a) * r * 0.5, y + 0.6 * s + h * 0.55, z + Math.sin(a) * r * 0.5, 0, -a, -0.9, 1, h / (0.11 * s) * 0.5, 0.5)); } }
function topiary(x, z, r, y = 0) { cyl('trunk', x, y, y + r * 0.5, z, 0.05 * r + 0.02, 0.06 * r + 0.02, 7); sph(rnd() < 0.5 ? 'leaf' : 'leaf2', x, y + r * 0.95, z, r, 2, 0.92); solid(x - r * 0.8, x + r * 0.8, z - r * 0.8, z + r * 0.8, y, y + r * 2); }
function palmTree(x, z, h) { const g = []; const seg = 7; for (let i = 0; i < seg; i++) { const c = new THREE.CylinderGeometry(0.16 - i * 0.012, 0.19 - i * 0.012, h / seg + 0.05, 9); c.applyMatrix4(mat4((rnd() - 0.5) * 0.08, h / seg * (i + 0.5), (rnd() - 0.5) * 0.08)); g.push(c.toNonIndexed()); } put('trunk', mergeGeometries(g), mat4(x, 0, z)); solid(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 0, h);
  const fr = []; for (let k = 0; k < 11; k++) { const a = k / 11 * PI * 2 + rnd() * 0.4, tilt = 0.55 + rnd() * 0.5; const f = new THREE.ConeGeometry(0.32, 3.0 + rnd(), 4, 1); f.applyMatrix4(new THREE.Matrix4().makeRotationX(PI / 2)); f.applyMatrix4(new THREE.Matrix4().makeRotationX(-tilt)); f.applyMatrix4(new THREE.Matrix4().makeRotationY(-a)); f.applyMatrix4(mat4(Math.cos(a) * 0.9, h + 0.25, Math.sin(a) * 0.9)); fr.push(f.toNonIndexed()); } put('palm', mergeGeometries(fr), mat4(x, 0, z)); }
function pineTree(x, z, h) { cyl('trunk', x, 0, h * 0.45, z, 0.14, 0.22, 8, true); for (let i = 0; i < 4; i++) { const y = h * 0.35 + i * h * 0.17, r = (2.4 - i * 0.45) * (h / 11); put('pine', new THREE.ConeGeometry(r, h * 0.32, 9), mat4(x, y + h * 0.16, z, 0, rnd() * 3)); } }
function jar(x, z, r, h, y = 0) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.35 + 0.65 * Math.sin(t * PI) * (1 - 0.2 * t)) + 0.02, t * h)); } put('jar', new THREE.LatheGeometry(pts, 24), mat4(x, y, z)); solid(x - r, x + r, z - r, z + r, y, y + h); }
function rock(x, z, r, y = 0, key = 'rock') { put(key, new THREE.IcosahedronGeometry(r, 1), mat4(x, y + r * 0.45, z, rnd(), rnd() * 6, rnd() * 0.4, 1.4, 0.75, 1)); solid(x - r, x + r, z - r, z + r, y, y + r); }
function waterMirror(x, z, rx, rz, y = 0) { // miroir d'eau noir surélevé, liseré LED sous la vasque
  put('mirror', new THREE.CylinderGeometry(1, 0.9, 0.25, 36), mat4(x, y + 0.42, z, 0, rnd() * 3, 0, rx, 1, rz)); put('jar', new THREE.CylinderGeometry(0.55, 0.5, 0.32, 20), mat4(x, y + 0.16, z, 0, 0, 0, rx * 0.6, 1, rz * 0.6)); put('led', new THREE.CylinderGeometry(0.98, 0.98, 0.02, 36), mat4(x, y + 0.3, z, 0, 0, 0, rx, 1, rz)); solid(x - rx, x + rx, z - rz, z + rz, y, y + 0.6); }
function crane(x, z, ry, s = 1) { const g = (key, geo, lx, ly, lz, r = [0, 0, 0]) => put(key, geo, mat4(x, 0, z, 0, ry).multiply(mat4(lx, ly, lz, r[0], r[1], r[2]))); g('gold', new THREE.CylinderGeometry(0.012, 0.012, 0.9 * s, 6), 0.08 * s, 0.45 * s, 0); g('gold', new THREE.CylinderGeometry(0.012, 0.012, 0.9 * s, 6), -0.08 * s, 0.45 * s, 0.03); g('gold', new THREE.SphereGeometry(0.2 * s, 12, 9), 0, 1.0 * s, 0, [0, 0, 0]); const neck = new THREE.CatmullRomCurve3([V(0, 1.1 * s, 0.1 * s), V(0.02 * s, 1.5 * s, 0.35 * s), V(0, 1.75 * s, 0.6 * s), V(0, 1.6 * s, 0.9 * s), V(0, 1.4 * s, 1.1 * s)]); g('gold', new THREE.TubeGeometry(neck, 20, 0.04 * s, 7), 0, 0, 0); g('gold', new THREE.ConeGeometry(0.035 * s, 0.35 * s, 7), 0, 1.3 * s, 1.28 * s, [PI / 2 + 0.3, 0, 0]); g('gold', new THREE.CylinderGeometry(0.25 * s, 0.25 * s, 0.02, 16), 0, 0.01, 0); }

// ---------------------------------------------------------------- le terrain
const PLOT = { x0: -13, x1: 20.5, z0: -16.5, z1: 20.5 };
put('lawn', new THREE.PlaneGeometry(PLOT.x1 - PLOT.x0, PLOT.z1 - PLOT.z0).rotateX(-PI / 2), mat4((PLOT.x0 + PLOT.x1) / 2, -0.01, (PLOT.z0 + PLOT.z1) / 2));
floor(PLOT.x0, PLOT.x1, PLOT.z0, PLOT.z1, 0);
put('lawn', new THREE.PlaneGeometry(900, 900).rotateX(-PI / 2), mat4(0, -0.03, 0)); // au-delà : pelouse à perte de vue
box('asphalt', PLOT.x0 - 9, PLOT.x0 - 0.6, -0.02, 0.0, -80, 80); box('paver', PLOT.x0 - 0.6, PLOT.x0, -0.02, 0.12, -80, 80); // la rue à l'ouest, bordure
{ // clôture en lames de bois sur muret de pierre, ouvertures : portail piéton au sud, accès voitures à l'ouest
  const run = (axis, c, a0, a1) => { const lo = Math.min(a0, a1), hi = Math.max(a0, a1); if (hi - lo < 0.1) return; if (axis === 'x') { box('stone', lo, hi, 0, 0.5, c - 0.15, c + 0.15, true); for (let u = lo; u < hi; u += 0.13) box('fence', u, u + 0.07, 0.5, 1.95, c - 0.03, c + 0.03); box('frame', lo, hi, 1.95, 2.0, c - 0.04, c + 0.04); solid(lo, hi, c - 0.1, c + 0.1, 0, 2.1); } else { box('stone', c - 0.15, c + 0.15, 0, 0.5, lo, hi, true); for (let u = lo; u < hi; u += 0.13) box('fence', c - 0.03, c + 0.03, 0.5, 1.95, u, u + 0.07); box('frame', c - 0.04, c + 0.04, 1.95, 2.0, lo, hi); solid(c - 0.1, c + 0.1, lo, hi, 0, 2.1); } };
  run('x', PLOT.z0, PLOT.x0, PLOT.x1); run('x', PLOT.z1, PLOT.x0, -6.4); run('x', PLOT.z1, -2.6, PLOT.x1); run('z', PLOT.x1, PLOT.z0, PLOT.z1); run('z', PLOT.x0, PLOT.z0, -13.6); run('z', PLOT.x0, -4.6, PLOT.z1);
  for (const [x, z] of [[-6.4, PLOT.z1], [-2.6, PLOT.z1], [PLOT.x0, -13.6], [PLOT.x0, -4.6]]) { box('marbleB', x - 0.25, x + 0.25, 0, 2.3, z - 0.25, z + 0.25, true); box('led', x - 0.26, x + 0.26, 2.3, 2.34, z - 0.26, z + 0.26); }
}
// carport (dalle de pavés), allée piétonne en pas japonais vers l'entrée, sentier latéral depuis la rue
box('paver', -12.6, -6.9, 0, 0.1, -13.3, -3.2); floor(-12.6, -6.9, -13.3, -3.2, 0.1);
box('gravelD', -12.6, -6.9, 0, 0.06, -3.2, 5.7);
for (let i = 0; i < 14; i++) { const t = i / 13; const x = -4.5 + Math.sin(t * 3.2) * 1.2, z = 19.3 - t * 8.4; put('paver', new THREE.CylinderGeometry(0.5, 0.5, 0.08, 9), mat4(x, 0.04, z, 0, rnd() * 3)); }
for (let i = 0; i < 9; i++) put('paver', new THREE.CylinderGeometry(0.45, 0.45, 0.08, 9), mat4(-9.2 + i * 0.02, 0.04, -2.4 + i * 1.05, 0, rnd() * 3));
// jardin sud : miroirs d'eau noirs, bassin aux rochers sculptés, topiaires, jarres, galets sombres
waterMirror(2.0, 14.2, 1.9, 1.35); waterMirror(-0.6, 16.6, 1.3, 1.0); box('gravelD', -2.5, 4.5, 0, 0.05, 12.4, 18.4);
{ const x0 = 7.0, x1 = 12.2, z0 = 12.6, z1 = 15.8; box('marbleB', x0, x1, 0, 0.45, z0, z1, true); put('waterDark', new THREE.PlaneGeometry(x1 - x0 - 0.3, z1 - z0 - 0.3).rotateX(-PI / 2), mat4((x0 + x1) / 2, 0.42, (z0 + z1) / 2)); box('gravelD', x0 - 1.2, x1 + 1.2, 0, 0.06, z0 - 1.2, z1 + 1.2);
  put('rockD', new THREE.IcosahedronGeometry(1, 1), mat4(8.7, 1.9, 14.2, 0.1, 0.4, 0.15, 0.7, 1.5, 0.35)); put('rockD', new THREE.IcosahedronGeometry(1, 1), mat4(10.4, 1.8, 14.2, -0.1, -0.5, -0.1, 0.65, 1.45, 0.35));
  box('marbleB', x0 + 1.0, x1 - 1.0, 0.45, 0.6, z1 - 0.3, z1); put('fall', new THREE.PlaneGeometry(x1 - x0 - 2.0, 0.55), mat4((x0 + x1) / 2, 0.3, z1 + 0.02)); box('marbleB', x0 + 0.8, x1 - 0.8, 0, 0.08, z1, z1 + 1.1); }
for (const [x, z, r] of [[-8.6, 13.4, 0.9], [-7.4, 15.2, 0.65], [-9.8, 15.6, 0.5], [-6.2, 17.8, 0.75], [4.9, 17.6, 0.8], [6.3, 18.6, 0.55], [13.6, 16.2, 1.0], [15.4, 14.4, 0.6], [-9.5, 10.4, 0.55], [-11.2, 12.8, 0.7], [16.8, 18.2, 0.8], [-1.8, 11.4, 0.45], [5.2, 11.6, 0.4]]) topiary(x, z, r);
for (const [x, z, r] of [[-11.5, 17.2, 0.55], [-3.8, 12.2, 0.4], [16.5, 12.0, 0.5], [18.6, 15.2, 0.6], [-10.4, 7.0, 0.5], [-10.8, -0.6, 0.6], [18.8, -8.0, 0.55], [18.4, -14.0, 0.7]]) { sph('leaf2', x, r * 0.6, z, r, 1, 0.6); }
jar(-6.8, 12.1, 0.55, 1.1); jar(14.2, 11.4, 0.6, 1.2); jar(-10.3, 4.2, 0.45, 0.9);
rock(-9.4, 17.9, 0.6); rock(14.6, 18.6, 0.5); rock(-1.0, 12.6, 0.45, 0, 'rockD'); rock(6.0, 11.4, 0.35, 0, 'rockD');
// pelouse est : hérons dorés, vasque noire, massifs
crane(16.2, 3.0, -2.2, 1.0); crane(17.4, 4.4, -2.6, 0.85); { const x = 16.4, z = 8.2; put('jar', new THREE.CylinderGeometry(2.2, 2.0, 0.45, 40), mat4(x, 0.22, z)); put('waterDark', new THREE.CylinderGeometry(2.05, 2.05, 0.02, 40), mat4(x, 0.44, z)); solid(x - 2.2, x + 2.2, z - 2.2, z + 2.2, 0, 0.5); }
for (const [x, z, r] of [[15.0, -1.2, 0.5], [18.0, 0.4, 0.6], [15.8, 11.6, 0.45], [19.0, 9.2, 0.4]]) sph('leaf', x, r * 0.55, z, r, 1, 0.55);
// grands sujets : palmiers, pins ; au-delà de la clôture, un rideau d'arbres ; au loin, l'Atlas
for (const [x, z, h] of [[-9.6, 12.0, 7.5], [-10.8, 16.0, 6.2], [10.2, 17.4, 8.0], [13.4, 12.8, 6.6], [17.6, 16.4, 7.2], [-10.2, -15.2, 7], [15.8, -14.4, 6.5], [18.4, -5.6, 7.4], [-11.8, 6.4, 5.6]]) palmTree(x, z, h);
for (const [x, z, h] of [[-11.6, -8.2, 12], [18.2, 13.2, 11], [-11.9, 19.3, 10], [19.0, -11.0, 12.5]]) pineTree(x, z, h);
for (let i = 0; i < 46; i++) { const a = i / 46 * PI * 2, r = 32 + rnd() * 18; const x = 3 + Math.cos(a) * r, z = 2 + Math.sin(a) * r; if (x < PLOT.x0 - 10 && Math.abs(z) < 26) continue; rnd() < 0.55 ? pineTree(x, z, 9 + rnd() * 6) : palmTree(x, z, 6 + rnd() * 4); }
for (let i = 0; i < 16; i++) { const a = -0.3 + i * 0.16, r = 300 + rnd() * 60, h = 45 + rnd() * 45; put('mountain', new THREE.ConeGeometry(h * 1.9, h, 7), mat4(Math.cos(a) * r, h / 2 - 4, -Math.abs(Math.sin(a)) * r - 120, 0, rnd() * 3)); }

// ---------------------------------------------------------------- la villa : niveaux
const F0 = 0.15, Y1 = 3.9, SL = 4.2, Y2 = 7.7;
// dalles RDC : carrelage grand format à l'intérieur, marbre clair sur les terrasses
for (const [x0, x1, z0, z1] of [[-6.9, 8.5, -13.4, -4.26], [-6.9, 2.66, -4.26, 5.7], [-2.66, 4.26, 5.7, 10.1], [2.66, 4.26, 2.66, 5.7]]) { box('tile', x0, x1, 0, F0, z0, z1); floor(x0, x1, z0, z1, F0); }
for (const [x0, x1, z0, z1] of [[2.66, 4.5, -4.26, 2.66], [4.26, 8.5, 1.6, 10.6], [8.5, 10.2, -14.0, -4.26], [-7.3, -2.66, 5.7, 10.6], [4.5, 13.6, -4.26, -3.06], [12.5, 13.6, -3.06, 10.0], [8.0, 13.6, 10.0, 11.2], [-7.3, -2.66, 10.6, 11.4]]) { box('marbleW', x0, x1, 0, 0.17, z0, z1); floor(x0, x1, z0, z1, 0.17); }
box('marbleW', -8.0, -2.66, 0, 0.12, 11.4, 12.2); // marche d'entrée
// bassin à débordement en mosaïque (bras ouest + grand bassin est), LED immergées, trop-plein à l'est
box('mosaic', 4.5, 12.5, -1.6, -1.5, -3.06, 10.0);
for (const [x0, x1, z0, z1] of [[4.5, 12.5, -3.26, -3.06], [4.3, 4.5, -3.06, 1.6], [4.5, 8.0, 1.6, 1.8], [7.8, 8.0, 1.6, 10.0], [8.0, 12.5, 10.0, 10.2], [12.5, 12.7, -3.06, 10.0]]) box('mosaic', x0, x1, -1.6, 0.17, z0, z1);
box('led', 4.6, 12.4, -0.45, -0.41, -3.06, -3.04); box('led', 12.48, 12.5, -0.45, -0.41, -3.0, 9.9); box('led', 4.52, 4.54, -0.45, -0.41, -3.0, 1.5);
put('water', new THREE.PlaneGeometry(3.5, 4.66).rotateX(-PI / 2), mat4(6.25, 0.08, -0.73)); put('water', new THREE.PlaneGeometry(4.5, 13.06).rotateX(-PI / 2), mat4(10.25, 0.08, 3.47));
solid(4.3, 12.7, -3.26, 1.8, -1.6, 0.3); solid(7.8, 12.7, 1.6, 10.2, -1.6, 0.3);
box('marbleB', 12.5, 13.6, -0.35, -0.3, -3.06, 10.0); put('fall', new THREE.PlaneGeometry(13.0, 0.4).rotateY(PI / 2), mat4(12.52, -0.12, 3.47)); box('marbleB', 13.6, 13.75, -0.35, 0.17, -3.06, 10.0);
// marches de descente dans le bassin (bras ouest), nez de marche LED
for (let i = 0; i < 3; i++) { const z1 = 1.6 - i * 0.6, z0 = z1 - 0.6, y = 0.17 - 0.3 * (i + 1); box('marbleW', 4.5, 8.0, -1.5, y, z0, z1); box('led', 4.55, 7.95, y - 0.02, y, z0 - 0.015, z0); }
// RDC — murs extérieurs (pierre anthracite) et vitrages
wall('z', -6.7, -13.4, 5.7, F0, Y1, -1); wall('x', -13.4, -6.7, -2.13, F0, Y1, -1); wall('z', -2.13, -13.4, -12.0, F0, Y1, -1);
wall('x', -12.0, -2.13, 3.2, F0, Y1, -1); glazing('x', -12.0, 3.2, 8.5, F0, Y1, { open: [[5.0, 6.1]], transoms: [1.4, 2.6], mullions: 5 });
wall('z', 8.5, -12.0, -10.5, F0, Y1, 1); glazing('z', 8.5, -10.5, -4.26, F0, Y1, { open: [[-7.4, -6.3]], transoms: [1.4, 2.6], mullions: 5 });
glazing('x', -4.26, 2.66, 8.5, F0, Y1, { open: [[3.0, 4.1]] });
glazing('z', 2.66, -4.26, 2.66, F0, Y2, { transom: Y1 + 0.15, open: [[0.3, 1.4]], mullions: 5 });
wall('x', 2.66, 2.66, 4.26, F0, Y1, -1); glazing('z', 4.26, 2.66, 10.1, F0, Y1, { open: [[4.2, 5.3]] });
glazing('x', 10.1, 0.1, 3.2, F0, Y1, {}); wall('x', 10.1, -2.66, 0.1, F0, Y1, 1); wall('x', 10.1, 3.2, 4.26, F0, Y1, 1);
wall('z', -2.66, 5.7, 10.1, F0, Y1, -1);
wall('x', 5.7, -6.7, -5.1, F0, Y1, 1); wall('x', 5.7, -4.1, -2.66, F0, Y1, 1); // porte d'entrée en noyer, entrouverte
box('frame', -5.18, -5.1, F0, 2.95, 5.52, 5.88); box('frame', -4.1, -4.02, F0, 2.95, 5.52, 5.88); box('frame', -5.18, -4.02, 2.88, 2.95, 5.52, 5.88); box('walnut', -5.12, -5.04, F0, 2.85, 4.72, 5.68, true); box('bronze', -5.14, -5.02, 0.9, 2.1, 5.5, 5.54);
// RDC — cloisons intérieures
wall('x', -8.0, -6.7, -4.0, F0, Y1); wall('z', -2.13, -12.0, -8.0, F0, Y1); // cuisine fermée au sud (sauf passage x -4..-2.4) et à l'est
wall('x', -8.0, -2.13, 0.7, F0, Y1); wall('x', -8.0, 1.7, 2.66, F0, Y1); wall('z', 2.66, -12.0, -8.0, F0, Y1); // local de service, porte ouverte
wall('z', -4.0, -8.0, -4.26, F0, Y1); wall('x', -4.26, -6.7, -4.0, F0, Y1); // WC / lave-mains
for (const [z0, z1] of [[-7.5, -6.6], [-5.6, -4.7]]) { box('walnut', -4.15, -4.11, F0, 2.4, z0, z1); box('bronze', -4.1, -4.08, 1.0, 1.1, z1 - 0.15, z1 - 0.1); }
// étage — dalle (pierre en rive, lames de bois dessous à l'extérieur, plâtre dans les pièces)
for (const [x0, x1, z0, z1] of [[-7.45, 9.2, -13.4, -3.7], [-6.9, -1.6, -3.7, 2.1], [-6.9, 7.3, 1.6, 10.1]]) { box('stone', x0, x1, Y1 + 0.03, SL, z0, z1); box('slats', x0 + 0.02, x1 - 0.02, Y1, Y1 + 0.03, z0 + 0.02, z1 - 0.02); }
for (const [x0, x1, z0, z1] of [[-6.6, 8.3, -13.2, -4.4], [-6.6, 2.5, -4.4, 2.5], [-2.5, 4.1, 2.5, 9.9]]) box('ceiling', x0, x1, Y1 - 0.03, Y1, z0, z1);
box('stone', -7.45, 9.2, Y1 - 0.5, Y1 + 0.03, -13.4, -3.7); box('stone', -6.9, 7.3, Y1 - 0.5, Y1 + 0.03, 1.6, 10.1); // bandeau profond en rive
ledRing(-7.45, 9.2, -13.4, -3.7, Y1 - 0.3); ledRing(-6.9, 7.3, 1.6, 10.1, Y1 - 0.3);
for (const [x0, x1, z0, z1] of [[-7.45, 7.7, -13.4, -3.7], [-6.9, 3.7, 1.6, 10.1], [-6.4, -1.6, -3.7, 2.1]]) { box('tile', x0, x1, SL, SL + 0.02, z0, z1); floor(x0, x1, z0, z1, SL + 0.02); }
for (const [x0, x1, z0, z1] of [[-3.06, 9.2, -13.4, -12.1], [7.7, 9.2, -12.1, -3.7], [3.7, 7.3, 1.6, 10.1]]) { box('marbleW', x0, x1, SL, SL + 0.03, z0, z1); floor(x0, x1, z0, z1, SL + 0.03); }
// escalier droit en marbre le long du mur ouest (montée vers le nord), contremarches LED, joue de marbre côté hall
{ const N = 21, rise = (SL + 0.02 - F0) / N, tread = 5.8 / N; for (let i = 0; i < N; i++) { const z1 = 2.5 - i * tread, z0 = z1 - tread, y = F0 + rise * (i + 1); box('marbleW', -6.4, -5.0, y - rise, y, z0, z1); box('led', -6.35, -5.05, y - 0.03, y - 0.01, z1 - 0.012, z1); box('marbleG', -5.05, -4.95, F0, Math.min(Y2 - 0.3, y + 1.05), z0, z1); }
  solid(-5.08, -4.92, -3.3, 2.5, F0, Y2); floor(-6.4, -5.0, -3.4, 2.5, 0, (x, z) => F0 + (SL + 0.02 - F0) * clamp((2.5 - z) / 5.8, 0, 1)); }
railing('z', -1.6, -3.7, 1.6, SL + 0.02, 1.1); // passerelle sur le vide
for (let x = -1.5; x < 2.6; x += 0.12) box('steelBk', x, x + 0.05, SL + 0.1, Y2 - 0.1, 1.38, 1.45); box('led', -1.5, 2.6, SL + 0.08, SL + 0.1, 1.4, 1.44);
// étage — murs extérieurs et vitrages
wall('z', -7.45, -13.4, -3.7, SL, Y2, -1); wall('x', -13.4, -7.45, -3.06, SL, Y2, -1); wall('z', -3.06, -13.4, -12.1, SL, Y2, -1);
wall('x', -12.1, -3.06, -2.6, SL, Y2, -1); glazing('x', -12.1, -2.6, 7.3, SL, Y2, { open: [[0.2, 1.3]] }); wall('x', -12.1, 7.3, 7.7, SL, Y2, -1);
wall('z', 7.7, -12.1, -11.6, SL, Y2, 1); glazing('z', 7.7, -11.6, -5.0, SL, Y2, { open: [[-7.2, -6.1]] }); wall('z', 7.7, -5.0, -4.5, SL, Y2, 1);
glazing('x', -4.5, 2.66, 7.7, SL, Y2, {}); wall('x', -3.7, -7.45, 2.66, SL, Y2, 1); wall('z', 2.66, -4.5, -3.7, SL, Y2, 1);
wall('z', -6.9, 1.6, 10.1, SL, Y2, -1); wall('x', 10.1, -6.9, -0.5, SL, Y2, 1); glazing('x', 10.1, -0.5, 2.0, SL, Y2, {}); wall('x', 10.1, 2.0, 3.7, SL, Y2, 1);
wall('z', 3.7, 9.7, 10.1, SL, Y2, 1); glazing('z', 3.7, 2.0, 9.7, SL, Y2, { open: [[5.0, 6.1]] }); wall('z', 3.7, 1.6, 2.0, SL, Y2, 1);
wall('x', 1.6, -6.9, -3.06, SL, Y2, -1); wall('x', 1.6, -1.6, 3.7, SL, Y2, -1);
railing('x', -13.4, -3.06, 9.2, SL + 0.03); railing('z', 9.2, -13.4, -3.7, SL + 0.03); railing('z', 7.3, 1.6, 10.1, SL + 0.03); railing('x', 10.1, 3.7, 7.3, SL + 0.03);
// étage — cloisons : couloir, trois chambres et leurs bains, suite parentale (bain + dressing)
wall('x', -5.2, -7.45, -6.5, SL, Y2); wall('x', -5.2, -5.5, -1.5, SL, Y2); wall('x', -5.2, -0.5, 2.0, SL, Y2);
wall('z', -3.06, -13.4, -5.2, SL, Y2); wall('z', 2.0, -12.1, -4.6, SL, Y2);
wall('z', -4.3, -7.5, -6.5, SL, Y2); wall('x', -7.5, -7.45, -4.3, SL, Y2); wall('z', -4.3, -5.6, -5.2, SL, Y2);
wall('x', -9.8, -1.5, 0.0, SL, Y2); wall('x', -9.8, 0.9, 2.0, SL, Y2); wall('z', -1.5, -12.1, -9.8, SL, Y2);
wall('x', -9.8, 2.0, 4.6, SL, Y2); wall('z', 4.6, -12.1, -10.6, SL, Y2);
wall('z', -4.0, 1.6, 3.5, SL, Y2); wall('z', -4.0, 4.4, 5.0, SL, Y2); wall('x', 5.0, -6.9, -4.0, SL, Y2);
// toitures : dalle profonde en pierre, sous-face en lames de bois, plafonds plâtre dans les pièces, ligne LED en façade, gravillon sombre dessus
const roofs = [[-7.85, 9.7, -14.0, -3.6, Y2, 9.3], [-6.9, 2.9, -3.6, 1.5, Y2, 8.5], [-7.3, 7.7, 1.5, 10.6, Y2, 8.7]];
for (const [x0, x1, z0, z1, y0, y1] of roofs) { box('stone', x0, x1, y0 + 0.03, y1, z0, z1); box('slats', x0 + 0.02, x1 - 0.02, y0, y0 + 0.03, z0 + 0.02, z1 - 0.02); box('gravelD', x0 + 0.25, x1 - 0.25, y1, y1 + 0.03, z0 + 0.25, z1 - 0.25); ledRing(x0, x1, z0, z1, y0 + 0.28, 0.045); ledRing(x0, x1, z0, z1, y1 - 0.35, 0.03); }
for (const [x0, x1, z0, z1] of [[-7.3, 7.55, -13.25, -3.85], [-6.75, 3.55, 1.75, 9.95]]) box('ceiling', x0, x1, Y2 - 0.03, Y2, z0, z1);
// pylônes de marbre gris (lames de bronze éclairées), lames d'eau en bronze sur le pylône du bassin
pylon(6.9, 8.0, 1.8, 4.8, 0, 8.7); pylon(6.9, 8.0, 9.4, 10.6, 0, 8.7); pylon(8.9, 9.84, -14.0, -9.6, 0, 9.3); pylon(8.9, 9.84, -5.0, -3.9, 0, 9.3); pylon(-7.3, -6.3, 9.5, 10.6, 0, 8.7); pylon(-7.3, -6.3, 5.6, 6.6, 0, 8.7);
for (const z of [2.4, 3.3, 4.2]) { box('bronze', 8.0, 8.1, 0.2, 6.2, z - 0.09, z + 0.09); box('bronze', 8.0, 8.2, 6.0, 6.2, z - 0.12, z + 0.12); put('fall', new THREE.PlaneGeometry(0.12, 6.0).rotateY(PI / 2), mat4(8.14, 3.1, z)); }
// panneau de claustra en bois (motif ondulé) sur la façade ouest, côté rue, et verrière du couloir
box('lattice', -6.78, -6.72, SL + 0.4, Y2 - 0.4, -11.6, -5.4); box('led', -6.75, -6.73, SL + 0.4, Y2 - 0.4, -11.62, -11.6); box('led', -6.75, -6.73, SL + 0.4, Y2 - 0.4, -5.4, -5.38);
glazing('z', -6.7, -2.0, 1.5, SL + 0.9, Y2 - 0.9, { mullions: 2 });

// ---------------------------------------------------------------- intérieurs
// cuisine : îlot en marbre noir, plan de travail et colonnes en noyer, LED sous les meubles hauts
box('walnut', -6.55, -2.3, F0, 0.95, -13.25, -12.6, true); box('marbleB', -6.6, -2.25, 0.95, 1.0, -13.3, -12.55); box('walnut', -6.55, -2.3, 2.2, 3.0, -13.25, -12.9); box('led', -6.5, -2.35, 2.19, 2.21, -12.92, -12.9);
box('walnut', -6.55, -5.9, F0, 3.0, -12.6, -8.3, true); box('marbleB', -5.1, -2.8, F0, 0.97, -11.2, -10.2, true); box('marbleB', -5.2, -2.7, 0.97, 1.03, -11.3, -10.1); box('led', -5.1, -2.8, 0.17, 0.2, -11.19, -11.17);
for (let i = 0; i < 3; i++) { cyl('frame', -4.6 + i * 0.8, 2.9, 3.0, -10.65, 0.006, 0.006, 4); put('bronze', new THREE.ConeGeometry(0.16, 0.22, 16, 1, true), mat4(-4.6 + i * 0.8, 2.1, -10.65)); }
for (let i = 0; i < 3; i++) chair(-4.5 + i * 0.75, -9.7, PI, 'leatherC');
// salle à manger : table noire, huit chaises, suspension dorée en disque, bibliothèque LED sur le mur ouest
table(0, -6.2, 3.2, 1.1, 0.75, 'marbleB', 'frame');
for (let i = 0; i < 4; i++) { chair(-1.2 + i * 0.8, -6.95, 0, 'fabricD'); chair(-1.2 + i * 0.8, -5.45, PI, 'fabricD'); }
put('gold', new THREE.SphereGeometry(0.75, 28, 10, 0, PI * 2, 0, PI * 0.45).scale(1, 0.4, 1), mat4(0, 2.0, -6.2)); cyl('frame', 0, 2.3, Y1, -6.2, 0.006, 0.006, 4);
{ const x = -2.5; for (let y = 0.6; y < 3.4; y += 0.65) { box('steelBk', x, x + 0.3, y, y + 0.03, -7.8, -4.5); box('led', x + 0.02, x + 0.28, y + 0.03, y + 0.05, -7.78, -4.52); for (let k = 0; k < 4; k++) if (rnd() < 0.7) box(rnd() < 0.5 ? 'book' : 'copper', x + 0.04, x + 0.26, y + 0.04, y + 0.3 + rnd() * 0.15, -7.6 + k * 0.8, -7.0 + k * 0.8 + rnd() * 0.3); } }
// séjour d'après les rendus : banquette capitonnée cuir vert, pouf cognac sur socle noyer, grand canapé crème à boudins,
// tables basses marbre noir et acier, lampe aux sphères dorées, sphères de bois sculpté, lit de galets, fauteuils tressés,
// lampadaires noirs, niche en noyer éclairée, sculpture noire sur socle, rideaux en plis de part et d'autre des baies
box('fabric', 3.3, 8.1, F0, 0.2, -11.0, -7.6); box('fabricD', 3.3, 8.1, 0.2, 0.215, -11.0, -7.6); // tapis
tufted(6.0, -10.4, 3.6, 1.05, 0, 'fabric', 0.42, true); tufted(3.65, -8.6, 2.4, 1.0, PI / 2, 'fabric', 0.42, true);
tufted(5.4, -8.2, 1.4, 0.95, 0, 'leatherC', 0.42); box('walnut', 4.55, 6.25, F0, F0 + 0.12, -8.75, -7.6);
tufted(6.5, -5.9, 2.8, 1.05, 0, 'leatherG', 0.44);
table(5.2, -9.1, 1.4, 0.75, 0.36, 'marbleB', 'steelBk', F0, 0.14); box('steelBk', 6.1, 6.9, F0 + 0.28, F0 + 0.32, -9.5, -8.75); box('steelBk', 6.1, 6.15, F0, F0 + 0.32, -9.5, -8.75); box('steelBk', 6.85, 6.9, F0, F0 + 0.32, -9.5, -8.75);
domeLamp(5.0, F0 + 0.36, -9.3, 0.14); domeLamp(6.05, F0 + 0.42, -8.3, 0.12);
{ const x = 3.4, z = -11.4; cyl('gold', x, F0, F0 + 0.03, z, 0.28, 0.28, 24); cyl('bronze', x, F0, 2.3, z, 0.015, 0.015, 8); for (const [dx, dy, dz, r] of [[0, 2.35, 0, 0.3], [0.32, 2.0, 0.15, 0.22], [-0.25, 1.85, -0.1, 0.2], [0.1, 1.55, 0.25, 0.25], [-0.3, 1.45, 0.2, 0.17], [0.28, 1.2, -0.2, 0.19]]) put('gold', new THREE.SphereGeometry(r, 18, 14), mat4(x + dx, dy, z + dz)); }
for (const [x, z, r] of [[7.5, -5.1, 0.46], [7.95, -5.9, 0.28], [3.2, -6.0, 0.32]]) { put('woodBall', new THREE.SphereGeometry(r, 24, 18), mat4(x, F0 + r, z, 0.3, rnd() * 3, 0.2)); solid(x - r, x + r, z - r, z + r, 0, r * 2); }
put('walnut', new THREE.SphereGeometry(0.2, 18, 14), mat4(7.2, F0 + 0.2, -6.4));
box('frame', 2.9, 3.5, F0 - 0.1, F0 + 0.02, -8.0, -4.6); box('pebble', 2.95, 3.45, F0 - 0.1, F0 + 0.06, -7.95, -4.65); sph('leaf2', 3.2, F0 + 0.3, -6.3, 0.26, 1, 0.8);
armchair(7.7, -7.6, -PI / 2 + 0.3); armchair(7.7, -9.0, -PI / 2 - 0.2); armchair(4.1, -6.0, PI / 2 + 0.4);
floorLamp(3.3, -9.9, 0.6); floorLamp(7.9, -4.7, -2.4, F0, 2.1);
plant(7.9, -11.4, F0, 1.1); plant(3.1, -4.9, F0, 0.9);
{ const x = 8.2; box('walnut', x, x + 0.33, F0 + 0.4, 2.6, -11.9, -10.6, true); box('jar', x + 0.02, x + 0.3, F0 + 0.45, 2.55, -11.88, -10.62); for (let y = 0.5; y < 2.3; y += 0.5) { box('walnut', x + 0.02, x + 0.31, F0 + y, F0 + y + 0.03, -11.88, -10.62); box('led', x + 0.04, x + 0.3, F0 + y + 0.03, F0 + y + 0.05, -11.87, -11.85); for (let k = 0; k < 3; k++) if (rnd() < 0.7) cyl(rnd() < 0.5 ? 'jar' : 'gold', x + 0.17, F0 + y + 0.03, F0 + y + 0.25 + rnd() * 0.15, -11.7 + k * 0.4, 0.035, 0.035, 8); } }
{ const x = 3.0, z = -11.5; box('marbleB', x - 0.16, x + 0.16, F0, 1.1, z - 0.16, z + 0.16, true); for (let i = 0; i < 6; i++) put('steelBk', new THREE.BoxGeometry(0.18 + rnd() * 0.12, 0.26, 0.06), mat4(x + (rnd() - 0.5) * 0.08, 1.25 + i * 0.22, z, 0, rnd() * 1.2, (rnd() - 0.5) * 0.5)); }
curtain('x', -11.72, 3.25, 4.4, F0, Y1 - 0.06); curtain('x', -11.72, 6.8, 7.95, F0, Y1 - 0.06); curtain('z', 8.22, -10.4, -9.3, F0, Y1 - 0.06); curtain('z', 8.22, -5.3, -4.4, F0, Y1 - 0.06);
box('led', 2.9, 8.2, Y1 - 0.12, Y1 - 0.1, -11.75, -11.72); box('led', 2.9, 2.93, Y1 - 0.12, Y1 - 0.1, -11.7, -4.5); // gorge lumineuse
// hall double hauteur : sculpture dorée en spirale sur socle de marbre noir, suspension en grappe, console
{ const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * PI * 3.2; const r = 0.9 * (1 - t * 0.55); pts.push(V(0.4 + Math.cos(a) * r, 0.5 + t * 4.6, -1.0 + Math.sin(a) * r)); } put('gold', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.17, 10, false), null); box('marbleB', -0.5, 1.3, F0, 0.45, -1.9, -0.1, true); box('led', -0.52, 1.32, 0.4, 0.43, -1.92, -0.08);
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2, r = 0.5 + (i % 3) * 0.35, y = 5.2 + (i % 4) * 0.4; const x = 0.5 + Math.cos(a) * r, z = -2.4 + Math.sin(a) * r; cyl('frame', x, y, Y2, z, 0.004, 0.004, 4); put('bulb', new THREE.SphereGeometry(0.1, 10, 8), mat4(x, y, z)); } }
table(-3.8, 4.4, 1.6, 0.45, 0.85, 'marbleB', 'bronze'); jar(-6.0, 4.3, 0.3, 0.7, F0);
box('marbleG', -6.55, -5.15, F0, 2.3, 2.6, 3.2, true); for (let y = 0.55; y < 2.2; y += 0.42) box('led', -6.5, -5.2, F0 + y, F0 + y + 0.015, 3.2, 3.215); // tableau d'étagères de marbre sous l'escalier
// salon-cheminée : pilastres en plâtre gris, bibliothèque noire aux fonds cuivre et réglettes LED, foyer linéaire à galets,
// poufs crème, tables basses noires, tapis, plantes, bibliothèque noire pleine hauteur
{ const xw = -2.51; box('plaster', xw, xw + 0.45, F0, Y1, 6.1, 6.55); box('plaster', xw, xw + 0.45, F0, Y1, 9.65, 10.1); box('steelBk', xw, xw + 0.04, F0 + 0.6, Y1 - 0.25, 6.55, 9.65); box('steelBk', xw, xw + 0.42, F0 + 0.6, Y1 - 0.25, 6.55, 6.58); box('steelBk', xw, xw + 0.42, F0 + 0.6, Y1 - 0.25, 9.62, 9.65); box('plaster', xw, xw + 0.45, F0, F0 + 0.6, 6.55, 9.65); box('plaster', xw, xw + 0.45, Y1 - 0.25, Y1, 6.55, 9.65);
  const rows = [F0 + 0.6, 1.5, 2.3, 3.05, Y1 - 0.25]; for (let i = 0; i < rows.length; i++) { box('steelBk', xw + 0.02, xw + 0.42, rows[i] - 0.015, rows[i] + 0.015, 6.55, 9.65); if (i < rows.length - 1) { box('led', xw + 0.3, xw + 0.42, rows[i] + 0.015, rows[i] + 0.03, 6.6, 9.6); } }
  for (const [y0, y1, z0, z1] of [[1.5, 2.3, 8.3, 9.65], [2.3, 3.05, 6.55, 7.6], [F0 + 0.6, 1.5, 7.8, 8.6], [3.05, Y1 - 0.25, 8.8, 9.65]]) { box('copper', xw + 0.04, xw + 0.07, y0 + 0.03, y1 - 0.03, z0 + 0.03, z1 - 0.03); box('led', xw + 0.06, xw + 0.42, y0 + 0.03, y1 - 0.03, z1 - 0.05, z1 - 0.03); }
  for (let i = 0; i < 14; i++) { const r = rows[i % 4], z = 6.7 + rnd() * 2.6; box('book', xw + 0.08, xw + 0.36, r + 0.03, r + 0.25 + rnd() * 0.18, z, z + 0.06 + rnd() * 0.12); }
  box('frame', xw + 0.45, xw + 0.95, F0, F0 + 0.45, 6.7, 9.5, true); box('pebble', xw + 0.5, xw + 0.9, F0 + 0.4, F0 + 0.47, 6.8, 9.4); box('steelBk', xw + 0.45, xw + 0.95, F0 + 0.45, F0 + 0.48, 6.7, 9.5); box('steelBk', xw + 0.45, xw + 0.95, F0 + 0.1, F0 + 0.12, 6.7, 6.72); }
box('fabric', -0.4, 3.0, F0, 0.18, 6.0, 9.4); tufted(0.3, 6.8, 1.3, 0.9, 0, 'fabric', 0.42); tufted(0.3, 8.9, 1.3, 0.9, 0, 'fabric', 0.42); tufted(2.6, 8.3, 1.6, 0.9, 0, 'fabric', 0.42); tufted(2.6, 6.5, 1.3, 0.9, 0, 'fabric', 0.42);
put('marbleB', new THREE.CylinderGeometry(0.62, 0.62, 0.05, 28), mat4(1.4, F0 + 0.36, 7.7)); put('steelBk', new THREE.CylinderGeometry(0.2, 0.3, 0.33, 14), mat4(1.4, F0 + 0.17, 7.7)); put('marbleB', new THREE.CylinderGeometry(0.4, 0.4, 0.05, 24), mat4(1.1, F0 + 0.28, 8.5)); put('steelBk', new THREE.CylinderGeometry(0.12, 0.2, 0.25, 12), mat4(1.1, F0 + 0.13, 8.5)); solid(0.7, 2.1, 7.0, 8.9, 0, 0.5); cyl('steelBk', 1.9, F0, F0 + 0.45, 8.6, 0.32, 0.32, 20);
plant(-1.3, 5.9, F0, 1.2, 8); plant(3.6, 9.7, F0, 0.9);
floorLamp(3.3, 6.3, -2.2, F0, 2.4); floorLamp(-1.6, 9.6, 2.6, F0, 2.2); domeLamp(1.9, F0 + 0.45, 8.6, 0.15);
box('steelBk', 3.9, 4.1, F0, Y1, 2.8, 5.5); for (let y = 0.6; y < 3.5; y += 0.5) { box('steelBk', 3.75, 3.9, F0 + y, F0 + y + 0.02, 2.85, 5.45); box('led', 3.77, 3.88, F0 + y + 0.02, F0 + y + 0.035, 2.9, 5.4); }
curtain('z', 4.02, 2.9, 4.0, F0, Y1 - 0.06); curtain('z', 4.02, 9.0, 9.9, F0, Y1 - 0.06);
// terrasse couverte : grande table de marbre, dix fauteuils tressés, deux suspensions dorées en coupole, lounge au bord du bassin
table(6.0, 5.5, 1.1, 4.6, 0.75, 'marbleW', 'bronze', 0.17);
for (let i = 0; i < 5; i++) { chair(5.25, 3.7 + i * 0.9, PI / 2, 'fabricD', 0.17); chair(6.75, 3.7 + i * 0.9, -PI / 2, 'fabricD', 0.17); }
for (const z of [4.4, 6.6]) { put('gold', new THREE.SphereGeometry(0.9, 28, 10, 0, PI * 2, 0, PI * 0.5).scale(1, 0.45, 1), mat4(6.0, 2.35, z)); cyl('frame', 6.0, 2.7, Y1, z, 0.006, 0.006, 4); }
for (const z of [-2.2, -0.6]) { box('fabric', 9.1, 9.75, 0.17 + 0.25, 0.17 + 0.4, z - 0.9, z + 0.9); box('fabric', 9.1, 9.75, 0.17 + 0.4, 0.17 + 0.95, z - 0.9, z - 0.55); box('frame', 9.12, 9.73, 0.17, 0.17 + 0.25, z - 0.85, z + 0.85, true); }
for (const z of [3.0, 4.6, 6.2]) { box('fabric', 12.75, 13.55, 0.17, 0.5, z - 0.75, z + 0.75, true); box('fabric', 12.75, 13.55, 0.5, 0.95, z - 0.75, z - 0.5); }
// figure de bronze marchant, adossée au pylône de la terrasse
{ const x = 6.95, z = 9.3, g = (geo, lx, ly, lz, r = [0, 0, 0]) => put('bronze', geo, mat4(x, 0.17, z).multiply(mat4(lx, ly, lz, r[0], r[1], r[2]))); g(new THREE.CapsuleGeometry(0.11, 0.6, 4, 10), 0, 1.6, 0); g(new THREE.SphereGeometry(0.11, 12, 9), 0, 2.12, 0); g(new THREE.CapsuleGeometry(0.05, 0.85, 3, 8), 0.0, 0.62, 0.28, [0.45, 0, 0]); g(new THREE.CapsuleGeometry(0.05, 0.85, 3, 8), 0.02, 0.62, -0.25, [-0.4, 0, 0]); g(new THREE.CapsuleGeometry(0.035, 0.6, 3, 8), 0.0, 1.5, 0.22, [0.7, 0, 0]); g(new THREE.CapsuleGeometry(0.035, 0.6, 3, 8), 0.0, 1.5, -0.22, [-0.7, 0, 0]); }
// étage : chambres 1, 2, 3 et suite parentale, dressings en noyer, bains en marbre blanc, rideaux
bed(-5.4, -9.6, PI / 2, 1.8, 2.1); bed(-0.4, -8.2, 0, 1.8, 2.1); bed(5.0, -8.0, 0, 1.8, 2.1); bed(-4.6, 7.9, PI / 2, 2.0, 2.2);
wardrobe(4.0, 7.4, -10.0, -9.4); wardrobe(-3.9, -3.3, 1.9, 4.9); wardrobe(-1.7, -1.1, 1.9, 4.9); wardrobe(-5.5, -5.0, -12.0, -10.0);
for (const [x0, x1, z0, z1] of [[-7.3, -5.6, -7.35, -6.6], [-1.3, 0.5, -11.9, -11.3], [2.2, 4.4, -11.9, -11.3], [-6.7, -5.0, 1.8, 2.4]]) { box('marbleW', x0, x1, SL, SL + 0.85, z0, z1, true); box('white', x0 + 0.2, x1 - 0.2, SL + 0.85, SL + 0.95, z0 + 0.1, z1 - 0.1); box('led', x0, x1, SL + 1.6, SL + 1.62, z0 + 0.02, z0 + 0.04); }
for (const [x, z] of [[-6.6, -5.5], [1.7, -10.4], [3.5, -10.4], [-6.4, 3.8]]) { put('white', new THREE.CylinderGeometry(0.8, 0.7, 0.55, 24).scale(1, 1, 0.6), mat4(x, SL + 0.28, z)); solid(x - 0.8, x + 0.8, z - 0.5, z + 0.5, SL, SL + 0.6); }
curtain('x', -11.82, -2.2, -1.2, SL, Y2 - 0.06); curtain('x', -11.82, 6.2, 7.2, SL, Y2 - 0.06); curtain('z', 3.5, 2.2, 3.2, SL, Y2 - 0.06); curtain('z', 3.5, 8.8, 9.6, SL, Y2 - 0.06);
tufted(0.5, 8.9, 2.0, 0.9, PI, 'leatherG', 0.4, true, SL + 0.02); table(0.5, 7.4, 0.9, 0.5, 0.4, 'marbleB', 'steelBk', SL, 0.04); plant(2.8, 9.4, SL + 0.02, 0.9); plant(-6.4, 9.4, SL + 0.02, 0.9);
for (const [x, z] of [[5.0, -6.0], [5.5, 3.0]]) { box('fabric', x - 0.35, x + 0.35, SL + 0.25, SL + 0.4, z - 0.9, z + 0.9); box('fabric', x - 0.35, x + 0.35, SL + 0.4, SL + 0.95, z - 0.9, z - 0.55); box('frame', x - 0.33, x + 0.33, SL, SL + 0.25, z - 0.85, z + 0.85, true); }
for (const [x, z, r] of [[8.4, -12.6, 0.45], [8.4, -4.4, 0.4], [6.6, 9.6, 0.45], [-2.0, -12.9, 0.4]]) { cyl('pot', x, SL + 0.03, SL + 0.5, z, 0.32, 0.26, 14); sph('leaf', x, SL + 0.5 + r * 0.8, z, r, 1, 0.9); }
box('fabric', -2.6, 2.8, SL + 0.02, SL + 0.04, 5.8, 9.6);

// ---------------------------------------------------------------- flammes animées et assemblage des maillages
const flames = []; { const fx = -2.0; for (let i = 0; i < 16; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 + rnd() * 0.04, 0.28 + rnd() * 0.22, 6), M.flame); f.position.set(fx + (rnd() - 0.5) * 0.3, F0 + 0.58, 6.9 + i * 0.17); f.userData.p = rnd() * 6; f.userData.h = f.scale.y; flames.push(f); scene.add(f); } }
const world = new THREE.Group(); scene.add(world);
for (const [key, geos] of Object.entries(buckets)) { const geo = mergeGeometries(geos, false); const mesh = new THREE.Mesh(geo, M[key]); if (!NO_SHADOW.has(key)) { mesh.castShadow = true; mesh.receiveShadow = true; } else if (key === 'lawn' || key === 'curtain') mesh.receiveShadow = true; if (key === 'glass' || key === 'railGlass' || key === 'water' || key === 'waterDark' || key === 'fall') mesh.renderOrder = 10; world.add(mesh); }
// éclairages ponctuels (allumés au crépuscule)
const lamps = []; const lamp = (x, y, z, col, dist, pow) => { const l = new THREE.PointLight(col, 0, dist, 2); l.position.set(x, y, z); l.userData.pow = pow; scene.add(l); lamps.push(l); return l; };
lamp(-1.9, 1.0, 8.2, '#ff8a3a', 9, 18); lamp(1.2, 3.4, 7.6, '#ffc890', 10, 14); lamp(0.4, 5.4, -1.8, '#ffd3a0', 14, 26); lamp(5.6, 2.9, -8.2, '#ffcf96', 11, 18);
lamp(6.0, 2.2, 4.4, '#ffc27a', 8, 14); lamp(6.0, 2.2, 6.6, '#ffc27a', 8, 14); lamp(10.2, -0.6, 3.4, '#3fc3e8', 12, 22); lamp(-4.6, 3.2, 8.0, '#ffcf9a', 8, 10); lamp(-4.4, 3.4, 4.0, '#ffd6a8', 9, 14); lamp(-3.0, 3.4, -6.2, '#ffd6a8', 8, 8);
lamp(-1.5, 6.6, 7.5, '#ffd6a8', 10, 12); lamp(-4.4, 3.1, -10.6, '#ffd6a8', 9, 12); lamp(0.6, 6.5, -8.2, '#ffd6a8', 9, 10); lamp(-5.0, 6.5, -9.0, '#ffd6a8', 9, 10);
lamp(0, 2.2, -6.2, '#ffc27a', 7, 10); lamp(2.0, 1.2, 14.2, '#ffd0a0', 7, 6); lamp(9.6, 1.4, 14.2, '#9ad5ec', 7, 6);

// ---------------------------------------------------------------- jour / crépuscule
const MODES = {
  dusk: { top: '#152650', mid: '#4f6ea8', hor: '#e8a46c', sunDir: [-0.7, 0.16, 0.5], sun: ['#ffbf80', 1.25], sunPos: [-45, 13, 30], hemi: ['#6f88bf', '#3a2f26', 0.7], fog: '#8c7a86', expo: 1.0, lamps: 1, led: 1, water: '#2a9fbe' },
  day: { top: '#3d7bd0', mid: '#9dc2ea', hor: '#e7edf1', sunDir: [-0.5, 0.75, 0.4], sun: ['#fff1dc', 2.8], sunPos: [-32, 50, 24], hemi: ['#dfe9f6', '#8c7c62', 1.05], fog: '#d6dde6', expo: 1.0, lamps: 0, led: 0.22, water: '#3db4cf' },
};
let mode = 'dusk';
function applyMode(k) { mode = k; const m = MODES[k]; skyU.top.value.set(m.top); skyU.mid.value.set(m.mid); skyU.hor.value.set(m.hor); skyU.sunDir.value.set(...m.sunDir).normalize();
  sun.color.set(m.sun[0]); sun.intensity = m.sun[1]; sun.position.set(...m.sunPos); hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2]; scene.fog.color.set(m.fog); renderer.toneMappingExposure = m.expo;
  lamps.forEach(l => { l.intensity = l.userData.pow * 1.3 * m.lamps; }); M.led.color.setRGB(2.4 * m.led + 1.0 * (1 - m.led), 2.0 * m.led + 0.95 * (1 - m.led), 1.45 * m.led + 0.85 * (1 - m.led)); M.bulb.color.setRGB(3.2 * m.led + 1.0 * (1 - m.led), 2.6 * m.led + 0.97 * (1 - m.led), 1.8 * m.led + 0.9 * (1 - m.led)); M.ledCool.color.setRGB(1.6 * m.led + 0.9 * (1 - m.led), 2.2 * m.led + 1 * (1 - m.led), 2.6 * m.led + 1 * (1 - m.led));
  M.water.color.set(m.water); M.water.emissiveIntensity = 0.35 * m.lamps; M.flame.opacity = 0.6 + 0.3 * m.lamps; buildEnv(); $('mode').setAttribute('aria-pressed', k === 'day'); $('mode').textContent = k === 'day' ? 'Crépuscule' : 'Jour'; }
applyMode('dusk');
$('mode').addEventListener('click', () => applyMode(mode === 'day' ? 'dusk' : 'day'));

// ---------------------------------------------------------------- déplacement : sol, collisions, clavier / souris / tactile
const P = { x: -4.4, y: 0, z: 18.6, yaw: 0.08, pitch: 0.02, vy: 0 };
const EYE = 1.62, R = 0.32;
function floorAt(x, z, cur) { let best = -Infinity; for (const f of floors) { if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const y = f.fn ? f.fn(x, z) : f.y; if (y <= cur + 0.55 && y > best) best = y; } return best === -Infinity ? 0 : best; }
function collide() { const y0 = P.y + 0.3, y1 = P.y + 1.5; for (let pass = 0; pass < 2; pass++) for (const s of solids) { if (s.y1 <= y0 || s.y0 >= y1) continue; const cx = clamp(P.x, s.x0, s.x1), cz = clamp(P.z, s.z0, s.z1); let dx = P.x - cx, dz = P.z - cz; const d2 = dx * dx + dz * dz; if (d2 >= R * R) continue; if (d2 < 1e-8) { const px = Math.min(P.x - s.x0, s.x1 - P.x), pz = Math.min(P.z - s.z0, s.z1 - P.z); if (px < pz) P.x += (P.x - s.x0 < s.x1 - P.x ? -1 : 1) * (px + R); else P.z += (P.z - s.z0 < s.z1 - P.z ? -1 : 1) * (pz + R); continue; } const d = Math.sqrt(d2); P.x = cx + dx / d * R; P.z = cz + dz / d * R; } }
function move(dx, dz, dt) { // dx, dz : déplacement souhaité (m) ; refuse les chutes de plus d'un mètre
  const ox = P.x, oz = P.z; P.x += dx; P.z += dz; collide(); const fy = floorAt(P.x, P.z, P.y); if (P.y - fy > 1.0 && !(P.y > SL - 0.5 && fy >= SL - 0.5)) { P.x = ox; P.z = oz; return; } P.y = fy > P.y ? damp(P.y, fy, 16, dt) : damp(P.y, fy, 9, dt); }
const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); }); addEventListener('keyup', e => { keys[e.code] = false; });
const K = (...c) => c.some(k => keys[k]);
let locked = false, dragging = null; const look = (ddx, ddy) => { P.yaw -= ddx * 0.0022; P.pitch = clamp(P.pitch - ddy * 0.0022, -1.3, 1.3); };
const lock = () => { try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => { $('intro').classList.remove('on'); }); } catch { $('intro').classList.remove('on'); } };
canvas.addEventListener('click', () => { if (!isTouch && !locked && !renderer.xr.isPresenting) lock(); });
$('go').addEventListener('click', lock);
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; $('intro').classList.toggle('on', !locked && !isTouch && !renderer.xr.isPresenting); });
addEventListener('mousemove', e => { if (locked) look(e.movementX, e.movementY); else if (dragging === 'mouse') look(e.movementX, e.movementY); });
canvas.addEventListener('mousedown', e => { if (!locked && !isTouch) dragging = 'mouse'; }); addEventListener('mouseup', () => { if (dragging === 'mouse') dragging = null; });
// tactile : moitié gauche = joystick de marche, moitié droite = regard
const stick = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 }, lookT = { id: null, x: 0, y: 0 };
canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && stick.id === null) { stick.id = t.identifier; stick.x0 = t.clientX; stick.y0 = t.clientY; stick.dx = stick.dy = 0; $('stick').style.left = t.clientX + 'px'; $('stick').style.top = t.clientY + 'px'; $('stick').classList.add('on'); } else if (lookT.id === null) { lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY; } } e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.dx = clamp((t.clientX - stick.x0) / 60, -1, 1); stick.dy = clamp((t.clientY - stick.y0) / 60, -1, 1); $('knob').style.transform = `translate(${stick.dx * 30}px,${stick.dy * 30}px)`; } else if (t.identifier === lookT.id) { look((t.clientX - lookT.x) * 1.6, (t.clientY - lookT.y) * 1.6); lookT.x = t.clientX; lookT.y = t.clientY; } } e.preventDefault(); }, { passive: false });
const endTouch = e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.id = null; stick.dx = stick.dy = 0; $('stick').classList.remove('on'); $('knob').style.transform = ''; } if (t.identifier === lookT.id) lookT.id = null; } };
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
// points de visite
const SPOTS = { jardin: [-4.4, 18.6, 0.08, 0.02], entree: [-4.5, 8.6, 0.0, 0.05], salon: [1.6, 7.9, PI / 2, 0.02], hall: [-0.4, 0.4, -PI / 2 + 0.3, 0.12], dinner: [0.2, -3.0, 0, 0.05], sejour: [5.6, -7.3, 0.4, 0.02], terrasse: [6.0, 9.2, 0.0, 0.03], piscine: [10.4, 11.0, 0.15, 0.06], suite: [-1.0, 7.8, PI / 2 + 0.4, 0.03], etage: [5.4, 5.6, -PI / 2, -0.1], chambre: [-0.6, -6.0, -0.2, 0.02], facade: [16.5, 1.2, PI / 2 + 0.55, 0.14] };
function goTo(name) { const s = SPOTS[name]; if (!s) return; $('fade').classList.add('on'); setTimeout(() => { P.x = s[0]; P.z = s[1]; P.yaw = s[2]; P.pitch = s[3]; P.y = floorAt(P.x, P.z, name === 'suite' || name === 'etage' || name === 'chambre' ? SL : 0); if (renderer.xr.isPresenting) { rig.position.set(P.x, P.y, P.z); rig.rotation.y = P.yaw; } $('fade').classList.remove('on'); }, 260); }
document.querySelectorAll('[data-spot]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.spot)));
const ZONES = [[-6.9, -2.13, -13.4, -8.0, 'Cuisine'], [-2.13, 2.66, -12.0, -8.0, 'Service'], [2.66, 8.5, -12.0, -4.26, 'Séjour'], [-2.66, 2.66, -8.0, -4.26, 'Salle à manger'], [-6.9, 2.66, -4.26, 5.7, 'Hall double hauteur'], [-2.66, 4.26, 5.7, 10.1, 'Salon · cheminée'], [4.26, 8.5, 1.6, 10.6, 'Terrasse couverte'], [4.3, 13.8, -4.3, 11.2, 'Piscine à débordement'], [8.5, 10.2, -14, -4.26, 'Terrasse est'], [-7.3, -2.66, 5.7, 11.4, 'Entrée'], [-13, 20.5, 10.6, 20.5, 'Jardin'], [-13, 20.5, -16.5, 20.5, 'Domaine Red Stone']];
const ZONES1 = [[-7.45, -3.06, -13.4, -5.2, 'Chambre 1'], [-3.06, 2.0, -12.1, -5.2, 'Chambre 2'], [2.0, 7.7, -12.1, -3.7, 'Chambre 3'], [-7.45, 2.0, -5.2, -3.7, 'Couloir'], [-6.9, -4.0, 1.6, 5.0, 'Bain parental'], [-4.0, -1.0, 1.6, 5.0, 'Dressing'], [-6.9, 3.7, 1.6, 10.1, 'Suite parentale'], [3.7, 7.3, 1.6, 10.1, 'Terrasse de la suite'], [-6.9, -1.6, -3.7, 2.1, 'Passerelle'], [-20, 20, -20, 20, 'Terrasses']];
function zoneName() { const L = P.y > SL - 0.6 ? ZONES1 : ZONES; for (const [x0, x1, z0, z1, n] of L) if (P.x >= x0 && P.x <= x1 && P.z >= z0 && P.z <= z1) return n; return 'Villa Chloé'; }

// ---------------------------------------------------------------- WebXR : rig = pieds du visiteur ; gâchette = téléportation, stick gauche = marche, stick droit = rotation par crans
const ctrls = []; const ray = new THREE.Raycaster(); const tmpM = new THREE.Matrix4();
const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#f0cf7a', transparent: true, opacity: 0.85 })); marker.visible = false; scene.add(marker);
function floorHit(origin, dir) { // intersection analytique avec les sols (plans et rampe d'escalier)
  let best = null; for (const f of floors) { if (f.fn) { for (let t = 0.2; t < 14; t += 0.12) { const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t; if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const fy = f.fn(x, z); if (y <= fy + 0.03) { if (!best || t < best.t) best = { t, p: V(x, fy, z) }; break; } } continue; }
    if (Math.abs(dir.y) < 1e-4) continue; const t = (f.y - origin.y) / dir.y; if (t < 0.2 || t > 20) continue; const x = origin.x + dir.x * t, z = origin.z + dir.z * t; if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; if (!best || t < best.t) best = { t, p: V(x, f.y, z) }; }
  return best; }
for (let i = 0; i < 2; i++) { const c = renderer.xr.getController(i); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf0cf7a })); line.scale.z = 8; c.add(line); rig.add(c); ctrls.push(c);
  c.addEventListener('selectend', () => { const h = ctrlHit(c); if (h) { const prev = P.y; P.x = h.p.x; P.z = h.p.z; P.y = h.p.y; rig.position.set(P.x, P.y, P.z); if (Math.abs(prev - P.y) > 2.5) { /* changement d'étage */ } } });
  const grip = renderer.xr.getControllerGrip(i); const gm = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.1, 3, 10).rotateX(PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.5, metalness: 0.5 })); grip.add(gm); rig.add(grip); }
function ctrlHit(c) { tmpM.identity().extractRotation(c.matrixWorld); const o = V().setFromMatrixPosition(c.matrixWorld), d = V(0, 0, -1).applyMatrix4(tmpM); return floorHit(o, d); }
let snapT = 0;
function xrUpdate(dt) { const s = renderer.xr.getSession(); if (!s) return;
  const xrCam = renderer.xr.getCamera(); const fwd = V(); xrCam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const right = V().crossVectors(fwd, V(0, 1, 0));
  for (const src of s.inputSources) { const g = src.gamepad; if (!g || g.axes.length < 4) continue; const ax = g.axes[2], ay = g.axes[3];
    if (src.handedness === 'right') { snapT -= dt; if (Math.abs(ax) > 0.6 && snapT <= 0) { snapT = 0.35; P.yaw -= Math.sign(ax) * PI / 6; rig.rotation.y = P.yaw; } continue; }
    if (Math.abs(ax) < 0.15 && Math.abs(ay) < 0.15) continue; const v = 1.8 * dt; move((fwd.x * -ay + right.x * ax) * v, (fwd.z * -ay + right.z * ax) * v, dt); rig.position.set(P.x, P.y, P.z); }
  let shown = false; for (const c of ctrls) { const h = ctrlHit(c); if (h) { marker.position.copy(h.p).y += 0.02; shown = true; break; } } marker.visible = shown; }
renderer.xr.addEventListener('sessionstart', () => { rig.position.set(P.x, P.y, P.z); rig.rotation.y = P.yaw; camera.rotation.set(0, 0, 0); camera.position.set(0, 0, 0); document.body.classList.add('xr'); });
renderer.xr.addEventListener('sessionend', () => { rig.position.set(0, 0, 0); rig.rotation.y = 0; marker.visible = false; document.body.classList.remove('xr'); $('vr').setAttribute('aria-pressed', 'false'); });
const vrBtn = $('vr');
if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { vrBtn.hidden = !ok; $('vrhint').hidden = ok; }).catch(() => { vrBtn.hidden = true; }); else { vrBtn.hidden = true; }
vrBtn.addEventListener('click', async () => { if (renderer.xr.getSession()) { renderer.xr.getSession().end(); return; } try { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }); await renderer.xr.setSession(s); vrBtn.setAttribute('aria-pressed', 'true'); } catch (e) { console.warn('VR', e); } });
$('fs')?.addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); });

// ---------------------------------------------------------------- boucle
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
let last = performance.now(), zoneT = 0, bob = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000; T.ripple.offset.set(t * 0.012, t * 0.009); T.fall.offset.y = -t * 1.4;
  for (const f of flames) { const k = 0.75 + 0.35 * Math.sin(t * 9 + f.userData.p) + 0.15 * Math.sin(t * 23 + f.userData.p * 3); f.scale.y = k; f.position.x += Math.sin(t * 7 + f.userData.p) * 0.0006; }
  if (renderer.xr.isPresenting) { xrUpdate(dt); }
  else {
    let fx = 0, fz = 0; if (K('KeyW', 'KeyZ', 'ArrowUp')) fz -= 1; if (K('KeyS', 'ArrowDown')) fz += 1; if (K('KeyA', 'KeyQ', 'ArrowLeft')) fx -= 1; if (K('KeyD', 'ArrowRight')) fx += 1;
    fx += stick.dx; fz += stick.dy; const len = Math.hypot(fx, fz); if (len > 1) { fx /= len; fz /= len; }
    if (len > 0.02) { const sp = (K('ShiftLeft', 'ShiftRight') ? 4.2 : 2.3) * dt; const c = Math.cos(P.yaw), s = Math.sin(P.yaw); move((fx * c - fz * s) * sp, (fx * s + fz * c) * sp, dt); bob += dt * (K('ShiftLeft') ? 11 : 7); } else P.y = damp(P.y, floorAt(P.x, P.z, P.y), 10, dt);
    camera.position.set(P.x, P.y + EYE + Math.sin(bob) * 0.025, P.z); camera.rotation.set(P.pitch, P.yaw, 0);
  }
  sky.position.copy(renderer.xr.isPresenting ? rig.position : camera.position); sun.target.position.set(P.x, 0, P.z); sun.position.set(P.x + MODES[mode].sunPos[0], MODES[mode].sunPos[1], P.z + MODES[mode].sunPos[2]);
  zoneT -= dt; if (zoneT <= 0) { zoneT = 0.4; const n = zoneName(); if ($('zone').textContent !== n) { $('zone').textContent = n; $('area').classList.add('on'); } }
  renderer.render(scene, camera);
});
$('loader').classList.add('off');
window.WHV = { scene, M, P, goTo, applyMode, renderer, floors, solids };
if (isTouch) $('intro').classList.remove('on');
