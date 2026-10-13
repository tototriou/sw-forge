# Une documentation qui se suffit, sans outillage maison

## Contexte

Jusqu'à la refonte d'octobre 2026, la documentation tenait par un outillage
maison : un script refusait au commit un document dont la forme n'allait pas
(en-tête `Statut :`, taille des blocs), un autre sortait le sommaire d'un
document pour éviter de le lire en entier, un skill d'agent rappelait les
règles. Les décisions, les cadrages et les notes de
chantier restaient hors du dépôt.

Ces scripts compensaient des documents trop longs et mal routés : on ne
trouvait pas simplement ce qu'on cherchait, et c'étaient des scripts de plus à
maintenir.

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
- **Décisions, cadrages et pilotage vivent dans le dépôt**, qui est public
  (depuis le 2026-10-08). N'en restent dehors qu'un export de compte, des
  données personnelles, des captures d'écran.

## Options écartées

- **Garder l'outillage maison.** Si la documentation est bien faite, elle n'a
  pas besoin de script pour être respectée ; et l'en-tête `Statut :` qu'il
  imposait fait double emploi avec les README, qui portent le routage.
- **Le remplacer par un outil existant.** Même raison : une documentation bien
  rangée s'en passe.
- **Limiter la profondeur des dossiers.** On en crée tant qu'on en a besoin :
  ce sont les README qui guident jusqu'au bon fichier.
- **Un README qui dit à quelle question répond chaque document.** Il dit ce
  qu'on y trouve : c'est ce qui permet de choisir le fichier sans l'ouvrir.
- **Des notes de chantier privées.** Une décision ou un cadrage tenu hors du
  dépôt ne se retrouve pas depuis la documentation.

## Conséquences

- Une règle de forme ne tient que si elle est écrite et relue :
  [documentation.md](../../03-developpeur/documentation.md), et la
  [charte](../../README.md) pour la structure.
- La documentation change dans le même commit que le code qu'elle décrit.
- Ce que l'outillage laisse derrière lui est compté dans la
  [dette](../../05-pilotage/dette.md) : les en-têtes `Statut :` hérités, le
  récit de chantier resté dans les documents.
