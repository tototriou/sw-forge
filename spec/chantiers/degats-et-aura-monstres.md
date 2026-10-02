# Liste des monstres et sorts modifiés — chantier degats-et-aura

**Statut :** CHANTIER en cours — branche forge/degats-et-aura

Demande de l'utilisateur du 2026-10-02 : une liste exhaustive des monstres et
des sorts modifiés par ce chantier, pour tout vérifier à la fin, **tenue à
jour à chaque commit**. Lot LM du [cadrage](degats-et-aura.md). Point de
départ : `81284199` ; état couvert à l'écriture : `084cd46a`.

**Règle de tenue (A.8 du cadrage)** : tout commit qui change le calcul ou
l'affichage d'un monstre ou d'un sort met cette liste à jour **dans le même
commit**. Les vérifications visuelles déjà inscrites au cadrage (A.8,
« Vérifications de l'utilisateur en attente ») disent *quand* regarder ;
cette liste dit *quoi*, monstre par monstre.

## Comment la lire

- **Chemin commun** : page Outils → Optimizer → choisir le monstre (liste de
  travail ou bestiaire) → objectif « Dégâts réels » → fenêtre « Dégâts
  réels », où se trouvent « Compétence utilisée », « Passifs offensifs »,
  « Stats acquises en combat » et « Effets actifs ». Les deux formats, ordinateur
  et téléphone, sont de premier rang : chaque ligne vaut pour les deux.
- **Formes** : l'identifiant est le `com2usId` du monstre dans
  `public/data/monsters.json`. **†** = forme non éveillée (étoiles égales aux
  étoiles naturelles) ou habillage coréen : `formesJouables`
  (`src/lib/monsterForms.ts`) ne la propose pas, mais l'identifiant du sort
  est le même (voir « Doutes »).
- **Sort** : nom du jeu · identifiant de compétence (`com2usId` du sort) ·
  slot. Les noms et slots sont lus dans `public/data/skills/<forme>.json`.
- **Lot** : le nom du lot dans le cadrage. **Commit(s)** : les huit premiers
  caractères, dans l'historique de la branche.
- Un sort porté par plusieurs monstres apparaît sous **chacun**. Ordre :
  alphabétique par nom de monstre.
- Aucune ligne n'a été vérifiée à l'œil : elles disent ce qu'on doit voir,
  d'après le code, les tests et les Résultats du cadrage.

## 1. Par monstre

### Acasis

Formes : 11913 Acasis.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Force Field » · 2818 · S3 | Sort sans attaque (bouclier, `0.3*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Acasis → « Compétence utilisée » : plus de case « Force Field », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Alesia

Formes : 30104 Cyborg †, 30114 Alesia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Inverted Output (Passive) » · 19814 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Malus inversés par Inverted Output » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Inverted Output (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Artamiel

Formes : 17004 Archangel †, 17014 Artamiel.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Judge (Passive) » · 6314 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Déclenchements de Judge » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Judge (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Astar

Formes : 19802 Magic Knight †, 19812 Astar.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10602 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10602 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10602 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Bastet

Formes : 20501 Desert Queen †, 20511 Bastet.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Oasis's Blessing » · 11311 · S3 | Sort sans attaque (bouclier, `170*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Bastet → « Compétence utilisée » : plus de case grisée « Oasis's Blessing ». |

### Birgitta

Formes : 29704 Magic Order Swordsinger †, 29714 Birgitta.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Turning Slash (Passive) » · 19414 · S3 | Nouveau compteur « Cumuls de Turning Slash » (0 à 5) : chaque cumul ajoute +50 de VIT en points (« increases your Attack Speed by 50 each, up to 250 »), à 0 par défaut. La VIT de combat change le S1 « Double Gash » (`{SPD}`) ; au témoin (ATQ 1 000, VIT 200), le S1 passe de 2 056,44 à 3 038,55 avec 5 cumuls. | 15e | commit du lot 15e | Chemin commun → Birgitta → « Stats acquises en combat » : un compteur « Cumuls de Turning Slash » sans en-tête ni prose (le bloc « Passifs offensifs » les rend déjà) ; S1 choisi, le total monte à chaque cumul, et plus au-delà de 5. |

### Bolverk

Formes : 22601 Lightning Emperor †, 22611 Bolverk.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Forbidden Galdr » · 13111 · S3 | Effet de PV sans coup (`10 (Fixed)`, A.2 ter) masqué de « Compétence utilisée » : il était affiché refusé (« Ces dégâts ne dépendent d'aucune statistique du monstre. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Bolverk → « Compétence utilisée » : plus de case grisée « Forbidden Galdr » ; « Lightning Strike » (S1) reste proposé. |

### Brita

Formes : 28201 Mercenary Queen †, 28211 Brita.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Might of the Mercenary (Passive) » · 18011 · S3 | Le seuil de 1 671 ATQ (+100 %) lit l'ATQ de début de combat avec les auras Fight, externes et propres au build. | 6bis-b2 | `dbd4ee54`, `b0a2e84d` | Chemin commun → « État de mon monstre » → « Sets d'aura des autres monstres » : ajouter un set Fight ; le bonus de ce passif (lisible dans « Passifs offensifs ») réagit quand le seuil ou la jauge est franchi. Confirmé par l'utilisateur au lot 6bis-b2. |

### Byungchul

Formes : 28903 Dokkaebi Lord †, 28913 Byungchul.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Violent Swing » · 18603 · S1 | Critique garanti, porté par le passif « Full of Spirit (Passive) » 18613 (« Your attacks will always land as a Critical Hit whenever you attack the enemy ») : en « Non critique », le total est celui de « Critique ». | 15d | `292716c2` | Chemin commun → Byungchul → « Compétence utilisée » → Violent Swing : le résumé du sort dit « Critique garanti », le cran « Non critique » est désactivé ; le total ne bouge pas entre les deux modes. |
| « Summon Heavenly Kings Gate » · 18608 · S2 | Même garantie, même source (passif 18613). | 15d | `292716c2` | Même chemin, Summon Heavenly Kings Gate : « Critique garanti » au résumé, « Non critique » désactivé. |

### Celine

Formes : 25803 Rune Blacksmith †, 25813 Celine.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Beneficial Hammering » · 15608 · S2 | Sort sans attaque (buffs et bouclier, `100*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Celine → « Compétence utilisée » : plus de case grisée « Beneficial Hammering ». |

### Chakra

Formes : 28313 Chakra.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « The Wind Thunderer » · 18138 · S4 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « État Thunderer » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (PassifInterrupteur), la description du passif « The Wind Thunderer » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Chamie

Formes : 11204 Nine-tailed Fox †, 11214 Chamie.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Reincarnate » · 2214 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Reincarnate » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Reincarnate » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### CHUN-LI (eau)

Formes : 24401 춘리(물) †, 24411 CHUN-LI.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Hoyokusen » · 14311 · S3 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (7 coups, rangs 2 à 7, 7ᵉ coup inconditionnel et défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Hoyokusen » · 14311 · S3 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « 2ᵉ » à « 7ᵉ coup » (défaut : 7ᵉ coup seul) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. |

### CHUN-LI (ténèbres)

Formes : 24405 춘리(어둠) †, 24415 CHUN-LI.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Hyakuretsukyaku » · 14310 · S2 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (3 coups, rangs 2 et 3, aucun par défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Hyakuretsukyaku » · 14310 · S2 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « aucun », « dès le 2ᵉ coup », « dès le 3ᵉ coup » (défaut : aucun) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. |

### CHUN-LI (vent)

Formes : 24403 춘리(바람) †, 24413 CHUN-LI.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Hyakuretsukyaku » · 14308 · S2 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (3 coups, rangs 2 et 3, aucun par défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Hyakuretsukyaku » · 14308 · S2 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « aucun », « dès le 2ᵉ coup », « dès le 3ᵉ coup » (défaut : aucun) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. |
| « Rankyaku (Passive) » · 14313 · S3 | Aucune ligne du calcul modifiée : le constat 110 est prouvé par test (ATQ += 5 × VIT finale, lead et buff de VIT compris). | 11 | `d6ff1b6a` | Chemin commun → « Stats acquises en combat » : le passif « Rankyaku » est un jeton « toujours actif » ; avec un lead VIT ou le buff de VIT, l'ATQ de combat (et le total) monte. |
| « Rankyaku (Passive) » · 14313 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Rankyaku » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Rankyaku (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Cichlid

Formes : 19603 Mermaid †, 19613 Cichlid.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Air Shield » · 10408 · S2 | Sort sans attaque (bouclier, `0.25*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé et calculé comme des dégâts (pas retenu par défaut). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Cichlid → « Compétence utilisée » : plus de case « Air Shield », ni grisée ; le sort par défaut ne change pas. |

### Ciri

Formes : 29304 시리(빛) †, 29314 Ciri.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Flash Step (Passive) » · 19014 · S3 | Nouveau compteur « Cumuls de Flash Step » (0 à 5) : chaque cumul ajoute +50 de VIT en points (« increases your Attack Speed by 50 each, up to 250 »), à 0 par défaut. La VIT de combat change le S1 « Slash » (`{SPD}`) ; au témoin (ATQ 1 000, VIT 200), le S1 passe de 2 056,44 à 3 038,55 avec 5 cumuls. | 15e | commit du lot 15e | Chemin commun → Ciri (lumière) → « Stats acquises en combat » : un compteur « Cumuls de Flash Step » sans en-tête ni prose (le bloc « Passifs offensifs » les rend déjà) ; S1 choisi, le total monte à chaque cumul, et plus au-delà de 5. |

### Conrad

Formes : 16204 Death Knight †, 16214 Conrad.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Trade » · 7414 · S3 | Sort sans attaque (échange des PV, `180.0*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Conrad → « Compétence utilisée » : plus de case grisée « Trade ». |

### Cordelia

Formes : 24903 Blade Dancer †, 24913 Cordelia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Dance of Night » · 14808 · S2 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (3 coups, rangs 2 et 3, aucun par défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Blade Dance of Night » · 14808 · S2 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « aucun », « dès le 2ᵉ coup », « dès le 3ᵉ coup » (défaut : aucun) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. Valeurs de référence relevées au CLI (compte réel de l'utilisateur, lot 10b) : rang 2, 19 320,0 → 59 606,6. |
| « Accelerando (Passive) » · 14813 · S3 | Aucune ligne du calcul modifiée : le constat 110 est prouvé par test (ATQ += 5 × VIT finale, lead et buff de VIT compris). | 11 | `d6ff1b6a` | Chemin commun → « Stats acquises en combat » : le passif « Accelerando » est un jeton « toujours actif » ; avec un lead VIT ou le buff de VIT, l'ATQ de combat (et le total) monte. |
| « Accelerando (Passive) » · 14813 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Accelerando » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Accelerando (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Crane

Formes : 20833 Crane.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Strange Reversible Reaction (Passive) » · 11663 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Buffs sur Crane » + « Débuffs sur Crane » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Strange Reversible Reaction (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Dagora

Formes : 10731 Dagora.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Crouch » · 1856 · S2 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Crouch » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Crouch » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Devaraja

Formes : 28315 Devaraja.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « The Dark Thunderer » · 18140 · S4 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « État Thunderer » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (PassifInterrupteur), la description du passif « The Dark Thunderer » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Eivor

Formes : 27701 에이보르(물) †, 27711 Eivor.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Might of the Clan (Passive) » · 17511 · S3 | Le seuil de 1 520 ATQ (+100 %) lit l'ATQ de début de combat avec les auras Fight, externes et propres au build. | 6bis-b2 | `dbd4ee54`, `b0a2e84d` | Chemin commun → « État de mon monstre » → « Sets d'aura des autres monstres » : ajouter un set Fight ; le bonus de ce passif (lisible dans « Passifs offensifs ») réagit quand le seuil ou la jauge est franchi. Confirmé par l'utilisateur au lot 6bis-b2. |

### Elder Horn

Formes : 35304 Elder Horn †, 35314 Elder Horn.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Deer Steps (Passive) » · 24414 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de Deer Steps » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Deer Steps (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Elpuria

Formes : 11304 Serpent †, 11314 Elpuria.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Punish (Passive) » · 2314 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de Punish » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Punish (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Elsharion

Formes : 19204 Ifrit †, 19214 Elsharion.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Master of Magic Power (Passive) » · 10014 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Buffs sur Elsharion » + « Buffs sur les alliés » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Master of Magic Power (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Frieren

Formes : 35704 Frieren †, 35714 Frieren.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Spell to Create a Field of Flowers » · 24909 · S2 | Sort sans attaque (bouclier, `2.8*{ATK}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts (1 426 dans la preuve 13b) et retenu par défaut ; le sort par défaut devient « Ordinary Offensive Magic » (S1). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Frieren → « Compétence utilisée » : plus de case « Spell to Create a Field of Flowers », ni grisée ; « Ordinary Offensive Magic » coché par défaut. |

### Gandalf (eau)

Formes : 34401 Gandalf †, 34411 Gandalf.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Guardian's Barrier » · 23706 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Gandalf (eau) → « Compétence utilisée » : plus de case « Guardian's Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Gandalf (lumière)

Formes : 34404 Gandalf †, 34414 Gandalf, 34514 간달프(빛)(강화) †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Guardian's Barrier » · 23709 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Gandalf (lumière) → « Compétence utilisée » : plus de case « Guardian's Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Gandalf (vent)

Formes : 34403 Gandalf †, 34413 Gandalf.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Guardian's Barrier » · 23708 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Gandalf (vent) → « Compétence utilisée » : plus de case « Guardian's Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Geralt

Formes : 29205 게롤트(어둠) †, 29215 Geralt.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Alchemy (Passive) » · 18915 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Buffs sur Geralt » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Alchemy (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Gideon

Formes : 32301 Beetle Guardian †, 32311 Gideon.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Aegis Shell (Passive) » · 21711 · S3 | Le bonus de dégâts selon SA Défense (+100 % à 5 000 DEF, linéaire) lit la DEF de début de combat avec les auras Determination, externes et propres au build. | 6bis-b2 | `dbd4ee54`, `b0a2e84d` | Chemin commun → « État de mon monstre » → « Sets d'aura des autres monstres » : ajouter un set Determination ; le bonus de ce passif (lisible dans « Passifs offensifs ») réagit quand le seuil ou la jauge est franchi. Confirmé par l'utilisateur au lot 6bis-b2. |

### Grego

Formes : 16305 Lich †, 16315 Grego.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « King of the Dead (Passive) » · 7515 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Morts avant ce tour » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « King of the Dead (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Hollyberry Cookie

Formes : 26403 홀리베리 쿠키(바람) †, 26413 Hollyberry Cookie.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Cries of Unity » · 16213 · S3 | Sort sans attaque (bouclier, `3.0*{DEF}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Hollyberry Cookie → « Compétence utilisée » : plus de case « Cries of Unity », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Homunculus (Support) (lumière)

Formes : 1000204 Homunculus(Support) †, 1000214 Homunculus(Support).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Protection Field » · 10243000 · S3 | Sort sans attaque (bouclier, `110.0*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Homunculus (Support) lumière → « Compétence utilisée » : plus de case grisée « Protection Field ». |

### Homunculus (Support) (ténèbres)

Formes : 1000205 Homunculus(Support) †, 1000215 Homunculus(Support).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Protection Field » · 10253000 · S3 | Sort sans attaque (bouclier, `110.0*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Homunculus (Support) ténèbres → « Compétence utilisée » : plus de case grisée « Protection Field ». |

### Illianna

Formes : 20104 Neostone Agent †, 20114 Illianna.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Neostone Field » · 10914 · S3 | Sort sans attaque (immunité, invincibilité, bouclier, `150.0*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Illianna → « Compétence utilisée » : plus de case grisée « Neostone Field ». |

### Imperfect Magic Knight

Formes : 19823 Imperfect Magic Knight †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10603 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10603 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10603 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Inosuke Hashibira

Formes : 32105 Inosuke Hashibira †, 32115 Inosuke Hashibira.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fierce Attack! (Passive) » · 21515 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Fierce Attack! » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Fierce Attack! (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Iris

Formes : 19804 Magic Knight †, 19814 Iris.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10604 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10604 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10604 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Iunu

Formes : 20403 Anubis †, 20413 Iunu.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Underworld King's Return(Passive) » · 11213 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Résurrections déjà effectuées » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Underworld King's Return(Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Jaara

Formes : 14505 Phoenix †, 14515 Jaara.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fiery Path (Passive) » · 3216 · S3 | Le critique garanti exige une DEF cible **strictement** inférieure à l'ATQ de combat de Jaara (prose « Defense lower than your Attack Power ») : à l'égalité, plus de garantie. Le jeton du passif disait « ignore DEF si la DEF cible ≤ 1× ton ATQ » ; il dit « critique garanti si la DEF cible < 1× ton ATQ ». | 15d | `b2d44b4d`, `aa052b63` | Chemin commun → Jaara → « Passifs offensifs » : le jeton « Fiery Path » dit « critique garanti si la DEF cible < 1× ton ATQ ». En « Non critique », DEF de la cible égale à l'ATQ de combat : le total n'est plus doublé ; un point de DEF de moins : critique. |

### Jade

Formes : 26903 Macaron Guard †, 26913 Jade.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Sweet Shout » · 16713 · S3 | Sort sans attaque (bouclier, `3.0*{DEF}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Jade → « Compétence utilisée » : plus de case « Sweet Shout », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Jager

Formes : 16604 Dragon Knight †, 16614 Jager.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « King's Rage (Passive) » · 7814 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de King's Rage » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « King's Rage (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Kunite

Formes : 23302 Gargoyle †, 23312 Kunite, 23402 가고일(불) †, 23412 가고일(불).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13502 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Lanett

Formes : 19815 Lanett.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10620 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10620 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10620 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Lapis

Formes : 19811 Lapis.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10616 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10616 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». Valeurs de référence relevées au CLI sur le compte réel de l'utilisateur (lot 8b) : 10 031,1 sur la cible visée, 7 460,2 sur les autres ennemis. |
| « Blade Surge » · 10616 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Lariel

Formes : 24901 Blade Dancer †, 24911 Lariel.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Moonlight Dance » · 14811 · S3 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (7 coups, rangs 2 à 7, 7ᵉ coup inconditionnel et défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Moonlight Dance » · 14811 · S3 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « 2ᵉ » à « 7ᵉ coup » (défaut : 7ᵉ coup seul) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. |

### Legolas

Formes : 34704 Legolas †, 34714 Legolas.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Quick Steps (Passive) » · 23914 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de Quick Steps » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Quick Steps (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Leona

Formes : 21805 Paladin †, 21815 Leona.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Internal Force (Passive) » · 12515 · S3 | Le Bouclier (`2.0*{DEF}`) n'est plus compté comme des dégâts : le passif n'est plus un passif offensif à formule propre. Le « +50 % de dégâts infligés quand tu as un Bouclier » de la donnée est compté sur tous les sorts de Leona, sous un interrupteur désactivé par défaut (même clé de stockage que l'ancien bouton : un réglage déjà allumé donne désormais +50 % au lieu de +2 × DEF). L'égalisation ATQ/DEF de début de combat reste hors calcul. | 15b | `dcca28a7` | Chemin commun → Leona → « Passifs offensifs » : un interrupteur « Internal Force (+50 %) », éteint, « Se déclenche si tu as un bouclier actif. », la prose du passif dessous ; plus de ratio « 2 × DEF ». Éteint : le total est celui du sort seul. Allumé : le total de S1 comme de S2 est multiplié par 1,5 ; changer la DEF du build ne change plus le total. |

### Lupinus

Formes : 19813 Lupinus.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10618 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10618 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10618 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Madeleine

Formes : 25804 Rune Blacksmith †, 25814 Madeleine.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Beneficial Hammering » · 15609 · S2 | Sort sans attaque (buffs et bouclier, `100*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Madeleine → « Compétence utilisée » : plus de case grisée « Beneficial Hammering ». |

### Magic Knight (eau)

Formes : 19801 Magic Knight †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10601 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10601 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10601 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Magic Knight (ténèbres)

Formes : 19805 Magic Knight †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10605 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10605 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10605 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Magic Knight (vent)

Formes : 19803 Magic Knight †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10603 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10603 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10603 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### Malite

Formes : 23303 Gargoyle †, 23313 Malite, 23403 가고일(바람) †, 23413 가고일(바람).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13503 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Mayasura

Formes : 28501 Asura †, 28511 Mayasura.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Constant Training (Passive) » · 18311 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Attaques déjà effectuées » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Constant Training (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Mei Hou Wang

Formes : 16802 Monkey King †, 16812 Mei Hou Wang.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Gold Headband (Passive) » · 7912 · S3 | Chaque cumul ajoute 20 % de l'ATQ de BASE et 12 % de la VIT de BASE (avant : 20 % de l'ATQ de combat et 12 points de VIT), jusqu'à 10 cumuls, sans arrondi ; nouvel axe `spdBasePct`. | 11 | `92de9890` | Chemin commun → « Stats acquises en combat » : compteur « Charges de Gold Headband ». Le total monte avec le compteur ; référence du test sur Mei Hou Wang : 1 cumul = +138,4 ATQ et +13,92 VIT, 10 cumuls = +139,2 VIT (VIT de base 116). |
| « Gold Headband (Passive) » · 7912 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de Gold Headband » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Gold Headband (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Miriam

Formes : 25802 Rune Blacksmith †, 25812 Miriam.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Beneficial Hammering » · 15607 · S2 | Sort sans attaque (buffs et bouclier, `100*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Miriam → « Compétence utilisée » : plus de case grisée « Beneficial Hammering ». |

### Molly

Formes : 19604 Mermaid †, 19614 Molly.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Air Shield » · 10409 · S2 | Sort sans attaque (bouclier, `0.25*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Molly → « Compétence utilisée » : plus de case « Air Shield », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Monte

Formes : 21305 Dice Magician †, 21315 Monte.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Destiny Dice » · 12115 · S3 | Sort sans attaque (redistribution des PV, `15.0*DICE_MIN + 15.0`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Monte → « Compétence utilisée » : plus de case grisée « Destiny Dice ». |

### Mork

Formes : 31401 Tomb Warden †, 31411 Mork.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Lamplight in Darkness » · 21111 · S3 | Sort sans attaque (immunité, bouclier, `0.2*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Mork → « Compétence utilisée » : plus de case « Lamplight in Darkness », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Old Wood (eau)

Formes : 35001 Old Wood †, 35011 Old Wood.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Floral Barrier » · 24206 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Old Wood (eau) → « Compétence utilisée » : plus de case « Floral Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Old Wood (lumière)

Formes : 35004 Old Wood †, 35014 Old Wood, 35114 Old Wood †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Floral Barrier » · 24209 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Old Wood (lumière) → « Compétence utilisée » : plus de case « Floral Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Old Wood (vent)

Formes : 35003 Old Wood †, 35013 Old Wood.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Floral Barrier » · 24208 · S2 | Sort sans attaque (bouclier, `0.2*{MAX HP}`, et Reflect Damage accordé) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Old Wood (vent) → « Compétence utilisée » : plus de case « Floral Barrier », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Onyx

Formes : 23305 Gargoyle †, 23315 Onyx, 23405 가고일(어둠) †, 23415 가고일(어둠).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13505 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Ophilia

Formes : 21802 Paladin †, 21812 Ophilia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Cry of Threat » · 12512 · S3 | Sort sans attaque (immunité, bouclier, `0.2*{MAX HP}`, Menace) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Ophilia → « Compétence utilisée » : plus de case « Cry of Threat », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Parjanya

Formes : 28311 Parjanya.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « The Sea Thunderer » · 18136 · S4 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « État Thunderer » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (PassifInterrupteur), la description du passif « The Sea Thunderer » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Phenaka

Formes : 23304 Gargoyle †, 23314 Phenaka, 23404 가고일(빛) †, 23414 가고일(빛).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13504 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Raviti

Formes : 21003 Harg †, 21013 Raviti.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Deer's Song » · 11813 · S3 | Sort sans attaque (purification, immunité, bouclier, `2.5*{DEF}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Raviti → « Compétence utilisée » : plus de case « Deer's Song », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Rick (feu)

Formes : 31002 Rick †, 31012 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20707 · S2 | Critique garanti contre une cible affligée (« the Critical Rate increases to 100% when attacking an enemy with harmful effects ») : interrupteur « Shockwave Fist (critique garanti) », éteint par défaut, ou Brise DEF / Marque saisies → les deux coups critiques. Nouveau cadre « Prendre en compte les débuffs posés entre les coups », ligne « Réduction de DEF » : posée « Après le coup 1 », le coup 2 seul devient critique (décision de l'utilisateur, A.2 ter) ; la DEF du coup 2 n'est pas réduite. Résumé du sort : « critique garanti si la cible a un débuff ». | 15d | `292716c2` | Chemin commun → Rick (feu) → « Compétence utilisée » → Shockwave Fist : le résumé, l'interrupteur et le cadre des poses entre les coups. En « Non critique » : interrupteur allumé, les deux coups critiques et « Non critique » désactivé ; interrupteur éteint et pose « Après le coup 1 », seul le second coup critique. |

### Rick (ténèbres)

Formes : 31005 Rick †, 31015 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20710 · S2 | Comme Rick (feu), 20707. | 15d | `292716c2` | Comme Rick (feu), sur Rick (ténèbres). |

### Rick (vent)

Formes : 31003 Rick †, 31013 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20708 · S2 | Comme Rick (feu), 20707 (le `Destroy HP` de 20708 porte 50, hors de ce lot). | 15d | `292716c2` | Comme Rick (feu), sur Rick (vent). |

### Suiki

Formes : 25101 Onimusha †, 25111 Suiki, 25121 Imperfect Onimusha †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Undergo Hardship (Passive) » · 15011 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Tours déjà joués » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Undergo Hardship (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Sylphid (vent)

Formes : 11903 Sylphid †, 40403 Sylphid †, 700403 Sylphid †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Force Field » · 2813 · S3 | Sort sans attaque (bouclier, `100.0*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). Aucune forme jouable ne porte ce sort. | 15c | `a65b2f28`, `f7bd6a1f` | Seulement si un exemplaire du compte est une forme † : plus de case grisée « Force Field ». |

### Tantra

Formes : 10412 Tantra.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Ancestors' Blessing » · 1412 · S3 | Sort sans attaque (bouclier, `0.5*{MAX HP}`, et récupération) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Tantra → « Compétence utilisée » : plus de case « Ancestors' Blessing », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Tanzaite

Formes : 23301 Gargoyle †, 23311 Tanzaite, 23401 가고일(물) †, 23411 가고일(물).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13501 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Teshar

Formes : 14503 Phoenix †, 14513 Teshar.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Tempest (Passive) » · 3213 · S3 | Tempest (Passive) se calcule : formule curée 3,7 × ATQ (les données n'en portent pas) ; interrupteur désactivé par défaut ; compté après S1 ou S2 seulement, jamais après S3 ; 411 jamais, 402/410 une fois. | 9a | `50e46aea`, `e5dc87ae` | Chemin commun → « Passifs offensifs » : « Tempest (Passive) » avec son interrupteur, éteint. L'allumer ajoute 3,7 × ATQ à S1 et à S2 ; avec S3 comme sort, rien ne s'ajoute. |
| « Tempest (Passive) » · 3213 · S3 | Tempest devient un choix de « Compétence utilisée » (jamais le sort par défaut : Teshar reste sur S2, une seule contribution) ; interrupteur « Tempest (S3) se déclenche après ce sort », masqué quand Tempest est le sort choisi ; CLI et recette (identifiant 3213) le reprennent. | 9b | `db32bbd9`, `2402e91d`, `badea22f` | Chemin commun : Tempest dans la liste des sorts, jamais pré-choisi ; sous S1 ou S2, l'interrupteur « Tempest (S3) se déclenche après ce sort » ; choisir Tempest masque l'interrupteur. Le texte de condition au survol (`title`) de 9b n'existe plus (lot 9d, ligne suivante). |
| « Tempest (Passive) » · 3213 · S3 | L'interrupteur « Tempest (S3) se déclenche après ce sort » n'a plus de survol (`title`) : la phrase curée (« … ton S1 ou ton S2 frappe (recharge non simulée) ») n'est plus affichée nulle part à l'écran ; la condition du jeu reste lisible dans la prose de Tempest (sous l'interrupteur, et au « ? » de sa case dans « Compétence utilisée »). Calcul inchangé ; les autres interrupteurs de passif gardent leur survol. | 9d | `2bca1603` | Chemin commun → Teshar, S1 ou S2 choisi : à la souris, rien ne s'affiche au survol de l'interrupteur « Tempest (S3) se déclenche après ce sort » ; la prose « … after you attack the enemy on your turn … » est sous l'interrupteur ; le « ? » de la case Tempest l'ouvre aussi (bulle à la souris, panneau au doigt). Un autre passif conditionnel garde son survol. |

### Tetra

Formes : 19601 Mermaid †, 19611 Tetra.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Air Shield » · 10406 · S2 | Sort sans attaque (bouclier, `0.25*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Tetra → « Compétence utilisée » : plus de case « Air Shield », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Valdemar

Formes : 29605 Magic Order Guardian †, 29615 Valdemar.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Addicted Power (Passive) » · 19315 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Buffs sur Valdemar » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Addicted Power (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Varus

Formes : 11535 Varus, 47705 Griffon 2A † (forme générique, non jouable).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Dark Guardian (Passive) » · 2565 · S3 | Le critique garanti exige une DEF cible **strictement** inférieure à la DEF de combat de Varus, +50 % du passif compris (prose « lower Defense than yours ») : à l'égalité, plus de garantie. Le jeton du passif disait « ignore DEF si la DEF cible ≤ 1× ta DEF » ; il dit « critique garanti si la DEF cible < 1× ta DEF ». | 15d | `b2d44b4d`, `aa052b63` | Chemin commun → Varus → « Passifs offensifs » : le jeton « Dark Guardian » dit « critique garanti si la DEF cible < 1× ta DEF ». En « Non critique », DEF de la cible égale à la DEF de combat : le total n'est plus doublé ; un point de moins : critique. |

### Vendhan

Formes : 28312 Vendhan.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « The Flame Thunderer » · 18137 · S4 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « État Thunderer » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (PassifInterrupteur), la description du passif « The Flame Thunderer » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Vereesa

Formes : 24905 Blade Dancer †, 24915 Vereesa.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Dance of Night » · 14810 · S2 | L'ignore DEF n'est plus « toujours » mais « à partir d'un coup choisi » (3 coups, rangs 2 et 3, aucun par défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au coup 1 seulement ; la jauge d'attaque adverse n'est pas modélisée. | 10a | `db913084`, `dc8e4b5f` | Chemin commun → choisir ce sort : son résumé n'écrit plus « Ignore la DEF » ; la DEF de la cible est affichée (elle compte désormais pour les coups avant le rang). |
| « Blade Dance of Night » · 14810 · S2 | Sélecteur « Ignore la DEF (jauge de la cible à 0) » : crans « aucun », « dès le 2ᵉ coup », « dès le 3ᵉ coup » (défaut : aucun) ; ligne de résumé « Ignore la DEF : … » ; CLI et recette (`premierCoupIgnoreDefParSort`, refus avec son chemin d'un rang hors crans). | 10b | `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f` | Chemin commun : ce sort choisi, le sélecteur apparaît (ordinateur ET téléphone), rien ne bouge au clic ; le résumé dit « Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul » sur une ligne à lui. |

### White Tiger Blade Master

Formes : 32805 White Tiger Blade Master †, 32815 White Tiger Blade Master.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Attack Instinct (Passive) » · 22115 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Attack Instinct » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Attack Instinct (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Yuji Itadori (feu)

Formes : 30402 이타도리 유지(불) †, 30412 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20107 · S2 | Comme Rick (feu), 20707 : critique garanti contre une cible affligée (interrupteur « Divergent Fist (critique garanti) », Brise DEF ou Marque) ; « Réduction de DEF » posée « Après le coup 1 » dans le cadre des poses entre les coups → le coup 2 seul critique, sa DEF non réduite. Le S3 « Black Flash: Maximum Power » (20112) reste critique garanti sans condition. | 15d | `292716c2` | Comme Rick (feu), sur Yuji Itadori (feu), sort Divergent Fist. |

### Yuji Itadori (ténèbres)

Formes : 30405 이타도리 유지(어둠) †, 30415 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20110 · S2 | Comme Yuji Itadori (feu), 20107. | 15d | `292716c2` | Comme Rick (feu), sur Yuji Itadori (ténèbres). |

### Yuji Itadori (vent)

Formes : 30403 이타도리 유지(바람) †, 30413 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20108 · S2 | Comme Yuji Itadori (feu), 20107. Témoin du lot (1 000 ATQ, 100 % de Dgts Crit, DEF cible 1 000, « Non critique ») : 848,5 sans débuff, 1 272,8 avec la pose après le coup 1, 1 697,1 interrupteur allumé. | 15d | `292716c2` | Comme Rick (feu), sur Yuji Itadori (vent). |

## 2. Changements transverses (tous les monstres)

Chaque ligne vaut pour tout monstre ; rien n'est à chercher monstre par
monstre. Les lots sans effet à l'écran le disent.

### 2.1 Planchers, contexte, auras

| Changement | Lot | Commit(s) | Vérifier |
| --- | --- | --- | --- |
| **Plancher des conditions en « Libre »** : la contribution garantie des emplacements d'artéfact vaut 0 ; la base et la relique réellement équipée restent comptées selon le mode d'affichage. | 3 | `28df1995` | Recherche d'artéfacts en mode « Libre » avec des conditions : les emplacements non figés ne garantissent aucune ligne ; le plancher n'est pas nul sur les huit stats. Garde : `artifact-condition-floor`. |
| **Relique équipée comptée dans le plancher** (choix « comme équipé »). | 4 | `91837dab` | Relique PV/ATQ/DEF à +8 % portée, modes total et bonus : le plancher ajoute 641 PV, 81 ATQ ou 57 DEF sur les bases mesurées 8 001 / 1 001 / 701 ; sans relique ou avec un autre choix, 0. Garde : `artifact-relic-condition-floor`. |
| **Contexte de combat conservé entre monstres** : le réglage de « Dégâts réels » survit à un changement d'espèce, seul ce qui désigne un sort de l'ancienne espèce est vidé ; un autre exemplaire de même espèce ou une navigation entre listes ne vide rien ; l'import de compte garde le reset complet. | 5 | `bed3818f`, `09ca897d` | Régler le combat (cible, buffs, mode critique), passer à un monstre d'une autre espèce : le réglage reste, le sort retombe sur le défaut. Garde : `optimizerdamagetransitions`. |
| **Modèle des cinq auras** (premier jet, total d'équipe figé) — remplacé par 6bis-b1 et 6bis-b2 ; ne se vérifie plus seul. | 6 | `4f6ce326`, `88d58019` | Rien à chercher : voir les deux lignes suivantes. |
| **Auras externes** : seules les auras des autres monstres se saisissent (jusqu'à 15 sets) ; une recette qui porte l'ancien total d'équipe `setsAura` non vide est refusée à l'import. | 6bis-b1 | `4622a02f` | Importer une recette portant l'ancien `setsAura` : refus, jamais réinterprétation. |
| **Auras propres au build** : les sets d'aura réellement actifs des six runes (même non demandés, ou complétés par Intangible) s'ajoutent aux auras externes, en UN seul terme, dans les stats de début de combat, le score, « PV effectifs », les passifs et les exclusives de relique. | 6bis-b2 | `dbd4ee54`, `b0a2e84d` | 3 Fight externes + un build à 2 Fight actifs : l'ATQ de combat compte 5 sets, +40 % de l'ATQ de base. Garde : `auras`. |
| **Conditions RES/PRE** exactes avec les auras propres ; borne de minimum RES/PRE avec les auras propres. | 6bis-b3a, 6bis-b3b | `6b1ff763`, `bdbd952c` | Recherche avec un minimum de RES ou de PRE franchi grâce à un set Tolerance/Accuracy du build : le build est retenu. |
| **Saisie des sets d'aura des autres monstres** dans « État de mon monstre » (boîte « Sets d'aura des autres monstres », compteur « X / 15 », bouton « Ajouter un set d'aura » désactivé à 15) ; **libellés Accuracy et Tolerance alignés sur +8 points** (ils disaient +10 %) ; **écho de « Dégâts réels »** qui nomme les auras externes ; **interrupteur « Compter les effets d'auras Tolerance et Précision dans les conditions »**. | 7a | `85c2359d`, `1baecf9e`, `0b642561`, `3bc596af` | Carte « État de mon monstre » : la boîte, le compteur, le bouton ; une pastille de set Accuracy/Tolerance dit « +8% » ; l'interrupteur en dernier des réglages avancés (flottant sur ordinateur, panneau « Options » sur téléphone) ; l'écho de la fenêtre « Dégâts réels ». |
| **Rappel** des auras externes au changement de monstre en liste de travail ; **ouverture guidée** vers l'interrupteur RES/PRE en ajoutant Accuracy ou Tolerance. | 7b | `cc85a596`, `9291e1c8` | Changer de monstre en liste de travail : message de 3 s à la place de l'en-tête de la boîte ; ajouter Accuracy ou Tolerance : défilement puis ouverture de l'interrupteur (ordinateur ET téléphone). |
| **Le même rappel sous la liste** de la zone C, au clic sur un membre. | 7c | `c60bceee` | Cliquer un membre de la liste : 32 px réservés dès que la liste a un membre, rien ne saute ; au téléphone, dans le dépliement de la zone C. |

### 2.2 Résultats de recherche, relique, file et Worker

Ces lignes changent ce que la recherche retient, classe, affiche ou calcule
en arrière-plan ; elles n'ont pas de réglage propre. Les gardes sont des tests
nommés (`node tests/run.mjs <filtre>`).

| Changement | Lot | Commit(s) | Vérifier |
| --- | --- | --- | --- |
| **Dominance** (élagage des runes) : seulement entre sets interchangeables, bonus de set utiles protégés, efficience, Taux Crit sous condition, sets formables, Intangible dans les activations possibles ; elle protège aussi les stats de l'effet unique de la relique et celles des lignes d'artéfact 218–221. | 6bis-b3b, 6bis-b3c, 6bis-b3d-1 | `b841912c`, `1bb729c2`, `12812a6e`, `3f9be574`, `756eb09c`, `99463b70`, `4e761e7e` | Aucune lecture directe : une recherche exhaustive et la recherche élaguée rendent le même optimum. Gardes : `runeoptimauras`, `dominancerelique`, `dominancelignes`. |
| **Oracles et différentiels de preuve** (relique, lignes 218–221) — outillage de preuve, pas d'écran. | 6bis-b3d-2, 6bis-b6 | `9e56c343`, `d00230e2`, `40ccc426`, `72783391`, `4957a782` | Rien à l'écran. |
| **Effet unique de la relique** dans le tri, les cartes et « Comparer » (trois modes) ; l'ordre de base le compte pour une relique fixe ; compté dans les artéfacts de la fiche ; le CLI classe comme l'écran. | 6bis-b5a, 6bis-b5b, 6bis-b5c | `2e896bfa`, `41db8858`, `ef88c08f`, `99513bcf`, `d52d2e94`, `597a0730`, `808d2d36`, `c77b34d6`, `5ac720ca`, `b8b28f63` | Une carte de résultat avec relique à effet unique : le chiffre affiché est celui qui la classe ; « Comparer » note la fiche avec sa paire et sa relique. |
| **Paramètres de paires partagés** : un seul producteur pour l'écran et le CLI, le CLI neutralise les verrous. | 6bis-b6 | `810745a7`, `d80274ba` | Rien à l'écran (parité écran / CLI). |
| **La carte affiche le chiffre qui la classe** ; le CLI donne score, sets actifs et auras propres des 20 meilleurs ; le harnais classe « Dégâts réels » avec le contexte du CLI. | 6bis-b4 | `8d816ec3`, `5772364d`, `d716b7be`, `56ee3b99` | Une carte de résultat : le nombre en tête est celui du tri. |
| **« Trier par » PV, ATQ ou DEF** classe sur la fiche ; à égalité de régime de stat, la relique portée l'emporte. | 6bis-b9 | `4fa6ad5c`, `f3aa265d` | « Trier par » ATQ, puis PV, puis DEF : la valeur de la carte décroît de haut en bas (vérifié par l'utilisateur le 2026-10-02). |
| **Une tranche arrêtée sur son quota tronque la recherche parallèle** ; la file résout 300 builds en mode relique « recherche ». | 6bis-b7, 6bis-b8 | `6d238d08`, `28a765cd` | Recherche interrompue : « Recherche interrompue après examen de N combinaisons » (recette `recette-6bis-b7-atq3000-dc220.json`, facultatif). |
| **Un build écarté à la résolution sort du compte en direct** ; **la page affichée se résout sans attendre l'inactivité** ; **la résolution d'un build partage ce qui ne dépend pas de lui**. | 6bis-b10, 6bis-b11, 6bis-b13 | `fd9d7f52`, `bfe6f6d7`, `88e4c76a` | Sous un zéro dû aux rejets : retour sur la dernière page, « Trier par » et « Adapter les artéfacts… » masqués (vérifié le 2026-10-02). |
| **Relique de la carte de résultat** sous la roue, à la souris (elle ne débordait plus). | 6bis-b15 | `add96600`, `7b3ec767` | À la souris, la relique est dans la case sous la roue (vérifié le 2026-10-02). |
| **Worker de résolution** : la file confie la résolution des builds à un Worker, le fil de l'écran en repli ; un seul producteur des runes d'un build ; publication forcée ; motif d'erreur journalisé. | 6bis-b13bis-a, -b, -c | `b0c580e7`, `9a7202a8`, `11abb68d`, `0625cfe9`, `c1c31d6a`, `95407be1`, `380bf00d`, `f951f3e9` | Recette Kinki : barre et compte fluides pendant la recherche, résolution de la page en « Dégâts réels » et « PV effectifs ». |
| **Une carte n'apparaît qu'une fois vérifiée** (places « Vérification… », plus de va-et-vient). | 6bis-b16 | `6df20ba2` | Recette Kinki : aucune carte qui apparaît puis disparaît ; changer de page et de tri (vérifié le 2026-10-02). |
| **Le cache de la file suit les artéfacts réservés et la pièce d'un emplacement figé.** | 6bis-b17 | `d8132284`, `c1d96fd5` | Réserver ou figer un artéfact puis relancer : les paires suivent. |
| **La file vise K combinaisons confirmées** ; en-tête et pages comptent les confirmées ; interrupteur « Vérifier toutes les combinaisons trouvées ». | 6bis-b18 | `734d4dd6`, `69d7ec6a`, `ab1e33f0` | En-tête « XX combinaison(s) confirmée(s) » qui ne baisse jamais, avec infobulle ; l'interrupteur, désactivé par défaut, sur une grosse recherche en « PV effectifs » : l'écran reste-t-il fluide ? (à confirmer). |
| **Chaque import du compte vide le cache de la file ; changer d'exemplaire dans la liste efface les résultats affichés.** | 6bis-b19 | `92db894b`, `62ac3eeb` | Réimporter le compte puis relancer : les paires suivent ; passer à un autre exemplaire de la même espèce (liste de travail seulement) efface les résultats. |

### 2.3 Affichage des sorts, mode critique, recette

| Changement | Lot | Commit(s) | Vérifier |
| --- | --- | --- | --- |
| **Prose d'un sort au clic** : un « ? » à droite du nom de chaque case de « Compétence utilisée » ouvre la prose (bulle à la souris, panneau montant au doigt) sans choisir le sort ; plus de survol (`title`) ; l'infobulle « Effets actifs » regroupe les descriptions des vignettes affichées ; nouvel axe `actionTitre` de `Option`. **Tous les monstres** dont un sort a une prose. | 11bis | `a34dedb5`, `aba5306e` | Chemin commun → « Compétence utilisée » : le « ? » à la souris ET au doigt ; la case cliquée ne bouge pas ; un sort sans prose n'a pas de « ? », un sort refusé garde le sien ; « Effets actifs » : l'infobulle liste « libellé — description » par effet affiché. |
| **Prose des passifs « Stats acquises en combat »** : une fois par passif, jamais en double ; voir les 30 passifs et leurs monstres en § 1 (lot 11). | 11 | `5a21fd78` | Voir chaque monstre en § 1 ; absence de doublon sur les huit exclusions (§ 3). |
| **Mode critique « Moyenne » supprimé** : deux crans seulement, « Critique » et « Non critique » ; la part critique vaut 1 ou 0 ; une recette qui porte « moyenne » est convertie en « crit » à l'import avec un avertissement (token warn, affiché jusqu'au prochain import), à l'écran et au CLI. | CM | `f1e7d71c`, `361cc9d0`, `3ea62afe`, `3cba1d5a` | Mode critique : deux crans, aide « Coup critique » en une phrase ; importer une recette exportée en « Moyenne » : avertissement en couleur d'avertissement, calcul en « Critique ». |
| **Recette : une seule règle de clé d'identifiant de compétence** pour quatorze champs (un zéro de tête est refusé avec son chemin) ; le refus d'une clé sans règle d'ignore DEF ne compte plus les sorts. | 8d, 9c | `52717fe0`, `39145f17` | Importer une recette dont une clé d'identifiant vaut « 010616 » : refus avec le chemin du champ. |

### 2.4 Hors produit (ni calcul, ni affichage)

Commits du chantier qui ne changent ni le calcul ni l'écran ; listés pour que
la liste des commits de code soit complète.

| Objet | Lot | Commit(s) |
| --- | --- | --- |
| Extraction du corpus dégâts et aura, complément borné du lot 1a2 | 0, 1a2 | `c0407a5f`, `d9b6959d` |
| Découpage de la spec des dégâts réels | 2b | `62fc8bf8` |
| Parité des skills Codex | outillage | `f4ec2b9f` |
| Verrous d'`ouvrir` et de `livrer` de l'outil `chantier` | O | `32a5da12` |
| Définitions d'agents `lot-c`, `lot-m`, `lot-j` | A.4 | `7ad98468`, `69d659dc` |
| Tests des trois mécanismes rejoués sur des cas indépendants (aucun fichier de `src/`) | 12 | `6f16ce5d` |

## 3. Préparé mais sans effet en production

Rien de ce qui suit n'est à chercher à l'écran.

- **Attaque appelée active** (`ATTAQUES_APPELEES_PAR_DECLENCHEUR`, lot 9c,
  `38223c94`) : la table est **vide en production**, par contrat. Les 17
  amorces examinées (constats 168 Mina, 178 RYU et Striker, 179 Maîtres
  ivres) ne sont pas codées ; seul un test injecte des entrées et les retire.
- **Prose des passifs masqués** (`783df03d`, lot 9c) : un passif masqué
  (choisi comme sort, ou exclu par ses slots déclencheurs) qui porterait aussi
  des stats de combat garde sa prose. Aucun cas dans le corpus aujourd'hui.
- **Mécanismes génériques sans autre porteur** : `slotsDeclencheurs` et
  `selectionnableCommeSort` (seul Tempest), la formule curée d'un passif par
  `FORMULES_CUREES_PAR_ID` (seul `3213`), la séquence de coups curée (seul
  Blade Surge), l'ignore DEF à partir d'un coup (seuls les six sorts des
  Blade Dancers).
- **Les huit passifs dont la prose était déjà rendue ailleurs** (lot 11, rien
  ne doit changer, aucun doublon ne doit apparaître) : `2565` Dark Guardian
  (Varus 11535, Griffon 2A 47705) ; `9611` à `9615` Berserk déjà actif
  (Barbaric King et Aegir, Surtr, Hraesvelg, Mimirr, Hrungnir) ; `10612`
  Vengeful Fire (Astar, Magic Knight feu) ; `18139` The Light Thunderer
  (Dyeus 28314).
- **Hors lot, préexistant** : le surplus de Taux Crit de Ciri, MOS (Feu) et
  Reyka change les dégâts sans être protégé par la dominance (relevé au lot
  CM) ; le lot 13 le consolide.

## 4. Doutes laissés écrits

- **Lot 9d** (retrait du survol de la condition de Tempest) : fait, lignes
  Teshar en § 1 ; la phrase curée de la condition n'est plus à l'écran,
  seule la prose du jeu reste.
- **Formes †** : Phoenix (vent) `14503`, les Magic Knight `19801` à `19805`,
  Imperfect Magic Knight `19823`, les habillages coréens et les formes non
  éveillées portent le même identifiant de sort que leur forme jouable ; la
  modification vaut pour elles si un exemplaire du compte les porte. Non
  vérifié : quelles formes † le compte de l'utilisateur contient.
- **Gold Headband** : aucun relevé en jeu de l'arrondi (la VIT n'est pas
  arrondie par cumul) ; le Speed tune (`pointsDeGain`, `speedTunePassif.ts`)
  arrondit chaque cumul au supérieur : écart consigné dans la spec, non
  tranché.
- **Rankyaku et Accelerando** : le lot 11 n'a changé aucune ligne de calcul
  (test seul) ; Miriam dans la VIT n'est pas exercée.
- **Stone Claws** : la prose est rendue sous le compteur ET au « ? » de la
  case du sort ; décision de l'utilisateur : garder les deux.
- **Calculs faux en silence encore en production** (Madness Judgement, Liam,
  Thunder Strike `7713`, Barbara, bouclier de Frieren…) : hors de cette
  liste, décision de l'utilisateur du 2026-10-02 d'attendre le plan du
  lot 13. Le bouclier d'Internal Force en est sorti au lot 15b (Leona, § 1),
  celui de Frieren au lot 15c (Frieren, § 1).
- **Sorts sans attaque** (lot 15c) : 28 sorts masqués, chacun par sa prose ;
  pour les boucliers, le mot « damage » de la prose (dégâts absorbés,
  Reflect Damage accordé) a été jugé ne pas faire une attaque. Le sort par
  défaut des monstres touchés n'a été vérifié que par test (Frieren), pas à
  l'écran.
- **Internal Force** (lot 15b) : aucun relevé en jeu du +50 % ; qu'il
  multiplie le total comme le reste des bonus conditionnels à bouton (hors
  bucket Additionnel) est l'hypothèse de la famille, non mesurée pour
  Leona.
- **Valeurs en jeu** : aucune des valeurs de Blade Surge, Tempest et Blade
  Dancers n'a de relevé en jeu ; elles viennent de l'utilisateur (A.2 ter).
- **Bornes de DEF** (lot 15d) : Copper `7763` et Guard Crush `15907`,
  `15908`, `15910` portent désormais un drapeau `inclusif` explicite ; leur
  calcul et leur texte ne changent pas (absents du § 1). La `note` de
  l'effet de Copper (« lower than 50% ») est stricte, sa prose (« half or
  lower ») inclusive : la prose fait foi, comme avant. Aucune borne n'a de
  relevé en jeu.
- **Yuji et Rick, coup 2** (lot 15d) : la garantie du coup 2 après la
  réduction de DEF du coup 1 est une décision de l'utilisateur, sans
  relevé ; que cette réduction baisse aussi la DEF du coup 2 n'est ni
  relevé ni décidé (non modélisé : 1 272,8 au témoin, 2 231,3 dans l'autre
  lecture). Byungchul : un passif bloqué (Oblivion) n'est pas modélisé.
- **Ciri et Birgitta** (lot 15e) : aucun relevé en jeu ; le +50 est lu en
  points, comme le Speed tune. Que l'artéfact « Effet aug. VIT » amplifie le
  cumul de Birgitta, typé « Buff » dans la donnée (« Neutral » chez Ciri),
  n'est pas établi. La hausse des dégâts « as the target's HP status
  decreases » des deux coups du passif reste non modélisée (plancher).

---

Mise à jour dans le même commit que tout changement du calcul ou de
l'affichage d'un monstre ou d'un sort (A.8).
