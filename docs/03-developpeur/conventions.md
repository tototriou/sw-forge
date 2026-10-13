# Conventions communes

Les règles qui valent pour toutes les pages : la règle de cadre et les conventions communes. La
carte des pages et leur ordre sont dans [02-app/](../02-app/README.md) ; les fonctionnalités
partagées, dont la navigation et le pied de page, dans
[02-app/transverse/](../02-app/transverse/README.md) ; l'interface dans
[interface/](interface/README.md).

## Règle de cadre

> ⚠️ **Une application responsive, mais DEUX plateformes de premier rang** :
> téléphone et ordinateur, dont aucune n'est le cas dégradé de l'autre. On ne
> dessine pas pour le bureau avant de rétrécir. **Une correction destinée à un
> format ne touche pas l'autre.** Cette règle prime sur tout arbitrage
> d'interface : lire [interface/](interface/)
> **avant** de modifier un écran.

## Conventions communes (toutes les pages)

- **Un texte saisi est trimé à la sortie du champ** (`onBlur`), jamais à la
  frappe ; les espaces intérieurs sont conservés. Détail :
  [composants.md](interface/librairie-ui/composants.md), « `Champ` ».
- **Un champ numérique est un `NumberField`**, jamais un `type="number"` ;
  `min` et `max` ne s'appliquent qu'à la sortie du champ. Détail :
  [composants.md](interface/librairie-ui/composants.md), « `NumberField` ».
- **Persistance : un seul interrupteur pour toute l'app**
  ([usePersistence.ts](src/hooks/usePersistence.ts)). Rien n'est conservé sans
  l'accord de l'utilisateur : une donnée s'écrit par `saveLocal`, jamais par
  `localStorage.setItem`, sous une clé préfixée `swblacksmith-`. Détail :
  [persistance.md](../02-app/transverse/feat-import-compte/persistance.md).
- **Aucune mesure d'audience**, sur le site comme dans l'application de
  bureau : « 100 % local » veut dire que rien ne quitte le navigateur. ⚠️ Ne
  pas en réintroduire sans décision.
- **Fenêtres modales** : aucun `confirm()` ni `prompt()` du navigateur, et le
  défaut d'une confirmation ne perd jamais rien. Détail :
  [modales-et-panneaux.md](interface/librairie-ui/modales-et-panneaux.md).
- **Glisser-déposer : toujours un repli au doigt.** Le glisser natif ne
  fonctionne pas au tactile : chaque zone de glisser-déposer propose un
  **sélecteur** qui fait le même geste (changer une carte de section en RTA,
  changer un monstre de position au Siège).
