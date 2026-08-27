# Outils · Speed tuning (`#/outils/speed-tuning`)

Outil de speed tune : à chaque « tick » d'horloge, la barre d'action (ATB) de
chaque monstre monte de `vitesse_combat × 7 %` ; **un seul monstre agit par
tick**. L'écran répond à une question précise — « est-ce que je joue **avant**
tel monstre ? » — d'où les deux camps et l'ordre de tour qui les entrelace.

Fichiers : [SpeedTuningSection.tsx](src/components/outils/SpeedTuningSection.tsx)
· calcul pur [speedTune.ts](src/lib/speedTune.ts) · import d'un deck de siège
[speedTuneDeck.ts](src/lib/speedTuneDeck.ts) · vitesse de combat
[speed.ts](src/lib/speed.ts). Rendu depuis [OutilsPage.tsx](src/pages/OutilsPage.tsx)
(`sub === 'speed-tuning'`).

## Formule (modèle partagé)

Même modèle que la page Mécaniques et que les ticks de siège :

```
ΔATB par tick = vitesse_combat × 7 / 100     (un monstre agit à 100)
vitesse_combat = base + runes + ⌈ base × (15 + lead) / 100 ⌉
```

- Le **totem +15 %** est **toujours** inclus (présent dans tous les contenus) —
  il est dans `combatSpeed` de speed.ts, pas un réglage.
- Le **lead** est saisi **par camp** (ton équipe / en face) : chaque camp a son
  leader.
- ⚠️ **Le set RAPIDITÉ (Swift) se coche par monstre**, et il compte. Ses 25 %
  entrent dans la **somme** des pourcentages (totem + lead + swift) alors que la
  « SPD runes » saisie les porte déjà **à plat** — `combatSpeed` retire donc le
  forfait avant de réinjecter le pourcentage (voir
  [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)). L'écart n'est que
  d'**un point**, et un point suffit à rater un tick : sur le deck de contrôle
  Mihyang / Adriana / Sonia, l'oublier donnait 374 et 350 au lieu de 373 et 349.
  Un deck importé du siège coche la case tout seul (le slot porte ses sets).
- La **vitesse de combat minimale pour agir au tick n** est
  `⌈ 10000 / (7n) ⌉` (`speedForTick`) : 130 au tick 11, **239 au tick 6**
  (« Lent » en siège), **286 au tick 5** (« Rapide »), 477 au tick 3.

Deux **modificateurs par tick** (saisis dans les grilles, voir plus bas) entrent
dans la simulation. ⚠️ **Une valeur saisie REMPLACE ce que les compétences
posent** pour ce monstre et ce tick — **0 annule** l'effet du sort, une case
**vide** lui rend la main :

- **Modification de barre d'attaque** (`atbMod[t]`) : variation **ponctuelle** de
  la barre au tick `t` — **positive** pour remplir (compétence de boost,
  artéfact…), **négative** pour vider (réduction d'ATB ennemie). ⚠️ La barre ne
  descend **jamais sous 0** (clampée dans la simulation). Une seule fois, ce
  tick-là. Bornée à ±100 dans la grille.
- **Buff de vitesse** (`speedMod[t]`) : +% de **vitesse** appliqué **uniquement
  au tick `t`** — ⚠️ **pas de report**, les ticks non marqués calculent l'ATB à
  la vitesse de base. C'est la **vitesse** qui change (l'ATB gagnée ce tick-là),
  pas la barre. Un buff qui dure plusieurs ticks se marque sur chacun d'eux.
- **Artéfact « Effet aug. VIT »** (`artefactBuff`) : il amplifie le **buff de
  vitesse**, et n'agit **que si un buff (> 0) est présent** ce tick-là (rien à
  amplifier sinon ; il ne s'applique **pas** à un ralenti).
  ⚠️ **MULTIPLICATIF sur la VALEUR DU BUFF**, pas additif à la vitesse :
  buff 30 % + artéfact 10 % → **buff 33 %**, pas 40 %.
  ⚠️ **Et la valeur du buff est un ENTIER de pourcentage** : le jeu affiche
  « +30 % », « +33 % », jamais 32,7 %. On **tronque** — 9 d'artéfact donne
  30 × 1,09 = 32,7 → **32 %**, quand 10 donne 33 % tout rond. Mesuré en jeu :
  9 ne passait pas, 10 oui, alors que le calcul décimal disait que 9 suffisait.
  Arrondir au lieu de tronquer donnerait 33 % dès 9, ce que le jeu dément.
  Conséquence utile : l'artéfact avance **par paliers**, et l'outil propose le
  premier palier qui change quelque chose.
  > « Increase SPD Effect +N% | Multiplicative | The buff value | 10% artifact
  > makes SPD buff being 33% instead of 30% » —
  > [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/artifacts/)

  ⚠️ **Cette spec a affirmé le contraire** (« additif, pas multiplicatif ») et le
  code suivait : l'artéfact valait alors trois à quatre fois son effet réel, ce
  qui faussait les vitesses proposées. Corrigé après un signalement de terrain
  (un deck où 10 d'artéfact valent ~3 de vitesse, pas ~20) et **re-vérification à
  la source**. Retenir la leçon : une valeur de mécanique se relit à la source
  avant d'être écrite ici comme acquise.

## Importer un deck de siège

⚠️ **L'autre sens existe aussi** : depuis un deck de siège, « Voir le speed
tune » ouvre **cet outil en modale** par-dessus la page du siège, équipe déjà
chargée dans « Ton équipe » (`deckInitial`, `entete={false}` — la modale porte
déjà le titre) **et l'analyse lancée d'office** (une fois les kits chargés).
⚠️ Ne pas confondre avec le bouton « Importer un deck » ci-dessous, qui lui ne
relance rien. Voir [../siege/speed-tick.md](../siege/speed-tick.md).

⚠️ **Bandes `compactes` et AUCUN pied** : c'est une modale de consultation — on
n'y valide rien, on lit un outil. Un « Fermer » en bas ferait doublon avec la
croix et coûterait ~50 px, soit deux lignes du tableau de ticks sur une modale
qui prend déjà 90 % de la hauteur. Voir [../shared/design.md](../shared/design.md),
« Les deux bandes d'une modale ».

Reprendre une composition déjà réglée plutôt que retaper trois monstres et
trois vitesses de runes. Calcul pur dans
[speedTuneDeck.ts](src/lib/speedTuneDeck.ts), **testé**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)).

- **Les deux camps** ont le bouton, sur la même liste : à gauche on reprend sa
  propre composition, à droite la **défense qu'on affronte** — c'est là qu'une
  équipe de siège enregistrée sert le plus (on l'a déjà rencontrée). Il ouvre un
  **flottant** listant les équipes de **Défense** puis d'**Offense** du siège
  (portraits + noms des monstres, `teamSummary`) — une équipe sans aucun monstre
  connu n'y figure pas.
- **Toujours affiché, désactivé** sans compte chargé (aucune équipe) : son
  `title` dit pourquoi.
- ⚠️ **Le lead du camp est un LEAD DE JEU, pas un pourcentage.** Il porte sa
  **portée**. L'encart « Lead » a **un seul menu**, en deux groupes — « Tous les
  alliés » et « Par élément » —, plus la **pastille des decks** (`LeadPill`,
  icône officielle du jeu comprise) dès qu'un lead est posé.

  Sa liste est **lue dans les données** (`leadsDeVitesse`), jamais écrite à la
  main : le jeu a des +10, +15, +16, +17 et des leads d'élément à +23 et +30
  qu'aucune constante ne contenait. Les portées **Arène** et **Donjon** en sont
  écartées — elles ne comptent pas en siège.

  ⚠️ **Un seul menu, pas deux** (montant × portée) : « +23 % alliés Eau » n'est
  pas « +23 % » plus « Eau ». Séparés, les deux sélecteurs laissaient composer
  des leads qui n'existent pas dans le jeu.

- ⚠️ **Le lead se devine à partir de l'équipe.** Un monstre du camp porte un lead
  de vitesse ? Il se pose tout seul dans l'encart (le plus fort si plusieurs — un
  seul leader agit). Aller le redire à la main était une saisie pour rien.
  Dès qu'on touche au menu **ou** qu'on importe un deck, ce défaut ne repasse
  plus jamais : « Sans » est un choix comme un autre, et un réglage qu'on ne peut
  pas poser vaut moins que pas de défaut du tout.

  > ⚠️ **Deux détours essayés avant, tous deux faux.** Ne garder que le montant
  > perdait les leads d'élément : le speed tune calculait plus lent que la card
  > de siège, qui les compte — un « il manque X de VIT » portant sur une vitesse
  > que personne n'avait sous les yeux. Les recopier ensuite sur chaque monstre
  > (`Ligne.lead`) rendait le sélecteur du camp décoratif et obligeait à
  > trafiquer les lignes une par une. Le camp porte le lead entier ; chaque
  > monstre en reçoit ce qui lui revient, via le `siegeLeadFor` du siège.

- ⚠️ **En lançant l'analyse, le camp d'en face prend le lead du tien**, portée
  comprise. L'adversaire de référence est une **copie** de ton monstre le plus
  rapide : un repère qui court moins vite que son modèle déclarerait tuné
  n'importe quoi. C'est un point de départ, pas un verrou — les deux encarts
  restent modifiables. ⚠️ **Sauf si une vraie composition est en face** : elle a
  son propre lead, et l'écraser recalculerait de vrais adversaires avec le tien.

  > ⚠️ Ce lead hérité est marqué comme **CHOISI**. Simplement écrit, le défaut
  > « lead présent dans l'équipe » le reprenait au rendu suivant : la référence
  > retombait au lead de son camp d'accueil — souvent aucun —, devenait plus
  > lente que le monstre qu'elle copie, et l'outil déclarait tuné à peu près
  > n'importe quoi.

- **L'artéfact « Effet aug. VIT » est repris** du `gear` du slot (code `206`
  dans `ARTIFACT_SUB`, sommé sur les deux artéfacts) : c'est lui qui amplifie le
  buff de vitesse, il n'a pas à être ressaisi.
- ⚠️ **Les sorts choisis du camp sont OUBLIÉS** : ils sont rangés par monstre
  (`camp:id`) et survivaient donc à un import — on rejouait le choix fait pour
  l'équipe précédente, et l'outil comptait un effet que le siège écarte. Deux
  verdicts sur la même équipe.
- ⚠️ **Le deck REMPLACE la composition du camp** où l'on a cliqué : un deck est
  une équipe, pas une liste de monstres à empiler — sans ça, importer une
  deuxième défense entassait six monstres du même côté. Ce qui était dans **ce
  camp** est donc perdu (vitesses corrigées, modificateurs) ; **l'autre camp
  garde tout**, et le deck reste dans Siège, réimportable à volonté. Le même deck
  peut être importé **des deux côtés** (`uid = camp:id`), pour se comparer à
  soi-même.
- **Lead** : celui du **leader du deck** (slot 0, convention du siège), écrit sur
  le camp qui reçoit l'import — ⚠️ **toujours, « Sans » compris** : un deck sans
  lead de vitesse laissait en place celui du deck précédent, et l'on calculait la
  nouvelle équipe avec un bonus qui n'existait plus (le siège, lui, lit `lead ?? 0`,
  d'où deux réponses sur la même compo). Il n'est repris **que s'il vaut pour tout
  le monde** (`General` / `Guild`). ⚠️ Un
  lead d'**élément** ne se transpose PAS — le speed tuning n'a qu'un lead par
  camp, l'appliquer à tous gonflerait la vitesse des monstres d'un autre
  élément : le lead saisi reste alors inchangé. Un lead absent des raccourcis de
  `SPEED_LEADS` est **ajouté au menu** du camp, sinon il s'afficherait vide.
- **Le set Rapidité est repris** du slot (`sets` contient `swift`) : la vitesse
  de combat importée est alors identique à celle qu'affiche le siège.

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
| **P4 méthode à la main** | à **trois ET quatre** alliés, le solveur fait **aussi bien ou mieux** que le joueur qui règle à la main, et n'est jamais bredouille là où la main trouve |

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

⚠️ **La référence de P3 n'est complète que sur les équipes de DEUX alliés** — le
premier étant figé, il ne reste qu'une inconnue, et elle balaie alors **tous** les
points un par un : ça vaut preuve, sans rien supposer du modèle. Au-delà, le
produit cartésien est hors d'atteinte ; elle balaie les affectations allié → tick
(non décroissantes, aux deux bords de chaque palier). **Contrôle incomplet,
assumé** : il peut rater une solution, jamais en inventer une — un échec est donc
toujours un vrai défaut.

**Coût mesuré** (les deux axes, à chaque frappe) : **1,9 ms** sur un tune à 3
alliés avec boost d'ATB, **4,9 ms** à 4 alliés, **9,5 ms** à 5. Aucun budget ni
cache n'a été nécessaire.

- **Limite héritée du modèle** : le verdict repose sur les **premiers tours**

  (voir plus bas) ; un adverse très rapide qui rejouerait une deuxième fois
  avant la fin de la chaîne n'est pas compté comme une coupure supplémentaire.

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
vérifiable : le moteur relançait le MÊME sort à chaque tour, donc **rien du
tout** dès que le rechargement l'en empêchait.

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
`allie:12#2` restait introuvable tant que les ticks se lisaient par
`premiersTours` : la contrainte « joue avant lui » tombait **sans bruit**, la
fenêtre annonçait une vitesse trop basse pendant que `diagnostiquerSequence`
déclarait l'ordre cassé — **deux réponses opposées sur le même écran**. Les ticks
se lisent donc par `ticksParOccurrence`, et le monstre se retrouve par la base de
sa clé.

⚠️ **À ne pas confondre avec `rejoue`** (Kroa), qui est un tour pris au **même
tick**, sans qu'aucune horloge ne tourne : celui-là garde son champ `sort2` et
son marqueur « rejoue » sur la ligne du 1ᵉʳ tour.

⚠️ **C'est l'analyse qui la remplit.** Cliquer sur « Analyser » y écrit l'ordre
que les vitesses produisent et, pour chacun, le sort que son kit a retenu —
exactement comme elle écrit dans les grilles. Ces choix deviennent alors des
choix comme les autres : on les corrige, et **y toucher relance l'écriture**.

⚠️ **Ce qui relance l'analyse, c'est TOUT ce qui entre dans son `choix`** — le
sort du 1ᵉʳ tour, celui du second, **et la CIBLE**. Le reste (vitesses,
artéfacts, cases des grilles) est un réglage de l'utilisateur, où
l'automatisation ne revient jamais.

⚠️ **La cible y manquait**, et c'est le pire défaut possible ici : désigner
« sur : lui-même » change qui reçoit la barre, qui reçoit le buff, et donc à quel
tick chacun joue ensuite — mais ne relançait rien. Les grilles gardaient les
valeurs de la cible **précédente**, et on lisait un buff tombé au mauvais tick
sur un écran par ailleurs cohérent : rien n'avait l'air cassé. Un **contrôle de
source** ([tests/speed-tune.test.ts](tests/speed-tune.test.ts)) vérifie
désormais que la signature de relance est le miroir de l'objet passé à
l'analyse — une entrée ajoutée à l'un et oubliée dans l'autre échoue.

⚠️ **Mais un sort déjà choisi n'est JAMAIS réécrit** : l'analyse ne remplit que
les cases vides. Sans ça, changer un sort relançait l'analyse, qui reposait
aussitôt celui du kit — le choix se réinitialisait sous les doigts et le réglage
était impossible. Une chaîne vide (« Aucun sort ») est un **choix**, pas une
absence : elle est préservée comme les autres.

⚠️ **Plus rien n'est deviné à la volée** : le sort lancé est celui qui a été
ÉCRIT. Sans analyse, personne ne lance rien — l'outil ne suppose pas à la place
de qui règle. Le menu n'a donc plus d'entrée « Sort détecté » : il n'y a que des
sorts, et « Aucun sort ».

- **Ordre voulu** : au départ, c'est **celui des vitesses** — l'ordre que la
  simulation produit aujourd'hui, les alliés sans vitesse connue à la fin. C'est
  le point de départ évident (« voilà ce que tu as »), et il se recale tant qu'on
  n'y a pas touché.
  ⚠️ **Le premier ▲▼ le FIGE** (`ordreRange`) : à partir de là c'est un choix, la
  liste ne suit plus les vitesses et se contente de suivre la composition (un
  allié ajouté entre à la fin, un retiré en sort). Le réécrire après coup serait
  une perte silencieuse.
- **Sort par monstre**, dans un **menu à icônes** (Bouton + `FlottantAuto` +
  rangées à plat, la grammaire des listes ancrées de l'app) — ⚠️ **`FlottantAuto`
  et non `Flottant`** : le bouton se promène au bout d'une rangée, et un flottant
  posé toujours du même côté sortait de la page par la droite ; celui-ci mesure
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
  accident masquait un monstre qui doublait celui qu'il devait suivre. Le test
  différentiel des fenêtres a attrapé cette erreur.

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
cassé. Sur Tiana / Galleon / Zaiross, Zaiross sortait `min 286, max 151` —
l'écran disait « est trop lent » **sans dire de combien**, précisément sur le
monstre qu'on cherchait à régler. Or c'est la question qu'on pose ici : *quelles
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
l'ordre**, jamais le dernier : c'est lui qui contraint ses successeurs. Une
version posait d'office chaque monstre signalé à son minimum, ce qui
**surestimait** : sur Chilling 396 / Carcano 366 / Seren 354 (référence
Chilling 396), Seren était signalé « trop lent », donc remonté — et Carcano,
calculé contre un Seren corrigé plus rapide que le vrai, réclamait **+2** là où
**+1** suffisait. Le défaut de Seren était une **conséquence** de la position de
Carcano : une fois Carcano corrigé, Seren n'avait plus rien à faire.

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
  la plus petite*. ⚠️ Le contrôle a d'abord menti — l'artéfact était tiré au sort
  DANS le constructeur de plateau, donc chaque appel comparait une configuration
  différente et « trouvait » des fautes inexistantes.

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
  ⚠️ **Ça ne s'écrit PAS sous la liste.** Un paragraphe le disait, et il ne se
  lisait pas : trois lignes de théorie sous une liste de chiffres qu'on vient
  consulter, à relire à chaque passage sans jamais rien y changer. La règle reste
  vraie et vit ici ; l'écran, lui, montre les fenêtres.

## Compétences (déclenchées par le tour)

⚠️ **C'est ce qui rend l'outil automatique.** Un Eshir (grosse vitesse de base,
compétence qui remplit la barre des siens) n'a plus à être posé à la main dans
la grille, tick par tick : on déclare sa compétence **sur sa card**, elle frappe
là où sa vitesse le fait jouer, et **suit** quand les vitesses changent. Saisie
dans les **deux camps** — l'adverse qui remplit la barre des siens est justement
celui qu'on cherche à devancer.

### Lues automatiquement dans le kit

⚠️ **Rien ne se saisit : l'utilisateur n'a pas à aller chercher ce que fait le
monstre, et la card n'a AUCUN champ pour ça.** Les deux valeurs sont lues dans
les compétences pré-générées (`public/data/skills/<com2usId>.json`, un seul point
d'entrée `chargerDetail`) — lecture pure dans
[speedTuneKit.ts](src/lib/speedTuneKit.ts), **testée**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)).

⚠️ **Deux champs de saisie (« Boost ATB », « Buff SPD ») ont existé sur la card
et ont été RETIRÉS** : une fois la détection automatique en place, ils ne
servaient plus à rien. Un cas que la détection ne couvre pas (effet sur un seul
allié, passive, compétence qu'on ne jouera pas) se pose **dans les deux grilles
par tick**, qui restent la porte de sortie manuelle.

- **Seuls les effets DE ZONE** (`aoe`) sont retenus : `Increase ATB` → boost,
  `Increase ATK SPD` → buff (+30 %, la valeur du jeu — les données ne donnent
  que sa **durée**). ⚠️ Un « remplit **TA** barre » (`surSoi`) ou un boost sur
  **un** allié est **écarté** : le modèle applique l'effet à tout le camp, les y
  verser gonflerait l'équipe entière.
- **Les compétences PASSIVES sont écartées** : elles partent sur une condition
  (quand il est attaqué, à la mort d'un allié…), pas au tour du monstre.
- **La plus forte l'emporte** quand plusieurs compétences remplissent la barre :
  c'est celle qu'on joue pour lancer le combo.
- ⚠️ **SKILL-UPS : la compétence compte MAXÉE.** La valeur de SWARFARM est celle
  du **niveau 1** ; les améliorations « Attack Bar Recovery +N% » s'y ajoutent —
  le **Tailwind de Bernard 2A** remplit **30 %** au niveau 1 et **45 %** maxé
  (+5 puis +10). Même convention que les rechargements (`paliersCooldown`) : on
  joue maxé. **L'écran le DIT** — une ligne d'avertissement sur la card («
  Tailwind compte MAXÉE : 45 %, dont +15 % de skill-up ») — sans quoi on
  règlerait sa vitesse sur un gain qu'on n'a pas encore.
- Une valeur déjà posée n'est **jamais** réécrite par une relecture (`kitLu`).

### Ce qu'un sort fait, CIBLE par cible

⚠️ **La cible compte autant que la valeur.** *Breeze* (Kroa) remplit la barre
d'**UN** allié — celui qui l'a la plus basse — pas de toute l'équipe : les
confondre triplait son effet. *Wood Vine* **vide** la barre d'un adverse, ce qui
aide tout autant à passer devant lui. D'où `EffetSort`
([speedTune.ts](src/lib/speedTune.ts)), appliqué au tick où le lanceur joue :

| Champ | Ce que ça fait |
|---|---|
| `atbEquipe` | +% de barre à **tout son camp**, lui compris |
| `atbAllie` | +% de barre à **UN** allié : celui dont la barre est la plus basse |
| `atbSoi` | +% sur **sa** barre |
| `atbEnnemi` / `atbEnnemiTous` | −% de barre à l'adverse (le plus avancé), ou à tous |
| `buffEquipe` / `buffSoi` | +30 % de vitesse, à partir du tick **suivant** |
| `buffAllie` | +30 % de vitesse à l'allié **visé** — la même cible qu'`atbAllie` |
| `ralenti` / `ralentiTous` | −30 % de vitesse sur l'adverse (le plus avancé, ou tous) |

- ⚠️⚠️ **`aoe` ET `surSoi` NE S'EXCLUENT PAS**, dans les données du jeu. `aoe +
  surSoi` veut dire « **tout le camp, lui compris** » — c'est la forme NORMALE
  d'un boost d'équipe, pas un boost sur soi. La lecture testait `surSoi` en
  premier : le S3 de **Jeogun** (*Blossom Painting* — « increases the Attack Power
  of all allies for 2 turns and their Attack Bar by 10% ») tombait dans « lui
  seul », et le reste de l'équipe ne recevait rien. La règle, dans cet ordre :

  | drapeaux | cible |
  |---|---|
  | `aoe` | **tout le camp**, `surSoi` ou non |
  | `surSoi` sans `aoe` | lui seul |
  | ni l'un ni l'autre | **UN** allié (la barre la plus basse) |

  ⚠️ Cette dernière ligne vaut aussi pour le **buff de vitesse** : `aoe=false,
  surSoi=false` sur un *Increase ATK SPD*, c'est un buff sur l'allié VISÉ, donc
  `buffAllie`. Il est passé par deux erreurs successives — rangé dans `buffSoi`
  (le lanceur héritait d'un buff qu'il **donne**), puis purement ignoré.

  Même règle pour le buff de vitesse et pour le **comptage des buffs d'équipe**
  (`buffsEquipe`, qui nourrit l'estimation des passifs à cumuls) : un effet
  **bénéfique** de zone va sur les alliés, que le lanceur en profite ou non.
- ⚠️ **La cible se DÉSIGNE** (`cibleAllie`) quand le sort laisse viser — « increases
  the Attack Bar of **the target ally** », le S3 de Sapsaree. La barre la plus
  basse n'est qu'un **défaut raisonnable**, pas une règle du jeu : l'ordre des
  sorts porte donc un « sur : … » à côté du sort, listant les alliés du lanceur.
  Il s'affiche dès que le sort porte `atbAllie` **ou** `buffAllie` : un sort qui
  ne fait que buffer vise lui aussi.
- ⚠️ **UNE cible pour le sort, pas une par effet.** `atbAllie` et `buffAllie`
  sortent du même sort : ils sont résolus **une seule fois**, ensemble. Les
  résoudre séparément aurait rempli la barre de l'un et buffé l'autre.
- ⚠️ **Le lanceur PEUT se viser lui-même** — le jeu l'autorise, et c'est le geste
  recherché quand le sort porte un buff de vitesse : *Rabbit's Agility* (Racuni,
  Harg, Dova) rend son tour au lanceur **et** l'accélère de 30 %. Il figure donc
  dans la liste des cibles, marqué « (lui-même) ».
- ⚠️ **Mais jamais PAR DÉFAUT** : sa barre vient de retomber à 0, il serait
  systématiquement « celui qui l'a la plus basse » et se rendrait à lui-même un
  boost dont personne ne compte. Se viser soi-même est un **geste**, pas le
  défaut.
- ⚠️ **Un retrait de barre et un ralenti ne sont JAMAIS appliqués
  automatiquement** — voir « Ce qu'on retire à l'adverse » ci-dessous. Le moteur
  sait les jouer (`atbEnnemi`, `ralenti`, sur l'adverse le plus AVANCÉ, celui
  qu'un joueur vise), mais l'analyse les coupe du sort avant de le lui donner
  (`sansReductionAdverse`).
- ⚠️ **Buffs et ralentis ne s'empilent pas** (le jeu n'en garde qu'un de chaque) :
  on retient le plus fort de chaque côté. Mais ils **se compensent** — +30 sur
  une cible ralentie de 30 la ramène à sa vitesse de base, comme en jeu.
- ⚠️ **Le taux de réussite est affiché, pas simulé** : un effet à 70 % est
  appliqué **comme s'il passait**. Un speed tune se règle sur le cas où le sort
  fait ce qu'on attend ; le taux figure dans le menu pour qu'on sache sur quoi
  l'on parie.

### Tour supplémentaire (« rejoue »)

⚠️ **Un tour rendu tombe AU MÊME TICK.** Aucune horloge ne tourne entre les deux :
les autres ne gagnent **rien** — c'est ce qui fait que « un seul monstre par
tick » n'est pas violé, c'est le **même** monstre qui joue deux fois d'affilée.
Détecté dans le kit par l'effet `Additional Turn` (`rejoue` sur `SortVitesse`).

- Le second tour lance **une autre compétence**, désignée dans l'analyse poussée
  (`sort2`). ⚠️ **Rien par défaut** : reprendre la même
  compétence gonflerait le boost d'un facteur deux sans qu'on l'ait demandé.
- Il n'ajoute **pas** un premier tour de plus : `premiersTours` continue de ne
  retenir que le premier de chaque monstre, donc l'ordre et le verdict de chaîne
  ne bougent pas.
- Dans le tableau des barres, la case du tick garde le badge du **premier** tour.

### Passifs de vitesse

Un passif ne part pas au tour du monstre : la simulation l'écarte (voir plus
haut). Mais certains décident du tune — **Shumar** gagne **+15 de vitesse en
permanence**, **Elsharion +5 par buff allié**, **Misty +15 % par tour adverse**.
L'outil les **lit et les applique** : [speedTunePassif.ts](src/lib/speedTunePassif.ts),
**testé** sur les cas relevés en jeu.

- ⚠️ **La VALEUR est lue, le NOMBRE DE FOIS se saisit.** Un gain permanent
  (Shumar) entre tout seul dans la vitesse de combat ; un gain « par
  déclenchement » (buffs portés, tours adverses, attaques) demande un chiffre —
  c'est la seule chose que les données ne peuvent pas savoir.
- ⚠️ **Sauf pour les BUFFS PORTÉS, qui s'estiment** (`cumulsEstimes`) : trois
  sources se connaissent d'avance — la **Volonté** (elle pose une Immunité dès le
  premier tour), le **Bouclier** et les **buffs de zone que les alliés lancent**
  (immunité, ATQ/DEF, buff de vitesse), comptés sur le sort retenu de chacun.
  ⚠️ **Volonté et Bouclier ne se comptent pas pareil** : la Volonté est
  personnelle (elle protège son porteur), le Bouclier ne l'est pas — un seul
  monstre en Bouclier dans l'équipe, et **tout le monde** en porte un.
  Chilling avec la Volonté dans une équipe qui pose un bouclier et un buff de
  vitesse porte donc **3 buffs → +60 de vitesse**. ⚠️ **L'outil le pose tout
  seul** dans la case « cumuls » d'une ligne jamais touchée — sans quoi une
  équipe arrivée du siège affichait une vitesse ici et une autre là-bas. C'est une **estimation**, pas
  une vérité : elle suppose ces buffs posés au moment où le passif compte, et un
  chiffre **saisi n'est jamais écrasé**.
- **Une rangée à part sur la card**, sous les réglages : bouton **« Passif »**,
  le gain unitaire, le champ de cumuls s'il y a lieu, et **ce qui est appliqué**
  (« +30 VIT ») aligné à droite.
  ⚠️ **Le bouton est TOUJOURS là** dès qu'un passif touche la vitesse, analyse
  lancée ou non : c'est une **propriété du monstre**, comme le set Swift, pas une
  hypothèse de l'analyse. Actif par défaut — un passif est toujours en vigueur en
  jeu — et on le coupe pour voir ce que vaut le tune sans lui.
- ⚠️ **Un passif change QUI est le plus rapide** : c'est pour ça que « Analyser »
  repose l'adversaire de référence sur le plus rapide du moment, en recopiant son
  set, son artéfact et son passif.
- ⚠️⚠️ **ELLE EST REPOSÉE AVANT L'ANALYSE, PAS APRÈS.** Elle ne l'était qu'à la
  fin d'`analyser()` : l'analyse tournait donc contre la référence de la fois
  **précédente**, et le verdict avait systématiquement **une analyse de retard**.
  - Le cas qui l'a révélé : Chilling à **+220** des deux côtés, speed tune. On
    monte à **+221** et on analyse — la référence suit et coupe. On redescend à
    +220 : l'écran replace bien nos tours **en direct**, mais la référence reste
    à +221. « Relancer » calculait alors un adverse à +221 contre un allié à
    +220, le plaçait au tick 4 devant nous au 5, et écrivait le buff de vitesse
    **un tick trop loin**. Un **second** clic sur « Relancer », sans rien
    changer, donnait la bonne réponse — la référence ayant enfin rattrapé son
    modèle.
  - ⚠️ **La PLACE compte autant que la vitesse** : à vitesse égale, c'est l'ordre
    du tableau qui départage (`placement`, voir `simuler`) — et ce cas est
    précisément une égalité. La référence est donc posée **en fin de liste**,
    exactement comme le fait `analyseAuto` ; sinon les deux chemins
    trancheraient l'égalité dans deux sens.
- ⚠️⚠️ **LA RÉFÉRENCE A SON PROPRE ESPACE DE NOMS** (`uidReference`,
  [speedTuneLignes.ts](src/lib/speedTuneLignes.ts) → `ennemi:ref:<id>`). Elle
  portait l'uid ordinaire de son monstre — exactement celui qu'aurait une VRAIE
  ligne adverse pour ce même monstre. Quand le plus rapide de ton équipe se
  retrouve aussi en face (un **miroir**, cas courant en siège), poser la
  référence **supprimait la ligne du vrai adverse** et la remplaçait par une
  copie de ton allié : le verdict portait alors sur un plateau qui n'était pas
  le tien, **sans un mot à l'écran**.
  - **Un seul constructeur**, utilisé par `ligneReference` ET par l'écran qui
    passe `idReference` à l'analyse. Écrits séparément, les deux divergeraient et
    ce que l'analyse écrit n'atterrirait nulle part — un modificateur appliqué
    mais invisible, la faute que cette page interdit partout ailleurs.
- **Plafonds respectés** (`up to 100`, `up to 150 %`) ; ⚠️ « up to 10 **times** »
  est un nombre de cumuls, pas un plafond de vitesse.
- Un gain en **pourcentage** se compte sur la vitesse de **base**, comme le totem
  et le lead.
- **Aucune valeur connue** → la card le dit en clair plutôt que d'appliquer 0 en
  silence : « son passif touche la vitesse, mais aucune valeur n'est connue ».

⚠️ **Deux choses très différentes se cachent derrière « attack speed »** dans les
textes, et les confondre fausse tout :
- « Increases your Attack Speed **for 2 turns** » (Juno, Oracle) → le monstre
  gagne le **BUFF** du jeu : +30 %, dispellable, **amplifié par le spd buff
  effect** ;
- « increases your Attack Speed **by 5** for each… » (Elsharion), « Your Attack
  Speed **is increased by 15 %** » (Misty) → un **gain propre**, ni dispellable
  ni amplifié par l'artéfact.

Le discriminant est dans le texte : un **montant** (« by N ») = gain propre, une
**durée** seule (« for N turns ») = buff.

L'inventaire complet — **généré par la même lecture**, donc jamais divergent —
vit dans [passifs-vitesse.md](passifs-vitesse.md) (`node scripts/passifs-vitesse.mjs`).
Il classe aussi ce que l'outil **n'applique pas** : tours supplémentaires, barres
remplies ou vidées hors de son tour (⚠️ une barre « remplie » vaut **100 %**),
et les montants introuvables — dont quatre passives marquées **AUCUNE donnée
(vérifié)**, trous définitifs qu'il est inutile de rechercher.

### Quel sort chacun lance par défaut

⚠️ **Une priorité explicite, pas un score pondéré** (`sortRetenu`,
[speedTuneAuto.ts](src/lib/speedTuneAuto.ts)) — un ordre se discute, des
coefficients inventés ne se vérifient nulle part. Du plus large au plus étroit :

1. remplir la barre de **tout le camp** ;
2. **buffer la vitesse** de tout le camp ;
3. **se rendre son propre tour** (*Power of Mirkwood*, Legolas) ;
4. se buffer / se remplir **soi-même** ;
5. remplir la barre d'**un** allié — ou seulement **buffer sa vitesse**.

⚠️ **À rang ÉGAL, c'est le montant qui départage** — pas l'ordre des slots. Le
rang dit QUI est touché, jamais COMBIEN : Racuni porte deux sorts « sur un
allié », *Breeze* (+15 % de barre) et *Rabbit's Agility* (barre **pleine** +
30 % de vitesse). Les deux valant 5, c'est le **premier rencontré** qui gagnait,
donc le S1 : l'analyse retenait le plus faible des deux, et le monstre visé
n'avait ni sa barre remplie ni son buff. Le départage additionne le remplissage
et le buff de vitesse — à remplissage égal, celui qui buffe **en plus** l'emporte
(*Clear Blue Sky* de Tanjiro vent contre *Dancing Flash* : 50 % tous les deux,
seul le premier buffe).

⚠️ **Le rang PRIME toujours** : le montant ne fait pas remonter un sort d'un
cran. Un boost d'équipe minuscule reste au-dessus d'un gros boost sur un seul
allié — sans quoi la priorité ne serait plus une priorité, mais le score pondéré
qu'on a refusé.

⚠️ Ce départage change le sort retenu de **14 monstres sur 2411**, et chaque
bascule va vers le sort strictement plus fort : Racuni / Harg (feu et lumière) /
Dova (15 % → barre pleine + buff), Twin Angels et Jaduel et Aepiah (10 % →
100 %), Dr. Plasma / Dr. Felix (10 % → 20 %), Fern (30 % → 35 %), Azure Dragon
Swordsman et Tanjiro vent (50 % → 50 % **plus** le buff).

Et **deux exclusions**, qui ont chacune fait mentir un verdict :

- ⚠️ **Vider la barre de l'adverse n'est JAMAIS retenu** — et va plus loin que le
  choix du sort : voir « Ce qu'on retire à l'adverse ».
- ⚠️ **Un sort à TAUX DE RÉUSSITE n'est jamais retenu.** Le *Glorious Attack* de
  Madeleine vide la barre adverse « avec 30 % de chances » : le compter déclarait
  l'équipe speed tune **sur un coup de dé**.

Les deux restent **choisissables à la main** dans l'ordre des sorts, en
connaissance de cause — le menu affiche l'effet et le taux.

⚠️ **« Aucun sort » est un CHOIX, pas l'absence de choix.** Les deux se disent
dans le même Record, et les confondre a fait mentir l'écran :

| valeur | sens | effet sur le Record |
|--------|------|---------------------|
| `''` | **Aucun sort** — il joue, mais rien qui touche la vitesse | **enregistrée** |
| `AUTO` | laisser le **kit** décider | l'entrée est **retirée** |

⚠️ **Une seule fonction pour les deux sorts** (`noterChoix`,
[speedTuneAuto.ts](src/lib/speedTuneAuto.ts)). Écrites séparément, elles avaient
divergé : le premier sort réservait la suppression à `AUTO` (juste), le second
supprimait sur `''` (faux). Dire « Aucun sort » au **second tour** effaçait donc
le choix, et le kit rappliquait son sort — le +15 % de barre de Kroa revenait
alors qu'on venait précisément de l'écarter, tick après tick. Choisir un AUTRE
sort marchait, ce qui rendait le défaut d'autant plus retors : seul le cas « rien »
était touché.

### Ce qu'on retire à l'adverse

⚠️ **Aucun retrait de barre ni ralenti n'entre dans le calcul du tune, jamais,
et même quand le sort est DÉSIGNÉ à la main.** Un speed tune, c'est ce qui tient
quand on n'a rien enlevé à l'autre : les monstres doivent jouer les uns après
les autres **sans ça**. Compter le −30 % de barre d'une Madeleine Cookie revient
à déclarer l'équipe tunée parce qu'elle aura freiné l'adverse — et le jour où le
frein rate, se voit résisté, ou tombe sur un monstre déjà passé, l'équipe se
coupe.

Concrètement : `sansReductionAdverse` (dans `lib/speedTune.ts`) retire
`atbEnnemi`, `atbEnnemiTous`, `ralenti` et `ralentiTous` du sort avant que
l'analyse ne le donne au moteur. Un sort qui fait **les deux** — remplir la
barre du camp ET vider celle d'en face — garde la moitié qui nous fait jouer et
perd l'autre. Les grilles n'en portent donc **aucune trace**, ce qui est cohérent
avec la règle « on affiche exactement ce qui est calculé » ; le menu de l'ordre
des sorts, lui, annonce l'effet suivi de **« (non compté) »**, pour qu'on ne
croie pas qu'il pèse.

⚠️ **La seule réduction qui compte est celle que l'utilisateur ÉCRIT lui-même**
dans la grille du modificateur de barre d'attaque : c'est une saisie, pas une
déduction, et le moteur l'applique telle quelle.

⚠️ **Le SECOND sort** (quand le premier rend le tour) suit la même règle sur ce
qui reste : sans lui, un monstre qui rejoue passait son tour supplémentaire à ne
rien faire.

### Rechargement des compétences

⚠️ **Un sort ne repart pas à chaque tour.** Le rechargement (`cooldown` sur
`EffetSort`) se compte en **tours du lanceur** : un sort à 3 tours lancé à son
premier tour ne revient qu'au quatrième — entre les deux, le monstre joue autre
chose (son S1, dont on ne sait rien, donc rien du tout). Sans ça, la simulation
relançait le S3 à **chaque** tour et l'équipe montait bien plus vite qu'en jeu.

- La valeur retenue est celle de la compétence **MAXÉE** (`paliersRechargement`,
  dernier palier) : même convention que le gain de barre, on joue maxé.
- Le premier tour n'est jamais bloqué : c'est le tour qui compte pour l'ouverture,
  et c'est celui que le verdict regarde.
- Le menu de l'analyse poussée annonce le rechargement (« recharge 3 tours »).
- Le **second sort** d'un monstre qui rejoue a son propre rechargement.

## Règle « un seul monstre par tick »

Le cœur de l'outil, dans `simulerOrdre` (speedTune.ts), **testé**
([tests/speed-tune.test.ts](tests/speed-tune.test.ts)) :

- Simulation tick par tick : chaque tick, tout le monde gagne son ATB ; si au
  moins un a atteint 100, **un seul** prend le tour — barre la plus haute,
  départagée par la vitesse de combat puis par **l'ordre de l'équipe** (le
  premier de la liste passe).
- ⚠️ **L'ORDRE DE L'ÉQUIPE EST UNE DONNÉE DU CALCUL, pas une présentation**, et
  il **se modifie** : deux flèches sur chaque card, monter / descendre
  (`deplacerDansCamp`, [speedTuneLignes.ts](src/lib/speedTuneLignes.ts)). C'est
  le seul levier quand un réglage fait finir deux monstres à la **même vitesse**
  — cas courant, puisque le solveur ramène chacun au minimum : ils se retrouvent
  à égalité et c'est la liste qui tranche. Le laisser subi revenait à cacher une
  entrée du calcul.
  - L'échange se fait avec le voisin **du même camp**, tel qu'il est affiché
    (masqués compris) : ce qu'on voit bouger est ce qui bouge — on ne saute pas
    par-dessus l'autre camp.
  - Aux extrémités, les flèches restent **affichées et désactivées** : un bouton
    qui disparaît selon les données ferait sauter le cluster d'une card à
    l'autre.
- ⚠️ **Ce n'est PAS un tri par vitesse.** Trois monstres qui franchissent 100 au
  même tick prennent le tour aux ticks n, n+1, n+2, pas tous au même.
- **Modèle du PREMIER tour** : on ne modélise pas les tours suivants d'un
  monstre très rapide qui rejouerait avant qu'un lent ait agi. Sans effet sur
  l'**ordre** relatif (un rapide reste devant un lent) ; le **numéro de tick**
  d'un lent peut être sous-estimé de quelques crans dans ce cas — raffinement
  laissé pour plus tard.
- Vitesse ≤ 0 (base inconnue, aucune runes) → n'agit jamais, écarté de l'ordre.

## Les deux camps se voient

⚠️ **Ton équipe et « En face » se distinguent à la COULEUR, pas à la position.**
`good` pour le tien, `bad` pour l'adverse — la sémantique de l'app, où `bad` dit
déjà « ce qui te coupe ». ⚠️ **Pas `accent`** : il dit « ceci est actif ou
sélectionné », pas à qui appartient une ligne, et sur le thème Forge il est
cuivre — « ton équipe » y virait à l'orange, à un cheveu du `warn` voisin.

- **Le panneau d'un camp** porte son contour (`border-good/45` /
  `border-bad/45`) et son bandeau de titre (`good-soft` / `bad-soft`).
  ⚠️ Le contour **remplace** celui du panneau au lieu de s'y ajouter : deux
  contours concentriques sont interdits par la charte.
- **La colonne des noms** des trois tableaux porte la même teinte. C'est la seule
  qui reste à l'écran quand on défile les 40 ticks : sans elle, on lit une ligne
  de chiffres sans savoir si elle est à soi ou en face. ⚠️ Fond **solide**
  (`-soft`), jamais une transparence — la colonne est collante et passe
  par-dessus le tableau qui défile dessous.
- Le repère des ticks garde son contour `bad` sur les portraits adverses, et la
  pastille « adv » reste : une couleur seule ne se lit pas en niveaux de gris.

## Écran

⚠️ **L'écran ne calcule rien.** `SpeedTuningSection.tsx` ne contient que du
rendu ; toute la logique est ailleurs, et c'est ce qui garantit que l'outil et
le siège répondent la MÊME chose :

- `lib/speedTuneLignes.ts` — le modèle, pur et testé : la `Ligne` (un monstre
  posé dans un camp), sa vitesse de combat, son sort actif, la **seule**
  fabrique de l'entrée du moteur (`tuneDe` — c'est là, et nulle part ailleurs,
  qu'on ajoute un champ comme l'amplification de Miriam, sinon un des deux
  écrans l'oublie), la référence copiée sur le plus rapide, l'écriture des
  résultats dans les grilles, l'oubli d'un camp à l'import d'un deck.
- `hooks/useSpeedTune.ts` — l'état (persistant), les actions et les dérivées.
  Ne rend aucun JSX.

De haut en bas :

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
   [../shared/design.md](../shared/design.md)). **Chaque monstre
   ajouté voit son portrait posé dans la case du tick que lui donne sa vitesse**
   (tick NATUREL = `⌈10000/(7×combat)⌉`, sans la règle « un par tick » : le repère
   lit la VITESSE, pas l'ordre final). Un adversaire porte un contour `bad` — on
   repère d'un coup d'œil un ennemi qui tombe au même tick que soi.
2. **Deux camps** côte à côte (flex-wrap, pas de breakpoint de largeur) : **Ton
   équipe** et **En face**. Chacun a son **lead** (`Selecteur`), sa liste de
   monstres (portrait, **SPD de base seule**, champ vitesse de runes, vitesse de
   combat) et sa **barre de recherche** d'ajout (combobox `Champ` + `Flottant`,
   même grammaire que RtaSearch — voir
   [../shared/recherche-clavier.md](../shared/recherche-clavier.md)). Chaque monstre
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
   deck de siège »** (voir plus bas). Chaque monstre est une **card** avec, en **haut à droite** (convention app),
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
       champ que personne ne voit manquer (voir « Conventions communes » dans
       [../README.md](../README.md)).
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
     activé (menu ⚙, voir [../README.md](../README.md)). Il n'était posé qu'en l'absence de tout adversaire :
     une fois là, il ne bougeait plus jamais — appliquer un passif (Chilling, +20
     par buff) pouvait changer qui est le plus rapide sans que la référence le
     sache, et on se comparait à un monstre qui ne l'était plus. Un **vrai**
     adversaire (saisi ou importé), lui, n'est jamais remplacé : c'est une
     composition qu'on affronte, pas un repère.
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
   (axe dense de la lib, voir [../shared/librairie-ui.md](../shared/librairie-ui.md)) ;
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
   son tick.

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

## Cas de contrôle

Un **deck réel** (Mihyang / Adriana / Sonia, lead 28 %, tous en Swift) est figé
dans [tests/speed-tune.test.ts](tests/speed-tune.test.ts) : vitesses de combat,
trajectoires **au millième** et ordre des tours, comparés à un outil de speed
tune de la communauté. C'est ce cas qui a fait apparaître que le Swift manquait —
et il garantit que le modèle (remise à zéro sans report, un seul monstre par
tick, buff au tick marqué) reste conforme.

## Attendus

- Fonctionne **sans compte importé** : les monstres viennent du bestiaire
  (`allMonsters`, formes jouables), la vitesse de runes se saisit. Cet outil
  passe donc AVANT la garde « aucune donnée de compte » de l'Optimizer.
- Changer un lead recalcule les vitesses de combat de son camp, donc l'ordre.
- Cohérent avec le calcul de vitesse du reste de l'app (`combatSpeed`), arrondi
  du bonus % au supérieur.
