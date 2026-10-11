// Mouvement : apparitions, parallaxe douce, transitions de page, liens PDF selon la langue.
(function(){
  const rm=matchMedia('(prefers-reduced-motion: reduce)').matches,root=document.documentElement;root.classList.add('fx');
  const els=[...document.querySelectorAll('.reveal')];
  if(rm)els.forEach(e=>e.classList.add('in'));
  else{const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{rootMargin:'0px 0px -8% 0px'});
    els.forEach(e=>{if(e.getBoundingClientRect().top<innerHeight*.9)e.classList.add('in');else io.observe(e)});setTimeout(()=>els.forEach(e=>e.classList.add('in')),4000)}
  const par=[...document.querySelectorAll('.full img,.band img')];
  if(!rm&&par.length){let t=false;const upd=()=>{par.forEach(im=>{const r=im.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;const p=(r.top+r.height/2-innerHeight/2)/innerHeight;im.style.transform=`translateY(${p*-7}%) scale(1.1)`});t=false};
    addEventListener('scroll',()=>{if(!t){t=true;requestAnimationFrame(upd)}},{passive:true});upd()}
  if(!rm){void document.body.offsetWidth;root.classList.add('ready');setTimeout(()=>root.classList.add('ready'),50);
    document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||a.target==='_blank'||a.hasAttribute('download'))return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!/\.html?$|\/$/.test(u.pathname))return;if(u.pathname===location.pathname&&u.hash)return;e.preventDefault();root.classList.add('leaving');setTimeout(()=>location.href=u.href,300)});
    addEventListener('pageshow',e=>{if(e.persisted)root.classList.remove('leaving')})}
  const pdfs=[...document.querySelectorAll('a[data-pdf-en]')];const swap=()=>{const en=root.lang==='en';pdfs.forEach(a=>{if(!a.dataset.pdfFr)a.dataset.pdfFr=a.getAttribute('href');a.href=en?a.dataset.pdfEn:a.dataset.pdfFr})};swap();document.addEventListener('wh:lang',swap);
})();
