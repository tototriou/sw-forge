# Algorithme (résumé fonctionnel)

**Statut :** ÉTAT ACTUEL — décrit l'algorithme de recherche des runes : meet-in-the-middle et élagages
**Lire si :** on modifie runeBuildOptim.ts : énumération, regroupement, élagages ou budgets

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface.
Lancer une **nouvelle** recherche termine sèchement celle en cours ; arrêter
la recherche **en cours** pour en garder le résultat passe par un canal
différent, coopératif (voir « Interruption »).

## Recherche des runes — meet-in-the-middle et élagages
- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune énumérée depuis le pool déjà
  pré-filtré, puis regroupées par le **compte exact** de pièces de chaque
  set demandé qu'elles apportent (+ jokers Intangible) : deux moitiés dont
  les comptes s'additionnent pour satisfaire le combo peuvent être appariées
  **sans jamais énumérer le produit complet** des runes individuelles. Un
  choix mesuré et confirmé sur des comptes réels — voir « Vérification ».
- **Statistique principale imposée (slots 2/4/6)** : appliquée avant tout le
  reste, dans la construction même du pool par slot.
### Élagages sûrs

- **Élagages SÛRS, ensuite — jamais un faux rejet**, avant même le
  pré-filtrage heuristique qui suit, auras **propres** au build, Intangible,
  effet unique de la relique et lignes d'artéfact 218–221 compris : un
  oracle exhaustif indépendant le vérifie, noté
  par la note de production de l'équipement complet,
  paire d'artéfacts comprise (voir
  [effets d'équipe](../../degats-reels/effets-equipe-et-leaders.md)) :
  - **Dominance** : une rune strictement moins bonne qu'une autre du MÊME
    slot (sur toutes les stats suivies, avantage strict quelque part) ne
    sert jamais à rien. Deux runes du même set se comparent toujours ; un set
    demandé ou l'Intangible ne se compare qu'à lui-même. Hors combo, la
    comparaison reste générique, sauf pour un set qui pourrait changer ce
    qui compte pour la recherche : un set à bonus ou une aura
    qui peut réellement se **former** (assez d'emplacements distincts qui
    le portent, une Intangible comprise, dans la limite des emplacements
    libres) **et dont la stat est utile** — une condition minimum ou
    maximum (pour une aura, seulement RES/PRE avec l'interrupteur activé),
    une stat de l'objectif, ou une stat dont dépend l'effet unique d'une
    relique que la recherche peut équiper — sa stat de référence (« tous les
    X pts de … », lue au début du combat) ou la stat qu'il améliore
    (Bravoure, Éternité, Origine) ; la relique portée, ou toutes les
    reliques éligibles quand la relique est cherchée. Ainsi,
    en « PV effectifs » avec une relique Ténacité sur l'ATQ, un Fight reste :
    son aura peut faire franchir une tranche. En « Dégâts réels », une stat
    que lit une ligne d'artéfact 218–221 (dégâts supplémentaires en
    proportion des PV, de l'ATQ, de la DEF ou de la VIT) est utile au même
    titre : celles de la paire supposée par la recherche, et, en « Libre »,
    de tout artéfact éligible que le choix de la paire peut retenir —
    moins ceux qu'une autre liste réserve, à l'écran. Ainsi,
    un Energy reste face à un Will dès qu'un artéfact éligible porte la
    ligne 218, même si les PV ne sont pas une stat du sort. Ces lignes ne
    changent ni le pré-filtrage ni la rétention : un artéfact récolte les
    stats que le build possède déjà, il n'en fait pas chercher d'autres
    (voir [dégâts supplémentaires](../../degats-reels/artefacts-et-degats-bruts.md)).
    « Efficience » maximise toutes les stats.
    Le Taux Crit ne compte que sous un minimum de Taux Crit, jamais par
    l'objectif (décision du 2026-09-29 ; sa réserve « même en mode
    Moyenne » est sans objet depuis la suppression de ce mode). S'y ajoute, dès qu'une Intangible est disponible, tout set
    qui peut être complet avec ses seules vraies runes, puisque le joker ne
    complète un set que s'il est le seul incomplet. Ainsi, en « Dégâts
    réels » avec des minimums ATQ, Taux Crit et Dgts Crit, une Blade dominée
    reste et un Focus dominé part ; en « Efficience », Endure ou Blade
    formables restent, Violent ou Revenge partent. ⚠️ L'optimum n'est
    garanti que pour les conditions, l'objectif (effet unique de la relique
    et lignes 218–221 compris) et
    l'efficience : un tri après coup sur une autre stat peut manquer un
    build qu'un bonus de set inutile à la recherche aurait porté.
    ⚠️ Sur une stat PLAFONNÉE (un maximum est
    demandé dessus), le sens s'inverse — seule l'égalité stricte y est sûre
    à comparer.
  - **Faisabilité** : une rune ne peut jamais entrer dans un build valide si,
    même avec le meilleur trouvé dans le pool réellement possédé de chacun
    des 5 autres emplacements, un minimum demandé reste hors de portée — ou
    si elle dépasse déjà, à elle seule, un maximum demandé.
    ⚠️ **Côté minimum, la borne compte aussi ce que les sets pourraient
    encore ajouter** sur les emplacements libres : le bonus d'un set non
    demandé, ou d'une activation de plus d'un set demandé, et, interrupteur
    RES/PRE activé, 8 points par activation Tolerance/Accuracy **propre**
    possible — une Intangible pouvant, dans les deux cas, en compléter la
    dernière pièce. Le compte porte sur tout le pool,
    plafonné aux emplacements libres : une borne volontairement large,
    jamais trop basse. Côté maximum, seul l'inévitable compte : aucune de ces
    activations n'y est supposée. Les bornes rapides de l'appariement et le
    diagnostic de faisabilité reprennent les mêmes bornes.
    ⚠️ **L'apport des artéfacts y compte pour ce que l'INVENTAIRE peut
    donner, jamais pour ce qu'une paire choisie d'avance apporte.** Deux
    bornes distinctes : le meilleur apport atteignable pour juger d'un
    minimum, l'apport incompressible (zéro dès qu'un emplacement peut rester
    vide) pour juger d'un maximum. Sans cette distinction, laisser la stat
    principale sur **Libre** pouvait rendre MOINS de résultats que la forcer
    sur une stat précise — alors que « Libre » autorise strictement plus
    d'artéfacts : la paire supposée était choisie pour son score, et pouvait
    donc n'apporter aucune DEF alors que l'inventaire en contenait.
  - ⚠️ **Cette borne est calculée stat par stat**, donc plus optimiste que ce
    qu'une paire réelle peut fournir : deux emplacements ne portent que deux
    statistiques principales. Elle sert au pré-filtrage, où être large ne
    coûte que du travail en trop. **La décision finale, elle, se prend sur de
    VRAIES paires** : un build n'est retenu que si l'une des combinaisons
    réellement équipables lui fait tenir *toutes* ses conditions à la fois.
    Un résultat affiché respecte donc toujours les conditions demandées.
### Paire d'artéfacts d'un build

  - **La meilleure paire d'artéfacts d'un build suit le critère de
    classement**, et l’interrupteur « Adapter les artéfacts et reliques au
    tri » décide duquel : le **tri affiché** (défaut) ou l’**objectif de la
    recherche**.
    Trier par PV effectifs ne retient pas les mêmes pièces que trier par
    Dégâts réels — deux réponses différentes pour le même build, et c’est
    normal : un artéfact change les statistiques du monstre, donc le meilleur
    dépend de ce qu’on cherche.

    ⚠️ **Un artéfact ne peut bouger que PV, ATQ et DEF** (sa stat principale
    est plate). D’où quatre régimes seulement :
    - **PV, ATQ ou DEF** — la paire maximise CETTE stat. Auparavant elle
      maximisait la somme des principales : trier par ATQ classait donc sur
      une ATQ qu’une autre paire aurait dépassée (PV+1500 × 2 vaut 3000 en
      somme, ATQ+100 × 2 seulement 200). La stat est celle de la **fiche**,
      sans les points Bravoure, Éternité ni Origine — la valeur que la carte
      affiche et qui classe (degats-et-aura 6bis-b9). ⚠️ Conséquence voulue :
      « Adapter les artéfacts et reliques au tri » étant activé par défaut,
      le régime de l'équipement suit le tri ; en relique « recherche », trier
      par une stat ne fait donc plus préférer une Bravoure, une Éternité ou
      une Origine pour ses points, et la relique et la paire affichées
      peuvent changer par rapport à avant ce lot. Deux reliques de même
      principale y sont alors souvent **ex æquo** : la relique **portée**
      l'emporte si elle est parmi les meilleures, sinon la plus petite `id`
      (décision de l'utilisateur du 2026-10-01). Ce départage ne choisit que
      la relique affichée ; les autres régimes gardent la plus petite `id`.
    - **PV effectifs** et **Dégâts réels** — la paire maximise l’objectif.
    - **Efficience, Vitesse, Taux CRIT, Dgts CRIT, Résistance, Précision** —
      aucun artéfact n’entre dans ces classements : rien à y maximiser, seule
      compte la faisabilité. Basculer de l’un à l’autre ne recalcule donc
      **rien**.
  - **Faisabilité de SET, précoce** (pendant la génération d'une moitié, pas
    seulement à l'appariement) : pour chaque set demandé, si même le
    meilleur cas ne peut plus atteindre le compte requis, la branche est
    coupée avant même de choisir le 3ᵉ slot.
### Pré-filtrage heuristique et compartiments

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
  [compte/calcul-runes.md § 5.2 Bonus de set — **à ne pas oublier**](../../../compte/calcul-runes.md)).
- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides, pour permettre le tri après coup sur n'importe quel
  critère sans recalcul.
- **Budget de recherche adaptatif** : le moteur ajuste automatiquement le
  travail qu'il s'autorise en fonction du nombre de contraintes posées à la
  fois, plutôt qu'un plafond fixe deviné à l'avance — évite à la fois de
  gaspiller du temps sur une recherche lâche et de sous-budgétiser une
  recherche à beaucoup de conditions simultanées.
- **La recherche de runes optimise uniquement les 6 runes.** La relique
  reste fixe (`relic?: RelicDetail; // fixe`, `SearchParams`) ; les
  artéfacts y entrent comme **paire représentative** pour la notation
  (`artifacts`) et comme **bornes d'inventaire** pour la faisabilité
  (`artifactBounds`, produit par `bornesArtefacts`) — leur choix est un
  second problème, séparé (voir « Le choix des artéfacts »).
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

