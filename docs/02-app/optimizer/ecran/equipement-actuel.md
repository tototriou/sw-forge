# Équipement actuel

Ce document décrit « Exemplaire » : ses vues, l'aperçu des autres
exemplaires, la fiche d'équipement et sa validation. Au bureau, la section
est dans la colonne « Monstre » ; au téléphone, dans « Monstre &
équipement ». Fichiers : [ExemplaireEtFiche.tsx](src/components/outils/optimizer/ExemplaireEtFiche.tsx),
[ExemplaireBureau.tsx](src/components/outils/optimizer/bureau/ExemplaireBureau.tsx),
[ChoixExemplaire.tsx](src/components/outils/optimizer/ChoixExemplaire.tsx),
[MonsterGear.tsx](src/components/MonsterGear.tsx).

## Regarder, jamais ajouter

⚠️ **« Exemplaire » ne sert qu'à regarder** (décision de l'utilisateur) :
aucune vue, aucune puce, aucune ligne de la zone D n'ajoute un monstre à la
liste ni ne change ce qui est optimisé — ni les critères, ni la relique et
les artéfacts de la recherche, ni les résultats affichés. On ajoute un
monstre par la recherche ou par « Importer une équipe »
([recherche-du-monstre.md](recherche-du-monstre.md)). **Ce qui est
optimisé est le membre de la liste**, ou le monstre affiché quand il n'est
pas membre ([recherche-du-monstre.md](recherche-du-monstre.md#monstre-affiché-sans-être-membre)).

Deux équipements, à ne pas confondre :

- **l'équipement optimisé** — celui de l'exemplaire du membre, son build
  validé à la place de l'équipement porté quand il en a un. La relique et
  les artéfacts « comme équipés » de la recherche en viennent. Ni la vue ni
  l'aperçu ne le changent ;
- **l'équipement affiché** — celui de la fiche, selon la vue ou l'aperçu.
  Il sert la fiche, la référence de « Comparer »
  ([../feat-listes-et-reservation.md](../feat-listes-et-reservation.md)) et
  « Valider ce build ».

## Vues et aperçu

1. **Deux vues** : `Segmented` « Build actuel » · « Build validé ».
   « Build validé » montre le build validé du membre dans la liste active,
   sous son bandeau (voir
   [../feat-listes-et-reservation.md](../feat-listes-et-reservation.md#monstre-non-possédé-et-auto-exemption)) ;
   « Build actuel », l'équipement réellement porté par l'exemplaire du
   membre. « Build validé » est grisé, avec sa raison, tant que le membre
   n'a pas de build validé. La vue de départ est « Build validé » s'il
   existe, « Build actuel » sinon.
2. **« Voir aussi » : les puces d'aperçu** — Box / RTA / Défenses siège /
   Offenses siège (`Segmented size="lg"`, même contrôle qu'« Exclure les
   runes d'un monstre », voir ../feat-exclusion.md § Exclusion manuelle —
   un monstre précis, dans n'importe quelle source). ⚠️ **Libellés sur deux
   lignes selon la largeur RÉELLE de sa colonne, pas celle de la fenêtre**
   — `Segmented` mesure lui-même la place qu'il reçoit et passe seul ses
   libellés sur deux lignes quand ils ne tiennent pas (« Défenses /
   siège », « Offenses / siège » ; voir
   [03-developpeur/interface/librairie-ui/README.md](../../../03-developpeur/interface/librairie-ui/README.md)),
   comportement commun à TOUS les sélecteurs de l'app. **Une puce grisée**
   signale que l'espèce n'a, dans cette source, aucun exemplaire à regarder
   que celui du membre (`options[i].disabled` ; aucune source : tout le
   contrôle). **Une puce dit le nombre dès deux exemplaires** :
   `{source} · {n}` (« Box · 2 »), même règle pour les quatre sources ; à
   zéro ou un exemplaire, la puce garde son libellé. C'est le seul signe
   qu'un clic ouvre la zone D. Le compte ne dépend que de l'espèce, jamais
   d'un clic, et les puces se partagent la largeur à égalité : rien ne
   bouge (`libellePuceSource`, optimizerExclusion.ts).
   **Cliquer une puce** montre l'unique autre exemplaire de cette source
   s'il n'y en a qu'un, sinon ouvre la **zone D** — un panneau flottant
   (bureau) / bloc en ligne (téléphone) listant chaque exemplaire
   (`ExclusionCandidateRow` : portrait, nom, icônes des sets actifs, compte
   de runes, et pour le siège le numéro d'équipe + coéquipiers) ; choisir
   une ligne le montre. Un exemplaire nu (sans rune) se regarde comme les
   autres.
3. **En aperçu**, un bandeau au-dessus de la fiche dit « Aperçu : <monstre>
   · <source>. Ce n'est pas l'exemplaire de la liste. », avec « Revenir »,
   qui rend la vue d'avant ; recliquer la puce allumée fait de même. La
   puce de l'aperçu est allumée, les vues ne le sont pas. L'aperçu est un
   état d'affichage, local à l'écran (hors `useOptimizerState`) : il se
   vide au changement de membre, et quitter la page de l'Optimizer le perd.
4. **« Valider ce build »**, sous la fiche, valide l'**équipement
   affiché** : ses six runes, sa paire d'artéfacts et sa relique deviennent
   le build validé du membre et réservent ses runes dans la liste ; la vue
   passe alors à « Build validé ». En aperçu, c'est le build de
   l'exemplaire regardé qui devient celui du membre (décision de
   l'utilisateur). Le bouton dit « Validé » quand l'équipement affiché est
   déjà le build validé, à l'identique, « Valider les artéfacts » quand
   seules ses runes le sont ; il exige six runes affichées. Sous lui, les
   runes déjà réservées par un autre membre de la liste sont nommées.

## La fiche

**Le composant `MonsterGear`, réutilisé tel quel** (pas réimplémenté), le
même qu'en RTA/Siège quand on clique un monstre : stats base/bonus,
artéfacts, roue de runes et relique de l'équipement affiché. L'exemplaire
du membre (`gearSource`, la puce de source ; `sourceSelector`, l'entrée
précise) vit dans `useOptimizerState` : il **reste choisi quand on change
de page**, et entre dans la sauvegarde de session
([transverse/ (sauvegarde de session)](../../transverse/)). Au montage,
l'écran le revérifie dès le premier rendu (`exemplaireAuMontage`,
[OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx),
enregistré par un `useLayoutEffect`) : s'il ne se résout plus
(`resolveExclusionEntry` — compte réimporté, équipe de siège supprimée) ou
n'est pas de l'espèce choisie, il est remplacé par le **PREMIER exemplaire
Box** de l'espèce (`boxCandidates[0]`), source Box — la même règle que la
recherche (voir [recherche-du-monstre.md](recherche-du-monstre.md)) —, ou
par `unownedSelectorIfNoneOwned` si la box n'en compte aucun. ⚠️ **Limite
connue** : ce choix d'exemplaire ne fait PAS partie de la recette exportée
(`OptimizerRecipe` ne porte que l'espèce, `monsterCom2usId`) — réimporter
une recette lancée sur un exemplaire RTA/siège retombe sur la box par
défaut.

Chacun de ses éléments reste **cliquable** pour ouvrir son détail complet
(`RuneDetailBox`/`ArtifactDetailBox`/`RelicDetailBox`, tous dans
[MonsterGear.tsx](src/components/MonsterGear.tsx)), affiché en **popover
flottant** ancré sur l'élément cliqué — même dispositif que les cartes de
résultat (`BuildCandidateCard`, voir resultats.md § Résultats), pas un bloc
qui pousserait le reste de la fiche vers le bas. Ce que l'outil part
optimiser, visible d'un coup d'œil avant de lancer quoi que ce soit. Les
résultats proposent leurs propres artéfacts et leur relique quand leur
optimisation est active, sans modifier l'équipement du compte (voir
../../../03-developpeur/optimizer/moteur/elagages.md § Algorithme (résumé
fonctionnel)).

- ⚠️ **Artéfacts : toujours 2 emplacements affichés** (Attribut puis
  Type), même si le monstre n'en porte qu'un seul ou aucun — un
  emplacement vide est montré grisé plutôt que simplement absent.
- ⚠️ **Relique : emplacement TOUJOURS affiché de la même façon**, même
  absente — grisé plutôt que simplement absent, comportement partagé avec
  RTA et Siège.
- ⚠️ **Artéfacts, roue et relique forment UN SEUL groupe insécable** dans
  `MonsterGear` (`flex-none`, aucun `flex-wrap` à l'intérieur) : trois
  items indépendants du conteneur `flex-wrap` parent laisseraient, dans une
  colonne étroite, la roue puis la relique passer seules à la ligne, la
  relique finissant hors du cadre visible. Groupés, ils se déplacent
  ensemble ou pas du tout.
- ⚠️ **L'encadré de stats bascule base+bonus ↔ total au clic**,
  comportement propre à `MonsterGear`, partagé avec RTA et Siège (voir
  [rta/feat-sections-runes.md](../../rta/feat-sections-runes.md)) ; Taux
  Crit, Dmg Crit, RES et Précision y restent toujours en total.

⚠️ **Affichée SOUS les vues et les puces, TOUJOURS** — vide (stats à zéro,
emplacements grisés, roue sans rune) tant qu'aucun monstre n'est choisi,
plutôt que de n'apparaître qu'au clic. C'est un `GearSet` NUL construit en
local (`EMPTY_GEAR`, [optimizer/constantes.ts](src/components/outils/optimizer/constantes.ts)),
pas une variante de `MonsterGear` : le composant partagé n'a besoin
d'aucune adaptation, `computeStats` sur une base à zéro renvoie déjà des
lignes à zéro, et `ArtifactSlots`/`RuneWheel` gèrent nativement un tableau
vide.

⚠️ **Au bureau, la fiche est toujours repliée** (artéfacts, roue de runes
et relique sous les statistiques ; décision de l'utilisateur) : 356 px
mesurés avec une relique ATQ ou DEF à deux chiffres, dans les 358 px de
contenu de la colonne « Monstre ». Le bandeau d'aperçu ou du build validé,
au-dessus, et « Valider ce build », dessous, ont la largeur de la fiche
telle qu'affichée (décision de l'utilisateur) : d'un bord à l'autre de sa
rangée la plus large.
