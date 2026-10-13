# Une librairie UI par axes

## Contexte

Avant la librairie, chaque écran redessinait ses boutons. Un même bouton
d'action existait en une quarantaine d'exemplaires, chacun avec ses classes
recopiées puis divaguées : rembourrages différents à deux pixels près, deux
rayons de coin, trois façons de dire « désactivé ».

La conséquence n'était pas esthétique mais **économique** : demander « réduis
les boutons sur téléphone » voulait dire refaire le même travail dans dix-sept
fichiers, et en oublier trois.

## Décision

- **Tout contrôle est un composant de `src/ui/`**, et un composant dessiné là
  ne se redessine nulle part ailleurs.
- **Ses styles se décrivent par des axes** qui se choisissent séparément et se
  combinent (`ton`, `fond`, `trait`, `forme`, `taille`), pas par des variantes
  nommées.
- **La librairie ne grossit que si un axe manque**, jamais parce qu'un écran de
  plus a un besoin de plus.

## Options écartées

- **Un fichier de constantes de classes** (`buttonStyles.ts`). La tentative a
  eu lieu, et elle a échoué. ⚠️ **Une constante de classes se contourne, un
  composant non.** Sept fichiers importaient `BOUTON_PRIMAIRE`, quarante
  dessinaient des boutons à la main. Rien ne s'opposait à recopier la chaîne
  en y ajoutant « juste un `px-2` pour ce cas » — et la divergence repartait.
  Un composant impose sa structure : la hauteur tactile, la pression au clic,
  l'état désactivé ne sont plus négociables au point d'appel.
- **Un catalogue de variantes nommées par intention** (`principal`, `discret`,
  `destructeur`…), le premier jet de la librairie. Il ne tient pas : dès qu'un
  écran veut un bouton d'ajout **en pointillés**, il faut une cinquième entrée.
  Puis une sixième pour la même chose en rouge. Puis une septième pour la
  version sans fond. Le catalogue grossit d'une ligne à chaque écran neuf, et
  les combinaisons manquantes se règlent en `className` — c'est-à-dire par le
  contournement qu'on cherchait à empêcher.

## Conséquences

- Un besoin nouveau se traduit en axe, pas en composant de plus : les axes et
  leurs pièges sont dans
  [principes-et-axes.md](../../03-developpeur/interface/librairie-ui/principes-et-axes.md).
- Un composant ne monte dans la librairie qu'à son deuxième usage, et les
  exceptions se justifient par écrit :
  [quand-ajouter.md](../../03-developpeur/interface/librairie-ui/quand-ajouter.md).
