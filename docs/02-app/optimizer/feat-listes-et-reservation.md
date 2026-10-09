# Listes de travail et réservation de runes

**Statut :** ÉTAT ACTUEL — décrit les listes de travail et la réservation de runes
**Lire si :** on modifie les listes de monstres, la validation d'un build ou la réservation de runes

Un 3ᵉ mécanisme d'exclusion, distinct des deux de feat-exclusion.md : ni
l'automatique (« Exclure les runes déjà utilisées », voir
feat-exclusion.md § Exclusion des runes déjà portées ailleurs) ni le manuel
(« Exclure les runes d'un monstre », voir
feat-exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source) ne savent exclure les runes d'un build
qui n'existe **pas encore** dans le compte — le résultat d'une recherche.
Résout un vrai problème de rareté : optimiser plusieurs monstres d'affilée
sans que chaque nouvelle recherche re-propose les runes déjà attribuées au
monstre précédent.

⚠️ **Pourquoi des LISTES, et plusieurs à la fois** — le modèle de rareté
réel du jeu ne connaît pas un seul pool global : Box et RTA sont des pools
de runes **totalement séparés** ; chaque **deck d'offense siège** est un
préréglage momentané indépendant des autres (exclusivité seulement ENTRE
les 3 monstres d'un même deck) ; la **défense siège**, elle, est **un seul
pool partagé** entre TOUTES les équipes 1 à 10 (une rune n'y sert qu'à UNE
équipe à la fois, tout runage siège confondu). Un pool de réservation
unique aurait fait fuiter des réservations entre des contextes qui, en
jeu, n'ont RIEN à voir l'un avec l'autre.

## Créer, valider et réserver dans une liste

- **Aucune liste fixe** — l'utilisateur en crée, renomme et supprime
  librement (`OptimizerListPicker.tsx`, menu déroulant : crayon de
  renommage, corbeille de suppression par ligne, « Nouvelle liste… »
  précédé d'un signe plus, en bas). Le menu est un `Flottant` : il ne
  pousse jamais la zone C. Ne pas le remplacer par une rangée de puces,
  qui défilerait latéralement dès quelques listes. Supprimer une liste efface son appartenance et ses runes
  validées — **jamais les runes elles-mêmes**, toujours réelles dans le
  compte. Navigable à tout moment ; changer de liste active change
  instantanément les runes réservées vues par la recherche.
- **« Valider ce build »**, sur chaque carte de résultat — réserve les 6
  runes de CE résultat dans la liste active : elles n'apparaissent plus
  dans les recherches suivantes de la MÊME liste (les autres listes n'en
  savent rien), jusqu'à libération explicite. Valider un NOUVEAU build
  pour un monstre déjà validé **remplace** l'ancien (les runes de l'ancien
  se libèrent automatiquement). ⚠️ **Jamais de perte silencieuse** :
  libérer un build déjà validé demande toujours confirmation (« Ces 6 runes
  ET la paire d’artéfacts redeviendront disponibles pour les autres
  monstres de cette liste. »).

  Un build validé (`ValidatedBuild`, optimizerExclusion.ts) est un
  **instantané** : sa liste (`listId`, obligatoire), son exemplaire
  (`selector`), les identifiants de ses 6 runes et de sa paire — jamais
  une référence recalculée depuis l'équipement courant, puisqu'on réserve
  un build trouvé, pas encore monté en jeu. Il est unique par paire
  (liste, exemplaire) : le même exemplaire peut porter un build différent
  dans deux listes (`useOptimizerLists.ts`). Une carte est « Validé » quand
  ses runes et sa paire sont celles réservées, comparées comme ensembles
  (`memesIds`, OptimizerSection.tsx : l'ordre des identifiants n'est pas
  garanti d'un calcul à l'autre).

  ⚠️ **Les ARTÉFACTS du build sont réservés eux aussi**, et mémorisés avec
  lui. Un artéfact physique ne se porte que sur UN monstre à la fois,
  exactement comme une rune : la paire retenue disparaît donc de l'inventaire
  proposé aux autres monstres de la MÊME liste, avec la même auto-exemption
  (relancer une recherche sur un monstre déjà validé ne le prive pas de ses
  propres pièces) et la même indépendance entre listes.

  ⚠️ **« Valider les artéfacts » — mêmes runes, autre paire.** Un build peut
  s'afficher avec les runes déjà réservées mais une AUTRE paire d'artéfacts :
  ses statistiques ne sont alors pas celles qui sont réservées. Le bouton
  passe dans un troisième état, actif, qui met à jour la seule paire sans
  toucher aux runes. Sans lui, la carte dirait « Validé » et n'offrirait plus
  rien alors que ce qu'elle montre n'est pas ce qui est réservé.
  Le cas se présente dès que « Adapter les artéfacts et reliques au tri »
  est activé (le défaut) : la paire suit alors le critère affiché, donc
  changer de tri peut la changer à runes identiques. Interrupteur désactivé,
  elle reste stable et ce bouton n’apparaît plus au fil de l’exploration.

  Sans cette mémorisation, la fiche d'un build validé rejouerait la paire portée
  AUJOURD'HUI plutôt que celle retenue par la recherche. ⚠️ Un build validé
  sans identifiant d'artéfact (enregistré avant qu'ils en aient un) retombe
  sur les artéfacts réels ; il faut le revalider. Le jeter serait une
  perte de données pour un simple affichage. Base et relique restent
  celles de l'exemplaire réel : seules runes et artéfacts sont substitués.

  ⚠️⚠️ **LA GARDE ANTI-DOUBLE-RÉSERVATION EST SUR LES DEUX CHEMINS** : sous
  la **fiche** (`displayedRuneConflicts`) et sur la carte de résultat. Ne
  pas vérifier la carte, au motif que le pool de recherche exclut déjà les
  runes réservées, ne suffit pas : c'est vrai **au moment de la recherche
  seulement** — des résultats affichés avant un changement de liste active,
  ou avant qu'un autre monstre ne réserve, permettraient de réserver **deux
  fois la même rune** dans une même liste. **La garde va là où l'on valide, pas là où l'on
  cherche** — un seul calcul (`conflitsDeRunes`), utilisé par les deux.

  ⚠️ Le bouton reste **affiché et désactivé**, libellé « Rune déjà réservée » et
  infobulle nommant le monstre qui la retient : le retirer laisserait croire que
  ce build n'est pas validable du tout, alors qu'il le redevient dès qu'on
  libère la rune.

## Zone C — Monstres de la liste

- **Zone C, « Monstres de la liste »** — juste sous les puces de source
  dans « Monstre & équipement » : chaque monstre de la liste active, son
  statut (« Validé » + bouton libérer, ou « pas encore validé »), cliquable
  pour rappeler son exemplaire et ses critères personnels mémorisés dans la
  recherche. Sans mémoire applicable, les critères prennent les défauts
  complets de l'Optimizer, même pour la même espèce ; les résultats affichés
  sont effacés. Voir
  [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md)
  § Mémoires des membres.
  Le clic rappelle les auras externes de la **destination**, celles de ses
  critères effectivement restaurés après validation, jamais celles du membre
  précédent. Si l'espèce ou l'exemplaire change et que la destination porte des
  auras externes, le rappel paraît 3 s dans « État de mon monstre » (voir
  feat-ecran-etat-de-mon-monstre.md § Sets d'aura des autres monstres) **et sous la liste** (voir plus bas) : c'est
  la seule voie qui le fasse. Une destination sans auras, un choix refusé ou
  un clic sur le même exemplaire efface le rappel précédent sans en créer.
  Restaurer par l'action seule, naviguer entre listes, importer ou remonter
  l'écran ne déclenche jamais de rappel ni d'ouverture guidée. Les nombres
  restaurés ne sont pas réécrits par le rappel. **Corbeille** à droite de
  chaque ligne pour retirer un monstre de la liste — sans confirmation s'il
  n'est pas encore validé (rien à perdre), avec confirmation s'il l'est (le
  retrait libère aussi ses runes). Bouton **« Ajouter à la liste »**, dont
  le libellé change selon le contexte (aucun monstre choisi → désactivé ;
  déjà dans la liste active → voir ci-dessous ; sinon → « Ajouter `<monstre>` à
  « `<liste>` » », suffixé « (non possédé) » pour une espèce sans exemplaire
  réel, voir plus bas). Sans liste active, « Créer une liste et y ajouter
  `<monstre>` » crée une liste (prompt du nom) ET y ajoute le monstre dans
  le même geste.
  Une marque « Critères mémorisés » occupe un emplacement réservé sur chaque
  ligne ; elle apparaît dès qu'une mémoire existe pour ce membre dans cette
  liste, sans déplacer la ligne. Le rapport du chargement et les messages de
  restauration occupent un espace réservé défilant de la zone C, commun au
  bureau et au téléphone. Une mémoire conservée mais inapplicable reste marquée
  et son refus est dit lorsqu'on choisit le membre.
  ⚠️ **Plusieurs exemplaires Box d'une même espèce** : les membres sont repérés
  par exemplaire (`exclusionSelectorKey`, Box = `box:<unitKey>`), deux
  exemplaires peuvent donc entrer dans la même liste. Quand l'exemplaire
  affiché **vient de la Box**, est déjà membre et qu'un autre exemplaire
  Box de l'espèce ne l'est pas, le bouton reste **actif** : « Ajouter un
  autre exemplaire de
  `<monstre>` à « `<liste>` » ». Un clic choisit le **premier exemplaire Box,
  dans l'ordre de la zone D, absent de la liste**, l'affiche (résultats
  affichés effacés, critères gardés, aucun rappel des auras externes —
  voir feat-ecran-recherche-du-monstre.md § Recherche du monstre à optimiser) puis
  l'ajoute ; un clic, un exemplaire. Tous les exemplaires Box déjà
  membres : « Déjà dans « `<liste>` » », désactivé. Exemplaire affiché
  venu de RTA ou du siège, déjà membre : « Déjà dans », désactivé, sans
  exemplaire suivant — l'exemplaire Box
  proposé pourrait être le même monstre physique. Aucun numéro
  d'exemplaire n'est affiché ; RTA garde un exemplaire par
  espèce (règle du jeu) ; le sélecteur « non possédé » reste repéré par
  espèce. Décision pure : `etatAjoutListe` et `exemplaireBoxHorsListe`
  (optimizerExclusion.ts), test `testListeExemplaires`. Bouton **« Libérer
  toutes les runes de « `<liste>` » »** (visible dès qu'au moins un build y
  est validé), avec sa propre confirmation dédiée.

  ⚠️ **Le rappel des auras s'affiche aussi sous la liste** — là où l'on vient de
  cliquer : « État de mon monstre » est souvent hors de l'écran à ce
  moment, toujours au téléphone. Même message (« Pense à vérifier les sets
  d'aura externes. »), même token (contour `warn` de 1 px, fond
  `warn-soft`, texte `warn`), même durée (`DUREE_ATTENTION_MS`, 3 s), même
  déclencheur : **un seul état du rappel pour les deux rendus**, celui que
  pose `doitRappeler` dans le `onClick` d'un membre — jamais un second
  minuteur ni une seconde condition. Sa place est réservée sous la liste :
  rendu avec elle, invisible hors rappel, rien ne bouge quand il paraît ni
  quand il s'efface. Le même rendu sert les deux formats ; au téléphone, il
  vit dans le dépliement de la zone C, ouvert au moment du clic. La boîte
  des auras garde son surlignage ; elle seule annonce le message aux
  lecteurs d'écran (`aria-live`), pour qu'il ne soit pas lu deux fois.

### Libération des runes réservées

  ⚠️ **DEUX libérations, pas une.** Chaque ligne de monstre validé porte :
  - **« Libérer ce build (runes et artéfacts) »** — rend les 6 runes ET la
    paire d’artéfacts.
    C’est un tout : la réservation existe POUR ce runage.
  - **« Libérer les artéfacts (le runage reste réservé) »** — rend la
    seule paire. Un artéfact physique ne se porte que sur un monstre à la fois :
    on veut souvent le récupérer pour un autre sans renoncer au runage déjà
    planifié. Affiché seulement s’il y a une paire à rendre. Les paires
    déjà calculées pour le monstre recherché se refont alors avec
    l’inventaire libéré (voir
    ../../03-developpeur/optimizer/moteur-artefacts.md § Recalcul quand la paire peut changer).

  ⚠️ **Pas de « libérer les runes seules », et c’est délibéré.** Un build
  validé porte TOUJOURS 6 runes : sans elles il n’y a plus de build à qui
  les artéfacts appartiendraient, et l’entrée résiduelle serait lue comme
  « 6 runes » par tout le reste (badge « Validé », exclusion, revalidation
  après réimport). L’asymétrie est donc dans le modèle, pas un oubli.

  ⚠️ **L’icône dit l’action.** Le bouton de libération porte la **roue
  barrée d’une interdiction**, celle d’« Exclure les runes déjà utilisées » :
  du point de vue du monstre, libérer, c’est lui retirer ses runes. La coche
  de validation, pictogramme du badge « Validé » posé juste à sa gauche,
  dirait le contraire. Le second bouton reprend le même montage avec
  l’icône d’**artéfact**.

### Monstre non possédé et auto-exemption

- ⚠️ **Ajouter un monstre qu'on ne possède PAS** — pour le joueur qui a
  obtenu le monstre et veut essayer des runages d'équipe sans avoir mis à
  jour son export. Une ESPÈCE choisie via la recherche
  bestiaire (voir feat-ecran-recherche-du-monstre.md § Recherche du monstre à optimiser) mais absente des 4 sources du compte
  reste ajoutable à une liste ET « validable » exactement comme un
  exemplaire réel — un sélecteur `unowned` (`ExclusionSelector`, distinct
  des 4 sources réelles) porte cette entrée, sur ses stats de base 6★
  niveau max, sans rune ni artéfact. ⚠️ **Les runes trouvées par la
  recherche restent de VRAIES runes du compte** : « Valider ce build »
  fonctionne à l'identique, réservant réellement ces 6 runes pour les
  autres monstres de la MÊME liste — c'est justement ce qui permet
  d'essayer un runage d'ÉQUIPE (plusieurs monstres, certains possédés,
  certains non) sans qu'un même jeu de runes soit proposé deux fois. Ne
  s'affiche QUE quand l'espèce n'a d'exemplaire dans AUCUNE des 4 sources
  — possédée ne serait-ce que quelque part (même ambiguë), la
  désambiguïsation normale (zone D / puces) garde toujours la main, jamais
  masquée par ce sélecteur. Aucune puce ne s'allume pour ce cas (comme un
  build validé, voir l'auto-exemption ci-dessous). ⚠️ Revérification au réimport (comme tout
  le reste de cette section) : un build validé reste valable tant que ses
  runes existent encore QUELQUE PART dans le compte réimporté, équipées
  ou non (`revalidateBuilds`) — même règle pour un exemplaire réel, dont
  le build validé n'est justement pas porté en jeu. Seule différence : un
  exemplaire réel doit encore se retrouver dans Box, RTA ou défenses de
  siège ; pour un monstre non possédé, l'espèce au bestiaire suffit.
  Limite assumée, pour les deux : une rune passée depuis sur un autre
  monstre n'est pas détectée. La revérification suit CHAQUE réimport, même
  du même compte — contrairement aux exclusions manuelles, effacées
  seulement par un autre `wizard_id` : c'est justement « mon compte a
  changé depuis » qu'elle cherche. Toute entrée retirée est comptée dans
  le message d'import (`App.tsx`), jamais en silence.
- **Auto-exemption de la liste ACTIVE** — chercher à nouveau le même
  monstre dans la MÊME liste exempte automatiquement SES PROPRES runes déjà
  validées (sans quoi la recherche se trouverait bloquée par ses propres
  runes réservées) ; les runes validées des AUTRES monstres de cette liste
  restent, elles, indisponibles. Aucune des 4 puces Box/RTA/Défenses siège/
  Offenses siège ne s'allume quand la fiche affiche un build VALIDÉ plutôt
  que le runage réellement équipé d'une source réelle — un build validé
  n'est ni du Box ni du RTA tel qu'actuellement équipé, juste une
  réservation. ⚠️ **Signal explicite en plus des puces grisées** : un
  bandeau dans la fiche elle-même (« Build validé affiché — pas
  l'équipement réellement porté ») s'affiche dans ce cas, pour ne
  jamais laisser croire que ce qui est montré est réellement équipé en jeu.
  ⚠️ **Bascule vers l'équipement réel, sans quitter la liste** — sans
  elle, on ne verrait plus le runage réellement porté tant qu'on est dans
  la liste. Une icône dans ce même bandeau (« Voir le runage réellement
  porté ») affiche l'équipement RÉEL de
  l'exemplaire à la place du build validé, sans changer d'exemplaire ni
  quitter la liste ; le bandeau change alors de message (« Équipement
  réellement porté affiché ») et une puce s'allume normalement si ce
  runage correspond bien à l'une des 4 sources. Réinitialisée à chaque
  changement d'exemplaire — revenir sur ce monstre plus tard réaffiche le
  build validé par défaut.

## Comparer, valider sans recherche et persistance

- **« Comparer », à côté de « Valider ce build »** sur chaque carte de
  résultat : les deux boutons **se partagent la largeur**
  de la carte, plutôt que d'être empilés — une rangée de plus par carte se
  paierait sur toute la grille de résultats. Au clic, l'**écart statistique
  par statistique** entre ce build et la référence apparaît **sous** les
  boutons, donc sans rien déplacer de ce qui précède.
  - ⚠️ **La référence est la fiche affichée**, ce qui couvre les deux cas
    *sans les distinguer* : le build validé s'il y en a un, sinon le build
    actuel. `selected.gear` **est** déjà le build validé quand il
    en existe un — runes ET artéfacts substitués — et l'équipement réel
    sinon. Refaire cette résolution côté comparaison la dupliquerait, et
    raterait « Voir le runage réellement porté », qui la désactive exprès.
  - Un seul build comparé à la fois : ils partagent la même référence, deux
    comparaisons ouvertes ne diraient rien de plus.
  - ⚠️ **L'écart porte aussi sur la valeur de TÊTE**, pas seulement sur les
    huit statistiques : dégâts, PV effectifs et
    efficience/score selon ce qui est affiché. Il se pose **sous** la valeur
    qu'il qualifie, jamais à côté, où il se lirait comme une seconde mesure.
    Un seul composant les rend tous les trois — trois rendus séparés
    divergeraient de couleur ou de format, alors que c'est précisément leur
    comparaison qui compte.
  - ⚠️ L'écart de **dégâts** est recalculé contre les stats ET la paire
    d'artéfacts de la référence, jamais contre le total d'un autre candidat.
  - ⚠️ **Les écarts de dégâts et de PV effectifs notent la fiche comme un
    candidat** (`scoreDeReference`, runeBuildOptim.ts) : ses stats, les activations d'aura de ses runes, le
    profil de SA paire d'artéfacts et l'effet unique de SA relique
    (Conquête ; Ténacité et points Bravoure/Éternité/Origine), par la même
    fonction de score que les cartes, avec des options propres à la
    référence — jamais celles du cache des résultats. Tout se déduit de la
    fiche : aucun appelant ne peut mêler deux équipements. Noter les stats
    de la fiche avec le profil de la paire de la RECHERCHE
    (`searchArtifacts`), ou sans l'effet unique, fausserait l'écart dans
    les deux sens. À équipement identique, l'écart vaut 0.
  - ⚠️ Les écarts **nuls sont affichés**, en gris. Ne montrer que les stats
    qui changent ferait une liste de longueur variable d'une carte à l'autre,
    et laisserait croire qu'une stat absente n'a pas été comparée.
  - L'écart est calculé **par le parent**, comme les dégâts réels de la carte
    et pour la même raison : la carte n'a aucune raison de savoir comment la
    référence se résout. Il n'est calculé que pour la carte comparée — le
    faire pour les 20 de la page coûterait vingt fois plus pour dix-neuf
    valeurs jamais affichées.

- **« Valider ce build » sous la fiche**, sans passer par une recherche
  — un second bouton, au même rôle que celui d'une carte de
  résultat, juste sous la fiche stats/artéfacts/runes/relique : valide
  directement les runes ACTUELLEMENT affichées sur l'exemplaire (un runage
  déjà composé en jeu, ou déjà planifié). Exige exactement 6 runes
  affichées (comme un build trouvé par la recherche) — désactivé sur un
  exemplaire partiellement runé ou nu. Affiche « Validé » (désactivé,
  coche) si c'est déjà EXACTEMENT le build validé de cet exemplaire. Sans
  liste active, ouvre le même dialogue « Nouvelle liste » que l'ajout à
  la liste, avec l'action « Créer et valider » (crée la liste ET valide
  dans le même geste). ⚠️ **Bloqué si UNE
  SEULE des 6 runes affichées est déjà réservée pour un AUTRE monstre de la
  MÊME liste** — contrairement à un résultat de
  recherche (dont le pool exclut déjà les runes réservées ailleurs dans la
  liste), les runes affichées ici viennent de l'équipement RÉEL de
  l'exemplaire : rien n'empêche structurellement qu'elles chevauchent une
  réservation posée depuis pour un autre monstre. Message explicite listant
  quelles runes et pour quel monstre (« Rune déjà réservée dans cette
  liste : emplacement 2 (Camilla) », accordé en nombre — « Runes déjà
  réservées » dès qu'il y en a plusieurs), pas juste un bouton désactivé
  sans explication.
- **Persisté**, comme les mémoires de critères des membres (voir
  feat-ecran.md § Survie à un changement d'onglet) — un flux de plusieurs
  dizaines de minutes à travers toute une liste ne doit pas perdre le
  travail déjà fait à un simple rechargement de page. Même statut que la
  prépa RTA et les équipes de siège (voir
  [usePersistence](src/hooks/usePersistence.ts)) : soumis au même
  interrupteur global de conservation. Un hook à part,
  `useOptimizerLists.ts`, instancié dans `App.tsx`, porte les listes,
  les réservations, les mémoires et les équipes ; la saisie libre et les
  résultats de recherche restent dans `useOptimizerState`.
- ⚠️ **Limite connue de l'écran** : l'ajout manuel se fait **un monstre à la
  fois**, sans workflow qui enchaîne automatiquement au monstre suivant
  après validation. Le modèle pur d'import depuis le siège, la prépa RTA
  ou le speed tuning crée une nouvelle liste ; il n'est pas encore branché
  sur un bouton ou un écran (voir
  [feat-import-equipes.md](feat-import-equipes.md) § Modèle d'import).

## Mémoire des membres et revérification

Le hook des listes porte aussi un index de mémoires par liste et sélecteur,
avec l'espèce `com2usId` et les critères personnels photographiés. Une clé de
stockage indépendante garde cet index et les équipes sans modifier le JSON
historique des listes. Le clic d'un membre restaure ses critères mémorisés
ou, sans mémoire applicable, la base complète de ses critères personnels.

Le réimport revérifie ensemble membres, builds, mémoires et équipes. Un membre
introuvable est retiré, sa mémoire reste conservée sans application, et son
équipe perd ce membre (dissoute sous deux). Une autre espèce rend sa mémoire
inapplicable. RTA et siège suivent leur entrée ou slot entre copies de la même
espèce : ce remplacement n'est pas détectable. Le rapport de revérification
liste ces mémoires, sans message systématique à chaque réimport.

Forme, validation, conservation et rapport :
[feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md).

