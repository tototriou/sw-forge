# Équipement actuel

**Statut :** ÉTAT ACTUEL — décrit la carte « Équipement actuel »
**Lire si :** on modifie l'affichage de l'équipement porté par le monstre choisi

2. **Équipement actuel** — **le composant `MonsterGear`, réutilisé tel quel**
   (pas réimplémenté), le même qu'en RTA/Siège quand on clique un monstre :
   stats base/bonus, artéfacts, roue de runes et relique **tels
   qu'ACTUELLEMENT équipés** sur l'exemplaire choisi dans la recherche du
   monstre (voir recherche-du-monstre.md § Recherche du monstre à optimiser) — **c'est
   CET exemplaire que la recherche optimise**, pas systématiquement la box.
   L'exemplaire choisi (`gearSource`, la puce de source ; `sourceSelector`,
   l'entrée précise) vit dans `useOptimizerState` : il **reste choisi quand
   on change de page**, et entre dans la sauvegarde de session
   ([transverse/ (sauvegarde de session)](../transverse/)). Au
   montage, l'écran le revérifie dès le premier rendu
   (`exemplaireAuMontage`, [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx),
   enregistré par un `useLayoutEffect`) : s'il ne se résout plus
   (`resolveExclusionEntry` — compte réimporté, équipe de siège supprimée)
   ou n'est pas de l'espèce choisie, il est remplacé par le **PREMIER
   exemplaire Box** de l'espèce (`boxCandidates[0]`), source Box — la même
   règle que la recherche bestiaire
   (voir recherche-du-monstre.md § Recherche du monstre à optimiser)
   —, ou par `unownedSelectorIfNoneOwned` si la box n'en compte aucun.
   ⚠️ **Limite connue** : ce choix
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
   comportement partagé avec RTA et Siège. ⚠️ **Artéfacts, roue et relique
   forment UN SEUL groupe insécable** dans `MonsterGear` (`flex-none`,
   aucun `flex-wrap` à l'intérieur) : trois items indépendants du
   conteneur `flex-wrap` parent laisseraient, dans une colonne étroite, la
   roue puis la relique passer seules à la ligne, la relique finissant hors
   du cadre visible. Groupés, ils se déplacent ensemble ou pas du tout. ⚠️ **L'encadré de stats bascule base+bonus
   ↔ total au clic**, comportement propre à `MonsterGear`, partagé avec RTA
   et Siège (voir [rta/ (sections runes)](../rta/)).
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
