# Dégâts réels — le modèle de calcul

Calcul des **dégâts d'un sort précis** d'un monstre précis contre un
adversaire configuré. Brique de calcul pure, sans état ni rendu :
[damage.ts](src/lib/damage.ts), vérifiée par
[tests/degats.test.ts](tests/degats.test.ts).

Consommée par l'objectif de recherche **« Dégâts réels »** de l'Optimizer
(comportement d'écran : [optimizer.md](optimizer.md)). Ce fichier-ci décrit
le **modèle**, pas l'interface.

> Prolonge la formule documentée dans [../mecaniques.md](../mecaniques.md) —
> même modèle communautaire **prédictif**, pas le code du jeu.

## Principe directeur — ne jamais redemander ce qu'on sait déjà

Les données SWARFARM (`public/data/skills/<com2usId>.json`, voir
[donnees-monstres.md](../shared/donnees-monstres.md)) portent **déjà**
l'essentiel. Sont donc **déduits, jamais saisis** :

| Ce qu'on déduit | D'où |
|---|---|
| Coefficient du sort | `formule` (ex. `0.68*{ATK}`) |
| Statistiques qui font travailler le sort | les variables de `formule` |
| Nombre de coups | `coups` |
| Portée (zone / cible unique) | `aoe` |
| Ignore la défense | un effet nommé `Ignore DEF` |
| Dégâts fixes (ni critique ni mitigation) | marqueur `(Fixed)` de la formule |
| Bonus de dégâts des améliorations | somme des `Damage +X%` de `ameliorations` |

⚠️ **La compétence est supposée MAXÉE**, comme partout ailleurs dans l'app
(même parti pris que `paliersRechargement`, voir
[monsterSkills.ts](src/lib/monsterSkills.ts)) : les `Damage +X%` sont tous
comptés.

Ne restent donc à saisir que ce qu'aucune donnée ne peut savoir :
**l'adversaire** et **les effets de combat actifs**.

## Lecture des formules — tout ou rien

Un analyseur descendant récursif sur une grammaire minuscule
(`+ - * /`, parenthèses, nombres, variables `{…}`).

**Variables reconnues** : `{ATK}`, `{DEF}`, `{SPD}`, `{MAX HP}` (l'attaquant,
buffs compris), `{Target MAX HP}`, `{Target Current HP %}` (la cible).

⚠️ **Le moindre jeton non compris fait refuser le sort ENTIER**, avec un
motif affiché — jamais une lecture partielle. Une formule
`0.15*{ATK}*({Relative SPD}+1)` dont on ne lirait que `0.15*{ATK}`
produirait un nombre parfaitement plausible, donc jamais remarqué, et
l'Optimizer classerait les builds sur une base fausse. C'est la seule
propriété de ce module qui serait **grave et invisible** — d'où le balayage
du corpus **réel** en test, pas seulement des cas écrits à la main.

Couverture mesurée sur le corpus complet : **5 861 sorts offensifs
calculables, 207 refusés explicitement** (variables hors modèle —
`{Relative SPD}`, `{Attacker's Level}`, `ABSORPTION_TOT_CNT`… — ou formules
hors grammaire).

Un sort dont la formule ne dépend d'**aucune** statistique de l'attaquant
(dégâts purement fixes) est refusé lui aussi : il est calculable, mais
optimiser des runes dessus n'a aucun sens — toutes les combinaisons
donneraient le même nombre.

## L'équation

Reprend celle de [../mecaniques.md](../mecaniques.md) :

```
Dégâts = ( Mult × Crit × FacteurDéf + Additionnel ) × Réductions × coups
```

- **Mult** — la formule du sort évaluée sur les stats du build, buffs
  appliqués.
- **Crit** — `1 + améliorations% + part_crit × DgtsCrit%`, où `part_crit`
  dépend du mode choisi : `1` (Critique), `0` (Non critique), ou le **Taux
  Crit du build** (Moyenne — l'espérance, seul mode où le Taux Crit
  participe au classement).
  ⚠️ **Taux Crit écrêté à 100 %** dans le calcul : `computeStats` renvoie
  volontairement le total brut (un dépassement reste une marge légitime
  contre la résistance adverse), mais au-delà de 100 % il ne rapporte plus
  aucun dégât en jeu.
- **FacteurDéf** — `1000 / (1140 + 3,5 × DEF_effective)`, avec
  `DEF_effective = DEF_ennemie × (0 si ignore défense) × (0,3 si réduction
  de défense)`. ⚠️ **Source unique du facteur de défense pour toute l'app** :
  `objectiveScore('ehp')` ([runeBuildOptim.ts](src/lib/runeBuildOptim.ts))
  importe ces mêmes constantes plutôt que d'en garder une copie.
- **Additionnel** — un sort à **dégâts fixes** passe par cette branche : ni
  critique, ni facteur de défense.
- **Réductions** — `+25 %` si la **marque** (Branding) est active.

**Effets de combat modélisés** (potences de base, tronquées vers le bas
comme le décrit [../mecaniques.md](../mecaniques.md) ; aucun bonus d'effet
n'est exposé en v1) : buff d'attaque **+50 %**, buff de défense **+70 %**,
buff de vitesse **+30 %**, réduction de défense **×0,3**, marque **+25 %**.

## Compétences d'invocateur

Remplacent, dans le jeu, les anciens **totems** de guilde (onglet
« Combat ») et **drapeaux** de Guerre de Guilde (onglet « Guilde »).
**Toujours supposées maxées** (Lv.20), même parti pris que les améliorations
de compétence.

⚠️ **Trois états, pas deux interrupteurs indépendants** — « Guilde » implique
toujours « Combat » : l'onglet Guilde ne s'applique qu'en contenu de guilde,
où les compétences de Combat comptent aussi. Deux cases séparées auraient
laissé cocher une combinaison qui n'existe pas en jeu.

| | Combat | + Guilde |
|---|---|---|
| ATQ | +20 % | +40 % |
| ATQ de l'élément du monstre | +21 % | +21 % |
| DEF | +20 % | +40 % |
| PV | +20 % | +40 % |
| VIT | +15 % | +15 % |
| Dgts Crit | +25 pts | +50 pts |

⚠️ **Le pourcentage porte sur la statistique de BASE**, pas sur le total
runé — même modèle que le totem de vitesse déjà en place (`pctSpeedBonus`,
[speed.ts](src/lib/speed.ts) ; le totem entre dans le `Σ%vit` appliqué à la
base). Un build à grosse ATQ runée n'en tire donc pas plus qu'un build nu de
même base. Les **Dgts Crit**, eux, sont des **points** ajoutés à la stat
(150 % → 175 %), pas un pourcentage de celle-ci.

⚠️ **L'élément n'est jamais demandé** : « Puis. d'att. de <élément> » suit
l'élément du monstre optimisé. Un monstre sans élément connu (`unknown`,
monstre perso) ne reçoit aucune des cinq compétences élémentaires.

⚠️ Le bonus est appliqué **après** `computeStats` (qui a déjà rendu ses
totaux), d'où un double arrondi supérieur : au plus 1 point d'écart sur la
statistique, sans effet sur un classement de builds.

**Défaut : « Combat »**, pas « Aucune » — ces compétences sont permanentes en
jeu dès qu'elles sont montées ; partir d'« Aucune » afficherait des dégâts
que personne n'observe réellement.

## Volontairement hors modèle

Absents du résultat, **jamais approximés en silence** :

- la **variance** (±2,8 %) — un aléa par coup, sans effet sur un classement ;
- l'**avantage élémentaire** et les coups **glancing** ;
- les lignes de **dégâts d'artéfact** (par élément, coopératif) et le
  **DMG%** en général ;
- les **réductions** autres que la marque (passifs, reflect, Mirinae S3) ;
- les **mécaniques propres à certains monstres** (Deborah, Herteit…) ;
- les sorts qui dépendent de l'**état de combat** au-delà des PV de la cible
  (`{Relative SPD}`, `{Alive Enemies}`, PV courants de l'attaquant…) — ces
  sorts-là sont refusés, pas approchés.

## Passifs offensifs — dégâts supplémentaires au-delà du sort choisi

Certains monstres infligent des dégâts **en plus** du sort actif choisi, via
un passif qui a lui-même une formule de dégâts (Feng Yan, Sia, Roid,
Dominic…). `monsterOffensivePassives(detail)` les détecte et
`computeTotalDamage(profil, passifs, stats, setup, élément)` additionne leur
contribution à celle du sort de base — c'est elle, et non `computeSkillDamage`
seul, que consomme l'objectif « Dégâts réels » (`objectiveScore`,
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) dès qu'au moins un passif est
reconnu.

⚠️ **Curation à la main, jamais une extraction automatique** —
`PASSIFS_OFFENSIFS_CONNUS` ([damage.ts](src/lib/damage.ts)) est une liste
explicite de passifs vérifiés, par leur `Competence.nom` SWARFARM exact. La
**formule elle-même** reste toujours lue en direct depuis les données (même
parseur, même discipline tout-ou-rien que le sort actif) — seule l'
**appartenance à la liste** et sa **catégorie** sont figées en dur. Un passif
absent de la liste (immense majorité du corpus) n'est simplement jamais
proposé : pas de faux négatif dangereux, juste une couverture partielle et
volontaire.

Quatre catégories, sur la seule question « quand ce passif compte-t-il ? » :

| Catégorie | Comportement | Exemple |
|---|---|---|
| `toujours` | S'ajoute d'office, aucun bouton — le texte du jeu ne pose aucune condition de combat | Feng Yan (Winds and Clouds), Sia (Great Friends), Benedict (Final Strike), Dominic (Improvisation) |
| `defBreak` | **Aucun bouton non plus** : le déclenchement est ENTIÈREMENT déduit des deux réglages de réduction de Défense (voir ci-dessous) | Roid (Slash Waves / Slash Wind), Silver (Ruins) |
| `bonus` | Les dégâts de base sont comptés **dans tous les cas** ; le bouton (désactivé par défaut) ne conditionne QUE le surplus de `pct` %, et seulement sur la contribution de ce passif | Ezio (Hidden Gun, +100 % si cible Lumière) |
| `conditionnel` | Bouton, désactivé par défaut ; activé, le passif compte à 100 % comme un second sort. Réservé aux conditions qui ne se modélisent PAS | (aucune entrée aujourd'hui) |

⚠️ **`bonus` ne met plus toute la contribution à zéro quand le bouton est
éteint.** Le texte de ces passifs décrit une attaque supplémentaire
INCONDITIONNELLE (« Attacks additionally … when you attack the enemy on your
turn »), dont seule la magnitude est conditionnée. Les confondre
sous-estimait la base à chaque fois que la condition n'était pas remplie —
corrigé après relecture du texte du jeu entrée par entrée.

### La réduction de Défense : « avant » n'est pas « après »

Le problème signalé à l'origine (Roid pose lui-même la réduction que son
propre passif vérifie) ne demandait PAS un bouton par passif, mais **un
second réglage** :

| Réglage | Sens |
|---|---|
| `defBreak` | Une réduction de Défense est **déjà active AVANT** le sort |
| `defBreakParLeSort` | Le sort choisi **en pose une lui-même** (n'apparaît que si `profile.appliqueDefBreak`, déduit de l'effet `Decrease DEF` des données) |

Le sort actif n'est JAMAIS affecté par la réduction qu'il pose lui-même
(elle atterrit après son propre coup). Les passifs, eux, frappent **après**
lui : leurs dégâts utilisent donc toujours l'état « après »
(`defBreak || defBreakParLeSort`). Le déclenchement d'un passif `defBreak`,
lui, s'évalue au `moment` que dit son texte — `'avant'` pour Roid (« if you
attack the enemy with[out] decreased Defense »), `'apres'` pour Silver
(« if the enemy is under Defense reduction effects AFTER you attack »).

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
| Eye of the Desert | Desert Warrior, Salah | compté sur la seule cible configurée malgré « random enemy » |
| Turning Slash / Flash Step | Birgitta, Ciri (Lumière), Magic Order Swordsinger | **2 coups** (prose) ; magnitude croissante avec les PV bas NON modélisée → plancher |
| Hidden Gun / Meticulous Attack | Ezio, Evan, Steel Commander | **critique toujours** ; base inconditionnelle, seul le +100 % dépend du bouton |
| Improvisation | Dominic, Weapon Master | condition de PV **ignorée**, compté d'office |
| Ruins | Silver | **3 coups**, critique normalement, déclenchement `defBreak` |
| Slash Waves / Slash Wind | Roid | déclenchement `defBreak` (2 coups pour Slash Waves) |
| Eagle Deception | Bayek | **pas encore vérifié** — défauts |

⚠️ Une entrée « Ruins » sans suffixe `(Passive)` visait un **boss de donjon
non invocable** (Living Armor 2A) : retirée, elle ne pouvait jamais
apparaître dans la box d'un joueur.

### Les PV de la cible se creusent COUP PAR COUP

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

### Coups variables — un sort/passif qui frappe un nombre de fois qui change en jeu

Certains sorts et passifs infligent un nombre de coups qui **varie** en jeu
(« 2 à 3 fois de plus », Sia — Great Friends ; « 3 à 5 fois », Okeanos S3).
`Competence.coups` (donnée SWARFARM) ne porte qu'**un seul nombre**, pas
toujours cohérent avec le texte du jeu (ex. Rain of Fire : `coups=6` en
donnée, « 3 à 5 fois » dans le texte — ni l'un ni l'autre) : aucune
extraction automatique fiable n'est possible.

⚠️ **Même discipline de curation que `PASSIFS_OFFENSIFS_CONNUS`** —
`COUPS_VARIABLES_CONNUS` ([damage.ts](src/lib/damage.ts)) associe un
`Competence.nom` exact à une plage `{ min, max }`, à la main, jamais déduite
du texte anglais libre. Sert aussi bien un sort actif
(`skillDamageProfile`) qu'un passif (`monsterOffensivePassives`) — même
table, même clé. `SkillDamageProfile.hitsRange` porte la plage quand elle
est connue ; `hits` retombe alors sur son **minimum**, jamais une
surestimation par défaut.

L'écran affiche un champ numérique (borné à la plage) partout où un tel
sort/passif apparaît — la recherche ET l'affichage utilisent la valeur
choisie. `DamageSetup.coupsPersonnalises` (`Record<skillCom2usId, number>`,
même espace de clés que `passifsOffensifs` : sort actif ET passifs
confondus) porte le choix ; `resolvedHits(profile, setup)` le résout
(bornée à `hitsRange` par sécurité, ex. recette écrite avant une
régénération des données SWARFARM) et remplace `profile.hits` partout où le
calcul en a besoin (`computeSkillDamage`, et `computeTotalDamage` pour la
propagation `coupsDuSortActif`).

⚠️ **Jamais déduit d'un réglage d'écran existant, même quand un réglage
équivalent existe déjà** (ex. le bouton « Réduction de DEF »). Cas identifié
par l'utilisateur : Roid peut lui-même poser la réduction de DEF via son
propre S1, et la condition de son passif porte sur l'état **avant** ce sort
précis — un réglage de combat global ne peut pas savoir « avant » ou
« après » lequel des sorts du même monstre. D'où un **bouton indépendant par
passif**, jamais rattaché à un réglage existant, avec la condition CURÉE et
le texte SWARFARM brut du passif (`Competence.description`, jamais
reformulé) affichés en clair **sous chaque passif** — pas seulement dans une
infobulle au survol, invisible au doigt — c'est au joueur de juger, pas à
l'app de deviner. Conséquence volontaire : oublier d'activer un bouton ne
peut que **sous-estimer** les dégâts, jamais les surestimer — un défaut
d'usage sans risque de classement erroné dans le sens dangereux.

`DamageSetup.passifsOffensifs` (`Record<com2usId du passif, boolean>`, clé
absente = désactivé) porte l'état des boutons ; une recette exportée avant
l'existence de ce champ n'en a simplement aucun (`?.` en lecture partout,
jamais supposé présent).

`damageRelevantStats` suit exactement le même interrupteur
(`passifActif`, factorisé) que `computeTotalDamage` : un passif désactivé
n'ajoute aucune stat au pré-filtrage, un passif actif y ajoute les siennes —
les deux fonctions doivent s'accorder EXACTEMENT, sinon la recherche
privilégierait des stats qu'un score différent ignore (ou l'inverse).

## Stats à privilégier dans la recherche

`damageRelevantStats(profil)` renvoie les statistiques que le sort fait
**réellement** travailler — les variables de sa formule, plus les Dgts Crit
(sauf sur un sort à dégâts fixes, qui ne critent pas). C'est ce qui oriente
le pré-filtrage de la recherche (`OBJECTIVE_RELEVANT_STATS`, voir
[optimizer.md](optimizer.md)).

⚠️ **Source UNIQUE**, appelée par l'écran **et** par la relecture d'une
recette en ligne de commande — deux calculs séparés divergeraient en
silence, sans que `tsc` puisse le voir (voir
[README.md](../README.md), « Conventions communes »).

⚠️ **Le Taux Crit n'y figure jamais**, même en mode Moyenne — même règle que
l'objectif « Dégâts » : plafonné à 100 % en jeu, c'est une **condition** à
atteindre (via un minimum posé), pas une cible à maximiser indéfiniment. L'y
mettre pousserait la rétention à garder des demi-builds pour un potentiel de
crit qui ne sert plus à rien.
