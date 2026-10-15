// Envoi des formulaires.
// Ordre : 1) Netlify Forms si le site est hébergé chez Netlify (aucun réglage) ;
//         2) WH_CONFIG.formEndpoint (Formspree, Basin, API maison…) en JSON ;
//         3) contact.php (hébergement PHP, ex. OVH) ;
//         4) repli : ouverture de la messagerie du visiteur (mailto).
(function(){
  const cfg=window.WH_CONFIG||{};
  const isNetlify=/\.netlify\.app$/.test(location.hostname)||cfg.netlifyForms===true;
  const t=(fr,en)=>document.documentElement.lang==='en'?en:fr;
  async function post(url,body,headers){const r=await fetch(url,{method:'POST',headers,body});if(!r.ok)throw new Error('HTTP '+r.status);return r}
  async function send(form,toast){
    if(!form.checkValidity()){form.reportValidity();return}
    if(form.elements.website&&form.elements.website.value){toast.hidden=false;return} // pot de miel : on fait comme si
    const fd=new FormData(form);const data=Object.fromEntries(fd.entries());
    data.page=location.pathname;data.lang=document.documentElement.lang;
    const btn=form.querySelector('[type=submit]');const label=btn.textContent;btn.disabled=true;btn.textContent='…';
    let sent=false,err=null;
    try{
      if(isNetlify){fd.set('page',data.page);fd.set('lang',data.lang);await post(form.getAttribute('action')||'/',new URLSearchParams(fd).toString(),{'Content-Type':'application/x-www-form-urlencoded'});sent=true}
      else if(cfg.formEndpoint){await post(cfg.formEndpoint,JSON.stringify(data),{'Accept':'application/json','Content-Type':'application/json'});sent=true}
      else{
        try{const r=await post(form.getAttribute('action')||'contact.php',JSON.stringify(data),{'Accept':'application/json','Content-Type':'application/json'});const j=await r.json().catch(()=>({}));if(j.ok===false)throw new Error(j.error||'php');sent=true}
        catch(e){err=e}
      }
      if(!sent){ // repli : messagerie du visiteur
        const subject=encodeURIComponent('Demande — '+(data.villa||'Williams & Harper'));
        const body=encodeURIComponent(Object.entries(data).filter(([k])=>!['page','lang','form-name','website','consent'].includes(k)).map(([k,v])=>k+': '+v).join('\n'));
        location.href='mailto:'+cfg.email+'?subject='+subject+'&body='+body;sent=true;
      }
      toast.hidden=false;toast.classList.remove('err');form.reset();
    }catch(e){
      toast.hidden=false;toast.classList.add('err');
      toast.textContent=t("L'envoi a échoué. Appelez le +212 6 34 04 89 77 ou écrivez à "+cfg.email+'.','Sending failed. Please call +212 6 34 04 89 77 or write to '+cfg.email+'.');
    }finally{btn.disabled=false;btn.textContent=label}
  }
  document.querySelectorAll('form[data-wh]').forEach(f=>{
    const toast=f.querySelector('.toast');
    f.addEventListener('submit',e=>{e.preventDefault();send(f,toast)});
  });
  // Pré-remplissage de la villa depuis l'URL (?villa=chloe) et défilement vers le formulaire
  try{const q=new URLSearchParams(location.search).get('villa');const fv=document.getElementById('f-villa');
    if(q&&fv){const want={chloe:'Villa Chloé',celine:'Villa Céline',margaux:'Villa Margaux'}[q];if(want)fv.value=want;const go=()=>document.getElementById('contact')?.scrollIntoView({block:'start'});addEventListener('load',()=>{go();setTimeout(go,700)})}}catch(e){}
  // Liens de téléchargement direct si les PDF existent
  const sel=document.getElementById('bm-villa'),dl=document.getElementById('bm-dl');
  if(sel&&dl){const up=()=>{const en=document.documentElement.lang==='en';const u=((en&&cfg.brochuresEN)||cfg.brochures||{})[sel.value]||(cfg.brochures||{})[sel.value];dl.hidden=!u;if(u)dl.href=u};sel.addEventListener('change',up);document.addEventListener('wh:lang',up);up()}
})();
