// Effets « signature » : préchargeur, curseur, titres en lignes, rideaux d'images, boutons magnétiques,
// compteurs, barre de progression, galerie horizontale épinglée, mode nuit. Tout se désactive avec prefers-reduced-motion.
(function(){
  const root=document.documentElement,rm=matchMedia('(prefers-reduced-motion: reduce)').matches,fine=matchMedia('(pointer:fine)').matches;
  // ---- mode nuit (mémorisé)
  try{if(localStorage.getItem('wh-night')==='1')root.classList.add('night')}catch(e){}
  const nb=document.getElementById('night');if(nb){const sync=()=>nb.setAttribute('aria-pressed',root.classList.contains('night'));sync();
    nb.addEventListener('click',()=>{root.classList.toggle('night');sync();try{localStorage.setItem('wh-night',root.classList.contains('night')?'1':'0')}catch(e){}})}
  // ---- barre de progression
  const bar=document.createElement('div');bar.className='progress';document.body.appendChild(bar);
  const prog=()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.transform=`scaleX(${h>0?scrollY/h:0})`};
  addEventListener('scroll',prog,{passive:true});prog();
  if(rm)return;
  // ---- préchargeur (une fois par session)
  let seen=false;try{seen=sessionStorage.getItem('wh-pre')==='1'}catch(e){}
  if(!seen&&!location.hash){const p=document.createElement('div');p.className='preload';p.innerHTML='<div class="pre-in"><img src="'+(root.lang==='fr'?'':'../')+'img/logo-dark.png" alt="" width="180" height="63"><span class="pre-line"><i></i></span></div>';document.body.appendChild(p);root.classList.add('preloading');
    const done=()=>{p.classList.add('out');root.classList.remove('preloading');setTimeout(()=>p.remove(),900);try{sessionStorage.setItem('wh-pre','1')}catch(e){}};
    let fired=false;const go=()=>{if(fired)return;fired=true;setTimeout(done,500)};addEventListener('load',go);setTimeout(go,2400)}
  // ---- titres : révélation ligne par ligne (mots masqués)
  const split=h=>{if(h.dataset.split)return;h.dataset.split='1';const walk=n=>{[...n.childNodes].forEach(c=>{if(c.nodeType===3){const words=c.nodeValue.split(/(\s+)/);const f=document.createDocumentFragment();words.forEach(w=>{if(!w)return;if(/^\s+$/.test(w)){f.appendChild(document.createTextNode(w));return}const s=document.createElement('span');s.className='w';s.innerHTML='<span>'+w.replace(/</g,'&lt;')+'</span>';f.appendChild(s)});c.replaceWith(f)}else if(c.nodeType===1&&!['BR'].includes(c.tagName))walk(c)})};walk(h);
    [...h.querySelectorAll('.w')].forEach((w,i)=>w.style.setProperty('--d',(i*55)+'ms'))};
  document.querySelectorAll('.head h2,.full h1,.hero-v2 h1,.manif-text h2,.faq-intro h2,.contact h2,.vgrid h2,.band h2,.band h1').forEach(split);
  // ---- apparitions : rideaux d'images + titres
  const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('seen');io.unobserve(x.target)}}),{rootMargin:'0px 0px -10% 0px'});
  document.querySelectorAll('[data-split], .curtain').forEach(e=>io.observe(e));
  document.querySelectorAll('.vie-grid figure,.cmp-card figure,.manif-big,.manif-small,.tri figure,.loc-row,.fars article,.gal figure,.mosaic figure,.plans figure').forEach(f=>{f.classList.add('curtain');io.observe(f)});
  // ---- compteurs
  const nums=[...document.querySelectorAll('.figures b,.manif-figs b,.cmp-figs b,.locfig b,.dn b')];
  const cio=new IntersectionObserver(es=>es.forEach(x=>{if(!x.isIntersecting)return;cio.unobserve(x.target);const el=x.target;const m=el.textContent.match(/^([\d\s]+)(.*)$/s);if(!m)return;const target=parseInt(m[1].replace(/\s/g,''),10),rest=m[2];if(isNaN(target))return;const t0=performance.now(),dur=1400;const fmt=v=>String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.firstChild.nodeValue=fmt(Math.round(target*e))+(rest&&el.childNodes.length===1?rest:'');if(k<1)requestAnimationFrame(step)};
    if(el.childNodes.length===1){el.textContent='0';requestAnimationFrame(step)}else{el.firstChild.nodeValue='0';requestAnimationFrame(step)}}),{threshold:.6});
  nums.forEach(n=>cio.observe(n));
  // ---- curseur + boutons magnétiques (souris uniquement)
  if(fine){const c=document.createElement('div');c.className='cursor';c.innerHTML='<span class="dot"></span><span class="ring"><b></b></span>';document.body.appendChild(c);root.classList.add('has-cursor');
    let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my;const dot=c.firstChild,ring=c.lastChild,lab=ring.firstChild;
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;dot.style.transform=`translate(${mx}px,${my}px)`},{passive:true});
    (function loop(){rx+=(mx-rx)*.16;ry+=(my-ry)*.16;ring.style.transform=`translate(${rx}px,${ry}px)`;requestAnimationFrame(loop)})();
    const hov=(sel,label)=>{document.querySelectorAll(sel).forEach(el=>{el.addEventListener('mouseenter',()=>{c.classList.add('big');lab.textContent=label||''});el.addEventListener('mouseleave',()=>{c.classList.remove('big');lab.textContent=''})})};
    hov('.gal img,.mosaic img,.tri img,.plans img,.cat img,.vie-grid img,.cmp-card,.villa figure','Voir');hov('.player','Film');hov('a,button,summary,.pt','');
    document.querySelectorAll('.btn,.pill,.hcta').forEach(b=>{b.addEventListener('mousemove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.18}px,${(e.clientY-r.top-r.height/2)*.28}px)`});b.addEventListener('mouseleave',()=>{b.style.transform=''})})}
  // ---- galerie horizontale épinglée (accueil)
  const pin=document.querySelector('.hscroll');
  if(pin&&innerWidth>960){const track=pin.querySelector('.hs-track');const n=track.children.length;pin.style.height=(n*100)+'vh';
    const upd=()=>{const r=pin.getBoundingClientRect();const total=pin.offsetHeight-innerHeight;const k=Math.min(1,Math.max(0,-r.top/total));track.style.transform=`translateX(${-k*(track.scrollWidth-innerWidth)}px)`;pin.querySelectorAll('.hs-dot').forEach((d,i)=>d.classList.toggle('on',Math.round(k*(n-1))===i))};
    addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd()}
  // ---- ruban défilant : duplique le contenu pour une boucle continue
  document.querySelectorAll('.ribbon').forEach(r=>{r.innerHTML=r.innerHTML+r.innerHTML});
})();
// ---- salve 3 : parallaxes, rideau du film, FAQ, horloge, contact, inclinaison, bandeau villa suivante, menus, pied de page
(function(){
  const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;if(rm)return;
  const fine=matchMedia('(pointer:fine)').matches;
  // 1 + 5 : parallaxes douces
  const par=[];const add=(el,sp)=>{if(el)par.push([el,sp])};
  add(document.querySelector('.manif-big'),-.08);add(document.querySelector('.manif-small'),.12);
  document.querySelectorAll('.vie-grid figure').forEach((f,i)=>add(f,[-.05,.1,.16,-.08,.07][i%5]));
  if(par.length){let t=false;const upd=()=>{par.forEach(([el,sp])=>{const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const p=(r.top+r.height/2-innerHeight/2);el.style.transform=`translateY(${p*sp}px)`});t=false};
    addEventListener('scroll',()=>{if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd()}
  // 2 : rideau du film
  const film=document.getElementById('film');if(film){new IntersectionObserver(es=>es.forEach(x=>{if(x.intersectionRatio>.35)film.classList.add('open')}),{threshold:[.35]}).observe(film)}
  // 4 : numéro courant de la FAQ dans la marge
  const acc=document.querySelector('.faq-acc');if(acc){const cur=document.createElement('div');cur.className='faq-cur';acc.appendChild(cur);
    const sync=()=>{const o=acc.querySelector('.faq-item[open]');if(!o){cur.style.opacity=0;return}cur.style.opacity=1;cur.textContent=o.querySelector('.faq-n').textContent;cur.style.top=(o.offsetTop+18)+'px'};
    acc.querySelectorAll('.faq-item').forEach(d=>d.addEventListener('toggle',()=>setTimeout(sync,20)));sync()}
  // 6 : horloge à rouleaux
  const clock=document.querySelector('.adv-clock');if(clock){const mos=[...document.querySelectorAll('.adv .mo')];const mo=new MutationObserver(()=>{const on=mos.find(m=>m.classList.contains('on'));if(!on)return;const t=on.querySelector('.mo-t').textContent;if(clock.firstChild.textContent===t)return;clock.classList.remove('roll');void clock.offsetWidth;clock.firstChild.textContent=t;clock.classList.add('roll')});mos.forEach(m=>mo.observe(m,{attributes:true,attributeFilter:['class']}))}
  // 7 : bouton envoyer → coche
  const sb=document.querySelector('#contact-form button[type=submit]');if(sb){sb.insertAdjacentHTML('beforeend','<span class="ck" aria-hidden="true">✓</span>');document.getElementById('contact-form').addEventListener('submit',()=>{if(!document.getElementById('contact-form').checkValidity())return;setTimeout(()=>sb.classList.add('done'),400);setTimeout(()=>sb.classList.remove('done'),4000)})}
  // 10 : inclinaison légère des photos
  if(fine)document.querySelectorAll('.gal figure,.mosaic figure,.tri figure,.vie-grid figure').forEach(f=>{f.addEventListener('mousemove',e=>{const r=f.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;f.style.transform=`perspective(900px) rotateY(${x*4}deg) rotateX(${-y*4}deg)`});f.addEventListener('mouseleave',()=>{f.style.transform=''})});
  // 12 : bandeau villa suivante qui s'agrandit à l'approche
  const nb=document.querySelector('.next-band');if(nb){const im=nb.querySelector('img');let t=false;const upd=()=>{const r=nb.getBoundingClientRect();const k=Math.min(1,Math.max(0,(innerHeight-r.top)/(innerHeight+r.height)));im.style.transform=`scale(${1.25-.2*k})`;t=false};addEventListener('scroll',()=>{if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd()}
  // 13 : escalier des sous-menus
  document.querySelectorAll('.sub-in').forEach(s=>[...s.children].forEach((a,i)=>a.style.setProperty('--i',i)));
  // 16 : pied de page
  const ft=document.querySelector('footer');if(ft)new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting)ft.classList.add('seen')}),{threshold:.3}).observe(ft);
  // 9 : plans
  document.querySelectorAll('.plans figure').forEach(f=>{if(!f.classList.contains('curtain')){f.classList.add('curtain')}});
})();
// ---- salve 4 : visite, index de section, retour en haut, zoom galerie, météo, nuit automatique, flèches, hero, contact, galerie, onglet
(function(){
  const root=document.documentElement,rm=matchMedia('(prefers-reduced-motion: reduce)').matches,L=(root.lang||'fr').slice(0,2);
  const T={fr:{top:'Haut de page',back:'Revenez voir Red Stone ✦'},en:{top:'Back to top',back:'Come back to Red Stone ✦'},nl:{top:'Naar boven',back:'Kom terug naar Red Stone ✦'}}[L]||{top:'Haut',back:'✦'};
  // visite scrollytelling
  const tour=document.querySelector('.tour');
  if(tour&&innerWidth>860){const slides=[...tour.querySelectorAll('.tour-slide')],bar=tour.querySelector('.tour-bar i');let t=false;
    const upd=()=>{const r=tour.getBoundingClientRect();const total=tour.offsetHeight-innerHeight;const k=Math.min(1,Math.max(0,-r.top/total));const i=Math.min(slides.length-1,Math.floor(k*slides.length));slides.forEach((s,j)=>s.classList.toggle('on',j===i));bar.style.height=(k*100)+'%';t=false};
    addEventListener('scroll',()=>{if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd()}
  // index de section (pages avec data-nav)
  const secs=[...document.querySelectorAll('section[data-nav]')];
  if(secs.length>1){const nav=document.createElement('nav');nav.className='secnav';nav.setAttribute('aria-label','Sections');secs.forEach((s,i)=>{if(!s.id)s.id='sec-'+i;const a=document.createElement('a');a.href='#'+s.id;a.innerHTML='<span>'+s.dataset.nav+'</span>';nav.appendChild(a)});document.body.appendChild(nav);
    const as=[...nav.children];let t=false;const upd=()=>{const y=scrollY+innerHeight*.4;let cur=-1;secs.forEach((s,i)=>{if(s.offsetTop<=y)cur=i});as.forEach((a,i)=>a.classList.toggle('on',i===cur));nav.classList.toggle('show',scrollY>innerHeight*.6);t=false};addEventListener('scroll',()=>{if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd()}
  // retour en haut avec anneau de progression
  const tt=document.createElement('button');tt.className='totop';tt.type='button';tt.setAttribute('aria-label',T.top);tt.innerHTML='<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22"/><circle class="p" cx="24" cy="24" r="22"/></svg>';document.body.appendChild(tt);
  const pc=tt.querySelector('.p');let t2=false;const u2=()=>{const h=root.scrollHeight-innerHeight;const k=h>0?scrollY/h:0;pc.style.strokeDashoffset=138*(1-k);tt.classList.toggle('show',scrollY>innerHeight);t2=false};addEventListener('scroll',()=>{if(!t2){t2=true;requestAnimationFrame(u2)}},{passive:true});u2();
  tt.addEventListener('click',()=>scrollTo({top:0,behavior:rm?'auto':'smooth'}));
  // zoom dans la galerie plein écran
  const lb=document.getElementById('lb'),li=document.getElementById('lb-img');
  if(lb&&li){li.addEventListener('dblclick',()=>{li.classList.toggle('zoom');lb.classList.toggle('zoomed')});new MutationObserver(()=>{if(lb.hidden){li.classList.remove('zoom');lb.classList.remove('zoomed')}}).observe(lb,{attributes:true,attributeFilter:['hidden']});
    addEventListener('keydown',e=>{if(!lb.hidden&&e.key==='f'&&document.fullscreenEnabled){document.fullscreenElement?document.exitFullscreen():lb.requestFullscreen().catch(()=>{})}})}
  // météo en direct à Marrakech (Open-Meteo, sans clé)
  const hero=document.querySelector('.full .copy .wrap');
  if(hero&&location.pathname.match(/index\.html$|\/$/)){const m=document.createElement('div');m.className='meteo';hero.appendChild(m);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=31.5665&longitude=-8.0459&current=temperature_2m,weather_code&timezone=Africa%2FCasablanca').then(r=>r.json()).then(d=>{const c=d.current;const code=c.weather_code;const W={fr:['ciel dégagé','peu nuageux','nuageux','couvert','brume','bruine','pluie','neige','averses','orage'],en:['clear sky','few clouds','cloudy','overcast','mist','drizzle','rain','snow','showers','storm'],nl:['heldere hemel','licht bewolkt','bewolkt','betrokken','nevel','motregen','regen','sneeuw','buien','onweer']}[L]||[];
      const idx=code===0?0:code<=2?1:code===3?3:code<=48?4:code<=57?5:code<=67?6:code<=77?7:code<=82?8:9;m.innerHTML='<b>'+Math.round(c.temperature_2m)+'°</b><span>Marrakech · '+(W[idx]||'')+'</span>';m.classList.add('on')}).catch(()=>{})}
  // nuit automatique entre 20 h et 7 h si l'utilisateur n'a rien choisi
  try{if(localStorage.getItem('wh-night')===null){const h=new Date().getHours();if(h>=20||h<7)root.classList.add('night')}}catch(e){}
  // flèches ← → entre les villas
  const prev=document.querySelector('.nextvilla a[href^="villa-"]'),next=document.querySelector('.next-band');
  if(prev||next)addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='ArrowRight'&&next)location.href=next.href;if(e.key==='ArrowLeft'&&prev)location.href=prev.href});
  // hero qui se rétracte et s'assombrit au scroll
  const copy=document.querySelector('.full .copy');if(copy&&!rm){let t3=false;const u3=()=>{const k=Math.min(1,scrollY/innerHeight);copy.style.opacity=1-k*1.3;copy.style.transform=`translateY(${k*60}px) scale(${1-k*.08})`;t3=false};addEventListener('scroll',()=>{if(!t3){t3=true;requestAnimationFrame(u3)}},{passive:true})}
  // contact qui s'assombrit quand on y arrive
  const ct=document.getElementById('contact');if(ct)new IntersectionObserver(es=>es.forEach(x=>ct.classList.toggle('dark',x.intersectionRatio>.35)),{threshold:[.35]}).observe(ct);
  // galerie : reflow animé au filtrage
  const gal=document.getElementById('gal');if(gal){const re=()=>{[...gal.querySelectorAll('figure:not([hidden])')].forEach((f,k)=>{f.style.setProperty('--k',k);f.style.animation='none';void f.offsetWidth;f.style.animation=''})};document.querySelectorAll('.galnav button').forEach(b=>b.addEventListener('click',()=>setTimeout(re,0)))}
  // titre de l'onglet quand on quitte la page
  const title=document.title;document.addEventListener('visibilitychange',()=>{document.title=document.hidden?T.back:title});
})();
// ---- salve 5 : partage, préchargement des pages au survol, gyroscope 360, accessibilité
(function(){
  const L=(document.documentElement.lang||'fr').slice(0,2);const T={fr:{copied:'Lien copié',share:'Partager'},en:{copied:'Link copied',share:'Share'},nl:{copied:'Link gekopieerd',share:'Delen'},ar:{copied:'تم نسخ الرابط',share:'مشاركة'}}[L]||{copied:'OK',share:'Share'};
  document.querySelectorAll('.share-btn').forEach(b=>b.addEventListener('click',async()=>{const data={title:b.dataset.title||document.title,text:b.dataset.title||document.title,url:location.href.split('#')[0]};if(navigator.share){try{await navigator.share(data)}catch(e){}}else{try{await navigator.clipboard.writeText(data.url);b.textContent=T.copied;setTimeout(()=>b.textContent=T.share,1800)}catch(e){}}}));
  // préchargement des pages internes au survol / au toucher
  const seen=new Set();const pre=u=>{if(seen.has(u))return;seen.add(u);const l=document.createElement('link');l.rel='prefetch';l.href=u;l.as='document';document.head.appendChild(l)};
  document.addEventListener('mouseover',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&/\.html$/.test(u.pathname)&&u.pathname!==location.pathname)pre(u.pathname)},{passive:true});
  document.addEventListener('touchstart',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin===location.origin&&/\.html$/.test(u.pathname))pre(u.pathname)},{passive:true});
  // accessibilité : annonce de la section courante, focus visible sur les éléments injectés
  const live=document.createElement('div');live.setAttribute('aria-live','polite');live.className='sr-only';document.body.appendChild(live);
  document.addEventListener('focusin',e=>{const s=e.target.closest('section[data-nav]');if(s&&live.textContent!==s.dataset.nav)live.textContent=s.dataset.nav});
})();
// ---- plans interactifs : points cliquables avec le nom de la pièce
(function(){document.querySelectorAll('.plan-hot[data-spots]').forEach(f=>{let spots=[];try{spots=JSON.parse(f.dataset.spots)}catch(e){return}
  spots.forEach(([x,y,n])=>{const b=document.createElement('button');b.type='button';b.className='hot';b.style.setProperty('--x',x+'%');b.style.setProperty('--y',y+'%');b.setAttribute('aria-label',n);b.innerHTML='<span></span>';b.firstChild.textContent=n;b.addEventListener('click',e=>{e.stopPropagation();f.querySelectorAll('.hot.on').forEach(o=>{if(o!==b)o.classList.remove('on')});b.classList.toggle('on')});f.appendChild(b)})})})();
