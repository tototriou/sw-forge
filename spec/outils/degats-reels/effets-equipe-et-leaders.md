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


## Leader skill d'équipe

Généralise l'ancien champ VIT-only (`leaderSpeedPct`) à **toute** stat de
lead — demande explicite de l'utilisateur : « choisir un leader skill…
implémenter les leader skill de PV, d'ATQ, de DEF, de VIT, de Taux Crit et
de dégâts crit ». Sélection dans « Effets actifs » : un type d'abord (avec
l'icône OFFICIELLE du jeu, réutilisée depuis `siege/LeadPill.tsx` —
`leadIconUrl`/`STAT_LABEL`, jamais dupliquée), puis une valeur — **une seule
liste déroulante** (`DamageSetup.leaderSkill: { stat, pct }`).

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
