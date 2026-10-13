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
| **Récit de chantier dans les commentaires** : un commentaire donne la raison et l'invariant, pas l'histoire | 269 mentions « lot N » dans 104 fichiers et 220 « décision N » dans 98 fichiers de `src/`, `scripts/`, `tests/` et `bureau/` ; 45 dates dans 9 fichiers de `src/` et `bureau/` (2026-10-13) | `git grep -i -E 'lot [0-9]+\|décision [0-9]+' -- src scripts tests bureau` | 2026-10-08 |
| **Points de la revue de `release/v2.0.0`** | à relever : ils ne sont pas dans le dépôt | — | 2026-10-08 |

Au total, ESLint rend 0 erreur et 257 avertissements (2026-10-13). Deux fichiers en portent près
des deux tiers : `src/components/outils/SpeedTuningSection.tsx` (92) et `src/lib/importAccount.ts`
(72). Un avertissement ne bloque ni un commit ni la CI
([qualite-code.md](../03-developpeur/qualite-code.md)).

## Documentation

| Dette | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **Récit de chantier dans la documentation** : elle dit l'état actuel et sa raison, sans « lot N » ni numéro de décision ([documentation.md](../03-developpeur/documentation.md)) | 107 mentions « lot N » dans 39 fichiers et 106 « décision N » dans 43 fichiers de `docs/` (2026-10-13) | `git grep -i -E 'lot [0-9]+\|décision [0-9]+' -- docs` | 2026-10-13 |
| **En-têtes `Statut :` hérités** : plus exigés depuis le retrait de l'outillage maison, les README portent le routage | 67 fichiers de `docs/` (2026-10-13) | `git grep -l '^\*\*Statut :\*\*' -- docs` | 2026-10-13 |

Le reste des travaux de documentation est dans [reste-documentation.md](reste-documentation.md).
