# Outils · Speed tuning (`#/outils/speed-tuning`)

Outil de speed tune : à chaque « tick » d'horloge, la barre d'action (ATB) de
chaque monstre monte de `vitesse_combat × 7 %` ; **un seul monstre agit par
tick**. L'écran répond à une question précise — « est-ce que je joue **avant**
tel monstre ? » — d'où les deux camps et l'ordre de tour qui les entrelace.

Fichiers : [SpeedTuningSection.tsx](src/components/outils/SpeedTuningSection.tsx)
· calcul pur [speedTune.ts](src/lib/speedTune.ts) · vitesse de combat
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
3. **Barre d'action par tick** (lecture seule) — tableau : lignes triées par
   ordre de tour, colonnes = ticks. Chaque cellule = `% rempli` — la
   **trajectoire réelle** renvoyée par la simulation (`OrdreEntree.trajectoire`),
   qui n'est plus linéaire dès qu'un modificateur entre en jeu. La case où le
   monstre **prend le tour** est surlignée (**fond** + badge de rang, jamais un
   contour de plus par-dessus la grille) ; les ticks après l'action restent
   vides. Adversaires en teinte `bad`, alliés en `accent`. Colonne de gauche
   figée, défilement horizontal.
4. **Modification de barre d'attaque** — grille **éditable**, même rendu que le
   tableau ci-dessus. Chaque camp présent ouvre sur une ligne **« Toute ton
   équipe » / « Tout en face »** (écrit la même valeur sur tous ses monstres au
   tick visé), puis une ligne par monstre. Cellules = `NumberField sansBoutons`
   (axe dense de la lib, voir [../shared/librairie-ui.md](../shared/librairie-ui.md)) ;
   valeur **positive pour remplir, négative pour vider** (la barre reste ≥ 0) ;
   une case vide = pas de modificateur.
5. **Buff de vitesse** — même grille, mais chaque cellule combine un **raccourci**
   et un **champ** : un bouton à l'icône SPD du jeu (celle des cartes RTA/Siège)
   pose/retire le buff **+30 %** d'un clic — c'est presque toujours celui-là — et
   un `NumberField` à côté permet de saisir une autre valeur (33 %, un ralenti
   −30 %…). La ligne équipe agit sur tout le camp. `speedMod` s'applique **au seul
   tick marqué** (pas de report) : un buff qui dure se marque sur chaque tick.
6. **Ordre de tour** — jetons entrelaçant les deux camps, chacun avec son rang et
   son tick.

Les trois tableaux **partagent les mêmes colonnes de ticks** (1 → au moins 12,
étendu jusqu'au dernier tick d'action) : on peut donc poser un modificateur sur
un tick avant qu'un monstre n'agisse.

## État & persistance

Aucune persistance disque (comme tout Outils). Les choix (monstres ajoutés,
vitesses de runes, leads, boosts d'ATB et buffs de vitesse) vivent en
`useStickyState` : conservés le temps de la session (survivent à la navigation),
remis à zéro au rechargement.

## Attendus

- Fonctionne **sans compte importé** : les monstres viennent du bestiaire
  (`allMonsters`, formes jouables), la vitesse de runes se saisit. Cet outil
  passe donc AVANT la garde « aucune donnée de compte » de l'Optimizer.
- Changer un lead recalcule les vitesses de combat de son camp, donc l'ordre.
- Cohérent avec le calcul de vitesse du reste de l'app (`combatSpeed`), arrondi
  du bonus % au supérieur.
