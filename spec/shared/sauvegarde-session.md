# La sauvegarde de session

**Statut :** ÉTAT ACTUEL — le format du fichier de session (`swblacksmith/session`) : ce qu'il contient, comment il se relit et ce qu'il refuse
**Lire si :** on ajoute une clé de stockage, un état `useStickyState` ou un champ à la recette de l'Optimizer ; on touche `src/lib/session.ts`
**Voir aussi :** [import-compte.md](import-compte.md) (le compte stocké), le cadrage [sauvegarde-session.md](../chantiers/sauvegarde-session.md)

Une session est **tout l'état de l'app à un instant donné**, dans un fichier
que l'utilisateur place où il veut et recharge plus tard, comme une
sauvegarde de jeu. Module pur : `src/lib/session.ts` (`composerSession`,
`ecrireSession`, `lireSession`, `nomFichierSession`).

## Ce que contient le fichier

`swblacksmith-session-AAAA-MM-JJ-HHhMM.json` (heure locale), du JSON compact :

| Champ | Contenu |
|-------|---------|
| `format`, `version` | `swblacksmith/session`, `1` |
| `enregistreeLe`, `versionApp` | date ISO de la sauvegarde ; version de l'app (diagnostic, jamais un critère) |
| `stockage` | le travail et les réglages : pour chaque clé de `CLES_SESSION`, la valeur **brute** du stockage local, telle que son hook l'écrit |
| `compte` | le compte importé, tel qu'IndexedDB le garde (`StoredAccount`), ou `null` |
| `outils.memoire` | l'état des outils en mémoire (`useStickyState`) ; `Set` et `Map` marqués `{"$set": […]}` / `{"$map": [[k, v]…]}` |
| `outils.optimizer` | les critères de l'Optimizer, sous la forme de sa recette (`OptimizerRecipe`), ou `null` |

- **`CLES_SESSION`** — le travail : prépa RTA, ses catégories, ses deux
  points de retour (sauvegarde manuelle, import), siège défense et offense,
  recommandations, monstres perso, listes de travail de l'Optimizer ; les
  réglages : thème, score, overcap, adversaire de référence. **Hors
  session**, à dessein : « Garder mes données » (propre à l'appareil) et les
  anciennes clés déjà migrées.
- **`outils.memoire`** : toutes les clés `useStickyState` sauf
  `STICKY_HORS_SESSION` — la barre latérale repliée et l'avertissement
  mobile fermé, propres à l'appareil. Les résultats de l'Optimizer ne sont
  pas sauvegardés : ils se recalculent.
- ⚠️ **Une clé ajoutée au stockage local, ou un état `useStickyState` qui ne
  doit pas voyager, se déclare ici** (`CLES_SESSION`, `STICKY_HORS_SESSION`) :
  sinon la session l'oublie, ou l'emporte à tort.

Mesuré le 2026-10-06 : avec un vrai compte (export SWEX de 7,7 Mo), la
session pèse **2,68 Mo**.

## Relire

⚠️ **Le fichier se lit entier et se valide avant que l'app n'y touche** :
`lireSession` rend une session valide (et ses avertissements), ou une erreur
dite.

- **Refusé, sans rien lu** : un texte qui n'est pas du JSON ou pas un objet ;
  un autre format (un autre export de l'app) ; une version illisible ou
  **plus récente** (« mets-la à jour pour la charger ») ; un stockage qui
  n'est pas un objet ; une valeur qui n'a pas la forme que son hook relit —
  les réglages une valeur permise (`dark`, `score`, `0`/`1`…), le travail du
  JSON.
- **Lu, et dit** : un compte d'un schéma périmé (laissé, « réimporte ton
  export SWEX ») ; une recette de l'Optimizer illisible (ignorée). Le compte
  passe par la même validation qu'à la relecture d'IndexedDB
  (`compteValide`), la recette par `parseOptimizerRecipe`.
- **Ignoré** : un champ ou une clé inconnus — une session d'une version
  suivante qui n'a fait qu'ajouter se relit.
