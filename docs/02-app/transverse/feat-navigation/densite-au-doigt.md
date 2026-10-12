# Navigation — densité au doigt

Partie de [Navigation](README.md).

## Densité au doigt

⚠️ **La règle tactile a deux paliers**, pas un seul (`src/index.css`) :

| Cible | Hauteur | Pourquoi |
|-------|---------|----------|
| Autonome (barre, page, panneau) | 40 px | Rater signifie ne rien déclencher |
| Imbriquée dans une carte (`data-carte-dense`) | 32 px | Rater est improbable : le contrôle occupe toute la largeur de sa carte, rien d'autre à toucher sur la ligne |
| Posée sur un coin (`data-cible-fine`) | libre | Agrandie, elle déborde la carte et recouvre le contenu |

⚠️ Le palier unique à 40 px avait un effet qu'on ne voit qu'à l'usage : le
sélecteur de section d'une carte RTA pesait plus lourd que le monstre qu'il
classe, et deux cartes ne tenaient plus dans un écran. **Une règle
d'accessibilité appliquée sans discernement finit par coûter en lisibilité ce
qu'elle gagne en visée.**

Compactage sous `sm`, dans le même esprit :

- **Recherche RTA** — 40 px au lieu de 56 (`py-2 text-sm` contre `py-3.5
  text-base`). C'est le rembourrage décoratif qui tombe, pas la zone touchable.
- **Sections RTA** — `p-2` au lieu de `p-3`. La page en empile trois à six :
  chaque rembourrage se paie autant de fois.
