# Vue d'ensemble

SW Blacksmith est une boîte à outils pour **Summoners War**. Elle aide à préparer ses contenus
compétitifs : composer ses équipes de siège et vérifier leur speed tuning, classer ses monstres pour
la RTA, analyser ses runes et son compte, chercher le meilleur build d'un monstre, partager des
recommandations de decks avec sa guilde.

En ligne : <https://sw-forge.vercel.app>. La même app existe en **application de bureau** (Windows,
Linux), proposée par la page Télécharger du site.

## Tout reste sur ta machine

Il n'y a **pas de serveur, pas de compte, pas d'authentification**. L'export de compte qu'on
importe est lu **dans la page** : il n'est jamais téléversé. Rien n'est conservé sans accord : un
seul interrupteur décide pour toute l'app, et « Tout supprimer » efface tout. Aucune mesure
d'audience.

## Ce qu'on y trouve

| Page | Ce qu'on y fait | Fiche |
| --- | --- | --- |
| **Accueil** | importer son compte, reprendre là où on s'était arrêté | [accueil/](../02-app/accueil/README.md) |
| **RTA** | classer ses monstres par set en glisser-déposer, saisir les vitesses, lire l'**ordre de tour** recalculé avec les leads ; lire la prépa d'un ami | [rta/](../02-app/rta/README.md) |
| **Siège** | composer des équipes de 3 en défense et en offense, leader et lead déduits de la leader skill, **vérification des ticks** | [siege/](../02-app/siege/README.md) |
| **Recommandations de siège** | un auteur décrit ses decks (monstres, sets, stats, consignes) et les exporte ; les autres les importent et **confrontent leur compte** : monstre manquant, deck à composer, stats qui ne suivent pas | [siege/feat-recommandations/](../02-app/siege/feat-recommandations/README.md) |
| **Mon compte** | la box 6★, les **runes** (efficience ou score SW, optimisation gemme et meule, courbes, comparaison entre amis) et les artéfacts | [compte/](../02-app/compte/README.md) |
| **Optimizer** | chercher, parmi ses runes réelles, la meilleure combinaison pour un monstre, selon un objectif choisi (dont les **dégâts réels** d'un sort) | [optimizer/](../02-app/optimizer/README.md) |
| **Speed tuning** | vérifier qu'une équipe joue avant l'adversaire, tick par tick, et trouver les vitesses qui manquent | [speed-tuning/](../02-app/speed-tuning/README.md) |
| **Bestiaire** | chercher et filtrer tous les monstres | [bestiaire/](../02-app/bestiaire/README.md) |
| **Mécaniques** | l'aide-mémoire des règles de jeu | [mecaniques/](../02-app/mecaniques/README.md) |
| **Nouveautés** | le journal des versions : ce qui change à chaque release | [nouveautes/](../02-app/nouveautes/README.md) |

La liste complète des pages, leurs routes et leur ordre : [02-app/](../02-app/README.md).

## D'où viennent les données

- **Ton compte** : l'export JSON produit par [SW Exporter](https://github.com/Xzandro/sw-exporter).
  La jointure avec les données de monstres se fait sur `com2us_id`. Dans l'application de bureau,
  « Mon compte » peut suivre le dossier de SW Exporter et se mettre à jour à chaque export. Détail :
  [transverse/feat-import-compte/](../02-app/transverse/feat-import-compte/README.md).
- **Les monstres et leurs compétences** : [SWARFARM](https://swarfarm.com), par son API publique
  `/api/v2/`. Elles sont récupérées **hors du navigateur** (Node, donc sans CORS) par
  `scripts/fetch-monsters.mjs` et `scripts/fetch-skills.mjs`, écrites dans `public/data/`, puis
  servies avec le site. Le workflow `.github/workflows/update-data.yml` les rafraîchit chaque
  semaine (ou à la demande) et commite le résultat. Si l'API est indisponible, un jeu de démonstration déterministe
  est généré à la place, et le bandeau de statut le dit clairement : le site reste déployable et
  testable. Détail : [transverse/feat-donnees-monstres.md](../02-app/transverse/feat-donnees-monstres.md).
- **Les icônes** (éléments, runes, stats, artéfacts, leader skills) sont servies en local depuis
  `public/` : aucun lien direct vers les serveurs de SWARFARM.

Données de jeu et images © Com2uS. Projet non officiel, sans affiliation avec Com2uS.

## Pour aller plus loin

- Comment l'app est construite : [02-architecture.md](02-architecture.md).
- Sa technique, ses commandes et ses tests : [03-technique.md](03-technique.md).
