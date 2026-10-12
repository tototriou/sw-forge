# Documentation — ce qui reste à faire

Ce que la refonte de la documentation (octobre 2026) a laissé ouvert. Une ligne quitte ce registre
quand elle est faite ; ce qu'elle produit vit dans la documentation.

| Chantier | Ce qu'il faut faire | Depuis |
| --- | --- | --- |
| **Revoir les conventions** | Décider quelles règles de [conventions.md](../03-developpeur/conventions.md) on garde. Puis réduire le fichier aux règles, une ou deux phrases chacune ; le pourquoi part en ADR dans [04-decisions/adr/](../04-decisions/adr/README.md) ; le contenu de fonctionnalité recopié (réglages du menu ⚙, pied de page, repli de la barre, import de compte, releases) rejoint sa fiche. Mis de côté le 2026-10-12, à reprendre avec Thomas. | 2026-10-12 |
| **Regrouper les familles de documents** | `moteur-*` et `harnais*` de [03-developpeur/optimizer/](../03-developpeur/optimizer/README.md) en dossiers `moteur` et `harnais` ; les `feat-ecran-*` de [02-app/optimizer/](../02-app/optimizer/README.md) dans un dossier `ecran`, `feat-ecran.md` en devenant le README. Noms courts, renvois repointés. | 2026-10-12 |
| **Liens vers un dossier** | Une centaine de liens visent un dossier, la section dans le libellé (« dossier/ (fichier) § Section ») : les faire viser la partie précise, maintenant que les gros fichiers sont découpés. | 2026-10-12 |
| **Blocs de plus de 100 lignes** | Quatre parties du speed tuning (`feat-chaine-ouverture.md`, `feat-competences.md`, `feat-ecran.md`, `feat-ordre-des-sorts.md`) gardent un bloc de plus de 100 lignes sous un même titre, dont une liste numérotée de 277 lignes : à sous-titrer au prochain chantier speed tuning. | 2026-10-12 |
| **Dette du code** | Ouvrir un registre `dette.md` : le code mort (153 variables inutilisées signalées par ESLint le 2026-10-08), les avertissements ESLint, les mentions « lot N / décision N » et de date dans les commentaires du code, et les points de la revue de `release/v2.0.0` (à relever : ils ne sont pas dans le dépôt). | 2026-10-08 |
| **Notes privées** | Passer en revue les notes privées du projet (49 au 2026-10-08) ; rapatrier dans le dépôt celles que Thomas retient, fichier par fichier, en ADR pour une décision encore en vigueur et citée. | 2026-10-08 |
