# Preuve — lot 6, la page « Télécharger » et le lien de l'accueil

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 6,
décisions 13 et 14. Mené le 2026-10-06 sur `forge/application-bureau`.

## Relevé et choix de Thomas, dans l'ordre

1. **Décision 13** (relevé) : deux boutons dans le héros, le fichier
   directement, une ligne au téléphone. `Bouton` ne savait faire qu'un
   `<button>` → axe **`href`**. Fichier direct → `artifactName` **sans
   version**, seule adresse fixe ; vérifié dans `electron-updater`
   (`providers/Provider.js` l. 24) : l'ancien `.blockmap` se retrouve en
   remplaçant la version dans tout le chemin, tag compris.
2. À l'arrêt avant commit : « mets l'icône Windows et Linux plutôt que
   l'icône de download » → `src/components/IconesSystemes.tsx` (Windows :
   quatre carreaux dessinés ; Linux : Tux de Simple Icons 16.34.0, CC0-1.0).
3. Dans la foulée : « une page dédiée au download […] en dessous de
   Nouveautés et un lien dans la page d'accueil » → **décision 14** : page
   `#/telecharger` « Télécharger » ; dans le héros un seul bouton vers elle
   + sa carte « Application de bureau » ; au téléphone, la page sans
   boutons ; contenu : ce que l'app apporte, la version, GitHub.

## Ce qui a été construit

- `src/ui/Bouton.tsx` : axe `href` (`<a>`, même dessin) ; `index.css` :
  `a[data-bouton]` dans la règle d'appui ; `librairie-ui.md`, `design.md`.
- `src/pages/TelechargerPage.tsx` ; `spec/telecharger.md`.
- `src/App.tsx` : route `telecharger` (site seulement — dans l'app,
  l'adresse retombe sur l'accueil), entrée sous « Nouveautés » dans
  `RESOURCES` (omise dans l'app), onglet « Outils » actif au téléphone.
- `src/pages/HomePage.tsx` : `LienApplication` (bouton à l'ordinateur,
  ligne-lien au téléphone) ; carte « Application de bureau » après
  « Nouveautés » ; les deux, site seulement.
- `IconeTelecharger` (atelier, dessinée pour l'app, pas sur planche) ;
  `COULEUR_SECTION.telecharger` `#7FD15B`.
- `src/lib/bureau.ts` : `TELECHARGEMENTS`, `DEPOT` ;
  `electron-builder.yml` : `SW-Blacksmith-Setup.${ext}`,
  `SW-Blacksmith.${ext}`.
- Specs : `accueil.md`, `README.md` (carte des pages),
  `shared/navigation.md` (Ressources, adresses, largeurs — dont « trois
  exceptions » qui en comptait six), `ARCHITECTURE.md`.

## Preuve 1 — captures (build servi par `vite preview`, Playwright)

| Page | Format | Forge | Atelier |
|------|--------|-------|---------|
| Accueil | ordinateur 1440 × 900 | [dark](lot-6-accueil-ordinateur-dark.png) | [light](lot-6-accueil-ordinateur-light.png) |
| Accueil | téléphone 390 × 844 | [dark](lot-6-accueil-telephone-dark.png) | [light](lot-6-accueil-telephone-light.png) |
| Télécharger | ordinateur | [dark](lot-6-telecharger-ordinateur-dark.png) | [light](lot-6-telecharger-ordinateur-light.png) |
| Télécharger | téléphone | [dark](lot-6-telecharger-telephone-dark.png) | [light](lot-6-telecharger-telephone-light.png) |

Relevé dans les pages : accueil à l'ordinateur, « Télécharger
l'application → #/telecharger » ; au téléphone, la ligne-lien vers
`#/telecharger` ; page à l'ordinateur, `Télécharger pour Windows →
…/releases/latest/download/SW-Blacksmith-Setup.exe` et `… Linux →
…/SW-Blacksmith.AppImage` ; au téléphone, aucun bouton. Fil d'Ariane
« Ressources › Télécharger ».

## Preuve 2 — tests

- `testRenduTelecharger` (nouveau, 14) : texte, trois atouts, liens et
  logos, phrase SmartScreen mot pour mot, ligne téléphone, version, GitHub.
- `testRenduAccueilBureau` : le bouton (lien, logos Windows puis Linux, sous
  la promesse), la ligne-lien ; dans l'app simulée : ni bouton, ni ligne,
  ni carte. `testRenduAccueil` : treize cartes dans l'ordre.
- `testNavigationAdresses` : `#/telecharger` dans la table ; dans l'app,
  retombe sur l'accueil. `testRenduAppRoutes` : son titre.
- `testBureauMiseAJour` : `artifactName` = noms visés, même dépôt que
  `publish`.
- `node tests/run.mjs renduapp telephoneoutilsressources rendunouveautes
  renduparametres navigationadresses bureau renduaccueil rendutelecharger
  refonteinventaire renduuibouton telephoneaccueil` → **493 passées** ;
  `palette` → 19 ; `tsc`, `npm run build` sans erreur.
- Mode preuve (app) : `"accueilSansTelechargement": true` — aucun
  `a[href="#/telecharger"]` dans l'app.

## Ce qui n'est pas prouvé

- **Un vrai téléchargement** : `releases/latest` est la v1.14.0, sans
  installeur — 404 jusqu'à la v2.0.0 (et les minutes où l'action construit).
  La page affiche aujourd'hui « Version proposée : v1.14.0 ».
- **L'AppImage** et l'avertissement SmartScreen sur un fichier téléchargé.
- **L'icône de section** n'a pas été choisie sur planche comme les autres.
