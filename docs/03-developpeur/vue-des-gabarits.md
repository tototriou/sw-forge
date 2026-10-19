# Vue des gabarits de l'Optimizer

Une vue de développement qui montre chaque boîte de la mise en page de bureau de l'Optimizer
([02-app/optimizer/ecran/](../02-app/optimizer/ecran/README.md), « Mise en page d'ensemble »),
seule, à sa largeur, dans chacun de ses états. Code :
[VueGabarits.tsx](../../src/components/outils/optimizer/gabarits/VueGabarits.tsx), son registre
[registre.ts](../../src/components/outils/optimizer/gabarits/registre.ts), les boîtes dans
[bureau/](../../src/components/outils/optimizer/bureau/), l'adresse dans
[optimizerGabarits.ts](../../src/lib/optimizerGabarits.ts).

## L'ouvrir

1. `npm run dev`, puis importer un compte (le compte d'exemple
   `tests/fixtures/compte-miniature.json` suffit).
2. Aller à `#/outils/optimizer/gabarits`.

⚠️ **En développement seulement.** `OutilsPage` reconnaît l'adresse sous
`import.meta.env.DEV` ; en production, la branche et son import dynamique disparaissent à la
construction, et l'adresse mène à la page de l'Optimizer. `App.tsx` n'en sait rien : `parseHash`
lit déjà `#/outils/optimizer/…` comme l'Optimizer.

## Ce qu'elle montre

Pour chaque boîte : sa largeur et sa hauteur déclarées, son composant, ce qu'elle partage avec le
téléphone, l'encadré « Ce qui change de comportement » par rapport à l'écran d'aujourd'hui, puis
chacun de ses états (liste vide ou remplie, aucun set ou sets choisis, principales libres ou
choisies…). Sous chaque état, la taille **réelle** mesurée dans le navigateur, et le débordement
quand le contenu dépasse la largeur déclarée.

- ⚠️ **Rien n'y est tassé** : la boîte porte sa largeur déclarée, son contenu garde la sienne ; un
  contenu qui ne tient pas déborde, et la mesure le dit en rouge.
- ⚠️ **Elle ne modifie jamais l'Optimizer.** Les états partent de l'état réel (listes, critères,
  compte importé) ; leurs gestes agissent sur un état local à chaque gabarit, ou sur des copies
  inertes des listes et de l'Optimizer, dont chaque fonction ne fait rien
  ([inertes.ts](../../src/components/outils/optimizer/gabarits/inertes.ts)).
- Le choix du format (téléphone ou bureau) ne s'y applique pas : chaque boîte est une forme de
  bureau, montrée à toute largeur de fenêtre.

## Ajouter des gabarits

Un groupe de boîtes = un fichier de gabarits (comme
[essentiels.tsx](../../src/components/outils/optimizer/gabarits/essentiels.tsx)) qui exporte une
liste de `Gabarit` (`types.ts`), et une ligne dans `registre.ts`. La vue n'a pas à changer. Chaque
état est un élément rendu à partir du contexte (`ContexteGabarits`) ; un état qui a besoin d'un
état local le porte dans son propre composant.

## Tests

[tests/rendu/optimizer-gabarits.test.tsx](../../tests/rendu/optimizer-gabarits.test.tsx) : le sens
de chaque boîte (libellés, choix, états), la vue (chaque gabarit du registre, chacun de ses états,
son encadré) et l'adresse (reconnue ; hors développement, la page de l'Optimizer). Le branchement
en développement ne se voit qu'au navigateur : les tests construisent l'app avec
`import.meta.env.DEV` faux.
