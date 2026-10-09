# Stockage des membres et des équipes de l’Optimizer

**Statut :** ÉTAT ACTUEL — décrit le stockage des mémoires, des équipes et leur revérification
**Lire si :** on modifie la persistance des listes, la validation d’une équipe ou la reprise d’un état sauvegardé
**Voir aussi :** [feat-listes-et-reservation.md](feat-listes-et-reservation.md), [transverse/ (feat-sauvegarde-session.md)](../transverse/)

## Stockage indépendant des listes

`useOptimizerLists.ts`, instancié dans `App.tsx`, porte les listes et leurs
réservations dans la clé historique `swblacksmith-optimizer-lists-v1`. Son
format reste inchangé : `lists`, `members`, `validated`, `activeListId`.

Les mémoires des membres, les équipes et les contenus de liste sont dans une seconde clé,
`swblacksmith-optimizer-members-v1`. Une version de l’application qui ne connaît
que les listes laisse cette clé intacte. Les deux clés passent exclusivement
par `saveLocal`, sous l’interrupteur global de conservation. Sans conservation,
le miroir de session reçoit quand même la dernière valeur. Réactiver la
conservation réécrit les deux clés depuis le hook. « Tout supprimer » efface
le disque et le miroir ; refuser la conservation garde le travail en mémoire
jusqu’à la fermeture de la session.

Au chargement, le stockage supplémentaire se valide indépendamment des listes :
des listes illisibles ne provoquent aucune purge de mémoire, d’équipe ou de contenu. Les
entrées malformées ou dupliquées sont écartées de l’état utilisable et signalées
dans `rapportStockage`. Le lecteur garde leurs valeurs JSON brutes dans `rejets`
(`memories`, `teams` et `listContents`) ; l’écrivain réécrit cette section intacte à chaque
mutation. Elle est vide quand absente d’un stockage plus ancien. Elle reste
séparée des entrées utilisables à chaque relecture : un doublon rejeté ne se
réactive jamais parce que l’entrée valide a disparu. Les rejets ne sont jamais
appliqués ni affichés comme des mémoires, équipes ou contenus valides.

Seul un geste visant une entrée rejetée la retire : supprimer une liste emporte
ses rejets dont le `listId` est une chaîne lisible, sans déduire la liste d’une
clé abîmée. Retirer un membre ou écrire une mémoire acceptée pour ce membre
retire les mémoires rejetées dont la liste et le sélecteur lisibles correspondent.
Une écriture refusée conserve ces rejets. `setTeams` conserve les équipes rejetées,
qui ne font pas partie des équipes utilisables remplacées par ce geste.
« Supprimer mes données » efface tous les rejets, sur disque et dans le miroir.

Le texte brut initial reste conservé tant qu’aucun geste ni réimport ne modifie
ce stockage. Un réimport sans changement ne réécrit aucune clé et conserve ses
octets. Un réimport avec changement réécrit les valeurs des rejets à part ; il
n’annonce aucune suppression de rejets puisqu’il les conserve.
Le rapport du hook est affiché dans la zone C, dans un espace réservé et
défilant commun aux deux formats. Le clic d’un membre restaure ses critères.

## Mémoires des membres

`OptimizerState.proprietaireCriteres` désigne le membre dont les critères sont
affichés. `validerProprietaireCriteres` vérifie, avant toute restauration et
écriture, l’existence de la liste active et du membre, le sélecteur affiché,
l’espèce résolue et l’espèce sélectionnée. Une saisie sans propriétaire ne
crée aucune mémoire. Le propriétaire et les messages de restauration sont
hors de la photo de session. La photo est sérialisée, mais aucun chemin dans
`App.tsx` ne la réapplique actuellement : le chargement des critères depuis un
fichier de session n’est pas implémenté. Une nouvelle instance de l’état démarre
sans propriétaire ; les mémoires restent disponibles au choix d’un membre.

L’action `choisirMembre`, portée par `useOptimizerState` dans `App.tsx`, fonctionne
même quand l’écran est démonté. Elle restaure une mémoire de même espèce ;
une mémoire d’une autre espèce reste conservée et son refus est affiché. Sans
mémoire applicable, elle pose la base complète des critères personnels,
indépendante du membre précédent, même pour une autre copie de la même espèce.
Les réglages globaux restent. Choisir ne capture rien : la première modification
faite par l’utilisateur photographie l’affichage. Chaque modification suivante
écrit vers ce propriétaire seulement. Les résultats affichés sont effacés,
sans relancer de recherche ni ouvrir la fenêtre du combat ou le guide RES/PRE.
Les runes imposées absentes de l’inventaire sont retirées de l’affichage et dites,
sans modifier la mémoire originale par cette seule restauration.

Changer de liste applique la mémoire valide de l’exemplaire déjà affiché dans
la destination ; sans elle, aucun propriétaire. Retirer le membre affiché ou
supprimer sa liste efface l’attribution. Le bestiaire, les puces de source et
la zone D l’effacent aussi. L’import de recette l’efface au moment où sa lecture
se résout, avant d’appliquer ses valeurs, même si un membre a été choisi entre-temps.
Le réimport de compte l’efface avant la remise à zéro. Une résolution devenue
introuvable ou une identité différente invalide l’attribution, y compris quand
l’écran est démonté. Un retour d’onglet conserve les critères et le cran des
artéfacts lorsque l’exemplaire reste valide.

« Ajouter à la liste » et une validation qui inclut le monstre photographient
immédiatement les critères du geste. L’écriture de cette photo passe par le
validateur après publication de l’appartenance par le hook des listes, dans le
même geste, y compris « Créer et ajouter ». Une mémoire refusée reste intacte
et le rapport du stockage dit la raison. Le lancement d’une recherche peut
reposer le tri sur l’objectif ; cette dérivation ne crée pas de mémoire.

Les poses automatiques passent par `poserCriteresAutomatiques`, séparé des
setters de saisie : défauts, cohérence de relique et valeurs d’une recette ne
photographient jamais une mémoire. Après réimport écran démonté, le traitement
différé de la relique marque l’import traité au remontage. Si un membre valide
a été choisi entre-temps, ses critères restaurés et sa mémoire restent intacts ;
sinon le défaut est calculé contre la relique de l’exemplaire affiché.

L’index en mémoire est une `Map`, à clé texte
`listId|exclusionSelectorKey(selector)`. Chaque écriture acceptée crée une
nouvelle `Map` et copie la photo des critères personnels. La seule paire de
conversion JSON est `ecrireMembresOptimizer` / `lireMembresOptimizer`, dans
`optimizerMemberStorage.ts` ; le JSON porte les paires de la `Map` et les équipes.

Une mémoire porte le sélecteur, la liste, l’espèce `com2usId` et une photo complète
des critères personnels. L’espèce résolue est comparée avant chaque lecture et
écriture. Un sélecteur introuvable ou une autre espèce rend la mémoire
inapplicable, sans la supprimer ni la remplacer lors d’une écriture refusée.
La lecture rend une copie ; modifier l’affichage ne peut pas modifier la mémoire
sans passer par une écriture.

Les critères textuels contrôlés hors du lecteur de recette, `sortBy` et
`critereArtefacts`, sont obligatoirement des chaînes appartenant aux valeurs
admises. Un tableau contenant une valeur admise est rejeté, signalé dans le
rapport et conservé parmi les valeurs brutes inutilisables.

Le membre suit son sélecteur : exemplaire Box par `unitKey`, entrée RTA par
`monsterId`, slot de siège par `teamId` et `slotIndex`. RTA et siège ne conservent
pas l’identifiant de la copie : une autre copie de la même espèce occupant la
même entrée ou le même slot reçoit donc cette mémoire, sans message : ce
remplacement n’est pas détectable. Le rapport de revérification liste ces
mémoires (`memoiresSuivantSelecteur`) sans les annoncer à chaque réimport.

## Équipes stockées

Une équipe porte `id`, `listId`, `members` (sélecteurs), un `leader` facultatif,
`lead` (le `LeaderSkill` du jeu, avec statistique, montant, portée et élément,
ou `null`). Elle ne porte aucun contenu de combat ; l’ancien champ d’équipe
est ignoré à la lecture, sans rejeter l’équipe ni inventer un contenu de liste.

La validation au chargement impose 2 à 5 membres distincts, tous rattachés à la
liste indiquée par l’équipe ; un membre ne figure que dans une équipe par liste.
Un leader désigné appartient à ses membres. Les identifiants d’équipes sont
uniques ; portée et élément sont validés. Chaque champ texte doit être
une chaîne : aucun tableau ou objet n’est converti en texte pour être accepté.
Les valeurs `null` prévues pour le lead, sa statistique et son élément restent
admises. Un conflit ou une entrée
malformée est signalé et écarté. La cohérence avec les listes et leurs membres
se vérifie à l’écriture et au réimport, pas au chargement contre des listes
potentiellement illisibles. Le lead de RES ou Précision peut être conservé.
Le stockage ne calcule aucun lead effectif et n’ajoute aucun contrôle d’écran.

## Contenu de combat des listes

`ContenuListeOptimizer` admet `guilde`, `donjon` et `arene`. Le contenu vit dans
`listContents`, une `Map` indexée par identifiant de liste, dans le stockage des
membres. Le JSON contient un tableau d’objets `{ listId, contenu }` ; chaque
identifiant est une chaîne non vide et chaque contenu une chaîne admise.
Une entrée inconnue, mal typée ou dupliquée est signalée et conservée brute dans
`rejets.listContents`, sans application ni réactivation automatique à la relecture.
Un index malformé est conservé de la même façon. Le chargement ne contrôle pas
ces références contre les listes : un contenu orphelin reste conservé.

Le stockage antérieur sans cet index se relit avec une `Map` vide, sans défaut.
Retirer un membre, écrire sa mémoire, modifier les équipes ou revérifier le compte
conserve les contenus et leurs rejets. Supprimer une liste retire son contenu et
les rejets dont le `listId` lisible la désigne ; les autres restent.
Le sélecteur de contenu et la définition du contenu à la création manuelle
ne sont pas encore branchés à l’écran.

## Modèle pur des équipes

`equipesOptimizer.ts` crée une équipe, ajoute ou retire un membre, délie un
membre ou dissout une équipe, sans toucher aux listes, aux builds ni aux
mémoires. Les identifiants sont fournis par l’appelant ; le lead par défaut
est `null` et le leader reste facultatif.
La création vérifie la forme de l’équipe proposée, l’existence de sa liste
et l’appartenance de chacun de ses membres à cette liste. Elle contrôle les
collisions d’identifiant et l’exclusivité des membres contre les équipes
existantes, conservées telles quelles. Une équipe ancienne dont la liste ou
un membre a disparu ne bloque pas la création d’une équipe indépendante.
L’ajout d’un membre conserve sa validation du stockage et des références.
Un refus rend les équipes initiales et un rapport explicite, sans déplacement
implicite d’un membre.
L’exclusivité d’un membre est propre à sa liste : le même sélecteur peut être
lié indépendamment dans deux listes.

Retirer ou délier un membre d’une équipe de deux dissout cette équipe. Au-delà,
seul ce membre sort ; s’il était leader, la désignation disparaît sans
remplacement automatique. Dissoudre laisse les membres dans leur liste et
leurs critères personnels intacts. Une opération visant une équipe ou un
membre absent est sans changement et le rapporte.

`equipeApresFiltrageOptimizer` reçoit les membres déjà filtrés d’une source :
0, 1 ou plus de 5 membres ne produisent aucune équipe, avec un motif explicite
et l’annonce que le lead de la source n’est appliqué à personne. Les membres
gardent leur base complète de critères ; le producteur ne copie jamais ce
lead dans leurs critères personnels. De 2 à 5 membres, la création suit les
mêmes validations que la création manuelle.

## Lead effectif d’un membre

`leadEffectifMembreOptimizer` rend un `LeadEffectifOptimizer` : hors équipe,
`personnel` ; dans une équipe, `equipe` avec `{stat, pct}` si le lead est actif,
sinon `aucun` avec un motif. La donnée du jeu reste entière dans l’équipe.
Le lead personnel n’est jamais un repli d’un lead d’équipe inactif ; délier
rend le lead personnel disponible sans modifier sa mémoire.

Le contenu est lu dans `listContents` pour la liste du membre, commun à toutes
ses équipes. Une liste sans contenu défini n’applique aucun lead d’équipe,
avec le motif « contenu de combat de la liste non défini » ; aucun repli sur
le lead personnel. Une modification du contenu change l’effet dérivé, sans
modifier le lead stocké ni les critères personnels.

La table `ACTIVITE_LEADS_OPTIMIZER` distingue actif, inactif et élément.
Une portée inconnue reste sans effet, avec un motif. « Élément » exige
l’élément identique du membre. Les règles de contenu sont :

| Contenu | General | Element | Arena | Guild | Dungeon |
| --- | --- | --- | --- | --- | --- |
| Guilde | actif | élément | inactif | actif | inactif |
| Donjon | actif | élément | inactif | inactif | actif |
| Arène | actif | élément | actif | inactif | inactif |

General agit dans les trois contenus ; Element seulement sur son élément.
Guild agit exclusivement en Guilde, Dungeon exclusivement en Donjon et Arena
exclusivement en Arène. Toute autre portée est inactive. La prépa RTA utilise
le contenu Arène, avec les mêmes portées actives.

Seules HP, Attack Power, Defense, Attack Speed, Critical Rate et Critical DMG
sont calculables (`LEADER_SKILL_STATS`, `damage.ts`). Resistance et Accuracy
restent conservées comme données sans application, avec un motif explicite.
Une statistique non calculable ou un montant non fini/négatif reste sans
effet. Un montant numérique valide hors des paliers proposés est conservé
tel quel : les paliers du menu ne sont pas une validation de lead importé.

## Paliers de lead

`LEADER_SKILL_VALEURS` couvre les paliers du corpus local `monsters.json`, dont
VIT 17 ; un test balaie toutes ses entrées pour contrôler cette couverture.
Le menu n’offre pas de saisie libre ; une valeur enregistrée hors liste reste
affichée telle quelle, jamais remplacée en silence.

## Revérification commune

`reverifierStockageOptimizer` est pure et exportée pour le réimport du compte
et la reprise d’un état sauvegardé. Elle renvoie le stockage revérifié et un
rapport : membres et builds retirés, mémoires inactives ou suivant leur
sélecteur, équipes modifiées ou dissoutes, messages explicites.

La garde `comptePeutJuger` interdit toute purge tant que Box et runes sont vides.
Les membres et builds suivent les règles existantes : sélecteur résolu, et pour
un build, runes toujours présentes dans l’inventaire du compte. Le contrôle
d’identité des builds au réimport reste inchangé.

Un membre retiré laisse sa mémoire conservée et inactive. Son équipe perd ce
membre ; sous deux membres, elle est dissoute. Un leader retiré n’est pas
remplacé automatiquement. `App.tsx` appelle cette fonction au réimport, applique
le résultat ensemble par `replaceAfterRevalidation` seulement s’il a changé,
et affiche ses messages. Sans changement, la fonction rend le stockage reçu ;
les mémoires inactives restent signalées sans provoquer de réécriture.
Les contenus des listes et leurs rejets restent intacts, avec ou sans changement.
La reprise d’un point de sauvegarde et ses contrôles d’identité propres ne sont
pas encore branchés dans l’écran.
