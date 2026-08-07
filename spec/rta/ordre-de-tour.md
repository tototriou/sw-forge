# RTA · Ordre de tour & simulation de leads

En bas de la page RTA : **toutes** les cartes de la prépa, triées par vitesse, du
**plus rapide à gauche**, avec des boutons pour simuler différents leads SPD.

Fichier : [TurnOrder.tsx](src/components/rta/TurnOrder.tsx) ·
monté par [RtaPage.tsx](src/pages/RtaPage.tsx) (`allItems` = toutes sections
confondues).

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
