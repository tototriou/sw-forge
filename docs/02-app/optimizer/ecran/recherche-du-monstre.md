# Recherche du monstre à optimiser

Ce document décrit la carte de recherche du monstre à optimiser.

## Choix du monstre et de l’exemplaire

1. **Recherche bestiaire, puis puces d'exemplaire** — la recherche
   « Rechercher un monstre… » (« Monstre à optimiser » au téléphone) résout
   d'abord une **ESPÈCE** (nom, icône, stats
   de base 6★ niveau max, sorts) dans **TOUT le bestiaire**, possédé ou
   non — pas seulement les monstres du compte (`MonsterSourcePicker
   mode="bestiary"`, même filtre `formesJouables` que les autres pickers de
   l'app). Un **sélecteur de source**, les puces d'« Exemplaire » (Box, par
   défaut / RTA / Défenses siège / Offenses siège, `Segmented size="lg"` —
   même contrôle qu'« Exclure les runes d'un monstre »,
   voir ../feat-exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source),
   ne filtre pas la recherche elle-même : il choisit
   dans QUELLE source résoudre l'**exemplaire**, une fois l'espèce trouvée.
   ⚠️ **Mode compact déclenché par la largeur RÉELLE de sa colonne, pas par
   celle de la fenêtre** — `Segmented` mesure lui-même la place qu'il reçoit
   et se resserre tout seul (voir
   [03-developpeur/interface/librairie-ui/README.md](../../../03-developpeur/interface/librairie-ui/README.md)), comportement commun
   à TOUS les sélecteurs de l'app. **Une puce grisée** signale que l'espèce
   choisie n'a aucun exemplaire dans cette source (`options[i].disabled` ;
   aucune source : tout le contrôle, `allSourcesEmpty`). La recherche du
   bestiaire et l'import de recette appellent `speciesCandidatesBySource`
   eux-mêmes, jamais par un `useMemo` en retard d'un rendu ; un membre de
   la zone C porte déjà son exemplaire. **Une puce dit le nombre
   dès deux exemplaires** : `{source} · {n}` (« Box · 2 »), même règle pour les
   quatre sources ; à zéro ou un exemplaire, la puce garde son libellé.
   C'est le seul signe qu'un clic sur la puce, même déjà allumée, ouvre la
   zone D. Le compte ne dépend que de l'espèce, jamais d'un clic, et les
   puces se partagent la largeur à égalité : rien ne bouge
   (`libellePuceSource`, optimizerExclusion.ts).
   **Avec une liste active, rechercher une espèce déjà membre sélectionne
   le premier membre résolu de cette espèce dans l’ordre de la liste**, avec
   ses critères mémorisés ou la base complète ; aucun doublon ni erreur.
   Sinon, **choisir une espèce résout automatiquement le PREMIER exemplaire
   Box** dès qu'il y en a au moins un (pour ne pas rouvrir
   la désambiguïsation pour tout monstre possédé en double) — la fiche
   d'équipement affiche directement ce build, prête à optimiser sans clic
   de plus. Aucun exemplaire Box : la fiche montre les stats de base 6★.
   Si l’espèce est présente en RTA ou siège, l’exemplaire reste non résolu
   jusqu’au choix explicite d’une puce ou d’une ligne de désambiguïsation.
   Une espèce absente des quatre sources est déjà résolue par son sélecteur
   non possédé (`unowned`), sur les seules stats de base.
   **Cliquer une puce** (`pickSource`) résout l'unique candidat de cette
   source s'il n'y en a qu'un, sinon ouvre la **zone D** — un panneau
   flottant (bureau) / bloc en ligne (mobile) listant chaque candidat
   (`ExclusionCandidateRow` : portrait, nom, icônes des sets actifs, compte
   de runes, et pour le siège le numéro d'équipe + coéquipiers) — jamais de
   résolution automatique dès qu'il y a un choix réel à cet endroit
   (contrairement à la recherche bestiaire, un clic de puce est un geste de
   désambiguïsation volontaire). **Un exemplaire NU (sans aucune rune) reste
   sélectionnable, dans TOUTE source** — Box (construire un build depuis
   rien) comme RTA/siège (un monstre assigné à un favori RTA ou un deck de
   siège mais jamais runé, ex. juste obtenu et pas encore équipé) : seul un
   **slot RÉELLEMENT vide** (aucun monstre assigné) est absent des
   candidats, pas un monstre présent sans rune.
   **Choisir un résultat fixe l'exemplaire RÉELLEMENT optimisé** — pas
   seulement prévisualisé. **Hors liste, changer d'ESPÈCE** réinitialise « Critères de
   recherche » et les résultats affichés (set, statistique principale
   imposée, objectif, artéfacts, conditions min/max, tri, pagination) — des
   critères posés pour l'ancien monstre n'ont pas de raison de valoir pour
   le nouveau. Hors liste, re-choisir le même exemplaire, ou un AUTRE exemplaire de la
   MÊME espèce, conserve les critères de recherche, le sort et ses réglages :
   aucun nouveau sort n'est à choisir pour cette espèce. Un autre
   exemplaire choisi par un membre de la
   liste de travail rappelle ses critères mémorisés ou la base complète s'il
   n'en a pas, puis efface les **résultats affichés** (voir la table ci-dessous).
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
ajoute l’exemplaire résolu avec ses critères ; un nom vide devient le
premier « Liste N » libre. Annuler garde le monstre affiché sans liste.
Une liste active existante n’ouvre aucun dialogue de création.
L’exemplaire résolu est automatiquement ajouté à cette liste avec la même
capture des critères qu’un ajout ordinaire. Une recherche répétée sélectionne
le membre présent. Pour ajouter une autre copie Box de la même espèce, le
bouton « Ajouter un autre exemplaire de … » reste disponible.

Si l’espèce est seulement présente en RTA ou siège et que l’exemplaire
n’est pas encore résolu, la création reste possible : la nouvelle liste
est active et vide. Aucun candidat n’est choisi à sa place. Le choix d’une
puce avec un candidat unique, ou d’une ligne de désambiguïsation, ajoute
ensuite cet exemplaire à la liste active et capture les critères de ce
geste. La même règle s’applique avec une liste déjà active. Choisir une
puce ambiguë n’ajoute rien avant le choix de la ligne. Un exemplaire déjà
membre est seulement sélectionné, avec restauration de ses critères et
sans doublon ni erreur. Sans liste active, ces choix de source n’ajoutent rien.
Le sélecteur non possédé, déjà résolu, suit l’ajout immédiat ordinaire.

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
| Autre exemplaire de la même espèce, hors liste ou avant sa première inclusion | Conservés | Conservés | Conservés, sous la garde de cohérence de relique ci-dessous |
| Navigation entre listes sans choisir un autre monstre | Mémoire valide du membre affiché dans la destination ; sinon conservés sans propriétaire | Même règle | Même règle |
| Création ou suppression de la liste active sans inclusion | Conservés sans propriétaire | Conservés sans propriétaire | Conservés sans propriétaire |
| Choix d'un membre de liste, par sa carte, la recherche ou un exemplaire déjà membre | Mémoire valide, sinon base complète | Mémoire valide, sinon base complète | Mémoire valide, sinon base complète |
| Import de recette | Valeurs de la recette | Valeurs de la recette | Valeurs de la recette |
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
Le bouton « Ajouter un autre
exemplaire de … » de la zone C
(voir ../feat-listes-et-reservation.md § Zone C — Monstres de la liste) change
d'exemplaire par le **chemin de sélection hors liste** (`choisirExemplaire`,
OptimizerSection.tsx) : résultats affichés effacés, critères gardés,
sans rappel des auras externes, qui reste au seul clic d'un membre ; l'inclusion
photographie immédiatement les critères conservés. Naviguer entre listes sans
choisir un autre monstre ne change pas le monstre optimisé, mais rappelle sa
mémoire valide dans la destination ; sans mémoire, aucun propriétaire. Hors liste, la simple
re-sélection de la même espèce dans le bestiaire, ou d'un exemplaire par
les puces de source et la zone D, ne vide rien, et n'efface pas non plus
les résultats affichés. L'import de
recette écrit directement ses valeurs après validation ; aucun effet
différé de changement d'espèce ne les écrase.

## Au bureau : la liste de travail et « Exemplaire »

La recherche et le choix de l'exemplaire vivent dans deux boîtes de la page
de bureau ([README.md](README.md#mise-en-page-densemble)), pas dans une carte
commune :

1. **la liste de travail**, première section du panneau des essentiels
   (`ListeDeTravailBureau`) : la rangée de « Liste active », que termine
   « Importer une équipe » ([../feat-import-equipes.md](../feat-import-equipes.md)),
   son titre au style d'un titre de section, 13,5 px gras (au téléphone, une
   étiquette) et son bouton qui nomme la liste (« nom - contenu ») ; puis
   la carte de la liste, dont la rangée du titre porte « Ajouter un
   monstre / à la liste », toujours, sur deux lignes, sans le nom de la
   liste ni son compte (« Liste active » la nomme juste au-dessus ; au
   téléphone, le titre reste « Monstres de « … » » et son compte),
   « Rechercher un monstre… » et le monstre actif (portrait et nom). ⚠️ **La place du monstre actif est réservée, vide ou
   non** (132 px) : choisir un monstre ne déplace ni le champ ni la liste.
   Les membres prennent leur hauteur jusqu'à 308 px, comme au téléphone,
   puis défilent (décision de l'utilisateur à l'arrêt 4 : plus haute que
   les quatre lignes d'avant) ;
2. **« Exemplaire »**, en tête de la colonne de droite en A3, sous les
   réglages en A1 et A2, section de 598 px au plus du panneau de droite
   (`ExemplaireBureau`) : les puces de source,
   la zone D en flottant (300 px de haut au plus, qui défile), puis
   la fiche ([equipement-actuel.md](equipement-actuel.md)).

## Au téléphone : trois blocs empilés

Un rendu à part (`MonstreEquipementTelephone`, dans la carte « Monstre &
équipement » que seul le téléphone affiche), pas un réagencement du bureau :

1. la recherche, toujours visible, avec en dessous la liste active dans le
   dépliement « Gérer mes listes », replié par défaut
   (`zoneCOpen`) ;
2. les puces, toujours visibles, avec la zone D **en ligne** dessous (le
   même `zoneDOpen` qu'au bureau ; un flottant se prête mal à un écran
   étroit), puis les cartes de la zone C quand « Gérer mes listes » est ouvert :
   un ajout agrandit la liste sous les puces sans déplacer celle qu’on vient de cliquer ;
3. la fiche `MonsterGear`, même composant qu'au bureau.

Dès que la ligne du monstre choisi, sous la recherche, sort de l'écran
(passée sous l'en-tête), le bouton flottant « Options » prend l'icône du
monstre devant la sienne ; elle s'en retire quand on remonte jusqu'à la
ligne. Elle entre en glissant depuis la gauche pendant que le bouton
s'élargit (500 ms), et ressort de même ; sans animation si le téléphone
demande moins de mouvement. Aucun autre élément n'apparaît à l'écran ; sans monstre choisi, ou
hors de l'Optimizer, le bouton garde sa seule icône.

