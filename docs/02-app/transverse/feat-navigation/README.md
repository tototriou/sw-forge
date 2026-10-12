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
