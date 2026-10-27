# Plafond de builds : tous les builds trouvés, jusqu'au million

## Décision

Une recherche de runes garde **tous les builds valides qu'elle trouve**,
jusqu'à **un million** (`MAX_COLLECTED`), en colonnes compactes dans le
Worker de classement. Sous ce plafond, aucun build n'est écarté pour la
place : jamais un top K, ni par critère ni global. Le plafond atteint, la
recherche s'arrête, comme avant, et l'écran le dit.

La mémoire n'est jamais devinée. Si l'appareil refuse une allocation au
classement, celui-ci s'arrête proprement, une seule fois par recherche :
il garde ce qu'il a déjà classé, cesse de vérifier en fond, arrête la
recherche si elle collecte encore, et l'écran annonce « Arrêt : mémoire »
avec le nombre de builds gardés sur le nombre trouvé. Rien n'est retenté.

## Raisons

- **L'écran trie, filtre et vérifie après coup** : n'importe quelle
  colonne, des bornes posées après la recherche, « Vérifier toutes les
  combinaisons trouvées ». Ces gestes ne voient que les builds gardés. Un
  build hors d'un top K peut devenir le meilleur sous une borne resserrée
  après coup (un build à 3 000 d'ATQ, hors des 1 000 meilleurs en ATQ comme
  en VIT, passe en tête quand le minimum de VIT monte), ou une fois sa
  relique choisie quand la relique se cherche dans l'inventaire (classé
  sans relique au rang 1 001, il passe devant une fois résolu). Gardé, il
  se retrouve ; écarté, rien ne le rattrape.
- **Les recherches réelles dépassent les 100 000 builds** : une recette réelle de Kinki au
  préréglage Extrême, minimum de VIT relâché de 224 à 212, en trouve 838 480,
  sur une recherche complète. Le plafond de 100 000 coupait ces recherches
  dans l'ordre de collecte, pas dans celui d'un critère : les builds gardés
  n'étaient pas les meilleurs.
- **Le million tient en mémoire** : environ 295 octets par build gardé,
  comptés sur le vrai classeur, soit environ 281 Mio au million ; environ
  443 Mio avec « Vérifier toutes les combinaisons trouvées » (le résultat
  vérifié de chaque build) ; plus 114 Mio, le temps de construire le
  classement à la fin de la recherche. Chaque structure croît linéairement
  avec le nombre de builds.
- **La mémoire disponible ne se lit pas de façon fiable** dans un
  navigateur : une fenêtre étroite n'est pas un téléphone, et la largeur
  d'un écran ne dit rien de sa mémoire. Seul le refus d'une allocation est
  un signal sûr.

## Options écartées

- **Les 100 000 premiers trouvés** (ancien fonctionnement, remplacé) :
  coupait des recherches réelles bien avant leur fin, en gardant l'ordre de
  collecte plutôt que les meilleurs builds.
- **Un top K par critère, seul** (possibilité écartée) : il perd les builds
  qu'un tri, une borne ou une relique résolue après coup feraient monter
  (raisons ci-dessus), alors que tout garder tient en mémoire.
- **Un plafond levé sans borne** (possibilité écartée) : la mémoire croît
  avec chaque build gardé, sans limite.
- **Un plafond choisi d'après l'appareil** (largeur d'écran, modèle)
  (possibilité écartée) : aucun de ces signaux ne dit la mémoire
  disponible.

## Conséquences

- **Au-delà du million, la recherche s'arrête au plafond** : garder les
  meilleurs au-delà (top K) reste une question ouverte, qui ne change rien
  sous le million.
- **Un onglet que le système ferme pour manque de mémoire n'a pas de
  reprise** : seul un refus d'allocation se rattrape.
- **Ce qui croît avec le nombre de builds doit rester linéaire** :
  l'index, la confirmation en fond, le cache des vérifiés, d'une recherche
  à l'autre comme dans une seule ; un test compte les octets au million.
- Le plafond et l'arrêt sur la mémoire dans la recherche :
  [pipeline.md § Arrêt sur la mémoire du classeur](../../03-developpeur/optimizer/moteur/pipeline.md#arrêt-sur-la-mémoire-du-classeur) ;
  ce que l'écran en dit : [limites-connues.md](../../02-app/optimizer/limites-connues.md).
