# Outils (`#/outils`)

Boîte à outils de calcul, distincte de « Mon compte » (qui explore le
compte) et du Siège/RTA (qui préparent des équipes). Un seul outil pour
l'instant, structuré pour en accueillir d'autres sans retoucher la nav.

Fichier racine : [OutilsPage.tsx](src/pages/OutilsPage.tsx). Données passées
en prop depuis [App.tsx](src/App.tsx) : `box` (6★), `runes`.

## Navigation par dropdown

« Outils » est un **dropdown de nav**, même mécanique que « Mon compte » et
« Ressources », **inséré entre les deux** (voir
[../README.md](../README.md), Shell applicatif).

| Sous-section | Route | Spec |
|--------------|-------|------|
| Optimizer | `#/outils/optimizer` | [optimizer.md](optimizer.md) |

La sous-section courante est déduite du hash (`parseHash` dans
[App.tsx](src/App.tsx)) et passée en prop `sub`.

## État & persistance

Aucune. Les choix de recherche (monstre, combo, minimums) sont des
préférences de vue jetables comme les filtres de page — rien n'est écrit
dans `localStorage`.

## Confidentialité

Tout est calculé **côté navigateur**, jamais envoyé. L'outil ne modifie
jamais le compte importé : il est purement indicatif.
