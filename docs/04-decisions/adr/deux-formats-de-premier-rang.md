# Deux formats de premier rang

## Décision

SW Blacksmith est **une seule application responsive** — une base de code, un
déploiement — qui sert **deux formats** : le téléphone et l'ordinateur.
**Aucun des deux n'est le cas dégradé de l'autre**, et **une correction
destinée à un format ne touche pas l'autre**. La règle prime sur tout arbitrage
d'interface.

Ne sont communs que les corrections de bug, la donnée et la logique métier, et
le vocabulaire du jeu ; tout le reste — disposition, densité, taille, ordre,
choix d'un contrôle — se décide par format.

## Raisons

- Chaque format a ses gestes, ses contraintes et ses habitudes : le même écran
  peut s'y présenter différemment quand ces contraintes divergent.
- L'objectif est de **servir les deux également bien** : chaque format doit
  pouvoir évoluer sans que l'autre bouge.

## Options écartées

- **Dessiner pour le bureau, puis rétrécir**, comme un site responsive
  ordinaire : l'écran rétréci garde la disposition et les gestes du bureau.
- **Étendre à l'autre format une correction faite pour l'un**, parce qu'il « en
  profiterait aussi » : elle déplace les repères d'un utilisateur qui ne
  demandait rien, sur un écran qui ne souffrait de rien.
- **Deux applications séparées.** La base est commune et responsive, même si
  les deux plateformes sont un jour empaquetées séparément.

## Conséquences

- Chaque écran est **pensé deux fois** plutôt qu'une fois puis étiré. C'est un
  travail supplémentaire assumé, pas une redondance à éliminer.
- Deux frontières distinctes, une pour la navigation et une pour la densité,
  et trois façons d'écrire une différence de format :
  [deux-formats.md](../../03-developpeur/interface/deux-formats.md).
