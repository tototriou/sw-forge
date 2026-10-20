# Préréglages emboîtés

## Décision

Les quatre préréglages de pré-filtrage de l'Optimizer sont **emboîtés** :
Bas ⊆ Moyen ⊆ Haut ⊆ Extrême. Une recherche complète à un préréglage trouve
au moins les builds valides de chaque préréglage plus étroit.

Le moteur l'obtient par une **union des rétentions** : pendant la
construction des moitiés de build, chaque moitié garde ce que retient le
préréglage de la recherche, plus, compartiment par compartiment, ce que
retient chaque préréglage plus étroit, construit avec ses propres
paramètres (son pool par emplacement, son `bucketCap`, ses bornes de sets).
Aucun `bucketCap` n'est agrandi. La chaîne part de Bas : Moyen, le défaut,
contient Bas.

## Raisons

- **Un préréglage plus large perdait des builds d'un plus étroit.** Son
  pool par emplacement est plus grand, si bien que bien plus de demi-builds
  se disputent des places de rétention qui grandissent moins vite (de Moyen
  à Extrême, environ 50 fois plus de triplets pour 3,75 fois plus de
  places) : des demi-builds que le préréglage plus étroit gardait étaient
  évincés. Mesuré sur deux recherches réelles lourdes, recherches complètes :
  jusqu'à 1 017 builds valides de Moyen absents de Haut, et 1 051 builds
  valides de Bas absents de Moyen. Choisir un préréglage plus large pour
  « chercher plus » pouvait donc faire perdre un build déjà trouvé.
- **L'union le garantit, à coût borné.** Le pool d'un préréglage plus
  étroit est inclus dans celui d'un plus large, emplacement par emplacement,
  et chacun de ses demi-builds est une combinaison que le préréglage plus
  large énumère déjà : l'union ne change ni les compartiments, ni leurs
  bornes, ni leur ordre ; elle ajoute des demi-builds, donc des paires,
  jamais n'en retire. Sur les recherches mesurées, quelques pour cent de
  paires en plus (de 0,7 à 5,6 %) et des préréglages plus étroits bien moins
  coûteux à construire que celui de la recherche.

## Options écartées

- **Construire chaque préréglage seul** (ancien fonctionnement, remplacé) :
  un préréglage plus large ne contenait pas les builds d'un plus étroit
  (voir les raisons).
- **Agrandir `bucketCap` seul** (possibilité écartée) : plus de places ne
  garantit pas qu'un demi-build retenu par un préréglage plus étroit
  survive à la concurrence d'un pool plus grand ; aucune inclusion n'en
  découle.
- **Supprimer le réglage et toujours chercher au plus large, sans
  rétention bornée** (possibilité écartée) : la mémoire ne le permet pas sur
  un gros compte (plus de 12 Go pour une recherche lourde à 32 fois la
  rétention de Moyen, et la rétention levée ne tient pas).
- **Emboîter à partir de Moyen seulement**, Moyen inchangé et Bas hors de
  la chaîne (possibilité écartée) : Moyen, le défaut, continuait de perdre
  des builds valides de Bas.

## Conséquences

- **Moyen, le défaut, gagne des builds** par rapport à sa construction
  seule : ceux que Bas retient et que Moyen évinçait. Il n'en perd aucun
  sur une recherche complète.
- **L'inclusion ne vaut que pour une recherche complète.** Les demi-builds
  ajoutés prennent leur place dans l'ordre d'exploration : une recherche
  arrêtée par le filet de temps ou le plafond de candidats peut rendre
  d'autres builds que le préréglage plus étroit arrêté au même point.
- **Chaque moitié construit un préréglage de plus par préréglage plus
  étroit**, et l'appariement voit les paires des demi-builds ajoutés ; la
  progression de la construction compte les runes de tous les préréglages
  construits.
- La rétention et son union :
  [elagages.md § Préréglages emboîtés](../../03-developpeur/optimizer/moteur/elagages.md#préréglages-emboîtés) ;
  la construction des moitiés et sa progression :
  [pipeline.md § Construction des moitiés](../../03-developpeur/optimizer/moteur/pipeline.md#construction-des-moitiés) ;
  les préréglages de l'écran :
  [conditions-et-reglages.md](../../02-app/optimizer/ecran/conditions-et-reglages.md).
