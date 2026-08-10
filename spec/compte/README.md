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

**Référence de calcul** (auto-suffisante : formules, tables, décodage SWEX,
algorithme d'optimisation) : [calcul-runes.md](calcul-runes.md).

La sous-section courante est déduite du hash (`parseHash` dans
[App.tsx](src/App.tsx)) et passée en prop `sub` ; `AccountPage` rend la section
correspondante. Le bouton de nav reste **actif** sur n'importe quelle
sous-section.

## État & persistance

- **En mémoire** (`useState` dans [App.tsx](src/App.tsx)), donc ré-import à
  chaque session — **sauf** si l'utilisateur active « Garder mon compte » dans le
  menu ⚙ : le compte est alors relu au démarrage depuis IndexedDB. Jamais
  `localStorage`. Voir [shared/import-compte.md](../shared/import-compte.md).
- Si rien n'est chargé (les trois vides) : écran d'invite « Aucune donnée de compte
  chargée — importe ton compte… ».
- ⚠️ Pendant la relecture, l'écran affiche **« Chargement de ton compte… »**, pas
  l'invite d'import : annoncer « aucune donnée » une fraction de seconde avant
  que tout apparaisse fait croire à une perte.

## Périmètre

- **Monstres** : uniquement les monstres **montés 6★** (grade actuel `class === 6`).
- **Runes / Artéfacts** : **tout** l'inventaire (possédés + équipés, dédupliqués).

## Confidentialité

Tout est traité **côté navigateur**, jamais envoyé. Idem pour l'import du JSON d'un
ami dans la comparaison de courbes de runes.
