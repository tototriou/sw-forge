# Deux formats de premier rang

## Contexte

SW Blacksmith est **une seule application responsive** — une base de code, un
déploiement — et elle sert **deux plateformes** : le téléphone et l'ordinateur.
Chaque format a ses gestes, ses contraintes et ses habitudes.

## Décision

**Aucun des deux formats n'est le cas dégradé de l'autre**, et **une correction
destinée à un format ne touche pas l'autre**. La règle prime sur tout arbitrage
d'interface.

Ne restent communs que les corrections de bug, la donnée et la logique métier,
et le vocabulaire du jeu ; tout le reste — disposition, densité, taille, ordre,
choix d'un contrôle — se décide par format.

## Options écartées

- **Dessiner pour le bureau, puis rétrécir.** ⚠️ La différence avec un site
  responsive ordinaire tient là : on ne dessine pas un écran pour le bureau
  qu'on rétrécit ensuite. Le même écran peut se présenter différemment d'un
  format à l'autre quand leurs contraintes divergent.
- **Étendre à l'autre format une correction faite pour l'un**, parce qu'il « en
  profiterait aussi » : elle déplace les repères d'un utilisateur qui ne
  demandait rien, sur un écran qui ne souffrait de rien.
- **Deux applications séparées.** La base reste commune et responsive, même si
  les deux plateformes sont un jour empaquetées séparément (application mobile
  installable, application de bureau).

## Conséquences

- L'objectif est de **servir les deux plateformes également bien**. D'où
  l'exigence : chaque format doit pouvoir évoluer sans que l'autre bouge, et
  chaque écran doit être **pensé deux fois** plutôt qu'une fois puis étiré.
  C'est un travail supplémentaire assumé, pas une redondance à éliminer.
- Deux frontières distinctes, une pour la navigation et une pour la densité,
  et trois façons d'écrire une différence de format :
  [deux-formats.md](../../03-developpeur/interface/deux-formats.md).
