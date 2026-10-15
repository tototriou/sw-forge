# Speed tuning — formule (modèle partagé)

Partie de [Outils · Speed tuning](README.md).

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
  [../transverse/](../transverse/)). L'écart n'est que
  d'**un point**, et un point suffit à rater un tick : sur le deck de contrôle
  Mihyang / Adriana / Sonia, l'oublier donnerait 374 et 350 au lieu de 373 et 349.
  Un deck importé du siège coche la case tout seul (le slot porte ses sets).
- La **vitesse de combat minimale pour agir au tick n** est
  `⌈ 10000 / (7n) ⌉` (`speedForTick`) : 130 au tick 11, **239 au tick 6**
  (« Lent » en siège), **286 au tick 5** (« Rapide »), 477 au tick 3.

### ⚠️ Mode RTA — non modélisé, chantier à ouvrir

**Les 7 % par tick sont ceux du siège** (et de l'arène, de la guerre de
guilde). **La RTA remplit la barre de 1,5 % de la vitesse par tick**, les
raids de 4,5 % :

> « In most areas of the game the tick size is 7%, the only exceptions are
> in Raids (4.5%) and RTA (1.5%) » —
> [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/attack_bar/),
> même chose sur le [wiki Fandom](https://summonerswar.fandom.com/wiki/Attack_Bar).

L'outil ne connaît que le siège : un réglage validé ici ne vaut pas pour la
RTA dès qu'un boost de barre ou un buff de vitesse entre en jeu (sans
modificateur, l'ordre est le même : tout le monde est ralenti dans la même
proportion). Un mode RTA est un **chantier à part** (il touche `src/lib/`). Ce
qu'il devra trancher :

- un réglage **Siège / RTA** de l'outil, qui change la constante du moteur
  (`speedTune.ts`), le seuil par tick (`speedForTick`) et le repère des ticks
  (239 / 286 n'existent qu'en siège) ;
- la **longueur des tableaux** : à 1,5 %, un monstre à 300 de vitesse joue
  vers le 23ᵉ tick — les 40 colonnes ne montreraient que son premier tour ;
- le **totem +15 %**, compté partout aujourd'hui (voir plus haut), y
  compris dans l'ordre de tour de la RTA : les bâtiments comptent-ils en
  RTA ? **Non établi** — à citer ou à mesurer en jeu avant de coder (skill
  `game-data-curation`, §6 ter : pas de déduction par ressemblance).

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
  9 ne passe pas, 10 oui, alors que le calcul décimal dit que 9 suffit.
  Arrondir au lieu de tronquer donnerait 33 % dès 9, ce que le jeu dément.
  Conséquence utile : l'artéfact avance **par paliers**, et l'outil propose le
  premier palier qui change quelque chose.
  ⚠️⚠️ **La troncature se calcule EN ENTIERS** — `(buff × (100 + artéfact)) / 100`,
  jamais `buff × (1 + artéfact / 100)` : le second passe par un flottant qui
  tombe juste sous l'entier (buff 25 + artéfact 16 → 28,999999999999996, tronqué
  en **28** au lieu de 29). Toujours dans le sens du MOINS, donc un outil qui
  réclame de la vitesse là où le jeu n'en demande pas.
  > « Increase SPD Effect +N% | Multiplicative | The buff value | 10% artifact
  > makes SPD buff being 33% instead of 30% » —
  > [Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/artifacts/)

  ⚠️ **Multiplicatif, pas additif** : additif, l'artéfact vaudrait trois à
  quatre fois son effet réel, ce qui fausserait les vitesses proposées (un deck
  où 10 d'artéfact valent ~3 de vitesse, pas ~20). Une valeur de mécanique se
  relit à la source avant d'être écrite ici comme acquise.
