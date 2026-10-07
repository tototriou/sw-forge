# Dégâts réels — séquences de coups et cible secondaire

**Statut :** ÉTAT ACTUEL — décrit les sorts dont les coups n’ont pas tous la même formule ni la même portée (Blade Surge, séquences à valeur de l’API)
**Lire si :** on modifie une séquence de coups curée, le choix de la cible calculée (`cibleDegatsParSort`) ou l’application coup par coup des lignes 224, 400–403/410 et 411
**Ne pas lire si :** on travaille sur un sort dont tous les coups se ressemblent, ou sur les passifs offensifs
**Voir aussi :** spec/outils/degats-reels/artefacts-critique-et-element.md, spec/outils/degats-reels/formules-et-combat.md

## Une portée par sort, pas par coup

`SkillDamageProfile.aoe` est un booléen **du sort**, et `formule`/`coups` ne
décrivent qu’un seul groupe de coups. La donnée SWARFARM de Blade Surge porte
`0.5*{ATK}`, `coups: 2`, `aoe: false` ; sa prose ajoute un troisième coup sur
tous les ennemis (« attacks all enemies with even more powerful attack on the
3rd attack »), **absent de l’API**. Lu tel quel, le profil ne
compterait que deux coups mono-cible, et la ligne 224 s’appliquerait au sort
entier.

## La séquence curée — une table par identifiant

`SEQUENCES_DE_COUPS_PAR_ID_CONNUS` ([damage.ts](../../../src/lib/damage.ts))
donne, par identifiant de compétence, la séquence complète dans l’ordre où les
coups tombent : pour chaque groupe, formule, nombre de coups et portée.
Jamais un cas Blade Surge codé en dur dans le calcul, jamais une réécriture de
`formule` : `skillDamageProfile` recopie la séquence analysée dans
`SkillDamageProfile.sequenceDeCoups`, une donnée pure qui traverse le Worker
de résolution.

| Groupe | Coups | Formule | Portée | Source |
| --- | --- | --- | --- | --- |
| 1 | 1 et 2 | `0.5*{ATK}` | mono-cible | donnée SWARFARM + confirmation |
| 2 | 3 | `3.0*{ATK}` | zone, cible visée comprise | utilisateur, absent de l’API |

Valeurs curées ([valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md),
A.2 ter), fournies par l’utilisateur : séquence, portée de la famille,
skillups (`skillupDamagePct`, +30 %, sur les **trois** coups) et cible du
troisième coup (la cible visée le reçoit aussi).

⚠️ **Chaque entrée porte l’empreinte de la donnée.** À côté des groupes,
l’entrée garde la donnée de la fiche sur laquelle elle a été curée —
`formule` (celle de la fiche, avant toute formule curée), `coups`, `aoe` —
telle quelle. Si SWARFARM ne la porte plus (formule, nombre de coups ou
portée), `skillDamageProfile` refuse le sort avec sa raison plutôt que de
calculer une séquence périmée. L’empreinte est distincte des groupes :
d’une fiche à l’autre,
la donnée décrit le premier groupe, toutes les phases en `coups`, ou la
portée de la seule phase de zone, sans règle qui relie ces champs aux
groupes. Pour Blade Surge, l’empreinte (`0.5*{ATK}`, `coups: 2`,
`aoe: false`) coïncide avec le premier groupe.

**Couverture, en trois unités :**

- **8 identifiants** : `10601`, `10602`, `10603`, `10604`, `10605`, `10616`,
  `10618`, `10620` ;
- **11 formes du corpus** : Magic Knight eau `19801`, feu `19802`, vent
  `19803`, lumière `19804`, ténèbres `19805` ; Lapis `19811`, Astar `19812`,
  Lupinus `19813`, Iris `19814`, Lanett `19815` ; Imperfect Magic Knight vent
  `19823`. Les Magic Knights non éveillés ne sont pas sélectionnables dans
  l’Optimizer : `10601` et `10605`, portés par eux seuls, ne sont couverts que
  par la table et le test ;
- **5 amorces**, une par identifiant : `10602`,
  `10604`, `10616`, `10618`, `10620`.

Cinq candidats écartés (`11015`, `18314`, `23507`, `23508`, `23510`)
restent hors table, comme les sorts voisins de même catégorie, d’une autre
mécanique.

### Séquences à valeur de l’API

Quatre sorts frappent d’abord l’ennemi, puis tous les ennemis ; la phase de
zone n’est chiffrée que par la « compétence auxiliaire » (`other_skill`) de
l’API SWARFARM, absente de l’import du corpus. Règle (A.2 ter, « Valeurs
connues par l'API seule ») : la valeur de l’API par défaut, sauf si la prose la contredit — aucune des
quatre proses ne la contredit. Phases et portées viennent de la prose
(« Attacks the enemy … Afterwards, … all enemies »).

| Identifiant · sort · formes | Empreinte (`formule`, `coups`, `aoe`) | Groupe 1 | Groupe 2 | Source du groupe 2 |
| --- | --- | --- | --- | --- |
| `13311` Fatal Extinctive Bullet · Abigail `22911` | `3.5*{ATK}`, 1, non | `3.5*{ATK}` ×1, mono-cible | `4.5*{ATK}` ×1, zone | auxiliaire 2476 |
| `13314` Fatal Armor Bullet · Emily `22914` | `3.5*{ATK}`, 1, non | `3.5*{ATK}` ×1, mono-cible | `4.5*{ATK}` ×1, zone | auxiliaire 2478 |
| `14113` Head Press · M. BISON `24213` (`24203` non éveillé) | `4.0*{ATK}`, 2, non | `4.0*{ATK}` ×1, mono-cible | `5.2*{ATK}` ×1, zone | auxiliaire 2762 |
| `14613` Great Sword of the End · Sagar `24713` (`24703` non éveillé) | `4.0*{ATK}`, 2, oui | `4.0*{ATK}` ×1, mono-cible | `5.2*{ATK}` ×1, zone | auxiliaire 2830 |

L’empreinte de Head Press et de Sagar ne coïncide pas avec leur premier
groupe : `coups: 2` y compte les deux phases, et `aoe: true` de Sagar est la
portée de la phase de zone. Ces deux sorts n’existent comme séquences que
grâce à la garde par empreinte.

Les lignes d’artéfact et la cible secondaire suivent les règles par groupe
ci-dessous, appliquées par le calcul générique : 224 sur la phase 1, 411 sur
le premier coup du tour, le cran « Dégâts sur les autres ennemis » calcule
la seule phase de zone.

⚠️ **Non établi, nommé** : les skillups de la fiche (+25 % pour Abigail et
Emily, +15 % pour M. BISON et Sagar) s’appliquent aux deux phases, parce que
le calcul recopie le profil sur chaque groupe ; rien ne l’a confirmé pour
ces sorts, contrairement à Blade Surge. Sur la phase 1 seule, Abigail et
Emily vaudraient `3,5 × 1,25 + 4,5 = 8,875` × ATQ au lieu de `10`, M. BISON
et Sagar `4,0 × 1,15 + 5,2 = 9,8` au lieu de `10,58`. Un relevé du rapport
phase 2 / phase 1 sur la cible visée tranche.

## La cible calculée — `cibleDegatsParSort`

`DamageSetup.cibleDegatsParSort` (clé = identifiant du sort) choisit la cible
dont on calcule les dégâts. `cibleDegatsRetenue` rend la cible réellement
retenue.

| Cible | Coups calculés | PV de départ |
| --- | --- | --- |
| `'visee'` (défaut, clé absente) | toute la séquence : `0.5 × ATQ` ×2 puis `3.0 × ATQ` | ceux saisis, creusés coup par coup |
| `'secondaire'` | les seuls coups de zone : `3.0 × ATQ` | ceux saisis, jamais creusés par les coups mono-cible |

- La cible secondaire est **un** autre ennemi, jamais la somme sur tous. Les
  champs de la cible (DEF, PV, élément…) la décrivent alors : aucun champ
  nouveau.
- Son résultat n’est **jamais** une soustraction du premier cran : la part du
  coup de zone dans le cran « visée » lit des PV déjà entamés (222/223).
- Pour le calcul, une clé `'secondaire'` posée sur un sort sans coup de zone
  curé est sans effet (`cibleSecondairePriseEnCharge`, table de capacité lue
  par l’identifiant seul) ; la recette, elle, la refuse (ci-dessous).
- Le champ est classé `'sort'` (`DAMAGE_SETUP_CLASSIFICATION`) : vidé au
  changement d’espèce et à l’import de compte, conservé au changement
  d’exemplaire.
- **Recette** : le champ voyage dans
  `OptimizerRecipe.damageSetup`. Absent, la recette reste valide (cible
  visée, comme toute recette antérieure). Présent, `parseOptimizerRecipe`
  exige un objet dont chaque clé est l’identifiant entier positif d’un sort à
  coup de zone curé — la même table de capacité que l’écran,
  `cibleSecondairePriseEnCharge` — et chaque valeur `'visee'` ou
  `'secondaire'`. La clé s’écrit sans zéro de tête, comme celle de
  `premierCoupIgnoreDefParSort` : « 010616 » passerait la
  table de capacité, mais le calcul lit la clé « 10616 » et ne la verrait
  jamais. Tout écart est refusé avec son chemin
  (`damageSetup.cibleDegatsParSort.<identifiant>`), jamais corrigé ni ignoré
  en silence. L’import restaure la valeur telle quelle, sans reset ultérieur ;
  l’aller-retour export → import ne perd ni n’ajoute rien.
- **Écran** : sous la
  liste de « Compétence utilisée », au même endroit que le champ des coups
  variables, un `Segmented` à deux crans — « Dégâts sur la cible visée »
  (défaut) et « Dégâts sur les autres ennemis » (`CIBLE_DEGATS_LABELS`,
  libellés partagés avec le CLI) — n’apparaît que si
  `cibleSecondairePriseEnCharge` le permet pour le sort choisi. Le cran
  allumé est la cible que retient le calcul (`cibleDegatsRetenue`) ; le
  choisir n’écrit que la clé de ce sort. Le résumé des sorts donne la
  séquence entière (`resumeSequenceDeCoups` : « 2 coups · Cible unique, puis
  1 coup · Zone ») et ne lit jamais le cran : rien au-dessus du contrôle ne
  change de hauteur quand on bascule, il ne bouge donc pas sous le pointeur.
- **Résumé sous l’objectif** (`resumeCombat`) : la ligne qui remplace la fenêtre fermée ajoute « autres
  ennemis » juste après le sort quand la cible que retient le calcul pour le
  sort RÉSOLU est la cible secondaire (`resumeCibleDegatsRetenue`) — « S1
  Blade Surge · autres ennemis · … ». Rien pour la cible visée (le défaut),
  rien pour un autre sort, jamais la valeur stockée. Le texte est la fin du
  libellé du cran, écrit une seule fois dans `damage.ts`.
- **CLI** (`scripts/optimizer-search.ts`) : la recette
  passe par le même parseur, et son `damageSetup` entier par le même
  contexte de dégâts que l’écran (`buildRealDamageContext`) — parité écran/CLI.
  La ligne « Dégâts réels : sort … » donne la séquence entière
  (`resumeSequenceDeCoups`, au lieu des coups et de la portée de la seule
  donnée SWARFARM) et, pour un sort qui le permet, le libellé du cran calculé
  (« Dégâts sur la cible visée » ou « Dégâts sur les autres ennemis »).
- **Script de diagnostic des artéfacts** (`scripts/artifact-search.ts`) :
  sa ligne « Sort : … » donne la même séquence
  (`resumeSequenceDeCoups`) au lieu de « 2 coup(s) ». Il n’a aucune option de
  cran et calcule toujours la cible visée.

## Les lignes d’artéfact et les skillups, coup par coup

Chaque groupe passe par le chemin ordinaire de `computeSkillDamageDetail`,
avec **sa** formule et **sa** portée ; les sorts sans séquence gardent leur
chemin d’avant.

| Ligne | Cible visée | Autres ennemis | Règle |
| --- | --- | --- | --- |
| 224 `D.CRIT+ comp cib uniq pdt tour` | coups 1 et 2 | jamais | suit la portée du coup |
| 400 `[Comp.1] Aug. Dgts CRIT` | les trois coups | le coup de zone | suit le slot du sort |
| 411 `Dgts CRIT 1re attaque` | coup 1 seulement | jamais | premier coup **du tour** |
| `skillupDamagePct` | les trois coups | le coup de zone | tout le sort |

224 et 400 : confirmation explicite de l’utilisateur. 411 :
correction de l’utilisateur en revue — la première attaque sur une nouvelle
cible n’est pas un nouveau premier coup du tour ; si le premier coup d’une
séquence était en zone, chaque ennemi qui le reçoit en profiterait, ce qui
n’est jamais le cas de Blade Surge. Les passifs offensifs gardent leur profil
sans 411, dans les deux crans.

Les autres termes coup par coup suivent leurs règles ordinaires : la part
additionnelle (218–221) compte à chaque coup reçu — trois sur la cible visée,
un sur la cible secondaire —, et 222/223 lisent les PV de la cible calculée
avant chaque coup.

## Ce qu’une séquence n’admet pas

Une séquence n’admet ni coups variables (`hitsRange`) ni effets entre coups
(`effetsEntreCoups`), et ses porteurs n’ont aucun passif offensif : rien de
cela n’est modélisé pour une séquence. Le test vérifie sur le corpus qu’aucun
porteur n’en a besoin ; un porteur futur qui en aurait besoin le fera échouer
et demandera une curation.

`hits` et `aoe` du profil gardent la donnée SWARFARM (celle de l’empreinte ;
pour Blade Surge, deux coups mono-cible) et ne servent plus au calcul de ce
sort.

## Vérification

`tests/degats-valeurs-api.test.ts` (`node tests/run.mjs sequencesapi`) :
les quatre séquences à valeur de l’API sur leurs six formes — profil,
séquence, totaux des deux crans écrits à la main, 224 et 411 par groupe,
refus quand la fiche ne porte plus l’empreinte (dont le premier groupe de
Head Press et de Sagar, qu’une garde sur le premier groupe aurait exigé).

`tests/degats-blade-surge.test.ts` (`node tests/run.mjs bladesurge`) :
balayage du corpus (les 8 identifiants et 11 formes de Blade Surge, les
quatre séquences à valeur de l’API, aucun autre porteur),
refus d’une curation périmée, montant des deux crans écrit à la main sur les
onze formes, apport exact de 224, 400 et 411 dans chaque cran, PV propres à
chaque cran pour 222/223 comparés au chemin ordinaire d’un sort d’un seul
groupe, part additionnelle par coup, classement et clonage du réglage.

`tests/blade-surge-propagation.test.ts` (même filtre) :
`testBladeSurgeRecette` — valeur absente, les deux crans acceptés sur les
huit identifiants, refus avec chemin (champ mal typé, clé invalide, valeur
hors de l’union, sort sans coup de zone curé), aller-retour export/import,
resets au changement d’espèce et à l’import de compte ;
`testBladeSurgeEcran` — libellés des crans, garde de capacité en tête du
contrôle, place sous la liste, écriture de la seule clé du sort, résumé qui
ne lit pas le cran, aide ; `testBladeSurgePariteEcranCli` — même score à
l’écran et au CLI pour les deux crans et la clé absente, rapport des deux
crans `(0,5 × 2 + 3,0) / 3,0`, points de passage du champ et ligne du CLI.
