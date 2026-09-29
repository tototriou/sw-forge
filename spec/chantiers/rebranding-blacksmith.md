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
| R1 jetons : deux thèmes, police de texte, arrondis | J | **validé par Thomas** (« continues », après les décisions 11 à 13) | 2026-09-29, [lot-R1.md](rebranding-preuves/lot-R1.md) |
| R2 nom et logo | J | **validé par Thomas** (« continues », image de partage comprise) | 2026-09-29, [lot-R2.md](rebranding-preuves/lot-R2.md) |
| R2 bis le logo de la nouvelle identité (décisions 24 à 26) | J | fait — symbole et police validés sur planche ; relecture de Thomas dans l'app en attente | 2026-09-29, [lot-R2bis.md](rebranding-preuves/lot-R2bis.md) |
| R3 `src/ui/` aux planches « Composants » | J | relevé et décisions faits (`dc9bee00`) ; R3a en pause, mis de côté (`git stash`, « R3a en cours ») pour le R2 bis | |
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
13. **Le vert et le rouge de Forge, plus saturés que la toile** (Thomas,
    2026-09-29, sur les camps du speed tuning : « ça me paraît pâle », puis
    « je parlais du vert et du rouge »). Même clarté et même teinte, chroma à
    mi-chemin du maximum : `#73E06B`, `#F27A84`. Atelier inchangé. Nouveau
    jeton `bad-ink` (encre sur l'aplat rouge), le blanc n'y tenant plus.

**14 à 16 — les questions du R2 (Thomas, 2026-09-29)** :

14. **Les fichiers téléchargés prennent le préfixe `swblacksmith-`** (ils
    s'appelaient `swforge-…`). Contenu et format inchangés, l'import ne
    dépend pas du nom : un ancien fichier se réimporte comme avant.
15. **L'infobulle Discord dit « SW Blacksmith »** ; Thomas renomme le
    serveur de son côté, le lien d'invitation ne change pas.
16. **L'image de partage est refaite dans ce lot** : même contenu, logo et
    couleurs de la charte, montrée à Thomas avant son commit.

**17 à 23 — les questions du R3 (Thomas, 2026-09-29)**, relevé dans
[lot-R3.md](rebranding-preuves/lot-R3.md) :

17. **Notre densité est gardée** : couleurs, rayons et états de la toile, mais
    les hauteurs actuelles (bureau 28 / 32, doigt 40), pas « 44 minimum ».
    Même logique que la décision 7.
18. **La règle du 1 px est gardée** : focus en anneau d'1 px de braise
    lisible, champ au focus sans halo, pas de double anneau.
19. **`Segmented` : l'option choisie en APLAT braise**, texte `accent-ink`
    (au lieu du fond doux du lot 9 de la refonte).
20. **Pastille active : les couleurs de la toile, sans coche ni gras** —
    contour braise, fond braise sombre. La largeur ne change pas au clic.
21. **Appui : un bouton fonce et descend d'1 px**, comme la toile ; les cartes
    et autres surfaces cliquables gardent le léger rétrécissement.
22. **Confirmation destructive : l'action en APLAT rouge**, l'autre bouton à
    contour. Libellés inchangés, focus sur l'action sans perte.
23. **Notification : en bas à droite au bureau** ; au téléphone, au-dessus des
    onglets, comme aujourd'hui. 6 s et une à la fois, inchangés.

**24 à 26 — la nouvelle identité de logo (Thomas, 2026-09-29)**, envoyée en
image pendant le R3a (« voilà ce que je veux comme identité de logo ») : une
enclume blanche surmontée d'un cristal de braise et de deux éclats, le nom en
linéale large en capitales espacées, la devise « Analyse · Optimise ·
Progresse ». Elle ne vient pas de la toile.

24. **Elle remplace le logo et le nom seulement** : symbole, police du nom,
    favicon, icône d'app, image de partage. La palette de l'app reste celle de
    la toile (R1) — l'image propose un fond #0E1116 et un accent #FF7A32,
    écartés.
25. **Le symbole est redessiné en SVG** d'après l'image (il n'existe qu'en
    rendu), et montré à Thomas avant d'être posé.
26. **La devise va sur l'image de partage.**

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

**Précisé au démarrage (2026-09-29)**, relevé : 30 fichiers mentionnent le
nom. Seuls sont renommés les TEXTES affichés, les noms de fichiers
téléchargés (décision 14) et les commentaires des fichiers qu'on touche. Ne
bougent pas : les clés de stockage `sw-forge-*`, la base IndexedDB
`sw-forge`, les identifiants de format (`sw-forge/prepa-rta`…), les URLs
GitHub et Vercel (A.2, hors périmètre).
- **Où vit le nom** : `src/marque.ts` (`NOM_APP`, préfixe des fichiers), lu
  par les composants, par `src/lib/` et par `index.html` au build, via un
  plugin de `vite.config.ts` qui remplace `%NOM_APP%`.
- **Le logo** : un composant `src/components/Logo.tsx` (symbole, horizontal,
  empilé), en couleurs de JETONS (enclume `ink`, marteau `star`, étincelles
  `accent`), donc lisible dans les deux thèmes. Il remplace les trois
  `<img src="favicon.svg">` de l'app : barre latérale, `App.tsx`, accueil.
- **Fichiers permis** (A.2, nommés avant leur code) : `public/favicon.svg`,
  `public/favicon.png`, `public/og-image.png` ; dans `src/lib/`,
  `rtaShare.ts`, `recoShare.ts` et `siegeShare.ts` — seulement les messages
  d'erreur qui nomment l'app, et le nom de fichier du siège.
- **Différé aux lots 9a / 11e** : `swforge-optimizer-…`, dans
  `OptimizerSection.tsx`. Thomas attend une livraison sur l'Optimizer, et une
  ligne changée ici risquerait un conflit avec elle.

**Résultat (2026-09-29)** — preuve [lot-R2.md](rebranding-preuves/lot-R2.md).
Le nom est lu partout depuis `src/marque.ts`, `index.html` compris, et le
logo est un composant en couleurs de jetons. Le favicon est la variante
16 px de la charte ; l'icône d'app, rendue en 512. Le nom tient dans la barre
latérale : mesuré sur l'app construite, dans les deux thèmes. Écarts au
contrat :
- l'extracteur de l'inventaire apprend à lire `NOM_APP` par sa valeur (sans
  cela, R2 rendait le nom invisible à l'inventaire) ;
- un test `marque` fige les identifiants de format ;
- les variantes « empilé » et « monochrome » du logo ne sont pas codées :
  rien ne les utilise encore (R5, l'accueil, pourra en avoir besoin).

Restent l'image de partage (décision 16, montrée avant son commit) et la
relecture de Thomas.

### R2 bis — le logo de la nouvelle identité · J

**Écrit au démarrage (2026-09-29)**, décisions 24 à 26. Même contrat que le R2,
sur les mêmes fichiers : `SymboleLogo` et `Logo` (`src/components/Logo.tsx`),
`public/favicon.svg`, `public/favicon.png`, `public/og-image.png` (déjà
permis). Le nom reste écrit une fois (`src/marque.ts`).
1. **Symbole redessiné en SVG** d'après l'image, en couleurs de jetons
   (enclume et éclats `ink`, cristal `accent`) ; montré à Thomas en grand, en
   32 et en 16 px, dans les deux thèmes, AVANT d'être posé.
2. **Police du nom** : une linéale large de Google Fonts, choisie par Thomas
   sur un rendu comparatif. Elle ne sert qu'au NOM : les titres de l'app
   restent en Cinzel (décision 24).
3. **Pose** : composant, favicon (32 : symbole complet ; 16 : à juger sur le
   rendu), icône d'app 512, image de partage avec la devise.

**Preuve** : `rebranding-preuves/lot-R2bis.md`, avec les rendus comparatifs ;
build ; tests `marque`, `rendu` ; inventaire. **Ne fait pas** : la palette,
les titres, les bannières Discord (hors de l'app).

**Résultat (2026-09-29)** — preuve [lot-R2bis.md](rebranding-preuves/lot-R2bis.md).
Symbole redessiné, planche montrée : « Oui, pose-le », nom en Saira 700.
Posés : `Logo.tsx` (deux jetons `logo-cristal`), `font-marque`, favicon (le
symbole complet, lisible à 16 px), icône d'app, image de partage avec la
devise. Le nom tient dans la barre latérale (123 px pour 130) ; le héros ne
déborde à aucune largeur (360, 390, 1440). Au passage, `accueil.md` disait
que la barre ne porte pas la marque, ce qui est faux depuis la refonte :
corrigé.

### R3 — la librairie aux planches « Composants » · J

**Écrit au démarrage (2026-09-29)**. Intrant : les planches 1 (Actions et
sélection), 2 (Formulaires) et 6 (Retours et fenêtres) — les trois autres
vont à la coquille et aux écrans (tableau § 1 de la preuve). Relevé des
écarts et décisions 17 à 23 : [lot-R3.md](rebranding-preuves/lot-R3.md).

**Contrat** : seul `src/ui/` change (plus `index.css` pour la pression et le
focus, et les specs `librairie-ui.md` / `design.md`). Aucun écran n'est
retouché : ce qu'un écran dessine à la main hors librairie attend son lot
(R5 à R9). Aucune information ni fonction perdue (inventaire).
- **R3a** Actions et sélection : `Bouton` (états des quatre tons, appui,
  désactivé), `Segmented` (aplat, décision 19), `Pastille` (décision 20).
- **R3b** Formulaires : `Champ`, `NumberField`, `Selecteur`, `Interrupteur`,
  `Case` — couleurs et états, tailles gardées (décision 17).
- **R3c** Retours et fenêtres : confirmation destructive (décision 22),
  notification (décision 23), `Menu`, `Modale`.

**Preuve** : tests de rendu `ui` et `rendu` verts, avec les assertions
changées déclarées une à une ; inventaire ; build ; classes vérifiées dans le
CSS construit ; relecture de Thomas dans les deux thèmes.

**Ne fait pas** : le bouton « chargement » (spinner + « En cours ») de la
toile — aucun écran ne l'emploie : il monte au premier usage réel, pas avant.

### R4 à R9

Même contrat que les lots d'écran de la refonte (`refonte-graphique.md`
§ B.5 à B.10) : tests de rendu de la zone d'abord, relevé des écarts
planche ↔ écran, décisions de Thomas avant le code, preuve. Chaque section
est écrite au démarrage de son lot, avec les lignes relevées à ce moment.
