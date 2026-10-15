# Patches conservés

Implémentations retirées du code de production mais gardées pour pouvoir
être réappliquées sans tout retaper — voir
[docs/03-developpeur/optimizer/](../../docs/03-developpeur/optimizer/),
« Variantes écartées ou gardées en réserve ».

## `piste-a-tranche-weighting.patch`

Pondération adaptative par tranche de rétention —
CV agrégé sur les 3 runes d'un demi-build, principale exclue du calcul
(`runeSubOnlyContribution`), réparti au carré sur un budget total inchangé.
Corrige une régression réelle (Sonia deck 6) sans en créer ailleurs, mais
coûte plus cher en construction sur la majorité des cas réels — retiré pour tester l'autre variante
sur la même base propre, PAS parce que celle-ci a été jugée mauvaise.

Pour réappliquer : `git apply scripts/patches/piste-a-tranche-weighting.patch`
depuis la racine du dépôt (sur un `src/lib/runeBuildOptim.ts` dans l'état où
il était au moment du patch — voir le commit `070013b` + rien d'autre —
sinon le patch peut ne pas s'appliquer proprement).
