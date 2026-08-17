# SW Forge — consignes

Boîte à outils Summoners War. React + TypeScript + Vite + Tailwind, 100 % local.

📐 **Où se trouve quoi : [ARCHITECTURE.md](ARCHITECTURE.md).** Le consulter
**avant** de chercher dans la codebase — il donne, par page, les fichiers à
ouvrir. Ne pas explorer `src/` à l'aveugle.

## Travail

- **Français partout** : réponses, commits, libellés d'interface, commentaires.
- **La spec avant le code.** Lire le `spec/` de la zone touchée avant de coder,
  la mettre à jour dans le **même commit**. Index : [spec/README.md](spec/README.md).
- **Tests ciblés** (`node tests/run.mjs`) pendant le travail. La suite complète
  seulement au moment de publier une version.
- **Branches `forge/<sujet>`**, jamais `release/x.y.z` : le numéro se décide à la
  fusion.
- **Toute page ou section ajoutée / renommée / supprimée** se répercute sur
  l'accueil et sur la nav de `App.tsx`, dans le même commit.
- **Une décision prise ensemble s'applique jusqu'au bout.** Si le chantier dérive
  et qu'une étape validée reste en attente, le dire explicitement.

## Interface

- **Deux formats de premier rang** : téléphone et ordinateur. Aucun n'est le cas
  dégradé de l'autre — **une correction destinée à l'un ne touche pas l'autre**.
- **Rien de custom.** Tout contrôle vient de `src/ui/`. On n'ajoute à la
  librairie que quand un **axe** manque, jamais une variante de plus.
- ⚠️ **Un clic ne déplace jamais ce qu'on vient de cliquer.** La place de ce qui
  s'ouvre est réservée d'avance, ou bien ce qui s'ouvre sort du flux (flottant,
  dialogue, panneau). On doit pouvoir basculer sans bouger la souris ni l'écran.
  Détail et exceptions : [spec/shared/design.md](spec/shared/design.md).
- **Contours : 1 px, et un seul.** Jamais deux superposés. Vaut pour les éléments
  d'**interface** ; runes, artéfacts et reliques se marquent comme dans le jeu.
- **Grammaire des modales** : titre en haut à gauche, croix en haut à droite,
  actions en bas à droite (empilées pleine largeur si elles ne tiennent pas sur
  une ligne), corps qui prend toute la largeur ou centré.
- **Les libellés sont ceux du jeu**, jamais reformulés.
- **Jamais un `confirm()` dont OK détruit** : le défaut est l'action sans perte.
- **Aucune couleur Tailwind native**, aucune valeur en dur : tout passe par les
  tokens ([spec/shared/design.md](spec/shared/design.md)).
- **Passe responsive en cours** — ne pas rustiner le mobile écran par écran.

## Vérifier

```
npx tsc --noEmit     # types
npm run build        # Tailwind n'émet que ce qu'il trouve dans le SOURCE
node tests/run.mjs   # vérifications ciblées
```

⚠️ Une classe Tailwind « correcte » dans le TSX peut n'être **jamais émise**
(`[&>*]:w-full` ne l'a pas été). Quand un style ne s'applique pas, vérifier dans
le **CSS construit**, pas dans le composant.
