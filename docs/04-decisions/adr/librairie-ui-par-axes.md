# Une librairie UI par axes

## Décision

- **Tout contrôle est un composant de `src/ui/`**, et un composant dessiné là
  ne se redessine nulle part ailleurs.
- **Ses styles se décrivent par des axes** qui se choisissent séparément et se
  combinent (`ton`, `fond`, `trait`, `forme`, `taille`), pas par des variantes
  nommées.
- **La librairie ne grossit que si un axe manque**, jamais parce qu'un écran de
  plus a un besoin de plus.

## Raisons

- **Un contrôle dessiné une fois se change à un seul endroit.** « Réduis les
  boutons sur téléphone » est une modification, pas la même retouche dans
  chaque écran. La raison est économique, pas esthétique.
- **Un composant impose sa structure** : la hauteur tactile, la pression au
  clic, l'état désactivé ne se négocient pas au point d'appel.
- **Des axes qui se combinent couvrent les besoins sans entrée de plus** :
  trois tons, trois fonds et trois traits couvrent ce que douze variantes
  nommées ne couvriraient pas.

## Options écartées

- **Des constantes de classes partagées.** ⚠️ Une constante de classes se
  contourne, un composant non : rien ne s'oppose à recopier la chaîne en y
  ajoutant « juste un `px-2` pour ce cas », et la divergence repart.
- **Un catalogue de variantes nommées par intention** (`principal`, `discret`,
  `destructeur`…). Il grossit d'une ligne à chaque écran neuf — un bouton
  d'ajout en pointillés, le même en rouge, le même sans fond — et les
  combinaisons manquantes se règlent en `className`, c'est-à-dire par le
  contournement qu'on cherche à empêcher.

## Conséquences

- Un besoin nouveau se traduit en axe, pas en composant de plus : les axes et
  leurs pièges sont dans
  [principes-et-axes.md](../../03-developpeur/interface/librairie-ui/principes-et-axes.md).
- Un composant ne monte dans la librairie qu'à son deuxième usage, et les
  exceptions se justifient par écrit :
  [quand-ajouter.md](../../03-developpeur/interface/librairie-ui/quand-ajouter.md).
