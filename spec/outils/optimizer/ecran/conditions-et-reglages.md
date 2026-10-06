# Conditions, inventaire et réglages avancés

**Statut :** ÉTAT ACTUEL — décrit les conditions, l'inventaire et les réglages avancés
**Lire si :** on modifie les minimums et maximums de stats, l'inventaire ou le panneau « Réglages avancés »

7. **Conditions** — les 8 stats (PV, ATQ, DEF, VIT, Taux Crit, Dmg Crit, RES,
   Précision). Chaque stat porte **deux champs, minimum et maximum**, tous
   deux facultatifs — champ vide = pas de contrainte. **Colonne DROITE** de
   « Critères de recherche », qu'elle occupe seule : « Artéfacts et
   reliques » est une carte à part (voir artefacts.md § Place de la carte à l'écran).
   - **Interrupteur « Stats de base exclues »**, activé par défaut : n'affecte
     que PV, ATQ, DEF et VIT — ces 4 stats ont une base qui grandit avec le
     niveau/l'éveil ; activé, le champ porte sur ce que l'**équipement**
     (runes et artéfacts) doit apporter au-dessus de la base nue. Désactivé,
     il porte sur le total. Taux Crit/Dmg Crit/RES/Précision restent
     TOUJOURS en total, quel que soit ce réglage — elles partent d'une petite
     valeur d'éveil fixe plutôt que d'une base qui grandit ; leur champ
     **évolue selon la valeur d'éveil du monstre** (repère affiché en
     `placeholder`), pas selon ce réglage. « Bonus apporté par
     l'équipement » se lit comme en jeu : un monstre sans la moindre rune
     mais avec deux artéfacts ATQ +100 affiche déjà +200 de bonus ATQ, pas 0.
   - ⚠️ **La valeur stockée ne change jamais de nature** : c'est une lecture
     dérivée (`total − base`, `base` = la base NUE du monstre, jamais les
     artéfacts) recalculée à l'affichage, pas une conversion appliquée une
     fois puis oubliée. Désactiver l'interrupteur change donc immédiatement
     les 4 champs concernés (sans perte), et **saisir** une valeur pendant
     qu'il est activé l'enregistre convertie en total (`base + valeur
     saisie`) — la valeur saisie représente le bonus **équipement complet**
     (runes et artéfacts additionnés), pas les runes seules : soustraire
     aussi les artéfacts aurait mélangé deux référentiels (`base` reste la
     base nue dans la conversion, seul le PLANCHER ci-dessous change selon
     les artéfacts comptés). Sans monstre sélectionné, la base vaut 0 : les
     deux lectures coïncident.
   - ⚠️ **Aucun champ ne descend sous ce qui est garanti sans la moindre
     rune** — le plancher, pas la valeur de conversion ci-dessus. La
     contribution d'artéfact se calcule séparément par emplacement :
     l'artéfact réellement porté si le choix est « Garder l'artéfact
     équipé », la principale imposée si elle est choisie, et zéro si le
     choix est « Libre ». Pour la relique, seule une pièce réellement portée
     avec le choix « Garder la relique équipée » garantit sa principale en
     PV %, ATQ % ou DEF % : `ceil(base × valeur / 100)`, comme dans
     `computeStats`. Une principale forcée, « Libre » ou l'absence de relique
     garantit zéro. La contribution de relique ne modifie jamais Taux Crit,
     Dmg Crit, RES ou Précision. L'optimisation coupée conserve les deux
     artéfacts portés. En lecture Total, le plancher ajoute ces contributions
     à la base nue ; en lecture « bonus », il garde seulement ces
     contributions. Les choix « Libre » ne garantissent donc aucun bonus
     d'artéfact ni de relique, même si une paire représentative en montre.
     « Stats de base
     exclues » ne s'applique qu'à PV/ATQ/DEF/VIT : Taux Crit, Dmg Crit, RES
     et Précision restent toujours des totaux. Affiché en `placeholder`
     tant que rien n'est saisi.

## Grille des conditions

   - **Grille en `w-fit`**, un seul triplet (libellé/Min/Max) par rangée,
     même au-delà de `2xl` — **jamais DEUX stats par rangée** : le triplet
     Min/Max reste la lecture
     attendue, pas un doublement de densité. Cause du `w-fit` : un conteneur
     `grid` en BLOC prend toute la largeur de son parent, et des colonnes
     `auto` (Min/Max) sans aucune piste en `fr` **se partagent l'espace libre
     restant** — la phase « maximize tracks » de CSS Grid, pas un bug.
   - **Largeur des champs alignée pixel pour pixel** entre les 8 stats, via
     `NumberField`, prop `boxWidth` (`w-24` sur les 16 champs de la grille) :
     la largeur **totale** du contrôle (boutons + champ + suffixe compris)
     est fixée d'avance, et c'est le champ texte lui-même qui devient
     flexible (`flex-1`) pour absorber la différence quand un suffixe `%`
     est présent. ⚠️ Réduire seulement la largeur du champ texte ne suffit
     **pas** : le suffixe prend de la place
     EN PLUS dans le contrôle, donc à largeur de texte égale un champ avec
     `%` reste toujours plus large qu'un champ sans — seule une largeur
     totale fixée en amont garantit l'alignement.
   - Taux Crit, RES et Précision sont plafonnés à 100 % **sur la saisie**
     seulement — la recherche elle-même ne doit surtout pas exclure un build
     dont la somme brute dépasse 100 % (une marge de sécurité contre la
     précision/résistance adverse reste un résultat légitime).
   - ⚠️ **Un maximum saisi SOUS le minimum retombe au défaut de la case** :
     la condition serait insatisfaisable par construction,
     et la recherche renverrait « 0 build » sans que rien ne dise pourquoi.
     - À la **sortie du champ**, jamais à la frappe : on ne saurait pas
       distinguer un « 5 » définitif d'un « 50 » en cours d'écriture. C'est le
       même piège que celui que `NumberField` documente déjà pour le bornage par
       `min` — d'où un axe `onBlur` ajouté au composant, réservé aux règles qui
       lient DEUX champs (borner celui-ci reste le travail de `min`/`max`).
     - Le champ est **effacé**, pas remonté à la valeur du minimum : il retrouve
       ainsi son placeholder, donc son défaut (le plafond pour une stat bornée à
       100, « aucun maximum » sinon). Le corriger en « max = min » poserait une
       contrainte que personne n'a demandée, et qui ne laisse passer qu'une
       seule valeur.
   - Le modèle des auras accepte les auras des **autres** monstres de
     l'équipe dans `DamageSetup.setsAuraExternes`, 15 sets au plus (voir
     [effets d'équipe](../../degats-reels/effets-equipe-et-leaders.md)) ; une
     recette portant l'ancien total d'équipe `setsAura` non vide est refusée.
     Les activations propres des runes de chaque build s'y ajoutent dans le
     combat et le score (dégâts, PV effectifs, exclusives de relique, choix
     des artéfacts et de la relique, tri et comparaison).
     `compterAurasResPre`, activé par défaut, ajoute les points d'aura RES
     et PRE aux **minimums et maximums** : part externe et activations
     Tolerance/Accuracy propres du build, testées sur leur valeur réelle par
     les contrôles exacts (filtre final de l'appariement, filtres de paire et
     de relique) ; désactivé, aucune aura n'y compte, et il ne change pas les
     dégâts ni les PV effectifs. Les élagages sûrs de la recherche en
     tiennent compte : potentiel favorable pour un minimum,
     seul l'inévitable pour un maximum, sans jamais écarter un build valide ;
     le pré-filtrage et la rétention restent heuristiques et ne valorisent
     pas l'aura propre. Les auras PV/ATQ/DEF ne comptent dans aucune
     condition. Les auras externes se saisissent dans « État de mon
     monstre » (voir etat-de-mon-monstre.md § Sets d'aura des autres monstres) ;
     `compterAurasResPre` se règle dans
     « Réglages avancés » (point 9 ci-dessous).
   - **« Réinitialiser les conditions »**, en bas à droite de la grille, vide
     en un clic les 16 champs (les 8 minimums et les 8 maximums), sans
     toucher à « Stats de base exclues » ni aux autres réglages de l'écran
     (set, statistique principale, objectif…) — seules les VALEURS saisies
     sont concernées.

## Inventaire

8. **« Exclure les runes déjà utilisées »** — interrupteur, **désactivé par
   défaut** : la recherche porte alors sur tout l'inventaire. Il vit dans
   « Exclusion de runes » (voir ../exclusion.md § Exclusion des runes déjà portées ailleurs).

## Réglages avancés

9. **« Réglages avancés »** (repliés par défaut). ⚠️ **Au bureau, un
   `FlottantAuto`** (`shared/librairie-ui.md`), PAS un bloc qui grandit la
   carte — dépliée, la carte reste sous « Exclusion de runes » (colonne 2,
   rangée 5, sous Exclusion en rangée 4 — voir
   README.md § Ordre d'usage et grille) à sa hauteur repliée, le
   contenu flotte par-dessus le reste de la page ; ferme au clic extérieur.
   Un panneau replié par défaut ne peut pas réserver sa place à l'avance
   sans perdre l'intérêt d'être replié — voir
   [shared/design.md](../../../shared/design.md), « un clic ne déplace jamais ce
   qu'on vient de cliquer ». **Pré-filtrage par emplacement**, en
   **presets** plutôt qu'un curseur libre — Bas / Moyen
   (défaut) / Haut / Extrême, du plus rapide au plus large (et donc plus
   lent, mais capable de retrouver un build sur un très gros compte),
   **séparés par un liseré vertical** (même patron que `Segmented.tsx`,
   PC et mobile).
   ⚠️ **Au doigt, dans le panneau « Options »** (bouton de la barre de nav,
   voir App.tsx/`pageAPanneau` — même patron que la Liste et l'Optimisation
   de runes de « Mon compte », voir RunesOptim.tsx), **sous** « Exclusion de
   runes » — **jamais replié** dans ce panneau : ouvrir le panneau EST déjà
   le geste « je veux voir les options ». Chaque groupe dans son propre
   cadre, deux unités visuelles distinctes plutôt qu'un simple trait entre
   deux blocs de texte. ⚠️ **« Pool de runes = X » s'affiche à droite des
   presets**, dans le panneau SEULEMENT (pas la carte du bureau, où
   l'estimation détaillée du point 10 est déjà visible juste en dessous,
   sans qu'un panneau ne la masque) — sans ce rappel local, aucun moyen de
   voir l'effet du preset qu'on vient de toucher sans d'abord fermer le
   panneau. **Passe sous les presets si la largeur manque** (le message
   est assez long pour ne pas toujours tenir à côté sur un téléphone
   étroit) — adaptatif, jamais coupé ni superposé. ⚠️ **Choisir Haut ou
   Extrême active automatiquement** « Rechercher jusqu'à épuisement
   complet » et « Prioriser les stats les plus difficiles » ci-dessous — un
   pré-filtrage large n'a de sens que combiné à ces deux réglages, qu'un
   utilisateur novice n'a aucune raison de connaître. Un COUP DE POUCE, pas
   un verrouillage : chaque interrupteur reste cliquable normalement
   ensuite pour revenir à décoché. Choisir Bas ou Moyen ne les décoche PAS
   automatiquement dans l'autre sens. Sous ce réglage :
   - **« Rechercher jusqu'à épuisement complet »**, décoché par défaut :
     retire le filet de temps de 10 minutes (voir
     ../interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel) — la
     recherche continue tant qu'il reste des combinaisons à examiner, plutôt
     que de s'arrêter au bout d'un temps fixe. ⚠️ Peut prendre très longtemps
     sur une recherche avec peu de conditions (beaucoup de combinaisons
     restent à examiner) : le bouton « Arrêter » reste le seul filet et garde
     le meilleur trouvé jusque-là. ⚠️ Ne retire que la limite de TEMPS — le
     plafond interne de candidats collectés (non réglable) reste actif ; une
     recherche assez large pour l'atteindre s'arrête quand même avant d'avoir
     tout exploré, et un meilleur build peut alors manquer (voir
     ../limites-connues.md § Limites connues). Fait partie
     des réglages exportés/importés dans une recette (voir
     lancer-la-recherche.md § Lancer la recherche).
   - **« Diagnostic approfondi sur 0 résultat »**, décoché par défaut (plus
     coûteux qu'un diagnostic simple, voir resultats.md § Diagnostic sur 0 résultat).
   - **« Prioriser les stats les plus difficiles »**, décoché par défaut :
     réalloue le budget de rétention vers les stats demandées les plus
     rares/difficiles à combiner plutôt qu'un partage égal entre toutes —
     peut retrouver un build qu'une recherche normale rate, au prix d'une
     recherche plus longue. Fait partie des réglages exportés/importés dans
     une recette (voir lancer-la-recherche.md § Lancer la recherche).
   - **« Vérifier toutes les combinaisons trouvées »**, décoché par défaut :
     la file de résolution vérifie tous les
     builds trouvés au lieu de s'arrêter à 100 combinaisons confirmées (300
     en mode relique « recherche », voir
     ../moteur/artefacts.md § Quand ce choix a lieu) — le
     compte des confirmées devient complet, au prix de plusieurs minutes
     possibles ; son aide le dit. ⚠️ **Lu EN DIRECT par la file**, jamais par
     « Rechercher » : il ne change pas la recherche de runes, seulement
     jusqu'où la file vérifie ; l'activer après une recherche vérifie le
     reste sans la relancer, le couper ne perd rien de déjà vérifié.
     ⚠️ **Masqué quand l'optimisation d'artéfacts est désactivée** : sans
     file, rien n'est vérifié — même règle que « Adapter les artéfacts et
     reliques au tri ». Fait partie des réglages exportés/importés dans une
     recette, champ optionnel `verifierToutesLesCombinaisons` (absent, il se
     relit désactivé), et le CLI le respecte (voir
     resultats.md § Valeur d'objectif affichée sur les cartes).
   - **« Compter les effets d'auras Tolerance et Précision dans les
     conditions »**, activé par défaut : le contrôle de `compterAurasResPre` (point 7
     ci-dessus) — activé, chaque set Tolerance ou Accuracy, externe ou
     propre au build, ajoute 8 points aux minimums ET aux maximums de RES
     et de Précision ; désactivé, ces deux conditions ignorent les auras,
     sans rien retirer des dégâts ni des PV effectifs. Son aide le dit.
     Lu au clic sur « Rechercher », comme les autres réglages de la
     recherche, et déjà porté par la recette. ⚠️ **Rendu sans condition**,
     en dernier de la colonne, même sans aucune aura RES/PRE saisie : les
     activations propres d'un build comptent aussi, et un réglage qui
     apparaîtrait avec la saisie d'une autre carte ne se retrouverait pas.
     Contenu commun aux deux formats (`reglagesAvancesInner`) : flottant au
     bureau, panneau « Options » au doigt. Fermés, ni l'un ni l'autre ne
     montre rien ; « toujours visible » porte sur leur contenu. Ajouter
     Accuracy ou Tolerance aux auras externes, ou le choisir comme set
     recherché, ouvre la surface du format et surligne cet interrupteur 3 s
     (voir
     etat-de-mon-monstre.md § Ouverture guidée vers l'interrupteur des auras RES/PRE).

   ⚠️ **Le seuil de niveau minimum de la relique N'EST PAS ICI** : il vit
   dans le bloc
   « Relique » de la carte « Artéfacts et reliques » (« Niveau minimum »,
   voir relique.md § Relique), avec les deux autres réglages relique, pas dans
   « Réglages avancés ».
