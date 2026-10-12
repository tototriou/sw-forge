# Recommandations — rendu de la page

Partie de [Siège · Recommandations](README.md).

⚠️ **En-tête BUREAU** (refonte graphique, lot 7b — même règle que la RTA et
Défense / Offense) : le titre « Recommandations », le compteur, puis les
actions par `BarreActions` — **toutes en boutons quand elles tiennent sur la
ligne**, sinon **Importer** et **Créer une recommandation** visibles, dans
cet ordre, et **Tout exporter**, **Tout effacer** (séparé, en `bad`) dans le
menu « ⋯ » Plus d'actions — l'organisation de la maquette (le mainteneur : « sur la
page de reco, le rendu comme sur la maquette sur l'organisation des boutons et
leur rendu »). Importer était d'abord dans le menu. Aucune action mise en
avant. Libellés, désactivations et infobulles repris des boutons d'avant. Au
doigt, le panneau « Options » ne change pas (lot 11).

⚠️ **À la souris, une seule barre d'outils sous l'en-tête** (la maquette) :
Vue (Attaque / Défense, qui a remplacé Origine — décision 19) · filet vertical · recherche par
monstre et ses trois cases, sur la même ligne ; « Rôle » passe dessous
quand une recherche est posée.

⚠️ **À la souris, l'en-tête d'une recommandation tient sur UNE ligne**
(lot 7b, la maquette) : chevron · titre · Importée · decks · auteur, un
ressort, puis **au bout** « Analyser mes decks » (bouton **à cadre**, comme
les autres boutons à libellé de la page — il a été fantôme un temps, et ne se
lisait plus comme un bouton parmi les icônes nues : « il ne ressort pas, il ne
ressemble pas aux autres boutons »), un filet vertical et Exporter / Éditer /
Supprimer. Au doigt, il garde ses deux rangées.

⚠️ **À la souris, le crayon d'un deck quitte la ligne** (la maquette) : la
ligne n'a plus que ses quatre colonnes (chevron · offense · fort contre ·
verdict, ce dernier aligné à droite), et l'édition devient **« Éditer ce
deck » écrit en toutes lettres, en PIED du détail déplié**, à droite, sous
un filet (en édition : « Terminer l'édition de ce deck »), et **« Supprimer
ce deck » à l'autre bout, TOUJOURS présent** — plus seulement en édition
(le mainteneur, 2026-09-27 : « le bouton de suppression devrait toujours être
présent » ; la confirmation reste le garde-fou). Au doigt aussi, la
corbeille suit le crayon en permanence. Ces boutons ont un **CADRE** à la
souris, comme les autres boutons à libellé (« le bouton d'édition ne ressort
pas trop ») : `BoutonIcone` `libelleALaSouris`. Replié, un deck ne montre
donc plus d'action d'édition : on le déplie d'abord, comme dans la maquette.
C'est le MÊME bouton qu'au doigt, placé sur la 3ᵉ rangée de la grille du
deck. **En édition de la recommandation**, Ajouter un deck vide et Importer
un deck d'offense forment le **pied du tableau des decks**, à droite, en
boutons **pointillés à fond**. **« + Défense »** devient un bouton `sm`
pointillé à fond au bout de la rangée des défenses visées. Tous trois ont
été fantômes un temps (la maquette) et ne ressortaient pas (« le bouton
d'ajout de défense ne ressort pas trop »). ⚠️ **Écart assumé** : la
maquette pose « Déplier tous les decks » dans ce pied, en BAS ; il reste
en HAUT du tableau — en bas, son clic l'aurait repoussé de toute la hauteur
des decks dépliés (un clic ne déplace jamais ce qu'on vient de cliquer).

⚠️ **À la souris, UN seul bouton d'icône sur toute la page** (lot 7b —
Le mainteneur : « il faudrait revoir un peu le système de bouton de cette page… comme
tu as fait dans la maquette ») : un carré de 28 px aux coins arrondis, sans
cadre ni fond, voile au survol — chevron de la recommandation, chevron de
chaque deck, Exporter, Éditer, Supprimer (`ICONE_LG` dans
[RecoCard.tsx](../../../../src/components/siege/RecoCard.tsx)). Avant, trois
tailles et deux formes cohabitaient (24 px rond, 20 px rond, bouton étiqueté
« Consulter »), et les deux crayons étaient des `<button>` redessinés hors
librairie : ils sont désormais des `BoutonIcone`, le ✓ doré posé sur l'icône.
« Analyser mes decks » et « Déplier tous les decks » (bouton fantôme de la
librairie, plus un lien souligné) prennent la même hauteur de 28 px. Au doigt,
chaque bouton garde sa taille et sa forme d'avant (lot 11).

Puis, en édition (le mainteneur : « revoir tous les boutons de la page ») : **28 px
de haut pour tout bouton à libellé et toute pastille de filtre**, à la souris
(`BOUTON_LG`) — Ajouter un deck vide, Importer un deck d'offense, + Set,
+ Possibilité, les pastilles de verdict, « Tout afficher » (bouton fantôme,
plus un lien souligné). Le ✓ « Terminer » d'une défense devient un
`BoutonIcone`, de la taille de la corbeille voisine. Restent à part, et c'est
voulu : **« + Défense »** au doigt (la hauteur des vignettes qu'il prolonge ;
à la souris, bouton `sm` pointillé à fond, voir plus haut), les
**croix posées dans une puce** (set, propriété d'artéfact, monstre d'une
défense — `serre`, 20 px, la puce est plus petite qu'un bouton), le **crayon
posé sur le coin d'une vignette**, la **grille des sets** (icônes du jeu) et
les **liens dans une phrase** (« Chercher partout », « Effacer la
recherche »).

⚠️ **Couleurs : plus d'aplats teintés** (lot 7b — le mainteneur : « revois les
couleurs et l'affichage sur les cards, là il n'y a rien qui va »). La carte
d'une recommandation, chaque deck, chaque monstre et l'encart de synthèse se
teintaient chacun en vert / orange / rouge à 20-45 % : une page analysée
devenait un patchwork. Désormais :

- cartes **neutres** (fond de panneau, contour discret) ; le statut d'un deck
  ou d'un monstre se lit au **contour** (au doigt) et aux **pastilles** —
  même règle que les équipes de siège (décision 8) ;
- ⚠️ **les pastilles de statut sont COLORÉES en entier**, à la maquette
  (`.pill.good/.warn/.bad` : fond doux du ton, texte du ton, sans contour) —
  la pastille Verdict de chaque ligne de deck, les puces de la carte repliée
  (un deck, ou une défense en vue Défense) **et les pastilles de filtre du
  résumé d'analyse**, colorées dès le repos pour que le résumé et les decks en
  dessous parlent la même couleur (« dans le résumé d'analyse et dans les
  cards en dessous, la même couleur ») — enclenchée, une pastille de filtre
  prend en plus le contour de son ton, seul marqueur d'état. Elles étaient
  neutres, la couleur
  réduite à un point de 6 px : « les couleurs ne sont pas assez vives sur les
  vignettes de validation de decks » (le mainteneur, 2026-09-27). Non analysé :
  neutre. Le point reste dedans (son creux distingue « monstre manquant » de
  « à revoir »). `PASTILLE_STATUT` dans RecoCard.tsx ; contrastes texte /
  fond doux mesurés dans les deux thèmes, 4,63:1 au plus bas ;
- l'encart de synthèse est neutre, son icône et son titre portent la couleur ;
- jetons de sets et de propriétés d'artéfact, rapport d'import : les **fonds
  doux** (`good-soft`, `warn-soft`, `bad-soft`) avec le texte à l'encre (les
  filtres de verdict ont depuis le texte de leur ton, voir ci-dessus).
  Contrastes mesurés, 4,91:1 au plus bas
  (`warn` ocre sur `warn-soft`, Atelier — décision 46 du rebranding ; le
  rouge est `bad` depuis la décision 43, et fait 5,53 sur `bad-soft` en
  Forge) ;
- « Importée » : pastille neutre (le contour d'accent la faisait passer pour
  un élément sélectionné).
