# Outils · Optimizer (`#/outils/optimizer`)

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/calcul-runes.md §6](../compte/calcul-runes.md) (« Futur optimiseur
de builds »).

Fichiers : [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) ·
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) (moteur pur) ·
[runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts) (Worker) ·
[useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts) (cycle de vie du
Worker) · [useOptimizerState.ts](src/hooks/useOptimizerState.ts) (toute la
saisie de l'écran, remontée dans App.tsx) ·
[MonsterGearPicker.tsx](src/components/outils/MonsterGearPicker.tsx) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx) ·
[StatPanel.tsx](src/components/StatPanel.tsx) ·
[ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) ·
[RuneWheel.tsx](src/components/RuneWheel.tsx) — ces trois derniers
partagés avec `MonsterGear.tsx` (RTA/Siège/« Équipement actuel »), voir
[README.md](../README.md).

⚠️ **Survit à un changement d'onglet.** Comme les autres pages de l'app,
`OutilsPage` (et donc `OptimizerSection`) est **démontée** à chaque
navigation — un simple `useState` local y perdrait tout (monstre choisi,
conditions saisies, résultats…) au moindre aller-retour vers RTA ou une autre
page. `useOptimizerState` centralise donc cette saisie et est instancié
**dans `App.tsx`**, qui ne se démonte jamais tant que l'onglet du navigateur
reste ouvert — même principe que `useRtaState`/`useSiegeState` pour la prépa
RTA et les équipes de siège. ⚠️ **Sans écriture disque**, à la différence de
ces deux-là : cette saisie n'a rien à voir avec le compte importé ni le
système de conservation (voir [usePersistence](src/hooks/usePersistence.ts))
— fermer l'onglet ou recharger la page la perd, seule la navigation ENTRE
onglets de la session en cours la préserve. Le Worker de recherche lui-même
suit ce cycle de vie : une recherche en cours **continue de tourner** en
arrière-plan si on change d'onglet, et son résultat est toujours là au
retour.

## Écran (de haut en bas)

0. **Bandeau bêta** — permanent, pas refermable (contrairement à
   `MobileNotice` : ce n'est pas un avertissement ponctuel mais un statut qui
   reste vrai tant que l'outil est en rodage). Rappelle que le moteur de
   recherche peut être lent sur des critères serrés ou manquer un build sur
   un cas inhabituel, et qu'il faut vérifier le résultat avant de re-runer.
1. **Sélecteur de monstre** — recherche parmi **tous** les monstres 6★ de la
   box importée (même liste que « Mon compte » → Monstres), **avec ou sans
   runes actuellement équipées** : un monstre nu se recherche tout aussi bien
   (même grammaire que [MonsterPicker](../shared/recherche-clavier.md)).
   Plusieurs exemplaires du même monstre → **une seule entrée** ; on retient
   l'exemplaire au meilleur équipement (somme d'efficience la plus haute,
   0 pour un monstre nu) pour les stats/artéfacts affichés. **Tous** les
   exemplaires comptent comme « à soi » pour l'exclusion (voir plus bas).
2. **Équipement actuel** — **le composant `MonsterGear`, réutilisé tel quel**
   (pas réimplémenté), le même qu'en RTA/Siège quand on clique un monstre :
   stats base/bonus, artéfacts, roue de runes et relique **tels
   qu'ACTUELLEMENT équipés** sur le monstre choisi, chacun **cliquable**
   pour ouvrir son détail complet (`RuneDetailBox`/`ArtifactDetailBox`/
   `RelicDetailBox`, tous dans [MonsterGear.tsx](src/components/MonsterGear.tsx)),
   affiché **en ligne sous la roue** (pas un popover flottant). Ce que
   l'outil part optimiser, visible d'un coup d'œil avant de lancer quoi que
   ce soit — y compris les artéfacts et la relique, qui ne sont eux jamais
   modifiés par la recherche (voir « Algorithme »). ⚠️ **Artéfacts : toujours
   2 emplacements affichés** (Attribut puis Type), même si le monstre choisi
   n'en porte qu'un seul ou aucun — un emplacement vide est montré grisé
   plutôt que simplement absent. ⚠️ **L'encadré de stats bascule base+bonus
   ↔ total au clic**, comportement propre à `MonsterGear`, partagé avec RTA
   et Siège (voir [rta/sections-runes.md](../rta/sections-runes.md)).
3. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés. ⚠️ **Obligatoire** :
   tenter de lancer une recherche sans set sélectionné met cette zone en
   **surbrillance rouge marquée** au lieu de silencieusement ne rien faire —
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté.
4. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. Ce filtre
   s'applique **avant** tout le reste, dans la construction même du pool par
   slot — il réduit donc le nombre de candidats réellement considérés dès le
   départ.
5. **Objectif de recherche** — **un bouton à choix unique** (`<Segmented
   size="lg">`), choisi **avant** de lancer la recherche, pas seulement un tri
   après coup :
   - **Efficience** (par défaut) — pas de biais particulier, la mesure
     choisie globalement (Efficience ou Score SW, voir
     [compte/runes.md](../compte/runes.md)).
   - **Dégâts** — considère ATQ, Taux Crit et Dmg Crit **ensemble** (une
     seule formule d'espérance) : `ATQ × (1 + (Taux Crit/100) × (Dgts
     Crit/100))`. Taux Crit plafonné à 100 % **dans la formule**, même si le
     total brut d'un build le dépasse — au-delà, le surplus ne rapporte plus
     rien en jeu, donc pas plus de dégâts espérés dans ce calcul non plus.
   - **PV effectifs** — considère PV et DEF ensemble.
   - **Vitesse** — VIT seule.
   ⚠️ L'objectif choisi oriente le **pré-filtrage** (quelles runes ont une
   vraie chance d'être considérées) et le **tri par défaut** des résultats
   (modifiable ensuite) — il **n'influence pas** le classement des candidats
   pendant la recherche elle-même : seuls les minimums/maximums posés
   ci-dessous en décident, quel que soit l'objectif choisi.
6. **Artéfacts** — interrupteur **« Ignorer les statistiques des
   artéfacts »**, **décoché par défaut** (les artéfacts réellement équipés
   comptent). Décoché, deux listes déroulantes (Attribut, Type) proposent :
   **« Comme équipé »** (défaut, reprend l'artéfact du build de BASE),
   **ATQ +100**, **DEF +100**, **PV +1500** (les trois valeurs de
   statistique principale d'artéfact possibles en jeu), ou **« Aucun »**.
   ⚠️ Un même monstre peut porter des artéfacts DIFFÉRENTS selon le contexte
   (build de base, RTA, un deck de siège) — le sélecteur de monstre de
   l'Optimizer n'expose que le build de base ; choisir une statistique
   explicite permet d'hypothéquer l'artéfact d'un autre contexte sans changer
   de monstre affiché. Ces stats deviennent le PLANCHER des conditions
   ci-dessous.
7. **Conditions** — les 8 stats (PV, ATQ, DEF, VIT, Taux Crit, Dmg Crit, RES,
   Précision). Chaque stat porte **deux champs, minimum et maximum**, tous
   deux facultatifs — champ vide = pas de contrainte.
   - **Interrupteur « Stats de base exclues »**, activé par défaut : n'affecte
     que PV, ATQ, DEF et VIT — ces 4 stats ont une base qui grandit avec le
     niveau/l'éveil ; activé, le champ porte sur ce que l'**équipement**
     (runes et artéfacts) doit apporter au-dessus de la base nue. Désactivé,
     il porte sur le total. Taux Crit/Dmg Crit/RES/Précision restent
     TOUJOURS en total, quel que soit ce réglage.
   - Taux Crit, RES et Précision sont plafonnés à 100 % **sur la saisie**
     seulement — la recherche elle-même ne doit surtout pas exclure un build
     dont la somme brute dépasse 100 % (une marge de sécurité contre la
     précision/résistance adverse reste un résultat légitime).
   - **« Réinitialiser les conditions »** vide les 16 champs sans toucher aux
     autres réglages de l'écran.
8. **« Utiliser tout l'inventaire »** — case à cocher, **cochée par défaut**
   (voir « Exclusion des runes » ci-dessous).
9. **« Options avancées »** (repliées par défaut) : **pré-filtrage par
   emplacement**, en **presets** plutôt qu'un curseur libre — Bas / Moyen
   (défaut) / Haut / Extrême, du plus rapide au plus large (et donc plus
   lent, mais capable de retrouver un build sur un très gros compte). Sous ce
   réglage :
   - **« Rechercher jusqu'à épuisement complet »**, décoché par défaut :
     retire le filet de temps de 10 minutes (voir « Interruption ») — la
     recherche continue tant qu'il reste des combinaisons à examiner, plutôt
     que de s'arrêter au bout d'un temps fixe. ⚠️ Peut prendre très longtemps
     sur une recherche avec peu de conditions (beaucoup de combinaisons
     restent à examiner) : le bouton « Arrêter » reste le seul filet et garde
     le meilleur trouvé jusque-là. ⚠️ Ne retire que la limite de TEMPS — le
     plafond interne de candidats collectés (non réglable) reste actif ; une
     recherche assez large pour l'atteindre s'arrête quand même avant d'avoir
     tout exploré, ce qui n'a en pratique aucune conséquence sur la qualité
     du résultat (voir « Limites connues »). Fait partie des réglages
     exportés/importés dans une recette (voir plus bas).
   - **« Diagnostic approfondi sur 0 résultat »**, décoché par défaut (plus
     coûteux qu'un diagnostic simple, voir « Résultats »).
10. **Estimation du nombre de builds** — dès qu'un monstre et un set sont
    choisis, une ligne affiche un ordre de grandeur du pool considéré,
    recalculée en direct à chaque changement de critère. ⚠️ Un ordre de
    grandeur, pas le nombre réellement exploré — c'est un repère pour juger
    si les critères actuels sont trop larges ou trop stricts, pas une
    promesse de temps de calcul.
11. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
    ne relance rien automatiquement : il faut recliquer. Un bouton
    **« Arrêter »** apparaît pendant le calcul — il interrompt la recherche
    et garde le **meilleur trouvé jusque-là**, plutôt que de tout perdre
    (voir « Interruption »). ⚠️ **« Exporter les paramètres » / « Importer
    les paramètres »**, juste à côté : télécharge/relit un fichier `.json`
    contenant la RECETTE de cette recherche (set, minimums, objectif,
    préréglage, exploration de tout l'inventaire, choix d'artéfacts) —
    **jamais le pool de runes ni le compte**, ce qui la rend partageable
    entre joueurs. L'import remplit tous les réglages et sélectionne
    automatiquement le monstre de la box courante si son `com2usId` s'y
    trouve.
12. **Barre de progression** — se remplit progressivement (pas une roue qui
    tourne), avec le nombre de combinaisons déjà examinées et déjà trouvées.
13. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les
    sets obtenus, le **panneau de stats** (`StatPanel.tsx`, le même composant
    que dans « Équipement actuel ») et les artéfacts + les 6 runes sur une
    roue à échelle réduite, cliquables pour ouvrir le détail complet de
    chaque rune. Puis la valeur **moyenne par rune** dans la mesure choisie.
    ⚠️ **Sur 0 résultat**, un encadré diagnostic apparaît : soit une liste de
    conditions mathématiquement hors de portée (avec leur borne exacte), soit
    un message neutre orientant vers la conjonction des contraintes ou un
    pré-filtrage plus large. Un sélecteur **« Trier par »** re-trie **côté
    client, instantanément**, sans relancer la recherche : le moteur a déjà
    calculé les stats complètes de chaque combinaison retenue. Deux groupes
    d'options — les 8 stats brutes, et les 4 mêmes objectifs qu'à l'étape 5.
    Cliquer sur une rune d'un résultat ouvre le même popover que dans Mon
    compte → Runes.

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Forge (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

## Exclusion des runes déjà portées ailleurs

**« Utiliser tout l'inventaire »**, cochée par défaut, porte la recherche sur
l'**inventaire entier** — y compris des runes qu'il faudrait retirer d'un
autre monstre pour composer le build proposé.

Décochée, la recherche **exclut** les runes déjà portées par un **autre**
monstre de la box : elle ne propose alors que des combinaisons réellement
montables sans dérunir quelqu'un. Les runes déjà portées par le monstre
**choisi** (n'importe lequel de ses exemplaires) restent TOUJOURS
disponibles quel que soit ce réglage, elles sont « à soi ».

⚠️ **Le moteur est générique**, pas couplé à la box : `searchBuilds` ne
connaît qu'un `pool` de runes déjà filtré. `excludedRuneIds` (dans
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) est la fonction spécifique à
la box qui construit cet ensemble d'exclusion aujourd'hui — pensée pour
qu'un autre appelant construise le sien.

> **Prévu, pas construit** : brancher l'outil dans RTA (pool RTA, dont le
> runage est **séparé** du reste) et dans le Siège (pool des decks de
> défense), avec la possibilité d'exclure des runes/monstres **ciblés** en
> plus de « tout » ou « rien ». L'architecture (pool + exclusion calculée par
> l'appelant) ne s'y oppose pas, mais rien de tout ça n'est implémenté pour
> l'instant.

## Interruption — filet de temps, pré-filtrage et arrêt manuel

Trois façons dont une recherche s'arrête **avant** d'avoir tout exploré, en
plus du plafond de candidats collectés :

- **Filet de temps** — 10 minutes par défaut, pas un réglage direct : une
  garde-fou en cas de recherche anormalement longue. Le vrai moyen de
  reprendre la main **avant** reste le bouton « Arrêter ». Peut être retiré
  via « Rechercher jusqu'à épuisement complet » (Options avancées, décoché
  par défaut) — la recherche continue alors jusqu'à épuisement des
  combinaisons à examiner (ou du plafond de candidats collectés, voir
  ci-dessous), sans limite de temps automatique.
- **Pré-filtrage par emplacement** — les presets « Options avancées »
  ci-dessus, calibrés par mesure sur des comptes réels : plus le preset est
  large, plus le pool considéré par emplacement grandit, et plus la
  recherche peut prendre de temps (jusqu'à plusieurs dizaines de secondes au
  preset le plus large sur un très gros compte).
- **Bouton « Arrêter »** — l'utilisateur reprend la main quand il l'estime
  suffisant. L'arrêt est **coopératif** : le moteur rend la main
  régulièrement pendant la recherche et renvoie le **meilleur trouvé
  jusque-là** plutôt que de tout jeter.

Les cas de troncature se distinguent dans le message affiché : un arrêt
manuel dit « voici le meilleur trouvé jusque-là » (un choix assumé), un
plafond atteint dit « resserre tes critères » (une limite subie).

### Barre de progression

Poste des messages de progression **entre** les points de passage internes,
avec le nombre de combinaisons déjà examinées et déjà trouvées. ⚠️
**Approximatif par construction** : le moteur ne consomme pas ses budgets
internes à un rythme constant d'une recherche à l'autre, donc la barre peut
accélérer ou ralentir en cours de route plutôt que progresser régulièrement.

## Algorithme (résumé fonctionnel)

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface.
Lancer une **nouvelle** recherche termine sèchement celle en cours ; arrêter
la recherche **en cours** pour en garder le résultat passe par un canal
différent, coopératif (voir « Interruption »).

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune énumérée depuis le pool déjà
  pré-filtré, puis regroupées par le **compte exact** de pièces de chaque
  set demandé qu'elles apportent (+ jokers Intangible) : deux moitiés dont
  les comptes s'additionnent pour satisfaire le combo peuvent être appariées
  **sans jamais énumérer le produit complet** des runes individuelles. Un
  choix mesuré et confirmé sur des comptes réels — voir « Vérification ».
- **Statistique principale imposée (slots 2/4/6)** : appliquée avant tout le
  reste, dans la construction même du pool par slot.
- **Élagages SÛRS, ensuite — jamais un faux rejet**, avant même le
  pré-filtrage heuristique qui suit :
  - **Dominance** : une rune strictement moins bonne qu'une autre du MÊME
    slot (sur toutes les stats suivies, avantage strict quelque part) ne
    sert jamais à rien. Comparaison limitée aux runes de même set (ou toutes
    deux hors du combo demandé). ⚠️ Sur une stat PLAFONNÉE (un maximum est
    demandé dessus), le sens s'inverse — seule l'égalité stricte y est sûre
    à comparer.
  - **Faisabilité** : une rune ne peut jamais entrer dans un build valide si,
    même avec le meilleur trouvé dans le pool réellement possédé de chacun
    des 5 autres emplacements, un minimum demandé reste hors de portée — ou
    si elle dépasse déjà, à elle seule, un maximum demandé.
  - **Faisabilité de SET, précoce** (pendant la génération d'une moitié, pas
    seulement à l'appariement) : pour chaque set demandé, si même le
    meilleur cas ne peut plus atteindre le compte requis, la branche est
    coupée avant même de choisir le 3ᵉ slot.
- **Pré-filtrage heuristique par emplacement**, ensuite : chaque slot ne
  garde qu'un nombre borné de runes candidates, en fonction du preset choisi
  — celles du (ou des) set(s) recherché(s), les meilleures toutes
  provenances vis-à-vis des minimums demandés, une tranche garantie de runes
  hors du set demandé, et le meilleur du slot sur chacune des 8 stats
  individuellement (pour que le tri après coup reste honnête sur un critère
  non contraint). Les stats propres à l'objectif choisi reçoivent un budget
  de rétention plus large. ⚠️ **Heuristique** malgré tout : au-delà de ce
  pré-filtrage, le résultat est « le meilleur trouvé parmi le pool retenu »,
  pas une preuve d'optimalité globale sur l'inventaire entier.
- **Compartiments construits EN FLUX, bornés en mémoire** : chaque
  combinaison d'une moitié est évaluée puis, selon son mérite, retenue ou
  immédiatement jetée — jamais de tableau intermédiaire qui grandirait au
  cube du pré-filtrage. La rétention se fait sur **plusieurs critères en
  parallèle** (pas un seul score agrégé), pour qu'un build spécialisé sur une
  stat donnée ne perde pas sa place face à des builds plus généralistes.
- **Compartiments triés par potentiel décroissant** avant l'appariement : les
  paires les plus prometteuses sont explorées EN PREMIER, ce qui compte dès
  que le budget de recherche interrompt la recherche avant d'avoir tout
  exploré.
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** : le regroupement ne connaît que des comptes agrégés, ce qui
  reste volontairement plus optimiste que la réalité mais seulement dans le
  sens qui ne casse rien — chaque candidat qu'il laisse passer est ensuite
  **revérifié sur les runes réelles** avant d'être retenu.
- **Au plus 1 rune Intangible par proposition** : le jeu n'autorise à en
  sertir qu'une seule par monstre (voir
  [compte/calcul-runes.md §5.2](../compte/calcul-runes.md)).
- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides, pour permettre le tri après coup sur n'importe quel
  critère sans recalcul.
- **Budget de recherche adaptatif** : le moteur ajuste automatiquement le
  travail qu'il s'autorise en fonction du nombre de contraintes posées à la
  fois, plutôt qu'un plafond fixe deviné à l'avance — évite à la fois de
  gaspiller du temps sur une recherche lâche et de sous-budgétiser une
  recherche à beaucoup de conditions simultanées.
- **Artéfacts et relique restent fixes** (ceux actuellement équipés ou
  hypothéqués à l'étape 6) : l'outil optimise **uniquement les 6 runes**.
- Toutes les valeurs sont recalculées avec [stats.ts](src/lib/stats.ts)
  (`computeStats`), la même fonction que partout ailleurs dans l'app.
- **Écrit comme un générateur**, pas une seule boucle qui tourne jusqu'au
  bout : il rend la main régulièrement pour rester interruptible et pour
  poster sa progression sans jamais geler l'interface. La construction des
  deux moitiés tourne en **vrai parallèle** (deux Web Workers dédiés).
- **L'appariement peut lui aussi se paralléliser sur plusieurs Web Workers**,
  au-delà d'une taille de recherche donnée — en recherche normale (le filet
  de temps par défaut) comme en mode « Rechercher jusqu'à épuisement
  complet ». Invisible à l'écran : mêmes garanties (aucun résultat valide
  perdu, vérifié par différentiel), potentiellement plus rapide sur une
  grosse recherche.

### Vérification

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** sur des jeux de
runes aléatoires mais déterministes — même verdict de faisabilité, aucun
faux positif, même optimum exact sur les scénarios non tronqués.
[tests/rune-optim.test.ts](tests/rune-optim.test.ts) couvre en plus, à la
main, la statistique principale imposée, les conditions maximum, et les cas
limites de chaque élagage. Un test de régression à échelle réelle
([tests/rune-optim-scale-monotonicity.test.ts](tests/rune-optim-scale-monotonicity.test.ts))
couvre en plus des pools de taille proche des comptes réels, pas seulement
les petits jeux du test différentiel.
[tests/rune-optim-parallel-pairing.test.ts](tests/rune-optim-parallel-pairing.test.ts)
vérifie spécifiquement que découper l'appariement sur plusieurs Workers
retrouve EXACTEMENT le même ensemble de candidats que l'appariement
séquentiel, sur des jeux aléatoires balayés à 1/2/3/4 tranches. Le moteur a
par ailleurs été validé
« grandeur nature » : retrouver exactement le runage d'un monstre réel
existant, à partir de ses propres stats comme critères, sur un compte de
plusieurs milliers de runes.

## Limites connues

- **L'objectif de recherche n'affecte QUE le pré-filtrage**, jamais le
  classement pendant la recherche elle-même — voir « Écran », étape 5.
- **Pré-filtrage heuristique par emplacement** : au-delà du budget de
  recherche, le résultat est « le meilleur trouvé », pas une preuve
  d'optimalité globale absolue sur l'inventaire entier. Sur une recherche à
  beaucoup de conditions simultanées (au-delà de 5-6 à la fois), le moteur
  peut manquer un build qui existe réellement — un cas connu et documenté,
  pas retouché depuis.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- L'exclusion v1 ne connaît que la **box** (6★ équipés) ; RTA, Siège et
  l'exclusion ciblée par monstre/rune sont prévus mais pas construits.
- Le preset de pré-filtrage par emplacement et le filet de temps (« Options
  avancées ») sont réglables ; le plafond de candidats collectés et le
  budget de paires restent des paramètres internes du moteur, non exposés
  dans l'UI — **« Rechercher jusqu'à épuisement complet » ne les retire
  pas**. Sur une recherche assez large pour atteindre le plafond de
  candidats collectés avant d'avoir tout exploré, la recherche s'arrête
  quand même — en pratique sans conséquence sur la qualité du résultat, ce
  plafond étant largement au-delà de ce qu'affiche l'écran.
- **L'estimation du nombre de builds** est un ordre de grandeur, pas le
  nombre réellement exploré par le meet-in-the-middle — et la barre de
  progression est elle-même approximative (voir « Interruption »).
- **Le joker (rune Intangible) n'est pas toujours crédité, dans le
  classement de rétention, de la valeur qu'il débloque en complétant un
  set** — un demi-build à joker médiocre en sous-stats brutes mais qui
  complète un set précieux peut ne pas recevoir l'avantage de classement
  qu'il mériterait. Piste connue, pas encore corrigée dans tous les cas.
- L'objectif « Dégâts » est une **formule communautaire prédictive**, comme
  celles de la page Mécaniques — pas une simulation de combat réel.
