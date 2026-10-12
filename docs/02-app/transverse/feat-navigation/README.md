# Navigation — barre latérale, barre supérieure et onglets mobiles

> ⚠️ La navigation est l'endroit où les **deux formats** divergent le plus :
> barre latérale sur bureau, barre d'onglets et panneau montant sur mobile. Voir
> [03-developpeur/interface/](../../../03-developpeur/interface/) pour la règle de cadre.

Depuis la refonte UI, la navigation repose sur trois pièces :
une **barre latérale** (au-dessus de `lg`), une **barre supérieure** fixe, et
une **barre d'onglets en bas** (sous `lg`).

Fichiers : [Sidebar.tsx](src/components/Sidebar.tsx),
[TopBar.tsx](src/components/TopBar.tsx),
[MobileTabs.tsx](src/components/MobileTabs.tsx),
[SidebarSearch.tsx](src/components/SidebarSearch.tsx),
[SidebarCompte.tsx](src/components/SidebarCompte.tsx), assemblés dans
[App.tsx](src/App.tsx).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `parseHash` et les routes de `src/App.tsx`, `src/lib/accountViews.ts` | [barre-laterale-et-adresses.md](barre-laterale-et-adresses.md), [niveaux-et-repli.md](niveaux-et-repli.md) |
| ce que fait un clic dans la barre (ouvrir une section, naviguer) | [navigation-seule.md](navigation-seule.md) |
| `src/components/Sidebar.tsx` : repli, niveaux, survol | [niveaux-et-repli.md](niveaux-et-repli.md) |
| `src/components/SidebarSearch.tsx`, `src/components/Palette.tsx`, `src/components/palette/recherchePalette.ts` | [recherche-et-palette.md](recherche-et-palette.md) |
| `src/components/TopBar.tsx` | [barre-superieure.md](barre-superieure.md) |
| `src/components/MobileTabs.tsx`, `src/components/MobileNavSheet.tsx`, `src/lib/layout.ts` | [barre-onglets.md](barre-onglets.md) |
| l'accent `--ctx`, l'animation de la nav, le contour au focus | [accent-animation-focus.md](accent-animation-focus.md) |
| `src/components/SidebarCompte.tsx`, `src/pages/SettingsPage.tsx` | [compte-et-parametres.md](compte-et-parametres.md) |
| la largeur maximale du contenu | [largeur-du-contenu.md](largeur-du-contenu.md) |
| le bouton « Options » et le panneau d'actions au téléphone, `src/ui/MobileSheet.tsx` | [panneau-actions-mobile.md](panneau-actions-mobile.md) |
| la règle tactile de `src/index.css` | [densite-au-doigt.md](densite-au-doigt.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [barre-laterale-et-adresses.md](barre-laterale-et-adresses.md) | Pourquoi une barre latérale, et ce que lit la barre d'adresse (routage par hash, `parseHash`). |
| [navigation-seule.md](navigation-seule.md) | La règle centrale : la page ne change qu'au choix d'une destination, jamais en ouvrant une section. |
| [niveaux-et-repli.md](niveaux-et-repli.md) | Les trois niveaux de « Mon compte », le repli à deux états, pas d'aperçu au survol. |
| [recherche-et-palette.md](recherche-et-palette.md) | La recherche de navigation en tête de la barre et la palette Ctrl K. |
| [barre-superieure.md](barre-superieure.md) | La barre supérieure : identité, où l'on est, ce qui sort. |
| [barre-onglets.md](barre-onglets.md) | La barre d'onglets en bas de l'écran au téléphone. |
| [accent-animation-focus.md](accent-animation-focus.md) | L'accent contextuel (`--ctx`) qui prend la couleur de l'élément du monstre consulté, l'animation, un seul contour au focus. |
| [compte-et-parametres.md](compte-et-parametres.md) | La carte du compte chargé en tête de la barre, et la page Paramètres (`#/parametres`). |
| [largeur-du-contenu.md](largeur-du-contenu.md) | La largeur du contenu, sans plafond à 1180 px. |
| [panneau-actions-mobile.md](panneau-actions-mobile.md) | Le bouton « Options » et le panneau d'actions qui monte au téléphone. |
| [densite-au-doigt.md](densite-au-doigt.md) | Les deux paliers de la règle tactile. |
