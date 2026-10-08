# Documentation SW Blacksmith

> Statut : **documentation vivante** — mise à jour dans le **même commit** que le code qu'elle
> décrit. La vérité = le code + la documentation vivante + les ADR. Cette page est la **carte** :
> une ligne par section ; chaque section a son propre `README.md`, avec une ligne par document
> (« quelle question ce fichier répond-il »). Parcours : cette carte → le README de section → le
> document.

## Sections

| Section | Contenu |
| --- | --- |
| [01-presentation/](01-presentation/README.md) | Vue d'ensemble pour un nouveau venu : ce que fait l'app, son architecture, sa technique — ordre de lecture numéroté |
| [02-app/](02-app/README.md) | Une fiche par page ou outil de l'app, ses fonctionnalités `feat-*.md` ; le dossier `transverse` pour ce qui sert plusieurs pages, `bureau` pour l'application de bureau |
| [03-developpeur/](03-developpeur/README.md) | Travailler sur le dépôt : conventions, qualité du code et hooks, tests, interface (design, librairie UI), deep-dives techniques |
| [04-conformite/](04-conformite/README.md) | Données et confidentialité : tout reste local, consentement à la conservation, licence et droits du jeu |
| [05-decisions/](05-decisions/README.md) | Pourquoi c'est comme ça : ADR, cadrages de chantier |
| [06-exploitation/](06-exploitation/README.md) | Publier et faire tourner : site, application de bureau, données SWARFARM, CI |
| [07-pilotage/](07-pilotage/README.md) | Registres vivants : dette, questions ouvertes, pistes futures |

## Règles de la documentation

### Nommage et structure

1. **Noms en kebab-case ASCII** — ni espace ni accent dans un nom de dossier ou de fichier : ce
   sont des cibles de liens et des motifs de recherche.
2. **Numéroter seulement là où l'ordre de lecture compte** (les sections, la présentation).
   Ailleurs, des noms stables : une séquence numérotée force des renommages en cascade à chaque
   insertion, donc des liens cassés.
3. **Trois niveaux au plus** sous `docs/` (`docs/<section>/<dossier>/<fichier>.md`) ; un dossier
   `assets` ne compte pas, ce sont des ressources.
4. **Une page ou un outil de l'app = un dossier avec `README.md`** (sa fiche), même quand une page
   suffirait : passer d'un fichier à un dossier casserait les renvois, et l'uniformité donne un
   motif de découverte unique (`02-app/*/README.md`).
5. **Une fonctionnalité : `feat-<slug>.md`**, à plat dans le dossier de sa page — pas de
   quatrième niveau. **Le slug reprend le nom du code** quand il existe. Une fonctionnalité qui
   sert plusieurs pages va dans le dossier `transverse` de `02-app`.

### Sommaires et découvrabilité

6. **Un `README.md` par dossier, une ligne par document** : la question à laquelle il répond.
   On ne compte jamais sur le seul nom de fichier.
7. **Tout nouveau document entre dans le README de son dossier, dans le même commit.**

### Schémas

8. **Mermaid d'abord, image en dernier recours** : un diagramme Mermaid se relit dans un diff et
   se lit par un agent ; une image est opaque. Une image inévitable s'accompagne d'un résumé
   texte, et vit dans un dossier `assets` de sa section.

### Frontières de contenu

9. **Un contenu ne vit qu'à un seul endroit** ; les autres pointent vers lui.
   `01-presentation` donne la vue d'ensemble et **renvoie** aux fiches ; `05-decisions` porte le
   *pourquoi* et l'historique ; `03-developpeur` les pratiques courantes.
10. **Les registres vivants** (dette, questions ouvertes, pistes) restent dans `07-pilotage` : ils
    n'encombrent pas les parcours de lecture.
11. **Cadrages éphémères** ([05-decisions/cadrages/](05-decisions/cadrages/README.md)) : documents
    de travail d'un chantier (diagnostic, lots, arbitrages ouverts), destinés à disparaître une
    fois leur contenu passé dans la documentation pérenne. Deux règles en découlent : **(a)** un
    cadrage n'est **jamais cité** par un autre document — seul le README de son dossier l'indexe,
    car un lien vers lui mourrait à sa disparition ; **(b)** un cadrage n'est **pas une source de
    vérité** : une décision ou une convention vit dans un ADR ou dans la documentation, jamais
    seulement dans un cadrage.

### Conventions de rédaction

- **Français partout** : documentation, commentaires et messages de commit.
- Dates **absolues** (jamais « récemment », « la semaine dernière »).
- **[à valider]** = proposition en attente d'arbitrage ; **[à préciser]** = renvoie à une question
  de [07-pilotage/questions-ouvertes.md](07-pilotage/questions-ouvertes.md).
- Liens internes **relatifs**, vérifiés en CI par `node tests/run.mjs renvois`.
- **Hors du dépôt**, qui est public : un export de compte, des données personnelles, des captures
  d'écran.
