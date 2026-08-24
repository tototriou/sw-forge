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
- **L'artéfact « Effet aug. VIT » est repris** du `gear` du slot (code `206`
  dans `ARTIFACT_SUB`, sommé sur les deux artéfacts) : c'est lui qui amplifie le
  buff de vitesse, il n'a pas à être ressaisi.
- ⚠️ **Le deck REMPLACE la composition du camp** où l'on a cliqué : un deck est
  une équipe, pas une liste de monstres à empiler — sans ça, importer une
  deuxième défense entassait six monstres du même côté. Ce qui était dans **ce
  camp** est donc perdu (vitesses corrigées, modificateurs) ; **l'autre camp
  garde tout**, et le deck reste dans Siège, réimportable à volonté. Le même deck
  peut être importé **des deux côtés** (`uid = camp:id`), pour se comparer à
  soi-même.
- **Lead** : celui du **leader du deck** (slot 0, convention du siège), appliqué
  au camp qui reçoit l'import **seulement s'il vaut pour tout le monde** (`General` / `Guild`). ⚠️ Un
  lead d'**élément** ne se transpose PAS — le speed tuning n'a qu'un lead par
  camp, l'appliquer à tous gonflerait la vitesse des monstres d'un autre
  élément : le lead saisi reste alors inchangé. Un lead absent des raccourcis de
  `SPEED_LEADS` est **ajouté au menu** du camp, sinon il s'afficherait vide.
- **Le set Rapidité est repris** du slot (`sets` contient `swift`) : la vitesse
  de combat importée est alors identique à celle qu'affiche le siège.

## Le combo passe-t-il ? (chaîne d'ouverture)

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
- **DEUX leviers proposés**, pour chaque allié coupé :
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
  Rien à trouver et rien à en attendre → « hors de portée ».

### Comment la vitesse requise est cherchée

⚠️ **Pas de formule fermée.** La règle « un seul monstre par tick », les boosts
de barre et les buffs de vitesse par tick se mêlent : la vitesse requise se
cherche par **dichotomie sur la vitesse de combat, avec re-simulation à chaque
essai**, entre la vitesse actuelle et `COMBAT_MAX` (= `speedForTick(1)` = 1429,
agir dès le tick 1 — au-delà il n'y a plus rien à gagner).

- **Ce qui rend la dichotomie valide** : le prédicat « cet allié joue avant le
  premier adverse » est **monotone sur les deux axes** (plus vite, ou buff plus
  amplifié = barre plus haute à chaque tick = tour plus tôt, et l'adverse ne peut
  qu'être repoussé). Vérifié par **test différentiel** contre une référence naïve
  (balayage linéaire exhaustif), **sur les deux axes**, sur 24 scénarios
  aléatoires **avec compétences** à seed fixe — voir le skill `algo-verify`.
- ⚠️ **Les alliés sont traités du plus rapide au plus lent, et chaque vitesse
  trouvée est CONSERVÉE pour les suivants** : les ticks avant l'adverse sont une
  ressource partagée (un seul monstre par tick), donc corriger un allié change
  ce qu'il faut aux autres. Les vitesses proposées se lisent **ensemble**, ce
  n'est pas une somme de corrections indépendantes.
- **« Hors de portée »** (`combatRequis: null`) : même à `COMBAT_MAX` l'allié
  reste coupé — typiquement plus d'alliés que de ticks disponibles avant
  l'adverse. L'écran le dit au lieu d'afficher un chiffre inatteignable.
- ⚠️ **Plusieurs PASSES** (`PASSES_MAX = 4`) : corriger un allié peut lui faire
  prendre le tick d'un autre, ou déplacer le tour de celui qui remplit la barre
  de l'équipe. On repasse tant que ça avance ; ce qui reste coupé au bout est
  déclaré hors de portée.
- **Coût** : ~11 simulations de 40 ticks par allié coupé et par passe, recalculé
  à chaque frappe. Négligeable à cette échelle (une poignée de monstres) — aucun budget
  ni cache n'a été nécessaire.
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

⚠️ **C'est l'analyse qui la remplit.** Cliquer sur « Analyser » y écrit l'ordre
que les vitesses produisent et, pour chacun, le sort que son kit a retenu —
exactement comme elle écrit dans les grilles. Ces choix deviennent alors des
choix comme les autres : on les corrige, et **y toucher relance l'écriture**
(c'est le seul changement qui la relance).

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
- **Sort par monstre**, dans un **menu à icônes** (Bouton + `Flottant` +
  rangées à plat, la grammaire des listes ancrées de l'app) : la ligne reste
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
| `ralenti` / `ralentiTous` | −30 % de vitesse sur l'adverse (le plus avancé, ou tous) |

- ⚠️ **`atbAllie` exclut le LANCEUR** : sa barre vient de retomber à 0, il serait
  systématiquement « celui qui l'a la plus basse » et se rendrait à lui-même un
  boost dont personne ne compte.
- ⚠️ **Un retrait de barre ou un ralenti vise l'adverse le plus AVANCÉ** : c'est
  lui qu'on cherche à retarder, et c'est ce qu'un joueur vise.
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
  départagée par la vitesse de combat puis par l'ordre de placement (le premier
  ajouté passe).
- ⚠️ **Ce n'est PAS un tri par vitesse.** Trois monstres qui franchissent 100 au
  même tick prennent le tour aux ticks n, n+1, n+2, pas tous au même.
- **Modèle du PREMIER tour** : on ne modélise pas les tours suivants d'un
  monstre très rapide qui rejouerait avant qu'un lent ait agi. Sans effet sur
  l'**ordre** relatif (un rapide reste devant un lent) ; le **numéro de tick**
  d'un lent peut être sous-estimé de quelques crans dans ce cas — raffinement
  laissé pour plus tard.
- Vitesse ≤ 0 (base inconnue, aucune runes) → n'agit jamais, écarté de l'ordre.

## Écran

De haut en bas :

1. **Repère des ticks** — bandeau : la vitesse de combat mini pour agir à chaque
   tick (11→3). Les deux ticks canoniques du siège (286 et 239) sont marqués par
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
   l'**œil** (masquer / afficher) et la **croix** de suppression. Un monstre
   **masqué** reste dans son camp (grisé) mais quitte les calculs et les trois
   tableaux — pour tester une compo sans perdre son réglage ; on le réaffiche
   d'un clic sur l'œil.
3. **Analyse automatique** — ⚠️ **Elle ÉCRIT, elle ne recouvre pas.** Un clic sur
   **« Analyser »** lit les kits, simule, et **pose le résultat DANS les grilles**
   — exactement comme si on les avait remplies à la main : buff de vitesse
   activé, valeurs dans les cases. Puis elle s'arrête. Tout reste modifiable
   ensuite, et **rien ne repasse dessus**.
   - **Pourquoi** : la version précédente affichait des valeurs qui n'existaient
     nulle part et se recalculaient sans cesse. On ne pouvait ni les corriger, ni
     savoir ce qui venait de l'outil et ce qui venait de soi.
   - ⚠️ **Un effet est écrit au tick SUIVANT celui où il est lancé.** Dans le
     moteur, ce qu'une compétence pose arrive APRÈS l'arbitrage du tick (le
     lanceur vient de jouer) ; une case de grille, elle, est posée AVANT.
     L'écrire sur le même tick aurait laissé un allié boosté voler le tour du
     lanceur.
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
   - ⚠️ **« Analyser » REPOSE l'adversaire de référence** sur le plus rapide du
     moment, à chaque fois — dès qu'il n'y a **pas** de vrai adversaire, ou
     **toujours** si le réglage d'application « Adversaire de référence » est
     activé (menu ⚙, voir [../README.md](../README.md)). Il n'était posé qu'en l'absence de tout adversaire :
     une fois là, il ne bougeait plus jamais — appliquer un passif (Chilling, +20
     par buff) pouvait changer qui est le plus rapide sans que la référence le
     sache, et on se comparait à un monstre qui ne l'était plus. Un **vrai**
     adversaire (saisi ou importé), lui, n'est jamais remplacé : c'est une
     composition qu'on affronte, pas un repère.
4. **Ordre des sorts** — card à part (voir « Ordre des sorts » plus bas).
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
   valeur **positive pour remplir, négative pour vider** (la barre reste ≥ 0) ;
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
   et c'est exactement ce que l'analyse écrit quand un sort buffe l'équipe.
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
