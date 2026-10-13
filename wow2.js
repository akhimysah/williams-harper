// Salve 6 (accueil) : le seuil qui s'ouvre, matières empilées, Red Stone masqué, explorer, ruban sensible à la vitesse.
(function(){
  const rm=matchMedia('(prefers-reduced-motion: reduce)').matches,fine=matchMedia('(pointer:fine)').matches;
  const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const prog=s=>{const r=s.getBoundingClientRect(),h=s.offsetHeight-innerHeight;return h>0?cl(-r.top/h):0};
  const jobs=[];let raf=0;const run=()=>{raf=0;jobs.forEach(f=>f())};const ask=()=>{if(!raf)raf=requestAnimationFrame(run)};
  // ---- explorer : lignes qui se tracent (aussi sans animation)
  const rows=[...document.querySelectorAll('.ex-row')];
  rows.forEach((r,i)=>r.style.setProperty('--d',(i*.08)+'s'));
  const rio=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('seen');rio.unobserve(x.target)}}),{rootMargin:'0px 0px -8% 0px'});rows.forEach(r=>rio.observe(r));
  if(rm){rows.forEach(r=>r.classList.add('seen'));return}
  // ---- le seuil
  const pt=document.getElementById('portail');
  if(pt){const arch=pt.querySelector('.pt-arch'),st=pt.querySelector('.pt-sticky');
    jobs.push(()=>{const r=pt.getBoundingClientRect();if(r.bottom<-50||r.top>innerHeight+50)return;
      const p=prog(pt),k=ease(cl((p-.08)/.62)),W=innerWidth,H=innerHeight,mob=W<861;
      const aw=mob?W*.62:Math.min(W*.24,H*.46),ah=mob?H*.5:H*.6;const w=aw+(W-aw)*k,h=ah+(H-ah)*k;
      const sx=(W-w)/2,t=(H-h)/2,rad=(w/2)*(1-k);
      st.style.setProperty('--sx',sx+'px');st.style.setProperty('--t',t+'px');st.style.setProperty('--b',t+'px');st.style.setProperty('--r',rad+'px');
      st.style.setProperty('--aw',aw+'px');st.style.setProperty('--ah',ah+'px');
      st.style.setProperty('--z',(1.35-.35*k).toFixed(4));st.style.setProperty('--o',cl(k*1.6).toFixed(3));st.style.setProperty('--cap',cl((p-.72)/.18).toFixed(3))})}
  // ---- matières empilées
  const cards=[...document.querySelectorAll('.mc')];
  if(cards.length)jobs.push(()=>{const H=innerHeight;cards.forEach((c,i)=>{const r=c.getBoundingClientRect();if(r.top>H*1.2||r.bottom<-H)return;
    c.style.setProperty('--e',cl((H-r.top)/H).toFixed(3));
    const n=cards[i+1];if(!n){c.style.setProperty('--k',0);return}const nt=n.getBoundingClientRect().top,stick=parseFloat(getComputedStyle(n).top)||0;
    c.style.setProperty('--k',cl(1-(nt-stick)/(H*.8)).toFixed(3))})});
  // ---- Red Stone masqué
  const mk=document.getElementById('redstone');
  if(mk){const st=mk.querySelector('.mk-sticky'),v=mk.querySelector('video');
    new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting)v.play().catch(()=>{});else v.pause()}),{rootMargin:'20% 0px'}).observe(mk);
    jobs.push(()=>{const r=mk.getBoundingClientRect();if(r.bottom<-50||r.top>innerHeight+50)return;const p=prog(mk),k=cl((p-.12)/.55),e=k*k*k;
      st.style.setProperty('--p',p.toFixed(3));st.style.setProperty('--ls',(1+e*14).toFixed(3));st.style.setProperty('--lo',cl(1-(k-.45)/.5).toFixed(3));st.style.setProperty('--cap',cl((p-.7)/.18).toFixed(3))})}
  // ---- ruban : inclinaison selon la vitesse
  const rib=[...document.querySelectorAll('.ribbon')];let ly=scrollY,sk=0;
  if(rib.length)jobs.push(()=>{const v=scrollY-ly;ly=scrollY;const s=cl(v*.35,-14,14);if(Math.abs(s-sk)>.5){sk=s;rib.forEach(r=>r.style.setProperty('--skew',(-s).toFixed(1)+'deg'))}clearTimeout(rib.t);rib.t=setTimeout(()=>{sk=0;rib.forEach(r=>r.style.setProperty('--skew','0deg'))},140)});
  addEventListener('scroll',ask,{passive:true});addEventListener('resize',ask);ask();
  // ---- explorer : image flottante qui suit la souris
  const fl=document.querySelector('.ex-float');
  if(fl&&fine&&rows.length){const im=fl.querySelector('img');let mx=0,my=0,x=0,y=0,on=false,loop=0;
    const tick=()=>{const dx=mx-x;x+=dx*.14;y+=(my-y)*.14;fl.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${cl(dx*.06,-10,10)}deg) scale(${on?1:.6})`;loop=(on||Math.abs(dx)>.5)?requestAnimationFrame(tick):0};
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY},{passive:true});
    rows.forEach(r=>{const src=r.dataset.img;const pre=new Image();r.addEventListener('mouseenter',e=>{if(!pre.src)pre.src=src;im.src=src;if(!on){x=mx=e.clientX;y=my=e.clientY}on=true;fl.classList.add('on');if(!loop)loop=requestAnimationFrame(tick)});
      r.addEventListener('mouseleave',()=>{on=false;fl.classList.remove('on')})})}
})();
