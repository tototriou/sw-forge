# Ressources · Télécharger (`#/telecharger`)

Page du **site** qui propose l'**application de bureau** (Windows, Linux).
Rangée sous **Ressources**, sous « Nouveautés ». **Absente de l'app de
bureau** : ni entrée de navigation, ni lien, et l'adresse y retombe sur
l'accueil (`estBureau()`).

Fichiers : [TelechargerPage.tsx](src/pages/TelechargerPage.tsx) ·
[bureau.ts](src/lib/bureau.ts) (`TELECHARGEMENTS`, `DEPOT`) ·
[IconesSystemes.tsx](src/components/IconesSystemes.tsx) (logos) ·
[App.tsx](src/App.tsx) (route, `RESOURCES`). Décisions 13 et 14 du chantier
[application-bureau](chantiers/application-bureau.md).

## Contenu (de haut en bas)

- Titre « Télécharger », une phrase : l'app existe pour Windows et Linux,
  la même boîte à outils dans sa propre fenêtre.
- **Ce que l'app apporte**, trois cartes : sa propre fenêtre ; la mise à
  jour proposée — « c'est toi qui décides quand » (décision 11) ; 100 %
  local, comme le site.
- **À l'ordinateur** : « Télécharger pour Windows » et « Télécharger pour
  Linux », boutons principaux (`Bouton href`, le **logo du système** en
  icône), puis la phrase SmartScreen avec les libellés de Windows — « Windows
  a protégé votre ordinateur », « Informations complémentaires »,
  « Exécuter quand même » (installeur non signé, décision 2).
- **Au téléphone, pas de boutons** : « À installer depuis un ordinateur
  Windows ou Linux. » — rien ne s'installe sur un téléphone.
- « Version proposée : vX.Y.Z » (la dernière **publiée** de
  `src/data/releases.ts`) et « Toutes les versions sur GitHub » (nouvel onglet).

## Règles

- ⚠️ **Un clic télécharge le FICHIER**, pas la page de la release :
  `…/releases/latest/download/SW-Blacksmith-Setup.exe` et
  `…/SW-Blacksmith.AppImage`. Ces adresses ne sont fixes que parce que les
  fichiers n'ont **pas de numéro de version** (`artifactName` de
  `electron-builder.yml`) ; `tests/bureau-mise-a-jour.test.ts` vérifie que
  les deux concordent.
- Les liens répondent 404 tant que la dernière release publiée n'a pas
  d'installeur (avant la v2.0.0, ou les minutes où l'action GitHub les
  construit).
- Non retenus (décision 14) : expliquer la séparation des données site /
  app, l'aide Linux (rendre l'AppImage exécutable).
- **Accueil** : un bouton « Télécharger l'application » dans le héros et la
  carte « Application de bureau » de la grille mènent ici — voir
  [accueil.md](accueil.md).
