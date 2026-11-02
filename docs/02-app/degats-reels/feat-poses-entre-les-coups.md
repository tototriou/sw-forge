# Dégâts réels — effets posés entre les coups

Un sort à plusieurs coups peut poser un effet néfaste (Marque, Réduction de
DEF…) dès un de ses premiers coups : les coups suivants le subissent. Ce
document dit quels sorts le proposent, quels coups posent, comment le joueur
le règle, et ce que le calcul en fait. Code : `effetsEntreCoupsDuSort`,
`EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID`, `rangsDePoseProposes` et
`calculerChronologie` dans [damage.ts](../../../src/lib/damage.ts) ; écran :
[DamageSetupCard.tsx](../../../src/components/outils/DamageSetupCard.tsx).

La liste des sorts, sort par sort, est dans
[inventaire-effets-entre-coups.md](inventaire-effets-entre-coups.md).

Voir aussi : [feat-conditions-et-audit.md](feat-conditions-et-audit.md)
(compteurs de débuffs, conditions « la cible porte un effet nocif »),
[feat-passifs-offensifs.md](feat-passifs-offensifs.md) (ce qu'un passif qui
suit le sort lit après ses coups).

## Quels sorts

Un sort **actif calculé** à **plusieurs coups** (au moins deux, plage de coups
comprise), hors séquence curée, propose chaque effet néfaste que **sa donnée**
pose sur l'ennemi (`type: 'Debuff'`, `surSoi: false`) :

- **toujours** la Réduction de DEF (`Decrease DEF`) et la Marque (`Brand`) :
  elles changent la DEF ou les dégâts subis des coups suivants ;
- **un autre effet** (Étourdissement, Dégâts continus, Irrécupérable, Gel…)
  seulement quand le compte des effets nocifs de la cible est **lu** : par le
  sort lui-même (bonus par effet nocif, condition « la cible porte un effet
  nocif ») ou par le monstre (passif, modificateur monstre-wide : Spirit's
  Wrath d'Aeilene, Tiger's Appearance de Naomi, Ancient Power de Tesarion,
  Backup Code de 570RM). Sans lecteur, il ne change aucun chiffre et n'est pas
  proposé.

La règle lit la donnée de **chaque identifiant**, jamais un nom : « Blackout
Kick » compte quinze homonymes au texte différent, et seul 3454 (Sia) pose une
Réduction de DEF. Elle suit le corpus sans curation : un sort ajouté par des
données régénérées est proposé s'il porte l'effet, et l'inventaire figé
(`testInventaireEffetsEntreCoups`) le signale pour relecture.

Les sorts du mode archer des anges jumeaux (Focus Shot, Air Shot), venus de
leur compétence auxiliaire, suivent la même règle.

## Quels coups posent

- **La note de l'effet**, quand elle nomme un rang (« 1st hit », « 2nd and
  3rd hit », « First 3 hits », « 4th hit only »…) : chaîne exacte de la donnée
  (`RANGS_PAR_NOTE`), jamais une expression régulière.
- **Sinon la prose**, quand elle le dit et que la donnée ne le dit pas : une
  entrée de `EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID` (Crushed Hopes, « the second
  attack decreases the Defense » : coup 2).
- **Sinon chaque coup** : une prose qui ne précise pas le coup pose à chacun
  (règle de l'utilisateur, 2026-11-02), et le joueur choisit après lequel la
  pose réussit.

Un effet posé au **seul dernier coup** ne change rien au sort et n'est pas
proposé (Domain Expansion de Megumi, Continuous Summoning Technique de
Tetsuya, Crushing Swipe de Daisy et Christine : « the last hit decreases… »).

Une note qui pose une **condition** plutôt qu'un rang s'affiche après le
libellé (`PRECISION_PAR_NOTE`) : « un seul des effets possibles par coup, au
hasard » (Virus), « en état Thunderer » (Wild Bolt), les deux branches de
Divine Judgment (Arella) ; un effet de la donnée marqué `surCritique` porte
« sur coup critique » (Triple Attack de Cogma).

Deux entrées du même effet s'unissent : des rangs différents donnent tous
leurs rangs (Triple Combo de RYU : coups 1 et 2) ; deux entrées identiques
d'un effet cumulable posent chacune le leur (Meteor Strike de Triss et Black
Meteor de Celestara : deux dégâts continus par coup, `nombre: 2`).

## Exceptions lues dans la prose

`EFFETS_ENTRE_COUPS_EXCEPTIONS_PAR_ID` corrige la donnée d'un identifiant,
jamais ne complète la règle :

| Sort | Correction | Prose |
| --- | --- | --- |
| Soul Summoning (Rigel 7501, Fuco 7503) | pas de Réduction de DEF, une Réduction de VIT | « Each attack has a 40% chance to decrease the enemy's Attack Speed » (la donnée dit `Decrease DEF`) |
| Crushed Hopes (Cichlid 10413) | Réduction de DEF au coup 2 | « the second attack decreases the Defense » |
| Fast Link (Barbara 13606, Masha 13607, Xiana 13610) | Réduction de DEF au coup 1 | « The beast's attack decreases the enemy's Defense » ; la bête attaque en premier, sans relevé |
| Weakness Shot (Carlos 15507, Dominic 15508, Benedict 15509) | Marque au coup 1 | « Attacks the enemy to leave a Branding effect … and attacks 3 more times » |
| Axe Technique of the Mercenary Queen (Solveig 18007, Berghild 18009) | Marque au coup 1, absente de la donnée | « The first attack leaves a Branding effect for 1 turn with a 100% chance » |
| Wild Bolt (Vendhan 18127, Dyeus 18129) | Marque « en état Thunderer » | « When used during the Thunderer state, leaves a Branding effect » (la note ne figure que sur Chakra, 18128) |
| Whirlpool (Tanjiro 21311), Water Dragon Surge (Azure Dragon Swordsman 21911) | Gel au coup 1 ; les dégâts continus des coups en plus ne sont pas proposés | « Attacks all enemies to Freeze them … Deals additional damage 2 more times to targets with harmful effects » |

## Le réglage à l'écran

Dans la fenêtre « Dégâts réels », parmi les réglages du sort, l'interrupteur
« Prendre en compte les débuffs posés entre les coups » ouvre une ligne par
effet proposé :

- **un seul coup pose** l'effet : un interrupteur « Posé au coup N » ;
- **plusieurs coups** le posent : un sélecteur « Aucune réussite », puis
  « Après le coup N » pour ces seuls coups (`rangsDePoseProposes`, toujours
  avant le dernier coup que le réglage retient) ;
- un effet non cumulable que la cible peut déjà porter garde son
  interrupteur « déjà présent » ; la Réduction de DEF et la Marque lisent
  « Brise DEF » et « Marque » du réglage.

Un sort sans aucun effet proposable n'affiche pas la section. Le nombre de
coups saisi d'un sort à coups variables (Rain of Stones, 3 à 5) borne les
coups proposés.

## Le calcul

Rien n'est jamais supposé posé : sans scénario actif, ou actif sans réussite,
le total ne change pas. Sous scénario, chaque coup lit l'état qui le précède
(`calculerChronologie`) : après le coup choisi, la Réduction de DEF et la
Marque s'appliquent aux coups suivants, un autre effet ajoute un effet nocif
au compte (le nombre de la pose pour un effet cumulable, un seul pour un effet
non cumulable déjà présent : aucun). Une pose demandée à un coup qui ne pose
pas l'effet (recette importée, données régénérées) n'a pas lieu.

Whirlpool et Water Dragon Surge n'ont qu'un coup de base : leurs deux coups en
plus ne frappent qu'une cible affligée. Le Gel posé au coup 1 les donne
(`poseAvantLesCoupsEnPlus`), exactement comme l'interrupteur « La cible porte
un effet nocif » : même total.

Une contribution qui suit le sort (passif, attaque appelée) lit l'état après
son dernier coup, poses comprises
([feat-conditions-et-audit.md](feat-conditions-et-audit.md#correctifs-de-contexte-et-de-dégâts-fixes)).

## Écartés

- **Nombre de coups contredit par la prose** : Crow Hunt de Prilea (1618,
  « attack the enemy target 2 times », `coups: 1`) et Splash Splash de
  Noctaris (25815, « Attacks the enemy … Afterwards, attacks random enemies
  2 to 3 times », `coups: 1`) se calculent sur un coup ; leur Réduction de DEF
  et leur Marque deviendront proposables d'elles-mêmes avec le bon nombre de
  coups ([Crow Hunt de Prilea](../../05-feuille-de-route/pistes-degats-reels.md#crow-hunt-de-prilea--deux-coups-annoncés-pour-un),
  [Splash Splash de Noctaris](../../05-feuille-de-route/pistes-degats-reels.md#splash-splash-de-noctaris--un-coup-en-donnée-trois-ou-quatre-en-prose)).
- **Sans dégâts** : Harmless Prank d'Orion (8811), qui pose sans frapper.
- **Bonus au seul coup 2** de Hairpin: Black Flash et Exorcist Shuriken
  Formation (20315, 20915 : +100 % si la cible porte un effet nocif) : leur
  Réduction de DEF du coup 1 est proposée, le bonus n'est pas compté
  ([piste](../../05-feuille-de-route/pistes-degats-reels.md#poses-entre-les-coups--buff-posé-par-le-sort-eightfold-bonus-du-coup-2)).

## Vérification

- `testInventaireEffetsEntreCoups` fige l'inventaire des formes jouables
  (`tests/fixtures/effets-entre-coups-inventaire.json`) : sorts, effets,
  rangs, porteurs ; toute note d'un effet proposé est classée.
- `testEffetsPosablesConnus` : chaque effet `Debuff` du corpus a son libellé.
- `testEffetsEntreCoupsRegle` : rangs, exceptions, coups en plus, compte et
  invariance sans réussite sur tout l'inventaire.
- `testRenduEffetsEntreCoupsEcran` : interrupteur, sélecteur limité, section
  absente, aux deux formats.

Tests : [tests/degats-effets-entre-coups.test.ts](../../../tests/degats-effets-entre-coups.test.ts),
[tests/rendu/effets-entre-coups-ecran.test.tsx](../../../tests/rendu/effets-entre-coups-ecran.test.tsx).
