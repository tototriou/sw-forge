# Équipement actuel

**Statut :** ÉTAT ACTUEL — décrit la carte « Équipement actuel »
**Lire si :** on modifie l'affichage de l'équipement porté par le monstre choisi

2. **Équipement actuel** — **le composant `MonsterGear`, réutilisé tel quel**
   (pas réimplémenté), le même qu'en RTA/Siège quand on clique un monstre :
   stats base/bonus, artéfacts, roue de runes et relique **tels
   qu'ACTUELLEMENT équipés** sur l'exemplaire choisi dans la recherche du
   monstre (voir recherche-du-monstre.md § Recherche du monstre à optimiser) — **c'est
   CET exemplaire que la recherche optimise**, pas systématiquement la box.
   Tant qu'aucun exemplaire n'a encore été choisi depuis le dernier montage
   de la page : repli sur le **PREMIER exemplaire Box** de l'espèce
   persistée (`boxCandidates[0]`, initialisation paresseuse de
   `sourceSelector` dans [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx)
   — la même règle que la recherche bestiaire,
   voir recherche-du-monstre.md § Recherche du monstre à optimiser), stats de base seules si la box n'en compte aucun ; la
   source active au montage est toujours Box. ⚠️ **Limite connue** : ce choix
   d'exemplaire ne fait PAS partie de la recette exportée (`OptimizerRecipe`
   ne porte que l'espèce, `monsterCom2usId`) — réimporter une recette lancée
   sur un exemplaire RTA/siège retombe sur la box par défaut. Chacun de ses éléments reste **cliquable**
   pour ouvrir son détail complet (`RuneDetailBox`/`ArtifactDetailBox`/
   `RelicDetailBox`, tous dans [MonsterGear.tsx](src/components/MonsterGear.tsx)),
   affiché en **popover flottant** ancré sur l'élément cliqué — même
   dispositif que les cartes de résultat (`BuildCandidateCard`,
   voir resultats.md § Résultats), pas un bloc qui pousserait le reste de la fiche vers le bas. Ce que
   l'outil part optimiser, visible d'un coup d'œil avant de lancer quoi que
   ce soit — y compris les artéfacts et la relique, qui ne sont eux jamais
   modifiés par la recherche
   (voir ../moteur/elagages.md § Algorithme (résumé fonctionnel)). ⚠️ **Artéfacts : toujours
   2 emplacements affichés** (Attribut puis Type), même si le monstre choisi
   n'en porte qu'un seul ou aucun — un emplacement vide est montré grisé
   plutôt que simplement absent. ⚠️ **Relique : emplacement TOUJOURS affiché
   de la même façon**, même absente — grisé plutôt que simplement absent,
   comportement partagé avec RTA et Siège. ⚠️ **L'encadré de stats bascule base+bonus
   ↔ total au clic**, comportement propre à `MonsterGear`, partagé avec RTA
   et Siège (voir [rta/sections-runes.md](../../../rta/sections-runes.md)).
   ⚠️ **Affiché dans la carte « Monstre & équipement », SOUS les puces
   d'exemplaire (colonne interne de droite au bureau), TOUJOURS** — vide
   (stats à zéro, emplacements grisés, roue sans rune) tant qu'aucun
   monstre n'est choisi,
   plutôt que de n'apparaître qu'au clic. C'est un `GearSet` NUL construit
   en local (`EMPTY_GEAR`, [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx)),
   pas une variante de `MonsterGear` : le composant partagé n'a besoin
   d'aucune adaptation, `computeStats` sur une base à zéro renvoie déjà des
   lignes à zéro, et `ArtifactSlots`/`RuneWheel` gèrent nativement un
   tableau vide.
