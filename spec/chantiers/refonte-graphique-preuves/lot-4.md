# Preuve — lot 4 de la refonte graphique : barre latérale bureau

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.4.
Décisions appliquées (A.2 bis) : 3 (menu sans couleurs de section), 5
(regroupement), 6 ([retrait #6] : Meules et Gemmes hors du menu).

## Tests écrits AVANT (commit `a68260a`)

`tests/rendu/app.test.tsx` rend l'application ENTIÈRE (`App`) sur ses 23
routes : chaque route s'affiche avec son titre ; le menu bureau atteint
toutes les destinations par un lien (en cumulant ce qu'il montre sur chaque
route) ; chaque section reste nommée au premier niveau ; recherche, import,
Paramètres, repli présents ; onglets mobiles inchangés. **Aucune assertion
modifiée depuis** ; une ajoutée pour fixer le retrait décidé (Meules et
Gemmes absentes du menu bureau).

## Ce qui change

- `App.tsx` : la barre latérale reçoit une structure PROPRE au bureau
  (`groupesBureau`, `sectionOuverteBureau`, sections RTA / Siège / Runes /
  Artéfacts), construite à partir des mêmes constantes que l'existant.
  Premier niveau : Accueil · Jouer (RTA, Siège, Arène) · Mon compte
  (Monstres, Runes, Artéfacts) · Outils (Optimizer, Speed tuning) ·
  Ressources. Icônes monochromes.
- Non touchés : `Sidebar.tsx` (mécanique des niveaux, survol, repli), les
  sections partagées avec le téléphone (`sectionCompte`, `sectionOutils`…),
  les onglets mobiles, le panneau mobile, la barre du haut, la recherche.
- Inventaire : une entrée change de nature — `prop:label:Mon compte`
  (entrée cliquable) devient `prop:titre:Mon compte` (titre de groupe).
  Déclarée dans `deplacements.json` avec le nouveau champ `devient`
  (comparaison et test étendus : accepté si retrouvé, refusé sinon).

## Vérifications

```text
$ npx tsc --noEmit                            → code 0
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node tests/run.mjs rendu navigation refonte → 177 vérifications passées
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
```

## À regarder sur le serveur de dev (non testable)

- Le panneau de survol à côté de la barre (RTA, Siège, Runes, Artéfacts) :
  il n'est pas rendu sans survol, aucun test ne le voit.
- Barre repliée : les titres de groupe (Jouer, Mon compte…) et les icônes
  monochromes.
