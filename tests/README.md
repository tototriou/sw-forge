# Vérifications automatiques

```bash
npm test
```

Affiche une ligne par vérification et sort en code 1 si l'une échoue.

## Ce qui est couvert, et pourquoi seulement ça

La plupart des bugs de SW Forge sont **visibles** : une icône manquante, une
carte mal placée, un filtre qui ne filtre pas. On les voit en ouvrant la page, et
c'est très bien comme ça — il n'y a **aucun test d'interface ici, et il ne faut
pas en ajouter** sans raison sérieuse.

Ces vérifications ciblent les quatre endroits où une erreur est à la fois
**grave et invisible** :

| Fichier | Ce qui casserait sans bruit |
|---|---|
| [vitesse.test.ts](vitesse.test.ts) | Un arrondi de travers = un speed tune faux d'un point. Le joueur perd son combat et croit à un mauvais RNG. |
| [import.test.ts](import.test.ts) | Un export lu différemment selon qu'il arrive en texte ou en objet ; une date d'import affichée à la place de la date d'export. |
| [stockage.test.ts](stockage.test.ts) | Une écriture en retard qui ressuscite un compte effacé ; un enregistrement périmé lu comme s'il était complet. |
| [persistance.test.ts](persistance.test.ts) | Écrire alors que l'utilisateur a refusé ; ou cesser d'écrire pour quelqu'un d'installé depuis des mois. |

Aucun de ces symptômes n'est reproductible à la demande, et aucun ne sera
remonté correctement par un utilisateur. C'est ce qui justifie de les figer ici.

## Choix d'outillage

- **Pas de framework.** Ce qui est vérifié, ce sont des fonctions pures et une
  base de données : des assertions suffisent. Vitest ou Jest apporteraient une
  configuration, des versions à suivre et une couche de magie pour un bénéfice
  nul à cette échelle. Le jour où il faudra tester des composants React, la
  question se reposera.
- **esbuild**, déjà présent comme dépendance de Vite, bundle `index.ts` ; Node
  exécute le résultat. C'est tout ce que fait [run.mjs](run.mjs).
- ⚠️ **Les tests ne passent pas par `tsc`** : `tsconfig.json` ne couvre que
  `src`, et les inclure demanderait `@types/node`. esbuild se contente de retirer
  les types. Une erreur de type dans un test se manifeste donc à l'exécution —
  acceptable, puisqu'on lance les tests précisément à ce moment-là.
- **`fake-indexeddb`** en dépendance de développement : les vraies sémantiques
  d'IndexedDB (transactions, ordre, structured clone), pas un faux maison qui
  validerait ce qu'on croit avoir écrit.

## Les fichiers d'exemple

- [fixtures/export-synthetique.json](fixtures/export-synthetique.json) — un
  export SWEX **miniature écrit à la main**, commité, sans la moindre donnée
  réelle : trois unités, six runes, deux artéfacts, mais **chaque chemin** des
  extracteurs est exercé (box 6★, inventaire, favoris RTA, défense, attaque).
- L'**export réel** du développeur (`tototriou-*.json`) est **gitignoré**. Les
  quelques vérifications qui s'en servent s'affichent en `--` (ignorées) quand il
  est absent, au lieu d'échouer sur les autres machines.

## Ajouter une vérification

1. Un fichier `nom.test.ts` exportant une fonction par défaut.
2. L'appeler depuis [index.ts](index.ts).
3. **Vérifier qu'elle sait échouer** : casser volontairement le code testé,
   constater le `KO`, puis restaurer. Un test qui ne peut pas échouer est pire
   qu'aucun test — il rassure à tort.
