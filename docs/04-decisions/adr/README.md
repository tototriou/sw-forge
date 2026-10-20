# Décisions durables (ADR)

Une décision par fichier : le choix, ses raisons, ce qu'il écarte, ses conséquences. Un ADR dit
toujours ce qui est en vigueur : une décision qui change se réécrit.

| Document | Contenu |
| --- | --- |
| [trois-plateformes-un-seul-code.md](trois-plateformes-un-seul-code.md) | Site au téléphone, site à l'ordinateur et application de bureau sont maintenus tous les trois par un seul code ; Electron pour le bureau. |
| [deux-formats-de-premier-rang.md](deux-formats-de-premier-rang.md) | Téléphone et ordinateur sont deux formats de premier rang : aucun n'est le cas dégradé de l'autre, une correction destinée à l'un ne touche pas l'autre. |
| [librairie-ui-par-axes.md](librairie-ui-par-axes.md) | Tout contrôle est un composant de `src/ui/`, décrit par des axes qui se combinent plutôt que par des variantes nommées. |
| [barre-laterale.md](barre-laterale.md) | La navigation de l'ordinateur est une barre latérale, qui a remplacé la rangée d'onglets et ses menus déroulants. |
| [documentation-sans-outillage.md](documentation-sans-outillage.md) | La documentation se parcourt par ses README et tient sans outillage maison ; le dépôt porte ce qui est livré et ce qui permet de le comprendre, pas l'organisation du travail. |
| [choix-de-recherche-degats-reels.md](choix-de-recherche-degats-reels.md) | Les stats et majorations des dégâts réels qui n'entrent pas dans la recherche des builds, parce qu'elles ne changent pas leur classement. |
| [retention-a-parts-egales.md](retention-a-parts-egales.md) | Pendant la construction des moitiés de build, chaque tranche de rétention par stat a le même nombre de places : le moteur ne priorise pas les stats « difficiles », ce qui faisait trouver moins de builds valides. |
| [appariement-par-seuils-exacts.md](appariement-par-seuils-exacts.md) | L'appariement des deux moitiés de build saute par seuils exacts les paires vouées au rejet et valide les autres sur tableaux typés ; au-delà de 100 M de paires, en parallèle sur un nombre de Workers qui suit la machine, en rendant l'ordre séquentiel. |

## Écrire un ADR

- **Ce qui mérite un ADR** : une décision structurante, encore en vigueur, qu'un chantier
  pourrait vouloir rouvrir faute d'en connaître le compromis. Elle est à la fois difficile à
  défaire, née d'un vrai choix entre plusieurs options, et surprenante sans ce contexte (un
  nouveau venu demanderait « pourquoi pas X ? »). L'ADR donne ce contexte : on ne la remet en
  question qu'en sachant ce qu'elle a écarté et pourquoi. Une petite décision, ou une règle sans
  option écartée, reste dans sa fiche.
- **Quatre parties** : « Décision », « Raisons », « Options écartées » (chacune avec ce qui la
  fait écarter), « Conséquences » (ce que le choix impose, et les fiches qui le mettent en
  œuvre).
- **Au présent, sans historique** : un ADR ne raconte ni ce qui se faisait avant, ni comment on
  est arrivé au choix (le récit d'un contributeur), et ne porte pas de date. Une raison née d'un
  défaut passé s'écrit en règle (« une barre verticale ne déborde pas »), pas en récit. Deux
  mentions du passé restent permises, sans récit : une option écartée qui était le fonctionnement remplacé porte « ancien
  fonctionnement, remplacé » (les autres, « possibilité écartée ») ; une raison peut donner
  l'ordre de grandeur d'avant et d'après qui justifie le choix (un débit, une proportion), pas
  le protocole de mesure.
- **Le pourquoi ne s'écrit qu'ici** : la fiche décrit ce qui se fait et renvoie à l'ADR pour la
  raison (règle 9 de la [charte](../../README.md)).
- **Aucune raison inventée** : une décision dont la raison n'est écrite nulle part se demande à
  celui qui l'a prise avant de s'écrire.
