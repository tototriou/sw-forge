# Dégâts réels — séquences de coups et cible secondaire

**Statut :** ÉTAT ACTUEL — décrit les sorts dont les coups n’ont pas tous la même formule ni la même portée (Blade Surge)
**Lire si :** on modifie une séquence de coups curée, le choix de la cible calculée (`cibleDegatsParSort`) ou l’application coup par coup des lignes 224, 400–403/410 et 411
**Ne pas lire si :** on travaille sur un sort dont tous les coups se ressemblent, ou sur les passifs offensifs
**Voir aussi :** spec/outils/degats-reels/artefacts-critique-et-element.md, spec/outils/degats-reels/formules-et-combat.md

## Une portée par sort, pas par coup

`SkillDamageProfile.aoe` est un booléen **du sort**, et `formule`/`coups` ne
décrivent qu’un seul groupe de coups. La donnée SWARFARM de Blade Surge porte
`0.5*{ATK}`, `coups: 2`, `aoe: false` ; sa prose ajoute un troisième coup sur
tous les ennemis (« attacks all enemies with even more powerful attack on the
3rd attack »), **absent de l’API**. Avant le lot 8a du chantier
degats-et-aura (constat 151 de l’audit), le calcul ne comptait donc que deux
coups mono-cible, et la ligne 224 s’appliquait au sort entier.

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

Valeurs curées du cadrage `spec/chantiers/degats-et-aura.md` (A.2 ter),
fournies par l’utilisateur le 2026-09-23 : séquence, portée de la famille,
skillups (`skillupDamagePct`, +30 %, sur les **trois** coups) et cible du
troisième coup (la cible visée le reçoit aussi).

⚠️ **Le premier groupe recopie la donnée.** Si SWARFARM ne la porte plus
telle quelle (formule, nombre de coups ou portée), `skillDamageProfile`
refuse le sort avec sa raison plutôt que de calculer une séquence périmée.

**Couverture, en trois unités (lot 1b, validé le 2026-09-23) :**

- **8 identifiants** : `10601`, `10602`, `10603`, `10604`, `10605`, `10616`,
  `10618`, `10620` ;
- **11 formes du corpus** : Magic Knight eau `19801`, feu `19802`, vent
  `19803`, lumière `19804`, ténèbres `19805` ; Lapis `19811`, Astar `19812`,
  Lupinus `19813`, Iris `19814`, Lanett `19815` ; Imperfect Magic Knight vent
  `19823`. Les Magic Knights non éveillés ne sont pas sélectionnables dans
  l’Optimizer : `10601` et `10605`, portés par eux seuls, ne sont couverts que
  par la table et le test ;
- **5 lignes d’audit** (constat 151), une par identifiant amorce : `10602`,
  `10604`, `10616`, `10618`, `10620`.

Les cinq candidats écartés au lot 1b (`11015`, `18314`, `23507`, `23508`,
`23510`) restent hors table, comme les voisins de catégorie (constats 163,
173, 180), d’une autre mécanique.

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
- **Recette** (degats-et-aura 8b) : le champ voyage dans
  `OptimizerRecipe.damageSetup`. Absent, la recette reste valide (cible
  visée, comme toute recette antérieure). Présent, `parseOptimizerRecipe`
  exige un objet dont chaque clé est l’identifiant entier positif d’un sort à
  coup de zone curé — la même table de capacité que l’écran,
  `cibleSecondairePriseEnCharge` — et chaque valeur `'visee'` ou
  `'secondaire'`. Tout écart est refusé avec son chemin
  (`damageSetup.cibleDegatsParSort.<identifiant>`), jamais corrigé ni ignoré
  en silence. L’import restaure la valeur telle quelle, sans reset ultérieur ;
  l’aller-retour export → import ne perd ni n’ajoute rien.
- **Écran** (degats-et-aura 8b, réponse n° 8 de l’utilisateur) : sous la
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

224 et 400 : confirmation explicite de l’utilisateur du 2026-10-02. 411 :
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

`hits` et `aoe` du profil gardent la donnée SWARFARM (deux coups mono-cible)
et ne servent plus au calcul de ce sort.

## Vérification

`tests/degats-blade-surge.test.ts` (`node tests/run.mjs bladesurge`) :
balayage du corpus (les 8 identifiants et 11 formes, aucun autre porteur),
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
ne lit pas le cran, aide.
