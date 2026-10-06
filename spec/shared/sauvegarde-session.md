# La sauvegarde de session

**Statut :** ÉTAT ACTUEL — « Sauvegarder la session » : où, ce que contient le fichier, son format et sa relecture
**Lire si :** on touche la ligne « Session » des Paramètres, l'action de la palette, `src/lib/session.ts`, `src/lib/sessionOptimizer.ts`, ou ce qu'un écran retient d'une page à l'autre
**Voir aussi :** [import-compte.md](import-compte.md) (le compte importé), [../outils/optimizer/ecran/equipement-actuel.md](../outils/optimizer/ecran/equipement-actuel.md) (l'exemplaire)

Une session est l'état de l'app à un instant donné, dans un fichier que
l'utilisateur garde où il veut : de quoi reprendre plus tard là où il
s'était arrêté.

## Sauvegarder

- **Paramètres**, bloc « Mes données » (`SettingsList`,
  `src/components/SettingsMenu.tsx`) : une ligne « **Session** » et son
  bouton « **Sauvegarder** », juste avant « Tout supprimer », qui reste la
  dernière ligne du bloc. Texte d'aide sur le site : « Tout l'état de l'app
  dans un fichier, à garder où tu veux : le compte, ton travail, les
  réglages et l'état des outils. » ; dans l'application de bureau,
  « enregistré où tu veux » au lieu de « à garder où tu veux ».
- **Palette Ctrl K** : l'action « **Sauvegarder la session** », sous-titrée
  « Tout l'état de l'app dans un fichier ».
- Les deux appellent `sauvegarderSession` (`src/App.tsx`), qui compose la
  session, l'écrit et la télécharge (`telechargerTexte`,
  `src/lib/telechargement.ts`). Sur le site, le navigateur l'enregistre ;
  dans l'application de bureau, la boîte « Enregistrer le fichier » s'ouvre
  dans le dossier Téléchargements (`bureau/navigation.ts`).
- Nom : `swblacksmith-session-AAAA-MM-JJ-HHhMM.json`, à l'heure locale du
  clic (`nomFichierSession`). Environ 2,7 Mo avec un vrai compte.

## Ce que contient le fichier

**Ce que l'app garde quand on passe d'une page à l'autre, tel qu'il est au
moment du clic**, que « Garder mes données » soit activé ou refusé. Du JSON
compact (`composerSession`, `ecrireSession`, `src/lib/session.ts`) :

| Champ | Contenu | Lu dans l'app par |
|-------|---------|-------------------|
| `format`, `version` | `swblacksmith/session`, `1` | — |
| `enregistreeLe`, `versionApp` | date ISO du clic ; version de l'app | — |
| `stockage` | clé → valeur brute, pour les clés de `CLES_SESSION` : prépa RTA, ses catégories, ses deux points de retour ; siège défense et offense ; recommandations ; monstres perso ; listes de l'Optimizer ; thème, score, overcap, adversaire de référence | `lireTravail` (`usePersistence.ts`) : la dernière valeur écrite par `saveLocal`, gardée en mémoire même conservation refusée (`saveLocal` n'écrit alors rien sur le disque), sinon le stockage local ; `oublierLocal` efface les deux |
| `compte` | le compte importé (`StoredAccount`, schéma 7), ou `null` | le compte en mémoire de `App.tsx`, pas IndexedDB |
| `outils.memoire` | clé → valeur de chaque `useStickyState`, sauf `STICKY_HORS_SESSION` (`sidebar.retractee`, `mobileNotice.ferme`) | `photographierMemoire` (`useStickyState.ts`) |
| `outils.optimizer` | les champs `CHAMPS_OPTIMIZER_SESSION` de `useOptimizerState` : monstre choisi et son exemplaire, set, conditions min/max, principales imposées, runes imposées, sous-propriétés verrouillées, artéfacts, relique, objectif et réglages de combat, exclusions, réglages avancés, tri | `photoOptimizer` (`sessionOptimizer.ts`) |

- `Set` et `Map` s'écrivent `{"$set": […]}` et `{"$map": [[clé, valeur]…]}`,
  à toute profondeur (`encoder`, `decoder`).
- Chaque champ de données d'`OptimizerState` est classé dans
  `CHAMPS_OPTIMIZER_SESSION` ou `CHAMPS_OPTIMIZER_HORS_SESSION` (interface,
  état passager, recherche et résultats) ; `tsc` échoue sur un champ non
  classé, un champ classé disparu, ou un champ de la session sans `set…`.
- **Pas dans le fichier** : la page affichée ; « Garder mes données » ; la
  barre latérale repliée et l'avertissement mobile fermé ; les résultats de
  l'Optimizer ; ce qu'un écran oublie déjà en changeant de page.
- Une clé de stockage ou un état `useStickyState` ajoutés entrent dans
  `CLES_SESSION`, ou dans `STICKY_HORS_SESSION` s'ils ne doivent pas
  voyager.

## Relire

`lireSession(texte)` lit et valide le fichier entier, et rend une session
avec ses avertissements, ou une erreur.

- **Refusé** : un texte qui n'est pas du JSON ou pas un objet ; un autre
  format ; une version qui n'est pas un entier ≥ 1, ou plus récente que
  `VERSION_SESSION` (« mets-la à jour pour la charger ») ; un `stockage`
  qui n'est pas un objet ; une valeur de stockage qui n'est pas un texte de
  la forme que son hook relit (`valeurStockageValide` : thème `auto`,
  `light`, `dark` ; score `eff`, `score` ; overcap et adversaire `0`, `1` ;
  le reste du JSON).
- **Lu, avec un avertissement** : un compte qui ne passe pas `compteValide`
  (schéma périmé) devient `null` ; un `outils.optimizer` qui n'est pas un
  objet devient `null`.
- **Ignoré** : un champ inconnu ; une clé de stockage hors `CLES_SESSION` ;
  une clé de mémoire de `STICKY_HORS_SESSION` ; dans l'Optimizer, un champ
  hors `CHAMPS_OPTIMIZER_SESSION`.

Le chargement d'une session dans l'app n'existe pas encore.

## Vérifier

```
node tests/run.mjs session persistance optimizerexemplairemontage renduparametres rendubureautextes
npm run bureau:preuve -- --session     # l'app, conservation refusée (après vite build et bureau:construire)
node scripts/preuve-session-site.mjs   # le site, conservation acceptée, exemplaire compris (après npm run build)
```

Tests unitaires : le format (aller-retour, refus, avertissements, compte
réel), `compteDeSession`, la photo de l'Optimizer, le miroir de
`saveLocal`, `exemplaireAuMontage`. Tests de rendu : la ligne « Session »
et ses deux textes. Les deux preuves de bout en bout relisent chaque fichier
téléchargé par `lireSession`, sans capture d'écran.
