# Preuve — lot R8 du rebranding : Mon compte

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R8 ;
décision 47 (affichage seulement). Script du scratchpad : `r8-captures.mjs`,
2026-09-30.

## 1. Avant de toucher

Captures sur l'app construite, compte réel importé : Ma box, les sept vues
de Runes (Résumé, Liste, Courbes, Comparaison, Optimisation, Meules,
Gemmes), Résumé et Liste d'Artéfacts, à 1440 px dans les deux thèmes ; Ma
box, Résumé et Liste des runes, Liste des artéfacts au téléphone tactile.

## 2. Relevé : la planche `BsCompte` contre nos écrans

| Zone | Toile | Nos écrans |
|---|---|---|
| Structure | UNE page « Mon compte » : surtitre de l'import, « Réimporter », « Supprimer mes données », onglets Résumé / Monstres / Runes / Artéfacts soulignés de braise | trois inventaires (Ma box, Runes, Artéfacts), leurs vues au troisième niveau de la barre latérale ; import et suppression dans la coquille (carte du compte, pied de page) |
| Chiffres clés | quatre grandes tuiles (monstres, runes, efficacité moyenne, artéfacts), chiffres en 34 px | Résumé des runes : bande de six chiffres compacts, puis distribution, qualité du stock, marge de progression, emplacements, stats principales, sets |
| Runes | un TABLEAU (set, slot, principale, secondaires, barre d'efficacité, « Conseil ») | la carte du jeu en tuile (`RuneDetailBox`), rendu du jeu intouchable |
| Panneaux | « À l'établi » (meules, gemmes, runes à vendre, lien vers le plan) ; « Sets équipés » (barres) | déjà là : « Marge de progression » (meules et gemmes à poser), vues Meules, Gemmes et Optimisation ; « Par set » |
| Téléphone | — (pas de planche) | inchangé |

Non proposé (décision 47) : la colonne « Conseil » (Garder, Gemmer, Meuler,
Vendre) et « Runes à vendre » — un verdict par rune que l'app ne calcule pas.

## 3. Déjà décidé, appliqué sans question (43)

Rouge et vert d'état à la place des couleurs d'élément, là où ils disent un
état :
- `MonsterDetailDialog` : pastille d'un effet de MALUS (`fire` → `bad`) —
  la fiche sert aussi au Bestiaire ;
- `RunesCompare` : message d'import (`wind` → `good`, `fire` → `bad`) ;
- `RunesOptim` : gain négatif du plan détaillé et la légende qui le dit « en
  rouge » (sur les tuiles, `effColor` a ensuite disparu : voir § 5) ;
- `SubSearchDialog` : survol de « Tout effacer » (`fire` → `bad`).
Les tables d'éléments (`MonsterCard`, `MonsterAvatar`) ne bougent pas.

## 4. Décisions du mainteneur

Structure (51), cartes de rune (52), icônes des vues (53) : gardées, les
trois recommandations retenues. Question du mainteneur en cours de lot : « est-ce
que tu ne ferais pas quelque chose qui a déjà été fait ? » — vérifié par
`git log -S"text-fire"` : aucun commit n'avait touché ces rouges ; la refonte
avait déjà reconstruit les écrans, d'où un relevé qui garde tout.

## 5. Les tuiles de l'Optimisation (54)

Trois retours du mainteneur sur les captures, avant son « validé » :
1. « écris de la même couleur le Héro et la flèche et la valeur, idem pour
   Légend » → une couleur par ligne, `effColor` retiré ;
2. « change la couleur de la valeur actuelle » → encre en gras, puis « bof,
   mets une autre couleur » → planche sur les vraies tuiles, deux thèmes
   (`r8-actuelle-planche.mjs` : encre, braise, bleu ciel, vert) → braise ;
3. « il faut que le actuelle aussi prenne la couleur » → toute la ligne en
   braise.
Limite dite au mainteneur : en Atelier, sur une légendaire, la braise foncée
(`166 79 17`) est quasi la couleur de rareté d'avant (`166 88 12`).

## 6. Vérifications

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduRunes RenduCompte RenduTelephoneRunes → 214 passées (148 pour les runes seules après les retours)
node scripts/inventaire-ui.mjs --verifier         → aucune perte (trois textes de l'aide déclarés)
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
npm run build                                     → built
```

Couleurs relues dans la page (`r8-tuile.mjs`) : « → 133.0% » en `text-bad`
avant le retour 1, la ligne « Héro » en `rgb(200 140 255)` / `118 51 176`
après.

## 7. Ce que je n'ai pas pu prouver

- Le message de RÉUSSITE de Comparaison (import d'une courbe exportée) : la
  capture n'a pas obtenu le téléchargement ; vérifié dans le code seulement.
- Le survol de « Tout effacer » du filtre de propriété : non capturé.
- Le téléphone à l'œil : mêmes classes, aucun `compact:` ni `lg:` touché.
