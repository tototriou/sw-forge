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
Une `ToolCard` par page, dans **l'ordre d'importance** (celui de la nav) :
**RTA, Siège, Arène, Mon compte**, puis les ressources : **Bestiaire, Mécaniques**.

Chaque carte porte : icône + couleur d'accent, titre, description, 2 puces de
features, et un CTA fléché. Halo d'accent en fond, léger soulèvement au survol.

| Carte | Route | Accent | CTA | Particularité |
|-------|-------|--------|-----|---------------|
| RTA — Préparation | `#/rta` | `#A15FE0` (violet) | Préparer mes équipes | — |
| Siège | `#/siege` | `#E4463A` (rouge) | Préparer mes équipes de siège | 3 puces (dont recommandations) |
| Arène | `#/arene` | `#F2C24C` (or) | Bientôt disponible | `soon` : badge « Bientôt », opacité réduite |
| Mon compte | `#/compte` | `#5EDB8F` (vert) | Explorer mon compte | Box 6★, runes & artéfacts |
| Bestiaire | `#/bestiary` | `#2FA0E0` (bleu) | Ouvrir le bestiaire | Ressource |
| Mécaniques | `#/mecaniques` | `#8890B8` (gris) | Consulter les mécaniques | Ressource (doc), la moins centrale |

## Règles / attendus

- ⚠️ **L'accueil doit rester le miroir de l'app** : **toute page ou section
  ajoutée / renommée / supprimée doit être répercutée ici** (carte, ordre,
  description) **dans le même commit**, et l'ordre doit rester identique à celui
  de la nav de [App.tsx](src/App.tsx).
- La carte Arène est **inactive visuellement** (`soon`) mais reste un lien vers
  `#/arene` (qui affiche le placeholder « Bientôt disponible »).
- Les descriptions et CTA sont figés (validés par l'utilisateur) — notamment le
  Siège : « Compose tes équipes, offense et défense, et vérifie les speed tune
  de tes équipes. »
- Aucune donnée chargée ici : page purement présentationnelle.
