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
R4 → R5 … R10 (un écran se refait sur la coquille finale)
V0 → R7 (on ne refait pas un écran de plus sur des lots non relus)
{R5 … R10, refonte 9a / 11e} → refonte lot 12 (une seule validation finale, une seule fusion)
```

⚠️ **Deux arrêts par lot, à partir du V0** (décision 47) :
1. **Relevé** — planche contre écran, captures, questions. Arrêt : Thomas
   choisit.
2. **Code, sans commit** — captures avant / après, bureau et téléphone,
   Forge et Atelier. Arrêt : Thomas regarde et dit « validé » ou corrige.
   ⚠️ **L'arrêt donne la LISTE DES PAGES à vérifier** (Thomas, 2026-09-30) :
   pour chacune, l'adresse (`#/…`), le geste à faire et ce qu'on doit voir,
   numérotées pour qu'il réponde par numéro.
3. **Commit, preuve, cadrage** — seulement après « validé ».

« Continue » fait passer à l'étape suivante ; ce n'est pas une validation.
Les lots R1 à R6 ont été commités avant d'être vus : c'est l'objet du V0.

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| R0 relevé : jetons de la toile ↔ jetons de l'app, écarts, questions | C | fait — sept questions posées | 2026-09-28, [lot-R0.md](rebranding-preuves/lot-R0.md) |
| R1 jetons : deux thèmes, police de texte, arrondis | J | **validé par Thomas** (« continues », après les décisions 11 à 13) | 2026-09-29, [lot-R1.md](rebranding-preuves/lot-R1.md) |
| R2 nom et logo | J | **validé par Thomas** (« continues », image de partage comprise) | 2026-09-29, [lot-R2.md](rebranding-preuves/lot-R2.md) |
| R2 bis le logo de la nouvelle identité (décisions 24 à 26) | J | **validé par Thomas** (« ok continues ») | 2026-09-29, [lot-R2bis.md](rebranding-preuves/lot-R2bis.md) |
| R3 `src/ui/` aux planches « Composants » | J | **fait** — relevé `dc9bee00`, R3a `012f7baa`, R3b `766258e1`, R3c `39a4c0af` ; relecture de Thomas en attente | 2026-09-29, [lot-R3.md](rebranding-preuves/lot-R3.md) § 5 à 7 |
| R4 coquille : barre latérale, barre du haut, icônes de nav (décision 9) | J | fait — relecture de Thomas en attente | 2026-09-29, [lot-R4.md](rebranding-preuves/lot-R4.md) |
| R5 Accueil (bureau et téléphone) | J | fait — accueil gardé (décisions 31 à 36) ; icônes d'atelier sur les cartes (37) | 2026-09-29, [lot-R5.md](rebranding-preuves/lot-R5.md) |
| R6 Siège et Recommandations | J | fait — écrans gardés (38 à 40, 42, 45) ; couleurs d'état `a329378c`, icônes `f3198798`, carte d'ajout `fb770b5c` ; relecture de Thomas en attente | 2026-09-29, [lot-R6.md](rebranding-preuves/lot-R6.md) |
| V0 relecture par Thomas de R3, R4, R6 et de la décision 46 (commités sans avoir été vus) | — | **validé par Thomas** (« tout est ok », sur une liste de 16 points) ; faute « équipe d'défense » à corriger | 2026-09-30 |
| R7 RTA (Ma prépa, Ami) — affichage seulement, **pas de classement** (47) | J | **validé par Thomas** — écran gardé (48 à 50) ; rouge d'état et icône « Ami » `2f4fc0c5` | 2026-09-30, [lot-R7.md](rebranding-preuves/lot-R7.md) |
| R8 Mon compte (Monstres, Runes, Artéfacts) | J | **validé par Thomas** — écrans gardés (51 à 53) ; rouges d'état `999a4c25`, tuiles d'Optimisation (54) `d52c438e` | 2026-09-30, [lot-R8.md](rebranding-preuves/lot-R8.md) |
| R9a Bestiaire | J | **validé par Thomas** (« ok ») — écran gardé (55, 56) ; grimoire sur « aucun monstre » `d3218f56` | 2026-09-30, [lot-R9a.md](rebranding-preuves/lot-R9a.md) |
| R9b Mécaniques, Nouveautés | J | **validé par Thomas** (« ok ») — pages gardées (58, 59) ; titres à l'encre unie (57) `e8e65c92` | 2026-09-30, [lot-R9b.md](rebranding-preuves/lot-R9b.md) |
| R10 Outils : Speed tuning, page Arène — sans planche : couleurs d'état (43), icônes (44), librairie | J | **validé par Thomas** (« ok ») — chronomètre dans l'en-tête du Speed tuning `f1870822` ; rien d'autre à faire | 2026-09-30, [lot-R10.md](rebranding-preuves/lot-R10.md) |
| Refonte 9a / 11e — Optimizer, `swforge-optimizer` compris ; **et** l'écran vide des Outils (`OutilsPage.tsx`, clé à molette → tenailles, décision 60) | J | **sorti de cette branche** (décision 61) : chantier à part, après la fusion | |
| Refonte 12 — `npm test` complet, note de version 2.0.0, PR vers `main` (décisions 61 à 63) | M | en cours — 12a contrôles | |

### A.8 Décisions prises en cours de chantier

(Numérotées à partir de 4, datées, « Thomas » ; un retrait porte
`[retrait R#n]` et se déclare dans `deplacements.json` de la refonte.)

#### 4 à 10 — les questions du R0 (Thomas, 2026-09-29)

Chiffres dans [lot-R0.md](rebranding-preuves/lot-R0.md) :

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

#### 11 à 13 — les questions du R1 (Thomas, 2026-09-29)

Chiffres dans [lot-R1.md](rebranding-preuves/lot-R1.md) :

11. **Contours d'état et focus en braise foncée** en Atelier (`#A64F11`,
    4,52 au pire) : la vive y fait 2,11 à 2,57, sous le 3:1 d'un contour qui
    porte un état. Même jeton que le texte (`accent-lisible`).
12. **L'avertissement de la toile, tel quel** (orange) : ΔE 6,7 avec l'accent
    en Forge, 3,8 en Atelier. Le libellé porte l'état ; aucun ambre lisible ne
    s'éloignait vraiment de la braise foncée en clair.
    ⚠️ **Remplacée par la décision 46** (jaune / ocre).
13. **Le vert et le rouge de Forge, plus saturés que la toile** (Thomas,
    2026-09-29, sur les camps du speed tuning : « ça me paraît pâle », puis
    « je parlais du vert et du rouge »). Même clarté et même teinte, chroma à
    mi-chemin du maximum : `#73E06B`, `#F27A84`. Atelier inchangé. Nouveau
    jeton `bad-ink` (encre sur l'aplat rouge), le blanc n'y tenant plus.

#### 14 à 16 — les questions du R2 (Thomas, 2026-09-29)

14. **Les fichiers téléchargés prennent le préfixe `swblacksmith-`** (ils
    s'appelaient `swforge-…`). Contenu et format inchangés, l'import ne
    dépend pas du nom : un ancien fichier se réimporte comme avant.
15. **L'infobulle Discord dit « SW Blacksmith »** ; Thomas renomme le
    serveur de son côté, le lien d'invitation ne change pas.
16. **L'image de partage est refaite dans ce lot** : même contenu, logo et
    couleurs de la charte, montrée à Thomas avant son commit.

#### 17 à 23 — les questions du R3 (Thomas, 2026-09-29)

Relevé dans [lot-R3.md](rebranding-preuves/lot-R3.md) :

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

#### 24 à 26 — la nouvelle identité de logo (Thomas, 2026-09-29)

Envoyée en image pendant le R3a (« voilà ce que je veux comme identité de logo ») : une
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

#### 27 à 30 — les questions du R4 (Thomas, 2026-09-29)

Planches dans `rebranding-preuves/lot-R4-icones*.png` :

27. **Icônes de navigation** : celles de la toile, plus, choisies sur trois
    planches successives (toutes les premières propositions retouchées à sa
    demande) : coupe (Arène), tenailles (Outils), compas (Optimizer), œuf fêlé
    (Monstres), deux compagnons (Ami), chronomètre (Speed tuning), médaillon
    actuel (Artéfacts).
28. **Paramètres prend les curseurs « Réglages » de la toile** ; l'engrenage
    va à Mécaniques.
29. **L'entrée active de la barre latérale est en braise** (fond braise
    sombre, texte et icône en braise).
30. **Le pied de page prend le logo et la mention** « Projet non officiel,
    sans affiliation avec Com2uS. » ; rien n'en est retiré. Puis, à la
    relecture (« le pied de page commence à être vraiment gros ») : une
    rangée comme la toile, liens en colonne au bureau, en encre.

#### 31 à 37 — les questions du R5, l'accueil (Thomas, 2026-09-29)

La toile propose un autre accueil ; Thomas garde le nôtre.

31. **Héros : gardé tel quel** — logo et nom en titre, « La boîte à outils
    pour Summoners War. » (pas « Forgé pour la guilde. »).
32. **Zone de dépôt seule** à droite du héros : ni l'illustration ni les
    deux boutons de la toile.
33. **Pas de bandeau de garanties.**
34. **Les douze cartes gardées** telles quelles (pas les six de la toile).
35. **« Comment ça marche » gardé** (pas « Trois coups de marteau »).
36. **Téléphone : la décision 24 tient** (même structure, resserrée).
37. **Les cartes de section prennent les icônes d'atelier** de la nav : une
    section a la même icône partout.

#### 38 à 45 — les questions du R6, Siège et Recommandations (Thomas, 2026-09-29)

Relevé dans [lot-R6.md](rebranding-preuves/lot-R6.md). Thomas garde nos
écrans, prend la carte d'ajout de la toile et les couleurs d'état.

38. **En-tête du Siège gardé** : « Défense » + compteur, côtés dans la barre
    latérale, aucune action en aplat (refonte, décision 4 précisée).
39. **Cartes d'équipe gardées** : tuiles portrait + nom + VIT + sets, pastille
    du lead, statut à la demande (« Vérifier mes speed »).
40. **Pas de panneau « Vérification du tick »** ni de sélection d'équipe.
41. **Une carte en pointillés « Ajouter une équipe » en fin de grille**, en
    plus du bouton de l'en-tête (la toile). Bureau seulement : la question
    portait sur la planche bureau, et le téléphone est gardé (45).
42. **Page Recommandations gardée** : une liste de lots de decks, analyse à la
    demande dans la carte.
43. **Couleurs d'état** au Siège et aux Recommandations : les fautes passent
    du rouge de l'élément Feu (`fire`) au rouge d'état `bad`, « pile au
    tick » de l'or du Vent à `good` ; le bleu de « au-dessus » reste. Les
    autres écrans suivent dans leur lot (R7 à R9).
44. **Icônes d'atelier dans l'écran** : état vide (bouclier ou épée selon le
    côté, icône des Recommandations), « Voir le speed tune » (chronomètre du
    Speed tuning), « Importer un deck d'offense » et « Fort contre » (épée).
45. **Téléphone gardé** : côtés dans le panneau de l'onglet Siège,
    interrupteur « Vérifier mes speed » dans la page.

#### 46 — l'avertissement passe au jaune (Thomas, 2026-09-29)

Pendant la relecture du R6 : « le orange rappelle vachement la couleur
principale de l'application, essaye une autre teinte ». En Forge, `warn`
valait exactement `accent-hover`.

46. **`warn` jaune / ocre**, dans toute l'app (c'est un jeton) : Forge
    `#F2C230`, Atelier `#7C630D`. Remplace la décision 12. Choisi sur la
    planche [lot-R6-warn-planche.png](rebranding-preuves/lot-R6-warn-planche.png)
    parmi jaune, violet (recommandé) et sarcelle, en sachant qu'en Atelier
    l'ocre lisible est proche de l'or du lead (ΔE 4). Fond doux d'Atelier
    hors construction (`#FBEDB7`) : les deux constructions du R1 donnaient une
    crème indiscernable de `panel2`. Le code et les specs appellent encore ce
    statut « orange » : `design.md` dit de lire `warn`.

#### 47 — le plan en lots, validé par Thomas (2026-09-30)

« Refais-moi un plan en lots que je valide, j'ai l'impression que je ne
valide pas ton travail », puis : « ok continue, mais je ne veux pas de
classement en RTA, ne touche pas au fonctionnel, on fait juste une refonte ».

47. **Deux arrêts par lot** (relevé, puis code avant tout commit) et un lot
    **V0** de relecture de ce qui a été commité sans être vu ; les lots R9a,
    R9b et R10 (Outils, qu'aucun lot ne couvrait) ; voir A.7. **Aucun
    changement fonctionnel** dans les lots restants : la planche `BsRTA`
    (classement S / A / B) n'est pas un modèle à suivre, seulement une source
    d'affichage. Ce qui dans une planche suppose une fonction absente de
    l'app ne se propose pas.

#### 48 à 50 — les questions du R7, la RTA (Thomas, 2026-09-30)

Relevé dans [lot-R7.md](rebranding-preuves/lot-R7.md). Thomas garde l'écran ;
seules les décisions 43 et 44 s'y appliquent.

48. **Sections gardées** : titre avec l'icône du set, sans cadre ni bandeau.
49. **Ordre des tours gardé** : pleine largeur sous les sections, en cartes.
50. **Glisser-déposer gardé** : pas d'emplacement « Déposer ici ».

L'en-tête et « Non classé » en tête de page sont gardés sans question, comme
l'en-tête du Siège (décision 38) ; dit à Thomas.

#### 51 à 54 — les questions du R8, Mon compte (Thomas, 2026-09-30)

Relevé dans [lot-R8.md](rebranding-preuves/lot-R8.md). La refonte avait déjà
reconstruit ces écrans sur sa maquette : la planche n'apporte rien qu'ils
n'aient. Thomas demande à la relecture : « est-ce que tu ne ferais pas
quelque chose qui a déjà été fait ? » — vérifié : les rouges `fire` du compte
n'avaient été touchés par aucun commit.

51. **Structure gardée** : trois inventaires, vues dans la barre latérale.
52. **Cartes de rune du jeu gardées** (pas de tableau).
53. **Icônes des vues gardées en lucide** (symboles de vue, comme les
    actions).
54. **Tuiles de l'Optimisation : une couleur par ligne** (demandé à la
    relecture) — « Héro » tout en violet, « Légend » tout en or, la ligne
    « actuelle » en braise, choisie sur planche (encre, braise, bleu ciel,
    vert). Le vert / rouge du gain ne reste que dans le plan détaillé.
    ⚠️ En Atelier, sur une légendaire, la braise foncée est quasi la couleur
    d'avant (`166 79 17` contre `166 88 12`) : dit à Thomas.

#### 55 et 56 — les questions du R9a, le Bestiaire (Thomas, 2026-09-30)

Relevé dans [lot-R9a.md](rebranding-preuves/lot-R9a.md).

55. **En-tête et filtres gardés** (titre + compteur, pastilles aux couleurs
    des éléments, tri sur la ligne de la pagination).
56. **Cartes gardées** : le gabarit de « Ma box », 10 par ligne.

Non proposés (47) : « Uniquement les miens » et « Dans ta box », qui
croiseraient le Bestiaire avec le compte.

#### 57 à 59 — les questions du R9b, Mécaniques et Nouveautés (Thomas, 2026-09-30)

Relevé dans [lot-R9b.md](rebranding-preuves/lot-R9b.md).

57. **Titres à l'encre unie, grand titre gardé** : plus de dégradé encre →
    braise (`title-gradient`, retiré) ; la spec générale suit.
58. **Sommaire des Mécaniques gardé** (liste sans cadre).
59. **Mise en page des Nouveautés gardée** (deux colonnes, changements
    étiquetés), pas de frise.

Non proposés (47) : le surlignage de la section lue (suivi du défilement)
et les grilles des sets et des effets (du contenu nouveau).

#### 60 — la question du R10, les Outils (Thomas, 2026-09-30)

Relevé dans [lot-R10.md](rebranding-preuves/lot-R10.md) : sans planche, seules
les décisions 43 et 44 s'appliquent ; une seule icône à changer.

60. **L'écran vide de l'Optimizer attend les lots de l'Optimizer** : la clé à
    molette d'`OutilsPage.tsx` (« Aucune donnée de compte chargée ») passera
    aux tenailles des Outils avec les lots 9a / 11e — même raison que le
    renommage `swforge-optimizer` (R2) : rien sur l'Optimizer avant la
    livraison de Thomas.

#### 61 à 63 — la fin du chantier (Thomas, 2026-09-30)

« Saute la partie Optimizer. »

61. **L'Optimizer sort de cette branche** : les lots 9a et 11e de la refonte,
    avec leurs points différés (renommage `swforge-optimizer`, décision 14 ;
    écran vide des Outils, décision 60), deviennent un chantier à part,
    cadré après la fusion et reparti de `main` quand la livraison de Thomas
    sera là. Le lot 12 se fait sans eux.
62. **Version 2.0.0** : nouveau nom, nouveau logo, nouvelle interface.
63. **Fusion par pull request** vers `main` ; Thomas la relit et fusionne.

Le lot 12 garde les deux arrêts de la décision 47 : 12a contrôles (rien
modifié), 12b relecture générale par Thomas sur une liste de pages, 12c
note de version montrée avant commit, 12d branche poussée et PR ouverte.

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

### R4 — la coquille · J

**Écrit au démarrage (2026-09-29)**. Intrant : planche « Icônes » et
planche 3 « Navigation et structure » de la toile ; `App.tsx` (constantes de
nav, pied de page), `Sidebar.tsx`, `SidebarCompte.tsx`, `TopBar.tsx`,
`SettingsMenu.tsx`, `pages/ComingSoon.tsx`. Décisions 9, 27 à 30.
- Icônes de nav : un composant `IconesAtelier.tsx`, au contrat de lucide.
- ⚠️ `InventaireIcon.tsx` est un **chemin interdit** (rendus du jeu à
  l'identique, refonte A.2) : il n'est pas touché ; la nav a ses propres
  icônes des trois inventaires.
- **Hors R4** : les icônes posées DANS les écrans (état vide du Siège et des
  recommandations, en-tête du Speed tuning, Bestiaire…) — elles suivent leurs
  lots d'écran, R5 à R9. Les hauteurs de la barre du haut (48) et des
  onglets gardent notre densité (décision 17).

**Résultat (2026-09-29)** — preuve [lot-R4.md](rebranding-preuves/lot-R4.md).
Icônes posées dans la barre latérale, les onglets du téléphone, le panneau de
navigation, le fil d'Ariane, la page Arène et le pied de page ; entrée active
en braise ; curseurs pour Paramètres (la rotation de l'engrenage retirée, le
fond et le libellé portent l'état) ; logo et mention en pied de page.

### R5 — l'accueil · J

**Écrit au démarrage (2026-09-29)**. Intrant : planches « Accueil » (bureau)
et « Accueil mobile » de la toile, `spec/accueil.md`, `HomePage.tsx`.
Relevé des écarts, six questions à Thomas, puis une septième sur les icônes.

**Résultat (2026-09-29)** — preuve [lot-R5.md](rebranding-preuves/lot-R5.md).
Thomas garde l'accueil (décisions 31 à 36). Seul changement : les cartes de
section prennent les icônes d'atelier de la nav (37).

### R6 — Siège et Recommandations · J

**Écrit au démarrage (2026-09-29)**. Intrant : planches `BsSiege`,
`BsRecommandations` et `BsMobileSiege` de la toile ; `spec/siege/README.md`
(l. 1–184), `speed-tick.md` (tableau des statuts), `recommandations.md`
(sections d'affichage) ; `SiegeBoard.tsx`, `SiegeTeam.tsx`, `RecoBoard.tsx`,
`RecoCard.tsx`. Relevé, puis huit questions à Thomas (décisions 38 à 45).

Un commit par décision appliquée : la carte d'ajout (41), les couleurs d'état
(43, contrastes mesurés sur les fonds où elles se posent), les icônes (44).
**Ne fait pas** : les couleurs d'état des autres écrans (RTA, Mon compte),
qui suivent leur lot ; l'outil Speed tuning ouvert en modale depuis une
équipe — c'est un écran des Outils, hors de ce lot.

**Résultat (2026-09-29)** — preuve [lot-R6.md](rebranding-preuves/lot-R6.md).
Nos écrans gardés ; trois commits : couleurs d'état (`a329378c`, contrastes
tous relevés, la VIT fautive en Forge passe de 3,58 à 5,53), icônes
d'atelier (`f3198798`), carte d'ajout au bureau (`fb770b5c`, l'équipe naît à
la place exacte de la carte, sans défilement). Choix faits sans question,
écrits dans la spec : la carte est désactivée pendant une recherche ;
« au-dessus du tick » garde le bleu de l'Eau. Défaut antérieur relevé, non
corrigé : « Aucune équipe d'défense ».

### V0 — relecture de ce qui est commité · —

Pour chaque lot commité avant d'avoir été vu (R3, R4, R6, décision 46) : la
liste de ce que Thomas regarde, écran par écran, sur son serveur de dev, dans
les deux thèmes. Ses corrections deviennent des commits propres, montrés
avant d'être commités. **Ne fait pas** : de nouveaux changements de son propre
chef.

### R7 — la RTA · J

**Écrit au démarrage (2026-09-30)**. Intrant : planche `BsRTA` de la toile,
`spec/rta/README.md`, `components/rta/`, `RtaPage.tsx`. Décision 47 : la
planche dessine un classement S / A / B, qui n'est pas repris.

**Résultat (2026-09-30)** — preuve [lot-R7.md](rebranding-preuves/lot-R7.md).
Écran gardé (48 à 50). Un commit, `2f4fc0c5` : erreurs en rouge d'état (43),
icône « Ami » d'atelier (44). Premier lot aux deux arrêts de la décision 47 :
relevé puis questions, code montré sans commit, « validé » de Thomas, commit.

### R8 — Mon compte · J

**Écrit au démarrage (2026-09-30)**. Intrant : planche `BsCompte`,
`spec/compte/` (sommaires), les dix vues capturées (Ma box, sept vues de
Runes, deux d'Artéfacts).

**Résultat (2026-09-30)** — preuve [lot-R8.md](rebranding-preuves/lot-R8.md).
Écrans gardés (51 à 53). Deux commits : rouges d'état (43) `999a4c25` ;
tuiles de l'Optimisation, une couleur par ligne (54) `d52c438e`, trois
allers-retours avec Thomas avant son « validé ».

### R9a — le Bestiaire · J

**Écrit au démarrage (2026-09-30)**. Intrant : planche `BsBestiaire`,
`spec/bestiaire.md` (l. 1–68), `BestiaryPage.tsx`.

**Résultat (2026-09-30)** — preuve [lot-R9a.md](rebranding-preuves/lot-R9a.md).
Écran gardé (55, 56). Un commit, `d3218f56` : le grimoire sur l'état « aucun
monstre » (44). Rien pour la décision 43.

### R9b — Mécaniques et Nouveautés · J

**Écrit au démarrage (2026-09-30)**. Intrant : planches `BsMecaniques` et
`BsNouveautes`, `MechanicsPage.tsx`, `ReleasesPage.tsx`.

**Résultat (2026-09-30)** — preuve [lot-R9b.md](rebranding-preuves/lot-R9b.md).
Pages gardées (58, 59). Un commit, `e8e65c92` : titres à l'encre unie (57).
Rien pour les décisions 43 et 44.

### R10 — les Outils (Speed tuning, Arène) · J

**Écrit au démarrage (2026-09-30)**. Pas de planche : relevé des décisions
43 et 44 et des contrôles hors librairie dans `SpeedTuningSection.tsx`,
`SpeedTuneModale.tsx`, `OutilsPage.tsx`, `ComingSoon.tsx`.

**Résultat (2026-09-30)** — preuve [lot-R10.md](rebranding-preuves/lot-R10.md).
Un commit, `f1870822` : le chronomètre dans la pastille de l'en-tête du Speed
tuning au téléphone (44). Rien pour 43 ni pour la librairie. L'écran vide
de l'Optimizer attend ses lots (60).

Les lots d'écran R5 à R10 sont tous passés. Restent les lots 9a / 11e de la
refonte (l'Optimizer, en attente de la livraison de Thomas) et le lot 12.
