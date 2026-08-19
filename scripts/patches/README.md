# Patches conservés

Implémentations retirées du code de production mais gardées pour pouvoir
être réappliquées sans tout retaper — voir la doc en prose dans
[spec/outils/optimizer/historique-ponderation-adaptative.md](../../spec/outils/optimizer/historique-ponderation-adaptative.md)
pour le contexte complet de chacune.

## `piste-a-tranche-weighting.patch`

Pondération adaptative par tranche de rétention (point 4, todo de la nuit) —
CV agrégé sur les 3 runes d'un demi-build, principale exclue du calcul
(`runeSubOnlyContribution`), réparti au carré sur un budget total inchangé.
Corrige une régression réelle (Sonia deck 6) sans en créer ailleurs, mais
coûte plus cher en construction sur la majorité des cas réels (voir le
Chronographe Optimizer) — retiré pour tester la piste B sur la même base
propre, PAS parce que la piste A a été jugée mauvaise.

Pour réappliquer : `git apply scripts/patches/piste-a-tranche-weighting.patch`
depuis la racine du dépôt (sur un `src/lib/runeBuildOptim.ts` dans l'état où
il était au moment du patch — voir le commit `070013b` + rien d'autre —
sinon le patch peut ne pas s'appliquer proprement).
