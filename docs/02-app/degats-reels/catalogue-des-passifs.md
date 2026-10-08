# Dégâts réels — catalogue des passifs

**Statut :** ÉTAT ACTUEL — décrit les entrées curées et mécanismes actuellement livrés du catalogue de passifs
**Lire si :** on ajoute, revalide ou modifie une entrée curée du catalogue de passifs
**Ne pas lire si :** on travaille sur le mécanisme générique des passifs offensifs ou sur le reliquat non implémenté
**Voir aussi :** feat-passifs-offensifs.md, feat-conditions-et-audit.md

## Modificateurs monstre-wide sans formule propre

Une recherche large des flags `Increase Damage`/`Increase Critical Damage`/
`Buff Bonus Damage` sur tout le corpus remonte ~65 entrées non modélisées.
Sur les 26 premières, confirmées par l'utilisateur, quatre familles de
modificateurs, toutes de la MÊME nature que `bonusDegatsSelonVit`/
`bonusDegatsStack` ci-dessus (`formule: ""` sur les 26 entrées vérifiées,
donc jamais des `PASSIFS_OFFENSIFS_CONNUS`) :

- **Taux Crit selon la VIT** (`CRIT_RATE_SELON_VIT_CONNUS`,
  `monsterCritRateSelonVit`) — Ciri (Feu, « Wolf School Training »), Magic
  Order Swordsinger (Feu) et Reyka (« Quick Execution ») : « Your Critical
  Rate increases in proportion to your Attack Speed. Additionally, if your
  Critical Rate exceeds 100%, your Critical Damage increases by the
  exceeded amount. » Confirmé par l'utilisateur : **1 point de Taux Crit
  tous les 12 points de VIT** (arrondi vers le bas), le SURPLUS au-delà de
  100 % se reversant en Dgts Crit **1 pour 1**, y compris le surplus
  apporté par ce même passif. ⚠️ Le reversement est un mécanisme PROPRE à
  ce passif — un monstre sans lui qui dépasse 100 % de Taux Crit (runes
  très généreuses) reste simplement plafonné, ce que garde le test dédié.
- **Bonus flat de Taux Crit/Dgts Crit** (`BONUS_STAT_FIXE_CONNUS`,
  `monsterBonusStatFixe`) — Lizardman (Lumière)/Glinodon, « Detect
  Weakspot » : « Increases your Critical Rate by 20% and the damage of
  your Critical Hits by 20% », `[Automatic Effect]` sans la moindre
  condition, toujours actif.
- **Extension de `BONUS_DEGATS_SELON_VIT_CONNUS`** — Chun-Li (Lumière),
  « Heavenly Kicks », et Leah (Lumière), « Turn Out » : texte identique mot
  pour mot à Sonia, seuls les paliers changent (**max 200 % à +150 points
  d'écart de VIT**, confirmé par l'utilisateur, contre 50/50 pour Sonia).
  ⚠️ Heavenly Kicks n'existe que sur la forme Lumière de Chun-Li — ses
  quatre autres formes portent un passif différent (Rankyaku, une formule
  propre à ATQ selon la VIT, hors du périmètre de cette famille).
- **Bonus conditionnel à bouton** (`BONUS_DEGATS_CONDITIONNEL_CONNUS`,
  `monsterBonusDegatsConditionnel`) — treize entrées vérifiées, une
  condition binaire que l'app ne peut PAS déduire (PV propres au monstre,
  comparaison de PV avec la cible, état d'un allié, tour précédent, pose
  active…), toujours « +X % au total, désactivé par défaut » :

  | Passif | Monstre(s) | Condition | Bonus |
  |---|---|---|---|
  | Indomitable Will / Martial Artist's Will | Jin Kazama, Kai | PV ≤ 23,5 % | +100 % |
  | Self Repair | Cyborg (Vent), Eliza | PV > 50 % | +100 % (simplifié binaire) |
  | Small Grudge | Brownie Magician (Lumière), Gemini | tes PV % < ceux de la cible | +100 % |
  | Vengeful Fire / Quality of Phantom | Astar, Jean | la cible a plus de PV % que toi | +100 % |
  | Strategic Advantage / Infinity / Magic Resistance | Kyle, Satoru Gojo (Feu), Werner (Feu) | pas attaqué depuis ton dernier tour | +100 % |
  | Protective Power / Retributive Power | Zenitsu Agatsuma (Feu), Qilin Slasher (Feu) | un allié est sous incapacité | +50 % |
  | Almighty Strength | Panda Warrior (Ténèbres), Mi Ying | ton ATQ > celui de l'adversaire | +50 % |
  | Hidden Aim | Sniper Mk.I, Carcano, Carbine, Dragunov (3 éléments × 2 stades d'éveil) | tu es dans la pose Hidden Aim | +200 % |

  ⚠️ **Hidden Aim n'est PAS un passif** (S2 actif, `formule` vide dans les
  données SWARFARM) — c'est une exception au reste de cette famille,
  demandée explicitement par l'utilisateur pour Carcano malgré ça :
  `monsterBonusDegatsConditionnel` ne filtre pas sur `c.passif` (les autres
  entrées sont toutes passives). Nom curé
  exclusif à cette famille de monstre dans tout le corpus — les douze fiches
  (base + éveillé × 3 éléments × 2 stades) partagent le texte mot pour mot,
  couvertes sans code supplémentaire par la curation par nom exact, même
  mécanisme que « Ray Spears ».

  ⚠️ **Self Repair simplifié en binaire** : le texte du jeu dit « increases
  the damage by up to 100% according to your HP condition » — un scaling
  CONTINU entre 50 % et 100 % de PV, sans pente confirmée. L'utilisateur a
  lui-même comparé ce cas à Dominic (binaire) plutôt que de faire deviner
  une courbe — retenu tel quel (0 % / 100 %), documenté comme une
  simplification, pas une confirmation de linéarité.
  ⚠️ **Vengeful Fire porte une SECONDE clause non modélisée** (« increases
  your Attack Power by 150% until the next turn if you receive damage from
  an enemy ») — état de combat séquentiel (a-t-on subi une attaque ce
  tour), hors de portée d'un calcul instantané ; seule la clause dégâts est
  modélisée.
  ⚠️ **Endless Death (Isabelle, +50 % quand son S3 est en recharge) ne
  majore jamais le S3 lui-même** : l'entrée porte `exclutLeSortDetecteur`,
  et le calcul écarte le sort dont l'identifiant est
  `excludeSkillCom2usId`, même si l'interrupteur est resté allumé dans une
  recette. Masquer le seul contrôle ne suffirait pas.

  Stockage : **même `Record` que `passifsOffensifs`** (clé =
  `skillCom2usId` de CE modificateur) — pas un nouveau champ dans
  `DamageSetup`, ces modificateurs n'ont pas de formule propre à
  additionner mais ont bien une compétence à eux. `bonusDegatsConditionnelActif(p,
  setup)` lit ce même Record. Appliqué multiplicativement sur le TOTAL,
  même famille que `bonusDegatsSelonVit`/`bonusDegatsStack` — seule la
  SOURCE change (un bouton plutôt qu'une valeur saisie ou déduite de la VIT).


## Formule selon un compteur (Crawler)

Rupture avec toutes les familles précédentes : ni un modificateur sur le
TOTAL (monstre-wide), ni un pourcentage multiplicatif sur un sort — un
terme ADDITIF sur le COEFFICIENT d'UN sort actif précis, selon un
compteur. Formule exacte fournie par l'utilisateur, avec démonstration
algébrique : « Si Crawler subit N attaques avant de lancer son S1 (qui
frappe normalement 2 fois à 2,04×Défense par coup), les dégâts par coup
s'expriment ainsi : (2,04×Défense)+(N×0,20×Défense). Compteur configurable
de 0 à 9999. »

`SkillDamageProfile.bonusCoefficientParCompteur?: { coeffParPoint: number;
variable: DamageVariable; label: string }`, curé dans `BONUS_COEFFICIENT_
PAR_COMPTEUR_CONNUS` (clé = `Competence.nom`, « Hammer Punch » — EXCLUSIF
à la famille Frankenstein/Crawler dans tout le corpus, 20 fiches
vérifiées). `2,04×{DEF}` (formes Crawler) et `1,8×{DEF}` (formes
Frankenstein classiques) portent TOUTES deux « Rage Charge (Passive) »
avec le même texte — même mécanisme, `+0,2×DEF` par attaque reçue,
appliqué aux deux (confirmé partagé par l'utilisateur, l'énoncé initial ne
chiffrant que le cas Crawler).

⚠️ **Jamais une réécriture de `formule`** (l'invariant central de ce
fichier) : le terme additif est recalculé à partir de la MÊME variable
déjà évaluée dans `valeurs` (`ajoutCompteur = coeffParPoint × compteur ×
valeurs[variable]`), ajouté au multiplicateur `evaluer(profile.noeud,
valeurs)` juste après son évaluation — dans les DEUX chemins de calcul
(court et séquentiel). `DamageSetup.compteurPersonnalise?:
Record<skillCom2usId, number>` (même espace de clés que
`coupsPersonnalises`) porte le compte SAISI, borné à 9999
(`resolvedCompteurPersonnalise`) — 0 par défaut, aucun état de combat
simulé. Champ affiché à côté du sort choisi (« Compétence utilisée »),
gaté sur `resolved.bonusCoefficientParCompteur`.


## Bonus selon les effets sur la CIBLE

Contrairement aux familles précédentes (qui majorent le TOTAL, monstre-wide),
celle-ci est propre à UN SORT ACTIF précis : `SkillDamageProfile.
bonusParEffetCible?: { pct: number; source: 'buffs' | 'debuffs' |
'buffsEtDebuffs' }`, curé dans `BONUS_PAR_EFFET_CIBLE_CONNUS` (clé =
`Competence.nom`, même discipline que `IGNORE_DEF_SELON_VIT_CONNUS`/
`COUPS_VARIABLES_CONNUS`). ⚠️ `source` remplace l'ancien `inclutDebuffs:
boolean` (Backup Code, plus bas) : un booléen ne pouvait exprimer que
« buffs seuls » / « buffs et débuffs », jamais « débuffs seuls » (Backup
Code).

- **Julie/Pierrette** (« Thousand Shots », S3) : « The damage increases by
  50% for each beneficial effect on the enemies. » `+50 %` confirmé
  DIRECTEMENT dans les données SWARFARM (`quantite: 50` sur l'effet
  « Buff Bonus Damage »), pas seulement la prose libre. ⚠️ Les coups sont
  eux-mêmes VARIABLES — confirmé par l'utilisateur : **4 à 6 coups** (6
  pile à pleine vie, « Attacks 6 times when this attack is used with full
  HP »). Ajoutée à `COUPS_VARIABLES_CONNUS` (même mécanisme qu'Okeanos S3/
  Amber S2, voir « Coups variables » plus haut) : `Competence.coups` (6)
  ne portait QUE le cas pleine vie, exactement le piège que cette table
  existe pour corriger. ⚠️ **`defaut: 6`, PAS le minimum** — exception
  explicite à la règle générale (« jamais une surestimation, retombe sur le
  minimum ») : demande directe de l'utilisateur, le cas pleine vie étant le
  plus représentatif d'un début de combat. Nouveau champ optionnel
  `COUPS_VARIABLES_CONNUS[nom].defaut` (absent = comportement inchangé,
  retombe sur `min` comme avant pour Sia/Okeanos/Amber).
- **Melissa/Chakram Dancer** (« Massacre Dance », S3) : « increases the
  damage by 10% each according to the number of beneficial AND harmful
  effects granted on the target » — BUFFS **ET** DEBUFFS, contrairement à
  Julie. `+10 %` confirmé sur LES DEUX effets SWARFARM (« Buff Bonus
  Damage » et « Debuff Bonus Damage », `quantite: 10` chacun).
- **Covenant/Sniper Mk.I** (« Suppressive Fire », S2) : « Removes all
  beneficial effects granted on the enemy target with a 70% chance, and
  deals damage that increases according [to] the number of beneficial
  effects removed. » `quantite: 0` dans les données SWARFARM : la valeur
  vient de l'utilisateur : « chaque buff sur l'ennemi rajoute
  100% au ratio du sort » — `+100 %`, BUFFS seuls comme Julie. ⚠️ Le compte
  saisi représente les effets RÉELLEMENT RETIRÉS (chacun à 70 % de chance),
  pas le nombre présent avant l'attaque — à l'utilisateur de le renseigner,
  l'app ne simule pas ce tirage.

`DamageSetup.effetsCibleCount?: Record<skillCom2usId, number>` (même espace
de clés que `coupsPersonnalises`/`stackPersonnalise`) porte le compte SAISI
par l'utilisateur — l'app ne simule aucun effet réel sur l'adversaire (0 par
défaut, jamais deviné). `resolvedEffetsCibleCount(profile, setup)` le
résout ; `computeSkillDamageDetail` l'applique multiplicativement
(`1 + pct × compte / 100`) dans le terme `horsCoup`, aux côtés de
`reductions` — propre au sort qui le porte, contrairement aux modificateurs
monstre-wide. Champ affiché dans « Adversaire » (comme PV/VIT de la cible),
libellé « Effets bénéfiques sur la cible » (Julie) ou « Effets sur la
cible » (Melissa, sans distinction buff/debuff).


## Bonus conditionnels et cumulables

**Selon les PV propres** — `BONUS_DEGATS_CONDITIONNEL_CONNUS` et
`BONUS_DEGATS_STACKABLE_CONNUS` :

- **Idunn's Heart/Eivor (Feu)** et **Innate Physical/Solveig** :
  « if you have taken less than 20% of your MAX HP as damage during the
  previous turn, increases the damage dealt this turn by 100% » — `+100 %`,
  toggle. ⚠️ Nom RÉEL vérifié par grep exhaustif du corpus avant de curer :
  « Idunn's Heart » est sur la forme **Feu** d'Eivor, pas Eau (piège
  identique pour « Cold Brew », plus bas).
- **Brawler's Will/Neostone Fighter, Trevor** : « increases the
  damage dealt... as your HP decreases » (`quantite: null`) — confirmé
  +2 %/point de % de PV PROPRES perdus, jusqu'à +200 %. Réutilise
  `BONUS_DEGATS_STACKABLE_CONNUS` (même mécanisme de saisie manuelle que
  Momo), aucun code nouveau.

**Nouveaux `BONUS_DEGATS_CONDITIONNEL_CONNUS`** (toggle, +X % au total,
condition non déductible) :

- **Path of the Brave Warrior/Deragron** : « up to 200%, on the
  next turn » après un soin reçu — simplifié en binaire (0/200 %), comme
  Self Repair.
- **Female Warrior/Sabrina** : « 20% more damage on enemies with
  no beneficial effects » — inverse conceptuel de Julie (bonus si la cible
  N'A PAS d'effet, pas selon son nombre). ⚠️ **20 %, pas 200 %** :
  `quantite: 20` dans SWARFARM ; une réponse de l'utilisateur disait
  « jusqu'à 200 % », très probablement une confusion avec Cold Brew/Iced Tea
  juste en dessous. Les données prévalent.
- **Cold Brew/Espresso Cookie (Eau)** et **Iced Tea/Black Tea Bunny (Eau),
  Rosemary** : « +200% if you attack the frozen enemy on your
  turn » — confirmé en données (`quantite: 200`).

**Internal Force/Paladin, Leona** (identifiant 12515) —
`BONUS_DEGATS_CONDITIONNEL_CONNUS` :
« Creates a Shield equal to your Defense for 2 turns when you are attacked.
Increases the damage dealt by 50% when you have a Shield. »

- **Le Bouclier n'est pas compté.** `formule: 2.0*{DEF}` décrit le Bouclier,
  créé « when you are attacked » : ce n'est pas une attaque ([valeurs curées](valeurs-de-jeu-curees.md),
  « Une attaque se lit dans la prose »).
- **Le +50 % est compté** : effet `Increase Damage`, `quantite: 50`, note
  « When you have a Shield. » ; `+50 %` sur les dégâts du monstre sous le
  bouton « bouclier actif », désactivé par défaut (même clé de stockage,
  `passifsOffensifs[12515]`, que l'ancien bouton). Qu'il majore le total
  comme le reste de la famille (multiplicatif, hors bucket Additionnel)
  n'est pas mesuré en jeu.
- ⚠️ **Ne pas en faire un `PASSIFS_OFFENSIFS_CONNUS` `conditionnel`** dont
  le `2.0*{DEF}` s'ajouterait aux dégâts bouton allumé, le +50 % portant sur
  les dégâts que le Bouclier absorbe : le Bouclier n'est pas une attaque ;
  le test dit pourquoi cette lecture est fausse.
- L'égalisation ATQ/DEF du début de combat (« the value of the lower stat
  will equal that of the higher ») reste hors modèle : mécanisme neuf,
  marqué « Calcul partiel » ([formules-et-combat.md § Calcul partiel — l'étiquette par identifiant](feat-formules-et-combat.md)).

**Nouveau `PASSIFS_OFFENSIFS_CONNUS` `conditionnel`** (toggle, formule
PROPRE au passif, pas un % du total) :

- **Comeuppance/Onmyouji, Giou** : `formule: 0.2*{Target MAX HP}`
  confirmée (capture du bestiaire à l'appui). ⚠️ Ne pas l'exclure par
  analogie avec `skillDamageProfile`, qui rejette un sort ACTIF
  stat-indépendant parce qu'INUTILE comme référence de classement des
  builds : la raison ne s'applique PAS à `monsterOffensivePassives`, qui
  somme une contribution RÉELLE au total affiché, jamais utilisée pour
  classer. `monsterOffensivePassives` ne rejette qu'une formule vraiment
  illisible ; toutes les autres entrées de la table dépendent d'au moins
  une stat de l'attaquant. `critique: 'jamais'`,
  catégorie `conditionnel` (bouton).

**Nouveau `BONUS_DEGATS_STACKABLE_CONNUS`** (compteur saisi manuellement, 0
par défaut, même mécanisme que Momo) :

- **Sleep Talk/Hypnomeow, Birman, Manx, Bombay** : « +100%
  while sleeping... +200% on the next turn » (au réveil) — DEUX états
  distincts, confirmé par l'utilisateur comme « toggle entre 0 %, 100 % et
  200 % » — `{pctParStack: 100, pctMax: 200}` donne exactement ces trois
  paliers.
- **Destroyer of Battlefield/Slayer, Borgnine** et **Fire
  Bead/Dokkaebi Lord (Feu), Moogwang** : « damage... increases
  proportionate to the enemy's DESTROYED HP » (`quantite: 0`) — confirmé
  +0,5 %/point pour Borgnine (jusqu'à +30 %), +1 %/point pour Moogwang
  (jusqu'à +60 %). Le « point » représente 1 % de PV cible DÉTRUITS (pas
  perdus normalement), saisi manuellement.


## Modificateurs additifs
**Modificateurs MONSTRE-WIDE ADDITIFS** (nouveaux, s'ajoutent au
MULTIPLICATEUR du sort choisi comme `bonusCoefficientParCompteur`/Crawler,
mais déduits d'un passif sans formule plutôt que propres à un sort — voir
`computeSkillDamageDetail`, paramètre `monsterWide` étendu) :

⚠️ **Un mécanisme porté par un PASSIF (`formule: ""`) ne se code JAMAIS
comme un champ de `SkillDamageProfile` keyé par le nom du passif** —
`skillDamageProfile()` (`if (c.passif || !c.formule …) return null`) ne
construit un profil QUE pour un sort ACTIF à formule : une telle entrée n'y
serait jamais lue. Ces six mécanismes sont donc des modificateurs
monstre-wide (`monsterWide`). Seul `bonusConditionnelPropre` (Emergency Drive → Rending Claw)
reste sur `SkillDamageProfile`, à raison : « Rending Claw » est un vrai sort
ACTIF. ⚠️ Un mécanisme se branche AUSSI dans le calcul, pas seulement dans
la table, le résolveur et l'UI : la multiplication de
`bonusConditionnelPropre` vit dans `computeSkillDamageDetail`
(`facteurConditionnelPropre`), et un test la garde.

- **Spear of Tenacity/Centaur Knight, Pholus** : « damage...
  proportionate to the enemy's MAX HP » — confirmé +2 %. Toujours actif,
  soumis au critique/à la défense comme le reste du sort.
- **Martial Arts Specialist/Martial Artist, Sin** : « additional
  damage proportionate to your Defense if your Defense is higher than the
  opponent » — confirmé 50 % de l'écart, à CHAQUE coup, jamais négatif
  (`max(0, DEF − DEF cible)`).

## Sacrifice, comptes d'effets et bouton de sort
- **Calculated Sacrifice/Onimusha, Fuuki** : « Decreases your
  current HP by 20% at the start of each turn and inflicts additional
  damage by 15% of the lost HP when you attack... Cannot Critical Hit. »
  Confirmé en données (`quantite: 20`/`15`). L'app ne simule pas la
  compression des PV tour après tour : `DamageSetup.
  pvActuelsAvantSacrificePct` (défaut **100**, PREMIER tour — seule
  exception « défaut non nul » de tout ce module, avec `defaut: 6` de
  Julie) porte les PV ACTUELS saisis par l'utilisateur. ⚠️ « Cannot
  Critical Hit » n'est PAS appliqué automatiquement (aucun mécanisme
  monstre-wide de blocage du critique) — à sélectionner manuellement via
  le mode de critique « Normal » pour ce monstre.

**Modificateurs MONSTRE-WIDE MULTIPLICATIFS selon un compte d'effets**
(même mécanisme que Julie/Melissa mais MONSTRE-WIDE — majore le sort choisi
quel qu'il soit, pas un sort précis) :

- **Backup Code/Hacker, 570RM** : « damage increases by 20% for
  each harmful effect granted on target » — confirmé (`quantite: 20`).
  PREMIER cas « débuffs SEULS » du fichier (`source: 'debuffs'`).
- **Blessing of Curse/Devil Maiden, Jessica** : « For each harmful
  effect granted on allies (including yourself), increases the damage dealt
  by 20%, up to 200% » — confirmé (`quantite: 20`, note « up to 200% »).
  Compte les débuffs sur les ALLIÉS, soi compris (`DamageSetup.
  effetsPropresCount`, stockage séparé de `effetsCibleCount`), et le bonus
  s'arrête à +200 % (`plafondPct`, `pctBonusParEffetPropreMonstre`). Champ
  « Débuffs sur tes alliés (toi compris) ».

**Bouton restreint à UN SORT** (nouveau : `SkillDamageProfile.
bonusConditionnelPropre?: { pct: number; condition: string }`) :

- **Emergency Drive/Cynthia, Arcane Weapon** : « deal 70%
  increased damage » (`quantite: 70`) UNIQUEMENT « While in the mechanical frame state », un
  état qui force l'usage de **Rending Claw** (S2) — un bouton monstre-wide
  aurait été faux dès qu'un AUTRE sort est sélectionné à l'écran. Le bouton
  ne majore donc QUE Rending Claw, jamais Mechanical Fist (S1). Le nom est
  partagé par trois identifiants (23306 Cecilia, 23307 Cynthia, 23310
  Elise) mais seule la fiche de Cynthia porte Emergency Drive : le bouton
  est posé **par identifiant** (23307, `BONUS_CONDITIONNEL_PROPRE_PAR_ID_CONNUS`,
  prioritaire sur la table par nom) ; Cecilia et Elise n'ont pas ce bouton.


## Statistiques
**QUATRIÈME et CINQUIÈME mécanique liée à une stat** (multiplicatif sur le
TOTAL, linéaire, plafonné, toujours actif — même famille que Sonia/écart de
VIT, source différente) ; une SIXIÈME, de forme différente (seuil ABSOLU,
pas linéaire), suit juste après :

- **Hidden Sense of Justice/Zenitsu Agatsuma (Ténèbres)** et **Lethal
  Intent/Qilin Slasher (Ténèbres)** : « increases the damage
  dealt according to your Critical Rate » (`quantite: 0`) — confirmé
  linéaire, +0,8 % de dégâts par point de Taux Crit BRUT (avant plafond à
  100 % — cohérent avec Wolf School Training, qui traite déjà ce nombre
  comme significatif au-delà de 100 %). SEUL cas du fichier où le Taux
  Crit devient une stat à privilégier au pré-filtrage.
- **Aegis Shell/Beetle Guardian, Gideon** : « increases the
  damage you deal to enemies by up to 100% in proportion to your Defense »
  (`quantite: 100`) — confirmé 100 % à 5000 DEF (« y compris lead, buff
  DEF »). Distinct de Martial Arts Specialist : ici c'est la DEF PROPRE,
  sans comparaison avec la cible. Cette DEF de combat comprend aussi les auras Determination, externes et propres au build, dans
  l'arrondi du lead ([sets d'aura](feat-effets-equipe-et-leaders.md)).

⚠️ **La formule linéaire-plafonnée partagée par toute cette famille**
(Sonia, Chun-Li/Leah…) clampe `Math.min(ecartMax, écart)`, jamais
`Math.min(pctMax, écart)`, qui ne serait juste que si `ecartMax == pctMax`
(Sonia : 50/50, coïncidence). Pour Chun-Li/Leah (`ecartMax: 150,
pctMax: 200`, valeurs DIFFÉRENTES), l'autre clamp donnerait ~267 % au-delà
de 150 points d'écart de VIT au lieu de rester plafonné à 200 %. Testé
au-delà du plafond.

**Might of the Mercenary/Mercenary Queen, Brita** / **Might of
the Clan/Eivor (Eau)** — SIXIÈME mécanique liée à une stat, mais d'une
forme NOUVELLE : un SEUIL ABSOLU (binaire), pas un scaling linéaire comme
les cinq précédentes. « Grants up to 3 effects... according to your
stats... (Attack Power: Increases the damage dealt to enemies by 100%,
Defense: Decreases the damage received from enemies by 30%, Attack Speed:
Removes 1 beneficial effect granted on the enemy with a 50% chance) » —
seule la branche **Attack Power** porte un bonus de DÉGÂTS ; les deux
autres sont défensives/hors modèle. Brita et Eivor (Eau) sont des JUMEAUX
DE COLLABORATION (`jumeauCollab`, mêmes stats et compétences sous deux
habillages) — même mécanisme, deux noms de passif différents.

Les seuils sont des totaux de combat, pas des écarts : l'ATQ comparée
comprend donc aussi les auras Fight, externes et propres au build
([sets d'aura](feat-effets-equipe-et-leaders.md)). Le relevé indépendant
de Brita conserve **1671 ATQ**. Pour Eivor (Eau), le relevé le plus récent
donne **1520 ATQ**, **1520 DEF** et **213 VIT**. L'écran montre les trois
objectifs et leur équivalent au-dessus de la fiche : avec Combat,
`+628 ATQ`, `+720 DEF`, `+111 VIT` ; avec Combat + Guilde, `+501 ATQ`,
`+634 DEF`, `+111 VIT`. Seule la branche ATQ entre dans le score de dégâts ;
DEF et VIT sont néanmoins affichées pour permettre de construire les trois
parties du passif.


## Brandia
**Brandia (« Touch of Mercy »)** — signalée par l'utilisateur (« augmente
ses dégâts selon le nombre d'effets néfastes sur l'ennemi »), absente de
TOUTES les tables existantes. Cause trouvée : le catalogue original (65
entrées) ne cherchait que les flags SWARFARM « Increase Damage »/« Increase
Critical Damage »/« Buff Bonus Damage » — Brandia porte « Debuff Bonus
Damage », jamais cherché. « The inflicted damage is increased by 40% for
each harmful effect OR beneficial effect of the enemy » (`quantite: 40`,
confirmé) — BUFFS ET DEBUFFS comptés ensemble (comme Melissa), pas
« débuffs seuls » malgré la description du signalement. Ajoutée à
`BONUS_PAR_EFFET_CIBLE_CONNUS` (sort actif, S3).

⚠️ **Touch of Mercy porte une SECONDE clause**, signalée séparément par
l'utilisateur : « Targets that have immunity against sleep will be
inflicted with 50% more damage. » Aucun effet SWARFARM dédié (seuls
« Sleep »/« Debuff Bonus Damage » sont listés dans les données) — condition
que l'app ne peut pas déduire, `+50 %` confirmé par l'utilisateur. Bouton
RESTREINT À CE SORT (`SkillDamageProfile.bonusConditionnelPropre`, même
mécanisme qu'Emergency Drive/Rending Claw), PAS monstre-wide : le texte ne
décrit que cette attaque précise, pas un bonus général du monstre. Les
deux clauses de Touch of Mercy (par effet, immunité au sommeil) se
COMPOSENT multiplicativement quand les deux sont actives, comme partout
ailleurs dans ce fichier.
