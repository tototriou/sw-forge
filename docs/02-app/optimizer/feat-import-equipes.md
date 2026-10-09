# Import d’équipes dans l’Optimizer

**Statut :** ÉTAT ACTUEL — modèle pur d’import et conversions du siège, de la prépa RTA, du speed tuning et des recommandations
**Lire si :** on convertit une source en liste de travail ou on modifie le consommateur d’import
**Voir aussi :** [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md), [feat-listes-et-reservation.md](feat-listes-et-reservation.md)

## Modèle d’import

`src/lib/importEquipes.ts`, `src/lib/importSpeedTuneOptimizer.ts` et
`src/lib/importRecoOptimizer.ts` fournissent
les producteurs purs et le consommateur unique `consommerImportOptimizer`.
L’action commune `importerEquipe` de `useOptimizerState`, instancié dans
`App.tsx`, reçoit un producteur et reste utilisable sans écran monté.

Un `ImportOptimizer` propose un nom et un contenu de liste, des membres (sélecteur précis,
identité d’espèce `com2usId`, libellé et critères partiels), des équipes
(libellé, membres, leader facultatif et lead du jeu entier) et les
monstres ignorés avec leur raison. Les messages accompagnent les valeurs
qui ne peuvent pas être converties. Les critères partiels utilisent l’objet
`vitesse.minimum` pour une VIT minimum de fiche.

## F1 — Importer depuis l’Optimizer

Lorsque l’Optimizer est monté avec un compte, « Importer une équipe » est
toujours affiché dans « Monstre & équipement »,
près du sélecteur de liste, au bureau et au téléphone, même lorsque
« Monstres à optimiser » est replié. Sans membre résolvable dans aucune
source, le bouton est désactivé et son `title` en donne la raison.
Sans compte, l’écran vide existant remplace l’Optimizer et ne montre pas ce bouton.
La disponibilité est dérivée des producteurs, y compris pour une source
non vide mais inutilisable. Les propositions sont mémorisées sur les données
sources et partagées entre les deux formats ; un rendu sans changement de
ces données ne rappelle pas les producteurs, flottant fermé compris.

Le bouton ouvre un `FlottantAuto`, de la largeur de son ancre : toutes les
défenses de siège, chaque deck d’offense identifié par son numéro et sa
composition, toute la prépa RTA avec ses vitesses. Une source sans membre
résolvable reste affichée désactivée avec sa raison. Les recommandations ajoutent
un choix par deck, identifié par le numéro et le nom de la recommandation,
le numéro du deck et sa composition. Elles utilisent `importerRecoOptimizer`,
comme l’export du deck ; leurs disponibilités suivent aussi les modifications
des recommandations.
Échap, la croix ou
le clic extérieur ferment le flottant. Ses choix sont des contrôles de
`src/ui/`, sans second contour autour des rangées.

L’action appelle le producteur sur les sources courantes, puis le
consommateur unique. Si aucun membre n’est accepté, elle rend le rapport
sans changer la liste, la sélection, les critères ni les résultats.
Tant que la revérification d’un compte réimporté est en attente, l’action
refuse avant le producteur et le dit au rapport, sans changer les listes,
la sélection, le propriétaire, les critères ni les résultats. L’état d’attente
est lu au moment du geste depuis `App.tsx`, même sans nouveau rendu ou avec
un compte arrivé par le dossier SW Exporter. L’import redevient possible
après la revérification. Un import de compte regroupé dans le même rendu
que la relecture du compte conservé est revérifié comme un réimport : la
relecture ne le masque pas, et l’attente se termine.
Sinon l’ajout vérifie l’identifiant sur l’état courant avant toute écriture,
y compris les cibles orphelines ou rejetées réservées par le consommateur.
Une collision rend un refus explicite au rapport, avec aucun monstre ni équipe
importé, sans changer liste, sélection, propriétaire, critères ou résultats.
La transformation rejouée par React sur un état d’entrée inattendu conserve
cet état sans lever d’exception. L’ajout accepté publie ensemble la nouvelle
liste active et toutes ses données ; l’action efface ensuite le propriétaire,
puis appelle `choisirMembre`
sur son premier membre. Ce choix restaure ses critères et efface les
résultats, progression, page, arrêt manuel et détail ouvert, sans lancer
de recherche. La réconciliation garde le propriétaire établi par le
geste ; la prochaine saisie écrit vers ce premier membre seulement.
Aucune liste existante ni aucun point de sauvegarde n’est modifié.
Après acceptation, l’action commune ouvre l’Optimizer par la route
`#/outils/optimizer`. Un import vide, une collision ou une revérification
en attente rendent leur rapport sans navigation.
Toute origine autre que `#/outils/optimizer` reçoit son rapport dans la modale
portée par `App.tsx`, après acceptation comme après refus. Depuis l’Optimizer,
le rapport reste dans le flottant des sources, sans seconde modale.
La préparation lit aussi les écritures des listes en attente dans le même
geste React pour attribuer un identifiant libre. La publication ajoute seulement
la nouvelle liste, ses membres, identités, mémoires, équipes et contenu par une
mise à jour fonctionnelle de l’état courant. Une saisie mémorisée, une création,
une modification de liste ou une revérification précédant l’import dans le même
geste reste conservée ; aucun état existant n’est republié depuis un ancien rendu.

Le rapport reste dans le flottant ouvert après le choix : nom de la liste,
nombre de monstres et d’équipes, membres ignorés et raisons, messages du
consommateur, dont les leads non appliqués. Il se conserve jusqu’au choix
suivant ou au démontage de l’écran. Un seul rapport appartient à l’écran :
passer du bureau au téléphone le conserve et permet de le relire en rouvrant
les sources. Si toutes les sources deviennent inutilisables, le bouton reste
désactivé avec sa raison : le rapport déjà ouvert reste lisible, mais une fois
fermé il ne peut être rouvert avant le retour d’une source utilisable. Le rapport
reste conservé pendant cette indisponibilité.
Au bureau et au téléphone, le bouton précède le sélecteur de listes,
après la recherche et le monstre choisi ; au téléphone, il reste sous
« Monstres à optimiser », hors de son dépliement. La ligne du monstre
choisi garde sa hauteur lorsqu’elle est vide ; un nom long reste sur une
ligne, tronqué avec son texte complet en `title`, pour que le premier import
ne déplace pas l’ancre. L’ouverture des sources et le rapport sortent du flux.

## F4 — Exporter depuis le siège

« Exporter vers l'Optimizer » appelle la même action que l’import interne :
toutes les défenses depuis la page Défense, une défense ou une offense depuis
sa carte, repliée comme dépliée. Le filtre de recherche du siège ne réduit pas
l’export de la page. Les producteurs de siège et le consommateur sont communs.
Un clic crée la liste, choisit le premier membre, restaure ses critères puis
ouvre l’Optimizer. Les données existantes et le point de sauvegarde restent intacts.

Sans compte chargé (Box et inventaire de runes vides), ou sans monstre
importable selon le producteur, le contrôle reste affiché, désactivé avec
la raison en `title`. La disponibilité utilise les sources du compte et se
recalcule à leur changement ; le geste rappelle le producteur sur les sources
courantes. Un refus de revérification, une collision ou un import devenu vide
gardent la page et ses contrôles en place.
Le rapport de l’export est une modale portée par `App.tsx`, lisible au bureau
et au téléphone après la navigation comme après un refus : comptes, membres
ignorés et messages. La croix, Échap ou le clic extérieur le ferment.
Son ouverture sort du flux et ne déplace aucun bouton de siège.

## Exporter la prépa RTA et un deck recommandé

La page « Ma prépa » propose « Exporter vers l'Optimizer » dans sa barre
d’actions au bureau et dans « Options » au téléphone. Elle transmet toute
la prépa avec ses vitesses à `importerPrepaRtaOptimizer`, indépendamment
des sections et des filtres affichés : liste Arène, sans équipe ni lead.

Chaque deck recommandé propose la même action dans sa ligne, repliée ou
dépliée, et dans les offenses de la vue Défense. Un clic transmet uniquement
ce deck à `importerRecoOptimizer` : liste Guilde, équipe, minimums, premier
runage, propriétés d’artéfact et lead du slot 0. Les exemplaires suivent
la confrontation commune décrite dans la conversion du deck recommandé.

Ces actions réutilisent `importerEquipe` avec navigation et la modale du
rapport portée par `App.tsx`. Sans compte (Box et runes vides) ou sans membre
importable, elles restent présentes, désactivées avec leur raison en `title`.
Leur disponibilité se dérive du producteur sur les sources courantes ; au
geste, l’action rappelle ce même producteur. Un refus garde la route et
les contrôles en place ; le rapport sort du flux dans les deux formats.

## Conversions du siège et de la prépa RTA

`importerDefensesSiegeOptimizer` propose « Défenses de siège » et une équipe
par défense. `importerOffenseSiegeOptimizer` reçoit l’identifiant d’un deck
et propose « Offense de siège ». Les sélecteurs restent ceux des slots de
leur source, même sans rune équipée ; aucun exemplaire Box ne les remplace.
Le slot 0 désigne le leader et fournit son `leaderSkill`, jamais le nombre
`SiegeTeam.lead`. Le lead conserve sa portée et son élément, y compris
s’il est inactif en Guilde ou sans effet calculé. Le contenu de liste est `guilde`.
Un slot vide n’est pas un monstre ignoré ; une espèce inconnue, une identité
inutilisable ou un exemplaire sans équipement résolvable est signalé.

`importerPrepaRtaOptimizer` propose « Prépa RTA », prend toutes les entrées
et leurs sélecteurs RTA, sans aucune équipe ni lead importé. Les sections
ne filtrent pas la prépa. Son contenu de liste est `arene`, même sans équipe.
Le consommateur dédoublonne par sélecteur,
jamais par espèce : deux slots d’une même espèce restent deux membres.

Pour RTA et chaque slot de siège, la vitesse saisie est `runeSpeed` :
elle contient déjà le bonus Swift à plat. La VIT minimum de fiche importée
est `monster.stats.speed + runeSpeed`, sans lead, compétence d’invocateur,
buff, tick cible ou gain de passif. Source de cette convention :
`src/lib/speedTuneDeck.ts`, `deckPourSpeedTune` ; la fiche est distincte de
la vitesse de combat. Une vitesse absente ne pose aucun minimum ; une
vitesse ou une base non finie, négative ou absente ne se convertit pas et
le rapport le dit. Aucun set ni équipement porté n’est imposé comme critère.

## F3 — Conversion du speed tuning

`importerSpeedTuneOptimizer` reçoit les lignes, le lead de « Ton équipe »,
les sources du compte et, facultativement, le `DeckInitial` de la modale.
Il propose une liste « Speed tuning » de contenu `guilde` et une équipe
« Ton équipe ». Toutes les lignes du camp allié sont prises, même masquées ;
les adversaires ne sont pas exportés. Une ligne sans monstre résolu ou sans
vitesse saisie valide est ignorée et comptée avec sa raison. Zéro est une
vitesse saisie. Après filtrage, 0 membre ne crée rien ; 1 ou plus de 5 membres
restent sans équipe. Le rapport nomme le lead du camp appliqué à personne.

Le minimum `vitesse.minimum` est la VIT de fiche :
`ligne.monster.stats.speed + ligne.runeSpeed`. La saisie contient déjà Swift
à plat, arrondi au supérieur, comme `computeStats` ; ni totem, lead, buff,
gain de passif ni fenêtre de l’analyse n’entrent dans ce minimum. Une ligne
Swift sélectionne seulement `['swift']` (quatre pièces, deux libres).
Sinon, aucun set n’est sélectionné et le rapport demande d’en choisir un.
« Effet aug. VIT » positif pose le verrou `{ code: 206, min: valeurSaisie }`
sur le cumul de la paire d’artéfacts. Une valeur nulle ou zéro ne pose aucun
verrou ; une valeur invalide n’est pas importée et le rapport le dit.

La VIT minimum **ne garantit pas l’ordre des tours** : aucun maximum ni
couple vitesse/amplification n’est exporté. Un build peut dépasser le minimum,
changer d’amplification ou différer en Swift. Exemple chiffré avec base 101,
lead 0 et totem 15 % : 100 points plats de runes avec Swift donnent une saisie
126 et une fiche 227. `combatSpeed` donne 242, car il retire les 26 points
Swift plats puis arrondit une seule fois 40 % de la base (41 points).
Sans Swift, 126 points plats donnent la même fiche 227 mais un combat à 243
(totem arrondi à 16). L’écart est **un point**, malgré un même minimum de fiche.

Avec un deck d’origine, chaque espèce retrouve le premier slot disponible
de ce deck ; les slots sont consommés dans leur ordre pour les copies d’une
même espèce. Le slot 0 désigne le leader s’il est retenu. Le lead importé est
toutefois celui du camp actuel, avec portée et élément, même s’il a été changé.
Un deck introuvable ou un slot sans équipement résolvable fait ignorer la ligne,
sans la remplacer silencieusement par une copie Box. Une ligne ajoutée qui ne
correspond à aucun slot disponible utilise la règle sans deck et le rapport
le signale. En page, sans deck d’origine, `retrouverDeckCompositionOptimizer`
cherche la composition exacte du camp allié actuel, hors ordre mais avec le
nombre de copies de chaque espèce. Toutes les lignes alliées comptent avant
filtrage des vitesses ; les adversaires sont exclus. Une identité non résolue
empêche de retrouver un deck. Le premier deck convient : défenses dans leur
ordre, puis offenses dans leur ordre. Ses slots fournissent les exemplaires
et son slot 0 le leader ; un slot sans équipement résolvable est ignoré,
sans remplacement Box. La page ne conserve aucune provenance dans ses lignes.
Sans composition retrouvée, le premier exemplaire résolvable est choisi dans
l’ordre Box, RTA, défense, offense, même sans rune. `unowned` ne sert que si
l’espèce est absente de ces quatre sources.

Le lead reste exclusivement sur l’équipe ; ses effets par élément sont dérivés
par `leadEffectifMembreOptimizer`, jamais copiés dans les critères personnels.

## F3b — Conversion d’un deck recommandé

`importerRecoOptimizer` reçoit un `RecoDeck` et les sources du compte. Il
propose une liste de contenu `guilde`, nommée comme le deck (« Deck recommandé »
si le nom est vide), et une équipe. Le slot 0 de la recommandation désigne
le leader et fournit son `leaderSkill` entier, avec sa portée et son élément ;
le leader n’est pas déduit de l’ordre du deck réel. Un slot vide ne compte
pas comme ignoré. Un monstre inconnu ou une identité inutilisable est
ignoré avec sa raison. Après filtrage, 0 membre ne crée rien ; 1 ou plus de
5 membres restent sans équipe, avec le lead de la source nommé comme non
appliqué à quiconque. Aucun lead n’entre dans les critères personnels.

La fonction commune `retrouverDeckCompositionOptimizer` appelle `matchDeck`
avec `contexteConfrontationReco`, le constructeur que l’écran des
recommandations utilise aussi : tous les builds, défenses et offenses,
réserve 6★ de la Box. Elle reprend la meilleure équipe selon les critères,
la première en cas d’égalité. Si cette équipe est une offense, les espèces
retrouvent ses slots, copies consommées dans l’ordre des slots. Sans offense
retenue, ou pour une occurrence qui n’a plus de slot distinct dans cette
offense, le repli choisit le premier exemplaire résolvable dans l’ordre
offense, Box, RTA, défense, même sans rune, en excluant les sélecteurs déjà pris.
Le repli faute de slot est dit au rapport. La confrontation garde le dernier
build résolvable par espèce dans une équipe ; l’import garde une occurrence
par slot distinct. Quand le sélecteur importé diffère de celui jugé par la
confrontation, y compris si elle retenait une défense, le rapport le dit.
`unowned` ne sert que si l’espèce est absente de toutes les sources ; un
sélecteur non possédé déjà pris ne se réutilise pas non plus.
Une espèce possédée sans équipement résolvable est ignorée, jamais déclarée
non possédée ; des copies épuisées sont ignorées avec raison. Un slot existant
mais sans équipement résolvable du deck retenu n’est pas remplacé par la Box.

Les minimums strictement positifs de `RecoSlot.stats` sont des **totaux de
fiche**, comme dans `recoMatch.ts` : aucune base soustraite. La VIT passe par
`vitesse.minimum`, les sept autres statistiques par `minStats`. Une valeur
non finie ou une statistique inconnue n’est pas importée et figure au rapport.
RES et Précision peuvent compter les auras dans l’Optimizer selon son réglage,
alors que la confrontation juge la fiche seule ; le rapport dit cet écart.
Seul `setOptions[0]` est importé, répétitions comprises, y compris 4+2,
2+2+2 et 4 seul. Un premier runage vide laisse le membre sans set et le dit ;
les autres possibilités ne le remplacent pas. Un set inconnu, le joker
Intangible demandé ou une combinaison de plus de six pièces ne se convertit pas.

Les propriétés d’artéfact deviennent des `LigneVerrouillee` : minimum **0,1
pour le code 218**, **1 pour tous les autres codes reconnus**, anciennes
lignes comprises. Ces seuils incluent les anciennes valeurs ; ils ne se
déduisent pas des minima de tirage actuels. Le code et la sorte sont vérifiés
par `isArtifactSub` puis `artifactSubKinds` avant conversion ; une principale,
un code inconnu ou une sorte impossible n’est pas importé et le rapport le dit.
Chaque code commun est importé une seule fois sur le cumul de la paire.
Demandé sur une seule sorte, le rapport nomme cette sorte et explique que
le verrou porte sur le cumul : un code commun peut désormais être porté
par l’une ou l’autre pièce. Un code propre conserve la seule sorte compatible
avec le jeu ; le rapport la nomme, sans inventer une compatibilité.
Demandé sur les deux pièces, **une seule présence sur la paire suffit** à
l’import, et le rapport le précise : un build peut satisfaire le verrou
importé tout en échouant à la recommandation, qui exige la présence par sorte.

## Consommation dans une nouvelle liste

Le consommateur reçoit le stockage, la liste active, l’import, les sources
actuelles du compte et un identifiant proposé par l’appelant. Il rend le
nouveau stockage, la nouvelle liste active et un rapport, sans effet de bord.
Le nom et les identifiants sont suffixés en cas de collision ; les identifiants
occupés par des mémoires, des équipes, des contenus de liste ou des rejets sont aussi réservés.
Pour l’identifiant de la nouvelle liste, les identités réservent aussi leur
`listId`, même seules après une ancienne suppression de liste, ainsi que les
rejets d’identité dont le `listId` reste lisible. Ces données restent intactes ;
le nouveau membre reçoit une identité de son espèce dans la liste suffixée,
sans reprendre une identité orpheline ni réactiver un rejet.
Un rejet d’identité sans `listId` lisible reste conservé tel quel et ne réserve
aucun identifiant de liste ; sa clé brute ne sert jamais à déduire cette cible.
Un import sans membre accepté ne crée rien et conserve la liste active,
avec un message explicite. Un contenu d’import inconnu est refusé explicitement,
sans modifier le stockage. Le contenu accepté est ajouté à `listContents` pour
la nouvelle liste seulement, même sans équipe.

Chaque sélecteur est résolu et son espèce vérifiée avant écriture. Un doublon
garde la première occurrence ; une identité différente ou un sélecteur
introuvable est ignoré avec sa raison. Chaque mémoire acceptée est construite
par `completerCriteresImport` sur la base complète de l’exemplaire actuel,
jamais sur des critères affichés ou une mémoire d’une autre liste. L’écriture
utilise `enregistrerMemoireMembre` et conserve l’identité d’espèce. Des critères
refusés n’ajoutent pas le membre. RTA et siège suivent leur sélecteur : une
autre copie de la même espèce dans la même entrée reçoit les critères ;
le remplacement de copie n’est pas détectable.

Seule une nouvelle liste et ses membres, mémoires, équipes et contenu sont ajoutés.
Aucune liste existante, mémoire existante, équipe existante, valeur rejetée,
contenu existant ou build validé n’est remplacé ni supprimé. Aucun build n’est validé par
l’import ; aucune rune ni paire d’artéfacts n’est réservée.

## Équipes et leads après filtrage

Les équipes sont créées par `equipeApresFiltrageOptimizer`, après le filtrage
des membres : 2 à 5 membres distincts, chacun dans une équipe au plus.
Avec 0, 1 ou plus de 5 membres, aucune équipe n’est créée ; les membres
acceptés restent dans la nouvelle liste. Le rapport nomme l’équipe et le
lead de la source non appliqué, même si aucun membre ne reste. Un leader
écarté n’est pas remplacé automatiquement.

Le lead d’une source n’est jamais copié dans les critères personnels de ses
membres. Sans équipe, ils gardent donc leur base complète complétée seulement
par les critères importés. Dans une équipe, le lead effectif reste dérivé par
`leadEffectifMembreOptimizer`, selon le contenu de sa liste et l’élément du membre. Un
lead conservé mais sans effet calculé porte son motif dans le rapport.
