# Dégâts réels — attaques conjointes

Ce document décrit quand un sort compte comme **attaque conjointe**, ce que
cela change au calcul (lignes d'artéfact 209 et 225, 224, 411), et le cas
d'un sort coopératif qui appelle le S1 du monstre. Code :
[damage.ts](../../../src/lib/damage.ts).

Voir aussi : [feat-artefacts-critique-et-element.md](feat-artefacts-critique-et-element.md),
[feat-attaque-apres-un-sort.md](feat-attaque-apres-un-sort.md),
[valeurs-de-jeu-curees.md](valeurs-de-jeu-curees.md).

## Ce qui compte, et ce qui ne compte pas

- **Seuls les dégâts du monstre optimisé comptent**, jamais ceux des
  alliés qui participent à l'attaque.
- **La contre-attaque n'est pas modélisée** : la ligne 208 (« Dgts de
  contre-attaque ») vaut toujours 0, et la ligne 225 ne compte que pour sa
  part d'attaque conjointe.

## Quand un sort est une attaque conjointe

Une seule fonction de `damage.ts` le dit : `contexteAttaqueConjointe(profil,
réglage, chemin)`, lue par le calcul, l'écran, le CLI et le Worker. Elle
rend `null` (pas une attaque conjointe) ou l'un des trois contextes
ci-dessous (`propre`, `appelee-par-allie`, `appelee-par-sort`), à partir du
profil du sort qui frappe, de l'interrupteur et du chemin qui l'appelle (le
sort choisi, ou une contribution qui le suit). Quatre cas :

| Cas | Règle | Interrupteur |
| --- | --- | --- |
| Sort coopératif du monstre | compétence active à formule portant l'effet SWARFARM `Ally Attack`, plus une table d'inclusion par identifiant (sorts coopératifs sans cet effet) et une table d'exclusion ; hors des deux familles ci-dessous | aucun : toujours conjoint |
| Attaque des familles Chakram Dancer et Boomerang Warrior | une table par identifiant : tous leurs sorts actifs à formule ; conjoints si un monstre de l'autre famille est au combat | « Attaque conjointe », **allumé par défaut** |
| S1 appelé par un allié | un S1 qui n'est pas conjoint par lui-même, interrupteur « Attaque conjointe » allumé | « Attaque conjointe », éteint par défaut |
| S1 appelé par un sort coopératif sans dégâts propres | le déclencheur figure dans `ATTAQUES_APPELEES_PAR_DECLENCHEUR` | aucun |

⚠️ **L'effet `Ally Attack` est le discriminant, les tables sont ses
exceptions** (règle générale et exceptions curées, jamais une liste
blanche) : un sort coopératif nouveau à effet `Ally Attack` est reconnu
sans curation. La table d'inclusion rattrape les sorts coopératifs dont la
donnée ne porte pas l'effet ; la table d'exclusion, ceux où l'effet ne
désigne pas une attaque du monstre lui-même. La liste par identifiant est
plus bas. La règle s'écrit `estSortCooperatif`, et son résultat voyage dans
le profil du sort (`SkillDamageProfile.sortCooperatif`) ; le troisième cas
est marqué sur le profil du S1 appelé (`appeleParSortCooperatif`), par le
chemin des attaques appelées.

⚠️ **Les familles Chakram Dancer et Boomerang Warrior sortent de cette
règle** (décision de l'utilisateur) : leur prose fait dépendre l'attaque
commune de la présence d'un monstre de l'autre famille, que le réglage ne
connaît pas (on ne regarde pas l'équipe). Toutes leurs attaques, avec ou
sans l'effet `Ally Attack`, proposent donc l'interrupteur « Attaque
conjointe », **allumé quand le champ est absent** ; l'utilisateur l'éteint
s'il joue le monstre sans l'autre famille. La table est fermée, par
identifiant (`estSortDesFamillesCooperatives`, marqueur de profil
`sortDesFamillesCooperatives`) : la compétence ne porte pas la famille de
son monstre, et l'effet `Ally Attack` manque sur quatre de leurs attaques.
Un sort nouveau de ces familles n'y entre que par curation.

- Allumé (ou absent) : contexte `propre`, l'attaque a lieu pendant le tour
  du monstre (224 selon la portée, 411).
- **S1 des deux familles** (`12601` à `12605`, `12701` à `12705`) : leur
  prose place l'attaque commune pendant le tour du monstre de l'autre
  famille (« during Boomerang Warrior's turn »). Une seconde vignette,
  « Pendant le tour d'un allié » (`DamageSetup.pendantTourAllie`, éteinte
  par défaut), le dit : allumée avec l'interrupteur, le S1 passe en contexte
  `appelee-par-allie`, hors du tour du monstre (209 et 225 comptent, **224
  non**, 411 oui) ; éteinte, il reste `propre` (décision de l'utilisateur).
  Leurs S2 et S3 n'ont pas de seconde vignette : pendant le tour du monstre.
- Éteint (`false`) : non conjoint, un sort ordinaire (209 et 225 à 0, 224
  selon la portée) ; la seconde vignette, même restée allumée, est alors
  sans effet.

⚠️ **« À formule » désigne la formule que retient le calcul** : celle des
formules curées par identifiant (`FORMULES_CUREES_PAR_ID`), sinon celle de
la fiche (décision de l'utilisateur). Un sort à effet `Ally Attack` sans
formule dans sa fiche, mais doté d'un ratio curé, est donc conjoint :
Purification, Cooperation! et Rite of Ashes (plus bas, « Conjoints par
leur formule curée »).

- **Un sort coopératif l'est toujours**, quel que soit le chemin : choisi,
  ou appelé après un autre sort ; une attaque des deux familles, allumée,
  aussi.
- **Le S1 appelé par un allié** ne vaut que pour le S1 **choisi** : un S1
  qui suit le sort choisi (attaque appelée) ne l'est pas, interrupteur
  allumé ou non.
- **Un passif n'est jamais une attaque conjointe** : Tempest, qui suit un S1
  appelé par un allié, ne reçoit ni 209 ni 225.

⚠️ **Un sort coopératif sans ratio dans ses données est utilitaire** : il
ne se calcule pas, sauf si sa prose dit qu'il appelle le S1 du monstre
(troisième cas). Assailing Horn (`17515`, Eivor ténèbres) et Flag of
Ambush (`18015`, Sigrid) en sont exclus : le monstre n'y inflige aucun
dégât.

## Ce que change une attaque conjointe

| Ligne | Libellé du jeu | Sort coopératif du monstre | S1 appelé par un allié | S1 appelé par un sort coopératif |
| --- | --- | --- | --- | --- |
| 209 | « Dgts d'attaque conjointe » | oui | oui | oui |
| 225 | « Dgts de contre-attaque/attaque conjointe » | oui | oui | oui |
| 208 | « Dgts de contre-attaque » | jamais | jamais | jamais |
| 224 | « D.CRIT+ comp cib uniq pdt tour » | selon la portée | **jamais** : hors du tour du monstre | selon la portée du S1 |
| 411 | « Dgts CRIT 1re attaque » | premier coup | premier coup | premier coup du S1 : le déclencheur ne frappe pas |
| 400-403, 410 | « [Comp.N] Aug. Dgts CRIT » | slot du sort | slot 1 | slot 1 (celui du S1), jamais celui du déclencheur |

Une attaque des deux familles, allumée, suit la colonne « Sort coopératif
du monstre » (contexte `propre`) ; un S1 des deux familles « pendant le tour
d'un allié » suit la colonne « S1 appelé par un allié » ; éteinte, elle
n'est pas une attaque conjointe.

- **209 et 225 entrent dans le terme `DMG%`**, additionnés aux dégâts
  infligés par élément (300-304) : même terme, mêmes exclusions — ni sur
  une bombe, ni sur le bucket Additionnel
  ([feat-artefacts-critique-et-element.md § Jamais sur une bombe, jamais sur le bucket Additionnel](feat-artefacts-critique-et-element.md#️-jamais-sur-une-bombe-jamais-sur-le-bucket-additionnel)).
  Multiplicatifs avec la Marque, comme eux.
- **Un sort non conjoint n'est pas touché** : 209 et 225 y valent 0, et
  son total reste celui d'avant.
- Le profil des artéfacts somme les deux lignes dans un seul champ,
  `ArtifactDamageProfile.degatsAttaqueConjointePct` ; le calcul le remet à
  0 hors d'une attaque conjointe, et retire 224 pour un S1 appelé par un
  allié (`artefactsSelonContexteConjoint`), avant d'évaluer le sort.
- **Le choix des artéfacts suit** : l'Optimizer sonde chaque ligne contre le
  calcul ([optimiseur-artefacts.md § Pré-filtrage exact](../../03-developpeur/optimizer/moteur/optimiseur-artefacts.md#pré-filtrage-exact--pertinence-obligation-dominance)),
  donc 209 et 225 comptent dans la pertinence et la dominance sur une
  attaque conjointe, et nulle part ailleurs. Un verrou sur l'une d'elles
  porte sur la paire (plafond doublé : les deux sortes la portent).

## L'interrupteur « Attaque conjointe »

Deux sens, selon le sort choisi :

| Sort choisi | Allumé, il dit que… | Champ absent |
| --- | --- | --- |
| S1 qui n'est pas conjoint par lui-même | le S1 est **appelé par un allié, hors du tour du monstre** : 209 et 225 comptent, 224 non, 411 oui | éteint |
| attaque des familles Chakram Dancer et Boomerang Warrior | **un monstre de l'autre famille est au combat** : contexte `propre` (S1 : `appelee-par-allie` avec la seconde vignette, plus bas) | **allumé** |

- **Proposé seulement quand il agit** : un bouton sans effet possible
  n'est jamais montré. La fonction pure
  `interrupteurAttaqueConjointe(profil, réglage)` le dit, dérivée de la
  porte (proposé quand l'allumer et l'éteindre donnent deux contextes
  différents) : `null`, ou son motif (`cas` : `familles-cooperatives`,
  `appele-par-un-allie`), son état (`allume`, défaut compris) et son
  défaut (`allumeParDefaut`). Le CLI la lit, jamais le champ directement.
- **Écran** : la vignette, dans « Effets actifs », est montrée quand
  `interrupteurAttaqueConjointe` propose l'interrupteur : sur toutes les
  attaques des deux familles (allumée par défaut) et sur un S1 qui n'est
  pas conjoint par lui-même (éteinte par défaut). Le clic écrit
  `attaqueConjointe: !allume`. Ses descriptions parlent en mots du jeu,
  sans numéro d'artéfact
  ([../optimizer/ecran/objectif-de-recherche.md](../optimizer/ecran/objectif-de-recherche.md)).
- **CLI** : la ligne du sort dit « attaque conjointe (appelée par un
  allié) » ou « attaque conjointe (un monstre de l'autre famille au
  combat) » quand l'interrupteur est proposé et allumé, défaut compris
  (`mentionAttaqueConjointe`).
- Recette : `DamageSetup.attaqueConjointe` ; absent = éteint, sauf sur les
  deux familles (allumé) ; seul `false` éteint une attaque des familles.
  Réglage propre au sort (`damageSetupTransition.ts`) : quand le
  **monstre** change, le champ est retiré (éteint sur un S1, allumé sur
  les deux familles) ; quand seul le sort change, il est conservé, sans
  effet sur un sort qui ne le propose pas (comme `defBreakParLeSort`).
- ⚠️ Il n'agit sur aucun autre interrupteur : un passif « after you attack
  … on your turn » (Tempest) reste au choix de l'utilisateur.

### La seconde vignette « Pendant le tour d'un allié »

Sur les S1 des deux familles seulement (décision de l'utilisateur) :

- **Proposée seulement quand elle agit**, par la fonction pure
  `vignettePendantTourAllie(profil, réglage)`, dérivée de la porte comme
  l'interrupteur (proposée quand, le reste du réglage tenu, l'allumer et
  l'éteindre donnent deux contextes différents) : `null`, ou son état
  (`allume`) et son défaut (`allumeParDefaut`, éteint). Elle l'est donc sur
  un S1 des deux familles dont « Attaque conjointe » est allumée, défaut
  compris ; jamais sur leurs S2/S3, ni sur un S1 ordinaire, ni quand
  l'interrupteur des familles est éteint.
- **Écran** : juste après « Attaque conjointe », dans « Effets actifs »,
  avec sa propre icône, celle de Crescent Moon Slash, le S1 de Shaina
  (fiche `21912`, compétence `12602` ; choix de l'utilisateur), et son
  libellé sur deux lignes au lieu d'être tronqué. Le clic écrit
  `pendantTourAllie: !allume`. Sa description, en mots du jeu, sans numéro
  d'artéfact : l'attaque conjointe a lieu pendant le tour de l'allié, les
  dégâts critiques sur cible unique pendant ton tour ne comptent pas.
- **CLI** : la ligne du sort dit « attaque conjointe (un monstre de l'autre
  famille au combat, pendant le tour d'un allié) » (`mentionAttaqueConjointe`,
  qui lit `vignettePendantTourAllie`).
- **Recette** : `DamageSetup.pendantTourAllie`, booléen ; absent = éteinte.
  Réglage propre au sort, comme `attaqueConjointe` : retiré quand le
  **monstre** change, conservé quand seul le sort change (sans effet hors
  d'un S1 des familles), conservé aussi quand l'interrupteur des familles
  s'éteint (sans effet, il reprend quand on le rallume).

## Le S1 appelé par un sort coopératif

Attack Command de Lisa et le S3 de Moria (2e éveil) n'ont pas de ratio :
leur prose dit qu'ils appellent le S1 du monstre. Ce déclencheur est
choisissable dans « Compétence utilisée », et son total est celui du S1
appelé, compté comme attaque conjointe **pendant le tour du monstre** :
224 suit la portée du S1, 411 s'applique (le déclencheur ne frappe pas),
et le S1 reçoit la ligne de SON slot. Le mécanisme est celui des attaques
appelées ([feat-attaque-apres-un-sort.md § Sort coopératif sans dégâts propres](feat-attaque-apres-un-sort.md#sort-coopératif-sans-dégâts-propres)),
sans interrupteur : l'appel est certain.

- **Le profil** porte l'identité du déclencheur (identifiant gardé par la
  recette, « S3 », nom, prose) et le calcul du S1 de la même fiche, trouvé
  par le slot ; il est marqué `appeleParSortCooperatif`, que la porte
  range dans le contexte `appelee-par-sort`, et `competenceQuiFrappe`, que
  lisent les lignes 400-403 et 410.
- **Un appel du S1**, jamais le nombre de coups que la donnée du
  déclencheur porte : il compte les alliés, dont les dégâts ne comptent
  pas.
- **Le sort par défaut ne change pas** : le déclencheur n'est jamais le
  défaut, qui reste le S2.
- ⚠️ Les lignes 400 et 411 sont déduites de l'interrupteur et des réponses de
  l'utilisateur sur les attaques appelées, à relire par l'utilisateur
  ([valeurs curées](valeurs-de-jeu-curees.md)). Avec l'autre lecture (la
  ligne du slot du déclencheur), Attack Command recevrait 402 et 410 au
  lieu de 400.

| Déclencheur | Monstres (fiches) | S1 appelé | Ce que dit la prose |
| --- | --- | --- | --- |
| `10912` Attack Command | Lisa (`20112`), Neostone Agent feu (`20102`) | `10902` Preemptive Strike, `1.9*{ATK}`, 2 coups | « attacks the enemy target with 2 other allies » : le S1 n'est pas nommé, son appel (une fois) est la décision de l'utilisateur |
| `3163` Concentrated Attack | Moria 2e éveil (`12033`) ; copie « boss » (`48003`) | `3153` Cross Attack (`3168` sur la copie), `4.5*{ATK}`, 1 coup | « Attacks the enemy with an ally at the same time with [Cross Attack]. You and the ally's attack will always land as a Critical Hit » : le S1 appelé critique **toujours**, quel que soit le réglage |

## Les sorts par identifiant

Établie sur tout le corpus (`public/data/skills`) : 47 compétences portent
l'effet `Ally Attack` — 39 actives à formule, 6 actives sans formule, 2
passifs. Un identifiant de compétence est partagé par toutes les fiches qui
le portent (forme de base et forme éveillée, version collab).

### Conjoints par l'effet `Ally Attack` (21)

Les 39 actives à formule, moins les 18 des deux familles (plus bas).

| Famille | Sort | Identifiants |
| --- | --- | --- |
| Tarq | Group Hunt (S3) | `1511`, `1561`, `1576` |
| Inugami, Icaru, Raoq, Kro, Inugami 2A | Team Up (S2) | `2006`, `2007`, `2010`, `2056`, `2057`, `2060`, `2071`, `2072`, `2075` |
| Moria (avant le 2e éveil) | Concentrated Attack (S3) | `3113` |
| Seren (2e éveil) | Violent Friends (S3) | `3465` |
| Battle Mammoth, Granite | Enter Battlefield (S3) | `9812` |
| Aragorn | Band of Blades (S2) | `23806`, `23808`, `23810` |
| Night Fang | Bond of the Pack (S2) | `24306`, `24308`, `24310` |

Lancés par le monstre lui-même, ils ont lieu pendant son tour : 224 compte
selon leur portée (décision de l'utilisateur). Team Up de Raoq, Violent
Friends de Seren 2e éveil et Concentrated Attack de Moria, mono-cibles, la
reçoivent.

### Attaques des familles Chakram Dancer et Boomerang Warrior (22)

Relevées sur les 21 fiches des deux familles (`skillGroupId` 21900 et
22000 : formes de base, éveillées, et Imperfect Chakram Dancer) : leurs
sorts actifs à formule. Les quatre Spirit Focus (S2, sans formule, sans
attaque) et les quatre passifs n'en sont pas. Aucune fiche hors des deux
familles ne porte ces identifiants. Interrupteur allumé par défaut (plus
haut).

| Famille | Sort | Identifiants | Effet `Ally Attack` |
| --- | --- | --- | --- |
| Chakram Dancer | Crescent Moon Slash (S1) | `12601` à `12605` | oui |
| Chakram Dancer | Chakram Crush (S2) | `12607`, `12609` | oui |
| Chakram Dancer | Double Strike (S2) | `12608` | non |
| Chakram Dancer | Deadly Dance, Massacre Dance (S3) | `12611`, `12613` | oui |
| Chakram Dancer | Moonlight Blow (S3) | `12615` | non |
| Boomerang Warrior | Returning Boomerang (S1) | `12701` à `12705` | oui |
| Boomerang Warrior | Triple Strike, Boomerang Crush (S2) | `12706`, `12707`, `12710` | oui |
| Boomerang Warrior | Flame Drive, Vacuum Boomerang (S3) | `12712`, `12713` | non |
| Boomerang Warrior | Lightning Flash (S3) | `12714` | oui |

### Table d'inclusion — conjoints sans l'effet dans la donnée (1)

| Identifiant | Sort | Monstre |
| --- | --- | --- |
| `10910` | Cutting Magic (S2) | Sylvia, Neostone Agent ténèbres |

Un identifiant, jamais un nom : Cutting Magic de Lisa et de Neostone Agent
feu (`10907`, même nom, même ratio) n'est pas inclus.

### Conjoints par leur formule curée (2)

| Identifiant | Sort | Monstre | Formule retenue |
| --- | --- | --- | --- |
| `21415` | Purification, Cooperation! (S3) | Nezuko Kamado ténèbres | `4.5*{ATK}`, l'attaque du monstre seule |
| `22015` | Rite of Ashes (S3) | Vermilion Bird Dancer ténèbres | `4.5*{ATK}`, l'attaque du monstre seule |

Leur fiche porte l'effet `Ally Attack` sans formule ; le ratio vient des
formules curées, et la règle le lit (décision de l'utilisateur). Contexte
`propre` : 224 selon la portée, 411 sur le premier coup.

### Table d'exclusion (2)

`10915` Best Partner (Passive), Sylvia (« A randomly selected ally also
attacks ») et `12711` Female Warrior (Passive), Sabrina (l'effet partagé
avec Chakram Dancer). Passifs sans formule, que la règle écarte déjà ; la
table les garde si une donnée régénérée leur prêtait une formule.

### Restent non conjoints

- **Sans formule** : Assailing Horn (`17515`, Eivor ténèbres) et Flag of
  Ambush (`18015`, Sigrid), où le monstre ne frappe pas, sont exclus ;
  Attack Command (`10912`, Lisa) et Concentrated Attack (`3163`, Moria 2e
  éveil) appellent le S1, et c'est ce S1 qui est conjoint (troisième cas,
  [Le S1 appelé par un sort coopératif](#le-s1-appelé-par-un-sort-coopératif)).
- **Violent Friends sans l'effet** (`3415`, Harpu et Seren avant le 2e
  éveil ; `3480`, Seren 1★) : pas une attaque conjointe (décision de
  l'utilisateur) ; seul celui de Seren 2e éveil (`3465`) l'est.

## Vérification

[tests/degats-attaques-conjointes.test.ts](../../../tests/degats-attaques-conjointes.test.ts),
inscrit à `tests/index.ts` (`node tests/run.mjs attaquesconjointes`). Les
libellés qui figent une décision de l'utilisateur le disent.

- `testAttaquesConjointesRegle` — sur le corpus entier : la règle prend
  exactement les 24 sorts coopératifs (effet `Ally Attack`, formule curée,
  inclusion) ; la table des deux familles est celle des sorts actifs à
  formule de leurs 21 fiches, et aucun de ses 22 sorts n'est toujours
  conjoint ; chaque entrée de la table d'inclusion est nécessaire (la donnée
  ne porte pas l'effet), les deux sorts à formule curée n'ont pas de
  formule de donnée, chaque exclusion tient même face à une donnée qui
  prêterait une formule au passif ; les cas non conjoints ci-dessus ; les
  deux marqueurs du profil valent leur règle, jamais ensemble ; les sorts de
  slot 1 des deux familles sont les 10 S1 écrits à la main, la seconde
  vignette n'est proposée que sur eux, et `pendantTourAllie` ne change le
  contexte d'aucun autre sort (ni d'eux, interrupteur éteint).
- `testAttaquesConjointesPorte` — les trois contextes et `null` (S1 qui suit
  le sort, S2 interrupteur allumé, passif) ; les deux familles allumées par
  défaut, éteintes par `false`, en contexte `propre` allumées ; un S1 des
  familles dans ses trois états (pendant le tour d'un allié :
  `appelee-par-allie` ; seconde vignette éteinte : `propre` ; interrupteur
  éteint : non conjoint), la seconde vignette sans effet sur leurs S2/S3 et
  sur un S1 ordinaire ; `interrupteurAttaqueConjointe` (proposé, état, défaut,
  motif), `vignettePendantTourAllie` et la mention du CLI ; ce que chaque contexte retire du profil des artéfacts,
  209 + 225 sommés et 208 jamais, la classe du réglage.
- `testAttaquesConjointesCalcul` — sur des fiches réelles : une attaque des
  familles, champ absent, avec (`12706`) et sans (`12713`) l'effet, majorée
  de 209 + 225, 208 sans effet ; éteinte (`12706`, `12713`, `12701`), au
  total d'un sort ordinaire au bit près, 224 selon la portée, 411 ; Nezuko
  (`21415`) et Vermilion (`22015`) majorés, 224 et 411 en contexte
  `propre` ; un sort non conjoint (`3415`, le S1 `10905`) au total inchangé
  au bit près ; ni bombe ni bucket Additionnel ; 224, 411 et 400 dans les trois
  contextes ; l'interrupteur sans effet sur un S2, le S1 d'une famille
  allumé ou au défaut au même total ; Returning Boomerang (`12701`) pendant
  le tour d'un allié : 209 + 225 et 411 comptent, 224 non, et le total est
  celui sans 224 ; la seconde vignette sans effet au bit près sur ce S1
  éteint, sur Triple Strike (`12706`) et sur un S1 ordinaire (`10905`) ;
  Tempest sans 209/225 après un S1 appelé par un allié.
- `testAttaquesConjointesSortLanceParLeMonstre` — Team Up de Raoq (`2007`,
  `2057`) et Violent Friends de Seren 2e éveil (`3465`) : contexte `propre`,
  224 et 411 comptent, 209 + 225 majorent, aucun interrupteur proposé ;
  Concentrated Attack de Moria 2e éveil (`3163`) : contexte du S1 appelé,
  pendant le tour du monstre, 224 compte.
- `testAttaquesConjointesTotalALaMain` — un total écrit à la main :
  `2000 × (1 + 0,12 + 0,10 + 0,08) × 1000/1142 × 1,25`, ligne Feu, 209 et
  225 additionnés dans DMG%, Marque multipliée, 208 exclue.
- `testAttaquesConjointesChoixArtefacts` — le choix des artéfacts
  (`chercherPaires`, paramètres de `parametresArtefactsFiche`, note de
  `evaluerPourRegime`) contre l'énumération exhaustive des paires, sur 40
  inventaires tirés au hasard (graine fixe), dont un sur quatre verrouille
  209 : sort conjoint, S1 appelé par un allié, sort non conjoint (Sylvia),
  S1 appelé par un sort coopératif (Attack Command, Lisa), attaque d'une
  famille au défaut et éteinte (Triple Strike, Sabrina), S1 d'une famille
  pendant ton tour, pendant le tour d'un allié et éteint (Returning
  Boomerang, Sabrina ; la sonde y écarte 224 hors du tour du monstre
  seulement). Sur les
  conjoints, 209/225 changent la paire choisie dans une partie des
  inventaires ; sur le non conjoint, retirer 208/209/225 ne change ni la
  paire ni le score. La sonde de pertinence compte 209 et 225 sur une
  attaque conjointe seulement, jamais 208 ; sur Attack Command, elle compte
  224 et 400, jamais 402 ni 410.

Le S1 appelé par un sort coopératif a ses propres vérifications, avec les
attaques appelées : `testAttaqueAppeleeParSortCooperatif`
([tests/degats-attaque-appelee.test.ts](../../../tests/degats-attaque-appelee.test.ts),
`node tests/run.mjs attaqueappelee`) — les quatre fiches du corpus,
totaux de Lisa et de Moria écrits à la main (224, 400, 402, 410, 411,
critique garanti), sort par défaut inchangé, gardes, aller-retour de
recette.

L'interrupteur hors du calcul :
[tests/attaques-conjointes-recette.test.ts](../../../tests/attaques-conjointes-recette.test.ts)
(`node tests/run.mjs attaquesconjointesrecette`) — validation de la
recette, transitions de monstre et de sort, ligne du CLI ; pour une
attaque des familles (Triple Strike, Sabrina), l'aller-retour avec et sans
le champ (sans : allumé par la porte, aucune clé ajoutée) et le contexte du
CLI ; pour le S1 d'une famille (Returning Boomerang), `pendantTourAllie` :
aller-retour, absent = éteinte, valeur non booléenne refusée, éteinte au
changement de monstre, contexte et ligne du CLI ;
[tests/rendu/attaque-conjointe-ecran.test.tsx](../../../tests/rendu/attaque-conjointe-ecran.test.tsx)
(`node tests/run.mjs attaque-conjointe-ecran`) — la vignette dans
« Effets actifs », présente (éteinte) sur un S1 ordinaire, présente et
allumée par défaut sur une attaque des familles, absente d'un S2 ordinaire
et d'un sort coopératif hors familles, sans numéro d'artéfact dans sa
description, avec l'icône de Team Up ; la seconde vignette « Pendant le
tour d'un allié » juste après elle sur Returning Boomerang (éteinte par
défaut, allumée par le champ), avec l'icône de Crescent Moon Slash, sans
numéro dans sa description, absente quand l'interrupteur est éteint, sur
Triple Strike et sur un S1 ordinaire ; le ratio 4,5 × ATQ de Nezuko et de
Vermilion Bird Dancer dans la ligne du sort ; aux deux formats.
