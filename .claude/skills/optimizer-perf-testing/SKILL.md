---
name: optimizer-perf-testing
description: Boîte à outils et pièges déjà rencontrés pour TESTER/MESURER un changement sur le moteur de recherche de runes (runeBuildOptim.ts, perf-battery.ts, perf-battery-compare.ts) — quel outil pour quelle question, et comment éviter de retomber dans des pièges déjà résolus (contention CPU/mémoire, git worktree, spawn sur Windows). Distinct d'algo-verify, qui couvre la CORRECTION de l'algorithme, pas la méthodologie de mesure.
---

# Tester le moteur de recherche de runes (SW Forge)

Née d'une investigation où chaque phase de test prenait plusieurs minutes à
plusieurs dizaines de minutes, répétée à chaque itération — et où le même
genre de piège (contention, chemins gitignorés, spawn Windows) a failli être
re-découvert plusieurs fois faute d'un endroit où le retrouver vite. Ce
skill est une RÉFÉRENCE, pas un récit : pour l'historique complet de chaque
décision, voir
`spec/outils/optimizer/historique-acceleration-et-outillage.md` (sections
« Suite — mode --quick et parallélisation… », « Suite —
perf-battery-compare.ts… », « leçons retenues sur la méthodologie de
mesure »).

⚠️ **Ne remplace PAS `algo-verify`** (`.claude/skills/algo-verify/SKILL.md`)
— celui-ci reste la discipline à suivre pour la CORRECTION d'un algorithme
combinatoire (référence brute-force, test différentiel, benchmark avant de
figer une constante). Ce skill-ci répond à une question différente : une
fois qu'on sait CE qu'il faut vérifier, QUEL outil utiliser pour le
vérifier vite et sans se faire piéger par la mécanique de mesure elle-même.

## Quand ce skill s'applique

- Avant de tester un changement dans `src/lib/runeBuildOptim.ts` ou ses
  Workers (`src/workers/runeBuildOptim.worker.ts`, et
  `src/workers/pairSlice.worker.ts` pour l'appariement parallélisé).
- Avant de lancer ou d'écrire un script qui mesure un temps ou une justesse
  sur ce moteur (`scripts/perf-battery.ts`, `scripts/perf-battery-compare.ts`,
  ou un script ad hoc similaire).
- Dès qu'une vérification menace de prendre « plusieurs minutes » — c'est le
  signal qu'un outil plus ciblé de la liste ci-dessous existe probablement.

## La boîte à outils — quel outil pour quelle question

| Question posée | Outil | Coût typique |
|---|---|---|
| Ai-je cassé quelque chose d'évident, pendant que j'itère ? | `perf-battery.ts --quick` | ~20-30 s |
| La justesse tient-elle à TOUS les préréglages (bas/moyen/haut/extrême), pas seulement Moyen ? | `perf-battery.ts --monotonicity` | ~2-3 min (parallélisé) |
| Quel est l'impact RÉEL en temps d'un changement, comparé de façon fiable ? | `perf-battery-compare.ts <ref-ancien>` | quelques min par cas (dos-à-dos simultané) |
| Je veux figer une référence de temps suivie dans le temps (avant de committer un changement accepté) | `perf-battery.ts --save` | plusieurs minutes (7 cas séquentiels, exprès) |
| Un demi-build/une rune survit-il à la rétention, sans lancer une recherche complète ? | `prepareSearch` + `buildBuckets` SEUL (jamais `pairBuckets`) | quelques secondes, même à grande échelle |
| Un changement de PARALLÉLISATION de l'appariement perd-il des candidats (pas une question de temps) ? | `tests/rune-optim-parallel-pairing.test.ts` — différentiel à `maxMs` RÉALISTE (30 s, jamais un budget court juste assez long pour déclencher le chemin de code, voir `algo-verify` méthode point 2) | quelques secondes à quelques minutes selon le nombre de scénarios |

⚠️ **`--quick` n'est PAS une preuve de justesse.** Ses 2 cas canari (voir
`scripts/perf-battery.ts`) sont les plus LÉGERS de la batterie — ils
n'auraient rien pu détecter du bug `BUCKET_CAP` qui a motivé toute cette
investigation. C'est un test de fumée pour l'itération, jamais un
remplaçant de `--monotonicity` ni de la batterie complète avant de committer.

## Le réflexe qui économise le plus de temps

**Vérifier au bon ÉTAGE du pipeline, pas systématiquement de bout en
bout** — voir `algo-verify`, méthode point 6. `buildBuckets` seul répond en
secondes à « ce demi-build survit-il à la rétention ? », contre plusieurs
minutes (avec l'escalade de budget) pour la même question posée via une
recherche complète. Avant de relancer un pipeline complet, se demander
quelle phase le changement touche réellement.

## Pièges déjà rencontrés, avec leurs contre-mesures

### Contention CPU/mémoire — pas la même règle pour la justesse et le temps

Plusieurs processus/threads concurrents sur la même machine se disputent
les mêmes cœurs (changement de contexte, cache CPU écrasé à chaque bascule)
et la même bande passante mémoire (pression GC accrue dans CHAQUE
processus). Deux régimes, pas un seul :

- **Mesure de TEMPS comparée à une référence** (baseline JSON, dos-à-dos) :
  la contention FAUSSE directement ce qu'on mesure — jamais paralléliser.
  La boucle principale de `perf-battery.ts` (hors `--quick`/
  `--monotonicity`) reste séquentielle exprès, `--save` ou non — `--save`
  ne fait qu'ajouter l'écriture de la baseline à la fin, il ne change rien
  à l'exécution elle-même ; chaîner plusieurs mesures dans un seul
  processus long fait dériver le résultat d'un facteur ×10 à ×27 (mesuré).
- **Verdict de justesse seul** (trouvé/perdu, pas de temps comparé) : la
  contention ne corrompt PAS ce signal. `--monotonicity` parallélise ses 7
  cas sans risque pour cette raison précise.

### `git worktree` pour comparer deux versions du code SIMULTANÉMENT

Un même chemin sur disque ne peut pas être dans deux états à la fois pour
deux processus qui tournent en même temps — éditer-relancer-rééditer un
fichier marche pour deux mesures SÉQUENTIELLES, jamais pour une comparaison
simultanée. Il faut deux répertoires distincts (voir
`scripts/perf-battery-compare.ts`).

1. **`node_modules` et les comptes réels sont ABSENTS d'un nouveau
   worktree** (gitignorés, git ne checkout que les fichiers SUIVIS).
   Contre-mesure : liés EXPLICITEMENT, un par un, jamais par motif global —
   `node_modules` (jonction, `symlinkSync(..., 'junction')` — n'exige PAS
   de privilège élevé sur Windows, contrairement à un symlink de dossier),
   les comptes réels par leur nom exact (`tototriou-12889591.json`,
   `ß☆Enzo-6399149.json` — liste `ACCOUNT_FILES` dans
   `perf-battery-compare.ts`, ⚠️ PAS `tests/outils.ts`/`exportReel`, qui ne
   connaît QUE `tototriou-12889591.json`).
2. **Lier en BLOC par motif peut écraser un fichier SUIVI par git** dans le
   worktree (ex. `tsconfig.json`/`package.json` remplacés par la version de
   la branche courante au lieu du commit visé). Contre-mesure : jamais de
   glob — vérifier `git -C <worktree> ls-files --error-unmatch <fichier>`
   AVANT de lier (exit 0 = suivi = refuser et prévenir, jamais écraser).
3. **Symlink de FICHIER refusé par Windows sans privilège élevé** (`EPERM`
   sans droits admin/Mode développeur — rencontré directement). Repli
   automatique sur un lien PHYSIQUE (`fs.linkSync`, même volume — toujours
   le cas sous le même profil utilisateur), qui fonctionne pour un usage en
   LECTURE SEULE sans élévation.
4. **Nettoyage** : retirer chaque lien EXPLICITEMENT (`unlinkSync` — retire
   le lien lui-même, ne suit JAMAIS la cible) AVANT `git worktree remove
   --force`, dans un bloc `finally` — un `rm -rf` naïf sur un dossier
   contenant un lien vers `node_modules` pourrait suivre le lien et
   supprimer l'ORIGINAL selon l'outil.

### `spawn` d'un exécutable Windows (`.cmd`) depuis un script

`npx` est un script `.cmd` sur Windows — `spawn('npx', args)` échoue
directement (`EINVAL`) sans passer par un shell. Mais `spawn(cmd, args,
{shell: true})` avec un TABLEAU d'arguments déclenche un avertissement de
dépréciation Node (`DEP0190` : concaténation sans échappement, risque
d'injection si un argument venait d'une source non fiable). Contre-mesure :
une seule CHAÎNE de commande déjà assemblée (jamais un tableau `args`
séparé) passée à `spawn` avec `shell: true` — sûr tant que chaque morceau
de cette chaîne est un littéral fixe ou une valeur déjà validée (un index
numérique, jamais une entrée utilisateur brute).

### Simuler N workers SÉQUENTIELLEMENT dans un test : état FRAIS à chaque itération

Un test qui simule plusieurs workers indépendants en les appelant l'un après
l'autre dans le même thread (au lieu de vrais `worker_threads`/Web Workers)
doit reconstruire son état de préparation (`prepareSearch(params)`) À
CHAQUE appel, jamais le partager entre « workers » simulés. Vécu en
construisant `tests/rune-optim-parallel-pairing.test.ts` : un `prepared0`
unique fermé sur toutes les slices faisait que `overBudget()` (qui compare
`Date.now()` à `prepared.startedAt`, figé à la construction) considérait les
slices traitées plus tard comme déjà hors budget — pertes énormes et
fausses (jusqu'à -565 candidats sur un scénario) qui ressemblaient
EXACTEMENT à un vrai bug de parallélisation. Chaque vrai Worker de prod
appelle `prepareSearch` indépendamment ; un test qui simule cette
indépendance doit faire pareil.

### `candidats.push(...tableauEnorme)` — limite d'arguments V8

`Array.prototype.push(...bigArray)` lève `RangeError: Maximum call stack
size exceeded` au-delà d'environ 65 536 éléments (limite V8 sur le nombre
d'arguments d'un appel de fonction) — atteint facilement dans un test
différentiel avec un `maxCollected` large sur une recherche peu contrainte.
Contre-mesure : accumuler dans un `Set`/tableau via une boucle
élément-par-élément (`for (const c of nouveauxCandidats) déjà.add(c)`),
jamais un spread sur un tableau dont la taille n'est pas bornée
explicitement.

## Voir aussi

- `algo-verify` — discipline de CORRECTION algorithmique (référence
  brute-force, test différentiel, benchmark avant de figer une constante) ;
  point 6 de sa méthode couvre le réflexe « bon étage du pipeline » plus en
  détail, et sa section « Fidélité des scripts diagnostics » couvre le
  risque qu'un script qui appelle les internes du moteur diverge du vrai
  chemin de production.
- `spec/outils/optimizer/README.md` — index de la section, avec les
  fichiers `historique-*.md` (l'historique complet, chronologique, de
  chaque décision résumée ici) et `spec/outils/optimizer-pistes.md` (état
  des lieux des pistes sans relire l'historique).
