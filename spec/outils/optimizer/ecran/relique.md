# Relique

**Statut :** ÉTAT ACTUEL — décrit le bloc « Relique » de la carte des artéfacts
**Lire si :** on modifie la relique à l'écran de l'Optimizer

6 ter. **Relique** — **bloc
   séparé** de la carte « Artéfacts et reliques », PAS une carte propre :
   ferme la carte, sous « Meilleurs artéfacts offensifs pour ce build »,
   séparé par un **trait horizontal** de 1 px (`border-border-soft`, un
   seul contour) — même JSX pour les deux formats, ordinateur et
   téléphone. Ni carte propre (elle ferait double emploi avec la
   carte Artéfacts juste au-dessus et décalerait toute la grille de la
   colonne), ni bloc à droite de la rangée Attribut / Type, trait vertical
   (il désalignerait les listes relique de celles d'artéfacts).

   ⚠️ **Pas d'interrupteur propre** : coupé avec « Activer
   l'optimisation d'artéfacts et reliques » (même carte, juste au-dessus),
   le bloc se masque avec le reste de la carte (mêmes deux listes
   d'artéfacts).

   Trois réglages, **grammaire des artéfacts à la valeur près qui n'existe
   que pour la relique** (le type) :
   - **Principale** : **« Garder la relique équipée »** (pièce entière,
     rien n'est cherché), **Principale ATQ %**, **Principale DEF %**,
     **Principale PV %**, **« Libre »** (cherche parmi toutes les reliques
     éligibles). **Défaut : « Garder la relique équipée » si le monstre
     choisi porte une relique, « Libre » sinon** — calculé au choix du
     monstre, comme pour l'artéfact, par **tous** les chemins qui en
     désignent un : bestiaire, recette importée, membre de la liste de
     travail, « un autre exemplaire », puce de source, zone D et réimport
     du compte. Entre deux exemplaires de la **même espèce**, le choix de
     l'utilisateur est conservé, sauf « Garder la relique équipée » sur un
     exemplaire qui n'en porte pas, qui redevient « Libre »
     (`relicMainChoiceApresChangementExemplaire`) : ce mode ne refuse pas la
     recherche, il la ferait tourner sans relique, sans le dire. Une puce
     qui ouvre la zone D (plusieurs exemplaires) ne change rien tant
     qu'aucun n'est choisi.
   - **Propriété unique** : **« Libre »** (défaut) ou l'un des 16 types
     (`RELIC_UNIQUE`, `src/lib/effects.ts`), avec le libellé **« `<effet>` en
     fonction `<stat>` »** (`relicUniqueEffectLabel`, DÉRIVÉ de
     `RELIC_UNIQUE` — effet et stat sont chacun des mots du jeu, jamais une
     table séparée) — **désactivée et sans effet** avec « Garder la relique
     équipée » (la pièce est fixée), le bloc le dit. La carte candidat, elle,
     donne la phrase complète de la fiche d'objet (`formatRelicUnique`,
     `RelicSlot.tsx`), trop longue pour un sélecteur (voir
     resultats.md § Validation d'un build et relique).
   - **Niveau minimum** (`NumberField`, +0 à +15, +6 par défaut,
     `relicMinUpgrade`) : filtre d'ENTRÉE sur le pool cherché, jamais un
     critère de classement.
   - `libre` et le type n'ont d'effet qu'avec la recherche (bornes,
     résolution exacte) ; les sélecteurs ne se conditionnent
     pas aux reliques possédées, comme pour l'artéfact.
   - **Pool vide → refus nommé**, à la place du lancement : un texte par
     raison (seuil trop haut, aucune relique de cette principale/ce type,
     aucune relique dans l'inventaire — réimporter le compte ou couper
     l'interrupteur).
   - **Recette** : « Garder la relique équipée » ne se partage pas —
     importée d'un autre joueur, elle bascule sur « Libre » et le message
     d'import le dit (mêmes trois règles que l'artéfact) ; le script CLI ne
     bascule jamais.

