# Mon compte (`#/compte`)

Explorer **tout son compte** importé : la box des monstres, l'inventaire des runes
(avec analyse) et des artéfacts. Alimenté par l'**import global** (voir
[../shared/import-compte.md](../shared/import-compte.md)).

Fichier racine : [AccountPage.tsx](src/pages/AccountPage.tsx). Données passées en
prop depuis [App.tsx](src/App.tsx) : `box` (6★), `runes`, `artifacts`.

## Navigation par dropdown

« Mon compte » n'est **pas un onglet simple** mais un **dropdown de nav** (comme
« Ressources »), avec trois sous-sections adressables par hash :

| Sous-section | Route | Spec |
|--------------|-------|------|
| Monstres (box 6★) | `#/compte` | [monstres.md](monstres.md) |
| Runes | `#/compte/runes` | [runes.md](runes.md) |
| Artéfacts | `#/compte/artefacts` | [artefacts.md](artefacts.md) |

La sous-section courante est déduite du hash (`parseHash` dans
[App.tsx](src/App.tsx)) et passée en prop `sub` ; `AccountPage` rend la section
correspondante. Le bouton de nav reste **actif** sur n'importe quelle
sous-section.

## État & persistance

- **En mémoire uniquement** (`useState` dans [App.tsx](src/App.tsx)). Aucun
  `localStorage` : il faut **ré-importer** son compte à chaque session.
- Si rien n'est chargé (les trois vides) : écran d'invite « Aucune donnée de compte
  chargée — importe ton compte… ».

## Périmètre

- **Monstres** : uniquement les monstres **montés 6★** (grade actuel `class === 6`).
- **Runes / Artéfacts** : **tout** l'inventaire (possédés + équipés, dédupliqués).

## Confidentialité

Tout est traité **côté navigateur**, jamais envoyé. Idem pour l'import du JSON d'un
ami dans la comparaison de courbes de runes.
