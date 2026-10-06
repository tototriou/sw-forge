# Garde-fou des renvois

**Statut :** ÉTAT ACTUEL — décrit le test qui refuse un renvoi mort dans un fichier suivi : formes relevées, résolution, exemptions et liste tolérée
**Lire si :** un test `renvois` échoue ; on déplace, renomme ou supprime un fichier cité ailleurs ; on publie ou retire une note de l'Optimizer ; on modifie `tests/renvois.test.ts` ou `tests/fixtures/renvois-toleres.json`
**Voir aussi :** `spec/outillage/spec.md` (natures des specs, `spec-lint`)

Un texte suivi ne renvoie qu'à ce que le dépôt contient : ni aux notes privées
de l'Optimizer, ni à un fichier déplacé ou supprimé. Le test
`tests/renvois.test.ts` (`node tests/run.mjs renvois`) le vérifie sur chaque
fichier texte suivi, hors des fiches des chantiers de refonte graphique et de
rebranding, qui ne sont pas lues.

## Formes relevées

- **Lien Markdown relatif**, définition de lien par référence comprise, dans
  le Markdown et dans les commentaires du code.
- **Chemin entre backticks**, dans le Markdown et les commentaires : un texte
  sans espace qui contient `/` et qui a la forme d'un chemin (extension
  connue, `/` final, racine du dépôt ou `../` en tête). Une version
  (`release/x.y.z`), une adresse (`/api/v2/`) ou un nom d'hôte n'en sont pas.
- **Chemin nu** qui commence par `spec/`, `src/`, `scripts/`, `tests/`,
  `.claude/` ou `.agents/`, partout : texte, commentaires et chaînes.
- **Forme relative `../`**, dans le Markdown et les commentaires seulement.
- **Nom seul d'une note** de l'Optimizer qui n'a pas d'homonyme suivi
  (`pistes.md` sans chemin, par exemple), dans `src/`, `scripts/`, `tests/`
  et `.claude/`. Un nom quitte le contrôle dès qu'un fichier suivi le porte.

Jamais un spécificateur de module (`import`, `export … from`, `import()`,
`require()`, `vi.mock()`) : `tsc` les vérifie. Une ligne de commentaire qui
finit par `/` ou `-` n'est recollée à la suivante que si le recollage résout ;
sinon elle est prise seule.

## Résolution

Le chemin, sans `:ligne`, `#ancre` ni ponctuation finale, est normalisé puis
cherché depuis trois bases, comme `scripts/spec-lint.mjs` : le dossier du
fichier, la racine, `spec/`. Il résout s'il désigne un fichier de
`git ls-files`, jamais par existence sur le disque : un fichier ignoré présent
localement, ou hors du dépôt, ne résout pas. Un dossier résout s'il contient
des fichiers suivis, sauf dans le dossier de l'Optimizer sous `spec/outils/`,
où un renvoi doit nommer un fichier publié. Un chemin qui contient `<`, `*`,
`{` ou `$` est un modèle : il n'est pas vérifié.

## Exemptions

Écrites dans le test, chacune vérifiée :

- **Cibles volontairement non suivies** (`.claude/settings.json`, réglages et
  agents locaux de `.claude/`, captures du driver, `.history/`, `.vscode/`,
  `node_modules/`, `dist/`, `.git/`) : le test vérifie que Git ignore chacune.
- **Fichiers dont les renvois ne sont pas contrôlés** : les garde-fous qui
  citent un chemin privé à dessein (`.githooks/pre-commit`, sa liste des
  fichiers publiés, `.gitignore`, `scripts/installer-hooks.mjs`, leurs tests,
  ce test et sa liste) et les tests qui montent des arborescences jetables
  aux chemins factices. Le test vérifie que chacun est suivi.

## Liste tolérée

`tests/fixtures/renvois-toleres.json` : une entrée par fichier et par renvoi,
avec le nombre exact d'occurrences et un propriétaire.

- `a-publier` : renvoi vers une note de l'Optimizer pas encore publiée ;
  l'entrée disparaît à sa publication, ou quand le renvoi est corrigé.
- `a-corriger` : renvoi mort déjà pris en charge, à corriger.
- `thomas` : renvoi qui appartient aux chantiers de refonte graphique et de
  rebranding ; on n'y touche pas.
- `hors-perimetre` : renvoi mort connu, sans correction prévue ; qui touche
  le fichier le corrige et retire l'entrée.

Le test échoue sur un renvoi mort absent de la liste, ou plus fréquent
qu'elle ne le dit, et sur une entrée qui ne fait plus échouer : le commit qui
corrige un renvoi, ou qui publie la note qu'il vise, retire ou décompte
l'entrée. Une entrée nouvelle n'est admise qu'en `a-publier`, quand le README
de routage de l'Optimizer annonce sa cible, ou en `thomas` et
`hors-perimetre` à la fusion d'une autre branche ; jamais en `a-corriger`.
