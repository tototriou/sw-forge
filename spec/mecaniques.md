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
4. **Facteur de défense** — `1000 / (1140 + 3.5 × DEF)` (aligné wiki fandom — swcalc.cz affiche
   `1142 + 3.572 × DEF`, écart jugé négligeable, formule actuelle conservée), def break ×0.3,
   ignore def (plancher ≈ 0,877).
5. **Coups critiques** — taux vs dégâts crit ; glancing ne crit pas ; certaines lignes d'artefact
   ont une portée limitée (par compétence, cible primaire seule, etc.).
6. **Variance** — ±2.8 % (stats), ±2.35 % (PV max), tirage triangulaire.
7. **Cas particuliers** — mécaniques de monstres liées à la vitesse/défense (non modélisées dans l'outil).

> Volontairement **exclus** (non présents sur swcalc/game-mechanics) : efficacité
> des runes, sets de runes, précision/résistance, avantage élémentaire.

## Règles / attendus

- **Formules = modèle communautaire** (prédictif), annoncé dans l'intro (pas de
  crédit de source affiché).
- Cohérent avec les calculs réels de l'app : vitesse/ticks (voir
  [siege/speed-tick.md](siege/speed-tick.md)), efficacité & sets (voir
  [shared/import-compte.md](shared/import-compte.md)).
- Composants internes : `Section`, `F` (bloc formule mono défilable), `K` (terme
  inline). Titres sans en-tête d'action ; la page **garde** son titre (contrairement
  aux pages outils) car c'est une doc.
- Ancres de sommaire via `scrollIntoView` (pas de `href="#..."` qui modifierait le
  hash de routing).
