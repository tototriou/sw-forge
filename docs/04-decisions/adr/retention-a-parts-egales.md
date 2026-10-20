# Rétention à parts égales entre les stats

## Décision

Pendant la construction des moitiés de build, chaque compartiment garde ses
meilleures combinaisons dans plusieurs **tranches de rétention** : une
générique, une pour l'ensemble des minimums, et une par stat à protéger
(stats à minimum et stats de l'objectif). **Chaque tranche par stat a le
même nombre de places, `bucketCap`**, quelle que soit la stat.

Le moteur ne donne pas plus de places à une stat jugée « difficile » : il
n'a pas de réglage « Prioriser les stats les plus difficiles », et les
préréglages de pré-filtrage Haut et Extrême ne changent que la largeur du
pré-filtrage (et `bucketCap`, qui en dérive).

## Raisons

- **Prioriser les stats les plus dispersées trouvait moins de builds
  valides** : à pré-filtrage et budget de rétention égaux, 5 à 11 % de
  builds valides en moins sur les recherches mesurées (deux recherches
  lourdes à plusieurs minimums, aux préréglages Moyen et Haut).
- **Cette priorité ne gagnait aucun meilleur build** : le meilleur build de
  chaque critère était le même avec et sans elle, une fois moins bon avec
  elle ;
  sur les recherches à réponse unique, le même build.

## Options écartées

- **Répartir les places des tranches par stat selon la dispersion de chaque
  stat** (ancien fonctionnement, remplacé) : le coefficient de variation
  des sous-stats sur le pool filtré fixait la part de chaque tranche, à
  budget total égal, sous l'interrupteur « Prioriser les stats les plus
  difficiles », que les préréglages Haut et Extrême activaient d'office.
  Moins de builds valides, aucun meilleur build gagné.

## Conséquences

- **Une stat rare n'a pas plus de places qu'une autre** : seul un
  préréglage plus large (`slotFilterCap`, `bucketCap` dérivé) en donne
  davantage, à toutes les tranches à la fois.
- **Une recette qui porte `adaptiveTrancheWeighting` s'importe sans
  erreur** : le champ est accepté et sans effet, à l'écran comme au CLI.
- La rétention par tranches :
  [elagages.md § Pré-filtrage heuristique et compartiments](../../03-developpeur/optimizer/moteur/elagages.md#pré-filtrage-heuristique-et-compartiments) ;
  la construction des moitiés :
  [pipeline.md § Construction des moitiés](../../03-developpeur/optimizer/moteur/pipeline.md#construction-des-moitiés) ;
  les réglages de l'écran :
  [conditions-et-reglages.md](../../02-app/optimizer/ecran/conditions-et-reglages.md).
