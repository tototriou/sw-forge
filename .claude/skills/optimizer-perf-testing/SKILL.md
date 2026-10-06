---
name: optimizer-perf-testing
description: Boîte à outils et pièges déjà rencontrés pour TESTER/MESURER un changement sur le moteur de recherche de runes (runeBuildOptim.ts, perf-battery.ts, perf-battery-compare.ts) — quel outil pour quelle question, et comment éviter de retomber dans des pièges déjà résolus (contention CPU/mémoire, git worktree, spawn sur Windows). Distinct d'algo-verify, qui couvre la CORRECTION de l'algorithme, pas la méthodologie de mesure.
---

# Tester le moteur de recherche de runes (SW Blacksmith)

Une phase de test sur ce moteur peut prendre plusieurs minutes à plusieurs
dizaines de minutes, répétée à chaque itération, et un même genre de piège
(contention, chemins gitignorés, spawn Windows) se redécouvre faute d'un
endroit où le retrouver vite. Ce skill est une RÉFÉRENCE, pas un récit ;
la méthode de comparaison des temps que suit le harnais est décrite dans
[spec/outils/optimizer/harnais.md § Séries de temps et comparaison](../../../spec/outils/optimizer/harnais.md).

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
- Avant de tester un mécanisme de COORDINATION EN DIRECT entre plusieurs
  workers/threads (pas seulement leur résultat final une fois chacun
  terminé) — quota partagé, arrêt anticipé signalé par un autre worker,
  tout protocole où le comportement d'un worker doit changer PENDANT son
  exécution en réponse à un événement venu d'ailleurs. Voir « Simulation
  séquentielle d'une COORDINATION EN DIRECT… » ci-dessous — piège distinct
  de la simple simulation séquentielle de workers indépendants.

## ⚠️ Le premier réflexe : le harnais, pas un script ad hoc

`scripts/diagnostic-harness.ts` (cœur dans `scripts/lib/diagnostic*.ts`)
orchestre les fonctions de production et observe ce qu'elles font. **Avant
d'écrire un script de diagnostic, vérifier qu'il ne répond pas déjà à la
question** — c'est presque toujours le cas pour « pourquoi ce cas donne-t-il
ça ? », « cette rune survit-elle, et à quel étage ? », « qu'est-ce que ce run
applique vraiment ? », « la recherche était-elle complète, et sinon
pourquoi ? ».

Ce qu'il apporte, et qu'un script ad hoc doit sinon refaire à la main —
c'est-à-dire rater :

- l'**origine** de chaque paramètre effectif, dont le `bucketCap` **DÉRIVÉ**
  de `slotFilterCap` (surcharger l'un déplace l'autre) ;
- le **marquage de fidélité** : un run surchargé annonce « DIVERGE DE LA
  PROD », et la marque voyage avec le résultat — un nombre collé dans une
  conversation ne peut plus se faire passer pour du comportement de prod ;
- le **régime** d'appariement choisi comme la production le choisirait
  (seuil contre `totalPairCount`), jamais un séquentiel implicite ;
- la **complétude** avec son motif (`maxMs`, `maxCollected`, ou
  `quotaTranche` en régime parallèle depuis degats-et-aura 6bis-b7) et
  l'autodiagnostic `explored` contre `totalPairs` ;
- la distinction **élagage sûr / rétention heuristique** — `filterSlot` est
  MIXTE, une disparition n'y est pas un verdict ;
- les temps **par phase** avec min / médiane / dispersion, et une mesure à
  une seule répétition marquée comme non comparative.

Écrire un script ad hoc reste légitime pour une question que le harnais ne
couvre pas (l'intérieur de `buildBuckets`, une charge concurrente, un
prototype d'algorithme) — dans ce cas, `algo-verify` s'applique
intégralement.

## La boîte à outils — quel outil pour quelle question

| Question posée | Outil | Coût typique |
|---|---|---|
| Ai-je cassé quelque chose d'évident, pendant que j'itère ? | `perf-battery.ts --quick` | ~20-30 s |
| La justesse tient-elle à TOUS les préréglages (bas/moyen/haut/extrême), pas seulement Moyen ? | `perf-battery.ts --monotonicity` | ~2-3 min (parallélisé) |
| Quel est l'impact RÉEL en temps d'un changement, comparé de façon fiable ? | `perf-battery-compare.ts <ref-ancien>` | quelques min par cas (dos-à-dos simultané) |
| Je veux figer une référence de temps suivie dans le temps (avant de committer un changement accepté) | `perf-battery.ts --save` | plusieurs minutes (7 cas séquentiels, exprès) |
| Une rune survit-elle à la préparation, et à quel étage disparaît-elle ? | `scripts/diagnostic-harness.ts --arret=filterslot --suivre=<id>` | ~2 s, même sur un compte réel |
| Qu'est-ce que ce run va RÉELLEMENT appliquer, avant de le lancer ? | `scripts/diagnostic-harness.ts --apercu` — configuration effective, ORIGINE de chaque paramètre, drapeau de fidélité, **rien n'est exécuté** | instantané |
| Un demi-build survit-il à la rétention, sans lancer l'appariement ? | `scripts/diagnostic-harness.ts --arret=demi-builds` (ou `prepareSearch` + `buildBuckets` SEUL si on a besoin des `HalfCombo` eux-mêmes) | quelques secondes, même à grande échelle |
| **Ce build de 6 runes est-il dans le résultat, et sinon QUI l'a perdu ?** | `scripts/diagnostic-harness.ts --suivre=<les 6 ids>` — **verdict structuré** cherchant le premier point de divergence (entrée inadmissible · moitié écartée · absent des compartiments · perdue à l'appariement AVEC l'étage · présent HORS top-N **avec son rang**, pris sur le classement ENTIER · non observable), rendu AVEC sa complétude. ⚠️ Ne jamais lire une absence sans elle : sur un run TRONQUÉ, « pas dans le classement » ≠ « le moteur ne la trouve pas » | le coût du run demandé — `--arret=filterslot` suffit pour l'admissibilité seule (~2 s) |
| **J'ai besoin d'un cas COURT et REPRODUCTIBLE pour comparer deux configurations** | `scripts/diagnostic-harness.ts --profils` puis `--profil=<nom>` — profils de pool synthétique NOMMÉS, chacun portant son BUILD CIBLE et ses grandeurs MESURÉES (complétude + motif, régime, `totalPairs`, rang + population), relues par `tests/diagnostic-profils.test.ts`. ⚠️ **Ce ne sont pas « des cas réels en plus rapide »** : un cas réel tronque par le TEMPS, ce qui rend NON_COMPARABLES le verdict, la population et le classement — la vitesse n'est pas le critère, la NATURE de la troncature l'est. ⚠️ Et un profil COMPLET peut être totalement INSENSIBLE à la configuration : lire son champ `axesSensibles` (les axes sur lesquels une divergence a été MESURÉE) et son champ `limites` AVANT de conclure « aucune divergence », et ne jamais prendre la rétention affichée pour un indicateur de sensibilité (le produit brut est un MAJORANT) | 0,13 s à 1,5 s |
| **Ce paramètre change-t-il quelque chose ? (deux CONFIGURATIONS du même code)** | `scripts/diagnostic-harness.ts --profil=<nom> --differentiel=<axe>:<témoin>,<comparé> [--repetitions=<n>]` — deux bras ENTRELACÉS (T1 C1 T2 C2…), sept éléments d'oracle lus dans l'ordre du pipeline, et le PREMIER point de divergence nommé avec ses quatre champs (OÙ · COMBIEN · SUR COMBIEN · CE QUE ÇA AUTORISE). ⚠️ **À ne pas confondre avec `perf-battery-compare`**, qui compare deux VERSIONS DU CODE via `git worktree` : celui-ci compare deux CONFIGURATIONS du même code, et c'est un problème distinct. ⚠️ **Il REFUSE plus souvent qu'il ne conclut, et c'est sa valeur** : un motif de troncature différent ferme le PORTIER, un préfixe exploré différent rend `NON_COMPARABLE` le verdict, la population, le classement et le near-miss — des valeurs ÉGALES sur des préfixes différents ne prouvent rien. ⚠️ Il exige un PROFIL (un cas réel tronque par le TEMPS, donc son oracle n'est comparable sur rien) et il **diffe les paramètres EFFECTIFS**, pas seulement l'axe demandé : surcharger `slotFilterCap` déplace AUSSI `bucketCap`, donc fait varier deux paramètres | 2N × le coût du profil (0,3 s à 9 s) |
| **Cette version converge-t-elle plus TÔT ? (en travail, pas en temps)** | `scripts/diagnostic-harness.ts … --suivre=<les 6 ids>` — rend `decouverteBuildCible` : l'**INSTANT DE DÉCOUVERTE** (`explored` à la première apparition de la cible) et la **COURBE DE RENDEMENT** (candidats cumulés à 1/5/10/25/50/75/100 % de l'espace). ⚠️ **À ne JAMAIS confondre avec le RANG**, qui vient de `sortCandidates` et décrit un état FINAL : les deux sont indépendants — sur `complet-sensible` la cible est découverte à 0,022 % de l'espace et sort #1424. ⚠️ C'est un COMPTE de paires, donc insensible à la dérive machine et à la contention, contrairement à tout `foundMs` — c'est ce qui le rend utilisable là où `perf-battery-compare` ne l'est pas. ⚠️ **MAJORANT, jamais la paire exacte** (points de passage tous les 500 paires), et **NON REPRODUCTIBLE en régime PARALLÈLE** (relevé temporel, `explored` sommé sur les workers) : ne comparer deux configurations dessus qu'en séquentiel. Un jalon jamais atteint s'affiche « — », jamais la dernière valeur connue | le coût du run demandé |
| **Quelle stat DIFFÉRENCIE vraiment les demi-builds ? (piste B, « prioriser les stats les plus difficiles »)** | `scripts/diagnostic-harness.ts …` — rend `dispersionTranches` : le **CV par `retentionKey`** et la répartition du budget de rétention qu'il produit, par moitié. ⚠️ **C'est LE nombre du moteur**, lu par `trancheReallocation` que `buildBuckets` appelle lui-même — jamais une reconstitution. Un CV recalculé sur les demi-builds RETENUS, principale COMPRISE, n'en est PAS une approximation : c'est un autre nombre, qui ne pilote rien (l'exclusion de la principale est délibérée — une principale garantie noie la vraie dispersion et fait passer une stat TENDUE pour MOLLE). ⚠️ Rendu MÊME quand `adaptiveTrancheWeighting` est inactif, parce que le CV est une propriété du POOL et pas du réglage — mais `applique` dit alors NON : c'est ce que la réallocation FERAIT, pas ce qu'elle a fait | le coût d'un `--arret=demi-builds` |
| Un changement de PARALLÉLISATION de l'appariement perd-il des candidats (pas une question de temps) ? | `tests/rune-optim-parallel-pairing.test.ts` — différentiel à `maxMs` RÉALISTE (30 s, jamais un budget court juste assez long pour déclencher le chemin de code, voir `algo-verify` méthode point 2) | quelques secondes à quelques minutes selon le nombre de scénarios |
| Une charge concurrente sur le fil PRINCIPAL (optimisation d'artéfacts au fil de l'eau) ralentit-elle la recherche ? | `scripts/artifact-contention-diag.ts` — vrais `worker_threads` pour l'appariement, répétitions ENTRELACÉES, charge témoin en calcul pur pour séparer cœurs et mémoire | quelques minutes par cas (N répétitions × 3 conditions) |
| Un mécanisme de COORDINATION EN DIRECT entre workers (quota partagé, arrêt anticipé signalé…) respecte-t-il sa garantie sous une VRAIE latence de messages ? | ⚠️ JAMAIS une simulation séquentielle (voir piège dédié plus bas) — de VRAIS `worker_threads` Node concurrents, bundlés via esbuild : `scripts/lib/pairing-quota-worker.ts` + `scripts/parallel-pairing-real-diag.ts` (patron réutilisable, déjà utilisé pour la décision initiale de paralléliser l'appariement via `scripts/lib/pairing-worker.ts`/`scripts/pairing-parallel-diag.ts`) | quelques secondes par cas (bundling + spawn réel) |
| L'appariement PARALLÈLE de production donne-t-il le même résultat qu'un changement le laisse croire ? | `scripts/parallel-pairing-extraction-diff.ts` — de VRAIS `worker_threads` exécutant le **code de production lui-même** (`runPairSlice` + `driveParallelPairing`, partagés avec le navigateur), comparés au chemin séquentiel sur les 7 cas connus | quelques minutes par cas (budget INFINI des deux côtés) |

⚠️ **Trois façons de faire tourner l'appariement parallèle en Node, à ne pas
confondre** — elles n'ont ni la même fidélité ni le même usage :

| Fichier | Ce que c'est | Quand s'en servir |
|---|---|---|
| `scripts/lib/pair-slice-worker.ts` | ✅ **Le code de PRODUCTION**, coquille Node du même `runPairSlice` que le navigateur (voir [spec/outils/optimizer/moteur/parallelisation.md § Coquilles et lanceurs](../../../spec/outils/optimizer/moteur/parallelisation.md)) | Dès qu'on veut mesurer ou vérifier ce que la prod fait vraiment |
| `scripts/lib/pairing-quota-worker.ts` | Une REPRODUCTION fidèle du mécanisme, plus un mode `shared` **qui n'est pas en production** (prototype du quota partagé, écarté) | Uniquement pour explorer la question du quota partagé |
| `scripts/lib/pairing-worker.ts` | Un PROTOTYPE de mesure de débit brut — **budget figé, aucune escalade**, son en-tête le dit | Rien de fidèle : ne jamais en tirer une conclusion sur la prod |

⚠️ **`--quick` n'est PAS une preuve de justesse.** Ses 2 cas canari (voir
`scripts/perf-battery.ts`) sont les plus LÉGERS de la batterie — ils ne
peuvent rien détecter d'un bug de rétention comme `BUCKET_CAP`, qui
n'apparaît qu'au volume. C'est un test de fumée pour l'itération, jamais un
remplaçant de `--monotonicity` ni de la batterie complète avant de committer.

## Avant de mesurer : le coût est-il SUBI, ou choisi par l'implémentation ?

⚠️ **Mesurer une implémentation naïve qu'on n'a pas l'intention de livrer ne
répond à aucune question utile.** Avant de lancer quoi que ce soit, se
demander si le coût redouté est intrinsèque au changement, ou seulement à la
première façon de l'écrire.

**Exemple** (artéfacts, lignes 222/223 « Dgts CRIT selon les PV de la
cible ») : ces lignes rendent les Dgts CRIT dépendants des PV de la cible,
qui baissent pendant le sort, ce qui semble imposer de RECALCULER
`horsCoup` à chaque coup. Or `cr`, `cd` et `partCrit` sont tous
calculés une seule fois — seul `pvPct` varie. Le terme est donc **affine** en
`pvPct` :

```
horsCoup(pvPct) = horsCoup_base + partCrit × [a·pvPct + b·(1−pvPct)] × K
```

`K` (mitigation × réductions × facteurs) étant constant, il n'y a **rien à
recalculer** : deux constantes précalculées, puis deux multiplications-
additions par coup. Mesurer le recalcul chiffrerait le coût d'un code qui
n'a pas à exister.

**Règle** : quand un changement semble imposer de refaire un calcul dans une
boucle chaude, chercher d'abord la **décomposition** (quelle partie est
réellement variable ?) avant de chercher le chiffre. Le vrai coût résiduel —
ici forcer le chemin séquentiel là où le chemin court suffisait — est
souvent tout autre, et c'est LUI qu'il faut mesurer, une fois le code écrit.

## Le réflexe qui économise le plus de temps

**Vérifier au bon ÉTAGE du pipeline, pas systématiquement de bout en
bout** — voir `algo-verify`, méthode point 6. `buildBuckets` seul répond en
secondes à « ce demi-build survit-il à la rétention ? », contre plusieurs
minutes pour la même question posée via une recherche complète. Avant de relancer un pipeline complet, se demander
quelle phase le changement touche réellement.

⚠️ C'est exactement ce qu'expose `--arret=` du harnais (`mainstat`,
`dominance`, `feasibility`, `filterslot`, `demi-builds`, `appariement`,
`classement`) : le point d'arrêt devient un argument au lieu d'un script
à écrire. ⚠️ S'arrêter à un étage de PRÉPARATION n'interrompt pas
`prepareSearch` en son milieu — les quatre étages s'exécutent d'un bloc
(~2 s au total) ; ce qui est évité, c'est la construction des demi-builds
et l'appariement, où est le vrai coût.

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
   sans droits admin/Mode développeur). Repli
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
CHAQUE appel, jamais le partager entre « workers » simulés, parce que
`overBudget()` compare `Date.now()` à `prepared.startedAt`, figé à la
construction : un `prepared` unique fermé sur toutes les slices fait passer
les slices traitées plus tard pour déjà hors budget — des pertes énormes et
fausses qui ressemblent EXACTEMENT à un vrai bug de parallélisation.
Chaque vrai Worker de prod
appelle `prepareSearch` indépendamment ; un test qui simule cette
indépendance doit faire pareil.

### Simulation séquentielle d'une COORDINATION EN DIRECT entre workers — invalide, jamais juste « moins précise »

⚠️ **Distinct du piège précédent** (qui porte sur l'état FRAIS de chaque
worker simulé, un problème de CORRECTION des données). Celui-ci porte sur
le TEMPS lui-même : une simulation séquentielle (round-robin, un pas de
générateur à la fois dans un seul thread) a une latence de coordination
**quasi nulle** entre « vérifier un total cumulé » et « réagir » — rien à
voir avec un vrai `postMessage` entre threads/Workers concurrents, qui
passe par la boucle d'événements et arrive avec un délai réel, non nul.

Exemple de défaillance que seule la vraie latence révèle : chaque worker
rapporte sa progression, le parent lui envoie `'stop'` une fois le total
cumulé global atteint ; le worker le plus productif peut atteindre son
propre plafond individuel AVANT que le signal `'stop'` lui parvienne, et
le plafond global est dépassé. La simulation séquentielle, à latence
nulle, ne peut PAS révéler ce mode de défaillance.

**Règle de décision, à appliquer AVANT d'écrire un test/script de
mesure** : la CORRECTION du mécanisme testé dépend-elle du TIMING/de la
latence entre acteurs concurrents (un worker doit réagir PENDANT son
exécution à un événement déclenché ailleurs) ? Ou dépend-elle seulement
d'un partitionnement/allocation décidé UNE FOIS, À L'AVANCE, avant que
les workers ne démarrent (chacun reçoit son quota fixe dès le départ,
aucun message ne doit changer son comportement en cours de route) ?
- **Allocation figée à l'avance** (ex. le mécanisme ACTUEL de prod :
  `perWorkerMaxCollected` calculé une fois, donné à chaque worker au
  démarrage, aucune coordination en cours d'exécution) : une simulation
  séquentielle reste un verdict de justesse VALIDE.
- **Coordination EN DIRECT** (ex. tout prototype de quota PARTAGÉ, arrêt
  anticipé signalé, ou plus généralement tout protocole où un worker doit
  RECEVOIR un message pendant qu'il tourne pour changer de comportement) :
  la simulation séquentielle est **invalide par construction**, pas juste
  « moins précise » — sa latence nulle masque exactement la classe de
  défaillance (dépassement, coupure prématurée d'un worker plus lent) que
  la vraie latence de messages introduit. Utiliser de VRAIS
  `worker_threads`/Web Workers, sans exception, dès que la question posée
  porte sur la coordination elle-même.

**Portée** : à vérifier au cas par cas avant de faire
confiance à une mesure PASSÉE, jamais présumer un verdict global. Les
autres mécanismes « parallèles » de ce dépôt mesurés par simulation
séquentielle jusqu'ici (construction des 2 moitiés en Workers,
`--monotonicity`) sont des ALLOCATIONS FIGÉES à l'avance (aucun message
ne change leur comportement en cours de route) — la règle ci-dessus les
classe du côté valide, pas suspect.
Le quota partagé écarté pour cette raison :
[spec/outils/optimizer/moteur/parallelisation.md § Répartition et partage du plafond](../../../spec/outils/optimizer/moteur/parallelisation.md).

### `candidats.push(...tableauEnorme)` — limite d'arguments V8

`Array.prototype.push(...bigArray)` lève `RangeError: Maximum call stack
size exceeded` au-delà d'environ 65 536 éléments (limite V8 sur le nombre
d'arguments d'un appel de fonction) — atteint facilement dans un test
différentiel avec un `maxCollected` large sur une recherche peu contrainte.
Contre-mesure : accumuler dans un `Set`/tableau via une boucle
élément-par-élément (`for (const c of nouveauxCandidats) déjà.add(c)`),
jamais un spread sur un tableau dont la taille n'est pas bornée
explicitement.

### Protocole en BLOCS — un biais qui se REPRODUIT, donc qui passe pour un signal

⚠️ **Un protocole biaisé produit des conclusions fausses sur des données
justes** : c'est le protocole qui est en cause, pas les données.

**Le protocole fautif**, qui paraît pourtant rigoureux :

```
échauffement → témoin → essai CHARGÉ → témoin (après)
```

Le second témoin est censé attraper une dérive de la machine. Il n'attrape
qu'une dérive **LENTE** : une perturbation transitoire tombée pendant l'essai
chargé passe entière dans le résultat, et les deux témoins la ratent
complètement : un faible écart entre témoins ne garantit pas un signal net.

⚠️⚠️ **ET LE BIAIS SE REPRODUIT.** L'essai chargé occupe TOUJOURS la même
position dans la séquence : tout effet lié à cette position (échauffement
thermique, état du GC, montée en fréquence) revient identique à chaque
exécution.

**C'est la leçon principale : une lecture répétée sous un protocole biaisé
n'est PAS une reproductibilité.** Elle en a l'apparence exacte, et elle est
d'autant plus convaincante qu'on la retrouve. Répéter ne corrige que le bruit
ALÉATOIRE, jamais un biais systématique.

**La contre-mesure — entrelacer, pas grouper :**

```
témoin, A, B, témoin, A, B, témoin, A, B…    (N fois)
```

Une perturbation frappe alors une répétition de CHAQUE condition, pas une
condition entière.

**Et les bons estimateurs :**

- Le **MINIMUM** sur N répétitions est l'estimateur le plus propre du coût
  réel : une interférence ne peut qu'AJOUTER du temps, jamais en retirer.
- La **médiane** à côté, pour voir si la série est stable ou dispersée.
- La **DISPERSION** de chaque série AFFICHÉE — c'est elle qui dit si l'écart
  mesuré veut dire quelque chose. Sur les cas artéfacts, le plancher de bruit
  valait 2 à 4,5 % : tout écart en dessous ne signifie rien, et il faut le
  montrer plutôt que le laisser deviner.

⚠️ Corollaire : **ne jamais conclure sur un écart plus petit que la dispersion
observée**. Un essai chargé « plus rapide que le témoin » n'est
pas un résultat, c'est la preuve qu'on mesure sous le plancher.

Exemple complet : `scripts/artifact-contention-diag.ts`.

### Une charge de test peut s'EFFONDRER sans rien dire

⚠️ Distinct de la fidélité de l'ALGORITHME (voir `algo-verify`) : ici c'est la
**charge** opposée au système mesuré qui diverge de la production.

Exemple : une charge qui rejoue `chercherPaires` pendant que l'appariement
tourne, avec un évaluateur qui somme les stats, ne lit **aucune
sous-propriété d'artéfact**. Cascade : `analyserPertinence` ne trouve aucune
ligne croissante → la dominance ne compare plus que les trois stats
principales → l'inventaire s'effondre à une poignée de candidats par côté →
la « charge » ne coûte presque plus rien.

La mesure annonce alors « aucun ralentissement » — vrai, et totalement
dénué de sens : il n'y a **aucune charge**. Seul un compteur la trahit, et
seulement s'il figure dans la sortie.

**Contre-mesure : faire dire au script sa PROPRE fidélité, avant de mesurer.**

```
Charge par build : 86 ms sur 12 315 paires parcourues.
(attendu ~75-85 ms sur ~12 000 paires — bien moins signale une charge effondrée)
```

Deux nombres, affichés AVANT les résultats, avec leur fourchette attendue. Une
charge effondrée se voit alors à la première ligne au lieu de se déduire après
coup. ⚠️ La fourchette doit venir d'une mesure INDÉPENDANTE et citer le bon
régime : un repère pris sur l'espace NON élagué est faux, la
production élaguant aussi.

⚠️ Et pour une charge de calcul pur : accumuler le résultat dans un puits que
le programme lit ensuite. Une boucle dont le résultat ne sert à rien peut être
supprimée entièrement par le JIT — on mesurerait de nouveau l'absence de
charge.

## Voir aussi

- `algo-verify` — discipline de CORRECTION algorithmique (référence
  brute-force, test différentiel, benchmark avant de figer une constante) ;
  point 6 de sa méthode couvre le réflexe « bon étage du pipeline » plus en
  détail, et sa section « Fidélité des scripts diagnostics » couvre le
  risque qu'un script qui appelle les internes du moteur diverge du vrai
  chemin de production.
- `spec/outils/optimizer/README.md` — routage par tâche vers les specs de
  l'Optimizer (vérification, harnais, parallélisation), et
  `spec/outils/optimizer/pistes.md` (les pistes futures, à lire avant toute
  idée « nouvelle »).
