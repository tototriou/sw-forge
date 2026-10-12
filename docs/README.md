# Documentation SW Blacksmith

> Statut : **documentation vivante** — mise à jour dans le **même commit** que le code qu'elle
> décrit. La vérité = le code + la documentation vivante + les ADR. Cette page est la **carte** :
> une ligne par section ; chaque section a son propre `README.md`, avec une ligne par document
> (ce qu'on y trouve). Parcours : cette carte → le README de section → le README du dossier → le
> document. Ces règles se tiennent à l'écriture et en relecture, sans outil qui les vérifie ; la
> façon de les appliquer est dans
> [03-developpeur/documentation.md](03-developpeur/documentation.md).

## Sections

| Section | Contenu |
| --- | --- |
| [01-presentation/](01-presentation/README.md) | Vue d'ensemble pour un nouveau venu : ce que fait l'app, son architecture, sa technique — ordre de lecture numéroté |
| [02-app/](02-app/README.md) | Une fiche par page ou outil de l'app, ses fonctionnalités `feat-*.md` ; le dossier `transverse` pour ce qui sert plusieurs pages, `bureau` pour l'application de bureau |
| [03-developpeur/](03-developpeur/README.md) | Travailler sur le dépôt : conventions, qualité du code et hooks, tests, interface (design, librairie UI), deep-dives techniques |
| [04-decisions/](04-decisions/README.md) | Pourquoi c'est comme ça : ADR, cadrages de chantier |
| [05-pilotage/](05-pilotage/README.md) | Registres vivants : dette, questions ouvertes, pistes futures |

## Règles de la documentation

### Nommage et structure

1. **Noms en kebab-case ASCII** — ni espace ni accent dans un nom de dossier ou de fichier : ce
   sont des cibles de liens et des motifs de recherche.
2. **Numéroter seulement là où l'ordre de lecture compte** (les sections, la présentation).
   Ailleurs, des noms stables : une séquence numérotée force des renommages en cascade à chaque
   insertion, donc des liens cassés.
3. **Autant de niveaux qu'il en faut** sous `docs/` : la profondeur n'est pas limitée, parce que
   chaque dossier a son `README.md` qui guide vers le bon fichier (règle 6). Un dossier `assets`
   contient des ressources, pas des documents.
4. **Une page ou un outil de l'app = un dossier avec `README.md`** (sa fiche), même quand une page
   suffirait : passer d'un fichier à un dossier casserait les renvois, et l'uniformité donne un
   motif de découverte unique (`02-app/*/README.md`).
5. **Une fonctionnalité : `feat-<slug>.md`**, dans le dossier de sa page. **Le slug reprend le
   nom du code** quand il existe. Une fonctionnalité qui sert plusieurs pages va dans le dossier
   `transverse` de `02-app`.

### Sommaires et découvrabilité

6. **Un `README.md` par dossier, une ligne par document ou sous-dossier** : ce qu'on y trouve,
   de quoi choisir le bon fichier sans l'ouvrir. On ne compte jamais sur le seul nom de fichier.
   Quand les documents décrivent du code, le README ouvre sur une table **« Le changement
   touche… »** : les fichiers ou les notions qu'on va modifier, et le document à lire avant. Le
   point d'entrée depuis le code est la table du même nom d'[AGENTS.md](../AGENTS.md).
7. **Tout nouveau document entre dans le README de son dossier, dans le même commit.**

### Schémas

8. **Mermaid d'abord, image en dernier recours** : un diagramme Mermaid se relit dans un diff et
   se lit par un agent ; une image est opaque. Une image inévitable s'accompagne d'un résumé
   texte, et vit dans un dossier `assets` de sa section.

### Frontières de contenu

9. **Un contenu ne vit qu'à un seul endroit** ; les autres pointent vers lui.
   `01-presentation` donne la vue d'ensemble et **renvoie** aux fiches ; `04-decisions` porte le
   *pourquoi* et l'historique ; `03-developpeur` les pratiques courantes.
10. **Les registres vivants** (dette, questions ouvertes, pistes) restent dans `05-pilotage` : ils
    n'encombrent pas les parcours de lecture.
11. **Cadrages éphémères** ([04-decisions/cadrages/](04-decisions/cadrages/README.md)) : documents
    de travail d'un chantier (diagnostic, lots, arbitrages ouverts), destinés à disparaître une
    fois leur contenu passé dans la documentation pérenne. Deux règles en découlent : **(a)** un
    cadrage n'est **jamais cité** par un autre document — seul le README de son dossier l'indexe,
    car un lien vers lui mourrait à sa disparition ; **(b)** un cadrage n'est **pas une source de
    vérité** : une décision ou une convention vit dans un ADR ou dans la documentation, jamais
    seulement dans un cadrage.

### Taille

12. **500 lignes au plus par document**, et un bloc sous un titre de 80 lignes visées, 100 au
    plus. Au-delà, le document **devient un dossier à son nom** (`feat-<slug>.md` devient le dossier `feat-<slug>`) : son
    `README.md` garde l'introduction et liste les parties, une par fichier. On segmente autant
    qu'il faut ; ce sont les README qui guident jusqu'au bon fichier. Un découpage ne perd aucune
    règle : la compacité ne passe jamais avant le contenu.

### Conventions de rédaction

- **Français partout** : documentation, commentaires et messages de commit.
- Dates **absolues** (jamais « récemment », « la semaine dernière »).
- **[à valider]** = proposition en attente d'arbitrage ; **[à préciser]** = renvoie à une question
  de [05-pilotage/questions-ouvertes.md](05-pilotage/questions-ouvertes.md).
- Liens internes **relatifs**, vérifiés en CI par `node tests/run.mjs renvois`.
- **Hors du dépôt**, qui est public : un export de compte, des données personnelles, des captures
  d'écran.
