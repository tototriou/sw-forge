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

Torrent de Leo et Ragdoll utilise un coefficient constant `5,5 × ATQ`.
L'état de PV n'est pas interpolé : un interrupteur « PV actuels inférieurs à
30 % » active seulement l'ignore-DÉF. Cette lecture suit la clause de seuil
de la compétence ; elle ne transforme pas le sort en critique garanti.

Lorsqu'un sort garantit son critique, ou qu'une condition sélectionnée le
garantit, « Non critique » et « Moyenne » sont désactivés dans la modale et
« Critique » devient la seule lecture possible. Les conditions qui dépendent
du build candidat restent évaluées par candidat dans le moteur.

Les dégâts fixes d'Atlas Stone (Skogul/Trasar) et de Reckless Assault
(Mo Long) reçoivent les augmentations élémentaires d'artéfact. La réserve de
Sacrifice de Velaska et la composante de réserve de Lamiella n'en reçoivent
pas. Atlas Stone et les réserves de Sacrifice ne sont pas multipliés par
Mirinae, Price of Pain ou les autres bonus généraux ; seule Marque les
augmente. Sur Lamiella, ces restrictions ne concernent que la réserve : la
partie `1,2 × ATQ` reste une attaque ordinaire.
