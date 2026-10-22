(() => {
  const dedicated = ["/demande-reservation-villa", "/en/villa-reservation-enquiry", "/nl/villa-reserveringsaanvraag", "/ar/%D8%B7%D9%84%D8%A8-%D8%AD%D8%AC%D8%B2-%D9%81%D9%8A%D9%84%D8%A7"].some(p=>decodeURIComponent(p)===decodeURIComponent(location.pathname)) || /(?:^|\/)reservation\.php$/.test(location.pathname);
  if (!dedicated && new URLSearchParams(location.search).get('intent') !== 'reservation') return;
  const copy = {
  "ar": {"title":"لنجهز طلب حجزك.","intro":"حدد الفيلا التي تهمك. يؤكد فريقنا التوافر ويرافقك خلال خطوات الحجز.","message":"أرغب في معرفة التوافر وشروط حجز فيلتي في دومين ريد ستون."},
  "fr": {
    "title": "Préparons votre réservation.",
    "intro": "Indiquez la villa qui vous intéresse. Notre équipe vous confirme les disponibilités et vous accompagne dans les étapes de votre réservation.",
    "message": "Je souhaite connaître les disponibilités et les modalités pour réserver ma villa au Domaine Red Stone."
  },
  "en": {
    "title": "Let’s prepare your reservation.",
    "intro": "Tell us which villa interests you. Our team will confirm availability and guide you through the reservation process.",
    "message": "I would like to know the availability and the steps to reserve my villa at Domaine Red Stone."
  },
  "nl": {
    "title": "Laten we uw reservering voorbereiden.",
    "intro": "Laat ons weten welke villa u interesseert. Ons team bevestigt de beschikbaarheid en begeleidt u bij de stappen van uw reservering.",
    "message": "Ik ontvang graag informatie over de beschikbaarheid en de stappen om mijn villa op Domaine Red Stone te reserveren."
  }
};
  const text = copy[document.documentElement.lang] || copy.fr;
  const contact = document.querySelector('#contact');
  if (!contact) return;
  if (!dedicated) contact.querySelector('h1, h2').textContent = text.title;
  if (!dedicated) contact.querySelector('p').textContent = text.intro;
  const message = contact.querySelector('textarea[name="message"]');
  if (!message.value.trim()) message.value = text.message;
  const whatsapp = contact.querySelector('.contact-whatsapp');
  const choice = contact.querySelector('#villaChoice');
  const updateWhatsApp = () => {
    const selected = /^(Villa |فيلا )/.test(choice.value) ? '\n\n' + choice.value : '';
    whatsapp.href = 'https://wa.me/212634048977?text=' + encodeURIComponent(text.message + selected);
  };
  updateWhatsApp();
  choice.addEventListener('change', updateWhatsApp);
})();
