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
buffs compris), `{Target MAX HP}`, `{Target Current HP %}` (la cible),
`{Relative SPD}` (voir « VIT de l'adversaire » plus bas).

⚠️ **Le moindre jeton non compris fait refuser le sort ENTIER**, avec un
motif affiché — jamais une lecture partielle. Une formule
`0.15*{ATK}*({Attacker's Level}+1)` dont on ne lirait que `0.15*{ATK}`
produirait un nombre parfaitement plausible, donc jamais remarqué, et
l'Optimizer classerait les builds sur une base fausse. C'est la seule
propriété de ce module qui serait **grave et invisible** — d'où le balayage
du corpus **réel** en test, pas seulement des cas écrits à la main.

Couverture mesurée sur le corpus complet : **5 881 sorts offensifs
calculables, 187 refusés explicitement** (variables hors modèle —
`{Attacker's Level}`, `ABSORPTION_TOT_CNT`… — ou formules hors grammaire).
`{Relative SPD}` a longtemps fait partie des variables refusées (20 sorts,
Beast Rider ×10 formes/éléments, Barbara, Masha, Savannah, Narsha, Xiana) —
reconnue depuis confirmation de sa formule par l'utilisateur.

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

## Corrections identifiées, pas encore appliquées

⚠️ **À distinguer de « Volontairement hors modèle » ci-dessus.** Là il s'agit
de ce qu'on ne calcule pas et qu'on assume ; ici, de ce qu'on calcule **faux**
et qu'on sait faux. Chaque point ci-dessous a été établi en cadrant un autre
chantier, et deux d'entre eux s'appuient sur un **relevé en jeu**, pas sur une
relecture du modèle par lui-même.

### 1. `ajoutUneFois` — faux sur deux axes

Les trois passifs de cet accumulateur — `Sickle Blade` (**Bayek Vent**),
`Sand Blade` (**Desert Warrior Vent**, **Shahat**) et `Calculated Sacrifice`
(**Onimusha**, **Fuuki**) — infligent des dégâts **bruts** (ni critiques, ni
mitigés par la défense) et s'appliquent **à chaque coup**.

`computeSkillDamageDetail` fait aujourd'hui l'inverse sur les deux points :
il les multiplie par `horsCoup` **et** ne les ajoute qu'une seule fois par
sort.

⚠️ **Le « une fois par sort » actuel s'appuie sur une note du code
(« confirmé par l'utilisateur ») qui était une ERREUR**, corrigée depuis par
le relevé ci-dessous. La note est à retirer en même temps que le calcul, pas
à laisser cohabiter avec lui.

⚠️ **Ne PAS scinder l'accumulateur** : les deux familles qu'il mélange
(`ajoutMaxHpPropre`, `ajoutSacrifice`) vont exactement au même endroit.
`ajoutUneFois` disparaît en tant que concept et devient un terme **brut par
coup**, ajouté hors de `horsCoup`.

⚠️ **Sur le chemin séquentiel**, ce terme doit être creusé de `pvCourant` **à
chaque itération**, plus en bloc après la boucle — sous peine de rouvrir le
bug de `pvRestantsPct` déjà corrigé une fois à cet endroit.

**Relevé en jeu — Shahat.** ~50 000 PV, S2 sur une cible à ~3 000 DEF →
**~4 500 dégâts par coup**. Le cas est *diagnostique* : à 3 000 de DEF la
mitigation écrase tout ce qui la subit (`defenseFactor(3000) ≈ 0,0859`), ce
qui sépare nettement le terme brut du terme mitigé. `Control Sand` (S2) =
`1.4*{ATK} + 0.11*{MAX HP}`, 2 coups ; `Sand Blade` = 7 % des PV max.

| | Part du sort (mitigée) | Sand Blade | Total par coup |
|---|---|---|---|
| Modèle corrigé, sans critique | ≈ 600 | **3 500** (brut) | **≈ 4 100** |
| Modèle corrigé, avec critique | ≈ 1 400 | **3 500** (brut) | **≈ 4 900** |
| Modèle actuel | — | — | ≈ 770 à 1 760 |

Le relevé tombe **entre les deux lignes du modèle corrigé**, ce qui est
exactement attendu : Sand Blade ne critant pas, seule la part du sort oscille.
Le modèle actuel sous-estime d'un facteur 3 à 6. ⚠️ **Le résultat ne dépend
pas de l'ATQ**, absente du relevé : le terme dominant du sort est
`0.11*{MAX HP}` (5 500), pas `1.4*{ATK}` — faire varier l'ATQ de 1 000 à
1 500 déplace le total de 4 093 à 5 002, la conclusion tient sur toute la
plage.

**À reprendre tel quel comme test de non-régression** : c'est une mesure de
jeu, pas une valeur recalculée depuis le modèle qu'on veut corriger.

### 2. Les bombes ne sont jamais reconnues comme dégâts fixes

Une bombe (S2 de **Seara**) **ne peut pas être critique** et **ignore la
défense adverse**. Elle est aujourd'hui calculée comme un sort ordinaire :
critique et mitigée.

⚠️ **La donnée dit pourtant la vérité.** `public/data/skills/15713.json`,
effet de `Fate of Destruction` : `"nom": "Bomb"` — « the bomb explodes to deal
damage that **ignores Defense** ». Les deux détections qui auraient pu
l'attraper échouent, chacune pour sa propre raison :

| Drapeau | Détection | Pourquoi ça rate |
|---|---|---|
| `fixed` | `RE_FIXED` sur la **formule** (marqueur `(Fixed)`) | la formule est `"5.0*{ATK}"`, sans marqueur |
| `ignoreDef` | un effet **nommé exactement** `'Ignore DEF'` | l'effet s'appelle `'Bomb'` — l'ignore-défense n'est écrit que dans sa **prose** |

⚠️ **Le mécanisme existe déjà** : `SkillDamageProfile.fixed` porte exactement
la sémantique voulue (ni critique, ni facteur de défense). C'est une affaire
de **détection**, pas de calcul — contrairement au point 1.

⚠️ **La règle ne peut pas être « un effet nommé `Bomb` → `fixed` » tout
court.** Ça vaut pour un sort dont TOUTE la contribution est la bombe (Seara
S2 : `coups: 0`, il ne frappe pas, il pose), mais serait faux pour un sort qui
**frappe normalement ET pose une bombe** — son coup direct, lui, crite et se
fait mitiger. Le discriminant est à choisir explicitement (`coups === 0` est
le candidat naturel) et à vérifier sur **le corpus complet** des sorts portant
un effet `Bomb`, pas sur Seara seule.

**Relevé en jeu — Seara.** Bombes à **~27 000** ; avec **+24 %** de dégâts de
bombe venant des artéfacts, **~34 000**. Le rapport confirme la nature
**multiplicative** de ce bonus : `27 000 × 1,24 = 33 480`. La magnitude se
recale en lisant le relevé correctement — le +2 800 d'ATQ est un **bonus
d'équipement**, à additionner à la base et à la compétence d'invocateur :

| | |
|---|---|
| ATQ de base (Seara) | 801 |
| + équipement | +2 800 → **3 601** |
| + compétence d'invocateur (~15 %) | ≈ **4 150** |
| `5,0 × 4 150 × 1,30` (3 × `Damage +10%`) | ≈ **27 000** ✅ |

### 3. Le voisinage, lui, est correct

L'inventaire des autres termes de dégâts plats a été passé en revue et n'a
**rien à corriger** — `ajoutParCoup` traverse `horsCoup` à juste titre :

| Terme | Passif | Monstres | Critique / mitigé | Cadence |
|---|---|---|---|---|
| `ajoutCompteur` | `Rage Charge` (sur `Hammer Punch` S1) | Crawler, Frankenstein | **oui** ✅ | par coup ✅ |
| `ajoutCiblePvMax` | `Spear of Tenacity` | Centaur Knight, Pholus | **oui** ✅ | par coup ✅ |
| `ajoutEcartDef` | `Martial Arts Specialist` | Martial Artist, Sin | **oui** ✅ | par coup ✅ |

⚠️ **Ce tableau vaut d'être conservé bien qu'il ne déclenche aucun travail** :
c'est la trace que ces trois-là ont été **vérifiés** et non pas seulement
supposés corrects — exactement la distinction qui manquait à `ajoutUneFois`.

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
| `toujours` | S'ajoute d'office, aucun bouton — le texte du jeu ne pose aucune condition de combat | Feng Yan (Winds and Clouds), Sia (Great Friends), Benedict (Final Strike) |
| `defBreak` | **Aucun bouton non plus** : le déclenchement est ENTIÈREMENT déduit des deux réglages de réduction de Défense (voir ci-dessous) | Roid (Slash Waves / Slash Wind), Silver (Ruins) |
| `bonus` | Les dégâts de base sont comptés **dans tous les cas** ; le bouton (désactivé par défaut) ne conditionne QUE le surplus de `pct` %, et seulement sur la contribution de ce passif | Ezio (Hidden Gun, +100 % si cible Lumière), Dominic (Improvisation, +100 % si PV > 50 %) |
| `conditionnel` | Bouton, désactivé par défaut ; activé, le passif compte à 100 % comme un second sort. Réservé aux conditions qui ne se modélisent PAS | (aucune entrée aujourd'hui) |

⚠️ **`bonus` ne met plus toute la contribution à zéro quand le bouton est
éteint.** Le texte de ces passifs décrit une attaque supplémentaire
INCONDITIONNELLE (« Attacks additionally … when you attack the enemy on your
turn »), dont seule la magnitude est conditionnée. Les confondre
sous-estimait la base à chaque fois que la condition n'était pas remplie —
corrigé après relecture du texte du jeu entrée par entrée.

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

### Le ratio de dégâts, affiché pour CHAQUE passif

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
familles introduites dans les vagues suivantes — `BONUS_DEGATS_STACKABLE_
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
| Eye of the Desert / Eagle Deception | Desert Warrior/Salah, Bayek | compté sur la seule cible configurée malgré « random enemy » — même monstre, même passif (Bayek = version collaboration, Salah = version SW native), confirmation étendue de l'un à l'autre |
| Turning Slash / Flash Step | Birgitta, Ciri (Lumière), Magic Order Swordsinger | **2 coups** (prose) ; magnitude croissante avec les PV bas NON modélisée → plancher |
| Hidden Gun / Meticulous Attack | Ezio, Evan, Steel Commander | **critique toujours** ; base inconditionnelle, seul le +100 % dépend du bouton |
| Improvisation | Dominic, Weapon Master | bouton `bonus`/`dejaInclus` (+100 % si PV > 50 %, formule déjà majorée) |
| Ruins | Silver | **3 coups**, critique normalement, déclenchement `defBreak` |
| Slash Waves / Slash Wind | Roid | déclenchement `defBreak` (2 coups pour Slash Waves) |

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
(« 2 à 3 fois de plus », Sia — Great Friends ; « 3 à 5 fois », Okeanos S3 ;
« 4 à 6 fois », Julie — Thousand Shots, 6 pile à pleine vie). `Competence.
coups` (donnée SWARFARM) ne porte qu'**un seul nombre**, pas toujours
cohérent avec le texte du jeu (ex. Rain of Fire : `coups=6` en donnée,
« 3 à 5 fois » dans le texte — ni l'un ni l'autre ; Julie : `coups=6`,
mais 6 n'est que le cas pleine vie) : aucune extraction automatique fiable
n'est possible.

⚠️ **Même discipline de curation que `PASSIFS_OFFENSIFS_CONNUS`** —
`COUPS_VARIABLES_CONNUS` ([damage.ts](src/lib/damage.ts)) associe un
`Competence.nom` exact à une plage `{ min, max, defaut? }`, à la main,
jamais déduite du texte anglais libre. Sert aussi bien un sort actif
(`skillDamageProfile`) qu'un passif (`monsterOffensivePassives`) — même
table, même clé. `SkillDamageProfile.hitsRange` porte la plage quand elle
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

### VIT de l'adversaire — `{Relative SPD}` et l'ignore-DEF proportionnel

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

### « Ta VIT totale » — ce que `maVitCombat` additionne

Confirmé par l'utilisateur (« il faut prendre en compte les runes, le totem
de vitesse, mais aussi la présence éventuelle d'un buff speed ainsi que les
artefacts… ainsi que le leader skill éventuel de vitesse ») : `maVitCombat`
(damage.ts) est la source UNIQUE de « ta VIT totale » pour les trois
mécaniques ci-dessus ET pour `{SPD}` lui-même :

1. **Runes + totem** — déjà comptés (`stats`/`summonerSkillBonus`, +15 % de
   « Combat », voir plus haut).
2. **Buff de VIT** (`setup.spdBuff`, +30 %) — éventuellement **amplifié**
   par un artéfact « Effet aug. VIT +X% » (code 206, voir `ARTIFACT_SUB`,
   effects.ts) : `speedBuffAmpliPct(artifacts)` somme cette ligne sur tous
   les artéfacts ÉQUIPÉS (`SearchParams.artifacts` — fixes pour toute une
   recherche, l'Optimizer n'optimise que les runes) et amplifie
   MULTIPLICATIVEMENT le pourcentage du buff (`30 % × (1 + X/100)`), jamais
   la VIT plate elle-même. Porte sur le **TOTAL** (base + rune + lead déjà
   posés) — mécanique différente du lead, voir plus bas.
3. **Leader skill d'ÉQUIPE** (`setup.leaderSkill`, type VIT — voir « Leader
   skill d'équipe » plus bas) — le sien n'agit jamais sur lui-même,
   contrairement au totem. ⚠️ Porte sur la VIT de **BASE**, pas sur le total
   runé — signalé par l'utilisateur, incident détaillé ci-dessous.

Le buff de VIT (%TOTAL) s'applique donc APRÈS le lead (%BASE) déjà posé,
jamais sommé avec lui dans la même étape — voir « Leader skill d'équipe »
pour la correction et sa justification complète.

### Crit garanti si plus rapide que la cible

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

⚠️ **Le champ « VIT adversaire », le bouton « Buff VIT » et le leader skill
apparaissent aussi quand `critSiPlusRapide` OU `bonusDegatsSelonVit` sont
présents**, même si le sort ACTIF choisi ne lit ni `{SPD}` ni
`{Relative SPD}` (ex. Rigna S1 « Double Gash » ; ou n'importe quel sort de
Sonia, voir ci-dessous) : la comparaison de vitesse a lieu indépendamment du
sort sélectionné. Trouvé après coup sur le bouton « Buff VIT »
spécifiquement (question directe de l'utilisateur, Ciri Eau/Sonia) — gaté
sur `utilise('SPD')` seul à l'origine, corrigé à l'identique du champ « VIT
adversaire » : `utilise('SPD') || utilise('Relative SPD') ||
critSiPlusRapide || bonusDegatsSelonVit`.

### Bonus de dégâts continu selon l'écart de VIT (Sonia, Battle Angel)

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

### Les modificateurs monstre-wide s'affichent maintenant dans « Passifs offensifs »

⚠️ **Bug signalé par l'utilisateur** : `critSiPlusRapide` (Ciri Eau, Rigna,
Magic Order Swordsinger) et `bonusDegatsSelonVit` (Sonia, Battle Angel)
étaient CALCULÉS mais jamais AFFICHÉS — contrairement à Feng Yan ou Dominic
(des vrais `PASSIFS_OFFENSIFS_CONNUS`), rien dans « Passifs offensifs » ne
signalait leur existence, seule une ligne de texte discrète près du champ
« VIT adversaire » en parlait.

`monsterModificateursVit(detail)` (nouvelle fonction d'AFFICHAGE seule,
jamais utilisée par le calcul) renvoie nom/description/icône SWARFARM de
ces passifs, réutilisés dans la MÊME liste que `passifs`, avec le même rendu
« toujours actif » (Jeton, pas de bouton — rien à cocher, entièrement
automatique dès que la VIT le permet). La ligne de texte près du champ VIT
adversaire est retirée : la liste, plus complète, ferait redite.

### Bonus de dégâts ACCUMULABLE en combat (Momo, Mage)

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
désormais le DÉCLENCHEUR brut, jamais le bonus directement.
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
`offset`), « Buffs volés » (Martina — corrigé : effet SWARFARM
« Steal Buff », PAS un vol de PV comme documenté d'abord), « État »
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

### Catalogue « passifs non implémentés » — première vague

Une recherche large des flags `Increase Damage`/`Increase Critical Damage`/
`Buff Bonus Damage` sur tout le corpus avait remonté ~65 entrées non
modélisées (catalogue livré à part). L'utilisateur a répondu question par
question sur les 26 premières ; quatre nouvelles familles de modificateurs
en sont sorties, toutes de la MÊME nature que `bonusDegatsSelonVit`/
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
  très généreuses) reste simplement plafonné, comme avant cette
  fonctionnalité (régression trouvée et corrigée en cours de route, voir
  le test dédié).
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
  `monsterBonusDegatsConditionnel` ne filtre plus sur `c.passif` (les autres
  entrées, toutes passives, ne changent pas de comportement). Nom curé
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

  Stockage : **même `Record` que `passifsOffensifs`** (clé =
  `skillCom2usId` de CE modificateur) — pas un nouveau champ dans
  `DamageSetup`, ces modificateurs n'ont pas de formule propre à
  additionner mais ont bien une compétence à eux. `bonusDegatsConditionnelActif(p,
  setup)` lit ce même Record. Appliqué multiplicativement sur le TOTAL,
  même famille que `bonusDegatsSelonVit`/`bonusDegatsStack` — seule la
  SOURCE change (un bouton plutôt qu'une valeur saisie ou déduite de la VIT).

### Deuxième vague — points 16 à 25

Trois entrées de plus tenaient dans les mécanismes déjà en place, sans
nouveau code (voir `BONUS_DEGATS_STACKABLE_CONNUS` plus haut) — Fermion
(point 16), Ludo (point 23), Martina (point 24). Deux autres ont demandé un
CINQUIÈME/SIXIÈME effet d'équipe — Dr. Matteo (point 20, « Transmission »)
et Velaska (point 18, « Price of Pain », le seul à porter une DEUXIÈME
donnée en plus du toggle — voir « Effets d'équipe » plus bas).

⚠️ **Point 17 (Trasar, « Weight of Death ») — BLOQUÉ, pas seulement
différé.** Le texte confirme +15 %/mort jusqu'à +30 %, mais cette
augmentation ne porte que sur UN sort précis (« Atlas Stone », S2), dont la
formule (`{MAX HP}/{Alive Enemies} (Fixed)`) utilise `{Alive Enemies}` — une
variable qu'`analyser` (damage.ts) ne reconnaît PAS
(`DamageVariable` ne la liste pas). Ce sort est donc déjà REJETÉ par le
parseur (« tout ou rien »), avant même de songer à lui appliquer un bonus :
implémenter la table de stack serait sans effet tant que la formule
elle-même reste hors modèle. À reprendre seulement si `{Alive Enemies}`
est un jour ajouté à la grammaire.

### Quatrième vague — point 25 : formule bespoke selon un compteur (Crawler)

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

### Troisième vague — points 4 et 5 : bonus selon les effets sur la CIBLE

Contrairement aux familles précédentes (qui majorent le TOTAL, monstre-wide),
celle-ci est propre à UN SORT ACTIF précis : `SkillDamageProfile.
bonusParEffetCible?: { pct: number; source: 'buffs' | 'debuffs' |
'buffsEtDebuffs' }`, curé dans `BONUS_PAR_EFFET_CIBLE_CONNUS` (clé =
`Competence.nom`, même discipline que `IGNORE_DEF_SELON_VIT_CONNUS`/
`COUPS_VARIABLES_CONNUS`). ⚠️ `source` remplace l'ancien `inclutDebuffs:
boolean` (cinquième vague, plus bas) : un booléen ne pouvait exprimer que
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
  effects removed. » `quantite: 0` dans les données SWARFARM — d'abord
  laissé de côté pour cette raison (voir la vague précédente). Confirmé
  ensuite par l'utilisateur, en aparté : « chaque buff sur l'ennemi rajoute
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

⚠️ **Réponses données par l'utilisateur pour les points restants, non
implémentés ici** : le point 19 est déjà implémenté (Protective Power/
Retributive Power, voir plus haut) ; le point 26 (Aragorn/Night Fang) n'a
en réalité **pas reçu de réponse** — la réponse fournie sous ce numéro dans
le fichier couvrait le point 25 (Crawler) par un décalage d'un cran.
Points 10-12 (Karakum, Nezuko, formules à ratio inconnu) : explicitement
laissés de côté par l'utilisateur (formule inconnue, monstres jamais
joués). Aucun de ces cas n'est implémenté — à reprendre sur une demande
dédiée plutôt qu'en marge de cette vague.

### Cinquième vague — points 9, 10 et 26 à 43

Un second fichier de réponses, sur les points restants du catalogue
original (dont deux trous du premier lot, jamais câblés malgré une réponse
déjà donnée) plus dix-sept points nouveaux (27-43).

**Trous comblés du premier lot** — `BONUS_DEGATS_CONDITIONNEL_CONNUS` :

- **Idunn's Heart/Eivor (Feu)** et **Innate Physical/Solveig** (point 9) :
  « if you have taken less than 20% of your MAX HP as damage during the
  previous turn, increases the damage dealt this turn by 100% » — `+100 %`,
  toggle. ⚠️ Nom RÉEL vérifié par grep exhaustif du corpus avant de curer :
  « Idunn's Heart » est sur la forme **Feu** d'Eivor, pas Eau (piège
  identique pour « Cold Brew », plus bas).
- **Brawler's Will/Neostone Fighter, Trevor** (point 10) : « increases the
  damage dealt... as your HP decreases » (`quantite: null`) — confirmé
  +2 %/point de % de PV PROPRES perdus, jusqu'à +200 %. Réutilise
  `BONUS_DEGATS_STACKABLE_CONNUS` (même mécanisme de saisie manuelle que
  Momo), aucun code nouveau.

**Nouveaux `BONUS_DEGATS_CONDITIONNEL_CONNUS`** (toggle, +X % au total,
condition non déductible) :

- **Path of the Brave Warrior/Deragron** (point 39) : « up to 200%, on the
  next turn » après un soin reçu — simplifié en binaire (0/200 %), comme
  Self Repair.
- **Female Warrior/Sabrina** (point 40) : « 20% more damage on enemies with
  no beneficial effects » — inverse conceptuel de Julie (bonus si la cible
  N'A PAS d'effet, pas selon son nombre). ⚠️ **Écart entre données et
  réponse utilisateur** : `quantite: 20` confirmé dans SWARFARM, mais la
  réponse parlait de « jusqu'à 200 % » — très probablement une confusion
  avec Cold Brew/Iced Tea juste en dessous (même lot de réponses). Les
  données réelles ont prévalu (20 %, pas 200 %).
- **Cold Brew/Espresso Cookie (Eau)** et **Iced Tea/Black Tea Bunny (Eau),
  Rosemary** (point 43) : « +200% if you attack the frozen enemy on your
  turn » — confirmé en données (`quantite: 200`).

**Nouveau `PASSIFS_OFFENSIFS_CONNUS` `conditionnel`** (toggle, formule
PROPRE au passif, pas un % du total) :

- **Internal Force/Paladin, Leona** (point 28) : « Creates a Shield equal
  to your Defense... Increases the damage dealt by 50% when you have a
  Shield. » `formule: 2.0*{DEF}` EST le Bouclier — ce n'est PAS un % du
  total (contrairement à ce que le catalogue laissait supposer), c'est une
  source de dégâts À PART ENTIÈRE gatée par un bouton, exactement comme
  Roid. Le +50 % du texte s'applique aux dégâts que le Bouclier ABSORBE
  (défensif, hors modèle).
- **Comeuppance/Onmyouji, Giou** (point 41) : `formule: 0.2*{Target MAX HP}`
  confirmée (capture du bestiaire à l'appui — d'abord exclue à tort par
  analogie avec `skillDamageProfile`, qui rejette un sort ACTIF
  stat-indépendant parce qu'INUTILE comme référence de classement des
  builds ; une raison qui ne s'applique PAS à `monsterOffensivePassives`,
  qui somme une contribution RÉELLE au total affiché, jamais utilisée pour
  classer). Le filtre correspondant a été RETIRÉ de
  `monsterOffensivePassives` (seule une formule vraiment illisible reste
  rejetée) — aucune autre entrée de la table n'est affectée, toutes
  dépendaient déjà d'au moins une stat de l'attaquant. `critique: 'jamais'`,
  catégorie `conditionnel` (bouton, comme Internal Force).

**Nouveau `BONUS_DEGATS_STACKABLE_CONNUS`** (compteur saisi manuellement, 0
par défaut, même mécanisme que Momo) :

- **Sleep Talk/Hypnomeow, Birman, Manx, Bombay** (point 30c) : « +100%
  while sleeping... +200% on the next turn » (au réveil) — DEUX états
  distincts, confirmé par l'utilisateur comme « toggle entre 0 %, 100 % et
  200 % » — `{pctParStack: 100, pctMax: 200}` donne exactement ces trois
  paliers.
- **Destroyer of Battlefield/Slayer, Borgnine** (point 31a) et **Fire
  Bead/Dokkaebi Lord (Feu), Moogwang** (point 31b) : « damage... increases
  proportionate to the enemy's DESTROYED HP » (`quantite: 0`) — confirmé
  +0,5 %/point pour Borgnine (jusqu'à +30 %), +1 %/point pour Moogwang
  (jusqu'à +60 %). Le « point » représente 1 % de PV cible DÉTRUITS (pas
  perdus normalement), saisi manuellement.

**Modificateurs MONSTRE-WIDE ADDITIFS** (nouveaux, s'ajoutent au
MULTIPLICATEUR du sort choisi comme `bonusCoefficientParCompteur`/Crawler,
mais déduits d'un passif sans formule plutôt que propres à un sort — voir
`computeSkillDamageDetail`, paramètre `monsterWide` étendu) :

- **Spear of Tenacity/Centaur Knight, Pholus** (point 38) : « damage...
  proportionate to the enemy's MAX HP » — confirmé +2 %. Toujours actif,
  soumis au critique/à la défense comme le reste du sort.
- **Martial Arts Specialist/Martial Artist, Sin** (point 37) : « additional
  damage proportionate to your Defense if your Defense is higher than the
  opponent » — confirmé 50 % de l'écart, à CHAQUE coup, jamais négatif
  (`max(0, DEF − DEF cible)`).
- **Sickle Blade/Bayek (Vent)** et **Sand Blade/Desert Warrior (Vent),
  Shahat** (point 35) : « additional damage that's 7% of your MAX HP when
  you attack on your turn » — confirmé (`quantite: 7`). ⚠️ **UNE SEULE
  FOIS par sort, pas par coup** (confirmé par l'utilisateur) — ajouté
  APRÈS le `×coups`, contrairement à Spear of Tenacity/Martial Arts
  Specialist.
- **Calculated Sacrifice/Onimusha, Fuuki** (point 27) : « Decreases your
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

- **Backup Code/Hacker, 570RM** (point 33) : « damage increases by 20% for
  each harmful effect granted on target » — confirmé (`quantite: 20`).
  PREMIER cas « débuffs SEULS » du fichier (`source: 'debuffs'`).
- **Blessing of Curse/Devil Maiden, Jessica** (point 34) : « For every
  harmful effect granted on YOURSELF, the damage dealt is increased by
  20% » — confirmé. Compte les débuffs sur SOI (`DamageSetup.
  effetsPropresCount`, stockage séparé de `effetsCibleCount`).

**Bouton restreint à UN SORT** (nouveau : `SkillDamageProfile.
bonusConditionnelPropre?: { pct: number; condition: string }`) :

- **Emergency Drive/Cynthia, Arcane Weapon** (point 32) : « deal 50%
  increased damage » UNIQUEMENT « While in the mechanical frame state », un
  état qui force l'usage de **Rending Claw** (S2) — un bouton monstre-wide
  aurait été faux dès qu'un AUTRE sort est sélectionné à l'écran. Le bouton
  ne majore donc QUE Rending Claw, jamais Mechanical Fist (S1).

**QUATRIÈME et CINQUIÈME mécanique liée à une stat** (multiplicatif sur le
TOTAL, linéaire, plafonné, toujours actif — même famille que Sonia/écart de
VIT, source différente) ; une SIXIÈME, de forme différente (seuil ABSOLU,
pas linéaire), suit juste après :

- **Hidden Sense of Justice/Zenitsu Agatsuma (Ténèbres)** et **Lethal
  Intent/Qilin Slasher (Ténèbres)** (point 29) : « increases the damage
  dealt according to your Critical Rate » (`quantite: 0`) — confirmé
  linéaire, +0,8 % de dégâts par point de Taux Crit BRUT (avant plafond à
  100 % — cohérent avec Wolf School Training, qui traite déjà ce nombre
  comme significatif au-delà de 100 %). SEUL cas du fichier où le Taux
  Crit devient une stat à privilégier au pré-filtrage.
- **Aegis Shell/Beetle Guardian, Gideon** (point 30a) : « increases the
  damage you deal to enemies by up to 100% in proportion to your Defense »
  (`quantite: 100`) — confirmé 100 % à 5000 DEF (« y compris lead, buff
  DEF »). Distinct de Martial Arts Specialist : ici c'est la DEF PROPRE,
  sans comparaison avec la cible.

⚠️ **Régression trouvée EN COURS d'implémentation de Gideon (pas signalée
par l'utilisateur)** : la formule linéaire-plafonnée partagée par toute
cette famille (Sonia, Chun-Li/Leah…) clampait `Math.min(pctMax, écart)` —
correct UNIQUEMENT quand `ecartMax == pctMax` (Sonia : 50/50, coïncidence).
Pour Chun-Li/Leah (`ecartMax: 150, pctMax: 200`, valeurs DIFFÉRENTES), un
écart de VIT au-delà de 150 points donnait ~267 % au lieu de rester
plafonné à 200 %. Corrigé (`Math.min(ecartMax, écart)`) et testé au-delà du
plafond, jamais vérifié jusque-là.

**Might of the Mercenary/Mercenary Queen, Brita** (point 30b) / **Might of
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

⚠️ **Deux réponses successives de l'utilisateur, réconciliées après coup.**
Une première (Brita, « +633 de vitesse ») ne correspondait pas aux données
(aucune clause VIT ne porte de bonus de dégâts) — corrigée en « +633
d'ATQ, sans lead attaque, en ne prenant en compte que les compétences
d'invocateur combat », d'abord interprétée comme un ÉCART au-dessus de la
seule BASE (736 + 633 = 1369). Une seconde réponse (Eivor, même mécanique
confirmée indépendamment) a donné le seuil directement en TOTAL ABSOLU :
« 1671, toute source confondue (ATQ de base + rune + lead + compétence
d'invocateur) ». Les deux se recoupent exactement : 736 (base) + 302
(compétence d'invocateur combat, 41 % de la base, arrondie au-dessus) +
633 (rune) = **1671** — confirmant que `+633` désignait la part RUNE
seule, pas un écart sur la base entière. Seuil réel = **1671, un total
ABSOLU** (contrairement à tous les autres seuils/plafonds de ce fichier,
qui sont des écarts) — et INCLUT le lead cette fois, contrairement à la
première interprétation. Comparé à `atkCombatComplet` (nouvelle fonction,
même prudence que `defCombat` : non partagée avec le calcul de
`computeSkillDamageDetail`). Entièrement DÉDUIT, aucun bouton — même
famille que `critSiPlusRapide`, mais un seuil sur l'ATQ propre plutôt
qu'une comparaison de VIT avec la cible.

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

⚠️ **Cette découverte révèle ~24 AUTRES sorts/passifs portant le flag
« Debuff Bonus Damage »**, jamais examinés (recherche corpus-wide faite
après coup, catalogue séparé préparé pour l'utilisateur) — aucun
implémenté à l'aveugle dans cette vague.

**Zaiross (« Fiery Breath »)** — demande explicite. « Attacks all enemies
and puts their skills on MAX cooldown. [...] Additionally, if the enemy's
Attack Power is half or less than your Attack Power, the attack always
lands as a Critical Hit and increases the damage dealt against the enemy
by 50%. » L'ATQ de l'adversaire n'est pas une donnée que l'app connaît —
condition non déductible, bouton RESTREINT À CE SORT
(`SkillDamageProfile.bonusConditionnelPropre`, même mécanisme que Touch of
Mercy/Emergency Drive), `+50 %` sur les dégâts. ⚠️ **Seule la clause de
DÉGÂTS est modélisée** (demande explicite) — la clause « critique garanti
sous la même condition » reste HORS MODÈLE : aucun mécanisme dans ce
fichier pour un crit garanti conditionné à l'ATQ adverse (`critSiPlusRapide`
compare la VIT, pas l'ATQ). Skill partagé tel quel (même `com2usId`) par le
Dragon Feu 5★ pré-éveillé — le bouton s'applique aux deux formes sans code
séparé.

## Effets d'ÉQUIPE (Euldong, Mirinae, Deborah, Miriam, Dr. Matteo, Velaska)

Six effets **portés par un AUTRE monstre que celui optimisé** — leur
présence dépend de la composition d'équipe, pas du monstre en cours
d'optimisation. Demande explicite de l'utilisateur : sélectionnables dans
« Effets actifs » comme un buff ATQ, avec le **portrait du monstre** en
icône plutôt qu'une icône de buff générique (`EULDONG_ICON`/`MIRINAE_ICON`/
`DEBORAH_ICON`/`MIRIAM_ICON`/`TRANSMISSION_ICON`/`VELASKA_ICON`, URLs
`Monster.image` — pas `buffs/…` comme les icônes de buff). Contrairement à
`critSiPlusRapide`/`bonusDegatsSelonVit`/`bonusDegatsStack` (déduits du
monstre OPTIMISÉ, `RealDamageContext`), ces six sont de purs choix
utilisateur : des champs booléens de `DamageSetup`
(`euldongActif`/`mirinaeActif`/`deborahActif`/`miriamActif`/
`transmissionActif`/`velaskaActif`), lus directement dans
`computeSkillDamageDetail`/`computeTotalDamage` — aucune détection de
monstre, aucun `RealDamageContext` supplémentaire.

- **Euldong** (« Triumph Over Evil », passif — Dokkaebi Lord Euldong) :
  confirmé par l'utilisateur, ajoute **100 POINTS** à la stat Dgts Crit
  (130 % → 230 %), pas un facteur ×2 — même famille que les points plats des
  compétences d'invocateur. `EULDONG_CD_POINTS = 100`, gaté sur `montreCrit`
  (un sort à dégâts fixes ne crite jamais, rien à amplifier). ⚠️ Le texte du
  jeu précise que cet effet ne cumule pas avec un AUTRE effet
  d'augmentation de Dgts Crit — aucun de modélisé ici pour l'instant, donc
  sans conséquence actuellement.
- **Mirinae** (S3, « Cursed Music ») : confirmé par l'utilisateur, « works
  as 30% negative damage resistance. It stacks additively with -DMG%
  artifacts ». Même famille que la Marque (+25 %, additif dans le terme
  « Réductions ») — les deux s'ADDITIONNENT, ne se multiplient pas entre
  elles. `MIRINAE_BONUS_PCT = 30`, non gaté (comme la Marque, aucun sort ne
  l'ignore).
- **Deborah** (passif, « Blacksmith's Discernment ») : confirmé par
  l'utilisateur — « modeled through the effective DEF break… Effective DEF
  break is 91% with deborah passive and a defense break ». Amplifie la
  RÉDUCTION de DEF d'une réduction de défense déjà active
  (`setup.defBreak`), jamais une réduction à elle seule :
  `1 − (1 − DEF_BREAK_FACTOR) × DEBORAH_AMPLIFY` = `1 − 0,7 × 1,3 = 0,91`.
  `DEBORAH_AMPLIFY = 1.3`, gaté sur `montreDefEnnemie` (même condition que
  le toggle « Def break »). ⚠️ Le texte précise « 15% if it's the boss » —
  comme partout ailleurs dans l'outil, aucune notion de boss n'est modélisée
  ; seul le cas non-boss (30 %) l'est.
- **Miriam** (passif, « Blacksmith's Technique ») : confirmé par
  l'utilisateur — « augmente l'effet du buff ATQ, du buff vitesse et du
  buff defense de 35% ». Amplifie la MAGNITUDE des trois buffs déjà actifs,
  jamais leur simple présence : généralise à ATQ/DEF le mécanisme déjà en
  place pour la VIT via un artéfact « Effet aug. VIT »
  (`speedBuffAmpliPct`), mais Miriam est un TOGGLE (un monstre dans
  l'équipe ou non), pas une somme de lignes d'artéfact — les deux sources
  s'ADDITIONNENT avant d'amplifier, comme plusieurs lignes d'artéfact
  identiques le font déjà. `MIRIAM_AMPLIFY_PCT = 35`, gaté sur l'union des
  conditions déjà utilisées pour les toggles ATQ/DEF/VIT ci-dessus.
- **Dr. Matteo** (S3, « Transmission ») : « increases the damage that
  allies deal to enemies by 20% while you are under an inability effect ».
  ⚠️ Formulation IDENTIQUE à Mirinae (« increases the damage… by X% ») mais
  **jamais confirmée séparément comme additive** avec la Marque/Mirinae —
  traitée PAR ANALOGIE de formulation dans le même terme « Réductions »
  (`TRANSMISSION_BONUS_PCT = 20`), non gaté. Condition (« pendant que
  Dr. Matteo est sous incapacité ») non déductible, comme les autres : un
  toggle, désactivé par défaut.
- **Velaska** (S3, « Price of Pain ») : « When an ally with reduced HP
  attacks the enemy, the damage dealt increases in proportion to the
  amount of HP lost. » Confirmé par l'utilisateur : scaling **linéaire**,
  **+0,5 % de dégâts par point de % de PV perdu**
  (`VELASKA_PCT_PAR_PV_PERDU = 0.5`). ⚠️ **Seul effet d'équipe à porter une
  DEUXIÈME donnée** en plus du toggle : l'app ne simule pas les PV réels du
  monstre optimisé (`setup.velaskaPvPerduPct`, 0-100, 0 par défaut = aucun
  bonus). Un champ numérique dédié apparaît sous la grille d'icônes
  UNIQUEMENT quand `velaskaActif` est coché — même discipline que le champ
  « Stack actuel » de Momo, jamais un état deviné.

## Leader skill d'équipe

Généralise l'ancien champ VIT-only (`leaderSpeedPct`) à **toute** stat de
lead — demande explicite de l'utilisateur : « choisir un leader skill…
implémenter les leader skill de PV, d'ATQ, de DEF, de VIT, de Taux Crit et
de dégâts crit ». Sélection dans « Effets actifs » : un type d'abord (avec
l'icône OFFICIELLE du jeu, réutilisée depuis `siege/LeadPill.tsx` —
`leadIconUrl`/`STAT_LABEL`, jamais dupliquée), puis une valeur — un palier
réel du jeu proposé dans une liste déroulante, ou une saisie libre
(`DamageSetup.leaderSkill: { stat, pct }`).

Paliers réels, confirmés par l'utilisateur (`LEADER_SKILL_PRESETS`,
damage.ts) — jamais une progression régulière déduite d'une stat à
l'autre :

| Stat | Paliers |
|---|---|
| PV / ATQ / DEF | 28, 33, 38, 40, 44, 50 % |
| VIT | 21, 24, 28, 30, 33 % |
| Taux Crit | 21, 24, 28, 33, 38 % |
| Dégâts Crit | 25 % (un seul palier connu) |

⚠️ **Deux familles de mécaniques, jamais confondues** :
- **PV/ATQ/DEF/VIT** — un pourcentage MULTIPLICATIF de la stat de **BASE**
  (voir l'incident ci-dessous), ajouté comme des points FLATS au total
  runé — exactement `avecInvocateur`/`pctSpeedBonus` (speed.ts, page RTA).
- **Taux Crit/Dégâts Crit** — des points FLATS ajoutés DIRECTEMENT à la
  stat, même famille que les compétences d'invocateur (`cdPoints`) et
  Euldong — jamais un pourcentage de quoi que ce soit.

### ⚠️ Incident : un lead porte sur la stat de BASE, pas le total runé

Signalé par l'utilisateur : « les leaderskill s'appliquent sur les
statistiques de base. Tu as un exemple d'utilisation des leader skill (de
VIT) dans la page RTA. » Un premier jet appliquait le pourcentage du lead
au **total runé** — exactement l'erreur que `combatSpeed`/`pctSpeedBonus`
(speed.ts) évitent déjà pour la VIT en siège/RTA :
`base + rune + ceil(base × (totem+lead+swift)/100)`, le pourcentage ne
portant QUE sur `base`, jamais sur `base + rune`. Corrigé pour toutes les
stats concernées (`avecInvocateur` gagne un second paramètre
`extraBasePct`, sommé à la compétence d'invocateur — même nature — AVANT
le `ceil` UNIQUE, jamais un second `ceil` séparé qui reproduirait l'écart
d'un point déjà documenté et corrigé une fois dans `pctSpeedBonus`, « ne
jamais arrondir bonus par bonus »).

Le buff de combat (`atkBuff`/`defBuff`/`spdBuff`), lui, reste %TOTAL — une
mécanique DIFFÉRENTE, pas la même formule : il s'applique donc APRÈS le
lead déjà posé, jamais sommé avec lui dans la même étape.

### Compatibilité arrière

Une recette exportée AVANT cette généralisation ne porte que l'ancien
`leaderSpeedPct` (un pourcentage de VIT nu, sans type). `resolvedLeaderSkill`
(damage.ts) traduit explicitement : `leaderSkill` si présent, sinon
`{ stat: 'Attack Speed', pct: leaderSpeedPct }` — jamais un défaut générique
qui perdrait la valeur déjà saisie. Le champ legacy n'est plus jamais
ÉCRIT depuis l'écran (marqué `@deprecated`), seulement lu.

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
