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

Une seule fonction de `damage.ts` le dit, lue par le calcul, l'écran, le
CLI et le Worker. Trois cas :

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
plus bas.

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

## L'interrupteur « Attaque conjointe »

- Dans « Effets actifs », éteint par défaut, montré **seulement** pour un
  S1 qui n'est pas conjoint par lui-même : un bouton sans effet possible
  n'est jamais montré. Écran :
  [../optimizer/ecran/objectif-de-recherche.md](../optimizer/ecran/objectif-de-recherche.md).
- Allumé, il dit que le S1 est **appelé par un allié, hors du tour du
  monstre** : 209 et 225 comptent, 224 non, 411 oui.
- Recette : `DamageSetup.attaqueConjointe`, absent = éteint. Il se
  réinitialise quand le sort choisi change, comme les autres réglages
  propres au sort (`damageSetupTransition.ts`).
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

<!-- Liste établie par l'inventaire du corpus : à compléter avec le code. -->

## Vérification

<!-- Tests nommés : à compléter avec le code. -->
