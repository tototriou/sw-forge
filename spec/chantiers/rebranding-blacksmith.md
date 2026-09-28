# Cadrage — rebranding « SW Blacksmith »

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

## Partie A — préambule commun (le brief de chaque lot)

### A.1 Pourquoi

Thomas veut une **nouvelle identité** pour l'app (2026-09-28) : la toile
`https://claude.ai/artifact/9KRpA74BakEWdkmvioBwKC` (« SW Forge —
Rebranding », page « SW Blacksmith — maquette », « Thème & icônes »,
« Composants »). Ce n'est pas un restylage de plus : le **nom** change
(« SW Blacksmith »), le **logo** (enclume et marteau), la **palette** (braise
`#FF7A1A`, laiton `#C9A227`, fonds brun-noir chauds, texte parchemin), la
**police de texte** (Source Sans 3 au lieu d'Inter), les **arrondis**, et
chaque écran a sa planche.

Ce qui le rend faisable : la refonte graphique en cours a tout rangé dans des
**variables** (`src/index.css`, `tailwind.config.js`) et une **librairie**
(`src/ui/`). Une grande part du rebranding est un changement de VALEURS, pas
de code d'écran.

### A.2 Cible et périmètre

**Cible** : l'app porte le nom, le logo, les deux thèmes (Forge sombre par
défaut, Atelier clair), les polices, les arrondis et les composants de la
toile ; chaque écran qui a une planche en suit la structure, dans les limites
des décisions de Thomas.

**Décisions de départ (Thomas, 2026-09-28)** :
1. **Tout de suite, sur la branche de la refonte** (`forge/refonte-graphique`)
   — le rebranding en devient la suite, avant sa fusion. Le lot 12 de la
   refonte (validation finale, fusion) couvre les deux.
2. **« SW Blacksmith » partout** dans l'app (titre, logo, textes, onglet). Le
   dépôt GitHub et l'URL se décident à part.
3. **La barre LATÉRALE est gardée** (décision 11 de la refonte) — la barre
   horizontale de la maquette n'est pas reprise ; la barre latérale prend les
   couleurs, le logo et les états de la charte.

**Intouchable** (rien ne change, quoi qu'en dise une planche) :
- les **clés de stockage** `sw-forge-*`, `sky-arena-*` et les formats de
  fichiers exportés — les renommer ferait perdre à chacun sa prépa, ses
  équipes et son compte. Le nom ne vit que dans des TEXTES ;
- les **rendus du jeu** (roue de runes, cadres, fiches, portraits, icônes
  d'élément et de set) — la charte le dit elle-même : « Monstres, éléments,
  runes, objets : visuels du jeu, repris tels quels » ;
- aucune information ni fonction perdue (principe fondateur de la refonte,
  même mécanisme : inventaire, `deplacements.json`, retraits décidés).

**Hors périmètre** : le dépôt GitHub, le domaine, les données du jeu, la
logique (`src/lib/`, `src/hooks/`) — sauf fichier nommé dans la section de
son lot avant le code, comme pour la refonte.

### A.3 Hiérarchie des priorités

Celle de la refonte (`refonte-graphique.md` § A.3) : 1 ne rien perdre ;
2 traçabilité ; 3 erreurs observables ; 4 fidélité à la toile ; 5 volume.
Quand une planche contredit une décision déjà prise avec Thomas (refonte ou
ce cadrage), la **décision l'emporte**, et l'écart lui est signalé.

### A.4 Catégories de lots

Celles de la refonte : M mécanique, C classification, J jugement (décisions
de Thomas avant le code). Même modèle, même effort.

### A.5 Branche, fichiers transverses

Branche `forge/refonte-graphique`. Fichiers transverses portés par ce
chantier : `src/index.css`, `tailwind.config.js`, `index.html`,
`public/favicon.*`, `src/App.tsx`, `spec/shared/design.md`,
`spec/shared/navigation.md`. Les lots 9a et 11e de la refonte (Optimizer)
restent en attente d'une livraison ; l'Optimizer prend les jetons et la
librairie comme tout écran, sa structure attend 9a.

### A.6 Quand une vérification échoue ou qu'un cas est ambigu

Comme la refonte : vérification échouée → pas de commit ; planche ambiguë
ou contraire à une décision → question à Thomas avant le code, décision
numérotée en A.8.

### A.6 bis Preuves

`spec/chantiers/rebranding-preuves/lot-R<n>.md` : H1, en-tête `Statut`,
tests d'avant, commits, retours de Thomas, commandes et sorties. Mêmes outils
que la refonte : `node scripts/inventaire-ui.mjs --verifier`,
`node scripts/chemins-interdits.mjs 6110609`, tests de rendu de la zone,
`npm run build`, classes émises et ordonnées.

### A.7 Ordre, dépendances, suivi

```text
R0 → R1 (les jetons se posent sur le relevé, pas de mémoire)
R1 → R2, R3 (nom, logo et librairie se jugent sur les nouveaux jetons)
R3 → R4 (la coquille consomme la librairie)
R4 → R5 … R9 (un écran se refait sur la coquille finale)
{R5 … R9} → refonte lot 12 (une seule validation finale, une seule fusion)
```

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| R0 relevé : jetons de la toile ↔ jetons de l'app, écarts, questions | C | à faire | |
| R1 jetons : deux thèmes, police de texte, arrondis | J | à faire | |
| R2 nom et logo | J | à faire | |
| R3 `src/ui/` aux planches « Composants » | J | à faire | |
| R4 coquille : barre latérale et barre du haut | J | à faire | |
| R5 Accueil (bureau et téléphone) | J | à faire | |
| R6 Siège et Recommandations | J | à faire | |
| R7 RTA | J | à faire | |
| R8 Mon compte | J | à faire | |
| R9 Bestiaire, Mécaniques, Nouveautés | J | à faire | |

### A.8 Décisions prises en cours de chantier

(Numérotées à partir de 4, datées, « Thomas » ; un retrait porte
`[retrait R#n]` et se déclare dans `deplacements.json` de la refonte.)

## Partie B — les lots

### R0 — relevé · C

**Intrant** : la page « Thème & icônes » de la toile (`BsTheme`, `BsIcones`),
`BsCharte`, `src/index.css` (blocs `:root` et Forge), `tailwind.config.js`.
**Sortie** : `rebranding-preuves/lot-R0.md` — un tableau jeton par jeton, pour
chaque thème : nom de la toile (`--bs-*`), jeton de l'app qu'il remplace
(`bg`, `panel`, `panel2`, `border`, `border-soft`, `ink`, `ink-dim`,
`ink-dimmer`, `accent`, `accent-ink`, `star`, `good`, `warn`, `bad`…), valeur
actuelle, valeur de la toile, **contraste mesuré** des paires texte / fond ;
les jetons de l'app SANS équivalent dans la toile (éléments, raretés,
palette de données `pal-*`, couleurs de section de l'accueil) et une
proposition pour chacun ; la liste des questions à poser à Thomas avant R1.
**Ne fait pas** : aucune valeur changée.

### R1 — jetons · J

Les valeurs de R0 dans `src/index.css` (Forge et Atelier, mêmes noms de
variables), Source Sans 3 à la place d'Inter (`index.html`,
`tailwind.config.js`), arrondis 6 / 10 / 14 / 20. **Preuve** : contrastes
re-mesurés (≥ 4,5:1 pour le texte courant), tous les tests de rendu verts,
build, relecture par Thomas sur son serveur de dev dans les deux thèmes.

### R2 — nom et logo · J

« SW Blacksmith » écrit **une fois** (une constante) et lu partout où le nom
s'affiche (titre de l'onglet, barre, messages) — 26 mentions en dur relevées
le 2026-09-28 dans `src/`, `index.html` ; les clés de stockage ne bougent
pas. Le logo (symbole, horizontal, empilé, favicon 16 / 32, icône d'app) en
composant et en fichiers `public/`. **Preuve** : `grep -rn "SW Forge"` ne
rend plus que l'historique (`data/releases.ts`) et les commentaires ;
inventaire (les textes renommés déclarés) ; tests verts.

### R3 à R9

Même contrat que les lots d'écran de la refonte (`refonte-graphique.md`
§ B.5 à B.10) : tests de rendu de la zone d'abord, relevé des écarts
planche ↔ écran, décisions de Thomas avant le code, preuve. Chaque section
est écrite au démarrage de son lot, avec les lignes relevées à ce moment.
