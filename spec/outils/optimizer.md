# Outils · Optimizer (`#/outils/optimizer`)

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets** et de **minimums de stats**. Anticipé dans
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
4. **Conditions minimum** — les 8 stats (`RECO_STATS`) : PV, ATQ, DEF, VIT,
   Taux Crit, Dmg Crit, RES, Précision. Chacune facultative (absente = non
   exigée).
   - **Toggle Bonus / Total** (`<Segmented>`, [Segmented.tsx](src/components/Segmented.tsx))
     au-dessus de la grille : la contrainte réellement posée au moteur est
     **toujours le total** (comme `RecoSlot.stats`), mais le champ affiché
     peut se lire en **bonus** — ce que l'équipement doit apporter au-dessus
     de la **base nue** du monstre choisi (même sens que la colonne `bonus`
     du tableau de stats, voir [StatTable.tsx](src/components/outils/StatTable.tsx)).
   - ⚠️ **La valeur stockée ne change jamais de nature** : c'est une lecture
     dérivée (`total − base`) qui est recalculée à l'affichage, pas une
     conversion appliquée une fois puis oubliée. Basculer le toggle change
     donc immédiatement les chiffres affichés (sans perte), et **saisir**
     une valeur en mode Bonus l'enregistre convertie en total
     (`base + valeur saisie`).
   - Sans monstre sélectionné, la base vaut 0 : les deux modes coïncident.
   - ⚠️ **En mode Total, la valeur ne descend jamais sous la base nue du
     monstre choisi** : même sans la moindre rune, le total vaut déjà au
     moins ça — demander un total plus bas n'a pas de sens, ce n'est donc
     pas saisissable (`NumberField` borné, `min = base`). Le champ vide
     affiche la base en **repère** (`placeholder`), pas « 0 », qui
     laisserait croire qu'un total de 0 est une contrainte atteignable. En
     mode Bonus, la valeur ne descend pas sous 0 pour la même raison (un
     bonus négatif n'a pas de sens non plus).
   - ⚠️ **Taux Crit, RES et Précision sont plafonnés à 100 %** — leur effet en
     jeu ne va jamais au-delà, même si la somme brute des runes dépasse. Une
     condition minimum sur ces trois stats est donc bornée à 100 en mode
     Total (`100 − base` en mode Bonus). **Dmg Crit n'a pas ce plafond**
     (200 %+ courant), les autres stats non plus.
     Ce plafond ne concerne **que la saisie d'une condition** : la
     **recherche**, elle, ne doit surtout pas exclure un build dont la somme
     brute dépasse 100 % — c'est un résultat légitime (une marge de sécurité
     contre la précision/résistance adverse, par exemple). `computeStats`
     n'écrête jamais rien ; seul le champ de saisie est borné.
5. **« Explorer tout l'inventaire »** — case à cocher, **décochée par
   défaut** (voir « Exclusion des runes » ci-dessous).
6. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
   ne relance **rien automatiquement** : il faut recliquer, comme
   « (Ré)analyser mes decks » dans les recommandations de siège (« rien
   n'est confronté par défaut »).
7. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les 6
   runes (cadres orientés par slot, comme l'onglet Liste des runes), les sets
   obtenus, la table de stats résultante, la valeur totale dans la **mesure
   choisie** (Efficience ou Score SW — réglage global, voir
   [compte/runes.md](../compte/runes.md)). Un sélecteur **« Trier par »**
   (PV/ATQ/DEF/VIT/Taux Crit/Dmg Crit/RES/Précision/Efficience) re-trie
   **côté client, instantanément**, sans relancer la recherche : le moteur a
   déjà calculé les stats complètes de chaque combinaison retenue.

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

## Algorithme (résumé fonctionnel)

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface —
« annulable » veut dire ici qu'une nouvelle recherche termine celle en
cours plutôt que de tenter une annulation coopérative.

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune entièrement énumérée depuis le
  pool déjà pré-filtré. Les moitiés sont ensuite regroupées par le **compte
  exact** de pièces de chaque set demandé qu'elles apportent (+ jokers
  Intangible) : deux moitiés dont les comptes s'additionnent pour satisfaire
  le combo peuvent être appariées **sans jamais énumérer le produit complet**
  des runes individuelles.
  ⚠️ Un *branch-and-bound* linéaire sur les 6 emplacements (la première
  version) ne détecte un combo de sets impossible qu'une fois les 6 runes
  choisies — il gaspille donc des branches entières à explorer des débuts de
  combinaison qui ne pourront jamais aboutir. Le regroupement par compte élimine
  ce gaspillage : une paire de moitiés dont les comptes ne peuvent pas
  satisfaire le combo est écartée **avant** d'examiner la moindre rune
  individuelle des deux côtés.
- **Pré-filtrage par emplacement**, avant le découpage en moitiés : chaque
  slot ne garde qu'un nombre borné de runes candidates — celles du (ou des)
  set(s) recherché(s), les meilleures par pertinence vis-à-vis des minimums
  demandés, **et** le meilleur du slot sur **chacune des 8 stats
  individuellement**, même sans minimum demandé dessus. ⚠️ Cette dernière
  règle existe pour que le tri après coup (voir plus haut) reste honnête sur
  un critère que l'utilisateur n'a pas contraint : sans elle, trier par une
  stat absente des minimums pouvait classer des combinaisons dont les
  meilleures runes sur cette stat avaient déjà été écartées du pool.
  ⚠️ **Heuristique** : au-delà de ce pré-filtrage, le résultat est « le
  meilleur trouvé parmi le pool retenu », pas une preuve d'optimalité
  absolue sur l'inventaire entier.
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** : le regroupement ne connaît que des comptes agrégés (pas les
  runes réelles), ce qui l'empêche de voir qu'un joker pourrait, dans la
  vraie combinaison, être disputé par une rune d'un set **hors combo demandé**
  (ex. un « Shield » isolé). Le groupage est donc volontairement **plus
  optimiste** que la réalité — mais seulement dans le sens qui ne casse rien :
  s'il écarte une paire, la vraie combinaison (avec cette concurrence en
  plus) échouerait forcément aussi. Chaque candidat qu'il laisse passer est
  ensuite **revérifié sur les runes réelles** (`activeSets`/`missingSets`,
  les mêmes fonctions que partout ailleurs dans l'app) avant d'être retenu —
  c'est cette vérification finale, jamais le groupage, qui décide.
- **Élagage de faisabilité, pas d'optimisation vers un seul critère** : la
  recherche collecte un ensemble large mais borné de combinaisons valides
  (jusqu'à **2000**, mesuré — voir « Vérification » ci-dessous), pour
  permettre le tri après coup sur n'importe quel critère sans recalcul. Passé
  ce plafond de collecte (ou le budget de paires évaluées), un bandeau
  signale que la recherche a été interrompue avant exhaustivité — la
  comparaison au meilleur possible n'a alors plus de sens et n'est pas
  garantie.
- **Artéfacts et relique restent fixes** (ceux actuellement équipés) :
  l'outil optimise **uniquement les 6 runes**.
- Toutes les valeurs sont recalculées avec [stats.ts](src/lib/stats.ts)
  (`computeStats`), la même fonction que partout ailleurs dans l'app — pas
  de second calcul de stats à maintenir.

### Vérification

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** (les 6 emplacements
énumérés en toutes lettres, sans pré-filtrage ni groupage) sur des jeux de
runes aléatoires mais déterministes (seed fixe). Vérifié à chaque
exécution : même verdict de faisabilité, aucun faux positif (chaque candidat
renvoyé est revérifié indépendamment), et — sur les scénarios non tronqués —
le même optimum exact que la référence.

[scripts/benchmark-optim.ts](scripts/benchmark-optim.ts) (`npm run
benchmark:optim`, hors `npm test` — mesure, ne vérifie rien) calibre les
constantes sur des pools synthétiques de 500 à 5000 runes, plusieurs
scénarios (aucune contrainte, set seul, set + minimums, combo serré). Constat
qui a fixé `MAX_COLLECTED = 2000` :

- la troncature est **systématique** dans tous les scénarios testés — c'est
  toujours le plafond de collecte qui coupe, jamais le budget de paires
  (400 000, largement hors d'atteinte) ;
- le pré-filtrage par emplacement borne déjà le travail réel : au-delà
  d'environ 500 runes, la taille totale du pool ne fait presque plus grimper
  le temps (chaque slot retient de toute façon un nombre borné de candidats) ;
- relever le plafond à 5000 reste sous ~4 s dans le pire scénario testé — la
  marge est confortable, ce qui laisse de la place pour un futur réglage
  utilisateur (« profondeur de recherche ») sans risque de blocage.

## Limites connues

- Pré-filtrage heuristique par emplacement : pas de garantie d'optimalité
  globale absolue au-delà de ce que le pré-filtrage retient (voir plus haut).
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- L'exclusion v1 ne connaît que la **box** (6★ équipés) ; RTA, Siège et
  l'exclusion ciblée par monstre/rune sont prévus mais pas construits.
- Le plafond de collecte est mesuré (voir « Vérification »), mais **l'ordre
  dans lequel les paires de compartiments sont explorées reste arbitraire** :
  même à 2000, rien ne garantit que les meilleures combinaisons soient
  collectées en priorité plutôt que les premières rencontrées. Trier les
  paires par potentiel optimiste avant de les explorer (réutiliser les bornes
  déjà calculées pour l'élagage) reste le chantier suivant.
- Pas encore de réglage utilisateur de « profondeur de recherche »
  (`maxCollected`/`maxNodes` sont déjà des paramètres du moteur, mais non
  exposés dans l'UI).
