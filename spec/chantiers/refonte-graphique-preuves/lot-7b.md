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
