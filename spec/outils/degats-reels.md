# Dégâts réels — le modèle de calcul

**Statut :** ÉTAT ACTUEL — route vers les règles du calcul de dégâts réels
**Lire si :** on cherche dans quel fichier vit une règle du calcul de dégâts
**Ne pas lire si :** on connaît déjà la famille de règle recherchée
**Voir aussi :** spec/outils/optimizer.md, spec/outils/artefacts.md

Calcul des **dégâts d'un sort précis** d'un monstre précis contre un
adversaire configuré. Brique de calcul pure, sans état ni rendu :
[damage.ts](../../src/lib/damage.ts), vérifiée par
[tests/degats.test.ts](../../tests/degats.test.ts).

Consommée par l'objectif de recherche **« Dégâts réels »** de l'Optimizer
(comportement d'écran : [optimizer.md](optimizer.md)). Ce fichier-ci décrit
le **modèle**, pas l'interface.

> Prolonge la formule documentée dans [../mecaniques.md](../mecaniques.md) —
> même modèle communautaire **prédictif**, pas le code du jeu.

## Destinations

- [Dégâts réels — formules et combat](degats-reels/formules-et-combat.md) — état actuel
- [Dégâts réels — artéfacts et dégâts bruts](degats-reels/artefacts-et-degats-bruts.md) — état actuel
- [Dégâts réels — critique et élément](degats-reels/artefacts-critique-et-element.md) — état actuel
- [Dégâts réels — bombes](degats-reels/bombes.md) — état actuel
- [Dégâts réels — séquences de coups et cible secondaire](degats-reels/sequences-de-coups.md) — état actuel
- [Dégâts réels — passifs offensifs](degats-reels/passifs-offensifs.md) — état actuel
- [Dégâts réels — attaque déclenchée après un sort](degats-reels/attaque-apres-un-sort.md) — état actuel
- [Dégâts réels — effets d’équipe et leaders](degats-reels/effets-equipe-et-leaders.md) — état actuel
- [Dégâts réels — conditions et audit](degats-reels/conditions-et-audit.md) — état actuel
- [Dégâts réels — catalogue des passifs](degats-reels/catalogue-des-passifs.md) — état actuel
- [Choix de recherche pour les dégâts réels](degats-reels/decisions/choix-de-recherche.md) — décision
- [Historique du modèle de dégâts réels](degats-reels/archive/historique-du-modele.md) — archive
