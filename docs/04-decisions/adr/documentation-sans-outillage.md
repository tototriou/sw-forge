# Une documentation qui se suffit, sans outillage maison

## Décision

- **On se dirige par les README.** Chaque dossier a le sien, qui dit en une
  ligne ce qu'on trouve dans chaque document et, quand ils décrivent du code,
  quel document lire selon ce qu'on va toucher (« Le changement touche… »).
  Depuis le code, l'entrée est la table du même nom
  d'[AGENTS.md](../../../AGENTS.md).
- **On segmente autant qu'il faut** : 500 lignes au plus par document ; un
  document trop long devient un dossier, sans limite de profondeur.
- **Aucun outillage maison.** Les règles de forme sont des bonnes pratiques
  écrites, tenues à l'écriture et en relecture. Seuls les liens sont vérifiés,
  par le test des renvois.
- **Lire avant d'écrire.** Avant tout travail, on lit les bonnes pratiques du
  travail à faire et la documentation du code qui va être touché.
- **On décrit ce qui est décidé ou fait**, jamais ce qui se faisait avant :
  l'historique Git garde le texte remplacé.
- **Le dépôt porte ce qui est livré et ce qui permet de le comprendre** :
  code, tests, documentation, décisions structurantes (ADR). L'organisation
  du travail (cadrages, plans de lots, pilotage) reste hors du dépôt, comme
  un export de compte, des données personnelles, des captures d'écran.

## Raisons

- **On doit trouver simplement ce qu'on cherche** : une ligne par document
  suffit à choisir le bon fichier sans l'ouvrir.
- **Une documentation bien faite n'a pas besoin de script pour être
  respectée** : des documents courts et des README qui guident rendent le
  contrôle de forme inutile, et un script est une chose de plus à maintenir.
- **Une décision tenue hors du dépôt ne se retrouve pas** depuis la
  documentation.
- **Un dépôt public dit ce qui est livré, pas comment on l'a construit** :
  un plan de lots ou le récit d'un chantier ne sert pas à comprendre le
  code, et il est périmé dès le chantier fini.

## Options écartées

- **Un outillage maison qui vérifie la forme** (en-tête imposé, taille des
  blocs, sommaires générés) : il compense des documents trop longs et mal
  routés au lieu de les corriger.
- **Un outil existant pour la même vérification** : même raison.
- **Une limite de profondeur des dossiers** : on en crée tant qu'on en a
  besoin, ce sont les README qui guident jusqu'au bon fichier.
- **Un README qui dit à quelle question répond chaque document** : il dit ce
  qu'on y trouve.
- **Des cadrages de chantier dans le dépôt** : ils décrivent l'organisation
  du travail, pas ce qui est livré ; ce qui en reste vrai passe dans la
  documentation ou dans un ADR.

## Conséquences

- Une règle de forme ne tient que si elle est écrite et relue :
  [documentation.md](../../03-developpeur/documentation.md), et la
  [charte](../../README.md) pour la structure.
- La documentation change dans le même commit que le code qu'elle décrit.
- Les écarts connus à ces règles sont comptés dans la
  [dette](../../05-pilotage/dette.md).
