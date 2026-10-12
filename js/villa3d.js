// Maquette blanche interactive d'une villa, construite depuis les plans (coordonnées en pixels du plan, converties en mètres).
// Trois vues : volumes, rez-de-chaussée (écorché), étage (écorché). Rotation à la souris / au doigt, zoom à la molette / pincement.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { RGBELoader } from './vendor/jsm/loaders/RGBELoader.js';
import * as BGU from './vendor/BufferGeometryUtils.js';

const MODELS = {
  chloe: {
    plan: 1400, scale: 37.6, // px du plan d'origine ; px par mètre (bassin 13,00 m = 490 px)
    rdcTex: 'img/plans/chloe-rdc-3d.png', etageTex: 'img/plans/chloe-etage-3d.png',
    facades: { east: 'img/facades/chloe-east.jpg', west: 'img/facades/chloe-west.jpg', north: 'img/facades/chloe-north.jpg', south: 'img/facades/chloe-south.jpg' },
    h: { rdc: 3.9, etage: 3.5, slab: 0.3, roof: 0.45 },
    // Murs extérieurs : polylignes fermées [x,y] en px ; segments vitrés par index d'arête (de i à i+1) → {i:[t0,t1]} fraction vitrée
    rdc: [
      { pts: [[440,195],[620,195],[620,250],[1020,250],[1020,540],[800,540],[800,800],[860,800],[860,1080],[600,1080],[600,915],[455,915],[455,580],[440,580]],
        glass: { 2: [0.5, 0.95], 3: [0.3, 0.95], 4: [0.1, 1], 5: [0.08, 0.92], 7: [0.08, 0.9], 8: [0.15, 0.6], 10: [0.3, 0.7] }, door: [10, 0.36, 0.64] },
    ],
    etage: [
      { pts: [[420,195],[585,195],[585,245],[990,245],[990,530],[800,530],[800,560],[420,560]], glass: { 2: [0.05, 0.95], 4: [0.08, 0.92], 3: [0.1, 0.9] } },
      { pts: [[440,760],[840,760],[840,1080],[590,1080],[590,915],[440,915]], glass: { 1: [0.1, 0.94], 2: [0.3, 0.7] } },
    ],
    // Dalles : rectangles [x0,y0,x1,y1]
    ground: [[440,195],[1070,1080]],
    deck: [[800,540,1000,1080],[1020,195,1070,540],[240,200,440,580]],
    pool: [[870,585],[1170,585],[1170,1075],[1000,1075],[1000,760],[870,760]],
    slab1: [[420,195,1045,560],[440,760,975,1080],[585,560,640,760],[440,560,600,780]],
    roof: [[405,175,1065,565],[440,565,810,755],[425,755,990,1100]],
    columns: [[1035,195,1070,345,'full'],[1040,520,1070,545,'full'],[958,770,1000,880,'rdc'],[920,1065,1000,1085,'rdc'],[1020,195,1045,315,'etage']],
    trees: [[350,120,5.5],[1130,500,5],[760,1150,6],[520,1290,5.5],[300,330,0],[910,110,0]],
    plot: [[240,150],[1260,1400]],
    rails: [[975,790,975,1080],[840,1080,975,1080],[585,195,1045,195],[1045,195,1045,540]],
    spheres: [[330,1000,0.55],[372,1062,0.35],[1160,340,0.6],[1120,470,0.4]],
  },
  celine: {
    plan: 1400, scale: 38, // bassin 15,00 m = 570 px
    rdcTex: 'img/plans/celine-rdc-3d.png', etageTex: 'img/plans/celine-etage-3d.png',
    facades: { east: 'img/facades/celine-east.jpg', west: 'img/facades/celine-west.jpg', north: 'img/facades/celine-north.jpg', south: 'img/facades/celine-south.jpg' },
    h: { rdc: 3.9, etage: 3.4, slab: 0.3, roof: 0.45 },
    rdc: [
      { pts: [[245,460],[370,460],[370,675],[500,675],[500,460],[1100,460],[1100,1150],[800,1150],[800,975],[245,975]],
        glass: { 2: [0.1, 0.9], 6: [0.1, 0.9], 7: [0.1, 0.9], 8: [0.04, 0.96], 9: [0.02, 0.45] }, door: [2, 0.32, 0.68] },
    ],
    etage: [
      { pts: [[245,460],[370,460],[370,610],[525,610],[525,975],[245,975]], glass: { 4: [0.1, 0.9], 5: [0.02, 0.5] }, dz: 0.9 },
      { pts: [[780,510],[990,510],[990,460],[1100,460],[1100,1150],[800,1150],[800,975],[780,975]], glass: { 0: [0.1, 0.9], 3: [0.3, 0.55], 4: [0.1, 0.9] } },
    ],
    ground: [[245,460],[1100,1150]],
    deck: [[190,975,800,1150],[800,1150,1130,1290],[780,250,1100,450]],
    pool: [[555,1025],[745,1025],[745,1345],[175,1345],[175,1155],[555,1155]],
    slab1: [[225,440,545,995],[760,440,1120,1170],[525,655,820,725],[190,975,525,1075],[800,1150,1100,1255],[1090,700,1160,870],[780,250,1100,450]],
    roof: [[225,440,800,1170,0.9],[760,440,1120,760,0.9],[760,740,1120,1170,0]],
    columns: [[190,1075,280,1115,'full'],[490,1075,530,1115,'full'],[780,1180,805,1290,'full'],[1020,1255,1130,1290,'full'],[780,250,800,270,'rdc'],[1080,250,1100,270,'rdc'],[780,430,800,450,'rdc'],[1080,430,1100,450,'rdc']],
    trees: [[305,195,6],[150,380,5.5],[640,330,6.5],[1210,95,6],[1210,330,5.5]],
    plot: [[120,20],[1340,1390]],
    rails: [[190,975,190,1075],[190,1075,525,1075],[800,1255,1100,1255],[1100,1150,1100,1255],[780,460,990,460],[1160,700,1160,870]],
    spheres: [[420,70,0.5],[520,370,0.35],[690,650,0.45],[150,1120,0.55]],
  },
  margaux: {
    plan: 1400, scale: 36.2, cam: 1.25, // bassin 16,00 m = 580 px ; villa plus large : caméra reculée
    rdcTex: 'img/plans/margaux-rdc-3d.png', etageTex: 'img/plans/margaux-etage-3d.png',
    facades: { east: 'img/facades/margaux-east.jpg', west: 'img/facades/margaux-west.jpg', north: 'img/facades/margaux-north.jpg', south: 'img/facades/margaux-south.jpg' },
    h: { rdc: 3.9, etage: 3.4, slab: 0.3, roof: 0.45 },
    rdc: [
      { pts: [[200,335],[455,335],[455,455],[905,455],[905,200],[1195,200],[1195,915],[455,915],[455,735],[200,735]],
        glass: { 2: [0.72, 0.98], 5: [0.62, 0.96], 6: [0.03, 0.97], 7: [0.1, 0.9], 8: [0.1, 0.9], 9: [0.05, 0.4] }, door: [2, 0.76, 0.95] },
    ],
    etage: [
      { pts: [[190,280],[455,280],[455,690],[190,690]], glass: { 2: [0.1, 0.9], 3: [0.05, 0.45] } },
      { pts: [[905,150],[1195,150],[1195,860],[745,860],[745,600],[850,600],[850,400],[905,400]], glass: { 0: [0.15, 0.85], 1: [0.1, 0.9], 2: [0.05, 0.95] } },
    ],
    ground: [[200,200],[1195,915]],
    deck: [[170,735,455,915],[170,915,1230,1170],[905,40,1195,200],[170,20,480,330],[730,0,905,455]],
    pool: [[515,950],[730,950],[730,1170],[915,1170],[915,1350],[335,1350],[335,1170],[515,1170]],
    slab1: [[190,205,455,690],[885,150,1195,860],[745,600,885,860],[455,540,1090,600],[1015,450,1090,600],[170,690,455,860],[745,860,1195,1060],[905,0,1230,150]],
    roof: [[170,185,475,710],[455,380,905,880],[885,130,1215,880]],
    columns: [[170,890,275,915,'full'],[170,20,205,110,'full'],[455,20,480,110,'full'],[1195,85,1230,160,'full'],[730,1030,765,1115,'full'],[1030,1085,1195,1115,'full'],[750,200,775,290,'full'],[185,520,200,600,'rdc']],
    pergola: [[170,20,480,210]],
    trees: [[660,330,6.5],[265,1270,6],[1120,1240,6],[1165,1175,5]],
    plot: [[100,0],[1300,1398]],
    rails: [[170,690,170,860],[170,860,455,860],[745,1060,1195,1060],[1195,860,1195,1060],[905,0,1230,0],[1230,0,1230,150]],
    spheres: [[640,50,0.55],[725,55,0.4],[690,140,0.5],[560,220,0.35]],
  },
};

// Matières d'après les photos : murs (travertin teinté), poteaux (marbre), lames de bois. Chloé : pierre sombre ; Céline : travertin et marbre gris ; Margaux : travertin clair.
const LOOK = { chloe: { wallTex: 'stone', wall: 0x4d4c4e, colTex: 'stone', column: 0xd9d9dc, slat: 0x8a5a34 }, celine: { wallTex: 'travertine', wall: 0xe9e2d6, colTex: 'marbled', column: 0xa9a9ad, slat: 0x9a6a3e }, margaux: { wallTex: 'travertine', wall: 0xf0e9dc, colTex: 'marbled', column: 0xa9a9ad, slat: 0x9a6a3e } };
const C = { ivory: 0xf5f3ee, wall: 0xffffff, slab: 0xf1eee7, deck: 0xe6e1d6, roof: 0xfbfaf7, glass: 0xc9dde2, water: 0xa9cdd4, ground: 0xf0ede6, tree: 0xd9dccf, trunk: 0xe3ddd0, line: 0xb59a6a };

export function mount(el, opts = {}) {
  const key = el.dataset.model; const M = MODELS[key]; if (!M) return null;
  el.querySelectorAll('canvas').forEach((c) => c.remove());
  const base = new URL('../', import.meta.url);
  const px = (x) => (x - M.plan / 2) / M.scale; // X en mètres
  const pz = (y) => (y - M.plan / 2) / M.scale; // Z en mètres
  const H = M.h, Y1 = H.rdc, Y2 = H.rdc + H.slab + H.etage, YR = Y2 + H.slab;

  const scene = new THREE.Scene(); scene.background = new THREE.Color(C.ivory);
  let skyPaint = null;
  if (opts.sky) { const c = document.createElement('canvas'); c.width = 2; c.height = 512; const g = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mix = (a, b, k) => '#' + [0, 1, 2].map((i) => Math.round(parseInt(a.substr(1 + i * 2, 2), 16) * (1 - k) + parseInt(b.substr(1 + i * 2, 2), 16) * k).toString(16).padStart(2, '0')).join('');
    skyPaint = (k) => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, mix('#6f9fd1', '#2f3550', k)); gr.addColorStop(0.55, mix('#c9dcec', '#7d6c84', k)); gr.addColorStop(1, mix('#efeee8', '#d9b08f', k)); g.fillStyle = gr; g.fillRect(0, 0, 2, 512); t.needsUpdate = true; };
    skyPaint(0); scene.background = t; }
  const W = el.clientWidth, Hh = el.clientHeight;
  const camera = new THREE.PerspectiveCamera(30, W / Hh, 0.5, 400); const kA = () => (M.cam || 1) * Math.max(1, 1.5 / (el.clientWidth / el.clientHeight)); // écrans étroits : on recule
  camera.position.set(27, 17, 29).multiplyScalar(kA());
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opts.quality ? 1.5 : Math.min(devicePixelRatio, 2)); renderer.setSize(W, Hh); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor'); el.appendChild(renderer.domElement);
  // Reflets : ciel HDR (Poly Haven, CC0) en environnement PBR ; le fond reste ivoire.
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load(new URL('textures/sky.hdr', base).href, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = 0.55; t.dispose(); pmrem.dispose(); }, undefined, () => pmrem.dispose());
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.5, 0); controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 14; controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.autoRotate = !opts.still; controls.autoRotateSpeed = 0.35; controls.enablePan = false;
  let idleT; renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; clearTimeout(idleT); idleT = setTimeout(() => { if (!opts.still) controls.autoRotate = true; }, 6000); });

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe6e0d3, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffefd8, 2.8); sun.position.set(-30, 34, 22); sun.castShadow = true;
  sun.shadow.mapSize.set(opts.quality ? 4096 : 2048, opts.quality ? 4096 : 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -40; sun.shadow.camera.right = sun.shadow.camera.top = 40; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
  scene.add(sun);

  const loader = new THREE.TextureLoader();
  const canvasTex = (draw, rep = 1) => { const c = document.createElement('canvas'); c.width = c.height = 512; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const travTex = canvasTex((g) => { g.fillStyle = '#cfc9bf'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 900; i++) { const x = Math.random() * 512; g.fillStyle = `rgba(${90 + Math.random() * 80},${85 + Math.random() * 70},${75 + Math.random() * 60},${0.08 + Math.random() * 0.25})`; g.fillRect(x, Math.random() * 512, 1 + Math.random() * 3, 20 + Math.random() * 160); } for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(60,55,50,${Math.random() * 0.25})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1 + Math.random() * 3); } });
  const gravelTex = canvasTex((g) => { g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 20000; i++) { const v = 150 + Math.random() * 90; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } }, 6);
  const rippleTex = canvasTex((g) => { g.fillStyle = '#8080ff'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 400; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 10 + Math.random() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(140,140,255,0.5)'); gr.addColorStop(1, 'rgba(128,128,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }, 4);
  rippleTex.colorSpace = THREE.NoColorSpace;
  const walnutTex = canvasTex((g) => { g.fillStyle = '#4a3222'; g.fillRect(0, 0, 512, 512); for (let p = 0; p < 8; p++) { g.fillStyle = `hsl(${20 + Math.random() * 6},${35 + Math.random() * 10}%,${18 + Math.random() * 8}%)`; g.fillRect(p * 64, 0, 64, 512); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(p * 64, 0, 2, 512); for (let k = 0; k < 30; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.lineWidth = 1; g.beginPath(); const x = p * 64 + Math.random() * 64; g.moveTo(x, 0); g.bezierCurveTo(x + 5, 170, x - 5, 340, x, 512); g.stroke(); } } });
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...o });
  // Textures PBR CC0 de /textures (couleur, normale, rugosité), répétées en mètres
  const pbr = (name, rep, o = {}) => { const t = (sfx, srgb) => { const x = loader.load(new URL(`textures/${name}_${sfx}.webp`, base).href); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(rep, rep); x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
    return new THREE.MeshStandardMaterial({ map: t('c', true), normalMap: t('n', false), roughnessMap: t('r', false), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, ...o }); };
  const LK = LOOK[key] || LOOK.celine;
  const mWall = pbr(LK.wallTex, 1.3, { color: LK.wall }), mSlab = pbr('concrete', 0.6, { color: 0xd9d4ca }), mDeck = pbr('concrete', 0.8, { color: 0xd3cdc1 }), mRoof = pbr('asphalt', 2.2, { color: 0x9c968c }), mTrunk = pbr('bark', 1.5, { color: 0xa08a70 });
  const texA = (name, srgb) => { const x = loader.load(new URL(`textures/${name}.webp`, base).href); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
  const mTree = new THREE.MeshStandardMaterial({ map: texA('leaf_c', true), normalMap: texA('leaf_n', false), normalScale: new THREE.Vector2(1.2, 1.2), color: 0x7f9e55, roughness: 0.9 }); mTree.map.repeat.set(2.5, 2.5); mTree.normalMap.repeat.set(2.5, 2.5);
  const mBox = new THREE.MeshStandardMaterial({ map: texA('leaf_c', true), normalMap: texA('leaf_n', false), normalScale: new THREE.Vector2(1.2, 1.2), color: 0x5e7f3f, roughness: 0.95 }); mBox.map.repeat.set(3, 3); mBox.normalMap.repeat.set(3, 3);
  const mFrond = new THREE.MeshStandardMaterial({ map: texA('frond_c', true), normalMap: texA('frond_n', false), color: 0x8aa857, roughness: 0.85, alphaTest: 0.45, side: THREE.DoubleSide });
  // Palme : rachis courbé (y = -1,1 t² + 0,25 t sur 3 m) et 2 × 20 folioles prises dans l'atlas de feuilles, fusionnées en une géométrie
  const frondGeo = (() => { const parts = []; const rach = (t) => new THREE.Vector3(3.0 * t, -1.1 * t * t + 0.25 * t, 0);
    const spine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([rach(0), rach(0.33), rach(0.66), rach(1)]), 10, 0.018, 5, false); const sUV = spine.attributes.uv; for (let k = 0; k < sUV.count; k++) sUV.setXY(k, 0.33, 0.5); parts.push(spine);
    const nL = 20; for (let i = 0; i < nL; i++) { const t = 0.08 + 0.9 * i / (nL - 1); const p = rach(t), p2 = rach(Math.min(1, t + 0.02)); const dir = p2.clone().sub(p).normalize(); const len = 0.75 * (1 - 0.55 * Math.pow(t - 0.35, 2)) ; const leaf = (i * 5) % 6;
      for (const side of [1, -1]) { const g = new THREE.PlaneGeometry(0.11, len, 1, 3); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (leaf + uv.getX(k)) / 6, uv.getY(k)); g.translate(0, len / 2, 0);
        const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(0, 0, 0); const yaw = Math.atan2(dir.y, dir.x);
        g.rotateZ(-Math.PI / 2); g.rotateX(side * 0.6); g.rotateZ(yaw - side * 0.95 - 0.25 * t); g.rotateY(side * 0.15); g.translate(p.x, p.y, p.z + side * 0.015); parts.push(g); } }
    const merged = (BGU.mergeGeometries || BGU.mergeBufferGeometries)(parts, false); merged.computeVertexNormals(); return merged; })();
  const travMap = loader.load(new URL('img/tex/travertin.jpg', base).href); travMap.colorSpace = THREE.SRGBColorSpace; travMap.wrapS = travMap.wrapT = THREE.RepeatWrapping; travMap.anisotropy = 8; travMap.repeat.set(1, 1);
  const travNor = loader.load(new URL('img/tex/travertin-normal.jpg', base).href); travNor.wrapS = travNor.wrapT = THREE.RepeatWrapping; const travRgh = loader.load(new URL('img/tex/travertin-rough.jpg', base).href); travRgh.wrapS = travRgh.wrapT = THREE.RepeatWrapping;
  const marbleTex = canvasTex((g) => { g.fillStyle = '#626466'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1800; i++) { const v = 80 + Math.random() * 50; g.fillStyle = `rgba(${v},${v},${v + 3},${Math.random() * 0.22})`; const x = Math.random() * 512, y = Math.random() * 512; g.beginPath(); g.ellipse(x, y, 8 + Math.random() * 40, 3 + Math.random() * 10, Math.random() * 3, 0, 6.3); g.fill(); }
    for (let k = 0; k < 7; k++) { const pts = []; let x = -20, y = Math.random() * 512; for (let j = 0; j < 6; j++) { pts.push([x, y]); x += 100 + Math.random() * 30; y += (Math.random() - 0.5) * 90; }
      for (let w = 7; w >= 1; w -= 2) { g.strokeStyle = `rgba(220,220,224,${w === 1 ? 0.5 : 0.07})`; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) g.quadraticCurveTo((pts[j - 1][0] + pts[j][0]) / 2 + 20, (pts[j - 1][1] + pts[j][1]) / 2 + (Math.random() - 0.5) * 20, pts[j][0], pts[j][1]); g.stroke(); } }
  }, 1);
  const mStone = pbr(LK.colTex, 0.7, { color: LK.column, roughness: 0.28, metalness: 0.05, envMapIntensity: 0.9 }); mStone.normalScale.set(0.25, 0.25);
  const mLedLine = mat(0xfff1d6, { emissive: 0xffd9a0, emissiveIntensity: 1.6, roughness: 0.6 }); const mBronze = mat(0x2b2521, { roughness: 0.45, metalness: 0.4 }); const mAlu = mat(0x141414, { roughness: 0.35, metalness: 0.6 });
  const mSlabEdge = [mBronze, mBronze, mSlab, mBronze, mBronze, mBronze];
  const soffitTex = canvasTex((g) => { g.fillStyle = '#6b4b32'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 24; i++) { g.fillStyle = `hsl(${24 + Math.random() * 6},${40 + Math.random() * 10}%,${26 + Math.random() * 8}%)`; g.fillRect(0, i * 21.3, 512, 15); g.fillStyle = '#1f1612'; g.fillRect(0, i * 21.3 + 15, 512, 6.3); } }, 1);
  const mSoffit = pbr('wood', 0.8, { color: LK.slat, roughness: 0.6 }); mSoffit.map.rotation = Math.PI / 2; mSoffit.normalMap.rotation = Math.PI / 2; mSoffit.roughnessMap.rotation = Math.PI / 2; const mCoping = new THREE.MeshStandardMaterial({ map: travMap, normalMap: travNor, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.85 });
  const mGlass = new THREE.MeshPhysicalMaterial({ color: 0x6f8a92, transparent: true, opacity: 0.55, roughness: 0.04, metalness: 0, transmission: 0, envMapIntensity: 1.6, emissive: new THREE.Color(0xffd79a), emissiveIntensity: 0 });
  const mWater = new THREE.MeshPhysicalMaterial({ color: 0x4fa6b8, transparent: true, opacity: 0.88, roughness: 0.03, metalness: 0.05, envMapIntensity: 1.4, normalMap: rippleTex, normalScale: new THREE.Vector2(0.35, 0.35), emissive: new THREE.Color(0x7fb5c4), emissiveIntensity: 0 });
  // Façades : les élévations des architectes (avant, arrière, latérales) sont projetées sur les murs extérieurs selon leur orientation.
  const facMats = {}; let facBox = null;
  if (M.facades && opts.elevations) {
    const pts = [...M.rdc, ...M.etage].flatMap((p) => p.pts); const xs = pts.map((p) => px(p[0])), zs = pts.map((p) => pz(p[1]));
    facBox = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), h: H.rdc + H.slab + H.etage + H.roof };
    for (const [dir, file] of Object.entries(M.facades)) {
      const t = loader.load(new URL(file, base).href); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      facMats[dir] = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(0x000000), roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide });
    }
  }
  const facUV = (dir, x, y, z) => { // (u,v) dans l'élévation : vue de l'extérieur, gauche→droite
    const b = facBox; let u = 0;
    if (dir === 'east') u = (b.z1 - z) / (b.z1 - b.z0); else if (dir === 'west') u = (z - b.z0) / (b.z1 - b.z0); else if (dir === 'south') u = (x - b.x0) / (b.x1 - b.x0); else u = (b.x1 - x) / (b.x1 - b.x0);
    return [u, y / b.h];
  };
  const groups = { rdc: new THREE.Group(), etage: new THREE.Group(), roof: new THREE.Group(), site: new THREE.Group() };
  // Film de construction : étape courante appliquée aux objets créés ensuite ([début, fin] en fraction du film, mode)
  let stage = null; const staged = []; const setStage = (a, b, mode) => { stage = a === null ? null : { a, b, mode }; };
  const tag = (o) => { if (stage) { o.userData.stage = { ...stage, y: o.position.y, s: o.scale.clone() }; staged.push(o); } return o; };
  Object.values(groups).forEach((g) => scene.add(g));

  const scaleBoxUV = (geo, w, h, d, unit = 1.6) => { // faces de BoxGeometry : +x,-x,+y,-y,+z,-z (4 sommets chacune)
    const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit); }
    uv.needsUpdate = true; return geo;
  };
  const box = (x0, y0, x1, y1, yb, yt, m, g, shadow = true) => {
    const w = Math.abs(px(x1) - px(x0)), d = Math.abs(pz(y1) - pz(y0));
    const mesh = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, yt - yb, d), w, yt - yb, d), m);
    mesh.position.set((px(x0) + px(x1)) / 2, (yb + yt) / 2, (pz(y0) + pz(y1)) / 2); mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); mesh.userData.h = yt - yb; return tag(mesh);
  };
  // Murs : une boîte par arête, décalée vers l'intérieur ; partie vitrée = panneau translucide.
  const walls = (poly, yb, yt, g) => {
    const stageSave = stage || { a: null }; const P = poly.pts, n = P.length, t = 0.3;
    // orientation (pour décaler vers l'intérieur) : aire signée
    let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const inward = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      const ax = px(a[0]), az = pz(a[1]), bx = px(b[0]), bz = pz(b[1]);
      const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
      const nx = -Math.sin(ang) * inward, nz = Math.cos(ang) * inward; // normale intérieure
      const seg = (t0, t1, m, hb, ht, cast) => {
        const len = L * (t1 - t0); if (len <= 0.01) return;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, ht - hb, m === mGlass ? 0.06 : t), m);
        const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2;
        mesh.position.set(cx + nx * t / 2, (hb + ht) / 2, cz + nz * t / 2); mesh.rotation.y = -ang; mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh); mesh.userData.h = ht - hb; tag(mesh);
      };
      const ox = -nx, oz = -nz; // normale extérieure
      // Menuiseries aluminium noir en relief devant une baie : cadre, meneaux, traverse
      const frames = (gl2) => {
        const t0 = gl2[0], t1 = gl2[1], len = L * (t1 - t0), hb = yb + 0.02, ht = yt - 0.05, h = ht - hb; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2; const off = 0.045;
        const fr = new THREE.Group(); fr.position.set(cx + ox * off, 0, cz + oz * off); fr.rotation.y = -ang; g.add(fr); setStage(0.80, 0.88, 'pop'); tag(fr); setStage(stageSave.a, stageSave.b, stageSave.mode);
        const bar = (w_, h_, d_, x_, y_) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w_, h_, d_), mAlu); m.position.set(x_, y_, 0); m.castShadow = true; fr.add(m); };
        bar(len, 0.05, 0.05, 0, hb + 0.025); bar(len, 0.05, 0.05, 0, ht - 0.025); bar(0.05, h, 0.05, -len / 2 + 0.025, hb + h / 2); bar(0.05, h, 0.05, len / 2 - 0.025, hb + h / 2);
        const nm = Math.max(0, Math.round(len / 1.3) - 1); for (let k = 1; k <= nm; k++) bar(0.035, h, 0.035, -len / 2 + len * k / (nm + 1), hb + h / 2);
      };
      // Panneau de lames de bois verticales sur le mur plein voisin d'une baie (comme sur les photos)
      const slats = (t0, t1) => {
        const len = L * (t1 - t0); if (len < 0.8) return; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2;
        const sg = new THREE.Group(); sg.position.set(cx + ox * 0.04, 0, cz + oz * 0.04); sg.rotation.y = -ang; g.add(sg); tag(sg);
        const n = Math.max(2, Math.round(len / 0.14)); for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, yt - yb - 0.1, 0.06), mSoffit); m.position.set(-len / 2 + 0.07 + k * (len - 0.14) / (n - 1), (yb + yt) / 2, 0); m.castShadow = true; sg.add(m); }
      };
      if (!facBox) { // façade en matière : travertin, baies vitrées, menuiseries, lames de bois
        const gl = poly.glass && poly.glass[i];
        if (!gl) { seg(0, 1, mWall, yb, yt, true); }
        else {
          seg(0, gl[0], mWall, yb, yt, true); seg(gl[1], 1, mWall, yb, yt, true);
          seg(gl[0], gl[1], mGlass, yb + 0.05, yt - 0.25, false); seg(gl[0], gl[1], mWall, yt - 0.25, yt, true); // linteau
          frames(gl); if (gl[0] > 0.12 && gl[0] * L > 1.2) slats(Math.max(0.02, gl[0] - Math.min(0.3, 1.8 / L)), gl[0] - 0.01); if (gl[1] < 0.88 && (1 - gl[1]) * L > 1.2) slats(gl[1] + 0.01, Math.min(0.98, gl[1] + Math.min(0.3, 1.8 / L)));
        }
        if (poly.door && poly.door[0] === i) {
          const [, d0, d1] = poly.door; const len = L * (d1 - d0), cx = ax + (bx - ax) * (d0 + d1) / 2, cz = az + (bz - az) * (d0 + d1) / 2; const hd = Math.min(2.7, yt - yb - 0.2);
          const dg = new THREE.Group(); dg.position.set(cx + ox * 0.03, 0, cz + oz * 0.03); dg.rotation.y = -ang; g.add(dg); setStage(0.84, 0.9, 'pop'); tag(dg); setStage(stageSave.a, stageSave.b, stageSave.mode);
          const door = new THREE.Mesh(new THREE.BoxGeometry(len, hd, 0.06), new THREE.MeshStandardMaterial({ map: walnutTex, roughness: 0.5 })); door.position.set(0, yb + hd / 2, 0); door.castShadow = true; dg.add(door);
          const fr2 = new THREE.Mesh(new THREE.BoxGeometry(len + 0.16, hd + 0.08, 0.05), mAlu); fr2.position.set(0, yb + hd / 2 + 0.04, -0.02); dg.add(fr2);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), mat(0xb08d57, { roughness: 0.3, metalness: 0.9 })); handle.position.set(len * 0.3, yb + 1.1, 0.07); dg.add(handle);
        }
        continue;
      }
      { // façade texturée : mur plein + élévation plaquée dehors
        seg(0, 1, mWall, yb, yt, true);
        const dir = Math.abs(ox) > Math.abs(oz) ? (ox > 0 ? 'east' : 'west') : (oz > 0 ? 'south' : 'north');
        const mtl = facMats[dir]; if (!mtl) continue;
        const geo = new THREE.PlaneGeometry(L, yt - yb); const mesh = new THREE.Mesh(geo, mtl);
        mesh.position.set((ax + bx) / 2 + ox * 0.012, (yb + yt) / 2, (az + bz) / 2 + oz * 0.012); mesh.rotation.y = -ang; mesh.updateMatrixWorld(true);
        const pos = geo.attributes.position, uv = geo.attributes.uv; const w = new THREE.Vector3();
        for (let k = 0; k < pos.count; k++) { w.set(pos.getX(k), pos.getY(k), pos.getZ(k)); mesh.localToWorld(w); const [u, v] = facUV(dir, w.x, w.y, w.z); uv.setXY(k, u, v); }
        uv.needsUpdate = true; mesh.receiveShadow = true; g.add(mesh); mesh.userData.h = yt - yb; tag(mesh);
        // menuiseries aluminium noir en relief devant chaque baie : cadre, meneaux tous les 1,3 m, traverse
        const gl2 = poly.glass && poly.glass[i];
        if (gl2) {
          const t0 = gl2[0], t1 = gl2[1], len = L * (t1 - t0), hb = yb + 0.02, ht = yt - 0.05, h = ht - hb; const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2; const off = 0.045;
          const fr = new THREE.Group(); fr.position.set(cx + ox * off, 0, cz + oz * off); fr.rotation.y = -ang; g.add(fr); setStage(0.80, 0.88, 'pop'); tag(fr); setStage(stageSave.a, stageSave.b, stageSave.mode);
          const bar = (w_, h_, d_, x_, y_) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w_, h_, d_), mAlu); m.position.set(x_, y_, 0); m.castShadow = true; fr.add(m); };
          bar(len, 0.05, 0.05, 0, hb + 0.025); bar(len, 0.05, 0.05, 0, ht - 0.025); bar(0.05, h, 0.05, -len / 2 + 0.025, hb + h / 2); bar(0.05, h, 0.05, len / 2 - 0.025, hb + h / 2);
          if (len > 5) bar(0.04, h, 0.04, 0, hb + h / 2);
        }
        if (poly.door && poly.door[0] === i) { // porte d'entrée en noyer, cadre alu noir, poignée laiton
          const [, d0, d1] = poly.door; const len = L * (d1 - d0), cx = ax + (bx - ax) * (d0 + d1) / 2, cz = az + (bz - az) * (d0 + d1) / 2; const hd = Math.min(2.7, yt - yb - 0.2);
          const dg = new THREE.Group(); dg.position.set(cx + ox * 0.03, 0, cz + oz * 0.03); dg.rotation.y = -ang; g.add(dg); setStage(0.84, 0.9, 'pop'); tag(dg); setStage(stageSave.a, stageSave.b, stageSave.mode);
          const door = new THREE.Mesh(new THREE.BoxGeometry(len, hd, 0.06), new THREE.MeshStandardMaterial({ map: walnutTex, roughness: 0.5 })); door.position.set(0, yb + hd / 2, 0); door.castShadow = true; dg.add(door);
          const fr2 = new THREE.Mesh(new THREE.BoxGeometry(len + 0.16, hd + 0.08, 0.05), mAlu); fr2.position.set(0, yb + hd / 2 + 0.04, -0.02); dg.add(fr2);
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), mat(0xb08d57, { roughness: 0.3, metalness: 0.9 })); handle.position.set(len * 0.3, yb + 1.1, 0.07); dg.add(handle);
        }
        continue;
      }
    }
  };

  // Sol, parcelle, dalle, terrasses, bassin
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), pbr('concrete', 70, { color: 0xeae5db, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; groups.site.add(ground);
  const lawnTex = canvasTex((g) => { g.fillStyle = '#9aa882'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 30000; i++) { const v = Math.random(); g.fillStyle = `rgb(${130 + v * 40},${150 + v * 35},${100 + v * 30})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } }, 10);
  const [p0, p1] = M.plot; const plot = new THREE.Mesh(new THREE.PlaneGeometry(px(p1[0]) - px(p0[0]), pz(p1[1]) - pz(p0[1])), pbr('grass', 14, { color: 0xadc08e })); plot.rotation.x = -Math.PI / 2; plot.position.set((px(p0[0]) + px(p1[0])) / 2, -0.01, (pz(p0[1]) + pz(p1[1])) / 2); plot.receiveShadow = true; groups.site.add(plot);
  const planTex = (file, y, g, size) => {
    const tex = loader.load(new URL(file, base).href); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, opacity: g === groups.rdc ? 0.82 : 1 });
    const s = size / M.scale; const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true; if (opts.sky && g === groups.rdc) mesh.visible = false; g.add(mesh); return mesh;
  };
  setStage(0.08, 0.2, 'grow'); const [g0, g1] = M.ground; box(g0[0], g0[1], g1[0], g1[1], 0, 0.15, mSlab, groups.rdc, false);
  M.deck.forEach(([x0, y0, x1, y1]) => box(x0, y0, x1, y1, 0.15, 0.17, mDeck, groups.rdc, false));
  setStage(null); planTex(M.rdcTex, 0.19, groups.rdc, M.plan); // plan RDC posé sur la dalle (et le jardin)
  // bassin
  const poolShape = new THREE.Shape(M.pool.map(([x, y]) => new THREE.Vector2(px(x), -pz(y))));
  const pool = new THREE.Mesh(new THREE.ShapeGeometry(poolShape), mWater); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.2; groups.rdc.add(pool); setStage(0.9, 0.97, 'rise'); tag(pool); setStage(0.14, 0.24, 'grow');
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(poolShape, { depth: 1.5, bevelEnabled: false }), pbr('tiles', 2, { color: 0x3f8e9c, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.18; rim.receiveShadow = true; groups.rdc.add(rim); setStage(0.16, 0.24, 'pop'); tag(rim);
  const copingShape = new THREE.Shape(M.pool.map(([x, y]) => new THREE.Vector2(px(x), -pz(y)))); const cop = new THREE.Mesh(new THREE.ExtrudeGeometry(copingShape, { depth: 0.06, bevelEnabled: false }), mCoping); cop.rotation.x = Math.PI / 2; cop.position.y = 0.24; cop.scale.set(1.04, 1.04, 1); groups.rdc.add(cop); tag(cop); cop.position.x -= (cop.scale.x - 1) * 0; 
  // murs RDC
  setStage(0.22, 0.42, 'grow'); M.rdc.forEach((poly) => walls(poly, 0.15, Y1, groups.rdc));
  // dalle d'étage + plan d'étage
  setStage(0.42, 0.5, 'grow'); M.slab1.forEach(([x0, y0, x1, y1]) => box(x0, y0, x1, y1, Y1, Y1 + H.slab, mSlabEdge, groups.etage));
  setStage(0.5, 0.56, 'pop'); planTex(M.etageTex, Y1 + H.slab + 0.02, groups.etage, M.plan);
  setStage(0.52, 0.7, 'grow'); M.etage.forEach((poly) => walls(poly, Y1 + H.slab, Y2, groups.etage));
  // toiture : dalle débordante, fine, avec acrotère
  const mFascia = mat(0x2b2521, { roughness: 0.5, metalness: 0.3 });
  const ledEdges = (x0, y0, x1, y1, y, g) => { const i = 0.06; box(x0 + 1, y0 + 1, x1 - 1, y0 + 3, y, y + 0.025, mLedLine, g, false); box(x0 + 1, y1 - 3, x1 - 1, y1 - 1, y, y + 0.025, mLedLine, g, false); box(x0 + 1, y0 + 1, x0 + 3, y1 - 1, y, y + 0.025, mLedLine, g, false); box(x1 - 3, y0 + 1, x1 - 1, y1 - 1, y, y + 0.025, mLedLine, g, false); };
  setStage(0.7, 0.8, 'drop'); M.roof.forEach(([x0, y0, x1, y1, dz = 0]) => { box(x0, y0, x1, y1, Y2 + dz, Y2 + dz + H.roof, [mFascia, mFascia, mRoof, mSoffit, mFascia, mFascia], groups.roof); ledEdges(x0, y0, x1, y1, Y2 + dz - 0.03, groups.roof); });
  // pergola : lames
  (M.pergola || []).forEach(([x0, y0, x1, y1]) => { const n = 14; for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; box(x0, y - 2, x1, y + 2, Y1 + 0.1, Y1 + 0.3, mRoof, groups.etage); } box(x0, y0, x0 + 6, y1, Y1, Y1 + 0.3, mRoof, groups.etage); box(x1 - 6, y0, x1, y1, Y1, Y1 + 0.3, mRoof, groups.etage); });
  setStage(0.86, 0.92, 'pop');
  // garde-corps des terrasses d'étage : verre fumé, main courante alu noir
  const mRailGlass = new THREE.MeshPhysicalMaterial({ color: 0x9fb2b6, transparent: true, opacity: 0.35, roughness: 0.1 });
  (M.rails || []).forEach(([x0, y0, x1, y1]) => {
    const ax = px(x0), az = pz(y0), bx = px(x1), bz = pz(y1); const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax); const yb = Y1 + H.slab;
    const gl = new THREE.Mesh(new THREE.BoxGeometry(L, 1.05, 0.02), mRailGlass); gl.position.set((ax + bx) / 2, yb + 0.55, (az + bz) / 2); gl.rotation.y = -ang; groups.etage.add(gl); tag(gl);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, 0.05), mAlu); hr.position.set((ax + bx) / 2, yb + 1.08, (az + bz) / 2); hr.rotation.y = -ang; hr.castShadow = true; groups.etage.add(hr); tag(hr);
    const n = Math.max(1, Math.round(L / 1.5)); for (let k = 0; k <= n; k++) { const t = k / n; const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 0.03), mAlu); p.position.set(ax + (bx - ax) * t, yb + 0.55, az + (bz - az) * t); groups.etage.add(p); tag(p); }
  });
  setStage(0.3, 0.46, 'grow');
  // poteaux
  M.columns.forEach(([x0, y0, x1, y1, lv]) => { const yt = lv === 'rdc' ? Y1 : Y2; const yb = lv === 'etage' ? Y1 + H.slab : 0.15; box(x0, y0, x1, y1, yb, yt, mStone, lv === 'rdc' ? groups.rdc : lv === 'etage' ? groups.etage : groups.roof); });
  setStage(0.92, 0.98, 'pop'); const mBoule = mBox;
  (M.spheres || []).forEach(([x, y, r]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 24), mBoule); b.position.set(px(x), r, pz(y)); b.castShadow = b.receiveShadow = true; groups.site.add(b); tag(b); });
  // arbres : palmiers stylisés (tronc + couronne), buissons (sphères)
  setStage(0.9, 1.0, 'pop'); M.trees.forEach(([x, y, h]) => {
    const X = px(x), Z = pz(y);
    if (h > 0) { // palmier : stipe incliné en écorce, couronne de palmes texturées retombantes
      const lean = ((h * 7.3) % 1 - 0.5) * 0.14, seed = (h * 13.7) % 1;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, h, 9), mTrunk); trunk.position.set(X, h / 2, Z); trunk.rotation.set(lean, 0, lean); trunk.castShadow = true; groups.site.add(trunk); tag(trunk);
      const crown = new THREE.Group(); crown.position.set(X + Math.sin(lean) * h / 2, h, Z - Math.sin(lean) * h / 2); groups.site.add(crown); tag(crown);
      const n = 13; for (let k = 0; k < n; k++) { const a = seed * 6.28 + (k / n) * Math.PI * 2; const f = new THREE.Mesh(frondGeo, mFrond); f.rotation.set(0, -a, 0.35 + ((k * 0.37) % 1) * 0.3); f.scale.setScalar(0.85 + ((k * 0.61) % 1) * 0.35); f.castShadow = true; crown.add(f); }
      for (let k = 0; k < 4; k++) { const a = seed * 6.28 + (k / 4) * Math.PI * 2 + 0.4; const f = new THREE.Mesh(frondGeo, mFrond); f.rotation.set(0, -a, 1.25); f.scale.setScalar(0.8); crown.add(f); } // palmes basses
    } else { // buisson taillé : sphère de feuillage légèrement aplatie
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 3), mTree); b.position.set(X, 0.7, Z); b.scale.set(1, 0.65, 0.9); b.rotation.y = (X * 3.1) % 6.28; b.castShadow = b.receiveShadow = true; groups.site.add(b); tag(b); }
  });

  // Nuit / jour : ciel crépusculaire, soleil bas et chaud, baies allumées, lampes sous les terrasses.
  const lamps = new THREE.Group(); scene.add(lamps);
  const lampAt = (x, z, y) => { const l = new THREE.PointLight(0xffc98a, 0, 14, 2); l.position.set(x, y, z); lamps.add(l); };
  M.deck.slice(0, 2).forEach(([x0, y0, x1, y1]) => lampAt((px(x0) + px(x1)) / 2, (pz(y0) + pz(y1)) / 2, Y1 - 0.4));
  lampAt(0, 0, Y1 - 0.3);
  const DAY = { bg: new THREE.Color(C.ivory), ground: new THREE.Color(C.ground), hemi: 1.1, hemiSky: new THREE.Color(0xffffff), sun: 2.8, sunCol: new THREE.Color(0xffefd8), sunPos: new THREE.Vector3(-30, 34, 22), glow: 0, water: 0, lamp: 0, expo: 1.15 };
  const NIGHT = { bg: new THREE.Color(0x7c8398), ground: new THREE.Color(0x9a9ca6), hemi: 0.95, hemiSky: new THREE.Color(0xc3cae0), sun: 1.0, sunCol: new THREE.Color(0xffd0a0), sunPos: new THREE.Vector3(-46, 12, 26), glow: 0.9, water: 0.45, lamp: 14, expo: 1.05 };
  let night = opts.night ? 1 : 0, nightTarget = night;
  const applyNight = (k) => {
    if (skyPaint) skyPaint(k); else scene.background.copy(DAY.bg).lerp(NIGHT.bg, k); ground.material.color.copy(DAY.ground).lerp(NIGHT.ground, k); plot.material.color.copy(DAY.ground).lerp(NIGHT.ground, k).offsetHSL(0, 0, 0.015);
    hemi.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, k); hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, k);
    sun.intensity = THREE.MathUtils.lerp(DAY.sun, NIGHT.sun, k); sun.color.copy(DAY.sunCol).lerp(NIGHT.sunCol, k); sun.position.lerpVectors(DAY.sunPos, NIGHT.sunPos, k);
    mGlass.emissiveIntensity = THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, k); mGlass.opacity = THREE.MathUtils.lerp(0.45, 0.7, k);
    mWater.emissiveIntensity = THREE.MathUtils.lerp(DAY.water, NIGHT.water, k);
    Object.values(facMats).forEach((m) => { m.emissive.setRGB(0, 0, 0).lerp(new THREE.Color(0xb08a55), k); });
    lamps.children.forEach((l) => { l.intensity = THREE.MathUtils.lerp(DAY.lamp, NIGHT.lamp, k); });
    renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.expo, NIGHT.expo, k);
  };
  if (night) setTimeout(() => applyNight(1), 0);
  const nightBtn = el.querySelector('[data-night]'); nightBtn?.setAttribute('aria-pressed', 'false');
  nightBtn?.addEventListener('click', () => { nightTarget = nightTarget ? 0 : 1; nightBtn.setAttribute('aria-pressed', !!nightTarget); });

  // Maquette des architectes (GLB) : remplace les volumes blancs quand elle est déclarée dans config.js.
  let glbRoot = null; const glbCfg = (window.WH_CONFIG && window.WH_CONFIG.models3d && window.WH_CONFIG.models3d[key]) || null;
  if (glbCfg && glbCfg.url) {
    new GLTFLoader().load(new URL(glbCfg.url, base).href, (g) => {
      glbRoot = g.scene; glbRoot.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      const sc_ = glbCfg.scale || 1; glbRoot.scale.setScalar(sc_); glbRoot.rotation.y = THREE.MathUtils.degToRad(glbCfg.rotation || 0); const off = glbCfg.offset || [0, 0, 0]; glbRoot.position.set(off[0], off[1], off[2]);
      scene.add(glbRoot); [groups.rdc, groups.etage, groups.roof].forEach((gr) => { gr.visible = false; });
      el.querySelectorAll('[data-view="rdc"],[data-view="etage"]').forEach((b) => { b.hidden = true; }); el.classList.add('has-glb');
    }, undefined, (e) => console.warn('Maquette GLB indisponible', e));
  }
  setStage(null);
  const easeB = (t) => 1 - Math.pow(1 - t, 3);
  const setBuild = (t) => { // t ∈ [0,1] : chantier
    staged.forEach((o) => { const st = o.userData.stage; const p = Math.max(0, Math.min(1, (t - st.a) / (st.b - st.a))); const e = easeB(p);
      if (st.mode === 'grow') { const h = o.userData.h || 1; o.scale.y = Math.max(0.001, e) * st.s.y; o.position.y = st.y - h / 2 + (h * e) / 2; o.visible = p > 0; }
      else if (st.mode === 'drop') { o.position.y = st.y + (1 - e) * 9; o.visible = p > 0; }
      else if (st.mode === 'pop') { o.visible = p > 0; o.scale.setScalar(st.s.x * (0.001 + 0.999 * e)); }
      else if (st.mode === 'rise') { o.position.y = st.y - 1.2 + 1.2 * e; o.visible = p > 0; } });
  };
  // Vues
  const setView = (v) => {
    if (glbRoot) { animateTo([27, 17, 29].map((x) => x * kA()), [0, 2.5, 0]); return; }
    groups.etage.visible = v !== 'rdc'; groups.roof.visible = v === 'all';
    el.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v));
    const tgt = v === 'all' ? [0, 2.5, 0] : v === 'rdc' ? [1, 0, 1] : [1, 4, 1];
    const pos = v === 'all' ? [27, 17, 29] : v === 'rdc' ? [13, 28, 17] : [14, 28, 18];
    animateTo(pos.map((v) => v * kA()), tgt);
  };
  let anim = null;
  if (opts.still) {
    const R = 46 * (M.cam || 1) * (opts.dist || 1), a = opts.angle || 0.65, v = opts.view || 'all';
    groups.etage.visible = v !== 'rdc'; groups.roof.visible = v === 'all';
    const el_ = opts.elev || (v === 'all' ? 0.42 : 0.95); camera.position.set(Math.cos(a) * R * Math.cos(el_), R * Math.sin(el_), Math.sin(a) * R * Math.cos(el_)); controls.target.set(0, v === 'all' ? 2 : 1, 0); controls.enableDamping = false;
  }
  const animateTo = (pos, tgt) => { anim = { t: 0, p0: camera.position.clone(), p1: new THREE.Vector3(...pos), t0: controls.target.clone(), t1: new THREE.Vector3(...tgt) }; };
  el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  el.querySelector('[data-reset]')?.addEventListener('click', () => { controls.autoRotate = true; setView('all'); });

  const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); });
  ro.observe(el);
  let visible = true; new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(el);
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  // ---- WebXR : visite à l'échelle 1 (casque Quest, téléphone compatible). Rig = position du visiteur ; téléportation à la gâchette, marche au joystick.
  const rig = new THREE.Group(); scene.add(rig);
  const startPos = () => { const d = M.deck[0]; return new THREE.Vector3((px(d[0]) + px(d[2])) / 2, 0.17, (pz(d[1]) + pz(d[3])) / 2); };
  const floorTargets = () => [...groups.rdc.children, ...groups.etage.children, ...groups.site.children].filter((o) => o.isMesh && o.geometry.type !== 'PlaneGeometry' || (o.isMesh && o === ground));
  const ray = new THREE.Raycaster(); const tmpM = new THREE.Matrix4(); const ctrls = [];
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i); const line = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xb59a6a })); line.scale.z = 6; c.add(line); rig.add(c); ctrls.push(c);
    c.addEventListener('selectstart', () => {
      tmpM.identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
      const hit = ray.intersectObjects(floorTargets(), false).find((h) => h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7);
      if (hit) rig.position.set(hit.point.x, hit.point.y, hit.point.z);
    });
  }
  const camHome = { pos: camera.position.clone(), tgt: controls.target.clone() };
  renderer.xr.addEventListener('sessionstart', () => { camHome.pos.copy(camera.position); camHome.tgt.copy(controls.target); controls.enabled = false; rig.position.copy(startPos()); rig.add(camera); groups.etage.visible = true; groups.roof.visible = true; });
  renderer.xr.addEventListener('sessionend', () => { scene.add(camera); camera.position.copy(camHome.pos); controls.target.copy(camHome.tgt); controls.enabled = true; });
  const vrBtn = el.querySelector('[data-vr]');
  if (vrBtn) {
    if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { vrBtn.hidden = !ok; }).catch(() => { vrBtn.hidden = true; }); else vrBtn.hidden = true;
    vrBtn.addEventListener('click', async () => {
      if (renderer.xr.getSession()) { renderer.xr.getSession().end(); return; }
      try { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }); await renderer.xr.setSession(s); vrBtn.setAttribute('aria-pressed', 'true'); s.addEventListener('end', () => vrBtn.setAttribute('aria-pressed', 'false')); } catch (e) { console.warn('VR', e); }
    });
  }
  const walk = (dt) => { // joystick : avance dans la direction du regard
    const s = renderer.xr.getSession(); if (!s) return;
    for (const src of s.inputSources) { const g = src.gamepad; if (!g || g.axes.length < 4) continue; const ax = g.axes[2], ay = g.axes[3]; if (Math.abs(ax) < 0.15 && Math.abs(ay) < 0.15) continue;
      const xrCam = renderer.xr.getCamera(); const fwd = new THREE.Vector3(); xrCam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
      rig.position.addScaledVector(fwd, -ay * dt * 1.6).addScaledVector(right, ax * dt * 1.6); }
  };
  let alive = true;
  const loop = () => {
    if (!alive) return; if (!visible && !renderer.xr.isPresenting) return;
    if (anim) { anim.t = Math.min(1, anim.t + 0.02); const k = ease(anim.t); camera.position.lerpVectors(anim.p0, anim.p1, k); controls.target.lerpVectors(anim.t0, anim.t1, k); if (anim.t >= 1) anim = null; }
    const now = performance.now(), dt = Math.min(0.1, (now - (loop.t || now)) / 1000); loop.t = now;
    if (night !== nightTarget) { night += Math.sign(nightTarget - night) * dt / 1.2; if (Math.abs(night - nightTarget) < 0.03) night = nightTarget; applyNight(night); }
    if (renderer.xr.isPresenting) walk(dt); else controls.update();
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);
  const snapshot = (type = 'image/jpeg', q = 0.92) => { controls.update(); renderer.render(scene, camera); return renderer.domElement.toDataURL(type, q); };
  const setCam = (a, el_, dist, ty = 2.5) => { const R = 46 * (M.cam || 1) * dist; camera.position.set(Math.cos(a) * R * Math.cos(el_), R * Math.sin(el_), Math.sin(a) * R * Math.cos(el_)); controls.target.set(0, ty, 0); controls.update(); };
  const setNight = (k) => { night = nightTarget = k; applyNight(k); };
  return { snapshot, setBuild, setCam, setNight, scene: opts.exportMode ? scene : undefined, dispose() { alive = false; renderer.setAnimationLoop(null); ro.disconnect(); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
export const available = Object.keys(MODELS);
window.WH3D = { mount, available };
document.querySelectorAll('[data-model]').forEach((el) => { if (!el.hasAttribute('data-manual')) mount(el); });
