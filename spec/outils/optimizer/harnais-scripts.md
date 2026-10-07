# Harnais de diagnostic — cas connus et scripts voisins

**Statut :** ÉTAT ACTUEL — le harnais de diagnostic lancé sur les cas réels connus (`--cas`), et les scripts de diagnostic qui restent à côté de lui : ce que chacun produit seul, ce que le harnais en couvre, et comment décider d'en garder ou d'en retirer un, avec le code qui porte chaque garantie
**Lire si :** on lance le harnais sur plusieurs cas réels, on lit la sortie d'un script `-diag` ou `optimum-*`, ou on s'apprête à en écrire, en garder ou en supprimer un
**Ne pas lire si :** on cherche le mode d'emploi du harnais sur un cas : harnais.md
**Voir aussi :** harnais.md, harnais-extensions.md, verification.md

[harnais.md](harnais.md) décrit un run du harnais,
[harnais-extensions.md](harnais-extensions.md) ses instruments et son
différentiel. Ce fichier dit comment le faire tourner sur les cas réels
connus, et ce qui reste aux scripts de diagnostic de `scripts/`. Le code
porte chaque garantie (`fichier:lignes`).

## Le lot sur les cas connus

`--cas=<index|nom|tous>` fait tourner le harnais, l'un après l'autre, sur des
cas réels de `scripts/lib/perfShared.ts` (`CASES`, la fixture de
`scripts/perf-battery.ts`), par `scripts/lib/diagnosticLot.ts`
(`scripts/diagnostic-harness.ts:52-58`). A-passif au sens littéral : le
module n'appelle aucune fonction du moteur, il boucle sur des runs du
harnais. `ResultatLot` contient N `ResultatHarnais` sans en modifier un, et
`OptionsLot = Omit<ConfigHarnais, 'source'>` est écrit en soustraction, pour
qu'une option ajoutée au harnais devienne commune au lot sans recopie
(`scripts/lib/diagnosticLot.ts:54-107`).

**La sélection** est tolérante à la saisie — minuscules, accents et
ponctuation mis à plat, un fragment de libellé suffit — jamais au résultat :
un nom inconnu est refusé en listant les cas, un nom ambigu en listant ceux
qu'il désigne, un indice hors bornes, signe compris, avant de lire un cas
indéfini (`resoudreSelectionCas`, `scripts/lib/diagnosticLot.ts:120-182`,
`tests/diagnostic-harness.test.ts:914-960`). `--cas` est une source à lui
seul : il refuse `--synthetique`, `--compte` et `--recette`
(`scripts/diagnostic-harness.ts:878-887`). Un cas dont l'export de compte
manque — ces exports ne sont pas suivis — est refusé au palier 1, fichier
nommé, jamais sauté ni remplacé par un pool synthétique
(`verifierComptesDisponibles`, `scripts/lib/diagnosticLot.ts:184-204`).

**Chaque cas suit le chemin de la production** (`resoudreCas`,
`scripts/lib/diagnosticLot.ts:210-277`) : l'exigence vient de `loadCase`,
`buildOptimizerRecipe` en fait une recette réimportable dans l'écran, au
préréglage « moyen », le défaut de l'écran, constaté et non choisi
(`PRESET_LOT`, `scripts/lib/diagnosticLot.ts:65-76`) — le changer passe par
`--slotFilterCap`, un override marqué —, puis `chargerRecette` la rejoue
comme `scripts/optimizer-search.ts`. La recette passe par un fichier
temporaire, supprimé dans le `finally` de `resoudreCas` dès la configuration
résolue : aucun appelant n'hérite d'un nettoyage.

**Ce qu'un lot autorise.** Les runs sont indépendants, sans état partagé ni
agrégation (`executerLot`, `scripts/lib/diagnosticLot.ts:283-315`), et chaque
cas imprime la sortie qu'il aurait seul, palier 1 et avertissement de
comparaison des temps compris (`scripts/diagnostic-harness.ts:869-945`). Le
coût s'annonce avant d'être payé — cas nommés, point d'arrêt, nombre de
recherches — et `--apercu` rend les N paliers 1 sans rien exécuter
(`annoncerLot`, `scripts/lib/diagnosticLot.ts:321-358`,
`tests/diagnostic-harness.test.ts:962-975`). Le récapitulatif imprime la
condition commune, puis `AVERTISSEMENT_LOT` AVANT le tableau : une
différence entre deux lignes est une différence entre deux CAS, jamais
l'effet d'un paramètre ; comparer deux conditions demande de les entrelacer
(harnais-extensions.md § Le différentiel : l'oracle). L'avertissement part
aussi dans `--json` (`ResultatLot.avertissementLot`,
`scripts/lib/diagnosticLot.ts:364-403`, `tests/diagnostic-harness.test.ts:977-1030`).
Les colonnes suivent le point d'arrêt ; les temps y sont des minimums, dont
la dispersion se lit dans le bloc de chaque cas (`rendreRecapLot`,
`scripts/lib/diagnosticLot.ts:408-515`).

## Garder ou retirer un script de diagnostic

Un script ad hoc reste légitime pour une question que le harnais ne couvre
pas (harnais.md § Ce que le harnais n'absorbe pas). Son sort se décide script
par script, sur son code et non sur son en-tête :

1. **Le harnais sait-il construire l'entrée ?** Il ne construit qu'un pool
   `randomPool` à graine ou celui d'un compte réel par une recette
   (harnais.md § Deux sources : une recette ou un pool synthétique) : aucune
   principale forcée par emplacement, aucune rune fabriquée. Sinon, chercher
   l'entrée fidèle qui pose la même question, souvent un compte réel avec
   des principales imposées : garder un script pour son pool artificiel
   préserve un écart à la production.
2. **Produit-il la GRANDEUR ?** Couvrir le sujet ne suffit pas : le coût d'une
   moitié construite sous la concurrence de l'autre n'est pas son coût isolé.
3. **Le script est-il fidèle ?** Une fonction de production appelée sur une
   entrée qu'elle ne reçoit jamais, ou une fonction du moteur recopiée, rend
   des chiffres faux : les retirer ne perd rien.

Une extension du harnais s'ouvre si elle se justifierait sans le script,
jamais pour en périmer un ; un chantier de mesure ne s'ouvre pas non plus
pour en sauver un. Une grandeur manquante ou une référence qui ne reproduit
plus s'écrit dans l'en-tête du script, où elle voyage avec ses chiffres
(`scripts/construction-time-diag.ts:14-25`). Une suppression se termine par
la recherche du nom sur tout le dépôt.

## Les scripts voisins

| Script | Ce qu'il produit seul | Ce que le harnais en couvre |
|---|---|---|
| `scripts/construction-time-diag.ts` | le coût ISOLÉ de chaque moitié, construites l'une après l'autre (`scripts/construction-time-diag.ts:56-60`) | `demiBuildA`, `demiBuildB` : le coût de chaque moitié sous la concurrence de l'autre, la construction étant toujours parallèle |
| `scripts/pair-bound-diag.ts` | `estimatePairBound`, majorant de `totalPairs` calculable avant la construction | rien. Ne pas l'afficher au palier 1 : trop lâche, il ne certifierait le régime séquentiel que sur des cas déjà faciles (`scripts/pair-bound-diag.ts:12-18`) |
| `scripts/optimizer-bucket-rank-diag.ts` | une rune isolée figure-t-elle dans au moins un demi-build retenu : morte au pré-filtrage, ou à la rétention | `--suivre` d'un identifiant s'arrête au pré-filtrage ; de trois, il rend le demi-build exact. `scripts/optimizer-find-rune.ts` trouve l'identifiant |
| `scripts/optimizer-bucket-list-diag.ts` | le catalogue des compartiments d'une moitié, ce qui devance la cible compris | le rang du compartiment seul |
| `scripts/monster-search-multicount-diag.ts` | l'ensemble des builds trouvés, pas un top | le top rendu et, avec un build cible, le cardinal ; `metric` et `adaptiveTrancheWeighting` ne se surchargent pas |
| `scripts/rune-owner-diag.ts` | le porteur d'une rune dans la box, sans toucher au moteur | l'étage 0 dit une rune absente du pool d'entrée, pas qui la porte |
| `scripts/optimizer-deck10-final-diag.ts`, `scripts/combos-order-mode-real-account-diag.ts` | l'instant de découverte et la courbe de rendement, aux mêmes jalons ; le second apparie en séquentiel et lit ses comptes sous `maxMs` | `decouverteBuildCible` (harnais-extensions.md § Instant de découverte et dispersion par tranche) |
| `scripts/optimum-speed-diag.ts` | la comparaison de deux VERSIONS du code, copié dans le `git worktree` d'un ancien commit | son `foundExplored`, un compte de paires que `scripts/perf-battery-compare.ts` ne rend pas, est `decouverteBuildCible` |
| `scripts/optimum-speed-targets.ts` | une vérité terrain : par couple de compartiments, les paires dans l'ordre de leur somme de `relevanceScore`, par un tas, sans matérialiser le produit cartésien ; au-delà de `HEAP_BUDGET` paires examinées, le refus de conclure (`scripts/optimum-speed-targets.ts:97-183`) | aucun optimum ; un run complet à `bucketCap` maximal classe toutes les paires quand il reste atteignable |
| `scripts/retention-dispersion-diag.ts` | un CV sur les demi-builds retenus, compartiments aplatis, principale comprise | le CV que le moteur utilise : `dispersionTranches` |
| `scripts/bucket-cap-scaling-diag.ts` | une table préréglage × formule de `bucketCap`, sur une paire d'artéfacts fabriquée | la survie du build équipé, préréglage par préréglage, sur les cas réels : `scripts/perf-battery.ts` en `--monotonicity` (`checkMonotonicityForCase`, `scripts/lib/perfShared.ts:134-155`) ; une formule se rejoue par `--slotFilterCap` et `--bucketCap` |
| `scripts/stress-tranche-weighting-attainable-diag.ts` | un pool à principales forcées et runes injectées, que la source synthétique ne construit pas ; le rang par contribution d'une seule stat | le CV par `dispersionTranches` ; des principales imposées se posent sur un compte réel |
| `scripts/filterslot-topk-diag.ts` | la différence symétrique entre deux IMPLÉMENTATIONS de `filterSlot` | rien : le harnais décrit un run, pas l'écart entre deux implémentations |

**Références recopiées.** Une copie d'une fonction du moteur ne se maintient
pas seule, et aucun `tsc` ne le signale. `filterSlotOld`, la référence de
`scripts/filterslot-topk-diag.ts`, n'a pas l'élagage `hasFreeSlots` de
`filterSlot` (`src/lib/runeBuildOptim.ts:1583-1585`) ; `retentionScoreLocal`
recopie `retentionScore`, que le moteur n'exporte pas
(`scripts/retention-dispersion-diag.ts:84-84`). Trois scripts portent dans
leur en-tête une référence que leur exécution ne reproduit plus — lire cet
en-tête avant de se fier à leur sortie : `scripts/bucket-cap-scaling-diag.ts`
(`scripts/bucket-cap-scaling-diag.ts:60-74`),
`scripts/stress-tranche-weighting-attainable-diag.ts`
(`scripts/stress-tranche-weighting-attainable-diag.ts:53-64`),
`scripts/filterslot-topk-diag.ts` (`scripts/filterslot-topk-diag.ts:37-53`).
