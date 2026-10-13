# Runes — mesure de la qualité

Partie de [Mon compte — Runes](README.md).

## Choix de la mesure — **Efficience** ou **Score SW**

La qualité d'une rune peut s'afficher de deux façons, au choix :

| Mesure | Ce que c'est |
|--------|--------------|
| **Efficience** (défaut) | convention communautaire — stat principale incluse, `/2,8` |
| **Score SW** | le score **affiché dans le jeu** — stats secondaires uniquement |

Formules et écart entre les deux : [feat-calcul-runes.md §3 et §3 bis](../feat-calcul-runes.md).

- ⚠️ **C'est un RÉGLAGE GLOBAL de l'application**, pas un filtre de page : il se
  pose **une fois** dans le menu **⚙** (tout à droite de la barre de nav, voir
  [../../03-developpeur/](../../../03-developpeur/)). Aucun sélecteur n'est répété dans les pages.
- **Persisté** dans `localStorage` (`swblacksmith-rune-metric-v1`) : un réglage
  d'application survit au rechargement, contrairement aux filtres et tris qui
  sont des préférences de vue jetables. « Tout supprimer » le garde.
- Implémenté par un **store externe** (`useSyncExternalStore`,
  [useRuneMetric.ts](src/hooks/useRuneMetric.ts)) et **non** par `useStickyState` :
  ce dernier ne relit son cache **qu'au montage**, il ne synchroniserait pas les
  vues déjà affichées au moment du changement.
- **Même couleur** dans les deux cas (`text-star` dans le détail, couleur de
  rareté sur les tuiles) : c'est la même information, seule l'unité change.
- Les deux valeurs sont calculées **une fois par import** → bascule instantanée.
- **Portée** : **Liste**, **Courbes**, **Comparaison** et **Optimisation** suivent
  le réglage, ainsi que le détail d'équipement en RTA/siège. Seul le **Résumé**
  reste en efficience (ses paliers et agrégats sont calibrés dessus).
- ⚠️ Dans l'**Optimisation** et les **Courbes de potentiel**, ce n'est pas un
  simple changement d'unité : `runePotential` **refait le calcul** dans la mesure
  demandée. Les stats plates ne pesant pas pareil dans les deux tables, la
  **meilleure gemme peut différer** (typiquement entre un ATQ plat et un ATQ %).
  Voir `OptimMetric` dans [runeOptim.ts](src/lib/runeOptim.ts).
- **Arrondi** : en mode score, potentiels et gains sont des **entiers**
  (`round(… × 100)`, comme la formule du jeu). L'arrondi n'intervient qu'**en
  sortie** — les comparaisons internes du choix de gemme travaillent en pleine
  précision, sinon deux gemmes séparées d'un centième seraient à égalité et le
  choix deviendrait arbitraire. Les **gains** sont calculés sur les valeurs déjà
  arrondies, pour que « gain = potentiel − actuel » soit vrai **à l'écran**.

## Efficience d'une rune

Formule validée (détail + tables `MAINSTAT_MAX` / `SUBSTAT_MAX` dans
[feat-calcul-runes.md](../feat-calcul-runes.md)) :

```
eff = (min(main/mainMax, 1) + Σ(substat/subMax) + innée/subMax) / 2.8 × 100
```

Substats = **valeur meule incluse**. Maxes 6★ **non antiques** → une rune antique
peut dépasser 100 %.
