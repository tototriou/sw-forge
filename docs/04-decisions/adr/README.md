# Décisions durables (ADR)

Une décision par fichier : le contexte, le choix, ses conséquences. Une décision remplacée le dit
et pointe vers celle qui la remplace.

| Document | Contenu |
| --- | --- |
| [deux-formats-de-premier-rang.md](deux-formats-de-premier-rang.md) | Téléphone et ordinateur sont deux formats de premier rang : aucun n'est le cas dégradé de l'autre, une correction destinée à l'un ne touche pas l'autre. |
| [librairie-ui-par-axes.md](librairie-ui-par-axes.md) | Tout contrôle est un composant de `src/ui/`, décrit par des axes qui se combinent plutôt que par des variantes nommées. |
| [barre-laterale.md](barre-laterale.md) | La navigation de l'ordinateur est une barre latérale, qui a remplacé la rangée d'onglets et ses menus déroulants. |
| [choix-de-recherche-degats-reels.md](choix-de-recherche-degats-reels.md) | Les stats et majorations des dégâts réels qui n'entrent pas dans la recherche des builds, parce qu'elles ne changent pas leur classement. |

## Écrire un ADR

- **Ce qui mérite un ADR** : un choix entre plusieurs options, encore en vigueur, qu'un chantier
  pourrait vouloir rouvrir. Une règle sans option écartée reste dans sa fiche.
- **Quatre parties** : « Contexte » (le problème constaté), « Décision », « Options écartées »
  (chacune avec ce qui l'a fait écarter), « Conséquences » (ce que le choix impose, et les fiches
  qui le mettent en œuvre).
- **Le pourquoi ne s'écrit qu'ici** : la fiche décrit ce qui se fait et renvoie à l'ADR pour la
  raison (règle 9 de la [charte](../../README.md)).
- **Aucune raison inventée** : une décision dont la raison n'est écrite nulle part se demande à
  celui qui l'a prise avant de s'écrire.
