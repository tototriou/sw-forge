# Preuve — lot 14 de la refonte graphique : thème clair (Atelier)

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.14.
Contrat : seules les VALEURS du thème clair changent. Le thème sombre (Forge),
les composants, les classes et les rendus du jeu ne bougent pas.

## Relevé, avant tout code

Tokens de l'app contre ceux de la maquette (`.sf[data-theme=light]`) :

| Token | App (avant) | Maquette | |
|---|---|---|---|
| `bg` | `#DFE3ED` | `#F6F6F8` | diffère — le plus gros écart |
| `panel` | `#FFFFFF` | `#FFFFFF` | = |
| `panel2` | `#EFF2F8` | `#F1F1F4` | diffère (bleuté → neutre) |
| `border` | `#A6AFC5` | `#D0D1DA` | diffère |
| `border-soft` | `#C5CDDD` | `#E3E3E9` | diffère |
| `ink` / `ink-dim` / `ink-dimmer` | `#1A1E2B` / `#585F75` / `#666D83` | `#16171F` / `#565869` / `#6B6D80` | teintés bleu → neutres |
| `accent` | indigo `#2B36A5` | cuivre `#B5561C` | diffère |
| `good` | `#146A41` | `#17804A` | diffère |
| `warn-soft` | `#FFECB5` | `#FDF0D2` | diffère |
| `bad` | `#B01C1C` | `#B91C1C` | quasi = |
| `good-soft`, `bad-soft`, `warn`, les six éléments, les paliers | | | = |

Thomas n'a pas nommé de défaut précis ; il a dit « passe à la suite » et
a tranché les deux questions posées :
- **bordures : « intermédiaires »** — celles de la maquette pour les
  séparateurs et les cadres de carte, un cran plus marquées pour les champs,
  les boutons et les puces ;
- **accent : l'indigo reste**.

## Ce qui change (src/index.css, bloc `:root` clair seulement)

| Token | Avant | Après | Source |
|---|---|---|---|
| `bg` | `223 227 237` | `246 246 248` | maquette |
| `panel2` | `239 242 248` | `241 241 244` | maquette |
| `border` | `166 175 197` | `196 198 208` | intermédiaire (maquette : `208 209 218`) |
| `border-soft` | `197 205 221` | `227 227 233` | maquette |
| `ink` | `26 30 43` | `22 23 31` | maquette |
| `ink-dim` | `88 95 117` | `86 88 105` | maquette |
| `ink-dimmer` | `102 109 131` | `107 109 128` | maquette |
| `warn-soft` | `255 236 181` | `253 240 210` | maquette |
| `--page-veil` | halo `#dfe3f5` | halo `#ffffff` | un halo bleu sur fond neutre aurait fait une tache |

Gardés de l'app, et pourquoi :
- `good` : celui de la maquette tombe à 4,41 sur `panel2` ;
- `bad` : plus foncé, donc plus contrasté ;
- l'accent indigo : choix de Thomas.

Vérifié par `git diff -U0 src/index.css` : aucune ligne `--forge-*` touchée.

## Contrastes (WCAG ; texte 4,5, contour 3)

Scripts du scratchpad : `proposition-clair.mjs`, `bordure-intermediaire.mjs`,
`paliers-avant.mjs`.

```text
texte sur bg      min 4.21  SOUS 4.5 : wind 4.29, pal-1 4.21, pal-6 4.48
texte sur panel   min 4.55  tous ≥ 4.5
texte sur panel2  min 4.03  SOUS 4.5 : wind 4.11, pal-1 4.03, pal-6 4.29
 15.79   ink sur warn-soft        5.38   warn sur warn-soft
 15.60   ink sur good-soft        5.79   good sur good-soft
 14.90   ink sur bad-soft         4.98   fire sur bad-soft
 14.27   ink sur accent-soft      7.72   accent sur accent-soft
border #C4C6D0       bg=1.58  panel=1.70  panel2=1.51
border-soft #E3E3E9  bg=1.18  panel=1.28  panel2=1.13
surfaces : panel/bg=1.08  panel2/bg=1.04  panel/panel2=1.13

AVANT, sur l'ancien fond :
wind   bg=3.61  panel2=4.13
pal-1  bg=3.54  panel2=4.05
pal-6  bg=3.76  panel2=4.31
ink-dimmer bg=4.01
```

Sous le seuil, en connaissance de cause :
- **Vent, palier or, palier gris**, sur `bg` et `panel2` :
  - plus lisibles qu'avant partout, sauf le palier gris sur `panel2`, un
    cheveu en dessous (4,31 → 4,29) ;
  - au-dessus de 4,5 sur `panel`, la surface où ils apparaissent.

  C'est l'arbitrage déjà documenté pour le vent (design.md § Contraste),
  étendu aux deux paliers.
- **Bordures** : sous 3, comme avant (1,96 à 2,20). Elles sont décoratives
  (design.md) ; le seuil de 3 vaut pour un contour porteur de sens, qui est
  l'accent.
- **Surfaces** : `panel2` / `bg` passe de 1,15 à 1,04, et `panel` / `bg` de
  1,28 à 1,08. Une surface posée sur la page se sépare désormais par sa
  bordure : c'est le rendu de la maquette, noté dans design.md.

Gagné : `ink-dimmer` passe le seuil sur le fond de page (4,01 → 4,72).

## Couleurs de section de l'accueil, sur le nouveau fond

Script `sections-accueil.mjs`. Sur l'accueil, tout est posé dans des cartes
`panel` (blanc, inchangé), avec `panel2` au survol, qui bouge d'un cheveu.
**Le lot ne change rien à leur lisibilité** : de −0,02 à +0,01 selon la
couleur. Icône sur sa tuile (sa couleur à 14 %, carte `panel`) :

```text
rta 3.41 · siege 3.33 · mecaniques 2.72 · monstres 2.64 · bestiary 2.54
home 2.51 · artefacts 2.36 · releases 1.99 · outils 1.74 · recos 1.61
compte 1.60 · arene 1.55
```

⚠️ **Défaut qui préexiste, relevé par la mesure** : ces couleurs sont des hex
FIXES, les mêmes dans les deux thèmes (`couleursSection.ts`), choisis pour le
fond sombre. En clair, neuf sur douze passent sous 3:1, le seuil d'une icône
porteuse de sens ; cyan, jaune et vert tombent vers 1,6. Ce ne sont pas des
tokens : hors du contrat de ce lot. Le correctif possible est une variante
claire, plus foncée, par section. Il revient à la zone Accueil (lot 5, déjà
validé), à décider avec Thomas.

## Défauts qui ne se corrigent pas par un token

Recherche de couleurs en dur dans les composants
(`(bg|text|border|…)-[#…]`, `bg-white`, `bg-black`) : rien à signaler. Les
occurrences restantes sont la pastille blanche de l'interrupteur et des
rendus du jeu (portrait de collab, cadre de catégorie RTA). Aucun défaut
relevé par Thomas.

## Vérifications

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu refonte            → 370 vérifications passées
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
```

## À regarder en thème clair sur le serveur de dev

- **L'ensemble** : le fond presque blanc, les cartes blanches, qui se
  détachent désormais par leur contour.
- **Siège** : les équipes de Défense / Offense et les Recommandations, avec
  les pastilles colorées sur les nouveaux fonds.
- **Les champs de saisie** : le contour « intermédiaire » se voit-il assez ?
- **Le résumé de compte** (Runes) : les paliers or et gris sur la page.
- **Les écrans pas encore refaits** (Runes, Optimizer…) : ils prennent aussi
  ces valeurs.
- **Téléphone** : non regardé (lot 11).
