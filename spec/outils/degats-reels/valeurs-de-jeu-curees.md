# Dégâts réels — valeurs de jeu curées

**Statut :** ÉTAT ACTUEL — valeurs de jeu fournies par l'utilisateur (joueur) pour le calcul des dégâts réels, chacune avec sa source
**Lire si :** on modélise ou on corrige une mécanique de jeu dont la valeur ne vient pas de la donnée SWARFARM, ou un commentaire de code cite « A.2 ter »
**Ne pas lire si :** on cherche comment le calcul applique une valeur (voir les autres fichiers de `degats-reels/`)
**Voir aussi :** spec/outils/degats-reels.md, spec/outils/degats-reels/formules-et-combat.md

Valeurs curées par le chantier degats-et-aura (fiche :
[degats-et-aura.md](../../chantiers/degats-et-aura.md) ; journal archivé dans
les notes privées du projet). Le titre ci-dessous garde l'identifiant de sa
section d'origine, « A.2 ter », que le code et les tests citent ; les
identifiants de lot (lot 10, lot 15g, P2…) et du questionnaire (Q03, D06…)
renvoient à ce journal.

## Les valeurs de jeu — curées, avec leur source (ex-A.2 ter)

**Les valeurs ci-dessous sont fournies.** Elles viennent de l'utilisateur
(joueur), le 2026-09-23, sauf mention contraire. Elles ne sont pas à redemander.
Le cas à sept coups est confirmé au lot 10 ; aucune valeur ne se complète
par invention.

| Mécanique | Valeur retenue | Source |
| --- | --- | --- |
| Blade Surge, coups 1 et 2 | `0.5 × ATQ` chacun, **mono-cible** | donnée SWARFARM (`formule`, `coups: 2`) + confirmation |
| Blade Surge, coup 3 | `3.0 × ATQ`, **en zone** | utilisateur — absent de l'API |
| Portée de la curation Blade Surge | La même séquence de dégâts vaut aussi pour les compétences `10601`, `10603` et `10605` des Magic Knights eau, vent et ténèbres ; `10603` couvre également l'Imperfect Magic Knight vent qui partage cet identifiant | utilisateur, confirmation explicite du 2026-09-23 |
| Skillups de Blade Surge | Le même nombre de skillups vaut pour les huit identifiants retenus et `skillupDamagePct` s'applique aux trois coups, **troisième coup inclus** | utilisateur, confirmation explicite du 2026-09-23 |
| Cible du troisième coup de Blade Surge | Le coup de zone touche aussi la cible principale : elle reçoit donc les deux premiers coups mono-cible puis le troisième coup en zone | utilisateur, confirmation explicite du 2026-09-23 pour toute la famille retenue |
| Tempest (Teshar) | `3.7 × ATQ`, **en zone**, déclenché après S1 **ou** S2 | utilisateur, **et** l'audit (3,7 ATQ, `other_skill=1181`) : deux sources concordantes |
| Skillups de Tempest | Les trois améliorations `Damage +10%`, soit `+30 %`, s'appliquent aux dégâts de Tempest | utilisateur, confirmation explicite du 2026-09-23 |
| Gold Headband (`7912`, Mei Hou Wang feu) | Chaque cumul ajoute **20 % de l'ATQ de base** et **12 % de la VIT de base** ; maximum 10. Pour Mei Hou Wang éveillé, la VIT de base vaut 116 | utilisateur, confirmation explicite du 2026-09-24 |
| Attaques supplémentaires conditionnelles | L'Optimizer ne tire jamais la probabilité : un interrupteur utilisateur inclut ou exclut la compétence supplémentaire, comme pour Tempest. Règle confirmée pour les S2/S3 des Maîtres ivres, Shoryuken, les chaînes de Kung Fu Girls et Chain Effect de Vendhan. Pour Vendhan, la répétition vaut 50 % des dégâts ; le Silence réel à 25 % est hors calcul. Chaque famille garde ses paramètres propres et doit être classée par le lot 1 | utilisateur, décisions produit des 2026-09-23 et 2026-09-24 |
| Formes génériques et non éveillées | Aucune forme non éveillée d'un monstre n'est sélectionnable dans l'Optimizer. Les cinq Martial Cat 2A génériques `47601` à `47605` ne correspondent en outre à rien de jouable. Ces formes sont entièrement ignorées, sauf quand leur identifiant de compétence est aussi porté par une forme jouable : le profil est alors conservé pour cette dernière seulement | utilisateur, confirmations explicites des 2026-09-23 et 2026-09-24 |
| Stock de dégâts de Jin/Kai ténèbres | Lorsqu'un S3 élimine sa cible, l'excédent `max(0, dégâts infligés − PV restants)` devient un dégât fixe ajouté au prochain S3. Il ignore la DEF mais subit les réductions des dégâts fixes, est entièrement consommé puis remplacé par le nouvel excédent éventuel, sans plafond de jeu. L'Optimizer demande directement un stock `0..100000` à l'utilisateur ; cette borne de saisie n'est pas un plafond du jeu | utilisateur, valeurs et décision produit du 2026-09-23 |
| Répétitions sans plafond connu | Scratch de Raoq, Sonic Boom d'Ermeda et Chain Fire utilisent un nombre total de coups saisi de `1` à `10`. Pour Raoq, l'utilisateur choisit après quel coup le break DEF réussit | utilisateur, décision produit du 2026-09-23 |
| Déclenchements de Hwa et Jackie | Burning Whip répète exactement la S1 ou S2 initiale une fois, sans récursion, sur interrupteur. Exploding Hands répète une fois son ratio `7.4 × ATQ`, sur interrupteur, sans nouvelle tentative d'étourdissement | utilisateur, confirmation explicite du 2026-09-23 |
| Zeratu — Forbidden Power | L'utilisateur choisit 1, 2 ou 3 attaques, défaut 3. Les attaques 2 et 3 valent chacune 50 % du ratio initial : trois attaques valent `100 % + 50 % + 50 % = 200 %` ; **les skillups s'appliquent** à ces deux coups, et le bonus de Trample selon les PV de la cible est **recalculé à chaque coup** sur les PV restants (2026-10-03, Q03) | utilisateur, confirmation explicite du 2026-09-24 et du 2026-10-03 |
| Sia — Great Friends | Sélecteur 2 ou 3 coups supplémentaires, défaut 2. Les deux skillups `Damage +10 %` s'appliquent à chaque coup du passif, ajouté après la S1 ou S2 sélectionnée | utilisateur, confirmation explicite du 2026-09-24 |
| Chaînes des Kung Fu Girls | Les formes non éveillées `8206` à `8210` n'ont pas de suite et ne sont pas sélectionnables. Sur les formes éveillées, un break DEF réussi de S1 est actif pour la S2. Les cinq Dragon Attack utilisent un sélecteur de 1 à 4 coups reçus, défaut 4 ; Fei choisit l'ignore DEF séparément pour chaque coup | utilisateur, confirmations explicites des 2026-09-23 et 2026-09-24 |
| Calcul monocible et nouvelle cible | Une contribution obligatoirement portée sur un autre monstre est ignorée : notamment la S2 après Sword of Promise des Valkyrjas et la seconde attaque de Shadow Assault de Tanya | utilisateur, décision produit du 2026-09-23 |
| Samouraïs — tour supplémentaire | Après S1, l'utilisateur choisit S1/S2/S3/S4 ; après S2, S1/S3/S4 ; après S3, S1/S2/S4. Une S4 sélectionnée seule ne déclenche rien. La compétence suivante garde son propre profil et son slot. Seules les formes nommées `16911` à `16915` sont sélectionnables : les formes génériques `16901` à `16905` et l'Imperfect Samurai `16921` ne le sont pas et sont ignorées par l'Optimizer | utilisateur, décisions produit des 2026-09-23 et 2026-09-24 |
| Barque — Shoot n' Slash | Backspin Slash puis Pirate's Strike ; le break DEF de la première frappe, s'il est activé par l'utilisateur, profite à la seconde. Le bonus `+35 %` par effet nocif est recalculé avant chaque frappe. Skillups et lignes d'artéfact : `400` pour Backspin Slash, puis `401` pour Pirate's Strike | utilisateur, confirmation explicite du 2026-09-24 |
| Ignore DEF des Blade Dancers | **le coup 1 ne peut JAMAIS ignorer la DEF** ; une fois qu'un coup ignore, **tous les suivants ignorent** | utilisateur |
| Défauts d'ignore DEF | 3 coups : **aucun ignore DEF** ; 7 coups : **septième seul**, dernier coup toujours ignore DEF | utilisateur, confirmation de revue du 2026-09-23 |
| Auras PV/ATQ/DEF | **+8 % de la statistique de BASE par effet de set** | utilisateur |
| Auras RES/PRE | **+8 points de pourcentage par effet de set**, additifs : `0 % + 8 % = 8 %` ; jamais `base × 8 %` | utilisateur, précision de revue |
| Sets d'aura, les cinq stats | Fight → ATQ · Determination → DEF · Enhance → PV · Accuracy → **PRE** · Tolerance → RES | utilisateur (« Accuracy PV » de la demande était une coquille) |
| Plafond de saisie des auras externes | **15 sets au total**, tous types confondus : au plus 5 autres monstres avec 3 sets chacun (`5 × 3`). Les 3 activations possibles du monstre optimisé s'ajoutent ensuite ; 18 reste la borne physique du total effectif, **pas** celle du champ saisi | utilisateur, changement de périmètre confirmé le 2026-09-25 ; borne physique initiale du 2026-09-23 |
| Artéfact 411 | Premier coup du tour seulement ; s'il est en zone, chaque adversaire recevant CE coup en profite. Jamais sur Tempest, même sélectionné seul, ni sur le coup de zone de Blade Surge | utilisateur, correction explicite en revue |
| Cible secondaire | « Autres ennemis » = dégâts sur **un** autre ennemi, jamais somme sur tous | utilisateur, précision de revue |
| Tempest seul | Une seule contribution, jamais un second déclenchement de lui-même | utilisateur, précision de revue |
| Conquête et lignes 218–221 | Le bonus Conquête vit dans le terme DMG% : il ne s'applique jamais au bucket Additionnel, dont font partie les dégâts supplémentaires 218–221 | utilisateur, 2026-09-30 ; concorde avec la spec (`degats-reels/artefacts-et-degats-bruts.md`, bucket Additionnel sans DMG%, relevés Julie et Jessica) et le code (`damage.ts`, `dmgPct` vs `horsCoupBrut`) |
| Points de relique et lignes 218–221 | Les points de Bravoure (ATQ), Éternité (DEF) et Origine (PV), acquis au début du combat, augmentent la stat dont les lignes 218–221 prennent leur pourcentage | utilisateur, 2026-09-30 |
| Lignes 224 et 400 sur Blade Surge | **224** (« D.CRIT+ comp cib uniq pdt tour ») porte sur les **coups 1 et 2** seulement ; **400** (« [Comp.1] Aug. Dgts CRIT ») porte sur les **trois coups**, coup de zone compris | utilisateur, confirmation explicite du 2026-10-02 |
| Rankyaku — `5 × VIT` | La VIT est la **VIT finale** : base + runes + set + lead + effet d'augmentation de vitesse, éventuellement augmentée par les artéfacts | utilisateur, confirmation explicite du 2026-10-02 |
| Tempest — coups critiques | Tempest **peut infliger un coup critique** (les lignes de Dgts CRIT 402/410 s'y appliquent une fois) | utilisateur, confirmation explicite du 2026-10-02 |
| Une attaque se lit dans la prose | Un ratio (`formule`) et un nombre de `coups` dans SWARFARM ne prouvent pas qu'un sort attaque (le soin S2 d'Anavel ; le bouclier S2 de Frieren `24909`). Avant de traiter un sort comme offensif, vérifier dans sa prose la notion d'attaque ou de dégâts ; sans elle, ce n'est pas une attaque. **Précision du 2026-10-03** : une prose ancienne et laconique peut taire un coup réel — Sleep Spell `1161` (« ratio de 600 % × ATQ ») et Ice Ball `1206` sont jugés offensifs par l'utilisateur sans mot d'attaque dans leur prose ; un sort sans ce mot va donc à l'utilisateur, il n'est pas masqué d'office | utilisateur, 2026-10-02 et 2026-10-03 (lot 15g) |
| Effets de PV sans coup | Bolverk S3, Harmonia S3, Vivachel S3, les passifs d'Aya vent (S3) et de Nobara vent (`20313`, prose identique mot pour mot) agissent sur les PV ennemis **sans infliger de coup** et ne dépendent que des stats de l'adversaire : **ignorés** par le calcul de l'Optimizer. Une perte de PV qui accompagne un coup (Hellfire de Daphnis) reste comptée | utilisateur, 2026-10-02 |
| Chaînes des Kung Fu Girls (sens) | Une S1 peut appeler la S2 après elle, une S2 peut appeler la S3 ; une S2 n'appelle jamais la S1 et une S3 n'appelle rien. Choisir la S3 : un seul sort ; choisir la S1 : la chaîne entière possible, chaque appel sous interrupteur | utilisateur, 2026-10-03 |
| Trinity Claymore | Le hasard (20 % par attaque, 50 % sur retrait de bonus) le **débloque pour le tour suivant** : aucun sort ne l'active en chaîne. Choisi comme sort : **toute la chaîne d'abord (son S1, puis son S2), puis ses 3 coups au ratio du sort** — Taebaek et Hwoarang ténèbres, versions Summoners War et collab | utilisateur, 2026-10-03 |
| Chance d'ignore DEF par coup (Fei) | Chacun des 4 coups, **le premier compris**, a sa chance d'ignorer la DEF | utilisateur, 2026-10-03 |
| Taebaek | La **prose** fait foi : 15 % / 150 (l'effet de la donnée dit 20 % / 200) | utilisateur, 2026-10-03 |
| Bonus de Taux Crit | S'ajoute **en points** ; depuis le lot CM, il ne change un total que s'il déclenche un effet sur critique ou alimente un reversement du surplus au-delà de 100 % | utilisateur, 2026-10-03 |
| Assiette des « +X % » de passif | Base ou totale **selon le passif** : aucune règle générale, à relever passif par passif | utilisateur, 2026-10-03 |
| Energy Punch de Mina | Suit le mode critique : en « Critique », un Energy Punch par coup du sort ; en « Non critique », aucun | utilisateur, 2026-10-03 |
| Yuji et Rick (S2) | La réduction de DEF posée par le 1er coup garantit le critique du 2e : **posée sans attendre de relevé** ; elle **baisse aussi la DEF du 2e coup** (lot 15f) | utilisateur, 2026-10-03 |
| Dgts CRIT d'une attaque déclenchée (Q02) | Prose « attacks again » avec le ratio du passif → lignes de Dgts CRIT **du sort qui porte le passif** (son emplacement) ; prose qui nomme un sort (« attacks with [X] ») → lignes **du sort X** ; prose peu claire → soumise **sort par sort** à l'utilisateur | utilisateur, 2026-10-03 (questionnaire) |
| Anges jumeaux (Q04) | Chaque paire a **deux jeux de sorts, un par forme** ; elle peut lancer un sort de la première forme puis un sort de la seconde **dans le même tour**. Les sorts « Horn of … » de la donnée sont ceux de la forme de soutien, qui n'inflige **aucun** dégât ; **tous** les sorts de la forme archer en infligent. Choix produit : le sort de l'archer **seul**, sans tenir compte du Horn lancé avant | utilisateur, 2026-10-03 (questionnaire) |
| Provocation (Q05) | La Provocation **n'est pas** un effet d'incapacité (Fast Charge de Dr. Richard ne coïncide jamais avec une de ses attaques) | utilisateur, 2026-10-03 (questionnaire) |
| Tempest Sword de Lupinus (Q06) | Le 3e coup, sur tous les ennemis, a **le même ratio** que les deux premiers (`{ATK} + 0.06*{Target MAX HP}`) ; comme pour son S1, l'écran doit pouvoir calculer les dégâts sur les ennemis non ciblés | utilisateur, 2026-10-03 (questionnaire) |
| Stella, Blade Dance of the Reaper (Q08) | Coups selon la **VIT totale en combat** (arrondie au supérieur) : < 129 → 3 ; 129 → 4 ; 154 → 5 ; 179 → 6 ; ≥ 204 → 7 | utilisateur, 2026-10-03 (questionnaire) |
| Lord of Hell (Q09) | Garde **les runes et l'ATQ de Liliana**, puis +50 % de dégâts | utilisateur, 2026-10-03 (questionnaire) |
| Marque de la S2, puis S1 enchaîné (D03) | Shoryuken (RYU) et Iron Uppercut (Striker) : la Marque est posée (ou non) **avant** que le S1 se déclenche → interrupteur « Marque posée » pour le S1 enchaîné | utilisateur, 2026-10-03 (questionnaire) |
| Bella, One More Time! (D04) | Fire! suit l'attaque, sous interrupteur **allumé par défaut** (après S1, S2 ou S4) | utilisateur, 2026-10-03 (questionnaire) |
| Seuil de PV : un interrupteur (D06) | Ce qui dépend d'un **seuil** de PV (bonus ou déclenchement « si les PV sont au-dessus de X % ») se règle par un interrupteur, pas par la saisie exacte des PV ; une valeur continue (Brawler's Will de Trevor) garde sa saisie et affiche le bonus obtenu | utilisateur, 2026-10-03 (questionnaire, règle d'interface) |
| Dorothy, Time of Destruction (D36) | Le bonus dépend des PV détruits **de la cible** : jauge de 15 à 60 %, bonus DMG% égal au % détruit (champ déjà présent pour le passif de Borgnine) | utilisateur, 2026-10-04 (questionnaire) |
| Parts non calculées (D36) | Égalisation des ratios de PV (Lavender), réduction de PV en % après les dégâts du ratio (Jasmine, Daniel) : **non calculées, dit à l'écran** — rien à optimiser ; Devil's Bargain (Bael) : la prose se trompe, aucune conversion des PV perdus en dégâts | utilisateur, 2026-10-04 (questionnaire) |
| Stormfist de Mayasura, Varuna, Danu (valeur) | 3 coups, **+1 coup par tranche de 60 % de l'ATQ de base** dans l'ATQ totale, 6 au plus : 6 coups à ATQ totale = 280 % de l'ATQ de base (base + 180 %) ; l'ATQ de base est **celle de chaque monstre**, et le passif de Mayasura (Constant Training, +100 ATQ par attaque) compte dans l'ATQ totale | utilisateur, 2026-10-04 |
| Torrent de Leo et Ragdoll (D61) | Le ratio ne bouge pas (5,5 × ATQ) ; sous 30 % de PV, un interrupteur d'ignore DEF — état actuel du code | utilisateur, 2026-10-04 (questionnaire) |
| Carlos, Collect Weapons (D62) | ATQ gagnée saisie **en %**, plafond de 300 % **de l'ATQ de base** | utilisateur, 2026-10-04 (questionnaire) |
| Huga, Slaughter (D47) | « +30 % de dégâts critiques » = **+30 points** de Dégâts CRIT | utilisateur, 2026-10-04 (questionnaire) |
| Kamatau, Exile (D49) | Ne reçoit aucun buff : ses buffs sont éteints | utilisateur, 2026-10-04 (questionnaire) |
| Chilling, The Cunning (D53) | **+20 de VIT par buff** sur Chilling ; un champ « nombre de buffs sur Chilling » pour son S1, qui lit la VIT | utilisateur, 2026-10-04 (questionnaire) |
| RES et PRE des passifs (D54) | Jamais comptées dans les conditions de recherche, même avec l'interrupteur des auras | utilisateur, 2026-10-04 (questionnaire) |
| DHALSIM, Jarrett (D44) | +50 % par dégât continu sur la cible, **la prose fait foi** (la donnée dit 30) ; compteur propre des dégâts continus | utilisateur, 2026-10-04 (questionnaire) |
| Self Repair d'Eliza (D41) | Bonus continu : 0 % à 50 % de PV ou moins, puis +2 % par point de PV, 100 % à PV pleins | utilisateur, 2026-10-04 (questionnaire) |
| Path of the Brave Warrior de Deragron (D41) | On saisit le **soin reçu** : +1 % de dégâts par tranche de soin égale à 1 % de ses PV max, 200 % au plus — à soin égal, moins il a de PV, plus le bonus est grand | utilisateur, 2026-10-04 (questionnaire) |
| Sword of Destruction des Démons (D36) | Champ « PV actuels de l'ennemi le plus en forme » ; dégâts de base = **370 % × ATQ + 100 % des PV retirés** par la première partie (10 % de ces PV) ; cette part peut être **critique**, comme le S3 de Lynn | utilisateur, 2026-10-04 (questionnaire) |
| Espresso Cookie (D36) | Feu (Extraction) comme Jasmine, ténèbres (Blending) comme Lavender : part non calculée, dit à l'écran | utilisateur, 2026-10-04 (questionnaire) |
| Lucifer, Red Battlefield (D32) | Nouvel **effet actif** (comme celui de Velaska) : +1 % de dégâts infligés par palier de 5 000 dégâts reçus auparavant, **50 % au plus**, dans le terme DMG% (comme le S3 de Zaiross) ; saisie de 0 à 50 % avec l'équivalent en dégâts reçus indiqué à côté ; valeur **fixe** pendant toute l'attaque | utilisateur, 2026-10-03 (questionnaire) |
| Kiki, Start of Pain (D33) | Vol de PV **compté** : 4 % des **PV max de Kiki** par effet nocif sur la cible (8 % au plus), à **chaque coup** ; choix 0, 1 ou 2 effets ; le S1 (Magical Eye) peut poser une baisse d'ATQ à chaque coup et augmenter le compte s'il n'y en avait pas déjà 2 | utilisateur, 2026-10-03 (questionnaire) |
| Meteor Strike, Black Meteor (D20) | Le coup 1 ignore aussi la DEF si un effet nocif est déjà posé avant (réduction de DEF, Marque ou autre) ; choix « ignore DEF à partir du coup 1, 2, 3, ou aucun » | utilisateur, 2026-10-03 (questionnaire) |
| Crushed Hopes de Cichlid (D21) | Seul le **2e coup** pose la réduction de DEF : posée au coup 2 (le 3e en profite), déjà active avant le coup 1, ou aucune | utilisateur, 2026-10-03 (questionnaire) |
| Valeurs connues par l'API seule (D12) | L'API SWARFARM **par défaut**, sauf si la prose du sort la contredit (alors relevé ou confirmation) | utilisateur, 2026-10-03 (questionnaire) |
| Chain Fire (D09) | Salves de **deux** flèches : le compteur avance par pas de 2, une unité = une flèche | utilisateur, 2026-10-03 (questionnaire) |
| Frodo — buff « all allies » du passif | Le porteur **reçoit aussi** le buff d'ATQ (le champ `surSoi: false` de la fiche est faux) ; de même Silver Tail, son jumeau collab | utilisateur, 2026-10-03 (lot P2) |
| Versions Summoners War et collab | Deux monstres reliés par `jumeauCollab` (même `skillGroupId`) ont **la même mécanique** : une valeur ou une règle fournie pour l'un vaut pour l'autre (déjà dit pour Taebaek et Hwoarang ténèbres) | utilisateur, 2026-10-03 |
| Sindar's Volley, Sylvan Volley | **2 à 5 coups** : 2, puis jusqu'à 3 supplémentaires ; pas encore codé : [pistes.md § Plages de coups à relever et coups « au hasard »](pistes.md) | utilisateur, 2026-10-04 (questionnaire) |
| Clear Water, Precision | +50 RES et +25 PRE en **points additifs** (utile seulement si les passifs comptent dans les conditions : voir « RES et PRE des passifs ») | utilisateur, 2026-10-03 (questionnaire) |

⚠️ **La jauge d'ATB adverse n'est pas modélisée dans l'Optimizer, et ce
chantier ne la modélise pas.** C'est précisément pourquoi la condition d'ignore
DEF devient un **choix** de l'utilisateur, et non un état déduit : l'app ne
sait pas où en est l'ATB de la cible. Voir lot 10.

Les skillups de Blade Surge et de Tempest, ainsi que la cible du troisième
coup de Blade Surge, sont désormais des valeurs curées fournies par
l'utilisateur : aucune de ces trois règles ne demeure une hypothèse.
