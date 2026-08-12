# Outils · Optimizer (`#/outils/optimizer`)

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**. Anticipé dans
[compte/calcul-runes.md §6](../compte/calcul-runes.md) (« Futur optimiseur
de builds »).

Fichiers : [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) ·
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) (moteur pur) ·
[runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts) (Worker) ·
[useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts) (cycle de vie du
Worker) · [MonsterGearPicker.tsx](src/components/outils/MonsterGearPicker.tsx) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx).

## Écran (de haut en bas)

1. **Sélecteur de monstre** — recherche parmi **tous** les monstres 6★ de la
   box importée (même liste que « Mon compte » → Monstres), **avec ou sans
   runes actuellement équipées** : un monstre nu se recherche tout aussi bien
   (même grammaire que [MonsterPicker](../shared/recherche-clavier.md)).
   Plusieurs exemplaires du même monstre → **une seule entrée** ; on retient
   l'exemplaire au meilleur équipement (somme d'efficience la plus haute,
   0 pour un monstre nu) pour les stats/artéfacts affichés. **Tous** les
   exemplaires comptent comme « à soi » pour l'exclusion (voir plus bas).
2. **Stats actuelles** — `computeStats(gear)` du monstre choisi, même
   grammaire `base/bonus/total` que [MonsterGear.tsx](src/components/MonsterGear.tsx)
   et le tableau de lecture des recommandations de siège.
3. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés.
4. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher (`SLOT_MAIN_OPTIONS` dans
   [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6.
   ⚠️ Ce filtre s'applique **avant** le pré-filtrage par pertinence, dans la
   construction même du pool par slot — il réduit donc le nombre de candidats
   réellement considérés **dès le départ**, ce qui aide aussi, en pratique, à
   éviter la troncature sur un gros compte (voir « Validation grandeur
   nature »).
5. **Conditions** — les 8 stats (`RECO_STATS`) : PV, ATQ, DEF, VIT, Taux
   Crit, Dmg Crit, RES, Précision. Chaque stat porte **deux champs, minimum
   et maximum**, tous deux facultatifs (absent = pas de contrainte de ce
   côté).
   - **Toggle Bonus / Total** (`<Segmented>`, [Segmented.tsx](src/components/Segmented.tsx))
     au-dessus de la grille, vaut pour les deux champs : la contrainte
     réellement posée au moteur est **toujours le total** (comme
     `RecoSlot.stats`), mais l'affichage peut se lire en **bonus** — ce que
     l'équipement doit apporter au-dessus de la **base nue** du monstre
     choisi (même sens que la colonne `bonus` du tableau de stats, voir
     [StatTable.tsx](src/components/outils/StatTable.tsx)).
   - ⚠️ **La valeur stockée ne change jamais de nature** : c'est une lecture
     dérivée (`total − base`) qui est recalculée à l'affichage, pas une
     conversion appliquée une fois puis oubliée. Basculer le toggle change
     donc immédiatement les chiffres affichés (sans perte), et **saisir**
     une valeur en mode Bonus l'enregistre convertie en total
     (`base + valeur saisie`).
   - Sans monstre sélectionné, la base vaut 0 : les deux modes coïncident.
   - ⚠️ **En mode Total, aucun des deux champs ne descend sous la base nue du
     monstre choisi** : même sans la moindre rune, le total vaut déjà au
     moins ça. En mode Bonus, aucun des deux ne descend sous 0. Le champ
     minimum vide affiche la base en **repère** (`placeholder`), pas « 0 »,
     qui laisserait croire qu'un total de 0 est une contrainte atteignable.
   - ⚠️ **Taux Crit, RES et Précision sont plafonnés à 100 %** sur les deux
     champs — leur effet en jeu ne va jamais au-delà, même si la somme brute
     des runes dépasse. **Dmg Crit n'a pas ce plafond** (200 %+ courant), les
     autres stats non plus.
     Ce plafond ne concerne **que la saisie** : la **recherche**, elle, ne
     doit surtout pas exclure un build dont la somme brute dépasse 100 % —
     c'est un résultat légitime (une marge de sécurité contre la
     précision/résistance adverse, par exemple). `computeStats` n'écrête
     jamais rien ; seuls les champs de saisie sont bornés.
6. **« Explorer tout l'inventaire »** — case à cocher, **décochée par
   défaut** (voir « Exclusion des runes » ci-dessous).
7. **« Options avancées »** (repliées par défaut) — temps limite en secondes
   et étendue du pré-filtrage par emplacement, tous deux des réglages
   utilisateur. Voir « Interruption » plus bas pour ce que chacun change
   concrètement, et pourquoi le second porte un avertissement.
8. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
   ne relance **rien automatiquement** : il faut recliquer, comme
   « (Ré)analyser mes decks » dans les recommandations de siège (« rien
   n'est confronté par défaut »). Pendant le calcul, le bouton affiche une
   icône de chargement (rotation) et se désactive ; un bouton **« Arrêter »**
   apparaît à côté — il interrompt la recherche et garde le **meilleur trouvé
   jusque-là**, plutôt que de tout perdre (voir « Interruption » plus bas).
9. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les 6
   runes (cadres orientés par slot, comme l'onglet Liste des runes), les sets
   obtenus, la table de stats résultante, la valeur totale dans la **mesure
   choisie** (Efficience ou Score SW — réglage global, voir
   [compte/runes.md](../compte/runes.md)). Un sélecteur **« Trier par »**
   re-trie **côté client, instantanément**, sans relancer la recherche : le
   moteur a déjà calculé les stats complètes de chaque combinaison retenue.
   Deux groupes d'options :
   - **Stats** : les 8 stats brutes + Efficience/Score.
   - **Objectifs** — critères composites, calculés à l'affichage depuis les
     stats déjà connues du candidat (`objectiveScore` dans
     `OptimizerSection.tsx`), pas dans le moteur :
     - **Dégâts (coup critique assuré)** : `ATQ × (1 + DCC/100)`.
     - **Dégâts (non critique)** : `ATQ`.
     - **Dégâts (moyenne)** : `ATQ × (1 + (TC/100) × (DCC/100))` — espérance
       sur le taux de critique réellement atteint.
     - **PV effectifs** : `PV × (1140 + 3,5 × DEF) / 1000` — réutilise
       **exactement** le facteur de défense déjà documenté dans
       [mecaniques.md](../mecaniques.md), pas une formule maison.
     ⚠️ Aucune des trois hypothèses de critique n'est « la bonne réponse » —
     ça dépend du monstre et de l'usage visé (RTA, siège…) ; les trois sont
     donc proposées côte à côte plutôt qu'un seul choix arbitraire.

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Forge (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

## Exclusion des runes déjà portées ailleurs

Par défaut, la recherche **exclut** les runes déjà portées par un **autre**
monstre de la box : elle ne propose que des combinaisons réellement
montables sans dérunir quelqu'un. Les runes déjà portées par le monstre
**choisi** (n'importe lequel de ses exemplaires) restent disponibles, elles
sont « à soi ».

**« Explorer tout l'inventaire »** lève cette contrainte : la recherche
porte alors sur l'**inventaire entier**, y compris des runes qu'il faudrait
retirer d'un autre monstre pour composer le build proposé — un outil
exploratoire (« si je pouvais réassigner librement mes runes »).

⚠️ **Le moteur est générique**, pas couplé à la box : `searchBuilds` ne
connaît qu'un `pool` de runes déjà filtré. `excludedRuneIds` (dans
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) est la fonction **spécifique
à la box** qui construit cet ensemble d'exclusion aujourd'hui — pensée pour
qu'un autre appelant construise le sien.

> **Prévu, pas construit** : brancher l'outil dans RTA (pool RTA, dont le
> runage est **séparé** du reste — voir
> [shared/import-compte.md](../shared/import-compte.md)) et dans le Siège
> (pool des decks de défense), avec la possibilité d'exclure des
> runes/monstres **ciblés** en plus de « tout » ou « rien ». L'architecture
> (pool + exclusion calculée par l'appelant) ne s'y oppose pas, mais rien de
> tout ça n'est implémenté pour l'instant.

## Interruption — temps limite et arrêt manuel

Trois façons dont une recherche s'arrête **avant** d'avoir tout exploré, en
plus du plafond de candidats collectés :

- **Temps limite** (`maxMs`, 15 s par défaut) — **réglage utilisateur**
  (« Options avancées » de l'écran, champ en secondes). Champ vidé = pas de
  limite automatique, seul le bouton « Arrêter » reste un recours.
- **Pré-filtrage par emplacement** (`slotFilterCap`, 40 par défaut) —
  également un réglage utilisateur, borné à 80 dans l'UI et accompagné d'un
  avertissement explicite : le relever aide à retenir plus de runes
  candidates, au prix d'un temps de recherche qui grandit vite sur un gros
  compte. Voir « Validation grandeur nature » pour ce que ce réglage change
  concrètement, et ses limites.
- **Bouton « Arrêter »** — l'utilisateur reprend la main quand il l'estime
  suffisant, sans attendre un plafond. Contrairement à un simple
  `worker.terminate()` (qui perdrait tout le travail déjà fait),
  l'arrêt est **coopératif** : le moteur tourne comme un **générateur**
  (`searchBuildsSteps`) qui rend la main tous les 500 paires évaluées ; le
  Worker vérifie à chaque point de passage si un message d'arrêt est arrivé,
  et si oui, renvoie le **meilleur trouvé jusque-là** au lieu de tout jeter.
  ⚠️ Un `terminate()` pur et simple aurait été plus simple à écrire, mais
  aurait vidé le bouton de son intérêt : on l'appuie précisément pour
  **garder** ce qui a déjà été trouvé, pas pour tout perdre.

Les cas de troncature se distinguent dans le message affiché : un arrêt
manuel dit « voici le meilleur trouvé jusque-là » (un choix assumé), un
plafond atteint dit « resserre tes critères » (une limite subie) — voir la
section Résultats plus haut.

## Validation grandeur nature — ce qu'un vrai compte a révélé

Un contributeur a signalé être bridé par le message de troncature sur son
compte réel (~4 400 runes, 600 à 1000 par emplacement). Plutôt que de
deviner, la même discipline que pour le calibrage précédent : retrouver un
monstre réel dans son export (Lushen, deck d'offense n°15), reconstruire ses
runes exactes via le moteur (`computeStats` retombe pile sur ses 8 stats
annoncées — **écart nul**, ce qui valide au passage tout le pipeline de
calcul sur des données réelles), puis chercher à RETROUVER ce runage avec
plusieurs stratégies, ses stats réelles servant de critères. Deux tours
successifs de mesure, chacun ayant trouvé une cause réelle avant de la
corriger — voir `.claude/skills/algo-verify/SKILL.md`.

### Premier tour — le choix d'algorithme

| Stratégie | Pool | Temps | Paires explorées | Runage exact retrouvé |
|---|---|---|---|---|
| Brute-force restreinte (top 12/emplacement) | 12⁶ ≈ 3 M | 2,4 s | 2 985 984 | ✅ oui |
| **Meet-in-the-middle**, même pool restreint (contrôle) | 12⁶ ≈ 3 M | **0,13 s** | **49 668** | ✅ oui |
| Backtracking séquentiel (sans MITM), pool réel complet | ~700/emplacement | 2,6 s (plafond atteint) | 5 000 000 | ❌ non |
| Meet-in-the-middle (production), pool réel complet | ~700/emplacement | 14,7 s (non tronqué) | 2 490 384 | ❌ non |
| Brute-force sur le pool réel complet | ~700⁶ ≈ 1,5 × 10¹⁷ | — | — | hors de portée (pour mémoire) |

**Meet-in-the-middle confirmé juste et nettement meilleur** : sur un pool
identique, il retrouve le même runage que la brute-force en **60× moins de
paires examinées** et **~18× plus vite**. Mais sur le pool réel complet,
MITM et le backtracking séquentiel échouent tous les deux à retrouver le
runage, pour la **même raison** : **3 des 6 runes réelles de Lushen étaient
écartées par le pré-filtrage** (`slotFilterCap=40`) avant même que la
recherche ne commence. Ce n'était donc **pas** un problème de stratégie de
recherche.

### Deuxième tour — la mémoire, puis le regroupement

Relever `slotFilterCap` pour que les 6 runes réelles survivent au
pré-filtrage (il fallait ≈100) a révélé un second problème, plus grave que
la lenteur : le moteur d'alors matérialisait **tous** les combos d'une
moitié en mémoire d'un coup (tableau de `cap³` objets, pas les « tableaux
typés » que [calcul-runes.md §6](../compte/calcul-runes.md) anticipait) — à
`cap=80`, le processus **plantait par épuisement mémoire** (~4 Go,
`Ineffective mark-compacts near heap limit`).

**Correctif** : les compartiments sont désormais construits **en flux** —
chaque combinaison d'une moitié est évaluée une fois, puis retenue ou
**immédiatement jetée** selon son mérite (`insertBounded`,
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), sans jamais passer par un
tableau intermédiaire de `cap³` éléments. La mémoire dépend maintenant du
nombre de compartiments × leur taille max (`BUCKET_CAP`), plus jamais du
cube du pré-filtrage. À `slotFilterCap=80` avec ce correctif : **plus de
plantage**, la recherche se termine (42 s, non tronquée) — mais toujours
« exact=non ».

⚠️ **Une combinaison dont les 6 runes individuelles survivent au
pré-filtrage n'est pas automatiquement retrouvée pour autant.** Le
regroupement par compte de pièces (voir « Algorithme ») rassemble parfois
des **dizaines de milliers** de combinaisons de 3 runes dans le **même
compartiment** (le combo de sets « évident » d'un vrai build en fait
partie) — la moitié réelle de Lushen doit alors se classer dans le
`BUCKET_CAP` premières par pertinence pour ne pas être jetée à son tour,
même si chacune de ses 3 runes, prise isolément, avait survécu à son propre
pré-filtrage de slot.

Mesuré à `slotFilterCap=80` (avec la contrainte de statistique principale de
Lushen posée — ATQ% en 2, Dmg Crit en 4, ATQ% en 6) :

| `BUCKET_CAP` | Temps | Paires explorées | Runage exact retrouvé |
|---|---|---|---|
| 300 (valeur initiale du correctif mémoire) | 14,3 s (non tronqué) | 330 600 | ❌ non |
| 600 | 16,5 s | 1 095 000 | ✅ oui |
| 1000 | 20,0 s | 2 631 000 | ✅ oui |
| 3000 | 49,8 s | 15 934 704 | ✅ oui |

**Retenu : `BUCKET_CAP = 600`** — le plus bas des trois qui retrouve le
runage exact, pour un temps de recherche qui reste raisonnable.

### Conclusion générale

- Le choix de l'algorithme (meet-in-the-middle) était déjà le bon —
  confirmé et non remis en cause par ce qui suit.
- Le vrai obstacle avait **deux couches**, découvertes l'une après l'autre en
  mesurant plutôt qu'en devinant : d'abord le pré-filtrage **par slot**, puis
  — une fois celui-ci desserré — le regroupement **par compartiment**. Les
  deux sont maintenant réglables (`slotFilterCap`) ou recalibrés
  (`BUCKET_CAP`), et le moteur ne risque plus de plantage mémoire en
  poussant l'un des deux.
- La **contrainte de statistique principale** (slots 2/4/6) aide aussi
  concrètement : en réduisant le pool brut avant tout le reste, elle rend
  chacune des deux couches ci-dessus moins sujette à l'écrasement par des
  runes hors sujet.

## Algorithme (résumé fonctionnel)

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface.
Lancer une **nouvelle** recherche (paramètres changés) termine sèchement
celle en cours (`cancel`, `worker.terminate()`) — sa réponse ne doit pas
écraser la nouvelle demande. Arrêter la recherche **en cours** pour en garder
le résultat passe par un canal différent, coopératif : voir « Interruption »
plus haut.

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune énumérée depuis le pool déjà
  pré-filtré. Les moitiés sont regroupées par le **compte exact** de pièces
  de chaque set demandé qu'elles apportent (+ jokers Intangible) : deux
  moitiés dont les comptes s'additionnent pour satisfaire le combo peuvent
  être appariées **sans jamais énumérer le produit complet** des runes
  individuelles.
  ⚠️ Un *branch-and-bound* linéaire sur les 6 emplacements (la première
  version) ne détecte un combo de sets impossible qu'une fois les 6 runes
  choisies — il gaspille donc des branches entières. Le regroupement par
  compte élimine ce gaspillage, et c'est mesuré (voir « Validation grandeur
  nature »).
- **Statistique principale imposée (slots 2/4/6)** : appliquée **avant**
  tout le reste, dans la construction même du pool par slot — un candidat
  dont la mainstat n'est pas dans la liste autorisée n'entre jamais en jeu.
- **Pré-filtrage par emplacement**, ensuite : chaque slot ne garde qu'un
  nombre borné de runes candidates (`slotFilterCap`) — celles du (ou des)
  set(s) recherché(s), les meilleures par pertinence vis-à-vis des minimums
  demandés, **et** le meilleur du slot sur **chacune des 8 stats
  individuellement**, même sans minimum demandé dessus (pour que le tri
  après coup reste honnête sur un critère non contraint).
  ⚠️ **Heuristique** : au-delà de ce pré-filtrage, le résultat est « le
  meilleur trouvé parmi le pool retenu ».
- **Compartiments construits EN FLUX, bornés en mémoire** (`BUCKET_CAP`,
  600) : chaque combinaison d'une moitié est évaluée puis, selon son mérite,
  retenue ou **immédiatement jetée** — jamais de tableau intermédiaire de
  `cap³` éléments. C'est ce qui a remplacé un risque de plantage mémoire par
  un coût borné et prévisible (voir « Validation grandeur nature »). Les
  bornes d'élagage (`maxPct`/`maxFlat` par compartiment) s'étendent à partir
  de **toute** combinaison rencontrée, même celles finalement jetées — rester
  large ici ne coûte rien et ne peut jamais écarter une paire à tort.
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** : le regroupement ne connaît que des comptes agrégés (pas les
  runes réelles), ce qui l'empêche de voir qu'un joker pourrait, dans la
  vraie combinaison, être disputé par une rune d'un set **hors combo
  demandé** (ex. un « Shield » isolé). C'est volontairement **plus
  optimiste** que la réalité, mais seulement dans le sens qui ne casse rien :
  s'il écarte une paire, la vraie combinaison échouerait forcément aussi.
  Chaque candidat qu'il laisse passer est ensuite **revérifié sur les runes
  réelles** (`activeSets`/`missingSets`) avant d'être retenu.
- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides (jusqu'à 2000, mesuré), pour permettre le tri après
  coup sur n'importe quel critère sans recalcul. Le maximum se prête à un
  élagage plus simple que le minimum : une combinaison ne peut qu'AJOUTER en
  complétant les 6 runes (jamais retirer), donc dès qu'un maximum est déjà
  dépassé par la première moitié seule (plus le contexte fixe), aucune
  seconde moitié ne peut plus repasser sous la barre — branche coupée sans
  even ouvrir la boucle de la moitié B.
- **Artéfacts et relique restent fixes** (ceux actuellement équipés) :
  l'outil optimise **uniquement les 6 runes**.
- Toutes les valeurs sont recalculées avec [stats.ts](src/lib/stats.ts)
  (`computeStats`), la même fonction que partout ailleurs dans l'app.
- **Écrit comme un générateur** (`searchBuildsSteps`), pas une seule boucle
  qui tourne jusqu'au bout : il rend un point de passage tous les 500 paires
  évaluées. `searchBuilds` (l'API historique, utilisée par les tests et le
  benchmark) ne fait que le drainer d'un bloc.

### Vérification

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** sur des jeux de
runes aléatoires mais déterministes (seed fixe) — même verdict de
faisabilité, aucun faux positif, même optimum exact sur les scénarios non
tronqués. [tests/rune-optim.test.ts](tests/rune-optim.test.ts) couvre en
plus, à la main, la statistique principale imposée (une rune écartée quand
sa mainstat ne correspond pas, une autre retenue) et les conditions maximum
(rejet au-delà, acceptation en-deçà, encadrement exact).

[scripts/benchmark-optim.ts](scripts/benchmark-optim.ts) (`npm run
benchmark:optim`, hors `npm test`) calibre les constantes sur des pools
synthétiques de 500 à 5000 runes — c'est ce qui a fixé `MAX_COLLECTED = 2000`.
La « Validation grandeur nature » ci-dessus complète ce calibrage sur un vrai
compte, pour des ordres de grandeur (nombre de runes par slot, poids d'un
compartiment) qu'un pool synthétique ne reproduit pas forcément.

## Limites connues

- **Pré-filtrage heuristique par emplacement ET par compartiment** : pas de
  garantie d'optimalité globale absolue au-delà de ce que ces deux étages
  retiennent. `slotFilterCap` et `BUCKET_CAP` sont mesurés sur un compte réel
  (voir « Validation grandeur nature »), pas prouvés exhaustifs dans
  l'absolu.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- L'exclusion v1 ne connaît que la **box** (6★ équipés) ; RTA, Siège et
  l'exclusion ciblée par monstre/rune sont prévus mais pas construits.
- **L'ordre dans lequel les paires de compartiments sont explorées reste
  arbitraire** : rien ne garantit que les meilleures combinaisons soient
  collectées en priorité plutôt que les premières rencontrées. Trier les
  paires par potentiel optimiste avant de les explorer reste un chantier
  ouvert.
- `maxMs` et `slotFilterCap` sont des réglages utilisateur (« Options
  avancées ») ; `maxCollected`/`maxNodes`/`BUCKET_CAP` restent des paramètres
  du moteur non exposés dans l'UI.
- Les objectifs de tri (Dégâts, PV effectifs) sont des **formules
  communautaires prédictives**, comme celles de la page Mécaniques — pas une
  simulation de combat réel.
