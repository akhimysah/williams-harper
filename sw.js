// Service worker : mise en cache des pages visitées et des ressources statiques, consultation hors ligne.
const C='wh-v60';
const CORE=['index.html','styles.css','fx.js','wow.js','wow2.js','config.js','forms.js','img/logo.png','img/logo-dark.png','villa-chloe.html','villa-celine.html','villa-margaux.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'}))).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||!r.url.startsWith(self.location.origin))return;
  if(r.destination==='video')return;
  // Réseau d'abord : les visiteurs voient toujours la dernière version publiée ; le cache ne sert qu'hors ligne.
  e.respondWith(fetch(r).then(res=>{if(res&&res.ok&&(r.destination==='image'||r.destination==='document'||r.destination==='script'||r.destination==='style'||r.destination==='font'))caches.open(C).then(c=>c.put(r,res.clone()));return res}).catch(()=>caches.match(r).then(hit=>hit||(r.destination==='document'?caches.match('index.html'):Response.error()))))});
