# Une barre latérale plutôt qu'une rangée d'onglets

## Contexte

L'ancienne navigation était une **rangée horizontale** avec deux menus
déroulants (« Mon compte », « Ressources ») et un bouton hamburger de repli.

- ⚠️ **Le problème n'était pas esthétique : la rangée ne tenait plus.** Neuf
  destinations, dont **six enfouies** derrière les deux menus — qu'il fallait
  ouvrir pour savoir ce qu'ils contenaient.
- ⚠️ **Un intitulé de groupe n'est PAS un lien.** « Ressources » annonce ce qui
  suit, il ne mène nulle part. Le menu déroulant confondait les deux.

## Décision

À l'ordinateur, la navigation est une **barre latérale** repliable, dont le
premier niveau est regroupé sous des intitulés. Au téléphone, c'est une barre
d'onglets en bas de l'écran. La refonte change la **forme** de la navigation,
pas la hiérarchie : l'ordre d'importance des pages reste le même.

## Options écartées

- **Garder la rangée horizontale et la replier en hamburger quand elle
  déborde.** Trois `ref`, un `ResizeObserver` et un `useLayoutEffect`
  décidaient quand replier la rangée : une mécanique entière pour un
  débordement qu'une barre verticale n'a pas.

## Conséquences

- La **mécanique de mesure** de l'ancienne barre a disparu avec elle : une
  barre verticale ne déborde pas.
- Le premier niveau se lit d'emblée, sous des intitulés de groupe qui ne sont
  pas des liens.
- Le regroupement du premier niveau et les adresses :
  [barre-laterale-et-adresses.md](../../02-app/transverse/feat-navigation/barre-laterale-et-adresses.md) ;
  la frontière entre les deux navigations :
  [deux-formats.md](../../03-developpeur/interface/deux-formats.md).
