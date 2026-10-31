# Speed tuning — ordre des sorts (analyse poussée)

Partie de [Outils · Speed tuning](README.md).

## Ordre des sorts (analyse poussée)

⚠️ **C'est un SOUS-BLOC de la card « Analyse automatique »**, pas un écran à
part : même cadre, même bouton de coupure. Couper l'analyse le referme.

L'analyse simple répond à « est-ce que tout le monde joue avant l'adverse ». Un
combo construit demande plus : **un ordre précis** — celui qui remplit la barre
part en premier, le nettoyeur de buffs ensuite, le gros dégât en dernier — et
il faut savoir **quel sort** chacun lance. Moteur dans
[speedTune.ts](src/lib/speedTune.ts) (`diagnostiquerSequence`, `fenetresRequises`)
et [speedTuneKit.ts](src/lib/speedTuneKit.ts) (`sortsVitesse`), **testés**.

### Un monstre qui joue PLUSIEURS FOIS

⚠️ **Un combo fait jouer le même monstre deux fois avant l'adverse** — Racuni se
vise lui-même au S2 (barre pleine → il rejoue au tick suivant) puis enchaîne son
S1. L'ordre doit pouvoir le dire, sinon le combo n'est ni descriptible ni
vérifiable : relancer le MÊME sort à chaque tour ne donnerait **rien du
tout** dès que le rechargement l'en empêche.

- Un **`+`** sur chaque ligne ajoute un tour à ce monstre. ⚠️ La nouvelle ligne
  naît **juste en dessous**, là où le tour se joue — un `+` en pied de liste
  aurait demandé de rechoisir le monstre puis de remonter la ligne à sa place,
  deux gestes pour un.
- Chaque ligne a **son sort et sa cible**. ⚠️ La cible appartient au couple
  (tour, sort), **pas au monstre** : un tour supplémentaire repart du défaut
  (barre la plus basse). Enchaîner Breeze après un *Rabbit's Agility* visé sur
  soi aurait visé le lanceur une seconde fois sans qu'on l'ait demandé.
- ⚠️ **Rien n'est deviné pour un tour supplémentaire.** L'analyse remplit les
  sorts manquants du 1ᵉʳ tour, jamais ceux d'un tour ajouté : c'est un combo
  qu'on décrit, pas un défaut qu'on suppose.
- Une croix retire un tour ajouté. ⚠️ **Le 1ᵉʳ ne se retire pas** : il n'est pas
  un ajout, c'est la présence du monstre dans l'ordre.
- ⚠️ **Ajouter une ligne RANGE l'ordre** (`ordreRange`). Sans ça, la
  resynchronisation sur les vitesses reconstruit la liste depuis la simulation
  et l'occurrence disparaît dans la foulée — un clic sans effet visible.

#### Un tour supplémentaire : ce qui reste et ce qui s'annonce

⚠️ **La ligne RESTE quand le combo ne tient pas**, signalée en rouge (« ne joue
pas une 2ᵉ fois ») — comme un rang qu'on réclame sans l'avoir. La faire
disparaître toute seule effacerait la question qu'on vient de poser. Le message
est **distinct** de « trop lent » : le tour n'a pas lieu du tout, ce n'est pas un
rang raté de peu, et envoyer corriger une vitesse serait un faux conseil.

⚠️ **Aucune migration.** La **1ʳᵉ occurrence garde l'identifiant nu**
(`allie:12`), seules les suivantes portent un suffixe (`allie:12#2`) : un ordre
déjà enregistré, une grille ou un sort choisi restent valides, et tout se lit
comme avant tant qu'aucun tour n'est ajouté. Côté moteur, `sortsParTour` et
`EffetSort.cle` (l'horloge de rechargement, **par sort** et non par tour — sans
quoi deux sorts sur deux tours la partageraient et le second serait bloqué).

⚠️ **Un tour supplémentaire n'annonce pas de vitesse à lui** : c'est le même
monstre, il n'a qu'une vitesse. La ligne dit que le tour n'a pas lieu, sans
chiffrer — annoncer deux vitesses différentes pour un seul monstre serait pire
que de se taire.

⚠️⚠️ **Mais les fenêtres CONNAISSENT les occurrences.** Un voisin nommé
`allie:12#2` resterait introuvable si les ticks se lisaient par
`premiersTours` : la contrainte « joue avant lui » tomberait **sans bruit**, la
fenêtre annoncerait une vitesse trop basse pendant que `diagnostiquerSequence`
déclare l'ordre cassé — **deux réponses opposées sur le même écran**. Les ticks
se lisent donc par `ticksParOccurrence`, et le monstre se retrouve par la base de
sa clé.

⚠️ **À ne pas confondre avec `rejoue`** (Kroa), qui est un tour pris au **même
tick**, sans qu'aucune horloge ne tourne : celui-là garde son champ `sort2` et
son marqueur « rejoue » sur la ligne du 1ᵉʳ tour.

#### Ce que l'analyse remplit, et ce qui la relance

⚠️ **C'est l'analyse qui la remplit.** Cliquer sur « Analyser » y écrit l'ordre
que les vitesses produisent et, pour chacun, le sort que son kit a retenu —
exactement comme elle écrit dans les grilles. Ces choix deviennent alors des
choix comme les autres : on les corrige, et **y toucher relance l'écriture**.

⚠️ **Ce qui relance l'analyse, c'est TOUT ce qui entre dans son `choix`** — le
sort du 1ᵉʳ tour, celui du second, **et la CIBLE**. Le reste (vitesses,
artéfacts, cases des grilles) est un réglage de l'utilisateur, où
l'automatisation ne revient jamais.

⚠️ **La cible en fait partie** : désigner « sur : lui-même » change qui reçoit
la barre, qui reçoit le buff, et donc à quel tick chacun joue ensuite. Sans
elle dans la signature, rien ne serait relancé : les grilles garderaient les
valeurs de la cible **précédente**, et on lirait un buff tombé au mauvais tick
sur un écran par ailleurs cohérent. Un **contrôle de
source** ([tests/speed-tune.test.ts](tests/speed-tune.test.ts)) vérifie
que la signature de relance est le miroir de l'objet passé à
l'analyse — une entrée ajoutée à l'un et oubliée dans l'autre échoue.

⚠️ **Mais un sort déjà choisi n'est JAMAIS réécrit** : l'analyse ne remplit que
les cases vides. Sans ça, changer un sort relancerait l'analyse, qui reposerait
aussitôt celui du kit — le choix se réinitialiserait sous les doigts et le
réglage serait impossible. Une chaîne vide (« Aucun sort ») est un **choix**,
pas une absence : elle est préservée comme les autres.

⚠️ **Rien n'est deviné à la volée** : le sort lancé est celui qui a été
ÉCRIT. Sans analyse, personne ne lance rien — l'outil ne suppose pas à la place
de qui règle. Le menu n'a donc pas d'entrée « Sort détecté » : il n'y a que des
sorts, et « Aucun sort ».

#### Ordre voulu, sort par monstre, tour rendu et verdict

- **Ordre voulu** : au départ, c'est **celui des vitesses** — l'ordre que la
  simulation produit aujourd'hui, les alliés sans vitesse connue à la fin. C'est
  le point de départ évident (« voilà ce que tu as »), et il se recale tant qu'on
  n'y a pas touché.
  ⚠️ **Le premier ▲▼ le FIGE** (`ordreRange`) : à partir de là c'est un choix, la
  liste ne suit plus les vitesses et se contente de suivre la composition (un
  allié ajouté entre à la fin, un retiré en sort). Le réécrire après coup serait
  une perte silencieuse. ⚠️ **Sauf à l'import d'un deck dans « Ton équipe »** :
  le rangement portait sur l'équipe précédente, l'ordre repart des vitesses
  (voir [feat-import-deck-siege.md](feat-import-deck-siege.md)).
- **Sort par monstre**, dans un **menu à icônes** (Bouton + `FlottantAuto` +
  rangées à plat, la grammaire des listes ancrées de l'app) — ⚠️ **`FlottantAuto`
  et non `Flottant`** : le bouton se promène au bout d'une rangée, et un flottant
  posé toujours du même côté sortirait de la page par la droite ; celui-ci mesure
  la place autour de son ancre et choisit son côté : la ligne reste
  lisible d'un coup d'œil et le détail s'ouvre à la demande. Le bouton porte
  l'icône du sort retenu ; chaque entrée dit ce que le sort fait et son taux de
  réussite. ⚠️ **Pas des cartes `Option` dans le flottant** : elles y font des
  coins dans des coins (voir la note de l'import de deck). Le bouton porte l'icône du
  sort retenu. Trois familles d'entrées : « Sort détecté » (celui que la lecture
  du kit a retenu),
  « Aucun sort », ou **n'importe quelle compétence** du kit — ⚠️ **toutes** sont
  proposées, y compris celles qui ne touchent ni la barre ni la vitesse : on doit
  pouvoir dire « à ce tour-là il lance son S1 », c'est le sens même d'un ordre de
  sorts. Seules les **passives** sont écartées (elles ne partent pas à son tour).
  Chaque entrée dit ce qu'elle fait (« S3 Tailwind — +45 % barre équipe · buff
  VIT ») et, s'il y en a un, son **taux de réussite**. Le choix entre dans la
  simulation, donc dans tous les tableaux et dans le verdict.
- **Tour RENDU** : quand la compétence choisie rend son tour au lanceur (Kroa,
  *Owl's Hoot* : buff de vitesse à toute l'équipe **puis elle rejoue**), la ligne
  porte un badge **« rejoue »** et un **second `Selecteur`** — ce qu'il lance à ce
  second tour, qu'on ne devine pas.
- **Verdict par monstre** : à sa place, ou ce qui cloche — *n'agit pas*, *joue
  après l'adverse*, *joue trop tôt*, *joue trop tard*.
  ⚠️ **La contrainte se juge PAR VOISIN** (je joue après mon prédécesseur, avant
  mon successeur), jamais sur un rang global : un rang qui retombe juste par
  accident masquerait un monstre qui double celui qu'il doit suivre (test
  différentiel des fenêtres).

### Fenêtres de vitesse

⚠️ **Ici, un monstre peut avoir besoin d'être RALENTI.** Tenir un rang, ce n'est
pas seulement jouer assez tôt, c'est aussi jouer assez tard. Chaque rang donne
donc une **fenêtre** `min → max`, dont l'écran ne montre **que ce qui manque** :
la borne à viser traduite en points de vitesse de runes, **négatifs** s'il faut
en retirer — et, comme le verdict, l'alternative en **artéfact** quand un buff de
vitesse court (`fenetresRequises` prend l'axe en paramètre : même méthode, même
garanties). Un rang tenu n'affiche qu'une coche.

⚠️⚠️ **DANS L'ÉCRAN, LES FENÊTRES SONT ENCHAÎNÉES** — chacune suppose les autres
corrigées (`fenetresRequises`, drapeau `enchainer`). Calculées indépendamment,
**deux monstres trop lents à la suite** rendent la fenêtre du dernier **VIDE** :
il ne doit pas passer devant son prédécesseur, un prédécesseur qu'on sait déjà
cassé. Sur Tiana / Galleon / Zaiross, Zaiross sortirait `min 286, max 151` —
l'écran dirait « est trop lent » **sans dire de combien**, précisément sur le
monstre qu'on cherche à régler. Or c'est la question qu'on pose ici : *quelles
vitesses pour que TOUT passe*.

⚠️ **La chaîne se résout PAR LA FIN, et il faut ITÉRER.** Corriger le 2ᵉ puis
lire le 3ᵉ ne marche pas : posé à SON minimum, le 2ᵉ ne laisse plus la place au
3ᵉ. Une seule passe arrière ne suffit pas non plus, parce que les exigences sont
**mutuellement dépendantes** — tant que Galleon traîne, Zaiross n'a qu'à prendre
le tick que l'adverse laisse ; dès que Galleon est corrigé et occupe ce tick,
Zaiross doit à son tour passer devant l'adverse, et sa borne monte de 286 à 296.
On itère donc jusqu'au **point fixe** : les corrections ne font que MONTER et
sont bornées par le plafond, la terminaison est acquise. ⚠️ **Un seul monstre
agit par tick** — corriger l'un DÉPLACE les autres : c'est ce couplage qui rend
l'itération nécessaire, pas un raffinement.

⚠️⚠️ **ON NE CORRIGE QUE CE QUI EST ENCORE EN DÉFAUT**, un monstre à la fois, en
rediagnostiquant après chaque correction — et **le premier en défaut dans
l'ordre**, jamais le dernier : c'est lui qui contraint ses successeurs. Poser
d'office chaque monstre signalé à son minimum **surestimerait** : sur
Chilling 396 / Carcano 366 / Seren 354 (référence Chilling 396), Seren est
signalé « trop lent », donc serait remonté — et Carcano, calculé contre un
Seren corrigé plus rapide que le vrai, réclamerait **+2** là où **+1**
suffit. Le défaut de Seren est une **conséquence** de la position de
Carcano : une fois Carcano corrigé, Seren n'a plus rien à faire.

⚠️⚠️ **LA BORNE ANNONCÉE EST REJOUÉE.** Les dichotomies cherchent chacune une
condition, et les corrections enchaînées supposent les autres réglés : rien de
tout ça ne garantit le **plus petit point qui, en ne bougeant que CE monstre,
fait tenir l'ordre** — et c'est pourtant le seul geste que l'utilisateur fasse.
Quand la borne suffit **à elle seule**, on balaie donc **vers le haut** depuis sa
vitesse actuelle et on annonce le premier point qui marche.

- ⚠️ **Vers le haut, jamais une dichotomie** : « l'ordre tient » n'est **pas
  monotone** en vitesse — un seul monstre agit par tick, donc aller plus vite
  peut voler le tick d'un allié. Le premier point qui marche en partant du bas
  est le minimum **par construction** ; une dichotomie y trouverait n'importe
  quoi.
- ⚠️ Seulement quand la borne suffit à elle seule : sinon elle vaut « les autres
  étant corrigés », et il n'y a pas de minimum individuel à chercher.
- Coût mesuré : **~2,4 ms** par appel, même avec des monstres très en retard.
- **Gardé** par une propriété balayée : *toute borne qui suffit à elle seule est
  la plus petite*. ⚠️ L'artéfact n'est pas tiré au sort DANS le constructeur
  de plateau : chaque appel comparerait une configuration différente et
  « trouverait » des fautes inexistantes.

⚠️ **Les bornes annoncées sont VÉRIFIÉES, pas déduites** : le test repose les
vitesses trouvées, contrôle que l'ordre demandé est tenu, puis qu'**un seul point
de moins le casse** — la borne est le minimum, pas une marge. Une borne affichée
sans avoir été rejouée enverrait régler une équipe sur un chiffre faux. Coût
mesuré : ~6 ms pour une équipe de trois.

⚠️ Le mode **indépendant** reste le défaut de la fonction : régler un ordre un
monstre à la fois, en voyant ce que ça laisse aux autres, est ce qu'on veut quand
tout le reste tient.

- Les deux bornes se cherchent par **dichotomie sur des prédicats monotones de
  sens opposés** : « avant son successeur / avant l'adverse » se gagne en
  accélérant, « après son prédécesseur » se perd en accélérant.
- **Test différentiel** (algo-verify) : les bornes sont comparées à un **balayage
  exhaustif** de toutes les vitesses, qui vérifie en plus que l'ensemble des
  vitesses valides est bien un **INTERVALLE** — l'hypothèse qui autorise la
  dichotomie. Une fenêtre **vide** (bornes croisées) est affichée comme telle
  (« impossible à ce rang sans toucher aux autres »), jamais comme un chiffre.
- ⚠️ **Une fenêtre se lit « les autres inchangés »** — contrairement à
  `vitessesRequises`, qui empile ses corrections. C'est voulu : un ordre se règle
  un monstre à la fois, et corriger l'un déplace les fenêtres des voisins.
  ⚠️ **Ça ne s'écrit PAS sous la liste** : trois lignes de théorie sous une
  liste de chiffres qu'on vient consulter ne se liraient pas, à relire à
  chaque passage sans jamais rien y changer. La règle reste
  vraie et vit ici ; l'écran, lui, montre les fenêtres.
