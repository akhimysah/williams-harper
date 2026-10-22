/* Williams & Harper — comportements de la nouvelle base : en-tête, menu, révélation douce. */
(function(){
  var header=document.querySelector('.wh-header');
  if(!header)return;
  var burger=header.querySelector('.wh-burger');
  var nav=header.querySelector('.wh-nav');
  function solid(){header.classList.toggle('is-solid',window.scrollY>24);}
  solid();window.addEventListener('scroll',solid,{passive:true});
  if(burger&&nav){
    burger.addEventListener('click',function(){
      var open=header.classList.toggle('is-open');
      burger.setAttribute('aria-expanded',open?'true':'false');
      document.body.style.overflow=open?'hidden':'';
    });
    nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){header.classList.remove('is-open');burger.setAttribute('aria-expanded','false');document.body.style.overflow='';});});
  }
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var items=[].slice.call(document.querySelectorAll('main > section:not(.wh-hero) > .wrap > *, main .card, main .residents-card, main .photo-grid figure, main .home-domain-card, main .purchase-step, main .comfort-card, main .art-chapter > .wrap > *'));
    items.forEach(function(el,i){el.classList.add('wh-reveal');el.style.transitionDelay=((i%4)*45)+'ms';});
    var pending=items.slice(),ticking=false;
    function check(){
      ticking=false;var h=window.innerHeight;
      pending=pending.filter(function(el){var r=el.getBoundingClientRect();if(r.top<h*1.3&&r.bottom>-h*0.2){el.classList.add('in');return false;}return true;});
      if(!pending.length){window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);}
    }
    function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(check);}}
    window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll);
    check();setTimeout(check,300);window.addEventListener('load',check);
    setTimeout(function(){pending.forEach(function(el){el.classList.add('in');});pending=[];},2500);
  }
})();
/* Film du domaine : version verticale sur téléphone (affiche assortie), jamais sur ordinateur même si le navigateur ignore source[media]. */
(function(){
  var v=document.querySelector('video[data-poster-mobile]');if(!v)return;
  var s=v.querySelector('source[media]');if(!s)return;
  if(window.matchMedia(s.getAttribute('media')).matches){v.poster=v.getAttribute('data-poster-mobile');return;}
  var picked=v.currentSrc&&v.currentSrc.indexOf('film-mobile')>-1;
  s.parentNode.removeChild(s);
  if(picked){v.load();var p=v.play();if(p&&p.catch)p.catch(function(){});}
})();
