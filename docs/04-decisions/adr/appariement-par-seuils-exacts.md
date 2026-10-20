# Appariement par seuils exacts, en parallèle dans l'ordre séquentiel

## Décision

La recherche de runes de l'Optimizer construit deux moitiés de build (trois
emplacements chacune), puis les **apparie** : chaque combinaison de la
première face à chaque combinaison de la seconde. Cet appariement se fait
ainsi :

- **par seuils exacts sur tableaux typés** : pour une combinaison de la
  première moitié et une stat contrainte, l'apport de chaque combinaison de
  la seconde se réduit à un entier, et la paire échoue au test rapide
  (`quickOk`) si et seulement si cet entier sort d'un intervalle calculé une
  fois par ligne. Les combinaisons de la seconde moitié, triées par cet
  entier, se sautent par blocs entiers sans être jugées une à une. Seules
  sont sautées des paires que le test rapide rejetterait : le résultat est
  exactement celui du parcours de référence (`pairBuckets`) ;
- **avec une validation typée** des paires qui passent le test rapide :
  sets comptés par indices, stats en sommes d'entiers, puis les mêmes
  expressions que le calcul de référence, opérande par opérande ;
- **en entiers 32 bits pour les stats, en flottants 64 bits pour les
  identifiants de runes**, deux domaines où le calcul est exact. Hors de ce
  contrat numérique, vérifié avant toute paire, le parcours de référence
  prend l'appariement ;
- **au-delà de 100 millions de paires, en parallèle sur un nombre de
  Workers qui suit la machine** : ses cœurs physiques moins deux, au moins
  deux, au plus huit. Quand ils ne sont pas connus, ils se déduisent des
  fils logiques (la moitié, deux fils par cœur) ; quand la machine ne dit
  rien, quatre. Le travail part en morceaux de lignes consécutives,
  distribués à la demande ;
- **en rendant l'ordre séquentiel** : les morceaux se fusionnent dans
  l'ordre du parcours, et le plafond de candidats est global. Le parallèle
  rend exactement le résultat d'un parcours sur un seul fil, quel que soit
  le nombre de Workers.

## Raisons

- **Presque toutes les paires échouent au test rapide** : plus de 99,6 %
  sur les recherches mesurées. Les juger une à une, c'est passer l'essentiel
  du temps sur des paires vouées au rejet, à environ 8 millions de paires
  par seconde ; les sauter par seuils exacts porte le débit à plusieurs
  centaines de millions, jusqu'à quelques milliards, selon la recherche.
- **Les seuils ne valent que s'ils sont exacts** : une paire sautée à tort
  est un build perdu sans que rien ne le signale. D'où des entiers, dont les
  comparaisons sont exactes, et un contrat numérique vérifié avant tout
  saut.
- **La validation est le travail qui reste** une fois les sauts faits ;
  l'écrire sur tableaux typés évite de construire des objets pour des
  paires qui ne seront pas gardées.
- **Le nombre de cœurs change d'une machine à l'autre** : un nombre de
  Workers fixe laisse des cœurs inoccupés sur une grosse machine et en
  surcharge une petite.
- **Deux cœurs laissés aux autres tâches ne ralentissent pas la
  recherche** : sur 8 cœurs, 6 Workers vont aussi vite que 8 sur la plus
  lourde recherche mesurée, et plus vite (de 13 %) sur une autre. Quand la
  machine est occupée ailleurs, la recherche reste aussi rapide à 6 qu'à 8,
  et prend moins à ce qui tourne à côté (8 % de débit en moins pour ces
  tâches à 6 Workers, 13 % à 8).
- **Un résultat qui dépend du découpage n'est pas reproductible** : avec
  l'ordre séquentiel et un plafond global, une recherche rend les mêmes
  builds sur toutes les machines, et le parcours sur un seul fil reste la
  référence de tous les tests.

## Options écartées

- **Force brute sur GPU** (possibilité écartée) : une fois les sauts faits,
  il ne reste presque plus de balayage à accélérer.
- **Solveur à optimum unique** (possibilité écartée) : l'écran propose
  plusieurs builds, triables selon chaque objectif ; un solveur qui rend le
  seul meilleur pour un objectif ne donne pas cette liste.
- **Virgule flottante 32 bits** (possibilité écartée) : environ 7 chiffres
  significatifs, trop peu pour garder l'exactitude des seuils.
- **Mémoire partagée entre Workers (`SharedArrayBuffer`)** (possibilité
  écartée) : elle exige des en-têtes d'isolation que le site ne peut pas
  poser. Chaque Worker reçoit sa propre copie des tableaux, transférée une
  fois.
- **Module natif pour l'application de bureau** (possibilité écartée) : le
  site et le bureau gardent un seul code
  ([trois-plateformes-un-seul-code.md](trois-plateformes-un-seul-code.md)).
- **Quatre Workers fixes, un compartiment par Worker** (ancien
  fonctionnement, remplacé) : la répartition par compartiment donnait à la
  tranche la plus lourde 35 à 63 % des paires, et le temps d'une recherche
  était celui de cette tranche.
- **Un Worker par cœur physique** (ancien fonctionnement, remplacé) : il
  n'allait pas plus vite que deux de moins, et prenait davantage aux autres
  tâches de la machine.
- **Moins de Workers sur les petites recherches** (possibilité écartée) :
  sous la seconde, deux Workers battent huit, mais l'écart ne dépasse pas
  un quart de seconde.
- **Une part du plafond de candidats par Worker** (ancien fonctionnement,
  remplacé) : un Worker arrêté sur sa part laisse son travail non visité,
  et les candidats gardés dépendent du découpage.

## Conséquences

- **Deux écritures de la validation coexistent**, la typée et la copie
  conforme du bloc de référence, prise hors du contrat de la première ; les
  tests les comparent paire par paire, et l'appariement entier au parcours
  de référence.
- **Une recherche hors contrat numérique, ou avec une trace de diagnostic,
  reste séquentielle**, par le parcours de référence.
- **Seule une recherche coupée par le temps ou arrêtée diffère du parcours
  sur un seul fil** : le parallèle a pu aller plus loin dans le même délai,
  et garde tout ce qu'il a trouvé.
- **Un Worker travaille par tranches de 100 ms** et lit ses messages entre
  deux : l'arrêt manuel lui parvient en cours de morceau.
- Le noyau, son contrat et ses sauts :
  [noyau-appariement.md](../../03-developpeur/optimizer/moteur/noyau-appariement.md) ;
  la répartition, la fusion et l'arrêt :
  [parallelisation.md](../../03-developpeur/optimizer/moteur/parallelisation.md) ;
  leur place dans une recherche :
  [pipeline.md](../../03-developpeur/optimizer/moteur/pipeline.md).
