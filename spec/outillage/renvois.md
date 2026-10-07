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

- **Lien Markdown relatif**, dans le Markdown et dans les commentaires du
  code, quelle que soit la forme de sa destination : seuls en sont exclus un
  schéma (`https:`, `mailto:`…), une URL qui commence par `//`, une ancre
  seule et une destination vide, titre seul compris. Destination entre
  chevrons (espaces admis), titre entre guillemets, apostrophes ou
  parenthèses. Une destination nue qui contient `(` n'est pas vérifiée ;
  entre chevrons, elle est résolue. La définition de lien par référence
  n'est relevée que dans le Markdown. Un lien écrit en code en ligne (entre
  backticks), dans le Markdown comme dans un commentaire, ou dans un bloc de
  code clôturé par trois backticks ou trois tildes, est un exemple : il n'est
  pas relevé comme lien. Non reconnus : un libellé à crochets imbriqués, une
  destination sur plusieurs lignes, une définition de lien dont la cible est
  à la ligne suivante.
- **Chemin entre backticks**, dans le Markdown et les commentaires : le texte,
  sans `#ancre`, `?requête` ni `:ligne`, sans espace, qui contient `/` et qui
  a la forme d'un chemin (extension connue, `/` final, racine du dépôt ou
  `../` en tête). Une version (`release/x.y.z`), une adresse (`/api/v2/`) ou
  un nom d'hôte n'en sont pas. Ce contrôle vaut aussi dans un bloc de code.
- **Chemin nu** qui commence par `spec/`, `src/`, `scripts/`, `tests/`,
  `.claude/` ou `.agents/`, partout : texte, commentaires et chaînes.
- **Forme relative `../`**, dans le Markdown et les commentaires seulement.
- **Nom seul d'une note** de l'Optimizer qui n'a pas d'homonyme suivi
  (`pistes.md` sans chemin, par exemple), dans `src/`, `scripts/`, `tests/`
  et `.claude/`. Un nom quitte le contrôle dès qu'un fichier suivi le porte.

Jamais un spécificateur de module (`import`, `export … from`, `import()`,
`require()`, `vi.mock()`), hors des commentaires : `tsc` les vérifie. Un
import éclaté sur deux lignes n'est pas reconnu. Un chemin se lit entier :
lettres, marques combinantes, chiffres, `_ . - / @ +`. Une ligne de commentaire qui
finit par `/` ou `-` n'est recollée à la suivante que si le recollage résout ;
sinon elle est prise seule.

## Résolution

Le chemin perd d'abord `#ancre`, `?requête` et `:ligne`, puis la ponctuation
finale qui suit un caractère de nom ; `.` et `..` restent des composants. Il
est normalisé puis cherché depuis trois bases, dans l'ordre de
`scripts/spec-lint.mjs` : le dossier du fichier, la racine, `spec/`. Le
premier candidat qui existe gagne : un fichier de `git ls-files`, ou un
dossier qui contient des fichiers suivis (la racine en est un). L'existence
ne se juge jamais sur le disque : un fichier ignoré présent localement, ou
hors du dépôt, ne résout pas. Si le candidat gagnant est un dossier dans le
dossier de l'Optimizer sous `spec/outils/`, le renvoi est mort, même si une
base suivante résoudrait : il doit nommer un fichier publié. Un chemin qui
contient encore `<`, `*`, `{` ou `$` est un modèle : il n'est pas vérifié.

Un fichier suivi illisible fait échouer le test. Sans `.git` (fichier ou
dossier) à la racine, le test est ignoré ; sinon, toute erreur de Git le fait
échouer.

## Exemptions

Écrites dans le test, chacune vérifiée :

- **Cibles volontairement non suivies** (`.claude/settings.json`, réglages et
  agents locaux de `.claude/`, captures du driver, `.history/`, `.vscode/`,
  `node_modules/`, `dist/`, `.git/`) : le test vérifie qu'aucune n'est
  suivie, et que Git ignore chacune, sauf `.git/`, le dossier de Git
  lui-même. Une cible exemptée comme fichier n'exempte pas ce qui est
  écrit sous son nom.
- **Fichiers dont les renvois ne sont pas contrôlés** : les garde-fous qui
  citent un chemin privé à dessein (`.githooks/pre-commit`, sa liste des
  fichiers publiés, `.gitignore`, `scripts/installer-hooks.mjs`, leurs tests,
  ce test et sa liste) et les tests qui montent des arborescences jetables
  aux chemins factices. Le test vérifie que chacun est suivi.

## Liste tolérée

`tests/fixtures/renvois-toleres.json` : une entrée par fichier et par renvoi,
avec le nombre exact d'occurrences et un propriétaire.

- `a-publier` : renvoi vers les notes de l'Optimizer (une note, ou leur
  dossier), pas encore publiées ; l'entrée disparaît à la publication, ou
  quand le renvoi est corrigé. Une mention du dossier lui-même ne disparaît
  pas à la publication : elle se remplace par le fichier publié qu'elle
  vise, puis l'entrée se retire.
- `a-corriger` : renvoi mort déjà pris en charge, à corriger.
- `refonte` : renvoi qui appartient aux chantiers de refonte graphique et de
  rebranding ; on n'y touche pas.
- `hors-perimetre` : renvoi mort connu, sans correction prévue ; qui touche
  le fichier le corrige et retire l'entrée.

Le test échoue sur un renvoi mort absent de la liste, ou plus fréquent
qu'elle ne le dit, et sur une entrée qui ne fait plus échouer : le commit qui
corrige un renvoi, ou qui publie la note qu'il vise, retire ou décompte
l'entrée. Une entrée nouvelle n'est admise qu'en `a-publier`, quand le README
de routage de l'Optimizer annonce sa cible, ou en `refonte` et
`hors-perimetre` à la fusion d'une autre branche ; jamais en `a-corriger`.
Les règles d'admission se vérifient en revue ; le test ne les contrôle pas.
