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
  leader. Le Swift n'est pas modélisé en v1 (la vitesse des runes se saisit
  directement).
- La **vitesse de combat minimale pour agir au tick n** est
  `⌈ 10000 / (7n) ⌉` (`speedForTick`) : 130 au tick 11, **239 au tick 6**
  (« Lent » en siège), **286 au tick 5** (« Rapide »), 477 au tick 3.

Deux **modificateurs par tick** (saisis dans les grilles, voir plus bas) entrent
dans la simulation :

- **Modification de barre d'attaque** (`atbMod[t]`) : variation **ponctuelle** de
  la barre au tick `t` — **positive** pour remplir (compétence de boost,
  artéfact…), **négative** pour vider (réduction d'ATB ennemie). ⚠️ La barre ne
  descend **jamais sous 0** (clampée dans la simulation). Une seule fois, ce
  tick-là. Bornée à ±100 dans la grille.
- **Buff de vitesse** (`speedMod[t]`) : +% de **vitesse** appliqué **uniquement
  au tick `t`** — ⚠️ **pas de report**, les ticks non marqués calculent l'ATB à
  la vitesse de base. C'est la **vitesse** qui change (l'ATB gagnée ce tick-là),
  pas la barre. Un buff qui dure plusieurs ticks se marque sur chacun d'eux.
- **Artéfact « augmente l'effet du buff de vitesse »** (`artefactBuff`, par
  allié) : bonus **ADDITIF** au buff de vitesse, actif **seulement quand un buff
  (> 0) est présent** ce tick-là — ex. buff +30 % + artéfact +10 % → vitesse
  × 1,40 ce tick. Ne s'applique **pas** à un ralenti. Modèle communautaire
  (additif, pas multiplicatif — [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/artifacts/)) ;
  renseigné pour les alliés seulement (artéfacts d'en face inconnus).

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
- **L'import n'enlève rien** : les monstres du deck rejoignent **le camp d'où
  on a cliqué** avec **la vitesse de runes du deck** ; un monstre déjà présent
  **dans ce camp** voit la sienne **remplacée** (le deck fait foi) et
  **réapparaît** s'il était masqué. Ce qui était là avant reste — à retirer d'un
  clic sur la croix si on ne le veut pas. Le même deck peut être importé **des
  deux côtés** (`uid = camp:id`), pour se comparer à soi-même.
- **Lead** : celui du **leader du deck** (slot 0, convention du siège), appliqué
  au camp qui reçoit l'import **seulement s'il vaut pour tout le monde** (`General` / `Guild`). ⚠️ Un
  lead d'**élément** ne se transpose PAS — le speed tuning n'a qu'un lead par
  camp, l'appliquer à tous gonflerait la vitesse des monstres d'un autre
  élément : le lead saisi reste alors inchangé. Un lead absent des raccourcis de
  `SPEED_LEADS` est **ajouté au menu** du camp, sinon il s'afficherait vide.
- ⚠️ **Swift** : la « SPD runes » d'un slot de siège contient déjà le Swift **à
  plat** (convention de l'app, voir [../shared/calcul-vitesse.md](../shared/calcul-vitesse.md)),
  mais le speed tuning ne modélise pas le set. La vitesse de combat importée peut
  donc différer de celle du siège de **1 point** au plus (arrondi du bonus %).

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
- **Vitesse à trouver** (`vitessesRequises`) : pour chaque allié coupé, la
  **vitesse de combat minimale** qui le fait passer avant. L'écran la traduit en
  points de **vitesse de runes** manquants.

### Comment la vitesse requise est cherchée

⚠️ **Pas de formule fermée.** La règle « un seul monstre par tick », les boosts
de barre et les buffs de vitesse par tick se mêlent : la vitesse requise se
cherche par **dichotomie sur la vitesse de combat, avec re-simulation à chaque
essai**, entre la vitesse actuelle et `COMBAT_MAX` (= `speedForTick(1)` = 1429,
agir dès le tick 1 — au-delà il n'y a plus rien à gagner).

- **Ce qui rend la dichotomie valide** : le prédicat « cet allié joue avant le
  premier adverse » est **monotone** en sa vitesse (plus vite = barre plus haute
  à chaque tick = tour plus tôt, et l'adverse ne peut qu'être repoussé). Vérifié
  par **test différentiel** contre une référence naïve (balayage linéaire
  exhaustif) sur 24 scénarios aléatoires à seed fixe — voir le skill
  `algo-verify`.
- ⚠️ **Les alliés sont traités du plus rapide au plus lent, et chaque vitesse
  trouvée est CONSERVÉE pour les suivants** : les ticks avant l'adverse sont une
  ressource partagée (un seul monstre par tick), donc corriger un allié change
  ce qu'il faut aux autres. Les vitesses proposées se lisent **ensemble**, ce
  n'est pas une somme de corrections indépendantes.
- **« Hors de portée »** (`combatRequis: null`) : même à `COMBAT_MAX` l'allié
  reste coupé — typiquement plus d'alliés que de ticks disponibles avant
  l'adverse. L'écran le dit au lieu d'afficher un chiffre inatteignable.
- **Coût** : ~11 simulations de 40 ticks par allié coupé, recalculé à chaque
  frappe. Négligeable à cette échelle (une poignée de monstres) — aucun budget
  ni cache n'a été nécessaire.
- **Limite héritée du modèle** : le verdict repose sur les **premiers tours**
  (voir plus bas) ; un adverse très rapide qui rejouerait une deuxième fois
  avant la fin de la chaîne n'est pas compté comme une coupure supplémentaire.

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
   [../shared/recherche-clavier.md](../shared/recherche-clavier.md)). Côté
   **allié uniquement**, chaque monstre a en plus un champ **« Arté buff »** — le
   bonus d'artéfact au buff de vitesse (voir Formule). Un même monstre peut
   figurer des DEUX côtés (`uid = camp:id`), pas deux fois dans le même camp.
   **Chaque camp** porte sous sa barre de recherche un bouton **« Importer un
   deck de siège »** (voir plus bas). Chaque monstre est une **card** avec, en **haut à droite** (convention app),
   l'**œil** (masquer / afficher) et la **croix** de suppression. Un monstre
   **masqué** reste dans son camp (grisé) mais quitte les calculs et les trois
   tableaux — pour tester une compo sans perdre son réglage ; on le réaffiche
   d'un clic sur l'œil.
3. **Le combo passe-t-il ?** — le verdict, posé AVANT les tableaux : c'est la
   question à laquelle sert l'outil. Vert quand toute l'équipe joue avant le
   premier adverse (il est nommé, avec son tick) ; rouge sinon — l'adverse qui
   coupe, puis **une ligne par allié coupé** : son tick, la **vitesse de combat**
   à atteindre et les **points de vitesse de runes** qui manquent
   (`runeSpeedForTarget`). Sans adverse (ou sans allié), une phrase neutre le
   dit — la section garde sa place, elle ne surgit pas sous le clic.
4. **Barre d'action par tick** (lecture seule) — tableau : lignes triées par
   ordre de tour, colonnes = ticks. Chaque cellule = `% rempli` — la
   **trajectoire réelle** renvoyée par la simulation (`OrdreEntree.trajectoire`),
   qui n'est plus linéaire dès qu'un modificateur entre en jeu. La case où le
   monstre **prend le tour** est surlignée (**fond** + badge de rang, jamais un
   contour de plus par-dessus la grille) ; les ticks après l'action restent
   vides. Adversaires en teinte `bad`, alliés en `accent`. Colonne de gauche
   figée, défilement horizontal.
5. **Modification de barre d'attaque** — grille **éditable**, même rendu que le
   tableau ci-dessus. Chaque camp présent ouvre sur une ligne **« Toute ton
   équipe » / « Tout en face »** (écrit la même valeur sur tous ses monstres au
   tick visé), puis une ligne par monstre. Cellules = `NumberField sansBoutons`
   (axe dense de la lib, voir [../shared/librairie-ui.md](../shared/librairie-ui.md)) ;
   valeur **positive pour remplir, négative pour vider** (la barre reste ≥ 0) ;
   une case vide = pas de modificateur.
6. **Buff de vitesse** — même grille, mais chaque cellule combine un **raccourci**
   et un **champ** : un bouton à l'icône SPD du jeu (celle des cartes RTA/Siège)
   pose/retire le buff **+30 %** d'un clic — c'est presque toujours celui-là — et
   un `NumberField` à côté permet de saisir une autre valeur (33 %, un ralenti
   −30 %…). La ligne équipe agit sur tout le camp. `speedMod` s'applique **au seul
   tick marqué** (pas de report) : un buff qui dure se marque sur chaque tick.
7. **Ordre de tour** — jetons entrelaçant les deux camps, chacun avec son rang et
   son tick.

Les trois tableaux **partagent les mêmes colonnes de ticks** (1 → au moins 12,
étendu jusqu'au dernier tick d'action) : on peut donc poser un modificateur sur
un tick avant qu'un monstre n'agisse.

## État & persistance

Aucune persistance disque (comme tout Outils). Les choix (monstres ajoutés,
vitesses de runes, leads, boosts d'ATB, buffs de vitesse, artéfacts, état
masqué) vivent en `useStickyState` : conservés le temps de la session (survivent
à la navigation), remis à zéro au rechargement.

## Attendus

- Fonctionne **sans compte importé** : les monstres viennent du bestiaire
  (`allMonsters`, formes jouables), la vitesse de runes se saisit. Cet outil
  passe donc AVANT la garde « aucune donnée de compte » de l'Optimizer.
- Changer un lead recalcule les vitesses de combat de son camp, donc l'ordre.
- Cohérent avec le calcul de vitesse du reste de l'app (`combatSpeed`), arrondi
  du bonus % au supérieur.
