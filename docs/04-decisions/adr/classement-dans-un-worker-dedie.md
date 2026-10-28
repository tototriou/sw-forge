# Classement des résultats dans un Worker dédié, sur un contexte figé

## Décision

Les builds trouvés par une recherche de runes de l'Optimizer appartiennent
à un **Worker de classement dédié**, distinct de la page, de la recherche
et des Workers qui résolvent l'équipement :

- **il possède les résultats** : les candidats, en colonnes typées pour
  tout ce qui croît avec leur nombre, le cache des équipements résolus, la
  file de vérification et le classement. Il tient le classement **par
  différences** : quand l'équipement d'un build est résolu, seules ses
  lignes sont renotées et replacées, jamais tous les candidats ;
- **il travaille sur un contexte figé au clic « Rechercher »** :
  paramètres de recherche, fiche, inventaires, combat. Seul ce geste lance
  une recherche. Modifier stats, conditions, objectif ou sets, rafraîchir
  la page ou changer de monstre dans la liste prépare la prochaine
  recherche et ne relance rien, ni recherche ni équipement ;
- **la page ne reçoit que ce qu'elle affiche** : l'instantané de sa vue,
  soit vingt cartes au plus, les comptes, la page et les versions ;
- **l'affichage se règle par des filtres et un tri séparés des conditions
  de recherche** : une borne minimum et une borne maximum sur chacune des
  onze colonnes (PV, ATQ, DEF, VIT, Taux Crit, Dmg Crit, RES, Précision,
  Efficience, Dégâts réels, PV effectifs), et un tri par colonne,
  décroissant puis croissant. Un filtre masque, il ne retire rien : le
  relâcher rend les mêmes builds, avec le même équipement, et une borne plus
  large que la recherche n'affiche rien de plus. Ni un tri ni un filtre ne
  résolvent d'équipement ;
- **l'équipement de chaque build (paire d'artéfacts et relique) est résolu
  pour l'objectif de la recherche lancée** ; changer de tri ne le change
  pas. Il n'y a pas de réglage « Adapter les artéfacts et reliques au
  tri » ;
- **l'objectif de recherche Vitesse existe ; le tri par Vitesse est le tri
  par la colonne VIT.**

## Raisons

- **Classer sur la page bloquait l'écran.** Sur une recherche réelle au
  préréglage Moyen (environ 77 000 builds), la page reclassait tous les
  candidats à chaque publication de la file de vérification, alors que
  seuls les builds dont l'équipement venait d'être résolu changeaient de
  note : près d'une minute de classement après une recherche d'une dizaine
  de secondes, et des clics pendant la vérification qui attendaient
  environ 570 ms au 95e centile, jusqu'à une seconde. Le budget d'un clic
  est de 100 ms au 95e centile et 200 ms au plus. Dans le Worker dédié, avec
  le classement par différences, les clics pendant la vérification restent
  sous 80 ms au 95e centile, et le temps total d'une recherche ne se
  dégrade pas (quelques pour cent de moins au préréglage Moyen, égal en
  Extrême).
- **Une publication ne coûte rien de proportionnel au nombre de builds** :
  la page ne reçoit ni ne parcourt les candidats, seulement sa page et ses
  comptes, quel que soit le nombre de builds trouvés.
- **Un résultat est celui de la recherche lancée.** Lus en direct, les
  réglages de recherche changeaient l'affichage d'un résultat déjà trouvé,
  qui ne correspondait plus à la recherche qui l'avait produit. Figés au
  lancement, ils préparent la recherche suivante sans toucher au résultat
  courant.
- **Explorer un résultat ne perd aucun build et ne relance rien** : un
  filtre d'affichage n'est pas une condition de recherche ; il se pose et se
  relâche sans recherche ni vérification nouvelles.
- **Un tri ne doit pas devenir une vérification.** Adapter l'équipement au
  tri affiché remettait en vérification tous les builds vérifiés à chaque
  changement de tri (cache vidé, quelques centaines de résolutions). Pour
  un équipement choisi sur un autre critère, on relance la recherche avec
  cet objectif : elle se compte en secondes.
- **Trier par l'objectif Vitesse et trier par VIT donnent le même ordre** :
  la note de l'objectif Vitesse est la VIT de la fiche, celle de la colonne
  VIT.

## Options écartées

- **Classer et vérifier sur la page** (ancien fonctionnement, remplacé) :
  près d'une minute de classement sur une recherche moyenne, des clics
  jusqu'à une seconde pendant la vérification (voir les raisons).
- **Reclasser tous les candidats à chaque publication** (ancien
  fonctionnement, remplacé) : seuls les builds dont l'équipement change
  changent de note ; le reste du travail est refait pour rien.
- **Des réglages de recherche lus en direct par l'affichage** (ancien
  fonctionnement, remplacé) : changer une condition changeait l'affichage
  d'un résultat qu'elle n'avait pas produit.
- **« Adapter les artéfacts et reliques au tri »** (ancien fonctionnement,
  remplacé) : chaque changement de tri devenait une nouvelle vérification.
- **Un tri par l'objectif Vitesse à côté du tri par VIT** (ancien
  fonctionnement, remplacé) : le même ordre, deux fois.

## Conséquences

- **Trois propriétaires de tâches distincts** : recherche, classement,
  résolution. La page relie la recherche au classeur et le classeur aux
  résolveurs par des canaux transférés une fois ; elle ne relaie ni les
  candidats ni les réponses d'équipement.
- **La page garde ses contrôles, ses brouillons, son rendu et ses gestes** ;
  elle envoie sa vue (tri, sens, mesure, bornes, page) et montre
  l'instantané reçu, après en avoir vérifié les versions. Un geste de vue
  force sa publication dès que son instantané est prêt.
- **Sur un gros résultat, le tri et le changement de page restent un peu
  au-dessus du budget d'un clic** (de l'ordre de 110 à 170 ms au 95e
  centile sur une recherche réelle en Dégâts réels d'environ 60 000
  builds) ; c'est accepté, et
  inscrit en piste ([pistes-optimizer-vitesse.md](../../05-feuille-de-route/pistes-optimizer-vitesse.md)).
- **La perte du classeur interrompt la recherche** : la dernière page reste
  affichée, marquée interrompue, sans tri ni pagination ; rien n'est
  reconstitué ni relancé, seul « Rechercher » crée un nouveau classeur.
- **Le CLI et le harnais classent avec le même corps que le Worker**, sans
  Worker.
- **Une session ou une mémoire de membre qui porte encore « Adapter au
  tri » est relue sans lui**, sans avertissement ; un tri « vitesse »
  enregistré se relit VIT.
- Le propriétaire, le contexte figé et l'instantané :
  [pipeline.md § Propriétaire et contexte du résultat](../../03-developpeur/optimizer/moteur/pipeline.md#propriétaire-et-contexte-du-résultat)
  et [pipeline.md § Résultat affiché](../../03-developpeur/optimizer/moteur/pipeline.md#résultat-affiché) ;
  le magasin compact et le classement par différences :
  [optimiseur-artefacts.md § Classement incrémental](../../03-developpeur/optimizer/moteur/optimiseur-artefacts.md#classement-incrémental) ;
  le tri et les filtres à l'écran :
  [resultats.md § Tri des résultats](../../02-app/optimizer/ecran/resultats.md#tri-des-résultats)
  et [resultats.md § Filtres d'affichage par colonne](../../02-app/optimizer/ecran/resultats.md#filtres-daffichage-par-colonne).
