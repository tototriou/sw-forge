# Objectif de recherche

**Statut :** ÉTAT ACTUEL — décrit la carte « Objectif de recherche » et ses quatre objectifs
**Lire si :** on modifie l'objectif de recherche, le réglage « Dégâts réels » ou le garde-fou de revalidation des listes

3. **Objectif de recherche** — en tête de la **carte du bouton
   Rechercher**, au-dessus de la rangée Rechercher / Exporter / Importer.
   ⚠️ Il a longtemps été une carte à part, à droite de « Critères de
   recherche » : c'était nécessaire tant qu'il portait la description du
   combat de « Dégâts réels », qui a besoin de place. Celle-ci ouverte en
   fenêtre, il ne reste qu'un bouton à choix unique, et il rejoint le geste
   qu'il qualifie. Ce qui n'a pas changé : ce n'est **pas** un champ de
   « Critères de recherche » — l'objectif se choisit avant même de composer
   le set, ce n'est pas un critère de plus parmi d'autres. **Un bouton à
   choix unique** (`<Segmented
   size="lg">`), choisi **avant** de lancer la recherche, pas seulement un tri
   après coup :
## Garde-fou de revalidation contre un compte vide
   ⚠️⚠️ **ON NE REVALIDE JAMAIS LES LISTES CONTRE UN COMPTE VIDE**
   (`comptePeutJuger`, [optimizerExclusion.ts](src/lib/optimizerExclusion.ts)).
   La revérification répond à « mon compte a-t-il changé depuis » ; face à un
   compte sans monstre ni rune, elle ne peut répondre qu'une chose — plus rien
   ne résout, donc **tout est jeté** — et cette réponse-là n'est jamais la
   bonne : un compte vide veut dire « pas encore chargé », pas « tes monstres
   ont disparu ». Le résultat étant **écrit sur disque**, la perte est
   définitive.
   - Symptôme observé : à **chaque rechargement de page**, les listes
     survivaient mais leur CONTENU disparaissait — `replaceMembersAndValidated`
     vide les membres et les builds sans toucher aux listes elles-mêmes.
   - Cause : `React.StrictMode` monte le composant **deux fois** en
     développement. Le garde-fou d'`App.tsx` (`boxMountedRef`) ne protège que
     le PREMIER passage de l'effet ; le second revalidait avec `box` et `runes`
     encore vides.
   - ⚠️ **La garde vit sur la DONNÉE, pas sur un compteur de rendus.** Un
     garde-fou qui compte les passages d'un effet est battu par StrictMode, par
     un remontage, ou par le prochain qui réorganise les effets. Celui-ci tient
     quoi qu'il arrive en amont — et il est **testable**, donc testé (dont le
     contrôle qui montre que sans lui, tout part).
   - ⚠️⚠️ **« Le compte » = LA BOX ET LES RUNES, jamais RTA ni le siège.** Une
     première version acceptait « n'importe quelle source non vide » — elle
     passait donc toujours : RTA et le siège sont des états persistés **à part**,
     rendus dès le premier rendu, tandis que le compte se relit en **asynchrone**
     (`loadAccount()`). Mesuré sur le cas réel, au second passage d'effet de
     StrictMode :

     ```
     revalidation lancée — box=0 runes=0 rta=40 siegeDef=3 siegeOff=49 membres=1
     ```

     Le garde-fou laissait passer, la revérification jetait le membre, et
     l'écriture suivante le perdait pour de bon. C'est bien contre la **box**
     que les sélecteurs se résolvent, et contre les **runes** que les builds se
     vérifient : une source annexe chargée ne dit rien de la disponibilité de
     celles-là.

   ⚠️⚠️ **UN OBJECTIF RETIRÉ SURVIT DANS LES SCRIPTS.** `'degats'` a été sorti
   d'`Objective`, mais il restait le DÉFAUT de dix scripts CLI/diag, en cast
   `as Objective`. Or `objectiveKeysOf` retombe sur `[]` pour une valeur absente
   de la table : ces scripts mesuraient donc **sans aucun biais de
   pré-filtrage**, alors qu'ils sont précisément là pour le mesurer — le
   validateur différentiel comparait deux moteurs dans des conditions qui
   n'étaient plus celles de l'app, et **rien ne le disait**.
   - Le repli vit en **un seul endroit** (`scripts/lib/objectifCli.ts`) et
     **reproduit l'ancien comportement** : `'degats'` → `efficience` +
     `objectiveStats: ['atk', 'cd']`, l'équivalence déjà retenue par
     `perfShared.ts`. Mesurer « sans biais » aurait changé la question posée,
     silencieusement.
   - La valeur reste acceptée **en ligne de commande** : c'est une compatibilité
     d'argument, pas un objectif de l'app.
   - ⚠️⚠️ **`tsconfig.json` couvre `src`, `scripts` et `tests`**
     (`"include": ["src", "scripts", "tests"]`) : `tsc --noEmit` attrape
     désormais un champ partagé dont le type change ou qui devient
     obligatoire. Les dix casts étaient passés quand le périmètre se limitait
     à `src` — et le code le savait déjà (`filterSlot` porte l'avertissement
     « incident déjà vécu deux fois »). Reste hors de portée de `tsc` le
     champ **OPTIONNEL** ajouté ou renommé, où l'oubli reste parfaitement
     typé : **`grep` du nom sur tout le dépôt** (`src/`, `scripts/`,
     `tests/`), voir CLAUDE.md, « Un type partagé… ».

## Les quatre objectifs disponibles
   - **Efficience** (par défaut) — pas de biais particulier, la mesure
     choisie globalement (Efficience ou Score SW, voir
     [compte/runes.md](../../../compte/runes.md)).
   - **PV effectifs** — considère PV et DEF ensemble. Les auras Enhance et
     Determination apportent chacune 8 % de leur base au score, à son tri et
     à sa comparaison, sans ajouter les autres bonus de début de combat —
     celles des autres monstres comme celles que forment les runes de chaque
     build, dans un seul arrondi.
   - **Vitesse** — VIT seule.
   - **Dégâts réels** — la **vraie formule d'un sort précis** contre un
     adversaire configuré, pas une espérance générique. Modèle de calcul
     détaillé : [degats-reels.md](../../degats-reels.md). Choisir cet objectif
     **ouvre** son réglage, dans une fenêtre par-dessus l'écran
     ([DamageSetupModale.tsx](src/components/outils/DamageSetupModale.tsx),
     qui porte la même carte qu'avant) — et rien ailleurs à l'écran ne
     change. Une fois la fenêtre fermée, une **ligne de résumé** prend sa
     place sous l'objectif : `S1 Flying Cards · élément ignoré · PV 30 000 ·
     DEF 1 000 · Critique`. On la clique pour rouvrir.
     La partie 2 de l'audit ajoute dans cette fenêtre les PV propres, les
     ennemis vivants, la réserve de Sacrifice, les comparaisons de stats et
     les états de combat propres au monstre choisi. Les compteurs de débuffs
     ennemis s'arrêtent à 10 ; les conditions binaires utilisent un
     interrupteur activé automatiquement par Brise DEF ou Marque. Ces choix
     traversent recette, CLI, Worker, score de recherche et évaluation des
     artéfacts ; les anciennes recettes conservent leurs valeurs par défaut.
     Les buffs sur soi ont le même compteur plafonné à 10 : les interrupteurs
     ATQ, DEF et VIT actifs s'ajoutent automatiquement aux autres buffs saisis.
     Une ancienne recette garde son total inclusif, sans double comptage.
     - ⚠️ **Le résumé dit le sort RÉELLEMENT utilisé**, pas celui qu'on
       avait choisi. Un sort appartient à un monstre : après un changement
       de monstre, le calcul retombe sur le sort par défaut du nouveau. Tant
       que le réglage était déplié on le voyait ; derrière une fenêtre
       fermée, afficher l'ancien choix ferait croire à un calcul qui n'a pas
       lieu.
     - ⚠️ **Le résumé ne montre QUE ce que le sort consomme**, exactement
       comme la fenêtre. Sur un sort qui **ignore la défense**, le champ DEF
       n'existe pas dans la fenêtre — et il disparaît donc du résumé : `S3
       Amputation Magic · élément ignoré · PV 30 000 · Critique`. Une
       première version l'affichait en dur, donnant « DEF 1 000 » sur un sort
       qui n'en tient aucun compte, signalé à l'usage. Les deux lectures
       viennent désormais d'un seul prédicat (`champsDuCombat`,
       [damage.ts](src/lib/damage.ts)) : deux copies avaient déjà divergé.
     - **La cible calculée de Blade Surge, quand ce n'est pas la cible
       visée.** Le cran « Dégâts sur les autres ennemis » ajoute un bout
       juste après le sort : `S1 Blade Surge · autres ennemis · élément
       ignoré · PV 30 000 · DEF 1 000 · Critique`. Comme pour le sort, c'est
       la cible que RETIENT le calcul pour le sort résolu
       (`resumeCibleDegatsRetenue`, qui lit `cibleDegatsRetenue`), jamais
       la valeur stockée : rien pour la cible visée (le défaut), rien pour
       un autre sort, même sous une clé posée à la main. Le texte est la fin
       du libellé du cran, écrit une seule fois (degats-et-aura 8c).
     - **Pas de buffs dans ce résumé** : ils ne sont plus dans la fenêtre
       qu'il rouvre, et ont leurs propres contrôles toujours visibles dans
       « État de mon monstre ».
     - ⚠️ **Choisir l'objectif ouvre la fenêtre, il ne fait pas que la
       révéler.** Auparavant le réglage se dépliait sous l'objectif et rien
       n'obligeait à le regarder : on pouvait classer des milliers de builds
       sur un sort, une cible et un mode de critique jamais choisis. Le
       geste est désormais explicite.

## Dégâts réels — compétence utilisée et passifs offensifs
     Ce que contient ce réglage :
     - **Compétence utilisée** — les sorts offensifs du monstre, chacun
       accompagné de ce que ses données disent déjà (« 3 coups · Zone ·
       Ignore la DEF · +30 % (compétence maxée) »). ⚠️ **Rien de tout cela
       ne se saisit** : coefficient, coups, portée, ignore défense, dégâts
       fixes et bonus des améliorations sont lus dans la fiche du sort. Un
       sort dont les coups n'ont pas tous la même formule ni la même portée
       (Blade Surge) affiche sa séquence curée (« 0.5 × ATQ puis 3.0 × ATQ ·
       2 coups · Cible unique, puis 1 coup · Zone »). ⚠️ **Seule exception,
       un choix et non un paramètre** : pour un sort dont la séquence curée
       porte un coup de zone (`cibleSecondairePriseEnCharge`, Blade Surge
       seulement), un `Segmented` à deux crans apparaît sous la liste des
       sorts, au même endroit que le champ des coups variables — « Dégâts
       sur la cible visée » (défaut, les trois coups) et « Dégâts sur les
       autres ennemis » (le coup de zone seul, sur UN autre ennemi). Les
       champs de l'adversaire décrivent alors cet autre ennemi ; aucun champ
       nouveau. Le résumé des sorts ne lit pas le cran : basculer ne fait
       bouger ni le texte au-dessus, ni le contrôle (degats-et-aura 8b,
       réglage `cibleDegatsParSort`) ; la ligne de résumé sous l'objectif,
       elle, dit « autres ennemis » quand ce cran est retenu (8c, voir
       « Les quatre objectifs disponibles » ; détail :
       [degats-reels/sequences-de-coups.md](../../degats-reels/sequences-de-coups.md)). Par
       défaut, le dernier slot calculable parmi les sorts actifs (S3 avant
       S2 avant S1). Un passif curé « sélectionnable comme sort » figure
       aussi dans la liste, calculé seul et une seule fois — Tempest (S3) de
       Teshar, nom du jeu « Tempest (Passive) » —, mais n'est jamais le sort
       par défaut : Teshar reste sur S2 (degats-et-aura 9b, réponse n° 9 de
       l'utilisateur du 2026-10-02 ; détail
       [degats-reels/attaque-apres-un-sort.md](../../degats-reels/attaque-apres-un-sort.md)). Un sort
       dont la formule sort du modèle reste **affiché, grisé, avec son
       motif** — jamais absent sans explication. ⚠️ **La description du jeu
       de chaque sort, même grisé, s'ouvre au CLIC** sur un « ? » posé
       juste à droite de son nom — bulle à la souris, panneau montant au
       doigt (`HelpPopover`) —, plus au survol : un `title` natif ne
       s'ouvre jamais au doigt, elle restait invisible sur téléphone
       (degats-et-aura 11bis, demande de l'utilisateur du 2026-10-02). Le
       « ? » vit dans la case mais HORS de son bouton (axe `actionTitre`
       d'`Option`, [librairie-ui.md](../../../shared/librairie-ui.md)) : le
       toucher ne choisit pas le sort, et la case ne bouge pas. Un sort
       sans description n'a pas de « ? » ; elle reste annoncée aux
       lecteurs d'écran par le bouton de la case (`aria-description`). Les conditions « buff
       adverse présent/absent » sont des interrupteurs, contrairement aux
       bonus proportionnels au nombre de buffs. ⚠️ **Coups variables** (« 2
       à 3 fois », Sia — Great Friends ; « 3 à 5 fois », Okeanos S3) : un
       champ numérique borné apparaît sous le sort choisi (ou sous le passif
       concerné) pour choisir la valeur réellement utilisée par le calcul —
       `Competence.coups` ne porte qu'un seul nombre en donnée, pas fiable
       pour ces sorts-là. Détail : [degats-reels/passifs-offensifs.md#coups-variables--un-sortpassif-qui-frappe-un-nombre-de-fois-qui-change-en-jeu](../../degats-reels/passifs-offensifs.md#coups-variables--un-sortpassif-qui-frappe-un-nombre-de-fois-qui-change-en-jeu),
       « Coups variables ». Un champ **Attaques reçues avant ce sort**
       (0 par défaut) n'apparaît que pour l'unique sort connu dont le
       coefficient dépend d'un compteur de combat (Crawler/Frankenstein —
       « Hammer Punch »). Détail : [degats-reels/catalogue-des-passifs.md#quatrième-vague--point-25--formule-bespoke-selon-un-compteur-crawler](../../degats-reels/catalogue-des-passifs.md#quatrième-vague--point-25--formule-bespoke-selon-un-compteur-crawler),
       « formule bespoke selon un compteur ». ⚠️ **L'ignore DEF des six
       sorts Blade Dancers se choisit** : ils n'ignorent la DEF qu'une fois
       la jauge d'attaque de la cible à 0, que l'app ne modélise pas. Pour
       eux seulement, un sélecteur **« Ignore la DEF (jauge de la cible à
       0) »** apparaît sous la liste : « Aucun » (défaut), « Dès le 2ᵉ
       coup », « Dès le 3ᵉ coup » pour les sorts à 3 coups ; « Dès le 2ᵉ
       coup » à « Dès le 6ᵉ coup », puis « 7ᵉ coup seul » (défaut) pour les
       sorts à 7 coups. Le résumé du sort dit le cran retenu sur une ligne à
       lui, d'une ligne de haut quel que soit le cran — en changer ne
       déplace pas le sélecteur —, et la DEF de la cible reste affichée dans
       tous les crans (degats-et-aura 10b). Détail :
       [degats-reels/formules-et-combat.md](../../degats-reels/formules-et-combat.md),
       « Ignore DEF à partir d'un coup choisi ».
     - **Passifs offensifs** — n'apparaît que si le monstre en a un
       (Feng Yan, Sia, Roid, Dominic, Ciri, Sonia, Momo, Chun-Li, Lizardman,
       Jin Kazama…) : des dégâts **en plus** du sort choisi ci-dessus, OU un
       modificateur sur l'ensemble de ses dégâts, via un passif reconnu
       (liste à la main, voir [degats-reels/passifs-offensifs.md#passifs-offensifs--dégâts-supplémentaires-au-delà-du-sort-choisi](../../degats-reels/passifs-offensifs.md#passifs-offensifs--dégâts-supplémentaires-au-delà-du-sort-choisi)). Un passif
       **toujours actif** (le texte du jeu ne pose aucune condition)
       apparaît en jeton simple, sans bouton — y compris un modificateur
       sans formule propre (crit garanti si plus rapide, bonus continu
       selon l'écart de VIT, Taux Crit selon la VIT, bonus flat de Taux
       Crit/Dgts Crit). Un passif **bonus** ou **conditionnel**, ou un
       modificateur sans formule propre soumis à une condition que l'app ne
       peut pas déduire (PV propres, état d'un allié, tour précédent…),
       apparaît en **interrupteur** (glissière, comme « Stats de base
       exclues »), **désactivé par défaut** — signalé par l'utilisateur :
       une pilule cliquable (`Pastille`) ne distinguait pas assez la CIBLE
       du clic (l'icône + le libellé) du paragraphe de condition juste en
       dessous, purement informatif. Un passif dont le bonus S'ACCUMULE en
       combat sans que l'app ne puisse le savoir (Momo) apparaît avec un
       **champ numérique** (0 % par défaut) plutôt qu'un interrupteur.
       ⚠️ **Jamais déduit d'un autre
       réglage de l'écran** (le passif d'un monstre peut dépendre de l'état
       posé par son **propre** sort, avant même que ce sort ne soit lancé :
       aucun réglage existant ne peut trancher ça à sa place) — la condition
       et le texte du jeu (`Competence.description`) sont affichés **en
       clair sous chaque passif**, pas seulement au survol, pour que le
       joueur juge lui-même. Pour un passif qui frappe **après certains
       sorts** (Tempest), la condition EST le libellé de l'interrupteur :
       « **Tempest (S3) se déclenche après ce sort** », désactivé par défaut
       (réponse n° 11 de l'utilisateur du 2026-10-02), à la place de la
       phrase « Se déclenche si … », et **sans survol** (`title`) : un
       survol n'existe pas au doigt (décision du 2026-10-02, degats-et-aura
       9d) ; le texte du jeu reste sous l'interrupteur. Un passif
       n'apparaît que s'il peut suivre le sort choisi : l'interrupteur de
       Tempest est **masqué**
       quand Tempest est lui-même la compétence choisie (réponse n° 10).
## Dégâts réels — adversaire, effets actifs et coup critique
     - **Adversaire** — PV et DEF. ⚠️ Les **PV ne classent rien** : ils ne
       servent qu'à lire le résultat (« 42 % des PV », « tue la cible »).
       Un champ **PV restants** n'apparaît que pour les sorts dont la
       formule lit les PV courants de la cible. Un champ **Effets sur la
       cible** (0 par défaut) n'apparaît que pour les rares sorts dont les
       dégâts augmentent par effet présent sur l'adversaire (Julie, Melissa)
       — l'app ne simule aucun effet réel sur la cible. Détail :
       [degats-reels/catalogue-des-passifs.md#troisième-vague--points-4-et-5--bonus-selon-les-effets-sur-la-cible](../../degats-reels/catalogue-des-passifs.md#troisième-vague--points-4-et-5--bonus-selon-les-effets-sur-la-cible), « bonus selon les effets sur la
       CIBLE ». ⚠️ **VIT adversaire** +
       **leader skill VIT** : apparaissent pour un sort/passif qui dépend de
       l'écart de vitesse (`{Relative SPD}`, ignore-DEF proportionnel à
       l'écart, un monstre qui force le critique s'il est plus rapide, ou
       majore tous ses dégâts selon cet écart — même quand le sort CHOISI ne
       lit pas cette variable, ex. n'importe quel sort de Sonia) ; un
       artéfact « Effet aug. VIT » équipé et un éventuel critique/bonus de
       dégâts garanti sont, eux, **déduits et affichés**, jamais redemandés.
       Détail : [degats-reels/passifs-offensifs.md#vit-de-ladversaire--relative-spd-et-lignore-def-proportionnel](../../degats-reels/passifs-offensifs.md#vit-de-ladversaire--relative-spd-et-lignore-def-proportionnel), « VIT de l'adversaire ».
     - **Effets actifs** — effets subis par la cible (réduction de défense
       ×0,3, marque +25 %, « ce sort pose le def break » — distingue
       « attaque une cible déjà réduite » de « réduit puis frappe », les
       deux mitigations ne sont pas identiques), chacun son **icône de jeu
       cliquable**, pas
       une case à cocher séparée. ⚠️ **Grisée au repos, en couleurs + coche
       une fois
       activée** — l'état se lit sur l'icône elle-même, sans avoir à cliquer
       pour comprendre la légende (au repos, tout est grisé : rien n'est
       encore choisi). Le survol décrit l'effet complet, pas seulement son
       nom. ⚠️ **L'infobulle « ? » de la rangée regroupe ces MÊMES
       descriptions**, pour les seuls effets affichés pour le sort choisi :
       une seule liste (`effetsActifs`,
       [DamageSetupCard.tsx](../../../../src/components/outils/DamageSetupCard.tsx))
       rend les vignettes et l'infobulle, jamais un texte écrit à côté —
       celui d'avant citait encore les buffs ATQ/DEF/VIT partis dans « État
       de mon monstre ». Au doigt, où le survol n'existe pas, c'est elle
       qui donne les descriptions ; à la souris, le survol de chaque
       vignette reste en complément (degats-et-aura 11bis, décision de
       l'utilisateur du 2026-10-02 : une seule infobulle, pas une par
       effet). **Six effets d'ÉQUIPE** (Euldong, Mirinae, Deborah,
       Miriam, Dr. Matteo, Velaska — un AUTRE monstre que celui optimisé),
       même contrôle mais **portrait du monstre** en icône plutôt qu'une
       icône de buff générique. ⚠️ Velaska porte en plus un **champ
       numérique** (% de PV perdus, 0 par défaut) qui n'apparaît que si son
       effet est activé. Détail des mécaniques :
       [degats-reels/effets-equipe-et-leaders.md#effets-déquipe-euldong-mirinae-deborah-miriam-dr-matteo-velaska](../../degats-reels/effets-equipe-et-leaders.md#effets-déquipe-euldong-mirinae-deborah-miriam-dr-matteo-velaska), « Effets d'équipe ».

       ⚠️ **Les buffs ATQ/DEF/VIT et le leader skill n'y sont plus** — voir
       « État de mon monstre » ci-dessous.
     - ⚠️ **Compétences d'invocateur : parties ailleurs**, voir « État de mon
       monstre ». Rappel de ce qu'elles font : **Combat** (défaut) /
       **Combat + Guilde**, remplaçant les anciens totems et
       drapeaux, toujours supposées maxées. **Un choix unique, pas deux
       cases** : l'onglet Guilde ne s'applique qu'en contenu de guilde, où
       Combat compte aussi — « Guilde » implique donc toujours « Combat ».
       Il n'existe pas de cran « Aucune » : les compétences de Combat
       s'appliquent dans toute situation réelle du jeu. Une ancienne recette
       qui portait ce cran est normalisée vers **Combat** à l'import.
       La compétence « Puis. d'att. de <élément> » suit l'élément du
       monstre, sans rien demander. Détail des valeurs :
       [degats-reels/effets-equipe-et-leaders.md#leader-skill-déquipe](../../degats-reels/effets-equipe-et-leaders.md#leader-skill-déquipe).
     - **Coup critique** — Critique (défaut, le plafond d'un coup isolé) /
       Non critique (le plancher). Si le sort garantit son critique, ou si
       le réglage actif remplit sa condition de critique garanti, le cran
       Non critique est grisé et non sélectionnable. L'ancien mode
       « Moyenne » (espérance sur le Taux Crit) est supprimé.
     ⚠️ **On n'affiche que ce que le sort CONSOMME** : un sort qui ignore la
     défense ne montre ni la DEF ennemie ni la réduction de défense ; un
     sort qui ne dépend pas de la VIT ne montre pas le buff de vitesse. Un
     champ visible mais sans effet est pire qu'un champ absent — il fait
     croire à une action.
     ⚠️ Contrairement aux trois autres objectifs, ses stats pertinentes
     **dépendent du sort** (`{ATK}`, `{ATK}×({SPD}+70)/30`, `0.2×{MAX HP}`…)
     et ne tiennent donc pas dans une table statique : l'écran les calcule
     (`damageRelevantStats`) et les transmet au moteur via
     `SearchParams.objectiveStats`. Le moteur, lui, reste générique — il
     reçoit « ces stats comptent plus », jamais la notion de sort. L'entrée
     `degats_reels` de la table statique n'est qu'un REPLI (`['atk','cd']`)
     pour le cas « aucun sort résolu ». ⚠️ `objectiveScore` exige un
     `RealDamageContext` pour cet objectif et **lève** sans lui — jamais un
     repli silencieux vers une autre formule : un score plausible mais
     calculé sur un autre modèle que celui affiché serait invisible.
## Repli et objectifs retirés
     ⚠️ **Aucun sort calculable** (monstre perso, fiche absente, formules
     hors modèle) : l'option « Dégâts réels » **disparaît purement et
     simplement** du bouton à choix unique (`OBJECTIVE_LABELS` filtré sur
     `realDamage`, résolu) — jamais proposée puis désactivée, ni de repli
     silencieux vers un autre objectif ; il reste Efficience/PV
     effectifs/Vitesse.
   ⚠️ **« Speed nuker » a été retiré** (remplacé par « Dégâts réels »), et
   **« Dégâts » (formule générique `ATQ × (1 + TC × DC)`, sans sort ni
   adversaire) l'a été à son tour** une fois « Dégâts réels » mature —
   approximation devenue strictement inférieure du même besoin, un choix
   supplémentaire qui faisait juste hésiter entre les deux pour un objectif
   offensif. « Dégâts réels » répond mieux à ce besoin quand le sort
   utilisé dépend effectivement de VIT (ex. Lagmaron, `ATQ × (VIT + 70) /
   30`) : la vraie formule, VIT comprise, sert alors au tri — pas seulement
   au pré-filtrage. Une recette exportée pendant la durée de vie de l'un ou
   l'autre objectif porte encore sa valeur retirée — traduite à l'import
   vers « Efficience » (jamais « Dégâts réels », qui exige un sort et un
   adversaire résolus, hors de portée d'un simple import).
   ⚠️ L'objectif choisi oriente le **pré-filtrage** (quelles runes ont une
   vraie chance d'être considérées) et le **tri par défaut** des résultats
   (modifiable ensuite) — il **n'influence pas** le classement des candidats
   pendant la recherche elle-même : seuls les minimums/maximums posés
   ci-dessous en décident, quel que soit l'objectif choisi.
