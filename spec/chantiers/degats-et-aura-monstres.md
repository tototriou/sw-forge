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

### Abigail

Formes : 22911 Abigail.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fatal Extinctive Bullet » · 13311 · S3 | Séquence curée : 1 coup de 3,5 × ATQ sur la cible (donnée) puis 1 coup de 4,5 × ATQ sur tous les ennemis (compétence auxiliaire 2476 de l'API SWARFARM, règle D12) ; avant, 3,5 × ATQ seul. Total « Non critique » ×2,286 (ATQ 2 000, DEF cible 1 000). Deux crans « Dégâts sur la cible visée » / « Dégâts sur les autres ennemis » (4,5 × ATQ seul) ; 224 et 411 sur le premier coup seul. Skillups (+25 %) sur les deux coups : supposé, non confirmé. | P6 (SZ-2) | commit du lot P6 | Chemin commun → Abigail → « Compétence utilisée » → « Fatal Extinctive Bullet » : résumé « 1 coup · Cible unique, puis 1 coup · Zone » ; les deux crans sous la liste ; « Dégâts sur les autres ennemis » baisse le total. |

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

### Amelia

Formes : 21501 Unicorn †, 21511 Amelia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Protection Wings (Passive) » · 12311 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Protection Wings » (icône et nom du jeu) pose Buff DEF — « when you are attacked » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff DEF »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Amelia → carte « État de mon monstre » : sous les vignettes, la ligne « Protection Wings » + « pose Buff DEF — « when you are attacked » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Antares

Formes : 16302 Lich †, 16312 Antares, 41202 Lich †, 701202 Lich †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Transcendence (Passive) » · 7512 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Transcendence » (icône et nom du jeu) pose Buff ATQ et Buff Taux Crit — « Gains a turn with a 15% chance whenever an enemy's turn ends » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. Le Taux Crit est nommé, mais aucune vignette ne le règle (D5 du lot 13b : il ne pèse que dans le mode « Moyenne »). | P2 | `87e03514` | Outils → Optimizer → choisir Antares → carte « État de mon monstre » : sous les vignettes, la ligne « Transcendence » + « pose Buff ATQ et Buff Taux Crit — « Gains a turn with a 15% chance whenever an enemy's turn ends » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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

### Azazel

Formes : 2003503 Azazel.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Devil Gene's Origin (Passive) » · 20021103 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Devil Gene's Origin » (icône et nom du jeu) pose Buff DEF — « at the start of its turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff DEF »), rien ne s'allume d'office. Forme de boss (prose « the boss's ») : jouabilité soumise à D6 du lot 13b ; prose seule, fiche sans effet. | P2 | `87e03514` | Outils → Optimizer → choisir Azazel → carte « État de mon monstre » : sous les vignettes, la ligne « Devil Gene's Origin » + « pose Buff DEF — « at the start of its turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Barbara

Formes : 23501 Beast Rider (eau) †, 23511 Barbara.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fast Link » · 13606 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 100 % ; prose « The beast's attack decreases the enemy's Defense », la bête frappe en premier) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. L'ignore DEF de « Start of Attacking » (13611) n'est pas touché (P11). | P4 | `730927e7` | Chemin commun → Barbara → choisir « Fast Link » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Bastet

Formes : 20501 Desert Queen †, 20511 Bastet.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Oasis's Blessing » · 11311 · S3 | Sort sans attaque (bouclier, `170*{Attacker's Level}`) masqué de « Compétence utilisée » : il était affiché refusé (« Formule non prise en charge par le calcul de dégâts. »). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Bastet → « Compétence utilisée » : plus de case grisée « Oasis's Blessing ». |

### Benedict

Formes : 25704 Weapon Master (lumière) †, 25714 Benedict.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Weakness Shot » · 15509 · S2 | Effet posé entre les coups, par identifiant : « Marque » (donnée `Brand` 100 % ; prose « leave a Branding effect for 2 turns and attacks 3 more times », donc au coup 1) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », les 3 coups suivants reçoivent +25 % (×1,188 contre sans pose, DEF cible 1 500, ATQ 1 000, sort seul). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Benedict → choisir « Weakness Shot » : le cadre des poses entre les coups apparaît avec « Marque » ; « Après le coup 1 » monte le total (davantage que « Après le coup 2 » ou « 3 »), aucune pose : total inchangé. |
| « Final Strike (Passive) » · 15514 · S3 | Le passif suit le sort (« Attacks additionally … when you attack the enemy on your turn ») : sous le scénario de poses de « Weakness Shot », il lit l'état de la cible après le dernier coup du sort, Marque posée comprise. Marque « Après le coup 1 / 2 / 3 » : total de l'objectif ×1,218 / ×1,185 / ×1,153 contre sans pose (avant : ×1,097 / ×1,065 / ×1,032), DEF cible 1 500, ATQ 1 000, non critique. Sans scénario, total inchangé. | P4b | `09ee8342` | Chemin commun → Benedict → choisir « Weakness Shot » → Marque « Après le coup 1 » : le total monte davantage qu'avant P4b ; aucune pose : total inchangé. |

### Birgitta

Formes : 29704 Magic Order Swordsinger †, 29714 Birgitta.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Turning Slash (Passive) » · 19414 · S3 | Nouveau compteur « Cumuls de Turning Slash » (0 à 5) : chaque cumul ajoute +50 de VIT en points (« increases your Attack Speed by 50 each, up to 250 »), à 0 par défaut. La VIT de combat change le S1 « Double Gash » (`{SPD}`) ; au témoin (ATQ 1 000, VIT 200), le S1 passe de 2 056,44 à 3 038,55 avec 5 cumuls. | 15e | `6c2b593e` | Chemin commun → Birgitta → « Stats acquises en combat » : un compteur « Cumuls de Turning Slash » sans en-tête ni prose (le bloc « Passifs offensifs » les rend déjà) ; S1 choisi, le total monte à chaque cumul, et plus au-delà de 5. |

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

### Carbine

Formes : 22703 Sniper Mk.I †, 22713 Carbine, 22803 Sniper Mk.I †, 22813 Carbine (non proposée par `formesJouables`).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Veteran (Passive) » · 13213 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Veteran » (icône et nom du jeu) pose Buff ATQ — « whenever the enemy's attack lands as a Glancing Hit » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. Prose seule : la fiche n’a que `Increase ATB`. | P2 | `87e03514` | Outils → Optimizer → choisir Carbine → carte « État de mon monstre » : sous les vignettes, la ligne « Veteran » + « pose Buff ATQ — « whenever the enemy's attack lands as a Glancing Hit » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Carlos

Formes : 25702 Weapon Master (feu) †, 25712 Carlos.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Weakness Shot » · 15507 · S2 | Effet posé entre les coups, par identifiant : « Marque » (donnée `Brand` 100 % ; prose « leave a Branding effect for 2 turns and attacks 3 more times », donc au coup 1) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », les 3 coups suivants reçoivent +25 % (×1,188 contre sans pose, DEF cible 1 500, ATQ 1 000, sort seul). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Carlos → choisir « Weakness Shot » : le cadre des poses entre les coups apparaît avec « Marque » ; « Après le coup 1 » monte le total (davantage que « Après le coup 2 » ou « 3 »), aucune pose : total inchangé. |

### Cecilia

Formes : 34001 Arcane Weapon (eau) †, 34011 Cecilia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Rending Claw » · 23306 · S2 | Le bouton « +50 % — tu es en Mechanical Frame State (Emergency Drive) » disparaît : la fiche de Cecilia ne porte pas Emergency Drive (décision de l'utilisateur du 2026-10-03). Total par défaut inchangé (981,1201, au témoin du lot) ; le total « interrupteur allumé » (1 471,6801) n'existe plus. | P1b | `f840ef7e` | Chemin commun → Cecilia → « Compétence utilisée » → « Rending Claw » : aucun interrupteur « Mechanical Frame State » ; le total est celui de l'ancien état éteint. |

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

### Chamomile

Formes : 27003 Black Tea Bunny †, 27013 Chamomile.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Mind and Body Rest (Passive) » · 16813 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Mind and Body Rest » (icône et nom du jeu) pose Buff ATQ, Buff DEF ou Buff VIT — « when you gain a turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ », « Buff DEF », « Buff VIT »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Chamomile → carte « État de mon monstre » : sous les vignettes, la ligne « Mind and Body Rest » + « pose Buff ATQ, Buff DEF ou Buff VIT — « when you gain a turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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
| « Crushed Hopes » · 10413 · S3 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 80 % ; prose « the second attack decreases the Defense ») entre dans le cadre des poses entre les coups ; posée « Après le coup 2 », seul le coup 3 subit la DEF réduite (×1,455 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. Le sélecteur propose aussi « Après le coup 1 », que le sort ne pose pas (décision D21, en attente). | P4 | `730927e7` | Chemin commun → Cichlid → choisir « Crushed Hopes » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 2 » monte le total, « Après le coup 1 » le monte davantage (cran à ne pas lire comme réel) ; aucune pose : total inchangé. |

### Ciri

Formes : 29304 시리(빛) †, 29314 Ciri.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Flash Step (Passive) » · 19014 · S3 | Nouveau compteur « Cumuls de Flash Step » (0 à 5) : chaque cumul ajoute +50 de VIT en points (« increases your Attack Speed by 50 each, up to 250 »), à 0 par défaut. La VIT de combat change le S1 « Slash » (`{SPD}`) ; au témoin (ATQ 1 000, VIT 200), le S1 passe de 2 056,44 à 3 038,55 avec 5 cumuls. | 15e | `6c2b593e` | Chemin commun → Ciri (lumière) → « Stats acquises en combat » : un compteur « Cumuls de Flash Step » sans en-tête ni prose (le bloc « Passifs offensifs » les rend déjà) ; S1 choisi, le total monte à chaque cumul, et plus au-delà de 5. |

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

### Cynthia

Formes : 34002 Arcane Weapon (feu) †, 34012 Cynthia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Rending Claw » · 23307 · S2 | Le bouton « +50 % — tu es en Mechanical Frame State (Emergency Drive) » passe de la table par nom à une table par identifiant (23307) : Cynthia, seule fiche à porter Emergency Drive, le garde ; ses totaux sont inchangés (981,1201 par défaut, 1 471,6801 interrupteur allumé, au témoin du lot). | P1b | `f840ef7e` | Chemin commun → Cynthia → « Compétence utilisée » → « Rending Claw » : l'interrupteur « Mechanical Frame State » est présent, éteint par défaut ; l'allumer multiplie le total par 1,5 ; « Mechanical Fist » (S1) n'a pas ce bouton. |

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

### Dominic

Formes : 25703 Weapon Master (vent) †, 25713 Dominic.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Weakness Shot » · 15508 · S2 | Effet posé entre les coups, par identifiant : « Marque » (donnée `Brand` 100 % ; prose « leave a Branding effect for 2 turns and attacks 3 more times », donc au coup 1) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », les 3 coups suivants reçoivent +25 % (×1,188 contre sans pose, DEF cible 1 500, ATQ 1 000, sort seul). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Dominic → choisir « Weakness Shot » : le cadre des poses entre les coups apparaît avec « Marque » ; « Après le coup 1 » monte le total (davantage que « Après le coup 2 » ou « 3 »), aucune pose : total inchangé. |
| « Improvisation (Passive) » · 15513 · S3 | Le passif suit le sort (« Attacks additionally … when attacking an enemy on your turn ») : sous le scénario de poses de « Weakness Shot », il lit l'état de la cible après le dernier coup du sort, Marque posée comprise. Marque « Après le coup 1 / 2 / 3 » : total de l'objectif ×1,225 / ×1,200 / ×1,176 contre sans pose (avant : ×1,074 / ×1,050 / ×1,025), interrupteur du passif allumé, DEF cible 1 500, ATQ 1 000, non critique. Sans scénario, total inchangé. | P4b | `09ee8342` | Chemin commun → Dominic → choisir « Weakness Shot » → Marque « Après le coup 1 » : le total monte davantage qu'avant P4b ; aucune pose : total inchangé. |

### Eivor

Formes : 27701 에이보르(물) †, 27711 Eivor.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Might of the Clan (Passive) » · 17511 · S3 | Le seuil de 1 520 ATQ (+100 %) lit l'ATQ de début de combat avec les auras Fight, externes et propres au build. | 6bis-b2 | `dbd4ee54`, `b0a2e84d` | Chemin commun → « État de mon monstre » → « Sets d'aura des autres monstres » : ajouter un set Fight ; le bonus de ce passif (lisible dans « Passifs offensifs ») réagit quand le seuil ou la jauge est franchi. Confirmé par l'utilisateur au lot 6bis-b2. |

### Eivor (feu)

Formes : 27702 에이보르(불) †, 27712 Eivor.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Harpoon Impalement » · 17507 · S2 | Effet posé entre les coups, par identifiant : « Marque » (donnée `Brand` 100 %, note « 1st hit » ; prose « The first attack leaves a Branding effect ») entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 reçoit +25 % (×1,125 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Eivor (feu) → choisir « Harpoon Impalement » : le cadre des poses entre les coups apparaît avec « Marque » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Eivor (lumière)

Formes : 27704 에이보르(빛) †, 27714 Eivor.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Harpoon Impalement » · 17509 · S2 | Effet posé entre les coups, par identifiant : « Marque » (donnée `Brand` 100 %, note « 1st hit » ; prose « The first attack leaves a Branding effect ») entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 reçoit +25 % (×1,125 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Eivor (lumière) → choisir « Harpoon Impalement » : le cadre des poses entre les coups apparaît avec « Marque » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Elder Horn

Formes : 35304 Elder Horn †, 35314 Elder Horn.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Deer Steps (Passive) » · 24414 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Charges de Deer Steps » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Deer Steps (Passive) » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. |

### Eleni (vent)

Formes : 28103 Gladiatrix †, 28113 Eleni.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Vigor Crush » · 17913 · S3 | Une ancienne recette sans `enemyAtk` prend l'ATQ ennemie affichée par l'écran (1 000) au lieu de 0 : le +30 % « If the enemy's Attack Power is lower than yours » n'est plus allumé à tort. Au témoin du lot (ATQ du build 900, DEF cible 1 000, « Non critique »), 1 548,7484 avant, 1 191,3449 après ; à 1 200 d'ATQ, 2 064,9979 inchangé. | 15f | `372168cd` | Chemin commun → Eleni → « Compétence utilisée » → Vigor Crush : le champ « ATQ adverse » affiche 1 000 ; importer une recette exportée avant ce champ donne le même total que ce champ à 1 000 (bonus seulement si l'ATQ du build dépasse 1 000). |

### Elise

Formes : 34005 Arcane Weapon (ténèbres) †, 34015 Elise.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Rending Claw » · 23310 · S2 | Le bouton « +50 % — tu es en Mechanical Frame State (Emergency Drive) » disparaît : la fiche d'Elise ne porte pas Emergency Drive (décision de l'utilisateur du 2026-10-03). Total par défaut inchangé (981,1201, au témoin du lot) ; le total « interrupteur allumé » (1 471,6801) n'existe plus. | P1b | `f840ef7e` | Chemin commun → Elise → « Compétence utilisée » → « Rending Claw » : aucun interrupteur « Mechanical Frame State » ; le total est celui de l'ancien état éteint. |

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

### Emily

Formes : 22914 Emily.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fatal Armor Bullet » · 13314 · S3 | Séquence curée : 1 coup de 3,5 × ATQ sur la cible (donnée) puis 1 coup de 4,5 × ATQ sur tous les ennemis (compétence auxiliaire 2478 de l'API SWARFARM, règle D12) ; avant, 3,5 × ATQ seul. Total « Non critique » ×2,286 (ATQ 2 000, DEF cible 1 000). Deux crans « Dégâts sur la cible visée » / « Dégâts sur les autres ennemis » (4,5 × ATQ seul) ; 224 et 411 sur le premier coup seul. Skillups (+25 %) sur les deux coups : supposé, non confirmé. | P6 (SZ-2) | commit du lot P6 | Chemin commun → Emily → « Compétence utilisée » → « Fatal Armor Bullet » : résumé « 1 coup · Cible unique, puis 1 coup · Zone » ; les deux crans sous la liste ; « Dégâts sur les autres ennemis » baisse le total. |

### Erwin

Formes : 20903 Elven Ranger †, 20913 Erwin.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Evasive Maneuver(Passive) » · 11713 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Evasive Maneuver » (icône et nom du jeu) pose Buff ATQ et Buff VIT — « When being attacked » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ », « Buff VIT »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Erwin → carte « État de mon monstre » : sous les vignettes, la ligne « Evasive Maneuver » + « pose Buff ATQ et Buff VIT — « When being attacked » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Espresso Cookie

Formes : 26503 에스프레소맛 쿠키(바람) †, 26513 Espresso Cookie.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Caffeine (Passive) » · 16313 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Caffeine » (icône et nom du jeu) pose Buff ATQ, Buff DEF ou Buff VIT — « when you gain a turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ », « Buff DEF », « Buff VIT »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Espresso Cookie → carte « État de mon monstre » : sous les vignettes, la ligne « Caffeine » + « pose Buff ATQ, Buff DEF ou Buff VIT — « when you gain a turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Fridrion

Formes : 30704 Drakan Warrior †, 30714 Fridrion.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Dragon Scales (Passive) » · 20414 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Dragon Scales » (icône et nom du jeu) pose Buff DEF — « whenever you are granted with a harmful effect » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff DEF »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Fridrion → carte « État de mon monstre » : sous les vignettes, la ligne « Dragon Scales » + « pose Buff DEF — « whenever you are granted with a harmful effect » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Frieren

Formes : 35704 Frieren †, 35714 Frieren.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Spell to Create a Field of Flowers » · 24909 · S2 | Sort sans attaque (bouclier, `2.8*{ATK}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts (1 426 dans la preuve 13b) et retenu par défaut ; le sort par défaut devient « Ordinary Offensive Magic » (S1). | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Frieren → « Compétence utilisée » : plus de case « Spell to Create a Field of Flowers », ni grisée ; « Ordinary Offensive Magic » coché par défaut. |

### Frodo

Formes : 34301 Frodo †, 34311 Frodo.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Will of The Shire (Passive) » · 23611 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Will of The Shire » (icône et nom du jeu) pose Buff ATQ — « If no harmful effects were removed » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. Le porteur compté parmi « all allies » : lecture de la prose, l'effet de la fiche porte `surSoi: false` (non prouvé). | P2 | `87e03514` | Outils → Optimizer → choisir Frodo → carte « État de mon monstre » : sous les vignettes, la ligne « Will of The Shire » + « pose Buff ATQ — « If no harmful effects were removed » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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

### Hanwul

Formes : 23704 Art Master (lumière) †, 23714 Hanwul.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Scroll Trap » · 13709 · S2 | Sort sans attaque (sceau : la formule `10*(17*{SPD} + 2900)/({SPD} + 100)` est une durée, pas des dégâts) masqué de « Compétence utilisée » : il était proposé et calculé comme des dégâts. Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Hanwul → « Compétence utilisée » : plus de case « Scroll Trap », ni grisée ; les autres sorts de Hanwul restent proposés. |

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

### Icaru

Formes : 11031 Icaru.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Counterattack (Passive) » · 2061 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Counterattack » (icône et nom du jeu) pose Buff ATQ — « when you attack on your turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Icaru → carte « État de mon monstre » : sous les vignettes, la ligne « Counterattack » + « pose Buff ATQ — « when you attack on your turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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

### Iona

Formes : 15304 Epikion Priest (lumière) †, 15314 Iona.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Light of Revival » · 6714 · S3 | Sort sans attaque (soin et résurrection, `0.6*{Target MAX HP} (Fixed)`) masqué de « Compétence utilisée » : il était affiché refusé (« Ces dégâts ne dépendent d’aucune statistique du monstre. »). Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Iona → « Compétence utilisée » : plus de case grisée « Light of Revival » ; les autres sorts d'Iona restent proposés. |

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

### Jeogun

Formes : 23702 Art Master (feu) †, 23712 Jeogun.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Scroll Trap » · 13707 · S2 | Sort sans attaque (sceau : la formule `10*(17*{SPD} + 2900)/({SPD} + 100)` est une durée, pas des dégâts) masqué de « Compétence utilisée » : il était proposé et calculé comme des dégâts. Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Jeogun → « Compétence utilisée » : plus de case « Scroll Trap », ni grisée ; les autres sorts de Jeogun restent proposés. |

### Juno

Formes : 15702 Oracle †, 15712 Juno.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Loss of Cause and Effect (Passive) » · 7112 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Loss of Cause and Effect » (icône et nom du jeu) pose Buff VIT — « if you get a harmful effect » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff VIT »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Juno → carte « État de mon monstre » : sous les vignettes, la ligne « Loss of Cause and Effect » + « pose Buff VIT — « if you get a harmful effect » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Kassandra (vent)

Formes : 27603 카산드라(바람) †, 27613 Kassandra.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Wrath of Ares » · 17413 · S3 | Une ancienne recette sans `enemyAtk` prend l'ATQ ennemie affichée par l'écran (1 000) au lieu de 0 : le +30 % « If the enemy's Attack Power is lower than yours » n'est plus allumé à tort. Au témoin du lot (ATQ du build 900, DEF cible 1 000, « Non critique »), 1 548,7484 avant, 1 191,3449 après ; à 1 200 d'ATQ, 2 064,9979 inchangé. | 15f | `372168cd` | Chemin commun → Kassandra → « Compétence utilisée » → Wrath of Ares : le champ « ATQ adverse » affiche 1 000 ; importer une recette exportée avant ce champ donne le même total que ce champ à 1 000 (bonus seulement si l'ATQ du build dépasse 1 000). |

### Kazuya Mishima

Formes : 2003601 Kazuya Mishima.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Devil Gene (Passive) » · 20021203 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Devil Gene » (icône et nom du jeu) pose Buff ATQ — « at the start of its turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. Forme de boss (prose « the boss's ») : jouabilité soumise à D6 du lot 13b ; prose seule, fiche sans effet. | P2 | `87e03514` | Outils → Optimizer → choisir Kazuya Mishima → carte « État de mon monstre » : sous les vignettes, la ligne « Devil Gene » + « pose Buff ATQ — « at the start of its turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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

### Lukan

Formes : 11113 Lukan, 40803 Salamander †, 700803 Salamander †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Regenerate » · 2113 · S3 | Sort sans attaque (soin après purge, `0.3*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Lukan → « Compétence utilisée » : plus de case « Regenerate », ni grisée ; le sort coché par défaut est « Sandstorm » (S2), un sort qui frappe. |

### Lupinus

Formes : 19813 Lupinus.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blade Surge » · 10618 · S1 | Troisième coup en zone ajouté : 2 coups de 0,5 × ATQ sur la cible puis 1 coup de 3,0 × ATQ sur tous les ennemis ; 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup seul. | 8a | `f229d2f1` | Chemin commun : « Compétence utilisée » → Blade Surge. Le total compte trois coups (le troisième, en zone, pèse six fois chacun des deux premiers avant artéfacts) ; la ligne d'artéfact « Dgts CRIT comp. cib. uniq. » (224) n'agit que sur les deux premiers. |
| « Blade Surge » · 10618 · S1 | Deux crans « Dégâts sur la cible visée » (défaut) et « Dégâts sur les autres ennemis » (3ᵉ coup seul, sur un autre ennemi à ses PV saisis) ; le résumé du sort dit la séquence ; le CLI aussi ; la recette valide le champ `cibleDegatsParSort`. | 8b | `12595440`, `d6c576b5`, `22dda1f2` | Chemin commun : sous la liste des sorts de « Compétence utilisée », deux crans à choisir ; basculer ne déplace rien ; le résumé du sort dit « … 2 coups · Cible unique, puis 1 coup · Zone ». |
| « Blade Surge » · 10618 · S1 | Le résumé sous l'objectif ajoute « autres ennemis » quand le cran « Dégâts sur les autres ennemis » est retenu ; la ligne du sort de `scripts/artifact-search.ts` dit la séquence ; la clé de `cibleDegatsParSort` refuse un zéro de tête. | 8c | `b55a02ec`, `62dc6dce`, `66309e93` | Cran « Dégâts sur les autres ennemis » choisi : le résumé sous l'objectif dit « Blade Surge · autres ennemis · … » ; rien de tel pour la cible visée. Au téléphone, le résumé peut passer sur une ligne de plus. |

### M. BISON

Formes : 24203 바이슨(바람) †, 24213 M. BISON.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Head Press » · 14113 · S3 | Séquence curée : 1 coup de 4,0 × ATQ sur la cible puis 1 coup de 5,2 × ATQ sur tous les ennemis (compétence auxiliaire 2762 de l'API SWARFARM, règle D12) ; avant, 2 coups de 4,0 × ATQ sur la cible (`coups: 2` de la donnée compte les deux phases). Total « Non critique » ×1,15 (ATQ 2 000, DEF cible 1 000). Deux crans « Dégâts sur la cible visée » / « Dégâts sur les autres ennemis » (5,2 × ATQ seul) ; 224 et 411 sur le premier coup seul (224 portait sur les deux coups). Skillups (+15 %) sur les deux coups : supposé, non confirmé. | P6 (SZ-2) | commit du lot P6 | Chemin commun → M. BISON → « Compétence utilisée » → « Head Press » : résumé « 1 coup · Cible unique, puis 1 coup · Zone » (avant : « 2 coups · Cible unique ») ; les deux crans sous la liste. |

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

### Magnum

Formes : 22704 Sniper Mk.I †, 22714 Magnum.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Snipe Preparation (Passive) » · 13214 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Snipe Preparation » (icône et nom du jeu) pose Buff ATQ — « whenever an enemy gains a beneficial effect from a skill » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Magnum → carte « État de mon monstre » : sous les vignettes, la ligne « Snipe Preparation » + « pose Buff ATQ — « whenever an enemy gains a beneficial effect from a skill » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Malite

Formes : 23303 Gargoyle †, 23313 Malite, 23403 가고일(바람) †, 23413 가고일(바람).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13503 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Masha

Formes : 23502 Beast Rider (feu) †, 23512 Masha.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fast Link » · 13607 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 100 % ; prose « The beast's attack decreases the enemy's Defense », la bête frappe en premier) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Masha → choisir « Fast Link » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

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

### Melissa

Formes : 21903 Chakram Dancer (vent) †, 21913 Melissa.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Double Strike » · 12608 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 50 %, note « First hit only ») entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Melissa → choisir « Double Strike » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Michelle

Formes : 15303 Epikion Priest (vent) †, 15313 Michelle.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Soul Revival » · 6713 · S3 | Sort sans attaque (résurrection, `0.5*{Current HP %}*{Target MAX HP} (Fixed)`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Michelle → « Compétence utilisée » : plus de case « Soul Revival », ni grisée ; le sort coché par défaut est « Absorb Mana » (S1), un sort qui frappe. |

### Mikene

Formes : 11601 Undine (eau) †, 11611 Mikene, 11621 Imperfect Undine †, 40501 Undine (eau) †, 700501 Undine (eau) †.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Revive » · 2611 · S3 | Sort sans attaque (résurrection, `0.4*{Target MAX HP} (Fixed)`) masqué de « Compétence utilisée » : il était affiché refusé (« Ces dégâts ne dépendent d’aucune statistique du monstre. »). Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Mikene → « Compétence utilisée » : plus de case grisée « Revive » ; les autres sorts de Mikene restent proposés. |

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

### Moore

Formes : 24501 Striker †, 24511 Moore.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Overdrive (Passive) » · 14411 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Overdrive » (icône et nom du jeu) pose Buff ATQ — « If you receive damage during the turn of the enemy » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Moore → carte « État de mon monstre » : sous les vignettes, la ligne « Overdrive » + « pose Buff ATQ — « If you receive damage during the turn of the enemy » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Mork

Formes : 31401 Tomb Warden †, 31411 Mork.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Lamplight in Darkness » · 21111 · S3 | Sort sans attaque (immunité, bouclier, `0.2*{MAX HP}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Mork → « Compétence utilisée » : plus de case « Lamplight in Darkness », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Nezuko Kamado

Formes : 31905 카마도 네즈코(어둠) †, 31915 Nezuko Kamado, 32015 Nezuko Kamado (non proposée par `formesJouables`).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Purification, Cooperation! » · 21415 · S3 | Sort désormais proposé et calculé (il était absent : formule vide dans la donnée) : 4,5 × ATQ, un coup, mono-cible, +20 % (compétence auxiliaire 4626 de l'API SWARFARM, règle D12). Les attaques des deux alliés restent hors calcul. Dernier sort calculable, il devient le sort coché par défaut (avant : « Triple Roundhouse Kick »). | P6 (HT-1) | commit du lot P6 | Chemin commun → Nezuko Kamado → « Compétence utilisée » : une case « Purification, Cooperation! », cochée par défaut ; résumé « 1 coup · Cible unique ». |

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

### Perna

Formes : 14502 Phoenix †, 14512 Perna.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Eternity (Passive) » · 3212 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Eternity » (icône et nom du jeu) pose Buff ATQ — « Rises from the ashes at the moment of death » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Perna → carte « État de mon monstre » : sous les vignettes, la ligne « Eternity » + « pose Buff ATQ — « Rises from the ashes at the moment of death » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Phenaka

Formes : 23304 Gargoyle †, 23314 Phenaka, 23404 가고일(빛) †, 23414 가고일(빛).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Stone Claws » · 13504 · S1 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Cumuls de Stone Claws » (jamais reformulée) ; l'icône et le nom du passif coiffent le réglage. | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (compteur), la description du passif « Stone Claws » en clair, avec icône et nom au-dessus ; aucun doublon ailleurs dans la carte. Stone Claws : la prose est aussi au « ? » de la case du sort S1 (11bis) — gardée aux deux endroits, décision de l'utilisateur. |

### Qilin Slasher

Formes : 32903 Qilin Slasher †, 32913 Qilin Slasher.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Against the Current (Passive) » · 22213 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Against the Current » (icône et nom du jeu) pose Buff ATQ — « When you take fatal damage from the enemy's attack » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Qilin Slasher → carte « État de mon monstre » : sous les vignettes, la ligne « Against the Current » + « pose Buff ATQ — « When you take fatal damage from the enemy's attack » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Ramon

Formes : 31404 Tomb Warden †, 31414 Ramon.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Cursed Tombstone » · 21114 · S3 | Sort désormais proposé et calculé (il était absent : formule vide dans la donnée) : 2,7 × ATQ + 0,29 × PV max, un coup, +15 % (compétence auxiliaire 4592 de l'API SWARFARM, règle D12). **Mono-cible** : la prose « Attacks the enemy » l'emporte sur `aoe: true` de la donnée ; 224 s'applique. Dernier sort calculable, il devient le sort coché par défaut (avant : « Coffin Bash »). | P6 (HT-1) | commit du lot P6 | Chemin commun → Ramon → « Compétence utilisée » : une case « Cursed Tombstone », cochée par défaut ; résumé « 1 coup · Cible unique » (jamais « Zone »). |

### Raviti

Formes : 21003 Harg †, 21013 Raviti.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Deer's Song » · 11813 · S3 | Sort sans attaque (purification, immunité, bouclier, `2.5*{DEF}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. | 15c | `a65b2f28`, `f7bd6a1f` | Chemin commun → Raviti → « Compétence utilisée » : plus de case « Deer's Song », ni grisée ; le sort coché par défaut est un sort qui frappe. |

### Rick (feu)

Formes : 31002 Rick †, 31012 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20707 · S2 | Critique garanti contre une cible affligée (« the Critical Rate increases to 100% when attacking an enemy with harmful effects ») : interrupteur « Shockwave Fist (critique garanti) », éteint par défaut, ou Brise DEF / Marque saisies → les deux coups critiques. Nouveau cadre « Prendre en compte les débuffs posés entre les coups », ligne « Réduction de DEF » : posée « Après le coup 1 », le coup 2 devient critique (décision de l'utilisateur, A.2 ter) ET subit la DEF réduite par ce coup 1, comme Ghost Slash ou Triple Crush (décision de l'utilisateur du 2026-10-03). Sans scénario, rien ne change. Résumé du sort : « critique garanti si la cible a un débuff ». | 15d, 15f | `292716c2`, `616e09a1` | Chemin commun → Rick (feu) → « Compétence utilisée » → Shockwave Fist : le résumé, l'interrupteur et le cadre des poses entre les coups. En « Non critique » : interrupteur allumé, les deux coups critiques et « Non critique » désactivé ; interrupteur éteint et aucune pose, deux coups non critiques (total inchangé) ; interrupteur éteint et pose « Après le coup 1 », le second coup devient critique et le total monte nettement au-dessus du cas sans pose (DEF réduite sur ce coup). |

### Rick (ténèbres)

Formes : 31005 Rick †, 31015 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20710 · S2 | Comme Rick (feu), 20707, y compris la DEF réduite du coup 2 (15f). | 15d, 15f | `292716c2`, `616e09a1` | Comme Rick (feu), sur Rick (ténèbres) : avec la pose « Après le coup 1 », le total du sort dépasse celui du seul critique garanti du coup 2. |

### Rick (vent)

Formes : 31003 Rick †, 31013 Rick.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Shockwave Fist » · 20708 · S2 | Comme Rick (feu), 20707, y compris la DEF réduite du coup 2 (15f) (le `Destroy HP` de 20708 porte 50, hors de ce lot). | 15d, 15f | `292716c2`, `616e09a1` | Comme Rick (feu), sur Rick (vent) : au témoin (1 000 ATQ, 100 % de Dgts Crit, DEF cible 1 000, « Non critique »), 848,5 sans pose, 2 231,3 avec la pose après le coup 1 (1 272,8 avant 15f). |

### RYU

Formes : 24001 류(물) †, 24011 RYU.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Mind's Eye (Passive) » · 13911 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Mind's Eye » (icône et nom du jeu) pose Buff ATQ — « If you receive damage during the turn of the enemy » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir RYU → carte « État de mon monstre » : sous les vignettes, la ligne « Mind's Eye » + « pose Buff ATQ — « If you receive damage during the turn of the enemy » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Sagar

Formes : 24703 Slayer †, 24713 Sagar.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Great Sword of the End » · 14613 · S3 | Séquence curée : 1 coup de 4,0 × ATQ sur la cible puis 1 coup de 5,2 × ATQ sur tous les ennemis (compétence auxiliaire 2830 de l'API SWARFARM, règle D12) ; avant, 2 coups de 4,0 × ATQ en zone (`coups: 2` compte les deux phases, `aoe: true` est la portée de la seconde). Total « Non critique » ×1,15 (ATQ 2 000, DEF cible 1 000). Deux crans « Dégâts sur la cible visée » / « Dégâts sur les autres ennemis » (5,2 × ATQ seul) ; 224 agit désormais sur le premier coup, 411 sur le premier coup seul. Skillups (+15 %) sur les deux coups : supposé, non confirmé. | P6 (SZ-2) | commit du lot P6 | Chemin commun → Sagar → « Compétence utilisée » → « Great Sword of the End » : résumé « 1 coup · Cible unique, puis 1 coup · Zone » (avant : « 2 coups · Zone ») ; les deux crans sous la liste. |

### Satoru Gojo

Formes : 30301 고죠 사토루(물) †, 30311 Satoru Gojo.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Six Eyes (Passive) » · 20011 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Six Eyes » (icône et nom du jeu) pose Buff DEF — « whenever your turn ends » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff DEF »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Satoru Gojo → carte « État de mon monstre » : sous les vignettes, la ligne « Six Eyes » + « pose Buff DEF — « whenever your turn ends » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Sia

Formes : 12134 Sia (seule forme à porter l'identifiant 3454 ; les autres « Blackout Kick » du corpus, au texte différent, ne reçoivent rien).

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Blackout Kick » · 3454 · S1 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 50 %, note « First hit ») entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose pour le sort seul, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. Les coups de « Great Friends » (passif) : voir la ligne P4b. | P4 | `730927e7` | Chemin commun → Sia → choisir « Blackout Kick » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |
| « Great Friends (Passive) » · 3464 · S3 | Le passif suit le sort (« When using a skill on your turn, attacks the target 2 to 3 more times ») : sous le scénario de poses de « Blackout Kick », ses coups lisent l'état de la cible après le dernier coup du sort, réduction de DEF posée comprise. Posée « Après le coup 1 » : total de l'objectif ×1,935 contre sans pose (sort ×1,682, passif entièrement sous la DEF réduite ; avant : ×1,429), DEF cible 1 500, ATQ 1 000, non critique. Sans scénario, total inchangé. | P4b | `09ee8342` | Chemin commun → Sia → choisir « Blackout Kick » → réduction de DEF « Après le coup 1 » : le total monte davantage qu'avant P4b ; aucune pose : total inchangé. |

### Silver Tail

Formes : 34901 Silver Tail †, 34911 Silver Tail.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Will of the Deep Woods (Passive) » · 24111 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Will of the Deep Woods » (icône et nom du jeu) pose Buff ATQ — « If no harmful effects were removed » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. Le porteur compté parmi « all allies » : lecture de la prose, l'effet de la fiche porte `surSoi: false` (non prouvé). | P2 | `87e03514` | Outils → Optimizer → choisir Silver Tail → carte « État de mon monstre » : sous les vignettes, la ligne « Will of the Deep Woods » + « pose Buff ATQ — « If no harmful effects were removed » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

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

### Theomars

Formes : 19201 Ifrit †, 19211 Theomars.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Elemental King (Passive) » · 10012 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Elemental King » (icône et nom du jeu) pose Buff ATQ — « When you take fatal damage » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Theomars → carte « État de mon monstre » : sous les vignettes, la ligne « Elemental King » + « pose Buff ATQ — « When you take fatal damage » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Theonia

Formes : 34205 Justice †, 34215 Theonia.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Summary Justice » · 23515 · S3 | +100 % de dégâts quand l'ATQ ennemie saisie est strictement inférieure à l'ATQ du build (« For enemies with Attack Power lower than yours ») ; le champ « ATQ adverse » s'ouvre pour ce sort. Au témoin (ATQ 1 000), 1 832,84 contre une ATQ ennemie de 1 000, 3 665,68 contre 999. La clause de VIT (« Attack Speed lower than yours ») reste non comptée. Une ancienne recette sans `enemyAtk` prend la valeur affichée (1 000) au lieu de 0 : à ATQ du build 900, le total du moteur passe de 3 299,1090 (condition allumée à tort) à 1 649,5545 ; à 1 200, 4 398,8120 inchangé (15f). | 15e, 15f | `404472a3`, `372168cd` | Chemin commun → Theonia → « Compétence utilisée » → Summary Justice : un champ « ATQ adverse » (1 000 par défaut) ; sous l'ATQ du build, le total double ; à l'égalité ou au-dessus, rien. Après import d'une recette exportée avant ce champ (sans `enemyAtk`), le résultat est celui du champ affichant 1 000. |

### Tilasha

Formes : 11605 Undine (ténèbres) †, 11615 Tilasha.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Dark Return » · 2615 · S3 | Sort sans attaque (résurrection et tour gagné, `1 (Fixed)`) masqué de « Compétence utilisée » : il était affiché refusé (« Ces dégâts ne dépendent d’aucune statistique du monstre. »). Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Tilasha → « Compétence utilisée » : plus de case grisée « Dark Return » ; les autres sorts de Tilasha restent proposés. |

### True Devil Kazuya

Formes : 2003705 True Devil Kazuya.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Devil Gene Awakening (Passive) » · 20021303 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Devil Gene Awakening » (icône et nom du jeu) pose Buff ATQ et Buff DEF — « at the start of its turn » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ », « Buff DEF »), rien ne s'allume d'office. Forme de boss (prose « the boss's ») : jouabilité soumise à D6 du lot 13b ; prose seule, fiche sans effet. | P2 | `87e03514` | Outils → Optimizer → choisir True Devil Kazuya → carte « État de mon monstre » : sous les vignettes, la ligne « Devil Gene Awakening » + « pose Buff ATQ et Buff DEF — « at the start of its turn » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Übel (eau)

Formes : 36001 Übel †, 36011 Übel.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Reelseiden・Flurry » · 25206 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 50 %, note « 1st hit » ; en zone) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Übel (eau) → choisir « Reelseiden・Flurry » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Übel (ténèbres)

Formes : 36005 Übel †, 36015 Übel.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Reelseiden・Flurry » · 25210 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 50 %, note « 1st hit » ; en zone) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. | P4 | `730927e7` | Chemin commun → Übel (ténèbres) → choisir « Reelseiden・Flurry » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

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

### Vermilion Bird Dancer

Formes : 32605 Vermilion Bird Dancer †, 32615 Vermilion Bird Dancer.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Rite of Ashes » · 22015 · S3 | Sort désormais proposé et calculé (il était absent : formule vide dans la donnée) : 4,5 × ATQ, un coup, mono-cible, +20 % (compétence auxiliaire 4710 de l'API SWARFARM, règle D12). Les attaques des deux alliés restent hors calcul. Dernier sort calculable, il devient le sort coché par défaut (avant : « Triple Flame Kick »). | P6 (HT-1) | commit du lot P6 | Chemin commun → Vermilion Bird Dancer → « Compétence utilisée » : une case « Rite of Ashes », cochée par défaut ; résumé « 1 coup · Cible unique ». |

### Vidurr

Formes : 22402 Giant Warrior †, 22412 Vidurr.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Return of Fighter (Passive) » · 13012 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Return of Fighter » (icône et nom du jeu) pose Buff ATQ et Buff DEF — « at the moment of death to be revived with 30% HP » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ », « Buff DEF »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Vidurr → carte « État de mon monstre » : sous les vignettes, la ligne « Return of Fighter » + « pose Buff ATQ et Buff DEF — « at the moment of death to be revived with 30% HP » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Werner

Formes : 30901 Werner †, 30911 Werner.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Honored One (Passive) » · 20611 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Honored One » (icône et nom du jeu) pose Buff DEF — « whenever your turn ends » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff DEF »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Werner → carte « État de mon monstre » : sous les vignettes, la ligne « Honored One » + « pose Buff DEF — « whenever your turn ends » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### White Tiger Blade Master

Formes : 32805 White Tiger Blade Master †, 32815 White Tiger Blade Master.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Attack Instinct (Passive) » · 22115 · S3 | La prose du jeu du passif s'affiche en clair, une seule fois, sous le réglage « Attack Instinct » (jamais reformulée). | 11 | `5a21fd78` | Chemin commun → « Stats acquises en combat » : sous le contrôle (Jeton), la description du passif « Attack Instinct (Passive) » en clair ; aucun doublon ailleurs dans la carte. |

### Xiana

Formes : 23505 Beast Rider (ténèbres) †, 23515 Xiana.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fast Link » · 13610 · S2 | Effet posé entre les coups, par identifiant : « Réduction de DEF » (donnée `Decrease DEF` 100 % ; prose « The beast's attack decreases the enemy's Defense », la bête frappe en premier) entre dans le cadre des poses entre les coups ; posée « Après le coup 1 », le coup 2 subit la DEF réduite (×1,682 contre sans pose, DEF cible 1 500, ATQ 1 000). Sans pose choisie, total inchangé. L'ATB de « Late Night Ambush » (13615) n'est pas touché. | P4 | `730927e7` | Chemin commun → Xiana → choisir « Fast Link » : le cadre des poses entre les coups apparaît avec « Réduction de DEF » ; « Après le coup 1 » monte le total, aucune pose : total inchangé. |

### Yuji Itadori (feu)

Formes : 30402 이타도리 유지(불) †, 30412 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20107 · S2 | Comme Rick (feu), 20707 : critique garanti contre une cible affligée (interrupteur « Divergent Fist (critique garanti) », Brise DEF ou Marque) ; « Réduction de DEF » posée « Après le coup 1 » dans le cadre des poses entre les coups → le coup 2 critique ET subissant la DEF réduite (15f, décision du 2026-10-03). Le S3 « Black Flash: Maximum Power » (20112) reste critique garanti sans condition. | 15d, 15f | `292716c2`, `616e09a1` | Comme Rick (feu), sur Yuji Itadori (feu), sort Divergent Fist : avec la pose « Après le coup 1 », le total dépasse celui du seul critique garanti du coup 2. |

### Yuji Itadori (ténèbres)

Formes : 30405 이타도리 유지(어둠) †, 30415 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20110 · S2 | Comme Yuji Itadori (feu), 20107, y compris la DEF réduite du coup 2 (15f). | 15d, 15f | `292716c2`, `616e09a1` | Comme Rick (feu), sur Yuji Itadori (ténèbres) : avec la pose « Après le coup 1 », le total dépasse celui du seul critique garanti du coup 2. |

### Yuji Itadori (vent)

Formes : 30403 이타도리 유지(바람) †, 30413 Yuji Itadori.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Divergent Fist » · 20108 · S2 | Comme Yuji Itadori (feu), 20107, y compris la DEF réduite du coup 2 (15f). Témoin du lot (1 000 ATQ, 100 % de Dgts Crit, DEF cible 1 000, « Non critique ») : 848,5 sans débuff ni scénario, 2 231,3 avec la pose après le coup 1 (1 272,8 avant 15f), 1 697,1 interrupteur allumé. | 15d, 15f | `292716c2`, `616e09a1` | Comme Rick (feu), sur Yuji Itadori (vent) : le témoin ci-contre, 848,5 / 2 231,3 / 1 697,1. |

### Zaiross

Formes : 14402 Dragon †, 14412 Zaiross.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Fiery Breath » · 2912 · S3 | Une ancienne recette sans `enemyAtk` prend l'ATQ ennemie affichée par l'écran (1 000) au lieu de 0 : le +50 % et le critique garanti « if the enemy's Attack Power is half or less than your Attack Power » (seuil inclusif à 50 % de l'ATQ du build) n'étaient allumés à tort que parce que 0 passait sous le seuil. Au témoin du lot (ATQ du build 900, DEF cible 1 000, « Non critique »), 3 578,3305 avant, 1 216,1646 après ; à 1 200 d'ATQ, 4 771,1073 avant, 1 621,5528 après (seuil 600 < 1 000). | 15f | `372168cd` | Chemin commun → Zaiross → « Compétence utilisée » → Fiery Breath : le champ « ATQ adverse » affiche 1 000 ; importer une recette exportée avant ce champ donne le même total que ce champ à 1 000 (bonus et critique garanti seulement si l'ATQ du build vaut au moins 2 000). |

### Zenitsu Agatsuma

Formes : 32203 아가츠마 젠이츠(바람) †, 32213 Zenitsu Agatsuma.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Man Strong in Crisis (Passive) » · 21613 · S3 | Rappel dans « État de mon monstre », sous les vignettes des buffs : le passif « Man Strong in Crisis » (icône et nom du jeu) pose Buff ATQ — « When you take fatal damage from the enemy's attack » (extrait littéral de la prose). Aucun calcul ne change : le buff reste à allumer à la main (« Buff ATQ »), rien ne s'allume d'office. | P2 | `87e03514` | Outils → Optimizer → choisir Zenitsu Agatsuma → carte « État de mon monstre » : sous les vignettes, la ligne « Man Strong in Crisis » + « pose Buff ATQ — « When you take fatal damage from the enemy's attack » » ; aucune autre ligne de ce type ; le total ne bouge pas tant que la vignette reste éteinte. |

### Zeratu

Formes : 14605 Chimera (ténèbres) †, 14615 Zeratu.

| Sort (nom du jeu · identifiant · slot) | Ce qui change | Lot | Commit(s) | Vérifier à l'écran |
| --- | --- | --- | --- | --- |
| « Unleashed Fury » · 4210 · S2 | Sort sans attaque (gain d'ATQ, immunité et tour gagné, `3.5*{ATK}`) masqué de « Compétence utilisée » : il était proposé, calculé comme des dégâts et retenu par défaut. Confirmé par l'utilisateur, lot 15g. | 15h | `53668cc2` | Chemin commun → Zeratu → « Compétence utilisée » : plus de case « Unleashed Fury », ni grisée ; le sort coché par défaut est « Trample » (S1), un sort qui frappe. |

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
| Garde des séquences de coups curées par empreinte de la donnée (`formule`, `coups`, `aoe` de la fiche), distincte des groupes ; Blade Surge identique au chiffre près sur ses 8 identifiants et 11 formes | P6 (SZ-1) | commit du lot P6 |

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
  `FORMULES_CUREES_PAR_ID` (seul `3213` ; pour un sort actif à formule vide,
  `21114`, `21415`, `22015` depuis P6), l'ignore DEF à partir d'un coup
  (seuls les six sorts des Blade Dancers). La séquence de coups curée n'est
  plus propre à Blade Surge depuis P6 (SZ-2 : Abigail, Emily, M. BISON,
  Sagar).
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
- **Sorts sans attaque** (lots 15c et 15h) : 36 sorts masqués (28 au lot 15c,
  8 confirmés au lot 15g et masqués au 15h), chacun par sa prose ;
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
  relevé ; que cette réduction baisse aussi la DEF du coup 2 est une autre
  décision de l'utilisateur, du 2026-10-03 (lot 15f) : modélisé, 2 231,3 au
  témoin contre 1 272,8 avant, sans scénario inchangé (848,5). Byungchul :
  un passif bloqué (Oblivion) n'est pas modélisé.
- **Ciri et Birgitta** (lot 15e) : aucun relevé en jeu ; le +50 est lu en
  points, comme le Speed tune. Que l'artéfact « Effet aug. VIT » amplifie le
  cumul de Birgitta, typé « Buff » dans la donnée (« Neutral » chez Ciri),
  n'est pas établi. La hausse des dégâts « as the target's HP status
  decreases » des deux coups du passif reste non modélisée (plancher).
- **Theonia** (lot 15e) : la clause de VIT attend le relevé R11.
- **ATQ ennemie absente d'une recette** (lot 15f) : une recette sans
  `enemyAtk` (ancienne recette) prend la valeur que l'écran affiche, 1 000,
  et non plus 0 qui allumait la condition « ATQ cible inférieure » alors que
  le champ affichait 1 000 (décision de l'utilisateur du 2026-10-03,
  levant D5 de `13b-pv-comparaisons-boucliers`). Concerne Theonia, Kassandra
  (vent), Eleni (vent) et Zaiross.

---

Mise à jour dans le même commit que tout changement du calcul ou de
l'affichage d'un monstre ou d'un sort (A.8).
