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
