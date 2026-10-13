# Runes — onglet Optimisation

Partie de [Mon compte — Runes](README.md).

## Onglet Optimisation — `RunesOptim`

⚠️ **À la SOURIS, un en-tête** :
« Optimisation », puis « Ce que tes meules et gemmes permettent d'améliorer,
rune par rune. ». Le plan d'une rune s'ouvre au clic sur sa tuile.

Calcule, pour chaque rune, son **potentiel maximal** et **ce qu'il faut faire**
pour l'atteindre. Calcul pur & linéaire dans [runeOptim.ts](src/lib/runeOptim.ts)
(`runePotential`, `runePlan`) — réutilisable dans un Web Worker.

> **Disclaimer** affiché en tête : c'est une optimisation d'**efficience**, pas
> forcément la bonne stat pour ton monstre.

### Potentiel = gemme optimale **puis** grind au max

Deux scénarios calculés (héroïque & légendaire, **tables classiques et antiques
distinctes**) :

- **Meules (grinds)** : chaque substat grindable porté **exactement** à son grind
  max (RES/Précision/Taux Crit/Dmg Crit **non grindables**). Une rune déjà grindée
  au-delà (ex. légendaire) est **ramenée** au max du scénario en héroïque (delta
  négatif possible).
- **Gemme** :
  - rune **non gemmée** → on choisit **le meilleur substat à remplacer** par la
    **meilleure stat grindable** (PV%/ATQ%/DEF%/VIT, sinon un flat), **sans
    doublon** (≠ principale / innée / **autres** substats) et en respectant les
    **emplacements** (slot 1 : pas de DEF ; slot 3 : pas d'ATQ) ;
    - ⚠️ **la stat du substat lui-même est candidate** : une ATQ% à 7 peut
      recevoir une gemme ATQ% (base 13 en légendaire). C'est une règle du
      jeu ; l'exclure **sous-estimerait** le potentiel quand les autres stats
      sont déjà présentes ou interdites.
      Retenue seulement si la base de gemme dépasse la base actuelle ;
  - rune **déjà gemmée** → la stat gemmée est **figée** ; seul gain possible =
    **procker au max** (porter la base de la gemme au max si elle n'y est pas
    déjà). Rien si déjà au max.
    - ⚠️ **Choix produit, pas règle du jeu.** Le jeu permet de regemmer la ligne
      gemmée avec **une autre stat** absente de la rune. On ne le propose pas
      **par défaut** : l'outil n'optimise que l'efficience, et le joueur a pu
      gemmer cette stat pour une autre raison — on ne remet pas sa décision en
      cause. Le bouton **« Autoriser un regemme différent »** (voir Modes) lève
      ce choix ; seule la ligne **déjà gemmée** peut alors changer de stat (une
      gemme par rune).
  - total de la stat gemmée = `gemMax + grindMax`.

**Toutes les tables de valeurs** (grind max & base max de gemme,
classiques/antiques, héro/légend) et l'**algorithme complet** `best()` sont dans
[feat-calcul-runes.md §4](../feat-calcul-runes.md).

### Modes

- **Gemme + meule** (défaut) : potentiel complet ci-dessus.
- **Meule seule** : garde les **stats actuelles** (aucune gemme), ne pousse que les
  meules → pour repérer les runes à **grinder en priorité**.
- **« Autoriser un regemme différent »** — bouton, **éteint par défaut**, mémorisé
  (`optim.regemLibre`). Allumé, une rune **déjà gemmée** peut voir sa ligne
  gemmée remplacée par **une autre stat** absente de la rune (mêmes exclusions et
  emplacements qu'une rune vierge) ; éteint, sa stat reste figée. **Grisé en
  « Meule seule »** : sans gemme, rien à regemmer. Même bouton dans **Courbes**,
  réglage mémorisé à part (`runesCurve.regemLibre`), comme le mode gemme/meule.
  - ⚠️ **Un réglage du CALCUL, pas un filtre** : il change le potentiel, le
    gain, le plan « Actuel | Optimisé » et la faisabilité sous « Faisable avec
    ma réserve » (la gemme réclamée peut devenir une autre). Le Résumé, lui,
    n'a pas ce bouton et reste sur la règle par défaut.

### Affichage & interactions

- **Tri** (onglets à la souris, liste déroulante au doigt — voir § Tri de la
  Liste) : Efficience actuelle (défaut) · Potentiel héroïque ·
  Potentiel légendaire · Gain héroïque · Gain légendaire. **Gain** = potentiel −
  efficience actuelle.
- **Palier** : champ % — n'affiche que les runes dont l'efficience actuelle ≥ palier
  (défaut 100 %).
  - ⚠️ **Converti au changement de mesure** (`convertirPalier` dans
    [useRuneMetric.ts](src/hooks/useRuneMetric.ts)) : « 100 » ne veut pas dire la
    même chose en efficience et en score, et garder la valeur brute déplacerait la
    coupe sans prévenir — souvent une liste vide, prise pour un bug.
  - ⚠️ **Pas de facteur de conversion, il n'en existe pas.** Sur un compte réel
    de 3 163 runes, le rapport score/efficience s'étale de **0,98 à 2,37** : la
    principale compte dans l'une et pas dans l'autre, et les tables de max
    diffèrent. Le ratio médian appliqué à un palier de 110 % laisserait passer
    **457 runes au lieu de 139**.
  - La conversion se fait donc **par rang** : on compte ce qui passait, on prend
    la valeur de la n-ième meilleure dans la nouvelle mesure. Exact pour la seule
    question que le palier pose — *où je coupe*.
  - Un palier qui ne gardait **rien** reste au-dessus du maximum : sans ça, la
    liste se remplirait toute seule au changement d'unité.
- **Sets** (`SetFilter`) et **slot** (`SlotFilter`) : mêmes composants que les
  autres onglets.
- **Runes** — le filtre antique **commun à toutes les pages de runes**,
  [AncientFilter](src/components/account/AncientFilter.tsx) : **Toutes** (défaut) ·
  **Antiques uniquement** · **Aucune antique**.
  - ⚠️ **Trois états PARTOUT, pas une bascule on/off** : garder / masquer ne
    permet pas de « n'afficher QU'ELLES ». Les antiques ont leurs **propres tables de
    max**, donc un potentiel et une efficience qui **ne se comparent pas** à ceux
    d'une rune normale : pouvoir les **isoler** autant que les écarter vaut sur
    chaque page, pas seulement ici. D'où un `Segmented` à trois crans, **unique et
    partagé** (le type, les options et `keepAncient` vivent dans le composant).
  - Le compteur et le message de liste vide rappellent le filtre actif
    (« hors antiques » / « antiques seules »), pour qu'un résultat vide ne passe
    pas pour une absence de runes.
- **Tuiles** : efficience **actuelle**, puis **Héro** et **Légend** avec leur gain
  et l'efficience cible.
  - ⚠️ **Une couleur par ligne, celle de sa rareté** : « Héro −7,1 → 133,0 % » tout en violet (`rarity-4`),
    « Légend » tout en or (`star`). Une cible colorée en vert / rouge selon
    qu'elle passe au-dessus ou en dessous de l'actuelle ferait lire la ligne en
    deux couleurs. Le signe du gain porte le sens ; le vert / rouge ne vit que
    dans le plan détaillé d'une rune (`OptimPlanBox`), un gain négatif
    n'existant d'ailleurs que hors filtre de réserve (`noDowngrade`).
  - ⚠️ **La ligne « actuelle » en braise**, mot compris, la valeur en gras
    (`text-accent`, la braise lisible) — une couleur par ligne, comme les deux
    autres. Dans la couleur de la rareté de la rune, elle se confondrait avec
    la ligne de même rareté (violette comme « Héro » sur une héroïque, orange
    près de l'or de « Légend » sur une légendaire).
  Pagination 60/page.
  - ⚠️ **DEUX grilles, une par format** (même patron que l'onglet Liste) : sous
    `lg`, **deux colonnes fixes** ; à partir de `lg`, l'`auto-fill` à 230 px. Sur
    téléphone, l'`auto-fill` retomberait toujours sur **une** colonne (une rune par
    écran) ; les deux colonnes tiennent jusqu'à ~360 px de large.
  - ⚠️ **Rendu resserré `etroit`** sous `lg` — police (`text-nano` au lieu de
    `text-xs`/`text-micro`) et cadre de rune (**34 px** au lieu de 46) réduits, pour
    que la tuile tienne à ~175 px sans se disloquer. Pas sous 30 px : le symbole de
    set gravé cesse de se reconnaître. `useMediaQuery(SOUS_LG)` est lu **une fois**
    par la liste et passé en prop — un lecteur par tuile poserait soixante
    écouteurs `matchMedia` pour la même réponse.
- **Rotation animée** des cadres, même mécanique que l'onglet Liste (clé
  positionnelle + `SPIN`).
- **Détail au clic** : plan **« Actuel | Optimisé »** (`OptimPlanBox`) — substats
  actuels à gauche (base blanche + meule orange), optimisés à droite avec **seul ce
  qui change en violet** (grind posé ou 💎 gemme/proc max).
- **Aide « ? »** sur la ligne des filtres — le composant partagé
  [HelpPopover](src/components/HelpPopover.tsx) (bulle à la souris, **panneau
  montant** au doigt), voir l'onglet Courbes § « L'aide a DEUX supports ». Elle
  détaille les deux modes, le choix de la gemme (dont le regemme différent), le gain, **le palier** (ce qu'il
  mesure et sa reconversion), **les icônes marteau/gemme** du plan, le filtre
  de réserve, **« Sans les immémoriaux »**, **« Runes utilisées »** et
  **« Marqueurs »**.

#### ⚠️ Le panneau « Options » (mobile) ne prend que huit contrôles

Comme la Liste, l'Optimisation gagne le bouton « Options » de la barre de nav sur
téléphone (`pageAPanneau` dans [App.tsx](src/App.tsx) — les vues qui étalent une
**grille de tuiles** y ont droit, pas le résumé ni les courbes). Mais **seuls
sept** contrôles y descendent : **palier**, **« Autoriser un regemme
différent »**, **filtre antique**, **« Faisable avec ma réserve »**, **« Sans
les immémoriaux »**, **« Runes utilisées »** et **« Marqueurs »**. **Sets,
slot, tri et l'aide restent dans la page**, à tous les formats.

⚠️ **« Gemme + meule / Meule seule » est en TÊTE DE LA PAGE au téléphone**,
sur toute la largeur, avant les filtres : c'est ce qui change toute la liste —
on le voit et on le bascule sans ouvrir le panneau. Au bureau, il est dans la
rangée d'options (`modeControl`, écrit une fois, posé aux deux endroits).

- ⚠️ **Au bureau, le groupe en ligne passe à la ligne tout seul**
  (`lg:flex-wrap`). Il est **un seul élément** de la rangée de filtres : sans
  retour à la ligne interne, il ne peut pas se réduire sous la largeur cumulée
  de ses contrôles, et c'est la **page** qui déborde par la droite — la
  rangée parente, elle, ne voit qu'un bloc et n'a rien à replier. Le cas se
  produit dès six contrôles, sur un écran de bureau ordinaire.
- Les contrôles sont écrits **une fois** (`optionsControls`) et posés à deux
  endroits : **en ligne au bureau** (`hidden lg:flex`, les huit, mode
  compris), **dans le panneau au doigt** (`MobileSheet`, sans le mode :
  `avecMode` faux). L'argument `large` élargit les segmentés à toute la
  largeur du panneau (`size="lg"`) ; en ligne ils restent serrés.
- ⚠️ **Dans le panneau, tout occupe la largeur — les cinq boutons aussi.**
  Les segmentés sont pleins (`size="lg"`) ; « Autoriser un regemme différent »,
  « Faisable avec ma réserve »,
  « Sans les immémoriaux », « Runes utilisées » et « Marqueurs » prennent donc
  eux aussi toute la colonne (`pleineLargeur={large}`), sinon ils pendraient
  seuls, à la largeur de leur texte, sous des contrôles pleins. En ligne au
  bureau (`large` faux) ils restent serrés.
- Sous « Runes utilisées » et « Marqueurs », le panneau montre **en
  permanence** leurs cases (grisées filtre éteint). Au bureau, elles vivent dans
  un flottant ouvert par un chevron : voir « Filtres à cases » plus bas.
- **Les deux filtres à cases sont côte à côte, sur deux colonnes.** Empilés,
  bouton + six cases + bouton + neuf cases feraient
  défiler le panneau sur plus d'un écran. Mesuré à 390 px : deux boutons de
  173 px, et chaque libellé de case tient sur une ligne. La grille porte `w-full`
  (même raison que ci-dessous) et `items-start`, car les deux listes n'ont pas la
  même hauteur. **Une seule colonne sans marqueurs** : « Runes utilisées » ne se
  réduit pas à une demi-largeur pour rien.
  ⚠️ Le conteneur bouton + cases porte `w-full` au doigt : sans lui,
  `[data-tiroir] .flex-col` (aligné à gauche) le réduit à la largeur de son
  contenu, et le bouton redevient plus étroit que ses voisins.
- ⚠️ **Le filtre antique passe en `dense` sous le panneau.** En `lg`, ses trois
  crans se partagent la largeur à égalité et « Antiques uniquement » déborderait
  son tiers (que `whitespace-nowrap` interdit de couper) ; `AncientFilter`
  active donc `dense` dès `size="lg"` (texte réduit, retour à la ligne autorisé),
  voir [AncientFilter](src/components/account/AncientFilter.tsx).
- ⚠️ Au **bureau**, les huit sont visibles dans la rangée de filtres. Le
  panneau n'existe que sous `lg`.

### Filtres à cases — `FiltreACases`

« Runes utilisées » et « Marqueurs » partagent **un seul gabarit**, le
composant `FiltreACases` de [RunesOptim.tsx](src/components/account/RunesOptim.tsx) :
un **bouton-interrupteur** qui allume le filtre, et des **`Case`** qui
choisissent ce qu'il garde, chacune suivie de son nombre de runes. Même geste,
même rendu, un seul endroit où ils pourraient diverger.

- ⚠️ **Deux supports, un par format, et aucun ne déplace ce qu'on clique :**
  - **au bureau**, un `BoutonIcone` (chevron) collé au bouton ouvre les cases
    dans un `FlottantAuto`, hors du flux. Un clic ailleurs ou Échap le ferme ;
  - **dans le panneau « Options » au doigt**, les cases sont rendues **en
    permanence** sous le bouton. Leur place est réservée, et aucun flottant ne
    s'ouvre dans le tiroir (règles descendantes `[data-tiroir]`).
- **Inactives filtre éteint** : chevron désactivé au bureau, cases grisées dans
  le panneau. Elles n'auraient aucun effet.
- Le filtre allumé avec tout coché ne retire rien : c'est le défaut.

### « Marqueurs » — le filtre des marqueurs posés en jeu

Un filtre à cases (voir ci-dessus), dans le groupe d'options : en ligne au
bureau, dans le panneau « Options » au doigt. En rangée de pastilles dans la
page, avec des libellés longs et agrandis pour le doigt, il prendrait
**quatre lignes** sur téléphone avant la première rune : c'est donc le même
bouton que « Runes utilisées ».

- **Une case par marqueur réellement posé** dans l'inventaire, plus « Sans
  marqueur », chacune avec son nombre de runes. Le libellé est **celui saisi en
  jeu**, tel quel. Un marqueur jamais nommé s'affiche « Marqueur N ». Données :
  `RuneDetail.marker` et `runeMarkerLabels`, voir
  [transverse/](../../transverse/).
- **Tout coché par défaut.** Une case **« Tous »** en tête coche ou décoche
  l'ensemble : pour ne garder qu'un marqueur, on décoche « Tous » puis on coche
  celui-là. Jusqu'à neuf cases, les décocher une à une serait fastidieux.
- ⚠️ **L'état retient ce qui est EXCLU** (`optim.marqueursExclus`), pas ce qui
  est coché, à l'inverse des périmètres. Un marqueur qui apparaît au réimport
  suivant doit arriver coché, pas décoché en silence. Une exclusion qui ne vise
  plus aucun marqueur présent ne compte pas. L'interrupteur est
  `optim.markersOnly`.
- **Masqué quand aucune rune ne porte de marqueur** (export sans marqueurs). Il
  est masqué plutôt que grisé : aucun réimport ne le rendrait utile sur un
  compte sans marqueurs. Un compte conservé avant la lecture des marqueurs est
  ignoré en entier (`ACCOUNT_SCHEMA` 7), il ne s'affiche donc jamais « sans
  marqueurs » à tort.
- Le compteur rappelle « · marqueurs », avec « (N exclus) » dès qu'une case est
  décochée. Le message de liste vide propose de désactiver « Marqueurs ».
- Il **se cumule** avec tous les autres filtres.

### « Runes utilisées » — le filtre qui regarde les decks

Un compte de 3 000 runes n'en fait jouer qu'un tiers ; les autres dorment dans le
sac. Améliorer l'une d'elles ne change **aucun combat**. Ce bouton restreint la
liste aux runes **qui jouent**.

⚠️ **Un filtre, pas un onglet** — même règle que « Faisable avec ma réserve »
ci-dessous : potentiels, gains et tris restent exactement les mêmes.

**Est utilisée** une rune posée sur un monstre présent :

- dans un **deck enregistré**, `deck_list` **tous `deck_type` confondus** —
  arène, donjons, ToA, labyrinthe, attaques de siège… ⚠️ **Aucune liste blanche
  de contenus** : Com2uS en ajoute, et un type oublié ferait passer des runes qui
  jouent pour des runes qui dorment. Sur un export réel, 19 types différents.
- dans une **défense de siège** (`guildsiege_defense_deck_*`) ;
- dans une **défense d'arène** — `defense_deck_info` (arène) et
  `server_arena_defense_deck_info` (arène de serveur), qui ne sont **pas** dans
  `deck_list`. ⚠️ Les deux n'ont pas la même forme d'`unit_id_list` : ids nus
  d'un côté, `{ unit_id, pos_id }` de l'autre.
- dans un **preset RTA** (`world_arena_rune_equip_list`).

⚠️ **« Utilisée » ≠ « équipée ».** Les presets (RTA, siège, arène, decks) ne
déplacent rien en jeu : une rune de l'**inventaire** peut très bien jouer en RTA,
et une rune posée sur un monstre qui ne joue nulle part ne joue pas. Se fier au
seul `occupied_id` aurait raté les deux cas. Pour un monstre d'un deck **sans
preset**, ce sont ses runes **actuellement portées** qui comptent : c'est avec
elles qu'il combat.

- Extraction : `parseUsedRuneIdsParPerimetre` dans
  [importAccount.ts](src/lib/importAccount.ts) → une liste de `rune_id` triée
  **par périmètre** (voir
  [transverse/](../../transverse/)).
- ⚠️ **Conservée dans IndexedDB** (`usedRuneIds`, `ACCOUNT_SCHEMA` 7) : les decks
  ne vivent que dans l'**export brut**, jamais stocké (5 à 8 Mo). Sans ça le
  filtre s'éteindrait à chaque rechargement d'un compte conservé.
- **Désactivé sans decks lus** (export sans aucun deck), avec l'explication en
  infobulle — même règle que le filtre de réserve : un bouton grisé qui dit
  pourquoi vaut mieux qu'une liste vidée sans raison. Un compte conservé sous un
  schéma antérieur n'arrive pas jusqu'ici : il est ignoré en entier, et l'app
  invite à réimporter.
- Le compteur rappelle le filtre actif (« · utilisées ») et le message de liste
  vide propose de le désactiver.
- Il **se cumule** avec tous les autres (palier, sets, slot, antiques, réserve) :
  « ce que je peux améliorer ce soir, sur des runes qui jouent » est justement la
  question qu'on pose le plus souvent.

#### Les périmètres — choisir ce qui compte

Six périmètres, tous **cochés par défaut** : le filtre garde alors exactement sa
définition ci-dessus. Une rune est gardée dès qu'**un** périmètre coché la
contient (union).

| Périmètre | Contenu |
|-----------|---------|
| RTA | presets RTA |
| Siège — attaque | `deck_list`, `deck_type` 22 |
| Siège — défense | défenses de siège |
| Arène — attaque | `deck_list`, `deck_type` 1 |
| Arène — défense | défense d'arène et d'arène de serveur |
| Autres decks | tout autre `deck_type` (donjons, ToA, labyrinthe…) |

- Un **filtre à cases** (voir « Filtres à cases » plus haut : chevron et
  flottant au bureau, cases permanentes au doigt, inactives filtre éteint). Chaque
  case est suivie de son nombre de runes (« RTA (212) »). L'état est collant
  (`optim.usedScopes`, liste blanche).
- « Désactivé sans decks lus » se juge sur **tous** les périmètres, pas sur ceux
  cochés : tout décocher n'est pas « aucun deck lu ». Cela donne une liste vide,
  que le message explique (« aucun périmètre coché »).
- Le compteur nomme les périmètres dès qu'ils ne sont pas tous cochés :
  « · utilisées (RTA, Siège — attaque) ».

### « Faisable avec ma réserve » — le filtre qui regarde le sac

Un potentiel de +20 d'efficience ne vaut rien si la meule qui l'apporte n'est pas
dans le sac. Ce bouton restreint la liste aux runes dont **le plan complet est
couvert** par la réserve de meules et de gemmes du compte.

⚠️ **Un filtre, pas un onglet.** C'est la même liste, restreinte : potentiel
héroïque, potentiel légendaire, les deux gains et le tri restent là. En faire une
vue séparée obligerait à tout y réimplémenter.

- Le **scénario suit le tri** (gain/potentiel héroïque → grade 4, sinon 5) :
  trier par gain héroïque tout en filtrant sur du légendaire n'aurait aucun sens.
  Ce grade décide des runes **gardées** et du **plan** ouvert au clic.
- ⚠️ **Mais chaque chiffre de la tuile se vérifie contre la réserve de SON
  grade**, quel que soit le tri : **Héro** contre les consommables héroïques ou
  mieux, **Légend** contre les légendaires (`dispoReserve` dans
  [crafts.ts](src/lib/crafts.ts), une par scénario). Calculés avec la seule
  réserve du grade du tri, les deux chiffres seraient faux : trié en héroïque,
  une meule héroïque ferait compter au chiffre légendaire la table légendaire
  (**surestimé** — un potentiel annoncé faisable qui ne l'est pas) ; trié
  autrement, le chiffre héroïque refuserait une meule héroïque présente
  (**sous-estimé**). Verrouillé par le test `testReserveParGrade`.
- Les plans ne sont calculés **que si le filtre est actif** — c'est plus lourd
  qu'un potentiel, et inutile tant qu'on ne le demande pas.
- Une rune **sans rien à appliquer** est écartée : la question posée est « que
  puis-je améliorer », pas « qu'est-ce qui ne bloque pas ».
- **Désactivé sans réserve connue** (compte enregistré avant `ACCOUNT_SCHEMA` 3),
  avec l'explication en infobulle : un bouton qui viderait la liste sans raison
  vaut moins qu'un bouton grisé qui dit pourquoi.
- Le compteur rappelle le filtre actif (« · faisables avec ma réserve »), pour
  qu'une liste courte ne passe pas pour une absence de runes.

⚠️ **Le plan est RESTREINT à la réserve, il n'est pas exigé en entier.** Une stat
dont le consommable manque n'est simplement pas poussée (`CraftDispo` dans
[runeOptim.ts](src/lib/runeOptim.ts)). Exiger le plan complet écarterait des
runes parfaitement travaillables : une Swift dont trois substats sur quatre
sont meulables disparaîtrait faute d'une seule meule VIT. Le gain affiché est donc
**celui qu'on peut aller chercher aujourd'hui**, ni plus ni moins — et le plan du
détail applique la même restriction, sans quoi il contredirait le chiffre.

**Marquage ligne par ligne** dans le plan (`SubLine`) : chaque substat à
travailler porte l'icône de son consommable — **marteau** pour une meule,
**gemme** pour une gemme — en **vert s'il est en réserve**, grisé sinon. Le plan
dit quoi faire, la réserve dit ce qui est à portée ; sans le croisement il
faudrait aller compter ses meules ailleurs pour savoir par où commencer.
⚠️ Une seule marque par ligne, la **gemme prime** : c'est elle qui conditionne le
reste, puisqu'elle remet le meulage du slot à zéro. Le marquage s'affiche dès
qu'une réserve est connue, filtre actif ou non.

Règles de disponibilité (grade ≥ scénario, immémoriaux valables sur tous les
sets, antique et normal étanches) : [crafts.ts](src/lib/crafts.ts).

⚠️ **Sans réserver le stock.** Deux runes qui réclament la même unique meule VIT
sont toutes deux annoncées faisables — ce qui est vrai de chacune. Compter les
quantités répondrait à une autre question (« que farmer pour toutes les faire »),
et c'est le sujet des onglets Meules et Gemmes.

#### « Sans les immémoriaux » — garder la pièce rare de côté

Une gemme ou une meule **immémoriale** va sur **n'importe quel set** : c'est le
consommable le plus rare du compte, celui qu'on garde pour la rune qui le
méritera. Tant qu'il entre dans la réserve, une rune annoncée « faisable » peut
ne l'être **qu'au prix de cette pièce-là**, sans que rien ne le dise. Ce bouton
retire ces lignes et répond donc à : *« et sans y toucher, qu'est-ce qui reste
faisable ? »*.

- ⚠️ **Un filtre de la RÉSERVE, pas du calcul.** Les lignes `setKey === null`
  sont écartées **en amont de `buildCraftStock`**, plutôt que d'ajouter un
  paramètre à `ownsCraft`/`pickCraft`. Une réserve sans immémoriaux **est** une
  réserve : la même règle de choix s'y applique, et il ne doit pas exister deux
  façons de décider ce qui est disponible — c'est déjà la raison d'être de
  `pickCraft` (voir [crafts.ts](src/lib/crafts.ts)).
- ⚠️ **Il agit même si « Faisable avec ma réserve » est éteint** : le marquage
  vert/grisé des marteaux et des gemmes du plan lit la **même** réserve. Le
  bouton n'est donc pas asservi au précédent — il n'est grisé que si aucune
  réserve n'a été lue.
- ⚠️ **Le bouton « Faisable » distingue deux causes de grisement** : réserve
  jamais lue (« réimporte ton compte ») et réserve **vidée par ce filtre-ci**.
  Sans la nuance, il accuserait l'import d'un choix fait à l'écran deux secondes
  plus tôt.
- Le compteur ajoute « · sans immémoriaux » **quand le filtre de réserve est
  actif** — c'est là seulement que le nombre de runes change.
- ⚠️ Aucun immémorial **antique** n'existe dans les données observées : le filtre
  ne change donc jamais rien pour une rune antique.

#### ⚠️ Le filtre change AUSSI le calcul — `noDowngrade`

Deux questions légitimes, deux calculs :

| Mode | Question posée | Conséquence |
|------|----------------|-------------|
| défaut | « que vaudrait cette rune si elle était **née** héroïque ? » | une rune meulée légendaire y **perd** — et ce gain négatif est l'information : l'héroïque ne lui apporte rien |
| filtre actif | « qu'est-ce que je peux **encore lui poser** ? » | seules les stats **pas encore au max** bougent, donc **aucun gain négatif** |

⚠️ Les mélanger affiche une contradiction sur la même ligne : une rune annoncée
« faisable » avec un gain négatif. Sous le filtre on regarde ce qu'on va
**réellement poser**, et on ne pose jamais une meule qui dégrade ce qui est là.

Mesuré sur un compte réel (3 163 runes) : **424 gains héroïques négatifs** en
mode par défaut, **0** sous le filtre.

Le **plan affiché suit la même règle** (`runePlan(..., noDowngrade)`), sinon il
contredirait le chiffre annoncé au-dessus. Sur une rune sans meule, les deux
lectures coïncident — l'option ne change rien là où il n'y a rien à préserver.
