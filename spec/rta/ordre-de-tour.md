# RTA · Ordre de tour & simulation de leads

En bas de la page RTA : **toutes** les cartes de la prépa, triées par vitesse, du
**plus rapide à gauche**, avec des boutons pour simuler différents leads SPD.

Fichier : [TurnOrder.tsx](src/components/rta/TurnOrder.tsx) ·
monté par [RtaPage.tsx](src/pages/RtaPage.tsx) (`allItems` = toutes sections
confondues).

## ⚠️ Vitesse modifiée à la main → détail désynchronisé

Le champ « SPD runes » de l'ordre de tour est **modifiable**, alors que le détail
d'équipement affiché sous la carte reste **celui de l'import**. Dès que les deux
divergent, le panneau montre des runes qui ne produisent plus la vitesse
annoncée.

Un **triangle orange** apparaît donc **sur la carte** et **dans la fiche**, et le
message s'ouvre **AU CLIC** ([DesyncBadge.tsx](src/components/rta/DesyncBadge.tsx)) :

> ⚠️ Une infobulle native ne s'ouvre qu'après un temps d'arrêt, disparaît dès
> qu'on bouge, et **n'existe pas au tactile**. Or le message compte : il dit que
> les runes affichées ne correspondent plus à la vitesse demandée, et renvoie à
> la valeur en rouge de la fiche.

Le panneau passe par **`DetailPopover`** (placement automatique) : les cartes
vont jusqu'au bord droit de la page, et un panneau ancré en dur **sortait de
l'écran**.

Dans la fiche, la **ligne VIT** porte une **flèche rouge suivie de la vitesse
demandée** (`spdCible` de [MonsterGear.tsx](src/components/MonsterGear.tsx)), à
côté du `+X` réellement apporté par les runes. Signaler l'écart **sans donner la
cible** obligerait à faire le calcul soi-même.

Le **nom et la vitesse** du monstre passent aussi **en orange** sur sa carte de
classement — bouton **« Modifiés »** ([categories.md](categories.md)) pour couper
ce signalement.

**Une seule source de vitesse.** Le champ de l'ordre de tour écrit dans
`rta.state.entries`, exactement là où les cartes de classement lisent : modifier
une vitesse en bas met donc **immédiatement** à jour la carte correspondante.
Rien à synchroniser, rien à dupliquer.

> Rappel : la carte affiche `base + runes`, l'ordre de tour y ajoute le **totem**
> (et le lead simulé). Les deux nombres diffèrent donc volontairement.

- Détection par **recalcul**, pas par un drapeau « modifié » stocké
  ([gearSync.ts](src/lib/gearSync.ts)) : on compare la saisie à la vitesse que
  donneraient les runes. L'avertissement reste donc juste après un rechargement
  ou un réimport, et **s'efface tout seul** si le joueur remet la valeur d'origine.
- La vitesse déduite des runes **inclut le bonus de set** (Swift), comme le champ
  lui-même — voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md).

## Objectif

Vérifier si l'ordre de passage change selon le lead de vitesse appliqué en jeu.

## Boutons de lead

- Un bouton par lead possible : **+33 %, +30 %, +28 %, +24 %, +23 %, +19 %**
  (classiques + arène), **du plus gros au plus petit**, + bouton **« Sans lead »**.
- Le lead choisi est **appliqué à tous** les monstres (simulation), toggle
  (re-cliquer désactive).
- **Interrupteur « Surligner les changements »** : quand il est actif ET qu'un
  lead est sélectionné, les monstres dont la **position change** par rapport à
  l'ordre sans lead sont mis en **surbrillance** (bordure/halo dorés). Comparaison
  via un `baselineRank` (ordre à lead 0).

## Calcul (identique au modèle partagé)

Voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md).

```
vitesse_effective = (base + runes) + ceil( base × (15 + lead) / 100 )
```

- Le bonus % (**totem 15 % + lead**) porte **uniquement sur la base**, arrondi
  **au supérieur**.
- « Sans lead » = lead 0 → le totem +15 % reste appliqué.
- Constantes locales au composant : `LEADS = [33,30,28,24,23,19]`, `TOTEM = 15`
  (cohérentes avec `speed.ts`).

## Tri

- Trié par **vitesse effective décroissante** (le plus rapide à gauche),
  départage par nom. Les monstres sans vitesse finissent en dernier.
- Le rang `#1, #2, …` se recalcule à chaque changement de lead.

## Rendu des cartes

- Disposition **multi-lignes** (`flex flex-wrap`), cartes **horizontales** (~168 px),
  style uniforme avec le siège.
- Chaque carte : **badge de rang superposé** en haut à gauche, portrait hexagonal
  + badge élément, nom, puis **icône vitesse + vitesse effective (blanc)** et les
  **icônes de sets de runes** (4 pièces en premier). Champ SPD runes éditable **en
  bas** (placeholder « + runes »).
- Pas d'icône éclair ; « base X » retiré pour épurer.

## Attendus

- Le champ SPD runes de l'ordre de tour édite **la même donnée** que les cartes
  de section (`onRuneSpeed` → `setRuneSpeed`) : modifier ici met à jour partout.
- Change de lead ⇒ le tri et les rangs se réordonnent en direct.
- Vide ⇒ « Ajoute des monstres pour visualiser l'ordre de tour. »
