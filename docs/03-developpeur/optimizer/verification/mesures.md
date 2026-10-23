# Vérification — Mesures et compte réel

Voir aussi : [index](README.md).

## Benchmarks

Hors `npm test`, lancés à la demande : ils mesurent et ne vérifient rien,
sans assertion. Leurs chiffres ne sont pas recopiés ici : on relance le
script sur la machine du moment, en suivant le skill
`optimizer-perf-testing`.

- `npm run benchmark:optim` (`scripts/benchmark-optim.ts`) : pools
  synthétiques de 500 à 5000 runes au total, quatre scénarios de sets et de
  minimums, plusieurs réglages ; il calibre les constantes du moteur à des
  tailles proches des comptes réels, comme l'exige `algo-verify`.
- `npm run benchmark:search-budget` (`scripts/benchmark-search-budget.ts`) :
  `bucketCap` et `slotFilterCap` fixés aux valeurs de production, seul
  `maxCollected` varie ; par palier, le meilleur score, les candidats, les
  paires et le temps. Il répond à « que gagne-t-on à collecter plus ? »
  avant de toucher `MAX_COLLECTED`.
- `npm run benchmark:bucket-retention`
  (`scripts/benchmark-bucket-retention.ts`) : seul `bucketCap` varie, pour
  voir si la rétention par compartiment perd de bons candidats.
- `scripts/perf-battery.ts` : les cas connus en temps et en builds trouvés,
  `--save` pour figer la référence `scripts/perf-baseline.json`. Ne pas
  paralléliser ses mesures de temps : la contention entre processus
  fausserait ce qu'elles mesurent. `--monotonicity`, qui ne compare aucun
  temps, tourne sur des `worker_threads` (`scripts/lib/monotonicity-worker.ts`).
  Il construit les moitiés typées et apparie par le lanceur compact de
  l'écran (`apparierNode` → `lancerAppariement`), avec son régime, sa
  distribution et ses crédits. La découverte lit les ids à chaque point
  de passage séquentiel ou publication parallèle ; c'est un majorant,
  dépendant de l'arrivée des morceaux en parallèle. Une référence de temps
  prise sous un autre régime ne permet pas une comparaison de débit.
- `scripts/banc-appariement-rapide.ts` et
  `scripts/banc-construction-moities.ts` : le chemin de production de
  l'appariement et de la construction contre `pairBuckets` et
  `buildBuckets`, sur les cas connus et sur une recette et un export, avec
  le différentiel et des temps indicatifs par phase.
- `scripts/pairing-parallel-diag.ts` : le seuil de déclenchement et le
  nombre de workers, mesurés aux volumes réels pour l'appariement par
  `pairBuckets` réparti en tranches statiques — la référence, pas la
  production.

Il n'existe pas de budget de paires : la recherche n'est bornée que par le
plafond de candidats collectés (`MAX_COLLECTED`, surchargeable par
`SearchParams.maxCollected`), par le temps (`maxMs`) et par la taille exacte
de l'espace (`totalPairCount`) (`src/lib/runeBuildOptim.ts:1198-1221`). Un
en-tête de script qui cite `DEFAULT_MAX_NODES` décrit un budget supprimé.
Le plafond de collecte privilégie la qualité du résultat sur la vitesse ;
au préréglage le plus large, c'est la construction des compartiments, un
coût fixe de `slotFilterCap`, qui domine le temps, pas `maxCollected`
(`:1174-1189`).

## Validation grandeur nature

Les scripts `scripts/monster-*.ts` rejouent le moteur sur un compte réel,
pour des ordres de grandeur qu'un pool synthétique ne reproduit pas. Rien
n'y est écrit en dur : ils prennent en argument un export de compte et le
monstre, et pour la plupart le deck d'offense de siège qui le porte. Le
principe : retrouver le runage réel d'un monstre déjà runé, à partir de ses
propres stats comme critères.

- `scripts/monster-search-cap-sweep.ts` balaie `slotFilterCap` pour trouver
  à partir de quel pré-filtrage le runage réel est retrouvé ; il a servi à
  calibrer `BUCKET_CAP`.
- `scripts/monster-search-validate.ts` ne donne qu'un sous-ensemble des
  stats en critère, comme un joueur à l'écran, au préréglage « Moyen » par
  défaut.
- `scripts/monster-search-benchmark.ts` compare plusieurs stratégies de
  recherche sur ce même but.
- `scripts/monster-search-rank-diag.ts` donne le rang du demi-build réel
  dans son compartiment, pour chaque tranche de rétention.
- `scripts/monster-search-multicount-diag.ts` étudie un cas où élargir le
  pré-filtrage trouve moins de builds.
- `scripts/monster-build-lookup.ts` affiche l'équipement et les stats
  calculées d'un monstre, à comparer au jeu.

Sur un compte de plusieurs milliers de runes, le moteur a retrouvé
exactement le runage d'un monstre existant ; le préréglage « Extrême »
(300) est la valeur qui l'a permis sur un très gros compte
(`src/lib/runeBuildOptim.ts:624-627`). Un export de compte ne se commite
pas : le `pre-commit` refuse un fichier de plus de 5 Mo.
