# Vue des gabarits de l'Optimizer

Une vue de développement qui montre les quatre configurations et chaque boîte de bureau de l'Optimizer
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

Les pages assemblées montent la vraie `PageBureau`, dans un corps visible de 730 px de haut,
avec une liste remplie, des réglages locaux et des résultats en attente. Leur largeur impose la
configuration ; les onglets restent cliquables sans modifier l'Optimizer.

| Largeur montrée | Configuration | Réglages rangés dans le groupe |
| --- | --- | --- |
| 752 px | Deux piles | Critères, Artéfacts, Options |
| 1 200 px | Monstre, groupe, résultats | Critères, Artéfacts, Options |
| 1 500 px | Monstre, Critères, groupe, résultats | Artéfacts, Options |
| 1 800 px | Cinq colonnes | Aucun |

« Monstre » rassemble la liste et l'exemplaire, dont la fiche reste repliée. Les trois colonnes
de réglages et les résultats suivent l'ordre de la
[spec de l'écran](../02-app/optimizer/ecran/README.md#mise-en-page-densemble).
Chaque panneau défile seul ; en deux piles, le groupe, le bloc et les résultats défilent ensemble.

- ⚠️ **Rien n'y est tassé** : la boîte porte sa largeur déclarée, son contenu garde la sienne ; un
  contenu qui ne tient pas déborde, et la mesure le dit en rouge.
- ⚠️ **Elle ne modifie jamais l'Optimizer.** Les états partent de l'état réel (listes, critères,
  compte importé) ; leurs gestes agissent sur un état local à chaque gabarit, ou sur des copies
  inertes des listes et de l'Optimizer, dont chaque fonction ne fait rien
  ([inertes.ts](../../src/components/outils/optimizer/gabarits/inertes.ts)).
- Le choix du format (téléphone ou bureau) ne s'y applique pas : chaque boîte est une forme de
  bureau, montrée à toute largeur de fenêtre.

## Ajouter des gabarits

Un groupe de boîtes = un fichier de gabarits qui exporte une liste de `Gabarit` (`types.ts`), et
une ligne dans `registre.ts`. La vue n'a pas à changer. Les groupes de boîtes :
[essentiels.tsx](../../src/components/outils/optimizer/gabarits/essentiels.tsx) (et le contrôle à
onglets), [colonnes.tsx](../../src/components/outils/optimizer/gabarits/colonnes.tsx) (Artéfacts et
Options) et [droite.tsx](../../src/components/outils/optimizer/gabarits/droite.tsx)
(« Exemplaire », bloc unique « Objectif et Rechercher » à plusieurs largeurs, résultats).
Ce dernier assemble aussi les quatre pages à partir de ces boîtes. Chaque état est un
élément rendu à partir du contexte (`ContexteGabarits`) ; un état qui a besoin d'un état local le
porte dans son propre composant.

- **Boîte élastique** (`elastique: true`) : sa `largeur` est son minimum ; un état peut se montrer
  plus large (`EtatGabarit.largeur`), dans une enveloppe à cette largeur, et la mesure s'y compare.
- **Données de vue.** Ce que la vue ne peut pas calculer sans lancer le moteur (estimation du pool
  filtré, chiffres des meilleurs artéfacts, progression, compte des combinaisons) est une valeur de
  vue, et le nom de l'état le dit. Les builds des résultats sont des combinaisons réelles des runes
  du compte (statistiques par `computeStats`) ; un compte trop petit pour vingt les répète sous des
  identifiants de copie ([donnees.ts](../../src/components/outils/optimizer/gabarits/donnees.ts),
  `droite.tsx`).
- Dans la vue, « Rechercher » bascule sur « Arrêter » sans rien lancer : la place exacte et les
  300 ms d'inactivité se voient sans moteur.

## Tests

[tests/rendu/optimizer-gabarits.test.tsx](../../tests/rendu/optimizer-gabarits.test.tsx) et
[tests/rendu/optimizer-gabarits-droite.test.tsx](../../tests/rendu/optimizer-gabarits-droite.test.tsx)
(réglages et résultats) : le sens
de chaque boîte (libellés, choix, états), la vue (chaque gabarit du registre, chacun de ses états,
son encadré) et l'adresse (reconnue ; hors développement, la page de l'Optimizer). Le branchement
en développement ne se voit qu'au navigateur : les tests construisent l'app avec
`import.meta.env.DEV` faux.
[tests/rendu/optimizer-gabarits-navigateur.test.ts](../../tests/rendu/optimizer-gabarits-navigateur.test.ts)
pilote un Chromium sur les boîtes dont le sens tient à un geste
([optimizer-gabarits-banc.tsx](../../tests/rendu/optimizer-gabarits-banc.tsx)) : le set compact
ouvert pendant la composition et fermé à six emplacements pleins, les principales en surbrillance
(résumé fermé entier sans que rien bouge au choix), l'aide et les buffs d'« État de mon monstre »,
le coffre en 3 + 4 colonnes, la fiche toujours repliée et le passage de Rechercher sous import/export.
Il mesure aussi les quatre configurations de la vraie page, leurs onglets exclusifs, leur stabilité
au clic et au redimensionnement, leur hauteur visible et leurs défilements confinés. Le banc
d'affichage décrit dans [tests/README.md](../../tests/README.md#le-banc-daffichage) exerce la page
complète avec un compte.
