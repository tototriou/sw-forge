# Preuve — lot 9b de la refonte graphique : Outils · Speed tuning

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à
B.10. Décision appliquée (A.2 bis) : **22**, trois choix du mainteneur avant le
code — import de deck un par camp, en tête de carte ; Ordre des sorts |
Analyse, puis Ordre de tour remonté avant les tableaux ; ajouts de la
maquette au lot 13.

## Tests écrits AVANT (commit `f5cc897a`)

`tests/rendu/speed-tune.test.tsx`, rendu bureau, 48 vérifications.

- **Sans monstre** : titre et règle des ticks, repère du tick 3 au 11, deux
  camps et tous les leads, recherches d'ajout, « Importer un deck de
  siège » désactivé avec sa raison, message d'attente.
- **Les deux camps** : lead d'équipe et son origine, chaque card (base,
  runes, Swift, bonus d'artéfact, vitesse de combat), monter / descendre et
  leurs extrémités désactivées, masquer / afficher, copier dans l'autre
  camp, retirer.
- **Analyse et tableaux** : « Ordre des sorts » et « Afficher », « Analyser »,
  barre au millième avec la case saisie comptée, adversaire marqué, monstre
  masqué hors des tableaux, les deux grilles et leurs cases, buff +30 %
  enclenché, ordre de tour.

⚠️ L'état de l'outil vit dans le magasin privé de `useStickyState`, rempli
par un effet qui ne tourne pas en rendu serveur ; `src/hooks/` est interdit
à la refonte. Le test intercepte donc la lecture du magasin le temps du
rendu seulement (`avecEtat`). Les kits ne se chargent pas non plus : le
contenu de l'analyse reste couvert par `tests/speed-tune.test.ts`.

## Le lot, puis les retours du mainteneur

| Commit | Quoi | Retour du mainteneur |
|---|---|---|
| `f3c17153` | décision 22 écrite dans le cadrage, avant le code | — |
| `0f5e4c85` | à la souris : titre au gabarit des autres pages ; « Importer un deck de siège » dans l'en-tête de chaque camp ; ordre de tour sous l'analyse | capture : « ça ne va pas, il faut que le rendu soit le même » — « Ton équipe » passait à la ligne, pas « En face » |
| `0e7a69ab` | en-tête des deux camps sur deux lignes : titre, puis lead et import calés à droite | « ça me va » |

Rien n'est retiré. **Une assertion d'avant le lot change**, signalée à
Le mainteneur : le compte des boutons d'import passe de 2 à 4 (une copie par
format, une seule visible) ; le sens, un import par camp, reste.

Non fait : les deux camps en grille à deux colonnes (la maquette). La spec
les veut côte à côte selon la place RÉELLE (`flex-wrap`), l'outil s'ouvrant
aussi en modale ; ils le sont déjà à la souris.

Signalé en cours de lot, hors refonte : la RTA remplit la barre de 1,5 %
par tick, pas 7 %. Noté comme chantier à ouvrir (`bf4ebc5c`,
`spec/outils/speed-tuning.md` § Mode RTA).

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs RenduSpeedTune speed-tune → 466 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; classes lg: émises
```

**Lot 9b validé par le mainteneur le 2026-09-28** (« ça me va »).
Téléphone non regardé (lot 11).
