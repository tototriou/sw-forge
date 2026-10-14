# Définition de fini — pas de fonctionnalité sans sa documentation et ses tests

Ce document dit quand une fonctionnalité, ou un changement de comportement, est terminée. La règle
vaut pour tout le dépôt et pour tout contributeur, humain ou agent.

> ⚠️ **Une fonctionnalité arrive avec sa documentation et ses tests, dans la même branche.** Sans
> eux, elle n'est pas finie : elle ne se propose pas à la relecture et ne fusionne pas dans une
> release. Ce n'est pas une étape qu'on demande en plus ; c'est une partie du travail.

Raison : une fonctionnalité sans fiche est réinventée ou contredite au prochain chantier, et une
fonctionnalité sans test se casse sans bruit. Les deux se rattrapent mal après coup — l'auteur est
le seul à savoir ce qui est voulu et ce qui ne l'est pas.

## La documentation

Avant de déclarer la fonctionnalité finie, chaque document qu'elle touche est à jour. La règle
d'écriture : [documentation.md](documentation.md).

- **Sa fiche** dans `docs/02-app/…` : ce qu'elle fait, ses règles et leur raison. Une fiche
  nouvelle entre dans le README de son dossier (la liste des parties ET la table « Le changement
  touche… »).
- **Les fiches voisines** dont elle change ce qu'elles décrivent (un bouton en plus dans la barre
  supérieure, une clé de plus hors de la session…).
- **Les documents d'ensemble**, dès qu'elle ajoute un fichier, une dépendance ou une commande :
  - [02-architecture.md](../01-presentation/02-architecture.md) : le shell, `src/ui/`, les hooks,
    le calcul de `src/lib/` ;
  - [03-technique.md](../01-presentation/03-technique.md) et [AGENTS.md](../../AGENTS.md) : la
    stack, les dépendances, les commandes, la table « Le changement touche… » ;
  - le [README.md](../../README.md) du dépôt (« Construit avec ») ;
  - le README de la section (`docs/02-app/README.md`, `docs/02-app/transverse/README.md`…) ;
  - [tests/README.md](../../tests/README.md) pour un outil de test.
- **Les mentions de l'ancien comportement** : `grep -rn` des noms changés dans `docs/`,
  `AGENTS.md`, `README.md` et `tests/` — une mise à jour remplace le texte périmé.

## Les tests

Chaque niveau que la fonctionnalité touche a sa vérification, inscrite au registre
([tests/index.ts](../../tests/index.ts)). Les outils : [tests/README.md](../../tests/README.md).

- **Le calcul** : la logique pure, dans `src/lib/`, testée par ses cas — dont ses cas limites et
  ce qui doit être refusé.
- **Le rendu** : chaque composant nouveau ou changé, par `react-dom/server` — ce qu'il affiche,
  ses libellés, ses états désactivés et leur raison.
- **Le branchement dans l'app** : la fonctionnalité rendue dans `App`, dans les conditions où elle
  s'active (route, largeur de fenêtre, données) — un composant juste mais jamais branché, ou
  branché à la mauvaise condition, ne se voit qu'ici.
- **L'outillage touché** (build, script, plugin) : vérifié sur ses vraies entrées, pas seulement
  sur un exemple écrit à la main.
- **Les tests existants** que la fonctionnalité fait mentir : corrigés pour dire le nouveau
  comportement, jamais supprimés pour faire passer la suite.

## Avant de proposer la fusion

- La documentation et les tests ci-dessus sont dans la branche.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` passent.
- La suite complète passe (`npm test`, ou `npm run test:suivi` pour la suivre en direct).
- Ce qui ne se vérifie qu'à l'écran (un geste, un rendu) est listé dans la PR, pour la relecture.
