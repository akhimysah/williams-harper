// Configuration du site — à adapter avant la mise en ligne.
window.WH_CONFIG = {
  // Adresse qui reçoit les demandes (utilisée pour le repli "mailto").
  email: "contact@williamsharper.com",
  // Service d'envoi des formulaires (Formspree, Basin, Netlify Forms, votre API…).
  // Exemple Formspree : "https://formspree.io/f/xxxxxxxx". Laisser vide pour utiliser le repli e-mail.
  formEndpoint: "",
  // Netlify Forms : détecté automatiquement sur *.netlify.app ; forcer à true si le site est sur Netlify avec un domaine personnalisé.
  netlifyForms: false,
  // Lien de téléchargement direct des brochures (laisser vide tant que les PDF ne sont pas fournis).
  // Avancement du chantier par villa : étape atteinte (1 à 4) et date de mise à jour. null = non communiqué.
  progress: {
    "Villa Chloé":   { step: null, updated: "" },
    "Villa Céline":  { step: null, updated: "" },
    "Villa Margaux": { step: null, updated: "" }
  },
  brochures: { "Villa Chloé": "pdf/brochure-chloe.pdf", "Villa Céline": "pdf/brochure-celine.pdf", "Villa Margaux": "pdf/brochure-margaux.pdf" },
  brochuresEN: { "Villa Chloé": "pdf/brochure-chloe-en.pdf", "Villa Céline": "pdf/brochure-celine-en.pdf", "Villa Margaux": "pdf/brochure-margaux-en.pdf" },
  interiorBrochure: "pdf/brochure-interieur.pdf",
  magazine: "pdf/magazine-williams-harper.pdf",
  // Maquettes 3D des architectes (fichiers GLB déposés dans models/). Dès qu'une entrée est renseignée, elle remplace la maquette blanche
  // de la villa sur le site et en VR. scale : facteur d'échelle vers les mètres ; rotation : degrés autour de la verticale ; offset : [x, y, z] en mètres.
  models3d: {
    // "chloe":   { url: "models/chloe.glb",   scale: 1, rotation: 0, offset: [0, 0, 0] },
    // "celine":  { url: "models/celine.glb",  scale: 1, rotation: 0, offset: [0, 0, 0] },
    // "margaux": { url: "models/margaux.glb", scale: 1, rotation: 0, offset: [0, 0, 0] }
  }
};
// Aperçu local depuis admin.html (réglages enregistrés dans ce navigateur uniquement).
try{const o=JSON.parse(localStorage.getItem('wh-config-override')||'null');if(o)Object.assign(window.WH_CONFIG,o)}catch(e){}
