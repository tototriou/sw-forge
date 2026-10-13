# Speed tuning — écran, état et persistance

Partie de [Outils · Speed tuning](README.md).

## Écran

⚠️ **L'écran ne calcule rien.** `SpeedTuningSection.tsx` ne contient que du
rendu ; toute la logique est ailleurs, et c'est ce qui garantit que l'outil et
le siège répondent la MÊME chose :

- `src/lib/speedTuneLignes.ts` — le modèle, pur et testé : la `Ligne` (un monstre
  posé dans un camp), sa vitesse de combat, son sort actif, la **seule**
  fabrique de l'entrée du moteur (`tuneDe` — c'est là, et nulle part ailleurs,
  qu'on ajoute un champ comme l'amplification de Miriam, sinon un des deux
  écrans l'oublie), la référence copiée sur le plus rapide, l'écriture des
  résultats dans les grilles, l'oubli d'un camp à l'import d'un deck.
- `src/hooks/useSpeedTune.ts` — l'état (persistant), les actions et les dérivées.
  Ne rend aucun JSX.

De haut en bas :

### Repère des ticks et deux camps

1. **Repère des ticks** — bandeau : la vitesse de combat mini pour agir à chaque
   tick, **dans le sens croissant (3 → 11)**.
   ⚠️ Comme les trois tableaux qui suivent, et comme le temps. Il descendait
   (11 → 3) pour aller du plus lent au plus rapide : on lisait l'écran dans un
   sens en haut et dans l'autre en dessous, et il fallait retourner sa lecture à
   chaque aller-retour.
   ⚠️ **Tick et vitesse sur UNE ligne** : empilés, ils coûtaient la hauteur d'un
   portrait pour deux nombres courts, en tête d'un écran qui manque de place. Les deux ticks canoniques du siège (286 et 239) sont marqués par
   la **couleur seule** (fond d'accent + chiffres en accent), **sans libellé** ;
   **pas de dégradé arc-en-ciel** (couleurs = tokens uniquement, voir
   [../../03-developpeur/interface/](../../03-developpeur/interface/)). **Chaque monstre
   ajouté voit son portrait posé dans la case du tick que lui donne sa vitesse**
   (tick NATUREL = `⌈10000/(7×combat)⌉`, sans la règle « un par tick » : le repère
   lit la VITESSE, pas l'ordre final). Un adversaire porte un contour `bad` — on
   repère d'un coup d'œil un ennemi qui tombe au même tick que soi.
2. **Deux camps** côte à côte (flex-wrap, qui suit la place réelle — page ou
   modale) : **Ton équipe** et **En face**. ⚠️ **Au TÉLÉPHONE, toujours
   empilés** (`max-lg:flex-col`, refonte graphique, lot 11d) : dès 560 px,
   deux camps de 280 px tenaient côte à côte et chacun devenait trop étroit —
   le lead débordait de l'en-tête, les réglages de chaque monstre
   s'empilaient (relevé par le mainteneur en mode appareil). L'en-tête du camp passe
   à la ligne au lieu de déborder. Chacun a son **lead** (`Selecteur`), sa liste de
   monstres (portrait, **SPD de base seule**, champ vitesse de runes, vitesse de
   combat) et sa **barre de recherche** d'ajout (combobox `Champ` + `Flottant`,
   même grammaire que RtaSearch — voir
   [../transverse/](../transverse/)). Chaque monstre
   a un champ **« SPD buff effect »** — le bonus d'artéfact « Effet aug. VIT »
   (voir Formule), **dans les deux camps** : ⚠️ le libellé retenu est celui que
   la communauté emploie, pas celui du jeu, parce que c'est sous ce nom qu'on le
   cherche et qu'on en parle ; ⚠️ il fut réservé aux alliés (« on ne
   connaît pas les artéfacts d'en face »), ce qui ne tient plus depuis qu'un deck
   importé et l'adversaire de référence y **posent** une valeur lue sur nos
   propres artéfacts — un chiffre qui compte dans le calcul doit se voir et se
   corriger là où il est. Un même monstre peut
   figurer des DEUX côtés (`uid = camp:id`), pas deux fois dans le même camp.
   **Chaque camp** porte sous sa barre de recherche un bouton **« Importer un
   deck de siège »** (voir plus bas). ⚠️ **À la souris**, ce bouton passe dans
   l'**en-tête de la carte du camp**, à côté du lead, en taille compacte, sa
   liste calée à droite (refonte graphique, décision 22 : on voit sans lire
   quel camp il remplace). Au doigt, il reste sous la recherche.
   L'en-tête est alors sur **deux lignes dans les deux camps** : le titre, puis
   lead et import calés à droite. Laissé au hasard de la largeur, « Ton
   équipe » passait à la ligne et pas « En face » — le mainteneur : « il faut que le
   rendu soit le même ». Chaque monstre est une **card** avec, en **haut à droite** (convention app),
   les **flèches** (monter / descendre dans l'équipe), l'**œil** (masquer /
   afficher) et la **croix** de suppression. Un monstre **masqué** reste dans son
   camp (grisé) mais quitte les calculs et les trois tableaux — pour tester une
   compo sans perdre son réglage ; on le réaffiche d'un clic sur l'œil.
   - ⚠️ **La card tient sur UNE rangée** : portrait, nom, les trois réglages et
     la vitesse de combat. Elle en occupait deux, alors que l'en-tête laissait
     toute sa droite vide — 44 px par monstre, soit une ligne du tableau de ticks
     par card. `flex-wrap` rend l'empilement au format étroit : **le mobile
     retrouve exactement la mise en page d'avant**, il n'y perd rien.
   - ⚠️ **Tout s'aligne sur le BAS des champs** (`items-end`). Les réglages
     portent leur libellé au-dessus, le nom n'en a pas : aligner par le haut
     décalerait le nom d'une ligne au-dessus du portrait.
   - ⚠️ **Le set Rapidité se montre par son ICÔNE**, pas par le mot « Swift » —
     c'est ainsi qu'on le reconnaît dans le jeu et partout ailleurs dans l'app
     (filtre de sets, choix de combo). Le mot demandait de lire là où un dessin
     suffit, et prenait trois fois la largeur sur la rangée qu'on resserre. Le
     libellé de colonne (« Set ») reste au-dessus, l'infobulle dit ce que ça
     change.
   - ⚠️ **La vitesse de combat garde sa taille et sa place**, à droite : c'est le
     chiffre qu'on vient lire. On gagne de la hauteur en resserrant ce qui
     l'entoure, jamais en rendant illisible l'objet de l'écran.

### Ordre des sorts et analyse automatique

3. **Ordre des sorts** — card à part (voir « Ordre des sorts » plus bas).
   ⚠️ **Côte à côte avec l'analyse quand il y a la place**, empilées sinon —
   même idiome que les deux camps (`flex-wrap` + largeur plancher), et pour la
   même raison : il suit la place **réelle** (pleine page ou modale), là où un
   point de rupture ne connaît que la fenêtre. L'ordre des sorts reste **à
   gauche** — la cause avant l'effet, comme empilées. `items-start`, sinon la
   card courte s'étire à la hauteur de la longue et laisse un grand vide encadré.
   ⚠️ **Elle passe AVANT l'analyse** : c'est l'ordre de la cause et de l'effet.
   On désigne ici ce que chacun lance, et le verdict de l'analyse en découle —
   y changer un sort ou une cible est d'ailleurs le seul geste qui relance
   l'écriture des grilles. Lire le verdict d'abord obligeait à remonter pour comprendre d'où il
   sortait.
4. **Analyse automatique** — ⚠️⚠️ **RIEN D'APPLIQUÉ NE RESTE INVISIBLE.** Tout ce
   que la simulation applique doit se retrouver dans les grilles, y compris sur
   l'adversaire de référence : un modificateur qui agit sans s'afficher rend
   **tout l'écran invérifiable** — on ne peut plus recouper un seul chiffre. Deux
   manquements à cette règle ont été corrigés : l'analyse ne reportait pas ce
   qu'elle écrivait pour la référence (identifiants différents de part et
   d'autre), et elle **ignorait les sorts désignés** dans « Ordre des sorts » —
   on choisissait un sort, et le verdict n'en savait rien.
   ⚠️ **Un SEUL calcul pour toute l'app** :
   `analyseAutomatique` ([speedTuneAuto.ts](src/lib/speedTuneAuto.ts)), celui-là
   même qu'utilise la card de siège. L'écran a longtemps eu sa propre pipeline —
   deux chemins pour une même question, qui ont fini par se contredire : une
   équipe déclarée « pas speed tune » au siège et « speed tune » dans l'outil.
   Un seul calcul, une seule réponse.
   ⚠️ **Elle ÉCRIT, elle ne recouvre pas.** Un clic sur
   **« Analyser »** lit les kits, simule, et **pose le résultat DANS les grilles**
   — exactement comme si on les avait remplies à la main : buff de vitesse
   activé, valeurs dans les cases. Puis elle s'arrête. Tout reste modifiable
   ensuite, et **rien ne repasse dessus**.
   - **Pourquoi** : la version précédente affichait des valeurs qui n'existaient
     nulle part et se recalculaient sans cesse. On ne pouvait ni les corriger, ni
     savoir ce qui venait de l'outil et ce qui venait de soi.
   - ⚠️⚠️ **INVARIANT — un effet est actif au tick SUIVANT le tour de son
     lanceur.** Un sort lancé au tick 4 est actif au tick 5, pour tout le camp.
     Pas « à peu près », pas « sauf quand un adverse coupe » : **toujours**. C'est
     ce qui rend l'écran vérifiable — on pose le doigt sur la case du tour, on
     glisse d'une colonne, l'effet y est.
     Dans le moteur, ce qu'une compétence pose arrive APRÈS l'arbitrage du tick
     (le lanceur vient de jouer) ; une case de grille, elle, est posée AVANT.
     L'écrire sur le même tick laisserait un allié boosté voler le tour du
     lanceur.
     - ⚠️ **Gardé par un contrôle de propriété** ([tests](tests/speed-tune.test.ts)),
       pas par des cas isolés : ~960 plateaux tirés au hasard, les **quatre
       formes d'effet** (barre de tout le camp, barre d'UN allié, sa propre
       barre, buff de vitesse), avec et sans rechargement, de 0 à 2 adverses.
     - ⚠️ **Sur l'enchaînement COMPLET** — analyse, écriture des grilles,
       simulation d'AFFICHAGE des deux camps —, jamais sur `analyseAutomatique`
       seule : c'est l'affichage que l'utilisateur regarde, et les deux défauts
       signalés (Bastet, puis les buffs quand l'adverse coupe) ne se voyaient QUE
       là ; la fonction, prise à part, semblait juste.
     - ⚠️ **La référence est posée comme une ligne du camp d'en face** dans ce
       contrôle, comme le fait l'écran. L'oublier fausse le contrôle lui-même —
       elle prend un tick, donc elle décale tout : c'est l'erreur qui m'a fait
       croire à huit fautes inexistantes.
     - Un **buff dure** : seul son DÉBUT tombe au tick suivant le tour. Un boost
       de barre est ponctuel — chacun de ses ticks doit suivre un tour du lanceur.
     Le contrôle attrape les deux dérives possibles : l'adverse ignoré (l'effet
     part deux ticks trop loin) et le décalage supprimé (l'effet tombe sur le
     tour même).

### Analyse automatique : saisie à la main, mêmes monstres, plateau entier

   - ⚠️⚠️ **LE DÉCALAGE NE VAUT QUE POUR CE QU'UN SORT POSE.** Une case **saisie
     à la main** reste à SON tick. `simuler` réenregistre la saisie dans
     `effetAtb` — c'est la même piste que les effets de sorts —, et la réécriture
     la décalait comme le reste : un −50 % tapé sur un adverse au tick 5 était
     jugé au **6** par l'analyse, quand le tableau de l'écran le jugeait toujours
     au **5**. Deux plateaux pour une seule équipe, **aucun signe à l'écran** — et
     le verdict lui-même (`diagnostiquerChaine`) tombait du mauvais côté, puisque
     c'est ce plateau-là qu'il juge. La distinction se lit sur `atbMod` : une
     valeur que l'utilisateur a posée y figure déjà, celles d'un sort non.
     **Gardé** : l'analyse doit dater la case saisie au **même tick** que
     `simuler`, et le test échoue bien quand on supprime la distinction.
   - ⚠️⚠️ **L'ANALYSE ET L'AFFICHAGE DOIVENT VOIR LES MÊMES MONSTRES.** Deux
     constructeurs pour deux entrées — `plateauDeLignes` pour l'analyse, `tuneDe`
     pour le moteur d'affichage — et rien n'obligeait le premier à porter ce que
     le second applique. **`EntreeAuto.lead` n'était rempli nulle part** dans
     l'écran : l'analyse calculait TOUTES les vitesses **sans le lead**,
     l'affichage avec. Un lead de +28 % suffit à décaler un tour d'un tick, et
     l'effet écrit dans les grilles partait alors un tick trop loin. C'est le
     défaut qui a **survécu à deux corrections** — chacune visait le décalage,
     aucune ne voyait que les **vitesses elles-mêmes** divergeaient.
     - **Un seul constructeur** pour l'entrée de l'analyse, à côté de `tuneDe` :
       écrite au fil de l'eau chez l'appelant, elle finit toujours par oublier un
       champ que personne ne voit manquer (voir « Conventions de code » dans
       [AGENTS.md](../../../AGENTS.md)).
     - **Gardé** : le même monstre doit avoir la **même vitesse de combat** des
       deux côtés — lead de camp, lead d'ÉLÉMENT (qui ne vaut que pour certains),
       Swift, passif. Le contrôle vérifie en plus que le lead **change** bien la
       vitesse, sans quoi il passerait pour de mauvaises raisons.
   - ⚠️⚠️ **L'ANALYSE SIMULE LE PLATEAU ENTIER, pas seulement ton camp.** Elle ne
     recevait que les alliés : elle les plaçait donc sur un plateau où personne
     n'occupait de tick en face. **Dès qu'un adverse coupe**, il prend un tick, et
     un seul monstre agit par tick : tous les tours alliés glissent d'un cran à
     l'écran. Ce que l'analyse avait écrit ne tombait alors plus au tick suivant
     le lanceur mais **sur son tour même, ou deux ticks plus loin** — signalé sur
     Bastet, puis sur les buffs de vitesse. Contrôlé par un test qui rejoue
     l'enchaînement complet : analyse, écriture des grilles, simulation
     d'affichage des deux camps.
     - **Les adverses ne lancent RIEN** dans cette simulation : ce sont leurs
       **ticks** qui comptent. Leur kit reste hors du calcul — un speed tune est
       ce qui tient sans rien attendre de ce que fait l'autre (voir « Ce qu'on
       retire à l'adverse »).
     - **Ce qui est saisi À LA MAIN sur eux est repris** : c'est une saisie, pas
       une déduction, et l'ignorer déplaçait leur tour.
     - ⚠️ **Aucune grille n'est écrite sur un adverse RÉEL** : l'analyse n'y pose
       rien, et lui renvoyer une grille vide effacerait la saisie de
       l'utilisateur. L'adversaire de **référence**, lui, en reçoit une — il est
       là pour être vérifié comme les autres.
     - ⚠️ **L'ordre d'affichage est conservé** dans l'entrée du moteur : c'est lui
       qui départage deux barres pleines à vitesse égale (`placement`). Trier par
       camp aurait fait diverger l'analyse et l'écran sur les égalités exactes —
       le cas même que le réglage d'équipe produit à longueur de temps.

### Analyse automatique : déclencheur, en-tête, verdict et référence

   - ⚠️ **Le SEUL déclencheur d'une nouvelle écriture, c'est le choix d'un sort**
     — un autre sort ne pose pas la même chose. Vitesses, artéfacts, sets, cases
     des grilles : ce sont des réglages, l'automatisation n'y revient jamais.
     « Relancer » réécrit tout depuis les kits, et écrase donc les corrections.
   - **En-tête** : le titre, le bouton **« Analyser »** (« Relancer » ensuite) et
     un **interrupteur « Afficher »**.
     ⚠️ **Une ACTION et un AFFICHAGE, pas le même objet** : « Analyser » écrit,
     l'interrupteur replie. Les confondre faisait d'un repliage une réécriture —
     donc l'écrasement des corrections qu'on venait d'apporter.
     ⚠️ **Aucune phrase d'explication** : le titre suffit.
   - **Corps** : rien d'autre que le **verdict**. Vert, il tient en quatre mots —
     **« Ta team est speed tune. »** Rouge, il nomme **l'adverse qui coupe**
     (sans son tick) puis donne **une ligne par allié coupé** : son nom et **le
     chiffre qui manque**, rien de plus.
   - ⚠️ **« Ordre des sorts » est une card INDÉPENDANTE**, pas un sous-bloc et pas
     un panneau qu'on ouvre depuis l'analyse : elle est là comme les grilles.
     L'analyse **la remplit**, mais les deux se lisent et se règlent séparément.
   - Les deux cards sont **l'une sous l'autre**, chacune sur toute la largeur, et
     **chacune porte son interrupteur « Afficher »**. ⚠️ Il ne fait que **replier**
     — verdict d'un côté, liste des sorts de l'autre : ce qui est écrit continue
     de compter, refermer ne défait rien. On masque pour gagner de la place, pas
     pour annuler un réglage.
   - ⚠️ **L'adversaire de référence ne lance RIEN** : c'est un repère de
     vitesse, pas un monstre qui joue son kit. Il recopie en revanche tout ce qui
     fait la vitesse de son modèle — lead, runes, Swift, artéfact, sets et
     **compte de buffs effectif** : dans l'autre camp, l'estimation des buffs ne
     verrait que lui, il serait plus lent, et l'équipe « passerait » à tort.
   - ⚠️ **« Analyser » REPOSE l'adversaire de référence** sur le plus rapide du
     moment, à chaque fois — dès qu'il n'y a **pas** de vrai adversaire, ou
     **toujours** si le réglage d'application « Adversaire de référence » est
     activé (menu ⚙, voir [les réglages](../transverse/feat-navigation/compte-et-parametres.md#les-réglages)). Il n'était posé qu'en l'absence de tout adversaire :
     une fois là, il ne bougeait plus jamais — appliquer un passif (Chilling, +20
     par buff) pouvait changer qui est le plus rapide sans que la référence le
     sache, et on se comparait à un monstre qui ne l'était plus. Un **vrai**
     adversaire (saisi ou importé), lui, n'est jamais remplacé : c'est une
     composition qu'on affronte, pas un repère.

### Les tableaux : barre d'action, modifications, buff de vitesse, ordre de tour

5. **Barre d'action par tick** (lecture seule) — tableau : lignes triées par
   ordre de tour, colonnes = ticks. Chaque cellule = `% rempli` — la
   **trajectoire réelle** renvoyée par la simulation (`OrdreEntree.trajectoire`),
   affichée à **trois décimales** — ⚠️ à deux, une barre à 99,996 % s'affichait
   « 100.00 » sans que le monstre agisse, et on cherchait un bug là où il n'y en
   avait pas ; le tick se joue au millième,
   qui n'est plus linéaire dès qu'un modificateur entre en jeu. La case où le
   monstre **prend le tour** est surlignée (**fond** + badge de rang, jamais un
   contour de plus par-dessus la grille) ; les ticks après l'action restent
   vides. Adversaires en teinte `bad`, alliés en `accent`. Colonne de gauche
   figée, défilement horizontal.
6. **Modification de barre d'attaque** — grille **éditable**, même rendu que le
   tableau ci-dessus. Chaque camp présent ouvre sur une ligne **« Toute ton
   équipe » / « Tout en face »** (écrit la même valeur sur tous ses monstres au
   tick visé), puis une ligne par monstre. Cellules = `NumberField sansBoutons`
   (axe dense de la lib, voir [../../03-developpeur/interface/](../../03-developpeur/interface/)) ;
   valeur **positive pour remplir, négative pour vider** (la barre reste ≥ 0),
   la cellule prenant le **ton** de sa valeur — vert pour un gain, rouge pour un
   retrait (axe `ton` de `NumberField`) — et portant son **`%`** (axe `suffix`) :
   ce sont des pourcentages de barre, pas des points ;
   une case vide = aucun modificateur. ⚠️ **C'est ici que l'analyse écrit** : les
   valeurs qu'elle pose sont des valeurs comme les autres, qu'on corrige ou qu'on
   efface — c'est ainsi qu'on écarte une réduction d'ATB à 70 % de chances dont
   un lead tune ne doit pas dépendre.
7. **Buff de vitesse** — même grille, mais chaque cellule combine un **raccourci**
   et un **champ** : un bouton à l'icône SPD du jeu (celle des cartes RTA/Siège)
   pose/retire le buff **+30 %** d'un clic — c'est presque toujours celui-là — et
   un `NumberField` à côté permet de saisir une autre valeur (33 %, un ralenti
   −30 %…). La ligne équipe agit sur tout le camp. `speedMod` s'applique **au seul
   tick marqué** (pas de report) : un buff qui dure se marque sur chaque tick —
   et c'est exactement ce que l'analyse écrit quand un sort buffe l'équipe. Même
   habillage que la grille des barres : **`%`** en suffixe, et le **ton** de la
   valeur (un buff est vert, un ralenti rouge).
   Comme pour le boost, une case vide laisse la **compétence** décider (valeur en
   repère), une valeur saisie la remplace et `0` l'annule.
8. **Ordre de tour** — jetons entrelaçant les deux camps, chacun avec son rang et
   son tick. ⚠️ **À la souris, il remonte sous l'ordre des sorts et l'analyse**,
   avant les trois tableaux (refonte graphique, décision 22) : c'est la
   conclusion qu'on vient lire. Au doigt, il reste tout en bas (lot 11).

⚠️ **En-tête à la souris** (refonte graphique, lot 9b) : le titre au gabarit
des autres pages (police d'affichage), sans la pastille d'icône, la règle des
ticks dessous. En modale, pas d'en-tête : la modale porte titre et règle.

Les trois tableaux **partagent les mêmes colonnes de ticks** (1 → au moins 12,
étendu jusqu'au dernier tick d'action) : on peut donc poser un modificateur sur
un tick avant qu'un monstre n'agisse.

## État & persistance

Aucune persistance disque (comme tout Outils). Les choix (monstres ajoutés,
vitesses de runes, leads, boosts d'ATB, buffs de vitesse, artéfacts, état
masqué, compétences) vivent en `useStickyState` : conservés le temps de la session (survivent
à la navigation), remis à zéro au rechargement.

⚠️ **Importer le JSON d'un AUTRE compte remet tout le speed tuning à zéro.** Son
équipe, ses vitesses de runes, ses artéfacts et ses grilles décrivent des
**monstres**, pas des réglages : sur un autre compte, ils parlent de monstres qui
ne sont plus là, et l'écran resterait plein, crédible, et faux.

- ⚠️ **Un simple RÉEXPORT du même compte ne touche à rien** (même `wizard_id`) —
  même distinction que l'exclusion manuelle de runes de l'Optimizer. Le speed
  tuning est un **plan de travail** : on y saisit souvent des vitesses qu'on
  **vise** et qu'on n'a pas encore. L'effacer à chaque réexport serait une perte
  sèche.
- ⚠️ **Toutes les clés collantes de l'outil portent le préfixe
  `speedTune.`** (`PREFIXE_SPEED_TUNE`), sans exception : c'est lui qui permet de
  tout réinitialiser d'un coup. Une clé ajoutée en dehors survivrait au
  changement de compte — **un test lit le SOURCE du hook** pour l'interdire, ce
  qu'une liste de clés écrite à la main ne saurait pas faire.
- ⚠️ **Le magasin ET les hooks montés** sont réinitialisés
  (`reinitialiserSticky`). Vider le premier seul laisserait un écran affiché sur
  ses anciennes valeurs, qu'il réécrirait aussitôt dans le magasin : la remise à
  zéro serait annulée par le composant lui-même.
