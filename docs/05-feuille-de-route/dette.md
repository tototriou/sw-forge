# Dette

Ce qui est connu, mesuré et pas corrigé. Une ligne quitte ce registre quand la dette est payée ;
une mesure se redonne avec sa date quand on la refait.

## Code

| Dette | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **Code mort** : variables, imports et paramètres inutilisés | 153 avertissements `@typescript-eslint/no-unused-vars` (2026-10-13) | `npm run lint` | 2026-10-08 |
| **Types `any`** | 80 avertissements `@typescript-eslint/no-explicit-any`, dont 72 dans `src/lib/importAccount.ts` (la lecture de l'export SWEX) | `npm run lint` | 2026-10-13 |
| **Dépendances de hooks React incomplètes** | 17 avertissements `react-hooks/exhaustive-deps` | `npm run lint` | 2026-10-13 |
| **Affectations inutiles** | 7 avertissements `no-useless-assignment` | `npm run lint` | 2026-10-13 |
| **Points de la revue de `release/v2.0.0`** | à relever : ils ne sont pas dans le dépôt | — | 2026-10-08 |

Au total, ESLint rend 0 erreur et 257 avertissements (2026-10-13). Deux fichiers en portent près
des deux tiers : `src/components/outils/SpeedTuningSection.tsx` (92) et `src/lib/importAccount.ts`
(72). Un avertissement ne bloque ni un commit ni la CI
([qualite-code.md](../03-developpeur/qualite-code.md)).

Les commentaires ne portent plus aucun « lot N » ni numéro de décision (2026-10-13 :
`git grep -E '\blots? [0-9]+|[Dd]écisions? [0-9]+' -- src scripts tests bureau`, aucun résultat) ;
une décision qui a son ADR y est citée par son chemin. Le récit sans numéro (« le mainteneur a
demandé… », « depuis le rebranding ») ne se compte pas : il se relève à la relecture.

## Documentation

Aucune dette mesurée (2026-10-13) : plus aucun « lot N » ni numéro de décision dans `docs/`
(`git grep -E '\blots? [0-9]+|[Dd]écisions? [0-9]+' -- docs`), plus aucun en-tête hérité. Le récit
de l'avant sans numéro (« l'ancienne… », « a été retiré ») ne se compte pas : il se relève à la
relecture ([documentation.md](../03-developpeur/documentation.md)).
