---
name: optimizer-field-propagation
description: "Checklist à suivre pour tout ajout, renommage ou changement de sémantique/défaut d'un champ TRAVERSANT (OptimizerState, OptimizerRecipe, RealDamageContext, ArtifactDamageProfile…) — l'écran, la recette et les scripts CLI ont chacun leur propre copie de la logique, et la documentation est éclatée sur plusieurs fichiers distincts. Un champ OPTIONNEL oublié dans l'un d'eux ne déclenche aucune erreur tsc : le seul signal est un script qui diverge silencieusement de l'écran, ou une doc qui ment."
---

# Propagation d'un champ Optimizer (SW Blacksmith)

## Quand ce skill s'applique

- Ajout d'un nouveau champ dans `OptimizerState` (`useOptimizerState.ts`)
  ou `OptimizerRecipe` (`optimizerRecipe.ts`).
- Renommage, changement de type, ou changement de **valeur par défaut** /
  **sémantique** (ex. inversion booléenne) d'un champ existant de l'un des
  deux.
- Suppression d'un champ devenu inutile.
- ⚠️ **Tout autre type TRAVERSANT** — c'est-à-dire dont la valeur est
  construite à plusieurs endroits indépendants (écran, moteur, scripts CLI,
  tests) plutôt qu'en un seul. `RealDamageContext` (runeBuildOptim.ts) et
  `ArtifactDamageProfile` (damage.ts) en sont : ils vivent hors
  d'`OptimizerState`/`OptimizerRecipe` mais traversent les mêmes six
  emplacements, avec exactement le même risque.

**Le critère n'est donc PAS « ce champ est-il dans OptimizerState ? »** mais
**« combien d'endroits INDÉPENDANTS construisent cette valeur ? »**. Un seul
constructeur → le compilateur suffit. Plusieurs → cette checklist.

**Hors périmètre** : un changement purement interne au moteur qui ne traverse
rien (une variable locale, une constante de calage) — voir `algo-verify` pour
la correction algorithmique, `optimizer-perf-testing` pour la méthodologie de
mesure. Ce skill-ci ne couvre QUE la complétude de la PLOMBERIE (la valeur
arrive-t-elle partout où elle doit arriver), jamais la justesse de
l'algorithme lui-même.

## La checklist — code

Chaque champ touché doit être vérifié (grep du nom, ancien ET nouveau) dans
CHACUN de ces emplacements — cocher explicitement, pas seulement « ça
compile » :

- [ ] **`src/hooks/useOptimizerState.ts`** — le champ + son setter dans
      l'interface `OptimizerState`, la valeur initiale du `useState`, et le
      retour de la fonction.
- [ ] **`src/components/outils/OptimizerSection.tsx`** — destructuré depuis
      `optimizer`, lu dans le `useMemo`/`handleSearch` qui construit les
      `SearchParams` réels envoyés au moteur, câblé dans le JSX (toggle/
      segmented/champ), lu dans `exportRecipe` (construction de la
      recette), écrit dans `importRecipe` (avec repli `?? défaut` pour une
      recette exportée AVANT ce champ — voir « Compatibilité arrière »
      ci-dessous).
- [ ] **`src/lib/optimizerRecipe.ts`** — le champ dans l'interface
      `OptimizerRecipe` (commentaire de tête du fichier : RAPPEL explicite
      de la règle des deux constructeurs, à jour).
- [ ] **`scripts/lib/recipeToSearchParams.ts`** — `resolvePool`/
      `recipeToSearchParams` (ou toute autre fonction qui traduit une
      `OptimizerRecipe` en `SearchParams`) lit le champ EXACTEMENT comme
      l'écran.
- [ ] **`scripts/optimizer-search.ts`** — la ligne de résumé affichée en
      console (`console.log` en tête de script) mentionne le nouveau champ
      s'il change un comportement visible ; toute logique conditionnelle
      qui dépendait de l'ANCIEN champ (ex. avertissements, chargement
      conditionnel de données) est mise à jour, pas dupliquée à côté.
- [ ] **`scripts/lib/loadMonster.ts`** — UNIQUEMENT si le champ nécessite de
      charger une donnée qui n'était pas déjà chargée pour un autre usage
      (sinon, rien à faire ici).
- [ ] **`tests/`** — au moins un test couvre le nouveau comportement ; si un
      champ est renommé/inversé, vérifier qu'aucun test existant ne
      référence encore l'ancien nom (`grep` de l'ancien nom sur `tests/`
      APRÈS le renommage, pas seulement sur `src/`/`scripts/`).
      ⚠️ **Les tests CONSTRUISENT eux aussi ces valeurs** — ce ne sont pas
      de simples lecteurs. Un test qui fabrique un contexte à la main est un
      constructeur de plus, à traiter comme les autres.

## Ce que `tsc` attrape, et ce qu'il n'attrape toujours pas

⚠️ `tsconfig.json` couvre désormais
`["src", "scripts", "tests"]`, plus seulement `src`. `npx tsc --noEmit`
type-vérifie donc tout le dépôt.

**Ce qu'il attrape maintenant** — et qu'il laissait passer avant :
- un champ dont le **type change** (`number` → objet) ;
- un champ **obligatoire** ajouté à une interface, absent d'un littéral ;
- un import de type devenu faux, un nom de variante d'union périmé.

**Ce qu'il n'attrape TOUJOURS pas**, et qui reste la raison d'être de la
checklist :
- un champ **optionnel** jamais lu par un constructeur — accès parfaitement
  valide, divergence parfaitement silencieuse ;
- un champ lu mais **mal interprété** (bon type, mauvaise sémantique) ;
- une **documentation** qui ment.

Autrement dit : le compilateur couvre désormais la FORME, jamais l'INTENTION.
La checklist reste obligatoire, plus une vérification de comportement RÉEL
(voir « Vérification »).

## Compatibilité arrière (recettes déjà exportées)

Une recette `.json` déjà exportée par un joueur AVANT ce changement ne
porte PAS le nouveau champ (`undefined`). Deux cas :

- **Champ nouveau, sans équivalent avant** : repli sur un défaut sûr,
  `recipe.nouveauChamp ?? défaut` — déjà la convention établie
  (`exhaustiveSearch ?? false`, `excludedSelectors ?? []`).
- **Renommage/inversion d'un champ EXISTANT** : ne pas se contenter d'un
  défaut générique — traduire explicitement l'ANCIEN champ vers le
  nouveau, pour qu'une recette déjà exportée continue de se comporter
  EXACTEMENT pareil après réimport. Exemple (`exploreAll` booléen,
  cochée par défaut, portée uniquement box → `excludeUsedRunes` +
  `excludeUsedScope`, décochée par défaut, 3 périmètres) :
  ```ts
  const legacy = recipe as unknown as { exploreAll?: boolean };
  setExcludeUsedRunes(recipe.excludeUsedRunes ?? legacy.exploreAll === false);
  setExcludeUsedScope(recipe.excludeUsedScope ?? 'box'); // seul périmètre que l'ancien champ connaissait
  ```

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

## Vérification

Après avoir coché les deux checklists ci-dessus :

1. `npx tsc --noEmit`, `npm test`, `npm run build` — propres. ⚠️ `tsc` prouve
   désormais que la FORME est cohérente partout, `tests/` et `scripts/`
   compris (voir la section dédiée plus haut) ; il ne prouve toujours rien
   sur un champ **optionnel** oublié ni sur une valeur mal interprétée.
2. **Fumée sur un compte réel**, si le champ affecte `resolvePool`/le pool
   de runes envoyé au moteur : un script ad hoc (supprimé après usage)
   appelant `resolvePool`/`recipeToSearchParams` directement pour chaque
   valeur du champ, sur un export de compte réel (voir `tests/outils.ts`,
   `exportReel` pour les noms de fichiers disponibles) — pas besoin de
   lancer une recherche complète (`runSearchToCompletion`), le
   changement est en AMONT du moteur, voir le réflexe « bon étage du
   pipeline » d'`algo-verify`.
3. **Le script CLI réel** (`scripts/optimizer-search.ts`) lancé au moins une
   fois de bout en bout avec le nouveau champ activé, sur un compte réel —
   confirme que la ligne de résumé et le chemin complet (pas seulement les
   fonctions internes testées au point 2) fonctionnent.

## Voir aussi

- `algo-verify` — discipline de CORRECTION algorithmique (référence
  brute-force, test différentiel, benchmark) : à appliquer EN PLUS de ce
  skill-ci si le changement touche aussi la logique de recherche elle-même,
  pas seulement un champ de configuration qui la traverse.
- `optimizer-perf-testing` — méthodologie de MESURE (quel outil pour
  quelle question) : à appliquer si le changement peut affecter le TEMPS
  de recherche, pas seulement sa justesse ou sa plomberie.
