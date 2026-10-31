# Glossaire

Les mots du jeu, de l'app et du moteur, pour un nouveau contributeur. Chaque entrée donne une
définition courte, les autres noms du terme (libellé du jeu, nom anglais, nom dans le code) et la
fiche qui fait foi : les règles détaillées et les valeurs chiffrées restent dans les fiches.
« À éviter » signale un mot qui crée une confusion réelle.

## Jeu

### Runes

- **Set de runes** : famille de runes (Swift, Violent, Despair…) dont l'effet s'active quand le
  monstre en porte 2 ou 4, selon le set. L'app affiche les noms anglais du jeu.
  Code : `RUNE_SETS`, `set_id`. À éviter : les noms français (« Rapidité » pour Swift).
  → [feat-calcul-runes.md](../02-app/compte/feat-calcul-runes.md)
- **Intangible (rune)** : rune joker, qui compte comme une pièce de n'importe quel set pour le
  compléter. Code : `intangible`, `jokers`. Voir aussi Intangible (artéfact).
  → [elagages.md](../03-developpeur/optimizer/moteur/elagages.md)
- **Emplacement** : position 1 à 6 d'une rune sur le monstre ; les emplacements 1, 3 et 5 ont une
  stat principale fixe. Anglais : slot. Code : `slot`, `slot_no`.
  → [feat-calcul-runes.md](../02-app/compte/feat-calcul-runes.md)
- **Stat principale** : la stat que la rune porte d'office et qui monte avec son niveau.
  Anglais : main stat. Code : `main`, `pri_eff`.
- **Stat innée** : stat fixe que certaines runes portent en plus de la principale ; ni meule ni
  gemme ne la touchent. Anglais : innate, prefix. Code : `innate`, `prefix_eff`.
- **Sous-stat** : stat secondaire d'une rune, renforcée par les améliorations. Anglais : substat.
  Code : `subs`, `sec_eff`. Sur un artéfact : sous-propriété.
- **Meule** : consommable qui augmente une sous-stat existante. Anglais : grind. Code : `grind`.
  → [feat-calcul-runes.md](../02-app/compte/feat-calcul-runes.md)
- **Gemme** : consommable qui remplace une sous-stat par une autre. Anglais : enchanted gem.
  Code : `enchant`, `'gem'`.
- **Immémoriale (meule, gemme)** : une meule ou une gemme qui s'applique à une rune de n'importe
  quel set. Code : `craft_type` 3 et 4.
- **Antique** : une catégorie de runes et de consommables. Une rune antique peut avoir des rolls
  initiaux plus élevés qu'une rune ordinaire ; l'export la marque par une classe supérieure
  à 10. Une meule ou une gemme antique ne s'applique qu'à une rune antique, avec des valeurs de
  roll possibles plus élevées (`craft_type` 5 et 6). Anglais : ancient.
- **Grade** : rareté d'une rune, d'une relique ou d'un consommable, sur une échelle discrète
  (Commun, Magique, Rare, Héroïque, Légendaire). Code : `extra`, `rarity`. À éviter : « grade »
  pour les étoiles.
- **Étoiles** : la classe d'une rune, de 1 à 6 ★, qui fixe les valeurs de ses stats.
  Code : `class` (`rank` dans le modèle).
- **Niveau** : amélioration de +0 à +15. Code : `level`, `upgrade_curr`.
- **Roll** : chaque amélioration qui augmente une sous-stat (rune) ou une sous-propriété
  (artéfact). Code : `rolls`.

### Artéfacts et reliques

- **Artéfact d'Attribut, de Type** : l'artéfact d'Attribut suit l'élément du monstre, celui de
  Type son archétype. Code : `ArtifactKind`, `ArtifactArchetype`.
  → [feat-calcul-artefacts.md](../02-app/compte/feat-calcul-artefacts.md)
- **Intangible (artéfact)** : artéfact joker, qui s'équipe sur n'importe quel monstre ; un seul
  par paire d'artéfacts. Code : `intangible`, `artifactPairAllowed`. Voir aussi Intangible
  (rune).
- **Sous-propriété** : ligne secondaire d'un artéfact ; c'est le mot de l'écran, le code dit
  « ligne » (`LigneVerrouillee`).
- **Relique, propriété unique** : la relique est un équipement à part ; sa propriété unique n'est
  pas une sous-stat. Code : `RelicDetail`, `RelicUnique`.
  → [reliques.md](../03-developpeur/optimizer/moteur/reliques.md)

### Combat et vitesse

- **Jauge d'attaque** : barre de 0 à 100 % ; un monstre joue quand elle est pleine. Le code et
  les formules écrivent ATB. → [feat-formule.md](../02-app/speed-tuning/feat-formule.md)
- **Tick** : unité de temps du combat ; à chaque tick, la jauge d'attaque de chaque monstre avance
  en proportion de sa VIT de combat. Par extension, être « au tick n », c'est avoir la VIT qui
  remplit la jauge en n ticks : 239 de VIT pour le tick 6, 286 pour le tick 5. Code :
  `speedForTick`. → [feat-formule.md](../02-app/speed-tuning/feat-formule.md)
- **VIT de combat** : la VIT qui compte en combat, bonus de lead et de compétences d'invocateur
  compris. Code : `combatSpeed`. → [feat-calcul-vitesse.md](../02-app/transverse/feat-calcul-vitesse.md)
- **Leader skill, lead, leader** : la leader skill est l'effet que le leader d'une équipe donne à
  ses alliés ; le lead est cet effet (« lead VIT +24 % »), le leader le monstre qui le porte. Sa
  zone : General, Element, Arena, Guild, Dungeon. Code : `LeaderSkill`, `speedLeadOf`.
- **Lead actif (en siège), chef** : en siège, un lead de zone General ou Guild est actif, un lead
  d'élément l'est si un monstre de l'équipe est de cet élément ; Arena et Dungeon ne le sont pas.
  Le chef d'une équipe est son premier monstre, s'il a un lead actif : deux équipes aux mêmes
  monstres ne diffèrent que par lui. Code : `leadActifEnSiege`, `cleEquipe`, `siegeLeadFor`.
  → [modele.md](../02-app/siege/feat-recommandations/modele.md)
- **Compétences d'invocateur** : bonus de compte qui s'ajoutent aux stats en combat. À éviter :
  « totem ». → [feat-formules-et-combat.md](../02-app/degats-reels/feat-formules-et-combat.md)
- **Set d'aura** : set dont l'effet s'applique à toute l'équipe. Code : `aurasExternes.ts`.
  → [feat-effets-equipe-et-leaders.md](../02-app/degats-reels/feat-effets-equipe-et-leaders.md)
- **Bombe, ignore DEF, passif** : notions de la formule des dégâts réels.
  → [feat-bombes.md](../02-app/degats-reels/feat-bombes.md),
  [catalogue-des-passifs.md](../02-app/degats-reels/catalogue-des-passifs.md)
- **Abréviations des stats** : celles du jeu : PV, ATQ, DEF, VIT, Tx critiq., Dgts critiq., RES,
  Précision. Code : `StatKey` (`cr`, `cd`…), libellés dans `src/lib/effects.ts`. À éviter :
  « TC », « DCC », « Taux Crit », « Dmg Crit ».

### Contenus, équipes, monstres

- **RTA** : le mode de combat en temps réel. → [rta/](../02-app/rta/README.md)
- **Siège** : guerre de guilde, en défense et en offense. → [siege/](../02-app/siege/README.md)
- **Équipe** : les monstres qui combattent ensemble ; dans l'app, ils partagent une leader skill
  et des sets d'aura. Code : `SiegeTeam`.
- **Deck** : une équipe préparée d'avance, avec un runage défini, réutilisable tout de suite.
  À éviter : « deck » pour une simple équipe.
- **Preset de runes** : runage enregistré dans le jeu pour un monstre. À éviter : « préréglage »,
  réservé à l'Optimizer.
- **Box** : les monstres du compte ; dans l'Optimizer, aussi le pool de runes du compte, distinct
  de celui de la RTA. → [compte/](../02-app/compte/README.md)
- **Second éveil** : un éveil supplémentaire de certains monstres. Code : `secondAwaken`.
- **Transformation** : un monstre qui change de forme en combat (Bellenus, les Sœurs…) ;
  SWARFARM en donne deux entrées, l'app une seule fiche. Ce n'est pas un éveil.
  Code : `transformsTo`. → [bestiaire/](../02-app/bestiaire/README.md)

## App

- **Efficience** : mesure de la qualité d'une rune d'après ses rolls, obtenus ou potentiels.
  Code : `RuneMetric`. C'est aussi l'objectif par défaut de l'Optimizer ; les artéfacts ont leur
  propre efficience, sur une autre échelle. → [feat-calcul-runes.md](../02-app/compte/feat-calcul-runes.md)
- **Score SW** : le score d'une rune affiché dans le jeu, proposé à la place de l'efficience.
- **Potentiel d'optimisation** : ce qu'une rune gagnerait avec la meilleure gemme et la meilleure
  meule.
- **Objectif de recherche** : ce que l'Optimizer maximise : Efficience, PV effectifs, Vitesse ou
  Dégâts réels. Code : `Objective`.
  → [objectif-de-recherche.md](../02-app/optimizer/ecran/objectif-de-recherche.md)
- **PV effectifs** : PV et DEF considérés ensemble. Anglais : EHP. Code : `'ehp'`.
- **Dégâts réels** : les dégâts d'un sort sur un adversaire choisi, calculés par l'app.
  Code : `RealDamageContext`. → [degats-reels/](../02-app/degats-reels/README.md)
- **Bucket Additionnel** : un terme de la formule des dégâts réels. À éviter : le confondre avec
  le compartiment (bucket) de l'Optimizer.
  → [feat-artefacts-critique-et-element.md](../02-app/degats-reels/feat-artefacts-critique-et-element.md)
- **Combo de sets, principale imposée** : les sets et les stats principales que la recherche
  exige. → [set-et-principale.md](../02-app/optimizer/ecran/set-et-principale.md)
- **Runes imposées** : runes verrouillées sur un emplacement. → [feat-exclusion.md](../02-app/optimizer/feat-exclusion.md)
- **Préréglage** : dans l'Optimizer, le niveau de pré-filtrage (Bas, Moyen, Haut, Extrême ;
  `slotFilterCap`) ; dans la librairie UI, un composant prêt à l'emploi bâti sur `Bouton`.
  → [conditions-et-reglages.md](../02-app/optimizer/ecran/conditions-et-reglages.md),
  [fondation-et-prereglages.md](../03-developpeur/interface/librairie-ui/fondation-et-prereglages.md)
- **Build, candidat** : une combinaison de six runes proposée par l'Optimizer.
  Code : `BuildCandidate`. → [resultats.md](../02-app/optimizer/ecran/resultats.md)
- **Build validé, liste de travail, réservation** : un build retenu entre dans une liste, qui
  réserve ses runes pour les autres monstres de la liste.
  → [feat-listes-et-reservation.md](../02-app/optimizer/feat-listes-et-reservation.md)
- **Exemplaire** : un monstre précis du compte, quand on en possède plusieurs du même nom.
  → [equipement-actuel.md](../02-app/optimizer/ecran/equipement-actuel.md)
- **Prépa, ami** : la prépa RTA d'un joueur ; « ami » désigne celle d'un autre, importée.
  → [rta/](../02-app/rta/README.md)
- **Sections** : le classement des monstres par set en RTA.
  → [feat-sections-runes.md](../02-app/rta/feat-sections-runes.md)
- **Ordre de tour** : l'ordre de jeu recalculé avec les leads.
  → [feat-ordre-de-tour.md](../02-app/rta/feat-ordre-de-tour.md)
- **Speed tuning** : vérifier qu'une équipe joue dans l'ordre voulu, tick par tick.
  → [speed-tuning/](../02-app/speed-tuning/README.md), [feat-speed-tick.md](../02-app/siege/feat-speed-tick.md)
- **Adversaire de référence** : l'adversaire contre lequel le speed tuning se vérifie.
  → [feat-competences.md](../02-app/speed-tuning/feat-competences.md)
- **Recommandation, confrontation** : un deck décrit par un auteur, que les autres confrontent à
  leur compte. Code : `Reco`. → [feat-recommandations/](../02-app/siege/feat-recommandations/README.md)
- **Overcap** : un Tx critiq. au-delà de 100 %, que l'app affiche ou non selon un réglage.
- **Sauvegarde** : quatre choses distinctes. La **session** (Accueil, barre du haut) garde tout le
  travail dans un fichier ([feat-sauvegarde-session.md](../02-app/transverse/feat-sauvegarde-session.md)) ;
  le **point de sauvegarde** de l'Optimizer garde ses listes et ses équipes
  ([feat-listes-equipes-et-sauvegarde.md](../02-app/optimizer/feat-listes-equipes-et-sauvegarde.md)) ;
  **« Garder mes données »** décide si l'app conserve quoi que ce soit dans le navigateur
  ([persistance.md](../02-app/transverse/feat-import-compte/persistance.md)) ; la **sauvegarde
  RTA** exporte et partage une prépa ([feat-sauvegarde-partage.md](../02-app/rta/feat-sauvegarde-partage.md)).
- **Filet de temps** : le temps au-delà duquel l'Optimizer arrête sa recherche : 10 minutes, ou
  aucun avec « Recherche jusqu'à épuisement complet ». Code : `maxMs` (`HARD_TIMEOUT_MS`).
  → [feat-interruption.md](../02-app/optimizer/feat-interruption.md)

## Moteur et code

- **Meet-in-the-middle** : la recherche coupe les six emplacements en deux moitiés de trois,
  construit chaque côté, puis les apparie. → [elagages.md](../03-developpeur/optimizer/moteur/elagages.md)
- **Demi-build** : la combinaison de trois runes d'une moitié. Code : `HalfCombo`. À éviter :
  « moitié » pour le demi-build.
- **Compartiment** : groupe de demi-builds qui apportent le même compte de pièces de chaque set
  demandé et le même nombre d'Intangible ; deux compartiments dont les comptes complètent le
  combo s'apparient en bloc. Anglais : bucket. Code : `Bucket`, `bucketKeyOf`.
- **Appariement** : la mise en regard des compartiments des deux moitiés. Anglais : pairing.
  Code : `pairBuckets`. → [pipeline.md](../03-developpeur/optimizer/moteur/pipeline.md)
- **Morceau** : suite de lignes d'appariement consécutives (une combinaison A face à un
  compartiment B) confiée à un Worker d'appariement, à la demande. Code : `Morceau`,
  `parcourirMorceau` (piloté par tranches par `servirAppariement`). → [parallelisation.md](../03-developpeur/optimizer/moteur/parallelisation.md)
- **Paires traitées** : les paires que l'appariement a parcourues, jugées ou sautées par le
  noyau parce qu'elles échoueraient sûrement au test rapide. Code : `explored`.
  → [noyau-appariement.md](../03-developpeur/optimizer/moteur/noyau-appariement.md)
- **Paire** : en moteur, une paire de compartiments ; côté artéfacts, une paire d'artéfacts.
- **Élagage sûr** : ce qui écarte un candidat sans risque de perdre le meilleur (dominance,
  faisabilité). **Pré-filtrage heuristique** : ce qui garde les meilleures runes par
  emplacement, au risque d'en écarter une utile. Code : `pruneDominated`, `filterSlot`.
- **Budgets** : trois limites. Le budget de nœuds (illimité aujourd'hui) ; le budget de temps,
  qui est le filet de temps ; le budget de candidats, le nombre maximal de builds gardés
  (`MAX_COLLECTED`). Code : `overBudget`.
- **Régime séquentiel, parallèle** : l'appariement tourne sur un fil, ou sur plusieurs Workers
  quand la recherche est grande. → [parallelisation.md](../03-developpeur/optimizer/moteur/parallelisation.md)
- **Worker** : un fil de calcul du navigateur ; l'Optimizer en a pour la recherche, les moitiés,
  l'appariement parallèle et la résolution. → [pipeline.md](../03-developpeur/optimizer/moteur/pipeline.md)
- **Résolution** : le choix des artéfacts et de la relique d'un build déjà trouvé.
  Code : `artifactQueue.ts`, `relicQueue.ts`.
- **Quasi-succès** : le build le plus proche quand aucun ne remplit les conditions. Anglais :
  near-miss. On dit ce qui « suffirait », jamais ce qui « manque ».
  → [diagnostics.md](../03-developpeur/optimizer/moteur/diagnostics.md)
- **Conditions bloquantes** : les conditions qui empêchent tout résultat.
  Code : `rankBlockingConditions`.
- **Recette** : une recherche de l'Optimizer exportée en fichier, rejouable par les scripts.
  Code : `OptimizerRecipe`. → [harnais/](../03-developpeur/optimizer/harnais/README.md)
- **Harnais, oracle, différentiel** : les outils qui vérifient le moteur.
  → [verification/README.md](../03-developpeur/optimizer/verification/README.md)
- **`jumeauCollab`** : lien entre la version Summoners War et la version collab d'un monstre ;
  ils ont la même mécanique. → [valeurs-de-jeu-curees.md](../02-app/degats-reels/valeurs-de-jeu-curees.md)
- **`com2us_id`** : l'identifiant d'un monstre dans le jeu, qui relie l'export de compte aux
  données. Écrit `com2usId` dans le code.
- **SW Exporter** : l'outil qui produit l'export de compte. À éviter : « SWEX ».
  → [feat-import-compte/](../02-app/transverse/feat-import-compte/README.md)
- **SWARFARM** : la base publique d'où viennent les données de monstres et de compétences.
  → [feat-donnees-monstres.md](../02-app/transverse/feat-donnees-monstres.md)
