# Dégâts réels — passifs offensifs

**Statut :** ÉTAT ACTUEL — décrit les passifs et modificateurs offensifs calculés
**Lire si :** on modifie un passif offensif, un nombre de coups ou une condition liée aux statistiques
**Ne pas lire si :** on cherche les entrées curées et leurs paramètres propres
**Voir aussi :** spec/outils/degats-reels/catalogue-des-passifs.md, spec/outils/degats-reels/conditions-et-audit.md

## Passifs offensifs — dégâts supplémentaires au-delà du sort choisi

Certains monstres infligent des dégâts **en plus** du sort actif choisi, via
un passif qui a lui-même une formule de dégâts (Feng Yan, Sia, Roid,
Dominic…). `monsterOffensivePassives(detail)` les détecte et
`computeTotalDamage(profil, passifs, stats, setup, élément)` additionne leur
contribution à celle du sort de base — c'est elle, et non `computeSkillDamage`
seul, que consomme l'objectif « Dégâts réels » (`objectiveScore`,
[runeBuildOptim.ts](../../../src/lib/runeBuildOptim.ts)) dès qu'au moins un passif est
reconnu.

⚠️ **Curation à la main, jamais une extraction automatique** —
`PASSIFS_OFFENSIFS_CONNUS` ([damage.ts](../../../src/lib/damage.ts)) est une liste
explicite de passifs vérifiés, par leur `Competence.nom` SWARFARM exact. La
**formule elle-même** est lue en direct depuis les données (même parseur,
même discipline tout-ou-rien que le sort actif) — seule l'**appartenance à
la liste** et sa **catégorie** sont figées en dur. **Seule exception** :
quand les données ne portent aucune formule, ou une fausse, elle vient de
`FORMULES_CUREES_PAR_ID`, par identifiant et avec sa source — la même table,
la même priorité et la même garde que pour un sort actif. Tempest (`3213`,
Teshar et Phoenix vent) porte `formule: ""` et reçoit ainsi `3.7 × ATQ`
([valeurs curées](valeurs-de-jeu-curees.md), « Tempest (Teshar) »). Un passif absent de la liste (immense
majorité du corpus) n'est simplement jamais
proposé : pas de faux négatif dangereux, juste une couverture partielle et
volontaire.

Quatre catégories, sur la seule question « quand ce passif compte-t-il ? » :

| Catégorie | Comportement | Exemple |
|---|---|---|
| `toujours` | S'ajoute d'office, aucun bouton — le texte du jeu ne pose aucune condition de combat | Feng Yan (Winds and Clouds), Sia (Great Friends), Benedict (Final Strike) |
| `defBreak` | **Aucun bouton non plus** : le déclenchement est ENTIÈREMENT déduit des deux réglages de réduction de Défense (voir ci-dessous) | Roid (Slash Waves / Slash Wind), Silver (Ruins) |
| `bonus` | Les dégâts de base sont comptés **dans tous les cas** ; le bouton (désactivé par défaut) ne conditionne QUE le surplus de `pct` %, et seulement sur la contribution de ce passif | Ezio (Hidden Gun, +100 % si cible Lumière), Dominic (Improvisation, +100 % si PV > 50 %) |
| `conditionnel` | Bouton, désactivé par défaut ; activé, le passif compte à 100 % comme un second sort. Réservé aux conditions qui ne se modélisent PAS | Giou (Comeuppance), Teshar (Tempest, recharge non simulée : voir [attaque après un sort](attaque-apres-un-sort.md)). ⚠️ Pas Leona : le `2.0*{DEF}` d'Internal Force est un Bouclier créé « when you are attacked », pas une attaque, et ne compte pas ; son « +50 % damage dealt » sous Bouclier est un bonus conditionnel à bouton (`BONUS_DEGATS_CONDITIONNEL_CONNUS`, « bouclier actif ») : voir le [catalogue des passifs](catalogue-des-passifs.md) |

En plus de la catégorie, `slotsDeclencheurs` (curé) restreint les sorts après
lesquels le passif compte (Tempest : S1 ou S2 ; absent, tous) ; `passifCompte`
le lit avec le `slot` du sort RETENU, et n'ajoute jamais un passif choisi comme
sort à lui-même ([attaque après un sort](attaque-apres-un-sort.md)).

⚠️ **`bonus` ne met plus toute la contribution à zéro quand le bouton est
éteint.** Le texte de ces passifs décrit une attaque supplémentaire
INCONDITIONNELLE (« Attacks additionally … when you attack the enemy on your
turn »), dont seule la magnitude est conditionnée. Les confondre
sous-estimerait la base chaque fois que la condition n'est pas remplie : le
texte du jeu se relit entrée par entrée.

⚠️ **`dejaInclus` (Dominic — Improvisation) : la formule elle-même porte le
cas MAJORÉ, pas le cas de base.** `Competence.formule` vaut `2.0*{ATK}
(Fixed)` — 100 % de base × (1 + 100 % si PV > 50 %) — sans formule séparée
pour le cas de base. Demande explicite de l'utilisateur : un bouton comme
Hidden Gun (« pouvoir activer ou non l'augmentation… comme le passif de
Ezio ») ; Dominic était d'abord passé de `bonus` à `toujours` précisément
parce qu'un bouton `bonus` NAÏF aurait doublé une seconde fois une valeur
déjà majorée. `categorie: { type: 'bonus', pct: 100, dejaInclus: true,
condition: 'tes PV dépassent 50 %' }` inverse le sens de l'opération plutôt
que de réécrire la formule (interdit, voir plus haut) : bouton décoché (par
défaut, jamais deviné), la contribution est **divisée** par `1 + pct/100`
pour retomber au cas de base — bouton coché, elle reste telle que parsée
(le cas majoré). Le ratio affiché à l'écran (voir ci-dessous) reste donc
`2.0 × ATQ`, le cas majoré, dans les deux états — c'est le texte de
condition qui précise que le cas de base, lui, vaut la moitié.


## Le ratio de dégâts, affiché pour CHAQUE passif

Comme pour le sort actif choisi (« Compétence utilisée »), l'écran affiche
le **ratio parsé** (`formuleLisible`, ex. `1.9 × ATQ`) et le résumé (nombre
de coups, Zone/Cible unique, Ignore la DEF, améliorations) de chaque passif
de `PASSIFS_OFFENSIFS_CONNUS` — demande explicite de l'utilisateur, gap
d'affichage repéré après l'ajout du toggle de Dominic. Aucune information
manquante à combler : `monsterOffensivePassives` n'inclut déjà QUE les
passifs dont la formule est analysable (voir plus haut, « Curation à la
main… ») — tous les passifs affichés ont donc TOUJOURS un ratio à montrer.
⚠️ Le nombre de coups affiché suit la même règle que le calcul : pour un
passif `coupsDuSortActif` (Feng Yan, Roid…), c'est le nombre RÉELLEMENT
retenu pour le sort actif qui s'affiche, jamais le nombre propre — souvent
non fiable — du passif lui-même.

⚠️ **Même exigence étendue aux modificateurs SANS formule propre** (les
familles du [catalogue des passifs](catalogue-des-passifs.md) — `BONUS_DEGATS_STACKABLE_
CONNUS`, les comptes d'effets monstre-wide, Calculated Sacrifice…) —
demande explicite de l'utilisateur : « affiche les ratios et formules des
passifs/sorts pour lesquels je t'ai fourni l'information ». Quatre blocs
affichaient encore juste « toujours actif » sans le pourcentage/formule
confirmé par l'utilisateur (le nombre restait visible uniquement dans le
texte anglais brut du jeu, en dessous) : Momo/Fermion/Ludo/Martina/
Borgnine/Moogwang/Trevor (`+X %/palier, jusqu'à +Y %`), Backup Code
(`+X %/effet`), Blessing of Curse (`+X %/débuff sur soi`), Calculated
Sacrifice (`sacrifie X %/tour, +Y % de la perte`) — corrigé, le ratio
apparaît maintenant à côté du nom, comme pour tous les autres.


## La réduction de Défense : « avant » n'est pas « après »

Le problème signalé à l'origine (Roid pose lui-même la réduction que son
propre passif vérifie) ne demandait PAS un bouton par passif, mais **un
second réglage** :

| Réglage | Sens |
|---|---|
| `defBreak` | Une réduction de Défense est **déjà active AVANT** le sort |
| `defBreakParLeSort` | Le sort choisi **en pose une lui-même** (n'apparaît que si `profile.appliqueDefBreak`, déduit de l'effet `Decrease DEF` des données) |

Le sort actif n'est JAMAIS affecté par la réduction qu'il pose lui-même (elle
atterrit après son propre coup). Les passifs frappent **après** lui : leurs dégâts
lisent l'état « après » (`defBreak || defBreakParLeSort`) ; sous un scénario de
poses entre les coups, celui qui suit le dernier coup du sort, poses comprises,
sauf un passif `coupsDuSortActif`, qui lit l'état avant chaque coup. Le
déclenchement d'un passif `defBreak` s'évalue au `moment` que dit son texte : `'avant'` pour Roid
(« if you attack the enemy with[out] decreased Defense »), `'apres'` pour Silver (« if the enemy is under Defense reduction effects AFTER you attack »).

Les trois scénarios de Roid, épinglés en test :

| Réduction avant | Posée par le S1 | Passif déclenché | Dégâts du S1 | Dégâts du passif |
|---|---|---|---|---|
| oui | — | Slash Waves | avec réduction | avec réduction |
| non | non | Slash Wind | sans | sans |
| non | oui | Slash Wind | **sans** | **avec** |

⚠️ Les deux branches de Roid étant mutuellement exclusives, **exactement une
des deux se déclenche toujours** — d'où des PV (`{MAX HP}`) qui comptent en
permanence dans le pré-filtrage pour ce monstre.

⚠️ **Deux propriétés du calcul lui-même, orthogonales aux trois catégories
ci-dessus** — quand ce passif compte n'est pas la même question que comment
il se calcule. Ni SWARFARM ni la formule ne les portent : résolues au cas
par cas dans `PASSIFS_OFFENSIFS_CONNUS`, **jamais un défaut générique
appliqué à toute la liste**, chacune confirmée par l'utilisateur pour
l'entrée où elle est posée :
- **`critique`** (défaut `'suit'`) — comment cette contribution traite le
  coup critique, **indépendamment du mode choisi pour le sort actif** :
  `'jamais'` (Feng Yan — Winds and Clouds ; Miles — Jet Engine : le bonus
  ne critique jamais, alors qu'aucun marqueur `(Fixed)` ne l'exprimerait) ;
  `'toujours'` (Ezio — Hidden Gun, Evan — Meticulous Attack : « The
  additional attack ALWAYS LANDS AS A CRITICAL HIT » — force le critique
  même quand l'écran est en « Non critique ») ; `'suit'` partout ailleurs.
- **`coupsDuSortActif`** (défaut `false`) — `true` fait suivre le nombre
  d'instances aux coups du **sort actif choisi**, pas au nombre propre du
  passif. Confirmé `true` sur Winds and Clouds : le bonus DEF s'ajoute à
  CHAQUE coup du sort utilisé (3 coups pour un sort à 3 coups, pas 1).
- **`coups`** (défaut 1) — nombre d'instances quand le texte l'annonce **en
  prose** et que la donnée le contredit : Turning Slash / Flash Step portent
  `coups=1` pour « attacks 2 more times » (curé à 2), Ruins porte 3, Slash
  Waves porte `2` sur une fiche et `1` sur l'autre pour le MÊME passif (curé
  à 2). ⚠️ `Competence.coups` n'est **jamais** utilisé pour un passif.

⚠️ **Les améliorations « Damage +X% » d'un passif comptent, exactement comme
sur un sort actif** (`skillupDamagePct`, même lecture de
`Competence.ameliorations`) — une hypothèse antérieure les ignorait pour
tout passif (« n'existent que pour les sorts actifs »), fausse : Winds and
Clouds en porte 4 (5+5+10+15 = 35 %, `1.6 × 1,35`), trouvée en vérifiant les
données brutes plutôt qu'en la supposant.

**État de vérification, entrée par entrée** (revue manuelle menée avec
l'utilisateur, à partir du fichier de travail listant formule + texte brut
du jeu de chaque entrée) :

| Passif | Monstres | Vérifié |
|---|---|---|
| Winds and Clouds | Feng Yan, Panda Warrior | jamais critique, suit les coups du sort actif, 35 % d'améliorations |
| Great Friends | Sia | critique normalement, 2 à 3 coups (variable) |
| Final Strike | Weapon Master, Benedict | ignore la DEF **et** critique normalement |
| Jet Engine | Sky Surfer, Miles | ignore la DEF, **ne critique jamais** |
| Eye of the Desert / Eagle Deception | Desert Warrior/Salah, Bayek | compté sur la seule cible configurée malgré « random enemy » — même monstre, même passif (Bayek = version collaboration, Salah = version SW native), confirmation étendue de l'un à l'autre |
| Turning Slash / Flash Step | Birgitta, Ciri (Lumière), Magic Order Swordsinger | **2 coups** (prose) ; magnitude croissante avec les PV bas NON modélisée → plancher |
| Hidden Gun / Meticulous Attack | Ezio, Evan, Steel Commander | **critique toujours** ; base inconditionnelle, seul le +100 % dépend du bouton |
| Improvisation | Dominic, Weapon Master | bouton `bonus`/`dejaInclus` (+100 % si PV > 50 %, formule déjà majorée) |
| Ruins | Silver | **3 coups**, critique normalement, déclenchement `defBreak` |
| Slash Waves / Slash Wind | Roid | déclenchement `defBreak` (2 coups pour Slash Waves) |
| Tempest | Teshar, Phoenix (Vent) | formule curée `3.7 × ATQ` (données vides), en zone, +30 % d'améliorations, une instance ; bouton `conditionnel`, après S1 ou S2 seulement ; aussi choisissable comme sort, jamais par défaut |

⚠️ Une entrée « Ruins » sans suffixe `(Passive)` visait un **boss de donjon
non invocable** (Living Armor 2A) : retirée, elle ne pouvait jamais
apparaître dans la box d'un joueur.


## Les PV de la cible se creusent COUP PAR COUP

⚠️ Un sort dont la formule lit `{Target Current HP %}` (Benedict/Dominic —
Weakness Shot, `{ATK}*(3.1 - 1.2*{Target Current HP %})`, 4 coups) voit son
ratio **monter à mesure que la cible descend**. `computeSkillDamageDetail`
simule donc les coups **un par un** : chaque coup retire ses dégâts des PV
courants, et le coup suivant est réévalué sur la cible entamée. Multiplier un
seul coup par `hits` sous-estimait lourdement ces sorts — le 4ᵉ coup de
Weakness Shot vaut bien plus que le 1ᵉʳ.

Un sort qui ne lit PAS cette variable garde le chemin court (une évaluation
× `hits`), au coût et au résultat strictement identiques à avant.

`computeSkillDamageDetail` renvoie donc `{ total, pvRestantsPct }`, et
`computeTotalDamage` **enchaîne** ces PV du sort actif vers les passifs, qui
frappent après lui sur une cible déjà entamée. C'est ce qui permet à
`bonusPvCible` de se déduire tout seul :

- **Final Strike** (Benedict, Weapon Master) — « deals 20 % increased damage
  if [the enemy's HP] is 30 % or below ». Aucun bouton : le seuil est jugé
  sur les PV que la simulation vient de calculer, à l'instant où le passif
  frappe.

⚠️ **Conséquence assumée** : les PV de l'adversaire ne sont plus purement
décoratifs. Pour un sort ou un passif qui en dépend, `enemyHp` et
`enemyHpPct` changent le classement des builds — alors que pour tous les
autres, ils ne servent toujours qu'à lire le résultat. Le champ « PV
restants » s'affiche donc aussi dès qu'un passif porte un `bonusPvCible`,
pas seulement quand la formule du sort lit les PV courants.


## Coups variables — un sort/passif qui frappe un nombre de fois qui change en jeu

Certains sorts et passifs infligent un nombre de coups qui **varie** en jeu
(« 2 à 3 fois de plus », Sia — Great Friends ; « 3 à 5 fois », Okeanos S3 ;
« 4 à 6 fois », Julie — Thousand Shots, 6 pile à pleine vie). `Competence.
coups` (donnée SWARFARM) ne porte qu'**un seul nombre**, pas toujours
cohérent avec le texte du jeu (ex. Rain of Fire : `coups=6` en donnée,
« 3 à 5 fois » dans le texte — ni l'un ni l'autre ; Julie : `coups=6`,
mais 6 n'est que le cas pleine vie) : aucune extraction automatique fiable
n'est possible.

⚠️ **Même discipline de curation que `PASSIFS_OFFENSIFS_CONNUS`** —
`COUPS_VARIABLES_CONNUS` ([damage.ts](../../../src/lib/damage.ts)) associe un
`Competence.nom` exact à une plage `{ min, max, defaut? }`, à la main,
jamais déduite du texte anglais libre. Sert aussi bien un sort actif
(`skillDamageProfile`) qu'un passif (`monsterOffensivePassives`) — même
table, même clé (ou l'identifiant : `conditions-et-audit.md`, « Nombres de coups variables, saisis »). `SkillDamageProfile.hitsRange` porte la plage quand elle
est connue ; `hits` retombe alors sur son **minimum**, jamais une
surestimation par défaut — **sauf `defaut` explicitement curé** (Julie :
6, le cas pleine vie, sur demande directe de l'utilisateur — la seule
exception à ce jour).

⚠️ **« Ray Spears » (Amber/Veronica S2, aussi Battle Angel) partagé entre
QUATRE fiches distinctes** (`com2usId` 26101/26104/26111/26114), même
formule (`1.68*{ATK}`) partout — confirmé par l'utilisateur, vérifié sur
les données : la curation PAR NOM couvre déjà les quatre sans code
supplémentaire, exactement le principe que cette table applique partout
ailleurs.

L'écran affiche un champ numérique (borné à la plage) partout où un tel
sort/passif apparaît — la recherche ET l'affichage utilisent la valeur
choisie. `DamageSetup.coupsPersonnalises` (`Record<skillCom2usId, number>`,
même espace de clés que `passifsOffensifs` : sort actif ET passifs
confondus) porte le choix ; `resolvedHits(profile, setup)` le résout
(bornée à `hitsRange` par sécurité, ex. recette écrite avant une
régénération des données SWARFARM) et remplace `profile.hits` partout où le
calcul en a besoin (`computeSkillDamage`, et `computeTotalDamage` pour la
propagation `coupsDuSortActif`).

⚠️ **Un bouton `bonus`/`conditionnel`, quand il en reste un, n'est JAMAIS
déduit d'un réglage d'écran existant**, même quand un réglage équivalent
existe déjà — c'est précisément ce qui a fait passer Roid/Silver de
`conditionnel` (bouton) à `defBreak` (déduit), voir plus haut : leur
condition SE modélisait entièrement, elle n'avait donc plus besoin d'un
bouton. Pour un bouton qui reste (`bonus` aujourd'hui), la condition CURÉE
et le texte SWARFARM brut du passif (`Competence.description`, jamais
reformulé) restent affichés en clair **sous chaque passif** — pas
seulement dans une infobulle au survol, invisible au doigt — c'est au
joueur de juger, pas à l'app de deviner. Conséquence volontaire : oublier
d'activer un bouton ne peut que **sous-estimer** les dégâts, jamais les
surestimer — un défaut d'usage sans risque de classement erroné dans le
sens dangereux.

`DamageSetup.passifsOffensifs` (`Record<com2usId du passif, boolean>`, clé
absente = désactivé) porte l'état des boutons ; une recette exportée avant
l'existence de ce champ n'en a simplement aucun (`?.` en lecture partout,
jamais supposé présent).

`damageRelevantStats` suit exactement le même interrupteur
(`passifActif`, factorisé) que `computeTotalDamage` : un passif désactivé
n'ajoute aucune stat au pré-filtrage, un passif actif y ajoute les siennes —
les deux fonctions doivent s'accorder EXACTEMENT, sinon la recherche
privilégierait des stats qu'un score différent ignore (ou l'inverse).

⚠️⚠️ **En mode « Non critique », Dgts Crit sort du pré-filtrage — SAUF quand un
critique est GARANTI.** Le mode annule la part critique du sort, donc retenir
Dgts Crit gaspillait du budget de rétention sur une stat qui ne pèse sur aucun
dégât. Mais il y a **deux** exceptions, pas une :

- `critSiPlusRapide` (Ciri Eau, Rigna, MOS) — un critique forcé par la vitesse ;
- ⚠️ un passif `critique: 'toujours'` (**Hidden Gun**, **Meticulous Attack**) :
  `computeTotalDamage` lui impose `critMode: 'crit'` pour sa **propre**
  contribution, quel que soit le mode choisi à l'écran.

N'excepter que la première retirait les Dgts Crit à un monstre dont un composant
crit pourtant à coup sûr — **le remède pire que le mal qu'il corrige**. Les deux
sens sont testés (`'toujours'` retient, `'jamais'` ne rattrape rien).


## VIT de l'adversaire — `{Relative SPD}` et l'ignore-DEF proportionnel

`DamageSetup.enemySpd` (VIT totale de l'adversaire, buffs compris — saisie
manuelle, comme `enemyDef`) sert **deux** mécaniques distinctes, confirmées
par l'utilisateur, ni l'une ni l'autre déductible du texte du jeu seul :

- **`{Relative SPD}`** — `(Ta VIT − VIT cible) / VIT cible`. 20 sorts du
  corpus en dépendent (Beast Rider ×10, Barbara, Masha, Savannah, Narsha,
  Xiana), tous sur `2.0*{ATK}*({Relative SPD}+1)` — **rejetés avant cette
  confirmation**, faute de variable reconnue.
- **Ignore-DEF proportionnel à l'écart de VIT** (Rigna/Birgitta/Magic Order
  Swordsinger — Concentrated Stab, Ciri — Charge Attack, `4.7*{ATK}` seul) —
  donnée **communautaire** (SWGT), pas le texte du jeu lui-même (« ignores
  its Defense up to 100 % according to the difference… » ne donne aucun
  seuil) : **126 points d'écart de VIT = 100 % de la DEF ignorée**, linéaire
  en-dessous, **0 % si la cible est aussi rapide ou plus**. Curé dans
  `IGNORE_DEF_SELON_VIT_CONNUS` (`{ ecartMax }`), `SkillDamageProfile.
  ignoreDefSelonVit`, appliqué en amont du facteur de défense — multiplicatif
  avec la réduction de Défense (`defBreak`), jamais substitué à elle.
  ⚠️ **`ignoreDefSelonVit` prévaut sur l'effet `Ignore DEF` détecté
  automatiquement** : SWARFARM tague Concentrated Stab d'un effet plein
  (`quantite: 100`), la nuance vivant uniquement dans son champ `note`
  (« according to the difference between the target's and your Attack
  Speed »), jamais lu ailleurs — sans ce garde-fou, ce sort aurait ignoré
  100 % de la DEF EN PERMANENCE, y compris face à une cible plus rapide.
- **`Relative SPD` ajoutée à `variables` même quand la FORMULE ne la lit
  pas** (Concentrated Stab est `4.7*{ATK}` nu) : c'est le mécanisme
  d'ignore-DEF qui en dépend, pas la formule — sans cet ajout, ni le champ
  « VIT adversaire » ni la VIT dans le pré-filtrage (`damageRelevantStats`)
  n'apparaîtraient pour ces sorts.


## « Ta VIT totale » — ce que `maVitCombat` additionne

Confirmé par l'utilisateur (« il faut prendre en compte les runes, le totem
de vitesse, mais aussi la présence éventuelle d'un buff speed ainsi que les
artefacts… ainsi que le leader skill éventuel de vitesse ») : `maVitCombat`
(damage.ts) est la source UNIQUE de « ta VIT totale » pour les trois
mécaniques ci-dessus ET pour `{SPD}` lui-même :

1. **Runes + totem** — déjà comptés (`stats`/`summonerSkillBonus`, +15 % de
   « Combat », voir plus haut).
2. **Buff de VIT** (`setup.spdBuff`, +30 %) — éventuellement **amplifié**
   par un artéfact « Effet aug. VIT +X% » (code 206, voir « Amplification de
   buff par artéfact » plus bas) : le pourcentage du buff est amplifié
   MULTIPLICATIVEMENT (`30 % × (1 + X/100)`), jamais la VIT plate elle-même.
   Porte sur le **TOTAL** (base + rune + lead déjà posés) — mécanique
   différente du lead, voir plus bas.
3. **Leader skill d'ÉQUIPE** (`setup.leaderSkill`, type VIT — voir « Leader
   skill d'équipe » plus bas) — le sien n'agit jamais sur lui-même,
   contrairement au totem. ⚠️ Porte sur la VIT de **BASE**, pas sur le total
   runé — règle de l'utilisateur, détaillée dans
   [effets d'équipe et leaders](effets-equipe-et-leaders.md).

Le buff de VIT (%TOTAL) s'applique donc APRÈS le lead (%BASE) déjà posé,
jamais sommé avec lui dans la même étape — voir « Leader skill d'équipe »
([effets-equipe-et-leaders.md](effets-equipe-et-leaders.md)) pour sa
justification complète.


## Crit garanti si plus rapide que la cible

Ciri (Eau), Rigna, Magic Order Swordsinger portent un passif **sans formule
ni dégâts propres** (« Lady of Space and Time (Passive) » / « Speed
Difference (Passive)) qui force le critique sur **tous** les dégâts du
monstre quand `maVitCombat(...) > VIT adverse`. ⚠️ **Ce n'est PAS un
`PASSIFS_OFFENSIFS_CONNUS`** — confirmé par l'utilisateur : « le passif en
lui-même ne fait pas de dégâts, ne fait pas de coup et n'a pas de ratio,
c'est lui qui force le Crit ». Table séparée
(`CRIT_SI_PLUS_RAPIDE_CONNUS`), détectée par `monsterCritSiPlusRapide(detail)`.

`computeTotalDamage(..., ampliVitPct, critSiPlusRapide)` force `critMode:
'crit'` sur le sort actif ET sur chaque passif dont `critique === 'suit'` —
un passif avec son propre `'jamais'`/`'toujours'` (fait plus précis sur
cette contribution précise) garde la priorité sur ce modificateur
monstre-wide.

⚠️ **Le champ « VIT adversaire » apparaît dès que la VIT de la cible
compte**, même si le sort choisi ne la lit pas (Rigna S1, tout sort de
Sonia) : `utilise('Relative SPD') || utilise('Target SPD') ||
critSiPlusRapide || bonusDegatsSelonVit || demandeVitCible`
(`DamageSetupCard.tsx` ; le dernier pour une condition `vitPropreSuperieure`
du sort). Le bouton « Buff VIT » et le leader skill ne sont pas
conditionnels : toujours visibles dans « État de mon monstre »
(`EtatMonstre.tsx`), ils changent les stats du monstre quel que soit le sort.


## Bonus de dégâts continu selon l'écart de VIT (Sonia, Battle Angel)

Sonia/Battle Angel (`Evasion (Passive)`, sans formule ni dégâts propres —
même famille que `critSiPlusRapide`, PAS un `PASSIFS_OFFENSIFS_CONNUS`) :
« The faster you are than the enemy… **the damage dealt increases by up to
50%** » — un TROISIÈME mécanisme lié à la VIT, distinct des deux
précédents : ni une formule de dégâts (`{Relative SPD}`), ni un critique
garanti binaire, mais un **bonus de dégâts CONTINU** proportionnel à l'écart
de VIT. Le texte du jeu ne donne aucun seuil (« up to 50% » seul) — donnée
**confirmée par l'utilisateur** : **50 points d'écart de VIT = +50 %**,
LINÉAIRE en-dessous (3 points = +3 %, 42 points = +42 %), 0 % si la cible
est aussi rapide ou plus. Curé dans `BONUS_DEGATS_SELON_VIT_CONNUS` (`{
ecartMax, pctMax }`, généralisé au-delà du cas 1:1 de Sonia — un futur
monstre pourrait plafonner à un pourcentage différent du nombre de points),
détecté par `monsterBonusDegatsSelonVit(detail)`.

`computeTotalDamage(..., bonusDegatsSelonVit)` applique ce bonus
MULTIPLICATIVEMENT sur le **total** (sort actif + tous les passifs), APRÈS
coup — « the damage dealt increases », un modificateur sur l'ensemble de ce
que le monstre inflige, pas une contribution isolée comme `bonusPvCible`
(propre à UN passif précis). `damageRelevantStats` fait travailler la VIT
au pré-filtrage MÊME si aucun sort actif de Sonia n'en dépend directement
(`Guard Crush` : `3.5*{ATK}` nu) — vérifié sur un compte réel : « stats
privilégiées [atk, spd, cd] ».


## Les modificateurs monstre-wide s'affichent dans « Passifs offensifs »

⚠️ `critSiPlusRapide` (Ciri Eau, Rigna, Magic Order Swordsinger) et
`bonusDegatsSelonVit` (Sonia, Battle Angel) sont CALCULÉS **et** AFFICHÉS :
comme Feng Yan ou Dominic (des vrais `PASSIFS_OFFENSIFS_CONNUS`), ils
apparaissent dans « Passifs offensifs », sans quoi rien n'y signalerait leur
existence.

`monsterModificateursVit(detail)` (fonction d'AFFICHAGE seule,
jamais utilisée par le calcul) renvoie nom/description/icône SWARFARM de
ces passifs, réutilisés dans la MÊME liste que `passifs`, avec le même rendu
« toujours actif » (Jeton, pas de bouton — rien à cocher, entièrement
automatique dès que la VIT le permet). Aucune ligne de texte près du champ
VIT adversaire ne les répète : la liste, plus complète, ferait redite.


## Bonus de dégâts ACCUMULABLE en combat (Momo, Mage)

Momo/Mage (`Secret Book (Passive)`, sans formule ni dégâts propres — même
famille que les modificateurs ci-dessus) : « increases the damage by 10%
each, up to 200%, whenever an ally attacks an enemy ». ⚠️ **Contrairement à
`bonusDegatsSelonVit`, RIEN ici ne se déduit d'un état déjà connu de
l'app** — le nombre d'attaques alliées déjà portées ce combat n'est simulé
nulle part. L'utilisateur choisit lui-même le niveau du DÉCLENCHEUR ACTUEL
(nombre d'attaques alliées, 0 à 20, pas de 1), via un champ qui apparaît
dans « Passifs offensifs » à côté du Jeton du passif — désactivé (0) par
défaut, jamais un déclencheur deviné.

⚠️ **Le DÉCLENCHEUR et le BONUS DE DÉGÂTS qui en résulte sont DEUX NOMBRES
DIFFÉRENTS, jamais confondus.** Signalé par l'utilisateur sur Borgnine :
« si l'utilisateur renseigne le % de PV cible détruit, alors il doit
pouvoir renseigner une valeur entre 0 et 60 % par palier de 1 %, par
contre l'augmentation de dégâts qui s'ensuit va de 0 à 30 % par palier de
0,5 % ». Le champ demandait jusque-là de saisir DIRECTEMENT le bonus
(0 à 30 %, pas de 0,5) — l'utilisateur devait faire la conversion
mentalement, et le libellé du champ ne correspondait plus à la plage
affichée. Curé dans `BONUS_DEGATS_STACKABLE_CONNUS` (`{ triggerMax,
triggerStep, ratio, pctMax, label, aide, suffix }`) — `triggerMax`/
`triggerStep` décrivent la plage du DÉCLENCHEUR saisi, `ratio` (dégâts %
par unité) et `pctMax` (plafond de dégâts) décrivent le BONUS qui en
résulte. `DamageSetup.stackPersonnalise` (`Record<skillCom2usId, number>`,
même espace de clés que `passifsOffensifs`/`coupsPersonnalises`) porte
le DÉCLENCHEUR brut, jamais le bonus directement.
`resolvedStackTrigger(profil, setup)` le résout, borné à `triggerMax` ;
`resolvedStackPct(profil, setup)` calcule le bonus qui en résulte
(`trigger × ratio`, borné à `pctMax` par sécurité) — c'est CE nombre que
`computeTotalDamage(..., bonusDegatsStack)` applique multiplicativement
sur le TOTAL, après coup (même famille que `bonusDegatsSelonVit`, seule la
SOURCE du pourcentage change). Le bonus résultant s'affiche EN CLAIR à
côté du champ (« → +20 % de dégâts »), jamais seulement dans la tête du
joueur.

⚠️ **`label`/`aide`/`suffix` — un texte PAR ENTRÉE, jamais un texte
générique partagé.** Signalé par l'utilisateur (incohérence trouvée sur le
champ de Trevor : libellé « Stack actuel » et infobulle « nombre
d'attaques alliées » — un texte écrit pour Momo, sans rapport avec Trevor
qui compte ses PROPRES PV perdus). Chaque entrée de la table décrit
maintenant EXACTEMENT ce qu'elle compte : « Attaques alliées » (Momo),
« Alliés morts » (Fermion), « Résultat du dé » (Ludo, 1 à 6 confirmé par
l'utilisateur — ⚠️ un dé ne tombe JAMAIS sur 0 : `offset: 1` décale la
pente du bonus, `max(0, trigger − 1) × ratio`, pour que le résultat 1
donne bien 0 % et non 20 %, seule entrée de la table à porter un
`offset`), « Buffs volés » (Martina — effet SWARFARM
« Steal Buff », PAS un vol de PV), « État »
(Sleep Talk), « PV cible détruits » (Borgnine/Moogwang), « PV perdus »
(Trevor — CAPÉ à 100 % côté déclencheur, confirmé par l'utilisateur ; les
dégâts, eux, vont bien jusqu'à 200 %, `ratio: 2`).

Trois entrées de plus (réponses au catalogue « passifs non implémentés »,
même mécanisme, aucun nouveau code) : **Fermion** (« Dominator », +10 % par
allié mort, jusqu'à +30 % — `quantite` ABSENT des données SWARFARM,
confirmé par l'utilisateur malgré le silence de la donnée brute) ;
**Ludo** (« Roll Again », +20 % par palier, jusqu'à 100 % — un jet de dé
1-6 au début du combat puis à chaque tour, aucun RNG in-app donc saisi
manuellement, ⚠️ le texte porte AUSSI une réduction des dégâts SUBIS,
hors modèle comme partout ailleurs) ; **Martina** (« Absorb Shadow », +10 %
par vol d'effet bénéfique, jusqu'à +150 %, 15 fois).


## Stats à privilégier dans la recherche

`damageRelevantStats(profil)` renvoie les statistiques que le sort et les
passifs retenus après lui (`passifCompte`) font **réellement** travailler —
variables des formules, plus les Dgts Crit (hors dégâts fixes). C'est ce qui oriente
le pré-filtrage de la recherche (`OBJECTIVE_RELEVANT_STATS`, voir
[optimizer.md](../optimizer.md)).

⚠️ **Source UNIQUE**, appelée par l'écran **et** par la relecture d'une
recette en ligne de commande — deux calculs séparés divergeraient en
silence, sans que `tsc` puisse le voir (voir
[README.md](../../README.md), « Conventions communes »).
