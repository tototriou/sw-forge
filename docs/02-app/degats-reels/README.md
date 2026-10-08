# Dégâts réels — le modèle de calcul

**Statut :** ÉTAT ACTUEL — route vers les règles du calcul de dégâts réels
**Lire si :** on cherche dans quel fichier vit une règle du calcul de dégâts
**Ne pas lire si :** on connaît déjà la famille de règle recherchée
**Voir aussi :** [../optimizer/](../optimizer/)

Calcul des **dégâts d'un sort précis** d'un monstre précis contre un
adversaire configuré. Brique de calcul pure, sans état ni rendu :
[damage.ts](../../../src/lib/damage.ts), vérifiée par
[tests/degats.test.ts](../../../tests/degats.test.ts).

Consommée par l'objectif de recherche **« Dégâts réels »** de l'Optimizer
(comportement d'écran : [optimizer/](../optimizer/)). Ce fichier-ci décrit
le **modèle**, pas l'interface.

> Prolonge la formule documentée dans [../mecaniques/](../mecaniques/) —
> même modèle communautaire **prédictif**, pas le code du jeu.

## Destinations

- [Dégâts réels — formules et combat](feat-formules-et-combat.md) — état actuel
- [Dégâts réels — artéfacts et dégâts bruts](feat-artefacts-et-degats-bruts.md) — état actuel
- [Dégâts réels — critique et élément](feat-artefacts-critique-et-element.md) — état actuel
- [Dégâts réels — bombes](feat-bombes.md) — état actuel
- [Dégâts réels — séquences de coups et cible secondaire](feat-sequences-de-coups.md) — état actuel
- [Dégâts réels — passifs offensifs](feat-passifs-offensifs.md) — état actuel
- [Dégâts réels — attaque déclenchée après un sort](feat-attaque-apres-un-sort.md) — état actuel
- [Dégâts réels — effets d’équipe et leaders](feat-effets-equipe-et-leaders.md) — état actuel
- [Dégâts réels — conditions et audit](feat-conditions-et-audit.md) — état actuel
- [Dégâts réels — catalogue des passifs](catalogue-des-passifs.md) — état actuel
- [Dégâts réels — valeurs de jeu curées](valeurs-de-jeu-curees.md) — état actuel
- [Dégâts réels — pistes futures](../../07-pilotage/) — coups comptés, stats et modificateurs
- [Choix de recherche pour les dégâts réels](../../05-decisions/adr/) — décision
