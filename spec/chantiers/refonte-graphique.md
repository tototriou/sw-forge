# Cadrage — refonte graphique sans régression

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

## Partie A — préambule commun (le brief de chaque lot)

### A.1 Pourquoi

La refonte change l'**apparence** de l'app : navigation, boutons, densité des
pages. Les maquettes validées vivent sur la toile
`https://claude.ai/artifact/PYnjwXTKEGSou2XCdCWegE` (pages Bureau, Téléphone,
Système).

**Principe fondateur (Thomas, 2026-09-24) : ne perdre AUCUNE information ni
AUCUNE fonctionnalité présente — seulement repenser leur affichage.** Tout
ce qui s'affiche, se lit, se touche ou se déclenche aujourd'hui existe
encore après la refonte ; seules sa forme et sa place peuvent changer.
**Un ajout ou un retrait peut être PROPOSÉ, jamais décidé par un lot :
c'est Thomas qui tranche**, et seule sa décision écrite dans A.2 bis
(numérotée, datée) l'autorise.

**La contrainte qui prime sur tout le reste : aucune régression.** Une
refonte d'interface est le chantier le plus exposé à la perte silencieuse :
un bouton qu'on « simplifie », un filtre qu'on range dans un menu et qu'on
oublie de rebrancher, un état qui ne s'affiche plus au doigt. Aucune des
45 vérifications de `npm test` ne rend un écran : elles testent la logique
(`lib/`, `hooks/`), la persistance et la navigation en données, **jamais
qu'un contrôle existe encore à l'écran**. Les garde-fous de ce cadrage
comblent ce trou, et ils sont construits AVANT le premier changement
visuel (lot 0).

Périmètre mesuré le 2026-09-24 sur `6110609` (commande entre parenthèses) :

- 117 fichiers `.tsx` dans `src/` (`find src -name '*.tsx' | wc -l`) ;
- appels des composants de `src/ui/` : `Bouton` 73, `BoutonIcone` 46,
  `NumberField` 42, `ZoneCliquable` 26, `Segmented` 23, `Selecteur` 19,
  `Champ` 16, `Interrupteur` 16, `Jeton` 15, `Flottant` 12, `FlottantAuto` 11,
  `MobileSheet` 11 (`grep -rhoE '<Nom\b' src --include=*.tsx | wc -l`) ;
- 36 `font-display`, 330 classes `rounded*`, 32 hexadécimaux en dur et 8
  couleurs Tailwind natives dans les `.tsx` ; `data/couleursSection.ts`
  importé par 4 fichiers.

### A.2 Cible et périmètre

**Ce qui change** : les tokens (`src/index.css`, `tailwind.config.js`,
polices de `index.html`), le rendu interne des composants de `src/ui/`, la
coquille de navigation (`Sidebar`, `TopBar`, `MobileTabs`, `MobileNavSheet`,
coquille de `App.tsx`), la mise en page des écrans (en-têtes, barres de
filtres, espacements). Le détail de ce qui est retenu dans les maquettes est
fixé au **lot 1** et recopié ici (A.2 bis) ; tant qu'il ne l'est pas, aucun
lot visuel ne démarre.

**Ce qui ne change PAS — chemins interdits en écriture pour tout lot** :

- la logique : `src/lib/**`, `src/hooks/**`, `src/workers/**`, `src/types.ts`,
  `src/data/**` sauf `src/data/couleursSection.ts` (affichage) et
  `src/data/releases.ts` (la refonte y écrit sa note « Nouveautés ») ;
- les données et ressources du jeu : `public/**` ;
- les rendus copiés du jeu, **à l'identique** (mémoire
  `rendus-du-jeu-intouchables`) : `RuneWheel.tsx`, `RuneSlotIcon.tsx`,
  `RuneIcon.tsx`, `ArtifactSlots.tsx`, `ArtifactFrameIcon.tsx`,
  `ArtifactIcon.tsx`, `PieceDetail.tsx`, `MonsterAvatar.tsx`,
  `ElementIcon.tsx`, `GameIcon.tsx`, `InventaireIcon.tsx` ;
- les routes (`#/…`), les clés de stockage (`localStorage`, IndexedDB), les
  formats d'import/export ;
- l'**API** des composants de `src/ui/` : mêmes props, mêmes valeurs. Seul
  leur rendu change, donc aucun point d'appel n'a à bouger pour suivre.

Preuve mécanique, à chaque lot :
`git diff --name-only <base-du-lot>..HEAD -- src/lib src/hooks src/workers src/types.ts public src/components/RuneWheel.tsx …`
→ **sortie vide** (liste complète dans le script du lot 0).

**Une information portée par la FORME compte autant qu'un libellé.**
L'inventaire du lot 0 ne voit que du texte ; ce qui suit se lit sans mot
et doit survivre, sous une forme au moins aussi lisible. Chaque lot de zone
le couvre par un **test de rendu** quand l'information est exposée en sens
(texte, `title`, `aria-label`, `disabled`), sinon par le test de la logique
qui la calcule (ex. `siegeStatut`, déjà testé) ; ce qui ne se teste ni l'un
ni l'autre (une couleur seule) est listé dans la preuve du lot pour que
Thomas le regarde sur le serveur de dev :

- statut d'une équipe de siège (vert / orange / rouge) ;
- vitesse saisie ≠ runes importées (`DesyncBadge`) ;
- couleurs d'élément, de rareté, paliers d'efficience, halo d'une rune
  antique, meule en orange, icône de gemme, compteur d'améliorations d'un
  artéfact ;
- ticks canoniques 239 et 286 du speed tuning, contour `bad` d'un
  adversaire, monstre masqué grisé ;
- sélection (le marqueur unique de `design.md`), focus clavier, état
  désactivé avec sa raison en infobulle.

**Hors périmètre par défaut** : toute fonctionnalité nouvelle vue dans les
maquettes (palette Ctrl K, liste « Reprendre », « Premiers pas »). Elle
reste une **proposition** : elle n'entre dans un lot que si Thomas la
retient dans A.2 bis, sinon elle a son propre chantier.

**Les maquettes ne sont pas exhaustives.** Elles ne montrent ni la relique,
ni la fiche d'un monstre (`MonsterDetailDialog`), ni les modales de l'Optimizer
(`DamageSetupModale`, `SpeedTuneModale`), ni la création d'un monstre, ni les
rapports d'import. Ce qui n'est pas maquetté **garde son comportement et sa
structure** : on lui applique les tokens et les composants, rien d'autre.

### A.2 bis Décisions retenues

Décisions de Thomas, **2026-09-24** (lot 1), une par point de B.1 :

1. **Polices : on garde** Inter / JetBrains Mono (et Cinzel pour les
   titres, comme aujourd'hui). Pas de Geist.
2. **Arrondis des maquettes retenus** : 8 px boutons et champs, 12 px
   cartes, 14 px fenêtres, dans les deux thèmes (Forge perd l'angle vif).
3. **Menu sobre retenu** : les couleurs de section (`couleursSection.ts`)
   quittent le menu et l'accueil ; la couleur reste aux données du jeu.
   *Précisée le 2026-09-24 pour le menu bureau* : les teintes de section,
   réessayées sur les icônes, ont été écartées — Thomas préfère le menu
   neutre. Ce qui manquait, c'était de **séparer les groupes** : un filet
   entre eux, et leur intitulé (Jouer, Mon compte…) à la couleur
   principale (accent). Un trait devant l'entrée courante, essayé entre-temps
   sur un malentendu, est retiré — « on sait déjà où on est ».
   *Précisée le 2026-09-25 pour l'accueil* : après le premier passage du
   lot 5 (accueil neutre), Thomas : « j'aimais bien les couleurs sur la page
   d'accueil ». **L'accueil garde ses teintes de section** (tuiles d'icône,
   halos, couleurs des étapes) ; seul le menu est neutre.
4. **Bouton principal plein retenu** : `ton="accent"` + `fond="plein"`
   devient un aplat d'accent, un seul par écran.
   *Précisée le 2026-09-26* : **pas d'action mise en avant dans les
   EN-TÊTES d'écran** (`BarreActions`). Essayé sur « Vérifier mes speed »
   (Siège), retiré par Thomas : « ne met pas d'action en avant en fait ça
   rend pas bien ». L'aplat reste là où il est déjà (« Importer mon compte »
   de l'accueil, boutons de validation des dialogues).
5. **Regroupement du menu retenu** : Jouer (RTA, Siège, Arène) / Mon compte
   (Monstres, Runes, Artéfacts) / Outils / Ressources — toutes les entrées
   restent.
6. **Meules et Gemmes retirées du MENU tant qu'elles sont « Bientôt »**
   — [retrait #6] décidé par Thomas le 2026-09-24. Leurs routes
   (`#/compte/runes/meules`, `…/gemmes`) et leur page « Bientôt » restent ;
   elles reviennent au menu quand elles seront construites.
7. **Flèches du speed tuning : on les garde sur la ligne.**
8. **Pastille de statut retenue** pour les cartes de siège (les deux
   thèmes), à la place du fond coloré en clair. Le statut y est ÉCRIT —
   libellés de l'app (`siegeStatut`), jamais ceux inventés par les
   maquettes.
9. **Pastille de filtre active plus marquée, en couleur de l'app** :
   contour d'accent + fond d'accent à 25 % (cuivre en Forge, indigo en
   Atelier). *Amendée le 2026-09-24* : la couleur inversée d'abord retenue
   (aplat d'encre) a été écartée par Thomas après essai — un aplat blanc en
   thème sombre.
10. **Accueil : on garde l'accueil actuel, restylé** (héros, zone de dépôt,
    « Ton espace », comment ça marche, fonctionnalités, version). La
    maquette « sommaire » n'est pas retenue.
#### Décisions prises en cours de chantier (11 et suivantes)

Même forme et même portée que les dix premières ; `[retrait #n]` y est
reconnu de la même façon (cette sous-section fait partie de A.2 bis).

11. **Menu bureau comme la maquette** — demandé par Thomas le 2026-09-24,
    après le premier passage du lot 4 (« je veux que tu fasses le menu comme
    dans la maquette ») : repli en tête à côté du logo, carte du compte
    (nom, date d'export, nombre de monstres ; la carte importe), recherche
    avec l'indication `Ctrl K`, intitulés de groupe en capitales, badge
    « Bientôt » sur Arène, Paramètres en pied, et surtout **les
    sous-sections se déroulent SOUS leur entrée** au lieu de remplacer la
    liste. Le bouton « ‹ Section — revenir à toutes les sections » disparaît
    avec le second niveau qu'il remontait — [retrait #11] décidé par Thomas
    le 2026-09-24 (conséquence de la demande : toutes les sections restent
    visibles, il n'y a plus de niveau à remonter). Non repris : le point
    « nouveau » sur Nouveautés, qui demanderait de suivre ce qui a été lu —
    un ajout, à décider.
12. **Plus d'aperçu au survol** à côté du menu bureau — [retrait #12]
    décidé par Thomas le 2026-09-24 (« supprime le popup à droite du menu
    quand on hover une section »). Les sous-sections se déroulent sous leur
    entrée : le panneau doublait ce geste. Toutes restent atteignables en
    déroulant la section, au clic comme au clavier.
13. **RTA · Ma prépa (lot 6)** — choix de Thomas le 2026-09-25 :
    l'**ordre de tour reste en bas**, pleine largeur (pas le panneau latéral
    de la maquette) ; les **actions passent dans un menu « ⋯ »** (maquette) —
    « Exporter » seul reste visible dans l'en-tête, Sauvegarder, Reprendre,
    Importer une prépa et Créer un monstre dans le menu, Réinitialiser et
    Tout effacer séparés en bas ; le **champ de recherche d'ajout reste
    permanent**. Les fonctions nouvelles de la maquette (filtrer la prépa,
    pastilles de set avec compteurs, tri, vue liste) : **« on verra plus
    tard »** — non retenues, hors refonte. Bureau seulement : le panneau
    d'actions mobile ne change pas (lot 11).
    *Précisée le 2026-09-26* : « sur PC, afficher ces boutons si on a la
    place » — **toutes les actions en boutons quand elles tiennent sur la
    ligne de l'en-tête** (place mesurée, barre latérale comprise), le menu
    « ⋯ » seulement faute de place (`src/ui/BarreActions`).
14. **Siège · Défense et Offense — deux AJOUTS, faits tout de suite** —
    demandés par Thomas le 2026-09-26 (« ajoute une barre de recherche dans
    les offenses et une fonctionnalité d'export », « idem dans les
    défenses ») ; il a choisi de les faire maintenant plutôt qu'au lot 13 :
    - **recherche par monstre** : un champ filtre les équipes qui contiennent
      ce monstre (un nom, insensible aux accents) ;
    - **export en `.json` réimportable**, avec son bouton **« Importer »** :
      les équipes affichées (monstres, vitesses des runes, ticks, sets) ;
      l'import AJOUTE les équipes du fichier aux siennes.
    Spec : [../siege/README.md](../siege/README.md) § Recherche d'équipe et
    § Exporter et importer des équipes. **Fichiers permis hors A.2**, écrits
    ici avant le code (règle du lot 13) : `src/lib/siegeShare.ts` (nouveau :
    format, validation), `src/hooks/useSiegeState.ts` (ajout de
    `appendTeams`, rien d'autre) — `scripts/chemins-interdits.mjs` les
    autorise nommément.
15. **Siège · Recommandations (lot 7b) — les decks en tableau, chacun
    dépliable en sa carte détaillée** — choix de Thomas le 2026-09-26 :
    entre « garder les cartes » et « le tableau de la maquette », il a demandé
    un mélange des deux, l'a fait mettre dans la maquette (planche « Siège ·
    Recommandations — proposition mixte »), puis « pars là-dessus ». À la
    souris : une ligne par deck (offense avec les sets visés collés à chaque
    monstre · fort contre · verdict), la carte détaillée d'aujourd'hui sous la
    ligne dépliée. Au doigt, rien ne change (lot 11). Spec :
    [../siege/recommandations.md](../siege/recommandations.md) § Repli deck
    par deck.
#### Décisions prises en cours de chantier (16 et suivantes)

16. **Boutons unifiés dans toute l'app, au rendu de la maquette** — Thomas,
    le 2026-09-26 : « il faut que les boutons soient unifiés dans
    l'application », puis « surtout, je veux le même rendu que sur la
    maquette au niveau des boutons ». Fait DANS LA LIBRAIRIE, pas écran par
    écran : `md` = `.btn` (32 px), `sm` = `.btn-sm` (28 px), `BoutonIcone`
    = `.btn-icon.btn-sm`, « ⋯ » et boutons d'en-tête = 32 px, `Segmented` =
    `.seg` (32 px, crans de 26) ; le survol peint le fond (`panel2`,
    l'équivalent du `--hover` de la maquette ; `bad-soft` en danger) au lieu
    d'allumer le contour d'accent. `xs` et `serre` restent hors échelle
    (DANS un contenant plus petit). La palette reste celle de l'app (ses
    tokens), seul le gabarit vient de la maquette.
    Tout est en `lg:` ou au survol : au doigt, rien ne change (lot 11).
    ⚠️ **Les `<button>` redessinés hors librairie des lots à venir** (Runes,
    Monstres, Artéfacts, Optimizer, Speed tuning, Ressources, Paramètres —
    une cinquantaine) **passent à la librairie DANS leur lot**, après ses
    tests de rendu, comme le reste de la zone. Exceptions admises : liens
    dans une phrase, entrées de navigation, grilles d'icônes du jeu.
    Spec : [../shared/librairie-ui.md](../shared/librairie-ui.md) § Bouton.
17. **Siège · Recommandations — « Analyser mes decks » devient un bouton à
    deux états** : un clic analyse, un second masque le résultat (Thomas, le
    2026-09-26 : « une fois analysé, je veux que si on clique ça cache
    l'analyse »). Le libellé « Réanalyser mes decks », que le bouton prenait
    une fois l'analyse affichée, disparaît — [retrait #17] décidé par Thomas
    le 2026-09-26 : relancer se fait en deux clics (masquer, puis analyser),
    aucune fonction perdue. Changement de COMPORTEMENT demandé, hors du
    « affichage seulement » de la refonte. Spec :
    [../siege/recommandations.md](../siege/recommandations.md) § Confrontation
    avec mon compte.
18. **Siège · Recommandations — le curseur passe au monstre suivant** : dans
    un deck ou une défense visée en édition, un monstre choisi donne le focus
    au slot vide suivant (Thomas, le 2026-09-26 : « quand on édite une
    équipe, mets un autofocus sur le monstre suivant une fois qu'on en a
    choisi un, idem pour les défenses »). AJOUT de comportement demandé,
    fait maintenant. Fichier permis hors A.2 :
    `src/components/siege/slotVideSuivant.ts` (calcul pur, testé). Spec :
    [../siege/recommandations.md](../siege/recommandations.md) § Trois
    niveaux d'édition. **Étendue le 2026-09-27** aux équipes de Siège
    Défense / Offense (Thomas : « ah oui fais ça ») —
    [../siege/equipes.md](../siege/equipes.md) § Slot vide.
19. **Siège · Recommandations — vue Attaque / Défense à la place du filtre
    d'origine** (Thomas, le 2026-09-26 : « au lieu du tri toutes / mes recos
    / importées, mets plutôt un tri attaque / défense […] je veux des
    défenses qui ont X offenses fortes contre elles, je veux que les deux
    affichages soient possibles, sans toucher au modèle exporté ou alors
    compatible »). Vue Défense : dans chaque recommandation, une ligne par
    défense visée avec les offenses qui la battent ; même leader et mêmes
    deux autres monstres = même défense ; lecture seule (on modifie en vue
    Attaque) — trois choix de Thomas. CALCULÉE à partir des decks
    (`src/lib/recoDefenses.ts`, fichier permis hors A.2, testé) : format
    exporté inchangé. Le filtre Toutes / Mes recos / Importées et ce qui
    n'existait que pour lui (états vides, infobulle d'export filtrée) sont
    retirés — [retrait #19] décidé par Thomas le 2026-09-26 ; la pastille
    « Importée » reste. Spec :
    [../siege/recommandations.md](../siege/recommandations.md) § Vue Défense.
#### Décisions prises en cours de chantier (20 et suivantes)

20. **Mon compte · Runes (lot 8a) — filtres en menus déroulants, ajouts
    plus tard** — deux choix de Thomas le 2026-09-27, avant le code :
    - À la souris, les filtres Sets / Emplacement / Antiques deviennent
      trois menus déroulants compacts, comme la maquette, plus « Effacer
      les filtres ». Chaque menu garde les MÊMES choix qu'aujourd'hui. Au
      doigt, rien ne change (lot 11).
    - **Précisée le 2026-09-27, après essai, en deux temps** : les SETS
      d'abord ne vont pas dans un menu (Thomas : « pas très fan d'avoir des
      drop-down pour un set filtre dedans »), puis plus AUCUN filtre (« sors
      tout des boutons »). Les trois filtres restent visibles, sur une seule
      ligne à la souris, suivis d'« Effacer les filtres ». Le composant
      `Deroulant`, ajouté pour les menus, est retiré sans autre usage.
    - Les fonctions que la maquette AJOUTE sont repoussées : recherche
      texte de propriété (« VIT ≥ 20 »), pagination numérotée, courbe par
      set et « Ajouter un set », « Voir en tableau », tableau chiffré de
      comparaison et « Retirer » par compte, lien « Voir l'optimisation ».
      Elles iront au lot 13, une par une, comme pour la RTA (décision 13).
    - Non suivi : le choix Efficience / Score SW dans la page. C'est un
      réglage global du menu ⚙ —
      [../compte/runes.md](../compte/runes.md) § Choix de la mesure.
21. **Mon compte · Runes — une seule entrée de mesure dans le tri de la
    Liste** : celle du menu ⚙, qui en porte le nom (« Score » ou
    « Efficience »). Thomas, le 2026-09-27 : « il y a Score et Efficience
    mais c'est la même chose », puis « une seule entrée qui suit ⚙ ». Les
    deux entrées côte à côte permettaient aussi de classer par la mesure
    qu'on ne voit pas sur les tuiles, pour un classement presque
    identique — [retrait #21] décidé par Thomas le 2026-09-27. Un tri
    mémorisé sur l'autre mesure suit le ⚙. Une assertion d'avant le lot
    (la liste des entrées de tri) est remplacée en conséquence. Spec :
    [../compte/runes.md](../compte/runes.md) § Tri.
22. **Outils · Speed tuning (lot 9b)** — trois choix de Thomas le
    2026-09-28, avant le code :
    - « Importer un deck de siège » reste **un par camp**, posé dans
      l'en-tête de la carte du camp à côté du lead — et non un seul en tête
      de page comme la maquette : on voit quel camp il remplace.
    - **Ordre des sorts | Analyse** côte à côte (la cause, puis l'effet),
      puis **Ordre de tour** remonté juste en dessous, avant les tableaux —
      la maquette le met à côté de l'Analyse.
    - Les ajouts de la maquette (« Appliquer +3 » sur le verdict, pastille
      « 1 correction », note sous le nom, élément sur le portrait) vont au
      lot 13, à décider un par un.
    Les trois tableaux, absents de la maquette, restent ; les boutons de
    chaque monstre aussi (monter / descendre, copier en face).
23. **Ressources, Paramètres, Bientôt (lot 10)** — Thomas, le 2026-09-28,
    avant le code : les ajouts de la maquette vont au lot 13, à décider un
    par un (stats VIT / PV / ATQ / DEF sur les cartes du bestiaire, section
    en cours surlignée dans le sommaire des Mécaniques, « Voir les
    nouveautés » sur « Bientôt disponible », pagination numérotée — déjà
    candidate). Repris sans nouvelle question, et annoncé : filtres du
    bestiaire visibles (décision 20), sa barre au gabarit de « Ma box »
    (lot 8b) ; libellés de l'app gardés là où la maquette en change
    (« Correction », pas « Correctif » ; « Importer un JSON » ; « Tout
    supprimer »).
#### Décisions prises en cours de chantier (24 et suivantes — le téléphone)

24. **Téléphone · Accueil et RTA (lot 11a)** — quatre choix de Thomas le
    2026-09-28, avant le code :
    - **Accueil** : la structure est GARDÉE, resserrée au doigt (comme la
      décision 10 au bureau) — pas la liste groupée de la maquette, qui
      retirait la zone de dépôt, « Comment ça marche », les descriptions,
      « Prépa d'un ami », l'Arène et la dernière version.
    - **RTA** : les rangées compactes de la maquette (portrait, nom,
      vitesse, alerte) au lieu des cartes ; le **choix de catégorie reste
      sur chaque rangée** (au doigt, on ne glisse pas), avec le retrait.
    - **Panneau des sous-sections** (onglets RTA, Siège, Compte) : la LISTE
      de la maquette — mêmes entrées, mêmes deux niveaux, retour en haut du
      panneau — au lieu de la grille de cases.
    - **Barre du haut** : la section en petit au-dessus du nom de la page, à
      gauche, au lieu du titre centré.
    Au lot 13, à décider un par un : la loupe de recherche de la barre du
    haut (la palette Ctrl K, déjà décidée), les pastilles de filtre par
    catégorie avec compteurs en tête de la RTA, les compteurs Monstres /
    Runes / Artéfacts de l'accueil.
25. **Téléphone · Siège (lot 11b)** — trois choix de Thomas le 2026-09-28,
    avant le code :
    - **Équipes** : les trois monstres restent CÔTE À CÔTE (une équipe tient
      en une carte basse, on en parcourt vingt) — pas les rangées de la
      maquette.
    - **« Vérifier mes speed »** sort du panneau « Options » : un
      **interrupteur sur la page**, en tête, à côté du compteur d'équipes.
    - **Recommandations** : chaque deck en **rangée compacte** (offense,
      défense visée, verdict, sets dessous), la carte détaillée d'aujourd'hui
      s'ouvrant au toucher — comme le tableau du bureau (décision 15).
    Le filtre « Toutes / Mes recos / Importées » de la maquette est ignoré :
    retiré par la décision 19.
26. **Téléphone · Mon compte (lot 11c)** — quatre choix de Thomas le
    2026-09-28, avant le code :
    - **Résumés** (runes, artéfacts) : les chiffres clés dans UNE carte sur
      deux colonnes — les six gardés, la maquette n'en montrait que quatre —,
      puis chaque bloc en carte.
    - **Courbes** : ~~les filtres passent dans le panneau « Options »~~ —
      **corrigé le même jour : ils RESTENT dans la page.** La question avait
      été posée sans l'historique de `compte/runes.md` (« Pas de panneau
      « Options » ici ») : c'était déjà fait puis défait, la page ne portant
      plus qu'un graphe et deux réglages. Redemandé avec cet historique,
      Thomas les garde dans la page.
    - **Optimisation** : « Gemme + meule / Meule seule » sort du panneau,
      sur la page, en tête.
    - **Panneau « Filtrer mes runes »** : deux blocs intitulés « Filtrer » et
      « Trier », et « Effacer les filtres » y entre (décision 20).
    Au lot 13, à décider un par un : la ligne de résumé des listes (« 318
    runes · Swift, Violent · Tri : Score SW ↓ »), le bouton « Voir N runes »
    qui ferme le panneau.
27. **Téléphone · Speed tuning, Ressources, Paramètres, Bientôt (lot
    11d)** — Thomas, le 2026-09-28, avant le code : les Mécaniques (sections
    à filet, **sommaire gardé** — la maquette le retirait), les Nouveautés
    (versions à filet) et les Paramètres (blocs « Réglages » et « Mes
    données ») prennent AU DOIGT le rendu posé au bureau au lot 10, qui est
    celui des maquettes téléphone. Speed tuning, Bestiaire et Bientôt ne
    changent pas : leurs maquettes sont l'écran, plus des ajouts déjà
    candidats au lot 13.

**Ajouts décidés** (point 7 bis) : palette de recherche Ctrl K (à partir de
la recherche de pages existante, « Rechercher une page (⌘K) »), indicateur
« Sauvegardé il y a … » de la prépa RTA, notification avec « Annuler »
après une action récupérable. Ils ajoutent du COMPORTEMENT : lot 13, après
la refonte, avec sa propre spec, ses tests et sa liste de fichiers permis
hors A.2.

Forme d'une décision de retrait, et **seulement** dans cette section :
`[retrait #<n>]` sur la ligne de la décision, avec la date et « décidé par
Thomas ». `scripts/lib/inventaire-comparer.mjs` ne reconnaît que cette
forme, dans cette section ; un `deplacements.json` qui cite un numéro
absent d'ici est refusé.

### A.3 Hiérarchie des priorités

Dans l'ordre, et le suivant ne s'achète jamais au prix du précédent :

1. **aucune information ni fonctionnalité perdue** : tout ce qu'on pouvait
   faire, voir ou atteindre avant reste faisable, visible et atteignable,
   dans les deux formats et les deux thèmes ;
2. respect des règles écrites de `spec/shared/design.md` et
   `spec/shared/navigation.md` (un clic ne déplace pas, un bouton ne
   disparaît pas, cibles de 40 px, contraste mesuré…) ;
3. fidélité aux décisions de A.2 bis ;
4. cohérence visuelle entre écrans ;
5. volume du diff.

Concrètement : un contrôle qu'on ne sait pas où ranger **reste où il est**.
« Simplifier » un écran n'autorise jamais à retirer un contrôle, un état ou
une information. **Aucun lot ne retire ni n'ajoute de sa propre
initiative** : on peut déplacer (dans un menu, un panneau, un repli),
regrouper, changer la forme. Un élément déplacé reste atteignable en un
geste explicite, et sa nouvelle place est écrite (`deplacements.json`).
Un lot qui juge qu'un ajout ou un retrait améliorerait l'écran **le
propose** dans son rapport (quoi, pourquoi, ce qui serait perdu ou
gagné) ; Thomas décide ; la décision s'écrit dans A.2 bis avant qu'un
lot l'applique.

### A.4 Catégories de lots, modèles et efforts

| Cat. | Nature | Critère de réussite |
| --- | --- | --- |
| M | mécanique | diff relu, vérifications vertes |
| C | outillage | tests sur fixtures, dont un test négatif qui refuse |
| J | jugement visuel | inventaire vert, tests de rendu de la zone verts |

| Cat. | Modèle, effort |
| --- | --- |
| M | Sonnet, effort bas |
| C | Sonnet, effort moyen |
| J | Opus, effort élevé |

### A.5 Branche, chantiers voisins, fichiers transverses

- Branche **`forge/refonte-graphique`**, créée depuis `release/v1.14.0`
  (`6110609`).
- **Deux chantiers ouverts touchent l'interface** (mesuré le 2026-09-24,
  `git log --oneline release/v1.14.0..<branche> | wc -l`) :
  `forge/edition-json` (6 commits, 7 fichiers de `src/`) et
  `forge/implementation-relique` (62 commits, 26 fichiers de `src/`, dont
  l'affichage des reliques). **Un lot visuel ne démarre pas sur une zone
  qu'une de ces branches modifie encore** : il attend sa fusion, puis on
  fusionne `main` dans `forge/refonte-graphique`. Sinon la fusion
  réécrirait leur interface en ancien style, ou la nôtre effacerait leur
  travail — deux régressions possibles.
- Fichiers transverses portés par ce chantier : `src/index.css`,
  `tailwind.config.js`, `index.html`, `src/App.tsx` (coquille seulement),
  `spec/shared/design.md`, `spec/shared/navigation.md`. Un autre chantier
  qui en a besoin le signale ; on redécoupe, on ne force pas.
- **Passe responsive en cours** (CLAUDE.md) : le lot téléphone (11) se
  coordonne avec elle et ne rustine pas écran par écran.

### A.6 Quand une vérification échoue ou qu'un cas est ambigu

- **Vérification échouée → pas de commit.** On corrige la cause, jamais la
  vérification. Une entrée d'inventaire qui disparaît de son fichier n'est
  acceptée que si elle est **déplacée** : sa nouvelle place est écrite
  dans `deplacements.json` (lot 0) et on l'y retrouve — ou si Thomas a
  décidé son retrait (A.2 bis, numéro cité dans `deplacements.json`).
  Aucun autre cas.
- **Cas ambigu → on conserve le comportement actuel**, on écrit
  `<!-- À trancher -->` dans la section du lot, on pose la question à
  Thomas. Jamais de retrait « parce que la maquette ne le montre pas ».
- **Écart entre maquette et règle de spec** → la règle gagne, l'écart va
  dans le rapport du lot.
- **Les fonctionnalités se prouvent par des TESTS, jamais par des captures
  d'écran** (Thomas, 2026-09-24 : « je veux les mêmes fonctionnalités, pas
  la même chose au pixel près » ; « crée des tests unitaires si tu veux
  contrôler de ne rien perdre »). Deux mécanismes : l'inventaire (statique,
  tout le code) et les **tests de rendu** (`tests/rendu/`, par écran). Une
  première version de ce cadrage prévoyait des captures « avant/après » et
  un contrôle au pixel près : retirés, ils mesuraient l'apparence au lieu de
  ce qui compte. L'apparence change librement.
- **Un lot de zone commence par écrire les tests de rendu de sa zone, sur
  le code AVANT tout changement**, dans un commit à part : verts sur la
  base, ils décrivent ce qui existe. Il refait ensuite l'affichage ; ils
  doivent rester verts. Un test qu'il faudrait modifier pour passer = une
  fonctionnalité perdue, sauf déplacement déclaré (on met à jour le chemin
  pour la retrouver, jamais l'assertion) ou retrait décidé par Thomas.

### A.6 bis Preuves — où elles vivent, sous quelle forme

- Fichiers de preuve : `spec/chantiers/refonte-graphique-preuves/lot-<n>.md`,
  avec un H1 et la ligne
  `**Statut :** CHANTIER en cours — branche forge/refonte-graphique`. Ils
  contiennent les commandes et leurs sorties, dont celles des tests de
  rendu de la zone.
- Le message de commit cite le fichier de preuve ; il ne le remplace pas.

### A.7 Ordre, dépendances, suivi

Notation **`A → B` : B requiert A** (prérequis à gauche).

```text
0 → 1 (le lot 1 décide sur l'inventaire du lot 0, pas de mémoire)
1 → 2 → 3 → 4 (tokens, puis composants qui les consomment, puis la coquille qui consomme les composants)
4 → 5, 6, 7, 8a, 8b, 9a, 9b, 10 (un écran se refait sur la coquille finale ; entre eux, aucun ordre imposé)
3 → 14 (le thème clair se revoit sur les composants de la librairie déjà refaits)
14 → 8a, 8b, 9a, 9b, 10 (pas un prérequis technique : les écrans restants se jugent dans un thème clair déjà revu, au lieu d'être validés sur un thème qui va changer)
{5 … 10, 14} → 11 (le téléphone se fait sur des écrans bureau stables ; 9a → 11e seulement, voir B.11)
11 → 13 (les ajouts se posent sur l'interface refaite)
13 → 12 (la validation finale couvre aussi les ajouts)
```

Ordre d'exécution : 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7a → 7b → **14** → 8a → 8b
→ 9b → 10 → 9a → 11 → 13 → 12. (Le lot 14 est ajouté le 2026-09-26, à la
demande de Thomas ; placé après 7b pour ne pas couper un lot d'écran en cours.)
**9a reporté après 10** (Thomas, 2026-09-28 : « saute l'Optimizer, on le fera
à la fin, j'attends une livraison sur cette partie-là ») : l'écran va changer
par un autre travail, le refaire avant serait à refaire. Il reste un
prérequis du lot 11 (`{5 … 10, 14} → 11`) : si la livraison n'est pas là
quand 11 commence, le téléphone de l'Optimizer attend 9a, le reste avance.

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 garde-fous : inventaire, chemins interdits, tests de rendu | C | exécuté | 2026-09-24 |
| 1 décisions retenues (avec Thomas) | J | exécuté | 2026-09-24 |
| 2 tokens : rayons, texte sur accent | J | exécuté | 2026-09-24 |
| 3 `src/ui/` : rendu interne, API inchangée | J | exécuté | `837efc0` (tests avant), 2026-09-24 |
| 4 coquille bureau : barre latérale, barre du haut | J | exécuté, validé (bureau) | `a68260a` (tests avant), `b4ecf52`, second passage `7887b6b` (décision 11), ajustements `f285763`…`79066a8` ; validé par Thomas le 2026-09-25 |
| 5 Accueil | J | exécuté, validé | `b5a0418` (tests avant), `4ebcf70`, couleurs remises `834ad3a` ; validé par Thomas le 2026-09-25 |
| 6 RTA | J | exécuté, validé (bureau) | `ef35074` (tests avant), `1ef4103` (Menu), `501699a`, `ca0d435`, hauteurs `b5bf247`, `BarreActions` `4121a71` + `1c05c06` ; validé par Thomas le 2026-09-26 |
| 7a Siège · Défense et Offense | J | exécuté, validé (bureau) | `553a709` (pastille), `f637bba`, `a39c836` (en-tête), ajustements `7587749`…`e3e00cf` ; validé par Thomas le 2026-09-26 |
| 7b Siège · Recommandations | J | exécuté, validé (bureau) | `40cd2d8` (tests avant), `cddede4` (décision 15), `439dfa6` (tableau), `f04845c` (en-tête), ajustements `c06d36d`…`4b40d07` (décisions 16 à 19) ; validé par Thomas le 2026-09-27 |
| 14 thème clair (Atelier) : revoir les tokens | J | exécuté, validé | `03fbe84` (tokens), `85f3c9e` (teintes claires de l'accueil) ; fonds, bordures « intermédiaires » et encres de la maquette, accent indigo gardé (choix de Thomas) ; preuve `lot-14.md` ; validé par Thomas le 2026-09-27 |
| 8a Compte · Runes | J | exécuté, validé (bureau) | tests avant `dd0151b` (114) ; décisions 20 et 21 ; 8a-1 filtres (`f010f55`…`d310592`), 8a-2 Résumé et Liste (`84e07ed`, `989f8f5`), 8a-3 Courbes, Comparaison, Optimisation (`8dd9dba`), bulles de l'app (`c87c8f1`, `aaaac28`, `c094446`) ; validé par Thomas le 2026-09-27 |
| 8b Compte · Monstres, Artéfacts | J | exécuté, validé (bureau) | tests avant `bb30d06` (59) ; décision 20 reprise ; box (`2227712`, `aee4db2`, `6c35a1b`), artéfacts (`ec5ec31`), tests (`2498f8b`) ; validé par Thomas le 2026-09-28 |
| 9a Outils · Optimizer | J | reporté après 10 | attend une livraison sur l'Optimizer (Thomas, 2026-09-28) |
| 9b Outils · Speed tuning | J | exécuté, validé (bureau) | tests avant `f5cc897` (48) ; décision 22 (`f3c1715`) ; écran (`0f5e4c8`, `0e7a69a`) ; une assertion recomptée (import 2 → 4) ; validé par Thomas le 2026-09-28 |
| 10 Ressources, Paramètres, Bientôt | J | exécuté, clos (bureau) | tests avant `96b74e9` (81) ; décision 23 (`6f90edd`) ; Bestiaire `cf11209`, Mécaniques `9779379`, Nouveautés `c99c99c`, Paramètres `9c7da0c` ; deux assertions assouplies (titre en tête) ; clos sur « continue » de Thomas le 2026-09-28 |
| 11a Téléphone · Accueil, RTA | J | exécuté, clos | tests avant `8d2552b` (37, `auTelephone`) ; décision 24 (`8ab9ebf`) ; barre `8ce6f6b`, panneau `e249feb`, accueil `96a1e5e`, RTA `54049bf` ; 9 titres attendus suivent la barre ; clos sur « ok continue » le 2026-09-28 |
| 11b Téléphone · Siège | J | exécuté, clos | tests avant `9a421af` (30) ; décision 25 (`29f33f1`) ; interrupteur `afc5e8e`, decks `220ab28` ; une assertion suit le panneau ; clos sur « ok continue » le 2026-09-28 |
| 11c Téléphone · Mon compte | J | exécuté, clos | tests avant `17c0ffb` (23) ; décision 26 (`74b1cb4`, corrigée `0b19997`) ; panneau runes `170861d`, Optimisation `8597bb6`, résumés `7bb9787` ; deux assertions suivent les panneaux ; clos sur « ok continue » le 2026-09-28 |
| 11d Téléphone · Speed tuning, Ressources, Paramètres, Bientôt | J | à faire | |
| 11e Téléphone · Optimizer | J | après 9a | |
| 13 ajouts décidés : palette Ctrl K, « Sauvegardé il y a … », « Annuler » | J | à faire | |
| 12 validation finale et fusion | M | à faire | |

## Partie B — les lots

### B.0 Lot 0 — garde-fous · C

**Intrant** : `src/**/*.tsx`, `tests/index.ts`, `tests/run.mjs`, le skill
`run-sw-forge` ; rien d'autre.

**Sortie** :

1. `scripts/inventaire-ui.mjs` — pour chaque `.tsx` de `src/`, extrait les
   points d'entrée visibles : textes JSX, props `label`, `libelle`,
   `libelleCourt`, `title`, `aria-label`, `placeholder`, et les routes
   `#/…`. Sortie JSON triée, déterministe (deux exécutions = même octet).
2. `spec/chantiers/refonte-graphique-preuves/inventaire-reference.json` —
   l'inventaire de `6110609`, figé.
3. `spec/chantiers/refonte-graphique-preuves/deplacements.json` — vide au
   départ : `{ "<entrée>": { "de": "<fichier>", "vers": "<fichier>" } }`,
   ou `{ "de": "<fichier>", "retrait": "A.2 bis #<n>" }` quand Thomas a
   décidé le retrait — la vérification refuse un numéro absent de A.2 bis.
   *Ajout du lot 4* : `"devient": "<entrée>"` quand l'entrée change de
   NATURE sans disparaître (une entrée cliquable devenue titre de groupe) ;
   c'est cette forme qu'on doit retrouver dans `vers`. `"pourquoi"` : texte
   libre, ignoré par la comparaison.
4. Vérification `refonte-inventaire` enregistrée dans `tests/index.ts` :
   **échoue si une entrée de la référence manque** de l'inventaire courant,
   et échoue aussi si une entrée de `deplacements.json` est absente de son
   fichier `vers` (un déplacement déclaré mais pas fait est une perte).
   Une entrée nouvelle est acceptée.
5. `scripts/chemins-interdits.mjs <base>` : `git diff --name-only` sur la
   liste de A.2 ; code de sortie 1 si non vide.
6. Tests de rendu : `tests/rendu/outils-rendu.tsx` affiche un vrai
   composant avec des données d'exemple (`react-dom/server`, sans
   navigateur) et l'interroge sur le SENS — texte visible, boutons avec
   `aria-label`, `title`, `disabled` — jamais sur les classes ou la
   disposition. Premier écran couvert : Siège · Défense et Offense
   (`tests/rendu/siege.test.tsx`), qui fixe le modèle des suivants. Les
   autres écrans sont couverts par leur lot de zone, AVANT d'y toucher
   (A.6).

**Preuve** : `node tests/run.mjs refonte-inventaire` vert sur `6110609` ;
**test négatif** : retirer un libellé d'une copie de fixture fait échouer la
vérification avec le nom de l'entrée ; `scripts/chemins-interdits.mjs` rend
0 sur un diff vide et 1 sur un diff qui touche `src/lib/`.

**Ne fait pas** : aucun changement visuel, aucun fichier de `src/` modifié.

**Résultat (2026-09-24)** — les six points livrés ; preuve
[lot-0.md](refonte-graphique-preuves/lot-0.md). Référence : 80 fichiers,
1 756 entrées. Preuve négative sur le vrai code : un libellé altéré et un
fichier de `src/lib/` touché sont refusés, fautif nommé. Limite mesurée de
l'inventaire : un texte construit par une fonction (`LeadPill`,
`title={leadTitle(ls)}`) lui échappe — les tests de rendu le voient (le
bonus du leader « +33% (donjon) » s'affiche dans le rendu du siège). Tests
de rendu du siège : 36 vérifications vertes ; « Tout effacer » renommé dans
le vrai composant → le test échoue en nommant le bouton perdu.

*Amendement (2026-09-24)* : le point 6 prévoyait des captures d'écran de
chaque route ; faites puis **abandonnées sur décision de Thomas** au profit
des tests de rendu (A.6). Script et images supprimés.

### B.1 Lot 1 — décisions retenues · J (avec Thomas)

**Intrant** : les maquettes (toile), l'inventaire du lot 0, `design.md` et
`navigation.md` par sections (`spec-toc`).

**Sortie** : A.2 bis rempli — une ligne numérotée par changement proposé,
avec « retenu / écarté », la règle de spec qu'il touche, et pour tout
ajout ou retrait **la décision de Thomas, datée**. Par défaut (sans
réponse), on garde l'existant. Points déjà identifiés comme **à trancher**
(les maquettes s'écartent de l'existant) :

1. polices Geist / Geist Mono à la place d'Inter / JetBrains Mono ;
2. rayons 8 / 12 / 14 px (Forge perd l'angle vif) ;
3. couleurs de section retirées de la navigation (`couleursSection.ts`) ;
4. `Bouton` `accent` + `plein` devient un aplat plein ;
5. regroupement de la barre latérale (Jouer, Mon compte, Outils, Ressources) ;
6. **proposition de retrait** : Meules et Gemmes ôtées du menu bureau tant
   qu'elles sont « Bientôt » (gain de hauteur). Sans décision de Thomas :
   elles restent, sous une forme compacte (repli, marque « Bientôt ») ;
7. **proposition de retrait** : flèches monter/descendre de la ligne du
   speed tuning. Sans décision de Thomas : elles restent accessibles, au
   besoin déplacées (menu « … » de la ligne) ;
7 bis. **propositions d'ajout** : palette Ctrl K, indicateur « Sauvegardé
   il y a … », notification avec « Annuler ». Sans décision : hors
   chantier ;
8. fond coloré des cartes de siège en clair remplacé par une pastille
   (l'information de statut reste, voir A.2 « forme ») ;
9. pastille de filtre active en couleur inversée ;
10. accueil en sommaire (le « Ton espace » actuel devient une liste chiffrée).

Les libellés **inventés** par les maquettes (statuts de siège, tris du
panneau Options) ne sont pas retenus : on garde ceux de l'app.

**Ne fait pas** : aucun code.

**Résultat (2026-09-24)** — les dix points tranchés par Thomas, recopiés dans
A.2 bis. Écarts aux maquettes à retenir par les lots suivants : polices
inchangées (1), accueil actuel conservé (10). Un seul retrait, [retrait #6]
(Meules et Gemmes hors du menu, routes conservées). Trois ajouts, isolés au
lot 13.

### B.2 Lot 2 — tokens · J

**Intrant** : `src/index.css`, `tailwind.config.js`, `index.html`,
`design.md` § Tokens, § Contraste.

**Contrat** : mêmes **noms** de tokens (aucune classe à renommer dans les
`.tsx`) ; chaque valeur nouvelle **mesurée** au ratio WCAG (4,5 texte, 3,0
bordures) dans les deux thèmes ; `design.md` mis à jour dans le même
commit.

**Preuve** : tableau des ratios dans le fichier de preuve ; `npx tsc
--noEmit`, `npm run build` ; chemins interdits vides ; inventaire vert ;
tous les tests de rendu existants verts.

**Ne fait pas** : ne touche aucun composant.

**Résultat (2026-09-24)** — preuve [lot-2.md](refonte-graphique-preuves/lot-2.md).
Périmètre réduit par les décisions : polices inchangées (1), palette
inchangée (hors décisions). Livré : quatre crans d'arrondi communs aux deux
thèmes (6 / 8 / 12 / 14 px), `rounded-xl` et `rounded-2xl` passés sous token
(ils étaient figés à 12 et 16 px) ; `accent-ink` pour le bouton plein du
lot 3 — blanc en Atelier (9.66), fond sombre en Forge (5.81 ; le blanc y
échouait à 3.18). Aucun `.tsx` touché ; tests de rendu et inventaire verts.

### B.3 Lot 3 — `src/ui/` · J

**Contrat** : rendu interne seulement. Les comptes d'appels de A.1 sont
**inchangés** (même commande, mêmes nombres) : si un point d'appel doit
bouger, c'est que l'API a changé — refusé.

⚠️ **Un contrôle dessiné se redimensionne en entier, jamais par sa seule
boîte.** Vu sur les maquettes (2026-09-24) : un interrupteur agrandi en
ligne gardait la pastille et la course de la petite taille — pastille
décentrée, qui n'atteint pas le bout. Toute taille de `Interrupteur` (et
de tout contrôle « dont la taille est le dessin », `design.md` § Cibles
tactiles) redéfinit piste, pastille ET course ensemble ; la cible
tactile s'élargit par `cible-tactile`, pas en gonflant le dessin.

**Preuve** : comptes d'appels avant/après, `tsc`, build, inventaire,
chemins interdits, tests de rendu verts ; un test de rendu par composant de
`src/ui/` qui porte un état (désactivé + raison, `aria-pressed`, `actif`),
écrit AVANT de le modifier.

**Résultat (2026-09-24)** — preuve [lot-3.md](refonte-graphique-preuves/lot-3.md).
Tests de rendu de `src/ui/` écrits avant (`837efc0`), verts après sans
changement. Bouton principal plein (combinaison inutilisée à ce jour : aucun
écran ne change, les lots de zone le poseront) ; marqueur de filtre actif
inversé dans une constante `MARQUEUR_FILTRE_ACTIF`. **Écart au périmètre
« `src/ui/` seulement »** : `SetFilter`, `SlotFilter` et `FilterBar`
importent ce marqueur — sinon des filtres voisins auraient porté deux
marqueurs différents (règle de design.md). Comptes d'appels identiques.
À regarder par Thomas : les icônes de set actives en thème sombre.

### B.4 Lot 4 — coquille bureau · J

**Contrat** : mêmes destinations, mêmes routes, même logique de niveau de la
barre (`navigation.md`).

**Preuve** : `node tests/run.mjs navigation`, inventaire, chemins
interdits, un test de rendu de la barre latérale et des onglets mobiles
écrit AVANT : chaque destination (libellé + route) reste présente.

**Résultat (2026-09-24)** — preuve [lot-4.md](refonte-graphique-preuves/lot-4.md).
Tests de la coquille écrits avant (`a68260a`) : l'application entière rendue
sur ses 23 routes. Barre bureau regroupée (Jouer · Mon compte · Outils ·
Ressources), icônes monochromes, Meules et Gemmes hors du menu ; structure
propre au bureau, le téléphone inchangé. Barre du haut non retouchée (rien
n'y était décidé). Premier changement de NATURE d'une entrée d'inventaire :
`deplacements.json` gagne le champ `devient`.

**Second passage (2026-09-24)** — décision 11, « le menu comme dans la
maquette ». Le contrat « même logique de niveau » est levé par Thomas : les
sous-sections se déroulent sous leur entrée (la page ne change toujours
qu'au choix d'une destination) ; carte du compte en tête, `Ctrl K`,
Paramètres en pied, badge « Bientôt ». Un retrait, [retrait #11] (le retour
de second niveau). Assertions des tests d'avant inchangées, 14 ajoutées ;
deux contrôles de source de `navigation.test.ts` suivent le mécanisme.
Détail dans la preuve.

**Ajustements et validation (2026-09-24 → 25)** — huit demandes de Thomas
après essai, un commit chacune (`f285763`…`79066a8`, tableau dans la
preuve) : icônes des sous-sections gardées, teintes de section écartées
(décision 3 précisée), groupes séparés par un filet et un intitulé en
accent, aperçu au survol retiré ([retrait #12]), résultats de recherche et
fil d'Ariane bureau au gabarit du menu. **Validé sur bureau le 2026-09-25.**
Le téléphone n'a pas été regardé : inchangé ici, il se vérifie au lot 11.

### B.5 à B.10 — écrans bureau · J

Un lot par zone (5 Accueil, 6 RTA, 7 Siège, 8a Runes, 8b Monstres et
Artéfacts, 9a Optimizer, 9b Speed tuning, 10 Ressources et Paramètres). Même
contrat pour tous :

- **intrant** : les fichiers de la zone (table « Par écran — quoi ouvrir »
  de [ARCHITECTURE.md](../../ARCHITECTURE.md)) et la spec
  de la zone par sections ; `OptimizerSection.tsx` (4 872 lignes) se lit
  par carte, jamais en entier ;
- chaque contrôle de l'écran avant le lot est **retrouvé** après : même
  libellé, même effet, dans l'écran ou dans un menu nommé dans
  `deplacements.json` ;
- **premier commit du lot** : les tests de rendu de la zone, écrits sur le
  code actuel et verts (modèle : `tests/rendu/siege.test.tsx`) — chaque
  bouton, libellé, infobulle, état désactivé, information calculée ;
- le téléphone garde toutes ses fonctionnalités (mêmes tests de rendu :
  le composant est le même) ;
- les rendus du jeu (A.2) ne sont pas touchés, seulement placés ;
- **preuve** : inventaire, chemins interdits, `node tests/run.mjs <zone>`,
  tests de rendu de la zone verts sans que leurs assertions aient changé.

**Résultat lot 5 — Accueil (2026-09-25)** — preuve
[lot-5.md](refonte-graphique-preuves/lot-5.md). Tests avant `b5a0418`
(40 vérifications), restylage `4ebcf70` : structure gardée (décision 10),
cartes de la refonte, bouton plein (décision 4), « Comment ça marche » en
une carte. Un changement de nature (bouton → `libelle`), aucune perte.
Premier passage en icônes neutres ; **couleurs remises** à la demande de
Thomas le 2026-09-25 (décision 3 précisée : accueil coloré, menu neutre) —
tuiles à la teinte de la section, halos, couleurs des étapes, mêmes valeurs
qu'avant le lot. Validé par Thomas le 2026-09-25.

**Résultat lot 6 — RTA (2026-09-25)** — preuve
[lot-6.md](refonte-graphique-preuves/lot-6.md). Décision 13 prise avant de
coder (ordre de tour en bas, actions dans un menu « ⋯ », recherche
permanente, fonctions nouvelles de la maquette non retenues). Tests avant
`ef35074` (47 vérifications, aucune assertion modifiée) ; `src/ui/Menu`
(`1ef4103`, premier usage justifié) ; en-tête bureau (`501699a`) ; sections
sans cadre et cartes de la refonte (`ca0d435`). Aucune perte, aucun
déplacement : la disposition mobile garde tous les libellés. Ajustements
après essai : « Exporter » et « ⋯ » à la même hauteur (`b5bf247`) ; sur PC,
toutes les actions en boutons quand elles tiennent (`src/ui/BarreActions`,
place mesurée — `4121a71`, `1c05c06`). **Validé par Thomas le 2026-09-26.**

**Lot 7 scindé (2026-09-26)** — ~5 200 lignes, dont 3 600 pour les
Recommandations : **7a** Défense et Offense (`SiegeBoard`, `SiegeTeam`),
**7b** Recommandations (`RecoBoard`, `RecoCard`). Même contrat pour chacun.

**Résultat lot 7a — Siège · Défense et Offense (2026-09-26)** — preuve
[lot-7a.md](refonte-graphique-preuves/lot-7a.md). Tests d'avant (lot 0)
verts sans changement. Pastille de statut écrite (décision 8, libellés
choisis par Thomas, `pastilleStatut.ts` testé), fond coloré du thème clair
retiré (`553a709`) ; en-tête bureau par `BarreActions`, comme la RTA
(`a39c836`), avec « Vérifier mes speed » en action principale à la demande de
Thomas ; axes `principal` / `actif` dans la librairie (`f637bba`). Fonctions
nouvelles de la maquette non faites. Aucune perte. Dix ajustements après
essai, un commit chacun (`7587749`…`e3e00cf`, tableau dans la preuve) :
aucune action mise en avant (décision 4 précisée), cartes resserrées et
grille selon la place, édition réorganisée (flèches ← → en haut, lignes
alignées, saisie puis conclusion, reclic pour enlever un tick, « Off »
masqué à la souris). **Validé par Thomas le 2026-09-26, sur bureau.**

**Ajouts de la décision 14 (2026-09-26), faits dans la foulée du 7a** —
spec avant le code (`b11a922`), logique `lib/siegeShare` + `appendTeams`
(`6ef0e24`, test `siege-partage`), écran : recherche, Exporter, Importer
(`bb69a00`), recherche en liste de suggestions comme ailleurs (`0e0e891`).
Fichiers hors A.2 limités à ceux nommés par la décision ; chemins interdits
vides. Validé par Thomas (« ok »).

**Résultat lot 7b — Siège · Recommandations (2026-09-26)** — preuve
[lot-7b.md](refonte-graphique-preuves/lot-7b.md). Tests avant `40cd2d8`
(37 vérifications ; une assertion recalée, pas assouplie — le compte de
« Fort contre » hors de la rangée d'intitulés). Décision 15 prise sur une
planche « proposition mixte » ajoutée à la maquette : à la souris, les decks
en tableau (offense avec sets visés, fort contre, verdict), la carte
détaillée d'avant sous une ligne dépliée (`439dfa6`) ; en-tête par
`BarreActions` (`f04845c`). Aucune perte. Puis onze ajustements demandés par
Thomas (`c06d36d`…`4b40d07`, tableau dans la preuve), dont les décisions 16
(boutons de toute l'app au gabarit de la maquette, dans `src/ui/`), 17
(« Analyser » à deux états, [retrait #17]), 18 (curseur au monstre suivant)
et 19 (vue Attaque / Défense à la place du filtre d'origine, [retrait #19]).
Tests d'avant le lot inchangés, sauf les trois du filtre retiré. **Validé
par Thomas le 2026-09-27.**

#### Lot 8a — Mon compte · Runes

**Découpage, écrit AVANT le code (2026-09-27).** L'intrant fait environ 4 000 lignes de composants, 1 136
de spec (`spec/compte/runes.md`, lue par sections) et cinq planches de
maquette. C'est trop pour un seul passage sans dégrader les derniers
écrans. Trois sous-lots, dans cet ordre, chacun validé par Thomas avant le
suivant :
- **8a-1 — les filtres** (décision 20, précisée) : `SetFilter`,
  `SlotFilter`, `AncientFilter` visibles sur UNE ligne à la souris, plus
  « Effacer les filtres ». Ils sont partagés par la Liste, les Courbes et
  l'Optimisation. Les menus déroulants de la maquette ont été essayés,
  puis défaits par Thomas.
- **8a-2 — Résumé et Liste** : le Résumé en barres et tableaux (planche
  « Résumé ») ; l'en-tête, le tri et la pagination de la Liste. Les
  tuiles, rendus du jeu, sont seulement placées.
- **8a-3 — Courbes, Comparaison, Optimisation** : l'Optimisation en
  tableau ; les graphes restent les mêmes, placés dans les cartes de la
  refonte.

Tests avant : `dd0151b` (114 vérifications, `tests/rendu/runes.test.tsx`).
Ils valent pour les trois sous-lots.

**Résultat lot 8a — Mon compte · Runes (2026-09-27)** — preuve
[lot-8a.md](refonte-graphique-preuves/lot-8a.md).
- **8a-1, les filtres** : trois essais avant l'état final (menus
  déroulants, puis sets visibles, puis tout visible), avec les filtres sur
  une ligne au gabarit du `Segmented` et « Effacer les filtres ». Le tri de
  l'Optimisation est en onglets, celui de la Liste en liste déroulante, au
  même endroit, au-dessus de la propriété. Décision 21 : une seule entrée
  de mesure, [retrait #21].
- **8a-2** : Résumé en bandeau et en trois colonnes, « Par emplacement »
  en barres, en-tête de la Liste, flèches du `Pager` dans la librairie.
- **8a-3** : en-têtes, graphe et légende « Séries » côte à côte.
- **Bulles de toute l'app** : l'infobulle du graphe aux tokens,
  `HelpPopover` rembourrée et bornée, les deux dernières bulles maison
  passées au `Flottant`.

Tests d'avant inchangés, sauf un, remplacé par la décision 21. Tests
ajoutés : 21 vérifications, 135 au total. Aucune perte. Non repris, pour le
lot 13 : les ajouts de la décision 20 et le plan d'optimisation dans chaque
carte. **Validé par Thomas le 2026-09-27.**

**Résultat lot 8b — Mon compte · Monstres et Artéfacts (2026-09-28)** —
preuve [lot-8b.md](refonte-graphique-preuves/lot-8b.md). Décision 20
reprise telle quelle, annoncée à Thomas avant le code.
- **Box** : en-tête « Ma box » ; une barre unique essayée puis défaite
  (« ça va pas ») ; état final en trois lignes : recherche, filtres, puis
  le tri « à la suite des filtres » avec la pagination.
- **Artéfacts** : en-têtes « Résumé » et « Liste », chiffres clés en
  bandeau, les six rangées de filtres sur la ligne.

Tests d'avant inchangés ; 3 vérifications ajoutées, 62 au total. Aucune
perte. Non ajouté, pour le lot 13 : « Effacer les filtres » hors des runes.
**Validé par Thomas le 2026-09-28.**

**Résultat lot 9b — Outils · Speed tuning (2026-09-28)** — preuve
[lot-9b.md](refonte-graphique-preuves/lot-9b.md). Décision 22 avant le
code. À la souris : titre au gabarit des pages, import de deck en tête de
chaque camp (en-tête sur deux lignes dans les deux camps, après un retour
de Thomas), ordre de tour sous l'analyse. Tests avant `f5cc897` (48) ; une
assertion recomptée, import 2 → 4 (une copie par format). Aucune perte.
Hors refonte, noté : le mode RTA (1,5 % par tick), chantier à ouvrir.
**Validé par Thomas le 2026-09-28.**

**Résultat lot 10 — Ressources, Paramètres, Bientôt (2026-09-28)** — preuve
[lot-10.md](refonte-graphique-preuves/lot-10.md). Décision 23 avant le code.
À la souris : Bestiaire en-tête et barre de « Ma box », Mécaniques en deux
colonnes (sommaire fixe), Nouveautés une version par rangée, Paramètres en
deux blocs intitulés. Aux deux formats, les derniers contrôles dessinés à la
main de ces pages passent sur la librairie. Tests avant `96b74e9` (81) ;
deux assertions assouplies (« contient » : le titre de page passe en tête).
Aucune perte. Reportés, hors refonte : deux textes de la page Mécaniques
(`spec/mecaniques.md`). **Clos sur « continue » de Thomas le 2026-09-28.**

### B.11 Lot 11 — téléphone · J

**Contrat** : `navigation.md` § Barre d'onglets et § Panneau d'actions
mobile s'appliquent tels quels (panneau de sous-sections, bouton Options,
pas de sous-onglets dans la page). Tous les tests de rendu restent verts.
Se coordonne avec la passe responsive (A.5).

**Découpage, décidé avec Thomas le 2026-09-28, avant le code** — même
raison que les lots bureau : 23 maquettes téléphone (`Mobile-*` sur la
toile) et tous les écrans. Un sous-lot par zone, chacun validé par Thomas
avant le suivant :

- **11a** Accueil et RTA (`Mobile-Accueil`, `Mobile-Rta`, `Mobile-Rta-Ami`,
  `Mobile-Menu-Compte`) ;
- **11b** Siège (`Mobile-Siege-Defense`, `-Offense`, `-Recos`) ;
- **11c** Mon compte (`Mobile-Monstres`, `Mobile-Runes-*`,
  `Mobile-Options-Runes`, `Mobile-Artefacts-*`) ;
- **11d** Speed tuning, Ressources, Paramètres, Bientôt ;
- **11e** Optimizer — **après le 9a** (`{9a} → 11e`), lui-même en attente
  d'une livraison.

Pour chacun, comme B.5 à B.10 : **premier commit** = tests de rendu de la
zone au format téléphone (panneaux « Options » ouverts, `menuOuvert`), sur
le code actuel ; décisions de maquette soumises à Thomas avant le code ;
preuve `lot-11x.md`. ⚠️ **Rien de ce qui est fait à la souris ne bouge** :
une correction destinée au téléphone passe par les variantes sous `lg`
(`max-lg:`, `lg:hidden`), jamais par une classe sans préfixe partagée avec
le bureau.

**Validation** : Thomas regarde en **mode appareil du navigateur**, sur son
serveur de dev habituel.

**Branches voisines (A.5), relevé du 2026-09-28** : `forge/edition-json`
(App.tsx, accueil, page Outils) est **abandonnée pour l'instant** (Thomas) —
elle ne bloque pas 11a ; c'est elle qui s'adaptera à sa reprise.
`forge/implementation-relique` touche l'Optimizer (d'où 11e après 9a) et
`MonsterGear.tsx` : avant 11a, vérifier si l'écran RTA le monte, et le
laisser à l'identique si oui.

### B.13 Lot 13 — ajouts décidés · J

Les trois ajouts de A.2 bis (palette Ctrl K, « Sauvegardé il y a … »,
notification « Annuler »). **Seul lot autorisé à ajouter du comportement.**

**Candidats repoussés par la décision 20** (Runes, 2026-09-27), à décider
un par un avec Thomas avant d'entrer dans ce lot :
- recherche texte de propriété dans la Liste (« VIT ≥ 20 ») ;
- pagination numérotée ;
- courbe par set et « Ajouter un set » ;
- « Voir en tableau » des Courbes ;
- tableau chiffré de comparaison entre comptes et « Retirer » par compte ;
- lien « Voir l'optimisation » depuis le Résumé ;
- dans l'Optimisation, le plan écrit DANS chaque carte, toujours visible
  (la maquette), au lieu du panneau qui s'ouvre au clic — relevé au lot
  8a-3 ;
- « Effacer les filtres » dans la box et la liste d'artéfacts, comme pour
  les runes — proposé au lot 8b, resté sans réponse ;
- Speed tuning (décision 22) : « Appliquer +N » sur le verdict de
  l'analyse, pastille du nombre de corrections, note sous le nom du
  monstre (sort retenu), élément sur le portrait ;
- Ressources (décision 23) : stats VIT / PV / ATQ / DEF sur les cartes du
  bestiaire, section en cours surlignée dans le sommaire des Mécaniques,
  « Voir les nouveautés » sur « Bientôt disponible » ;
- Téléphone (décision 24) : pastilles de filtre par catégorie avec
  compteurs en tête de la RTA, compteurs Monstres / Runes / Artéfacts sur
  l'accueil ;
- Téléphone (décision 26) : ligne de résumé en tête des listes (compte,
  filtres posés, tri), bouton « Voir N runes » qui ferme le panneau.

Ils ne sont pas décidés : sans accord de Thomas, ils ne se construisent pas.

**Contrat** : avant tout code, la spec de chaque ajout dans la spec de sa
zone (`spec/shared/navigation.md` pour la palette, `spec/rta/` pour
l'indicateur, `spec/shared/design.md` pour la notification) ; la liste des
fichiers permis hors A.2 écrite dans cette section, dans le même commit que
la spec, AVANT le code. La palette part de la recherche de pages existante
(`SidebarSearch.tsx`, « Rechercher une page (⌘K) »), elle ne la remplace
pas par une seconde. « Annuler » ne s'applique qu'à une action
récupérable (`design.md` § Ce qui se confirme).

**Preuve** : tests de la logique ajoutée, tests de rendu des trois ajouts,
inventaire (entrées nouvelles seulement), tous les tests de rendu existants
verts.

### B.14 Lot 14 — thème clair (Atelier) · J

Ajouté le 2026-09-26 à la demande de Thomas : « ajoute un lot pour revoir le
thème clair, il faut revoir ça ». Exécuté après 7b, avant les écrans
restants (A.7).

**Intrant** : les valeurs du thème clair (`src/index.css`, bloc `:root` hors
Forge ; `tailwind.config.js`), `spec/shared/design.md` § Tokens et
§ Contraste (par `spec-toc`), le thème clair de la maquette (`css.txt` de la
toile, `.sf[data-theme=light]`), et la **liste des défauts relevés par
Thomas** — rien d'autre.

**Déroulé** :
1. **Relevé, avant tout code** : un tableau token par token — valeur de l'app,
   valeur de la maquette, écart — et les défauts vus par Thomas (lui demander
   ce qui le gêne, écran par écran s'il le faut). Premier écart déjà vu : le
   fond de page de l'app (`--bg` `223 227 237`, `#DFE3ED`, un gris-bleu
   soutenu) contre `#F6F6F8` dans la maquette.
2. Les valeurs retenues sont **proposées à Thomas** (le tableau, avec les
   contrastes), puis appliquées.
3. Chaque couple texte / fond et contour / fond du thème clair est **mesuré**
   (WCAG : 4,5:1 pour le texte, 3:1 pour un contour ou une icône porteuse de
   sens), y compris les couleurs d'élément et de statut sur les nouveaux
   fonds.

**Contrat** : seules les VALEURS du thème clair changent. Le thème sombre
(Forge, `--forge-*` et ses deux déclencheurs) n'est **pas touché** ; aucun
composant, aucune classe, aucun rendu du jeu (A.2) ne bouge. Un défaut qui ne
se corrige pas par un token (une classe en dur, un fond oublié) est **listé**
dans la preuve avec son fichier et va au lot de sa zone — il n'est pas corrigé
ici.

**Preuve** (`refonte-graphique-preuves/lot-14.md`) : le tableau avant / après
de chaque token modifié, la sortie du script de contraste (tous les couples au
seuil), `node tests/run.mjs rendu refonte` vert, build, chemins interdits ;
la liste des écrans à regarder en thème clair sur le serveur de dev.

**Ce que le lot ne fait PAS** : ni le thème sombre, ni la mise en page, ni les
rayons (décision 2), ni les couleurs de section de l'accueil (décision 3
précisée) — seulement leur lisibilité sur le nouveau fond, mesurée.

**Résultat lot 14 — thème clair (2026-09-27)** — preuve
[lot-14.md](refonte-graphique-preuves/lot-14.md). Relevé app / maquette, puis
deux choix de Thomas : bordures « intermédiaires », accent indigo gardé.
Changent, dans le bloc clair seulement :
- depuis la maquette : `bg` (`#DFE3ED` → `#F6F6F8`), `panel2`, `border-soft`,
  les trois encres (neutres) et `warn-soft` ;
- `border` : un cran plus marquée que celle de la maquette ;
- le halo de page, désormais blanc.

Aucune ligne `--forge-*` touchée. Contrastes mesurés :
- le texte gagne partout, `ink-dimmer` passe 4,5 sur le fond de page (4,01 →
  4,72) ;
- vent et paliers or / gris restent un peu sous 4,5 hors `panel`, arbitrage
  étendu dans design.md ;
- `panel2` / `bg` passe de 1,15 à 1,04, choix de la maquette : c'est la
  bordure qui sépare.

`design.md` : la colonne Atelier est réalignée sur le code, dont elle avait
décroché. Défaut préexistant relevé par la mesure : les couleurs de section
de l'accueil, des hex fixes pensés pour le sombre, passent sous 3:1 en clair
(neuf sur douze). D'abord listé, il est corrigé à la demande de Thomas
(« effectivement pas très lisible ») : une variante claire par couleur
(`TEINTE_CLAIRE`, ≥ 3,2:1), choisie en CSS selon le thème ; l'accueil
seulement, la navigation du téléphone relève du lot 11. **Validé par Thomas
le 2026-09-27.**

### B.12 Lot 12 — validation finale · M

`npm test` complet (inventaire et tous les tests de rendu compris), `tsc`,
build ; relecture des déplacements déclarés et des retraits décidés
(A.2 bis) ; Thomas vérifie sur le serveur de dev ce qui ne se teste pas
(liste des preuves de zone) ; fusion.
