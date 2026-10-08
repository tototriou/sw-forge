---
name: optimizer-field-propagation
description: "Checklist pour tout ajout, renommage ou changement de type, de défaut ou de sens d'un champ TRAVERSANT de l'Optimizer (OptimizerState, OptimizerRecipe, SearchParams, RealDamageContext, entrée de résolution…) — d'abord un producteur pur unique, appelé par l'écran, la recette, les scripts et les Workers ; là où plusieurs constructeurs subsistent, chacun se vérifie, parce qu'un champ optionnel oublié dans l'un d'eux passe tsc et fait diverger un script de l'écran sans bruit."
---

# Propagation d'un champ Optimizer (SW Blacksmith)

## Quand ce skill s'applique

- Ajout d'un champ dans `OptimizerState` (`useOptimizerState.ts`) ou
  `OptimizerRecipe` (`optimizerRecipe.ts`).
- Renommage, changement de type, de **valeur par défaut** ou de **sens**
  (ex. inversion booléenne) d'un champ de l'un des deux ; suppression d'un
  champ devenu inutile.
- Tout autre type **traversant**, c'est-à-dire construit à plusieurs
  endroits indépendants (écran, scripts, Workers, tests) : `SearchParams`,
  `RealDamageContext`, `ArtifactSearchParams`, l'argument de
  `entreeResolutionDuBuild`.

**Le critère est « combien d'endroits INDÉPENDANTS construisent cette
valeur ? »**, pas « ce champ est-il dans `OptimizerState` ? ». Un seul
constructeur : le compilateur suffit. Plusieurs : d'abord les ramener à un
seul (section suivante), puis la checklist pour ce qui reste.

**Hors périmètre** : un changement interne au moteur qui ne traverse rien
(variable locale, constante de calage). La correction algorithmique relève
d'`algo-verify`, la mesure d'`optimizer-perf-testing`. Ce skill ne couvre que
la **plomberie** : la valeur arrive-t-elle partout où elle doit arriver.

## D'abord le producteur unique

Avant de brancher un champ dans plusieurs constructeurs, chercher la
fonction pure qui produit déjà la valeur pour tous les côtés, et n'ajouter le
champ qu'à elle. Si la valeur est encore assemblée à deux endroits, la
première réponse est d'extraire cette fonction (sous `src/lib/`, sans
React ni API de plateforme, pour que Node et les Workers l'importent) et de
la faire appeler partout ; la checklist ne sert que là où plusieurs
constructeurs subsistent.

Producteurs en place, chacun appelé de plusieurs côtés :

| Valeur | Producteur | Appelé par |
|---|---|---|
| paramètres de choix des paires, sans `evaluer` | `parametresArtefactsFiche` (artifactFiche.ts) | écran (`artifactParams`, OptimizerSection.tsx), CLI (`paramsArtefacts`, recipeToSearchParams.ts), différentiel des reliques (`entreeResolution`, relicDifferentiel.ts) |
| entrée de résolution d'un build | `entreeResolutionDuBuild` (relicQueue.ts) | écran (`resoudreEquipement`), CLI (`resoudreEquipementCli`), différentiel des reliques (`entreeResolution`), Worker de résolution (`CorpsResolution`, resolutionBody.ts) |
| options du classement | `optionsDeClassement` (runeBuildOptim.ts) | écran, CLI (classementCli.ts), harnais (diagnosticHarness.ts) |
| stats des lignes d'artéfacts équipables | `statsLignesArtefactsEquipables` (artifactFiche.ts) | écran (`handleSearch`), CLI (`resolveStatsLignesArtefacts`) |
| conditions avec auras | `avecAurasConditions` (runeBuildOptim.ts) | écran (`requirementAvecAuras`), CLI (`recipeToSearchParams`), parité du harnais (`diagnostic-harness-parite.ts`, avec des arguments figés : `DEFAULT_DAMAGE_SETUP`, `true`) |
| profil de dégâts des artéfacts | `artifactDamageProfile` (damage.ts), depuis `ARTIFACT_DAMAGE_NEUTRE` | seul constructeur de `ArtifactDamageProfile` ; écran, CLI et moteur l'appellent |
| recette lue d'un fichier | `parseOptimizerRecipe` (optimizerRecipe.ts) | écran (`importRecipe`), scripts (`chargerRecette`, scripts de diagnostic) |
| recette et export de compte vers `SearchParams`, côté scripts | `chargerRecette` (scripts/lib/chargerRecette.ts) | `optimizer-search.ts`, harnais (diagnosticConfig.ts), oracle des reliques (relicOracle.ts) |

Les runes d'un build ont un producteur pour les deux résolutions de l'écran,
directe et dans le Worker (`runesDuBuild`, relicQueue.ts) ; le CLI
(`resoudreEquipementCli`) et le différentiel (`runesDe`, relicDifferentiel.ts)
gardent chacun leur expression : ce sont deux constructeurs de plus.

## La checklist — code

Chaque champ touché se cherche (grep du nom, ancien ET nouveau) dans CHACUN
de ces emplacements, coché explicitement, pas seulement « ça compile » :

- [ ] **`src/hooks/useOptimizerState.ts`** — le champ et son setter dans
      `OptimizerState`, la valeur initiale du `useState`, le retour ; et
      `resetSearch`, qui remet les critères à zéro au changement de monstre
      ou de compte mais garde les réglages avancés : décider de quel côté
      est le champ. Les champs d'`OptimizerState` sont obligatoires, `tsc`
      voit donc un oubli ici ; il ne voit pas un état que personne ne lit.
- [ ] **`src/components/outils/OptimizerSection.tsx`** — déstructuré depuis
      `optimizer` ; lu par `handleSearch` (le `SearchParams` envoyé au
      moteur) ou par le mémo qui l'alimente ; câblé dans le JSX ; passé à
      `buildOptimizerRecipe` dans `exportRecipe` ; écrit par `importRecipe`,
      avec son repli (« Compatibilité arrière » ci-dessous). Un champ
      optionnel absent de l'appel à `buildOptimizerRecipe` reste valide pour
      `tsc`. Fichier très long : `grep -n`, jamais en entier.
- [ ] **`src/lib/optimizerRecipe.ts`** — le champ dans `OptimizerRecipe` ; sa
      validation dans `parseOptimizerRecipe`, sans quoi une valeur d'un
      mauvais type passe telle quelle à l'écran et au CLI ; le commentaire
      « Deux constructeurs » en tête du fichier, à jour.
- [ ] **`scripts/lib/recipeToSearchParams.ts`** — `recipeToSearchParams` et
      ses résolveurs (`resolvePool`, `resolveArtifacts`,
      `resolveArtifactBounds`, `resolveObjectiveStats`, `recipeToRelicIntent`,
      `artefactsDuCli`, `resoudreEquipementCli`) lisent le champ EXACTEMENT
      comme l'écran, repli compris. Un champ qui n'entre pas dans
      `SearchParams` a un seul point de lecture côté CLI, comme
      `toutVerifierDeLaRecette`.
- [ ] **`scripts/lib/chargerRecette.ts`** — si le champ demande un
      chargement conditionnel ou un avertissement de fidélité
      (`avertissements`). `scripts/lib/loadMonster.ts` seulement si le champ
      exige une donnée qui n'était pas déjà chargée.
- [ ] **Scripts qui lisent ou fabriquent une recette sans `chargerRecette`**
      (`grep -rln parseOptimizerRecipe scripts/`, moins
      `scripts/lib/chargerRecette.ts`) — huit scripts de diagnostic lisent
      la recette par `parseOptimizerRecipe` et n'en reprennent que ce qu'ils
      utilisent : sept appellent `recipeToSearchParams` sans `exclusionData`,
      donc lèvent une erreur dès que la recette exclut des runes
      (`excludeUsedRunes` ou `excludedSelectors`) ; `optimizer-pctflat-diff-diag.ts`
      ne passe pas par `recipeToSearchParams` ; seul
      `optimizer-search-analyze.ts` recopie un repli (l'objectif retiré).
      `artifact-contention-diag.ts` fabrique sa recette à la main
      (`buildOptimizerRecipe`). Un champ qu'ils lisent se vérifie chez eux.
- [ ] **`scripts/optimizer-search.ts`** — la ligne de résumé en tête de
      sortie mentionne le champ s'il change un comportement visible ; toute
      logique qui dépendait de l'ANCIEN champ est mise à jour, pas
      dupliquée à côté.
- [ ] **Contexte relique** (`SearchParams.relicContext`) — tous les appels
      passent par `resoudreContexteRelique`, l'intention vient de plusieurs
      endroits : l'écran (`relicIntentDepuisEtat`, useOptimizerState.ts), le
      CLI (`recipeToRelicIntent`), les cas nommés (`buildCaseSearchParams`,
      scripts/lib/perfShared.ts) et l'oracle des reliques
      (scripts/lib/relicOracle.ts), qui l'appelle une fois par
      `recipeToRelicIntent` et une fois avec une intention écrite à la main
      (`{ mode: 'recherche', ...option }`). Le différentiel
      (scripts/relic-differentiel.ts, `paramsA`) pose ce contexte dans
      `SearchParams.relicContext`. `grep -rn resoudreContexteRelique src/ scripts/`.
- [ ] **Bornes d'artéfacts** (`SearchParams.artifactBounds`) — l'écran
      (`searchArtifactBounds`), le CLI (`resolveArtifactBounds`), et le repli
      du moteur quand elles manquent (`deriveMinMaxContext`, runeBuildOptim.ts).
- [ ] **`RealDamageContext`** — le mémo `realDamage` de l'écran,
      `buildRealDamageContext` (scripts/lib/realDamageCli.ts), et tout script
      qui l'assemble à la main (`grep -rn RealDamageContext scripts/`).
- [ ] **Worker de résolution** — un argument ajouté à
      `entreeResolutionDuBuild` doit aussi voyager : `EntreesResolutionSerialisables`
      et `entreesSerialisables` (src/workers/resolutionBody.ts) listent les
      champs un par un (sauf `artifactParams`, recopié par décomposition), et
      `CorpsResolution` les repasse au producteur. L'écran passe les mêmes
      arguments à `entreeResolutionDuBuild` et à `entreesSerialisables` ; le
      test `resolutiondistante` compare les deux listes et en fige le compte,
      à mettre à jour. Un champ qui porte une fonction est refusé par `tsc`
      (`ProtocoleClonable`).
- [ ] **Différentiel des reliques** — `entreeResolution`
      (scripts/lib/relicDifferentiel.ts) traduit `ReglagesDifferentiel` vers
      les entrées des producteurs, avec ses propres `runesDe` et
      `maxStatsActifsDe`.
- [ ] **`tests/`** — au moins un test couvre le nouveau comportement ; après
      un renommage ou une inversion, plus aucun test ne cite l'ancien nom
      (`grep` sur `tests/` aussi). Un test qui fabrique la valeur à la main
      est un constructeur de plus, à traiter comme les autres.

## Ce que `tsc` attrape, et ce qu'il n'attrape pas

`tsconfig.json` couvre `src`, `scripts` et `tests` : `npx tsc --noEmit`
type-vérifie tout le dépôt.

**Il attrape** un champ dont le **type change**, un champ **obligatoire**
absent d'un littéral, un import de type faux, une variante d'union périmée.

**Il n'attrape pas**, et c'est la raison d'être de la checklist :
- un champ **optionnel** jamais lu par un constructeur ;
- un champ lu mais **mal interprété** (bon type, mauvais sens) ;
- une **documentation** qui ment.

Le compilateur couvre la FORME, jamais l'INTENTION.

## Compatibilité arrière (recettes déjà exportées)

Une recette `.json` exportée AVANT le changement ne porte pas le nouveau
champ (`undefined`).

- **Champ nouveau, sans équivalent avant** : repli sur un défaut sûr,
  `recipe.nouveauChamp ?? défaut`, le même dans chaque lecteur (l'écran,
  `importRecipe` ; le CLI, `recipeToSearchParams` ou sa fonction de lecture).
  Exemples en place : `exhaustiveSearch ?? false`, `excludedSelectors ?? []`,
  `lignesVerrouillees ?? []`.
- **Ancienne valeur à normaliser** : dans `parseOptimizerRecipe`, que l'écran
  et `chargerRecette` lisent tous deux, une seule fois pour les deux. Y vivent
  déjà le mode critique supprimé (avec l'avertissement
  `AVERTISSEMENT_CRIT_MOYENNE`), l'ancien cran « aucune » de `summonerSkills`,
  l'ancien `setsAura` (retiré s'il est vide, refusé sinon) et le seuil de
  relique ramené dans ses bornes.
- **Renommage ou inversion d'un champ EXISTANT** : traduire explicitement
  l'ANCIEN champ vers le nouveau, pour qu'une recette déjà exportée se
  comporte EXACTEMENT pareil après réimport. Exemple (`exploreAll`, coché
  par défaut, box seulement → `excludeUsedRunes` décoché par défaut et
  `excludeUsedScope`, trois périmètres) :
  ```ts
  const legacy = recipe as unknown as { exploreAll?: boolean };
  setExcludeUsedRunes(recipe.excludeUsedRunes ?? legacy.exploreAll === false);
  setExcludeUsedScope(recipe.excludeUsedScope ?? 'box'); // seul périmètre que l'ancien champ connaissait
  ```
  Trois replis vivent encore hors du parseur :
  - l'objectif retiré : `importRecipe`, `chargerRecette` et
    `optimizer-search-analyze.ts`, chacun sa copie ;
  - `exploreAll` : `importRecipe` seulement ;
  - l'ancien choix d'artéfact `'none'`, ramené à `'libre'` par
    `mainsPourCeCompte` (optimizerRecipe.ts), que seul `importRecipe` appelle.

  Le CLI ne relit ni `exploreAll` ni `'none'` : sur une recette qui les
  porte, il ne lit pas la même chose que l'écran. Un nouveau repli va dans
  le parseur.

## La checklist — documentation

**Plusieurs fichiers**, pas un seul, décrivent le même écran — un changement
qui n'en touche qu'un a de bonnes chances d'en avoir oublié un autre :

- [ ] **`spec/outils/optimizer.md`** — page d'entrée : objet de l'outil,
      fichiers de code, renvoi par sujet ; à revoir si le champ change ce
      qu'elle résume.
- [ ] **La page de la carte qui porte le contrôle**, une par carte dans le
      dossier `ecran` de l'Optimizer (liste dans
      `spec/outils/optimizer/ecran/README.md`) — current-state détaillé, avec
      les détails d'implémentation (fichiers, fonctions). La recette
      (export, import, repli d'une recette plus ancienne) :
      [spec/outils/optimizer/ecran/lancer-la-recherche.md § Lancer la recherche](../../../spec/outils/optimizer/ecran/lancer-la-recherche.md).
      Si le champ change ce que fait le moteur, la spec de ce mécanisme
      (routage : `spec/outils/optimizer/README.md`). Mettre à jour la section
      correspondante dans le même commit que le code, jamais après coup.
- [ ] **`spec/outils/optimizer/pistes.md`** — les pistes futures seulement :
      un champ qui réalise une piste l'en retire ; une variante écartée
      s'écrit en une ligne « ne pas… parce que… » dans la spec du
      mécanisme.
- [ ] **`spec/outils/optimizer/invariants.md`** — si la règle modifiée y
      figure, elle se modifie dans sa source ET dans `invariants.md`, dans le
      même commit
      ([spec/outillage/spec.md § Statut du fichier](../../../spec/outillage/spec.md)).

## Vérification

Après avoir coché les deux checklists ci-dessus, dans l'ordre de `CLAUDE.md`
(« Vérifier ») :

1. `npx tsc --noEmit` — vide. Il prouve la FORME partout, `scripts/` et
   `tests/` compris ; rien sur un champ optionnel oublié ni sur un sens mal
   lu.
2. `npx eslint <fichiers touchés>` — aucune erreur.
3. `node tests/run.mjs <filtre…>` — seulement la zone touchée : la
   vérification du champ, et celles des producteurs et constructeurs
   traversés, par exemple `recette`, `optimizerrecipe`,
   `artefactsficheparams`, `resolution`, `cliclassement`, `verifiertoutes`,
   `relicdifferentiel`. Un filtre qui ne correspond à rien échoue en
   listant les noms (registre : `tests/index.ts`).
4. `npm run build`.

La suite complète (`npm test`) ne tourne qu'avant une fusion sur `main`.

**Un contrôle exprimable en vérification nommée va dans `tests/`**, appelé
depuis `tests/index.ts`, et on le voit échouer une fois sur le code cassé
avant de le croire (`tests/README.md`, « Ajouter une vérification »). Pour
un champ traversant, c'est la parité : appeler le producteur, ou le
constructeur de chaque côté, sur la même entrée et comparer ; quand le côté
écran est une closure de composant, contrôler sa source, comme
`verifier-toutes.test.ts` et `resolution-distante.test.ts`. Un test qui a
besoin d'un export de compte réel le prend par `exportReel`
(`tests/outils.ts`) et s'ignore quand il manque.

**Un script ponctuel ne reste que pour ce qu'un test ne peut pas faire**, et
il le dit en tête : un export de compte réel non suivi, une mesure de temps,
un relevé ponctuel. Cas type : `scripts/optimizer-search.ts` lancé une fois
de bout en bout, champ activé, sur un export réel, pour la ligne de résumé
et le chemin complet ; ou, si le champ change le pool de runes, un script
du scratchpad qui appelle `resolvePool` ou `recipeToSearchParams` pour
chaque valeur du champ, sans recherche complète puisque le changement est en
amont du moteur (« Vérifier au bon ÉTAGE du pipeline », `algo-verify`). Le
script ne se commite pas ; sa sortie se cite avec le changement (commit,
PR).

## Voir aussi

- `algo-verify` — discipline de CORRECTION algorithmique (référence
  brute-force, test différentiel, benchmark) : à appliquer EN PLUS de ce
  skill-ci si le changement touche aussi la logique de recherche elle-même,
  pas seulement un champ de configuration qui la traverse.
- `optimizer-perf-testing` — méthodologie de MESURE (quel outil pour
  quelle question) : à appliquer si le changement peut affecter le TEMPS
  de recherche, pas seulement sa justesse ou sa plomberie.
