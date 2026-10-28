# Recherche du monstre à optimiser

Ce document décrit la recherche du monstre à optimiser et ce qu'elle ajoute
à la liste. Ce que montre « Exemplaire », et l'aperçu des autres
exemplaires, sont dans [equipement-actuel.md](equipement-actuel.md).

## Choix du monstre et de l’exemplaire

1. **Recherche bestiaire : une espèce, ajoutée sur son exemplaire
   suivant** — la recherche « Rechercher un monstre… » (« Monstre à
   optimiser » au téléphone) résout une **ESPÈCE** (nom, icône, stats de
   base 6★ niveau max, sorts) dans **TOUT le bestiaire**, possédé ou non —
   pas seulement les monstres du compte (`MonsterSourcePicker
   mode="bestiary"`, même filtre `formesJouables` que les autres pickers de
   l'app). ⚠️ **Avec « Importer une équipe », c'est le seul geste qui
   ajoute un monstre à la liste** (décision de l'utilisateur) : les puces
   d'« Exemplaire » ne font que regarder
   ([equipement-actuel.md](equipement-actuel.md)). ⚠️ **Une ligne par
   espèce, jamais une par exemplaire** (décision de l'utilisateur) : un
   joueur qui possède dix exemplaires d'un monstre, rangés dans plusieurs
   contenus, lirait dix lignes ; l'exemplaire se regarde ensuite dans
   « Exemplaire ».
   **Avec une liste active, choisir une espèce ajoute son exemplaire
   suivant** : le premier exemplaire de l'espèce absent de la liste, la
   Box d'abord, dans l'ordre de la zone D, puis RTA, Défenses siège et
   Offenses siège ; une espèce absente des quatre sources s'ajoute une fois,
   par son sélecteur non possédé (`unowned`), sur les seules stats de base.
   Avec deux Lushen en Box, choisir deux fois « Lushen » ajoute « Box 1 »,
   puis « Box 2 ». L'exemplaire ajouté devient le membre affiché et
   l'exemplaire **réellement optimisé**. ⚠️ **Quand tous les exemplaires de
   l'espèce sont dans la liste, sa ligne reste affichée, désactivée, avec sa
   raison** (« Les 2 Lushen de ta Box sont dans la liste », « Lushen est
   déjà dans la liste ») : elle se lit, et ne se choisit ni à la souris ni
   au clavier (`estDesactive` de `useComboboxNav`, voir
   [feat-recherche-clavier.md](../../transverse/feat-recherche-clavier.md)).
   Le choix de l'exemplaire suivant est une fonction pure
   d'[optimizerExclusion.ts](src/lib/optimizerExclusion.ts), testée. La
   recherche du bestiaire et l'import de recette appellent
   `speciesCandidatesBySource` eux-mêmes, jamais par un `useMemo` en retard
   d'un rendu ; un membre de la zone C porte déjà son exemplaire.
   **Un exemplaire NU (sans aucune rune) reste un exemplaire, dans TOUTE
   source** — Box (construire un build depuis rien) comme RTA/siège (un
   monstre assigné à un favori RTA ou un deck de siège mais jamais runé, ex.
   juste obtenu et pas encore équipé, ou placé à la main sans équipement du
   compte, aux stats de base) : seul un **slot RÉELLEMENT vide** (aucun
   monstre assigné) n'est pas un candidat.
   **Hors liste, changer d'ESPÈCE** réinitialise « Critères de recherche »
   et les résultats affichés (set, statistique principale imposée,
   objectif, artéfacts, conditions min/max, tri, pagination) — des critères
   posés pour l'ancien monstre n'ont pas de raison de valoir pour le
   nouveau. **Ajouter un autre exemplaire de l'espèce affichée** conserve
   les critères de recherche, le sort et ses réglages (aucun nouveau sort
   n'est à choisir pour cette espèce), efface les **résultats affichés**,
   faits pour l'exemplaire d'avant, et photographie aussitôt les critères
   pour le nouveau membre. Un membre choisi dans la liste de travail
   rappelle ses critères mémorisés, ou la base complète s'il n'en a pas,
   puis efface les résultats affichés (voir la table ci-dessous).
   Les **réglages avancés**
   (préfiltrage, exclusions, recherche exhaustive…) ne sont jamais
   concernés : préférences générales, pas critères propres à un monstre.
   **Importer un nouveau compte sans propriétaire valide** déclenche la réinitialisation complète,
   pour la même raison (autre box, autre pool de runes possible) — même en
   étant sur un autre onglet au moment de l'import.

   ⚠️ **Au bestiaire, changer d'espèce ramène l'objectif à « Efficience »** et vide le
   sort choisi ; **choisie dans le bestiaire**, l'espèce ramène aussi le cran
   des artéfacts à « Dégâts supplémentaires ». Un sort appartient à un
   monstre : après un changement, le calcul retomberait silencieusement sur
   le sort par défaut du nouveau ; le résumé sous l'objectif le nommerait,
   mais rien ne signalerait le changement, et l'on croirait calculer sur un
   sort qu'on a choisi. Remettre l'objectif (et, depuis le bestiaire, le
   cran) au défaut rend ce repli **impossible** plutôt que visible —
   réoptimiser en dégâts demande de recliquer « Dégâts réels », dont la
   fenêtre présélectionne le sort par défaut du nouveau monstre.
   - L'objectif et le sort retombent dans `resetSearch`, donc pour toute
     espèce différente au bestiaire ; le cran des artéfacts retombe dans
     `pickSpecies`. Le clic d'un membre passe par `choisirMembre` et restaure
     son objectif, son sort et son cran mémorisés, ou leurs défauts complets.
     Cette restauration n'ouvre jamais la fenêtre du combat.
   - Ces remises à zéro vivent dans les gestionnaires du geste, jamais dans
     un effet sur le monstre sélectionné : `importRecipe` pose le monstre et
     l'objectif sans passer par eux, et un effet, déclenché après l'import,
     écraserait l'objectif de la recette qu'on vient de charger.

   ⚠️ **Hors liste, la description du combat SURVIT** : défense, PV et élément de
   l'adversaire, buffs, lead ne sont pas propres au monstre, et ce sont les
   plus longs à ressaisir. Recliquer « Dégâts réels » rouvre la fenêtre avec
   le combat déjà décrit. Les sélecteurs et réglages propres au sort ne
   retombent au défaut lorsque l'espèce optimisée change ou qu'un nouveau
   compte est importé. Un membre rappelle son combat mémorisé ou la base complète, selon la table ci-dessous.

## Création depuis la recherche

Sans liste active, choisir un résultat ouvre « Nouvelle liste » avec nom
et contenu obligatoire, sans présélection. « Créer » crée la liste et y
ajoute l'exemplaire suivant de l'espèce avec ses critères ; un nom vide
devient le premier « Liste N » libre. Annuler garde le monstre affiché
sans liste. Une liste active existante n’ouvre aucun dialogue de création.

## Monstre affiché sans être membre

Le monstre affiché peut ne pas être membre de la liste active : sans liste
active (« Nouvelle liste » annulé, liste supprimée), ou avec une liste
active qui ne le contient pas (recette importée d'une autre espèce).
L'Optimizer optimise alors ce monstre, sur son exemplaire suivant, et
« Exemplaire » montre et regarde comme pour un membre. « Valider ce
build » garde deux chemins : sans liste, « Créer et valider » crée une
liste avec ce monstre et valide le build affiché ; avec une liste active,
la validation l'y ajoute.

## Classement des champs de DamageSetup au changement de monstre

**Classement exhaustif de `DamageSetup`.** « Contexte » désigne
l'adversaire, l'équipe ou l'état de combat réutilisable ; « sort » désigne
un choix lié au monstre, au sort ou à son passif. Un champ de compatibilité
suit le champ auquel il est associé. Toute nouvelle clé doit être classée
dans cette table et dans `DAMAGE_SETUP_CLASSIFICATION` avant usage. Ce classement
décrit les transitions hors liste ; la mémoire d'un membre contient le combat entier.
Les compétences d’invocateur enregistrées suivent ce classement de
compatibilité, mais leur mode effectif se dérive toujours du contenu de la
liste active : Guilde → « Contenu de guilde », sinon « Contenu normal », y compris à
l’import d’une recette. Cette dérivation ne réécrit aucune mémoire.

| Sens | Champs actuels | Changement de monstre |
| --- | --- | --- |
| Contexte partagé | `enemyDef`, `enemyHp`, `enemyHpPct`, `enemySpd`, `enemyAtk`, `enemyElement`, `enemyHpNotDestroyed`, `aliveEnemies`, `ownHpPct`, `livingAlliesPct`, `velaskaPvPerduPct`, `atkBuff`, `defBuff`, `spdBuff`, `atkDebuff`, `defDebuff`, `spdDebuff`, `defBreak`, `brand`, `critMode`, `summonerSkills`, `leaderSkill`, `euldongActif`, `mirinaeActif`, `deborahActif`, `miriamActif`, `transmissionActif`, `velaskaActif` | Conservés |
| Propre au monstre, sort ou passif | `skillCom2usId`, `defBreakParLeSort`, `attaqueConjointe`, `sacrificeReservePct`, `passifsOffensifs`, `statsCombatActives`, `coupsPersonnalises`, `cibleDegatsParSort`, `premierCoupIgnoreDefParSort`, `stackPersonnalise`, `effetsCibleCount`, `buffsCibleCount`, `buffsPropresCount`, `buffsAlliesCount`, `compteurPersonnalise`, `effetsPropresCount`, `scenariosEffetsEntreCoups`, `pvActuelsAvantSacrificePct` | Défauts |
| Compatibilité associée au contexte | `enemyDestroyedHpPct` (champ hérité de destruction des PV adverses, ignoré), `leaderSpeedPct` (lead VIT hérité) | Conservés avec le contexte |
| Marqueurs de sémantique associés aux compteurs par sort | `effetsCibleCountAutres`, `buffsPropresCountAutres` | Défauts avec leur compteur |

| Événement | Contexte partagé et legacy associé | Sort, passifs et marqueurs associés | Autres critères de recherche |
| --- | --- | --- | --- |
| Espèce différente hors liste | Conservés | Défauts | `resetSearch` habituel |
| Ajout, par la recherche, d'un autre exemplaire de l'espèce affichée | Conservés | Conservés | Conservés, sous la garde de cohérence de relique ci-dessous ; résultats affichés effacés ; critères photographiés pour le nouveau membre |
| Aperçu d'un exemplaire dans « Exemplaire » | Inchangés | Inchangés | Inchangés, résultats affichés compris |
| Navigation entre listes sans choisir un autre monstre | Mémoire valide du membre affiché dans la destination ; sinon conservés sans propriétaire | Même règle | Même règle |
| Création ou suppression de la liste active sans inclusion | Conservés sans propriétaire | Conservés sans propriétaire | Conservés sans propriétaire |
| Choix d'un membre de liste, par sa carte | Mémoire valide, sinon base complète | Mémoire valide, sinon base complète | Mémoire valide, sinon base complète |
| Import de recette | Valeurs de la recette | Valeurs de la recette | Valeurs de la recette ; autre espèce : `resetSearch` habituel d'abord (tri, sens, bornes, résultats) |
| Import de compte sans propriétaire valide | Défauts | Défauts | `resetSearch` habituel |
| Réimport avec propriétaire valide après rattachement | Conservés | Conservés | Conservés ; runes imposées absentes retirées de l'affichage et dites, cohérence de relique conservée |

La conservation hors liste garde la règle de cohérence de la relique :
« Comme équipée » redevient « Libre » si l'exemplaire choisi
n'en porte pas (voir relique.md § Relique). Cette pose automatique
ne crée aucune mémoire.

Cliquer un membre restaure ses critères personnels puis efface les résultats
affichés par la même fonction
(`effacerResultats`, useOptimizerState.ts, la partie « résultats » de
`resetSearch` : résultat et progression, page, arrêt manuel, détail
ouvert). Rien n'est relancé : l'utilisateur relance lui-même. La restauration
ne crée aucune mémoire et ne déclenche ni rappel des auras ni ouverture guidée.
Le rappel reste réservé au geste explicite sur une ligne de la liste.
L'ajout d'un autre exemplaire de l'espèce affichée change d'exemplaire par
le **chemin de sélection d'un exemplaire précis** (`choisirExemplaire`,
OptimizerSection.tsx) : résultats affichés effacés, critères gardés, sans
rappel des auras externes, qui reste au seul clic d'un membre ; l'inclusion
photographie immédiatement les critères conservés. Naviguer entre listes
sans choisir un autre monstre ne change pas le monstre optimisé, mais
rappelle sa mémoire valide dans la destination ; sans mémoire, aucun
propriétaire. Regarder un exemplaire dans « Exemplaire » ne vide rien et
n'efface pas les résultats affichés. L'import de
recette écrit directement ses valeurs après validation ; aucun effet
différé de changement d'espèce ne les écrase. Une recette d'une **autre
espèce** que le monstre sélectionné passe d'abord par `resetSearch`, comme
le bestiaire : le tri, son sens et les bornes des résultats reviennent à
leurs défauts et les résultats affichés s'effacent, puis les valeurs de la
recette s'écrivent par-dessus. Même espèce, ou monstre introuvable : rien
n'est remis à zéro.

## Au bureau : la liste de travail et « Exemplaire »

La recherche et l'exemplaire vivent dans la colonne « Monstre » de la page
de bureau ([README.md](README.md#mise-en-page-densemble)), l'une sous
l'autre, sans carte commune :

1. **la liste de travail**, première section du panneau
   (`ListeDeTravailBureau`) : la rangée de « Liste active », que termine
   « Importer une équipe » ([../feat-import-equipes.md](../feat-import-equipes.md)),
   son titre au style d'un titre de section, 13,5 px gras (au téléphone, une
   étiquette) et son bouton qui nomme la liste (« nom - contenu ») ; puis
   la liste, sans carte autour (chaque monstre garde la sienne), dont la
   rangée du titre porte « Ajouter un
   monstre / à la liste », toujours, sur deux lignes, sans le nom de la
   liste ni son compte (« Liste active » la nomme juste au-dessus ; au
   téléphone, le titre reste « Monstres de « … » » et son compte),
   « Rechercher un monstre… » et le monstre actif (portrait et nom). ⚠️ **La place du monstre actif est réservée, vide ou
   non**, de la largeur d'« Importer une équipe » au-dessus d'elle (lue sur
   la page) : choisir un monstre ne déplace ni le champ ni la liste, et la
   droite du champ s'aligne sur celle de la liste déroulante des listes
   (décision de l'utilisateur).
   Les membres prennent leur hauteur jusqu'à 308 px, comme au téléphone,
   puis défilent pour garder les critères accessibles ;
2. **« Exemplaire »**, sous la liste de travail (`ExemplaireBureau`) : les
   vues « Build actuel » · « Build validé », les puces d'aperçu, la zone D
   en flottant (300 px de haut au plus, qui défile), puis la fiche,
   toujours repliée ([equipement-actuel.md](equipement-actuel.md)).

## Au téléphone : trois blocs empilés

Un rendu à part (`MonstreEquipementTelephone`, dans la carte « Monstre &
équipement » que seul le téléphone affiche), pas un réagencement du bureau :

1. la recherche, toujours visible, avec en dessous la liste active dans le
   dépliement « Gérer mes listes », replié par défaut
   (`zoneCOpen`) ;
2. les vues et les puces d'aperçu, toujours visibles, avec la zone D **en
   ligne** dessous (le même `zoneDOpen` qu'au bureau ; un flottant se
   prête mal à un écran étroit), puis les cartes de la zone C quand « Gérer
   mes listes » est ouvert : un ajout par la recherche agrandit la liste
   sous les puces, sans déplacer la recherche ;
3. la fiche `MonsterGear`, même composant qu'au bureau.

Dès que la ligne du monstre choisi, sous la recherche, sort de l'écran
(passée sous l'en-tête), le bouton flottant « Options » prend l'icône du
monstre devant la sienne ; elle s'en retire quand on remonte jusqu'à la
ligne. Elle entre en glissant depuis la gauche pendant que le bouton
s'élargit (500 ms), et ressort de même ; sans animation si le téléphone
demande moins de mouvement. Aucun autre élément n'apparaît à l'écran ; sans monstre choisi, ou
hors de l'Optimizer, le bouton garde sa seule icône.
