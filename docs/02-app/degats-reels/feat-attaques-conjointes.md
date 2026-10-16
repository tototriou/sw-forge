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
sort choisi, ou une contribution qui le suit). Trois cas :

| Cas | Règle | Interrupteur |
| --- | --- | --- |
| Sort coopératif du monstre | compétence active à formule portant l'effet SWARFARM `Ally Attack`, plus une table d'inclusion par identifiant (sorts coopératifs sans cet effet) et une table d'exclusion | aucun : toujours conjoint |
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

⚠️ **« À formule » désigne la formule de la donnée SWARFARM**, pas celle
que retient le calcul : un sort sans formule dans sa fiche n'est pas
conjoint par la règle, même quand le calcul lui en donne une par curation
(voir plus bas, « Restent non conjoints »).

- **Un sort coopératif l'est toujours**, quel que soit le chemin : choisi,
  ou appelé après un autre sort.
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

- Dans « Effets actifs », éteint par défaut, montré **seulement** pour un
  S1 qui n'est pas conjoint par lui-même : un bouton sans effet possible
  n'est jamais montré. Écran :
  [../optimizer/ecran/objectif-de-recherche.md](../optimizer/ecran/objectif-de-recherche.md).
- Allumé, il dit que le S1 est **appelé par un allié, hors du tour du
  monstre** : 209 et 225 comptent, 224 non, 411 oui.
- Recette : `DamageSetup.attaqueConjointe`, absent = éteint. Réglage propre
  au sort (`damageSetupTransition.ts`) : il s'éteint quand le **monstre**
  change ; quand seul le sort change, il est conservé, sans effet hors d'un
  S1 qui n'est pas conjoint par lui-même (comme `defBreakParLeSort`).
- ⚠️ Il n'agit sur aucun autre interrupteur : un passif « after you attack
  … on your turn » (Tempest) reste au choix de l'utilisateur.

## Le S1 appelé par un sort coopératif

Attack Command de Lisa et le S3 de Moria (2e éveil) n'ont pas de ratio :
leur prose dit qu'ils appellent le S1 du monstre. Ce déclencheur est
choisissable dans « Compétence utilisée », et son total est celui du S1
appelé, compté comme attaque conjointe **pendant le tour du monstre** :
224 suit la portée du S1, 411 s'applique (le déclencheur ne frappe pas),
et le S1 reçoit la ligne de SON slot. Le mécanisme est celui des attaques
appelées ([feat-attaque-apres-un-sort.md](feat-attaque-apres-un-sort.md)),
sans interrupteur : l'appel est certain.

## Les sorts par identifiant

Établie sur tout le corpus (`public/data/skills`) : 47 compétences portent
l'effet `Ally Attack` — 39 actives à formule, 6 actives sans formule, 2
passifs. Un identifiant de compétence est partagé par toutes les fiches qui
le portent (forme de base et forme éveillée, version collab).

### Conjoints par l'effet `Ally Attack` (39)

| Famille | Sort | Identifiants |
| --- | --- | --- |
| Tarq | Group Hunt (S3) | `1511`, `1561`, `1576` |
| Inugami, Icaru, Raoq, Kro, Inugami 2A | Team Up (S2) | `2006`, `2007`, `2010`, `2056`, `2057`, `2060`, `2071`, `2072`, `2075` |
| Moria (avant le 2e éveil) | Concentrated Attack (S3) | `3113` |
| Seren (2e éveil) | Violent Friends (S3) | `3465` |
| Battle Mammoth, Granite | Enter Battlefield (S3) | `9812` |
| Chakram Dancer et formes éveillées | Crescent Moon Slash (S1) | `12601` à `12605` |
| Chakram Dancer et formes éveillées | Chakram Crush (S2), Deadly Dance, Massacre Dance (S3) | `12607`, `12609`, `12611`, `12613` |
| Boomerang Warrior et formes éveillées | Returning Boomerang (S1) | `12701` à `12705` |
| Boomerang Warrior et formes éveillées | Triple Strike, Boomerang Crush (S2), Lightning Flash (S3) | `12706`, `12707`, `12710`, `12714` |
| Aragorn | Band of Blades (S2) | `23806`, `23808`, `23810` |
| Night Fang | Bond of the Pack (S2) | `24306`, `24308`, `24310` |

⚠️ **Les dix S1 de Chakram Dancer et de Boomerang Warrior sont toujours
conjoints**, alors que leur prose place l'attaque commune pendant le tour
de l'autre famille : un sort coopératif lancé par le monstre compte
toujours (décision de l'utilisateur, [valeurs curées](valeurs-de-jeu-curees.md)).
L'interrupteur « Attaque conjointe » ne leur est donc pas proposé.

### Table d'inclusion — conjoints sans l'effet dans la donnée (5)

| Identifiant | Sort | Monstre |
| --- | --- | --- |
| `10910` | Cutting Magic (S2) | Sylvia, Neostone Agent ténèbres |
| `12608` | Double Strike (S2) | Melissa, Chakram Dancer vent |
| `12615` | Moonlight Blow (S3) | Belita, Chakram Dancer ténèbres |
| `12712` | Flame Drive (S3) | Maruna, Boomerang Warrior feu |
| `12713` | Vacuum Boomerang (S3) | Zenobia, Boomerang Warrior vent |

Un identifiant, jamais un nom : Cutting Magic de Lisa et de Neostone Agent
feu (`10907`, même nom, même ratio) n'est pas inclus.

### Table d'exclusion (2)

`10915` Best Partner (Passive), Sylvia (« A randomly selected ally also
attacks ») et `12711` Female Warrior (Passive), Sabrina (l'effet partagé
avec Chakram Dancer). Passifs sans formule, que la règle écarte déjà ; la
table les garde si une donnée régénérée leur prêtait une formule.

### Restent non conjoints

- **Sans formule** : Assailing Horn (`17515`, Eivor ténèbres) et Flag of
  Ambush (`18015`, Sigrid), où le monstre ne frappe pas, sont exclus ;
  Attack Command (`10912`, Lisa) et Concentrated Attack (`3163`, Moria 2e
  éveil) appellent le S1, et c'est ce S1 qui est conjoint (troisième cas).
- **Purification, Cooperation!** (`21415`, Nezuko Kamado ténèbres) et
  **Rite of Ashes** (`22015`, Vermilion Bird Dancer) : effet `Ally Attack`
  sans formule de donnée. Le calcul les connaît par une formule curée
  (`4.5*{ATK}`, l'attaque du monstre seule), mais leur prose ne dit ni
  qu'ils appellent le S1, ni combien de fois : ils restent non conjoints,
  total inchangé.
- **Violent Friends sans l'effet** (`3415`, Harpu et Seren avant le 2e
  éveil ; `3480`, Seren 1★) : la prose ne dit pas que les coups sont ceux
  du monstre.
- **Mind Break** (`20020152`, Lyrith) : les « incarnations » qui frappent
  avec elle sont ses invocations, pas des alliés. S1 ordinaire,
  l'interrupteur reste son seul chemin.

## Vérification

[tests/degats-attaques-conjointes.test.ts](../../../tests/degats-attaques-conjointes.test.ts),
inscrit à `tests/index.ts` (`node tests/run.mjs attaquesconjointes`). Les
libellés qui figent une décision de l'utilisateur le disent.

- `testAttaquesConjointesRegle` — sur le corpus entier : la règle prend
  exactement les 44 sorts des deux premières tables ; chaque entrée de la
  table d'inclusion est nécessaire (la donnée ne porte pas l'effet), chaque
  exclusion tient même face à une donnée qui prêterait une formule au passif ;
  les cas non conjoints ci-dessus ; le marqueur du profil vaut la règle.
- `testAttaquesConjointesPorte` — les trois contextes et `null` (S1 qui suit
  le sort, S2 interrupteur allumé, passif), ce que chacun retire du profil
  des artéfacts, 209 + 225 sommés et 208 jamais, la classe du réglage.
- `testAttaquesConjointesCalcul` — sur des fiches réelles : sort A
  (`12706`) et A+ (`12713`) majorés de 209 + 225, 208 sans effet ; un sort
  non conjoint (`3415`, le S1 `10905`, `21415`) au total inchangé au bit
  près ; ni bombe ni bucket Additionnel ; 224, 411 et 400 dans les trois
  contextes ; l'interrupteur sans effet sur un S2 et sur un S1 coopératif ;
  Tempest sans 209/225 après un S1 appelé par un allié.
- `testAttaquesConjointesTotalALaMain` — un total écrit à la main :
  `2000 × (1 + 0,12 + 0,10 + 0,08) × 1000/1142 × 1,25`, ligne Feu, 209 et
  225 additionnés dans DMG%, Marque multipliée, 208 exclue.
- `testAttaquesConjointesChoixArtefacts` — le choix des artéfacts
  (`chercherPaires`, paramètres de `parametresArtefactsFiche`, note de
  `evaluerPourRegime`) contre l'énumération exhaustive des paires, sur 40
  inventaires tirés au hasard (graine fixe), dont un sur quatre verrouille
  209 : sort conjoint, S1 appelé par un allié, sort non conjoint. Sur les
  deux premiers, 209/225 changent la paire choisie dans une partie des
  inventaires ; sur le dernier, retirer 208/209/225 ne change ni la paire ni
  le score. La sonde de pertinence compte 209 et 225 sur une attaque
  conjointe seulement, jamais 208.
