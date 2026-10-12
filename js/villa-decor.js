// Décor extérieur des villas, extrait des photos du site (Higgsfield 3D Objects → models/interieur/x-*.glb) et placé d'après elles.
// Coordonnées du plan de chaque villa (px, voir MODELS dans villa3d.js) : [fichier, x, y, taille (m), 'h' hauteur | 'w' largeur, rotation, collision, hauteur du pied (m)]
const PI = Math.PI, D = 0.17; // D : niveau des terrasses
export const EXT = {
  chloe: [ // jardin de rocaille devant la façade sud, terrasse du bassin à l'est
    ['x-cascade', 640, 1240, 3.2, 'w', 0], ['x-monolithes', 470, 1150, 2.6, 'h', 0.3], ['x-monolithes', 525, 1175, 2.1, 'h', 1.4],
    ['x-heron-or', 330, 1180, 1.7, 'h', 0.8], ['x-heron-or', 385, 1240, 1.5, 'h', 2.0], ['x-heron-or', 300, 1305, 1.6, 'h', -0.5],
    ['x-pierre-rayee', 860, 1320, 1.3, 'w', 0.5], ['x-tronc-blanc', 760, 1300, 1.9, 'h', 0.7],
    ['x-bonsai', 965, 1210, 2.4, 'h', 0], ['x-bonsai', 300, 1050, 2.0, 'h', 1.2],
    ['x-rocher', 700, 1355, 1.8, 'w', 0.4], ['x-rocher', 1080, 1285, 1.4, 'w', 2.2],
    
    ['x-jarre', 400, 960, 1.0, 'h', 0], ['x-jarre', 432, 1010, 0.75, 'h', 0],
    ['x-topiaire-pot', 1215, 620, 2.0, 'h', 0], ['x-topiaire-pot', 1215, 1030, 2.0, 'h', 0], ['x-bananier', 300, 520, 2.2, 'h', 0, true, D],
    ['x-transat', 840, 620, 1.9, 'w', PI / 2, true, D], ['x-transat', 840, 700, 1.9, 'w', PI / 2, true, D], ['x-transat', 840, 780, 1.9, 'w', PI / 2, true, D],
  ],
  celine: [ // sculpture dorée au bord du bassin, salons d'extérieur sur les terrasses, jardin d'entrée au nord
    ['x-sculpture-or', 650, 1005, 2.6, 'h', 0.4, true, D],
    ['x-canape-ext', 330, 1030, 3.0, 'w', 0, true, D], ['x-table-feu', 330, 1098, 1.5, 'w', 0, true, D],
    ['x-canape-ext', 980, 1190, 2.8, 'w', 0, true, D], ['x-table-feu', 980, 1252, 1.4, 'w', 0, true, D],
    ['x-transat', 850, 1335, 1.9, 'w', 0], ['x-transat', 930, 1335, 1.9, 'w', 0], ['x-transat', 1010, 1335, 1.9, 'w', 0],
    ['x-heron-or', 560, 330, 1.7, 'h', 0.5], ['x-rocher', 450, 380, 1.6, 'w', 0], ['x-bananier', 230, 420, 2.2, 'h', 0], ['x-bananier', 700, 420, 2.0, 'h', 1.0],
    ['x-jarre', 395, 520, 1.0, 'h', 0], ['x-jarre', 478, 520, 0.8, 'h', 0],
    ['x-pin', 1265, 700, 6, 'h', 0], ['x-pin', 1270, 1000, 5.5, 'h', 1.5],
  ],
  margaux: [ // deux salons d'extérieur et transats autour du bassin, cour d'entrée au nord
    ['x-canape-ext', 280, 1000, 3.0, 'w', 0, true, D], ['x-table-feu', 280, 1070, 1.5, 'w', 0, true, D],
    ['x-canape-ext', 1080, 1000, 3.0, 'w', 0, true, D], ['x-table-feu', 1080, 1070, 1.5, 'w', 0, true, D],
    ['x-transat', 960, 1255, 1.9, 'w', 0], ['x-transat', 1040, 1255, 1.9, 'w', 0], ['x-transat', 220, 1255, 1.9, 'w', 0], ['x-transat', 295, 1255, 1.9, 'w', 0],
    ['x-rocher', 200, 1335, 1.7, 'w', 0.5], ['x-rocher', 1000, 1365, 1.5, 'w', 1.8], ['x-pin', 150, 1150, 6.5, 'h', 0], ['x-pin', 1262, 1050, 6, 'h', 2.0],
    ['x-topiaire-pot', 750, 300, 2.0, 'h', 0, true, D], ['x-topiaire-pot', 890, 300, 2.0, 'h', 0, true, D], ['x-bananier', 600, 400, 2.2, 'h', 0],
    ['x-monolithes', 1255, 600, 2.4, 'h', 0], ['x-bonsai', 1255, 350, 2.2, 'h', 0],
  ],
};
