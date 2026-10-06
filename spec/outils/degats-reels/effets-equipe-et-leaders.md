# Dégâts réels — effets d’équipe et leaders

**Statut :** ÉTAT ACTUEL — décrit les effets d’équipe et leaders appliqués au calcul
**Lire si :** on modifie un effet d’équipe, un leader skill ou leur compatibilité de recette
**Ne pas lire si :** on travaille sur un passif propre au monstre optimisé
**Voir aussi :** spec/outils/degats-reels/passifs-offensifs.md, spec/outils/optimizer.md

## Effets d'ÉQUIPE (Euldong, Mirinae, Deborah, Miriam, Dr. Matteo, Velaska)

Six effets **portés par un AUTRE monstre que celui optimisé** — leur
présence dépend de la composition d'équipe, pas du monstre en cours
d'optimisation. Demande explicite de l'utilisateur : sélectionnables dans
« Effets actifs » comme un buff ATQ, avec le **portrait du monstre** en
icône plutôt qu'une icône de buff générique (`EULDONG_ICON`/`MIRINAE_ICON`/
`DEBORAH_ICON`/`MIRIAM_ICON`/`TRANSMISSION_ICON`/`VELASKA_ICON`, URLs
`Monster.image` — pas `buffs/…` comme les icônes de buff). Contrairement à
`critSiPlusRapide`/`bonusDegatsSelonVit`/`bonusDegatsStack` (déduits du
monstre OPTIMISÉ, `RealDamageContext`), ces six sont de purs choix
utilisateur : des champs booléens de `DamageSetup`
(`euldongActif`/`mirinaeActif`/`deborahActif`/`miriamActif`/
`transmissionActif`/`velaskaActif`), lus directement dans
`computeSkillDamageDetail`/`computeTotalDamage` — aucune détection de
monstre, aucun `RealDamageContext` supplémentaire.

- **Euldong** (« Triumph Over Evil », passif — Dokkaebi Lord Euldong) :
  confirmé par l'utilisateur, ajoute **100 POINTS** à la stat Dgts Crit
  (130 % → 230 %), pas un facteur ×2 — même famille que les points plats des
  compétences d'invocateur. `EULDONG_CD_POINTS = 100`, gaté sur `montreCrit`
  (un sort à dégâts fixes ne crite jamais, rien à amplifier). ⚠️ Le texte du
  jeu précise que cet effet ne cumule pas avec un AUTRE effet
  d'augmentation de Dgts Crit — aucun de modélisé ici pour l'instant, donc
  sans conséquence actuellement.
- **Mirinae** (S3, « Cursed Music ») : confirmé par l'utilisateur, « works
  as 30% negative damage resistance. It stacks additively with -DMG%
  artifacts ». Même famille que la Marque (+25 %, additif dans le terme
  « Réductions ») — les deux s'ADDITIONNENT, ne se multiplient pas entre
  elles. `MIRINAE_BONUS_PCT = 30`, non gaté (comme la Marque, aucun sort ne
  l'ignore).
- **Deborah** (passif, « Blacksmith's Discernment ») : confirmé par
  l'utilisateur — « modeled through the effective DEF break… Effective DEF
  break is 91% with deborah passive and a defense break ». Amplifie la
  RÉDUCTION de DEF d'une réduction de défense déjà active
  (`setup.defBreak`), jamais une réduction à elle seule :
  `1 − (1 − DEF_BREAK_FACTOR) × DEBORAH_AMPLIFY` = `1 − 0,7 × 1,3 = 0,91`.
  `DEBORAH_AMPLIFY = 1.3`, gaté sur `montreDefEnnemie` (même condition que
  le toggle « Def break »). ⚠️ Le texte précise « 15% if it's the boss » —
  comme partout ailleurs dans l'outil, aucune notion de boss n'est modélisée
  ; seul le cas non-boss (30 %) l'est.
- **Miriam** (passif, « Blacksmith's Technique ») : confirmé par
  l'utilisateur — « augmente l'effet du buff ATQ, du buff vitesse et du
  buff defense de 35% ». Amplifie la MAGNITUDE des trois buffs déjà actifs,
  jamais leur simple présence : généralise à ATQ/DEF le mécanisme déjà en
  place pour la VIT via un artéfact « Effet aug. VIT »
  (`speedBuffAmpliPct`), mais Miriam est un TOGGLE (un monstre dans
  l'équipe ou non), pas une somme de lignes d'artéfact — les deux sources
  s'ADDITIONNENT avant d'amplifier, comme plusieurs lignes d'artéfact
  identiques le font déjà. `MIRIAM_AMPLIFY_PCT = 35`, gaté sur l'union des
  conditions déjà utilisées pour les toggles ATQ/DEF/VIT ci-dessus.
- **Dr. Matteo** (S3, « Transmission ») : « increases the damage that
  allies deal to enemies by 20% while you are under an inability effect ».
  ⚠️ Formulation IDENTIQUE à Mirinae (« increases the damage… by X% ») mais
  **jamais confirmée séparément comme additive** avec la Marque/Mirinae —
  traitée PAR ANALOGIE de formulation dans le même terme « Réductions »
  (`TRANSMISSION_BONUS_PCT = 20`), non gaté. Condition (« pendant que
  Dr. Matteo est sous incapacité ») non déductible, comme les autres : un
  toggle, désactivé par défaut.
- **Velaska** (S3, « Price of Pain ») : « When an ally with reduced HP
  attacks the enemy, the damage dealt increases in proportion to the
  amount of HP lost. » Confirmé par l'utilisateur : scaling **linéaire**,
  **+0,5 % de dégâts par point de % de PV perdu**
  (`VELASKA_PCT_PAR_PV_PERDU = 0.5`). ⚠️ **Seul effet d'équipe à porter une
  DEUXIÈME donnée** en plus du toggle : l'app ne simule pas les PV réels du
  monstre optimisé (`setup.velaskaPvPerduPct`, 0-100, 0 par défaut = aucun
  bonus). Un champ numérique dédié sous la grille d'icônes ne devient
  utilisable que quand `velaskaActif` est coché — même discipline que le
  champ « Stack actuel » de Momo, jamais un état deviné.

  ⚠️ **Sa place est RÉSERVÉE d'avance, il n'APPARAÎT pas.** Rendu sous
  condition, il poussait toute la rangée de vignettes vers le bas au moment
  même où on cliquait Velaska — un clic qui déplace ce qu'on vient de
  cliquer, interdit par [../../shared/design.md](../../shared/design.md). Signalé
  à l'usage. La rangée existe donc en permanence et garde sa hauteur ; seul
  son contenu se révèle. `invisible` et non `hidden`, avec `aria-hidden` et
  le champ désactivé : la place est tenue sans qu'on puisse tabuler dans un
  champ qu'on ne voit pas.


## Sets d'aura d'équipe — modèle

`DamageSetup.setsAuraExternes` est une liste optionnelle d'entrées
`{ set, nombre }` : Fight → ATQ, Determination → DEF, Enhance → PV, Accuracy
→ PRE et Tolerance → RES. Elle ne décrit que les auras des **autres**
monstres de l'équipe : au plus cinq monstres à trois sets, d'où une seule
entrée par type, un entier de 1 à 15 et une somme de tous les types au plus
égale à **15**. Une liste absente ou vide vaut zéro ; une recette mal typée,
répétée ou hors bornes est refusée avec le chemin
`damageSetup.setsAuraExternes` ou celui de son entrée. La liste survit à un
changement d'espèce, d'exemplaire ou de liste et se vide à l'import d'un
compte. Depuis le lot 7a, l'écran la saisit dans la carte « État de mon
monstre » ([spec/outils/optimizer/ecran/etat-de-mon-monstre.md § État de mon monstre](../optimizer/ecran/etat-de-mon-monstre.md)) par les
fonctions pures de `src/lib/aurasExternes.ts`, qui bornent chaque écriture
et portent la validation que la recette appelle (`erreurAurasExternes`) :
ce que l'écran écrit, la recette le relit. Source des cinq valeurs et du plafond : utilisateur, 2026-09-23 puis
2026-09-25, cadrage `spec/chantiers/degats-et-aura.md` A.2 ter.

Les activations d'aura **propres** au build — les sets réellement formés par
ses runes, résolus par `activeSets` : répétitions et Intangible compris, set
demandé ou non (`requirement.sets` n'est qu'un minimum de recherche) —
s'ajoutent à cette part externe, pour un total effectif d'au plus 18
(15 + 3). Elles se résolvent **pour chaque build** — candidat, fiche affichée,
build dont on choisit la paire et la relique — et se transmettent aux calculs
comme un argument **obligatoire** (`AurasPropres`), jamais stockées dans
`DamageSetup` ni déduites des statistiques ; sans rune, le zéro se déclare
explicitement (`AUCUNE_AURA_PROPRE`). Depuis le lot 6bis-b2, le **combat et
le score** les comptent ; depuis le lot 6bis-b3a, les **contrôles exacts**
des conditions RES/PRE aussi, comme décrit ci-dessous. Depuis le lot
6bis-b3b, les **coupes sûres** de la recherche (dominance, faisabilité,
bornes rapides de l'appariement) et les diagnostics de faisabilité en
tiennent compte : pour un minimum, le potentiel favorable — activations
Tolerance/Accuracy possibles, set non demandé et Intangible compris, toggle
actif —, pour un maximum, seul l'inévitable ; la dominance ne remplace plus
une rune d'aura utile à la recherche (stat d'une condition ou de l'objectif)
par celle d'un autre set. Depuis le lot 6bis-b3c, une aura dont la stat
entre dans l'effet unique d'une relique que la recherche peut équiper — stat
de référence, lue au début du combat, ou stat améliorée — est utile au même
titre : Fight peut faire franchir une tranche de Ténacité sur l'ATQ en
« PV effectifs ». Depuis le lot 6bis-b3d-1, de même en « Dégâts réels »
pour une aura dont la stat nourrit une ligne d'artéfact 218–221 qu'un
artéfact équipable porte : Enhance avec la ligne 218 (PV), Determination
avec la 220 (DEF), même hors de l'objectif. Un oracle exhaustif indépendant
le vérifie, noté par la note de production de l'équipement complet, paire
d'artéfacts comprise. Le
pré-filtrage par emplacement et la rétention par compartiment restent
**heuristiques** : ils ne valorisent pas l'aura propre et ne garantissent
aucun optimum.

L'ancien champ `damageSetup.setsAura` comptait l'équipe entière, monstre
optimisé inclus : ses nombres ne se traduisent pas en auras des autres
monstres. Absent ou vide, il est accepté et retiré à l'import ; non vide, la
recette est refusée avec le chemin `damageSetup.setsAura` et la raison,
jamais réinterprétée en auras externes. La version de recette ne change pas.

Fight, Determination et Enhance donnent chacun **8 % de la statistique de
base** correspondante. Ils s'ajoutent au pourcentage de l'invocateur et du
lead dans le **même `ceil`** de `statsDebutCombat`, sans arrondi séparé :
part externe et activations propres forment un seul terme
`8 × (externes + propres)`, jamais deux arrondis, jamais un set du build
compté deux fois. Ils agissent ainsi sur le sort actif, ses passifs, les
dégâts additionnels, les bonus lus sur l'ATQ ou la DEF de combat (Brita,
Gideon : `atkCombatComplet` et `defCombat` dérivent désormais de ce même
préfixe) et l'assiette `Y` des propriétés uniques de relique. Accuracy et
Tolerance donnent chacun **8 points** de PRE/RES par set effectif, même si la
base vaut zéro. Aucun de ces cinq effets ne modifie `computeStats`, qui reste
la fiche hors combat : aucun set d'aura n'y a de bonus.

L'objectif PV effectifs compte Enhance et Determination dans ses scores,
son choix de paire d'artéfacts et de relique, son tri et sa comparaison,
avec un seul `ceil` par stat sur `base × 8 × (externes + propres)`.
Cette extension n'ajoute pas implicitement le lead ou l'invocateur aux PV
effectifs. La note d'une paire, celle qui choisit la relique et celle qui
classe reçoivent les activations propres du build noté, constantes pour
toutes ses paires et reliques (aucune ne porte de set) ; les couples restent
jugés sur leurs conditions avec la fiche hors combat. Pour les conditions
min **et** max, seul RES/PRE reçoit les points d'aura, ensemble, quand
`compterAurasResPre` est activé (défaut `true`) : la part externe, constante
sur toute la recherche, **et** les activations Tolerance/Accuracy propres du
build (Intangible et set non demandé compris), 8 points chacune, ajoutées
une seule fois à la fiche hors combat. Les contrôles exacts — filtre final
de l'appariement sur les six runes, filtres de paire à relique fixe et de
relique finale (`resoudreEquipementDuBuild`) — testent cette valeur réelle
pour le minimum comme pour le maximum ; en recherche de relique, seul le
terme de relique du filtre de l'appariement reste une borne. Le toggle
atteint le moteur par un booléen obligatoire de `auraResPre`, dont le seul
producteur est `avecAurasConditions` ; `auraResPre` absent signifie aucune
aura dans les conditions, et « désactivé » ne s'écrit jamais par cette
absence. Les coupes amont lisent encore la part externe seule (voir l'état
intermédiaire ci-dessus). Désactiver ce booléen ne retire aucun effet des
dégâts ni des PV effectifs, et une aura propre n'y favorise ni ne pénalise
plus aucune condition. Les auras PV/ATQ/DEF restent hors conditions. Le
booléen est optionnel dans la recette pour préserver les exports antérieurs ;
ses valeurs présentes doivent être booléennes. Le modèle est livré au lot 6,
le champ externe au lot 6bis-b1, les activations propres dans le combat et le
score au lot 6bis-b2, dans les contrôles exacts des conditions au lot
6bis-b3a ; la saisie des auras externes à l'écran et l'interrupteur
« Compter les effets d'auras Tolerance et Précision dans les conditions »
(réglages avancés, `compterAurasResPre`), au lot 7a.

## Leader skill d'équipe

Généralise l'ancien champ VIT-only (`leaderSpeedPct`) à **toute** stat de
lead — demande explicite de l'utilisateur : « choisir un leader skill…
implémenter les leader skill de PV, d'ATQ, de DEF, de VIT, de Taux Crit et
de dégâts crit ». Sélection dans « Effets actifs » : un type d'abord (avec
l'icône OFFICIELLE du jeu, réutilisée depuis `siege/LeadPill.tsx` —
`leadIconUrl`/`STAT_LABEL`, jamais dupliquée), puis une valeur — **une seule
liste déroulante** (`DamageSetup.leaderSkill: { stat, pct }`).

Une recette importée est validée comme l'écran écrit : `stat` parmi les six
de `LEADER_SKILL_STATS` (damage.ts), `pct` nombre fini. Un `pct` en texte est
refusé avec son chemin, jamais additionné aux auras par concaténation.

⚠️ **Plus de saisie libre.** L'écran proposait un menu de « paliers courants »
**et** un champ numérique, parce que la table ne prétendait pas être complète.
`LEADER_SKILL_VALEURS` (damage.ts) est désormais **EXHAUSTIVE** — liste
fournie par l'utilisateur — donc le champ libre n'a plus rien à rattraper.
Ça corrige au passage un défaut signalé : l'ancien menu gagnait une option
« 44 % (personnalisé) » dès que la valeur quittait un palier, et un `<select>`
natif se dimensionnant sur l'option SÉLECTIONNÉE, il s'élargissait d'un coup
et poussait le champ voisin — un clic qui déplace ce qu'on vient de cliquer.

| Stat | Valeurs |
|---|---|
| PV | 15, 17, 18, 21, 22, 25, 28, 30, 33, 38, 40, 44, 45, 50 % |
| ATQ | 15, 18, 20, 21, 22, 25, 28, 30, 33, 35, 38, 40, 44, 45, 50 % |
| DEF | 20, 21, 22, 25, 28, 30, 33, 38, 40, 44, 50 % |
| VIT | 10, 15, 16, 19, 20, 21, 23, 24, 28, 30, 33 % |
| Taux Crit | 10, 15, 16, 17, 19, 21, 23, 24, 28, 30, 33, 38 % |
| Dégâts Crit | 25 % — un seul monstre du jeu porte ce lead |

⚠️ **PV, ATQ et DEF ne partagent PLUS la même liste.** L'ancienne table les
donnait identiques (`28, 33, 38, 40, 44, 50`) : c'était un relevé partiel.
ATQ a un 35 que PV n'a pas, PV a un 17 et un 18 absents de DEF, et DEF ne
descend pas sous 20. Ne pas les refactoriser en une ligne « parce qu'elles se
ressemblent ». Les maximums diffèrent aussi : **33 % en VIT contre 50 % en
ATQ**.

⚠️ Une valeur enregistrée HORS liste (saisie du temps du champ libre, ou
recette importée) reste affichée telle quelle dans le menu plutôt que
remplacée en silence — changer un chiffre sans prévenir serait pire que le
défaut corrigé. Elle disparaît dès qu'on choisit autre chose.

⚠️ **Une GRILLE dont toutes les places sont tenues d'avance** — libellé
(« Lead », abrégé pour la largeur), icône, menus. Trois choses y bougeaient au
moindre clic, et c'est le même défaut trois fois
([../../shared/design.md](../../shared/design.md), « un clic ne déplace jamais ce
qu'on vient de cliquer ») :

1. le menu de la **valeur** se dépliait **à droite** du type, élargissant le
   groupe et poussant « Compétences d'invocateur » ;
2. passé **en dessous**, il ferait grandir la carte si sa rangée n'était pas
   réservée ;
3. l'**icône** du lead, rendue sous condition, poussait le menu de type dès
   qu'un lead était choisi.

La colonne de l'icône existe donc même vide, la seconde rangée existe même
sans lead (un menu figurant, désactivé et `aria-hidden`, la tient — sans lui
elle serait plate et la carte grandirait quand même), et la valeur se pose en
`col-start-3`, donc exactement sous le type. ⚠️ L'alignement se **déduit des
colonnes** ; il n'est pas reproduit à coups de marges qui dériveraient au
prochain changement de libellé. Même parade que le champ de Velaska.

⚠️ **Trois précisions confirmées par l'utilisateur**, à ne pas re-questionner :

- **La portée n'entre PAS dans la table, délibérément.** En jeu, une valeur de
  lead dépend de sa portée (33 % réservés à un contenu — guilde, arène —,
  24 % universels, 30 % élémentaires…), du monstre qui la porte et de son
  nombre d'étoiles naturel. Rien de tout ça n'a d'importance **ici** : c'est
  l'utilisateur qui choisit le lead qu'il veut poser sur son équipe, pas l'app
  qui le déduit d'un monstre. La table reste donc à UNE dimension — une liste
  de valeurs possibles par statistique. ⚠️ Les valeurs ne sont pas les mêmes
  d'une statistique à l'autre : le maximum est **33 % en VIT** contre **50 %
  en ATQ**, et aucune formule ne relie les deux.
- **Un seul palier en Dégâts Crit est CORRECT**, pas un trou : un seul monstre
  du jeu porte un leader skill de dégâts critiques.
- **Les leads de RES et de Précision existent** et sont **volontairement
  ignorés** : ils n'ont aucun effet sur les dégâts, seule question à laquelle
  ce réglage sert. Leur absence n'est pas un oubli.

⚠️ **Deux familles de mécaniques, jamais confondues** :
- **PV/ATQ/DEF/VIT** — un pourcentage MULTIPLICATIF de la stat de **BASE**
  (voir l'incident ci-dessous), ajouté comme des points FLATS au total
  runé — exactement `avecInvocateur`/`pctSpeedBonus` (speed.ts, page RTA).
- **Taux Crit/Dégâts Crit** — des points FLATS ajoutés DIRECTEMENT à la
  stat, même famille que les compétences d'invocateur (`cdPoints`) et
  Euldong — jamais un pourcentage de quoi que ce soit.


## ⚠️ Incident : un lead porte sur la stat de BASE, pas le total runé

Signalé par l'utilisateur : « les leaderskill s'appliquent sur les
statistiques de base. Tu as un exemple d'utilisation des leader skill (de
VIT) dans la page RTA. » Un premier jet appliquait le pourcentage du lead
au **total runé** — exactement l'erreur que `combatSpeed`/`pctSpeedBonus`
(speed.ts) évitent déjà pour la VIT en siège/RTA :
`base + rune + ceil(base × (totem+lead+swift)/100)`, le pourcentage ne
portant QUE sur `base`, jamais sur `base + rune`. Corrigé pour toutes les
stats concernées (`avecInvocateur` gagne un second paramètre
`extraBasePct`, sommé à la compétence d'invocateur — même nature — AVANT
le `ceil` UNIQUE, jamais un second `ceil` séparé qui reproduirait l'écart
d'un point déjà documenté et corrigé une fois dans `pctSpeedBonus`, « ne
jamais arrondir bonus par bonus »).

Le buff de combat (`atkBuff`/`defBuff`/`spdBuff`), lui, reste %TOTAL — une
mécanique DIFFÉRENTE, pas la même formule : il s'applique donc APRÈS le
lead déjà posé, jamais sommé avec lui dans la même étape.


## Compatibilité arrière

Une recette exportée AVANT cette généralisation ne porte que l'ancien
`leaderSpeedPct` (un pourcentage de VIT nu, sans type). `resolvedLeaderSkill`
(damage.ts) traduit explicitement : `leaderSkill` si présent, sinon
`{ stat: 'Attack Speed', pct: leaderSpeedPct }` — jamais un défaut générique
qui perdrait la valeur déjà saisie. Le champ legacy n'est plus jamais
ÉCRIT depuis l'écran (marqué `@deprecated`), seulement lu.
