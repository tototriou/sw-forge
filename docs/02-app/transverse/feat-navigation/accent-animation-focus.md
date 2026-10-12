# Navigation — accent contextuel, animation et focus

Partie de [Navigation](README.md).

## Accent contextuel — `--ctx`

L'idée directrice de la refonte : **l'élément du monstre consulté teinte
l'écran**. On sait de quel monstre on parle avant d'avoir lu son nom.

```css
--ctx: var(--accent);        /* par défaut : l'accent de l'app */
[data-ctx='water'] { --ctx: var(--el-water); }
```

- ⚠️ **`--ctx` est un ALIAS, jamais une couleur.** Il pointe vers un token qui
  existe déjà — un élément, ou l'accent de l'app. Chaque teinte reste donc celle
  dont le contraste a été **mesuré** (voir [03-developpeur/interface/](../../../03-developpeur/interface/) (design, « Contraste »)).
- ⚠️ **Valable dans les deux thèmes du seul fait qu'il est un alias** : sa cible
  change avec le thème, lui n'a pas à le savoir.
- L'attribut **`data-ctx`** se pose sur un conteneur ; toute sa sous-arborescence
  prend la teinte. Un composant n'a **rien à connaître** de l'élément courant :
  il écrit `text-ctx` ou `bg-ctx-soft`.
- Exposé à Tailwind : `bg-ctx`, `text-ctx`, `border-ctx`, `bg-ctx-soft`.

### Fonds doux par élément

`--el-*-soft` complète les six couleurs d'élément : la teinte **fondue dans la
surface**, exactement comme `--accent-soft` l'est pour l'accent. Ce sont des
**fonds**, jamais du texte.

⚠️ Comme tous les tokens, ils sont déclarés dans les **deux** blocs de thème
(media query *et* `[data-theme]`). Le fichier rappelle qu'une divergence est
déjà survenue entre ces deux blocs.

### Où il s'applique

- La **fiche d'un monstre** le pose à l'élément affiché — et le suit quand on
  bascule de forme sur un transformable.
- La **barre latérale** porte un liseré vertical à cette teinte, et l'entrée
  active un fond `ctx-soft`.

⚠️ **La pastille de lead ne suit PAS** ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) :
elle reste dorée, y compris dans la fiche. Partagée avec le siège où aucun
élément ne fait contexte, la teinter ici la ferait diverger d'un écran à l'autre
pour la même donnée.

## Animation

Framer Motion, déjà présent — pas de keyframes écrites à la main.

- **Glissement entre niveaux** : on entre par la droite, on ressort par la
  gauche, comme on tourne une page. 8 px, 180 ms : la liste doit sembler
  *glisser*, pas voler à travers l'écran.
- ⚠️ **Pas de `mode="wait"`.** Essayé et retiré : le niveau sortant devait finir
  avant que l'entrant commence, mais une navigation rapide interrompait la
  sortie et l'entrant ne montait jamais — **la barre restait vide**. Les deux
  niveaux se superposent dans une même cellule de grille.
- ⚠️ **La clé désigne le NIVEAU, pas la section.** Elle a contenu le titre
  (`section:Siège`) : passer d'une section à l'autre changeait la clé alors
  qu'on reste au niveau 2, et deux transitions se chevauchaient.
- ⚠️ **Pas de `layoutId` sur le fond de l'entrée active.** Un fond qui glisse
  d'une ligne à l'autre est joli, mais ce nœud traversait le changement de
  niveau géré par `AnimatePresence` : Framer le déplaçait entre deux parents
  dont l'un se démontait, et **les icônes disparaissaient en naviguant**. Une
  transition d'opacité ne peut pas casser.
- ⚠️ **`MotionConfig reducedMotion="user"`** à la racine
  ([main.tsx](src/main.tsx)) : Framer Motion ne respecte **pas**
  `prefers-reduced-motion` par défaut. Sans cette ligne, chaque animation aurait
  dû le gérer une par une, et la première oubliée serait passée inaperçue.

## ⚠️ Un seul contour au focus

```css
.focus-within\:border-accent :focus-visible,
.focus-within\:border-ctx :focus-visible { outline: none; }
```

Un champ posé dans un cadre qui réagit déjà au focus ne porte **pas** son propre
anneau : on obtenait un contour **dans** un contour, à 2 px l'un de l'autre.
C'est le cadre qui marque le focus, le champ le remplit.

Règle **globale**, pas propre à un composant : elle corrige aussi
[NumberField](src/ui/NumberField.tsx), qui avait le même défaut.
