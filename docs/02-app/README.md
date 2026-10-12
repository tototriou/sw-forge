# L'app

Le **comportement attendu** de chaque page : ce que l'utilisateur voit, ce qu'il peut faire, et
les règles de calcul appliquées. Ces fiches décrivent l'existant ; elles servent de référence
pour faire évoluer l'outil sans casser les comportements établis.

Une fiche par page ou outil (`<page>/README.md`) et ses fonctionnalités (`feat-*.md`), listées
dans la fiche ; le dossier `transverse` pour ce qui sert plusieurs pages, `bureau` pour
l'application de bureau. Les fichiers de code à ouvrir pour changer une page :
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Pages

| Dossier | Route | Statut | Contenu |
| --- | --- | --- | --- |
| [accueil/](accueil/README.md) | `#/` | Live | La page d'entrée : premier import du compte, reprise là où l'habitué s'était arrêté, cartes et ordre des pages |
| [rta/](rta/README.md) | `#/rta`, `#/rta/ami` | Live | La prépa RTA (Ma prépa / Ami) : recherche et import, classement par sets, ordre de tour, catégories, sauvegarde et partage |
| [siege/](siege/README.md) | `#/siege/defense`, `#/siege/offense`, `#/siege/recommandations` | Live | Le siège : composition des équipes de défense et d'offense, vitesse et ticks, lots de decks recommandés |
| [compte/](compte/README.md) | `#/compte`, `#/compte/runes`, `#/compte/artefacts` | Live | Mon compte : box 6★, inventaire des runes et des artéfacts, références de calcul (efficience, score) |
| [outils/](outils/README.md) | `#/outils` | Live | La page Outils : navigation entre les outils, garde d'accès aux données de compte, briques de calcul partagées |
| [optimizer/](optimizer/README.md) | `#/outils/optimizer` | Live | L'Optimizer : écran carte par carte, listes de travail et équipes, import d'équipes, exclusion, interruption, limites connues |
| [speed-tuning/](speed-tuning/README.md) | `#/outils/speed-tuning` | Live | Le speed tuning : formule ATB, chaîne d'ouverture, écran, export vers l'Optimizer, inventaire des passifs de vitesse |
| [degats-reels/](degats-reels/README.md) | objectif « Dégâts réels » de l'Optimizer | Live | Le modèle de calcul des dégâts réels : formules, artéfacts, bombes, séquences de coups, passifs, effets d'équipe, conditions |
| [arene/](arene/README.md) | `#/arene` | À venir | La page Arène, aujourd'hui un placeholder |
| [bestiaire/](bestiaire/README.md) | `#/bestiary` | Live | Le catalogue de tous les monstres |
| [mecaniques/](mecaniques/README.md) | `#/mecaniques` | Live | La page de documentation des mécaniques de jeu : contenu statique et sommaire |
| [nouveautes/](nouveautes/README.md) | `#/releases` | Live | Le journal des versions destiné aux joueurs |
| [telecharger/](telecharger/README.md) | `#/telecharger` | Live, site seulement | La page du site qui propose l'application de bureau |

## Hors pages

| Dossier | Contenu |
| --- | --- |
| [transverse/](transverse/README.md) | Ce qui sert plusieurs pages : modèle de vitesse, données monstres, import de compte, navigation, recherche au clavier, sauvegarde de session |
| [bureau/](bureau/README.md) | L'application de bureau (Electron, Windows et Linux) : ce qui diffère du site, fenêtre, installeur, publication, mise à jour, vérification |

Points d'entrée de l'Optimizer, avant un chantier qui le touche :

- [03-developpeur/optimizer/invariants.md](../03-developpeur/optimizer/invariants.md) — les
  contraintes critiques, chacune avec sa source ; se lit en entier.
- [optimizer/routage-par-tache.md](optimizer/routage-par-tache.md) — routage par tâche : quelle
  spec lire selon ce qu'on touche.

## Ordre des pages

Ordre d'importance (nav & cartes d'accueil) : **Accueil → RTA → Siège → Mon
compte → Outils → Arène**. Arène se positionne dans la barre entre le
dropdown Outils et le dropdown Ressources — pas dans le groupe des onglets
directs (Accueil/RTA/Siège), pour ne pas allonger cette rangée-là. Bestiaire,
Mécaniques, Nouveautés et Télécharger sont regroupés sous « Ressources » (les
moins centraux de l'outil) ; Télécharger n'existe que sur le site (application
de bureau, décision 14).

> ⚠️ **Règle permanente** : toute page ou section **ajoutée, renommée ou
> supprimée** doit être répercutée sur **l'accueil** ([accueil/](accueil/README.md) —
> carte + ordre) **et** dans la nav de [App.tsx](../../src/App.tsx), **dans le même
> commit** que la fonctionnalité, et dans ce README.
