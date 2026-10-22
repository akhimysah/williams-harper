(()=>{'use strict';document.querySelectorAll('[data-film]').forEach(root=>{
 const data=JSON.parse(root.dataset.film),frames=data.frames,labels=data.labels,max=(frames.length-1)*100;
 const base=root.querySelector('.wh-film-base'),overlay=root.querySelector('.wh-film-overlay'),line=root.querySelector('.wh-film-line'),range=root.querySelector('.wh-film-range'),play=root.querySelector('.wh-film-play'),caption=root.querySelector('.wh-film-label'),count=root.querySelector('.wh-film-count');
 let value=0,current=-1,playing=false,raf=0,last=0,preloaded=false;
 function preload(){if(preloaded)return;preloaded=true;frames.forEach(src=>{const im=new Image();im.src=src;});}
 function draw(v){value=Math.min(max,Math.max(0,v));range.value=String(value);const i=Math.min(frames.length-2,Math.floor(value/100)),f=value===max?1:value/100-i;if(current!==i){base.src=frames[i];overlay.src=frames[i+1];current=i;}overlay.style.clipPath='inset(0 '+((1-f)*100)+'% 0 0)';line.style.display=f>.015&&f<.985?'block':'none';line.style.left=f*100+'%';const n=Math.min(frames.length-1,Math.floor((value+1)/100));if(caption.textContent!==labels[n])caption.textContent=labels[n];count.textContent=data.stage+' '+String(n+1).padStart(2,'0')+' / '+frames.length;base.alt=labels[n];range.setAttribute('aria-valuetext',labels[n]);}
 function stop(){playing=false;cancelAnimationFrame(raf);play.firstElementChild.textContent=value>=max?data.replay:data.play;play.setAttribute('aria-pressed','false');}
 function tick(t){if(!playing)return;if(!last)last=t;draw(value+(t-last)/33);last=t;if(value>=max){stop();return;}raf=requestAnimationFrame(tick);}
 play.addEventListener('click',()=>{if(playing){stop();return;}preload();if(value>=max)draw(0);playing=true;last=0;play.firstElementChild.textContent=data.pause;play.setAttribute('aria-pressed','true');raf=requestAnimationFrame(tick);});
 range.addEventListener('input',()=>{preload();stop();draw(Number(range.value));});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)preload();else if(playing)stop();});},{rootMargin:'150px'});observer.observe(root);}
 // Leave the first image lazy until this section approaches the viewport.
 });})();
