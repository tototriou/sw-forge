# Dégâts réels — sorts incomplets, sets d'aura, ergonomie

**Statut :** CHANTIER terminé le 2026-10-04 — branche forge/degats-et-aura

Fiche du chantier : son journal (cadrage, contrats et résultats des lots) est
archivé dans les notes privées du projet.

## Ce que le chantier a livré

- Les cinq sets d'aura comptent dans les dégâts et les conditions : ceux du
  build et ceux des autres monstres, saisis dans « État de mon monstre » ;
  réglage « Compter les effets d'auras Tolerance et Précision dans les
  conditions ».
- « Dégâts réels » : Blade Surge choisit sa cible, les Blade Dancers ignorent
  la DEF à partir d'un coup choisi, Tempest se choisit comme sort ou suit le
  sort choisi ; coups qui varient selon l'ATQ, effets posés entre les coups,
  sorts sans attaque masqués, étiquette « Calcul partiel », mode critique
  « Moyenne » supprimé.
- Le contexte de combat survit au changement de monstre ; une carte de
  résultat n'apparaît qu'une fois vérifiée.
- La spec des dégâts réels découpée sous `spec/outils/degats-reels/` ; la
  liste des monstres et sorts modifiés :
  [degats-et-aura-monstres.md](degats-et-aura-monstres.md).

## Section citée → place publique

| Section citée | Place publique |
| --- | --- |
| A.2 ter — valeurs de jeu curées | [valeurs-de-jeu-curees.md](../outils/degats-reels/valeurs-de-jeu-curees.md), titre « (ex-A.2 ter) » |
| A.2 — cible (« cible 2 » : auras dans `statsDebutCombat` et les conditions) | [effets-equipe-et-leaders.md](../outils/degats-reels/effets-equipe-et-leaders.md), « Sets d'aura d'équipe — modèle » |
| A.4 — catégories de lots → modèle et effort | journal archivé |
| A.5 — branche, notes privées, verrous d'`ouvrir` | journal archivé |
| A.6 bis — preuves, note d'un oracle | journal archivé ; la garantie vérifiée : [../outils/optimizer/moteur/elagages.md § Élagages sûrs](../outils/optimizer/moteur/elagages.md) |
| A.8 — pilotage, vérifications et décisions de l'utilisateur | pilotage : journal archivé ; décisions de jeu : [valeurs-de-jeu-curees.md](../outils/degats-reels/valeurs-de-jeu-curees.md), [formules-et-combat.md](../outils/degats-reels/formules-et-combat.md) (sorts sans attaque, « Calcul partiel »), [catalogue-des-passifs.md](../outils/degats-reels/catalogue-des-passifs.md) (Internal Force) ; tenue de la liste : [degats-et-aura-monstres.md](degats-et-aura-monstres.md) ; le reste : journal archivé |
| B.0 — champs traversants | `setsAuraExternes` : [etat-de-mon-monstre.md](../outils/optimizer/ecran/etat-de-mon-monstre.md), « État de mon monstre » ; `compterAurasResPre` : [effets-equipe-et-leaders.md](../outils/degats-reels/effets-equipe-et-leaders.md) ; `cibleDegatsParSort` : [sequences-de-coups.md](../outils/degats-reels/sequences-de-coups.md) ; `premierCoupIgnoreDefParSort` : [formules-et-combat.md](../outils/degats-reels/formules-et-combat.md), « Ignore DEF à partir d'un coup choisi — les Blade Dancers » |

Les identifiants de lot cités dans le code renvoient au journal archivé
(`6bis-b7`, `9b`, `P4b`, `lot CM`, `Q03`, `D06`…).

Journal archivé dans les notes privées du projet : `spec/outils/optimizer/archive/chantiers/degats-et-aura.md`
