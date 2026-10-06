# Vérification

**Statut :** ÉTAT ACTUEL — décrit la vérification imposée à l'algorithme de recherche
**Lire si :** on modifie l'algorithme de recherche et qu'il faut savoir quels contrôles le couvrent

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** sur des jeux de
runes aléatoires mais déterministes — même verdict de faisabilité, aucun
faux positif, même optimum exact sur les scénarios non tronqués.
[tests/rune-optim.test.ts](tests/rune-optim.test.ts) couvre en plus, à la
main, la statistique principale imposée, les conditions maximum, et les cas
limites de chaque élagage. Un test de régression à échelle réelle
([tests/rune-optim-scale-monotonicity.test.ts](tests/rune-optim-scale-monotonicity.test.ts))
couvre en plus des pools de taille proche des comptes réels, pas seulement
les petits jeux du test différentiel.
[tests/rune-optim-parallel-pairing.test.ts](tests/rune-optim-parallel-pairing.test.ts)
vérifie spécifiquement que découper l'appariement sur plusieurs Workers
retrouve EXACTEMENT le même ensemble de candidats que l'appariement
séquentiel, sur des jeux aléatoires balayés à 1/2/3/4 tranches.

⚠️ **Les quatre étages de préparation sont OBSERVABLES, sans les rejouer.**
`prepareSearch` accepte un observateur optionnel (`onStage`) appelé après
chacun d'eux — statistique principale, dominance, faisabilité, pré-filtrage.
Raison d'être : ces états sont écrasés l'un après l'autre et seul le dernier
sort de la fonction, si bien qu'un outil de diagnostic voulant distinguer
« rune **prouvée** impossible » (dominance, faisabilité) de « rune seulement
**écartée** » (pré-filtrage heuristique) devait jusqu'ici rappeler les
fonctions une par une et reconstruire le contexte à la main — une seconde
implémentation du pipeline, qui a effectivement dérivé du vrai moteur.
Observateur **omis = comportement strictement inchangé** ; il ne doit jamais
muter ce qu'il reçoit.
[tests/rune-optim-onstage.test.ts](tests/rune-optim-onstage.test.ts) le
vérifie, en comparant le résultat produit avec et sans observateur.

Cet observateur est ce sur quoi repose le **harnais de diagnostic**
([scripts/diagnostic-harness.ts](scripts/diagnostic-harness.ts)) : un outil de
développement — pas une fonctionnalité de l'app — qui rejoue une recherche à
partir d'une recette exportée ou d'un pool synthétique reproductible, et
restitue en deux paliers la configuration réellement appliquée (avec
l'ORIGINE de chaque paramètre), la survie d'une rune étage par étage, le
régime d'appariement choisi comme la production le choisirait, et la
complétude avec son motif d'arrêt. Il remplace l'écriture de scripts de
diagnostic ponctuels, dont plusieurs avaient dérivé du moteur réel sans que
rien ne le signale.

Le moteur a par ailleurs été validé
« grandeur nature » : retrouver exactement le runage d'un monstre réel
existant, à partir de ses propres stats comme critères, sur un compte de
plusieurs milliers de runes.

