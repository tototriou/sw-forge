# Preuve — lot R9a du rebranding : le Bestiaire

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R9a ;
décision 47 (affichage seulement). Script du scratchpad : `r9a-captures.mjs`,
2026-09-30.

## 1. Avant de toucher

```text
node tests/run.mjs RenduBestiaire → 22 vérifications passées
```

Captures sur l'app construite : sans compte et avec le compte réel, 1440 px
dans les deux thèmes ; téléphone tactile 390 px.

## 2. Relevé : la planche `BsBestiaire` contre notre écran

| Zone | Toile | Notre écran |
|---|---|---|
| En-tête | surtitre « Référence », « Bestiaire », à droite « Données SWARFARM · mises à jour chaque semaine » | « Bestiaire » + compteur ; la source est au pied de page (« Source : swarfarm.com ») |
| Recherche et tri | recherche pleine largeur, bouton « Trier : nom » à côté | recherche à largeur fixe ; « Tri interne » sur la ligne de la pagination (refonte, lot 10) |
| Filtres | pastilles d'élément neutres avec l'icône | pastilles colorées par élément, plus les étoiles naturelles |
| Cartes | 5 par ligne, portrait de 96 px, pastille d'élément | 10 par ligne, portrait de 64 px (gabarit de la box), badge d'élément, étoiles, groupées par élément |
| Téléphone | — (pas de planche) | inchangé |

Non proposé (décision 47, une fonction absente de l'app) : le filtre « Dans
ma box — Uniquement les miens » et la pastille « Dans ta box » — le Bestiaire
ne croise pas le compte. Écarté aussi : « mises à jour chaque semaine », une
cadence que rien dans l'app ne garantit.

## 3. Déjà décidé, appliqué sans question

- **Icônes (44)** : l'état « Aucun monstre ne correspond à ces filtres »
  passe de `Sparkles` (lucide) au grimoire du Bestiaire (`IconeBestiaire`).
  Au passage : l'import `BookOpen`, inutilisé, disparaît.
- **Couleurs d'état (43)** : rien à faire — aucun rouge ni vert d'état dans
  ces composants ; la fiche d'un monstre a été traitée au R8.

## 4. Décisions et validation

En-tête et filtres (55), cartes (56) : gardés, les deux recommandations
retenues. Code montré avant commit, capture sur l'app construite
(`r9a-verif.mjs`, recherche « zzzz », deux thèmes), une page à vérifier
donnée au mainteneur ; réponse : « ok ». Commit `d3218f56`.

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduBestiaire navigation      → 87 passées
node scripts/inventaire-ui.mjs --verifier         → aucune perte
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
npm run build                                     → built
```

## 5. Ce que je n'ai pas pu prouver

- Le téléphone à l'œil pour cet état vide : même composant, aucune classe
  `compact:` ni `lg:` touchée.
