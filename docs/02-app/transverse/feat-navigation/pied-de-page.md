# Navigation — pied de page

Partie de [Navigation](README.md). Le pied de page vit dans [App.tsx](../../../../src/App.tsx).

- **À l'ordinateur, une rangée** de 79 px de haut : logo à gauche, mentions au
  centre (données locales ; © Com2uS, source SWARFARM, projet non officiel),
  liens à droite, **en colonne** (GitHub, version, Discord). La colonne de
  liens se cale à droite mais ses lignes s'alignent à gauche, pour que les
  icônes restent dans l'axe.
- **Au téléphone, une colonne centrée** : logo, liens sur une ligne en libellés
  courts (« GitHub », « Discord »), mentions.
- Police du texte, pas la mono. Liens en encre secondaire, braise au survol ;
  mentions en encre tertiaire.
- Rappel « données 100 % locales » ; crédit Com2uS / source SWARFARM.
- **Absent en écran partagé**, et **sur l'Optimizer au format bureau dès qu'il
  a des colonnes** (agencements A2 et A3) : la page y tient dans la fenêtre et
  chaque colonne défile seule, jusqu'au bas de la fenêtre
  ([optimizer/ecran/](../../optimizer/ecran/README.md#défilement)). La page le
  signale (`data-page-fenetre`) et [index.css](../../../../src/index.css)
  masque le pied (`data-pied-de-page`). En une colonne (A1), l'Optimizer
  défile comme les autres pages et le garde ; le téléphone aussi.
