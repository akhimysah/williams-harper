/* Shared navigation for the estate detail pages. */
document.querySelectorAll('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>a.closest('details').removeAttribute('open')));
document.querySelectorAll('[data-language]').forEach(a=>{const u=new URL(a.href);u.search=location.search;u.hash=location.hash;a.href=u.href;});
