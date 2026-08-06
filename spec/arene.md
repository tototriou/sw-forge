# Arène (`#/arene`) — à venir

Outil de préparation des équipes d'**arène classique** (offense et défense).
Actuellement un **placeholder**.

Fichier : [ComingSoon.tsx](src/pages/ComingSoon.tsx) (rendu générique
« Bientôt disponible »), câblé dans [App.tsx](src/App.tsx) avec le titre
« Arène » et la description « Préparation des équipes d'arène classique (offense
et défense). »

## État actuel

- Route active, accessible depuis la nav et la carte d'accueil (marquée « Bientôt »).
- Affiche l'écran générique en construction, sans logique métier.

## Intentions (non implémenté)

Quand cette page sera construite, elle réutilisera les briques transverses :

- Le [calcul de vitesse](shared/calcul-vitesse.md) partagé (base + runes + totem
  + lead), comme RTA et Siège.
- **Spécificité arène** : à la différence du siège, les leads de portée `Arena`
  **sont actifs** (voir `siegeLeadFor` / `isSiegeLeadActive` dans
  [speed.ts](src/lib/speed.ts) — la logique arène devra définir son propre
  filtre de portée : `Arena` actif, `Dungeon`/`Guild` selon le contexte).
- Probable réutilisation du modèle d'équipe à leader auto du [Siège](siege/README.md).

> À préciser avec l'utilisateur avant implémentation (règles de leads d'arène,
> nombre d'équipes off/def, tours). Ne pas démarrer sans validation.
