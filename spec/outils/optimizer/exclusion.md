# Exclusion des runes déjà portées ailleurs

**Statut :** ÉTAT ACTUEL — décrit l'exclusion des runes déjà portées ailleurs et les runes imposées
**Lire si :** on modifie le panneau « Options » : exclusion automatique, exclusion manuelle ou runes imposées

⚠️ **Au doigt, dans le panneau « Options »** (bouton de la barre de nav),
EN TÊTE — avant « Réglages avancés » (voir
ecran/conditions-et-reglages.md § Réglages avancés) : fonctionnalité
vedette, mise en avant côté bureau par sa carte à bordure accentuée.

**« Exclure les runes déjà utilisées »**, interrupteur DÉSACTIVÉ par
défaut : la recherche porte alors sur l'**inventaire entier** — y compris des runes qu'il faudrait
retirer d'un autre monstre pour composer le build proposé. ⚠️ **Icône** : la
roue de runes (le fond derrière les runes des cartes de résultat, voir
`RuneWheel.tsx`), barrée du symbole « interdit » — même traitement que les
deux autres icônes de cette section.

Ne pas l'activer par défaut : des runes écartées sans rien le dire font
paraître introuvable un build attendu. Les défenses de siège et le RTA
gardent dans l'export leurs propres runes (`importAccount.ts`), qu'un
autre monstre de la box peut porter aujourd'hui.

Activé, la recherche **exclut** les runes déjà portées ailleurs, dans **un
seul périmètre au choix** (jamais plusieurs à la fois) : **RTA** (défaut),
**Défenses siège** ou **Box**. Elle ne propose alors que des combinaisons
réellement montables sans déruner quelqu'un dans ce périmètre. Les runes
déjà portées par le monstre **choisi** lui-même (même espèce, n'importe
lequel de ses exemplaires) restent TOUJOURS disponibles quel que soit ce
réglage — jamais exclu de ses propres runes. Le sélecteur de périmètre est
grisé et non cliquable tant que l'interrupteur est désactivé.
Un seul périmètre RTA, parce que l'import ne garde qu'un jeu RTA : les
favoris, ou à défaut tous les monstres runés en RTA (`parseAccountJson`,
`importAccount.ts`). Distinguer « favoris » et « tous » demanderait de
changer d'abord l'import.

⚠️ **Le moteur est générique**, pas couplé à un périmètre précis :
`searchBuilds` ne connaît qu'un `pool` de runes déjà filtré.
`autoExcludedRuneIds` (dans
[optimizerExclusion.ts](src/lib/optimizerExclusion.ts)) est la fonction qui
construit cet ensemble d'exclusion pour le périmètre choisi — sa branche
« Box » réutilise `excludedRuneIds`
([runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), seule fonction
spécifique à la box. Ses branches RTA et Défenses siège comparent par
**`com2usId`** (l'espèce), jamais par entrée précise — c'est ce qui garantit
qu'un monstre recherché présent en RTA ne s'exclut jamais lui-même ; et le
périmètre Défenses siège ne dépend que de `monsterId` (stable), jamais de
`SiegeTeam.id`, qui n'a pas la même valeur à l'écran (un identifiant gardé
d'un import à l'autre, par position) et en ligne de commande (la position
de l'équipe, `scripts/lib/loadMonster.ts`), ce qui le rend pleinement fiable
en ligne de commande — contrairement aux sélecteurs manuels siège (voir
« Exclusion manuelle » ci-dessous).

⚠️ **Repli de compatibilité à l'import d'une recette** exportée avant le
renommage de la case (ancien champ `exploreAll`, coché = tout
l'inventaire) : `exploreAll` absent ou `true` → interrupteur désactivé
(comportement identique) ; `exploreAll: false` → interrupteur activé, périmètre
**Box** (le seul que l'ancienne case connaissait). Une recette déjà
exportée se comporte donc EXACTEMENT pareil après réimport — jamais un
champ manquant ignoré en silence.

## Exclusion manuelle — un monstre précis, dans n'importe quelle source

**« Exclure les runes d'un monstre »** : recherche par nom un monstre déjà
connu du compte, dans l'une de quatre sources (Box / RTA / Défenses siège /
Offenses siège), et retire SES runes **actuellement équipées** du pool
considéré — utile pour un build qu'on ne veut pas défaire, sans dépendre du
périmètre choisi pour « Exclure les runes déjà utilisées ». Se **superpose**
à ce dernier, ne le remplace pas : les deux exclusions s'additionnent.
Seules les entrées qui portent au moins une rune sont proposées
(`exclusionCandidatesFor`, `requireRunes` par défaut, appelé par
`RuneExclusionPicker.tsx`), jamais le bestiaire : une entrée sans rune ou
un monstre non possédé n'a rien à exclure.
⚠️ **Icône** : même pictogramme que « Monstre & équipement » (le monstre),
barré du symbole « interdit » — même traitement que l'icône « Exclusion de
runes » elle-même, cette action-ci RETIRE un monstre précis du pool.

Ordre relatif à « Exclure les runes déjà utilisées » : **au-dessus** dans le
panneau « Options » au doigt (c'est le réglage le plus utilisé sur cet
écran) ; à **droite**, côte à côte, au bureau (voir la carte ci-dessus).

⚠️ **Les quatre onglets de source restent sur UNE seule ligne au doigt**,
texte/rembourrage réduits — à 4 options aussi longues que « Défenses
siège », même resserré, le libellé passe sur DEUX lignes DANS le bouton
plutôt que déborder (le cran resserré ne force pas `whitespace-nowrap`,
contrairement aux autres). `Segmented` (`src/ui/`) mesure lui-même la place
qu'il reçoit et bascule seul entre les deux rendus (voir
[shared/librairie-ui.md](../../shared/librairie-ui.md)) — aucun réglage à
poser depuis cet écran.

⚠️ **L'équipe complète d'un résultat de siège reste visible sans défiler**
(`c.teamContext`, résultats de recherche par nom) : les coéquipiers passent
à la ligne (`flex-wrap`) plutôt que de glisser horizontalement — un
glissement horizontal DANS un panneau déjà scrollable verticalement
concurrence le geste de défilement de la page, quasi inutilisable au
doigt.

⚠️ Chaque sélection porte sur une **entrée précise**, pas un monstre en
général — un même monstre peut avoir un runage différent en box, en RTA et
dans un deck de siège ; exclure « Camilla (RTA) » n'exclut QUE son runage
RTA. Plusieurs sélections restent possibles à la fois (une liste, pas un
choix unique).

En Siège défense/offense, un même monstre peut apparaître dans plusieurs
équipes — indiscernables par le seul nom/portrait (même espèce = même
portrait). Chaque résultat de recherche affiche donc le **numéro d'équipe et
les portraits des 3 coéquipiers** (slot vide = tiret), à la même échelle que
l'écran Siège, pour lever l'ambiguïté sans avoir à cliquer.

⚠️ **Chaque résultat affiche aussi les icônes des sets ACTIFS** de
l'équipement montré, entre le nom et le compte de runes — pas un simple
comptage des sets présents parmi les runes portées : `activeSets`
(`lib/effects.ts`), la SEULE source de vérité de l'app pour « quels sets
sont actifs » (un set 4 pièces à 3 runes n'est pas actif, une rune
Intangible peut compléter le set incomplet le plus proche — un recomptage
à côté diverge de l'affichage, voir `swiftActive`, importAccount.ts). Même fonction que celle qui alimente les icônes de set
affichées sur les cartes de « Mon compte » → RTA.

Fait partie des réglages exportés/importés dans une recette : ce qui est
exporté, ce sont des **identifiants** (quel monstre, quelle source), jamais
les runes elles-mêmes — re-résolus contre le compte de qui importe la
recette au moment de la recherche. Un identifiant introuvable (monstre
absent chez l'importeur, deck remanié depuis…) est silencieusement ignoré,
jamais une erreur — même tolérance que pour le monstre recherché lui-même.

⚠️ **Réinitialisée sur un compte réellement DIFFÉRENT, pas sur une simple
nouvelle version réimportée du même compte.** Les sélections référencent des
monstres/runes par identifiant — valides pour un réexport du même joueur
(mêmes identifiants), mais sans plus aucun sens pour un compte différent.
Distingué par l'identité STABLE du compte (`wizard_id`), pas la date
d'export (qui change à chaque réexport) : réimporter son propre compte,
même après des heures de jeu, garde les sélections ; importer le fichier
d'un autre joueur les efface. Il faut les deux identités connues et
différentes (`appliquerImport`, `App.tsx`) : au premier import de la
session, ou sans `wizard_id` lisible, rien n'est effacé — mieux vaut une
sélection peut-être périmée qu'une sélection valide perdue. Ce n'est pas
`resetSearch`, qui part à chaque import, réexport compris.

## Runes imposées — verrouiller un emplacement sur une rune précise

**Regroupée dans la même carte** que les deux exclusions ci-dessus — même
thème (agir sur le pool de runes à partir de l'exemplaire recherché),
mécanisme distinct : ce n'est pas une exclusion mais un **verrou**. Une
pastille par emplacement (1 à 6) portant une rune sur l'exemplaire de
« Monstre & équipement » ; cliquer verrouille ce slot sur **exactement
cette rune** — son pool tombe à 1, les cinq autres emplacements restent
optimisés normalement. Cas d'usage : « je garde cette rune, cherche les
cinq autres autour » — d'où un choix limité aux runes que l'exemplaire
**porte déjà**, plutôt qu'un second sélecteur parmi des milliers de runes.
Un emplacement sans rune est montré grisé plutôt qu'absent.

⚠️ **Techniquement une RÉDUCTION DE POOL, pas une contrainte de plus** : le
verrou s'applique tout en amont (avant dominance/faisabilité/pré-filtrage).
Le moteur ne connaît pas la notion de verrou — il travaille sur un pool où
ce slot ne contient plus qu'une rune, ce qui rend la fonctionnalité **sûre
par construction** (elle ne peut pas provoquer de faux rejet, elle ne
retire que des candidats explicitement écartés par l'utilisateur).

⚠️ **Un `runeId` est propre à un compte.** Une recette importée d'un autre
joueur porte des runes imposées inconnues ici : elles sont **ignorées à
l'import**, avec le nombre signalé dans le message — les garder viderait le
pool du slot (zéro résultat) sans rien expliquer. En ligne de commande, le
script **avertit** au lieu de purger : il est censé rejouer la recette
telle quelle.

