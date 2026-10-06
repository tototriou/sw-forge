# L'application de bureau (Electron)

**Statut :** CHANTIER terminé le 2026-10-06 — branche forge/application-bureau

Fiche du chantier : son journal (cadrage, contrats et résultats des lots,
preuves) est archivé dans les notes privées du projet. L'état actuel de
l'application de bureau est décrit par
[shared/application-bureau.md](../shared/application-bureau.md).

## Ce que le chantier a livré

- L'application de bureau Windows et Linux (Electron) : le build du site
  servi par le protocole `app://swblacksmith/`, fenêtre aux couleurs du
  thème (barre intégrée, taille et position mémorisées, pas de menu), liens
  externes vers le navigateur du système, téléchargements par « Enregistrer
  sous ».
- L'installeur Windows (assistant NSIS, icône, désinstallation sans reste)
  et l'AppImage ; leur publication au tag `v*` par une action GitHub, qui
  les attache à la release du tag.
- La mise à jour automatique, que l'utilisateur décide ; le bloc
  « Application » des Réglages.
- Sur le site : la page « Télécharger » et son lien sur l'accueil.
- Le dossier SW Exporter : « Mon compte » suit les exports de l'invocateur
  choisi (Réglages ou carte du compte).
- Les textes qui parlent du navigateur, dits pour l'app ; la mesure
  d'audience retirée partout ; deux axes à `Notification`, un à `Bouton`,
  deux à `Menu`.

## Reste à constater

- **À la publication de la v2.0.0** : la première exécution de
  `.github/workflows/bureau.yml` (Windows et AppImage, jamais construite
  sous Linux), un vrai téléchargement depuis la page « Télécharger »,
  l'avertissement SmartScreen sur l'installeur téléchargé.
- **À la version suivante** : le passage réel N → N+1 de la mise à jour
  automatique (`mise-a-jour.log`).

## Section citée → place publique

| Section citée | Place publique |
| --- | --- |
| A.2 — « le site ne change pas » | [shared/application-bureau.md](../shared/application-bureau.md), « Un seul code » |
| décision 1 — données du jeu dans l'installeur | [shared/donnees-monstres.md](../shared/donnees-monstres.md), « Chargement côté app » |
| décision 2 — pas de signature | [telecharger.md](../telecharger.md) ; [shared/application-bureau.md](../shared/application-bureau.md), « L'installeur » |
| décision 3 — Windows et Linux | [shared/application-bureau.md](../shared/application-bureau.md), « L'installeur » |
| décision 4 — import du dossier SW Exporter, amendée par la 15 | voir décision 15 |
| décisions 5, 13, 14 — téléchargement sur le site | [telecharger.md](../telecharger.md) ; [accueil.md](../accueil.md), « Héros » |
| décision 6 — plus de mesure d'audience | [README.md](../README.md), « Conventions communes » |
| décision 7 — l'habillage de la fenêtre | [shared/application-bureau.md](../shared/application-bureau.md), « La coquille » |
| décision 8 — l'installeur Windows | [shared/application-bureau.md](../shared/application-bureau.md), « L'installeur » |
| décision 9 — publication par `gh`, pas d'essai | [shared/application-bureau.md](../shared/application-bureau.md), « La publication » |
| décisions 10, 11, 12 — la mise à jour | [shared/application-bureau.md](../shared/application-bureau.md), « La mise à jour » ; [shared/design.md](../shared/design.md), notification |
| décision 15 — le dossier SW Exporter | [shared/application-bureau.md](../shared/application-bureau.md), « Le dossier SW Exporter » ; [shared/import-compte.md](../shared/import-compte.md) |
| A.4, A.5, A.6 bis, A.7, lots 1 à 9, preuves | journal archivé |

Les identifiants de lot cités dans le code renvoient au journal archivé.

Journal archivé dans les notes privées du projet : `spec/outils/optimizer/archive/chantiers/application-bureau.md`
