# Vérification — Reliques et artéfacts

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testDominanceReliqueCasMinimal`, `testDominanceReliqueCouverture`, `testDominanceReliqueRecherche`, `testDominanceReliqueTemoins`, `testDominanceReliqueWorkers`, `testDominanceReliqueDifferentiel`, `testDominanceReliqueDifferentielCible` | `tests/rune-optim-dominance-relique.test.ts` | un oracle noté : la dominance face à l'effet unique de la relique et aux lignes d'artéfact 218–221, paire tirée, différentiel ciblé |
| `testDominanceLignesQuatrePorteurs`, `testDominanceLignesJoker`, `testDominanceLignesLibre`, `testDominanceLignesProducteurs`, `testDominanceLignesWorkers` | `tests/rune-optim-dominance-lignes.test.ts` | les cas fixes des lignes 218–221 : porteurs, joker, « Libre », producteurs, Workers |
| `testResolutionRapide`, `testResolutionRapideNaN` | `tests/resolution-rapide.test.ts` | la résolution rapide de l'équipement (`src/lib/resolutionRapide.ts`) et le point d'entrée de l'app (`resoudreEquipementDuBuild`, avec les formes de la file) contre le calcul exhaustif (`resoudreEquipementDuBuildExhaustif`), build par build, sans et avec diagnostic ; les notes NaN et leur repli |
| `testResolutionConfirmation` | `tests/resolution-rapide.test.ts` | la confirmation sans note (`confirmerEquipementDuBuild`) contre la résolution complète : même verdict, même résultat d'un build rejeté, mêmes erreurs, aucun appel à `evaluer` |
| `testMemoCombat` | `tests/memo-combat.test.ts` | le memo du calcul des dégâts réels d'un build (`MemoCombat`, `src/lib/damage.ts`) : `computeTotalDamage` avec et sans lui, au bit près, sur chaque sort calculable du corpus sous deux réglages (dont poses entre les coups, passifs allumés et critique forcé), paires de mêmes stats qui ne diffèrent que par une amplification de buff ; ses bornes ; sa mémoire gardée sous critique forcé avec poses entre les coups (le réglage recopié ne se retient pas) et avec un élément `undefined` |
| `testRelicOracle`, `testRelicOracleGroupesEffetUnique`, `testRelicOracleOptimumParScore` | `tests/relic-oracle.test.ts` | l'oracle de la dimension relique (`oracleSearch`, `scripts/lib/relicOracle.ts`) |
| `testReliqueOu` | `tests/relique-ou.test.ts` | la relique en « OU » du test conjoint (mode `recherche`) : les représentatives (`reliquesRepresentatives`) sur des inventaires écrits ; minimum et maximum sur la stat de la relique (une valeur du milieu, conforme pour la résolution) ; le quasi-succès relique par relique, et le faux positif de la borne par stat (fixture B) plus collecté ; le corpus à builds rejetés (`corpusAvecRejetes`) des tests de la résolution |
| `testTestConjointExact` | `tests/test-conjoint-exact.test.ts` | le test conjoint EXACT, maximums de PV/ATQ/DEF compris : le contre-exemple aux valeurs du jeu (un seul artéfact PV sous minimum et maximum de PV ; un maximum seul) en relique `recherche`, forcée, fixe et sans relique ; sur des pools tirés, chaque paire des compartiments collectée si et seulement si l'énumération brute (relique × vraie paire) la déclare conforme, production = référence, quasi-succès compris |
| `testRelicDifferentiel` | `tests/relic-differentiel.test.ts` | le différentiel de fidélité de la dimension relique : comparaison pure, puis orchestrateur contre `oracleSearch` si un export de compte est présent |

## Vérification — oracle noté, paire tirée et différentiel ciblé

Deux protections de la dominance ne se voient qu'au score : l'effet unique
de la relique, et les lignes d'artéfact 218–221, qui ajoutent en « Dégâts
réels » un pourcentage des PV, de l'ATQ, de la DEF ou de la VIT de combat
(`ajoutArtefactBrut`) que `damageRelevantStats` exclut de l'objectif. Un
oracle qui ne note pas reste d'accord avec le moteur précisément là où les
deux ont tort (`tests/rune-optim-dominance-relique.test.ts:5-9`).

`testDominanceRelique…` (`tests/rune-optim-dominance-relique.test.ts`) :

- **La note est celle de la production, paire comprise.** L'oracle
  énumère le produit des six emplacements sans appeler `prepareSearch` ni
  aucune coupe, et note par `objectiveScore` avec les auras propres du
  build et l'effet unique de sa relique (`apportExclusive`) (`:5-16`). Un
  cas peut porter une paire fixe (`SearchParams.artifacts`) et un mode
  critique ; `verifier()` confronte, candidat par candidat, la note de
  l'oracle à `scoreDuCandidat` (`optionsDeClassement`) en relique fixe, et
  au score du couple retenu par la vraie résolution (`resoudreCandidat`,
  paire figée par `paireFixe`) en mode `recherche` (`:22-27`, `:286-300`,
  `:323-350`). La dominance a le droit de retirer un build valide, jamais
  l'optimum.
- **Différentiel aléatoire** (`testDominanceReliqueDifferentiel`, graines
  6400 à 6479) : paire (zéro à deux lignes 218–221) et mode critique,
  Critique ou Non critique, tirés après les autres tirages. Il reste
  aveugle aux mutations de sa propre protection : un clone par
  emplacement, au set tiré, rarement porteur (`:676-750`, `:758-760`).
- **Différentiel ciblé** (`testDominanceReliqueDifferentielCible`, graines
  6500 à 6559) : chaque scénario est construit pour que la protection porte
  l'optimum. B* est l'optimum de l'oracle sur un bruit (sets neutres hors
  du combo) ; ses runes de `setPieces(porteur)` emplacements libres sont
  clonées au set porteur, avec un identifiant plus grand ; la tranche de la
  relique tombe entre les deux assiettes, ou la paire porte la ligne de la
  stat du porteur (`:761-770`). Pièges traités : la stat du porteur n'est
  jamais gardée par l'autre canal (un scénario « ligne » tourne sans
  relique, ou avec des reliques qui ne la protègent pas ; un scénario
  « effet unique » porte une paire dont aucune ligne ne lit la stat du
  porteur) ; deux graines sur trois tournent sans Intangible — avec elle,
  `setPieces − 1` clones et une Intangible, chaque emplacement libre ayant
  son set neutre propre (`:771-780`). Blade fait partie du bruit des
  emplacements libres (`:847`).
  Le test compte, par cible, les scénarios où la protection agit et où
  l'optimum exige les clones porteurs — les détecteurs — et en exige au
  moins un par cible (`:939-1013`) : une mutation qui vide
  `statsDeLEffetUnique` ou `statsLuesParLesLignes` doit faire échouer au
  moins un scénario (`:781-782`). Un scénario où une autre relique
  éligible rend le porteur inutile ne peut rien détecter : l'optimum n'y
  exige pas ses clones.

`testDominanceLignes…` (`tests/rune-optim-dominance-lignes.test.ts`) porte
les cas fixes des lignes 218–221 : sans protection, Energy, Guard, Enhance
ou Determination tomberaient face à un Will aux mêmes stats, optimum perdu
(`:1-7`). Même oracle noté, paire comprise ; en « Libre », l'oracle énumère
lui-même toutes les paires équipables et prend la meilleure note de
l'équipement complet (`:13-21`). Cas : quatre porteurs avec un témoin et
une variante Intangible, un set formable seulement grâce au joker, la ligne
portée par une autre pièce que la représentative en « Libre », les
producteurs du champ (union, cas mixte, écran et CLI), les Workers et les
tranches qui le reçoivent.
