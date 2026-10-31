# Les traductions par dictionnaires typés

## Décision

- **L'interface existe en plusieurs langues** — français et anglais — et chaque texte affiché vient
  d'un **dictionnaire par langue**, écrit en TypeScript dans `src/i18n/`. Le français est la
  langue **source** : la forme de `fr.ts` fait le type `Dictionnaire`, que chaque autre langue
  doit remplir exactement.
- **Aucune bibliothèque de traduction.** Un composant lit ses textes par `useTraduction()`, un
  texte qui dépend d'une valeur est une fonction du dictionnaire (`exportDu(date)`), un nombre ou
  une date passe par `src/i18n/format.ts`, qui reçoit la langue.
- **Au premier lancement, la langue du navigateur** : la première de ses langues préférées que
  l'app sait afficher, sinon l'anglais. Le réglage « Langue » a trois choix, « Auto », « Français »
  et « English », chaque langue étant nommée dans sa propre langue.
- **`src/lib/` ne fabrique pas de texte affiché** : il rend des codes et des valeurs, que le
  composant met en mots. Une fonction qui compose vraiment une phrase reçoit les textes en
  paramètre.
- **Le vocabulaire du jeu est celui du jeu, dans chaque langue** : sets, stats, effets, éléments et
  autres termes affichés reprennent le libellé officiel du client du jeu dans la langue choisie,
  jamais une traduction faite par l'app. Les noms de monstres et les compétences (nom,
  description, améliorations) sont ceux de SWARFARM, qui ne les publie qu'en anglais : ils restent
  en anglais dans toutes les langues.
- **Restent en français** : la documentation, les commentaires et les messages de commit.

## Raisons

- **`tsc` vérifie qu'aucune langue n'oublie un texte.** Une clé qui manque, une clé de trop ou un
  paramètre de type différent ne compilent pas ; la vérification ne demande ni outil ni étape de
  build en plus.
- **Aucune dépendance de plus.** En dehors de React, la pile n'a que trois dépendances à
  l'exécution ; une traduction
  par objets TypeScript ne demande ni chargement de catalogues, ni configuration, ni plugin.
- **La langue du navigateur au premier lancement** : quelqu'un qui ne lit pas le français doit
  pouvoir trouver le réglage, donc arriver dans une langue qu'il lit.
- **« Auto » reste un choix explicite**, comme pour le thème : un binaire figerait la langue de
  quelqu'un qui n'a rien choisi.
- **Le calcul reste testable sans langue** : une fonction de `src/lib/` qui rend un code se teste
  une fois, quel que soit le nombre de langues.
- **Un terme du jeu traduit par l'app ne serait reconnu par personne** : un joueur cherche dans
  l'app le mot qu'il lit en jeu, et le français officiel n'est pas devinable (« Fatale »,
  « Violente », au féminin de « rune »).

## Options écartées

- **`react-i18next`** (possibilité écartée) : deux dépendances, et des clés écrites en chaînes
  (`t('import.bouton')`), que `tsc` ne vérifie qu'avec une configuration de plus.
- **Lingui** (possibilité écartée) : les textes restent en clair dans le code, mais une étape de
  build les extrait en catalogues ; une dépendance et un plugin Vite de plus.
- **Toujours le français au premier lancement** (possibilité écartée) : un joueur anglophone
  arriverait dans une interface qu'il ne lit pas pour chercher le réglage qui la change.
- **Traduire nous-mêmes les termes du jeu ou les compétences** (possibilité écartée) : une
  traduction de l'app ne correspond pas au client du jeu ; et aucune source publique ne donne les
  compétences dans une autre langue que l'anglais.

## Conséquences

- Un texte nouveau s'écrit dans `fr.ts` **et** dans `en.ts`, dans le même commit
  ([définition de fini](../../03-developpeur/definition-de-fini.md)).
- La règle ESLint locale `swblacksmith/texte-en-dur` refuse un texte écrit en dur dans les
  fichiers traduits ; leur liste (`FICHIERS_TRADUITS`, `eslint.config.js`) grandit écran par
  écran jusqu'à couvrir `src/` ([qualite-code.md](../../03-developpeur/qualite-code.md)).
- Le rendu serveur des tests n'a pas de navigateur : « Auto » y donne le français, et les tests
  existants se lisent en français ; un test qui vérifie l'anglais choisit la langue, puis revient à
  « Auto ».
- La clé `swblacksmith-langue-v1` est une clé de réglage, conservée sans accord de conservation
  et reprise par la session.
- Le fonctionnement, l'enveloppe traduite et la règle du premier lancement :
  [feat-langues.md](../../02-app/transverse/feat-langues.md).
