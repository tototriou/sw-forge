# Dégâts réels — pistes futures

**Statut :** ÉTAT ACTUEL — liste les pistes futures sur les coups que le calcul des dégâts réels compte, chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on envisage de compter une attaque, un coup ou un réglage de la modale « Dégâts réels » de plus, ou un relevé en jeu, avant de le proposer comme nouveau
**Ne pas lire si :** on cherche ce que vaut un coup déjà compté (VIT, DEF ignorée, critique, composantes, PV, stats des passifs) : [pistes-stats-et-modificateurs.md](pistes-stats-et-modificateurs.md) ; ou ce que le calcul fait aujourd'hui : l'index [../degats-reels.md](../degats-reels.md)
**Voir aussi :** pistes-stats-et-modificateurs.md, ../degats-reels.md, valeurs-de-jeu-curees.md, formules-et-combat.md, ../optimizer/pistes.md

Les pistes des dégâts réels se partagent en deux fichiers, selon la question
qu'elles posent. Celui-ci tient **quels coups sont comptés** : attaques
déclenchées et hors tour, nombre de coups, séquences, poses et comptes entre
les coups. [pistes-stats-et-modificateurs.md](pistes-stats-et-modificateurs.md)
tient **ce que vaut un coup** déjà compté : VIT, DEF ignorée, critique,
composantes, pertes de PV, stats des passifs, recherche des runes.

Une piste est ce qui n'est pas fait : le **constat** (ce que le code fait,
avec sa coordonnée), l'**idée** (la forme du réglage quand elle est déjà
choisie) et ce qui la **bloque**. Les valeurs de jeu fournies sont dans
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md). Un relevé en jeu est
un rapport entre deux lancers qui ne diffèrent que d'une chose, avec sa
règle de décision posée d'avance (skill `game-data-curation`, § 6 bis), et
ne vaut que pour le sort mesuré. Un sort dont une part décidée n'est pas
codée porte « Calcul partiel »
([formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](formules-et-combat.md)).

## Attaques déclenchées et hors tour

### Attaques conjointes : lignes d'artéfact 209 et 225

- **Constat** : les lignes 209 (« Dgts d'attaque conjointe ») et 225
  (« Dgts de contre-attaque/attaque conjointe ») existent
  (`src/lib/artifacts.ts`), mais le calcul des dégâts n'en lit aucune ;
  224 (« D.CRIT+ comp cib uniq pdt tour ») est lue selon la portée du
  sort, sans notion de tour (`damage.ts`).
- **Idée** : un choix « attaque conjointe » dans « Effets actifs », pour
  un S1 ou un sort à effet `Ally Attack`, qui ajoute 209 et la part
  conjointe de 225 au terme `DMG%` des lignes élémentaires, sans 208 ;
  un S1 qui participe pendant le tour d'un autre perd 224 (et 411 à
  examiner), un S1 ordinaire la garde. Assailing Horn (`17515`, Eivor) et
  Flag of Ambush (`18015`, Sigrid) portent `Ally Attack` sans formule : une
  coopération sans dégâts propres est exclue.
- **Bloque** : un chantier à cadrer. L'effet `Ally Attack` ne couvre
  pas tous les sorts concernés (inclusion par identifiant) ; plusieurs
  n'ont pas de formule principale ; à trancher : additionner ou non les
  dégâts des alliés, et le sort d'un S1 `Ally Attack` appelé hors de son
  tour.

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

- **Constat** : aucune chaîne de sorts n'est calculée. Kung Fu Girls :
  Energy Ball (S1, `8201` à `8205`) appelle Twist Kick ou Shadowless Kick
  (S2, `8216` à `8220`), qui appelle leur Dragon Attack (S3, `8211` à
  `8215`). Hwoarang ténèbres : Hunting Hawk (`22510`) frappe d'abord avec
  Backlash quand la cible n'a aucun effet bénéfique, et Trinity Claymore
  (`22515`) enchaîne Backlash, Hunting Hawk puis trois coups ; Taebaek
  ténèbres, son jumeau, porte Roundhouse Kick Combo (`23010`) et Endless
  Kick Combo (`23015`). Shoot n' Slash de Barque (`10223`, sans formule)
  enchaîne Backspin Slash et Pirate's Strike.
- **Idée** : ce que décide chaque chaîne
  ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md)). Kung Fu Girls :
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
  → copie, et la ligne 224 porte-t-elle sur son coup principal ?

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
