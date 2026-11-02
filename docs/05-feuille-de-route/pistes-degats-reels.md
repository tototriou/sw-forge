# Dégâts réels — pistes futures

Voir aussi : pistes-degats-reels-stats.md, [../02-app/degats-reels/](../02-app/degats-reels/), pistes-optimizer.md.

Les pistes des dégâts réels se partagent en deux fichiers, selon la question
qu'elles posent. Celui-ci tient **quels coups sont comptés** : attaques
déclenchées et hors tour, nombre de coups, séquences, poses et comptes entre
les coups. [pistes-degats-reels-stats.md](pistes-degats-reels-stats.md)
tient **ce que vaut un coup** déjà compté : VIT, DEF ignorée, critique,
composantes, pertes de PV, stats des passifs, recherche des runes.

Une piste est ce qui n'est pas fait : le **constat** (ce que le code fait,
avec sa coordonnée), l'**idée** (la forme du réglage quand elle est déjà
choisie) et ce qui la **bloque**. Les valeurs de jeu fournies sont dans
[02-app/degats-reels/](../02-app/degats-reels/). Un relevé en jeu est
un rapport entre deux lancers qui ne diffèrent que d'une chose, avec sa
règle de décision posée d'avance (skill `game-data-curation`, § 6 bis), et
ne vaut que pour le sort mesuré. Un sort dont une part décidée n'est pas
codée porte « Calcul partiel »
([02-app/degats-reels/feat-formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](../02-app/degats-reels/feat-formules-et-combat.md#calcul-partiel--létiquette-par-identifiant)).

## Attaques déclenchées et hors tour

### Contre-attaque : ligne d'artéfact 208

- **Constat** : aucune contre-attaque n'est modélisée ; 208 (« Dgts de
  contre-attaque ») vaut 0, et 225 ne compte que pour sa part d'attaque
  conjointe.
- **Idée** : un interrupteur de contre-attaque, sur le modèle de
  « Attaque conjointe ».
- **Bloque** : un chantier à cadrer (quels sorts, quelles lignes 224 et
  411 hors du tour).

### Passif « on your turn » après un S1 appelé par un allié

- **Constat** : l'interrupteur « Attaque conjointe » n'agit sur aucun
  autre réglage : Tempest (Teshar, Phoenix vent), qui frappe « after you
  attack the enemy on your turn », reste au choix de l'utilisateur quand
  le S1 est appelé hors de son tour.
- **Idée** : masquer ou éteindre l'interrupteur de Tempest quand
  « Attaque conjointe » est allumé.
- **Bloque** : une décision produit.

### Compétence active appelée par un sort

- **Constat** : `ATTAQUES_APPELEES_PAR_DECLENCHEUR` (`src/lib/damage.ts`)
  ne porte que les deux sorts coopératifs sans dégâts propres qui appellent
  le S1 ; aucune attaque appelée après un sort qui frappe n'est curée, et
  aucun effet posé par un déclencheur n'est modélisé
  ([02-app/degats-reels/feat-attaque-apres-un-sort.md § Ce qu’il faudra fournir pour un autre cas](../02-app/degats-reels/feat-attaque-apres-un-sort.md#ce-quil-faudra-fournir-pour-un-autre-cas)).
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

- **Constat** : Burning Whip (`6912`) et Forbidden Power (`4215`) n'ont
  aucune entrée dans `src/lib/damage.ts`, alors que leurs valeurs sont
  fournies ([02-app/degats-reels/](../02-app/degats-reels/),
  « Déclenchements de Hwa et Jackie », « Zeratu — Forbidden Power ») ; la
  répétition d'Elise sous 50 % de PV non plus. Exploding Hands (`11015`) se
  répète par sa compétence auxiliaire, améliorations comprises, sans
  confirmation ([02-app/degats-reels/feat-competences-auxiliaires.md](../02-app/degats-reels/feat-competences-auxiliaires.md)).
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

### Attaque sur un autre ennemi après une élimination

- **Constat** : Shadow Assault (`10713`, Tanya vent) attaque, si la cible
  meurt, l'ennemi au plus bas en PV, à +30 % de dégâts et sans effleurement ;
  sa compétence auxiliaire (`10716`) en donne le ratio, `7.7*{ATK}`, mais
  aucun calcul ne la lit : le coup frappe un autre ennemi que la cible
  configurée.
- **Idée** : le coup en plus sur la cible secondaire (« Dégâts sur les
  autres ennemis »), sous un interrupteur « la cible meurt ».
- **Bloque** : une décision produit (sur quelle cible le compter) et un
  relevé du +30 % (sur le ratio ou en multiplicateur à part).

### Chaînes ordonnées

- **Constat** : aucune chaîne de sorts n'est calculée. Kung Fu Girls :
  Energy Ball (S1, `8201` à `8205`) appelle Twist Kick ou Shadowless Kick
  (S2, `8216` à `8220`), qui appelle leur Dragon Attack (S3, `8211` à
  `8215`). Hwoarang ténèbres : Hunting Hawk (`22510`) frappe d'abord avec
  Backlash quand la cible n'a aucun effet bénéfique, et Trinity Claymore
  (`22515`) enchaîne Backlash, Hunting Hawk puis trois coups ; Taebaek
  ténèbres, son jumeau, porte Roundhouse Kick Combo (`23010`) et Endless
  Kick Combo (`23015`). Les versions feu, Hunting Hawk (`22507`, Hwoarang) et
  Roundhouse Kick Combo (`23007`, Taebaek), frappent de même d'abord avec
  Backlash ou Triple Kick contre une cible sans effet bénéfique : la Marque
  que leur passif (Blood Talon, Heaven's Might) pose pendant ce préfixe
  vaudrait pour leurs trois coups, alors que le calcul ne propose que la pose
  après leur coup 1 ([02-app/degats-reels/feat-poses-entre-les-coups.md](../02-app/degats-reels/feat-poses-entre-les-coups.md)).
  Shoot n' Slash de Barque (`10223`, sans formule)
  enchaîne Backspin Slash et Pirate's Strike.
- **Idée** : ce que décide chaque chaîne
  ([02-app/degats-reels/](../02-app/degats-reels/)). Kung Fu Girls :
  chaque appel sous son interrupteur ; S3 choisi, un seul sort ; S1 choisi,
  la chaîne entière possible. Hunting Hawk : Backlash compté avant, la
  condition sur la cible en interrupteur. Trinity Claymore, choisi comme
  sort : toute la chaîne d'abord (S1 puis S2), puis ses 3 coups au ratio du
  sort ; aucun sort ne l'appelle. Barque : Backspin Slash puis Pirate's
  Strike, sans interrupteur de chaîne ; seul l'interrupteur du break DEF de
  la première frappe, qui profite à la seconde ; +35 % par effet nocif
  recalculé avant chaque frappe ; lignes 400 puis 401.
- **Bloque** : un changement de code, après la piste « Compétence active
  appelée par un sort ».

### Événements du monstre choisis seuls

- **Constat** : Tempest et trois passifs hors tour chiffrés par leur
  compétence auxiliaire (Rageful Return de Psamathe, les ripostes de
  Hollyberry Cookie et de Manon) sont `selectionnableCommeSort`
  (`src/lib/damage.ts`), sans facteur de riposte ; l'attaque d'état de
  Legolas et d'Elder Horn est leur S3, une fois. Un passif ne se choisit
  seul que sans
  ajustement propre à la boucle des passifs
  ([02-app/degats-reels/feat-attaque-apres-un-sort.md § Choisi seul — « Compétence utilisée](../02-app/degats-reels/feat-attaque-apres-un-sort.md#choisi-seul---compétence-utilisée-)).
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
  statue / Earth Strike ; Madeleine Cookie feu ou Pavé, son jumeau,
  additionnelle / S1 ; Artamiel, S1 critique à k cumuls de Judge puis la
  contre-attaque ; Chakra, deux VIT puis Wild Bolt ; Übel vent, chaque
  coup ajouté sur une cible sans réduction de DEF. Danu : le passif
  peut-il critiquer ? Facultatifs : Jin et Kai feu, Frieren (écart de plus
  de 5 % → facteur hors tour).

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
  VIT totale de combat ([02-app/degats-reels/](../02-app/degats-reels/)).
  Chain Fire : salves de deux flèches, compteur par pas de 2. Lala : un
  sélecteur de 0 à 5 [Attack!], son S3 sans coup propre. Coco : compteur des
  sphères restantes sur S1 et S2, 5 par défaut, chaque sphère en dégâts
  fixes, valeur de la donnée.
- **Bloque** : un changement de code, et des relevés. Wild Shot! avec 4, 3,
  2 puis 1 ennemi vivant, coups reçus par un ennemi : une table, ou une
  somme constante répartie. Cleave et Exorcism Orb : la règle du nombre de
  coups, à tester d'abord en jeu, puis ATQ sous la DEF, à 1,5 fois, à 2
  fois. Hors inventaire : Crow Hunt et Rat Hunt sous Immunité.

### Crow Hunt de Prilea : deux coups annoncés pour un

- **Constat** : Crow Hunt (`1618`, Prilea `10513`) « attack the enemy
  target 2 times » porte `coups: 1` ; `COUPS_FIXES_CORRIGES_PAR_ID`
  (`src/lib/damage.ts`) est vide, le calcul compte un coup. Ses homonymes
  jouables `1607` et `1609` portent `coups: 4`
  (`tests/degats-coups-saisis.test.ts`).
- **Idée** : l'entrée `1618: 2` dans `COUPS_FIXES_CORRIGES_PAR_ID`. Sa
  Réduction de DEF (`Decrease DEF` de la donnée) devient alors proposable
  entre les coups sans autre curation (`effetsEntreCoupsDuSort`).
- **Bloque** : un relevé, les nombres de dégâts affichés sur la cible :
  deux → 2 coups, un → la donnée dit vrai.

### Splash Splash de Noctaris : un coup en donnée, trois ou quatre en prose

- **Constat** : Splash Splash (`25815`, Noctaris `36715`) « Attacks the enemy
  to stun for 1 turn and leave a Branding effect for 2 turns. Afterwards,
  attacks random enemies 2 to 3 times » porte `coups: 1` et un effet
  `Additional Attack` ; le calcul compte un coup, et la Marque du coup 1
  (note « 1st hit ») ne peut rien majorer.
- **Idée** : une plage de 3 à 4 coups (`COUPS_VARIABLES_PAR_ID_CONNUS`), les
  coups en plus portés « au hasard » comme les autres sorts de ce cas
  (« Plages de coups à relever et coups « au hasard » », plus haut). La Marque
  devient alors proposable au coup 1 sans autre curation.
- **Bloque** : un relevé sur une cible seule : le nombre de dégâts affichés
  (3 ou 4 → la plage), et le rapport d'un coup en plus au premier (≈ 1 → même
  formule, sinon la formule de l'`Additional Attack`).

### Séquences à valeur relevée

- **Constat** : `SEQUENCES_DE_COUPS_PAR_ID_CONNUS` (`src/lib/damage.ts`) ne
  porte ni Shoulder Smash (`22615`, Paul Phoenix) et Triple Break Combo
  (`23115`, Duke), ni Oathbreakers (`23815`, Aragorn) et Spirits of Wolf
  Warriors (`24315`, Night Fang), ni Triple Combo (`13913`, RYU vent) et
  Triple Crush (`14413`, Kashmir), chaque paire de jumeaux de même prose,
  ni Explosive Bullet ou Tempest Sword (`10613`) : leur phase que la donnée
  ne chiffre pas manque au total. (Le coup en plus de Guilty Sentence
  s'ajoute sur interrupteur :
  [02-app/degats-reels/feat-competences-auxiliaires.md](../02-app/degats-reels/feat-competences-auxiliaires.md).)
- **Idée** : une séquence curée par sort
  ([02-app/degats-reels/feat-sequences-de-coups.md § La séquence curée — une table par identifiant](../02-app/degats-reels/feat-sequences-de-coups.md#la-séquence-curée--une-table-par-identifiant)).
  Tempest Sword : troisième coup au ratio des deux premiers (valeur
  fournie). Un effet posé entre deux groupes se règle par le
  choix « après quel coup ».
- **Bloque** : des relevés, chacun sur la cible visée ; une mesure vaut
  pour une paire de jumeaux. Shoulder Smash ou Triple Break Combo, coup 3
  / coup 1 (deux nombres seulement → la zone exclut la cible).
  Oathbreakers ou Spirits of Wolf Warriors, chaque coup de zone / coup 1.
  Triple Combo ou Triple Crush, coup 3 / coup 2 avec la Brise DEF du
  coup 1 posée : 1,00 à 2 % → aucun coefficient final. Explosive Bullet,
  chaque phase / S1 Cross Fire.

### Skillups des séquences à valeur de l'API

- **Constat** : chaque groupe de `sequenceDeCoups` reçoit le profil entier
  du sort (`computeSkillDamageDetail`, `src/lib/damage.ts`), skillups compris :
  ils valent aux deux phases de Fatal Extinctive Bullet (`13311`, Abigail),
  Fatal Mortar Bullet (`13312`, Scarlett), Fatal Armor Bullet (`13314`,
  Emily), Head Press (`14113`, M. BISON), Great Sword of the End (`14613`,
  Sagar) et Undefeated Warrior (`9515`, Kuna), sans confirmation
  ([02-app/degats-reels/feat-sequences-de-coups.md § Séquences à valeur de l’API](../02-app/degats-reels/feat-sequences-de-coups.md#séquences-à-valeur-de-lapi)).
- **Idée** : les borner à la phase 1 si le relevé le dit.
- **Bloque** : un relevé, sort au maximum de skillups, deux coups non
  critiques sur la cible visée, phase 2 / phase 1 : Abigail ou Emily,
  environ 1,29 → les deux phases, environ 1,03 → la phase 1 seule ;
  M. BISON ou Sagar, environ 1,30 contre 1,13.

### Part copiée sur un autre ennemi

- **Constat** : Thunder Break (`2908`), Lightning of Cycle (`9413`) et
  Crush (`4211`) infligent à un autre ennemi une fraction des dégâts de la
  cible ; le calcul ne la compte pas, et « Autres ennemis »
  (`cibleDegatsParSort`) ne leur est pas proposé.
- **Idée** : proposer « Autres ennemis » pour ces sorts, avec la fraction.
- **Bloque** : un relevé, un sort à la fois : A visée, B autre ennemi de DEF
  et de PV très différents. D_B / D_A constant à 0,20, 0,75 ou 0,60
  (±1 %) malgré B → copie ; sinon recalcul par cible ; Crush : D_B critique
  → copie, et la ligne 224 porte-t-elle sur son coup principal ?

### Poses entre les coups : buff posé par le sort, Eightfold, bonus du coup 2

- **Constat** : Eightfold (`21607`, `21609`, `22207`, `22209`) ne compte pas
  son +50 % quand la jauge d'attaque de la cible est à 0. Hairpin: Black
  Flash et Exorcist Shuriken Formation (`20315`, `20915`, Nobara et Aya
  ténèbres) proposent la Réduction de DEF de leur coup 1
  (`effetsEntreCoupsDuSort`, `src/lib/damage.ts`), sans leur +100 % au seul
  coup 2 si la cible porte un effet nocif. Fast Link (`13606`, `13607`,
  `13610`) pose sa Réduction de DEF au coup 1, celui de la bête, sans relevé.
  Un effet posé au dernier coup n'est jamais proposé, même quand un passif
  qui suit le sort le lirait. Les effets que pose une bête ou un disque « on
  a random enemy … when you attack on your turn » (Eagle Deception `17315`,
  Eye of the Desert `17815`) ne sont pas proposés : ni la cible ni l'instant
  ne sont dits. Un sort à un coup qui en enchaîne un autre (Shoryuken puis
  Hadoken, Iron Uppercut puis Mach Punch, Energy Ball, Wield) ne transmet pas
  sa Réduction de DEF ou sa Marque au sort enchaîné : aucune attaque
  conditionnelle n'est codée.
- **Idée** : Eightfold : à partir du coup choisi, comme l'ignore DEF des
  Blade Dancers ([02-app/degats-reels/](../02-app/degats-reels/)). Un buff
  que le sort se pose : un interrupteur allumé par défaut quand ce sort est
  choisi. Nobara et Aya : +100 % au coup 2, lu sur l'état après le coup 1,
  comme le disent la donnée et la prose.
- **Bloque** : un changement de code, et des relevés. Buff posé par le
  sort : la prose le place avant l'attaque ; un relevé (monstre déjà sous
  ce buff puis sans, environ 1,00 → actif avant) seulement en cas de doute.
  Barbara contre ~3 000 de DEF et 4 buffs : coup 2 / coup 1 très au-dessus
  de 1 → la cavalière est le coup 2 ; Savannah sous k débuffs : environ
  1 + 0,15k. Hellfire sans puis
  avec Brise DEF (~1 500 de DEF) : environ 1 → la Brise DEF précède le
  coup, environ 2,36 → après. Bayek ténèbres ou Salah, S2 à deux coups contre
  une cible seule à ~3 000 de DEF, coups non critiques : coup 2 / coup 1
  environ 2,7 → la Réduction de DEF de la bête précède le coup 2, environ 1
  → elle le suit. Manannan ténèbres, King of the Ruins (`10515`) : Spear of
  Devastation contre deux ennemis sans effet nocif, l'icône de dégâts
  continus après le coup 1 sur la cible visée → elle les reçoit, et le +100 %
  vaut pour le coup 2 (ses dégâts continus deviennent posables entre les
  coups) ; sur les seuls autres ennemis → rien à poser.

### Comptes propres et jauge absorbée

- **Constat** : aucun compte propre des dégâts continus sur la cible
  (Yoga Sunburst `14213`, Chemical Gas Spray `14728` de Jarrett ;
  Reelseiden・Havoc `25212` et Dimension Slash・Havoc `25712`, « 5% of its
  MAX HP for each Continuous Damage »), ni des effets
  retirés aux alliés, ni de la jauge d'attaque absorbée (Xiana, Theodora)
  n'existe dans `src/lib/damage.ts`. D'autres lecteurs des effets nocifs de
  la cible manquent aussi : Critical Link (`13608` Savannah, `13609` Narsha :
  l'attaque du cavalier +15 % par effet nocif), Nano Vision d'Amber
  (`15911` : 4 % des PV max par effet nocif), le dernier coup de Bullet
  Assassination et Shining Butterfly (`22714`, `23214` : 25 % des PV max si
  la cible porte un effet nocif) et Hammer Punch (`11651` à `11655` : le coup
  en plus contre une cible SANS effet nocif, seulement un interrupteur). Sans
  eux, les effets que ces sorts posent entre leurs coups ne sont pas
  proposés (`effetsEntreCoupsDuSort`).
- **Idée** : un compteur propre « dégâts continus sur la cible », +50 % par
  dégât continu, la prose faisant foi
  ([02-app/degats-reels/](../02-app/degats-reels/), « DHALSIM,
  Jarrett ») ; les autres comptes sur le même modèle. Chaque lecteur ajouté
  rend proposables, sans autre curation, les effets nocifs que le sort pose
  entre ses coups.
- **Bloque** : des relevés. Yoga Sunburst et Chemical Gas Spray, coup 2 /
  coup 1 après un dégât continu posé par le coup 1 : 1,3 à 1,5 → ceux du
  sort comptent. Satoru Gojo ou Werner, alliés portant 0, 1, 2 puis 4
  effets néfastes. Xiana et Theodora, jauge de la cible vers 0 puis à 30 %
  ou plus. Bayek ou Omar eau, deux cibles de même DEF et de PV très
  différents. Eshir contre 0, 1 puis 3 buffs. Yuji et Rick eau et lumière,
  suites critique et non critique (environ 1,20 → règle confirmée). Hors
  inventaire : Mach Crush à 0, 1 puis 2 débuffs.

### Escalade d'un coup à l'autre

- **Constat** : trois S3 annoncent des dégâts qui croissent au fil des
  coups : Start of Apocalypse (`13112`, Baleygr, « the damage increases as
  you attack »), Shooting Star (`1311`, `1361`, Kacey, « increases as the
  same target gets hit again ») et Doomsday (`6215`, `6265`,
  Thrain, « increases with time » ; `6280`, porté par une forme non
  obtenable, hors curation). Aucun n'a d'entrée dans
  `src/lib/damage.ts` : chaque coup vaut le ratio de la donnée, sans
  croissance. Start of Apocalypse frappe autant de fois que Baleygr a de
  Connaissances (1 à 5) ; la donnée dit 5 coups.
- **Idée** : un incrément par coup, curé par identifiant ; pour Start of
  Apocalypse, le nombre de coups saisi selon les Connaissances ; pour
  Shooting Star, avec le compteur des coups qui touchent la cible.
- **Bloque** : un relevé en jeu par sort, sur une cible seule (donjon à un
  ennemi ou dernier ennemi vivant) à DEF élevée : les chiffres d'un même
  lancer. Coup k / coup 1 constant → aucune escalade ; croissance régulière
  → l'incrément. Pour Baleygr, compter aussi les coups selon le nombre de
  Connaissances.

## Ajouter une piste

1. Vérifier que l'idée n'est ni faite dans le code, ni écartée dans la spec
   du mécanisme, ni fournie dans [02-app/degats-reels/](../02-app/degats-reels/).
2. L'ajouter dans la section de son domaine : un titre, puis **Constat**
   (avec sa coordonnée), **Idée** et **Bloque** ; un relevé y porte son
   montage et sa règle de décision.
3. Une piste réalisée sort d'ici dans le commit qui la réalise, avec son
   entrée de `CALCUL_PARTIEL_PAR_ID` s'il y en a une. Une piste essayée puis
   écartée laisse dans la spec du mécanisme une ligne « ne pas… parce
   que… ».
