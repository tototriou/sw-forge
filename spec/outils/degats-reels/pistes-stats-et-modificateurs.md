# Dégâts réels — pistes futures : stats et modificateurs

**Statut :** ÉTAT ACTUEL — liste les pistes futures sur ce que vaut un coup (VIT, DEF ignorée, critique, composantes, PV, stats des passifs), chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on envisage de compter une stat, un bonus, une part de dégâts ou un relevé en jeu de plus dans un coup déjà calculé, avant de le proposer comme nouveau
**Ne pas lire si :** on cherche quels coups sont comptés (attaques déclenchées, hors tour, nombre de coups, séquences, poses entre les coups) : [pistes.md](pistes.md)
**Voir aussi :** pistes.md, ../degats-reels.md, valeurs-de-jeu-curees.md, formules-et-combat.md

Les pistes des dégâts réels se partagent en deux fichiers, selon la question
qu'elles posent. Celui-ci tient **ce que vaut un coup** déjà compté : la VIT
qui le nourrit, la DEF ignorée, le critique, ses composantes et pertes de
PV, les stats des passifs, et la recherche des runes qui en dépend.
[pistes.md](pistes.md) tient **quels coups sont comptés** : attaques
déclenchées et hors tour, nombre de coups, séquences, poses et comptes entre
les coups. La forme d'une piste et des relevés en jeu est celle de
[pistes.md](pistes.md) ; le gabarit d'ajout :
[pistes.md § Ajouter une piste](pistes.md).

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
  vitesse, le produit tombant entre deux entiers. Ne pas changer d'arrondi
  sans cette preuve : l'écart d'un point n'existe peut-être pas.

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
  tienne) ; Start of Attacking, 35 % par effet bénéfique retiré ; Sword of
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
  pendant son S3 non plus. Deadly Swing ne garantit le critique sous 30 %
  de PV de la cible que sur `6258` (`CONDITIONS_COMBAT_PAR_ID_CONNUS`),
  pas sur `6207`, `6208`, `6209`, `6257`, `6272`, `6273`, de même prose.
- **Idée** : Energy Punch suit le mode critique, un par coup du sort en
  « Critique », aucun en « Non critique »
  ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)) ; un sort ne
  s'appelle jamais lui-même. Deadly Swing : la garantie partout où la
  prose la dit, forme jouable par forme jouable.
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
  reçus ; Kiki, un choix de 0, 1 ou 2 effets nocifs sur la cible ; le
  bonus du S4 de Zenitsu et de Qilin Slasher, lié à un seuil de PV de la
  cible, en interrupteur.
- **Bloque** : des relevés. Nina ou Shasha, S3, valeurs par coup. Shakan, PV % égaux puis cible entamée, et Disdain
  par un relevé propre. Amber (deux coups) contre 0, 1, 3, 4 débuffs.
  Mandrake avec puis sans effet sur la cible. S3 d'Übel feu sur une cible
  sans dégât continu, valeurs par coup. S3 de Jin ou de Kai, jumeaux, une
  mesure, coup par coup, contre une ATQ entre la leur sans et avec buff.

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
  pleine vie (linéaire ou palier), une mesure par paire de jumeaux : Blood
  Demon Art (Nezuko) ou Immortal Wings (Vermilion Bird Dancer), Flow
  (Chow), Full of Spirit (Byungchul), Cursed Body (Karakum), Magic Arrow
  (Ardella, critique), Bite (Shumar), S1 de Kamatau, de Gamir, de
  GingerBrave ou le mainteneur. Massacre :
  PV de la cible 100, 50, 25 %. VIT sans puis avec buff : Summary Justice
  (cible plus lente), Spear of Thunder (`23415`, Asbolus, cible plus
  rapide). Born to Fight (Lucas), premier tour puis bouclier affiché.
  Dismantle (Sukuna) ou Bead Explosion (Hayato), sans puis avec Brise DEF,
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
- **Bloque** : des relevés. Base d'une perte de PV, un sort à la fois
  (Hellfire, Ragnarok, le sort d'Agrenia, Moonlight Blow, les
  totems de Nora et de Maya), cible à PV pleins puis ~50 % : rapport
  environ 0,5 → PV actuels, environ 1 → PV max. Sword of Destruction : la
  part des PV retirés est-elle réduite par la DEF de la cible (deux
  lancers à même part retirée, puis contre ~3 000 de DEF) ? Ereshion, buff
  retiré, PV pleins puis ~50 %.

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
  Pater, Beast Riders, Indra. Anges jumeaux : le sort de la forme archer
  choisi seul, sans le Horn lancé avant ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)).
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
