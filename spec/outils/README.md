# Outils (`#/outils`)

Boîte à outils de calcul, distincte de « Mon compte » (qui explore le
compte) et du Siège/RTA (qui préparent des équipes). Structurée pour
accueillir plusieurs outils sans retoucher la nav (ajouter une branche =
ajouter un outil).

Fichier racine : [OutilsPage.tsx](src/pages/OutilsPage.tsx). Données passées
en prop depuis [App.tsx](src/App.tsx) : `box` (6★), `runes`, `allMonsters`.
⚠️ **Speed tuning ne dépend pas d'un compte importé** (il lit `allMonsters`
et la vitesse se saisit) : il passe AVANT la garde « aucune donnée de compte »,
qui est propre à l'Optimizer.

## Navigation par dropdown

« Outils » est un **dropdown de nav**, même mécanique que « Mon compte » et
« Ressources », **inséré entre les deux** (voir
[../README.md](../README.md), Shell applicatif).

| Sous-section | Route | Spec |
|--------------|-------|------|
| Optimizer | `#/outils/optimizer` | [optimizer.md](optimizer.md) |
| Speed tuning | `#/outils/speed-tuning` | [speed-tuning.md](speed-tuning.md) |

La sous-section courante est déduite du hash (`parseHash` dans
[App.tsx](src/App.tsx)) et passée en prop `sub`.

## Briques de calcul

Pas une page : un modèle de calcul partagé, documenté à part parce qu'il
dépasse l'écran qui le consomme aujourd'hui.

- [degats-reels.md](degats-reels.md) — dégâts d'un **sort précis** contre un
  adversaire configuré ([damage.ts](src/lib/damage.ts)). Alimente l'objectif
  de recherche « Dégâts réels » de l'Optimizer, et porte la **source unique**
  du facteur de défense pour toute l'app.

## État & persistance

Aucune. Les choix de recherche (monstre, combo, minimums) sont des
préférences de vue jetables comme les filtres de page — rien n'est écrit
dans `localStorage`.

## Confidentialité

Tout est calculé **côté navigateur**, jamais envoyé. L'outil ne modifie
jamais le compte importé : il est purement indicatif.
