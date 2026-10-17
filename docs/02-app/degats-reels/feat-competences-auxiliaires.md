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

## La seconde phase d'un sort

Six sorts frappent une cible, puis tous les ennemis : leur fiche ne chiffre
que la phase 1, l'auxiliaire chiffre la phase de zone (Abigail, Scarlett,
Emily, M. BISON, Sagar, Kuna). La séquence est curée
(`SEQUENCES_DE_COUPS_PAR_ID_CONNUS`) ; son groupe de zone lit le ratio dans
l'auxiliaire au lieu de le recopier. Table et règles :
[feat-sequences-de-coups.md](feat-sequences-de-coups.md#séquences-à-valeur-de-lapi).
Tests : `testDegatsSequencesApi`, `testDegatsSequencesAuxiliaire`.

## Les sorts de l'autre forme — anges jumeaux

La fiche des cinq paires d'anges jumeaux (Ramael et Judiah, Karuel et Lanoah,
Sadiel et Zeryah, Miruel et Graciah, Jaduel et Aepiah) ne liste que les
« Horn of… » de leur forme de soutien, qui n'infligent aucun dégât. Chaque
Horn est lié en `mutuel` au tir de la forme archer du même slot ; ce tir est
proposé dans « Compétence utilisée » à la place du Horn
(`sortsDeLAutreForme`), avec son propre profil : identifiant, slot, ratio,
coups, portée, améliorations. Décision de l'utilisateur
([valeurs curées](valeurs-de-jeu-curees.md), « Anges jumeaux ») : le tir est
choisi seul, sans le Horn lancé avant dans le même tour.

| Monstre | S1 | S2 | S3 (sort par défaut) |
| --- | --- | --- | --- |
| Ramael et Judiah `29111` | Aim Shot `3.8*{ATK}` | Scatter Shot `2.8*{ATK}`, zone | Focus Shot `2.1*{ATK}` ×3 |
| Karuel et Lanoah `29112` | Aim Shot `3.8*{ATK}` | Multiple Shot `1.6*{ATK}` ×3 | Continuous Shot `1.7*{ATK}` ×5 |
| Sadiel et Zeryah `29113` | Aim Shot `3.8*{ATK}` | Scatter Shot `2.8*{ATK}`, zone | Charge Shot `4.2*{ATK}`, zone |
| Miruel et Graciah `29114` | Aim Shot `3.8*{ATK}` | Multiple Shot `1.6*{ATK}` ×3 | Barrage Shot `1.4*{ATK}` ×3, zone |
| Jaduel et Aepiah `29115` | Aim Shot `3.8*{ATK}` | Scatter Shot `2.8*{ATK}`, zone | Air Shot `2.3*{ATK}` ×2, zone |

Un sort de la fiche qui a déjà un profil n'est jamais remplacé, et un lien
qui n'est pas `mutuel` ne donne aucun sort. Test : `testDegatsAutreForme`.

## Le second mode d'un sort — Unlimited Power

Unlimited Power (Liam `25711`, `15511`) change de forme selon le nombre
d'ennemis, et sa fiche mêle les deux : la formule du mode « 4 ennemis ou
plus », les 6 coups et l'ignore DEF du mode « 3 ennemis ou moins ».

| Choix dans « Compétence utilisée » | Formule | Coups, portée | Ignore DEF |
| --- | --- | --- | --- |
| « Unlimited Power » (la fiche, sort par défaut) | `{ATK}*(2.5*{Target Current HP %} + 3.5)` | 1, zone | aucun |
| « Unlimited Power — 3 ennemis ou moins » (`15516`) | `1.5*{ATK}` (auxiliaire) | 6, mono-cible | linéaire selon les PV perdus par la cible : 0 % à pleine vie, 100 % à 70 % de PV perdus et au-delà |

Le second mode est proposé comme un sort de plus (`MODES_PAR_AUXILIAIRE`,
`sortsEnModeAuxiliaire`), sous l'identifiant de l'auxiliaire, que la
recette garde ; il n'est jamais le sort par défaut (`modeAuxiliaire`). Les
coups de la fiche sont ramenés à un (`COUPS_DU_MODE_DE_LA_FICHE_PAR_ID`) et
son ignore DEF retiré (`IGNORE_DEF_CONDITIONNEL_PAR_ID`). Valeurs de
l'utilisateur ([valeurs curées](valeurs-de-jeu-curees.md), « Unlimited
Power »).

La fraction de DEF ignorée (`ignoreDefSelonPvCiblePerdus`) se recalcule à
**chaque coup**, sur les PV que les coups précédents ont laissés à la cible,
depuis les « PV restants » saisis : le champ s'affiche pour ce mode, et une
cible déjà entamée ignore sa DEF plus vite (utilisateur, 2026-10-17).

## Les attaques en plus, avant ou après un sort

Une attaque que la prose annonce sous condition, chiffrée par l'auxiliaire
du sort, s'ajoute après ce seul sort sur un interrupteur éteint par défaut
(`ATTAQUES_AUXILIAIRES_PAR_DECLENCHEUR`, même chemin que les
[attaques déclenchées](feat-attaque-apres-un-sort.md)). Son profil est celui
de l'auxiliaire, ses améliorations comprises ; elle porte un libellé, faute
de nom de jeu.

| Déclencheur · monstres | Attaque (auxiliaire) | Interrupteur : « se déclenche si… » | Source |
| --- | --- | --- | --- |
| Exploding Hands (S3) · Jackie `20215` | `7.4*{ATK}` (11016), +20 % | l'étourdissement de ce sort réussit | prose ; une répétition sans nouvel étourdissement : utilisateur, 2026-09-23 |
| Shadow of Right Arm (S2) · Minato `25911`, Ren `25912`, Ritsu `25915` | `4.5*{ATK}` (15716, 15717, 15720), +25 % | tu es en état de Menace et l'ennemi t'attaque d'un sort mono-cible | utilisateur, 2026-10-17 |

⚠️ **Non établi, nommé** : les améliorations de l'auxiliaire s'appliquent à
l'attaque en plus ; un relevé de la répétition d'Exploding Hands sur son
premier coup tranche (1,00 → oui).

## Les passifs qui frappent hors du tour, choisis seuls

Trois passifs n'ont de formule que par leur auxiliaire et frappent hors du
tour du monstre. Ils ne s'ajoutent à aucun sort ; ils se choisissent seuls
dans « Compétence utilisée », comme Tempest (`PASSIFS_OFFENSIFS_CONNUS`,
`slotsDeclencheurs: []`, `selectionnableCommeSort`).

| Passif · monstre | Formule (auxiliaire) | Portée |
| --- | --- | --- |
| Rageful Return · Psamathe `21111` | `6.0*{ATK}` (11916), +30 % | zone (prose « all enemies » ; l'auxiliaire dit mono-cible) |
| Parrying · Hollyberry Cookie `26411` | `3.5*{DEF}` (16216), +25 % | mono-cible |
| Fat Macaron · Manon `26911` | `3.5*{DEF}` (16716), +25 % | mono-cible |

⚠️ **Non établi, nommé** : aucun facteur de riposte n'est appliqué aux
ripostes de Hollyberry Cookie et de Manon ; le relevé de la piste
« Événements du monstre choisis seuls »
([05-feuille-de-route/pistes-degats-reels.md](../../05-feuille-de-route/pistes-degats-reels.md#événements-du-monstre-choisis-seuls))
tranche (environ 1 → aucun facteur, environ 0,75 → facteur de `Counter`).

Test : `testDegatsAttaquesAuxiliaires`.
