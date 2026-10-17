# Dégâts réels — compétences auxiliaires

Ce document décrit ce que le calcul tire des **compétences auxiliaires** de
SWARFARM : des compétences reliées à un sort par `other_skill`, qu'aucun
monstre ne liste, et qui portent le ratio que la fiche du sort tait. Code :
[damage.ts](../../../src/lib/damage.ts) ; données :
`Competence.auxiliaires` ([feat-monstres.md](../compte/feat-monstres.md)).

Voir aussi : [feat-sequences-de-coups.md](feat-sequences-de-coups.md),
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md).

## Ce qu'est une compétence auxiliaire

`scripts/fetch-skills.mjs` range chaque auxiliaire sous la compétence qu'elle
désigne, avec le sens du lien :

| Sens | Ce que SWARFARM dit | Exemples |
| --- | --- | --- |
| `versCeSort` | l'auxiliaire désigne le sort | le coup en plus de Hammer Punch, la seconde phase des balles de Fatal Bullet, la riposte de Parrying |
| `depuisCeSort` | le sort désigne l'auxiliaire | Incarnation Split |
| `mutuel` | chacun désigne l'autre | les « Horn of… » des anges jumeaux et les tirs de leur forme archer |

⚠️ **Le lien ne dit pas ce que vaut l'auxiliaire.** Une même relation porte
une seconde phase de zone (Abigail), un coup en plus au même ratio
(Frankenstein), une riposte (Hollyberry Cookie), une attaque d'état
(Legolas) : chaque usage ci-dessous a sa règle et ses tests.

## La formule d'un sort dont la fiche est vide

Quand la fiche porte `formule: ""`, la formule retenue est celle de son
**unique** auxiliaire `versCeSort` à formule (`formuleRetenue`). La valeur de
l'API vaut par défaut, sauf si la prose la contredit
([valeurs curées](valeurs-de-jeu-curees.md), « Valeurs connues par l'API
seule »). `FORMULES_CUREES_PAR_ID` garde la priorité : il ne porte plus que
des formules que l'API n'a pas, ou a fausses.

| Sort · identifiant · formes | Formule (auxiliaire) | Portée retenue | Note |
| --- | --- | --- | --- |
| Tempest (Passive) · `3213` · Teshar `14513`, Phoenix `14503` (vent) | `3.7*{ATK}` (3218) | zone | passif offensif curé ([attaque après un sort](feat-attaque-apres-un-sort.md)) ; ratio confirmé aussi par l'utilisateur |
| Cursed Tombstone · `21114` · Ramon `31414` (`31404` non éveillé) | `2.7*{ATK} + 0.29*{MAX HP}` (21116) | mono-cible | la donnée dit `aoe: true` (fiche et auxiliaire), la prose « Attacks the enemy » : la prose l'emporte (`PORTEE_CORRIGEE_PAR_ID`) |
| Purification, Cooperation! · `21415` · Nezuko Kamado `31915` (`31905`, `32015`) | `4.5*{ATK}` (21416) | mono-cible | les attaques des deux alliés (« Ally Attack ») sont hors calcul : dégâts d'autres monstres |
| Rite of Ashes · `22015` · Vermilion Bird Dancer `32615` (`32605` non éveillé) | `4.5*{ATK}` (22016) | mono-cible | idem |
| Whispers of Mirkwood · `23915` · Legolas `34715` (`34705` non éveillé) | `4.2*{ATK}` (23916) | mono-cible | l'attaque de l'état, comptée une fois ; ses répétitions à chaque fin de tour ennemi ne sont pas simulées |
| Echo of the Shadow Forest · `24415` · Elder Horn `35315` (`35305` non éveillé) | `4.2*{ATK}` (24416) | mono-cible | idem |

- Les améliorations « Damage » de la fiche s'y appliquent (+15 % Ramon,
  +20 % Nezuko et Vermilion Bird Dancer, +30 % Tempest ; aucune pour Legolas
  et Elder Horn).
- La garde « formule vide » de `skillDamageProfile` et de
  `monsterOffensivePassives` porte sur la formule **retenue** : une fiche
  vide sans formule curée ni auxiliaire reste sans profil.
- **Deux auxiliaires à formule** : aucune n'est retenue, le sort reste sans
  profil — on ne choisit pas entre deux ratios.
- **Un lien `depuisCeSort` ou `mutuel`** ne donne pas sa formule au sort :
  les « Horn of… » restent sans profil.
- Un passif dont l'auxiliaire porte une formule (Rageful Return de Psamathe,
  Parrying de Hollyberry Cookie, Fat Macaron de Manon) n'est compté que s'il
  est curé offensif (`PASSIFS_OFFENSIFS_CONNUS`).
- Devenus le dernier sort calculable, ces S3 sont aussi le sort par défaut
  de leur monstre.

Test : `testDegatsFormulesApi` (`node tests/run.mjs formulesapi`).
