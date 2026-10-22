# Parallélisation de l'appariement et Worker de résolution

Voir aussi : pipeline.md, ../../../02-app/optimizer/ (feat-interruption.md), ../harnais/mode-d-emploi.md, ../verification.md, artefacts.md, ../invariants.md.

Deux usages des Workers suivent le même patron : un corps neutre, qui porte
toute la logique et ne connaît aucune plateforme, et une coquille par
plateforme, qui ne fait que brancher la messagerie. L'appariement parallèle
répartit l'appariement d'une grosse recherche sur plusieurs fils ; le Worker
de résolution sort du fil de l'écran la résolution de l'équipement des
builds trouvés. Leur place dans une recherche :
[pipeline.md § Appariement parallèle](pipeline.md) et
[pipeline.md § Worker de résolution](pipeline.md). Pourquoi un nombre de
Workers qui suit la machine et l'ordre séquentiel rendu en parallèle :
[ADR](../../../04-decisions/adr/appariement-par-seuils-exacts.md). Les contraintes à ne pas
casser : [../invariants.md § Workers](../invariants.md).

| Fichier | Rôle | Plateforme |
| --- | --- | --- |
| `src/workers/parallelPairing.ts` | le seuil du régime, la règle du nombre de Workers (`nombreDeTravailleurs`), le choix du régime (`regimeAppariement`) | neutre |
| `src/lib/appariementRapideParallele.ts` | coordinateur : plan des morceaux, distribution à la demande, fusion dans l'ordre, progression, arrêt (`apparierRapideEnParallele`) | neutre |
| `src/lib/travailleurAppariement.ts` | ce que fait un Worker d'appariement : `servirAppariement` (messages, tranches de `TRANCHE_MS`, arrêt), `MessageVersTravailleur` | neutre |
| `src/lib/cession.ts` | `cederLaMain` : la cession entre deux tranches, par message de canal (repli `setTimeout(0)`) | neutre |
| `src/lib/appariementRapide.ts` | corps d'un morceau (`initialiserTravailleur`, `parcourirMorceau` ; `traiterMorceau`, le même d'un bloc, pour les tests), le noyau, les types du protocole | neutre |
| `src/workers/runeBuildOptim.worker.ts` | choix du régime, lanceur `lancerTravailleurNavigateur`, arrêt et erreur | navigateur |
| `src/workers/pairingDriver.ts` | `lancerAppariement`, commun à l'écran et aux outils : pilotage compact et crédits vers le propriétaire | neutre |
| `src/workers/appariementRapide.worker.ts` | coquille d'un Worker d'appariement | navigateur |
| `scripts/lib/appariementRapideNode.ts` | lanceur `lancerTravailleurNode`, paquet `assurerBundleAppariementRapide` | Node |
| `scripts/lib/appariement-rapide-worker.ts` | coquille d'un Worker d'appariement | Node (`worker_threads`) |
| `src/workers/resolutionBody.ts` | corps de résolution (`CorpsResolution`), entrées et protocole | neutre |
| `src/workers/resolution.worker.ts` | coquille de résolution | navigateur |
| `src/workers/resolutionDistante.ts` | côté écran : quoi envoyer, annuler, écrire (`ResolutionDistante`) | neutre |

## Choix du régime

Les moitiés construites, le Worker principal compare l'espace exact à
parcourir, `compterPaires(prepared, bucketsA, bucketsB)` (`totalPairCount`
pour les compartiments objets des outils), au seuil
`PARALLEL_PAIRING_THRESHOLD` (100 000 000 paires), et vérifie le contrat
numérique du noyau (`verifierContrat`) : `regimeAppariement` rend le
parallèle à partir du seuil, contrat tenu ; sinon le séquentiel, dans ce
Worker. Hors contrat (une valeur non entière, un dépassement), le séquentiel
parcourt les colonnes sans saut (`apparierSansSauts`) ; un traceur de
diagnostic demande `pairBuckets`. Ces générateurs rendent la main ;
le coordinateur parallèle, lui, n'a aucun repli et refuse un
appariement hors contrat. Ni le mode exhaustif, ni le filet de temps, ni le
plafond de candidats n'entrent dans le choix. La construction des moitiés,
elle, se fait toujours dans des Workers, un par moitié et par préréglage
construit, quelle que soit la taille du cas
([pipeline.md § Construction des moitiés](pipeline.md)).

Le nombre de Workers est DÉRIVÉ de la machine, par une seule règle pour les
deux plateformes : `nombreDeTravailleurs(concurrence, coeursPhysiques)` =
les cœurs physiques moins `COEURS_LAISSES` (2), au moins `TRAVAILLEURS_MIN`
(2), au plus `TRAVAILLEURS_MAX` (8). Sans cœurs physiques connus
(`coeursPhysiques` à `null`), ils valent la moitié des fils logiques :
`floor(concurrence / 2) − 2`, mêmes bornes ; ni l'un ni l'autre connu,
`TRAVAILLEURS_PAR_DEFAUT` (4). La concurrence se lit dans
`navigator.hardwareConcurrency` au navigateur, dans
`os.availableParallelism()` sous Node. Les cœurs physiques, seule
l'application de bureau les connaît : son processus principal les lit
([bureau/ § Les cœurs physiques](../../../02-app/bureau/README.md)), la
page les passe dans la demande au Worker de recherche
(`DemandeDeRecherche.coeursPhysiques`, posé par `useBuildOptimSearch`),
qui n'a pas accès au pont ; le site et les outils Node passent `null`. Sur
la machine de mesure (8 cœurs, 16 fils) : 6 Workers, par l'une ou l'autre
voie.

- La moitié des fils logiques vaut le nombre de cœurs physiques sur une
  machine à deux fils par cœur. Une machine sans deux fils par cœur
  (processeurs ARM, Apple) reçoit donc, sans ses cœurs physiques, moins de
  Workers que de cœurs : non mesuré.
- Deux cœurs laissés, mesuré sur 8 cœurs et 16 fils. Au calme, 6 Workers
  vont aussi vite que 8 sur la plus lourde recherche (20 milliards de
  paires, 3,9 s contre 3,8 s) et plus vite sur une autre (10 milliards,
  7,1 s contre 8,1 s). Avec 4 ou 8 fils occupés par d'autres tâches, 6 et 8
  Workers restent proches (8 devant de 4 à 6 % sur la première, 6 devant
  de 4 à 5 % sur la seconde), mais ce que la recherche prend à ces tâches croît avec le
  nombre de Workers : avec 8 fils occupés, leur débit baisse de 8 % à 6
  Workers et de 13 % à 8, par rapport à 2 Workers.
- Sous la seconde, le lancement, la copie des compartiments et la
  préparation par Worker dominent : 2 Workers y battent 8 de 27 % (0,14 à
  0,23 s). Aucune règle propre aux petits espaces n'en est tirée (décision).
- Au moins 2 : une machine de moins de 8 fils n'est pas mesurée.
- Au plus 8 : au-delà rien n'est mesuré, et chaque Worker reçoit sa copie
  des compartiments et refait la préparation ; la mémoire croît avec leur
  nombre.
- Sur un petit espace, démarrer et alimenter les fils coûte plus que le
  calcul gagné. Le seuil a été placé, pour l'appariement par `pairBuckets`,
  entre une zone où le parallèle perdait et une zone où il gagnait, sans
  mesure fine entre les deux ; il n'est pas remesuré pour le noyau.
- L'appariement ne tourne pas sur GPU : sa chaîne de filtres à sortie
  anticipée fait diverger les fils, et WebGPU n'est pas disponible partout ;
  le CPU suffit aux plus gros cas mesurés.

## Répartition et partage du plafond

`apparierRapideEnParallele` (`src/lib/appariementRapideParallele.ts`)
découpe le travail en LIGNES, jamais en compartiments : une ligne est une
combinaison A ouverte face à un compartiment B ouvert, avec les prédicats de
`pairBuckets` (`satisfiesSets`, jokers, `bucketPairFeasibleMin`,
`comboAFeasible`) et dans son ordre de parcours.

- `planifierMorceaux` groupe les lignes, dans cet ordre, en MORCEAUX
  contigus d'au moins `cible = max(TAILLE_MIN_MORCEAU, totalPairs /
  (travailleurs × MORCEAUX_PAR_TRAVAILLEUR))` paires (2 000 000 et 64) :
  plus fins que les compartiments : une répartition par compartiments entre
  quatre fils peut laisser à l'un d'eux jusqu'à 63 % des paires (mesuré sur
  une recette réelle). Chaque morceau connaît sa position de départ
  globale (`offset`). La somme des tailles vaut `totalPairs`, que
  l'appelant a calculé pour choisir le régime ; un plan qui s'en écarte
  lève une erreur.
- Chaque Worker reçoit UNE fois, à son lancement (`InitTravailleur`), les
  paramètres de la recherche tels quels, l'instant de départ global et sa
  propre jeu de colonnes (`encoderCompartiments`),
  dont les tampons sont TRANSFÉRÉS : rien n'est partagé en mémoire. Les
  premiers Workers reçoivent une copie indépendante ; le dernier reçoit
  l'encodage original, que le coordinateur ne lit plus après le plan.
- Les morceaux partent ensuite à la demande, `EN_VOL_PAR_TRAVAILLEUR` (2)
  en vol par Worker : le suivant attend déjà quand l'un se termine, et un
  Worker rapide en prend davantage. Leur distribution ne dépend pas de
  l'ordre de fusion ; les quatre places de réception par producteur bornent
  les retours en attente. Un morceau voyage avec ses segments de lignes
  et le verdict de `comboAFeasible` de chacune.
- Le plafond de candidats est GLOBAL : aucune part par Worker. Un morceau
  s'arrête de lui-même dès qu'il a `maxCollected` candidats (la fusion
  aurait de toute façon coupé avant), et la fusion coupe au
  `maxCollected`-ième dans l'ordre séquentiel.

Ce que le plafond global change :

- Le parallèle rend EXACTEMENT le résultat du séquentiel, non tronqué ou
  coupé par le plafond : mêmes candidats dans le même ordre, mêmes paires
  traitées, même quasi-succès, quel que soit le nombre de Workers.
- Le filet de temps et l'arrêt manuel le font différer, de la même façon :
  chaque morceau déjà parti revient et se fusionne, coupé ou non
  (§ Fusion des résultats). Le résultat est une SOUS-SUITE des candidats du
  séquentiel non tronqué, qui en est le préfixe exact jusqu'au premier
  morceau coupé, celui-ci compris ; les morceaux suivants, achevés avant
  d'avoir reçu l'arrêt, y ajoutent leurs candidats, si bien que des
  candidats du séquentiel manquent entre deux morceaux. Rien de ce qui a
  été parcouru n'est perdu, et le parallèle peut rendre davantage que le
  séquentiel coupé au même instant ; ce n'est pas un préfixe.
- Ne pas donner à chaque Worker une part fixe du plafond : un Worker arrêté
  sur sa part laisserait le reste de son travail non visité, et les
  candidats gardés dépendraient du découpage.

## Le corps d'un Worker

`servirAppariement` (`src/lib/travailleurAppariement.ts`) reçoit les
messages d'un Worker et rend un résultat par morceau ; il appelle
`initialiserTravailleur(init)` puis parcourt chaque morceau par
`parcourirMorceau(contexte, morceau)` (`src/lib/appariementRapide.ts`).
Aucun contact avec la plateforme.

L'initialisation contient seulement les colonnes lues : pour A et B,
début de chaque compartiment, trois identifiants par demi-build, valeurs
plates des contraintes, pourcentages des seules contraintes PV/ATQ/DEF
et leur index ; pour B aussi `W`, tri, permutation, début des blocs,
minimum et maximum par bloc. Aucun score de rétention, contribution non
contrainte, compte de set ni potentiel ne traverse ce message. Les
identifiants permettent de retrouver les runes complètes dans le pool
préparé du Worker, pour la validation et son repli de référence.

1. `initialiserTravailleur` refait la préparation, `prepareSearch(params)` :
   une `PreparedSearch` porte des fonctions (`totalOf`), que le clonage ne
   transporte pas. Sur les mêmes paramètres, la préparation du Worker
   retrouve le pool du Worker principal ; elle lève si elle rend `null`, ou
   si les stats contraintes diffèrent de celles des compartiments reçus. Ne
   pas transmettre aux Workers le pool que le Worker principal a préparé
   pour leur épargner ce travail : ce champ de plus devrait suivre tous les
   constructeurs du message (skill `optimizer-field-propagation`).
2. Il remplace `prepared.startedAt`, que sa propre préparation vient de
   poser, par l'instant de départ global, AVANT tout usage du filet de
   temps. Sans ce remplacement, le filet `maxMs` repartirait de la fin de la
   construction des moitiés au lieu du lancement de la recherche.
3. `parcourirMorceau` apparie les lignes du morceau par le noyau
   ([pipeline.md § Appariement séquentiel](pipeline.md)), et rend ses
   candidats en colonnes avec leur position globale, les améliorations successives de
   son quasi-succès, ses paires traitées et visitées (et, pour chaque
   candidat, les visitées jusqu'à lui), et son issue (`IssueMorceau`) :
   `complet`, `temps`, `plafond`, `limite` (l'arrêt déterministe des tests
   et du banc) ou `arret`. Le temps se teste à chaque ligne
   et à chaque point de passage (`CHECKPOINT_EVERY` paires
   TRAITÉES) qu'une ligne franchit, sautée ou non : une suite de lignes
   entièrement sautées ne le contourne pas. Coupé par le temps à un point de
   passage franchi pendant un saut, le morceau compte ses paires traitées
   jusqu'à ce point.
4. `parcourirMorceau` est un générateur qui rend la main après chaque
   ligne. `servirAppariement` le pilote par TRANCHES de `TRANCHE_MS`
   (100 ms) : entre deux tranches, il rend la main à la boucle d'événements
   du Worker (`cederLaMain` : un message de canal, `setTimeout(0)` si `MessageChannel`
   manque ; jamais des `setTimeout` enchaînés, que Chromium ramène à 4 ms dès le
   6ᵉ niveau : mesuré dans Chromium, ~3,6 % du temps d'un Worker d'appariement), qui lit les messages arrivés entre-temps.
   Une tranche court d'un morceau au SUIVANT : son chrono ne repart
   qu'après avoir rendu la main, jamais à l'entrée d'un morceau, et le temps
   se teste avant chaque ligne, la première d'un morceau comprise ; un
   message est donc lu au plus `TRANCHE_MS` plus une ligne après son
   arrivée, même quand des morceaux s'enchaînent. Le test est synchrone :
   rien n'est attendu par ligne, seulement pour rendre la main.
   Un `{ type: 'arret' }` reçu arrête le morceau en cours à la ligne
   suivante, rendu avec ce qu'il a trouvé (issue `arret`), et chaque
   morceau qui attendait est rendu aussitôt, vide (`resultatVide`). Un
   morceau d'un bloc, sans arrêt manuel (`traiterMorceau`), sert aux tests.

Un morceau n'a aucune borne propre au parallèle : il s'arrête sur le filet
de temps global, sur le plafond de candidats, sur l'arrêt manuel ou à sa
fin. Aucun plafond de paires.

La sortie objet est une adaptation explicite pour les outils. En colonnes,
le générateur rend aussi un état `suite` à chaque bloc plein, sans changer
le point où il lit l'arrêt manuel. `servirAppariement` attend un message
`credit` après chaque envoi, terminal compris ; les coquilles transfèrent
les tampons des candidats, des positions et des visites. Les messages sont
lus pendant cette attente aussi ; après acquittement, le même filet global
et les mêmes points de passage restent applicables.

## Coquilles et lanceurs

Seul le lancement d'un Worker dépend de la plateforme.
`apparierRapideEnParallele` reçoit un lanceur (`LancerTravailleur`) qui
démarre un Worker avec son initialisation et ses tampons à transférer, et
rend une poignée (`PoigneeTravailleur`) : `envoyer` un morceau,
`surMessage`, `surErreur`, `arreter`, `terminer`.

| | Navigateur | Node |
| --- | --- | --- |
| Coquille | `src/workers/appariementRapide.worker.ts` | `scripts/lib/appariement-rapide-worker.ts` |
| Lanceur | `lancerTravailleurNavigateur` (`runeBuildOptim.worker.ts`) | `lancerTravailleurNode` (`scripts/lib/appariementRapideNode.ts`) |
| Initialisation | `new Worker(new URL('./appariementRapide.worker.ts', import.meta.url), { type: 'module' })`, puis un message `{ type: 'init', init }`, tampons transférés | `new Worker(chemin du paquet, { workerData: init, transferList })` : l'initialisation arrive à la construction |
| Morceaux | un message par morceau, un résultat par morceau | idem |
| Arrêt manuel | message `{ type: 'arret' }` | idem |
| Fin | `terminate()` | message `{ type: 'fin' }` : le serveur s'arrête, puis le fil ferme son port et sort de lui-même |
| Erreur | `onerror`, `onmessageerror` | événement `error`, sortie de code non nul |

- Les deux coquilles ne portent aucune logique : elles passent chaque
  message reçu au même `servirAppariement` et postent ce qu'il rend ; une
  exception du serveur est relancée hors de sa promesse, pour atteindre
  `onerror` (navigateur) ou l'événement `error` (Node). Les types du
  protocole (`InitTravailleur`, `Morceau`, `ResultatMorceau`) vivent dans
  `appariementRapide.ts`, `MessageVersTravailleur` dans
  `travailleurAppariement.ts` ; les deux coquilles les importent de là,
  jamais l'une de l'autre.
- Un Worker ne lit aucun message pendant qu'il calcule : c'est pourquoi il
  travaille par tranches (§ Le corps d'un Worker). Sans elles, l'arrêt
  manuel attendrait la fin de chaque morceau en cours, et des morceaux en
  attente derrière lui.
- Côté Node, un `worker_threads` exécute du JavaScript :
  `assurerBundleAppariementRapide` assemble la coquille par esbuild en un
  `.cjs`, une fois par processus, dans un dossier temporaire, et tous les
  Workers le réutilisent ; le temps d'assemblage n'entre jamais dans une
  mesure d'appariement. La fin passe par un message plutôt que par
  `terminate()` : terminer un fil pendant le transfert initial a fait
  planter Node.

## Code commun aux deux plateformes

La construction Node du harnais suit aussi le chemin en colonnes :
`scripts/lib/build-half-worker.ts` appelle `construireMoitieTypee`, puis
transfère les tampons de `tamponsDesDemiBuilds` au parent.
`scripts/lib/buildHalvesNode.ts` réunit les rétentions par
`construireMoitiesEmboiteesTypees`, sans `HalfCombo` intermédiaire.
L'adaptation objet est explicite pour les consommateurs d'outillage
(`construireMoitiesObjetsEnParallele`) et pour les diagnostics de suivi.

- `parallelPairing.ts`, `appariementRapideParallele.ts`,
  `travailleurAppariement.ts` et `appariementRapide.ts` n'importent jamais `worker_threads`, ni `self`, ni
  `postMessage`, ni le `Worker` du DOM : Vite tenterait de résoudre du code
  Node dans le paquet du navigateur (construction en échec, ou polyfill
  embarqué). La plateforme arrive donc par injection (le lanceur, les
  rappels `surControle` et `surProgression`) : ne pas la remplacer par un
  test `if (isNode)`, qui ferait référencer les deux plateformes au module
  neutre.
- `PARALLEL_PAIRING_THRESHOLD` et `nombreDeTravailleurs` vivent dans
  `parallelPairing.ts`, importable depuis Node : un outil Node les lit et
  leur passe sa propre concurrence (`os.availableParallelism()`, cœurs
  physiques à `null` : la règle du site), il ne les recode jamais, sinon il
  cesse de reproduire le régime que la production choisirait.
- L'écran, le CLI, le harnais et les bancs passent par `lancerAppariement`
  (`pairingDriver.ts`) : `apparierRapide` piloté par `drivePairing` en
  séquentiel, `apparierRapideEnParallele` en parallèle, mêmes colonnes,
  distribution et crédits. L'adaptateur Node `apparierNode` injecte
  `lancerTravailleurNode` et un récepteur sans aperçu ; il ne matérialise
  les objets qu'après le scellement. Le harnais suit ce même chemin
  ([../harnais/mode-d-emploi.md § Régime d'appariement : le seuil de la production](../harnais/mode-d-emploi.md)).
  Apparier par une copie du corps mesure un comportement qui n'existe pas.
  `scripts/lib/pairing-worker.ts`, un autre fil Node du dépôt, apparie par
  `pairBuckets`, la référence : un prototype de débit, pas la production.
- L'injection coûte un message par morceau, quelques centaines par
  recherche, jamais un appel par paire : la boucle du noyau reste dans le
  corps du Worker.

## Orchestration et progression

`apparierRapideEnParallele(options)` (`src/lib/appariementRapideParallele.ts`) :

1. rappelle `surControle` avec l'arrêt manuel, avant tout travail, pour que
   l'appelant l'inscrive dans son registre d'arrêt (`arreterAppariement`
   dans `runeBuildOptim.worker.ts`) : le module neutre ne connaît pas ce
   registre ;
2. vérifie le contrat numérique sur les colonnes de construction (ou les
   objets d'un outil), projette les contraintes, planifie les
   morceaux, lance `min(travailleurs, morceaux)` Workers, puis distribue ;
3. à chaque bloc reçu, le met en file dans son morceau et rend le crédit
   dès réception tant que la fenêtre du producteur a une place libre ;
   une pompe unique fusionne ce qui suit le préfixe déjà fusionné
   (§ Fusion des résultats) et rappelle `surProgression(traitees,
   candidats)` : les paires traitées et les colonnes des candidats
   FUSIONNÉS, dans l'ordre séquentiel — les comptes du résultat, dont la
   dernière progression est l'état final. Le Worker principal transmet ces
   blocs puis les retire ; le crédit du producteur est indépendant de cette
   publication. La transmission admet jusqu'à seize
   blocs sans attendre la page ; seul le remplissage de cette fenêtre
   impose une contre-pression. Les messages de progression sont espacés
   (au plus un par `PROGRESS_THROTTLE_MS`), avec `totalPairs` et le
   pourcentage (`estimatePct`) :
   [02-app/optimizer/feat-interruption.md § Barre de progression](../../../02-app/optimizer/feat-interruption.md#barre-de-progression).
   L'aperçu est ainsi toujours un préfixe du résultat final ;
4. termine tous les Workers, puis rend le résultat (`ResultatParallele`,
   que `enResultatDeRecherche` réduit au `SearchResult` : `explored` = paires
   traitées, aucun compteur propre au noyau).

## Fusion des résultats

Sur le chemin compact, chaque morceau rend des blocs intermédiaires puis
un bilan terminal. Un bloc contient au plus 4 096 candidats, les positions
globales de coupe et les visites cumulées ; les améliorations du quasi-succès
voyagent avec le même préfixe. La fusion conserve le même morceau courant
jusqu'à son bilan, et coupe avant toute émission au candidat du plafond.

Un Worker attend l'acquittement de son bloc avant de produire le suivant.
Le coordinateur réserve `BLOCS_EN_ATTENTE_PAR_TRAVAILLEUR` (4) places par
Worker, bilans vides compris. Il acquitte dès la réception, avant toute
fusion, tant que moins de quatre messages attendent pour ce producteur.
Le quatrième reste sans crédit jusqu'à la libération d'une place : seule
la saturation de cette fenêtre impose une contre-pression. Les places
d'un autre producteur ne peuvent pas la consommer ; le morceau de tête
peut donc toujours avancer. Les files sont des FIFO par morceau et la
fusion ne passe au suivant qu'après le bilan terminal, même lorsque
plusieurs blocs `suite` sont déjà reçus.

La pompe de fusion est unique et les réveils sont regroupés : pas de
promesse conservant chaque réponse après son adoption. Une publication
adopte au plus W blocs, où W est le nombre de Workers ; la pompe recommence
si le préfixe reçu permet encore d'avancer. En compact, la distribution
garde deux morceaux en vol par Worker, sans attendre la fusion des morceaux
terminés ; les quatre places de réception bornent aussi leurs bilans en
attente. Au plus 6W morceaux distribués ne sont pas encore fusionnés
(4W bilans reçus, 2W morceaux en vol). Cette distribution est unique pour
l'écran et les outils ; aucun chemin objet parallèle ne la remplace.
L'attente cède la main aux messages et
compte dans le filet global. L'arrêt coopératif draine les blocs et bilans
des morceaux déjà partis, puis la fusion ou le rejet rend toute place.

Les crédits de la page sont distincts de ceux des producteurs.
`EmetteurCandidats` transfère au plus `BLOCS_EN_VOL_VERS_PAGE` (16) blocs
sans acquittement : 7,5 Mio de colonnes au maximum, ajustées aux lignes
réelles. Il attend seulement à saturation de cette fenêtre, puis au
scellement pour que tous les blocs soient reçus. Une page complètement
arrêtée impose donc encore une contre-pression ; aucune file illimitée ne
la masque. Avec W Workers, la collecte compacte en transit occupe au plus
16 + 5W blocs de colonnes : seize vers la page, W dans la publication
courante et 4W chez les producteurs ou reçus en attente de fusion. Les
colonnes transférées restent ajustées aux lignes ; les positions et visites
reçues occupent au plus `4W × 4096 × 16` octets, hors publication courante.
Les quatre places limitent l'anticipation sans allouer un morceau entier.
Cette borne décrit le chemin de production, qui retire chaque publication ;
elle exclut les candidats déjà reçus par la page, qui constituent le
résultat, les positions de coupe et les métadonnées des morceaux.

- Dans l'ORDRE DES MORCEAUX, donc dans l'ordre séquentiel : chaque morceau
  rendu attend que ses prédécesseurs le soient, puis ses candidats se
  concatènent, coupés au `maxCollected`-ième.
- Les paires traitées et visitées décrivent le même périmètre : la somme
  de celles des morceaux fusionnés, celles du morceau du `maxCollected`-ième
  candidat comptées jusqu'à lui (sa position, les visitées jusqu'à lui) ;
  `sautees` en est la différence, jamais négative. Sous le plafond comme à
  l'arrêt déterministe, les trois valent celles du noyau séquentiel.
- Quasi-succès : chaque morceau rend les AMÉLIORATIONS successives de son
  propre état, avec leur position ; la fusion les rejoue dans l'ordre avec
  la règle de production (remplacé seulement si strictement meilleur, la
  première vue à égalité). Une tentative qui n'améliore pas son morceau ne
  peut pas améliorer l'état global : le rejeu redonne l'état séquentiel
  exact.
- Motif (`ResultatParallele.motif`) : `maxCollected` (le plafond, global),
  `maxMs` (un morceau coupé par le temps, ou plus rien de distribué une fois
  le filet dépassé), `manuel` (l'arrêt manuel), `erreur` (un Worker a
  échoué, § Arrêt, erreur et nettoyage) ; `arret` est l'arrêt
  déterministe à un nombre de paires donné, réservé aux tests et au banc. Le
  motif ne voyage pas dans le `SearchResult` : l'ordre étant séquentiel et
  le plafond global, il se déduit du plafond comme en séquentiel
  ([../harnais/mode-d-emploi.md § Complétude : jamais un « 0 candidat » nu](../harnais/mode-d-emploi.md)).
  L'écran ne lit que `truncated`.
- Le filet de temps et l'arrêt manuel n'arrêtent que la DISTRIBUTION :
  chaque morceau déjà parti revient (coupé ou non) et se fusionne, dans
  l'ordre, jusqu'au plafond global. Un morceau coupé (par le temps ou par
  l'arrêt) n'empêche donc pas de fusionner ceux qui le suivent : le
  résultat garde tout ce qui a été trouvé, ses paires traitées sont un
  compte et non une position, et il peut rendre davantage que le
  séquentiel, jamais moins de ce qui a été parcouru. Seuls le plafond et
  l'arrêt déterministe arrêtent la fusion.
- Aucune trace de diagnostic : le noyau ne remplit pas le traceur, et un
  traceur fait sortir l'appariement du contrat numérique (séquentiel, par
  `pairBuckets`).

## Arrêt, erreur et nettoyage

Si une panne arrive pendant une publication asynchrone vers le propriétaire,
le coordinateur attend son achèvement avant de rendre le bilan de panne.
Les messages suivants sont ignorés : le préfixe déjà publié reste celui du
bilan, et son scellement ne précède jamais un transfert en cours.

Un refus de `RecepteurCandidats.recevoir` ou de `sceller` est rattrapé dans
le hook : erreur journalisée, progression effacée, statut `error`, Worker
de recherche terminé avec ses enfants et réponses tardives invalidées.
Un rejet de `posterResultat` est rattrapé à la frontière de messagerie du
Worker principal et devient un message `error` ; une promesse rejetée de
`onmessage` ne déclenche pas à elle seule `onerror` chez son parent.
Le hook termine également le Worker sur ce message. Une relance conserve
le canal coopératif du bouton « Arrêter ».

- Arrêt manuel : le Worker principal reçoit `{ stop: true }` et appelle
  l'arrêt inscrit (`arreterAppariement`). Le coordinateur ne distribue plus
  rien et envoie `arreter` à chaque Worker : celui-ci arrête son morceau en
  cours à la ligne qui suit sa tranche (au plus `TRANCHE_MS`, plus une
  ligne, la tranche courant d'un morceau au suivant), le rend avec ce
  qu'il a trouvé et rend vides ceux qui
  attendaient. Le coordinateur attend ces réponses, fusionne tout ce qui a
  été trouvé et rend un résultat tronqué. Arrêté avant toute
  distribution, il ne lance aucun Worker et rend un résultat vide, tronqué.
  Rien n'est terminé avant d'avoir répondu : « Arrêter » rend tout ce qui a
  été trouvé.
- Arrêt pendant la construction des moitiés :
  [pipeline.md § Interruption](pipeline.md).
- Erreur d'un Worker : le coordinateur cesse de fusionner (un résultat
  arrivé ensuite est ignoré), termine TOUS les Workers (`finally`) : aucun
  ne survit, quelle que soit l'issue. Puis il rejette par
  `ErreurAppariementParallele`, qui porte l'erreur du Worker et l'état
  fusionné jusque-là : les morceaux contigus reçus, comme à l'arrêt, motif
  `erreur`, tronqué. Un rejet plutôt qu'un résultat : un appelant qui ne le
  traite pas (harnais, banc, tests) échoue au lieu de prendre une panne pour
  une recherche coupée. Le Worker principal attrape le rejet, le journalise
  (`console.error`) et poste cet état (`resultatApresErreur`) : l'écran
  garde les candidats déjà montrés, au lieu d'annoncer zéro combinaison
  après les avoir affichés. Une erreur levée avant tout Worker (hors
  contrat, plan incohérent) n'a rien à rendre : résultat vide, tronqué.
  Une erreur reçue une fois la fusion terminée (plafond atteint, arrêt
  déterministe), pendant le retour des morceaux en vol, ne change pas le
  résultat, déjà complet pour sa coupe : l'attente se termine, tous les
  Workers sont terminés, et le résultat est rendu avec son motif, sans
  rejet.
- Au navigateur, le lanceur annule l'événement `error` d'un Worker enfant
  (`preventDefault`, `erreurDeWorkerEnfant`) avant de le remettre au
  coordinateur : non annulé, le
  standard HTML le signale à nouveau dans la portée qui a créé le Worker,
  ici le Worker de recherche, d'où il remonterait au `onerror` du hook
  (statut `error`), en concurrence avec le résultat posté.
- ⚠️ Ne pas retirer ce `try/catch` du Worker principal : un rejet non
  intercepté dans un `self.onmessage` asynchrone n'atteint pas le `onerror`
  du parent. Aucun message n'arriverait, et l'écran resterait « en cours ».

## Worker de résolution

La résolution de l'équipement d'un build (paire d'artéfacts et relique)
suit le même patron : un corps neutre, `CorpsResolution`
(`src/workers/resolutionBody.ts`) ; une coquille navigateur,
`src/workers/resolution.worker.ts` ; et côté écran un module neutre,
`ResolutionDistante` (`src/workers/resolutionDistante.ts`), que le hook de
la file branche. Le corps et le module ne touchent ni `self` ni
`postMessage`, ni `worker_threads`, ni le DOM, ni React : Node et les tests
les exécutent tels quels. Le corps ne réimplémente rien : il reconstruit
l'entrée de production par `entreeResolutionDuBuild` et résout par
`resoudreEquipementDuBuild`, comme le fil de l'écran et le CLI
([pipeline.md § Résolution de l'équipement d'un build](pipeline.md)).
Pourquoi la file passe par ce Worker, ses deux voies de repli et ce qui a
été mesuré : [artefacts.md § Résolution hors du fil de l'écran](artefacts.md).

### Entrées sérialisables

Les entrées de la résolution directe ne traversent pas `postMessage` :
`ArtifactSearchParams` porte une fonction, `evaluer`, et l'entrée de
production porte des fonctions et des caches. Le contexte voyage donc en
données, `EntreesResolutionSerialisables` : la fiche (`fiche`), les
paramètres de paires sans `evaluer` (`artifactParams`), le régime effectif
(`regime`), le contexte de dégâts (`degats`, `null` hors « Dégâts réels »),
l'assiette des effets uniques de relique (`exclusive`), les conditions avec
auras (`requirement`) et le contexte relique de la recherche lancée
(`relicContext`). Le corps reconstruit le reste de l'autre côté.

- `entreesSerialisables` les produit depuis les arguments que l'écran passe
  à `entreeResolutionDuBuild` ; elle ne retire que `evaluer`, par
  décomposition : un champ ajouté à `ArtifactSearchParams` voyage sans
  qu'on le liste.
- `ProtocoleClonable` fait échouer `tsc` dès qu'un message ou une réponse
  du protocole porte une fonction, à toute profondeur ; la garde refuse
  aussi un objet à méthodes, que le clonage rendrait nu.
  `tests/resolution-worker.test.ts` le vérifie à l'exécution par
  `structuredClone`.
- Les runes d'un build voyagent avec sa demande ; elles viennent de
  `runesDuBuild` (`src/lib/relicQueue.ts`), le producteur de la résolution
  du fil de l'écran.

### Protocole et ordre

Vers le Worker (`MessageVersResolution`) :

- `contexte` (`idContexte`, `entrees`) remplace le précédent : les demandes
  encore en attente reçoivent `annule`, motif `contexte`, et les caches
  repartent à neuf (`nouveauxCachesResolution`), jamais réutilisés — le
  profil de dégâts est rangé par identifiants de pièces, qu'un autre
  inventaire réattribue ;
- `resoudre` (`idContexte`, `idDemande`, `cle`, `runes`) : une demande pour
  un build ; d'un autre contexte que le courant, elle reçoit aussitôt
  `annule`, motif `contexte` ;
- `annuler` (`idDemande` facultatif) retire la demande en attente visée, ou
  toutes ; chacune reçoit `annule`, motif `demande`. Une demande déjà
  résolue ne se rappelle pas.

Réponses (`ReponseResolution`), toutes marquées `idContexte`, `idDemande` et
`cle` : `resultat` ; `annule` ; `erreur` (`nom`, `message`, et `vide` d'une
`RechercheRefusee`). Exactement une réponse par demande reçue : la file
n'attend jamais un build qui ne viendra pas.

`recevoir` traite un message sans rien résoudre ; `etape` résout la plus
ancienne demande en attente, une seule. La coquille appelle `etape` dans une
tâche à part (`setTimeout`), une demande par tâche, pour qu'un nouveau
contexte ou une annulation arrivés entre deux résolutions passent avant la
suivante. La plateforme ne garantit pas l'ordre entre cette tâche et un
message déjà en attente : l'annulation n'est qu'une économie, la garantie
est du côté de l'appelant, qui ignore toute réponse d'une demande annulée ou
d'un contexte périmé. Le corps ne trie rien : la priorité (la page affichée
d'abord) se décide sur le fil de l'écran, par `prochainsATraiter`.

### Côté écran

`ResolutionDistante` décide quoi envoyer (`planifier`, dans l'ordre :
contexte, annulations, demandes ; détail dans
[pipeline.md § Worker de résolution](pipeline.md)), quoi écrire
(`recevoir`), quand publier et quand renoncer.

- Le contexte courant (`ContexteCourant`) est l'objet des entrées et la
  signature des réglages, comparés par identité à l'envoi ET à chaque
  réponse : une réponse arrivée entre un changement de réglage et le renvoi
  du contexte porte encore l'`idContexte` courant, c'est l'identité qui la
  démasque. Le contexte ne part que s'il reste du travail.
- `planifier` est idempotent. Au plus `DEMANDES_EN_VOL_MAX` (2) demandes
  sans réponse, annulées comprises : deux, pour que le Worker enchaîne la
  seconde sans attendre l'aller-retour vers un écran occupé ; pas plus,
  parce qu'une demande partie ne se double qu'en l'annulant. La plus
  ancienne en vol n'est jamais annulée : le corps l'a sans doute commencée.
- `recevoir` libère toujours la place en vol et rend une issue : `ecrite`,
  `ignoree` (motifs `contexte-perime`, `demande-annulee`,
  `annulee-par-le-corps`, `demande-inconnue`, `cle-differente`, `repli`) ou
  `erreur`. Une erreur n'est jamais tue, même pour une demande annulée :
  c'est la résolution de production qui a levé.
- Publication : `publier` (port) rend vrai si l'écran a reçu le cache, faux
  si la cadence l'a retenu. Après une écriture, la publication est forcée
  (`publicationForcee`) quand le build était le dernier non résolu de la
  page affichée, ou que la file se vide. Une écriture retenue est publiée de
  force quand la file se vide (`pomper`, réponse ignorée comprise) et au
  repli (`renoncer` rend vrai).
- Repli : une réponse `erreur` ou un envoi qui lève font `basculer` —
  renoncer (plus rien d'envoyé ni d'écrit, demandes en vol oubliées),
  publier de force s'il le faut, puis appeler le port `repli`, journalisé
  avec le nom, le message et le motif `vide` (`repliSurErreur`).
- Le hook de la file (`useArtifactOptimQueue`) fournit les ports
  (`PortsResolutionDistante`) et crée un seul Worker pour sa vie, au premier
  besoin, terminé au démontage. Hors d'un effet actif, une réponse libère
  sa place sans rien écrire. Une erreur du Worker, une réponse illisible ou
  une création impossible font aussi repasser la file sur le fil de
  l'écran, l'erreur journalisée par `console.error` ; le repli dure
  jusqu'au démontage.

## Vérifier un changement

- Le code commun s'exerce en Node tel quel :
  - `testAppariementParallele` (`tests/appariement-parallele.test.ts`) : la
    règle du nombre de Workers et du régime, puis le coordinateur avec des
    Workers simulés qui rendent leurs morceaux dans le désordre — résultat
    identique au séquentiel, plafond global, progression qui ne recule
    jamais et dont l'aperçu est un préfixe du résultat, arrêt manuel (avant
    et pendant la distribution), filet de temps déjà dépassé, panne d'un
    Worker (rejet porteur de l'état fusionné, rien de fusionné après, tous
    terminés ; `resultatApresErreur` et `erreurDeWorkerEnfant`, que le
    Worker principal appelle), refus hors contrat, et le corps d'un
    Worker qui court sur l'instant global, dont la tranche court d'un
    morceau au suivant (horloge simulée) ;
  - `testAppariementParalleleWorkers` : le même coordinateur sur de VRAIS
    `worker_threads` (`lancerTravailleurNode`) — identique au séquentiel,
    non tronqué et sous petit plafond ; arrêt manuel ;
  - `testAppariementParalleleCoupeWorkers` : sur de vrais `worker_threads`,
    deux morceaux d'au moins 1,5 s chacun (validation de référence), coupés
    EN COURS par le filet de temps puis par l'arrêt manuel, à un quart d'un
    morceau étalonné DANS un Worker (marge ×2 sur la vitesse des Workers) ;
    la précondition « coupé en cours » est vérifiée, jamais supposée. Chacun
    rend le début de ses candidats, et le résultat est une sous-suite du
    séquentiel, préfixe exact jusqu'au premier morceau coupé ; l'horloge n'y
    sert qu'à couper, aucun temps n'est jugé ;
  - `testAppariementRapide` (`tests/appariement-rapide.test.ts`) : l'oracle
    du noyau et le différentiel contre `pairBuckets`, morceaux simulés
    compris ;
  - `testAurasPariteRegimes` (`tests/auras-modele.test.ts`) force
    l'appariement parallèle sur de vrais `worker_threads`, sur un petit pool
    sous le seuil (la production y choisirait le séquentiel), et compare ses
    builds, dans l'ordre, à ceux du séquentiel et du CLI ; il vérifie aussi
    qu'un Worker, qui refait la préparation sur les paramètres clonés,
    retrouve le même pool après dominance ;
  - `testAppariementParalleleBranchement` : le harnais, qui orchestre les
    fonctions de production, choisit le parallèle au-delà du seuil, au
    nombre de Workers de la règle pour la machine, et rend exactement les
    candidats et les paires traitées du séquentiel forcé (profil
    `quota-parallele`, coupé par le plafond global) ;
  - hors `npm test`, `scripts/banc-appariement-rapide.ts` compare, sans
    filet de temps, le chemin de production (séquentiel et parallèle, au
    nombre de Workers de la machine) à `pairBuckets` sur les cas de `CASES`
    (`scripts/lib/perfShared.ts`) et sur une recette et un export : non
    tronqué, sous petit plafond, arrêté à un nombre de paires donné.
- Ne jamais simuler séquentiellement, dans un seul processus, ce qui dépend
  de l'horloge ou de la concurrence : le test du temps lit l'horloge. Les
  Workers simulés ne vérifient que des décisions de coordination (ordre de
  fusion, plafond, arrêt), le filet de temps n'y est testé que déjà dépassé.
- La coquille navigateur ne s'exerce qu'au navigateur, à la main, sur une
  recherche au-dessus du seuil : la progression avance (barre, compte de
  candidats) ; « Arrêter » pendant l'appariement rend les candidats déjà
  trouvés, pas zéro, sans blocage ; une recherche menée jusqu'au bout rend
  des résultats ; aucun Worker d'appariement ne survit à la recherche, chemin
  d'erreur compris. Le Worker principal, lui, reste en vie après une
  recherche finie : il n'est terminé que par la recherche suivante ou au
  démontage (`src/hooks/useBuildOptimSearch.ts`), et ses Workers enfants
  avec lui. Pour comparer au navigateur sans outillage : exporter la recette,
  la rejouer sur la version d'avant le changement, comparer les premiers
  résultats.
- Worker de résolution : `testResolutionWorker`
  (`tests/resolution-worker.test.ts`) — corps neutre, entrées clonables,
  résolution par le corps derrière `structuredClone` identique à la
  résolution directe, caches neufs par contexte, une réponse par demande ;
  `testResolutionDistante` (`tests/resolution-distante.test.ts`) — envoi,
  annulation, réponses périmées jamais écrites, repli, publication, une file
  simulée qui remplit le même cache que la résolution directe, et le
  branchement du hook gardé par des contrôles de source. La coquille
  `resolution.worker.ts` ne se vérifie qu'au navigateur.
