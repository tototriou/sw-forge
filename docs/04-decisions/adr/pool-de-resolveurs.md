# Vérification des builds sur un pool de résolveurs

## Décision

La vérification des builds trouvés par une recherche de runes — la
résolution de leur équipement (vraie paire d'artéfacts, relique), qui
confirme ou écarte chaque build — tourne sur un **pool de résolveurs** :

- **autant de Workers que l'appariement** : les cœurs physiques de la
  machine moins deux, au moins deux, au plus huit
  ([appariement-par-seuils-exacts.md](appariement-par-seuils-exacts.md)).
  Ils sont créés avec le Worker de classement et gardés d'une recherche à
  l'autre ;
- **une seule voie reçoit des demandes tant que la recherche apparie** ;
  toutes résolvent dès que l'appariement est fini ;
- **le classeur décide seul de qui est vérifié et dans quel ordre** (la
  page affichée d'abord, puis le fond), donne au plus deux demandes en
  cours à chaque résolveur, et retrouve chaque réponse par sa demande,
  quel que soit son ordre d'arrivée ;
- **un résolveur en panne est retiré** : ses builds en cours repartent sur
  les autres. La panne du dernier ramène la résolution dans le classeur.
  **Aucune de ces pannes ne s'affiche à l'écran** ; la console les
  signale.

## Raisons

- **La vérification dominait le temps d'une recherche en Dégâts réels.**
  Sur une recherche réelle à relique libre et artéfacts optimisés (environ
  60 000 builds), le moteur trouvait les builds en un peu plus d'une
  seconde, puis la vérification des 300 premiers builds prenait environ
  40 s sur un seul fil (environ 130 ms par build vérifié, les deux tiers
  dans le calcul des dégâts réels), pendant que les Workers d'appariement,
  arrêtés, laissaient les
  cœurs libres. Sur le pool, la même recherche passe d'environ 40 s à
  environ 14 s (−65 %) ; une recherche au préréglage Moyen gagne environ
  5 %, et la plus lourde reste dans le bruit de mesure.
- **Le pool et l'appariement ne se disputent presque pas les cœurs** :
  l'appariement finit en une à quelques secondes, la vérification dure
  ensuite des dizaines de secondes. Les deux ne se chevauchent que sur la
  fin de l'appariement, d'où la même règle pour leur nombre.
- **Une seule voie pendant l'appariement** : la vérification commence dès
  les premiers builds reçus ; avec tout le pool actif à ce moment, la
  recherche la plus lourde prenait environ 4 % de plus. Une voie la sert
  sans prendre de cœurs aux Workers d'appariement.
- **La panne d'un résolveur est une information technique** : elle ne
  perd aucun build, que les autres reprennent ; la console suffit.

## Options écartées

- **Un seul Worker de résolution** (ancien fonctionnement, remplacé) :
  environ 40 s de vérification sur la recherche citée, sur un seul cœur.
- **Tout le pool dès le lancement de la recherche** (possibilité écartée) :
  la recherche la plus lourde prenait environ 4 % de plus.
- **Un avertissement à l'écran quand un résolveur tombe** (possibilité
  écartée) : la panne d'un résolveur est une information technique, la
  console suffit.

## Conséquences

- **La mémoire de la vérification est multipliée par le nombre de
  résolveurs** : environ 21 Mo par Worker, moins de 170 Mo au plus fort du
  pool.
- **La priorité ne change pas avec le nombre de résolveurs** : elle reste
  décidée dans le classeur ; les résolveurs prennent les demandes dans
  l'ordre reçu.
- **Le repli dans le classeur résout une demande par tâche**, sans revenir
  sur la page ; une erreur de calcul levée aussi dans ce repli termine la
  recherche en erreur.
- Le pool dans la recherche :
  [pipeline.md § Worker de résolution](../../03-developpeur/optimizer/moteur/pipeline.md#worker-de-résolution) ;
  le protocole, les voies et les pannes :
  [parallelisation.md § Worker de résolution](../../03-developpeur/optimizer/moteur/parallelisation.md#worker-de-résolution).
