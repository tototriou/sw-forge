# Preuve — lot R6 du rebranding : Siège et Recommandations

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R6.
Scripts du scratchpad : `r6-captures.mjs`, `r6-tel-carte.mjs`, 2026-09-29.

## 1. Avant de toucher

Tests de rendu de la zone, verts avant le lot :

```text
node tests/run.mjs RenduSiege RenduRecos RenduTelephoneSiege RenduTelephoneRecos → 144 vérifications passées
```

Captures de nos écrans sur l'app construite, compte réel importé et une
recommandation de deux decks semée : Siège (Défense, avec et sans « Vérifier
mes speed ») et Recommandations (repliée, consultée, analysée), à 1440 px et
au téléphone (390 px, **tactile** : `compact:` suit le pointeur, une fenêtre
étroite à la souris ne montre pas l'écran du téléphone). Aucun débordement
mesuré dans la page à 390 et 360 px.

## 2. Relevé : les planches contre nos écrans

Planches `BsSiege`, `BsRecommandations`, `BsMobileSiege`.

| Zone | Toile | Nos écrans | Décision |
|---|---|---|---|
| En-tête du Siège | surtitre « Siège », « Défense de siège », une phrase ; Défense \| Attaque dans la page ; « Nouvelle équipe » en aplat braise | « Défense » + compteur ; côtés dans la barre latérale ; aucune action en aplat (refonte, décision 4 précisée : « ça rend pas bien ») | 38 : gardé |
| Carte d'équipe | portraits de 68 px, nom dessous ; « Lead détecté » ; statut toujours affiché en bas | tuile portrait + nom + VIT + sets ; pastille du lead avec son pourcentage ; statut à la demande (« Vérifier mes speed ») | 39 : gardé |
| Équipe choisie | bord braise de 2 px, panneau « Vérification du tick » de 440 px à droite (VIT, tick, alerte, bonus, « Voir les runes ») | pas de sélection ; statut et « Valider le tick » dans la carte ; détail des runes au clic sur un monstre ; « Voir le speed tune » ouvre l'outil en modale | 40 : non |
| Fin de grille | carte en pointillés « Ajouter une équipe » | bouton « Ajouter une équipe » dans l'en-tête, défilement jusqu'à la nouvelle | 41 : **oui**, en plus du bouton |
| En-tête des recos | « Siège · Partage », « Recommandations de siège », une phrase ; « Importer un deck », « Exporter en JSON » en aplat | « Recommandations » + compteur ; Importer, Créer, Tout exporter, Tout effacer ; aucun aplat | 42 : gardé |
| Corps des recos | UN deck en édition (Monstre / Sets / Stats minimales, note, « Ajouter un monstre ») ; à droite « Comparé à ton compte » : anneau « 1 / 3 prêt », état par monstre, barre de progression | une LISTE de recommandations (lots de decks), repliées ; analyse à la demande, en synthèse dans la carte (decks au niveau, filtres de verdict, une ligne par deck) | 42 : gardé |
| Rouges d'état | `bad` (« Absent du compte ») | `fire`, le rouge de l'élément Feu (tuile fautive, contour « Pas au tick », monstre manquant, erreurs d'import) ; « pile au tick ✓ » en or du Vent | 43 : **`bad` et `good`** |
| Téléphone | retour + « Siège » ; Défense \| Attaque pleine largeur ; statut toujours visible, explication sur fond sombre | coquille du R4 ; côtés dans le panneau de l'onglet Siège ; interrupteur « Vérifier mes speed » dans la page | 45 : gardé |
| Icônes dans l'écran | — | lucide : état vide (château, ampoule), « Voir le speed tune » (minuteur), « Importer un deck d'offense » et « Fort contre » (épées) | 44 : **icônes d'atelier** |

Absents de la toile et gardés sans question : la recherche d'équipe par
monstre, l'export et l'import d'équipes, la vue Attaque / Défense et la
recherche par composition des recos, les consignes, les défenses visées.

Contrôles natifs relevés dans ces écrans (`<button>`, `<input>`) : tous sont
des exceptions déjà écrites dans le code — liens soulignés au doigt, filtres
de verdict (une couleur par statut), grille des sets, sélecteurs de fichier
jamais dessinés. Rien à reprendre au titre de la librairie.

## 3. Les changements

- **Couleurs d'état (43)** — `a329378c`. `fire` → `bad`, `wind` → `good`
  dans les quatre composants du Siège ; les tables d'éléments (dégradés des
  portraits) restent. Voiles d'opacité remplacés par les fonds doux.
  Contrastes (`r6-contrastes.mjs`), avant → après :

  ```text
                                    Atelier        Forge
  VIT fautive sur sa tuile          4,17 → 5,65    3,58 → 5,53
  « manque N »                      4,55 → 5,65    3,83 → 5,53
  « pile au tick ✓ »                3,78 → 5,48    6,65 → 8,25
  verdict « À revoir » sur bad-soft 4,88 → 5,65    4,26 → 5,53
  contour de carte sur bg           5,26 → 6,08    5,28 → 6,85
  ```

  Seul sous le seuil, avant comme après : le contour à 60 % d'un deck
  bloquant (2,70 / 2,81) — il double la pastille de verdict, il ne porte pas
  seul l'information.
- **Icônes d'atelier (44)** — `f3198798`. Captures en place, deux thèmes
  (`r6-icones.mjs`) : états vides (bouclier, épée, parchemin), « Voir le
  speed tune », « Importer un deck d'offense », « Fort contre ».
- **Carte d'ajout (41)** — `fb770b5c`. Mesurée sur l'app construite
  (`r6-ajout.mjs`), deux thèmes : carte 566 × 155 comme l'équipe voisine ;
  après le clic, l'équipe 4 occupe exactement sa position (850, 373),
  défilement 0 → 0 ; désactivée pendant une recherche.

- **Avertissement en jaune (46)**, demandé à la relecture. Balayage de toutes
  les teintes OKLCH (`warn-teintes.mjs`) : la couleur la plus vive encore
  lisible, et sa distance aux couleurs réservées. En Atelier, un orange ou un
  ambre lisible tombe à ΔE 2 à 4 de la braise foncée ou de l'or. Planche
  [lot-R6-warn-planche.png](lot-R6-warn-planche.png) : actuel, jaune, violet,
  sarcelle, en situation, deux thèmes. Retenu : jaune / ocre.
  Mesures (`warn-ocre.mjs`) :

  ```text
                              Atelier #7C630D    Forge #F2C230
  sur bg / panel / panel2     5,07 / 5,66 / 4,65 10,89 / 9,57 / 8,30
  sur son fond doux           4,91 (#FBEDB7)      7,69 (#39311B)
  texte bg sur l'aplat        5,07               10,89
  ΔE braise lisible / or      9 / 4              16 / 11
  ```

  Fond doux d'Atelier : 12 % dans `panel` (`#EFEBDC`) était à ΔE 1,3 de
  `panel2` ; chroma 0,07 à la clarté de l'ancien doux → ΔE 5,0.

## 4. Vérifications

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduSiege RenduRecos RenduTelephoneSiege RenduTelephoneRecos Reco SiegeStatut SiegePastille → 234 passées
node tests/run.mjs navigation                     → vert (avec la zone : 209)
node tests/run.mjs RenduSiege RenduTelephoneSiege refonte → 121 passées
node scripts/inventaire-ui.mjs --verifier         → aucune perte (prop `texte` déclarée)
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
npm run build                                     → classes `bad` émises, ordre vérifié
```

## 5. Ce que je n'ai pas pu prouver

- Le **téléphone réel** : captures en émulation tactile de Playwright
  (390 et 360 px), pas sur un appareil.
- Au passage, un défaut **antérieur au lot**, non corrigé : l'état vide de la
  défense écrit « Aucune équipe d'défense » (`d'${noun}` avec
  `noun = 'défense'`). À corriger à part si Thomas le veut.
