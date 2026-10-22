/* Arabic project advisor: deterministic answers and retrieval from published pages. */
(()=>{'use strict';
if(document.querySelector('.wh-launch'))return;
const knowledge=window.WH_KNOWLEDGE||{facts:{},records:[]};
const base=new URL('../ar/',document.currentScript.src);
const villas=[{id:'chloe',name:'كلويه',aliases:['كلويه','كلوي','chloe']},{id:'celine',name:'سيلين',aliases:['سيلين','سلين','celine']},{id:'margaux',name:'مارغو',aliases:['مارغو','مارجو','margaux']}];
const state={villa:null,intent:null};
const normalize=q=>q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const response=(text,path=null,contact=false)=>({text,path,contact});
const stop=new Set('كم ما ماذا هل في من عن الي علي هو هي انا انت ان اريد ارغب ممكن يمكن لدي عند كل لي هذا هذه التي الذي كيف اين متي وما وماهي عدد فيلا فيلات الفيلا الفيلات لو سمحت شكرا'.split(' ').map(normalize));
function tokens(q){return [...new Set(normalize(q).split(/[^\p{L}\p{N}]+/u).map(w=>w.replace(/^ال/,'')).filter(w=>w.length>2&&!stop.has(w)))];}
function retrieve(q,v){const words=tokens(q);if(!words.length)return null;
const rows=knowledge.records.filter(r=>r.lang==='ar'&&(!v||!['chloe','celine','margaux'].includes(r.page)||r.page===v.id)).map(r=>{const terms=tokens(r.heading+' '+r.text),hits=words.filter(w=>terms.includes(w)).length;return{r,hits,coverage:hits/words.length};}).filter(x=>x.coverage>=.65&&x.hits>=Math.min(2,words.length)).sort((a,b)=>b.hits-a.hits||b.coverage-a.coverage||a.r.text.length-b.r.text.length);
if(!rows.length)return null;return response('بحسب المعلومات المنشورة في الموقع:\n\n'+rows[0].r.text,rows[0].r.url.replace(/^ar\//,''));}
function facts(v,kind){const f=knowledge.facts[v.id];if(!f)return 'لم تتوفر بيانات مؤكدة لهذه الفيلا.';
const name='فيلا '+v.name+' : ';
if(kind==='bedrooms')return name+f.suites+' أجنحة نوم، لكل منها حمام خاص، إضافة إلى '+f.service+' غرفة خدمة مستقلة بحمام. ويمكن استبدال إحدى غرفتي الجلوس بغرفة ضيوف إضافية دون تكلفة إضافية، وهي غير محسوبة ضمن الأجنحة.';
if(kind==='bathrooms')return name+f.suites+' حمامات خاصة بالأجنحة، إضافة إلى حمام غرفة الخدمة؛ أي '+(f.suites+f.service)+' حمامات مذكورة في صفحة الفيلا، دون احتساب أي مراحيض إضافية للضيوف.';
if(kind==='land')return name+'فيلا على قطعة أرض ابتداءً من '+f.land+' م².';
if(kind==='price')return name+'ابتداءً من '+String(f.price).replace(',','.')+' مليون يورو.';
if(kind==='pool')return name+'مسبح بطول '+f.poolLength+' متراً.';
return name+f.suites+' أجنحة · أرض ابتداءً من '+f.land+' م² · سعر ابتداءً من '+String(f.price).replace(',','.')+' مليون يورو.';}
function answer(input){const q=normalize(input),named=villas.filter(v=>v.aliases.some(a=>q.includes(normalize(a))));if(named.length===1)state.villa=named[0];
const all=/جميع|كل الفيل|الثلاث|مقارن|فرق|اختلاف/.test(q)||named.length>1;
const v=all?null:state.villa,selected=all?(named.length>1?named:villas):v?[v]:villas;
const rules=[
['human',/واتساب|whatsapp|هاتف|رقم.*تواصل|فريق|مستشار|موظف|اتصل|اتصال/],
['location',/اين|موقع|عنوان|فين|امزميز|اين تقع/],
['rent',/ايجار|استئجار|تاجير|اجار/],
['service',/غرفه.*(خدم|عامل|خادم)|سكن.*(عامل|خدم)/],
['custom',/تعديل|تغيير|اضافه.*غرف|غرفه.*ضيوف/],
['bathrooms',/حمام|دورات.*مياه/],
['roomsize',/(مساحه|ابعاد|حجم).*غرف|غرف.*(مساحه|ابعاد|حجم)/],
['bedrooms',/غرف|اجنحه|جناح|نوم/],
['included',/(يشمل|شامل|يتضمن|داخل).*(سعر|ثمن)|(سعر|ثمن).*(يشمل|شامل|يتضمن)/],
['price',/سعر|اسعار|ثمن|تكلفه|ميزانيه|كم.*(تساوي|تسوي)/],
['delivery',/تسليم|موعد|متي|توافر|متاح|جاهزه|جاهز/],
['reserve',/حجز|احجز|دفع|دفعات|اقساط|شراء|اشتري/],
['plans',/مخطط|مخططات|توزيع/],
['land',/ارض|اراضي|قطعه|قطع/],
['surface',/مساحه|مساحات|امتار|متر/],
['pool',/مسبح|سباحه|عمق/],
['lift',/مصعد|اسانسي/],
['furniture',/اثاث|مفروش|تاثيث/],
['materials',/مواد|تشطيب|رخام|ترافرتين|سيراميك|خشب/],
['solar',/شمس|شمسيه/],
['climate',/تكييف|تبريد|تدفئه/],
['smart',/ذكي|ذكيه|ستائر|شيش|تحكم/],
['network',/انترنت|واي فاي|الياف/],
['security',/امن|حراسه|امان|مغلق/],
['garden',/حديقه|حدائق|خضراء|منتزه|اشجار/],
['services',/مرافق|خدمات|بادل|رياضه|مقهي|اطفال|كونسيرج/],
['brochure',/كتيب|بروشور|كتالوج/],
['build',/بناء|انشاء|اشغال|مراحل|هيكل/],
['identity',/من.*(ويليامز|هاربر)|شركه|مطور/],
['villas',/فيلات|نماذج|مجموعات|مقارن|الفرق/]
];let intent=rules.find(([,re])=>re.test(q))?.[0];if(!intent&&named.length)intent=state.intent||'villas';
if(!intent){if(/^(مرحبا|اهلا|السلام عليكم|صباح الخير|مساء الخير)[ !؟.]*$/.test(q))return response('أهلاً بك في ويليامز آند هاربر. هل ترغب في معرفة المزيد عن الفيلات أم المجمع أم خطوات الشراء؟');if(/شكرا|مشكور/.test(q))return response('على الرحب والسعة. ما الذي تود معرفته أيضاً؟');return retrieve(q,v)||response('لا أملك إجابة دقيقة بما يكفي عن هذا السؤال. يمكنك إعادة صياغته أو التواصل مع فريقنا للحصول على التفاصيل.',null,true);}
state.intent=intent;
if(['bedrooms','bathrooms','price','land','pool'].includes(intent)){let t=selected.map(x=>facts(x,intent)).join('\n\n');if(intent==='price')t+='\n\nالأسعار المبدئية المنشورة لا تشمل الأثاث. يؤكد السعر النهائي وشروط العرض بحسب الفيلا والأرض المختارتين.';if(intent==='pool'&&/عمق|عرض/.test(q))t+='\n\nالطول منشور في الموقع؛ أما العرض والعمق فيحتاجان إلى تأكيد من المخطط أو فريقنا.';return response(t,v?v.id+'.php':'./#villas');}
if(intent==='villas')return response('يضم دومين ريد ستون 41 فيلا: 29 كلويه، و8 سيلين، و4 مارغو.\n\n'+selected.map(x=>facts(x,'overview')).join('\n\n'),'./#villas');
if(intent==='surface'||intent==='roomsize'){if(!v)return {text:'أي فيلا تهمك: كلويه أم سيلين أم مارغو؟',choose:true};return response(intent==='surface'?'المساحة المعروضة في الموقع لفيلا '+v.name+' هي '+knowledge.facts[v.id].publishedArea+' م². يجب الرجوع إلى جدول المخطط للتمييز بين المساحات الداخلية والتراسات والمجموع الكلي.':'الأبعاد التفصيلية موجودة في المخططات. لا أملك قياساً نصياً مؤكداً لكل غرفة، ويمكن لفريقنا توضيح القياس المطلوب.',v.id+'.php#plans');}
const entries={
human:['يمكنك التواصل مع فريقنا على الرقم ‎+212 634 048 977 أو فتح واتساب أدناه. لا تُرسل أي رسالة تلقائياً.',null,true],
location:['يقع دومين ريد ستون في مراكش، طريق أمزميز عند الكيلومتر 7.','domaine.php#localisation'],
rent:['الفيلات ليست متاحة للإيجار حالياً؛ المشروع في مرحلة البناء. يعرض الموقع إمكانات تأجير مستقبلية وخدمة إدارة للمالكين، مع تقديرات استرشادية لا تضمن العائد.','domaine.php#potentiel-locatif'],
service:['تتضمن كل فيلا غرفة خدمة بحمام مستقل في الطابق الأرضي بالقرب من المطبخ، وهي منفصلة عن الأجنحة وغرفة الضيوف الاختيارية.',(v?v.id:'chloe')+'.php'],
custom:['يمكن استبدال إحدى غرفتي الجلوس بغرفة ضيوف إضافية دون تكلفة إضافية. هذا هو التعديل الوحيد المتاح في التوزيع؛ وتبقى العمارة وبقية المخطط كما هي.','faq.php'],
included:['يشمل السعر المبدئي الفيلا وأرضها المرجعية وأعمال الطرق والشبكات والبناء والتشطيبات والمسبح الخاص والأعمال الخارجية المحددة في الوصف. الأثاث غير مشمول. تؤكد التفاصيل والسعر النهائي للفيلا المختارة.','faq.php'],
delivery:['يرتبط التوافر والجدول الزمني بالفيلا المختارة ومرحلة تنفيذها. يحدد موعد التسليم والشروط في الوثائق التعاقدية؛ يمكن لفريقنا تأكيد الوضع الحالي لطلبك.','reservation.php',true],
reserve:['اختر نموذجاً وموقعاً على المخطط العام بحسب التوافر الذي يؤكده الفريق. تحدد شروط الحجز والدفعات في العقد. تعبئة النموذج تجهز طلب تواصل ولا تحجز فيلا تلقائياً.','reservation.php'],
plans:['يمكنك الاطلاع على المخططات وتنزيلها من صفحة الفيلا. الملفات الأصلية المرفقة محفوظة بلغتها الأصلية.',(v?v.id:'chloe')+'.php#plans'],
lift:[v?.id==='chloe'?'لا تعرض صفحة كلويه مصعداً. يوجد مصعد خاص مقترح لسيلين ومارغو.':'يوجد مصعد خاص مقترح لسيلين ومارغو. الصور توضح التصميم واندماجه مع مساحات المعيشة.',(v&&v.id!=='chloe'?v.id:'celine')+'.php#ascenseur'],
furniture:['الأثاث غير مشمول في السعر. يمكن تقديم خدمة تأثيث بتكلفة إضافية وميزانية مستقلة وفق عرض سعر. المطبخ المجهز والأجهزة المنزلية ضمن التجهيزات المعروضة.',(v?v.id:'chloe')+'.php'],
materials:['تشمل لوحة المواد الرخام والترافرتين الرمادي المزرق والسيراميك والأخشاب وتجهيزات الأبواب والنوافذ. الصور توضيحية، وتعتمد المراجع النهائية في دفتر المواصفات.','matieres-finitions.php'],
solar:['ينص الموقع على تسخين المياه الصحية بالطاقة الشمسية مع دعم كهربائي احتياطي. لا يعني ذلك تأكيد وجود ألواح كهروضوئية تغطي كامل استهلاك الفيلا.','matieres-finitions.php#prestations-detail'],
climate:['تكييف مدمج للتبريد والتدفئة مع ضاغط مركزي خارجي، ومدفأة مقررة في غرفة المعيشة.','matieres-finitions.php#prestations-detail'],
smart:['تتضمن التصورات تحكماً منزلياً ذكياً مركزياً وإضاءة LED وستائر بمحركات وشيش رول كهربائياً أسود. تخضع المراجع والأداء والتوافق للتأكيد.','matieres-finitions.php'],
network:['يذكر الموقع توزيعاً تلفزيونياً بالألياف البصرية وتمديدات أولية للهاتف والإنترنت، دون تحديد سرعة اتصال أو اشتراك مشمول.','matieres-finitions.php#prestations-detail'],
security:['المجمع خاص ومغلق وآمن، مع حضور أمني على مدار 24 ساعة واستقبال عند المدخل.','domaine.php#securite'],
garden:['تحتوي كل فيلا على حديقة خاصة. وتكملها حديقة مشتركة منسقة بمساحة تزيد على 4 000 م² داخل المجمع. مساحة الحديقة الخاصة تعتمد على الأرض ومخططها، ولا تساوي مساحة الأرض كاملة.','domaine.php#parc-paysager'],
services:['المرافق المقررة تشمل الكونسيرج وريد كوفي وتراسه والتنظيف الجاف والبقالة وصالة الرياضة وملعبي بادل وحديقة للأطفال وأمناً على مدار الساعة.','domaine.php#maison-services'],
brochure:['الكتيبات الحالية متاحة بالفرنسية والإنجليزية والهولندية. يمكنك تنزيل الكتيب الفرنسي من الصفحة العربية؛ لم تُترجم الملفات الأصلية إلى العربية.',(v?v.id:'chloe')+'.php#brochures'],
build:['تتولى ويليامز آند هاربر بناء الفيلات وفق التصميم المعماري المحدد. الصور المتتابعة تحاكي مراحل البناء ولا تمثل صوراً لتقدم الأشغال الفعلي.',(v?v.id:'chloe')+'.php#avant-apres'],
identity:['ويليامز آند هاربر شركة تطوير عقاري تطور دومين ريد ستون في مراكش، وهو مشروع من 41 فيلا موزعة على نماذج كلويه وسيلين ومارغو.','apropos.php']};
if(entries[intent])return response(...entries[intent]);return retrieve(q,v)||response('يمكن لفريقنا توضيح هذه النقطة لك.',null,true);
}
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
const button=(text,fn)=>{const b=el('button','',text);b.type='button';b.onclick=fn;return b;};
const launch=button('',()=>{dialog.showModal();input.focus();});launch.className='wh-launch';launch.append(Object.assign(el('img','wh-seal',''),{src:'/assets/logo-definitif-ecusson-clair.svg',alt:'Williams & Harper'}),el('span','','مستشارك'));launch.setAttribute('aria-haspopup','dialog');
const dialog=el('dialog','wh-dialog');dialog.setAttribute('aria-labelledby','wh-title');
const head=el('header','wh-head');head.append(Object.assign(el('img','wh-seal',''),{src:'/assets/logo-definitif-ecusson-clair.svg',alt:'Williams & Harper'}));const titles=el('div');const title=el('h2','','مستشارك');title.id='wh-title';titles.append(title,el('small','','مساعد المجمع'));head.append(titles);const close=button('×',()=>dialog.close());close.className='wh-close';close.setAttribute('aria-label','إغلاق');head.append(close);
const body=el('div','wh-body wh-chat');body.setAttribute('role','log');body.setAttribute('aria-label','المحادثة مع مستشارك');body.setAttribute('aria-live','polite');body.setAttribute('aria-relevant','additions');
const form=el('form','wh-compose');const input=el('textarea');input.rows=1;input.maxLength=600;input.placeholder='اكتب سؤالك…';input.setAttribute('aria-label','اكتب سؤالك');const send=el('button','','إرسال');send.type='submit';form.append(input,send);
const foot=el('footer','wh-foot');foot.append(button('محادثة جديدة',start));const note=el('p','wh-chat-note','إجابات آلية من معلومات المشروع. هذه الخدمة ليست ذكاءً اصطناعياً توليدياً.');dialog.append(head,body,form,note,foot);document.body.append(launch,dialog);
function bubble(t,user=false){const b=el('div',user?'wh-message wh-user':'wh-message wh-bot');b.append(el('small','',user?'أنت':'مستشارك'),el('p','',t));body.append(b);return b;}
function action(box,label,path,external=false){const a=el('a','wh-link',label);a.href=external?path:window.whPageUrl(path,base);if(external){a.target='_blank';a.rel='noopener';}else a.addEventListener('click',()=>dialog.close());box.append(a);}
function submit(q){q=q.trim();if(!q)return;input.value='';bubble(q,true);const r=answer(q),box=bubble(r.text);if(r.path)action(box,'المصدر في الموقع',r.path);if(r.contact)action(box,'تواصل مع فريقنا عبر واتساب','https://wa.me/212634048977?text='+encodeURIComponent('مرحباً، أرغب في التحدث مع مستشار بشأن مشروع دومين ريد ستون.'),true);if(r.choose){const opts=el('div','wh-chips');villas.forEach(v=>opts.append(button(v.name,()=>submit(v.name))));box.append(opts);}body.scrollTop=body.scrollHeight;input.focus();}
form.addEventListener('submit',e=>{e.preventDefault();submit(input.value);});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit(input.value);}});
function start(){body.replaceChildren();state.villa=null;state.intent=null;input.value='';bubble('أهلاً بك في ويليامز آند هاربر. كيف يمكنني مساعدتك؟');const opts=el('div','wh-chips');['كم غرفة نوم في كل فيلا؟','ماذا يشمل السعر؟','ما المرافق المقررة في المجمع؟'].forEach(q=>opts.append(button(q,()=>submit(q))));body.append(opts);const more=el('details','wh-more');more.append(el('summary','','أسئلة أخرى'));const extra=el('div','wh-chips');['كيف أحجز فيلا؟','هل يمكن تعديل المخططات؟','أين يقع المجمع؟','ما موعد التسليم؟','ما مساحة الأرض لكل فيلا؟','أريد التواصل مع مستشار'].forEach(q=>extra.append(button(q,()=>submit(q))));more.append(extra);body.append(more);}
dialog.addEventListener('close',()=>launch.focus());start();
})();
