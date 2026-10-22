# Site OVH (PHP, 4 langues) — nouvelle base graphique

Sources de l'habillage du site `williams-harper.com` hébergé chez OVH (paquet PHP `app/` + `www/`).

- `assets/wh-base.css` : la charte (ivoire, Cormorant Garamond, Jost, vert forêt du logo), en-tête, héros, galeries, pied de page, RTL.
- `assets/wh-base.js` : en-tête fixe, menu mobile, révélation douce au défilement.
- `build_ovh.py` : prend le paquet OVH d'origine (extrait du zip « Williams_Harper_OVH_Villas_4_Langues »), conserve tout le contenu
  (textes, SEO, URL, redirections, PHP, brochures, plans, photos) et regénère les 40 gabarits avec la nouvelle base.

```bash
python3 ovh-site/build_ovh.py <paquet-source-extrait> ovh-site/dist/Williams_Harper_OVH_Nouvelle_Base --zip ovh-site/dist/Williams_Harper_OVH_Nouvelle_Base.zip
```

Le dossier `dist/` (≈ 300 Mo avec les photos et brochures) n'est pas versionné.
