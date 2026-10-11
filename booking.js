// Prise de rendez-vous : calendrier (60 jours, sans dimanche), créneau, sur place ou en visio. Préremplissage depuis ?config=.
(function(){
  const form=document.getElementById('contact-form');if(!form)return;
  const L=document.documentElement.lang||'fr';
  const T={fr:{t:'Choisir un créneau de visite',s:'Facultatif. Nous confirmons par téléphone ou e-mail.',days:['L','M','M','J','V','S','D'],months:['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],slots:['10:00','12:00','15:00','17:00'],modes:['Au domaine','En visio'],chosen:'Rendez-vous souhaité',none:'Aucun créneau choisi',cfg:'Configuration souhaitée'},
    en:{t:'Choose a visit slot',s:'Optional. We confirm by phone or e-mail.',days:['M','T','W','T','F','S','S'],months:['January','February','March','April','May','June','July','August','September','October','November','December'],slots:['10:00','12:00','15:00','17:00'],modes:['On site','Video call'],chosen:'Requested appointment',none:'No slot chosen',cfg:'Requested configuration'},
    nl:{t:'Kies een bezoekmoment',s:'Optioneel. Wij bevestigen per telefoon of e-mail.',days:['M','D','W','D','V','Z','Z'],months:['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],slots:['10:00','12:00','15:00','17:00'],modes:['Op het domein','Videogesprek'],chosen:'Gewenste afspraak',none:'Geen moment gekozen',cfg:'Gewenste configuratie'}}[L.slice(0,2)]||null;
  if(!T)return;
  const box=document.createElement('div');box.className='booking';
  const today=new Date();today.setHours(0,0,0,0);let view=new Date(today.getFullYear(),today.getMonth(),1);let date=null,slot=null,mode=T.modes[0];
  const hidden=document.createElement('input');hidden.type='hidden';hidden.name='rendez-vous';form.appendChild(hidden);
  const fmt=d=>d.toLocaleDateString(L,{weekday:'long',day:'numeric',month:'long'});
  function render(){const y=view.getFullYear(),m=view.getMonth();const first=(new Date(y,m,1).getDay()+6)%7;const n=new Date(y,m+1,0).getDate();const max=new Date(today);max.setDate(max.getDate()+60);
    let cells='';for(let i=0;i<first;i++)cells+='<i></i>';
    for(let d=1;d<=n;d++){const dt=new Date(y,m,d);const off=dt<today||dt>max||dt.getDay()===0;const on=date&&dt.getTime()===date.getTime();cells+=`<button type="button" ${off?'disabled':''} class="${on?'on':''}" data-d="${dt.getTime()}">${d}</button>`}
    const prevOk=new Date(y,m,1)>today,nextOk=new Date(y,m+1,1)<=max;
    box.innerHTML=`<div class="bk-head"><div><div class="label">${T.t}</div><p class="muted">${T.s}</p></div></div>
      <div class="bk-grid"><div class="bk-cal"><div class="bk-m"><button type="button" class="bk-nav" data-n="-1" ${prevOk?'':'disabled'} aria-label="‹">‹</button><span>${T.months[m]} ${y}</span><button type="button" class="bk-nav" data-n="1" ${nextOk?'':'disabled'} aria-label="›">›</button></div>
      <div class="bk-days">${T.days.map(x=>`<span>${x}</span>`).join('')}</div><div class="bk-cells">${cells}</div></div>
      <div class="bk-side"><div class="bk-slots">${T.slots.map(s=>`<button type="button" class="${slot===s?'on':''}" data-s="${s}">${s}</button>`).join('')}</div>
      <div class="bk-modes">${T.modes.map(x=>`<button type="button" class="${mode===x?'on':''}" data-m="${x}">${x}</button>`).join('')}</div>
      <div class="bk-sum">${date&&slot?`<b>${T.chosen}</b><span>${fmt(date)} · ${slot} · ${mode}</span>`:`<span class="muted">${T.none}</span>`}</div></div></div>`;
    hidden.value=date&&slot?`${fmt(date)} ${slot} (${mode})`:'';
    box.querySelectorAll('.bk-cells button').forEach(b=>b.addEventListener('click',()=>{date=new Date(+b.dataset.d);render()}));
    box.querySelectorAll('.bk-slots button').forEach(b=>b.addEventListener('click',()=>{slot=b.dataset.s;render()}));
    box.querySelectorAll('.bk-modes button').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.m;render()}));
    box.querySelectorAll('.bk-nav').forEach(b=>b.addEventListener('click',()=>{view=new Date(view.getFullYear(),view.getMonth()+(+b.dataset.n),1);render()}))}
  render();
  const consent=form.querySelector('.consent');form.insertBefore(box,consent);
  form.addEventListener('submit',()=>{const msg=document.getElementById('f-msg');if(hidden.value&&msg&&!msg.value.includes(hidden.value))msg.value=(msg.value?msg.value+'\n\n':'')+T.chosen+' : '+hidden.value},true);
  try{const c=new URLSearchParams(location.search).get('config');if(c){const msg=document.getElementById('f-msg');if(msg&&!msg.value){msg.value=T.cfg+' :\n'+decodeURIComponent(c);msg.scrollIntoView({block:'center'})}}}catch(e){}
})();
