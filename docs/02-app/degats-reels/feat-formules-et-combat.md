# Dégâts réels — formules et combat

**Statut :** ÉTAT ACTUEL — décrit les formules, l’équation et les compétences d’invocateur
**Lire si :** on modifie l’analyse d’une formule ou l’équation de dégâts
**Ne pas lire si :** on travaille sur les artéfacts, bombes ou passifs offensifs
**Voir aussi :** [README.md](README.md), [../mecaniques/](../mecaniques/)

## Principe directeur — ne jamais redemander ce qu'on sait déjà

Les données SWARFARM (`public/data/skills/<com2usId>.json`, voir
[transverse/](../transverse/)) portent **déjà**
l'essentiel. Sont donc **déduits, jamais saisis** :

| Ce qu'on déduit | D'où |
|---|---|
| Coefficient du sort | `formule` (ex. `0.68*{ATK}`) |
| Statistiques qui font travailler le sort | les variables de `formule` |
| Nombre de coups | `coups` |
| Portée (zone / cible unique) | `aoe` |
| Ignore la défense | un effet nommé `Ignore DEF` (sauf l'ignore proportionnel à la VIT et les Blade Dancers, voir « Ignore DEF à partir d'un coup choisi ») |
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

Les **sorts sans attaque** sont masqués de la même façon. Règle de
l'utilisateur : un ratio et des `coups`
ne prouvent pas qu'un sort attaque ; sans attaque ni dégâts infligés dans sa
prose, ce n'en est pas une. Un tel sort n'apparaît pas dans « Compétence
utilisée » : il n'est ni proposé ni affiché refusé, et un passif de la même
table n'est jamais un passif offensif. La table `SORTS_SANS_ATTAQUE_PAR_ID`
([damage.ts](../../../src/lib/damage.ts)) est curée par identifiant, une
prose citée par ligne, jamais une détection de la prose. Elle compte
36 sorts actifs : 25 boucliers (dont Frieren `24909`, Gandalf, Old Wood,
les Air Shield, Force Field, Protection Field, Beneficial Hammering), Trade
`7414`, Destiny Dice `12115` et Forbidden Galdr `13111`. Ce dernier est un
effet de PV sans coup. Huit autres sont confirmés par l'utilisateur, parmi
les 144 sorts à formule sans « attack » ni « damage » :
Regenerate `2113` (Lukan), Revive `2611` (Mikene), Dark Return `2615`
(Tilasha), Unleashed Fury `4210` (Zeratu), Soul Revival `6713` (Michelle),
Light of Revival `6714` (Iona) et les deux Scroll Trap `13707` (Jeogun) et
`13709` (Hanwul), dont la formule est une durée de sceau. Harmonia et Vivachel S3 et le passif d'Aya vent
n'ont pas de formule et sont de toute façon hors calcul. Le mot « damage » d'un
bouclier (dégâts absorbés) ou d'un Reflect Damage accordé ne fait pas une
attaque. Les passifs de Pure Vanilla et Angela (`16113`, `16613`) restent
hors table : leur prose inflige une riposte, mais leur `formule` est celle
du bouclier.

⚠️ **La compétence est supposée MAXÉE**, comme partout ailleurs dans l'app
(même parti pris que `paliersRechargement`, voir
[monsterSkills.ts](../../../src/lib/monsterSkills.ts)) : les `Damage +X%` sont tous
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

Couverture mesurée sur le corpus complet après exclusion des 69 soins
(mesure antérieure au masquage des sorts sans attaque) :
**6 073 profils de dégâts calculables, 115 refusés explicitement** (variables hors modèle —
`{Attacker's Level}`, `ABSORPTION_TOT_CNT`… — ou formules hors grammaire).
`{Relative SPD}` est reconnue (20 sorts, Beast Rider ×10 formes/éléments,
Barbara, Masha, Savannah, Narsha, Xiana), sa formule confirmée par
l'utilisateur.

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

Reprend celle de [../mecaniques/](../mecaniques/) :

```
Dégâts = ( Mult × Crit × FacteurDéf + Additionnel ) × Réductions × coups
```

- **Mult** — la formule du sort évaluée sur les stats du build, buffs
  appliqués.
- **Crit** — `1 + améliorations% + part_crit × DgtsCrit%`, où `part_crit`
  dépend du mode choisi : `1` (Critique) ou `0` (Non critique). Le Taux
  Crit du build n'y entre pas : le calcul n'a pas de mode « Moyenne » qui le
  prendrait pour `part_crit` (l'espérance).
  ⚠️ **Taux Crit écrêté à 100 %** : `computeStats` renvoie volontairement
  le total brut (un dépassement reste une marge légitime contre la
  résistance adverse), mais au-delà de 100 % il ne rapporte plus aucun
  dégât en jeu — sauf le surplus que Wolf School Training reverse en Dgts
  Crit (voir [catalogue-des-passifs.md](catalogue-des-passifs.md)).
- **FacteurDéf** — `1000 / (1140 + 3,5 × DEF_effective)`, avec
  `DEF_effective = DEF_ennemie × (0 si ignore défense) × (0,3 si réduction
  de défense)`. ⚠️ **Source unique du facteur de défense pour toute l'app** :
  `objectiveScore('ehp')` ([runeBuildOptim.ts](../../../src/lib/runeBuildOptim.ts))
  importe ces mêmes constantes plutôt que d'en garder une copie.
- **Additionnel** — un sort à **dégâts fixes** passe par cette branche : ni
  critique, ni facteur de défense.
- **Réductions** — `+25 %` si la **marque** (Branding) est active.

**Effets de combat modélisés** (potences de base, tronquées vers le bas
comme le décrit [../mecaniques/](../mecaniques/) ; aucun bonus d'effet
n'est exposé en v1) : buff d'attaque **+50 %**, buff de défense **+70 %**,
buff de vitesse **+30 %**, réduction de défense **×0,3**, marque **+25 %**.


## Ignore DEF à partir d'un coup choisi — les Blade Dancers

Six sorts portent l'effet `Ignore DEF` avec une note qui le conditionne à la
jauge d'attaque de la cible : « If enemy ATB at 0 », ou « If enemy ATB at 0
or 7th hit ». Leur prose le confirme : la DEF n'est ignorée que lorsque la
jauge de la cible est tombée à 0, ce que chaque coup rapproche. Le corpus
balayé en entier n'en contient pas d'autre : six identifiants, douze formes.

| Variante | Identifiants (formes) | Coups | Crans proposés | Défaut |
|---|---|---|---|---|
| **A** — −50 % d'ATB par coup | `14308` (24403, 24413), `14310` (24405, 24415), `14808` (24903, 24913), `14810` (24905, 24915) | 3 × `1,8 × ATQ` | aucun ignore DEF · à partir du 2ᵉ coup · à partir du 3ᵉ | aucun ignore DEF |
| **B** — −40 % par coup, **7ᵉ coup toujours ignoré** | `14311` (24401, 24411), `14811` (24901, 24911) | 7 × `0,85 × ATQ` | à partir du 2ᵉ · 3ᵉ · 4ᵉ · 5ᵉ · 6ᵉ coup · 7ᵉ coup seul ; « aucun » n'existe pas | 7ᵉ coup seul |

**La règle est fournie par l'utilisateur** (confirmation de revue pour les
défauts) : le **coup 1 n'ignore jamais** la DEF, et **une fois
qu'un coup ignore, tous les suivants ignorent**. Le choix se réduit donc à un
seul nombre, le rang du premier coup qui ignore. Par défaut, seul le coup
inconditionnel ignore : jamais une réussite supposée.

⚠️ **La jauge d'ATB adverse n'est pas modélisée.** L'app ne sait pas où elle
en est au lancement du sort : le rang est un **choix** de l'utilisateur, jamais
déduit d'une ATB initiale ni d'un nombre de réductions réussies. Une
justification du type `⌈100/50⌉` supposerait arbitrairement une jauge pleine.

**Calcul, coup par coup.** Le booléen `ignoreDef` du profil, qui veut dire
« tous les coups ignorent », est **faux** pour ces six sorts ; la règle curée
(`IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID`, par identifiant, avec sa source) est
portée par le profil. Le sort se découpe en deux tronçons au plus : les coups
avant le rang, mitigés comme ceux de tout sort (DEF saisie, réduction de
Défense, fractions conditionnelles), puis les coups à partir du rang, dont la
DEF effective vaut 0. Les PV de la cible s'enchaînent d'un tronçon à
l'autre. Les Dgts CRIT de première attaque (411) ne valent que pour le
coup 1, qui n'ignore jamais. Comme `champsDuCombat` lit ce booléen, la DEF de
la cible reste comptée parmi les réglages consommés, dans tous les crans.

Ce mécanisme n'est ni la neutralisation d'`IGNORE_DEF_CONDITIONNEL_PAR_ID`,
où un bouton à part active l'ignore de tout le sort, ni l'ignore
proportionnel à la VIT, ni les conditions de combat (`ignoreDefParStack`,
`compteurMin`, `ignoreDefPct`). Les Blade Dancers ne figurent dans aucune de
ces tables.

**Réglage.** `DamageSetup.premierCoupIgnoreDefParSort`, indexé par
identifiant du sort : le rang choisi, ou `null` pour « aucun », permis
seulement sans coup inconditionnel. Une clé absente donne le défaut du sort.
Au calcul, une valeur hors des crans permis, par exemple un coup 1 ou
« aucun » en variante B, retombe aussi sur ce défaut
(`resolvedPremierCoupIgnoreDef`) : seconde garde pour ce qui n'arrive pas par
une recette, qui ne peut plus en porter (voir « Recette »). Le champ est
propre au sort : vidé au changement d'espèce et à l'import de compte,
conservé au changement d'exemplaire.

**À l'écran et au CLI.** Pour ces six sorts seulement, un sélecteur
**« Ignore la DEF (jauge de la cible à 0) »** apparaît sous la liste des
sorts de « Compétence utilisée ». Variante A : « Aucun » (défaut), « Dès le
2ᵉ coup », « Dès le 3ᵉ coup » ; variante B : « Dès le 2ᵉ coup » à « Dès le
6ᵉ coup », puis « 7ᵉ coup seul » (défaut). Crans et libellés sont dérivés de
la règle curée du sort (`cransIgnoreDefAPartirDuCoup`), jamais écrits par
sort ; la valeur montrée est le cran que le calcul retient
(`cranIgnoreDefRetenu`), jamais la valeur stockée. Le résumé du sort, dans la
liste, dit ce cran sur une ligne à lui — « Ignore la DEF : dès le 2ᵉ coup »,
« … : aucun », « … : 7ᵉ coup seul » —, d'une seule ligne de haut quel que
soit le cran : en changer ne déplace pas le sélecteur. La ligne du sort du
CLI (`scripts/optimizer-search.ts`) dit la même phrase
(`resumeIgnoreDefRetenu`). La DEF de la cible reste affichée dans tous les
crans, dans la fenêtre comme dans le résumé sous l'objectif.

**Recette.** Le champ voyage dans `damageSetup`, et l'import le valide
**selon la règle du sort** : un objet indexé par identifiants entiers
positifs (sans zéro de tête), dont chaque clé désigne un des six sorts et
chaque valeur un de ses crans — variante A `null`, 2 ou 3 ; variante B un
entier de 2 à 7, jamais `null`. Ces valeurs sont dérivées de la même règle
curée que les crans de l'écran (`cransDeLaRegleIgnoreDef`). Toute autre
valeur (coup 1, 9ᵉ coup, 0, « aucun » en variante B, texte…), et la clé d'un
sort sans cette règle (Lushen S3, autre monstre), font **refuser** la
recette avec le chemin exact (`damageSetup.premierCoupIgnoreDefParSort.<identifiant>`),
jamais ramenées en silence au défaut. Le message d'une clé sans règle,
« désigne un sort sans réglage d'ignore DEF par coup », ne compte ni ne nomme
les sorts de la table : il reste juste quand elle grandit. Une recette
antérieure, sans le champ,
garde le défaut de chaque sort. L'écran et le CLI lisent la recette par le
même parseur, et le CLI passe `damageSetup` entier au calcul, comme
l'écran : le rang s'y applique à l'identique.

**Garde-fou.** Les rangs ne valent que pour le nombre de coups que la
curation suppose : si les données en annonçaient un autre, le sort serait
refusé avec sa raison plutôt que calculé avec des rangs faux. Test :
[tests/blade-dancers.test.ts](../../../tests/blade-dancers.test.ts) — corpus et
famille close, chaque cran et chaque défaut, contrôle négatif sur les ignore
DEF inconditionnels (`Hero Strike`, `Strike of Fighter`, Lushen S3) ; puis la
recette (`testBladeDancersRecette`), le sélecteur, le résumé et la ligne du
CLI (`testBladeDancersEcranEtCli`).


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
[speed.ts](../../../src/lib/speed.ts) ; le totem entre dans le `Σ%vit` appliqué à la
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


## Calcul partiel — l'étiquette par identifiant

Un sort **calculé** dont le total omet une part connue du jeu porte, dans
« Compétence utilisée », une étiquette **« Calcul partiel »** posée après le
« ? » de sa prose, suivie de son propre « ? » qui dit ce qui n'est pas
compté.
La phrase vient d'une table curée par identifiant de sort
(`CALCUL_PARTIEL_PAR_ID`, lue par `calculPartielDuSort`, `damage.ts`) ;
l'écran ne l'écrit jamais lui-même.

- **Affichage seul** : aucun calcul ne lit la table, le total reste celui
  d'avant. Aucune mention sur les cartes de résultats (forme écartée par
  l'utilisateur).
- **Quatre sources, 31 identifiants** : les six ignore DEF comptés en
  permanence alors que le jeu les conditionne (Madness Judgement ×2,
  Unlimited Power, Start of Attacking, Thunder Strike, Sword of Discharge —
  total gardé avec la mention tant que leur condition n'est pas modélisée) ; les sorts
  dont une perte de PV, un bonus selon les PV détruits ou retirés, ou la
  détonation de bombes déjà posées est décidée « comptée » mais pas encore
  codée (« pas encore comptée ») ; les parts que l'utilisateur a décidé de
  ne **pas** calculer, dites à l'écran (Daniel, Jasmine, Lavender, Espresso
  Cookie, et Hibiscus par la règle des jumeaux collab : « n'est pas
  calculée ») ; enfin deux parts connues du jeu, non modélisées, que
  l'utilisateur a demandé de marquer :
  l'équilibrage ATQ/DEF d'Internal Force de début de combat sur les deux
  sorts de dégâts de Leona (Justice Strike, Fury of Punishment) et le bonus
  de dégâts selon la VIT contre les ennemis plus lents de Summary Justice
  (Theonia) — « pas encore compté ».
- **Écartés parce que le total est complet par décision** : Devil's Bargain
  (la prose se trompe), les détonations de dégâts continus et les bombes à
  retardement (hors total).
- **Seul un sort pris en charge** porte l'étiquette : un sort refusé n'a pas
  de total, il garde son motif.
- **Rien ne bouge au clic** : l'étiquette dépend du seul sort, jamais du sort
  choisi ; elle vit hors du bouton de la case (axe `actionTitre` d'`Option`),
  et son « ? » s'ouvre en bulle à la souris, en panneau montant au doigt
  (`HelpPopover`).
- **Une part livrée sort de la table dans le même commit.** La liste
  attendue est écrite à part dans `tests/calcul-partiel.test.ts`, avec sa
  source ; les six ignore DEF y sont aussi tenus pour « comptés en
  permanence », de sorte que le lot qui les conditionne fait échouer le
  test tant que l'entrée reste.


## Volontairement hors modèle

Absents du résultat, **jamais approximés en silence** :

- la **variance** (±2,8 %) — un aléa par coup, sans effet sur un classement ;
- l'**avantage élémentaire** et les coups **glancing** ;
