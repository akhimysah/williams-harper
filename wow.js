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
