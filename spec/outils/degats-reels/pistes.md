# Dégâts réels — pistes futures

**Statut :** ÉTAT ACTUEL — liste les pistes futures du calcul des dégâts réels, chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on envisage une mécanique de dégâts de plus, un réglage de la modale « Dégâts réels » ou un relevé en jeu, avant de les proposer comme nouveaux
**Ne pas lire si :** on cherche ce que le calcul fait aujourd'hui : la spec du mécanisme le dit (l'index [../degats-reels.md](../degats-reels.md) dit laquelle)
**Voir aussi :** ../degats-reels.md, valeurs-de-jeu-curees.md, formules-et-combat.md, ../optimizer/pistes.md

Une piste est ce qui n'est pas fait : le **constat** (ce que le code fait,
avec sa coordonnée), l'**idée** (la forme du réglage quand elle est déjà
choisie) et ce qui la **bloque**. Les valeurs de jeu fournies sont dans
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md). Un relevé en jeu est
un rapport entre deux lancers qui ne diffèrent que d'une chose, avec sa
règle de décision posée d'avance (skill `game-data-curation`, § 6 bis), et
ne vaut que pour le sort mesuré. Un sort dont une part décidée n'est pas
codée porte « Calcul partiel »
([formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](formules-et-combat.md)).

## Vitesse

### Gold Headband : arrondi de la VIT par cumul

- **Constat** : chaque cumul ajoute 12 % de la VIT de base, sans arrondi
  dans les dégâts (`statsDeCombat`, `src/lib/damage.ts` : +13,92 par cumul
  pour la base 116 de Mei Hou Wang), arrondi au supérieur par cumul dans
  le Speed tune (`pointsDeGain`, `src/lib/speedTunePassif.ts` : +14). Pour
  une base de 100, les deux lectures donnent +12 et +120
  ([conditions-et-audit.md § Audit des dégâts conditionnels — partie 2](conditions-et-audit.md)).
- **Idée** : une seule lecture, la même pour les deux outils.
- **Bloque** : un relevé en jeu de la VIT affichée par Mei Hou Wang sans
  cumul puis à dix cumuls. Règle de décision posée d'avance : un écart de
  +139 exclut l'arrondi supérieur par cumul ; un écart de +140 ne le
  distingue pas d'un simple arrondi de l'affichage (139,2 → 140).

### Arrondi de la VIT sous buff de vitesse

- **Constat** : `maVitCombat` (`src/lib/damage.ts`) rend une VIT
  flottante, `VIT × (100 + buff) / 100` sans arrondi : 168 sous le buff de
  30 % donnent 218,4. Cette VIT nourrit `{SPD}`, le critique garanti si plus
  rapide que la cible et l'écart de VIT de Sonia
  ([passifs-offensifs.md](passifs-offensifs.md)). `src/lib/speed.ts` ne
  modélise pas le buff de vitesse : aucune référence interne à laquelle se
  comparer.
- **Idée** : appliquer l'arrondi du jeu une fois connu, partout où
  `maVitCombat` est lue.
- **Bloque** : une source de mécanique (swcalc.cz) ou un relevé en jeu : la
  VIT affichée d'un monstre de VIT de combat connue, sans puis sous buff de
  vitesse, choisie pour que le produit tombe entre deux entiers. Ne pas
  changer d'arrondi sans cette preuve, parce qu'on introduirait un écart
  d'un point là où il n'y en a peut-être aucun.

## Attaques déclenchées et hors tour

### Attaques conjointes : lignes d'artéfact 209 et 225

- **Constat** : les lignes 209 (« Dégâts d'attaque conjointe ») et 225
  (« Dégâts contre/attaque conjointe ») existent
  (`src/lib/artifacts.ts`), mais le calcul des dégâts n'en lit aucune ; la
  ligne 224 (« Dmg crit mono-cible à ton tour ») est lue, selon la portée
  du sort (`damage.ts`).
- **Idée** : laisser choisir une attaque conjointe pour compter 209 et
  225, avec le rôle du monstre dans le tour pour 224.
- **Bloque** : périmètre et cas sans formule à qualifier : un chantier à
  cadrer.

### Compétence active appelée par un sort

- **Constat** : `ATTAQUES_APPELEES_PAR_DECLENCHEUR` (`src/lib/damage.ts`)
  est vide : aucune amorce n'est curée, et aucun effet posé par un
  déclencheur n'est modélisé
  ([attaque-apres-un-sort.md § Ce qu’il faudra fournir pour un autre cas](attaque-apres-un-sort.md)).
- **Idée** : l'interrupteur d'une attaque appelée sous un en-tête à part,
  « Attaques déclenchées ». Seal Punch (`8111`) gardé : son Rolling Punch
  se calcule sans la VIT posée, l'écart (environ 0,5 %) dit à l'écran.
  Fire! de Bella suit son S1, S2 ou S4, interrupteur allumé par défaut.
  Après Shoryuken et Iron Uppercut (`13907`, `13908`, `13910`, `14407`,
  `14408`, `14410`), un interrupteur « Marque posée après la S2 » pour le
  S1 enchaîné, au lieu d'un relevé. Tiger Punch (`8112`) : le buff d'ATQ
  posé avant l'attaque appelée.
- **Bloque** : un changement de code.

### Répétition du sort retenu

- **Constat** : Burning Whip (`6912`), Exploding Hands (`11015`) et
  Forbidden Power (`4215`) n'ont aucune entrée dans `src/lib/damage.ts`,
  alors que leurs valeurs sont fournies ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md),
  « Déclenchements de Hwa et Jackie », « Zeratu — Forbidden Power ») ; la
  répétition d'Elise sous 50 % de PV non plus.
- **Idée** : répéter le profil du sort retenu, sans récursion, sous
  interrupteur, avec des clés de réglage distinctes de celles du sort. Les
  conditions sur la cible (Hwa, Blood Talon, Heaven's Might, Hunting Hawk)
  sont des interrupteurs. Les PV propres viennent d'une source unique ; un
  seuil de PV se règle par un interrupteur.
- **Bloque** : trois relevés. Elise sous 50 % de PV, répétition sur coup 1
  de la S1 : 1,00 → répétition pleine, 0,50 → demi. Burning Swing de Hwa
  sur une cible sans effet néfaste, répétition sur coup 1 : environ 1,15 →
  le dégât continu posé compte. Exploding Hands de Jackie, répétition sur
  coup 1 : 1,00 → les améliorations portent sur la répétition.

### Chaînes ordonnées

- **Constat** : aucune chaîne de sorts n'est calculée. Les S2 des Kung Fu
  Girls appelés par leur S1 (`8216`, `8217`, `8219`) ne sont pas curés ; ni
  Trinity Claymore (`22515`), ni Backlash avant elle (Hwoarang et Taebaek
  ténèbres), ni Shoot n' Slash de Barque (`10223`).
- **Idée** : la chaîne entière sous un interrupteur par appel, dans l'ordre
  fourni ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md), « Chaînes
  des Kung Fu Girls (sens) », « Trinity Claymore », « Barque — Shoot n'
  Slash ») ; Backlash appelé avant.
- **Bloque** : un changement de code, après la piste « Compétence active
  appelée par un sort ».

### Événements du monstre choisis seuls

- **Constat** : seul Tempest est `selectionnableCommeSort`
  (`src/lib/damage.ts`), et un passif ne se choisit seul que sans
  ajustement propre à la boucle des passifs
  ([attaque-apres-un-sort.md § Choisi seul — « Compétence utilisée »](attaque-apres-un-sort.md)).
- **Idée** : chaque événement du monstre choisissable seul (attaque à la
  mort, riposte, attaque d'état, passif qui frappe), sans les attaques
  d'alliés. Danu : un interrupteur « le passif se déclenche après ce sort »
  et le passif choisissable seul. Lob Ear de Gollum lumière : un état
  exclusif « cible étourdie ». Übel vent : deux coups ajoutés par défaut.
- **Bloque** : un changement de code, et des relevés, chacun un rapport à
  un sort du monstre sur la même cible. Sapsaree, tour gagné sous
  incapacité / S1 Bring It Here! (environ 1 → profil de la S1). Ripostes à
  formule propre de Hollyberry ou Manon, Isillen, Vritra (environ 1 →
  aucun facteur, environ 0,75 → facteur de `Counter`). Facteur de riposte
  du set Revenge, même S1 sur son tour puis en riposte, puis Aragorn ou
  Night Fang, Ursha, jamais étendu aux autres ripostes. Drogan 2A, Jultan,
  même effet contre ~500 puis ~2 500 de DEF (environ 1 → ignore la DEF).
  Legolas ou Elder Horn, attaque d'état / coup de Sindar's Volley ; Pure
  Vanilla ou Angela, riposte / bouclier absorbé ; Malite, riposte en
  statue / Earth Strike ; Madeleine Cookie et Pavé, additionnelle / S1 ;
  Artamiel, S1 critique à k cumuls de Judge puis la contre-attaque ;
  Chakra, deux VIT puis Wild Bolt ; Übel vent, chaque coup ajouté sur une
  cible sans réduction de DEF ; Danu, passif / Brutal Fists (environ
  2,304 → formule confirmée). Facultatifs : Ramon et Psamathe ; Jin et Kai
  feu, Frieren (écart de plus de 5 % → facteur hors tour).

## Coups et séquences

### Plages de coups à relever et coups « au hasard »

- **Constat** : `COUPS_VARIABLES_CONNUS` et `COUPS_VARIABLES_PAR_ID_CONNUS`
  (`src/lib/damage.ts`) ne portent ni Sindar's Volley ni Sylvan Volley
  (2 à 5 coups, valeur fournie), ni Wild Shot! (`13306`), Cleave
  (`19910`), Exorcism Orb (`20510`), Blade Dance of the Reaper (`10711`,
  Stella), Chain Fire, ni les sorts de Lala et de Coco : ils frappent le
  nombre de coups de la donnée. Les coups portés à « un ennemi au hasard »
  (Rolling Punch, Kacey, Zenitsu, Qilin Slasher, Katarina) comptent tous
  sur la cible configurée : calcul trop favorable.
- **Idée** : un compteur borné où l'on choisit combien de coups touchent
  la cible. Le défaut d'une plage est son minimum. Stella : coups selon la
  VIT totale de combat ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)).
  Chain Fire : salves de deux flèches, compteur par pas de 2. Lala : un
  sélecteur de 0 à 5 [Attack!], son S3 sans coup propre. Coco : compteur des
  sphères restantes sur S1 et S2, 5 par défaut.
- **Bloque** : un changement de code, et des relevés. Wild Shot! avec 4, 3,
  2 puis 1 ennemi vivant, coups reçus par un ennemi : une table, ou une
  somme constante répartie. Cleave et Exorcism Orb : la règle du nombre de
  coups, à tester d'abord en jeu, puis ATQ sous la DEF, à 1,5 fois, à 2
  fois. Lala avec 0, 2 puis 5 effets nocifs sur les alliés. Coco contre une
  DEF basse puis ~3 000 : sphère égale à ±3 % → `(Fixed)` exact. Hors
  inventaire : Crow Hunt et Rat Hunt sous Immunité.

### Séquences à valeur relevée

- **Constat** : `SEQUENCES_DE_COUPS_PAR_ID_CONNUS` (`src/lib/damage.ts`) ne
  porte ni Shoulder Smash (`22615`), ni Triple Break Combo (`23115`), ni
  Oathbreakers (`23815`), ni Spirits of Wolf Warriors (`24315`), ni
  Explosive Bullet, Undefeated Warrior (`9515`), Tempest Sword (`10613`) ou
  Guilty Sentence (`23507`, `23508`, `23510`) : leur phase que la donnée ne
  chiffre pas manque au total.
- **Idée** : une séquence curée par sort
  ([sequences-de-coups.md § La séquence curée — une table par identifiant](sequences-de-coups.md)).
  Tempest Sword : troisième coup au ratio des deux premiers (valeur
  fournie). Guilty Sentence : une question « ta cible a-t-elle la DEF la
  plus faible ? » (oui : deux coups ; non : le coup de zone seul) ; pour
  Theonia, second coup à 3,3, valeur d'une sous-compétence de l'API que la
  prose ne contredit pas. Un effet posé entre deux groupes se règle par le
  choix « après quel coup ».
- **Bloque** : des relevés, chacun sur la cible visée. Shoulder Smash,
  coup 3 / coup 1 (deux nombres seulement → la zone exclut la cible).
  Oathbreakers, chaque coup de zone / coup 1. Explosive Bullet, chaque
  phase / S1 Cross Fire. Undefeated Warrior, suite / coup 1. Guilty
  Sentence d'Agrenia et de Driana, coup 2 / coup 1 sur l'ennemi de plus
  faible DEF non touché par la Brise DEF : 3,3 ou 3,2. Triple Combo et
  Triple Crush, coup 3 / coup 2 avec la Brise DEF du coup 1 posée : 1,00 à
  2 % → aucun coefficient final.

### Part copiée sur un autre ennemi

- **Constat** : Thunder Break (`2908`), Lightning of Cycle (`9413`) et
  Crush (`4211`) infligent à un autre ennemi une fraction des dégâts de la
  cible ; le calcul ne la compte pas, et « Autres ennemis »
  (`cibleDegatsParSort`) ne leur est pas proposé.
- **Idée** : proposer « Autres ennemis » pour ces sorts, avec la fraction.
- **Bloque** : un relevé, un sort à la fois : A visée, B autre ennemi de DEF
  et de PV très différents. D_B / D_A constant à 0,20, 0,75 ou 0,60
  (±1 %) malgré B → copie ; sinon recalcul par cible ; Crush : D_B critique
  → copie.

### Poses entre les coups : rang, buff posé par le sort, Eightfold

- **Constat** : le sélecteur de pose propose tous les rangs, même un coup
  qui ne pose rien (Crushed Hopes `10413`, `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS`,
  `src/lib/damage.ts`). Eightfold (`21607`, `21609`, `22207`, `22209`) ne
  compte pas son +50 % quand la jauge d'attaque de la cible est à 0. La
  Marque d'Axe Technique of the Mercenary Queen (`18007`, `18009`) n'est que
  dans la prose : non curée.
- **Idée** : ne proposer que les coups qui posent l'effet. Eightfold : à
  partir du coup choisi, comme l'ignore DEF des Blade Dancers
  ([formules-et-combat.md](formules-et-combat.md)). Un buff que le sort se
  pose : un interrupteur allumé par défaut quand ce sort est choisi.
- **Bloque** : un changement de code, et des relevés. Buff posé par le
  sort, monstre déjà sous ce buff puis sans : environ 1,00 → actif avant
  l'attaque. Barbara contre ~3 000 de DEF et 4 buffs : coup 2 / coup 1
  très au-dessus de 1 → la cavalière est le coup 2 ; Savannah sous k
  débuffs : environ 1 + 0,15k. Nobara ou Aya ténèbres sur une cible déjà
  sous Brise DEF : coup 2 / coup 1 environ 2 → +100 % au coup 2 seul.
  Solveig ou Berghild : l'icône de Marque après le sort. Hellfire sans puis
  avec Brise DEF (~1 500 de DEF) : environ 1 → la Brise DEF précède le
  coup, environ 2,36 → après.

### Comptes propres et jauge absorbée

- **Constat** : aucun compte propre des dégâts continus sur la cible
  (Yoga Sunburst `14213`, Chemical Gas Spray `14713`), ni des effets
  retirés aux alliés, ni de la jauge d'attaque absorbée (Xiana, Theodora)
  n'existe dans `src/lib/damage.ts`.
- **Idée** : un compteur propre « dégâts continus sur la cible », +50 % par
  dégât continu, la prose faisant foi
  ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md), « DHALSIM,
  Jarrett ») ; les autres comptes sur le même modèle.
- **Bloque** : des relevés. Yoga Sunburst et Chemical Gas Spray, coup 2 /
  coup 1 après un dégât continu posé par le coup 1 : 1,3 à 1,5 → ceux du
  sort comptent. Satoru Gojo ou Werner, alliés portant 0, 1, 2 puis 4
  effets néfastes. Xiana et Theodora, jauge de la cible vers 0 puis à 30 %
  ou plus. Bayek ou Omar eau, deux cibles de même DEF et de PV très
  différents. Eshir contre 0, 1 puis 3 buffs. Yuji et Rick eau et lumière,
  suites critique et non critique (environ 1,20 → règle confirmée). Hors
  inventaire : Mach Crush à 0, 1 puis 2 débuffs.

### Effets entre coups hors inventaire

- **Constat** : `EFFETS_ENTRE_COUPS_CONNUS` et
  `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS` (`src/lib/damage.ts`) ne portent que
  des sorts examinés un par un ; deux familles hors de l'inventaire de
  l'audit, de l'ordre de 200 et de 80 sorts, restent à trier.
- **Idée** : les trier par un balayage du corpus, puis curer par
  identifiant ce qui pèse sur un total.
- **Bloque** : le triage, à refaire sur `public/data/skills/`.

## Défense, critique et conditions

### Combat de boss

- **Constat** : aucune notion de combat de boss dans `src/lib/damage.ts`
  (commentaires de `BONUS_FIXE_CIBLE_PVMAX_CONNUS` et de
  `DEBORAH_AMPLIFY`) : seul le cas hors boss est calculé, pour Spear of
  Tenacity (Pholus), Comeuppance, le passif de Deborah (30 %, 15 % contre
  un boss) et les clauses « boss » d'autres sorts.
- **Idée** : un réglage global « combat de boss », lu par toutes les
  clauses « boss ».
- **Bloque** : le libellé du réglage, une décision d'interface. Agrius en
  combat de boss attend en plus un relevé : écart de VIT nul ou négatif,
  environ +100, puis +200 ou plus (environ 0,5 → linéaire, environ 0 →
  palier).

### Ignore DEF conditionnel

- **Constat** : six sorts comptent l'ignore DEF en permanence et portent
  « Calcul partiel » (`CALCUL_PARTIEL_PAR_ID`, `src/lib/damage.ts`) :
  Madness Judgement (`13406`, `13410`), Unlimited Power (`15511`), Start of
  Attacking (`13611`), Thunder Strike (`7713`), Sword of Discharge
  (`6013`) ; calcul trop favorable. Meteor Strike (`19215`) et Black Meteor
  (`19615`) ignorent la DEF sur tout le sort dès qu'un effet nocif est
  présent ; Bull's Eye, Wipe Out, Shadow Arrow et Dark Dragon Attack
  (`8215`, Fei) n'ont qu'un interrupteur pour tout le sort
  (`CONDITIONS_COMBAT_PAR_ID_CONNUS`).
- **Idée** : Thunder Strike, borne stricte (DEF de la cible sous 50 % de la
  tienne) ; Start of Attacking, 25 % par effet bénéfique retiré ; Sword of
  Discharge, sous Invincibilité. Meteor Strike et Black Meteor : « ignore
  DEF à partir du coup 1, 2, 3, ou aucun ». Fei, Bull's Eye, Wipe Out,
  Shadow Arrow : un choix coup par coup, la chance affichée près de
  l'interrupteur. Chaque entrée sort de `CALCUL_PARTIEL_PAR_ID` dans le
  commit qui la conditionne.
- **Bloque** : un changement de code, et des relevés. Madness Judgement
  contre ~3 000 de DEF, sans puis avec Brise DEF à 100 % de PV, puis 75,
  50, 20 % : PV lus avant ou après l'auto-dégât, et loi linéaire ou non.
  Unlimited Power, premier coup, PV de la cible 100, 50, 20 %, DEF ~3 000
  puis 300 ou moins. Ezio ou Patrick feu, S1 contre ~3 000 de DEF, avec
  buff à 100 % de PV puis variantes. Hors inventaire, facultatif : Silver
  Chakram, une vingtaine d'attaques avec puis sans effet nocif.

### Critiques conditionnels restants

- **Constat** : Head to Head (`6161`, Mina 2A), qui appelle Energy Punch
  après tout coup critique du tour, n'est pas curé ; la frappe de Moria 2A
  pendant son S3 non plus.
- **Idée** : Energy Punch suit le mode critique, un par coup du sort en
  « Critique », aucun en « Non critique »
  ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)) ; un sort ne
  s'appelle jamais lui-même.
- **Bloque** : un changement de code ; Moria 2A attend un relevé : frappe
  pendant le S3 / S1 Cross Attack, toutes deux critiques (environ 1,00 →
  profil de la S1 avec ses améliorations, environ 0,87 → sans).

## Composantes et PV

### Composantes à valeur connue et stocks saisis

- **Constat** : `COMPOSANTES_FIXES_ADDITIONNELLES_PAR_ID`
  (`src/lib/damage.ts`) ne porte que les réserves et dégâts fixes déjà
  livrés ; le stock de dégâts de Jin et Kai ténèbres, dont la règle est
  fournie, n'est pas calculé, ni les parts propres de Decamaron ou Deva,
  Hollyberry ou Audrey, Ciri ou Birgitta, Lydia, Paul ou Duke.
- **Idée** : une composante par sort, curée par identifiant, avec la
  saisie du stock de Jin et Kai de 0 à 100 000.
- **Bloque** : des relevés. Le stock de Jin et Kai reçoit-il les
  améliorations du S3, les lignes élémentaires, la Conquête, la Marque,
  Mirinae ? Cleaving Light! à PV pleins puis ~50 %, Big Bang et Lightning
  Strike! contre ~3 000 de DEF : brut ou mitigé. Decamaron ou Deva sans
  buff, avec buff d'ATQ, avec Brise DEF, avec les deux. Hollyberry ou
  Audrey contre une DEF inférieure puis supérieure à la leur. Ciri ou
  Birgitta, coups du passif à ~100, 50, 15 % de PV de la cible. Lydia, un
  allié encaisse X puis S1, pour deux X. Hors inventaire : Hollyberry,
  premier coup contre coup sous buff de DEF d'allié.

### Composantes conditionnelles et comptées

- **Constat** : Red Battlefield (`13414`, Lucifer) et Start of Pain
  (`15115`, Kiki) n'ont aucune entrée dans `src/lib/damage.ts`, alors que
  leurs valeurs sont fournies ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)) ;
  les clauses conditionnelles d'Amber, d'Übel feu, de Shakan (et de
  Disdain), de Mandrake (Hyanes), du S3 de Jin et Kai ne sont pas comptées.
- **Idée** : une clause « la cible porte un effet » en interrupteur ;
  Lucifer, un effet actif saisi de 0 à 50 % avec l'équivalent en dégâts
  reçus ; Kiki, un choix de 0, 1 ou 2 effets nocifs sur la cible.
- **Bloque** : des relevés. S4 de Zenitsu ou Qilin Slasher contre une cible
  à ~25 % puis à ~40 % que le coup fait passer sous 30 %. Nina ou Shasha,
  S3, valeurs par coup. Shakan, PV % égaux puis cible entamée. Amber
  (deux coups) contre 0, 1, 3, 4 débuffs. Lucifer : un allié frappe
  ~50 000, puis un autre attaque (environ 1,10 → règle de swcalc.cz).
  Mandrake avec puis sans effet sur la cible. S3 d'Übel feu sur une cible
  sans dégât continu, valeurs par coup. S3 de Jin et de Kai, coup par
  coup, contre une ATQ entre la leur sans et avec buff. Disdain : un relevé
  propre, avec celui de Shakan.

### PV et comparaisons continues

- **Constat** : Self Repair et Path of the Brave Warrior sont des boutons
  binaires (`BONUS_DEGATS_CONDITIONNEL_CONNUS`, `src/lib/damage.ts`) : trop
  favorables sous le seuil. Le bonus de Summary Justice selon la VIT
  contre un ennemi plus lent porte « Calcul partiel » (`23515`). Les PV
  propres n'ont pas de source unique ; Massacre (`1215`, Garok) n'est pas
  curé.
- **Idée** : Self Repair et Path of the Brave Warrior en réglage continu
  (valeurs fournies) ; Massacre déduit des PV de la cible ; Bayek et Ahmed
  sur l'état partagé « PV détruits de la cible ». Une seule source pour les PV propres.
- **Bloque** : des relevés à PV propres 100, 50, 25 %, rapport au cas
  pleine vie (linéaire ou palier) : Blood Demon Art (Nezuko), Immortal
  Wings (Vermilion Bird Dancer, pente propre), Flow (Chow), Full of Spirit
  (Byungchul), Cursed Body (Karakum), Magic Arrow (Ardella, critique),
  Bite (Shumar), S1 de Kamatau, Gamir, GingerBrave et Thomas. Massacre :
  PV de la cible 100, 50, 25 %. VIT sans puis avec buff : Summary Justice
  (cible plus lente), Spear of Thunder (`23415`, Asbolus, cible plus
  rapide). Born to Fight (Lucas), premier tour puis bouclier affiché.
  Dismantle (Sukuna) et Bead Explosion (Hayato), sans puis avec Brise DEF,
  puis buff d'ATQ. Stark, équipe pleine, alliés blessés, 1 puis 2 morts.
  Bayek ou Ahmed, cible intacte puis après une destruction connue.

### Pertes de PV

- **Constat** : `CALCUL_PARTIEL_PAR_ID` (`src/lib/damage.ts`) marque « pas
  encore comptée » la perte de PV de Hellfire (`11912`), Ragnarok
  (`6015`), Dragon Bombardment (`20413`), Moonlight Blow (`12615`),
  Volcanic Tribe Totem (`15437`), Half Moon Tribe Totem (`15440`), le
  bonus de Time of Destruction (`15114`, Dorothy) et la part de Sword of
  Destruction (`13401` à `13405`) : calculs trop bas.
- **Idée** : la perte comptée dans le total, et les PV qu'elle laisse
  nourrissent la suite (lignes 222 et 223 selon les PV ennemis). Dorothy :
  une jauge « PV détruits » de 15 à 60 %. Sword of Destruction : un champ
  « PV actuels de l'ennemi le plus en forme »
  ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)).
- **Bloque** : des relevés. Base d'une perte de PV, un sort à la fois,
  cible à PV pleins puis ~50 % : rapport environ 0,5 → PV actuels, environ
  1 → PV max. Terme proportionnel : deux lancers ne changeant que la
  quantité réduite ou absorbée, puis contre ~3 000 de DEF (mitigé si la
  part baisse comme le facteur de DEF, sinon brut). Ereshion, buff retiré,
  PV pleins puis ~50 %.

### Bombes qui explosent pendant le sort

- **Constat** : l'explosion des bombes déjà posées sur la cible est
  marquée « pas encore comptée » pour Meteor Bomb (`8912`), Promised Time
  (`7113`) et Detonation Shot (`10222`) (`CALCUL_PARTIEL_PAR_ID`,
  `src/lib/damage.ts`).
- **Idée** : ce qui explose pendant le sort compte, sur un nombre de bombes
  saisi ; les dégâts continus, leurs détonations, les bombes à retardement
  et la propagation restent hors total
  ([formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](formules-et-combat.md)).
- **Bloque** : des relevés. Explosion d'une bombe posée en frappant :
  Kobold Bomber eau (Firecracker / Time Bomb) ; Carrack et John à deux ATQ
  connues (pente). Seara : bombe de Fate of Destruction qui explose seule /
  déclenchée par Promised Time (environ 1 → une ligne de table suffit).

### Variables et dégâts fixes

- **Constat** : Reckless Assault (`12011`, Mo Long) compte ses dégâts fixes
  sans plafond aux PV actuels (`DEGATS_FIXES_SANS_STAT_PROPRE_PRIS_EN_CHARGE`,
  `src/lib/damage.ts`) : calcul trop favorable. Dice Madness (`12111`) ne
  saisit pas son tirage ; les dégâts fixes de Nobara et d'Aya lumière et le
  S4 de Christina ne sont pas calculés.
- **Idée** : Mo Long, un champ « Mes PV actuels » ; Dice Madness, le tirage
  saisi ; les dégâts fixes de Nobara et d'Aya lumière acceptés.
- **Bloque** : des relevés. Mo Long à ~30 % de PV contre une cible à forts
  PV, sans puis avec ligne élémentaire : plafond avant ou après les bonus.
  Christina, S4 à 4 alliés vivants puis un mort, même ennemi secondaire.
  Nobara ou Aya lumière, sans puis avec ligne élémentaire : une ligne de
  dégâts contre un élément agit-elle sur leur S3 ? Dice Madness : plus
  grande face, cinq valeurs.

## Stats des passifs

### Assiette des « +X % » de passif

- **Constat** : l'assiette d'un « +X % » de passif se décide passif par
  passif ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)). Fierce
  Attack!, Attack Instinct et Dark Guardian sont comptés sur la stat totale
  (`atkPct`, `defPct`, `STATS_COMBAT_PAR_ID_CONNUS`, `src/lib/damage.ts`).
- **Idée** : règle donnée par un joueur, à appliquer passif par passif : un
  passif de stat pure et permanente (« Increases ATK/DEF by X% ») porte sur
  la stat de base et s'ajoute aux runes et au lead ; un passif d'état qui
  agit comme un buff (Sleep Talk) multiplie la stat totale, sans cumul avec
  un buff de VIT ; la VIT de Sleep Talk suit l'état « endormi ».
- **Bloque** : des décisions sur Lord of Labyrinthos, Fierce Attack!,
  Attack Instinct, Dark Guardian, la forme bête de Bellenus (une source
  communautaire la dit sur la base) et Pater ; sur les cumuls et les états ;
  sur un passif d'état et un buff d'ATQ ensemble (le moteur multiplie). Et
  un relevé par passif : deux builds ne différant que par la stat plate des
  runes (écart de 400 ou plus), même cible ; ρ = T_B / T_A → stat totale,
  ρ = (T_B + x·B) / (T_A + x·B) → stat de base.

### Mécanismes de stats neufs

- **Constat** : Slaughter (`5411`, Huga), The Cunning (`11511`, Chilling),
  Exile (`8615`, Kamatau) et Collect Weapons (`15512`, Carlos) n'ont aucune
  entrée dans `src/lib/damage.ts`. L'équilibrage d'Internal Force porte
  « Calcul partiel » sur Justice Strike (`12520`) et Fury of Punishment
  (`12510`).
- **Idée** : valeurs fournies ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)) :
  Huga, +30 points de Dégâts CRIT ; Chilling, +20 de VIT par buff saisi ;
  Kamatau, ses buffs éteints ; Carlos, ATQ gagnée saisie en %, plafond de
  300 % de l'ATQ de base. Leona : la plus basse de l'ATQ et de la DEF monte
  au niveau de la plus haute en début de combat.
- **Bloque** : des relevés. Leona : deux builds de même ATQ, de DEF
  différentes au-dessus de l'ATQ, puis un troisième à ATQ au-dessus de la
  DEF. Kaki contre ~3 000 de DEF, deux builds de même ATQ et de DEF
  différente. Herteit, S1 avant puis après Endless Desire à k Knowledge.
  Chacha, S1 avant puis après la S3 contre une ATQ plus haute. Le plafond
  de VIT d'équipe de Leo n'est pas modélisé : rien de décidé.

### Formes transformées dans la modale

- **Constat** : `autreForme` (`src/lib/monsterForms.ts`) ne sert que la
  fiche du monstre ; la modale « Dégâts réels » ne propose que les sorts de
  la forme choisie.
- **Idée** : la forme choisissable dans la modale, puisqu'elle change les
  sorts disponibles, et jamais comme une entrée de plus de l'Optimizer :
  Lord of Hell (runes et ATQ de Liliana, puis +50 %), Bellenus, Taranys,
  Pater, Beast Riders, Indra.
- **Bloque** : un changement de code ; l'assiette des passifs de forme
  (piste « Assiette des « +X % » de passif »).

## Recherche des runes

### Taux Crit de Ciri feu, Magic Order Swordsinger feu et Reyka

- **Constat** : `damageRelevantStats` (`src/lib/damage.ts`) ajoute la VIT
  pour un `critRateSelonVit`, jamais le Taux Crit, dont le surplus au-delà
  de 100 % se reverse pourtant en Dégâts CRIT (`CRIT_RATE_SELON_VIT_CONNUS`).
- **Idée** : compter le Taux Crit parmi leurs stats pertinentes.
- **Bloque** : un changement du moteur, avec un test différentiel (skill
  `algo-verify`).

## Ajouter une piste

1. Vérifier que l'idée n'est ni faite dans le code, ni écartée dans la spec
   du mécanisme, ni fournie dans [valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md).
2. L'ajouter dans la section de son domaine : un titre, puis **Constat**
   (avec sa coordonnée), **Idée** et **Bloque** ; un relevé y porte son
   montage et sa règle de décision.
3. Une piste réalisée sort d'ici dans le commit qui la réalise, avec son
   entrée de `CALCUL_PARTIEL_PAR_ID` s'il y en a une. Une piste essayée puis
   écartée laisse dans la spec du mécanisme une ligne « ne pas… parce
   que… ».
