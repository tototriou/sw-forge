# Speed tuning — un seul monstre par tick

Partie de [Outils · Speed tuning](README.md).

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
