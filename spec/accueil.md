# Accueil (`#/`)

Landing page de SW Forge. Rôle : présenter l'outil et diriger vers les 4 pages.

Fichier : [HomePage.tsx](src/pages/HomePage.tsx)

## Contenu

### Hero
- Sur-titre mono : « Summoners War · Boîte à outils ».
- Titre géant `SW Forge` en dégradé (`title-gradient`), `clamp(44px,9vw,96px)`.
- Paragraphe d'accroche décrivant bestiaire + préparation RTA.
- Bandeau des 5 éléments (`fire, water, wind, light, dark`) qui flottent en
  boucle (animation `framer-motion`, décalage de 0.18 s par icône).

### Cartes des outils (grille, 2 colonnes ≥ md)
Une `ToolCard` par page, dans cet ordre : **RTA, Siège, Arène, Bestiaire**.

Chaque carte porte : icône + couleur d'accent, titre, description, 2 puces de
features, et un CTA fléché. Halo d'accent en fond, léger soulèvement au survol.

| Carte | Accent | CTA | Particularité |
|-------|--------|-----|---------------|
| RTA — Préparation | `#A15FE0` (violet) | Préparer mes équipes | — |
| Siège | `#E4463A` (rouge) | Préparer mes équipes de siège | — |
| Arène | `#F2C24C` (or) | Bientôt disponible | `soon` : badge « Bientôt », opacité réduite |
| Bestiaire | `#2FA0E0` (bleu) | Ouvrir le bestiaire | En dernier (le moins important) |

## Règles / attendus

- La carte Arène est **inactive visuellement** (`soon`) mais reste un lien vers
  `#/arene` (qui affiche le placeholder « Bientôt disponible »).
- Les descriptions et CTA sont figés (validés par l'utilisateur) — notamment le
  Siège : « Compose tes équipes, offense et défense, et vérifie les speed tune
  de tes équipes. »
- Aucune donnée chargée ici : page purement présentationnelle.
- Si une carte/route est ajoutée, garder l'ordre d'importance et refléter le
  même ordre dans la nav de [App.tsx](src/App.tsx).
