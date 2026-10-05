# Preuve — lot 5 de la refonte graphique : accueil

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à B.10.
Décisions appliquées (A.2 bis) : 10 (accueil actuel gardé, restylé),
3 (teintes de section retirées), 4 (bouton principal plein).

## Tests écrits AVANT (commit `b5a0418`)

`tests/rendu/accueil.test.tsx`, sur le code d'avant le lot, 40
vérifications :

- **héros** : nom, accroche, promesse ;
- **zone de dépôt** : `role="button"` atteignable au clavier, ses quatre
  textes, deux sélecteurs `.json` ;
- **Comment ça marche** : les trois étapes (numéro, titre, phrase), le lien
  SW Exporter dans un nouvel onglet ;
- **Fonctionnalités** : les douze cartes (destination, kicker, titre,
  phrase) et leur ordre ;
- **dernier appel** : son bouton, puis le bandeau de la dernière version
  publiée ;
- **« Ton espace »** : absent sans données ; chaque tuile vers sa
  sous-section, avec son chiffre et son unité accordée ; un zéro affiché.

**Aucune assertion modifiée depuis.**

## Ce qui change (commit `4ebcf70`)

- Cartes de la refonte (panneau, `border-soft`, rayon 12, fond appuyé au
  survol) ; plus de soulèvement (`whileHover`).
- Icônes dans une tuile de 32 px. **Premier passage : neutres, halos
  retirés. Retour de Thomas (2026-09-25) : « j'aimais bien les couleurs sur
  la page d'accueil »** — tuiles à la teinte de leur section (icône, fond
  14 %, contour 32 %), halos des cartes de fonctionnalités, couleurs des
  étapes, numéro compris. Les 16 teintes des cartes et tuiles sont les
  mêmes qu'avant le lot : comparées par `diff` avec `b5a0418` (« teintes
  identiques à avant le lot »). Les icônes d'élément du héros (rendus du jeu)
  gardent leur couleur.
- « Comment ça marche » : une carte, trois étapes séparées par des filets.
- Dernier appel : `Bouton ton="accent" fond="plein"`.
- Pastille de version : texte à l'encre. Mesure
  (`scratchpad/contraste-accueil.mjs`) : l'accent sur un fond d'accent à 15 %
  donne 4,44:1 sur `panel` en Forge et 3,97:1 sur `panel2`. L'encre donne
  10,31:1 au pire.
- Inventaire : « Importer mon compte » passe du texte au `libelle` du
  Bouton — déplacement `devient`.
- `couleursSection.ts` : commentaire à jour (les teintes ne servent plus
  qu'à la navigation du téléphone, jusqu'au lot 11).

## Vérifications

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu refonte            → 236 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; md:border-l,
  md:first:border-l-0, first:border-t-0, bg-accent/15, bg-accent/10,
  hoverable:bg-panel2 présentes dans le CSS
```

## À regarder sur le serveur de dev (non testable)

- L'aspect des cartes, des tuiles et des séparateurs, dans les deux thèmes.
- La carte « Comment ça marche » : les filets entre les colonnes sur
  ordinateur, et entre les étapes empilées sur téléphone.
- Au survol, le fond des cartes s'appuie.
