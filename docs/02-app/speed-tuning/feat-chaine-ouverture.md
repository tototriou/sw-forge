# Speed tuning — le combo passe-t-il ? (chaîne d'ouverture)

**Statut :** ÉTAT ACTUEL — décrit le diagnostic de la chaîne d'ouverture et la recherche du réglage
**Lire si :** on modifie `diagnostiquerChaine` ou la recherche du réglage de vitesse

Partie de [Outils · Speed tuning](README.md).

## Le combo passe-t-il ? (chaîne d'ouverture)

⚠️ **Toute liste de problèmes sort dans l'ORDRE DE JEU** — coupés
(`diagnostiquerChaine`), vitesses requises (`vitessesRequises`), artéfacts
requis (`artefactsRequis`), et le message de tick du siège. Rangée par slot,
elle oblige à reconstruire la chronologie de tête pour comprendre qui coupe
qui, alors que c'est exactement la question posée. Celui qui **n'agit pas** dans
l'horizon ferme la marche : il ne s'insère nulle part, et le mettre en tête le
ferait passer pour le plus rapide.

Le speed tune sert à ça : que **tous** les monstres de l'équipe jouent **avant**
que l'adversaire ne s'intercale. Un seul adverse qui passe au milieu — souvent
une grosse vitesse de base qui remplit la barre des siens — coupe le combo.
Calcul dans [speedTune.ts](src/lib/speedTune.ts), **testé**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)).

- **La cible est le PREMIER adverse à agir** (`diagnostiquerChaine`), pas un
  monstre à désigner : c'est la condition la plus stricte, et celle qui n'oblige
  à rien saisir. Sont **coupés** les alliés dont le PREMIER tour tombe après lui
  (ou qui n'agissent pas dans les 40 ticks).
- ⚠️ **Le verdict tient en une ligne par monstre** : son nom et **le chiffre qui
  manque**, rien d'autre. Pas de tick, pas de vitesse de combat cible, pas de
  phrase d'explication — ce qu'on vient chercher ici, c'est « combien il me
  manque ». Le détail se lit dans les tableaux, juste en dessous.
- **DEUX leviers proposés**, pour chaque allié **à qui le réglage demande
  quelque chose** — pas forcément un allié coupé, voir « Comment le réglage est
  cherché » :
  - **la vitesse à trouver** (`vitessesRequises`) — la **vitesse de combat
    minimale** qui le fait passer avant, traduite à l'écran en points de
    **vitesse de runes** manquants ;
  - **l'artéfact « Effet aug. VIT »** (`artefactsRequis`) — le **%** minimal qui
    suffirait, **quand un buff de vitesse est en jeu** : l'artéfact l'amplifie,
    donc il remplace parfois des runes qu'on n'a pas. Plafond `ARTE_MAX = 60`
    (un proc vaut au mieux 6 %, une ligne encaisse 5 procs, un monstre porte deux
    artéfacts). ⚠️ **Rien n'est proposé sans buff** : l'artéfact n'amplifie que
    ce qui existe — c'est ce que dit `artefactRequis: null`.
    ⚠️⚠️ **Le plafond borne L'ARTÉFACT, pas le champ `artefactBuff`** — celui-ci
    porte aussi l'**amplification de camp** (Miriam +35 %), que le joueur ne
    choisit pas. Elle voyage donc à part (`ampliBuff`) et le plafond vaut
    `60 + ampli`, monstre par monstre. Borné à 60 en bloc, il ne laissait que
    25 points d'artéfact à un monstre amplifié, et l'outil répondait « hors de
    portée » sur **271 plateaux sur 568 (47,7 %)** — dont des équipes que
    29 points d'artéfact suffisent à régler. L'écran, lui, affiche la
    **différence** entre le requis et l'actuel : l'amplification s'y annule, et
    ce que le joueur lit reste un nombre de points d'artéfact.
  L'écran affiche « **+71 SPD** ou **+18 spd buff effect** » — l'un OU l'autre suffit ; la
  pastille d'artéfact n'apparaît que si un buff de vitesse court sur son camp.
  Aucun des deux leviers n'y change rien → « hors de portée ».
  ⚠️ **Les lignes se lisent ENSEMBLE** : c'est un réglage d'équipe, pas une
  liste de corrections indépendantes dont on piocherait une seule.

### Comment le réglage est cherché

⚠️ **C'est le VÉRIFICATEUR RETOURNÉ.** Même critère que `diagnostiquerChaine` —
tout le monde avant le premier adverse — mais on cherche les vitesses au lieu de
les juger. Pas de formule fermée : la règle « un seul monstre par tick », les
boosts de barre et les buffs par tick se mêlent, chaque essai se re-simule.

⚠️ **C'est un RÉGLAGE D'ÉQUIPE, pas une somme de corrections individuelles.**
Le solveur demande donc parfois des points à un monstre **qui passe déjà** —
accéléré, il joue plus tôt et **achète un tick** à celui de derrière — et rien du
tout à un monstre coupé que la correction d'un autre sauve. **L'écran liste ce
que le solveur demande, pas ce qui est coupé** : lister les coupés masquait la
moitié de la solution, qui ne tenait pas une fois appliquée.

#### Trois règles de terrain

Trois règles de terrain le cadrent :

- ⚠️ **LA VITESSE DU PREMIER EST INTOUCHABLE.** Celui qui ouvre le combo porte
  déjà le meilleur Swift du compte : lui demander des points, c'est proposer ce
  que le joueur ne peut pas faire. Aucune proposition ne le monte — **même quand
  c'est la seule issue** : le verdict est alors « hors de portée », ce qui est la
  vérité pour ce joueur-là. La contrainte ne vaut que sur l'axe vitesse : un
  artéfact, ça se change.
- ⚠️ **PERSONNE NE DOUBLE LE PREMIER** — et c'est la seule contrainte d'ordre.
  Celui qui ouvre remplit la barre : le doubler ferait jouer les boostés **avant**
  le boost, et le combo tombe. En revanche l'ordre **entre les suivants est
  libre** ici : un seul monstre joue par tick, il suffit que chacun se case entre
  le premier et l'adverse. C'est la section « Ordre des sorts » qui fixe cet
  ordre-là quand on le veut (`fenetresRequises`) — pas l'analyse simple.
  ⚠️ Protéger TOUT l'ordre de jeu refusait des réglages que la méthode à la main
  trouve : c'est ce que le contrôle P4 a fait apparaître.
- ⚠️ **LES MONSTRES FONT LA QUEUE.** Deux barres pleines au même tick jouent
  l'une après l'autre (la plus haute d'abord) : un allié peut donc jouer au tick
  7 en étant **prêt au 6**. Le dernier de l'équipe attend derrière tous les
  autres — **un tick à trois alliés, deux à quatre**, et ainsi de suite. C'est
  lui la contrainte qui décide ; les intermédiaires se casent ensuite entre le
  premier et lui.

#### La recherche en deux temps

La recherche se fait en deux temps, sur chacun des deux leviers :

- **1. Candidat** — ⚠️ **on PLACE des alliés, on n'énumère pas des ticks.**
  Chaque allié retenu est poussé **au plus tôt** : la plus grande valeur qui ne
  lui fait pas doubler celui qui joue devant lui (dichotomie ; monter ne peut que
  l'avancer). C'est ce qui achète un tick à ceux de derrière.
  ⚠️ On essaie les **sous-ensembles** d'alliés à pousser, du plus petit au plus
  grand, parce que **pousser quelqu'un peut NUIRE** : l'avancer libère le tick où
  il barrait la route à l'adverse. C'est mesuré des deux côtés — sur l'axe
  artéfact, amplifier le buff de celui qui remplit la barre avance son **second**
  tour et fait passer l'adverse ; « tout le monde au maximum » faisait déclarer
  « rien à proposer » un artéfact qui suffisait.
  ⚠️⚠️ **LE PREMIER N'EST HORS DU LOT QUE SUR L'AXE VITESSE** — il porte le
  meilleur Swift du compte, on ne peut rien lui trouver de plus. Sur l'axe
  **artéfact**, il en est : un artéfact se change. Le code l'excluait des deux
  (`slice(1)` inconditionnel), et rendait « hors de portée » 291 plateaux sur
  1 283 (22,7 %) qu'un artéfact posé sur l'ouvreur suffisait à sauver.
  ⚠️ Une version précédente énumérait des affectations allié → tick strictement
  croissantes. Elle **ignorait la file d'attente** et déclarait « hors de portée »
  des équipes réglables : le bon chiffre est parfois celui qui rend un allié prêt
  au **même** tick qu'un autre, pour jouer juste derrière lui (250, quand les
  seuils de tick sont 239 et 286).
- **2. Redescente** — chaque allié ramené à la plus petite valeur qui préserve le
  résultat du candidat, du dernier au premier, **jusqu'au point fixe**
  (`DESCENTES_MAX = 4` : baisser un allié de devant rend du mou à celui de
  derrière, déjà posé). Sans ça on afficherait des points de runes à trouver pour
  rien.
  - ⚠️ **Balayage ascendant, pas dichotomie** : le domaine des vitesses valides
    d'un allié **n'est pas un intervalle** (il tient au tick 3 et au tick 5, pas
    au 4) ; une dichotomie s'arrête au bord de la mauvaise fenêtre et surévalue.
  - ⚠️ **Par PALIERS DE TICK**, pas point par point : essayer les ~1 200 points un
    par un coûtait ~90 ms par frappe. On essaie le **bas** de chaque palier (par
    dichotomie sur *son* tick, qui lui est monotone), puis, si le **haut** du
    palier tient alors que le bas ne tenait pas, on cherche par dichotomie **dans
    le palier** le point où l'égalité bascule — à tick constant, seul le
    dépassement d'ATB change, et il ne fait que départager les barres pleines.
- **« Hors de portée »** (`combatRequis: null`) : aucun placement ne le fait
  passer, le premier restant à sa vitesse.

#### Vérification du réglage cherché

**Vérification** (skill `algo-verify`) — ⚠️ **la référence de contrôle ne doit
partager NI la stratégie NI la recherche du code testé.** La toute première
rejouait la stratégie « le minimum pour chaque monstre coupé » et validait donc
son angle mort. Trois propriétés sont contrôlées sur scénarios aléatoires à seed
fixe, dans [tests/speed-tune.test.ts](tests/speed-tune.test.ts) :

| | ce qui est vérifié |
|---|---|
| **P1 justesse** | la proposition, appliquée, fait tenir le tune **sans changer l'ordre de jeu** |
| **P2 minimalité** | un seul point de moins sur n'importe quelle valeur proposée et le tune tombe |
| **P3 complétude** | « hors de portée » n'est prononcé que si la référence n'en trouve pas non plus |
| **P1–P3 artéfact** | les trois mêmes, sur l'axe **artéfact**, à deux alliés (référence exhaustive) |
| **P4 méthode à la main** | à **trois ET quatre** alliés, le solveur fait **aussi bien ou mieux** que le joueur qui règle à la main, et n'est jamais bredouille là où la main trouve |

⚠️ **P1–P3 tournent sur LES DEUX AXES.** Elles ne couvraient que la vitesse, et
c'est ce qui a laissé passer d'un coup l'ouvreur exclu de la recherche et le
plafond qui bornait l'amplification de camp : les deux ne rendaient QUE des
« hors de portée », donc un axe qui ne proposait rien avait l'air de ne rien
casser. Sur l'axe artéfact, le contrôle se fait **à deux alliés**, là où la
référence est EXHAUSTIVE (tous les couples de valeurs, un par un) et vaut donc
preuve ; au-delà elle ne saurait qu'essayer « tout le monde au maximum ».

⚠️⚠️ **L'ADVERSE SE TIRE PAR RAPPORT AUX ALLIÉS.** Tiré indépendamment, il est
presque toujours hors de portée ou déjà battu, et le bloc passait ENCORE en
remettant les deux défauts qu'il devait dénoncer — une vérification qui ne peut
pas échouer. La zone qui discrimine est étroite : l'adverse un peu plus rapide
que le plus lent des alliés, là où quelques points d'artéfact font la bascule.
**Toute propriété ajoutée ici se contrôle en réintroduisant le défaut**, jamais
sur la seule foi du vert.

⚠️ **P4 est la référence qui vaut le plus** : elle ne vient pas du code mais du
terrain — la façon dont un joueur règle un tune, rejouée par balayage linéaire.
1) la vitesse du 1er est une donnée ; 2) le 2e n'est pas le point limitant, on le
« colle » devant ; 3) on cherche à quelle vitesse le **dernier** doit être pour
que la chaîne tienne — c'est lui qui décide ; 4) on redescend les intermédiaires
au minimum, du dernier vers l'avant, puisqu'il suffit que chacun soit entre celui
qui le précède et celui qui le suit. On compare le **coût en points**, pas le
chiffre au point près : la main redescend jusqu'au premier refus et s'arrête
parfois un cran trop haut, le domaine n'étant pas un intervalle.

⚠️ **C'est P4 qui a imposé l'ordre d'essai des sous-ensembles** : en commençant
par les PETITS, le solveur retenait la première solution trouvée et non la moins
chère (136 points là où la main en demandait 85). On essaie donc le plus grand
d'abord — pousser tout le monde puis redescendre, exactement la méthode à la
main — et les petits ensuite, pour le cas où pousser nuit.

⚠️ **LE SOLVEUR EST FIGÉ À TROIS ALLIÉS.** Cinq compos concrètes en fixent les
chiffres EXACTS dans les tests (« figé — … »), et chaque chiffre figé est
re-vérifié : appliqué, le tune doit tenir. Toute évolution qui les déplace doit
échouer là et être justifiée — c'est un contrat, pas une photo.

⚠️ **La référence de P3 n'est complète que sur les équipes de DEUX alliés** — sur
l'axe vitesse le premier est figé, il ne reste qu'une inconnue ; sur l'axe
artéfact les deux sont inconnues et le produit complet reste minuscule. Elle
balaie alors **tous** les points un par un : ça vaut preuve, sans rien supposer du
modèle. ⚠️ Elle figeait le premier sur les DEUX axes — elle partageait donc
l'angle mort qu'elle devait dénoncer. Au-delà, le
produit cartésien est hors d'atteinte ; elle balaie les affectations allié → tick
(non décroissantes, aux deux bords de chaque palier). **Contrôle incomplet,
assumé** : il peut rater une solution, jamais en inventer une — un échec est donc
toujours un vrai défaut.

#### Coût mesuré et limite du modèle

**Coût mesuré** (les deux axes, à chaque frappe) : **1,9 ms** sur un tune à 3
alliés avec boost d'ATB, **4,9 ms** à 4 alliés, **9,5 ms** à 5. Aucun budget ni
cache n'a été nécessaire.

- **Limite héritée du modèle** : le verdict repose sur les **premiers tours**

  (voir plus bas) ; un adverse très rapide qui rejouerait une deuxième fois
  avant la fin de la chaîne n'est pas compté comme une coupure supplémentaire.
