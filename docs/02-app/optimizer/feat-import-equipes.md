# Import d’équipes dans l’Optimizer

**Statut :** ÉTAT ACTUEL — modèle pur d’import et conversions du siège, de la prépa RTA et du speed tuning
**Lire si :** on convertit une source en liste de travail ou on modifie le consommateur d’import
**Voir aussi :** [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md), [feat-listes-et-reservation.md](feat-listes-et-reservation.md)

## Modèle d’import

`src/lib/importEquipes.ts` et `src/lib/importSpeedTuneOptimizer.ts` fournissent
les producteurs purs et le consommateur unique `consommerImportOptimizer`. Ces fonctions ne sont pas
encore branchées sur un bouton ou un écran.

Un `ImportOptimizer` propose un nom et un contenu de liste, des membres (sélecteur précis,
identité d’espèce `com2usId`, libellé et critères partiels), des équipes
(libellé, membres, leader facultatif et lead du jeu entier) et les
monstres ignorés avec leur raison. Les messages accompagnent les valeurs
qui ne peuvent pas être converties. Les critères partiels utilisent l’objet
`vitesse.minimum` pour une VIT minimum de fiche.

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
le signale. Sans deck, le premier exemplaire résolvable est choisi dans
l’ordre Box, RTA, défense, offense, même sans rune. `unowned` ne sert que si
l’espèce est absente de ces quatre sources. La page n’a aucune provenance de
deck conservée dans ses lignes, même après y avoir importé un deck.

Le lead reste exclusivement sur l’équipe ; ses effets par élément sont dérivés
par `leadEffectifMembreOptimizer`, jamais copiés dans les critères personnels.

## Consommation dans une nouvelle liste

Le consommateur reçoit le stockage, la liste active, l’import, les sources
actuelles du compte et un identifiant proposé par l’appelant. Il rend le
nouveau stockage, la nouvelle liste active et un rapport, sans effet de bord.
Le nom et les identifiants sont suffixés en cas de collision ; les identifiants
occupés par des mémoires, des équipes, des contenus de liste ou des rejets sont aussi réservés.
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
