# Relique en « OU » à la validation des paires

## Décision

Quand la relique se choisit parmi celles de l'inventaire (mode relique
« recherche » de l'Optimizer), la validation d'une paire de demi-builds
garde le build **si et seulement si une relique éligible et un apport
d'artéfacts atteignable lui font tenir toutes ses conditions ensemble**,
minimums et maximums. Elle essaie pour cela les reliques **une à une**,
parmi des représentatives préparées une fois par recherche : pour chaque
principale (PV %, ATQ %, DEF %), la plus forte quand la stat n'a qu'un
minimum ou aucune condition, la plus faible quand elle n'a qu'un maximum,
toutes les valeurs distinctes quand elle a les deux ; une seule relique
d'une autre principale, qui ne change aucune condition. La validation de
référence et la validation typée font le même test.

Les bornes par stat, qui accordent à la fois la meilleure PV %, la
meilleure ATQ % et la meilleure DEF % des éligibles, restent pour ce qui
précède la validation : préparation, test rapide, sauts de l'appariement.
Le **quasi-succès** (le diagnostic d'une recherche sans résultat) juge
avec les mêmes tentatives que la validation. Hors mode « recherche », rien
ne change.

## Raisons

- **Une relique n'a qu'une principale.** Les bornes par stat les
  accordent toutes à la fois : la validation gardait des builds qu'aucune
  relique ne rend conformes, que la vérification rejetait ensuite. Sur une
  recherche réelle, essayer chaque relique écarte tous
  les builds que la vérification rejetait (environ 1 900) et aucun des
  conformes (environ 1 000) : la borne par stat explique à elle seule ces
  rejets.
- **Les builds rejetés prenaient les places du plafond de candidats.** Sur
  cette recherche, la collecte s'arrêtait au plafond de 100 000 candidats,
  dont deux tiers rejetés à la vérification ; avec la relique en « OU », la
  recherche complète tient sous le plafond (environ 77 000 candidats, tous
  équipables). Sur la même recherche, au préréglage Extrême, à espace
  parcouru égal (environ 116 milliards de paires), la validation garde
  environ 176 000 builds, contre environ 758 000 avec la borne par stat.
- **Le test est exact, pas une heuristique de plus** : une relique n'agit
  sur les conditions que par la stat de sa principale, et de façon
  croissante ; ses représentatives suffisent à décider si l'une des
  éligibles convient.
- **Un diagnostic doit dire ce qui manque à un vrai build** : jugé sur la
  borne par stat, le quasi-succès pouvait déclarer réussi un build
  qu'aucune relique ne rend conforme.

## Options écartées

- **La borne par stat à la validation** (ancien fonctionnement, remplacé) :
  elle garde des builds qu'aucune relique ne rend conformes (voir les
  raisons).
- **Garder la borne en attendant un plafond de candidats plus grand**
  (possibilité écartée) : la borne explique à elle seule les rejets
  comptés, et ces builds occupent des places du plafond sans jamais être
  équipables.
- **Seulement la plus forte et la plus faible d'une principale quand sa
  stat a un minimum et un maximum** (possibilité écartée) : l'ensemble
  admis est un intervalle, que les deux extrêmes peuvent manquer (des
  reliques à 5, 10 et 15 %, dont seule celle à 10 % tient les deux
  conditions).
- **Le quasi-succès jugé sur la borne par stat** (ancien fonctionnement,
  remplacé) : il déclarait réussi un build qu'aucune relique ne rend
  conforme.

## Conséquences

- **Sur une recherche non tronquée, les candidats sont un sous-ensemble
  exact** de ceux de la borne par stat, dans le même ordre, avec les mêmes
  paires traitées : seuls disparaissent ceux qu'aucune relique ne rend
  conformes. Tronquée au plafond, la recherche va plus loin : les places
  libérées reçoivent d'autres builds.
- **Une paire qui passe le test rapide coûte plusieurs tentatives** : une
  par relique représentative et par apport d'artéfacts atteignable.
- **L'exactitude suppose des apports d'artéfacts réduits dans le sens de
  chaque condition**, comme les reliques : le plus fort sous un minimum, le
  plus faible sous un maximum, toutes les valeurs sous les deux.
- **La préparation et les compartiments jugent encore sur les bornes par
  stat** : des demi-builds qu'aucune relique ne sauve peuvent y occuper des
  places de rétention.
- La validation et les représentatives :
  [reliques.md § Contexte transporté, bornes relâchées, filtre exact](../../03-developpeur/optimizer/moteur/reliques.md#contexte-transporté-bornes-relâchées-filtre-exact) ;
  leur place dans l'appariement :
  [pipeline.md § Appariement séquentiel](../../03-developpeur/optimizer/moteur/pipeline.md#appariement-séquentiel) ;
  les apports d'artéfacts du test :
  [artefacts.md § Test conjoint exact à la validation finale](../../03-developpeur/optimizer/moteur/artefacts.md#test-conjoint-exact-à-la-validation-finale) ;
  le quasi-succès :
  [diagnostics.md § Ce que le quasi-succès retient](../../03-developpeur/optimizer/moteur/diagnostics.md#ce-que-le-quasi-succès-retient).
