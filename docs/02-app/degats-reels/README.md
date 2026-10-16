# Dégâts réels — le modèle de calcul

Voir aussi : [../optimizer/](../optimizer/).

Calcul des **dégâts d'un sort précis** d'un monstre précis contre un
adversaire configuré. Brique de calcul pure, sans état ni rendu :
[damage.ts](../../../src/lib/damage.ts), vérifiée par
[tests/degats.test.ts](../../../tests/degats.test.ts).

Consommée par l'objectif de recherche **« Dégâts réels »** de l'Optimizer
(comportement d'écran : [optimizer/](../optimizer/)). Ce fichier-ci décrit
le **modèle**, pas l'interface.

> Prolonge la formule documentée dans [../mecaniques/](../mecaniques/) —
> même modèle communautaire **prédictif**, pas le code du jeu.

## Le changement touche…

Tout le calcul vit dans `src/lib/damage.ts` ; on choisit le document selon la règle touchée.

| Le changement touche… | Lire |
| --- | --- |
| l'équation de dégâts, la lecture des formules, l'ignore DEF, les compétences d'invocateur, le calcul partiel | [feat-formules-et-combat.md](feat-formules-et-combat.md) |
| les dégâts bruts d'un passif, l'amplification de buff, les dégâts proportionnels à une stat (lignes 218-221), le bucket Additionnel | [feat-artefacts-et-degats-bruts.md](feat-artefacts-et-degats-bruts.md) |
| les Dgts CRIT d'artéfact, les dégâts de bombe d'artéfact (210), les dégâts par élément (300-304) | [feat-artefacts-critique-et-element.md](feat-artefacts-critique-et-element.md) |
| une bombe (dégâts fixes, `coups === 0`) | [feat-bombes.md](feat-bombes.md) |
| la portée d'un sort, une séquence de coups curée, la cible secondaire (`cibleDegatsParSort`) | [feat-sequences-de-coups.md](feat-sequences-de-coups.md) |
| un passif offensif, la réduction de DEF, les PV creusés coup par coup, la VIT de l'adversaire, `maVitCombat` | [feat-passifs-offensifs.md](feat-passifs-offensifs.md) |
| une attaque déclenchée après un sort | [feat-attaque-apres-un-sort.md](feat-attaque-apres-un-sort.md) |
| une attaque conjointe (lignes 209 et 225, effet `Ally Attack`, interrupteur « Attaque conjointe », S1 appelé par un sort coopératif) | [feat-attaques-conjointes.md](feat-attaques-conjointes.md) |
| un effet d'équipe, un set d'aura, un leader skill, `src/lib/aurasExternes.ts` | [feat-effets-equipe-et-leaders.md](feat-effets-equipe-et-leaders.md) |
| un dégât conditionnel, une portée corrigée par la prose, un nombre de coups variable saisi | [feat-conditions-et-audit.md](feat-conditions-et-audit.md) |
| un modificateur monstre-wide d'un passif (compteur, effets sur la cible, sacrifice…) | [catalogue-des-passifs.md](catalogue-des-passifs.md) |
| une valeur de jeu curée à la main, et sa source | [valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md) |
| l'écran de l'objectif « Dégâts réels » (`src/components/outils/DamageSetupCard.tsx`, `src/components/outils/DamageSetupModale.tsx`) | [../optimizer/ecran/objectif-de-recherche.md](../optimizer/ecran/objectif-de-recherche.md) |

## Destinations

- [Dégâts réels — formules et combat](feat-formules-et-combat.md) — état actuel
- [Dégâts réels — artéfacts et dégâts bruts](feat-artefacts-et-degats-bruts.md) — état actuel
- [Dégâts réels — critique et élément](feat-artefacts-critique-et-element.md) — état actuel
- [Dégâts réels — bombes](feat-bombes.md) — état actuel
- [Dégâts réels — séquences de coups et cible secondaire](feat-sequences-de-coups.md) — état actuel
- [Dégâts réels — passifs offensifs](feat-passifs-offensifs.md) — état actuel
- [Dégâts réels — attaque déclenchée après un sort](feat-attaque-apres-un-sort.md) — état actuel
- [Dégâts réels — attaques conjointes](feat-attaques-conjointes.md) — état actuel
- [Dégâts réels — effets d’équipe et leaders](feat-effets-equipe-et-leaders.md) — état actuel
- [Dégâts réels — conditions et audit](feat-conditions-et-audit.md) — état actuel
- [Dégâts réels — catalogue des passifs](catalogue-des-passifs.md) — état actuel
- [Dégâts réels — valeurs de jeu curées](valeurs-de-jeu-curees.md) — état actuel
- [Dégâts réels — pistes futures](../../05-feuille-de-route/) — coups comptés, stats et modificateurs
- [Choix de recherche pour les dégâts réels](../../04-decisions/adr/) — décision
