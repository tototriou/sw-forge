# Dégâts réels — conditions et audit

**Statut :** ÉTAT ACTUEL — décrit les conditions livrées par l’audit des dégâts
**Lire si :** on modifie une condition ou un correctif issu de l’audit des dégâts
**Ne pas lire si :** on qualifie le reliquat encore non implémenté de l’audit
**Voir aussi :** spec/outils/degats-reels/passifs-offensifs.md, spec/outils/optimizer/archive/audit-degats-conditionnels-2026-09-08/

## Audit des dégâts conditionnels — partie 1

La livraison du 9 septembre 2026 ajoute les clauses recensées dans le
[suivi d’audit](../optimizer/archive/audit-degats-conditionnels-2026-09-08/suivi-implementation.md).
Les nouvelles saisies de `DamageSetup` restent optionnelles pour préserver les
anciennes recettes : nombres de buffs sur la cible et sur soi, puis scénario
de poses réussies entre les coups. Un scénario absent ou inactif ne suppose
aucune réussite.

Pour un sort multi-coups éligible, chaque coup lit l’état qui le précède. Les
effets choisis sont appliqués après ce coup, puis les coups suivants utilisent
le compteur de débuffs, la Marque et la DEF actualisés. Une Marque, un DEF
break ou un autre effet non cumulable déjà présent est identifié et ne
réaugmente pas le compteur ; un DoT reste cumulable. Les profils concernés
sont curés par identifiant quand leur nom possède un homonyme différent.

Les conditions déductibles du contexte — nombre de buffs, débuffs propres,
PV et élément de la cible — sont recalculées pour chaque build candidat. Les
états non déductibles restent des interrupteurs désactivés par défaut. Les
critiques garantis de Naomi, Kassandra/Kalantatze eau, Storm of Midnight et
Bella sont intégrés au score. Les cinq Onimusha ne critent jamais, mais leurs
dégâts restent ordinaires et soumis à la DEF.

Le choix des artéfacts, leur réévaluation dans la file et le score final
consomment le même contexte complet : sort, passifs, conditions, interdiction
de critique et modificateurs monstre-wide. Ce contrat est dérivé de
`RealDamageContext` ; ajouter un champ au moteur sans le propager à
l'évaluation des artéfacts fait désormais échouer le typage. Un test
différentiel sur Guillaume vérifie notamment que ses +100 points de Dgts Crit
produisent le même score dans l'écran, le moteur et le chemin CLI.

À l'import, une recette antérieure sans les nouveaux champs reste valide et
conserve les défauts ci-dessus. En revanche, un champ présent mais mal typé
est refusé avec son chemin précis : objectif, métrique, sets, contraintes,
principales de runes, paramètres d'artéfacts, compteurs conditionnels et
scénarios inter-coups imbriqués sont contrôlés avant d'atteindre l'état de
l'écran.

Ces deux exclusions de la partie 1 sont levées en partie 2 : Atlas Stone de
Skogul/Trasar vaut `PV max / ennemis vivants` en dégâts fixes ; Trasar ajoute
15 % par mort, au plus 30 %, à son S2 uniquement. Arsenal of Sacrifice de
Velaska vaut `PV max × réserve de Sacrifice / 100 / ennemis vivants`, avec
une réserve linéaire de 0 à 100. Lamiella conserve en plus sa composante
ordinaire `1,2 × ATQ`, qui peut critiquer et reçoit les modificateurs usuels ;
sa réserve est ajoutée séparément comme dégâts fixes. Le nombre d'ennemis
vivants est toujours borné de 1 à 4.


## Audit des dégâts conditionnels — partie 2

Le [périmètre exact](../optimizer/archive/audit-degats-conditionnels-2026-09-08/partie-2.md)
ajoute les PV propres actuels/manquants, le nombre d'alliés et d'ennemis
vivants, les comparaisons de PV/ATQ/DEF/VIT, les statistiques acquises en
combat, les seuils d'ignore DEF et les critiques garantis conditionnels.
Chaque grandeur provenant du build est recalculée pour chaque candidat.

Une comparaison de stat avec la cible est **stricte** par défaut ; une borne
inclusive s'écrit entrée par entrée, seulement quand la prose du sort la
dit. Copper (« half or lower than your Defense ») et Guard Crush (« 60% or
less than your Attack Power ») ignorent la DEF à l'égalité ; Jaara
(« Defense lower than your Attack Power ») et Varus (« lower Defense than
yours ») ne garantissent plus le critique à l'égalité, conformément à leur
prose et à la `note` de leur effet (degats-et-aura 15d). Summary Justice
(Theonia, S3) gagne +100 % quand l'ATQ ennemie saisie (« ATQ adverse »,
`enemyAtk`) est strictement inférieure à l'ATQ du build (« For enemies with
Attack Power lower than yours », valeur de la donnée ; décision de
l'utilisateur du 2026-10-03), comme Kassandra et Eleni vent à +30 % ; sa
clause sœur « Attack Speed lower than yours », sans valeur dans la donnée,
n'est pas comptée (degats-et-aura 15e). Le résumé de la
condition dit ce qu'elle accorde (ignore DEF ou critique garanti) et sa
borne (≤ ou <), lus sur l'entrée : Jaara et Varus affichaient « ignore
DEF ».

Les compteurs de débuffs ennemis sont plafonnés à 10 : Brise DEF et Marque
actifs s'ajoutent automatiquement aux autres effets saisis. Les clauses
binaires « au moins un effet néfaste » (Tesarion, Manannan, Arang et analogues)
utilisent un interrupteur ; Brise DEF ou Marque l'activent aussi sans clic.
Lorsqu'une pose est choisie entre les coups, seuls les coups suivants
reçoivent le nouvel état. Cette règle couvre Triple Crush,
Will-o'-the-Wisp et les dommages passifs par coup de Feng Yan.
Les nouvelles recettes marquent explicitement cette sémantique « autres
débuffs » ; une ancienne recette sans marqueur conserve son compteur total
historique, qui incluait déjà Brise DEF et Marque.

Les buffs propres suivent le même principe : `buffsPropresCount` contient
les **autres** buffs dans les nouvelles recettes, tandis que les buffs ATQ,
DEF et VIT actifs ajoutent chacun 1, sans dépasser 10 au total. Cette valeur
alimente Hero Strike/Strike of Fighter (Kassandra et équivalents), Power
Charge/Flying Strike, les statistiques de combat d'Elsharion/Crane/Geralt/
Valdemar et la chance affichée de Shadow Arrow. Une recette ancienne sans
`buffsPropresCountAutres` conserve son total historique inclusif ; les trois
interrupteurs en assurent au moins le minimum, sans double compte.

Les états binaires non observables (Power Surge, Inosuke, Berserk, Thunderer,
procs d'ignore DEF) restent des interrupteurs désactivés par défaut ;
aucune probabilité n'est convertie en succès garanti. Les deux clauses
d'Astar sont indépendantes : le bonus de dégâts et le +150 % d'ATQ calculé
sur sa stat de base quand elle a été touchée.

Gold Headband (Mei Hou Wang et Monkey King feu) se règle par un compteur de
cumuls, de 0 à 10. Chaque cumul ajoute 20 % de l'ATQ de base et 12 % de la
VIT de base, sans arrondi : pour les 116 de VIT de base de Mei Hou Wang,
+13,92 VIT par cumul et +139,2 à dix cumuls, à côté de +138,4 puis +1 384
ATQ. Les runes, les buffs et le leader skill ne changent pas cet apport,
calculé sur la seule base (curation de l'utilisateur du 2026-09-24, absence
d'arrondi décidée le 2026-10-02). La VIT reste, avec l'ATQ, une stat que la
recherche privilégie pour ce monstre.

<!-- À trancher : le Speed tune lit le même passif avec un arrondi supérieur
par cumul (`pointsDeGain`, speedTunePassif.ts) : +14 VIT par cumul et +140 à
dix cumuls pour la base 116, contre +13,92 et +139,2 dans les dégâts. Pour
une base de 100 (Monkey King), les deux donnent +12 et +120. Les deux
lectures restent en place ; un relevé en jeu de la VIT affichée par Mei Hou
Wang après un puis dix cumuls trancherait. Ligne correspondante dans
spec/outils/optimizer/pistes.md. -->

Flash Step (Ciri lumière) et Turning Slash (Birgitta lumière) : un compteur
des cumuls acquis avant le sort, de 0 à 5, chacun +50 de VIT **en points**
(« by 50 each, up to 250 »), après les pourcentages de la VIT de combat ;
il change leur S1, qui lit `{SPD}` (degats-et-aura 15e). Lu comme un gain
propre, comme dans le Speed tune : qu'un artéfact « Effet aug. VIT »
amplifie le cumul de Birgitta, typé « Buff » en donnée, n'est pas établi.

Rankyaku (Chun-Li vent) et Accelerando (Cordelia), toujours actifs, ajoutent
à l'ATQ cinq fois la VIT finale : base, runes et sets, compétence
d'invocateur, leader skill de VIT, puis buff de VIT, amplifié le cas échéant
par un artéfact « Effet aug. VIT » (confirmation de l'utilisateur du
2026-10-02). C'est la VIT de `maVitCombat`, jamais la VIT de fiche. Le
calcul est vérifié de bout en bout, lead et buff actifs, jusqu'aux dégâts du
S1 (constat 110 de l'audit).

Dans la fenêtre « Dégâts réels », chaque passif de « Stats acquises en
combat » affiche la prose du jeu, telle quelle, sous ce qui le nomme et
avant son réglage. Un compteur ou un interrupteur d'état ne nomme pas le
passif : son icône et son nom se posent alors au-dessus, puis la prose,
puis le champ. La prose n'apparaît qu'une fois par passif : Elsharion et
Crane gardent une seule description pour leurs deux compteurs. Elle
n'apparaît pas non plus quand un bloc de « Passifs offensifs » la rend déjà
pour la même compétence (Berserk, Thunderer de Dyeus, Dark Guardian,
Vengeful Fire, Flash Step, Turning Slash) : cette exclusion se déduit des blocs affichés, jamais d'une
liste de monstres. Pour les passifs offensifs, ce sont ceux que leur bloc
rend pour le sort choisi (`passifsSuivants`) : un passif masqué — choisi
lui-même comme sort, ou qui ne suit pas le sort choisi — qui porterait aussi
des stats de combat garde ici sa prose et son en-tête (degats-et-aura 9c ;
aucun cas au corpus aujourd'hui).


## Conditions binaires de buffs adverses et lecture des sorts

Raptor Combo et Flying Kick Combo gagnent 50 % de dégâts dès qu'au moins un
effet bénéfique est présent sur la cible, quel qu'en soit le nombre. Leur
condition, comme les clauses « aucun buff adverse » d'Airbender, Magic Surge,
Flash Pierce et Storm of Midnight, se règle avec un interrupteur « Effets
bénéfiques présents sur la cible ». Les anciennes recettes qui contiennent
un `buffsCibleCount` supérieur à zéro restent interprétées comme « présent » ;
les nouveaux choix enregistrent 0 ou 1. Les vrais bonus *par buff* (par
exemple Thousand Shots) gardent leur compteur distinct.

Dans la modale Dégâts réels, le survol de chaque compétence affiche sa prose
SWARFARM, y compris si sa formule n'est pas prise en charge. Le résumé sous
le nom reste celui des coefficients et conditions calculés. Dark Bolt (S1)
et Decimate (S3) de Grogen ajoutent respectivement 20 et 150 points de
Dégâts Crit au seul coup critique ; aucun de ces points ne modifie un coup
non critique.

Le survol d'une icône d'effet actif affiche sa conséquence complète : par
exemple Marque indique +25 % de dégâts, Brise DEF indique −70 % de DEF, et
les portraits d'Euldong, Mirinae, Deborah, Miriam, Dr. Matteo ou Velaska
décrivent leur effet d'équipe. Le nom court reste visible sous l'icône.

Pour Storm of Midnight (Alicia, Tiana, Lydia S2), l'interrupteur de présence
des buffs adverses explique en clair sa conséquence : sans buff sur la cible,
le coup est critique garanti ; avec un buff, il suit le mode critique choisi.
Les autres conditions binaires affichent aussi leur gain près de
l'interrupteur, sans imposer de relire le résumé du sort.

Les lignes « Effet renforcement ATQ/DEF » et « Effet aug. VIT » des artéfacts
amplifient les buffs du monstre optimisé, pas la VIT de l'adversaire. Leur
rappel apparaît auprès des buffs dans « État de mon monstre », seulement
quand le buff correspondant est actif ; rien de tel ne figure sous « VIT
adversaire ».

Ghost Slash (S1 des Onimusha, deux coups) peut poser Brise DEF sur chacun
de ses coups. Le scénario explicite « pose après le coup 1 » applique la
réduction de DEF au second coup uniquement ; aucune réussite n'est supposée
par défaut. Les cinq éléments et les formes partageant leur identifiant de
compétence suivent la même règle.


## Correctifs de contexte et de dégâts fixes

Yuji et Rick feu S3 utilisent un interrupteur « PV ennemis non détruits »,
désactivé par défaut. L'activer applique +50 % de dégâts. Leur critique
garanti est inconditionnel et ne dépend donc pas de cet interrupteur.

Leur S2 (Divergent Fist, Shockwave Fist, les trois éléments) est critique
garanti contre une cible qui porte un effet néfaste (« the Critical Rate
increases to 100% when attacking an enemy with harmful effects ») :
interrupteur du sort, Brise DEF ou Marque saisies, et les deux coups
critiquent. Le scénario des poses entre les coups propose aussi la
réduction de DEF du coup 1 : posée après le coup 1, elle rend le coup 2
seul critique (décision de l'utilisateur du 2026-10-03, sans relevé ;
degats-et-aura 15d). Elle compte comme un débuff **et** comme une
réduction de la DEF que subit le coup 2 (`effetCombat: 'defBreak'`, comme
Ghost Slash ou Triple Crush ; autre décision de l'utilisateur du
2026-10-03, degats-et-aura 15f) : le coup 2 est alors critique sous la DEF
réduite. Sans scénario, rien n'est supposé posé et le total ne change pas.
Témoin (Yuji vent, 1 000 ATQ, 100 % de Dgts Crit, DEF cible 1 000,
« Non critique ») : 848,5 sans débuff ni scénario, 2 231,3 avec la pose
après le coup 1 (coup 2 critique sous DEF réduite), 1 697,1 contre une
cible déjà affligée (interrupteur « débuff présent »).

Une recette sans `enemyAtk` (ancienne recette) prend l'ATQ ennemie que
l'écran affiche, `DEFAULT_DAMAGE_SETUP.enemyAtk` (1 000), et non 0 : la
condition « ATQ cible inférieure » est éteinte sous 1 000 d'ATQ du build,
allumée au-dessus, exactement comme avec une recette qui porte 1 000.
Theonia, Kassandra, Eleni (vent) et Zaiross (S3 Fiery Breath, seuil
inclusif à 50 % de l'ATQ) sont concernés (décision de l'utilisateur du
2026-10-03, degats-et-aura 15f).

Byungchul critique toujours avec ses deux sorts actifs (Violent Swing,
Summon Heavenly Kings Gate) : la garantie vient de son passif Full of
Spirit (« Your attacks will always land as a Critical Hit whenever you
attack the enemy »), sans condition, même si la prose des sorts n'en dit
rien et que la donnée ne porte l'effet que sur le S2 (degats-et-aura 15d).

Torrent de Leo et Ragdoll utilise un coefficient constant `5,5 × ATQ`.
L'état de PV n'est pas interpolé : un interrupteur « PV actuels inférieurs à
30 % » active seulement l'ignore-DÉF. Cette lecture suit la clause de seuil
de la compétence ; elle ne transforme pas le sort en critique garanti.

Lorsqu'un sort garantit son critique, ou qu'une condition sélectionnée le
garantit, « Non critique » est désactivé dans la modale et
« Critique » devient la seule lecture possible. Les conditions qui dépendent
du build candidat restent évaluées par candidat dans le moteur.

Les dégâts fixes d'Atlas Stone (Skogul/Trasar) et de Reckless Assault
(Mo Long) reçoivent les augmentations élémentaires d'artéfact. La réserve de
Sacrifice de Velaska et la composante de réserve de Lamiella n'en reçoivent
pas. Atlas Stone et les réserves de Sacrifice ne sont pas multipliés par
Mirinae, Price of Pain ou les autres bonus généraux ; seule Marque les
augmente. Sur Lamiella, ces restrictions ne concernent que la réserve : la
partie `1,2 × ATQ` reste une attaque ordinaire.

Treize sorts de plus entrent dans le cadre des poses entre les coups, **par
identifiant** et jamais par nom (« Blackout Kick » a des homonymes au texte
différent), chacun avec l'effet de sa donnée (`Decrease DEF` → Brise DEF,
`Brand` → Marque) : Crushed Hopes 10413 (Cichlid, coup 2), Double Strike 12608
(Melissa), Fast Link 13606, 13607 et 13610 (Barbara, Masha, Xiana ; coup de
la bête), Weakness Shot 15507 à 15509 (Carlos, Dominic, Benedict ; Marque),
Harpoon Impalement 17507 et 17509 (Eivor ; Marque), Blackout Kick 3454 (Sia)
et Reelseiden・Flurry 25206 et 25210 (Übel). Sans pose choisie le total ne
change pas ; posé après le coup qui le pose, l'effet ne majore que les coups
suivants (sort seul, DEF cible 1 500 : ×1,455 pour Cichlid, ×1,682 pour les
Brise DEF du coup 1, ×1,188 pour Weakness Shot, ×1,125 pour Eivor). Le
sélecteur propose toujours tous les rangs, y compris un coup qui ne pose rien
(décision D21 en attente). Les autres effets de ces sorts
(Decrease ATK, Étourdissement, Irrécupérable) ne sont pas curés ; Solveig et
Berghild (18007, 18009 : la Marque n'est que dans la prose) attendent un
relevé en jeu. Test : `testEffetsEntreCoups322`
(`tests/audit-degats-conditionnels.test.ts`).

Une contribution qui **suit** le sort — passif qui frappe après lui, attaque
appelée, Tempest — lit l'état de la cible **après le dernier coup** du sort,
poses du scénario comprises (Brise DEF, Marque, débuffs comptés) ; un passif
qui **accompagne** chaque coup (`coupsDuSortActif`, Feng Yan) garde la
lecture coup par coup ci-dessus (degats-et-aura P4b). Sans scénario actif,
rien ne change et rien n'est calculé de plus : l'état final se calcule une
fois par appel de `computeTotalDamage`, seulement sous scénario
(`etatCibleApresSort`). Formes jouables concernées : Sia (Great Friends après
Blackout Kick, réduction posée après le coup 1 : ×1,935 = sort ×1,682 et
passif entièrement réduit), Dominic et Benedict (Improvisation, Final Strike
après la Marque de Weakness Shot : ×1,225 et ×1,218 posée après le coup 1) ;
Feng Yan inchangé. Le déclenchement d'un passif `defBreak` (Roid, Silver)
reste jugé sur les deux réglages de réduction : aucun de leurs sorts n'a de
pose entre les coups. Test : `testSuiteDuSortVoitLesPosesP4b`.

## Formules de l'API pour les sorts à formule vide

Trois S3 dont la fiche porte `formule: ""` reçoivent la formule de leur
« compétence auxiliaire » (`other_skill`) de l'API SWARFARM, lue par l'audit
du 2026-09-08 et vérifiée à la source au contrôle 13b-hors-tour-cooperation
(degats-et-aura P6, HT-1 ; règle D12 de l'utilisateur : la valeur de l'API
par défaut, sauf si la prose la contredit) :

| Sort · identifiant · formes | Formule (auxiliaire) | Portée retenue | Note |
| --- | --- | --- | --- |
| Cursed Tombstone · `21114` · Ramon `31414` (`31404` non éveillé) | `2.7*{ATK} + 0.29*{MAX HP}` (4592) | mono-cible | la donnée dit `aoe: true` (fiche et auxiliaire), la prose « Attacks the enemy » : la prose l'emporte (`PORTEE_CORRIGEE_PAR_ID`) |
| Purification, Cooperation! · `21415` · Nezuko Kamado `31915` (`31905` et `32015` non proposées par `formesJouables`) | `4.5*{ATK}` (4626) | mono-cible | les attaques des deux alliés (« Ally Attack ») sont hors calcul : dégâts d'autres monstres |
| Rite of Ashes · `22015` · Vermilion Bird Dancer `32615` (`32605` non éveillé) | `4.5*{ATK}` (4710) | mono-cible | idem |

Les améliorations « Damage » de la fiche s'y appliquent (+15 %, +20 %). Ces
trois sorts n'étaient pas proposés avant P6 : `skillDamageProfile` écartait
toute fiche à formule vide **avant** de lire `FORMULES_CUREES_PAR_ID`. La
garde « formule vide » porte désormais sur la formule **retenue**, comme pour
un passif : une fiche à formule vide sans formule curée reste sans profil.
Devenus le dernier sort calculable, ils sont aussi le sort par défaut de ces
monstres. Hors périmètre : les sorts « Horn » des Anges jumeaux (forme de
soutien sans dégât, décision Q04), qui restent sans profil. Test :
`testDegatsFormulesApi` (`node tests/run.mjs formulesapi`).

## Nombres de coups variables, saisis

Décisions de l'utilisateur (degats-et-aura, lot P5a ; constat 13b-coups-
variables) : le nombre de coups d'un sort dont la prose le dit variable est
**saisi** par l'utilisateur, borné à la plage ; le **défaut est le minimum** ;
un coup supplémentaire **vaut les autres coups** (même formule par coup).
Aucune dérivation depuis les stats (ATQ, VIT, effets nocifs, PV) : les seuils
du jeu ne sont pas relevés. Les bornes viennent de la prose ou d'un champ de
la fiche, citées dans le test.

**Deux clés.** `COUPS_VARIABLES_CONNUS` (`{ min, max, defaut? }`) et
`COUPS_FIXES_CORRIGES` sont clées par **nom** ; `COUPS_VARIABLES_PAR_ID_CONNUS`
et `COUPS_FIXES_CORRIGES_PAR_ID` le sont par **identifiant de compétence**, et
l'identifiant l'emporte (`plageDeCoupsDe`, `coupsFixesCorrigesDe`, lues par
`skillDamageProfile` ET `monsterOffensivePassives`). Une entrée passe par
identifiant quand un homonyme **jouable** a une autre mécanique : une entrée
par nom s'étendrait à lui en silence. `COUPS_FIXES_CORRIGES_PAR_ID` est vide :
Crow Hunt de Prilea (1618) attend un relevé en jeu (R9), ses homonymes
jouables 1607 et 1609 portent `coups: 4`.

| Sort · identifiant · formes | Plage | Clé | Citation |
| --- | --- | --- | --- |
| Whirlpool · `21311` · Tanjiro Kamado `31811` (`31801` non éveillé) | 1 à 3 | identifiant | « Deals additional damage 2 more times to targets with harmful effects » ; `coups: 1`. Homonymes : `3463` (Seal 2A `12133`, **jouable**), `3413` et `3478` (Seal, non jouables) n'ont aucun coup supplémentaire — restent à 1 coup |
| Water Dragon Surge · `21911` · Azure Dragon Swordsman `32511` | 1 à 3 | nom (unique) | même prose que Whirlpool 21311 ; `coups: 1` |
| Strafe · `11716`, `11717`, `11703`, `11704`, `11720` · Eluin `20911`, Adrian `20912`, Erwin `20913`, Lucien `20914`, Isillen `20915` | 2 à 3 | nom | « Rapidly fires 2 shots, and may fire an additional shot by chance. The chance … is equivalent to your Critical Rate » ; `coups: 2`. Homonymes `11701`, `11702`, `11705` (Elven Ranger non éveillé, non jouables) : même prose, couverts par le nom. La chance n'est jamais tirée |
| Sura's Seal · `18312` · Varuna `28512` | 4 à 8 | nom (unique) | « Attacks the enemy 4 times … increases up to 8 times according to the difference between the target and your Attack Power » ; `coups: 4`. Seuils d'ATQ absents, jamais dérivés |
| God's Weapon · `18308`, `18310` · Usha `28513`, Vritra `28515` | 2 à 3 | nom | « Attacks all enemies 2 to 3 times ». La donnée dit `aoe: false` contre « all enemies » : portée non corrigée ici |
| Barrage of Madness · `18313` · Usha `28513` | 3 à 5 | nom (unique) | « Attacks all enemies 3 to 5 times … The more harmful effects granted on the target, the higher the chance » ; la probabilité n'est jamais tirée |
| Hammer Punch · `11651`-`11655` · Tractor `20831`, Bulldozer `20832`, Crane `20833`, Driller `20834`, Crawler `20835` | 2 à 3 | nom | « Attacks the enemy 2 times … If the target is not suffering any harmful effects, 1 additional attack is added » ; `coups: 2`. Homonymes `11601`-`11605` (Frankenstein 1A) et `11673`-`11677` (boss), non jouables : même prose, couverts par le nom. Le terme « Attaques reçues avant ce sort » reste par coup |
| Pound · `11664` · Driller `20834` | 4 à 6 | nom | « Attacks the enemy 4 times … 2 additional attacks are added if the enemy's HP condition is worse than yours or if the target is suffering a harmful effect » ; `coups: 4`. Homonymes `11614` (Driller 1A, condition « MAX HP **et** effet nocif ») et `11686` (boss), non jouables : même plage |

Deux sorts portent à l'inverse un nombre **fixe** corrigé (`COUPS_FIXES_CORRIGES`,
pas de saisie) : « Attacks all enemies 3 times … and attacks them once more »
fait 4 coups pour `coups: 3` en donnée. **Grinding** (`16306`, `16308`,
`16310` ; Espresso Cookie eau, vent, ténèbres) et **Spinning Tea Spoon**
(`16806`, `16808`, `16810` ; Rosemary, Chamomile, Lavender), noms exclusifs à
ces six sorts dans le corpus. Le total par défaut de ces six sorts monte donc
de 3 à 4 coups (×1,3333), contrairement aux plages, qui retombent sur leur
minimum.

Hors périmètre, voir le cadrage : Stormfist de Mayasura (18306…, la règle
selon l'ATQ est une valeur à fournir), Crow Hunt (R9), Lala, Coco, Stella,
Cleave, les coups tirés au hasard (P5b). Test : `testDegatsCoupsSaisis`
(`node tests/run.mjs coupssaisis`).
