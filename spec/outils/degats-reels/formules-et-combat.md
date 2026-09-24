# Dégâts réels — formules et combat

**Statut :** ÉTAT ACTUEL — décrit les formules, l’équation et les compétences d’invocateur
**Lire si :** on modifie l’analyse d’une formule ou l’équation de dégâts
**Ne pas lire si :** on travaille sur les artéfacts, bombes ou passifs offensifs
**Voir aussi :** spec/outils/degats-reels.md, spec/outils/mecaniques.md

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

La présence d'une `formule` ne suffit **pas** à qualifier le sort d'offensif :
elle peut chiffrer un soin (y compris proportionnel à l'ATQ), un bouclier ou
un autre effet. Avant de construire un profil de dégâts, les soins sans frappe
sont écartés. Sur le corpus vérifié, `coups: 0` avec l'effet `Heal` désigne
un soin sans dégâts ; les exceptions où `coups` vaut 1 ou l'effet `Heal`
manque sont curées par nom exact après lecture des variantes. Cela comprend
`Purify` d'Aeilene (normal et second éveil), `Fairy's Blessing`,
`Medical Support`, `Love & Peace`, `Soft Pudding`, `Amuse`, `Heal!`,
`Operation Support`, `Synergy`, `Mystical Blood Transfusion` et
`One More Drink` : ce dernier peut déclencher ensuite `Rolling Punch`, mais
sa propre formule `2,4 × ATQ` décrit le soin. À l'inverse, `Bite`,
`Will-o'-the-Wisp` et les autres sorts qui frappent **et** soignent gardent
leur profil offensif. Ni une recherche automatique du mot « attaque » dans
la prose ni la valeur de `coups` prise seule ne sont des preuves fiables.

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

Couverture mesurée sur le corpus complet après exclusion des 69 soins :
**6 073 profils de dégâts calculables, 115 refusés explicitement** (variables hors modèle —
`{Attacker's Level}`, `ABSORPTION_TOT_CNT`… — ou formules hors grammaire).
`{Relative SPD}` a longtemps fait partie des variables refusées (20 sorts,
Beast Rider ×10 formes/éléments, Barbara, Masha, Savannah, Narsha, Xiana) —
reconnue depuis confirmation de sa formule par l'utilisateur.

Un sort dont la formule ne dépend d'**aucune** statistique de l'attaquant
(dégâts purement fixes) est refusé lui aussi : il est calculable, mais
optimiser des runes dessus n'a aucun sens — toutes les combinaisons
donneraient le même nombre.


## L'équation de référence (swcalc)

```
Dégâts = (Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel) × Réductions
```

Source : [swcalc.cz/game-mechanics](https://swcalc.cz/game-mechanics). Ce
découpage en **brackets** est ce qui décide de tout : chaque terme est additif
**en interne**, jamais avec les autres.

| Terme | Contenu | Dans ce fichier |
|---|---|---|
| **Crit** | `1 + Skillups + CDrune + CDarti + CDbonus − CDtaken` | `critTerm` — les Dgts CRIT d'artéfact (400-403, 410, 411, 222-224) y entrent, confirmé |
| **DMG%** | `1 + ArtifactOnElement + ArtifactCoOp + Other` | `dmgPct` |
| **FacteurDéf** | `1000 / (1142 + 3,572 × DEF)` | `defenseFactor` — ⚠️ le dépôt garde **1140 / 3,5**, écart assumé de longue date |
| **Additionnel** | dégâts fixes de sort, et « + N % d'une stat » | `ajoutBrutParCoup` — ne crite pas, ignore la défense |
| **Réductions** | `Artefact + Passif − Mirinae/Marque`, puis un bucket multiplicatif | `reductions` |
| **Variance** | ±2,8 % | volontairement hors modèle |

⚠️ **Le piège de cette formule est de confondre « additif » et « dans le même
bracket ».** Deux effets peuvent être chacun additifs et pourtant se
multiplier entre eux — c'est exactement l'erreur commise sur les lignes
élémentaires (voir plus bas).


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

⚠️ **Deux états, pas deux interrupteurs indépendants** — **Combat** s'applique
toujours ; **Combat + Guilde** ajoute l'onglet Guilde dans le contenu concerné.
Deux cases séparées permettraient de demander Guilde sans Combat, autre
combinaison qui n'existe pas en jeu.

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

**Défaut et minimum : « Combat »** — le cran « Aucune » a été retiré, car ces
compétences s'appliquent dans toute situation réelle du jeu. Une recette
exportée avant ce retrait reste lisible : « Aucune » y est normalisée vers
« Combat » avant d'atteindre l'écran ou le CLI.


## Volontairement hors modèle

Absents du résultat, **jamais approximés en silence** :

- la **variance** (±2,8 %) — un aléa par coup, sans effet sur un classement ;
- l'**avantage élémentaire** et les coups **glancing** ;
