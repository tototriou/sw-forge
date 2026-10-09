# Stockage des membres et des équipes de l’Optimizer

**Statut :** ÉTAT ACTUEL — décrit le stockage des mémoires, des équipes et leur revérification
**Lire si :** on modifie la persistance des listes, la validation d’une équipe ou la reprise d’un état sauvegardé
**Voir aussi :** [feat-listes-et-reservation.md](feat-listes-et-reservation.md), [../transverse/feat-sauvegarde-session.md](../transverse/feat-sauvegarde-session.md)

## Stockage indépendant des listes

`useOptimizerLists.ts`, instancié dans `App.tsx`, porte les listes et leurs
réservations dans la clé historique `swblacksmith-optimizer-lists-v1`. Son
format reste inchangé : `lists`, `members`, `validated`, `activeListId`.

Les mémoires des membres et les équipes sont dans une seconde clé,
`swblacksmith-optimizer-members-v1`. Une version de l’application qui ne connaît
que les listes laisse cette clé intacte. Les deux clés passent exclusivement
par `saveLocal`, sous l’interrupteur global de conservation. Sans conservation,
le miroir de session reçoit quand même la dernière valeur. Réactiver la
conservation réécrit les deux clés depuis le hook. « Tout supprimer » efface
le disque et le miroir ; refuser la conservation garde le travail en mémoire
jusqu’à la fermeture de la session.

Au chargement, le stockage supplémentaire se valide indépendamment des listes :
des listes illisibles ne provoquent aucune purge de mémoire ou d’équipe. Les
entrées malformées ou dupliquées sont écartées de l’état utilisable et signalées
dans `rapportStockage`. Le lecteur garde leurs valeurs JSON brutes dans `rejets`
(`memories` et `teams`) ; l’écrivain réécrit cette section intacte à chaque
mutation. Elle est vide quand absente d’un stockage plus ancien. Elle reste
séparée des entrées utilisables à chaque relecture : un doublon rejeté ne se
réactive jamais parce que l’entrée valide a disparu. Les rejets ne sont jamais
appliqués ni affichés comme des mémoires ou équipes valides.

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
Le rapport est disponible dans le hook ; son
affichage et le choix d’un membre avec restauration ne sont pas encore branchés
dans l’écran.

## Mémoires des membres

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
ou `null`) et `contenu` : `siege`, `rta`, `arene` ou `donjon`. Le contenu absent
se relit comme `siege`.

La validation au chargement impose 2 à 5 membres distincts, tous rattachés à la
liste indiquée par l’équipe ; un membre ne figure que dans une équipe par liste.
Un leader désigné appartient à ses membres. Les identifiants d’équipes sont
uniques ; portée, élément et contenu sont validés. Chaque champ texte doit être
une chaîne : aucun tableau ou objet n’est converti en texte pour être accepté.
Les valeurs `null` prévues pour le lead, sa statistique et son élément restent
admises. Un conflit ou une entrée
malformée est signalé et écarté. La cohérence avec les listes et leurs membres
se vérifie à l’écriture et au réimport, pas au chargement contre des listes
potentiellement illisibles. Le lead de RES ou Précision peut être conservé.
Le stockage ne calcule aucun lead effectif et n’ajoute aucun contrôle d’écran.

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
La reprise d’un point de sauvegarde et ses contrôles d’identité propres ne sont
pas encore branchés dans l’écran.
