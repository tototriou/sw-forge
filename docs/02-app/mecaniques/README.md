# Mécaniques (`#/mecaniques`)

Page de **documentation des mécaniques de jeu** Summoners War (référence
utilisateur, façon `swcalc.cz`). Pas d'état, pas de données chargées : contenu
statique + sommaire cliquable.

Fichier : [MechanicsPage.tsx](src/pages/MechanicsPage.tsx)

## Contenu

Le contenu se limite **strictement à ce que couvre swcalc.cz/game-mechanics**
(pas d'ajout). Sommaire (ancres, scroll interne via `goTo(id)` — **pas** de
changement de hash pour ne pas casser le routing) puis sections en panneaux :

1. **Vitesse de combat** — `⌈ base × (1 + Σ%vit) + Σvit_plate ⌉ × Slow × BuffVit`, avec
   correction de troncature pour les runes Swift (perte à l'arrondi de `base × 0,25`).
2. **Barre d'action & ordre de tour** — `ΔATB/tick = vitesse × 7/100` (7 % par tick) ; action à 100.
3. **Équation finale des dégâts** — `(Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel) × Réductions`.
   Buffs ATQ/DEF (comme VIT) tronqués vers le bas selon le bonus d'effet ; les dégâts fixes
   (`Additionnel`) ignorent crit **et** FacteurDéf.
4. **Facteur de défense** — `1000 / (1142 + 3.572 × DEF)`, **aligné sur swcalc.cz** : la source
   de référence donne les vraies constantes, là où le wiki fandom les arrondit (`1140 + 3.5`,
   ~0,3 % d'écart à 3 000 de DEF). Def break ×0.3, ignore def (plancher ≈ 0,876).
5. **Coups critiques** — taux vs dégâts crit ; glancing ne crit pas ; certaines lignes d'artefact
   ont une portée limitée (par compétence, cible primaire seule, etc.).
6. **Variance** — ±2.8 % (stats), ±2.35 % (PV max), tirage triangulaire.
7. **Cas particuliers** — mécaniques de monstres liées à la vitesse/défense (non modélisées dans l'outil).

> Volontairement **exclus** (non présents sur swcalc/game-mechanics) : efficacité
> des runes, sets de runes, précision/résistance, avantage élémentaire.

⚠️ **Deux écarts connus entre la page et cette fiche, à corriger** :

- la page affiche encore `1000 / (1140 + 3.5 × DEF)`, les valeurs arrondies
  du wiki, alors que le point 4 ci-dessus retient `1142 + 3.572` (swcalc.cz) ;
- le point 2 et la page disent « 7 % par tick » sans réserve : c'est vrai
  partout **sauf en raid (4,5 %) et en RTA (1,5 %)** — voir
  [speed-tuning/feat-formule.md](../speed-tuning/feat-formule.md) § Mode RTA.

## Règles / attendus

- **Formules = modèle communautaire** (prédictif), annoncé dans l'intro (pas de
  crédit de source affiché).
- Cohérent avec les calculs réels de l'app : vitesse/ticks (voir
  [siege/](../siege/)), efficacité & sets (voir
  [transverse/](../transverse/)).
- Composants internes : `Section`, `F` (bloc formule mono défilable), `K` (terme
  inline). Titres sans en-tête d'action ; la page a le grand titre des pages
  de lecture.
- Ancres de sommaire via `scrollIntoView` (pas de `href="#..."` qui modifierait le
  hash de routing).
- ⚠️ **À la souris, deux colonnes** :
  le sommaire **fixe** à gauche (220 px, `sticky`), sans cadre ni numéros,
  chaque entrée surlignée au survol ; l'article à droite, borné à 720 px, ses
  sections séparées par un filet. L'ordre du DOM est le même (titre, sommaire,
  sections) : seule la grille les place. **Au doigt**, une colonne : le
  sommaire en tête, dans sa carte, puis les sections séparées par un filet,
  comme à la souris.
