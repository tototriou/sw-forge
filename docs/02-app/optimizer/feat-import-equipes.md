# Import d’équipes dans l’Optimizer

**Statut :** ÉTAT ACTUEL — modèle pur d’import et conversions du siège et de la prépa RTA
**Lire si :** on convertit une source en liste de travail ou on modifie le consommateur d’import
**Voir aussi :** [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md), [feat-listes-et-reservation.md](feat-listes-et-reservation.md)

## Modèle d’import

`src/lib/importEquipes.ts` fournit un producteur pur par source et le
consommateur unique `consommerImportOptimizer`. Ces fonctions ne sont pas
encore branchées sur un bouton ou un écran.

Un `ImportOptimizer` propose un nom de liste, des membres (sélecteur précis,
identité d’espèce `com2usId`, libellé et critères partiels), des équipes
(libellé, membres, leader facultatif, lead du jeu entier et contenu) et les
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
s’il est inactif en Siège ou sans effet calculé. Le contenu est `siege`.
Un slot vide n’est pas un monstre ignoré ; une espèce inconnue, une identité
inutilisable ou un exemplaire sans équipement résolvable est signalé.

`importerPrepaRtaOptimizer` propose « Prépa RTA », prend toutes les entrées
et leurs sélecteurs RTA, sans aucune équipe ni lead importé. Les sections
ne filtrent pas la prépa. Le consommateur dédoublonne par sélecteur,
jamais par espèce : deux slots d’une même espèce restent deux membres.

Pour RTA et chaque slot de siège, la vitesse saisie est `runeSpeed` :
elle contient déjà le bonus Swift à plat. La VIT minimum de fiche importée
est `monster.stats.speed + runeSpeed`, sans lead, compétence d’invocateur,
buff, tick cible ou gain de passif. Source de cette convention :
`src/lib/speedTuneDeck.ts`, `deckPourSpeedTune` ; la fiche est distincte de
la vitesse de combat. Une vitesse absente ne pose aucun minimum ; une
vitesse ou une base non finie, négative ou absente ne se convertit pas et
le rapport le dit. Aucun set ni équipement porté n’est imposé comme critère.

## Consommation dans une nouvelle liste

Le consommateur reçoit le stockage, la liste active, l’import, les sources
actuelles du compte et un identifiant proposé par l’appelant. Il rend le
nouveau stockage, la nouvelle liste active et un rapport, sans effet de bord.
Le nom et les identifiants sont suffixés en cas de collision ; les identifiants
occupés par des mémoires, des équipes ou des rejets sont aussi réservés.
Un import sans membre accepté ne crée rien et conserve la liste active,
avec un message explicite.

Chaque sélecteur est résolu et son espèce vérifiée avant écriture. Un doublon
garde la première occurrence ; une identité différente ou un sélecteur
introuvable est ignoré avec sa raison. Chaque mémoire acceptée est construite
par `completerCriteresImport` sur la base complète de l’exemplaire actuel,
jamais sur des critères affichés ou une mémoire d’une autre liste. L’écriture
utilise `enregistrerMemoireMembre` et conserve l’identité d’espèce. Des critères
refusés n’ajoutent pas le membre. RTA et siège suivent leur sélecteur : une
autre copie de la même espèce dans la même entrée reçoit les critères ;
le remplacement de copie n’est pas détectable.

Seule une nouvelle liste et ses membres, mémoires et équipes sont ajoutés.
Aucune liste existante, mémoire existante, équipe existante, valeur rejetée
ou build validé n’est remplacé ni supprimé. Aucun build n’est validé par
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
`leadEffectifMembreOptimizer`, selon le contenu et l’élément du membre. Un
lead conservé mais sans effet calculé porte son motif dans le rapport.
