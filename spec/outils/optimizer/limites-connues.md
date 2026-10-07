# Limites connues

**Statut :** ÉTAT ACTUEL — décrit ce que le moteur, l'écran et le harnais de l'Optimizer ne garantissent pas aujourd'hui
**Lire si :** on s'étonne d'un résultat de l'Optimizer, ou on cherche ce qu'il ne couvre pas
**Ne pas lire si :** on cherche comment un mécanisme fonctionne — chaque limite renvoie à la spec qui le décrit
**Voir aussi :** [moteur/elagages.md](moteur/elagages.md), [interruption.md](interruption.md), [moteur/diagnostics.md](moteur/diagnostics.md)

Une limite dit ce qui n'est pas garanti, et pourquoi. Ce qui pourrait être
construit pour la lever est une piste, pas une limite, et n'est pas décrit
ici.

## Recherche des runes — le meilleur trouvé, pas l'optimum prouvé

- **Le résultat est le meilleur build trouvé dans le pool retenu**, pas une
  preuve d'optimalité sur l'inventaire entier. Après les élagages sûrs, qui
  ne retirent que des runes prouvées inutiles, deux étages heuristiques
  bornent ce qui est examiné : le pré-filtrage par emplacement
  (`filterSlot`, préréglage `slotFilterCap`) et la rétention par
  compartiment (`buildBuckets`, `bucketCap` places par tranche). Une rune
  ou un demi-build écarté à ces étages n'est jamais revu. Mécanisme :
  [moteur/elagages.md § Pré-filtrage heuristique et compartiments](moteur/elagages.md).
- **Plus il y a de conditions à la fois, plus le pré-filtrage les dilue.**
  `relevance` additionne une contribution par minimum posé : une rune utile
  à une partie seulement des conditions se classe d'autant plus bas qu'elles
  sont nombreuses, même si le build final en a besoin. Au-delà de 4
  minimums (un minimum de RES ou de PRE couvert par l'aura externe ne
  compte pas), les tranches de `filterSlot` classées par `relevance`
  s'élargissent de 20 runes par condition, pas la tranche par stat
  (`FILTER_SLOT_WIDENING_THRESHOLD`, `FILTER_SLOT_WIDENING_PER_CONDITION`) ;
  c'est une atténuation, pas une garantie : un build réel peut rester
  introuvable sur une recherche à beaucoup de conditions simultanées.
- **Le joker n'est pas crédité de ce qu'il complète, avant la rétention.**
  Au pré-filtrage, une rune Intangible entre dans la tranche des sets
  demandés, classée par `relevance` sans valeur de complétion, et jamais
  dans la tranche hors set : une Intangible aux stats faibles peut y être
  écartée. L'ordre d'exploration des compartiments ne la crédite pas non
  plus, ce qui ne joue que si le temps ou le plafond interrompt la
  recherche. La rétention, elle, n'est pas concernée : deux demi-builds en
  concurrence pour une place ont les mêmes comptes et le même nombre de
  jokers (`bucketKeyOf`). Avantager le joker au classement a été écarté :
  [moteur/elagages.md § Variantes écartées ou gardées en réserve](moteur/elagages.md).
- **L'ordre d'exploration est une heuristique.** Les compartiments sont
  triés par potentiel, les paires de compartiments visitées par potentiel
  combiné (`orderedCompartmentPairs`), les demi-builds d'un compartiment
  rangés selon `combosOrderMode` ; à l'intérieur d'une paire de
  compartiments, la boucle parcourt toutes les combinaisons A puis toutes
  les B, sans trier les paires par leur valeur. Aucune borne sur l'objectif
  n'arrête l'appariement : quand le filet de temps ou le plafond de
  candidats l'interrompt, la part non explorée peut contenir mieux que ce
  qui est affiché ([interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](interruption.md)).
- **Le plafond de candidats collectés n'a pas de réglage.**
  `MAX_COLLECTED` (100 000) s'applique toujours ; « Rechercher jusqu'à
  épuisement complet » ne retire que le filet de temps. Atteint, il arrête
  la recherche : le résultat est le meilleur des candidats collectés
  jusque-là, et l'écran dit « resserre tes critères pour un résultat
  exhaustif ».
- **Aucun bonus de set ne pèse au pré-filtrage ni à la rétention.** Une
  rune y vaut par sa principale, son innée et ses sous-propriétés
  (`runeContribution`), plus, pour RES et PRÉ, la part EXTERNE d'aura
  déduite des minimums (`relevance`). Un set que le build activerait —
  set non demandé, activation supplémentaire d'un set demandé, set d'aura
  propre au build (Fight, Determination, Enhance, Accuracy, Tolerance) — ne
  donne aucune priorité à ses runes ni à ses demi-builds. Choix assumé pour
  les sets d'aura : leur valeur est surtout pour l'équipe. Les élagages
  sûrs, eux, comptent ces bonus, et ne coupent donc jamais un build qui en
  dépend : [moteur/elagages.md § Élagages sûrs](moteur/elagages.md).
- **Un résultat « tout-un-set » n'est pas un défaut en soi.** `filterSlot`
  réserve une tranche aux runes hors du set demandé (`offSet`) ; une place
  au pré-filtrage n'en garantit aucune dans le résultat. Si les meilleures
  runes du joueur pour l'objectif sont toutes du set demandé, des builds à
  six pièces de ce set peuvent être la bonne réponse.

## L'objectif de recherche oriente, il ne garantit pas

- **La pertinence ne lit jamais l'objectif.** `relevance`, qui classe les
  runes des tranches de `filterSlot` hors tranche par stat, ne dépend que
  des minimums posés. La tranche générique de `buildBuckets` se classe,
  elle, par l'efficience des trois runes (`relevanceScore`).
- **L'objectif agit à trois endroits, tous heuristiques** : il élargit la
  tranche par stat de `filterSlot` pour ses stats (`PER_STAT_KEEP_OBJECTIVE`,
  24 runes au lieu de 6) ; il ajoute à chaque compartiment une tranche de
  rétention par stat de l'objectif (`retentionKeys`) ; il range les
  demi-builds d'un compartiment (`combosOrderMode`, défaut `'objective'`).
  Les stats de l'objectif viennent d'`objectiveKeysOf` : celles du sort
  choisi en « Dégâts réels » (`objectiveStats`), sinon
  `OBJECTIVE_RELEVANT_STATS`, aucune pour « Efficience ».
- **Conséquence** : le classement par l'objectif se fait sur les candidats
  collectés, après coup ; rien ne garantit que le meilleur build pour
  l'objectif sur tout l'inventaire en fasse partie. Un objectif à plus de
  stats retient plus : chaque tranche a ses propres `bucketCap` places, la
  mémoire et le nombre de paires grandissent avec elles. Les objectifs :
  [ecran/objectif-de-recherche.md § Les quatre objectifs disponibles](ecran/objectif-de-recherche.md).

## Réglages exposés, estimation et progression

- **Quatre réglages de l'écran agissent sur la recherche**, sous
  « Réglages avancés » : le préréglage de pré-filtrage (`slotFilterCap`,
  dont dérive `bucketCap` par `bucketCapFor`), « Rechercher jusqu'à
  épuisement complet » (filet de temps de 10 minutes retiré), « Prioriser
  les stats les plus difficiles » (`adaptiveTrancheWeighting`) et
  « Compter les effets d'auras Tolerance et Précision dans les
  conditions » (`compterAurasResPre`). Ne sont pas exposés :
  `MAX_COLLECTED`, `BUCKET_CAP`, `combosOrderMode` ;
  `SearchParams.bucketCap` sert à la mesure, jamais à l'écran. Détail :
  [ecran/conditions-et-reglages.md § Réglages avancés](ecran/conditions-et-reglages.md).
- **L'estimation affichée avant de lancer est un ordre de grandeur**
  (`estimateSearchSpace`) : le produit des pools par emplacement après
  pré-filtrage, sans dominance ni faisabilité, et non le nombre de paires
  que l'appariement visite :
  [moteur/diagnostics.md § Ce que l'estimation du pool n'affirme pas](moteur/diagnostics.md).
- **La barre de progression est approximative par construction** :
  [interruption.md § Barre de progression](interruption.md).

## Équipement d'un build et diagnostics de l'écran

- **En mode relique « recherche », le classement affiché n'est pas
  exhaustif.** L'ordre de base note les builds sans relique ; la file
  résout la page affichée puis l'ordre de base jusqu'à K combinaisons
  confirmées (`kDeLaFile` : 300 en mode « recherche », 100 sinon ;
  `prochainsATraiter`). Un build au-delà, que la relique et la paire
  retenues feraient remonter, n'est jamais résolu, donc jamais affiché.
  Aucune note affichée n'est fausse : le manque vient de la non-résolution.
  « Vérifier toutes les combinaisons trouvées » résout tout ; en ligne de
  commande, `--resoudre-tout` est la référence exacte. Rien ne le signale à
  l'écran :
  [ecran/resultats.md § Valeur d'objectif affichée sur les cartes](ecran/resultats.md).
- **Les diagnostics de l'écran ne reçoivent pas tout le contexte de la
  recherche** : ni `relicContext`, ni l'objectif, ni
  `statsLignesArtefactsEquipables`. En mode relique « recherche », la
  preuve d'impossibilité porte sur la relique portée, pas sur les bornes du
  contexte relique avec lesquelles la recherche a élagué ; la dominance de
  `rankBlockingConditions` juge sans objectif. Le harnais, lui, leur passe
  les paramètres complets :
  [moteur/diagnostics.md § Paramètres reçus par les diagnostics de l'écran](moteur/diagnostics.md).
- **`chercherPaires` avec `avecCoutDesVerrous` : seul
  `meilleurSansVerrous` est fiable.** Ce drapeau retire les lignes
  verrouillées des dimensions de la dominance, pas seulement de
  l'obligation ; les `paires` rendues peuvent manquer une paire conforme.
  Sans effet à l'écran, dont le seul appel ne lit que
  `meilleurSansVerrous` :
  [moteur/optimiseur-artefacts.md § Lignes verrouillées](moteur/optimiseur-artefacts.md).

## Exclusion et listes de travail

- **En ligne de commande, l'exclusion manuelle venue du Siège n'est pas
  rejouée.** L'écran identifie une équipe de siège par un identifiant tiré
  au hasard à sa création, puis conservé par position aux réimports
  (`useSiegeState.ts`) ; `scripts/lib/loadMonster.ts` numérote les équipes
  par position. Un sélecteur `{ teamId, slotIndex }` exporté depuis l'écran
  ne résout donc jamais : le script l'ignore et avertit que son pool est
  plus large qu'à l'écran (`scripts/lib/chargerRecette.ts`). Box et RTA sont
  fidèles, et l'exclusion automatique « Défenses siège », qui ne lit que
  `monsterId`, aussi :
  [exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source](exclusion.md).
- **La réinitialisation des exclusions manuelles au changement de compte ne
  vaut que depuis le dernier chargement de la page.** L'identité du compte
  importé (`wizardIdRef`, `App.tsx`) n'est pas persistée, et
  `StoredAccount` ne garde pas le `wizard_id` : après un rechargement, le
  premier import d'un autre compte que celui conservé ne vide pas
  `excludedSelectors`.
- **Une liste de travail se remplit un monstre à la fois** : chaque clic
  sur « Ajouter à la liste » ajoute un exemplaire, sans import d'un deck de
  siège ou d'une prépa RTA entière :
  [listes-et-reservation.md § Comparer, valider sans recherche et persistance](listes-et-reservation.md).

## Dégâts réels

- **« Dégâts réels » applique une formule communautaire prédictive**, comme
  la page Mécaniques : la vraie formule du sort contre l'adversaire décrit,
  pas une simulation de combat. Ce qui reste hors modèle, jamais approximé
  en silence :
  [../degats-reels/formules-et-combat.md § Volontairement hors modèle](../degats-reels/formules-et-combat.md) ;
  une formule hors grammaire est refusée plutôt que calculée de travers :
  [../degats-reels/formules-et-combat.md § Lecture des formules — tout ou rien](../degats-reels/formules-et-combat.md).

## Harnais de diagnostic

Ce que les instruments du harnais ne mesurent pas, chacun décrit dans
[harnais-extensions.md § La construction observée](harnais-extensions.md)
et [harnais-extensions.md § Le différentiel : l'oracle](harnais-extensions.md) :

- aucun compteur des combinaisons réellement énumérées par `buildBuckets` :
  la rétention se rapporte au produit brut des pools, un majorant ;
- le relevé mémoire est pris en fin de fil : ni pic instantané, ni pauses
  du ramasse-miettes ;
- `--progression` : le dernier intervalle mêle la dernière rune extérieure
  et l'épilogue, et chaque intervalle inclut la suspension et la reprise du
  générateur (`scripts/lib/build-half-worker.ts`) ;
- le harnais ne rend que le haut du classement (`TAILLE_TOP_RENDU`) et, avec
  un build cible seulement, le nombre de candidats collectés : le
  différentiel compare ce haut et ce nombre, jamais l'ensemble ;
- entre deux bras tronqués, le verdict, la population, le classement et le
  quasi-succès d'un différentiel ne se comparent pas quand le nombre de
  paires explorées diffère au-delà de leur dispersion
  (`scripts/lib/diagnosticDifferentiel.ts`) ; un plafond de candidats
  (`maxCollected`) que la recherche n'atteint pas ne tronque pas une
  recherche séquentielle, mais en appariement parallèle une tranche tronque
  dès qu'elle atteint sa part (motif `quotaTranche`) ;
- le motif d'une recherche arrêtée à la main ne se distingue pas : en
  appariement parallèle elle porte `maxMs`, en séquentiel aucun motif
  (`runeBuildOptim.ts`, `motifTroncature`). L'écran n'en dépend pas, il
  sait lui-même qu'on a cliqué « Arrêter » ;
- en appariement parallèle, l'instant de découverte d'un build cible est
  relevé à intervalle de temps, non reproductible : comparer deux
  configurations sur cette grandeur demande le régime séquentiel.

Ce que le harnais ne sait pas faire, ou dit de travers :

- **`--cas` ignore `--profil` sans le dire** : le lot de cas connus refuse
  `--synthetique`, `--compte` et `--recette`, pas `--profil`, et il est
  traité avant que `--profil` soit lu (`scripts/diagnostic-harness.ts`) ;
- **le palier 1 annonce `combosOrderMode` « relevance (défaut) »**
  (`scripts/lib/diagnosticConfig.ts`), alors que `buildBuckets` prend
  `'objective'` quand le paramètre est absent, comme en production, qui ne
  le pose pas. Le libellé est faux ; le run, qui relaie la même absence,
  reste fidèle ;
- **le différentiel refuse l'axe `combosOrderMode` sur tout profil sans
  objectif**, donc sur les profils fournis : aucun ordre d'énumération ne
  se compare. La raison affichée, un repli de `objective` et `combined` sur
  `relevanceScore`, est plus large que le code : `combined` ne replie
  qu'en l'absence de minimum, `potential` jamais ;
- **la source synthétique** ne force pas de principale par emplacement,
  n'injecte pas de rune et ne porte aucun artéfact ;
  `adaptiveTrancheWeighting` ne se règle ni par elle ni par un override
  (`scripts/lib/diagnosticTypes.ts`) : [harnais-extensions.md § Configuration : une résolution, des arguments refusés, une fidélité bornée](harnais-extensions.md) ;
- **trois scripts conservés ne reproduisent plus leur référence**, chacun
  le dit dans son en-tête : `scripts/bucket-cap-scaling-diag.ts`,
  `scripts/stress-tranche-weighting-attainable-diag.ts` et
  `scripts/filterslot-topk-diag.ts`, dont la copie `filterSlotOld` n'a pas
  l'élagage sûr de la production à combo de coût complet
  ([harnais-scripts.md § Les scripts voisins](harnais-scripts.md)).
