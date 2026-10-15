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

## Vocabulaire

Le [glossaire](../01-presentation/04-glossaire.md) fixe les mots ; le dépôt et l'app ne le suivent
pas encore. Les remettre d'équerre est un chantier à part : les libellés affichés changent
l'écran, ils passent par le banc. Mesures hors du glossaire, dans `src/` et `docs/` (2026-10-14) :

| Écart au glossaire | Mesure | Comment la retrouver | Depuis |
| --- | --- | --- | --- |
| **« Taux Crit », « Dmg Crit »** au lieu de « Tx critiq. », « Dgts critiq. » (libellés du jeu), dont l'affichage (`src/lib/effects.ts`) | 113 occurrences, 35 fichiers | `git grep -E 'Taux Crit\|Dmg Crit' -- src docs` | 2026-10-14 |
| **« DCC », « Dgts CRIT »** pour la même stat | 72 occurrences, 28 fichiers | `git grep -E 'DCC\|Dgts CRIT' -- src docs` | 2026-10-14 |
| **« SWEX »** au lieu de « SW Exporter » | 67 occurrences, 30 fichiers | `git grep SWEX -- src docs` | 2026-10-14 |
| **« totem »** au lieu de « compétences d'invocateur » | 62 occurrences, 25 fichiers | `git grep -i totem -- src docs` | 2026-10-14 |
| **« moitié »** pour un demi-build, **« préréglage »** pour un deck, **« deck »** pour une équipe | à relever à la relecture | — | 2026-10-14 |

## Documentation

Aucune dette mesurée (2026-10-13) : plus aucun « lot N » ni numéro de décision dans `docs/`
(`git grep -E '\blots? [0-9]+|[Dd]écisions? [0-9]+' -- docs`), plus aucun en-tête hérité. Le récit
de l'avant sans numéro (« l'ancienne… », « a été retiré ») ne se compte pas : il se relève à la
relecture ([documentation.md](../03-developpeur/documentation.md)).
