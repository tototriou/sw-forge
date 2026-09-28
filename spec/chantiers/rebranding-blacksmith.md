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

**Cible** : l'app porte le nom, le logo, les deux thèmes (Forge sombre,
Atelier clair ; le défaut reste « Auto », décision 6), les polices, les
arrondis et les composants de la toile ; chaque écran qui a une planche en
suit la structure, dans les limites des décisions de Thomas.

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
| R0 relevé : jetons de la toile ↔ jetons de l'app, écarts, questions | C | fait — sept questions posées | 2026-09-28, [lot-R0.md](rebranding-preuves/lot-R0.md) |
| R1 jetons : deux thèmes, police de texte, arrondis | J | fait — relecture de Thomas en attente | 2026-09-29, [lot-R1.md](rebranding-preuves/lot-R1.md) |
| R2 nom et logo | J | à faire | |
| R3 `src/ui/` aux planches « Composants » | J | à faire | |
| R4 coquille : barre latérale, barre du haut, icônes de nav (décision 9) | J | à faire | |
| R5 Accueil (bureau et téléphone) | J | à faire | |
| R6 Siège et Recommandations | J | à faire | |
| R7 RTA | J | à faire | |
| R8 Mon compte | J | à faire | |
| R9 Bestiaire, Mécaniques, Nouveautés | J | à faire | |

### A.8 Décisions prises en cours de chantier

(Numérotées à partir de 4, datées, « Thomas » ; un retrait porte
`[retrait R#n]` et se déclare dans `deplacements.json` de la refonte.)

**4 à 10 — les questions du R0 (Thomas, 2026-09-29)**, chiffres dans
[lot-R0.md](rebranding-preuves/lot-R0.md) :

4. **Braise foncée pour le texte** en Atelier : un jeton de texte séparé,
   `#A64F11` (4,52 au pire). Aplats et boutons restent en braise vive
   `#FF7A1A`. En Forge, texte et aplat ont la même valeur.
5. **Un jeton `bar`** pour la barre latérale et la barre du haut (Forge
   `#1B1A19`, Atelier `#FFFDF8` = `surface`, comme la toile).
6. **Le thème par défaut reste « Auto »** (suit le navigateur) ; Forge est
   le thème de la charte et des captures, pas le point de départ imposé.
7. **Notre échelle typographique est gardée** : Source Sans 3 remplace
   Inter, les tailles ne bougent pas (le corps de 17 px de la toile vaut
   pour sa charte, pas pour la densité de nos listes).
8. **La règle de contraste de `design.md` est gardée** (4,5 sur `panel`,
   moins toléré ailleurs, les couleurs du jeu d'abord). Seuls `pal-1`
   (Atelier) et `pal-6` (Forge) bougent. Le laiton de la toile en Atelier
   (4,79 sur `surface`) y entre sans repli.
9. **Les icônes de la toile, plus sept à dessiner** dans le même trait :
   Arène, Outils, Optimizer, Speed tuning, Monstres, Artéfacts, Ami. Elles
   sont montrées à Thomas avant d'être posées (R4).
10. **Les couleurs de section sont gardées** (accueil, onglets du
    téléphone), variantes claires du lot 14 comprises.

**11 et 12 — les questions du R1 (Thomas, 2026-09-29)**, chiffres dans
[lot-R1.md](rebranding-preuves/lot-R1.md) :

11. **Contours d'état et focus en braise foncée** en Atelier (`#A64F11`,
    4,52 au pire) : la vive y fait 2,11 à 2,57, sous le 3:1 d'un contour qui
    porte un état. Même jeton que le texte (`accent-lisible`).
12. **L'avertissement de la toile, tel quel** (orange) : ΔE 6,7 avec l'accent
    en Forge, 3,8 en Atelier. Le libellé porte l'état ; aucun ambre lisible ne
    s'éloignait vraiment de la braise foncée en clair.

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
`tailwind.config.js`), arrondis 6 / 10 / 14 / 20. Selon les décisions 4 à 10 :
- les jetons nouveaux `bar` (5) et texte de braise (4) ;
- les 32 `text-accent` passent au jeton de texte, par renommage mécanique,
  avec un `grep` qui prouve qu'il n'en reste aucun ;
- `pal-1` et `pal-6` recalculés (8) ;
- fonds doux (`*-soft`) recalculés sur les nouvelles surfaces, par la même
  construction.

**Fichier permis hors affichage** (A.2, nommé avant son code) :
`src/hooks/useTheme.ts` — seulement les sous-titres des thèmes dans le menu ⚙,
« Atelier — fond clair, encre froide » et « Forge — fond profond, accent
cuivre », que les nouveaux jetons rendent faux (encre chaude, braise). La
logique du thème n'y bouge pas (décision 6 : « Auto » reste le défaut).

⚠️ **À mesurer dans ce lot** : `border-accent` (65 usages) marque souvent
une sélection, donc un contour porteur de sens (3:1). La braise vive fait
2,11 à 2,57 sur les fonds Atelier. Si les usages porteurs de sens ne
passent pas, question à Thomas **avant** de trancher (jeton de texte,
épaisseur, ou tolérance).

**Preuve** : contrastes re-mesurés (≥ 4,5:1 pour le texte courant, règle
de la décision 8), tous les tests de rendu verts, build, relecture par
Thomas sur son serveur de dev dans les deux thèmes.

**Résultat (2026-09-29)** — preuve [lot-R1.md](rebranding-preuves/lot-R1.md).
Les jetons de la toile posés dans les deux thèmes, `bar` et
`accent-lisible` ajoutés, fonds doux recalculés (12 % dans `panel`),
`pal-1` et `pal-6` d'un cheveu, rayons 6 / 10 / 14 / 20, Source Sans 3,
halo retiré. `border-accent` mesuré comme prévu : question posée, décision
11. Écarts au contrat :
- les 32 `text-accent` ne sont PAS renommés. Le partage des deux braises se
  fait dans `tailwind.config.js` (`textColor`, `borderColor`, `ringColor`,
  `outlineColor`), prouvé dans le CSS construit ;
- `useTheme.ts` a été ajouté en cours de lot, nommé ci-dessus avant son code ;
- un test périmé depuis le lot 13 de la refonte a été corrigé à part
  (f119015d).

Reste la relecture de Thomas à l'œil.

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
