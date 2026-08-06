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
- Rappel affiché : « totem +15 % inclus ».

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

- Disposition **multi-lignes** (`flex flex-wrap`), cartes de largeur fixe (~128 px).
- Chaque carte : rang `#i`, **vitesse effective** en gros (couleur `star`), cadre
  hexagonal + image/initiales + badge élément, nom, « base X », et un champ SPD
  runes éditable (placeholder « +runes »).
- **Pas d'icône éclair** (⚡) — retirée partout à la demande de l'utilisateur.

## Attendus

- Le champ SPD runes de l'ordre de tour édite **la même donnée** que les cartes
  de section (`onRuneSpeed` → `setRuneSpeed`) : modifier ici met à jour partout.
- Change de lead ⇒ le tri et les rangs se réordonnent en direct.
- Vide ⇒ « Ajoute des monstres pour visualiser l'ordre de tour. »
