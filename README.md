# Williams & Harper — site statique

Refonte du site williams-harper.com sur base blanche. Aucun framework, aucun build : des fichiers HTML/CSS/JS à déposer tels quels chez n'importe quel hébergeur (OVH, o2switch, Netlify, Vercel, GitHub Pages, Cloudflare Pages…).

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | Accueil : hero, manifeste, 3 villas, intérieurs, domaine, art de vivre, contact |
| `villa-chloe.html`, `villa-celine.html`, `villa-margaux.html` | Fiches villas : hero, texte officiel, chiffres, plans RDC/étage, inclusions, 5 photos |
| `galerie.html` | Galerie par villa + esquisses |
| `mentions-legales.html`, `confidentialite.html`, `404.html` | Pages annexes |
| `en/` | Pages anglaises statiques (`site-src/build_en.py`) |
| `styles.css`, `fx.js`, `forms.js`, `config.js`, `i18n.js` | Charte, mouvement, formulaires, configuration, traductions |
| `img/` (+ `sm/`, `plans/`), `pdf/` | Photos JPEG/WebP, plans, brochures |
| `site-src/build_brochure_chloe.py` | Brochure Villa Chloé (FR + EN) au format A4 paysage inspiré de la brochure Nautilus : `python3 site-src/build_brochure_chloe.py` → `pdf/brochure-chloe.pdf`, `pdf/brochure-chloe-en.pdf`. Rendus dans `img/chloe-nd/`. |
| `site-src/build_site.py` | Générateur du site : modifier les textes/photos ici puis relancer `python3 site-src/build_site.py && python3 site-src/build_en.py` |

## Avant la mise en ligne
1. **Formulaires** — le formulaire de contact fonctionne sans réglage selon l'hébergement :
   - **OVH / tout hébergement PHP** : `contact.php` envoie la demande à `contact@williamsharper.com` (modifier `$TO` et `$FROM` en tête du fichier ; `$FROM` doit être une adresse du domaine), envoie un accusé de réception au visiteur, et journalise chaque demande dans `../wh-demandes.log` (hors web) ou `.wh-demandes.log` (bloqué par `.htaccess`). Pot de miel et limite de 20 envois/heure/IP inclus.
   - **Netlify** : Netlify Forms est détecté sur `*.netlify.app` ; avec un domaine personnalisé, mettre `netlifyForms: true` dans `config.js`. Les demandes arrivent dans l'onglet *Forms* (notifications e-mail à activer).
   - **Vercel / autre hébergement statique** : renseigner `formEndpoint` dans `config.js` (ex. Formspree `https://formspree.io/f/xxxx`).
   - Sans aucun de ces cas, le formulaire ouvre la messagerie du visiteur avec la demande pré-remplie.
2. **Domaine** : si le site n'est pas sur `www.williams-harper.com`, mettre à jour `sitemap.xml`, `robots.txt` et les balises `canonical` dans `site-src/build_site.py`.

## Déploiement
OVH (Apache) : déposer le dossier par FTP (`.htaccess` fourni). Netlify / Vercel : `netlify.toml` / `vercel.json` fournis.

## Film de lancement
Sources Remotion dans `site-src/film/` (voir son README). Livrables dans `dist/` : master, version web 1080p, affiche.

## Maquettes 3D des architectes

Déposer les fichiers **GLB** (export glTF binaire depuis SketchUp, Revit, 3ds Max, Blender…) dans `models/`, puis renseigner `models3d` dans `config.js` :

```js
models3d: { "chloe": { url: "models/chloe.glb", scale: 1, rotation: 0, offset: [0, 0, 0] } }
```

La villa texturée remplace alors la maquette blanche sur la page de la villa, sur la page Maquette 3D et en VR (« Entrer en VR » sur un casque compatible, site en HTTPS). Conseils d'export : unités en mètres, origine au centre de la villa, textures incluses (≤ 2048 px), moins de 300 000 triangles par villa pour rester fluide sur mobile et casque.
