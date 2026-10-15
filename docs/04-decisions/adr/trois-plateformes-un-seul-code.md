# Trois plateformes, un seul code

## Décision

SW Blacksmith est maintenu sur trois plateformes — le **site au téléphone**, le
**site à l'ordinateur** et l'**application de bureau** (Windows, Linux) — et
**un seul code les sert toutes** :

- **le site** est une application responsive, un seul build Vite ; téléphone et
  ordinateur y sont deux formats de premier rang
  ([deux-formats-de-premier-rang.md](deux-formats-de-premier-rang.md)) ;
- **l'application de bureau** est construite avec **Electron**, qui affiche ce
  même build tel quel. ⚠️ **Aucune fonctionnalité ne s'écrit deux fois** : seul
  ce que le navigateur ne sait pas faire est propre au bureau, derrière
  `estBureau()` ;
- **au téléphone, rien ne s'installe** : il est servi par le site.

## Raisons

- **Une fonctionnalité écrite deux fois diverge.** Avec un seul code, ce qui
  est fait pour une plateforme existe sur les trois.
- **L'application de bureau sert ceux qui veulent l'app en local**, dans sa
  propre fenêtre, sans rien retirer au site.
- **Electron garde tout en TypeScript et Node**, comme le reste du dépôt ;
  Chromium embarqué donne le même rendu partout, et l'outillage est mûr
  (electron-builder, mise à jour automatique).

## Options écartées

- **Tauri ou une PWA pour le bureau** : Electron l'emporte pour les raisons
  ci-dessus.
- **Un code par plateforme** : la base est commune, même si les plateformes
  sont un jour empaquetées séparément.
- **Une application mobile installable** : le site au téléphone en tient lieu.

## Conséquences

- **Le poids d'Electron est accepté** : un installeur de 100 à 150 Mo, et plus
  de mémoire qu'un onglet.
- **Chaque écran est pensé deux fois**, pour le doigt et pour la souris.
- **Le site et l'application ne partagent rien** (deux origines) : passer de
  l'un à l'autre, c'est réimporter son compte, exporter puis importer prépa et
  équipes.
- **Les installeurs ne sont pas dans le dépôt** : ils sont construits au tag et
  attachés à la release ; la page Télécharger du site y mène.
- Ce qui diffère entre le site et l'application, la coquille, les données,
  l'installeur et la mise à jour :
  [bureau/](../../02-app/bureau/README.md) ; la page du site :
  [telecharger/](../../02-app/telecharger/README.md).
