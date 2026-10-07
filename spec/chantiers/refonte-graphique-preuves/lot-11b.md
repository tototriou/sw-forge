# Preuve — lot 11b de la refonte graphique : téléphone · Siège

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.11. Décision
appliquée (A.2 bis) : **25** — équipes gardées côte à côte ; « Vérifier mes
speed » en interrupteur sur la page ; decks des recommandations en rangées
compactes, détail au toucher. Filtre d'origine de la maquette ignoré
(décision 19).

## Tests écrits AVANT (commit `9a421af1`)

`tests/rendu/telephone-siege.test.tsx`, 30 vérifications par
`auTelephone` : équipes (lead, vitesses, emplacement vide, actions),
panneaux « Actions — défense / attaque » et leurs actions ; recommandations
(cartes, marque « Importée », panneau « Actions — recommandations »,
actions de chaque recommandation, « Analyser mes decks » désactivé sans
compte).

## Le lot

| Commit | Quoi |
|---|---|
| `29f33f1a` | décision 25 écrite dans le cadrage, avant le code |
| `afc5e8e0` | « Vérifier mes speed » : interrupteur sur la page au téléphone, hors du panneau ; libellé et forme courte déclarés dans `deplacements.json` |
| `220ab28b` | recommandations : la rangée repliée d'un deck montre aussi « Fort contre » et les sets visés |

Rien n'est retiré. **Une assertion change**, signalée au mainteneur : celle du
panneau « Options » (écrite au début du lot) suit le panneau sans « Vérifier
mes speed » ; une vérification de l'interrupteur sur la page est ajoutée
(31 vérifications).

Relevé en passant, hors refonte : l'infobulle d'« Exporter » en Défense dit
« tes équipes d'défense » — signalé au mainteneur, non corrigé ici.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu                    → 727 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
```

**Lot 11b clos le 2026-09-28** sur « ok continue » du mainteneur.
