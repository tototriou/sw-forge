# Preuve — lot 7b de la refonte graphique : Siège · Recommandations

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à B.10.
Décisions appliquées (A.2 bis) :
- 15 : les decks en tableau, dépliables en carte ;
- 13 précisée : en-tête par `BarreActions` ;
- 4 précisée : aucune action mise en avant.

## Tests écrits AVANT (commit `40cd2d8`)

`tests/rendu/recos.test.tsx`, rendu bureau, 37 vérifications :

- **la page** :
  - les actions : Créer une recommandation, Importer, Tout exporter, Tout effacer ;
  - les filtres d'origine avec leurs effectifs ;
  - la recherche par monstre ;
  - chaque recommandation repliée : nom, « Importée », résumé, compositions,
    Consulter, Exporter, Éditer, Supprimer, et « Analyser » désactivé avec
    sa raison.
- **une recommandation dépliée**, ses decks ouverts par une vraie recherche
  (`chercheMonstre`, puisque le rendu serveur ne clique pas) :
  - les consignes générales et celles du deck ;
  - le lead, les sets, la stat et sa bascule ;
  - « Fort contre », une défense à modifier et à ajouter ;
  - le repli et l'édition de chaque deck.
- **l'édition** : Terminer, Ajouter un deck vide, Importer un deck
  d'offense désactivé avec sa raison.

## Décision 15, prise avec Thomas

1. Question posée : garder les cartes, ou le tableau de la maquette ?
2. Thomas demande le lien de la maquette, puis « propose-moi un mix des deux ».
3. Proposition mixte décrite, puis « mets-la dans la maquette ».
4. Planche « Siège · Recommandations — proposition mixte (tableau + détail) »
   ajoutée à la toile.
5. « Ok, pars là-dessus ».

## Ce qui change

| Commit | Quoi |
|---|---|
| `cddede4` | décision 15 et spec (`recommandations.md` § Repli deck par deck), avant le code |
| `439dfa6` | à la souris, un deck = une ligne (offense avec sets visés collés à chaque monstre · fort contre · verdict avec les libellés des filtres, phrase complète en infobulle, « réalisable N fois »), rangée d'intitulés, carte détaillée d'avant sous une ligne dépliée ; mêmes boutons (chevron, crayon) ; au doigt rien ne change |
| `f04845c` | en-tête bureau (titre, compteur, `BarreActions`) ; test `testRenduRecosEnTete` |

**Une assertion recalée, pas assouplie** : le compte de « Fort contre »
(toujours 2, un par deck) se fait désormais hors de la rangée d'intitulés des
colonnes (`data-intitules-decks`), qui porte elle aussi ce mot. Toutes les
autres assertions d'avant sont inchangées.

Inventaire : aucune perte, aucun déplacement (le panneau mobile garde tous
les libellés ; le tableau AJOUTE « Offense · sets visés », « Fort contre »,
« Verdict »).

## Vérifications

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu-recos siege        → 158 vérifications passées
$ node tests/run.mjs rendu-recos              → 40 vérifications passées (dernier état)
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; gabarit de colonnes
  (grid-cols-[20px_minmax(0,1fr)_minmax(0,150px)_minmax(0,190px)_auto]) et
  classes lg: de la ligne présents dans le CSS
```

## À regarder sur le serveur de dev (non testable)

- **Le tableau** :
  - l'alignement des colonnes entre l'intitulé et les lignes ;
  - les icônes de sets à côté de chaque monstre ;
  - la carte détaillée sous une ligne dépliée.
- **Le verdict dans la ligne**, après « Analyser mes decks » : pastille,
  infobulle, « réalisable N fois ».
- **Un deck en édition** : sa ligne, puis la carte d'édition dessous.
- **L'en-tête** : le passage des boutons au « ⋯ » selon la largeur.
- **Téléphone** : non regardé, il reste en cartes (lot 11).

## Ajustements demandés par Thomas, puis validation (2026-09-26 et 27)

Chaque ajustement a son commit et sa spec (`recommandations.md`, sauf
mention). Décisions 16 à 19 inscrites en A.2 bis.

| Commit | Demande de Thomas | Quoi |
|---|---|---|
| `c06d36d` | « revois les couleurs et l'affichage sur les cards » | cartes neutres, statut aux pastilles, en-tête sur une ligne |
| `12496d4` | « revoir le système de bouton de cette page, comme dans la maquette » | un seul bouton d'icône (28 px) à la souris, chevron en tête, crayons dans la librairie |
| `738f833` | « au moins 5 chiffres » dans les champs d'édition | champ de bonus en `6ch` (il en montrait trois) |
| `592e4f3` | « revoir tous les boutons de la page » | 28 px pour les boutons à libellé et les pastilles, en édition comprise |
| `dd2da29`, `a9c899a` | « boutons unifiés dans l'application », « le même rendu que la maquette » | **décision 16** : gabarit de la maquette dans `src/ui/` (32 / 28 px, survol au fond) ; « Se déconnecter » dans la librairie (`librairie-ui.md`, `design.md`) |
| `eb9bb3a`, `20beae2` | « l'organisation des boutons comme sur la maquette » | `BoutonIcone.libelleALaSouris` ; Importer visible, barre d'outils sur une ligne, « Éditer ce deck » en pied du détail, ajouts en pied du tableau ; « Déplier tous les decks » reste en haut (un clic ne déplace pas ce qu'on clique) |
| `c458a61` | « Analyser » en double sur petit écran | caché sous `lg`, le panneau « Options » le porte |
| `d0bbd39` | « revois cet affichage » (capture) | le champ de recherche et ses trois cases en un seul bloc |
| `16f0050` | « si on clique, ça cache l'analyse » | **décision 17** : « Analyser mes decks » à deux états ; [retrait #17] « Réanalyser mes decks » |
| `8284ab2` | « autofocus sur le monstre suivant » | **décision 18** : le curseur passe au slot vide suivant (deck et défense visée) ; `slotVideSuivant.ts`, testé |
| `4b40d07` | « un tri attaque / défense au lieu de toutes / mes recos / importées » | **décision 19** : vue Défense calculée (`recoDefenses.ts`, testé), format exporté inchangé ; [retrait #19] le filtre d'origine |

**Tests modifiés, et pourquoi.** Assertions écrites PENDANT ce lot, mises
à jour quand Thomas a changé ce qu'elles décrivaient : le contenu du menu
« ⋯ » (Importer en est sorti, `20beae2`). Assertions d'AVANT le lot
remplacées : les trois du filtre d'origine (`4b40d07`), dont la fonction
est retirée (décision 19, [retrait #19]). Toutes les autres sont
inchangées et passent. Tests ajoutés : `siege-slot-suivant` (10),
`reco-defenses` (13), `testRenduRecosVueDefense` (9).

**Validé par Thomas le 2026-09-27** (« ok c'est super », puis « oui,
clos »). Téléphone non regardé (lot 11).
