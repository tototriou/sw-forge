# Dégâts réels — sorts incomplets, sets d'aura, ergonomie

**Statut :** CHANTIER en cours — branche forge/degats-et-aura

Cinq demandes d'une même session (2026-09-23) : quatre sorts au modèle
incomplet, les effets de set d'aura absents du modèle, une réinitialisation
de saisie de trop, un plancher de condition faux, une vérification à faire.
Elles partagent un même point d'entrée de code (`damage.ts` +
`OptimizerSection.tsx`) et une même dette de spec (`degats-reels.md`, en
exception du lint), d'où un seul chantier.

---

## Partie A — préambule commun (à relire par chaque lot)

### A.0 Unités de périmètre

- **Ligne d'audit** : une ligne de `inventaire.csv`, rattachée à un constat.
- **Identifiant de compétence unique** : un `skillCom2usId`, unité première
  d'une table de code clé par cet identifiant.
- **Forme de monstre du corpus** : une forme identifiée dans les fichiers
  `public/data/skills/*.json` ; plusieurs formes peuvent partager une compétence.

Ne jamais employer « fiche » comme unité de comptage. Les preuves donnent
trois colonnes distinctes et nomment toutes les formes affectées par chaque
identifiant. Les nombres initiaux issus de l'audit ne bornent pas le corpus.
Après le lot 1, le pilote amende obligatoirement les contrats 8, 9, 10 et 11,
leurs listes et leurs nombres, avant de les autoriser à démarrer.

### A.1 Pourquoi

Le chantier corrige les planchers artéfacts/relique (lots 3–4), la perte du
contexte entre monstres (5), les auras absentes des calculs de combat
(6, 6bis, 7), Blade Surge et Tempest incomplets (8–9), l'ignore DEF
conditionnel (10), puis
la prose des passifs déjà calculés mais mal présentés (11).
Les constats détaillés et coordonnées de code sont dans chaque contrat.
Les valeurs curées fournies sont en A.2 ter ; le périmètre réel se mesure au
lot 1, sans confondre l'audit et le corpus. Le découpage documentaire précède
les modifications de `degats-reels.md` (2a/2b).
Le lot 6 a livré des auras comme total d'équipe figé ; la décision du
2026-09-25 les sépare désormais en auras **externes** saisies et auras
**propres au build** calculées. Le lot 6bis corrige le modèle avant l'écran 7.
Deux lots s'ajoutent le 2026-09-30, après la restauration des notes relique
et sa revue externe : **6bis-b3c** corrige la dominance, qui ignorait l'effet
unique de la relique, et **O** durcit l'outil `chantier` (`ouvrir`,
`livrer`). O sort du sujet dégâts ; il est porté ici pour ne pas être oublié
(décision utilisateur du 2026-09-30).

### A.2 Cible et périmètre

**Cible, en termes vérifiables :**

1. Les quatre sorts se calculent, avec pour chacun le réglage utilisateur
   décrit en Partie B et un test nommé dans `tests/`.
2. Les cinq sets d'aura **externes au monstre optimisé** sont saisissables
   dans « État de mon monstre ». Chaque build ajoute ses propres activations
   réelles, même non demandées ou complétées par Intangible : elles entrent
   ensemble dans `statsDebutCombat`, les objectifs `degats_reels` et `ehp`, les
   passifs et les exclusives de relique. Un unique
   interrupteur autorise RES/PRE seulement dans les conditions min ET max ;
   les auras PV/ATQ/DEF ne participent jamais aux conditions.
3. Le contexte de combat survit à un changement d'espèce ; ce qui désigne un
   sort précis de l'ancienne espèce ne survit pas. Un changement d'exemplaire
   de même espèce ou une navigation entre listes ne vide aucun réglage de
   combat.
4. En « Libre », la contribution garantie des emplacements d'artéfact au
   plancher vaut 0 ; la base et une relique réellement équipée restent comptées
   selon le mode d'affichage. Ce n'est pas un plancher total nul sur huit stats.
5. `spec/outils/degats-reels.md` n'est plus en exception de `spec-lint.json`.
6. Chaque mécanique corrigée l'est pour **tous** les identifiants et formes retenus au lot 1
   qui la partagent (A.3 bis), et le reliquat de l'inventaire a un **plan
   chiffré** (lot 13).

**Hors périmètre, explicitement :**

- **L'IMPLÉMENTATION du reliquat de l'inventaire.** Mesuré : **243 constats
  restants, 521 lignes d'audit** hors suivi et hors chantier (A.2 bis). Le lot 13 en produit le plan découpé et
  chiffré ; ce que ce chantier en implémente se décide **sur ce plan**, pas
  par avance. Promettre les 243 ici serait un engagement qu'aucun lot ne peut
  tenir.
- **Les attaques conjointes et les lignes d'artéfact 209/225.** Demande du
  2026-09-25, consignée intégralement dans
  [la piste dédiée](../outils/optimizer/decisions/attaques-conjointes-piste.md) :
  chantier distinct à cadrer. Le lot 13a/13b-* rapproche cette piste des
  constats 234/235 et des découvertes hors audit, sans l'implémenter ici.
- **Le découpage d'`optimizer.md` et d'`artefacts.md`**,
  tous deux en exception du lint. `spec-lint.json` les assigne à d'autres
  chantiers (`découpage-optimizer`, `artefacts`) avec, pour `optimizer.md`,
  la mention « hors périmètre de ce cadrage ». Décision de l'utilisateur
  (2026-09-23) : on découpe `degats-reels.md`, qui nous est assigné
  (`chantier_responsable: "degats"`), et on ajoute aux deux autres dans leurs
  sections existantes. **Dérogation utilisateur explicite à la recette de
  découpage préalable de `spec-hygiene` pour les modifications normatives de
  ces deux fichiers dans ce chantier**, confirmée lors de la revue. Elle ne
  dispense ni de la cohérence des règles ni de la mise à jour des invariants.
  Une entrée de `pistes.md` note la dette (lot 14).
  **Étendue le 2026-10-01 à `harnais-diagnostic.md`** (exception du lint,
  chantier `harnais`), décision de l'utilisateur avant 6bis-b7, qui amende
  sa § 6.2 : mêmes conditions, ajouts dans les sections existantes, dette
  au lot 14. Elle régularise l'ajout normatif de 6bis-b4 à sa § 3
  (`sortCandidates` et contexte de dégâts), fait sans dérogation et validé
  sans que le pilote le relève. **Étendue de même le 2026-10-01 à
  `harnais-diagnostic-extensions.md`** (exception, chantier `harnais`),
  décision de l'utilisateur à la validation de 6bis-b7 : notes de
  correction en tête des § 9.2 et 9.3, deux renvois ajustés, rien d'autre
  réécrit ; dette au lot 14.
  Réparer leurs liens au lot 2b ne déclenche aucun découpage : `spec-hygiene`
  exclut explicitement les liens de son déclencheur normatif.
- **Les parties 3 et 4 de l'audit des dégâts conditionnels.** Elles restent
  « à définir » ; ce chantier n'est pas leur cadrage (A.2 bis).
- **Une passe responsive** sur les cartes touchées au-delà de ce que la
  demande exige (le panneau « Options » au doigt reçoit les mêmes contrôles,
  rien de plus).

### A.2 bis Croisement avec l'audit des dégâts conditionnels

Les constats 151, 164, 110 et 212 de l'audit sont les points de départ du
lot 1. Ils ne figurent pas dans le suivi initial des 78 constats livrés.
Le reliquat hors suivi ET hors chantier est **243 constats / 521 lignes
d'audit**. La commande, la ventilation et la réconciliation vivent au lot 13a.
Le constat 110 semble déjà calculé (`atkDepuisSpd: 5`) ; le lot 11 doit en
prouver le calcul avant sa clôture documentaire. Aucun statut ancien du CSV
ne vaut preuve de livraison.

### A.2 ter Les valeurs de jeu — curées, avec leur source

**Les valeurs ci-dessous sont fournies.** Elles viennent de l'utilisateur
(joueur), le 2026-09-23, sauf mention contraire. Elles ne sont pas à redemander.
Le cas à sept coups est confirmé au lot 10 ; aucune valeur ne se complète
par invention. Les précisions de revue remplacent les anciennes
affirmations contradictoires, notamment sur 411.

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
| Zeratu — Forbidden Power | L'utilisateur choisit 1, 2 ou 3 attaques, défaut 3. Les attaques 2 et 3 valent chacune 50 % du ratio initial : trois attaques valent `100 % + 50 % + 50 % = 200 %` ; **les skillups s'appliquent** à ces deux coups (rappel du 2026-10-03, Q03) | utilisateur, confirmation explicite du 2026-09-24 et du 2026-10-03 |
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
| Une attaque se lit dans la prose | Un ratio (`formule`) et un nombre de `coups` dans SWARFARM ne prouvent pas qu'un sort attaque (le soin S2 d'Anavel, historiquement ; le bouclier S2 de Frieren `24909`). Avant de traiter un sort comme offensif, vérifier dans sa prose la notion d'attaque ou de dégâts ; sans elle, ce n'est pas une attaque. **Précision du 2026-10-03** : une prose ancienne et laconique peut taire un coup réel — Sleep Spell `1161` (« ratio de 600 % × ATQ ») et Ice Ball `1206` sont jugés offensifs par l'utilisateur sans mot d'attaque dans leur prose ; un sort sans ce mot va donc à l'utilisateur, il n'est pas masqué d'office | utilisateur, 2026-10-02 et 2026-10-03 (lot 15g) |
| Effets de PV sans coup | Bolverk S3, Harmonia S3, Vivachel S3, le passif d'Aya vent (S3) agissent sur les PV ennemis **sans infliger de coup** et ne dépendent que des stats de l'adversaire : **ignorés** par le calcul de l'Optimizer. Une perte de PV qui accompagne un coup (Hellfire de Daphnis) reste comptée | utilisateur, 2026-10-02 |
| Chaînes des Kung Fu Girls (sens) | Une S1 peut appeler la S2 après elle, une S2 peut appeler la S3 ; une S2 n'appelle jamais la S1 et une S3 n'appelle rien. Choisir la S3 : un seul sort ; choisir la S1 : la chaîne entière possible, chaque appel sous interrupteur | utilisateur, 2026-10-03 |
| Trinity Claymore | Le hasard (20 % par attaque, 50 % sur retrait de bonus) le **débloque pour le tour suivant** : aucun sort ne l'active en chaîne. Choisi comme sort : **toute la chaîne d'abord (son S1, puis son S2), puis ses 3 coups au ratio du sort** — Taebaek et Hwoarang ténèbres, versions Summoners War et collab | utilisateur, 2026-10-03 |
| Chance d'ignore DEF par coup (Fei) | Chacun des 4 coups, **le premier compris**, a sa chance d'ignorer la DEF | utilisateur, 2026-10-03 |
| Taebaek | La **prose** fait foi : 15 % / 150 (l'effet de la donnée dit 20 % / 200) | utilisateur, 2026-10-03 |
| Bonus de Taux Crit | S'ajoute **en points** ; depuis le lot CM, il ne change un total que s'il déclenche un effet sur critique ou alimente un reversement du surplus au-delà de 100 % | utilisateur, 2026-10-03 |
| Assiette des « +X % » de passif | Base ou totale **selon le passif** : aucune règle générale, à relever passif par passif | utilisateur, 2026-10-03 |
| Energy Punch de Mina | Suit le mode critique : en « Critique », un Energy Punch par coup du sort ; en « Non critique », aucun | utilisateur, 2026-10-03 |
| Yuji et Rick (S2) | La réduction de DEF posée par le 1er coup garantit le critique du 2e : **posée sans attendre de relevé** ; elle **baisse aussi la DEF du 2e coup** (lot 15f) | utilisateur, 2026-10-03 |
| Dgts CRIT d'une attaque déclenchée (Q02) | Prose « attacks again » avec le ratio du passif → lignes de Dgts CRIT **du sort qui porte le passif** (son emplacement) ; prose qui nomme un sort (« attacks with [X] ») → lignes **du sort X** ; prose peu claire → soumise **sort par sort** à l'utilisateur | utilisateur, 2026-10-03 (questionnaire) |
| Anges jumeaux (Q04) | Chaque paire a **deux jeux de sorts, un par forme** ; elle peut lancer un sort de la première forme puis un sort de la seconde **dans le même tour**. Les sorts « Horn of … » de la donnée sont ceux d'une seule forme | utilisateur, 2026-10-03 (questionnaire) |
| Provocation (Q05) | La Provocation **n'est pas** un effet d'incapacité (Fast Charge de Dr. Richard ne coïncide jamais avec une de ses attaques) | utilisateur, 2026-10-03 (questionnaire) |
| Tempest Sword de Lupinus (Q06) | Le 3e coup, sur tous les ennemis, a **le même ratio** que les deux premiers (`{ATK} + 0.06*{Target MAX HP}`) ; comme pour son S1, l'écran doit pouvoir calculer les dégâts sur les ennemis non ciblés | utilisateur, 2026-10-03 (questionnaire) |
| Stella, Blade Dance of the Reaper (Q08) | Coups selon la **VIT totale en combat** (arrondie au supérieur) : < 129 → 3 ; 129 → 4 ; 154 → 5 ; 179 → 6 ; ≥ 204 → 7 | utilisateur, 2026-10-03 (questionnaire) |
| Lord of Hell (Q09) | Garde **les runes et l'ATQ de Liliana**, puis +50 % de dégâts | utilisateur, 2026-10-03 (questionnaire) |
| Clear Water, Precision (Q10) | +50 RES et +25 PRE en **points additifs** (utile seulement si les passifs comptent dans les conditions, D54) | utilisateur, 2026-10-03 (questionnaire) |

⚠️ **La jauge d'ATB adverse n'est pas modélisée dans l'Optimizer, et ce
chantier ne la modélise pas.** C'est précisément pourquoi la condition d'ignore
DEF devient un **choix** de l'utilisateur, et non un état déduit : l'app ne
sait pas où en est l'ATB de la cible. Voir lot 10.

Les skillups de Blade Surge et de Tempest, ainsi que la cible du troisième
coup de Blade Surge, sont désormais des valeurs curées fournies par
l'utilisateur : aucune de ces trois règles ne demeure une hypothèse.

### A.3 Hiérarchie des priorités

Dans cet ordre, quand deux consignes de ce cadrage se contredisent :

1. **Ne jamais inventer une valeur de jeu.** Un ratio, un pourcentage, une
   assiette (base ou total) non relevés bloquent le lot qui en dépend ; ils ne
   se comblent ni par analogie avec un effet voisin, ni par une moyenne, ni
   par « ça a l'air d'être ça ». Skill `game-data-curation`.
2. **Ne pas casser ce qui marche.** 100 % des vérifications de la zone touchée
   passaient avant le lot : elles passent après. Un test existant qui change
   de valeur attendue est un signal, pas une formalité à mettre à jour.
3. **Erreur observable plutôt que silence.** Une mécanique qu'on ne sait pas
   calculer s'affiche refusée avec sa raison (`SkillDamageUnsupported`), jamais
   calculée avec une constante de remplacement.
4. **Ne rien perdre de la spec.** Le découpage du lot 2 porte une correspondance
   source → destination et un diff séquentiel de chaque bloc ; ordre et
   doublons conservés, seules normalisations CRLF et espaces de fin permises.
   Un comptage des lignes supprimées ne prouve pas la conservation.
5. **Volume lu.** Un plafond (≤ 500 lignes, ≤ 100 par bloc) n'autorise jamais
   à omettre : on dépasse, ou on scinde — on ne tronque pas.

### A.3 bis Une mécanique corrigée l'est pour TOUTE sa famille

**Décision utilisateur du 2026-09-23 :** corriger tous les monstres de
l'inventaire qui partagent la mécanique, sans laisser leurs équivalents faux.
- **Même mécanique** = même règle et mêmes paramètres (ratio, coups,
  condition) : dans le lot, sans exception, après classification sourcée.
- **Même architecture, paramètres différents** : livrer le mécanisme
  générique ; les cas sans valeurs sourcées vont au lot 13 avec leur numéro
  de constat. Les familles candidates sont nommées au lot 1.

Mesurer le périmètre dans l'audit puis le confronter au corpus entier.
Aucun effet voisin n'est assimilé par analogie. Chaque lot cite la preuve
du lot 1 et son amendement pilote (A.0).

### A.4 Catégories de lots → modèle et effort

- **M — mécanique** : aucune décision, diff intégralement relu, preuve rejouable.
- **C — classification** : inventaire structuré avec coordonnées et mesures.
- **J — jugement** : décision par élément, sourcée ; toute mécanique de jeu
  et toute forme d'interface relèvent de J.

Affectation actuelle (révisable sans toucher au reste) : **M → Sonnet, effort
bas · C → Sonnet, effort moyen · J → Opus, effort élevé.**

⚠️ **L'effort ne se règle pas à l'appel** : un sous-agent lancé par le
pilote prend celui de la session (xhigh puis max le 2026-10-02 — les 24
premiers, tous Opus 5.5, ont donc tourné au-dessus de cette table). Depuis
le 2026-10-02 (décision de l'utilisateur), deux définitions suivies le
fixent : `.claude/agents/lot-c.md` (Sonnet, `effort: medium`) et
`lot-m.md` (Sonnet, `effort: low`), types `lot-c` et `lot-m`. Actives à
partir de la session suivante (dossier absent au démarrage de celle-ci).
`lot-j.md` (Opus, `effort: high`, ajouté le 2026-10-02 au soir) applique de
même la ligne « J → Opus, effort élevé » ; la surveillance à chaud l'a pris
avec plusieurs minutes de retard (deux essais refusés à 15 secondes
d'écart, disponible une vague plus tard). Les lots J d'avant (8c, 9c,
première vague de 13b) ont tourné en `general-purpose` + Opus à l'effort de
la session (max).

### A.5 Branche, chantier, fichiers transverses

**Branche `forge/degats-et-aura` depuis `forge/implementation-relique`,
point `81284199`.** Dérogation à la création depuis `origin/main` : les
calculs de début de combat et de reliques nécessaires n'y étaient pas présents.
Fusion uniquement après le chantier relique ou avec lui sur une branche
d'intégration, jamais seule. Relever les révisions courantes au lot 0.

**Notes privées** : les lots touchent `spec/outils/optimizer/invariants.md`,
`pistes.md`, `artefacts.md` — gitignorés. Un chantier `degats-et-aura` doit
être **ouvert** (lot 0) et chaque lot qui y touche finit par
`livrer` → `verifier` → `integrer`, depuis l'installation, dès que ses notes
sont validées (sans attendre le lot 14 ni la fusion du code) :

```bash
node "$(git rev-parse --git-common-dir)/forge/installation/scripts/chantier.mjs" \
  verifier --chantier degats-et-aura
```

Le chantier `implementation-relique` est **terminé** (décision utilisateur
du 2026-09-29, voir ci-dessous) : ses notes n'avancent plus. Lancer quand
même `chantier rafraichir --chantier degats-et-aura` avant toute
modification de `reliques.md`, au cas où une intégration tardive aurait eu
lieu.

**Fichiers transverses portés par CE chantier** : `App.tsx` peut recevoir au
lot 5 le changement ciblé qui distingue import de compte et changement
d'espèce. `package.json`, `tsconfig.json`, `tailwind.config.js` ne sont pas
touchés (ni page ni section ajoutée ou renommée).
`ARCHITECTURE.md` ne reçoit au lot 2b que les corrections de références
effectivement présentes, si l'aperçu en trouve. Dérogation utilisateur du
2026-09-24 : la procédure Codex Windows dans `CLAUDE.md` et les adaptateurs
de skills manquants sont corrigés dans un commit transverse distinct des lots
de mécanique, après le constat de blocage au lot 3.

**`spec/outils/optimizer/reliques.md`** : propriété de
`forge/implementation-relique` jusqu'au 2026-09-29. **Décision utilisateur
du 2026-09-29 :** ce chantier est terminé, entièrement inclus dans cette
branche, et n'attend que sa fusion sur `main` pour être clôturé ; ce
chantier-ci peut donc modifier `reliques.md` quand un lot l'exige, avec
`rafraichir` avant la modification et `livrer` → `verifier` → `integrer`
ensuite, comme toute note privée.

⚠️ **Incident, découvert le 2026-09-30.** Les notes locales de ce dossier
étaient restées à l'état `bcbb49a` du `main` documentaire (17/09). `ouvrir`
les a gardées avec un simple avertissement, puis le premier `livrer`
(`a190130`, 23/09) les a recopiées en miroir. Il a ainsi retiré du `main`
documentaire tout le travail du chantier relique : 529 fichiers et le
contenu relique de 7 notes. Les lots suivants ont lu un `invariants.md`
sans sa section « Reliques ». La restauration par fusion à trois voies a
été revue par une session externe, corrigée, puis intégrée (`6559ecc`) ;
preuve `controle-restauration-relique.md`. **Jusqu'au lot O**, un
avertissement « Les notes locales diffèrent de la base documentaire » à
l'ouverture d'un chantier arrête tout, et `rafraichir` ne se lance pas sur
un chantier dont les notes locales seraient restées en retard.

**Fichiers transverses du lot O** (décision utilisateur du 2026-09-30) :
`scripts/chantier.mjs`, `tests/chantier.test.ts` (et `tests/index.ts` si un
test s'ajoute), `spec/chantiers/orchestration-parallele.md` pour les sections
sur `ouvrir` et `livrer`, et le passage de `CLAUDE.md` « Les notes privées se
LIVRENT ». Le lot ne lance pas `node scripts/chantier.mjs installer` : cette
commande remplace l'outil de tous les chantiers de la machine. Le pilote la
soumet à l'utilisateur après validation.

**Audit parallèle de la prose des sorts** (décision utilisateur du
2026-10-01). Une session distincte audite les sorts qui ne seraient pas
encore bien implémentés. Elle travaille hors de ce worktree : aucune
écriture dans l'arbre de code, aucune commande git sur cette branche (un
fichier temporaire à sa racine a bloqué `livrer` le 2026-10-01), aucune
modification de `damage.ts` avant les lots 8 à 11. Son livrable est un
relevé, sans code, **remis le 2026-10-01** et importé par le pilote :
`spec/outils/optimizer/archive/audit-prose-sorts-2026-10-01/` (relevé de
39 constats sur `a6661f77`, CSV, balayage et scripts ; notes `96b3e44`).
Routage vérifié par le pilote : aucun de ses 73 identifiants de compétence
n'appartient aux familles des lots 8 à 11, les 39 constats vont à 13a. Il
nourrit la fin du chantier :

- un constat sur une famille des lots 8 à 11 rejoint ce lot, par
  amendement pilote avant son brief ; si l'audit n'est pas remis à ce
  moment, le pilote demande à l'utilisateur s'il attend ;
- tout le reste est un intrant de 13a (voir son contrat).

### A.6 Si une vérification échoue, si un cas est ambigu

- **Vérification échouée → pas de commit.** Le lot s'arrête et rapporte.
- **Valeur de jeu manquante ou douteuse → le lot s'arrête**, écrit le besoin
  de relevé dans la section du lot 1 et le signale. Il ne code pas « en
  attendant », même derrière un interrupteur désactivé par défaut.
- **Ambiguïté de spec (deux lectures possibles) → conserver les deux
  lectures**, poser `<!-- À trancher : … -->` à l'endroit exact, et une ligne
  dans `spec/outils/optimizer/pistes.md`. ⚠️ Le ledger et le fichier se
  mettent à jour **ensemble** (CLAUDE.md).
- **Un chiffre écrit sans la commande qui l'a produit est une estimation** et
  se traite comme telle : à mesurer avant usage.
- **Un skill se redéclare à chaque action qui le qualifie**, pas une fois par
  lot : `game-data-curation` à chaque mécanique, `algo-verify` à chaque script
  ad hoc qui appelle le moteur, `optimizer-perf-testing` avant toute mesure.

### A.6 bis Preuves — où elles vivent, sous quelle forme

**Dossier unique** :
`spec/outils/optimizer/archive/controles-degats-aura-2026-09/` (privé, livré
par `chantier livrer`). Un fichier par lot, nommé `controle-<lot>.md`.

Chaque fichier : un **H1**, une ligne vide, puis
`**Statut :** ARCHIVE — preuve du lot <n> du chantier degats-et-aura`. Puis,
pour chaque preuve : la commande **exacte**, sa sortie **collée**, et ce
qu'elle établit. Un relevé en jeu est cité intégralement, avec sa date.

**Ordre de livraison, sans autoréférence :** finaliser la preuve privée →
`livrer` → `verifier` → inscrire l'identifiant du reçu et les sorties de ces
deux commandes dans le **résultat public du lot**, sous sa section de ce
cadrage. Aucun nouveau `livrer` ne suit cette inscription publique. La preuve
privée ne contient que les contrôles antérieurs à sa livraison ; on ne la
modifie pas pour y recopier son propre reçu. `integrer` suit la validation,
selon A.5 ; sa sortie peut également être inscrite dans le résultat public.

⚠️ **Le message de commit cite le fichier de preuve ; il ne le remplace pas.**
Un lot dont la seule sortie est un relevé ou un inventaire n'a pas de commit
de code : sa preuve est son fichier **et** le commit
`docs(cadrage): lot <n> terminé — …` qui embarque commandes et sorties.

⚠️ **Un oracle se valide aussi sur sa NOTE** (leçon de 6bis-b3b, 2026-09-30).
Un oracle qui note avec un score simplifié, par exemple sans l'effet unique
de la relique, valide des coupes qui perdent l'optimum du vrai score. Il
reste d'accord avec le moteur précisément là où les deux ont tort. Toute
preuve par oracle, et sa validation par le pilote, vérifie que la note est
celle de la production pour l'équipement complet : auras propres, relique,
effet unique, **et paire d'artéfacts** (profil des lignes 218–221, paire
résolue par build en « Libre » ; ajout de la contre-revue du 2026-10-01,
après le défaut B1). L'oracle relique (garantie E) note avec
`params.artifacts`, la paire représentative : il reste exact pour la seule
dimension relique.

### A.7 Dépendances, ordre, suivi

#### Graphe et validations

Notation : **`A → B` signifie « B requiert A »** (prérequis à gauche).

```text
0 → 1a → 1b, 1c1, 1c2, 1c3, 1d, 1e
1c2 → 1a2 → 1c4
1b, 1c1, 1c2, 1c3, 1c4, 1d, 1e → 1f → amendement pilote → 8, 9, 10, 11
                            (extraction, correction bornée, classifications,
                            réconciliation, puis contrats corrigés)
0 → 2a → 2b → 6, 8, 9, 10, 11 (aucune modification normative de degats-reels.md
                            avant son découpage)
0 → 3 → 4                  (4 mesure le plancher que 3 vient de corriger)
0 → 5                      (réinitialisations du hook et appelants, dont App.tsx)
5 → 6 → contre-revue du cadrage → 6bis-a1
        → amendement pilote et revue indépendante
        → correctif pilote de la revue → validation indépendante
        → 6bis-a2a1-contexte → 6bis-a2a1-suite
        → 6bis-a2a1-suite-correction-stats-chain
        → 6bis-a2a1-suite-finalisation-preuve → 6bis-a2a2
        → 6bis-a2b1 → 6bis-a2b2 → 6bis-a2b3
        → 6bis-a3a → 6bis-a3b
        → 6bis-a4a → 6bis-a4b → 6bis-a4c1 → 6bis-a4c2
        → 6bis-a4d1 → 6bis-a4d2
        → amendement et revue pilote
        → 6bis-b1 → 6bis-b2 → 6bis-b3a → 6bis-b3b → 6bis-b4
        → 6bis-b5a
        → contre-revue des contrats b3c et O → amendement pilote
        → 6bis-b3c (dominance et effet unique, revue externe du 2026-09-30)
        → O (outil chantier, après contre-vérification ciblée de son
             point 3 ; placé ici par ordre d'exécution, il ne dépend
             d'aucun lot 6bis)
        → 6bis-b5b → 6bis-b5c (effets uniques de relique, demande du 2026-09-30)
        → revue technique indépendante (2026-10-01 : corrections avant 7)
        → contre-revue des contrats de correction → amendement pilote
        → 6bis-b6 → 6bis-b3d-1 → 6bis-b3d-2 → 6bis-b7 → 6bis-b8 → 6bis-b9
        → 6bis-b10 (constat de l'utilisateur au navigateur, 2026-10-01)
        → 6bis-b11 (même occasion : la page affichée, 2026-10-02)
        → 6bis-b12 (mesure, critère de b11 non tenu)
        → 6bis-b13 (coût par build, décision de l'utilisateur)
        → 6bis-b15 (relique de la carte, indépendante, faite avant le Worker)
        → 6bis-b13bis-a → 6bis-b13bis-b (Worker de résolution, décidé le
          2026-10-02 : « Dégâts réels » encore trop lent ; il remplace b14)
        → revue indépendante du Worker → 6bis-b13bis-c (ses corrections)
        → décision de l'utilisateur sur b13bis-b (Worker gardé, 2026-10-02)
        → 6bis-b16 (cartes vérifiées seulement, essai de l'utilisateur)
        → 6bis-b17 (cache et artéfacts réservés, revue du Worker)
        → 6bis-b18 (compte des confirmées, essai de b16)
        → 6bis-b19 (réimport du compte, changement d'exemplaire)
        → 7a → 7b (recalé et scindé le 2026-10-02) → 7c (rappel sous la liste)
                            (inventaire, cartographies bornées, réconciliation,
                            puis contrats d'implémentation ; l'écran 7 attend
                            tous les sous-lots validés)
8a → 8b ; 9a → 9b ; 10a → 10b   (recalés et scindés le 2026-10-02)
8b → 8c                    (suites de 8b ; résumé « autres ennemis » décidé
                            par l'utilisateur le 2026-10-02)
8c → 8d                    (8d étend à toute la recette la règle de clé que
                            8c a alignée sur 10b)
8b, 9b, 10b → 12           (12 éprouve les mécanismes qu'ils livrent)
12 → 9c                    (12 a trouvé le mécanisme 9 en défaut sur son
                            contrat : 9c le corrige avant 13a)
11bis                      (proses de sort au clic, demande du 2026-10-02 ;
                            aucune dépendance de code, après 11 par l'ordre)
1f, 11, 12, 9c → 13a → amendement et revue pilote → 13b-* → consolidation 13
                            (chaque contrat créé avant son exécution)
audit parallèle remis (A.5) → 13a ; et → 8, 9, 10, 11 par amendement
                            pilote quand il touche leur famille
3, 4, 5, 6, 6bis-a1, 6bis-a2a1-contexte, 6bis-a2a1-suite,
  6bis-a2a1-suite-correction-stats-chain,
  6bis-a2a1-suite-finalisation-preuve, 6bis-a2a2,
  6bis-a2b1, 6bis-a2b2, 6bis-a2b3, 6bis-a3a, 6bis-a3b,
  6bis-a4a, 6bis-a4b, 6bis-a4c1, 6bis-a4c2, 6bis-a4d1, 6bis-a4d2,
  6bis-b1, 6bis-b2, 6bis-b3a, 6bis-b3b, 6bis-b4, 6bis-b5a, 6bis-b3c, O,
  6bis-b5b, 6bis-b5c, 6bis-b6, 6bis-b3d-1, 6bis-b3d-2, 6bis-b7, 6bis-b8,
  6bis-b9, 6bis-b10, 6bis-b11, 6bis-b12, 6bis-b13, 6bis-b15,
  6bis-b13bis-a, 6bis-b13bis-b, 6bis-b13bis-c, 6bis-b16, 6bis-b17, 6bis-b18,
  6bis-b19,
  7a, 7b, 7c, 8c, 8d, 9d, 11bis, 12, tous les 13b-*, CM, LM, 15a-15e → 14
```

##### Ordre d'exécution et premières contre-revues

L'ordre d'exécution est l'ordre des numéros, avec 2a puis 2b, et 13a avant
les sous-lots 13b-*. Les lots 3, 4, 5 viennent après 2b et avant les auras.
La contre-revue de 6bis-a1 vérifie ce découpage, son budget et le repli
`git grep` ; les cartes issues de a1 reçoivent leurs plages puis leur revue
indépendante avant a2a1.
Contre-revue indépendante du 2026-09-25 : **a1 lançable**, aucun défaut
bloquant ; les précisions d'intrants relevées sont intégrées ci-dessous.
La revue des cartes du 2026-09-25 a trouvé une marge totale trop mince,
trois bornes au-delà des fichiers, quatre lignes hors fenêtres et une
projection non outillée ; le validateur renforcé en a révélé une quatrième.
Le pilote scinde a2a, a4c et a4d et corrige le contrat avant
son lancement ; le verdict « a2a lançable » de la revue ne vaut pas
validation du contrat amendé.
Contre-vérification indépendante du 2026-09-26 : **a2a1 lançable**, aucun
bloquant ; 104 clés et 2 usages partagés réconciliés, fenêtres et budgets
rejoués. Le diff `02391062..e1b4bf6` conserve aussi la preuve des anciennes
bornes et de leur correction. Les réserves sur les lectures adjacentes et
la taille des lignes JSON sont précisées dans le contrat ci-dessous.
Au repère historique de 1 500 lignes, le budget corrigé laissait moins de
100 lignes de marge prévisionnelle à a2b, a3a, a3b, a4a et a4d1. Ce constat
avait conduit à des scissions préventives ; la politique de lecture du
2026-09-27 ci-dessous retire cet arrêt automatique pour les lots restants.
La première tentative a2a1 du 2026-09-26 s'est arrêtée avant toute carte ou
preuve : une sortie tronquée puis des relectures et un contrat a1 lu trop
largement ont épuisé les 1 500 lignes. Elle n'établit aucun verdict. Le pilote
scinde les intrants en **a2a1-contexte** puis **a2a1-suite** ; chaque session
part d'un budget neuf et d'un livrable autonome, sans reprendre une mémoire
non livrée. La seconde réunit les deux synthèses pour a2a2.
La carte a2a1-suite a été livrée et ses 12 clés réconciliées, mais ce contrôle
ne valide pas leur contenu : la chaîne des stats de combat y est mal située et
deux chemins de bonus restent à distinguer. Son correctif nommé est un
prérequis de a2a2 ; le reçu initial ne vaut pas validation du verdict.
La contre-lecture du correctif a produit une carte et un validateur locaux,
mais a dépassé son budget après deux sorties tronquées puis relues. La preuve
reste inachevée : **finalisation-preuve** reprend uniquement cette preuve,
avant a2a2. Aucun contrôle vert d'une carte locale ne clôt le lot initial.

##### Validations des cartes 6bis

La finalisation et la contre-revue pilote ont depuis validé la carte corrigée,
les deux écarts et les preuves ; a2a2 peut commencer.
Le pilote a ensuite validé a2a2 : quatre clés réconciliées, et le `return`
L808 contrôlé séparément. Le budget de lecture dépassé de 79 lignes et les
écarts de discipline de commande restent consignés, sans changer les verdicts.
Avant son lancement, a2b est scindé en trois contrats successifs : paire
d'artéfacts et cache, relique, puis scripts/tests et réconciliation. Les huit
clés de sa projection gardent chacune un seul propriétaire.
La première tentative a2b1 du 2026-09-27 n'a produit aucun verdict : deux
sorties tronquées puis relues ont consommé sa marge sous l'ancien seuil. Elle
n'établit pas que ses deux clés exigent un lot de plus. a2b1 est repris sous
la politique de lecture assouplie, sans nouvelle scission.
Le pilote valide la reprise de a2b1 : ses deux clés sont classées, la paire
essayée est distinguée de celle retenue et la signature globale du cache de
la clé propre aux six runes. Le dépassement du repère de lecture n'a omis
aucune fenêtre ni aucun appel adjacent ; a2b2 peut commencer.
Le pilote valide a2b2 : l'exclusive consomme directement les stats et le
contexte de la relique essayée ; `relicOptim.ts` consomme indirectement la note
des couples faisables. Le résultat conserve la relique et la paire retenues,
distinctes des essais. Les auras propres aux six runes restent hors du calcul
actuel ; a2b3 peut réconcilier les huit clés projetées.
Le pilote valide a2b3 après rectification de sa carte combinée : les deux
scripts consomment le contexte transmis, mais n'en déduisent pas les auras
propres aux six runes ; les deux tests ne prouvent aucune couverture d'aura.
Les huit clés projetées sont réconciliées. Le vérificateur compare désormais
aussi les **verdicts** combinés aux cartes sources : `relicOptim.ts` reste
« consommateur indirect », non un nouveau verdict « transmetteur ».
Le pilote valide a3a après rectification de six signatures ou déclarations
initialement comptées comme lectures : 18 clés, **6 lectures consommatrices et
12 non-consommateurs**, dont 7 points de propagation. Le toggle atteint les
deux bornes RES/PRE du contexte figé, mais les auras propres au build y
manquent. Dominance et faisabilité minimum peuvent rejeter à tort ; le
maximum peut laisser passer un faux positif et `filterSlot` reste heuristique.
Les deux scénarios nommés passent à a3b, sans correction de code à ce stade.
Contre-revue externe des contrats 6bis-b, le 2026-09-28 : b3a/b3b avaient
des clés qui se recouvraient et b3a exigeait une recherche de bout en bout
avant correction des coupes de b3b. Le pilote amende les propriétaires et les
preuves ci-dessous. **Aucun 6bis-b-* ne démarre avant contre-vérification
indépendante de cet amendement**, notamment du partage 16 + 2 + 9 clés et
du test exact de `pairBuckets` distinct de ses coupes amont.
Trace des décisions et du comptage : `controle-6bis-contrats-b-revue.md`
dans le dossier de preuves A.6 bis.
Contre-vérification indépendante de l'amendement `39a7d5ee`, le 2026-09-28,
par une session qui ne l'a pas écrit : les deux bloquants et N1–N12 sont
traités. Partage rejoué depuis la carte : a2a1-contexte 5 → b1 et 6 → b2,
a3a 16 → b3a et 2 → b3b, a3b 9 → b3b ; les 104 entrées de carte et les
2 H documentaires (b1 puis b2) ont chacune un propriétaire ;
réconciliateur rejoué sans `--ecrire`, sortie « 46 A + 41 B + 15 H … 104
clés », mutations `omission`, `document`, `verdict` refusées. Une seule
précision ajoutée par le nouveau pilote, sans changer de propriétaire : la
preuve b3a du minimum par `pairBuckets` dépend d'une marge Endure/Focus,
faute de quoi elle revient à b3b. Écho du lot 7 précisé. **b1 est
lançable** ; b2, b3a, b3b et b4 le sont à la validation de leur prérequis.
Revue adversariale finale, le 2026-09-29, sur `4a13db13` : recompte
indépendant (b1 27, b2 19, b3a 16, b3b 11, b4 31 = 104 entrées ; rejouable :
effectifs par lot de `projeter-6bis.mjs --bilan`, puis b1 = a4a 9 +
a4b 13 + 5 d'a2a1-contexte, b2 = 6 + a2a1-suite 1 + a2a2 4 + a2b 8, b3a = 16 d'a3a,
b3b = 2 d'a3a + a3b 9, b4 = a4c1 3 + a4c2 4 + a4d1 24 en vérification
finale), maximum b3a
et limite Endure/Focus confirmés, aucun double compte trouvé. Trois
bloquants, tous rejoués par le pilote dans le code et corrigés ci-dessous :
b2 se disait « complet » avant b3a ; `relicQueue.ts:165` sert aussi au score
(partage par usage b2/b3a) ; l'assiette des exclusives change en b2 alors
que `reliques.md` § 5.2 nous est interdit (signal au chantier relique).
Corrigés aussi : le toggle, replié dans `auraResPre`, n'atteint pas le
moteur (b3a) ; un seul `ceil` dans `pvEffectifs` (b2) ; preuve et ligne de
suivi pour la revue technique ; régime parallèle sans cas réel connu (b4).
Le plafond 15 = 5 × 3 reste la valeur fournie en A.2 ter, non rediscutée.
b1 ne change que dans la phrase sur l'état provisoire : **il reste
lançable**. b2, b3a et b4, amendés, attendent une contre-vérification
ciblée avant leur lancement ; b3b est inchangé.
Contre-vérification ciblée, le 2026-09-29, sur `5fb9ae72` : **b2 et b4
lançables**, **b3a à corriger** — `runeBuildOptim.ts` L1309/L1381 (b3b)
lisaient `auraResPre` sans porteur de toggle nommé. Le pilote a rejoué
chaque objection dans le code et amendé : clause « seul porteur du toggle »
dans les frontières communes ; test b2 sur la note des couples de
`relicQueue.ts` ; levée de la réserve RES/PRE nommée en b3a ; rétention
distinguée des élagages sûrs ; `reliques.md` § 5.2 cité L254–261 ; A.5
aligné sur la fin du chantier relique ; `totalPairCount` nommé en b4 ;
recompte rendu rejouable. b3a, corrigé selon la correction minimale
proposée par la revue elle-même, est lançable après b2.

##### Validation de 6bis-b5a, restauration des notes relique, lots b3c et O

Le pilote valide 6bis-b5a le 2026-09-30 (détail sous son contrat).
b5a a signalé que `reliques.md` était revenu à une version antérieure. Le
diagnostic du pilote a mis au jour l'incident décrit en A.5, et le pilote a
restauré les notes du chantier relique. Une revue externe, par une session
qui n'avait pas écrit la restauration, conclut « à corriger avant
integrer » :

- restauration fidèle ;
- règles relique périmées remises en circulation, corrigées par le pilote ;
- **défaut de code dans 6bis-b3b**, reproduit par le pilote. La dominance
  (`contexteDominance`) ignore les stats dont dépend l'effet unique de la
  relique.

Notes intégrées au `main` documentaire `6559ecc` ; preuve
`controle-restauration-relique.md`.

**Validation de b3b rouverte en partie.** Sa garantie « élagages sûrs » ne
tient pas quand l'effet unique de la relique dépend d'une stat hors
conditions et hors objectif. `invariants.md` porte la réserve jusqu'à
6bis-b3c. Son oracle notait sans l'effet unique, et le pilote l'a rejoué
sans remettre en cause cette note (règle ajoutée en A.6 bis).

**Deux lots s'insèrent avant b5b** : 6bis-b3c, puis O. Leurs contrats
passent une contre-revue indépendante avant tout lancement.

**Contre-revue du 2026-09-30, sur `93f9388e` : les deux lots « à
corriger ».**

- **b3c.** Le défaut est reproduit au chiffre près, perdu à la dominance
  seule, sans autre coupe sûre touchée ; le score est monotone dans chaque
  stat. Le pilote a rejoué chaque objection dans le code et amendé :
  - trois appelants de `contexteDominance` ajoutés ;
  - une seule règle de protection, sans `dimensionsRetenues`, qui n'a aucun
    consommateur de production ;
  - couverture par type sans cas vide ;
  - oracle du mode `recherche` avec le filtre final ;
  - comparaison sur le modèle de `verifier()` de b3b ;
  - performance sur un cas où `interchangeables` change.

  Nuance au constat B5 : `verifier()` tolère la dominance par construction
  et garantit l'optimum. Coordonnée de la revue corrigée : `eligibles` est
  en `relicOptim.ts` L184-187, pas L271-274.
- **O.** La conception aurait évité l'incident aux deux étapes (vérifié sur
  les commits). Amendé : migration écrite, lieu de sauvegarde, recherche des
  révisions ancêtres, casse sous Windows, cas dégénérés, `verifier`,
  `integrer` inchangé et motivé, preuve sur les chantiers réels exécutable,
  conséquence d'`installer`. **Écart du pilote à la revue** : pour
  `livrer`, une garde « arbre documentaire = base », suivie du miroir
  actuel, plutôt que la fusion fichier par fichier proposée ; motif écrit
  au contrat.
- La contre-revue a lu les registres par un `node -e`, en lecture seule,
  contre la consigne.

**Contre-vérification ciblée du point 3 de O, le 2026-09-30, sur
`080a4e28` : « à corriger ».** La garde suivie du miroir est conservée, sans
fusion fichier par fichier, mais sous trois conditions :

- la garde porte aussi sur l'inventaire physique du worktree documentaire,
  fichiers ignorés compris (un fichier exclu passait sous une garde limitée
  à l'arbre Git) ;
- elle vient après une reprise vérifiée des opérations interrompues ;
- la base de `rafraichir` n'avance qu'après la copie.

Également relevés :

- `integrer` ne touche pas la branche du chantier : aucun faux refus ;
- aucune conversion de fins de ligne, puisque `.gitattributes` vaut
  `* -text` ;
- la casse se compare sur les chemins, jamais sur les empreintes ;
- une faiblesse de reprise préexistante (L352) ;
- sur les trois chantiers, la garde passerait aujourd'hui.

Le pilote a amendé le contrat point par point ; **O est lançable**.

#### Suivi des lots

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 — ouverture du chantier | M | terminé | 2026-09-23 |
| 1a — extraction automatique des candidats | C | terminé | `c0407a5` / 2026-09-23 |
| 1a2 — correctif d'extraction Kung Fu Girls et Samouraïs | C | terminé | `d9b6959` / 2026-09-24 |
| 1b — classification Blade Surge | J | terminé | 2026-09-23 |
| 1c1 — Tempest : amorces et noms partagés | J | terminé | 2026-09-23 |
| 1c2 — Tempest : effet Additional Attack, première moitié | J | terminé | `eaf8520` / 2026-09-24 |
| 1c3 — Tempest : effet Additional Attack, seconde moitié | J | terminé | `1742488` + amendement pilote / 2026-09-24 |
| 1c4 — classification du complément de 1a2 | J | terminé | 2026-09-24 |
| 1d — classification Blade Dancers | J | terminé | 2026-09-24 |
| 1e — formes et rendus des stats de combat | C | terminé | `cb5f630` + amendement pilote / 2026-09-24 |
| 1f — réconciliation et proposition d'amendement | C+J | terminé | 2026-09-24 |
| 2a — classement des blocs et plan de découpage | C | terminé | amendement pilote / 2026-09-24 |
| 2b — déplacement et repointage selon le plan validé | M | terminé | `62fc8bf8` + correctif pilote des liens relatifs / 2026-09-24 |
| 3 — plancher des conditions en « Libre » | M | terminé | 2026-09-24 |
| 4 — relique « comme équipé » et les minimums | C→M | terminé | `91837dab` / 2026-09-25 |
| 5 — le contexte survit au changement de monstre | J | terminé | `bed3818f` + `09ca897d` / 2026-09-25 |
| 6 — sets d'aura : modèle initial, corrigé au lot 6bis | J | terminé | `4f6ce326` + `88d58019` / 2026-09-25 |
| 6bis-a1 — inventaire et recettes de contrôle | C | terminé | reçu `948066b` ↔ `87d09ec` / 2026-09-25 |
| 6bis-a2a1 — tentative initiale | C | interrompu sans carte | 2026-09-26 |
| 6bis-a2a1-contexte — champs, début de combat, stats de fiche | C | terminé | reçu `c09a516` ↔ `7dffbbc` / 2026-09-26 |
| 6bis-a2a1-suite — chaîne des dégâts | C | terminé après rectification | reçu initial `12b7d05` ↔ `6d9b556` / 2026-09-26 |
| 6bis-a2a1-suite-correction-stats-chain — contenu et preuve de la carte | C | interrompu, notes locales non validées | 2026-09-26 |
| 6bis-a2a1-suite-finalisation-preuve — preuve et livraison du correctif | C+M | terminé après complément pilote | reçu `57a7c28` ↔ `ab0fb25` / 2026-09-26 |
| 6bis-a2a2 — sets actifs du build et score | C | terminé après complément pilote | reçu `4816082` ↔ `1d20a54` / 2026-09-26 |
| 6bis-a2b1 — paire d'artéfacts et cache | C | terminé après reprise | reçu `e5d785f` ↔ `9c2e357` / 2026-09-27 |
| 6bis-a2b2 — exclusive et sélection de relique | C | terminé | reçu `0a512eb` ↔ `4e46068` / 2026-09-27 |
| 6bis-a2b3 — scripts, tests et réconciliation | C | terminé après rectification pilote | reçu initial `d04bb19` ↔ `833b51a` / 2026-09-27 ; preuve rectifiée relivrée |
| 6bis-a3a — conditions et élagages locaux | C | terminé après rectification pilote | reçu initial `e21a385` ↔ `ab5c858` / 2026-09-27 ; preuve rectifiée relivrée |
| 6bis-a3b — recherche, diagnostics et filtre final | C | terminé | reçu `bd9b60a` ↔ `2c5b82d` / 2026-09-27 |
| 6bis-a4a — recette, reset et import écran | C | terminé | reçu `2d8d364` ↔ `7e0541c` / 2026-09-28 |
| 6bis-a4b — CLI et scripts de diagnostic | C | terminé | reçu `6669527` ↔ `308c6be` / 2026-09-28 |
| 6bis-a4c1 — écran de recherche et caches | C | terminé après complément pilote de la preuve | reçu initial `4d95932` ↔ `4ed721e` / 2026-09-28 ; preuve relivrée |
| 6bis-a4c2 — cartes de résultat et autres affichages | C | terminé après rectification pilote des verdicts | reçu initial `840f202` ↔ `39a362f` ; preuve relivrée / 2026-09-28 |
| 6bis-a4d1 — Workers et tests | C | terminé après complément pilote de la preuve | reçu initial `655b0a2` ↔ `7f2e0bf` ; preuve relivrée / 2026-09-28 |
| 6bis-a4d2 — réconciliation des cartes | C | terminé après complément pilote du validateur | reçu initial `b9ff929` ↔ `473fe62` ; complément livré et intégré / 2026-09-28 |
| 6bis-b1 — champ externe, recette et CLI | J | terminé, preuves rejouées par le pilote | `4622a02f` ; reçu `de9e893` ↔ `a38a410` / 2026-09-29 |
| 6bis-b2 — aura propre et scores | J | terminé, preuves rejouées par le pilote ; Brita/Gideon confirmés par l'utilisateur | `dbd4ee54` + `b0a2e84d` ; reçu `b0a2e84` ↔ `5e32fe6` / 2026-09-29 |
| 6bis-b3a — conditions exactes et filtre final | J | terminé, preuves et deux mutations rejouées par le pilote | `6b1ff763` ; reçu `6b1ff76` ↔ `11be57d` / 2026-09-29 |
| 6bis-b3b — coupes, diagnostics et différentiel | J | terminé, preuves rejouées par le pilote ; rétention sur compte réel arrêtée par décision utilisateur | `bdbd952c`…`3f9be574` ; reçu `3f9be57` ↔ `bc01ad2` / 2026-09-29 |
| 6bis-b4 — écran, Workers, caches et parité | J | terminé, preuves rejouées par le pilote | `d716b7be`…`56ee3b99` ; reçu `56ee3b9` ↔ `ce2e842` / 2026-09-30 |
| 6bis-b5a — cartes, tri, Comparer et CLI à relique fixe | J | terminé, preuves rejouées par le pilote ; restauration des notes relique, revue externe corrigée | `2e896bfa`…`d52d2e94` ; reçu `d52d2e9` ↔ `da2886f` / 2026-09-30 |
| 6bis-b3c — dominance et effet unique de la relique | J | terminé, preuves et mutation rejouées par le pilote | `756eb09c` + `ca15a281` ; reçu `ca15a28` ↔ `61364e2` / 2026-09-30 |
| O — verrous de `chantier ouvrir` et `livrer` | J | terminé, rouge et preuves rejoués par le pilote ; installé le 2026-10-01 @ `62bb877` | `32a5da12` + `ea6a37f3` ; reçu `32a5da1` ↔ `c8b6323` / 2026-10-01 |
| 6bis-b5b — Meilleurs artéfacts et paire représentative | J | terminé, preuves et mutation rejouées par le pilote | `597a0730` ; reçu `597a073` ↔ `76a4a2f` / 2026-10-01 |
| 6bis-b5c — CLI en mode recherche et parité finale | J | terminé, contrat amendé (option 2, décision utilisateur), preuves, mutation et CLI réel rejoués par le pilote | `808d2d36`…`b8b28f63` ; reçu `b8b28f6` ↔ `9ef88ae` / 2026-10-01 |
| 6bis-b — revue technique indépendante avant le lot 7 | J | terminée : corrections avant le lot 7 ; B1 rejoué par le pilote ; preuve archivée | `controle-6bis-b-revue-technique.md`, notes `3b7d237` / 2026-10-01 |
| 6bis-b6 — paramètres d'artéfacts partagés et outils de preuve relique | J | terminé, preuves et mutation rejouées par le pilote | `d80274ba`…`4957a782` ; reçu `4957a78` ↔ `3e26c7f` / 2026-10-01 |
| 6bis-b3d-1 — dominance et lignes 218–221 : le correctif | J | terminé, preuves et mutation rejouées par le pilote | `99463b70` + `4e761e7e` ; reçu `4e761e7` ↔ `457ec7a` / 2026-10-01 |
| 6bis-b3d-2 — oracles avec artéfacts et différentiel ciblé | J | terminé, preuves et mutation rejouées par le pilote | `9e56c343` + `d00230e2` ; reçu `d00230e` ↔ `0e6d663` / 2026-10-01 |
| 6bis-b7 — troncature du régime parallèle | J | terminé, preuves, mutation et cas réel rejoués par le pilote ; notes complétées (dérogation étendue) | `6d238d08` + `c0b20a94` ; reçu `c0b20a9` ↔ `affd6d5` / 2026-10-01 |
| 6bis-b8 — file en mode relique « recherche » (300 builds dès la recherche) | J | terminé, preuves, mutation et CLI réel rejoués par le pilote ; coût de la file (~8–10 %, Node) livré en l'état sur décision de l'utilisateur | `28a765cd` + `2594f1b4` ; reçu `2594f1b` ↔ `d3c186e` / 2026-10-01 |
| 6bis-b9 — tri par stat sur la fiche | J | terminé, preuves et mutation rejouées par le pilote | `4fa6ad5c` + `f3aa265d` ; reçu `f3aa265` ↔ `fb8d549` / 2026-10-01 |
| 6bis-b10 — un build écarté à la résolution sort du compte, en direct | J | terminé, preuves et mutation rejouées par le pilote ; vérifié par l'utilisateur au navigateur | `fd9d7f52` ; reçu `fd9d7f5` ↔ `12a0296` / 2026-10-02 |
| 6bis-b11 — la page affichée se résout sans attendre l'inactivité | J | code validé par le pilote ; **critère non tenu au navigateur** (saccades, page lente) ; mesure 6bis-b12 avant correction | `bfe6f6d7` ; reçu `bfe6f6d` ↔ `f17ad7e` / 2026-10-02 |
| 6bis-b12 — ce qui sature l'écran pendant une recherche, mesuré | C | terminé, chiffres recoupés par le pilote : la résolution sature (66 %), pas le tri | reçu `f0e77a4` ↔ `a4b54d7` / 2026-10-02 |
| 6bis-b13 — la résolution d'un build coûte moins, à résultat identique | J | terminé, preuves et mutation rejouées par le pilote ; essai de l'utilisateur : reliques « très bien », fluidité à améliorer | `88e4c76a` ; reçu `88e4c76` ↔ `069d7c0` / 2026-10-02 |
| 6bis-b14 — la résolution rend la main entre deux reliques | J | sans objet : remplacé par le Worker (décision de l'utilisateur du 2026-10-02) | — |
| 6bis-b15 — la relique de la carte de résultat ne déborde plus (ordinateur) | J | terminé ; vérifié par l'utilisateur à l'écran | `7b3ec767` ; reçu `7b3ec76` ↔ `1d50ccc` / 2026-10-02 |
| 6bis-b13bis-a — Worker de résolution : corps et protocole | J | terminé, preuves et mutation rejouées par le pilote (agent lancé par le pilote) | `b0c580e7` ; reçu `b0c580e` ↔ `5da194f` / 2026-10-02 |
| 6bis-b13bis-b — Worker de résolution : branchement et mesure | J | terminé : arrêté avant livraison (A.6, recherche +4 à +7 %, résultat complet −27 %), puis **Worker gardé par l'utilisateur** le 2026-10-02 ; revue indépendante : rien de bloquant | `9a7202a8`, `534de15a` ; livré avec 6bis-b13bis-c / 2026-10-02 |
| 6bis-b13bis-c — corrections de la revue du Worker | J | terminé, preuves et mutation rejouées par le pilote ; livré avec b13bis-b | `11abb68d`…`f951f3e9` / 2026-10-02 |
| 6bis-b16 — une carte n'apparaît qu'une fois vérifiée | J | terminé, preuves, mesure et mutation rejouées par le pilote ; essai de l'utilisateur en attente (A.8) | `6df20ba2` ; reçu `6df20ba` ↔ `226c64d` / 2026-10-02 |
| 6bis-b17 — le cache de la file suit les artéfacts réservés | J | terminé, preuves et mutation rejouées par le pilote ; deux cas voisins soumis à l'utilisateur (A.8) | `d8132284`, `c1d96fd5` ; reçu `c1d96fd` ↔ `13ac9f3` / 2026-10-02 |
| 6bis-b18 — le compte ne compte que les combinaisons confirmées | J | terminé, preuves, mesure et mutation rejouées par le pilote ; essai de l'utilisateur en attente (A.8) | `734d4dd6`…`a9fa6b48` ; reçu `a9fa6b4` ↔ `04da233` / 2026-10-02 |
| 6bis-b19 — réimport du compte et changement d'exemplaire | J | terminé, preuves et mutation rejouées par le pilote ; deux cas voisins soumis à l'utilisateur (A.8) | `92db894b`, `62ac3eeb` ; reçu `62ac3ee` ↔ `16d8d7a` / 2026-10-02 |
| 7a — sets d'aura : saisie, interrupteur, écho, libellés | J | terminé, preuves et mutation rejouées par le pilote ; vérification à l'œil en attente (A.8) | `1baecf9e`…`3bc596af` ; reçu `3bc596a` ↔ `42f1a43` / 2026-10-02 |
| 7b — sets d'aura : rappel et ouverture guidée, deux formats | J | terminé, preuves et mutation rejouées par le pilote | `cc85a596`, `9291e1c8` ; reçu `9291e1c` ↔ `9ca4172` / 2026-10-02 |
| 7c — le rappel aussi sous la liste de travail | J | terminé, preuves et mutation rejouées par le pilote ; vérification à l'œil en attente (A.8) | `c60bceee` ; reçu `c60bcee` ↔ `a779e59` / 2026-10-02 |
| 8a — Blade Surge : moteur (8 identifiants / 11 formes de corpus) | J | terminé (lot parallèle), preuves et mutation rejouées par le pilote, intégré | `f229d2f1` / 2026-10-02 |
| 8b — Blade Surge : recette, écran, CLI | J | terminé (lot parallèle, seconde vague), preuves et mutation rejouées par le pilote, intégré ; vérification à l'œil en attente (A.8) | `12595440`, `d6c576b5`, `22dda1f2` / 2026-10-02 |
| 8c — suites de 8b (résumé « autres ennemis », clé à zéro de tête, script de diagnostic) | J | terminé, preuves et mutation rejouées par le pilote ; constat de douze champs soumis à l'utilisateur ; vérification à l'œil en attente (A.8) | `66309e93`, `62dc6dce`, `b55a02ec` ; reçu `b55a02e` ↔ `48ea7df` / 2026-10-02 |
| 8d — une seule règle de clé d'identifiant pour toute la recette | M | terminé (agent `lot-m`), preuves et mutation rejouées par le pilote | `52717fe0` ; reçu `52717fe` ↔ `5af83df` / 2026-10-02 |
| 9a — Tempest : formule curée d'un passif, déclenchement après S1/S2 | J | terminé (lot parallèle), preuves et mutation rejouées par le pilote, intégré | `50e46aea`, `e5dc87ae` / 2026-10-02 |
| 9b — Tempest comme sort, écran, mécanisme générique | J | terminé (lot parallèle, seconde vague), preuves rejouées ; mutation du pilote d'abord survivante, test complété par l'agent puis rejoué ; intégré ; vérification à l'œil en attente (A.8) | `db32bbd9`, `2402e91d`, `badea22f` / 2026-10-02 |
| 9c — l'attaque appelée active, la prose des passifs masqués (suites du lot 12) | J | terminé, preuves et mutations rejouées par le pilote ; 11 amorces acceptables, 6 classées ; table vide en production | `38223c94`, `783df03d`, `39145f17` ; reçu `39145f1` ↔ `1b86eb0` / 2026-10-02 |
| 10a — ignore DEF conditionnel des Blade Dancers : moteur | J | terminé (lot parallèle), preuves et mutation rejouées par le pilote, intégré | `db913084`, `dc8e4b5f` / 2026-10-02 |
| 10b — Blade Dancers : recette, écran, CLI | J | terminé (lot parallèle, seconde vague) après correction de l'import selon B.0 (erreur du brief du pilote), preuves et mutation rejouées, intégré ; vérification à l'œil en attente (A.8) | `784378b9`…`072c7c3f` / 2026-10-02 |
| 11 — prose et exactitude des passifs « Stats acquises en combat » (inventaire 38/40 ; correctif 30/32) | J (C fait par 1e) | terminé (lot parallèle, seconde vague), preuves et mutation rejouées par le pilote, intégré ; vérification à l'œil en attente (A.8) | `92de9890`, `d6ff1b6a`, `5a21fd78` / 2026-10-02 |
| 11bis — proses de sort au clic, deux formats | J | terminé (lot parallèle), preuves et mutation rejouées par le pilote, intégré ; vérification à l'œil en attente (A.8) | `a34dedb5`, `aba5306e` / 2026-10-02 |
| 12 — les trois mécanismes rejoués sur des cas indépendants | C | terminé (agent `lot-c`), preuves et mutation rejouées par le pilote ; mécanisme 9 à retoucher → 9c ; 8 → extension lot 13 | `6f16ce5d` ; reçu `6f16ce5` ↔ `c222480` / 2026-10-02 |

##### Suivi des lots 13 et suivants (reliquat compris)

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 13a — extraction et réconciliation du reliquat (243 constats hors chantier) | C | terminé (agent `lot-c`), scripts rejoués par le pilote (empreintes identiques), compte des 51 recoupé ; suivi 78 → 82 | notes `35d577f` (reçu `cd5fe43`) / 2026-10-02 |
| `13b-*` — dix-sept sous-lots de qualification (contrat commun et table : lot 13, « Contrats `13b-*` ») | J | contrats écrits et revus le 2026-10-02 ; **17 / 17 validés** (amorces, séquences-zone, ignore-def ; voisins, effets entre coups, coups variables ; composantes, hors tour, pertes de PV ; variables refusées, PV et boucliers, compteurs ; passifs de stats, passifs du corpus, critiques garantis ; bonus TC/DC, vérification de la partie 2) ; les autres par vagues de trois (`lot-j`) | Résultats : lot 13, « Résultats des sous-lots 13b » / 2026-10-02 |
| 13 — consolidation : plan, synthèse, recommandation (pilote) | J | terminé : plan validé par le pilote ; recommandation « chantier à part » **écartée par l'utilisateur** le 2026-10-03 (D65 : lots de plus ici → lots Q et P1 à P26) | `decisions/plan-reliquat-degats-2026-10.md` / 2026-10-03 |
| CM — le mode critique « Moyenne » supprimé | J | terminé (lot parallèle, `lot-j`), preuves et mutation rejouées par le pilote, intégré ; vérification à l'œil en attente (A.8) | `f1e7d71c`, `361cc9d0`, `3ea62afe`, `3cba1d5a` / 2026-10-02 |
| LM — la liste des monstres et sorts modifiés, tenue à chaque commit | C | terminé (`lot-c`), contrôlé par le pilote ; règle permanente en A.8 | `7d3a9d77` / 2026-10-02 |
| 9d — le survol de Tempest retiré | J | terminé, preuves et mutation rejouées par le pilote ; vérification à l'œil en attente (A.8) | `2bca1603` / 2026-10-03 |
| 15a à 15e — les lots prêts du plan | C / J | **terminés**, preuves et mutations rejouées par le pilote : 15b (`dcca28a7`), 15c (`a65b2f28`, `f7bd6a1f`), 15d (`b2d44b4d`, `292716c2`, `aa052b63`), 15e (`6c2b593e`, `404472a3`), 15a (`35541133`…`4616dab1`) ; vérifications à l'œil en attente (A.8) | 2026-10-03 |
| 15f — Yuji et Rick : DEF du coup 2 ; ATQ ennemie absente = valeur affichée | C | terminé (`lot-c`), preuves et mutations rejouées par le pilote ; Zaiross ajouté (quatre monstres) ; vérification à l'œil en attente (A.8) | `616e09a1`, `372168cd` / 2026-10-03 |
| 15g — revue des 144 sorts à formule sans « attack » ni « damage » | J | terminé : six blocs tranchés par l'utilisateur ; 8 sorts à masquer (→ 15h), 136 inchangés | `controle-15g.md` / 2026-10-03 |
| 15h — les 8 sorts sans attaque confirmés en 15g, masqués | C | terminé (`lot-c`), preuves et mutations rejouées par le pilote ; vérification à l'œil en attente (A.8) | `53668cc2` / 2026-10-03 |
| Q1, Q2 — le questionnaire du reliquat (valeurs Q01-Q10, décisions D01-D64) | J | terminés (`lot-j`, notes seules), vérifications rejouées par le pilote ; 67 questions à soumettre à l'utilisateur par blocs | `controle-q1.md`, `controle-q2.md` / 2026-10-03 |
| P1 à P26 — le reliquat de l'audit, lots de ce chantier (plan, section 6) | C / J | **P1 terminé** (`lot-c`), preuves et mutations rejouées ; Rending Claw remis à l'utilisateur (A.8) ; **P4 lancé** ; P2 prêt ; le reste attend une décision (Q) ou un relevé | P1 : `8db128c7`…`61351084` / 2026-10-03 |
| 14 — clôture et ledgers après contrôles | M | à faire, après les lots P (ou leur report nominatif décidé par l'utilisateur) | — |

**Avant le lot 0 : la revue adversariale.** Au moins deux tours, par une
session qui **n'a pas écrit** ce document, munie de la checklist C du skill
`cadrage-chantier` et de trois questions par lot : *l'intrant est-il borné ? la
preuve est-elle un artefact ? l'outil qu'il utilise existe-t-il déjà à ce
numéro ?* ⚠️ **Elle est conduite par l'utilisateur**, qui la soumet lui-même
(décision du 2026-09-23) ; le prompt de revue lui est fourni sur demande. Une
revue qui ne trouve rien au premier tour n'a pas lu le graphe.

### A.8 Mode de pilotage et vérifications de l'utilisateur en attente

#### Le pilote lance les sous-agents (décision du 2026-10-02)

Depuis 6bis-b13bis-a, la session pilote **lance elle-même** l'agent de
chaque lot (sous-agent, modèle selon A.4, en arrière-plan), reçoit son
rapport, valide (rejeux, mutation, Résultat, commit, relivraison) et
enchaîne. L'utilisateur ne transmet plus les briefs ni les retours.

- **Un agent à la fois**, dans le worktree du chantier : pas d'isolation
  en worktree séparé, qui casserait `livrer` et le reçu. **Le pilote ne
  modifie aucun fichier suivi pendant qu'un agent tourne** : un fichier
  modifié ferait refuser son `livrer`.
- **Lots indépendants en parallèle** (décision de l'utilisateur du
  2026-10-02, pour gagner du temps) : un worktree par lot, créé par le
  pilote (`sw-forge-lot-<lot>`, branche `forge/dea-<lot>`, `npm ci`, jamais
  de jonction `node_modules` ; comptes réels en liens physiques, lecture
  seule). L'agent lit les notes privées dans le worktree principal sans y
  écrire ; il dépose ses modifications de notes dans
  `sw-forge-lot-<lot>-notes\base` (l'original) et `\notes` (sa version),
  avec sa preuve ; ni `livrer`, ni `push`. Le pilote intègre **un lot à la
  fois** dans la branche du chantier (commits, conflits, fusion à trois des
  notes, rejeux sur le combiné, livraison) et supprime le worktree. Seuls
  des lots sans mesure de temps au navigateur tournent ainsi ensemble.
  Répétition sur une branche partie de la **tête du chantier** : propre,
  la branche du chantier avance jusqu'à elle (`merge --ff-only`), avec
  exactement les commits rejoués (seconde vague).
- **Créneau de mesure accordé jusqu'à nouvel ordre** : le pilote lance les
  mesures sans redemander, jamais deux agents à la fois, et sans serveur à
  lui pendant une mesure.
- **Les vérifications visuelles de l'utilisateur sont différées** : le
  pilote ne s'arrête pas pour chacune, il les inscrit ci-dessous et
  l'utilisateur les fait plus tard, en une séance.
- **Les décisions restent à l'utilisateur** (produit, interface, valeur de
  jeu manquante, relevé en jeu, chantier à part) : le pilote s'arrête et
  demande. De même si un contrat ancien ne tient plus face au code.
- **Revue indépendante** : le pilote peut lancer un ou deux sous-agents
  relecteurs, qui n'ont pas écrit le code relu.
- **Dans un brief, la mutation vient APRÈS le commit** : restaurée par
  `git checkout --`, une mutation faite avant efface le travail non commité
  (lot 8d).
- **La liste des monstres et sorts modifiés**
  (`spec/chantiers/degats-et-aura-monstres.md`, lot LM ; demande de
  l'utilisateur du 2026-10-02) se met à jour **dans le même commit** que
  tout changement du calcul ou de l'affichage d'un monstre ou d'un sort :
  chaque brief le demande, chaque validation le vérifie. Un commit ne
  pouvant citer son propre hash, le lot écrit « commit du lot N » et le
  pilote inscrit le hash à la validation, dans un commit documentaire.

#### Vérifications de l'utilisateur en attente

Tenue par le pilote à chaque lot : une ligne s'ajoute quand un lot laisse
une vérification à l'écran, et se raye (avec la date) quand l'utilisateur
l'a faite. Serveur : le pilote construit l'application et la sert sur le
port 5173 (même origine, le compte déjà importé reste).

| Lot | À vérifier | État |
| --- | --- | --- |
| 6bis-b9 | « Trier par » ATQ, PV puis DEF : la valeur de la carte décroît de haut en bas | ✔ vérifiée le 2026-10-02 |
| — | Bouton « Arrêter » en pleine recherche : les résultats trouvés restent, message « meilleur trouvé jusque-là » | ✔ vérifiée le 2026-10-02 (les builds restent et sont résolus, puis retirés s'ils n'atteignent pas les minimums) |
| 6bis-b7 | Facultatif : recette `recette-6bis-b7-atq3000-dc220.json` (Lushen, siège 15) → « Recherche interrompue après examen de N combinaisons » | en attente |
| 6bis-b10 | Sous un zéro dû aux rejets : retour sur la dernière page, « Trier par » et « Adapter les artéfacts… » masqués | ✔ vérifiée le 2026-10-02 (le 0 et la ligne de raison, puis la dernière page et les masquages) |
| 6bis-b15 | Relique sous la roue, à la souris | ✔ vérifiée le 2026-10-02 |
| 6bis-b13bis-b | Essai du Worker : fluidité de la barre et du compte, résolution de la page en « Dégâts réels » et « PV effectifs » | essayé le 2026-10-02 : barre **fluide** ✔ ; **va-et-vient des cartes (apparues puis retirées) jugé insupportable, bloquant** → 6bis-b16 ; à revoir après b16 (recette `swforge-optimizer-kinki-2026-10-02`) |
| 6bis-b18 | Compte « confirmée(s) » qui ne baisse jamais, infobulle de différence, interrupteur « Vérifier toutes les combinaisons trouvées » ; recette Kinki ; interrupteur activé sur une grosse recherche (« PV effectifs ») : l'écran reste-t-il fluide ? | ✔ essai OK le 2026-10-02 ; interrupteur sur une grosse recherche : à confirmer |
| 6bis-b19 | Réimporter le compte puis relancer : les paires suivent ; passer à un autre exemplaire de la même espèce efface les résultats | après le lot |
| 6bis-b16 | Essai avec la recette Kinki : aucune carte qui apparaît puis disparaît ; places « Vérification… » sans saut ; page 1 complète vers 20-25 s ; changer de page et de tri | ✔ 2026-10-02 : « c'est parfait » ; demande nouvelle : stabiliser le compte et ne compter qu'après vérification (décision en A.8) |
| 7a | Carte « État de mon monstre » : boîte « Sets d'aura des autres monstres » (hauteur, largeur du menu sur un téléphone étroit), libellé explicite placé **sous** les contrôles de chaque ligne (choix de l'agent, pour que le menu cliqué ne bouge pas), compteur « X / 15 » ajouté, bouton « Ajouter un set d'aura » désactivé à 15 ; champ du nombre vidé puis quitté → 1 ; interrupteur « Compter les effets d'auras Tolerance et Précision dans les conditions », placé en dernier des réglages avancés, dans le flottant (ordinateur) ET le panneau « Options » (téléphone) ; écho de la fenêtre « Dégâts réels » | en attente |
| 7b | Rappel au changement de monstre en liste de travail (message 3 s à la place de l'en-tête de la boîte des auras) ; ouverture guidée vers l'interrupteur en ajoutant Accuracy ou Tolerance, ordinateur (défilement puis flottant) ET téléphone (panneau « Options de recherche ») | en attente |
| 7c | Le même rappel sous la liste de la zone C, au clic sur un membre : place de 32 px réservée dès que la liste a un membre (rien ne saute à l'apparition ni à l'effacement ; deux lignes sur un téléphone étroit ?), sur les deux formats (au téléphone, dans le dépliement de la zone C) | en attente |
| 8b, 9b, 10b | Nouveaux choix de « Dégâts réels », ordinateur ET téléphone. **Blade Surge** (Lapis) : deux crans sous la liste des sorts, rien ne bouge en basculant, résumé « … puis 1 coup · Zone ». **Tempest** (Teshar, Phoenix vent) : dans la liste des sorts, jamais par défaut ; interrupteur « Tempest (S3) se déclenche après ce sort » sous S1/S2, masqué quand Tempest est choisi ; condition au survol (`title`) gardée — à retirer ? **Blade Dancers** : sélecteur « Ignore la DEF (jauge de la cible à 0) », cran retenu sur une ligne à lui sous le résumé (tronquée si étroit), DEF de la cible affichée dans tous les crans | en attente |
| 8c | Blade Surge, cran « Dégâts sur les autres ennemis » : le résumé sous l'objectif dit « S1 Blade Surge · autres ennemis · … », rien pour la cible visée ; au téléphone, une ligne de plus possible | en attente |
| CM | Mode critique : deux crans seulement (« Critique », « Non critique »), aide « Coup critique » réduite à une phrase ; importer une recette exportée en « Moyenne » → avertissement en couleur d'avertissement, qui reste jusqu'au prochain import, et calcul en « Critique » | en attente |
| 9d | Teshar, S1 ou S2 choisi : l'interrupteur « Tempest (S3) se déclenche après ce sort » n'a plus de bulle au survol ; la prose de Tempest se lit sous l'interrupteur et au « ? » ; la mention « recharge non simulée » a disparu (à confirmer) | en attente |
| 15b | Leona : plus de ratio « 2 × DEF » ; interrupteur « Internal Force (+50 %) » éteint par défaut ; allumé, le total ×1,5, et la DEF du build ne change plus le total | en attente |
| 15c | Frieren et les 27 autres sorts masqués (liste des monstres) : plus de case pour le sort sans attaque, le sort coché par défaut est un sort qui frappe | en attente |
| 15d | Byungchul : S1 et S2 toujours critiques ; Yuji et Rick : sur la S2, un cadre des poses entre les coups, le 2e coup critique quand la réduction de DEF est posée après le 1er ; Jaara et Varus : « critique garanti si la DEF cible < … » (plus « ignore DEF »), rien à l'égalité | en attente |
| 15e | Ciri et Birgitta : compteur « Cumuls de Flash Step » / « … de Turning Slash » (sans en-tête ni prose, déjà sous « Passifs offensifs »), +50 de VIT par cumul ; Theonia : le champ « ATQ adverse » s'ouvre sur Summary Justice, ×2 contre une ATQ plus faible | en attente |
| 15h | Lukan, Zeratu, Michelle, Mikene, Tilasha, Iona, Jeogun, Hanwul : plus de case pour Regenerate, Unleashed Fury, Soul Revival, Revive, Dark Return, Light of Revival, Scroll Trap ; sort coché par défaut : Sandstorm (Lukan), Trample (Zeratu), Absorb Mana (Michelle) | en attente |
| 15f | Yuji et Rick (S2) : réduction de DEF posée après le 1er coup → le 2e coup est critique ET plus fort (DEF réduite) ; une ancienne recette sans ATQ adverse, importée : le champ affiche 1 000 et le bonus de Theonia, Kassandra, Eleni ou Zaiross suit ce 1 000 | en attente |
| 11bis | Proses de sort : le « ? » à droite du nom ouvre la prose sans choisir le sort ni déplacer la case, à la souris (bulle) ET au doigt (panneau montant) ; titre de case agrandi à 28 px par le « ? » ; phrase d'introduction de l'infobulle « Effets actifs » (à garder ou retirer) ; case de sort refusé (couleurs à 40 %) ; survol du « ? » qui allume la bordure | en attente |
| 11 | Description sous les passifs : Mayasura (`stacks`), Cordelia (`toujours`), aucun doublon sur les huit exclusions ; Stone Claws : prose sous le compteur ET au « ? » de la case du sort (à garder ?) | en attente |

#### Décisions de l'utilisateur en attente

Tenue comme la table précédente : une ligne quand le pilote s'arrête sur une
décision, rayée avec la date et la réponse.

| Lot | Question | État |
| --- | --- | --- |
| 6bis-b13bis-b | ~~Garder le Worker malgré une recherche +4 à +7 % plus longue en « Dégâts réels », pour un résultat complet ~27 % plus tôt et un fil de l'écran libéré ?~~ | ✔ 2026-10-02 : **garder tel quel** (option 1) |
| 8 | ~~À quels coups de Blade Surge s'appliquent 224 et 400 ?~~ | ✔ 2026-10-02 (utilisateur) : **224 sur les coups 1 et 2, 400 sur les trois** |
| revue du Worker | ~~Défaut antérieur : le cache de la file n'est pas vidé quand les artéfacts réservés par d'autres builds changent sans changer la signature.~~ | ✔ 2026-10-02 : **corriger dans ce chantier** → 6bis-b17 |
| essai du Worker | ~~Comment supprimer le va-et-vient des cartes ?~~ | ✔ 2026-10-02 : **n'afficher que les builds vérifiés**, places en attente marquées « Vérification… » → 6bis-b16, avant 7a |
| 6bis-b17 | ~~Deux cas voisins rapportés : réimport du compte à nombre égal ; changement d'exemplaire de la même espèce.~~ | ✔ 2026-10-02 : **corriger les deux** — chaque import vide le cache ; changer d'exemplaire efface les résultats comme un changement d'espèce → 6bis-b19 |
| 6bis-b19 | ~~Deux cas voisins rapportés : autres chemins de changement d'exemplaire ; cache qui ne suit pas l'exemplaire.~~ | ✔ 2026-10-02 : (1) **liste de travail seulement** — puces de source, zone D et bestiaire inchangés ; (2) **écarté, faux problème** : l'utilisateur n'utilise que des monstres niveau 40, dont les stats de base sont identiques d'un exemplaire à l'autre |
| 7b | ~~Afficher aussi le rappel sous la liste de la zone C ?~~ | ✔ 2026-10-02 : **oui, aussi sous la liste** → lot 7c |
| essai de b16 | ~~Quel compte afficher ?~~ | ✔ 2026-10-02 : progression inchangée (« Z trouvée(s) ») ; en-tête « XX combinaison(s) confirmée(s) » avec infobulle ; la file vise **K confirmées** ; interrupteur « Vérifier toutes les combinaisons trouvées », désactivé par défaut ; mesure courte → 6bis-b18 |
| 7a, 7b, 8-11 | ~~Seize questions d'interface (page « Seize choix d'interface », numéros 1 à 16)~~ | ✔ 2026-10-02 (utilisateur) : recommandations du pilote retenues, sauf **n° 1**, libellé « **Compter les effets d'auras Tolerance et Précision dans les conditions** » ; **n° 10**, l'interrupteur Tempest est **masqué** quand Tempest est la compétence choisie ; **n° 11**, texte « **Tempest (S3) se déclenche après ce sort** » ; **n° 16**, VIT de Rankyaku = VIT finale (A.2 ter). Détail par lot dans chaque recalage |
| 11bis | ~~Les textes d'effet au survol entrent-ils dans le même lot ?~~ | ✔ 2026-10-02 (utilisateur) : pas une infobulle par effet ; **une seule, celle de « Effets actifs »**, qui regroupe les textes, et le survol est gardé en complément. Précisé par le pilote : l'infobulle est construite à partir des descriptions des vignettes affichées ; la fiche monstre ne change pas (la prose du sort y est déjà en clair) — à confirmer par l'utilisateur |
| 8b | ~~Le résumé sous l'objectif (`resumeCombat`) doit-il dire « autres ennemis » quand ce cran de Blade Surge est choisi ?~~ | ✔ 2026-10-02 (utilisateur) : **oui** → lot 8c, avec les deux corrections techniques |
| A.4 | ~~Effort des sous-agents : l'outil de lancement ne le règle pas, il suit celui de la session (xhigh, puis max, le 2026-10-02) ; les 24 sous-agents étaient Opus 5.5. Créer des définitions d'agent pour les lots C et M ?~~ | ✔ 2026-10-02 (utilisateur) : **oui** — `lot-c` (Sonnet, medium) et `lot-m` (Sonnet, low), actives à la session suivante (A.4) ; le lot 12 attend donc la prochaine session |
| 8c | ~~Douze autres champs de la recette indexés par identifiant acceptent une clé à zéro de tête : les aligner dans ce chantier, ou laisser ?~~ | ✔ 2026-10-02 (utilisateur) : **aligner dans ce chantier** → lot 8d |
| 8c | ~~Le résumé sous l'objectif doit-il aussi dire le cran d'ignore DEF des Blade Dancers ?~~ | ✔ 2026-10-02 (utilisateur) : **non**, pas de résumé pour les Blade Dancers |
| 13b (découverte) | ~~Le mode critique « Moyenne », dit par l'utilisateur « non utilisé et devant être supprimé » (amendement 1c1, L64-66), existe toujours et aucun lot ne porte sa suppression : l'ajouter à ce chantier ?~~ | ✔ 2026-10-02 (utilisateur) : **oui** → lot CM ; une recette qui l'utilise est **convertie en « Critique » avec un avertissement visible** (écran et CLI) |
| 13b (constat) | ~~Des calculs faux en silence sont en production (Madness Judgement, Liam, Thunder Strike 7713, Barbara, boucliers de Frieren et d'Internal Force…) : mesure conservatoire maintenant, ou au plan du lot 13 ?~~ | ✔ 2026-10-02 (utilisateur) : **attendre le plan du lot 13** — aucune mesure conservatoire |
| CM | ~~Avertissement de conversion « Moyenne » : vert, effacé après 5 s ?~~ | ✔ 2026-10-02 (utilisateur) : **token warn, affiché jusqu'au prochain import** (`3cba1d5a`) |
| 11bis | ~~Fiche monstre inchangée (prose déjà en clair) ?~~ | ✔ 2026-10-02 (utilisateur) : **confirmé** |
| 11 | ~~Prose de Stone Claws sous le compteur ET au « ? » ?~~ | ✔ 2026-10-02 (utilisateur) : **garder les deux** |
| 9b | ~~Condition de Tempest au survol (`title`) ?~~ | ✔ 2026-10-02 (utilisateur) : **retirer le survol** → lot 9d |
| demande | ~~Liste des monstres et sorts modifiés~~ | ✔ 2026-10-02 (utilisateur) : liste exhaustive, **tenue à chaque commit** → lot LM et règle permanente (ci-dessus) |
| 13b (pour le plan) | ~~Clauses « boss »~~ | ✔ 2026-10-02 : **un réglage global « combat de boss »** lu par toutes les clauses |
| 13b (pour le plan) | ~~Pertes de PV (Hellfire, Ragnarok, Agrenia, Ereshion, Totems, Extraction…)~~ | ✔ 2026-10-02 : **comptées dans le total** — et les PV qu'elles laissent nourrissent la suite (artéfacts 222/223 selon l'état des PV ennemis, ex. Daphnis avant son S3) |
| 13b (pour le plan) | ~~Dégâts différés~~ | ✔ 2026-10-02 : **ce qui tombe pendant le sort** (détonations de bombes, sur un état saisi) ; **les DoT ne comptent pas**, ni leurs détonations (Incinerate, Eivor, Astrid) ; bombes à retardement et propagation hors total, sauf le précédent de la bombe posée sans coup direct |
| 13b (pour le plan) | ~~Attaques hors tour~~ | ✔ 2026-10-02 : **chaque événement du monstre choisissable seul**, sans les attaques d'alliés ; les attaques en coopération restent le **chantier distinct** déjà décidé (`decisions/attaques-conjointes-piste.md`, demande du 2026-09-25) |
| 13b (pour le plan) | ~~Mention « calcul partiel »~~ | ✔ 2026-10-02 : **oui, visible** sur un sort calculé en partie |
| 13b (pour le plan) | ~~Nombre de coups variable~~ | ✔ 2026-10-02 : **saisi, puis dérivé des stats** une fois la loi relevée |
| 13b (pour le plan) | ~~Sort qui porte une formule mais n'attaque pas~~ | ✔ 2026-10-02 : **masqué** de la liste des sorts |
| 13b (pour le plan) | ~~Formes transformées (Liliana → Lord of Hell, Bellenus, Taranys, Pater, Beast Riders)~~ | ✔ 2026-10-02 : **choisissables dans la modale « Dégâts réels »** (la forme change les sorts disponibles), **pas** comme une entrée de plus de l'Optimizer |
| 13b (pour le plan) | ~~Internal Force (Leona)~~ | ✔ 2026-10-02 : **bouclier retiré du total, +50 % « damage dealt » compté** sous un interrupteur « bouclier actif » ; catalogue L220-226 et test à corriger |
| 13b (pour le plan) | ~~Interrupteur d'une attaque appelée active~~ | ✔ 2026-10-02 : **en-tête à part « Attaques déclenchées »** |
| 13b (pour le plan) | ~~Coups sur « un ennemi au hasard » (Rolling Punch, Kacey, Zenitsu, Qilin, Katarina…)~~ | ✔ 2026-10-02 : **un compteur borné** où l'utilisateur choisit combien de coups touchent la cible |
| 13b (pour le plan) | ~~Buffs standard posés par un passif~~ | ✔ 2026-10-02 : **rappel à l'écran**, réglage manuel conservé |
| 13b (pour le plan) | ~~Eightfold (Zenitsu, Qilin Slasher), +50 % si jauge à 0~~ | ✔ 2026-10-03 : **à partir du coup choisi** (comme les Blade Dancers) |
| 13b (pour le plan) | ~~Theonia : comment savoir si la cible a moins d'ATQ ?~~ | ✔ 2026-10-03 : **ATQ ennemie saisie** (le champ `enemyAtk` existe déjà) |
| 13b (pour le plan) | ~~Kung Fu Girls, Trinity Claymore, Fei, Taebaek, TC en points, assiette, Mina, Yuji/Rick, effets de PV sans coup~~ | ✔ 2026-10-02 / 03 : mécaniques fournies par l'utilisateur, inscrites en A.2 ter |
| nuit du 2026-10-02 | ~~Jusqu'où aller sans l'utilisateur ?~~ | ✔ 2026-10-02 : **le plan du lot 13, puis les lots déjà prêts dans ce chantier** (valeur dans la donnée, mécanique existante, décision prise, aucun relevé) — lots 15a à 15e |
| clôture | ~~Lot 14 cette nuit ?~~ | ✔ 2026-10-02 : **après la vérification à l'œil de l'utilisateur**, guidée par la liste du lot LM |
| 13 (consolidation) | ~~Le plan du reliquat (`decisions/plan-reliquat-degats-2026-10.md`) : chantier à part après la clôture (recommandation, D65), ou lot de plus ?~~ | ✔ 2026-10-03 (utilisateur) : **lots de plus dans ce chantier**, contre la recommandation du pilote → lots Q1, Q2 puis P1 à P26 ; rien de livré ne rejoint `main` avant leur fin (ou leur report décidé) |
| 13 (consolidation) | Les 64 décisions encore ouvertes du plan (D01-D64, section 5.2), ses 10 valeurs de jeu (Q01-Q10, section 5.1), puis sa demande de 109 relevés (section 4) | en cours — questionnaire (lots Q1, Q2), 67 questions par blocs de 10 : bloc 1 (Q01-Q10) répondu le 2026-10-03 (A.2 ter ; Q01 et Q07 → relevés ; Q04 appelle une question de suite) |
| 15d | ~~La réduction de DEF posée par le 1er coup de la S2 de Yuji et Rick baisse-t-elle aussi la DEF que subit le 2e coup ? (non modélisé aujourd'hui ; sur le témoin, 2 231,3 au lieu de 1 272,8)~~ | ✔ 2026-10-03 (utilisateur) : **oui**, comme les cinq autres sorts du genre → lot 15f |
| 15e | ~~Une ancienne recette sans `enemyAtk` compte 0 : la condition de Theonia (et de Kassandra, Eleni) s'allume alors que le champ affiche 1 000 — garder, ou prendre la valeur affichée par défaut ?~~ | ✔ 2026-10-03 (utilisateur) : **la valeur affichée** (1 000) → lot 15f |
| 15e | Libellés « Cumuls de Flash Step » et « Cumuls de Turning Slash » : à confirmer | en attente |
| P1 | Rending Claw : le bouton « +50 % sous Mechanical Frame State » est offert aussi à Cecilia (23306) et Elise (23310), dont le kit ne porte pas Emergency Drive — le retirer (clé par identifiant, 23307 seul) ? | en attente |
| bloc 1 | Zeratu (Q03) : les coups 2 et 3 sont des coups de Trample au ratio ÷ 2 ; le bonus selon les PV de la cible recalculé à chaque coup sur les PV restants ? | en attente |
| 15c | ~~Les 14 sorts masqués sur jugement (2813, 2818, 12512, 23706, 23708, 23709, 24206, 24208, 24209, 10243000, 10253000, 15607, 15608, 15609 — boucliers et buffs dont la prose dit « damage » / « attack » au sens des dégâts absorbés ou des attaques ennemies) : confirmer ?~~ | ✔ 2026-10-03 (utilisateur) : **les 14 confirmés**, après lecture du nom, du monstre et de la prose de chacun ; aucun sort à réafficher |
| 15c | ~~Les 144 sorts à formule sans « attack » ni « damage » dans la prose (`controle-15c.md` § 6 ; quelques-uns semblent ne pas attaquer : Unleashed Fury 4210, Scroll Trap 13707/13709, Revive, Toad Poison, Curse, Sleep Spell) : à passer en revue ?~~ | ✔ 2026-10-03 (utilisateur) : **revue maintenant** → lot 15g ; rien n'est masqué sans confirmation de la liste des candidats |

---

## Partie B — un contrat par lot

### B.0 Champs traversants — contrat commun aux lots 6bis, 7, 8 et 10

Les noms ci-dessous sont fixés pour le chantier. Tout renommage exige un
amendement de cette table et le contrôle de propagation de l'ancien ET du
nouveau nom. `SetAura` désigne l'union des cinq clés du lot 6.

| Champ et emplacement | Type | Absent / défaut | Validation | Réinitialisation |
| --- | --- | --- | --- | --- |
| `DamageSetup.setsAuraExternes` | `Array<{ set: SetAura; nombre: number }>` optionnel | `[]` | clés reconnues et uniques, entiers 1..15, somme ≤ 15 ; voir 6bis pour les anciennes recettes | conservé entre monstres/listes ; vidé à l'import de compte |
| `OptimizerState.compterAurasResPre` et `OptimizerRecipe.compterAurasResPre` | booléen ; optionnel dans la recette | `true` | booléen strict si présent | réglage avancé conservé par `resetSearch`, même contrat que les autres réglages avancés |
| `DamageSetup.cibleDegatsParSort` | `Record<number, 'visee' \| 'secondaire'>` optionnel | map vide ; clé absente = `'visee'` | identifiants entiers positifs, valeur dans l'union | vidé au changement d'espèce ou import de compte ; conservé au changement d'exemplaire |
| `DamageSetup.premierCoupIgnoreDefParSort` | `Record<number, number \| null>` optionnel | clé absente = `null` pour A, `7` pour B | A : `null`, 2, 3 ; B : entiers 2..7, jamais `null` | vidé au changement d'espèce ou import de compte ; conservé au changement d'exemplaire |

Les champs de `DamageSetup` voyagent dans `OptimizerRecipe.damageSetup`.
L'import de recette restaure les valeurs validées sans reset ultérieur ;
pas de migration du précédent calcul ignore DEF (décision du lot 10).
`setsAuraExternes` désigne uniquement les autres membres de l'équipe : au
plus cinq monstres à trois sets, d'où le plafond **dérivé** de 15. Le total
effectif d'un build est ce nombre plus les activations d'aura de ses six
runes, résolues par `activeSets` (répétitions et Intangible comprises) ; il
reste au plus à 18. Les sets recherchés ne sont qu'une contrainte, jamais le
nombre des activations propres. L'ancien `setsAura` signifie « total d'équipe » :
une recette qui le porte non vide est refusée avec `damageSetup.setsAura`
et une explication, jamais réinterprétée silencieusement comme « externe ».
Absent ou vide, il équivaut à aucune aura externe ; les recettes antérieures
sans ce champ restent valides. Ne pas changer la version de recette au prix
de rejeter toutes les autres recettes antérieures.
Le vecteur des cinq nombres effectifs (externes + activations propres) se
résout pour **chaque candidat** puis se transmet aux consommateurs concernés,
sans muter `DamageSetup`. En particulier, `auraResPre` figé une fois par
recherche ne peut représenter la RES/PRE des sets propres variables : les
tests de minimum, maximum, bornes et filtres finaux doivent distinguer la
part externe constante et la part propre au build, avec la même convention.
**Décision utilisateur du 2026-09-27 :** pour les conditions RES/PRE,
un set Tolerance ou Accuracy propre est reconnu même s'il n'est pas demandé,
y compris s'il est complété par Intangible, **seulement quand
`compterAurasResPre` est activé**. Désactivé, il ne contribue ni aux bornes
ni au filtre final de ces conditions ; son effet de combat reste actif.
L'analogie avec Blade porte sur la reconnaissance d'un set réellement formé,
pas sur une modification présumée des protections existantes de Blade ou
d'Intangible : a3b vérifie leur parcours avant tout verdict algorithmique.
Les clés de sorts non pris en charge sont refusées avec le chemin du champ,
sur la base des tables de capacités curées ; jamais un cran secondaire ou
ignore DEF arbitrairement appliqué à un sort sans cette capacité.

**Propagation obligatoire pour chaque champ :** état/setter et retours du
hook, contrôles écran, constructeurs de recette export/import, parseur,
`recipeToSearchParams`, contextes réels de recherche et de calcul, CLI,
constructeurs de tests et scripts de diagnostic, signatures de cache
concernées. Documenter explicitement les emplacements sans changement.
Ajouter des tests de valeur absente, présente valide, mal typée/hors bornes,
aller-retour export/import, reset et parité écran/CLI.
Rechercher les noms dans `src/`, `scripts/`, `tests/` et conserver la sortie.
Exécuter aussi `scripts/optimizer-search.ts` de bout en bout sur un compte
réel et une recette gelée exerçant le nouveau champ ; conserver la commande,
la révision, le régime réel et le résumé sans recopier de données privées
dans ce cadrage public. Appliquer les skills de mesure si une perf est comparée.

#### Dérogation documentaire au skill de propagation

**Dérogation explicite validée par l'utilisateur lors de cette revue :**
pour ce chantier, remplacer la checklist documentaire périmée du skill
`.claude/skills/optimizer-field-propagation/SKILL.md` par celle-ci :

- mettre à jour la spec publique de comportement (`optimizer.md` ou les
  fichiers issus de `degats-reels.md`), et la spec privée compétente identifiée
  par le README de routage ;
- mettre à jour `invariants.md` si les règles retenues changent, avec leur source ;
- tenir le suivi `pistes.md` et sa source cohérents dans la même livraison ;
- conserver raisons et preuves dans le dossier A.6 bis et les résultats de lot ;
  ne pas imposer une seconde narration dans un fichier historique ;
- modifier `optimizer/README.md` seulement si son **routage** doit évoluer ;
  ne jamais y réintroduire les anciennes sections de comportement.

La checklist de code et l'exécution du CLI du skill restent obligatoires.
Son ancien appel à `npm test` est remplacé pendant les lots par les tests
ciblés prescrits par `CLAUDE.md` ; suite complète uniquement avant fusion.
Le skill canonique n'est pas modifié par ce chantier.

### Lot 0 — ouverture du chantier

**Cat. M.** Intrant : ce cadrage, Partie A. Aucun fichier de code.

**Déroulé :** `chantier ouvrir --chantier degats-et-aura` depuis
l'installation ; créer
`spec/outils/optimizer/archive/controles-degats-aura-2026-09/README.md`
(H1 + `**Statut :** ARCHIVE — preuves du chantier degats-et-aura`) ; vérifier
la ligne déjà présente dans `spec/README.md` § Chantiers (fichier, statut
« en cours », branche `forge/degats-et-aura`), la corriger si nécessaire,
ne jamais en créer une seconde.

**Sortie :** l'état du chantier existe, `chantier verifier` passe.

**Preuve :** sortie de `chantier ouvrir` et contrôle du README dans
`controle-0.md`, finalisé avant livraison. Ensuite `livrer` → `verifier` →
reçu et sorties inscrits dans le résultat public de ce lot, sans nouvelle
livraison après cette inscription (A.6 bis).

#### Résultat du lot 0 — 2026-09-23

Le pilote valide l'ouverture du chantier et la preuve privée
`archive/controles-degats-aura-2026-09/controle-0.md`. Le dossier de preuves
porte l'en-tête requis, l'entrée de `spec/README.md` est unique et correcte,
et aucun fichier de code ni de destination du lot 2 n'a été créé.

Commande de livraison, rejouée sans changement des notes :

```text
node "C:\Users\Enzo\Desktop\sw-forge\.git\forge\installation\scripts\chantier.mjs" livrer --chantier degats-et-aura
```

```text
Notes déjà à jour côté documentaire — aucun nouveau commit.
Livré.
  code  : c27fe42
  notes : a190130 (74 fichiers)
  reçu  : recus/degats-et-aura.json

Sauvegarde non effectuée par cette commande : git -C "C:\Users\Enzo\Desktop\sw-forge-docs-chantiers\degats-et-aura" push -u origin chantier/degats-et-aura
```

Commande de vérification :

```text
node "C:\Users\Enzo\Desktop\sw-forge\.git\forge\installation\scripts\chantier.mjs" verifier --chantier degats-et-aura
```

```text
Chantier « degats-et-aura »
  ok   le code livré est le code actuel — reçu c27fe42 · actuel c27fe42
  ok   aucune modification de code en attente
  ok   les notes actuelles sont celles du reçu — 74 fichiers · da5fae8fe7e95c8a…
  ok   le worktree documentaire est sur sa branche — chantier/degats-et-aura
  ok   le worktree documentaire est propre
  ok   la branche documentaire est à la révision attendue — attendue 741eacd · trouvée 741eacd
  ok   les notes reportées sont identiques aux notes locales
  ok   l'installation commune est intègre — @ 838641e

Reçu valide. code c27fe42 ↔ notes a190130
```

Verdict : **lot 0 validé**. Le reçu associe le code
`c27fe425305b90ac625e5b5be0691c873ea3c45d` au commit documentaire
`a190130e3788aa773721c8b84c797431bb8fb145`, pour 74 fichiers et l'empreinte
`da5fae8fe7e95c8a696167f807351afaa2c1b494c147d1c0dce9fac280a200f2`.

**Ne fait pas :** ne crée aucun fichier de spec de destination du lot 2, ne
touche à aucun fichier de code.

### Lot 1 — les périmètres de famille, mesurés

Le lot est désormais composé de l'extraction 1a, des six classifications
bornées 1b à 1e, puis de la réconciliation 1f. Aucun lot 8, 9, 10 ou 11 ne
démarre avant 1f, l'amendement pilote et sa revue.

#### Lot 1a — extraction automatique des candidats

**Cat. C pour l'extraction, J pour la classification des candidats.** Les valeurs sont fournies
et consignées en A.2 ter. Ce qu'il produit, c'est la seule chose que ni la
demande ni le CSV ne donnent toute faite — **la liste nominative des compétences et formes
que chaque lot de mécanique doit couvrir**, avec les trois unités de A.0.
Un candidat supplémentaire sans valeur sourcée est signalé pour décision,
jamais couvert par analogie avec les valeurs fournies. Sans cette liste, chaque lot
redécouvre son périmètre et se trompe, comme je m'étais trompé sur le constat
212 (8 lignes d'audit annoncées, 6 réelles).

**Intrant :** `inventaire.csv` (695 lignes d'audit, extraction par script — **jamais**
une lecture de mémoire) ; balayage de tous les `public/data/skills/*.json`
pour vérifier l'exhaustivité, puis lecture ciblée des candidats. Conserver
le script, la commande et la liste des candidats retenus/rejetés avec raison.
Script à créer et conserver : `scripts/audit-degats-aura-corpus.mjs`, sans
dépendance au moteur de recherche. Sortie machine : `corpus-lot-1.json` dans
le dossier de preuves A.6 bis ; commande et sortie résumée dans `controle-1.md`.
Le balayage est automatique ; la lecture humaine porte seulement sur les
candidats extraits (données utiles, provenance, textes de compétence).
Avant cette lecture, mesurer son volume ; si plus de 800 lignes sont à
examiner, le pilote crée des sous-lots de classification bornés avant exécution.

**Sortie :** `controle-1.md` et `corpus-lot-1.json`, avec les requêtes,
compteurs séparés et candidats complets. Les verdicts automatiques restent
`à documenter` : ils sont remplacés par les sous-lots de classification.

**Passage obligatoire par le pilote :** après 1f, amender
les nombres ET listes nominatives des contrats 8, 9, 10, 11 et du tableau A.7.
Le résultat public du lot 1 cite cet amendement et sa revue. Aucun des quatre
lots ne démarre avec les anciennes listes ; signaler un écart dans la preuve
sans corriger le contrat ne termine pas le lot 1.

#### Les quatre extractions à produire

1. **Blade Surge** — constat 151. Point de départ : **5 lignes d'audit / 5 identifiants** (Astar feu `10602`,
   Iris lumière `10604`, Lapis eau `10616`, Lupinus vent `10618`, Lanett
   ténèbres `10620`). À vérifier : quels autres identifiants et formes du corpus portent le
   même sort. ⚠️ Les constats **163** (Theonia : zone puis frappe sur la DEF
   la plus faible), **173** (Danu : zone après sept attaques cumulées) et
   **180** (Jackie : attaque de plus si la cible est étourdie) sont
   **voisins mais distincts** — même catégorie 08, autre mécanique. Ils ne
   rejoignent pas le lot 8 ; ils vont au lot 13.
2. **Tempest** — constat 164, **1 ligne d'audit / 1 identifiant**, `3213`.
   Recenser toutes ses formes de monstre, pas seulement Teshar éveillé. Même
   architecture : constats **168** (Mina, 1), **178** (RYU/Striker, 6),
   **179** (Drunken Masters, 10), **313** (Jin/Kai ténèbres, 2) — **19
   lignes d'audit** d'attaque déclenchée par un sort, aux déclencheurs et ratios
   propres. Le lot 9 livre le mécanisme, ces 19 vont au lot 13 **avec leur
   numéro de constat**.
3. **Les Blade Dancers** — constat 212, **6 lignes d'audit / 6 identifiants**, **deux variantes** que
   la donnée distingue (relevé ci-dessous, à rejouer et coller) :

   | Variante | Identifiants initiaux et noms | `coups` | `Decrease ATB` / coup | `note` |
   | --- | --- | --- | --- | --- |
   | **A** | Hyakuretsukyaku CHUN-LI vent `14308` et ténèbres `14310` ; Blade Dance of Night Cordelia `14808` et Vereesa `14810` | 3 | 50 % | `If enemy ATB at 0` |
   | **B** | Hoyokusen CHUN-LI eau `14311` ; Moonlight Dance Lariel eau `14811` | 7 | 40 % | `If enemy ATB at 0 or 7th hit` |

   ⚠️ En **B**, la prose ajoute « The 7th attack will always ignore Defense » :
   le dernier coup est **inconditionnel**. C'est une règle de plus, pas la
   même mécanique — d'où deux entrées de table au lot 10, pas une.
4. **Les passifs « Stats acquises en combat »** — les **38 identifiants / 40
   configurations** de `STATS_COMBAT_PAR_ID_CONNUS`, avec pour chacune le monstre (résolu depuis
   `public/data/monsters.json`), la `source`, et la branche de
   rendu qui la traite. C'est l'intrant du lot 11.

**Preuve :** `controle-1.md` avec les quatre extractions et leurs commandes.
Un écart avec un chiffre de ce cadrage se **signale** — le cadrage se corrige,
pas la mesure.

**Ne fait pas :** ne modifie aucun code de production, ne touche à `damage.ts`
ni à aucune table `*_CONNUS`, ne décide d'aucun ratio (A.2 ter les fixe déjà).

#### Résultat du lot 1a — 2026-09-23

Extraction déterministe livrée par `c0407a5`. Le corpus fait **870 lignes
utiles / 407 338 octets**, empreinte
`e14d2259f1a7501dee37f34d15c1dbb4d042db31c334f870989b64f6a38d5f34` :
le seuil de 800 impose la scission avant lecture humaine. Les compteurs sont
Blade Surge **10/13/21**, Tempest **100/140/202**, Blade Dancers **6/6/12**
et stats de combat **42/38/80**, dans l'ordre lignes d'audit / identifiants /
formes ; les 40 configurations de stats sont retrouvées.

La preuve `controle-1.md` est associée au reçu valide code `c0407a5` ↔ notes
`ea309e7` (76 fichiers, empreinte `6f3dd6da5d98bffc…`). À ce stade de
l'extraction, le constat 313 restait à trancher : sa lacune parlait d'un
excédent stocké pour le prochain S3, pas d'une attaque déclenchée. Le résultat
du lot 1c1 ci-dessous l'a depuis classé hors famille et en a curé la règle.

#### Lot 1a2 — correctif d'extraction borné

**Cat. C.** Réouverture de 1a imposée par la découverte du lot 1c2 : le
constat 177 contient les lignes de Twist Kick `8216`, `8217` et `8219`, mais
elles sont absentes de `corpus-lot-1.json` alors que les deux autres S2 de la
même famille, `8218` et `8220`, y figurent. Une extraction qui retient une
partie d'un constat et omet ses compétences liées ne prouve pas le périmètre.

**Intrant borné :** toutes les lignes du constat 177 dans `inventaire.csv`,
les kits complets des formes Kung Fu Girl concernées, puis tous les kits dont
`familyId` ou `skillGroupId` appartient à la famille Samurai `16900`. Le
balayage du corpus entier sert à retrouver ces formes ; il ne crée aucun autre
périmètre par ressemblance de prose.

**Sortie :** modifier l'extracteur pour produire, sans modifier les six
projections figées déjà livrées, un complément déterministe :
`corpus-lot-1-complement.json`, `manifest-lot-1-complement.json` et
`projection-lot-1c4.json`. Le complément contient au minimum les trois S2
Kung Fu Girls omises et les compétences S1 à S4 de toutes les formes Samurai
trouvées ; les couples à classifier et les contextes seulement consultables
sont distingués comme dans le contrat commun. Comptages, octets et empreintes
sont mesurés et collés dans `controle-1a2.md`.

**Preuve :** la commande d'extraction rejouée deux fois donne des octets
identiques ; les dix lignes du constat 177 sont retrouvées ; aucune décision
des lots 1c1/1c2 n'est perdue ni déplacée ; les anciennes empreintes restent
inchangées. Puis `node scripts/spec-lint.mjs` et `git diff --check`.

**Ne fait pas :** aucune classification humaine, aucun code de production,
aucune régénération silencieuse des projections 1c1 à 1e.

**Résultat validé le 2026-09-24.** L'extracteur livré par `d9b6959` produit
un complément déterministe de **43 couples attendus** : les trois S2 Kung Fu
Girls omises `8216`, `8217` et `8219`, puis les quarante compétences Samurai
`8001` à `8040`. Le contexte joint couvre **55 compétences, 16 formes et 14
lignes d'audit**. Les onze kits Samurai comportent chacun les slots S1 à S4 ;
le onzième est l'Imperfect Samurai eau `16921`, inclus parce que ses
`familyId` et `skillGroupId` valent `16900`, sans préjuger ici de sa
sélectionnabilité ni de son verdict au lot 1c4.

Les deux extractions de contrôle donnent les mêmes octets :
`corpus-lot-1-complement.json` (79 479 octets,
`5ff6f62f62a44984cdbfdcf4495a57c64dad28d78d31b1e2ae722c44b5aa9f77`),
`manifest-lot-1-complement.json` (5 303 octets,
`a835faea98164ffb4364b13502684b18a91561f47a51afe7561954c9f0aa9886`)
et `projection-lot-1c4.json` (76 175 octets,
`72828e9f578b87741faa7a941e23e04f1113be1eb03c514a134d73f1a354296a`).
Le corpus, le manifeste et les six projections antérieures conservent leurs
empreintes. Preuve : `controle-1a2.md`. Reçu validé : code `d9b6959` ↔ notes
`614e05d`. Le lot 1c4 est débloqué ; aucune classification ni valeur de jeu
n'a été ajoutée par 1a2.

#### Contrat commun des lots 1b à 1e

Intrant figé : `corpus-lot-1.json` à l'empreinte ci-dessus. La commande
canonique `node scripts/projeter-degats-aura-lot-1.mjs` produit six fichiers
`projection-lot-<sous-lot>.json` et `manifest-lot-1.json` (empreinte
`42b66d32039311b535d7a4d3f913a8cca0745fd9ffa995eb5ea0c9589007c613`).
Le format est du JSON tabulaire UTF-8/LF, une ligne par enregistrement, ordre
fixe. Chaque projection porte son empreinte et celle du corpus.

Dans une projection, seuls `couplesAttendus` et `candidats` désignent ce que
le sous-lot doit classifier : même famille, mêmes identifiants, même nombre.
`competences`, `formes` et `lignesAudit` sont du contexte consultable joint
par identifiant ; `competencesCandidates` y est réduit aux identifiants du
sous-lot. `configurations` est vide sauf en 1e. Aucun enregistrement de
contexte ne crée un verdict supplémentaire.

Chaque sous-lot produit `decisions-lot-<sous-lot>.json` et
`controle-<sous-lot>.md`. Une décision structurée porte obligatoirement :
`famille`, `skillCom2usId`, `verdict`, `justification`, `sources`,
`lignesAudit`, `formes` (identifiant, nom, élément) et `incertitudes` ; 1e
ajoute `configurations` et leurs branches de rendu. Les verdicts autorisés
sont **même mécanique / même architecture / hors famille / à documenter**.
Une ressemblance de nom, de prose ou d'effet ne suffit jamais. Aucun ratio
n'est étendu.

Chaque preuve cite les données lues, toutes les formes affectées et les
incertitudes. Pas de code de production ni de modification du script ; une
erreur d'extraction rouvre 1a. Chaque sous-lot validé suit `livrer` →
`verifier` → `integrer` avant le suivant.

#### Lot 1b — Blade Surge

**Cat. J.** Les 13 identifiants candidats de `famille = bladeSurge` :
`10601`, `10602`, `10603`, `10604`, `10605`, `10616`, `10618`, `10620`,
`11015`, `18314`, `23507`, `23508`, `23510`. Projection : **85 lignes utiles /
27 024 octets**, empreinte
`b4941261db4800379830b4524b4c522f5e18167b2ccde5b561648f5265d724c4`.
Les constats 151, 163, 173 et 180 restent distingués.

**Résultat validé le 2026-09-23.** Les huit identifiants `10601`, `10602`,
`10603`, `10604`, `10605`, `10616`, `10618` et `10620`, soit onze formes,
relèvent de la même mécanique. Les trois identifiants supplémentaires ont été
curés par confirmation directe de l'utilisateur après la première
classification ; ils ne sont plus à documenter. Les cinq identifiants
`11015`, `18314`, `23507`, `23508` et `23510`, soit dix formes, restent hors
famille. Aucun candidat ne reste indécis et aucun voisin n'est classé en même
architecture. La confirmation complémentaire de l'utilisateur lève
`H-BS-SKILLUP` : le même nombre de skillups vaut pour ces huit identifiants et
leur bonus de dégâts porte aussi sur le troisième coup. Elle lève également
`H-BS-CIBLE` : le troisième coup en zone touche la cible principale après les
deux coups mono-cible. Il ne reste donc aucune hypothèse Blade Surge parmi ces
deux points. Le lot 1f devra proposer l'amendement correspondant
du contrat du lot 8 sans réintroduire ces trois compétences dans le reliquat.
Preuves : `decisions-lot-1b.json`, `controle-1b.md` et
`controle-1b-amendement.md` dans le dossier de contrôles du chantier.

#### Lots 1c1 à 1c3 — Tempest et attaques supplémentaires

**Cat. J.** Trois ensembles disjoints dans `famille = tempest` :

- **1c1** : les 20 amorces des constats 164, 168, 178, 179, 313, plus les
  deux candidats à nom partagé `6111` et `6176` — 22 identifiants ; projection
  **134 lignes utiles / 50 161 octets**, empreinte
  `94681cf5365ebe50311af11f4f7a7acee397d5719cecc30d51073e085e7e8e62`.
  Le constat 313 reçoit un verdict explicite.
- **1c2** : candidats restants découverts uniquement par l'effet
  `Additional Attack`, triés par identifiant, positions **1 à 59** ; projection
  **298 lignes utiles / 111 149 octets**, empreinte
  `2852722f44ae68eb059f733cefd99208fdfd968f0caa5ba5b18f3f20b9d059f4`.
- **1c3** : même liste triée, positions **60 à 118** — au plus
  **339 lignes utiles / 129 391 octets**, empreinte
  `7a38a0c2edc1f0a31ac2f14280139a26a57a2f50b1bea4b1dc863e81bdd9d570`.

Le tri et les positions portent sur le corpus figé, jamais sur une nouvelle
extraction. 1f vérifie que les trois ensembles retrouvent exactement les 140
identifiants Tempest candidats sans doublon ni omission.

**Résultat du lot 1c1 validé le 2026-09-23.** Tempest `3213` est la seule
compétence de même mécanique : ses trois skillups `Damage +10%` s'appliquent.
Les dix-sept identifiants des constats 168, 178 et 179 relèvent de la même
architecture, soit Mina 2A, les RYU/Strikers concernés et les Maîtres ivres.
Leurs probabilités réelles restent des données de jeu — 30 % pour Drunken Kick
de Wei Shin, 50 % pour les trois Shoryuken — mais ne pondèrent jamais le calcul :
l'utilisateur active ou non chaque attaque supplémentaire. Les gabarits
Martial Cat 2A `47601` à `47605` ne sont pas jouables ; `6176` rejoint donc
`6111`, `22415` et `22915` hors famille. Aucun candidat ne reste à documenter.

Les compétences appelées sont présentes dans le corpus complet : Energy Punch
`6151`, Rolling Punch `8101` à `8105`, Hadoken `13902`, `13903`, `13905` et
Mach Punch `14402`, `14403`, `14405`. Le lot 1f doit joindre ces profils aux
déclencheurs au lieu de demander leurs paramètres à l'utilisateur. Les deux
lignes du constat 313 forment une autre famille : Jin/Kai à stock de dégâts,
destinée au lot 13 avec le compteur manuel curé en A.2 ter. Preuves :
`decisions-lot-1c1.json`, `controle-1c1.md` et
`controle-1c1-amendement.md` dans le dossier de contrôles du chantier.

**Résultat du lot 1c2 validé le 2026-09-24.** Sur les 59 identifiants de la
projection figée : aucun n'est de même mécanique, **18** relèvent de la même
architecture, **41** sont hors famille et aucun ne reste à documenter. Les
cinq S2 non éveillées `8206` à `8210` rejoignent les cas hors famille : elles
n'ont pas de S3 et leurs formes ne sont pas sélectionnables. Sword of Promise
`6001` à `6005` et Shadow Assault `10713` sortent aussi du calcul, car leur
contribution suivante vise obligatoirement un autre monstre alors que
l'Optimizer calcule une cible.

Les décisions utilisateur de A.2 ter ferment les scénarios de Raoq, Ermeda,
Chain Fire, Sia, Zeratu, Hwa, les cinq Kung Fu Girls éveillées, Barque et
Jackie. Sword of the Supreme Sky Wolf `8018` reste hors famille comme
**déclencheur** : une S4 sélectionnée seule ne produit aucune suite. Le
mécanisme Samurai découvert porte sur les S1/S2/S3 et rejoint le complément
1a2/1c4, avec toutes ses formes, au lieu d'être artificiellement attribué au
seul identifiant `8018`. Preuves : `decisions-lot-1c2.json`,
`controle-1c2.md` et `controle-1c2-amendement.md`.

#### Lot 1c4 — classification du complément

**Cat. J.** Intrant exclusif : la projection produite et bornée par 1a2.
Appliquer le schéma de décision du contrat commun à chaque couple attendu.
Pour les Kung Fu Girls, préserver la famille complète S1 → S2 → S3 et les
crans curés en A.2 ter. Pour les Samouraïs, distinguer les compétences qui
ouvrent un tour supplémentaire de la S4 terminale ; une forme générique ou
non sélectionnable n'est jamais assimilée à une forme jouable sans preuve.

**Sortie et preuve :** `decisions-lot-1c4.json`, `controle-1c4.md` et un
validateur structurel couvrant exactement le manifeste complémentaire. Aucun
code de production ni nouvelle valeur de jeu.

**Résultat validé le 2026-09-24.** Les 43 couples sont réconciliés sans
incertitude : **23 relèvent de la même architecture, 20 sont hors famille,
0 de la même mécanique et 0 restent à documenter**. Les trois S2 Kung Fu
Girls `8216`, `8217` et `8219` rejoignent l'architecture de chaîne curée.
Pour les Samouraïs, les vingt compétences `8021` à `8040` des formes nommées
Kaz, Jun, Kaito, Tosi et Sige relèvent de la même architecture, S4 comprise
comme contribution terminale. Les vingt compétences `8001` à `8020` sont
hors famille : elles ne sont portées que par les formes génériques `16901` à
`16905` et l'Imperfect Samurai `16921`, toutes confirmées non sélectionnables
par l'utilisateur. Cette exclusion ne modifie ni les profils ni les chaînes
des cinq formes nommées. Preuves : `decisions-lot-1c4.json`,
`controle-1c4.md` et `valider-lot-1c4.mjs`.

**Périmètre du complément, clos au lot 1f.** Les 43 couples comprennent les
trois S2 Kung Fu Girls `8216`, `8217`, `8219` et quarante compétences de
Samouraïs : `8021` à `8040` pour les cinq formes nommées, de même architecture,
et `8001` à `8020` pour les formes non sélectionnables, hors famille. Dans la
chaîne Kung Fu Girl, les S1 `8201` à `8205` et les S2 `8218`/`8220` ont déjà
été classées au lot 1c2 et font partie des 240 couples. Seules les cinq S3
Dragon Attack `8211` à `8215` sont du contexte sans couple propre dans le
complément ; leurs valeurs curées restent valides et elles rejoignent
explicitement l'inventaire du lot 13 sans être ajoutées artificiellement aux
240 clés.

**Résultat amendé du lot 1c3, validé le 2026-09-24.** Les 59 couples sont
réconciliés : **23 relèvent de la même architecture, 36 sont hors famille,
0 de la même mécanique et 0 restent à documenter**. Improvisation `15513`
de Dominic rejoint l'architecture des contributions passives déjà livrées :
le calcul existant applique un dégât fixe de `2.0 × ATQ` au-dessus de 50 % de
PV et de `1.0 × ATQ` sinon, sans facteur de DEF. Chain Effect `18112` sort du
périmètre car il n'est porté que par Indra feu générique `28302`, non
sélectionnable ; les Vendhan jouables `18132` et `18212` répètent, eux, la
compétence à 50 % de ses dégâts, le Silence à 25 % restant hors calcul.

Hwoarang et Taebaek sont deux habillages des mêmes monstres. Feu : Backlash
`22502` correspond à Triple Kick `23002`, Hunting Hawk `22507` à Roundhouse
Kick Combo `23007`, et Blood Talon `22512` à Heaven's Might `23012`. Sur S1,
un interrupteur ajoute S2 ; sur S2, le scénario choisit S1 avant ou S2 après.
La première pose réussie de Marque dans la chaîne de six coups se choisit
entre aucune et les coups 1 à 5. Ténèbres : Backlash `22505` correspond à
Triple Kick `23005`, Hunting Hawk `22510` à Roundhouse Kick Combo `23010`, et
un interrupteur de S2 choisit si S1 frappe avant. Trinity Claymore `22515` et
Endless Kick Combo `23015` appellent S1 puis S2, dans cet ordre, avant trois
coups utilisant chacun leur ratio propre `0.8 × ATQ`. Les formes génériques
associées à ces identifiants restent ignorées. Preuves :
`decisions-lot-1c3.json`, `controle-1c3.md` et `valider-lot-1c3.mjs`.

#### Lot 1d — Blade Dancers

**Cat. J.** Les six identifiants `14308`, `14310`, `14311`, `14808`,
`14810`, `14811`. Projection : **51 lignes utiles / 14 168 octets**, empreinte
`70142e16f0ce2a4e18585efa541fa25add10cf93debc2bc60a831c7d5fba2f25`.
Vérifier séparément
les variantes trois et sept coups, les deux quantités de baisse d'ATB et le
dernier coup inconditionnel ; ne pas valider les valeurs curées par simple
relecture de la table initiale.

**Résultat validé le 2026-09-24.** Les six couples et leurs douze formes sont
réconciliés sans incertitude. Les quatre compétences de variante A `14308`,
`14310`, `14808` et `14810` relèvent de la **même mécanique** : trois coups à
`1.8 × ATQ`, baisse d'ATB de 50 % par coup et aucun ignore DEF par défaut. Les
deux compétences de variante B `14311` et `14811` relèvent de la **même
architecture**, et de la même mécanique entre elles : sept coups à
`0.85 × ATQ`, baisse d'ATB de 40 % par coup et septième coup toujours en
ignore DEF, seul coup qui l'est par défaut. Cette règle supplémentaire
interdit de fusionner A et B sous un même verdict mécanique. Preuves :
`decisions-lot-1d.json`, `controle-1d.md` et `valider-lot-1d.mjs`.

#### Lot 1e — stats acquises en combat

**Cat. C.** Les 38 identifiants / 40 configurations de
`STATS_COMBAT_PAR_ID_CONNUS`. Projection : **291 lignes utiles /
107 450 octets**, empreinte
`c871aa35d3b266000a38e8656356c56176cfea68597fccd7a8c8d12c250aa4f5`.
Résoudre les 80 formes, la source et la branche de rendu de chaque
configuration. « Présent dans la table » ne valide pas la valeur de jeu. Le
calcul du constat 110 reste à prouver au lot 11.

#### Lot 1f — réconciliation et proposition d'amendement

**Cat. C+J.** Intrants : `manifest-lot-1.json`,
`manifest-lot-1-complement.json`, les **sept** fichiers de décisions (`1b`,
`1c1`, `1c2`, `1c3`, `1c4`, `1d`, `1e`) et leurs preuves ; ne pas relire les
1 056 lignes brutes des deux corpus. Comparer les clés aux **240 couples
famille/identifiant nommés par les deux manifestes** : 197 dans le manifeste
initial (13 + 140 + 6 + 38) et 43 dans le complément, ensembles disjoints par
famille. Comparer les clés, pas le seul total : zéro substitution, doublon ou
omission. Un même identifiant peut appartenir à deux familles candidates.
Valider les deux schémas, les verdicts, les sources, les formes et les
incertitudes ; pour 1e, les configurations, branches et la résolution pilote
de `7912`. Aucun verdict ne reste absent ou contradictoire.

Produire `controle-1f.md` avec les listes finales par mécanique, les formes,
les incertitudes et le texte exact proposé pour les lots 8, 9, 10, 11 et
A.7, complément `1c4` compris. La réconciliation automatique porte sur les
fichiers structurés ; la preuve textuelle ne recopie que les totaux, anomalies
et décisions encore
ouvertes. Le pilote applique ensuite cet amendement et le fait revoir ; lui
seul marque l'ensemble du lot 1 terminé.

**Résultat validé et amendé par le pilote le 2026-09-24.** Les deux manifestes
portent exactement **240 couples famille/identifiant** : 197 initiaux et 43 du
complément. Les sept fichiers de décisions restituent les mêmes 240 clés, sans
omission, substitution, duplication ni verdict contradictoire : 18 « même
mécanique », 108 « même architecture », 114 « hors famille », 0 « à
documenter ». Les inventaires conservent toutes les formes du corpus ; leur
présence ne les rend pas sélectionnables. La décision générale de `A.2 ter`
exclut directement les formes non éveillées de l'écran, sans confirmation
forme par forme ni suppression des identifiants partagés avec une forme
jouable.

Les validateurs 1d et 1e, rendus instables par leurs coordonnées de lignes
absolues dans ce cadrage mutable, utilisent désormais des ancres sémantiques
uniques pour les fichiers évolutifs et conservent la vérification ligne par
ligne des projections figées. Les sept validateurs de sous-lot et le
validateur 1f passent. Preuves : `controle-1f.md`, `valider-lot-1f.mjs` et les
amendements consignés dans `controle-1d.md` et `controle-1e.md`.

### Lot 2a — classement des blocs et plan de découpage

**Cat. C.** Requiert le lot 0. Skill `spec-hygiene`, recette (b). Déclencheur : les lots
6, 8, 9, 10 et 11 modifient le **contenu normatif** de ce fichier, listé en
exception de `spec/spec-lint.json` (`chantier_responsable: "degats"` — c'est
nous).

**Mesuré le 2026-09-23** (script d'inventaire des blocs, à joindre à la
preuve) : **2 004 lignes, 55 titres, 1 seul bloc terminal > 100** — le H3
« Cinquième vague — points 9, 10 et 26 à 43 » (L1418), **230 lignes**.
Masse par H2 :

| Plage | Lignes | H2 |
| --- | --- | --- |
| L1-198 | 198 | en-tête + principe, lecture des formules, équation, invocateur, hors modèle |
| L199-760 | 562 | dégâts bruts de passif, amplification de buff, lignes 218-221, 411/222/223, 400-403/410/224, bombe 210, éléments 300-304, les bombes |
| L761-1218 | 458 | passifs offensifs — le modèle |
| L1219-1647 | 429 | catalogue « passifs non implémentés », cinq vagues |
| L1648-1839 | 192 | effets d'équipe, leader skill, stats à privilégier |
| L1840-2004 | 165 | audit des dégâts conditionnels, parties 1 et 2 |

**Intrant borné :** les 2 004 lignes de `degats-reels.md` à l'état initial,
par sections après sommaire ; les références sont relevées sans modification.
Relever les plages courantes avant exécution. Les 429 lignes de catalogue
font partie du classement, pas d'un déplacement automatique en archive.

**Contrat :** classer chaque bloc en état actuel, décision, piste ou archive ;
citer sa première ligne et justifier sa destination. Produire un plan complet
source → destination, titres/ancres inclus, conservant ordre et doublons.
Le pilote valide ce plan avant 2b. Ne modifier aucune règle métier.

**Sortie et preuve :** `controle-2a.md`, décisions par bloc et plan de
destination, avec longueurs et commandes d'inventaire ; aperçu des références
daté, distinguant nombre de lignes correspondantes, occurrences et fichiers.
Les anciens « 340 occurrences / 28 fichiers » ne constituent pas une cible.

**Ne fait pas :** aucun déplacement, aucun repointage, aucune suppression
d'exception ; ces opérations relèvent exclusivement de 2b.

**Résultat validé et amendé par le pilote le 2026-09-24.** Après revue
externe, le plan couvre exactement les 2 003 lignes de contenu en **68
fragments** : 57 d'état actuel (1 859 lignes), 2 de décision (26), 2 de
piste (15) et 7 d'archive (103).
Les identifiants `Bnn` restent des coordonnées de preuve privées ; les
destinations utilisent les titres métier conservés ou ajoutés et leurs slugs
effectifs. `plan-2a.json` fixe aussi le H1 et l'en-tête de chaque nouveau
fichier, ainsi que l'emplacement des deux ajouts à `pistes.md`.

Les sept ambiguïtés du premier plan sont tranchées dans `controle-2a.md` à
partir du code et des tests actuels : scission de l'état courant et de
l'historique pour les exclusions générales, `ArtifactDamageProfile` et
`damageRelevantStats` ; archivage de l'ancien blocage de Trasar, de
l'application une fois par sort de Sickle/Sand Blade et de l'ancien bouton
manuel de Zaiross ; distinction des deux listes qui portent un « point 10 ».
La revue externe a en plus fait régénérer les trois coordonnées périmées du
cadrage dans l'inventaire, corriger le routage de la ligne d'artéfact 210,
fixer le niveau de chaque titre et l'emplacement des deux pistes, conserver
la partie actuelle de l'ancien incident B09 et expliciter la politique des
références archivées. Le plan ainsi amendé est l'intrant obligatoire du lot
2b.

Une seconde revue externe a ensuite relevé que cinq lignes d'`invariants.md`
auraient continué à résoudre tout en visant une archive, une décision ou le
mauvais fragment. Le pilote a donc reclassé en **état actuel** les huit
fragments du catalogue qui décrivent le modèle livré (373 lignes), dans
`degats-reels/catalogue-des-passifs.md` ; seules B15 et B24 restent des
décisions. Le plan fixe désormais les cinq sources vivantes d'invariants,
l'énoncé d'état actuel qui accompagne la décision B15 sur
`damageRelevantStats`, la destination de trois références déjà obsolètes et
la redistribution des dix titres cités par `pistes.md:108`. Aucune source
d'invariant ne peut viser `decisions/` ou `archive/`.

### Lot 2b — déplacement et repointage selon le plan validé

**Cat. M.** Requiert le lot 2a et la validation pilote de son plan.
**Intrants :** plan et décisions de `controle-2a.md`, blocs source nommés dans
ce plan et aperçu des références. Si la source a changé, réconcilier le plan
avec le pilote avant déplacement, jamais choisir de nouvelles destinations seul.

#### Contrat exact

1. **Exécuter le classement validé en 2a**, bloc par bloc, sans requalifier
   les contenus au fil du déplacement. Le fragment mixte B46b2 reste complet
   en archive ; les deux formulations d'état actuel fixées par
   `plan-2a.json` sont ajoutées à leur destination : conservation de la valeur
   curée `quantite: 7`, puis exclusion des lignes 218–221 de
   `damageRelevantStats`. Elles ne changent aucune décision métier ; B15 reste
   conservée dans `decisions/choix-de-recherche.md` pour en expliquer la
   raison.
2. **Destination : un dossier `spec/outils/degats-reels/`** + un
   `degats-reels.md` réduit à son routage (comme
   `spec/outils/optimizer/README.md`). Chaque fichier ≤ 500 lignes, chaque
   bloc terminal ≤ 100 — l'ancien bloc de 230 lignes est réparti dans les huit
   fragments fixés par le plan ; aucun de ces fragments n'est tronqué.
3. **En-tête sur chaque fichier issu du découpage** (nature « état actuel » :
   `Statut` / `Lire si` / `Ne pas lire si` / `Voir aussi`).
4. **Repointer les références réellement relevées en 2a**, notamment dans
   `invariants.md`, `optimizer.md`, `artefacts.md`,
   `pistes.md`, `spec/outils/README.md`, le skill `game-data-curation`,
   `ARCHITECTURE.md` si une référence y existe, et les commentaires de `damage.ts`,
   `runeBuildOptim.ts`, `OptimizerSection.tsx`, `DamageSetupCard.tsx`,
   `useOptimizerState.ts`, `artifactOptim.ts`, `optimizerRecipe.ts`,
   `scripts/artifact-search.ts`, `tests/degats.test.ts`. **D'abord en aperçu**
   (script qui liste sans écrire), puis diff relu, jamais une réécriture à
   l'aveugle : une référence `fichier § Titre` est sensible au chemin **et**
   au slug du titre. Repointer les documents actifs et les citations en prose
   identifiées ; ne pas réécrire les références des preuves sous `archive/`,
   qui décrivent volontairement le chemin et les titres à leur date.
   Appliquer en particulier les cinq cibles d'`invariants.md`, les trois
   références à l'ancien titre « Corrections identifiées » et la répartition
   en quatre fichiers des dix titres de `pistes.md:108`, tous fixés dans
   `plan-2a.json` ; aucune destination ne se décide pendant 2b.
5. **Retirer l'exception** de `spec/spec-lint.json`.
6. **`ARCHITECTURE.md`** : relever ses références dans l'aperçu. Si une
   référence à une section déplacée existe, la repointer vers sa destination
   exacte. Si aucune référence n'existe, conserver la sortie vide comme
   preuve et ne pas modifier le fichier. Ajouter volontairement une nouvelle
   référence serait une décision distincte, pas un repointage du lot 2b.

**Sortie :** fichiers déplacés selon le plan, routage et références mis à jour,
exception retirée après vérification.
**Preuve** (`controle-2b.md`) :
`node scripts/spec-lint.mjs` propre (contrôle global, sans filtre de chemin) · `node tests/run.mjs spec-lint spec-markdown spec-toc` vert ·
table source → destination (plages et première ligne de chaque bloc), puis
`git diff --no-index -U0 <bloc-source> <bloc-destination>` sur les blocs
reconstitués dans leur ordre d'origine, chaque différence structurelle
justifiée · aperçu des références via `rg --hidden --no-ignore -n
'degats-reels\.md' spec src scripts tests .claude/skills ARCHITECTURE.md`,
puis vérification des chemins ET ancres · tableau des longueurs après découpage.
Un `rg` non vide est normal : le fichier de routage reste valide.

**Ne fait pas :** ne corrige aucune faute ni règle métier ; `optimizer.md`
et `artefacts.md` ne reçoivent ici que les corrections de liens et références.
Ces corrections ne déclenchent aucun découpage (`spec-hygiene`, déclencheur).

### Lot 3 — le plancher des conditions en « Libre »

**Cat. M.** Le bug est localisé :
`OptimizerSection.tsx` l. 2370 `artifactBonusOf` somme la principale de
`searchArtifacts` ; l. 3477-3491 en fait `floor`, puis `min={floor}` et
`placeholder={String(floor)}` du champ « Min » (et de « Max »). En « Libre »,
`searchArtifacts = paireRepresentative(...)` retient deux `PV +1500` : plancher
**3 000 PV**, et **0 ATQ / 0 DEF** — asymétrie qui a déjà causé une violation
de monotonie côté moteur (`artefacts.md` § 12.13).

**Contrat :** le plancher est **ce qui est garanti**, jamais ce qu'une paire
représentative suppose. Donc, par emplacement :

- `'equipped'` → la pièce réellement portée est fixe et connue : sa principale
  compte.
- un code de stat forcé (100/101/102) → la principale imposée compte.
  Hypothèse produit explicite de l'utilisateur (revue du 2026-09-23) : chaque
  compte possède au moins deux artéfacts applicables de chaque principale
  PV/ATQ/DEF pour chaque monstre. Aucun mécanisme supplémentaire de preuve
  de disponibilité n'est demandé pour ce plancher.
- `'libre'` → **rien n'est garanti : 0**.
- optimisation d'artéfacts coupée → les deux emplacements valent `'equipped'`
  (déjà le cas, l. 1402-1407) : inchangé.

Le plancher est donc une somme **par emplacement**, pas une lecture de la
paire retenue. ⚠️ Les deux emplacements ont chacun leur choix : un
`'equipped'` + un `'libre'` donne le plancher du seul premier.

**Sortie :** contribution d'artéfacts nulle quand les deux emplacements sont
sur « Libre ». En mode total, le plancher conserve la base ; en mode bonus,
la base est exclue seulement pour PV/ATQ/DEF/VIT. TC/DC/RES/PRE restent des
totaux. La contribution d'une relique équipée s'ajoute au lot 4.
Tester les modes total/bonus et les choix mixtes par emplacement.
Un test nommé dans `tests/` +
`tests/index.ts` (harnais d'abord — c'est un contrôle exprimable en test).

**Preuve :** le test (rouge avant, vert après, les deux sorties collées) ·
`npx tsc --noEmit` · `node tests/run.mjs <nom> artefact-optim artefact-file artifact-evaluation` ·
`npm run build`.

**Ne fait pas :** ne touche pas au moteur (`artFlatMax`/`artFlatMin` de
`runeBuildOptim.ts` sont **corrects** — une borne optimiste pour les minimums,
pessimiste pour les maximums). Ce lot ne corrige que le **plancher de saisie
de l'écran**. Ne touche pas à la relique (lot 4).

### Lot 4 — la relique « comme équipé » et les minimums

**Cat. C, puis M seulement si le constat l'exige.** Vérification demandée :
la relique en « comme équipé », **et dans ce cran seulement**, modifie-t-elle
bien un des minimums PV / ATQ / DEF, comme le font les artéfacts ?

**Constat déjà établi, à confirmer et compléter :** `artifactBonusOf`
(l. 2370) ne lit **que** `searchArtifacts` — la relique n'y entre pas. Et la
principale d'une relique est un **pourcentage** (`stats.ts` l. 75-77 :
`pct[def.stat] += gear.relic.main.value`), pas un plat : sa contribution
garantie vaut `base × pct / 100`, arrondie comme `computeStats` l'arrondit —
**jamais** recopiée ailleurs.

**Déroulé :** 1) constater, par mesure, ce que le plancher vaut aujourd'hui
avec et sans relique équipée, dans les cinq valeurs de `relicMainChoice`
(`equipped`, `libre`, 100/101/102) ; 2) comparer au moteur, qui lui a bien
`relPctMax`/`relPctMin` (`runeBuildOptim.ts` l. 2777) ; 3) **si** écart, le
corriger : contribution garantie **uniquement en `'equipped'` avec une
relique réellement présente**. Une principale forcée ou `'libre'` contribue
0 au plancher : ni la présence d'une relique ni sa valeur en % ne sont
supposées. Une relique ne modifie jamais TC, DC, RES ou PRE.
Décision utilisateur, revue du 2026-09-23 ; l'hypothèse de disponibilité
des artéfacts du lot 3 ne s'étend pas aux reliques.

**Sortie :** `controle-4.md` avec le tableau des cinq valeurs × (avec /
sans relique), les valeurs mesurées, et le verdict. Plus, si correction, un
test nommé.

**Preuve :** le tableau mesuré · le test s'il y a correction ·
`node tests/run.mjs relic-queue relic-optim relic-search <nom>`.

**Ne fait pas :** ne touche pas `reliques.md` (propriété d'un autre chantier,
A.5) — le constat va dans `controle-4.md` et, s'il est normatif, dans
`spec/outils/optimizer.md § Conditions, inventaire et réglages avancés`.

#### Résultat du lot 4 — 2026-09-25

Le pilote valide le correctif `91837dab` et la preuve privée
`archive/controles-degats-aura-2026-09/controle-4.md`. Sur les cinq choix
de principale, avec et sans relique portée, seuls les trois cas « comme
équipé » avec une relique PV/ATQ/DEF à +8 % ajoutent respectivement
641 PV, 81 ATQ ou 57 DEF aux bases mesurées (8 001/1 001/701), en modes
total et bonus. Le test était rouge sur ces six lectures avant correction ;
les autres choix et l'absence de relique restent à zéro. Le moteur porte
déjà `relPctMax`/`relPctMin` et son `totalOf` utilise le même `ceil` sur la
somme des pourcentages de base ; ni moteur ni `reliques.md` n'ont changé.

Contrôles rejoués par le pilote : `node tests/run.mjs relic-queue relic-optim
relic-search artifact-relic-condition-floor` → 716 vérifications passées ;
`npx.cmd tsc --noEmit` → exit 0 ; `npm.cmd run build` → exit 0 (avertissement
préexistant du chunk principal > 500 kB) ; `node scripts/spec-lint.mjs` →
aucune erreur ; `git diff --check HEAD^ HEAD` → aucune erreur. Reçu
`chantier verifier` valide : code `91837da` ↔ notes `8b5ef2d` (277 fichiers) ;
notes intégrées et poussées sur le main documentaire `f2fb5c9`. Aucun rendu
en navigateur n'a été prouvé : le test exerce le calcul du plancher, pas le DOM.

### Lot 5 — le contexte de combat survit au changement de monstre

**Cat. J.** `resetSearch` (`useOptimizerState.ts` l. 382-416) fait
`setDamageSetup(DEFAULT_DAMAGE_SETUP)`. Le commentaire en place donne la
raison — `skillCom2usId` désigne un sort du monstre précédent — et elle est
**juste pour ce champ-là**, fausse pour le reste.

**Critère de la coupe : le sens métier**, pas le type TypeScript seul.
Le lot dresse la liste exhaustive des champs de `DamageSetup` et classe
chacun en contexte partagé, état propre au monstre/sort ou compatibilité.
Les champs ajoutés aux lots 6 à 10 complètent ce classement et ses tests.
Point de départ dans `DamageSetup` (`damage.ts` l. 3254-3432) :

- un champ **`Record<number, …>` clé par `skillCom2usId`** désigne un sort ou
  un passif d'un monstre précis → **réinitialisé** : `passifsOffensifs`,
  `statsCombatActives`, `coupsPersonnalises`, `stackPersonnalise`,
  `effetsCibleCount`, `buffsCibleCount`, `buffsPropresCount`,
  `buffsAlliesCount`, `compteurPersonnalise`, `effetsPropresCount`,
  `scenariosEffetsEntreCoups`, `pvActuelsAvantSacrificePct` ;
- `skillCom2usId` lui-même → **réinitialisé** ;
- tout **scalaire ou booléen de contexte** → **conservé** : `enemyDef`,
  `enemyHp`, `enemyHpPct`, `enemySpd`, `enemyAtk`, `enemyElement`,
  `aliveEnemies`, `ownHpPct`, `livingAlliesPct`, `atkBuff`, `defBuff`,
  `spdBuff`, `atkDebuff`, `defDebuff`, `spdDebuff`, `defBreak`, `brand`,
  `critMode`, `summonerSkills`, `leaderSkill`, les six effets d'équipe.

`defBreakParLeSort` et `sacrificeReservePct` sont propres au sort/monstre et
retombent au défaut ; `enemyHpNotDestroyed` et `velaskaPvPerduPct` décrivent
le contexte conservé. Les champs legacy et marqueurs de sémantique des
compteurs sont traités avec leur champ associé, jamais comme de nouveaux
réglages de contexte. Le lot documente chaque cas dans `optimizer.md`.

**Motif de remise à zéro obligatoire.** `App.tsx` appelle aussi
`resetSearch()` à l'import d'un compte : cet appel garde la réinitialisation
complète. Distinguer les actions ou leur motif explicite ; ne pas modifier
indistinctement tous les appelants. L'import de recette restaure la recette,
sans se faire écraser par une remise à zéro de changement d'espèce.

**Conservation en session, précisée par l'utilisateur le 2026-09-25 :** le
contexte se conserve en changeant d'espèce ou de liste de travail. Les
réglages propres au sort ne se vident qu'au choix d'une espèce différente
ou à l'import d'un nouveau compte. Changer d'exemplaire de même espèce,
créer/supprimer une liste ou naviguer entre listes ne change pas le sort
optimisé. L'import de compte garde la réinitialisation complète définie
ci-dessus.

**Sortie :** une table normative des champs et événements dans
`spec/outils/optimizer.md § Recherche du monstre à optimiser`.
Elle est accompagnée d'un test qui vérifie changement d'espèce, conservation
sur changement d'exemplaire et navigation de liste, choix d'un membre d'une
autre espèce, import de recette et import de compte. Le test protège cette
table, il ne remplace pas la spec. Les nombres d'auras dans l'équipe survivent
au changement de monstre ; le lot 7 éprouve leur interaction avec les sets
recherchés.

**Preuve :** le test · `npx tsc --noEmit` · `node tests/run.mjs <nom> degats optimizer-recipe-import-selection`.

**Ne fait pas :** ne touche pas aux autres réinitialisations de `resetSearch`
(`minStats`, `lockedRunes`, `lignesVerrouillees`, `objective`… — chacune a sa
raison écrite sur place, et aucune n'est visée par la demande).

#### Résultat du lot 5 — 2026-09-25

Le code `bed3818f` classe exhaustivement les champs de `DamageSetup`,
conserve le contexte au changement d'espèce et distingue l'import de compte
de l'import de recette. Le correctif pilote `09ca897d`, décidé avec
l'utilisateur, retire la remise à zéro superflue lors de la navigation entre
listes ou exemplaires de même espèce. Le choix d'une autre espèce, depuis le
bestiaire ou un membre de liste, garde le reset ciblé ; l'import de compte
garde le reset complet. La règle normative et l'invariant privé concordent
avec les chemins de l'écran. Preuve privée :
`archive/controles-degats-aura-2026-09/controle-5.md`, corrigendum pilote.
Le test nommé a échoué sur trois assertions avant le correctif, puis ses 22
vérifications sont passées ; 1 016 vérifications ciblées, `tsc`, build, lint
global et `git diff --check` passent. Le test lit les raccordements de l'écran
mais ne simule pas les clics dans un navigateur ; aucun benchmark n'a été
lancé.

### Lot 6 — sets d'aura : le modèle

**Cat. J.** Requiert les lots 2b et 5 — pas le lot 1 : les valeurs sont en
A.2 ter, et les nouveaux champs suivent la politique de réinitialisation.
**Contrat historique exécuté :** les mentions de `setsAura` et de B.0 dans
ce lot décrivent la règle en vigueur lors de sa livraison, désormais
remplacée par B.0 et 6bis. Ne pas le rejouer comme contrat actuel.

⚠️ **PV/ATQ/DEF : pourcentage de la statistique de BASE. RES/PRE : points
de pourcentage additifs** (A.2 ter). Pour deux effets : +16 % de base en
PV/ATQ/DEF ; +16 points de RES/PRE, même si la valeur de base est nulle.

**Modèle de données :** `DamageSetup.setsAura` (contrat B.0 à la date du lot 6), liste de `{ set: 'fight'|'determination'|
'enhance'|'accuracy'|'tolerance', nombre: 1..18 }` dans `DamageSetup` — un
nouveau champ, **optionnel** (compatibilité des recettes déjà exportées).
`nombre` est le **nombre total de sets dans l'équipe**, monstre optimisé
inclus. Ne jamais ajouter une seconde fois les sets du candidat à ce total.
Une seule entrée par set ; absence = 0. Les nombres doivent être entiers et
leur **somme ne dépasse pas 18**, tous types confondus (6 monstres × 3 sets,
source utilisateur en A.2 ter). Les recettes mal typées/hors bornes, y compris
une somme supérieure à 18, sont refusées avec le chemin du champ.
Le booléen `compterAurasResPre` (B.0) active ensemble RES et PRE dans les
conditions min/max ; défaut **activé**, conservant les défauts précédemment
prévus pour ces deux stats. Aucune option analogue pour PV/ATQ/DEF.
⚠️ **Champ optionnel = `tsc` ne verra jamais un oubli.** Skill
`optimizer-field-propagation` : le champ se propage à **tous** ses
constructeurs (`useOptimizerState`, `optimizerRecipe.ts`,
`scripts/lib/recipeToSearchParams.ts`, les scripts de diagnostic), et le lot
finit par un `grep -rn` du nom du champ sur `src/`, `scripts/` **et** `tests/`.

#### Chemins de calcul et preuves

1. **Dégâts, passifs et reliques.** `statsDebutCombat` (`damage.ts` l. 3768) est le
   point d'entrée : c'est déjà là que vivent l'invocateur et le lead, avec un
   **`ceil` unique** sur la somme des pourcentages de base. L'aura s'y ajoute
   comme un `extraBasePct` de plus — **jamais un second arrondi**. ⚠️ Gain
   collatéral : `relicExclusive.ts` l. 133 lit `statsDebutCombat` pour
   l'assiette `Y` des propriétés uniques, donc la demande « les effets d'aura
   entrent dans les stats de début de combat pour les reliques » est satisfaite
   **par construction**, sans second chemin. Le lot le **prouve** par un test,
   il ne le suppose pas.
2. **PV effectifs.** Vérifier puis corriger le chemin EHP : actuellement
   `objectiveScore('ehp')` appelle `pvEffectifs(stats)` sans passer par
   `statsDebutCombat`. Enhance et Determination doivent compter dans le
   score réel, le tri, la comparaison et le choix des artéfacts/reliques.
   Ce correctif ajoute les auras ; il ne change pas implicitement la politique
   des autres bonus de combat en EHP.
3. **Conditions min ET max, RES/PRE seulement.** Le même interrupteur ajoute
   `8 × nombre` aux deux statistiques pour les deux bornes. Désactivé, les
   conditions utilisent les stats sans ces auras. PV/ATQ/DEF restent toujours
   hors aura pour les conditions, même si elles comptent dans les scores.
   Ne pas modifier `computeStats` globalement : conserver les stats de fiche.
   Les bornes d'élagage, diagnostics et filtres finaux sur l'équipement réel
   doivent employer exactement la même convention. Ne pas écrêter les stats
   brutes à 100 dans le moteur ; les plafonds de saisie existants demeurent.

**Propagation à prouver :** tableau des consommateurs (sort actif, passifs,
additionnels, EHP, assiette des exclusives, recherche, diagnostics, sélection
finale artéfacts/relique, tri et comparaison), chacun avec son test. Les
signatures de cache qui dépendent du contexte incluent les nouveaux champs.
Les auras ne comptent qu'une fois sur chaque chemin ; désactiver leur prise
en compte dans les conditions ne les retire pas du calcul de dégâts/EHP.

**Sortie :** un test nommé par chemin (dégâts, EHP, exclusive de relique,
conditions min/max RES/PRE et absence d'effet sur les conditions PV/ATQ/DEF),
plus un test de compatibilité d'une recette sans les champs. Cas explicites :
RES/PRE de base 0, seuil min franchi, seuil max dépassé, toggle désactivé,
18 sets acceptés (type unique ou mélange), 19 refusés même répartis,
arrondi PV/ATQ/DEF avec lead/invocateur, parité écran/CLI et cache invalidé.
Si les élagages sont modifiés : `algo-verify`, contrôle différentiel contre
une référence exhaustive bornée et mesure ciblée, avant de valider le lot.

**Preuve :** les tests · `npx tsc --noEmit` · `node tests/run.mjs <noms> degats rune-optim relic-exclusive` ·
le `grep -rn` de propagation, sortie collée · passage CLI réel et checklist
documentaire de remplacement de B.0 dans sa version d'alors.

**Amendement obligatoire :** `invariants.md` l. 20 dit aujourd'hui que les
**cinq** réglages d'« État de mon monstre » « sont exactement les champs qui
modifient les stats propres du monstre ». Ce lot en ajoute un sixième :
l'invariant se corrige **dans le même commit** que la spec source.

**Ne fait pas :** aucun rendu (lot 7). Le champ du toggle et sa propagation
sont livrés ici ; son contrôle visuel est livré au lot 7.

#### Résultat du lot 6 — 2026-09-25

Le modèle des cinq auras est livré par `4f6ce326` ; `88d58019` complète
les preuves d'arrondi commun avec lead et invocateur et de choix effectif
entre deux reliques pour l'objectif PV effectifs. La preuve privée est
`archive/controles-degats-aura-2026-09/controle-6.md`. Le pilote a relu
les attentes chiffrées indépendantes et rejoué `node tests/run.mjs auras
degats rune-optim relic-exclusive` : **1 958 vérifications passées**.
`chantier verifier` confirme le reçu code `88d5801` ↔ notes `f10ade2` ;
les notes ont été intégrées au main documentaire en `e405061`.
La preuve initiale `controle-6.md` compte 1 940 vérifications sur ce filtre ;
les 18 assertions du complément `88d58019` expliquent les 1 958 du rejeu
pilote. Les deux comptes portent sur des révisions différentes.

Le contrôle différentiel couvre 12 petites recherches exhaustives ; le CLI
réel, tronqué à 100 000 builds, n'établit pas l'exhaustivité sur le compte.
Le rendu est réservé au lot 7 et `npm test` à la fusion sur main. Les deux
libellés d'Accuracy et Tolerance encore à « +10 % » sont attribués au lot 7.

**Correction décidée le 2026-09-25 :** ce résultat reste la preuve du modèle
livré alors. Sa convention « total d'équipe figé, candidat inclus » est
remplacée par le lot 6bis ; ni ses tests ni son reçu ne prouvent la nouvelle
convention. Le lot 7 attend donc 6bis.

### Lot 6bis — auras externes et activations propres par build

**Décision utilisateur du 2026-09-25 :** `setsAuraExternes` contient seulement
les auras des **autres** monstres de l'équipe. Pour chaque build, compter en
plus ses sets d'aura **réellement actifs** à partir de ses six runes avec
`activeSets`, y compris un set non demandé ou complété par Intangible.
`requirement.sets` est un minimum de recherche, pas un compteur d'auras.
Exemples obligatoires : 3 Fight externes + 2 Fight actifs = 5 ; si un build
active 3 Fight, le total vaut 6. Avec Rage seul demandé, 4 Rage + 1 Fight +
1 Intangible active Fight et reçoit aussi son +8 % ATQ de base.

**Volume commun :** la Partie A, `spec/outils/optimizer/invariants.md` et
`spec/outils/optimizer/README.md` représentent déjà environ 800 lignes,
avant B.0, les autres sections, la projection et le code. Chaque sous-lot
`6bis-a*` lit ce socle, B.0, le résultat du lot 6, le chapeau 6bis, la
section « Sets d'aura d'équipe — modèle » de
`spec/outils/degats-reels/effets-equipe-et-leaders.md`, puis les sections
d'aura ciblées de `spec/outils/optimizer.md` (`spec-toc` d'abord).

**Politique de lecture décidée le 2026-09-27 pour les lots restants :**
**2 500 lignes utiles sont un repère d'alerte, pas un plafond ni une cause
d'arrêt automatique**. Ce chiffre réserve une marge au socle documentaire
(environ 1 000 lignes), aux fenêtres de code, aux appels adjacents et aux
sorties ; il ne prétend mesurer ni la capacité du modèle ni des tokens. Les
anciens budgets de 1 500/1 600/1 700 lignes restent les repères historiques
des tentatives déjà terminées ou suspendues. L'agent compte **toutes ses
lectures de travail** (documents, contrat, preuves, code, recherches et
sorties), y compris une sortie tronquée puis relue, et donne le total réel
dans sa preuve. `CLAUDE.md` et les skills chargés comme instructions ne sont
pas des intrants de classification.

Dimensionner les sorties **avant** lecture et ouvrir les gros intrants en
plages bornées : une troncature appelle une relecture ciblée de la partie
manquante, jamais l'omission de celle-ci. Si le repère de 2 500 est franchi,
continuer les lectures indispensables, consigner le dépassement et sa cause,
et préserver la preuve par clé. Scinder seulement si le périmètre réel ou la
capacité à vérifier les verdicts exige deux travaux autonomes ; le simple
compteur de lignes ou une troncature d'outil ne suffit pas. Ne pas ouvrir
entiers `damage.ts`, `runeBuildOptim.ts` ou `OptimizerSection.tsx`.

#### 6bis-a1 — inventaire et fixtures, sans classification de code

**Cat. C.** Requiert 6. Lire la Partie A, puis en entier
`spec/outils/optimizer/invariants.md` et `spec/outils/optimizer/README.md` ;
lire B.0, le résultat du lot 6 et les points **1 et 2 du lot 7** (actuellement
l. 1708–1732, de « Ajouter / visualiser / supprimer » jusqu'avant le point 3).
`spec-toc` repère le lot 7, pas ses items de liste : relever de nouveau cette
plage si le cadrage bouge. Lire aussi la seule section « Sets d'aura d'équipe —
modèle » de `spec/outils/degats-reels/effets-equipe-et-leaders.md`, les sections
d'aura ciblées de `spec/outils/optimizer.md`, ainsi que la recette et les noms
de tests de
`spec/outils/optimizer/archive/controles-degats-aura-2026-09/controle-6.md`.
Ne pas lire la preuve entière sans besoin. Consigner les longueurs exactes
et les plages réellement consultées, budget commun ci-dessus compris.

**Extraction :** depuis un worktree propre, lancer les deux commandes
ci-dessous. Si `rg` manque dans la session, utiliser les deux commandes
`git grep` équivalentes ; noter l'outil, la commande et la sortie réellement
utilisés. Au 2026-09-25, le repli `git grep` a donné 46 lignes et 41 chemins
dans une session sans `rg` ; les remesurer, pas les supposer.

```text
rg -n 'setsAura|nombreAura|pointsAuraResPre|auraResPre' src scripts tests
rg -l 'activeSets|pvEffectifs|objectiveScore' src scripts tests
git grep -n -E 'setsAura|nombreAura|pointsAuraResPre|auraResPre' -- src scripts tests
git grep -l -E 'activeSets|pvEffectifs|objectiveScore' -- src scripts tests
```

**Sortie :** dans le dossier privé A.6 bis, `manifest-6bis-a1.json` inventorie
chaque occurrence et chemin
détecté (fichier, ligne ou fonction, motif, source de découverte), puis
propose une affectation **provisoire** à a2, a3 ou a4, ou un rejet motivé.
Ajouter les candidats connus de B.0, de l'écran/Worker/CLI et des caches
même s'ils échappent aux deux motifs. Ne pas déclarer « consommateur » sur
la seule présence d'un mot. Le pilote remplace les contrats des cartes par
des sous-lots bornés et les fait revoir **avant a2a1**.
Créer dans ce même dossier `recette-6bis-externe.json` avec 3 Fight externes
et Rage seul demandé, et `recette-6bis-ancienne-non-vide.json` portant
l'ancien `setsAura` non vide ; conserver leurs empreintes, le compte de test
et la commande du CLI réel pour a4b et 6bis-b.
Le parseur actuel accepte une clé inconnue `setsAuraExternes` et le code
de calcul l'ignore : inscrire cet état **rouge**, sourcé par les chemins de
code, sans appeler la recette neuve un succès. Aucune sortie verte anticipée.

**Preuve :** `controle-6bis-a1.md` avec commandes, sorties, décompte des
lectures, manifeste, empreintes et code cité ; `node scripts/spec-lint.mjs`
et `git diff --check`. Livraison et vérification privées selon A.6 bis.
**Ne fait pas :** aucune classification approfondie de consommateur,
modification de production, test nouveau ou benchmark.

**Résultat pilote du 2026-09-25 :** les deux extractions au repli `git grep`
retrouvent 46 lignes et 41 chemins. Le manifeste affecte provisoirement
chaque entrée à a2, a3 ou a4 et ajoute 17 candidats hors motifs ; deux lignes
de `damage.ts` ont légitimement un double usage score/conditions. Les recettes
figées prouvent l'état rouge par le code : le nouveau champ est accepté comme
clé inconnue mais ignoré par le calcul ; l'ancienne recette non vide reste
acceptée. Le sort de la clé inconnue après reconstruction du parseur sera
qualifié en **a4a**. Le « compte de test » désigne le fichier de compte pour le
CLI réel ; les 117 vérifications du filtre `auras` sont un décompte distinct.
La recette ancienne non vide, identique à celle du lot 6, est conservée comme
fixture historique de régression, sans prétendre être un nouveau scénario.
La vérification isolée par `node --eval`, contraire à `CLAUDE.md`, a été
réintégrée au script conservé avant validation ; aucune décision n'en dépend.
`controle-6bis-a1.md` et son manifeste corrigé ont été livrés puis vérifiés
(`948066b` ↔ `87d09ec`), et les notes validées intégrées au main documentaire
en `f52f3ee`. Aucun code de production ni test n'a changé ; a2–a4 restent
non lançables avant inscription et revue de leurs plages exactes. La mention
erronée de `pair-slice-worker.ts` dans `invariants.md` sera corrigée au lot 14
avec la réconciliation finale des notes.

#### Contrat commun de 6bis-a2a1-contexte à 6bis-a4d2 — fenêtres mesurées après a1

**Amendement pilote du 2026-09-25 : contre-vérification indépendante favorable
le 2026-09-26, puis précisions de budget et de périmètre du pilote.** Le manifeste a1 est à
`spec/outils/optimizer/archive/controles-degats-aura-2026-09/manifest-6bis-a1.json`
(SHA-256 `23e107ace593dd322e8343f778fdd21e7c66c3d92f05684cbcbe547eb758f65d`).
L'outil privé `projeter-6bis.mjs` du même dossier vérifie cette empreinte et
répartit les entrées **sans décision de mécanique** : `node
spec/outils/optimizer/archive/controles-degats-aura-2026-09/projeter-6bis.mjs
--lot <suffixe>` émet une ligne JSON par entrée du seul sous-lot ; `--bilan`
vérifie l'union, les doublons permis et les entrées différées. La projection
est un intrant lu et compté ; ne pas lire les 1 146 lignes du manifeste
comme de la prose. Les affectations a1 restent provisoires quant au
**verdict**, non quant à la propriété des clés dans les cartes.
Pour le budget de lecture, chaque projection JSONL compte pour le maximum
entre son nombre d'enregistrements et `ceil(octets UTF-8 / 80)` lignes
équivalentes ; une longue ligne JSON ne réduit pas artificiellement le volume.
Une clé stable vaut `A:<fichier>:<ligne>`, `B:<chemin>`,
`H:fichier:<chemin>`, `H:champ:<type.champ>`, `H:cache:signatureArtefacts`
ou `H:document:<référence source>` ; une découverte supplémentaire vaut
`D:<source>:<coordonnée>`. Les deux lignes partagées de `damage.ts`
L3785–3786 apparaissent en a2a1-contexte (`usage: score`) et a3a (`usage:
conditions`) : deux verdicts sous `(clé, usage)`, mais une seule ligne A
d'origine chacune. Les deux H documentaires dont `vers` est vide sont
`differe` dans le bilan : l'invariant et la spec source relèvent des futurs
6bis-b-*, pas d'une carte de code ; a4d2 les réconcilie séparément.
Chaque carte porte clé, verdict sourcé (consommateur / non-consommateur /
incertain), `usage` (`score` ou `conditions` pour les deux lignes partagées),
fonction, six runes connues ou non, provenance des auras, cache,
test existant ou à créer, et une `synthese` de 12 lignes au plus pour le lot
suivant ; cette compacité ne retire aucune décision de la carte complète.
Une clé d'origine a un seul propriétaire dans les cartes, fixé par la
projection ; les suivantes la référencent sans recopier son verdict. Les
clés A/B/H actives se réconcilient en a4d2 par égalité, pas par total ; les
deux H différées et les deux usages supplémentaires sont comptés à part.

Les plages ci-dessous sont **inclusives**, relevées au HEAD `b2ccfca1` ; un
lot les recontrôle sur sa révision. Son socle documentaire : Partie A et
B.0 en entier, « Résultat du lot 6 », le chapeau du lot 6bis, cette
section, `invariants.md` et le README de routage en
entier, `spec/outils/degats-reels/effets-equipe-et-leaders.md` L88–120 et
`spec/outils/optimizer.md` L680–687 et L1319–1324. Ces coordonnées de
cadrage se relèvent par `spec-toc` à chaque lot. Le lot lit
sa projection compacte du manifeste et **ses** fenêtres de code — jamais
les fichiers entiers. La somme prévisionnelle des fenêtres de code de chaque
sous-lot est inférieure à 450 lignes ; compter aussi la projection, toutes
les lectures documentaires, cartes antérieures et sorties selon la politique
du chapeau 6bis. Les fenêtres sont des amorces de chaîne d'appel, pas le droit
d'omettre un appel adjacent : le lire et le compter même si le repère de
2 500 lignes est franchi. Chaque preuve donne les plages réellement lues,
le total, l'éventuel dépassement et les découvertes hors manifeste.
Ne pas relire le contrat a1 historique : sa synthèse dans le cadrage suffit.
Une sortie tronquée puis relue compte **deux fois** ; dimensionner la sortie
ou lire en plages plus petites dès le premier essai.
Rejouer `node spec/outils/optimizer/archive/controles-degats-aura-2026-09/valider-fenetres-6bis.mjs` :
sommes inclusives attendues a2a1-contexte/a2a1-suite/a2a2/a2b/a2b1/a2b2/
a2b3/a3a/a3b/a4a/a4b/a4c1/a4c2/a4d1/a4d2 =
136/194/159/386/178/123/259/375/411/371/299/231/186/336/0 lignes
de code et de tests ciblés (a2b3 : 85 + 174), avec existence des fichiers et
des bornes vérifiée. a2b garde l'inventaire historique des 386 lignes ; seuls
a2b1, a2b2 et a2b3 s'exécutent. Le contrôle affiche une estimation au repère
de 2 500 lignes mais **n'échoue pas** sur ce seul compte. Il ne remplace pas
le décompte **réel et total** de lecture de chaque lot.

**Preuve commune :** un `carte-6bis-<sous-lot>.json` et un
`controle-6bis-<sous-lot>.md` dans le dossier privé A.6 bis, avec commandes,
sorties et verdicts par clé ; `node scripts/spec-lint.mjs`, `git diff
--check`, `chantier livrer` puis `verifier`. Une carte peut conclure « non
consommateur » : la présence d'`activeSets` dans un import ou un test ne
prouve aucune consommation d'aura. Aucun de ces sous-lots ne modifie le
code de production, les tests ou la règle de jeu.

#### 6bis-a2a1 — tentative interrompue, sans livrable

Le premier lancement n'a produit ni carte, ni preuve, ni reçu. Ses lectures
ne sont pas une source pour les sessions fraîches. Le contrat est remplacé
par les deux sous-lots ci-dessous ; ne pas le relancer tel quel.

#### 6bis-a2a1-contexte — champs et stats de début de combat

**Cat. C ; requiert a1 et la scission pilote validée.** Projection
`projeter-6bis.mjs --lot a2a1-contexte` : **11 clés** (9 A, 1 B, 1 H).
Fenêtres : `src/lib/damage.ts` L3309–3321, L3433–3441, L3503–3515,
L3745–3790 ; `src/lib/stats.ts` L49–103. Classer les champs d'aura de
`DamageSetup` et leur défaut, `nombreAura`, `statsDebutCombat` et les stats de
fiche. Prouver l'assiette et l'arrondi ; ne pas attribuer des auras d'équipe
à `computeStats` par analogie. Pour la clé B de `stats.ts`, classer le fichier
sur les usages vus dans cette fenêtre, et nommer toute limite de portée.

**Sortie :** `carte-6bis-a2a1-contexte.json` et
`controle-6bis-a2a1-contexte.md`, avec une synthèse de 12 lignes au plus.
**Ne fait pas :** chaîne `computeTotalDamage`, score, conditions ou CLI.

**Résultat du lot 6bis-a2a1-contexte — 2026-09-26.** Le pilote valide la carte
privée corrigée : les 11 clés projetées sont couvertes (9 A, 1 B, 1 H), avec
6 lectures effectives d'aura, 2 points de propagation et 5 non-consommateurs
(dont ces 2 points), sans incertitude. L'assiette PV/ATQ/DEF est la stat de
base, dans un `ceil` commun avec l'invocateur et le lead ; RES/PRE ajoutent
8 points par set. `computeStats` ne lit pas d'aura dans la fenêtre examinée.
L'ancien défaut `setsAura: []` ne crée pas le nouveau défaut de
`setsAuraExternes`, encore à implémenter. Les tests cités sont des candidats,
pas une couverture vérifiée. Le validateur de carte, celui des fenêtres,
`spec-lint` et `git diff --check` passent ; reçu vérifié `c09a516` ↔
`7dffbbc`, notes intégrées. La preuve conserve le dépassement de lecture
déclaré (environ 85 lignes, dû aux sorties annexes) ; aucune fenêtre prescrite
n'a été omise ni tronquée. `computeTotalDamage`, les caches et les autres
consommateurs restent à classer dans les sous-lots numérotés suivants.

#### 6bis-a2a1-suite — chaîne des dégâts

**Cat. C ; requiert a2a1-contexte.** Lire sa synthèse structurée ; interroger
sa carte par clé si nécessaire, sans charger sa preuve entière comme prose.
Compter ces sorties. Projection `projeter-6bis.mjs --lot a2a1-suite` :
**1 clé B**, `B:src/lib/damage.ts`. Fenêtres : `src/lib/damage.ts`
L4690–4699 et L4744–4927 (**194 lignes**, fin de `computeTotalDamage`
incluse). Examiner les appels adjacents nécessaires en les comptant avant
lecture. Classer la clé B et établir la chaîne contexte → dégâts actifs,
passifs et additionnels ; distinguer les appels qui ne reçoivent que des
stats. La synthèse relie les 11 verdicts du lot précédent au dernier,
**sans les recopier ni les modifier**. Une divergence rouvre a2a1-contexte.

**Sortie :** `carte-6bis-a2a1-suite.json` et
`controle-6bis-a2a1-suite.md`, puis synthèse combinée pour a2a2. Les
**12 clés** de la projection initiale doivent être présentes une seule fois
dans l'union des deux cartes, vérifiée par comparaison des clés et non par
le seul total. **Ne fait pas :** sets des six runes, score, choix de
paire/relique, conditions ou CLI.

**Résultat provisoire du 2026-09-26 :** carte et contrôle privés livrés, reçu
vérifié `12b7d05` ↔ `6d9b556`, notes intégrées. L'égalité des 12 clés passe,
mais elle ne vérifie ni le sens du verdict ni la chaîne de calcul. Le lot
reste **non validé** jusqu'au correctif nommé ci-dessous ; a2a2 attend.

#### 6bis-a2a1-suite-correction-stats-chain — contenu et preuve de la carte

**Cat. C ; requiert a2a1-suite et a2a1-contexte.** Scission décidée après
l'arrêt du correctif initial à **1 209 lignes de noyau sur 1 500** : les 291
lignes restantes ne suffisaient pas à la contre-lecture et aux preuves. Ce
lot dispose d'un budget neuf de **1 700 lignes utiles**, exceptionnellement
plus large que le plafond prévisionnel commun de 1 500 : socle documentaire
commun (~1 000 lignes), carte/contrôle/validateur existants (~100), fenêtres
de code ciblées (~220) et sorties de contrôle à compter. Mesurer chaque lecture,
y compris une sortie tronquée puis relue ; si 1 700 ne suffit pas, arrêter et
demander une nouvelle scission, sans omettre de branche.

**Intrants bornés :** socle documentaire du contrat commun ; synthèse de
`carte-6bis-a2a1-contexte.json`, puis les seuls
`carte-6bis-a2a1-suite.json`, `controle-6bis-a2a1-suite.md` et
`verifier-union-6bis-a2a1.mjs` du dossier privé A.6 bis. À partir du HEAD
réel, recontrôler et lire dans `src/lib/damage.ts` les fenêtres inclusives
L3645–3661, L3715–3728, L3768–3788, L3807–3828, L3951–3964,
L4049–4062, L4091–4105, L4498–4506, L4568–4579, L4690–4699,
L4751–4761, L4806–4825, L4833–4844, L4886–4904 et L4920–4928
(**219 lignes** au HEAD `12b7d05`). Une ligne adjacente nécessaire se
compte avant lecture ; ne pas relire tout `computeTotalDamage`.

**Contrat exact :** corriger la clé `B:src/lib/damage.ts` sans toucher aux 11
clés du contexte. `computeTotalDamage` reçoit `StatRow[]` et `DamageSetup` :
ne pas présenter ces `stats` comme des statistiques de combat déjà calculées.
Tracer séparément son appel à `computeSkillDamageDetail`, puis
`statsDeCombat` → `statsDebutCombat`, pour le sort, les passifs et les lignes
additionnelles 218–221, en citant la lecture effective des valeurs. Examiner
à part `defCombat` et `atkCombatComplet`, appelés depuis le calcul total mais
ne passant pas par cette chaîne ; conserver leur effet éventuel sur les auras
comme **écart à qualifier** dans un champ `ecarts` distinct des 12 clés
projetées, repris par a4d2 puis les contrats 6bis-b-*, sans inventer une
correction de règle de jeu. Garder `verdict` dans l'énumération du contrat
commun et `role` dans `lecture | propagation | aucun` : la clé B est un
consommateur au niveau du fichier, tandis que l'orchestrateur délègue la
lecture d'aura à ses appelés. La synthèse destinée à a2a2 distingue ce fait
des deux chemins séparés, sans attribuer la résolution à un appelant non lu.

**Sortie :** carte et contrôle a2a1-suite corrigés ; validateur d'union
renforcé pour vérifier aussi les champs sémantiques de la clé B, et non les
seules 12 clés ; `controle-6bis-a2a1-suite-correction-stats-chain.md` avec
les plages et le décompte des lectures. Corriger dans la preuve initiale son
en-tête selon A.6 bis et ajouter une rectification datée avec **commande
exacte + sortie complète collée + conclusion** pour chaque contrôle rejoué ;
ne pas présenter une sortie actuelle comme sortie historique du premier lot.
La nouvelle preuve suit le même format ; les contrôles pré-livraison y
précèdent le reçu, inscrit par
le pilote dans le résultat public après `livrer` puis `verifier`.

**Preuve :** projection a2a1-suite et validation des fenêtres d'origine,
validateur du contexte, validateur d'union renforcé (12 clés et assertions
sémantiques, avec mutation négative), `node scripts/spec-lint.mjs` et
`git diff --check`, commandes et sorties complètes dans la preuve privée.
Notes seules : `livrer` → `verifier` → `integrer` depuis l'installation après
validation. **Ne fait pas :** aucun code de production, test, chiffre de jeu,
set de rune, score ou règle de condition ; ne touche pas au cadrage public.

**Résultat provisoire du 2026-09-26 :** budget de 1 700 lignes dépassé après
deux sorties tronquées puis relues. La carte B et le validateur d'union ont
été modifiés localement : 12 clés et mutation négative passent. Le contrôle
initial garde toutefois son faux verdict et son mauvais en-tête ; aucune
preuve complète n'a été produite. Ces notes restent **un brouillon non validé**,
même si elles sont sauvegardées par une livraison de cadrage intermédiaire.
La reprise se limite au sous-lot suivant ; a2a2 demeure bloqué.

#### 6bis-a2a1-suite-finalisation-preuve — preuve et livraison du correctif

**Cat. C+M ; requiert le correctif stats-chain interrompu.** Budget neuf de
**1 600 lignes utiles**, sorties et relectures comprises. Le socle commun
reste obligatoire ; le travail propre à ce lot est limité aux trois fichiers
privés déjà modifiés (`carte-6bis-a2a1-suite.json`,
`verifier-union-6bis-a2a1.mjs`, `controle-6bis-a2a1-suite.md`), à la synthèse
de la carte contexte et à la présente section. Le pilote a comparé ces trois
fichiers par SHA-256 le 2026-09-26 : leurs copies privées locales sont
**identiques** à celles de
`C:/Users/Enzo/Desktop/sw-forge-docs-chantiers/degats-et-aura`
(branche `chantier/degats-et-aura`) ; les deux premiers diffèrent de
`C:/Users/Enzo/Desktop/sw-forge-docs` (branche `main`), où ils ne sont pas
encore intégrés. Ne pas prendre ce `main` pour le brouillon ni refaire cette
comparaison sans changement constaté. Ne pas réécrire les 11 clés de contexte.
**Ne pas rouvrir les 219 lignes** du lot
précédent : contrôler seulement les citations utiles dans `damage.ts`
L3647–3655, L3719–3724, L3768–3788, L3807–3818, L4049–4057,
L4092–4103, L4500–4504, L4690–4694, L4755–4759, L4813–4822,
L4840–4841 et L4892–4901 (**106 lignes inclusives** au HEAD `049ceac`).
Une plage nécessaire en plus se compte avant lecture ; aucune sortie tronquée
n'autorise à ignorer son contenu.

**Contrat :** confirmer ou corriger les citations de la carte B et les deux
`ecarts` sans décider de nouvelle règle de jeu. Conserver le validateur
sémantique et prouver qu'une altération du verdict est rejetée. Corriger
`controle-6bis-a2a1-suite.md` : en-tête exact d'A.6 bis, verdict historique
explicitement **invalidé**, verdict corrigé visible avant l'historique, puis
rectification datée avec commande exacte, sortie complète collée et conclusion
pour chaque contrôle rejoué. Ne pas attribuer au premier reçu une sortie
obtenue aujourd'hui. Créer
`controle-6bis-a2a1-suite-finalisation-preuve.md` au même format avec le
décompte intégral des lectures et les éventuelles limites non prouvées.

**Preuve et sortie :** projection, validateur des fenêtres initiales, carte
contexte, union des 12 clés, mutation négative, `node scripts/spec-lint.mjs`
et `git diff --check` ; chaque commande avec sa sortie et son code de sortie
dans la preuve privée. Les notes ne deviennent validables que si la carte, le
validateur et **les deux contrôles** concordent. Alors seulement : `livrer` →
`verifier` → `integrer` depuis l'installation ; le pilote inscrit le reçu
dans le résultat public et libère a2a2. Si le budget manque encore, arrêter
avant livraison et indiquer quelles lignes sont nécessaires. **Ne fait pas :**
aucun code de production, test, benchmark ni cadrage public ; ne relance pas
la classification générale du lot 6bis.

**Tentative de reprise du 2026-09-26 :** aucun fichier modifié, aucun contrôle
rejoué ni reçu créé. Deux sorties de lecture tronquées puis reprises ont
consommé le budget de 1 600 lignes. Aucun nouvel intrant nécessaire n'a été
nommé : il s'agit d'un échec de conduite des lectures, pas d'une preuve que
le contrat dépasse le budget. La prochaine session reprend ce même sous-lot
avec un budget neuf ; elle borne chaque sortie avant l'appel et compte toute
relecture. a2a2 reste bloqué jusqu'aux preuves complètes et à leur validation.

**Résultat du 2026-09-26 :** l'agent a corrigé le verdict historique dans
`controle-6bis-a2a1-suite.md`, vérifié les 106 lignes contractuelles plus
L4902, confirmé les deux `ecarts` et rejoué les sept contrôles à code de
sortie 0. Le pilote les a rejoués, puis a corrigé deux erreurs de preuve
dans `controle-6bis-a2a1-suite-finalisation-preuve.md` : la projection de
180 octets vaut **3 lignes équivalentes**, pas 1 ; le delta de noyau
`1209 → 1228` provient des **14 lignes ajoutées à la Partie A** et des
**5 lignes ajoutées au contrat a2a1-suite**, pas de la carte privée.
L'agent n'avait pas lu les 401 lignes obligatoires du socle documentaire ;
le pilote les a lues séparément et a consigné cette dérogation, sans lui
attribuer cette lecture ni modifier sa mesure de budget. La lecture
adjacente de `damage.ts` L4492–L4504 confirme aussi l'attribution des codes
218–221 aux valeurs de combat. Aucun code de production ni règle de jeu n'a
changé. `chantier livrer` puis `verifier` : reçu **valide**, code
`57a7c28` ↔ notes `ab0fb25` ; `integrer` a avancé le main documentaire
`e54e122 → 675626f` et l'a poussé sur `origin/main`. Les deux fichiers de
preuve sont conservés. La finalisation est validée et **a2a2 est libéré**.

#### 6bis-a2a2 — sets actifs du build et score

**Cat. C ; requiert a2a1-suite-finalisation-preuve validé.** Lire sa
synthèse combinée corrigée, puis :
`src/lib/runeBuildOptim.ts` L733–807, L3965–4005 ;
`src/lib/effects.ts` L303–345. Classer EHP, score et résolution
d'`activeSets` sur les six runes ; distinguer build concret et borne sur
un demi-build. Conserver la politique EHP préexistante hors auras.

**Sortie :** carte a2a2 et chaîne runes → sets actifs → score, avec
renvoi au contexte a2a1. **Ne fait pas :** choix de paire/relique, tri,
conditions ou CLI.

**Résultat du 2026-09-26 :** les quatre clés de
`carte-6bis-a2a2.json` égalent la projection (4 entrées, 1 210 octets,
16 lignes équivalentes). `valider-fenetres-6bis.mjs` retrouve les trois
plages et 159 lignes ; le vérificateur privé conservé
`verifier-carte-6bis-a2a2.mjs` rend `RÉSULTAT : OK` (aucune omission,
substitution ou duplication). Le pilote a lu en plus L808 de
`src/lib/runeBuildOptim.ts` : le `return` consomme les `hp`/`def` enrichis
aux lignes 801 et 802.
La chaîne six runes → `activeSets` existe, mais ne rejoint pas le score EHP :
elle vérifie seulement les sets demandés. Aucun code ni test n'a changé.
L'agent a déclaré 1 579/1 500 lignes lues, deux `node -e` et l'absence de
relecture de `CLAUDE.md` ; ces écarts de méthode ne sont pas effacés par la
contre-vérification pilote. `node scripts/spec-lint.mjs` : aucune erreur ;
`git diff --check` : aucune sortie. Preuve privée :
`archive/controles-degats-aura-2026-09/controle-6bis-a2a2.md`.
La rectification a été livrée puis vérifiée : reçu valide, code `4816082` ↔
notes `1d20a54` (304 fichiers). `chantier integrer` a avancé le main
documentaire `4322036 → ffa8991` et l'a poussé. Sa marge prévisionnelle de
53 lignes motive la scission de a2b ci-dessous, avant son lancement.

#### 6bis-a2b — découpage des choix d'artéfacts et de relique

**Scission pilote avant exécution, le 2026-09-26.** L'ancien contrat réunissait
386 lignes de fenêtres de code et ne laissait que 53 lignes de marge
prévisionnelle sur 1 500, avant les appels adjacents et les tests. Les trois
sous-lots ci-dessous se partagent ses fenêtres sans perte : **178 + 123 + 85
= 386 lignes**. L'inventaire historique que contrôle encore
`valider-fenetres-6bis.mjs` est :
`src/lib/artifactEvaluation.ts` L85–158 ; `src/lib/relicExclusive.ts`
L117–150 ; `src/lib/relicQueue.ts` L138–205 ; `src/lib/relicOptim.ts`
L190–210 ; `src/lib/runeBuildOptim.ts` L848–870 et L930–959 ;
`src/lib/artifactQueue.ts` L190–214 et L280–305 ;
`scripts/lib/relicDifferentiel.ts` L115–143 et L162–173 ;
`scripts/lib/relicOracle.ts` L141–157 et L175–201.
Ce bloc commun n'est **plus un lot exécutable**. Chacun des trois sous-lots
lit le socle du contrat commun, puis seulement ses fenêtres et la synthèse de
son prédécesseur. À chaque session, recontrôler les numéros de ligne au HEAD
et dimensionner les sorties. Un appel adjacent nécessaire se lit même au-delà
du repère d'alerte ; ni une fenêtre ni une preuve ne se tronquent.

`projeter-6bis.mjs --lot a2b` émet **8 clés** : 7 B et 1 H. Chaque sous-lot
rejoue cette projection compacte, ne classe que les clés qui lui sont
attribuées ci-dessous et mentionne les autres sans leur donner de verdict.
La somme des trois cartes, non chacune isolément, doit être égale à cette
projection, clé par clé. `valider-fenetres-6bis.mjs` garde sa mesure de 386
lignes pour **l'union** des fenêtres ; les comptes propres aux sous-lots
figurent dans leurs preuves. Le contrat commun de preuve, de livraison et de
non-modification du code s'applique à chacun.

#### 6bis-a2b1 — paire d'artéfacts et cache

**Cat. C ; requiert a2a2.** Lire les synthèses combinées a2a1-suite et a2a2.
Classer uniquement `B:src/lib/artifactEvaluation.ts` et
`H:cache:signatureArtefacts`. Fenêtres :
`src/lib/artifactEvaluation.ts` L85–158 ; `src/lib/runeBuildOptim.ts`
L848–870 et L930–959 ; `src/lib/artifactQueue.ts` L190–214 et L280–305,
soit **178 lignes inclusives**. Suivre les appels adjacents nécessaires en
les comptant avant lecture. Distinguer la paire essayée du build finalement
rendu, son score, le tri/comparaison et les dépendances de sa signature de
cache. Une référence à la relique ne donne pas ici de verdict sur ses clés.

**Sortie :** `carte-6bis-a2b1.json`, `controle-6bis-a2b1.md`, synthèse de 12
lignes au plus pour a2b2. **Ne fait pas :** exclusive ou sélection finale de
relique, scripts/tests du manifeste, conditions, diagnostics ou CLI.

**Tentative suspendue du 2026-09-27 :** branche, HEAD et worktree initiaux
conformes ; deux sorties de lecture tronquées puis reprises ont épuisé la
marge sous l'ancien seuil de 1 500. Aucun verdict, carte, preuve, reçu ou
intégration n'en résulte. La pause est enregistrée. **Reprendre ce même lot**
avec la politique du 2026-09-27, sans créer un a2b1 supplémentaire ; les
lectures de la tentative suspendue ne constituent pas une preuve à réutiliser.

**Résultat du lot 6bis-a2b1 — 2026-09-27.** Les deux clés sont classées
« consommateur », chacune dans son rôle : `artifactEvaluation.ts` note les
paires essayées avec le `DamageSetup` courant, tandis que
`signatureArtefacts` sérialise ce contexte pour invalider le cache. Le build
final reprend les stats de la paire retenue puis est retrié ; la clé de build
encode séparément les six identifiants de runes. **Aucun de ces chemins ne
déduit encore les auras propres des sets actifs des six runes** : ce constat
reste une obligation des futurs 6bis-b-*, pas une couverture acquise. La
preuve `controle-6bis-a2b1.md` et la carte du même nom sont livrées sous le
reçu valide code `e5d785f` ↔ notes `9c2e357`, intégré au main documentaire
`ea836f6`. Le contrôle des 178 lignes prescrites, la projection des deux clés,
`spec-lint` et `git diff --check` ont été rejoués. La lecture réelle est
estimée à 3 800 lignes équivalentes, au-dessus du repère indicatif de 2 500 ;
les troncatures et relectures sont décomptées. Pas de test ni benchmark pour
ce lot de classification. a2b2 est libéré ; les clés de relique n'ont pas de
verdict ici.

#### 6bis-a2b2 — exclusive et sélection de relique

**Cat. C ; requiert a2b1.** Lire sa synthèse, et la carte a2b1 uniquement
pour suivre une clé citée. Classer uniquement `B:src/lib/relicExclusive.ts`
et `B:src/lib/relicOptim.ts`. Fenêtres : `src/lib/relicExclusive.ts`
L117–150 ; `src/lib/relicQueue.ts` L138–205 ; `src/lib/relicOptim.ts`
L190–210, soit **123 lignes inclusives**. Relier l'assiette des exclusives,
le score EHP et la relique effectivement retenue au build rendu ; distinguer
un essai de la sélection finale. Toute nouvelle branche d'appel indispensable
est lue et décomptée, jamais supposée. Ne pas attribuer un verdict aux scripts
ou aux tests simplement parce qu'ils appellent ces fonctions.

**Sortie :** `carte-6bis-a2b2.json`, `controle-6bis-a2b2.md`, synthèse de 12
lignes au plus pour a2b3. **Ne fait pas :** modifier la règle de jeu,
conditions, diagnostics ou CLI.

**Résultat du lot 6bis-a2b2 — 2026-09-27.** Les deux clés sont classées
« consommateur » avec des portées distinctes. `relicExclusive.ts` calcule
l'assiette `Y` sur les stats du build incluant la principale de la relique
essayée, puis `statsDebutCombat` lit le `DamageSetup` actuel.
`relicOptim.ts` ne lit ni les auras ni les six runes directement : il compare
les notes des couples faisables transmises par l'appelant ; la file reprend
ensuite la relique et la paire retenues pour les stats, le tri et le rendu.
Les auras propres issues des six runes ne sont pas encore ajoutées au contexte.
La carte et `controle-6bis-a2b2.md` portent ces chemins, la projection des
huit clés et la vérification des 123 lignes prescrites. `spec-lint`,
`git diff --check` et le reçu code `0a512eb` ↔ notes `4e46068` ont été
rejoués ; les notes sont intégrées au main documentaire `9ea0220`.
La lecture totale est estimée à 4 500 lignes équivalentes, au-dessus du repère
indicatif de 2 500, avec les appels adjacents et relectures décomptés. Aucun
test ni benchmark dans ce lot de classification. a2b3 est libéré ; ses quatre
clés de scripts et tests attendent encore leur verdict.

#### 6bis-a2b3 — scripts, tests et réconciliation

**Cat. C ; requiert a2b2.** Lire les deux synthèses précédentes et classer
uniquement `B:scripts/lib/relicDifferentiel.ts`,
`B:scripts/lib/relicOracle.ts`, `B:tests/relic-exclusive.test.ts` et
`B:tests/relic-oracle.test.ts`. Fenêtres de scripts :
`scripts/lib/relicDifferentiel.ts` L115–143 et L162–173 ;
`scripts/lib/relicOracle.ts` L141–157 et L175–201, soit **85 lignes
inclusives**. Pour les tests, chercher d'abord les appels ciblés, puis lire
les seules fenêtres utiles : `tests/relic-exclusive.test.ts` L35–40,
L145–160 et L180–260 ; `tests/relic-oracle.test.ts` L1–10, L50–75,
L116–138 et L240–251
(**174 lignes inclusives au plus** avant recontrôle au HEAD). Les tests sont
des **candidats**, pas une preuve de couverture avant lecture de leurs
assertions. Classer si chaque script/test consomme réellement le contexte
d'aura, ou ne fait que transmettre des statistiques déjà calculées.

**Sortie :** `carte-6bis-a2b3.json` et `controle-6bis-a2b3.md`, puis
`carte-6bis-a2b.json` combinée avec une synthèse de 12 lignes au plus pour
a3a. Conserver un vérificateur rejouable comparant l'union des trois cartes
aux **8 clés exactes** de la projection, refusant omission, substitution,
doublon et verdict contradictoire ; coller commande et sortie dans la preuve.
Le fichier combiné est l'interface attendue par a3a et a4d2 ; il ne remplace
pas les trois preuves détaillées. **Ne fait pas :** tests d'exécution,
conditions, diagnostics, benchmark, CLI ou correction de code.

**Résultat du 2026-09-27.** Les quatre clés de scripts/tests ont été classées
sur leurs appels et assertions : deux consommateurs du contexte transmis,
deux tests sans preuve d'aura. La réunion a2b1–a2b3 couvre les huit clés
exactes de la projection. La contre-vérification pilote a corrigé un verdict
de synthèse différent de sa carte source (`relicOptim.ts`) et renforcé le
vérificateur par un auto-refus de cette divergence. Les fenêtres ciblées
totalisent 259 lignes ; `spec-lint` et `git diff --check` passent. La preuve
privée `controle-6bis-a2b3.md` conserve le reçu initial et la rectification ;
aucun test d'exécution, CLI ou benchmark n'est attesté par ce lot.

#### 6bis-a3a — conditions et élagages locaux

**Cat. C ; requiert a2b3.** Lire la synthèse combinée a2b et ces fenêtres :
`src/lib/damage.ts` L3506–3515, L3778–3788 ;
`src/lib/runeBuildOptim.ts` L60–125, L365–434, L1297–1318,
L1339–1392, L1515–1609 ; `src/lib/effects.ts` L303–330 ;
`src/lib/relicQueue.ts` L50–68. Relever par recherche ciblée le test
`tests/relic-queue.test.ts` du manifeste.
Classer `avecAurasConditions`, minimums **et** maximums RES/PRE, dominance,
faisabilité et `filterSlot` : avant la construction des six runes, une aura
propre inconnue ne peut être remplacée par un total externe figé. Indiquer
pour chaque borne si elle est exacte, optimiste ou heuristique.

**Sortie :** carte a3a et deux scénarios de contrôle nommés : Tolerance
propre, Intangible compris, franchit un minimum RES puis dépasse un maximum
RES ; toggle éteint, elle reste dans le score. **Ne fait pas :** recherche
complète, diagnostic ou correction d'élagage.

**Résultat du 2026-09-27.** Les 18 clés de la projection sont couvertes par
`carte-6bis-a3a.json` et `controle-6bis-a3a.md`. La contre-vérification
pilote a réservé « consommateur » aux six lectures effectives et reclassé
six signatures ou déclarations comme points de propagation ; le bilan est
6 consommateurs, 12 non-consommateurs, dont 7 propagations. Les contrôles
rejoués retrouvent les 18 clés sans doublon, 375 lignes ciblées et un lint
propre. Les filtres min/max sont exacts pour l'aura figée reçue, non pour les
activations propres inconnues avant six runes. La carte signale des **risques
statiques à éprouver** pour dominance, faisabilité min et rétention ; elle
ne démontre aucune perte de build par une recherche exécutée et ne conclut
pas à un défaut du traitement de Blade ou d'Intangible. Le maximum peut
conserver un faux positif ; `filterSlot` est heuristique. Deux scénarios
Tolerance/Intangible et toggle sont transmis à a3b. Aucun test d'exécution
ni benchmark n'est attesté.

#### 6bis-a3b — recherche, diagnostics et filtre final

**Cat. C ; requiert a3a.** Lire la synthèse a3a et ces fenêtres :
`src/lib/runeBuildOptim.ts` L2866–2883, L2940–2955, L3085–3110,
L3185–3218, L3309–3340, L3588–3635, L3965–4048, L4179–4190 ;
`src/lib/relicQueue.ts` L138–205 ; `src/workers/prepareForSearch.ts`
L14–31 ; `scripts/monster-search-rank-diag.ts` L43–53 ;
`scripts/monster-search-validate.ts` L31–42 ;
`scripts/optimum-retention-rate.ts` L94–114 ;
`scripts/retention-dispersion-diag.ts` L178–188. Les autres chemins de
tests a3 du manifeste se qualifient par leurs appels ciblés, non par une
lecture intégrale. Reprendre les divergences notées en a3a.
Classer bornes, rétention, `prepareSearch`, diagnostics, appariement,
sélection finale artéfacts/relique et caches. Écrire pour chaque étape si
les six runes sont connues et si une coupe sûre reste démontrable.

**Contrôle ciblé de la décision du 2026-09-27 :** suivre d'abord le cas de
référence Rage seul demandé, Blade non demandé complété par Intangible,
depuis les demi-builds jusqu'au filtre final. Le cas historique de Lushen
est un point de départ, pas une preuve que le parcours actuel est défectueux.
Suivre ensuite Rage seul demandé avec Tolerance non demandé complété par
Intangible : minimum RES franchi et maximum RES dépassé quand le toggle est
actif ; toggle éteint, aucun des deux tests de condition ne compte cette aura,
qui reste présente au calcul de combat. Distinguer une borne optimiste d'une
activation réelle et noter l'étape exacte qui reçoit ou perd l'information.
Un verdict de faux rejet exige un contrôle reproductible sur le **vrai
chemin de recherche**, avec ses paramètres et sa complétude consignés ; à
défaut, le verdict reste « risque non démontré ». Ce contrôle ciblé peut
rester dans le dossier de preuves ; s'il appelle le moteur par un script ad
hoc, appliquer `algo-verify`. Ne pas refondre les tranches de Blade ou
d'Intangible sans échec observé.

**Sortie :** carte a3b, liens vers a2 et a3a, trace des deux cas ci-dessus
et inventaire des tests différentiels nécessaires aux futurs 6bis-b-*.
**Ne fait pas :** la suite différentielle complète, benchmark ni correction
du moteur.

**Résultat du lot 6bis-a3b — 2026-09-27.** La projection et la carte privée
réconcilient 9 clés, toutes non-consommatrices dans leur usage actuel ; huit
étapes de recherche supplémentaires sont documentées séparément. La trace
statique confirme que Blade non demandé, complété par Intangible, est activé
sur six runes réelles, mais que le majorant de sets supplémentaires ne crédite
pas ce joker. Pour Tolerance, l'activation réelle n'est pas propagée aux
conditions ni aux stats de combat sur le HEAD examiné. **Aucun faux rejet
n'a été reproduit** : le risque reste à éprouver sur le vrai chemin par les
contrôles différentiels proposés, sans attribuer de défaut aux tranches
Blade/Intangible. La preuve est `controle-6bis-a3b.md` ; projection, 411 lignes
contractuelles, lint, diff et reçu `bd9b60a` ↔ `2c5b82d` ont été rejoués ou
vérifiés par le pilote. Notes intégrées au main documentaire `b9054fc`.

#### 6bis-a4a — recette, reset et import écran

**Cat. C ; requiert a3b.** Lire les synthèses combinées a2a1-suite et a3b, puis :
`src/lib/optimizerRecipe.ts` L125–140, L240–340, L405–475 ;
`src/lib/damageSetupTransition.ts` L1–38 ;
`src/hooks/useOptimizerState.ts` L235–255, L365–425, L450–465 ;
`src/components/outils/OptimizerSection.tsx` L1810–1830, L1930–1955.
Qualifier le sort de la clé inconnue après reconstruction du succès du
parseur (non prouvé en a1), les anciens `setsAura` absent/vide/non vide,
l'export/import et les resets. Appliquer la checklist de code du skill
`optimizer-field-propagation`, avec la dérogation documentaire de B.0.

**Sortie :** carte a4a, matrice des constructeurs recette/état et des
compatibilités. **Ne fait pas :** CLI, affichage ou changement de champ.

**Résultat du lot 6bis-a4a — 2026-09-28.** La carte privée réconcilie les
9 clés projetées : 6 consommatrices et 3 non-consommatrices dans leur usage
actuel. Le parseur accepte encore `setsAura` absent, vide ou non vide valide
jusqu'à 18 ; la cible 6bis devra refuser le non-vide avec le chemin
`damageSetup.setsAura`. Une clé inconnue dans `damageSetup` survit au parseur,
à l'import écran et au réexport sans être validée ni calculée ; une clé
inconnue à la racine disparaît au réexport. Le reset d'espèce conserve le
contexte et le toggle, l'import de compte les réinitialise. La matrice de
propagation est dans `controle-6bis-a4a.md` et `carte-6bis-a4a.json` ;
projection, 371 lignes contractuelles, lint, diff et reçu valide
`2d8d364` ↔ `7e0541c` ont été contrôlés par le pilote. Ces conclusions
restent statiques : aucun round trip exécuté, reset React ou CLI réel n'est
prouvé ici. Notes intégrées au main documentaire `af2820e`.

#### 6bis-a4b — CLI réel et scripts de diagnostic

**Cat. C ; requiert a4a.** Lire la synthèse a4a et :
`scripts/lib/recipeToSearchParams.ts` L180–210, L350–375, L388–420 ;
`scripts/optimizer-search.ts` L102–120, L150–166, L410–420 ;
`scripts/lib/realDamageCli.ts` L40–67 ;
`scripts/optimizer-search-analyze.ts` L98–113, L155–175 ;
`scripts/lib/diagnosticHarness.ts` L1568–1585, L1990–2000 ;
`scripts/lib/diagnosticTypes.ts` L715–725 ;
`scripts/lib/perfShared.ts` L100–108 ;
`scripts/monster-search-benchmark.ts` L115–122, L192–199 ;
`scripts/monster-search-cap-sweep.ts` L18–26 ;
`scripts/optimizer-dump-equipped.ts` L21–26 ;
`scripts/optimizer-dump-siege.ts` L21–26 ;
`scripts/optimum-speed-targets.ts` L80–90.
Qualifier chaque script candidat, y compris un simple affichage de sets.
Exécuter le CLI réel sur la recette externe figée de a1 et le compte privé
nommé dans `controle-6bis-a1.md` § 6 : reprendre la commande de compilation
de `controle-6.md` L73 et remplacer **seulement** la recette dans sa
commande L74. Conserver l'intégralité de la sortie en preuve privée, mais
ne lire et citer que le résumé nécessaire au verdict ; ni copie du compte
dans le cadrage ni comparaison de temps. Dire succès/refus, prise en compte
ou ignorance sourcée par le code, plafond et troncature. Si esbuild refuse
l'accès Windows, appliquer la procédure de `CLAUDE.md`, sans déclarer le
CLI « passé ».

**Sortie :** carte a4b et constat CLI rouge ou vert, sans prétendre à une
mesure de performance. **Ne fait pas :** modifications de scripts ou tests.

**Résultat du lot 6bis-a4b — 2026-09-28.** Les 13 clés projetées sont
réconciliées : 4 consommatrices et 9 non-consommatrices dans leur usage actuel.
Le CLI réel accepte la recette figée à trois Fight externes, mais le code
continue de lire `setsAura` et ignore `setsAuraExternes` pour le calcul ; son
écho « Auras d'équipe : [] » ne suffit pas seul à ce verdict. La recherche
atteint 100 000 builds et indique `tronqué : true` : aucune exhaustivité ni
variation chiffrée du score par les auras externes n'est établie. Le pilote a
rejoué la projection, le contrôle des 299 lignes, le lint et le diff, comparé
les 13 clés et l'empreinte de la sortie CLI conservée, puis vérifié le reçu
`6669527` ↔ `308c6be`. Preuves privées : `carte-6bis-a4b.json`,
`controle-6bis-a4b.md` et `sortie-cli-6bis-a4b.txt` ; notes intégrées au main
documentaire `7ba3367`. 6bis-a4c1 peut commencer.

#### 6bis-a4c1 — écran de recherche et caches

**Cat. C ; requiert a4b.** Lire la synthèse a4b et :
`src/components/outils/OptimizerSection.tsx` L455–465, L580–605,
L1155–1180, L1325–1345, L1415–1435, L1640–1672, L2053–2066,
L2088–2143, L4938–4960.
Classer l'écran de recherche, le cache et les moments où les six runes
sont disponibles. `src/lib/importAccount.ts` et `src/lib/recoMatch.ts`,
trouvés au motif B, se qualifient par leurs appels ciblés à `activeSets`,
sans supposer qu'ils calculent des auras de combat.

**Sortie :** carte a4c1 et matrice écran/cache. **Ne fait pas :** cartes
de résultat, autres contrôles, Workers ou tests.

**Résultat du lot 6bis-a4c1 — 2026-09-28.** Les trois clés projetées sont
réconciliées : `OptimizerSection.tsx` consomme le contexte fixe pour les
conditions, le tri et le cache d'artéfacts ; `importAccount.ts` et
`recoMatch.ts` emploient `activeSets` sans calculer d'aura de combat. Les six
runes sont connues une fois les candidats publiés par l'appariement, mais
aucune aura propre n'est dérivée dans l'écran. La preuve privée
`controle-6bis-a4c1.md` et la carte homonyme consignent les citations et la
matrice écran/cache. Le pilote a comparé les trois clés à la projection,
rejoué le contrôle des 231 lignes et le lint, puis complété l'en-tête et les
sorties de contrôle de la preuve avant de la relivrer. Les quelque 4 800 lignes
lues par l'agent dépassent le repère indicatif, principalement à cause d'un
`spec-toc` trop large ; aucune fenêtre requise n'a été omise. Aucun test
d'interface ni calcul d'aura propre par build n'est prouvé ici. Le reçu
initial était `4d95932` ↔ `4ed721e` ; a4c2 peut commencer.

#### 6bis-a4c2 — cartes de résultat et autres affichages

**Cat. C ; requiert a4c1.** Lire sa synthèse, puis :
`BuildCandidateCard.tsx` L165–180,
L260–275 ; `ExclusionCandidateRow.tsx` L20–36 ; `EtatMonstre.tsx`
L35–65, L75–115 ; `DamageSetupCard.tsx` L82–104 ;
`DamageSetupModale.tsx` L25–40 (ces cinq fichiers sont sous
`src/components/outils/`) ; `src/lib/artifactQueue.ts` L280–305.
Classer les surfaces avec ou sans six runes, l'écho d'« État de mon
monstre », le score de carte et la signature du cache ; ajouter les
affichages découverts hors manifeste.

**Sortie :** carte a4c2 et matrice des cartes et contrôles. Aucun rendu
nouveau ni contrôle visuel (lot 7). **Ne fait pas :** Workers ou tests.

**Résultat du lot 6bis-a4c2 — 2026-09-28.** Les quatre clés de la projection
sont réconciliées (4 attendues, 4 présentes, aucune substitution). Les deux
cartes de candidats connaissent les runes et utilisent `activeSets` pour
**afficher** leurs sets, sans convertir ceux-ci en auras. Les dégâts et PV
effectifs affichés par `BuildCandidateCard` viennent du parent. Les deux
contrôles `DamageSetupCard` et `DamageSetupModale` ne connaissent pas les six
runes candidates et ne lisent aucun champ d'aura : le pilote a corrigé leurs
verdicts initiaux de « consommateurs » à **non-consommateurs**. Recevoir ou
transmettre `DamageSetup` dans l'interface ne prouve pas une consommation
d'aura dans un calcul. La signature du cache d'artéfacts porte le setup et le
toggle RES/PRE, mais pas un vecteur distinct d'auras propres au build.

Preuve : `controle-6bis-a4c2.md` et `carte-6bis-a4c2.json` dans le dossier
A.6 bis. Projection et contrôle des fenêtres rejoués : 8 plages et **186
lignes**, bornes OK ; `node scripts/spec-lint.mjs` : aucune erreur ;
`git diff --check` : aucune sortie. Le reçu initial était `840f202` ↔
`39a362f` ; la carte et la preuve rectifiées sont relivrées par le pilote.
Aucun test, contrôle visuel ni calcul d'aura propre par build n'est établi
par ce lot. 6bis-a4d1 peut commencer.

#### 6bis-a4d1 — Workers et tests

**Cat. C ; requiert a4c2.** Lire les synthèses a3b et a4c2, puis :
`src/workers/runeBuildOptim.worker.ts`
L235–265, L270–290, L360–385 ; `buildHalf.worker.ts` L30–55, L90–110 ;
`pairSlice.worker.ts` L25–37 ; `pairSliceBody.ts` L47–60, L94–105 ;
`parallelPairing.ts` L104–138 ; `pairingDriver.ts` L1–30 (tous sous
`src/workers/`) ; `tests/auras-modele.test.ts` L1–60, L85–100,
L200–230.
Pour les quatre autres tests a4 du manifeste, lire seulement les appels
adjacents ciblés, en documentant leurs coordonnées. Les cartes a2/a3
portent leurs propres tests candidats ; ne pas les perdre à l'agrégation.

**Sortie :** carte a4d1, contexte des six runes côté Workers et inventaire
des tests présents/manquants. **Ne fait pas :** réconciliation globale,
benchmarks ni implémentation.

**Résultat du lot 6bis-a4d1 — 2026-09-28.** La carte privée classe les
**24 clés projetées** (13 A, 5 B, 6 H) : aucune clé omise, substituée ou
doublée. Les Workers relaient les paramètres et les demi-builds ; les six
runes ne sont réunies que dans `pairBuckets`, que les deux régimes appellent.
Les tests du lot 6 prouvent surtout les anciennes auras `setsAura` figées :
le différentiel à 12 seeds construit six runes, mais ajoute 8 points RES/PRE
constants à son oracle. Aucun des 24 sites ne calcule l'**aura propre au
build**. Ce verdict local ne signifie pas que les tests ou les Workers ne
lisent jamais l'ancien contexte d'aura fixe.

La preuve `controle-6bis-a4d1.md` porte les citations et l'inventaire des
tests manquants ; le pilote y a ajouté la commande exacte de comparaison
des clés. Contrôles rejoués : 24 attendues = 24 réelles = 24 uniques,
0 écart ; `valider-fenetres-6bis.mjs` : 13 plages et 336 lignes, bornes OK ;
`node scripts/spec-lint.mjs` : aucune erreur ; `git diff --check` : aucune
sortie. Les lectures (~2 900 lignes) dépassent le repère indicatif de
2 500 après suivi des appels ; aucune fenêtre prescrite n'a été omise.
Reçu initial `655b0a2` ↔ `7f2e0bf`, notes intégrées au main documentaire
`08eb674` ; la preuve complétée est relivrée par le pilote. Aucun calcul
externe + propre, cas Intangible non demandé ni parité des régimes Worker
n'est encore prouvé. 6bis-a4d2 peut commencer.

#### 6bis-a4d2 — réconciliation des cartes

**Cat. C ; requiert a4d1.** Lire les synthèses structurées a2a1-contexte,
a2a1-suite et a2a2–a4d1,
pas toutes leurs preuves ; aucune fenêtre de code nouvelle. Créer puis
exécuter un script de réconciliation conservé avec la preuve, qui compare
les cartes complètes sans les charger toutes comme prose. Rejouer
`projeter-6bis.mjs --bilan` et conserver les clés attendues.

**Réconciliation :** égalité des clés A/B/H **actives** de la projection
et de l'union des cartes, avec verdicts sourcés et usages multiples
distincts ; les deux H documentaires `differe` sont vérifiées séparément
contre leur destination 6bis-b-* ; découvertes D séparées.
Conserver **deux axes distincts** lors de la consolidation : consommation
de l'ancienne aura fixe reçue dans `setup` et calcul de l'aura propre aux
six runes. Les « non-consommateurs » d'a4d1 ne le sont que sur le second
axe ; ne pas les assimiler à une absence de tout usage d'aura.
`carte-6bis-a4d2.json` consolide coordonnées, runes connues ou
non, cache, tests, incertitudes et scénarios Intangible. `controle-6bis-a4d2.md`
porte commandes, sorties, longueurs, verdict CLI repris de a4b et les
seeds/tests à créer. Proposer des contrats **bornés** `6bis-b-*` ; le pilote
les inscrit dans A.7, les fait revoir et les valide avant tout lancement.

**Ne fait pas :** code, tests différentiels, benchmark ou implémentation du
modèle. Les lots `6bis-b-*` restent non lançables.

**Résultat du lot 6bis-a4d2 — 2026-09-28.** Le script
`reconcilier-6bis-a4d2.mjs` compare par identité les 13 cartes propriétaires
aux projections : **46 A + 41 B + 15 H = 102 clés actives**, plus **2 H
documentaires différées**, soit 104 clés du manifeste. Les deux usages
supplémentaires `score`/`conditions` sont distincts ; `carte-6bis-a2b.json`
n'est pas comptée deux fois, les découvertes D restent à part. Les cinq
mutations initiales sont refusées ; le pilote a corrigé le contrôle négatif
du verdict (empreinte recalculée après mutation) et imposé l'identité exacte
des deux H documentaires, avec une sixième mutation refusée. Le CLI et T1–T6
sont **repris des preuves précédentes, non rejoués**. La preuve est
`controle-6bis-a4d2.md` ; `projeter-6bis.mjs --bilan`, le réconciliateur,
`spec-lint` et `git diff --check` passent. Les lectures comptées dépassent
de 78 lignes le repère indicatif de 2 500, sans fenêtre omise. Le reçu initial
est `b9ff929` ↔ `473fe62`, notes intégrées sur le main documentaire
`43037eb` ; le complément pilote a été livré et intégré ensuite. La sûreté des coupes,
les nouveaux calculs et la parité ne sont pas encore prouvés. Les contrats
b1–b4 ci-dessous sont une **proposition du pilote**, non lançable avant
contre-revue indépendante et amendement de ses objections.

#### 6bis-b-* — contrat commun de correction du modèle

**Cat. J ; contrats amendés après contre-revue externe du 2026-09-28,
non lançables avant contre-vérification indépendante de l'amendement.**
Chaque contrat reprend un intrant borné de la carte réconciliée 6bis-a4d2
et désigne ses producteurs, consommateurs et preuves, sans omettre ceux
attribués à un autre sous-lot. Ensemble, ils livrent ceci :

- Résoudre les activations propres depuis les runes de **chaque** build,
  propager explicitement externe + propre sans muter `DamageSetup` ni déduire
  les sets de `StatRow`. Un appel sans équipement déclare explicitement zéro
  aura propre. Le total effectif est identique à l'écran, en Worker et au CLI.
- Compter chaque activation dans les dégâts (sort, passifs, additionnels),
  PV effectifs, exclusives de relique, choix artéfacts/relique, tri,
  comparaison et affichage. PV/ATQ/DEF rejoignent le `ceil` commun de base
  de `statsDebutCombat` sans modifier `computeStats` ; EHP garde sa politique
  préexistante hors auras (ni lead ni invocateur ajoutés implicitement).
  RES/PRE rejoignent min **et** max seulement avec le toggle actif. Aucun
  double compte des sets du candidat.
- Auditer et corriger dominance, faisabilité, `filterSlot`, rétention par
  compartiment, diagnostics, cache et filtre final : Fight non demandé n'est
  plus neutre pour le score. Aucune coupe « sûre » ne rejette un build valide
  ou meilleur en ignorant une aura ; une rétention heuristique n'annonce
  jamais une garantie d'optimalité globale. Mesurer l'impact de la recherche
  selon `optimizer-perf-testing`, sans benchmark concurrent ; toute constante
  changée suit `algo-verify` avant d'être figée.
- Pour RES/PRE, préserver le potentiel d'Accuracy/Tolerance propres non
  demandés dans les conditions **seulement si** le toggle est actif : borne
  favorable aux minimums, borne fondée sur l'inévitable pour les maximums,
  puis activations réelles au filtre final. Toggle éteint, leurs auras restent
  en combat mais ne favorisent ni ne pénalisent ces conditions. Reprendre la
  trace Blade/Intangible de a3b comme témoin ; ne changer son traitement que
  si un test ciblé établit un défaut réel.
- Renommer et propager le champ de B.0 (état, reset, recette, parseur,
  export/import, CLI, caches, scripts et tests). Ancien `setsAura` absent/vide
  accepté ; non vide refusé avec le chemin et la raison. Nouveau champ :
  somme externe ≤ 15, total effectif ≤ 18. Aucun rejet global des anciennes
  recettes sans aura ; aucune réinterprétation silencieuse de leurs totaux.

**Preuves globales obligatoires :** les exemples du chapeau, 0/15/16 auras
externes, 15 + 3 propres = 18, 2 ou 3 Fight actifs, joker qui complète Fight,
aura non demandée, recette ancienne vide/non vide, import/export, reset,
cache et parité écran/CLI. Tester explicitement les deux bornes RES/PRE
avec une aura **propre** au candidat, y compris complétée par Intangible :
minimum franchi, maximum dépassé et toggle éteint. Chaque consommateur de
6bis-a4d2 a un test nommé. Les attentes historiques 18 acceptés / 19 refusés
de `testAurasRecette` changent : conserver la sortie rouge avant correction,
puis justifier 15 acceptés / 16 refusés et le refus d'un ancien `setsAura`
non vide, au lieu d'ajuster silencieusement le test existant.
La référence exhaustive indépendante n'appelle pas le nouvel évaluateur
pour établir ses attentes ; seeds fixes et comparaison différentielle sur
petits pools, plus cas à volume réel pour les rétentions. Commandes ciblées
exactes et résultats de complétude/troncature dans les preuves privées.
Rejouer la nouvelle recette figée par le **CLI réel** ; l'ancienne doit être
refusée explicitement. Terminer par `npx tsc --noEmit`, tests ciblés,
`npm run build`, `node scripts/spec-lint.mjs`, `git diff --check` et recherche
des **deux** noms de champ dans `src/`, `scripts/`, `tests/`. Mettre à jour
`degats-reels/effets-equipe-et-leaders.md`, `optimizer.md` et `invariants.md`
avec le modèle dans les commits concernés ; livrer, vérifier puis intégrer
les notes privées de chaque sous-lot validé.

##### 6bis-b-* — propriétaires, découvertes et frontières

Le découpage ci-dessous attribue un **propriétaire de correction** à chaque
zone ; les 104 clés restent dans `carte-6bis-a4d2.json`, sans recopier ses
112 Ko dans le cadrage. Un sous-lot relit ses propres cartes et seulement
les clés citées d'un lot voisin. Les tests existants ne sont pas des preuves
des nouvelles auras : ils sont à conserver ou à remplacer avec une attente
justifiée, jamais à modifier pour les faire passer. Les découvertes D
reçoivent une décision explicite avant clôture du propriétaire concerné :
commentaire `damage.ts` et ancien invariant → b1/b2 ; libellés +10 % et
écho d'état sans aura → lot 7 ; `isSetComparable`, `guaranteedMin`, ordre
de `prepareSearch`, `estimateSearchSpace`, `estimatePairBound`, `buildBuckets`,
`diagnoseFeasibility` et `rankBlockingConditions` → b3b ;
`pairBuckets` se partage par **usage** : `quickOk` et bornes → b3b,
contrôle exact après construction des six runes → b3a ;
`relicQueue.ts:165` (`resoudreEquipementDuBuild`) se partage de même par
usage : note des couples (`chercherPaires(e.faireParams(relique))`,
`p.score`) → b2, conditions (`respecteConditionsAvecRelique`) → b3a ; signature
`artifactQueue` → b4. **Toggle RES/PRE :** le booléen ajouté par b3a dans
`auraResPre` est le **seul** porteur du toggle dans le moteur. Les lectures
de valeur `runeBuildOptim.ts` L1309 (`relevance`) et L1381 (`filterSlot`),
qui appartiennent à b3b, s'y conforment ; `tsc` ne les signale pas, car
`auraResPre?.[k]` reste typé. « Éteint » ne se code jamais par l'absence
de `auraResPre`. Les coordonnées restent dans les entrées D de la
carte, et cette attribution ne préjuge pas qu'un correctif est nécessaire.
Les quatre `contratsProposes` de la carte a4d2 sont sa proposition
**historique**, non réécrite ; les **cinq** contrats publics amendés ici font
foi pour l'exécution. Les tests a4d1 ne sont pas réservés en bloc à b4 :
chaque propriétaire de calcul corrige ses fixtures et attentes, b4 vérifie
leur parité finale.
**Assiette des exclusives et chantier relique.** A.2 (cible 2) fait entrer
les auras dans les exclusives de relique : l'assiette Y d'`apportExclusive`
(`relicExclusive.ts` L133) passe par `statsDebutCombat` et change donc en
b2. Or `reliques.md` § 5.2 (L254–261, énumération citée L259–261) énumère « au début du combat » sans
les auras. b2 amende cette énumération dans le **même commit** que le code
(auras externes et activations propres, décision du 2026-09-25), avec renvoi
croisé vers `degats-reels/effets-equipe-et-leaders.md`, et met à jour la
ligne « les reliques » du README privé de l'Optimizer, qui interdit encore
de modifier ce fichier ailleurs (A.5, décision du 2026-09-29).

**Ne fait pas :** aucun contrôle visuel d'aura (lot 7), aucun changement de
la règle de jeu d'Intangible ni des valeurs +8 de A.2 ter. Après tous les
sous-lots et avant le lot 7, revue technique indépendante des coupes sûres,
du double compte et de la parité des chemins ; objections corrigées et
preuves rejouées avant validation. Cette revue a sa propre preuve,
`controle-6bis-b-revue-technique.md` (dossier A.6 bis), et sa ligne dans
le suivi A.7.

##### 6bis-b1 — données externes, recettes, resets et CLI

**Cat. J ; requiert la contre-vérification des contrats amendés après
a4d2.** Intrant borné :
`carte-6bis-a4d2.json`, clés des propriétaires a4a (9) et a4b (13), plus
`H:champ:DamageSetup.setsAuraExternes` et les quatre sites de définition /
lecture de `nombreAura` d'a2a1-contexte. Lire les plages de code citées dans
ces clés seulement, puis leurs appelants directs nécessaires ; ne pas
rouvrir les 13 preuves complètes. Les deux H documentaires suivent b1
puis b2 : aucune ne reste sans propriétaire.

**Contrat :** ajouter et valider le champ externe optionnel, somme ≤ 15 ;
refuser l'ancien `setsAura` **non vide** avec le chemin du champ, garder
absent/vide compatible. Propager type, défaut, transition d'espèce, import
de compte, recette, état, constructeurs de scripts et CLI réel ; faire
l'aller-retour sans clé inconnue opaque. Dans l'état intermédiaire b1,
les calculs qui recevaient un total figé reçoivent la seule part externe :
ne pas prétendre que les activations propres sont déjà comptées. La spec
source et l'invariant décrivent exactement cet état provisoire, puis b2
(combat et score) et b3a (conditions) les amènent ensemble au modèle
complet.
Dans `tests/auras-modele.test.ts`, b1 prend la fixture L20 et le test de
recette L41–57 ; il renomme mécaniquement l'ancien champ dans les autres
fixtures nécessaires au typage, **sans changer leurs attentes métier**,
qui appartiennent à b2 et b4.

**Preuves :** test rouge puis vert de l'ancien `testAurasRecette` ; 0/15
acceptés, 16 refusés, champ mal typé, doublon, absent/vide/non vide ancien,
export/import et resets ; recherche des deux noms dans `src/`, `scripts/`,
`tests/` avec décision par occurrence. CLI réel sur la recette externe
gelée de a1 **et** sur `recette-6bis-ancienne-non-vide.json` : prouver
respectivement la lecture des trois Fight externes et le refus explicite
de `damageSetup.setsAura`. Cette recette en objectif EHP ne prouve pas
l'effet offensif des Fight ; signaler toute troncature, sans conclure à
l'exhaustivité. `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
`controle-6bis-b1.md`.
**Ne fait pas :** dériver les auras propres du build, changer les coupes,
ajouter les contrôles visuels du lot 7 ou présenter le CLI comme complet.

**Résultat du lot 6bis-b1 — 2026-09-29.** Code `4622a02f` (7 fichiers,
une seule raison : champ, recette, CLI, tests, spec publique). Reçu
`de9e893` ↔ `a38a410`, notes intégrées au main documentaire `92ca335`.
Preuve privée `controle-6bis-b1.md` (324 lignes). Le pilote a rejoué sur
`de9e8938` : `npx tsc --noEmit` → 0 ; les six filtres du brief → 102
vérifications passées ; `node tests/run.mjs auras` → 132 ; `npm run build`,
`spec-lint` et `git diff --check` verts ; `setsAura` ne subsiste que dans
le refus, le retrait à l'import et les tests. CLI réel reconstruit :
recette ancienne non vide refusée, `damageSetup.setsAura`, code 1 ;
recette externe → écho `[{"set":"fight","nombre":3}]`, 100 000 builds,
`truncated=true`, 8 536 796 paires (régime séquentiel), 11 s ;
`chantier verifier` → « Reçu valide ». `invariants.md` L21–23 et
`artefacts.md` § 11.5 décrivent l'état provisoire. Écarts acceptés :
l'ancien champ est retiré du type ; la sortie rouge est celle de
l'ancien test sur le code corrigé ; un `node -e` sans backtick a été
utilisé contre CLAUDE.md. Non prouvé : l'effet offensif des Fight par le
CLI (objectif EHP) et l'exhaustivité (recherche tronquée).
**Incident de pilotage :** un commit du cadrage pendant la livraison de b1
a bloqué `livrer` (arbre sale) ; le reçu porte donc `de9e893`. Règle : le
pilote ne commite plus le cadrage pendant qu'un lot tourne dans ce
worktree.

##### 6bis-b2 — aura propre par build, combat, EHP et choix des pièces

**Cat. J ; requiert b1.** Intrant borné : les cinq clés A de
`src/lib/damage.ts` aux lignes 3781, 3782, 3783, 3785 et 3786, et la clé
`B:src/lib/stats.ts` d'a2a1-contexte, a2a1-suite (1), a2a2 (4),
a2b1–a2b3 (8) dans la carte consolidée, plus l'usage « note des couples »
de `D:src/lib/relicQueue.ts:165` ; consulter les plages citées
et leurs appelants directs. Les quatre clés de champ/lecteur
`damage.ts:3316/3438/3506/3507` sont déjà traitées par b1 : b2
vérifie leur interface, sans les reclasser.

**Contrat :** produire un vecteur externe + activations propres depuis les
six runes du candidat via `activeSets`, puis le transmettre sans muter
`DamageSetup` aux calculs de dégâts, passifs, additionnels, EHP et assiette
des exclusives ; un appel sans équipement annonce zéro aura propre. Recalculer
pour chaque paire d'artéfacts/relique essayée puis retenue, sans confondre
les stats de fiche et celles du combat. Examiner les chemins séparés
`defCombat` et `atkCombatComplet` signalés par a2a1-suite, avec test ou
justification sourcée pour chacun. Les choix et scores par build doivent
être cohérents ; les conditions restent le lot b3a. Mettre à jour la spec
source et `invariants.md` ensemble pour l'état du **combat et du score** ;
l'invariant RES/PRE des conditions reste marqué **provisoire** (part externe
seule, activations propres pas encore comptées) jusqu'à b3a, qui lève cette
réserve. Aucun texte publié par b2 ne présente le modèle comme complet.
Ordre des chemins partagés : b1 renomme et valide le lecteur **externe** ;
b2 compose les activations propres dans le combat et le score, mais laisse
`avecAurasConditions` sur la seule part externe provisoire ; b3a corrige
ensuite les conditions. Pour toute signature modifiée, b2 recense et
raccorde **tous** les appelants : deux `computeTotalDamage` et quatre
`pvEffectifs` dans `OptimizerSection.tsx`, plus les découvertes
`scripts/artifact-search.ts` et `scripts/artifact-contention-diag.ts`.
L'argument qui transmet l'aura propre est obligatoire (ou contenu dans un
contexte obligatoire), afin que `tsc` expose les appels oubliés ; six runes
présentes → leurs sets réels, absence réelle d'équipement → zéro explicite.
Les deux attentes d'arrondi L91/L97 de `tests/auras-modele.test.ts`
appartiennent à b2 ; b4 ne fait que vérifier ces raccordements.

**Preuves :** 3 Fight externes + 2 ou 3 Fight propres, Rage seul avec Fight
complété par Intangible, set non demandé, +8 de base dans le `ceil` commun,
RES/PRE depuis zéro, EHP, exclusive, paire/relique réellement retenues,
non-mutation du setup et deux candidats aux auras différentes. Prouver
**15 externes + 3 propres = 18**, et que 3 externes + 2 propres valent 5,
jamais 7, séparément pour dégâts, EHP, exclusive et paire. `pvEffectifs`
(`runeBuildOptim.ts` L801–802) garde **un seul** `ceil` sur
`base × 8 × (externes + propres)`, comme le `ceil` commun de
`statsDebutCombat` : test nommé avec une aura propre non nulle et une base
où `ceil(externe) + ceil(propre)` diffère de ce `ceil` unique. Couvrir aussi
Intangible quand deux sets sont incomplets et qu'il n'en complète aucun :
test de cohérence avec `activeSets`, sans prétendre relever une nouvelle
règle du jeu. Tester le score direct sans revendiquer encore la sûreté de
la recherche ; caches des
pièces séparés par build. Test nommé sur la note des couples de
`resoudreEquipementDuBuild` (`relicQueue.ts`, appel `faireParams`) avec une
aura propre non nulle, qui prouve aussi que les couples transmis au contrôle
des conditions (usage b3a) restent ceux attendus. `tsc`, tests ciblés, build, spec-lint, diff-check ;
preuve `controle-6bis-b2.md`.
L'écho du CLI (`scripts/optimizer-search.ts`, « activations propres du
build : pas encore comptées ») devient « comptées dans le combat et le
score, pas encore dans les conditions » ; b3a l'achève.
**Ne fait pas :** conditions, élagages, rétention heuristique, UI de saisie.

**Résultat du lot 6bis-b2 — 2026-09-29.** Code `dbd4ee54` (25 fichiers :
résolution, raccordements, tests, spec publique) et `b0a2e84d` (commentaire
seul). Reçu `b0a2e84` ↔ `5e32fe6`, notes intégrées au main documentaire
`18266dd`. Preuve privée `controle-6bis-b2.md` (376 lignes). Conception :
`aurasPropresDesRunes` (via `activeSets`) produit `AurasPropres`, argument
obligatoire après `setup` de toute la chaîne combat/score (`statsDebutCombat`,
`statsDeCombat`, `computeSkillDamageDetail`, `computeTotalDamage`,
`pvEffectifs`, `objectiveScore`, `apportExclusive`, `evaluerPourRegime`,
`aurasPropresDe` requis par `sortCandidates`). Le pilote a relu le diff de
code et rejoué sur `b0a2e84d` : `npx tsc --noEmit` → 0 ;
`node tests/run.mjs auras degats relic artifact runeoptim` → 3 040
vérifications passées ; build, `spec-lint`, `git diff --check` verts ;
`chantier verifier` → « Reçu valide ». Aucun `AUCUNE_AURA_PROPRE` hors
tests dans `src/` et `scripts/` : chaque chemin de production résout les
runes réelles. L'appariement ne calcule aucun score d'objectif (tri après
recherche) : les Workers ne sont pas touchés. `reliques.md` § 5.2 amendé,
README privé L29 aligné, invariant RES/PRE des conditions marqué provisoire,
écho CLI « pas encore dans les conditions ». Mutations rapportées par
l'agent (double compte, deux `ceil`, note des couples, Brita/Gideon) : non
rejouées par le pilote. `relicQueue.ts` inchangé, raccordé par
`faireParams`. **Décision utilisateur du 2026-09-29 :** `defCombat`
(Gideon) et `atkCombatComplet` (Brita) passent par `statsDebutCombat` et
comptent donc les auras externes et propres, comme les autres passifs
(A.2 cible 2) ; aura nulle → valeurs inchangées. Non prouvé : écran non exécuté, effet sur
le classement du compte réel (recherche EHP tronquée), Brita/Gideon sans
relevé en jeu. Lectures ≈ 5 600 lignes, au-delà du repère, sans fichier
lourd lu en entier.

##### 6bis-b3a — conditions exactes et filtres finaux

**Cat. J ; requiert b2.** Intrant borné : les **16 clés a3a hors**
`A:src/lib/runeBuildOptim.ts:1309` et
`A:src/lib/runeBuildOptim.ts:1381` (points de propagation,
conditions et tests, pas 16 filtres), plus l'usage « conditions » de la
découverte `D:src/lib/relicQueue.ts:165` et l'usage de contrôle final de
`D:src/lib/runeBuildOptim.ts:4029-4035`. Interroger
`carte-6bis-a4d2.json` par ces clés, puis les seules plages citées.
Les deux clés `filterSlot`, les **9 clés a3b** et les coupes précoces de
`pairBuckets` appartiennent à b3b : aucune clé a3b n'est classée ici.

**Contrat :** séparer RES/PRE externes constants et propres variables par
build ; au filtre final, tester la valeur **réelle** des six runes pour min
et max. Toggle éteint : aucune aura RES/PRE dans ces conditions, mais combat
et score inchangés. Transmettre la même convention aux appelants du filtre,
sans déclarer sûrs les diagnostics ou coupes amont encore anciens. Ne jamais ajouter
les auras PV/ATQ/DEF aux conditions. Mettre à jour la spec et l'invariant
concernés dans le même commit, dont l'invariant RES/PRE laissé provisoire
par b2, dont b3a lève la réserve.
**Le toggle doit atteindre le moteur.** Aujourd'hui `avecAurasConditions`
(`runeBuildOptim.ts` L117–119) le replie dans `auraResPre`, et
`pointsAuraResPre` rend `{ res: 0, acc: 0 }` éteint, valeur identique à
« allumé sans aura externe » ; `compterAurasResPre` n'apparaît ni dans
`runeBuildOptim.ts` ni dans `src/workers/`. b3a ajoute donc à l'objet
`auraResPre` un booléen **obligatoire dans cet objet**, posé seulement par
`avecAurasConditions` et lu par `totalCondition` (L121–122), les trois
`Pick<…>` (L371, L396, L423) et `relicQueue.ts` L58. `auraResPre` absent
garde son sens actuel : aucune aura dans les conditions, ni externe ni
propre. Ne pas coder « éteint » par l'absence de `auraResPre`. Producteurs
à vérifier : `recipeToSearchParams.ts` L410, `OptimizerSection.tsx` L1665 ;
recettes littérales qui fixent le toggle : `scripts/lib/diagnosticLot.ts`
L246, `scripts/diagnostic-harness-parite.ts` L142,
`scripts/artifact-contention-diag.ts` L108. Les littéraux `auraResPre`
attendus par `testAurasPariteEcranCliEtCache` (`tests/auras-modele.test.ts`,
retrouver par `grep` : les lignes des tests bougent à chaque lot) reçoivent
mécaniquement le nouveau booléen,
sans changer leur sens ; la parité reste à b4.
**État intermédiaire explicite :** les contrôles exacts connaissent l'aura
propre, mais les élagages de dominance/faisabilité ne sont pas encore
prouvés sûrs pour ce nouveau modèle, et l'effet de la rétention heuristique
n'est pas mesuré (elle n'a jamais été garantie, `invariants.md` L193). L'énoncé général
« élagages SÛRS » d'`invariants.md` reçoit cette réserve temporaire, avec
renvoi à b3b ; aucune garantie de résultat complet n'est publiée à ce stade.

**Preuves :** Tolerance ou Accuracy propre non demandée, Intangible qui
la complète, min franchi, max dépassé et toggle éteint, **sur candidats
construits**. Tests nommés au niveau de `respecteMinEtMax`,
`respecteConditionsPaireFixe`, `respecteConditionsAvecRelique`,
`resoudreEquipementDuBuild` et du contrôle final de `pairBuckets` : pour
ce dernier, les coupes `quickOk`/bornes doivent être rendues non
contraignantes ou leur passage prouvé, afin d'isoler l'assertion finale.
**Limite mesurée par le pilote :** le `quickOk` minimum
(`runeBuildOptim.ts` L3944–3952) précède ce contrôle et sa marge
`guaranteedMin` ne vient que de `SET_STAT_BONUS` (L1690–1725, L3105) :
aucune aura n'y figure. Un **minimum** franchi seulement grâce à une
Tolerance/Accuracy propre n'atteint donc le contrôle final que si le pool
offre une marge Endure (RES) ou Focus (PRE) sur les emplacements libres,
passage tracé par `quickOkMin` ; sans cette marge, ce minimum se prouve
au niveau des fonctions ci-dessus et son passage par `pairBuckets` est
reporté à b3b, sans modifier `quickOk` ici. Le **maximum** s'y prouve en
b3a : `quickOk` y reste un minorant sans l'aura propre. En mode recherche
de relique (L4020–4025), ce contrôle reste une borne pour le terme de
relique ; seul le terme d'aura, connu par les six runes, y est exact.
Comparer au moins deux candidats sans passer par `searchBuilds` ni prétendre
prouver la conservation du pool ; cette preuve de bout en bout (T2 et T3)
appartient à b3b. Un échec de recherche complète éventuellement constaté
ici est documenté comme risque à traiter en b3b, pas corrigé par b3a.
`tsc`, suite ciblée, build, spec-lint et diff-check ; preuve
`controle-6bis-b3a.md`. b3a retire de l'écho du CLI la réserve « pas
encore dans les conditions ».
**Ne fait pas :** dominance, faisabilité précoce, diagnostics de faisabilité
ou de blocage, `filterSlot`, rétention par compartiment ni benchmark.

**Résultat du lot 6bis-b3a — 2026-09-29.** Code `6b1ff763` (10 fichiers).
Reçu `6b1ff76` ↔ `11be57d`, notes intégrées au main documentaire `867acdb`.
Preuve privée `controle-6bis-b3a.md` (362 lignes). Conception : le toggle
atteint le moteur par `auraResPre.compter`, obligatoire dans l'objet et posé
par le seul `avecAurasConditions` ; `totalCondition` ajoute, toggle actif,
part externe + `pointsAuraResPrePropres` à un total `computeStats` (aucune
aura) : un seul compte. Sites raccordés : les trois `respecte*`, les deux
appels de `relicQueue.ts`, le contrôle final de `pairBuckets` (depuis
`activeSets` des six runes). Les bornes amont (`deriveMinMaxContext`)
passent `AUCUNE_AURA_PROPRE`, volontairement, jusqu'à b3b. Le pilote a relu
le diff et rejoué sur `6b1ff763` : `npx tsc --noEmit` → 0 ;
`node tests/run.mjs auras relic runeoptim conditionfloor intangible` →
2 155 vérifications passées ; les trois tests nouveaux → 76 ; build,
`spec-lint`, `git diff --check` verts ; « Reçu valide ». Deux mutations
rejouées par le pilote dans un worktree jetable : aura propre comptée
toggle éteint → 16 échecs sur 76 (trois tests) ; contrôle final de
`pairBuckets` sans aura propre → 4 échecs sur 12. `pairBuckets` : maximum
prouvé, minimum prouvé grâce à une marge Endure tracée (`quickOkMin`).
Invariant RES/PRE des conditions : réserve levée. Réserve « élagages SÛRS »
posée à **quatre** endroits : `invariants.md` L35, `optimizer.md` L1334 et
L2052, `effets-equipe-et-leaders.md` L116. Non prouvé : recherche complète
où un minimum ne tient que par l'aura propre sans marge Endure/Focus (b3b) ;
écran non exécuté ; l'écart de premier build au CLI réel attribué à la
troncature par déduction ; lectures ≈ 3 600 lignes, estimées sans
commande de comptage.

##### 6bis-b3b — coupes, diagnostics et rétention, avec oracle indépendant

**Cat. J ; requiert b3a.** Intrant borné : les **deux clés a3a**
`A:src/lib/runeBuildOptim.ts:1309` et
`A:src/lib/runeBuildOptim.ts:1381` (`filterSlot`), les **9 clés
a3b**, les découvertes D attribuées aux coupes/diagnostics/rétentions
dans le contrat commun, et l'usage `quickOk`/bornes de
`D:src/lib/runeBuildOptim.ts:4029-4035` ; plus les six clés Worker
d'a4d1 qui transportent ces étapes. Lire les plages citées par la carte
et les synthèses `controle-6bis-a3a.md`/`controle-6bis-a3b.md`, pas les
preuves entières. `pairBuckets` partage une **coordonnée**, pas un verdict
dupliqué : b3a possède son contrôle final, b3b ses coupes antérieures.

**Contrat :** les bornes sûres comptent le potentiel favorable de
Tolerance/Accuracy propres non demandés pour un minimum, seulement toggle
actif ; pour un maximum, elles n'attribuent que l'inévitable. Vérifier
dominance, faisabilité, diagnostics, pré-filtrage et rétention par compartiment pour les
cinq auras influant sur score ou conditions, sans attribuer à `filterSlot`
une garantie d'optimum qu'il n'a pas. Préserver le parcours Blade/Intangible
tant qu'un test ne prouve pas un défaut. `algo-verify` s'applique avant toute
modification d'algorithme : oracle exhaustif indépendant, comparaison
différentielle, puis mesure ciblée avec `optimizer-perf-testing` au créneau
sans concurrent convenu ; une constante ne se fige pas sur une impression.
L'oracle peut partager **`computeStats` et `activeSets`**, sources existantes
de stats et de sets actifs, mais calcule lui-même les 8 points par aura et
les conditions : il n'appelle ni le nouveau calcul d'auras par build, ni
`prepareSearch`, ni ses bornes ou élagages. La référence exhaustive part
du pool **avant** préparation ; elle n'est jamais l'ensemble déjà filtré.
⚠️ Depuis b2, `scripts/lib/relicOracle.ts` et `relicDifferentiel.ts`
résolvent les auras propres par `aurasPropresDesRunes`, comme la
production : ils ne sont **pas** une référence indépendante pour les auras
et ne fournissent aucune attente d'aura à cet oracle.
La réserve temporaire d'`invariants.md` créée en b3a n'est levée qu'après
un différentiel vert prouvant à nouveau la sûreté des coupes concernées.

**Entrées laissées par b3a** (risques observés, pas des défauts
reproduits) : sans marge Endure/Focus dans le pool, un minimum RES/PRE que
seule une aura propre fait tenir peut être coupé par `quickOk`,
`guaranteedMin`, `bucketPairFeasibleMin`, `comboAFeasible` ou
`eliminateInfeasible` ; la dominance compare des runes de sets hors combo
(`isSetComparable`) et peut retirer une rune Tolerance/Accuracy ;
`diagnoseFeasibility` peut déclarer impossible un tel minimum ;
`filterSlot`/`relevance` ne lisent que la part externe de `auraResPre`.
Chacun reçoit un verdict prouvé par l'oracle. Lever la réserve « élagages
SÛRS » partout où b3a l'a posée : `grep -rn "6bis-b3b" spec/` (quatre
emplacements au 2026-09-29), invariant et sources dans le même commit.
Toute mesure de performance attend un créneau confirmé par l'utilisateur
sans autre agent actif. **Créneau confirmé par l'utilisateur le
2026-09-29** pour la session b3b : aucun autre agent, aucun serveur de dev,
aucun build ni test lancé en parallèle par le pilote pendant les mesures.

**Preuves :** T1, **T2 de bout en bout**, T3 et T4 sur seeds fixes et petits
pools, zéro faux rejet par coupe sûre, témoins Fight/Tolerance/Accuracy
non demandés avec et sans Intangible, diagnostics et near-miss cohérents,
maximum RES/PRE, toggle éteint, résultats de complétude et troncature.
Cas réel pour quantifier la rétention heuristique ; temps min,
médiane et dispersion, sans chiffre nu. `tsc`, tests ciblés, build,
spec-lint, diff-check ; preuve `controle-6bis-b3b.md`.
**Ne fait pas :** nouveau contrôle visuel, valeur de jeu curée ou promesse
d'exhaustivité sur une recherche tronquée.

**Résultat du lot 6bis-b3b — 2026-09-29.** Cinq commits de code : borne
de minimum RES/PRE avec potentiel propre, toggle actif (`bdbd952c`) ; joker
crédité dans `additionalSetActivationHeadroom`, borne seulement, `activeSets`
inchangé (`b841912c`) ; dominance restreinte aux sets interchangeables,
`contexteDominance` (`1bb729c2`, `12812a6e`, `3f9be574`) ; réserve levée
(`e43aee53`). Reçu `3f9be57` ↔ `bc01ad2`, notes intégrées au main
documentaire `9e38ffc`. Preuve privée `controle-6bis-b3b.md` (708 lignes),
rouge d'origine reproduit : 100 échecs sur 753. Le pilote a relu le diff et
rejoué sur `3f9be574` : `npx tsc --noEmit` → 0 ;
`node tests/run.mjs runeoptim auras intangible conditionfloor diagnostic relic amplification`
→ 3 404 vérifications passées, 0 KO ; build, `spec-lint`, `git diff --check`
verts ; « Reçu valide ». La nouvelle dominance est strictement plus
prudente que l'ancienne (tout set jadis protégé l'est encore) ; sa portée
est écrite dans `invariants.md` L37 : optimum garanti pour conditions,
objectif et efficience, pas pour un tri après coup sur une autre stat
(décisions utilisateur du 2026-09-29, dont le Taux Crit protégé seulement
sous un minimum de Taux Crit). Mesures rapportées (min/médiane, répétitions
entrelacées) : écarts dans la dispersion (1,4 à 5,8 %), non rejouées par le
pilote. **Écart au contrat acté par décision utilisateur du 2026-09-29 :**
la mesure de la rétention heuristique sur un vrai compte est arrêtée ;
premier relevé à RES 85 / PRE 80 : 3 473 candidats sur 528 221 ne tiennent
que par l'aura propre, sans comparaison à un filtrage large. `filterSlot`,
`relevance` et `bucketCap` restent aveugles à l'aura propre, documenté comme
limite connue (`limites-connues.md` L71–85). Bornes comptées sur tout le
pool plutôt que par emplacement : piste « En attente » (`pistes.md` L197).
Hors chantier, constaté : `sw-forge-docs` (privé) porte `comptes/` avec
deux exports de compte, jetons de session masqués (`30b8a6f`), ajout
volontaire pour les sessions cloud.

##### 6bis-b4 — raccordements écran/Workers, caches et parité finale

**Legs de b3b :** `prepareSearch` calcule désormais `contexteDominance` à
partir de `objective`/`objectiveStats` ; b4 vérifie que l'écran, le CLI et
les deux régimes Worker (qui relancent `prepareSearch` par Worker)
transmettent les mêmes valeurs. La revue technique qui suit b4 vérifie que
`invariants.md` L35 (« jamais de faux rejet ») renvoie à la portée écrite
en L37.

**Cat. J ; requiert b3b.** Intrant borné : clés d'a4c1 (3), a4c2 (4),
a4d1 (24) **pour vérification finale**, plus
`H:cache:signatureArtefacts` et les scripts/test candidats d'a4b et
a2b3. Les six clés Worker sont raccordées par b3b si ses coupes changent ;
b4 vérifie les deux régimes. Les assertions de parité de
`testAurasPariteEcranCliEtCache` (`tests/auras-modele.test.ts`, citées par
nom : leurs lignes bougent à chaque lot) appartiennent à b4.
**Constat hérité de b2, à trancher par b4 :** la carte « Dégâts réels »
(`OptimizerSection.tsx`, calcul affiché près de L5007 en `b0a2e84d`)
n'ajoute pas le bonus de Conquête que le tri compte. Défaut antérieur aux
auras, mais c'est un écart tri/carte, donc de parité : b4 le corrige s'il
le confirme, sinon il le consigne dans `pistes.md` avec sa raison. Lire les synthèses et
plages citées, pas leurs preuves entières ; vérifier les chemins modifiés
par b1–b3b.

**Contrat :** tri, comparaison, cartes de résultat, sélection finale des
pièces et signatures de cache utilisent le vecteur effectif **du candidat**.
Le Worker séquentiel et le régime parallèle transmettent les mêmes données
au même calcul, sans attribuer un set propre au setup commun. Les cartes
d'affichage de sets ne sont pas automatiquement des consommateurs d'aura :
seules les valeurs réellement présentées sont vérifiées. Aucun contrôle de
saisie des auras n'est ajouté ici (lot 7).

**Preuves :** T5–T6 ; invalidation du cache au changement des auras
externes, séparation par six runes et absence de résultat périmé ; même
build avec constructeurs de contexte de l'écran, CLI réel, Worker
séquentiel et parallèle ; `testAurasPariteEcranCliEtCache` couvre le
contexte écran côté Node, `testRuneOptimParallelPairing` de **vrais
`worker_threads`** couvre le régime parallèle. Pour ce dernier, utiliser
un cas réel au-dessus du seuil de 100 M de paires ou déclarer un forçage
« FIDÉLITÉ : DIVERGE DE LA PROD » ; ne jamais faire passer le second pour
le premier. Aucun cas réel au-dessus du seuil n'est connu à ce jour : b4
mesure d'abord l'espace réel par `totalPairCount` (`runeBuildOptim.ts`,
utilisé par `runeBuildOptim.worker.ts`) sur les recettes gelées et le consigne ; faute
de cas, le forçage marqué est la preuve attendue du régime parallèle, pas un
échec du lot. La coquille Web Worker reste une vérification manuelle au
navigateur, sans Playwright sauf demande explicite. La recette externe
figée de a1 vise l'EHP : créer, geler et hacher une **seconde recette** en
« Dégâts réels » pour la preuve offensive. Avec ces deux recettes, vérifier
3 Fight externes, builds à 2 puis 3 Fight, EHP/dégâts/conditions et
Intangible. Distinguer une recherche `truncated=true` d'une preuve
exhaustive. `tsc`, tests ciblés, build, spec-lint, diff-check, sorties des
deux noms de champ et preuve `controle-6bis-b4.md`. Faire ensuite revoir
indépendamment coupes sûres, double compte et parité ; corriger les
objections et rejouer avant d'autoriser le lot 7.
**Ne fait pas :** rendu visuel ou contrôles de saisie du lot 7, fusion du
code sur `main`, suite complète `npm test` avant cette fusion.

**Résultat du lot 6bis-b4 — 2026-09-30.** Quatre commits : le harnais classe
« Dégâts réels » avec le contexte du CLI (`d716b7be`) ; les cartes « Dégâts
réels » et « PV effectifs » affichent `scoreDuCandidat`, avec les options du
tri affiché (`8d816ec3`) — la carte omettait la Conquête de la relique
retenue et « PV effectifs » la Ténacité, constat hérité de b2 confirmé et
corrigé ; le CLI affiche score, sets actifs, Intangible et auras propres des
20 premiers (`5772364d`) ; tests de parité des régimes et du cache T5
(`56ee3b99`). Reçu `56ee3b9` ↔ `ce2e842`, notes intégrées au main
documentaire `f1d40e7`. Preuve privée `controle-6bis-b4.md` (562 lignes).
Seconde recette gelée `recette-6bis-degats.json` (Lushen Rage + Fight,
« Dégâts réels »), sha256 `5f95fc47…`, composition et seuils fournis par
l'utilisateur. Le pilote a relu le diff et rejoué sur `56ee3b99` :
`npx tsc --noEmit` → 0 ;
`node tests/run.mjs auras artefact artifact relic diagnostic runeoptim` →
3 642 vérifications passées, 0 KO ; build, `spec-lint`, `git diff --check`
verts ; « Reçu valide » ; empreintes des deux recettes vérifiées. Rapportés,
non rejoués : régime parallèle RÉEL sur la recette « Dégâts réels »
(133,9 M paires, 4 tranches, recherche complète, mêmes 29 376 builds et
mêmes cinq premiers que le séquentiel) ; mutations des nouveaux tests. Sur
le vrai compte, un seul Fight propre : 2 et 3 Fight propres prouvés par
`testAurasPariteRegimes` seulement, régime forcé marqué. Écart : un
`sed -i` sur `tests/index.ts`, contre CLAUDE.md, résultat relu et correct.
Non prouvé : coquille Web Worker au navigateur, rendu réel des cartes,
Web Workers de construction des moitiés, optimum de la recette EHP
(tronquée).
**Pour la revue technique :** le JSDoc d'`aurasPropresParRunes` précède
désormais celui de `scoreDuCandidat` et documente la mauvaise fonction ;
`relicOracle.ts` porte une fonction locale homonyme `scoreDuCandidat` ; le
harnais rend « INCOHÉRENT — incomplet, motif non déductible » en parallèle
réel (ATQ 3000 / DC 220), non investigué ; `invariants.md` L35 → L37 (legs
de b3b).

##### 6bis-b5 — effets uniques de relique : règles communes et scission

**Cat. J ; requiert b4.** Demandes de l'utilisateur du 2026-09-30 (cartes et
tri, « Comparer », « Meilleurs artéfacts offensifs »), nées des constats de
b4. **Contre-revue indépendante du 2026-09-30 : à corriger** (intrant non
borné, relique des modes fixes à découvrir, mélange de paires dans
« Comparer », effet de la paire représentative sur la recherche, parité CLI
sous-estimée, tests qui n'exercent pas l'écran). Le pilote a vérifié chaque
objection dans le code et scinde le lot en **b5a → b5b → b5c**, chacun avec
sa preuve `controle-6bis-b5<x>.md`. La revue technique indépendante passe
après b5c et couvre les trois.

**Constats de départ, vérifiés par le pilote :**

- hors mode `recherche`, le tri et les cartes ignorent l'effet unique : la
  file ne renseigne `relique` qu'en recherche (`relicQueue.ts` L112, L210) ;
- « Comparer » l'ignore ET mélange deux paires : `statsReference` décrit la
  fiche, mais le profil passé est `realDamage.artefacts`, tiré de
  `searchArtifacts` (`OptimizerSection.tsx` L1661, alors que le commentaire
  L5034–5036 affirme l'inverse) ; l'écart peut être faux dans les deux sens ;
- paire représentative de la fiche : effet unique compté en EHP, pas en
  « Dégâts réels » ; elle alimente la RECHERCHE (stats collectées,
  `artFlatFige` et replis, `runeBuildOptim.ts` L3284–3287 et L4174–4202 au
  2026-09-30, L3368–3440 et L4290–4330 depuis b3c) ;
- « Meilleurs artéfacts » en « Dégâts réels » (`evaluerReel`) : effet unique
  absent ;
- CLI : l'effet unique n'entre que dans sa paire représentative EHP
  (`recipeToSearchParams.ts` L206–208) ; il trie les candidats collectés sans
  résoudre leur couple artéfacts/relique (`optimizer-search.ts` L391–427).

**Règles communes aux trois sous-lots :**

1. Relique par mode (`useOptimizerState.ts` L81) : `off` et `equipped` → la
   relique de la fiche sélectionnée (`selected.gear.relic`, y compris celle
   d'un build validé ; au CLI, `loaded.gear.relic` via `SearchParams.relic`) ;
   `recherche` → la relique retenue par la résolution du build ; résolution
   pas encore faite → apport neutre, **sans repli** sur la relique équipée ;
   aucune relique → apport neutre.
2. Un seul compte : la principale de la relique est déjà dans `c.stats` et
   `statsReference` (`stats.ts` L75–77). L'effet unique se calcule sur ces
   stats par `apportExclusive` et s'applique une fois, dans le score
   (`scoreDuCandidat`, `evaluerPourRegime`) ; jamais dans `computeStats` ni
   dans des stats mises en cache. L'évaluateur de paire applique déjà points
   et Ténacité : ne pas les rajouter à sa sortie.
3. Jamais dans les conditions min/max (`reliques.md` § 5).
4. Lignes 218–221 (A.2 ter, 2026-09-30) : points Bravoure/Éternité/Origine
   dans la stat lue, Conquête jamais. L'arrondi des points n'est pas relevé
   (`relicExclusive.ts` L145–150) : garder le comportement actuel, n'en
   inventer aucun.
5. Tests sur les **producteurs réels** : les options du tri affiché et la
   référence « Comparer » sont extraites d'`OptimizerSection.tsx` en fonctions
   pures, appelées par l'écran et testées directement, avec des attentes
   calculées indépendamment. `testAurasCarteEgaleTri` construit ses propres
   options (`auras-modele.test.ts` ~L843) : il ne détecte pas un oubli de
   l'écran.
6. Caches : les signatures portent déjà relique, contexte et empreinte
   (`artifactQueue.ts` L253–265, `relicOptim.ts` L197–204). Ajouter une
   mutation d'effet unique à identifiant constant et vérifier les
   dépendances de chaque nouveau mémo.

Volumes : somme des fenêtres de code et de spec de chaque sous-lot, calculée
sur ses bornes, hors socle documentaire (Partie A, B.0, invariants, README).

##### 6bis-b5a — cartes, tri, « Comparer » et CLI à relique fixe

**Cat. J ; requiert b4 et cette scission.** Intrant borné (≈ 721 lignes) :
`OptimizerSection.tsx` L1160–1195, L1655–1665, L2290–2345, L4965–5060 ;
`runeBuildOptim.ts` L930–1035 ; `relicExclusive.ts` L100–200 ;
`relicQueue.ts` L100–215 ; `stats.ts` L70–80 ; `scripts/optimizer-search.ts`
L370–440 ; `scripts/lib/recipeToSearchParams.ts` L180–215 ; `reliques.md`
§ 5 (L231–291) et § 8 (L338–357).

**Contrat :** les cartes « Dégâts réels » et « PV effectifs » et le tri
comptent l'effet unique dans les trois modes (règle 1), par
`scoreDuCandidat`. « Comparer » : pseudo-candidat de la fiche (ses stats,
`aurasPropresFiche`, `artifactDamageProfile(selected.gear.artifacts)`, sa
relique), noté par `scoreDuCandidat` avec des options propres à la
référence, jamais les accesseurs du cache des résultats ; le mélange de
paires est corrigé. CLI en `off` et `equipped` : `exclusiveDuBuild` depuis
`loaded.gear.relic`. Tri PV/ATQ/DEF : `scorerPour` consomme aussi l'effet
unique (`runeBuildOptim.ts` L1029) ; même règle dans les trois modes. b5a
vérifie si la carte affiche alors la valeur qui classe et consigne l'écart
éventuel, sans le corriger (hors demande). Réconcilier `reliques.md` § 8
avec le score implémenté, point par point, sources d'origine citées,
incertitude d'arrondi conservée.

**Preuves :** tests nommés, rouges puis verts, sur les fonctions extraites :
modes `off`, `equipped`, `recherche` résolue et non résolue, avec Conquête
puis Ténacité ; « Comparer » : écart nul à équipement identique, cas où les
paires diffèrent. CLI `off` sur `recette-6bis-degats.json` ; CLI `equipped`
sur une recette gelée à créer (sha256). `tsc`, tests ciblés, build,
spec-lint, diff-check ; `optimizer.md`, `reliques.md`, `invariants.md` ;
preuve `controle-6bis-b5a.md`.
**Ne fait pas :** « Meilleurs artéfacts » et paire représentative (b5b),
résolution CLI en recherche (b5c).

**Résultat du lot 6bis-b5a — 2026-09-30.** Cinq commits :

- `2e896bfa` : le tri et les cartes comptent l'effet unique dans les trois
  modes, par `optionsDeClassement`, producteur que partagent l'écran, le CLI
  et le harnais ;
- `41db8858` : « Comparer » note la fiche avec sa propre paire et sa
  relique (`scoreDeReference`) ;
- `ef88c08f` : le CLI passe par le même producteur en `off` et `equipped` ;
- hors contrat, acceptés par le pilote : `99513bcf`, l'ordre de base de
  l'écran compte l'effet unique d'une relique fixe (ordre affiché tel quel
  quand l'optimisation d'artéfacts est coupée) ; `d52d2e94`, le harnais
  classe comme le CLI (invariant « Harnais »).

Reçu `d52d2e9` ↔ `da2886f`, notes intégrées au main documentaire `9f2d15f`.
Preuve privée `controle-6bis-b5a.md` (837 lignes). Recette gelée
`recette-6bis-b5a-equipped.json`, sha256 `f4dc0a6c…`.

Le pilote a relu le diff et rejoué sur `d52d2e94` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs testRelicClassementParMode testRelicReferenceComparer`
  → 53 vérifications passées ;
- `node tests/run.mjs auras relic artifact` → 2 335 passées ;
- `npm run build` vert ; « Reçu valide ».

Rapportés, non rejoués :

- 12 KO avant correction, sur `off` et `equipped` ;
- écart « Comparer » à équipement identique : 260,95 en dégâts et 7 047,37
  en PV effectifs avant la correction, 0 après ;
- CLI sur Lushen : les 19 builds communs sont multipliés par 1,03986 et
  l'ancien n° 17 sort du top 20.

Écarts :

- commits 2 à 5 passés par un here-string PowerShell puis `git commit -F`,
  Bash refusant de démarrer ;
- `reliques.md` § 8 réconcilié sur une version périmée du fichier (incident
  A.5), puis fusionné dans la version restaurée.

Consigné sans correction (hors demande) : en tri PV/ATQ/DEF, la carte
affiche la stat hors combat alors que le tri compte les points de Bravoure,
Éternité et Origine (`optimizer.md`, `pistes.md`). Non prouvé : rendu réel
des cartes et de « Comparer », mode `recherche` au CLI (b5c), Ténacité et
Bravoure sur le vrai compte, lignes 218–221 avec les points (b5b).
**Pour la revue technique :**

- `relicOracle.ts` L267 trie ses candidats finaux sans l'effet unique de
  leur relique retenue ;
- sur Lushen, le rapport vaut 1,03986 au lieu de 1,04 : hypothèse « une part
  des dégâts échappe au terme `DMG%` » **réfutée** par la revue technique,
  qui l'attribue à la ligne 222 (voir « Revue technique 6bis-b ») ;
- l'écart carte/tri en PV/ATQ/DEF décrit plus haut ;
- l'oracle relique (garantie E) partage le moteur de runes, donc sa
  dominance ; le revérifier après 6bis-b3c.

##### 6bis-b3c — dominance et effet unique de la relique

**Cat. J ; requiert b5a (base de code) et la contre-revue de ce contrat.**
Défaut trouvé par la revue externe de la restauration, reproduit par le
pilote sur `d52d2e94`. Il est décrit dans `pistes.md`, entrée « DÉFAUT — la
dominance des runes ignore l'exclusive de la relique ».

`effetUtile` (`runeBuildOptim.ts` L1672-1679) ne protège le bonus d'un set
que si sa stat est une condition ou une stat de l'objectif. L'effet unique
de la relique peut pourtant rendre utile une autre stat :

- sa stat de référence `Y`, lue au début du combat, auras propres
  comprises (`RELIC_UNIQUE[type].stat`) ;
- la stat qu'il améliore (Bravoure → ATQ, Éternité → DEF, Origine → PV,
  `relicUniqueNature`).

Deux sets aux runes de stats identiques deviennent alors interchangeables,
et la dominance jette l'optimum.

**Cas minimal à rejouer**, recopié de la sonde :

- **Monstre** : base PV 10 000, ATQ 660, DEF 600, VIT 100, TC 15, DCC 50,
  RES 15, PRE 0.
- **Principales** par emplacement : 1 → code 3 (160), 2 → code 2 (63),
  3 → code 5 (160), 4 → code 2 (63), 5 → code 1 (2 448), 6 → code 2 (63) ;
  aucune sous-stat ; rang 6, rareté 5, niveau 15.
- **Pool** : Violent aux emplacements 1 à 4 (id 1 à 4) ; Will aux
  emplacements 5 et 6 (id 5, 6) ; Fight aux emplacements 5 et 6 (id 105,
  106).
- **Relique** : id 900, +6, principale code 100 à 9, effet unique type 4
  (Ténacité·ATQ), tranche 1 000, 1 %.
- **Recherche** : sets `['violent']`, sans minimum, objectif `ehp`,
  `slotFilterCap` 80, `maxMs` infini.

Attendu : Violent + Fight 125 627,78 (ATQ de début de combat 1 005,
réduction 1 %) contre Violent + Will 124 371,51. Aujourd'hui, les ids 105 et
106 tombent à l'étage de dominance.

**Intrant borné.**

- `runeBuildOptim.ts` :
  - L1607-1760 : commentaire, `contexteDominance`, `isSetComparable`,
    `isDominated`, `pruneDominated` ;
  - L654-680 : `objectiveKeysOf` ;
  - L762-800 : `objectiveScore` ;
  - L3550-3600 : `poolMinSlotSafe` ;
  - L3866-3960 : `prepareSearch`.
- `relicOptim.ts` L60-99 (`exclusiveChiffrable`, `relicUniqueNature`).
- `effects.ts` L346-370 (`SET_STAT_BONUS`) et L646-689 (`RELIC_UNIQUE`).
- `damage.ts` L3259-3270 (`STAT_DE_L_AURA`).
- `relicExclusive.ts` L100-200.
- `relicQueue.ts` L155-195 : filtre final avec la candidate et
  `conforme: false`, que l'oracle du mode `recherche` reproduit.
- Les trois autres appelants de `contexteDominance` (contre-revue du
  2026-09-30) :
  - `scripts/diagnostic-harness-parite.ts` L85-95, dont le commentaire
    promet un étage identique entre les deux chemins ;
  - `scripts/monster-search-rank-diag.ts` L60-66 ;
  - `tests/auras-modele.test.ts` L945-955.
- `tests/rune-optim-auras-coupes.test.ts` : l'oracle de b3b, sa note et
  `verifier()` (L235-252), repérés par grep.
- Commentaires périmés : `relicQueue.ts` L45-56 et `OptimizerSection.tsx`
  L2266-2283.

###### 6bis-b3c — contrat et preuves

**Contrat.**

- **Une seule règle de protection.** Une stat devient aussi « utile » dès
  qu'elle est la stat de référence (`RELIC_UNIQUE[type].stat`) ou la stat
  améliorée (`relicUniqueNature`) d'un type chiffrable (`exclusiveChiffrable`)
  porté par une relique que la recherche peut équiper :
  - relique fixe (`off`, `equipped`, contexte absent) : `params.relic` ;
  - mode `recherche` : l'union sur `relicContext.eligibles`, pris avant la
    dominance des reliques (`relicOptim.ts` L184-187, `RelicContext.eligibles`),
    donc un sur-ensemble sûr.

  Aucune restriction par objectif. `dimensionsRetenues` n'a aucun
  consommateur de production, et sa pertinence en « Dégâts réels » suit le
  scaling du sort, pas `objectiveStats` ni les passifs. Protéger une stat que
  le score ne lit pas ne coûte que de l'élagage.
- **Appelants.** L'information entre par un paramètre **obligatoire** de
  `contexteDominance`, pour que `tsc` signale chaque appelant. Les cinq
  appelants reçoivent la même information que la production, et le harnais
  de parité tient sa promesse d'un étage identique. Les régimes Worker
  transmettent `SearchParams` entier (contre-revue) : un test le confirme.
- **Périmètre de la modification.** Seule l'interchangeabilité des sets
  change. La comparaison des stats des runes, `DOMINANCE_MAX_POOL` et le
  score ne bougent pas. La rétention (`filterSlot`, clés de rétention) reste
  aveugle aux stats de l'effet unique, comme à toute stat hors objectif :
  hors périmètre, et la preuve le dit. `algo-verify` s'applique.
- **Oracle.** Il est exhaustif, part du pool **avant** préparation, et
  n'appelle ni `prepareSearch` ni ses coupes. **Sa note est celle de la
  production** pour l'équipement complet (A.6 bis) : `objectiveScore`, auras
  propres (`aurasPropresDesRunes`), `apportExclusive`. Artéfacts : aucun, ou
  la paire fixe `SearchParams.artifacts`, dont le profil est
  `artifactDamageProfile(params.artifacts)` en « Dégâts réels ».
  En mode `recherche`, un build est noté par la meilleure relique éligible
  **dont le couple passe `respecteConditionsAvecRelique`** avec la candidate
  à la place de `gear.relic`. Sans telle relique, le build n'est pas valide
  (production : `conforme: false`, jamais affiché).
- **Comparaison.** Même structure que `verifier()` de b3b, avec la note de
  production comme critère :
  - recherche complète : `truncated = false`, `explored` confronté à
    `totalPairCount` ;
  - aucun faux positif ; en mode `recherche`, compté après le filtre final
    de la résolution, jamais sur les candidats bruts (bornes relâchées) ;
  - même verdict de faisabilité ;
  - zéro faux rejet par une coupe sûre autre que la dominance (première
    coupe lue par le traceur) ;
  - l'optimum de la note de production conservé, et ses builds présents
    parmi les candidats (`findIndex`, jamais `candidates[0]`).

  La dominance a le droit de retirer un build valide, jamais l'optimum.
- **Commentaires.** Corriger les deux commentaires périmés (« minimums
  seuls, T11 »).

###### 6bis-b3c — preuves

- **Test nommé** : le cas minimal, rouge puis vert.
- **Couverture des 15 types chiffrables, sans cas vide.** Chaque cas
  réunit quatre conditions :
  - la stat protégée est hors conditions et hors `objectiveKeysOf` de la
    recherche ;
  - le score de l'objectif lit l'effet unique ;
  - le set porteur est formable. Swift est un 4 pièces : il faut au moins
    4 emplacements libres (set demandé de 2 pièces au plus, ou aucun) et
    4 runes Swift sur 4 emplacements distincts ;
  - le cas échoue sous la mutation (protection retirée).

  Repères, à confirmer par la mutation :
  - Conquête 1 à 3 en « Dégâts réels », avec un sort qui ne s'appuie pas
    sur la stat de référence ;
  - Ténacité 4 en « PV effectifs » ;
  - Bravoure 7 à 9 en « Dégâts réels », avec un sort sur l'ATQ ;
  - Éternité 10 et 11, Origine 13 et 14 en « PV effectifs » ;
  - Éternité 12 en « Dégâts réels » avec un sort sur la DEF ;
  - Origine 15 en « Dégâts réels » avec un sort sur les PV.

  `pvEffectifs` ne lit que PV et DEF (`runeBuildOptim.ts` L832-846).
  Ténacité 5 et 6 ne sont lues qu'en « PV effectifs », où leur stat de
  référence est déjà dans l'objectif. Un type dont les dépendances sont
  toujours déjà protégées là où le score le lit se justifie par un test qui
  prouve cette protection AVANT la correction, jamais par un cas vide.

  Sets porteurs : auras Fight, Determination, Enhance ; bonus de fiche
  Fatal, Guard, Energy, Swift.
- **Mode `recherche`** : deux reliques éligibles aux stats de référence
  différentes, et un minimum qui écarte l'une d'elles au filtre final pour
  un build.
- **Témoins sans changement** : sans relique, Régénération, type inconnu,
  objectif « Efficience ».
- **Différentiel** sur seeds fixes, puis **mutation** : retirer la nouvelle
  protection fait échouer chaque cas de couverture.
- **Performance.** Les recettes gelées ne portent aucun pool : elles
  tournent sur un export de compte.
  - Pour chacune (`recette-6bis-externe.json`, `recette-6bis-degats.json`,
    `recette-6bis-b5a-equipped.json`), nommer l'export et la relique portée
    ou le contexte, puis relever `interchangeables` avant et après.
  - « Aucune mesure de temps » n'est admis que si au moins un cas réel fait
    changer `interchangeables`. Faute de tel cas, en geler un (sha256) sur
    un vrai export avec une relique chiffrable.
  - Dès que `interchangeables` change : mesure selon
    `optimizer-perf-testing` (min, médiane, dispersion, répétitions
    entrelacées), au créneau sans concurrent confirmé par l'utilisateur.
- **Documentation** :
  - lever la réserve d'`invariants.md` (élagages sûrs, dominance) dans le
    même commit que le code, en ces termes : les stats dont dépend l'effet
    unique rejoignent la garantie de l'objectif, dans les mêmes limites,
    rétention heuristique comprise ;
  - fermer l'entrée de `pistes.md` ;
  - mettre à jour la section de dominance d'`algorithme.md` et
    `optimizer.md` s'il en décrit la portée ;
  - `spec-hygiene` (c) pour les invariants.
- **Contrôles** : `tsc`, tests ciblés, build, spec-lint, diff-check ;
  preuve `controle-6bis-b3c.md`.

**Ne fait pas :** changement du score, de la sélection de relique, de
`filterSlot` ou de la rétention ; suite complète `npm test`.

###### Résultat du lot 6bis-b3c — 2026-09-30

Deux commits :

- `756eb09c` : la dominance tient pour utiles la stat de référence et la
  stat améliorée de tout type chiffrable (`statsDeLEffetUnique`,
  `relicExclusive.ts`), pour les reliques que la recherche peut équiper
  (`reliquesEquipables`). Paramètre obligatoire de `contexteDominance`,
  cinq appelants raccordés. Le commit porte aussi le test nommé
  `rune-optim-dominance-relique` et les specs publiques.
- `ca15a281` : commentaires « minimums seuls » périmés corrigés.

Reçu `ca15a28` ↔ `61364e2`, notes intégrées au main documentaire `95c3f06`.
Preuve privée `controle-6bis-b3c.md`. Nouvelle recette gelée
`recette-6bis-b3c.json`, sha256 `9ec4ddf3…`. Commits de code poussés par le
pilote.

Le pilote a relu le diff et rejoué sur `ca15a281` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs dominance-relique` → 656 vérifications passées ;
- `node tests/run.mjs runeoptim auras intangible diagnostic relic` →
  3 474 passées ;
- `npm run build` vert ; « Reçu valide » ;
- la sonde du cas minimal : Violent + Fight (125 627,78) est rendu, les
  runes 105 et 106 passent la dominance, recherche non tronquée ;
- **mutation du pilote** (`statsDeLEffetUnique` vidé) : 54 échecs sur 656 ;
  fichier restauré depuis git, puis 656 passées ;
- l'oracle note par `objectiveScore` avec auras propres et
  `apportExclusive` ; en mode `recherche`, par `respecteConditionsAvecRelique`
  et la vraie résolution (A.6 bis tenu).

Couverture : les 15 types chiffrables, rouge → vert → échec sous mutation
pour 13 d'entre eux. Ténacité 5 et 6 sont déjà protégées par l'objectif,
prouvé par test.

Rapportés, non rejoués :

- `interchangeables` inchangé sur les trois recettes gelées existantes
  (export `ß☆Enzo`, Lushen du siège 15, relique Conquête·ATQ) ;
- sur la nouvelle recette, construite avec des runes imposées, Fatal devient
  protégé (1 878 → 1 881 runes après dominance) ;
- performance, 5 répétitions entrelacées : min 2 400 → 2 300 ms, dispersion
  8,3 % et 13,0 %, même travail (1 274 464 paires). Les deux côtés
  s'arrêtent au plafond de 100 000 candidats : aucun coût démontré, sur une
  recherche plafonnée.

Écarts acceptés :

- le rouge du différentiel a tourné sur une première version du test, et
  c'est la mutation qui tient lieu de rouge ;
- en mode `recherche`, le filtre final passe par la vraie résolution
  (`resoudreCandidat`) plutôt que par une copie ;
- le cas réel gelé repose sur des runes imposées ;
- quatre `export` ajoutés au test de b3b.

Limites :

- sous mutation, le différentiel aléatoire reste vert (constaté aussi par le
  pilote) : seuls les cas écrits à la main détectent le défaut ;
- la protection de la stat améliorée n'est nécessaire dans aucun cas, car le
  score ne la lit que si elle est déjà dans l'objectif. Elle est gardée comme
  sur-ensemble sans coût ;
- aucun cas réel connu où la correction change un optimum ;
  `tototriou-12889591.json` n'a pas été exploré ;
- la coquille Worker du navigateur n'a pas été exercée.

**Pour la revue technique :** cibler le générateur du différentiel (reliques
chiffrables, sets porteurs formables) pour qu'il détecte la mutation ;
mesurer la performance sur une recherche non plafonnée.

##### 6bis-b5b — « Meilleurs artéfacts » et paire représentative

**Cat. J ; requiert b5a, puis 6bis-b3c et O (ordre A.7).** Intrant borné,
recalé le 2026-10-01 sur `423be54c` après b5a et b3c (≈ 550 lignes) :

- `OptimizerSection.tsx` L1378–1468 (paire représentative : `artifactParams`,
  `searchArtifacts`) et L1470–1653 (bloc) ;
- `artifactEvaluation.ts` L80–170 ;
- `artifactOptim.ts` L890–925 ;
- `runeBuildOptim.ts` L3368–3440 (`deriveMinMaxContext` : `artFlatFige` et
  repli) et L4290–4330 (validation par `artPossibles`) ;
- `damage.ts` L3925–3945 et L4576–4586.

Depuis b3c, la dominance lit les reliques équipables (`reliquesEquipables`) ;
b5b n'y touche pas. A.6 bis s'applique à son différentiel : la note de
référence est celle de la production, effet unique compris.

**Contrat :** « Meilleurs artéfacts offensifs pour ce build » compte
l'effet unique de la relique de la fiche dans la valeur et dans l'écart à
la paire portée, pour les deux crans ; cran « Dégâts supplémentaires » :
points seulement (règle 4). Paire représentative : même règle en « Dégâts
réels » qu'en EHP. ⚠️ Elle alimente la recherche : `algo-verify`
s'applique. Différentiel avant/après, avec et sans `artifactBounds` (les
bornes explicites ne passent pas par l'évaluateur : `artifactOptim.ts`
L905–920) et avec le repli `artFlatFige`, en distinguant candidats
admissibles, stats provisoires et classement final. Aucune constante figée.

**Preuves :** tests nommés, rouges puis verts, par cran : Bravoure, Éternité
puis Origine augmentent le cran « Dégâts supplémentaires », principales
identiques entre témoins, recalcul par paire ; Conquête le laisse identique ;
cran « Dégâts réels » avec Conquête et Ténacité ; écart à la paire portée.
Différentiel de recherche sur seeds fixes et sur `recette-6bis-degats.json`.
Mesure de performance seulement si le volume collecté change, selon
`optimizer-perf-testing`. Preuve `controle-6bis-b5b.md`.
**Ne fait pas :** cartes, tri, « Comparer » (b5a), CLI en recherche (b5c).

**Résultat du lot 6bis-b5b — 2026-10-01.** Un commit, `597a0730` : un
producteur unique, `evaluateursArtefactsFiche` (`src/lib/artifactFiche.ts`),
sert la paire représentative et les deux crans. Cran « Dégâts
supplémentaires » : l'effet unique est recalculé paire par paire, et seuls
ses points entrent dans le brut. Cran « Dégâts réels » et paire
représentative en « Dégâts réels » : effet unique compté, comme en EHP.

Reçu `597a073` ↔ `76a4a2f` (904 fichiers), première base synchronisée
enregistrée par l'outil du lot O ; notes intégrées au main documentaire
`d9985f3`. Preuve privée `controle-6bis-b5b.md` (820 lignes). `reliques.md`
§ 8 : le point 2 renvoie aux tests ; l'arrondi des points reste ouvert.
Commit de code poussé par le pilote.

Le pilote a relu le diff et rejoué sur `597a0730` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs ArtefactsFiche` → 405 vérifications passées ;
- `node tests/run.mjs auras relic artifact` → 2 335 passées ; build vert ;
  « Reçu valide » ;
- **mutation du pilote** (effet unique retiré des deux crans de
  `artifactFiche.ts`) : 39 échecs sur 405 ; fichier restauré depuis git,
  puis 405 passées.

Rapportés, non rejoués :

- rouge de 14 échecs sur 44, sur un bundle jetable ;
- différentiel synthétique : 24 seeds × trois chemins (avec bornes, sans,
  repli `artFlatFige`) × avant/après. Avec bornes, candidats et classement
  final identiques ; les replis changent le volume dans 46 comparaisons.
  3 198 notes finales égales à `scoreDeReference`, la note de production
  (A.6 bis tenu) ;
- `recette-6bis-degats.json`, six recherches complètes : ensembles et
  classements identiques, et la note de la fiche (24 026,63) égale à la
  référence de production. La recette impose les artéfacts équipés : ses
  variantes avec bornes sont instrumentales ;
- mesure sur le seul repli synthétique sensible, écart sous la dispersion.

Écarts acceptés : lectures supplémentaires bornées pour raccorder les
producteurs réels ; scripts de contrôle dans `.claude/scratchpad/`, ignoré
par git ; dépendance de mémo `artefactsReserves` ajoutée à `artifactParams`.
Elle y était lue sans être déclarée : c'est un mémo périmé corrigé en
passant. Non prouvé : rendu React au navigateur, arrondi en jeu des points,
optimalité des rétentions heuristiques et des replis, coût navigateur,
parité CLI en recherche (b5c).

##### 6bis-b5c — CLI en mode recherche et parité finale

**Cat. J ; requiert b5b.** Intrant borné, recalé le 2026-10-01 sur
`31cf01be` (≈ 400 lignes) :

- `scripts/optimizer-search.ts` L380–475 (`optionsDuTri` par
  `optionsDeClassement`, tri, 20 premiers) ;
- `relicQueue.ts` L100–265 (`resoudreEquipementDuBuild`,
  `etatReliqueDuBuild`) ;
- `scripts/lib/relicDifferentiel.ts` L117–175 (`entreeResolution`,
  `resoudreCandidat`) ;
- `scripts/lib/recipeToSearchParams.ts` L180–215, inchangé ;
- `OptimizerSection.tsx` L2195–2300 (`faireParamsArtefacts`,
  `resoudreEquipement` : la résolution de l'écran).

`resoudreCandidat` sert déjà de résolution de production au test de
6bis-b3c (`tests/rune-optim-dominance-relique.test.ts`). A.6 bis s'applique
à la parité : la note de référence est celle de la production.

**Contrat :** en mode `recherche`, le CLI résout comme l'écran le couple
artéfacts/relique de chaque candidat collecté (`resoudreEquipementDuBuild`,
rejet des couples infaisables, stats et profils recalculés), puis trie par
`scoreDuCandidat` avec l'effet unique de la relique retenue. Mesurer le coût
de cette résolution sur les recettes gelées (`optimizer-perf-testing`) ; s'il
est prohibitif, s'arrêter et rapporter les options (A.6), sans rien borner
en silence.

**Amendement du 2026-10-01** (décision de l'utilisateur, option 2, après la
mesure de `controle-6bis-b5c-mesure.md`). La résolution de tous les
candidats est prohibitive avec des artéfacts « Libre » : 401,5 s de
résolution pour 20,3 s de recherche. Par défaut, le CLI résout donc comme la
file de l'écran : les 100 premiers de l'ordre de base et ses 20 lignes
imprimées, choisis par `prochainsATraiter`, jusqu'au point fixe.
`--resoudre-tout` résout chaque candidat collecté et reste la référence
exacte.

**Preuves :** recette gelée « recherche » à créer (sha256), avec une relique
retenue différente de l'équipée ; parité écran/CLI des cinq premiers et de
leurs scores dans les trois modes, l'écran étant représenté par les
fonctions extraites en b5a ; troncature signalée. Preuve
`controle-6bis-b5c.md`.
**Ne fait pas :** changement du moteur de recherche ni de la sélection de
relique elle-même.

###### Résultat du lot 6bis-b5c — 2026-10-01

Quatre commits, poussés :

- `808d2d36` : la paire représentative du CLI (`artefactsDuCli`) est notée
  par le producteur de l'écran (`evaluateursArtefactsFiche`) ; avant, son
  effet unique ne comptait qu'en PV effectifs ;
- `c77b34d6` : `entreeResolutionDuBuild` (`relicQueue.ts`) et
  `classementResolu` (`artifactQueue.ts`) extraits de l'écran, sans
  changement de comportement (règle 5 de 6bis-b5) ;
- `5ac720ca` : le CLI résout l'équipement de chaque build et classe par ces
  producteurs (`scripts/lib/classementCli.ts`) ;
- `b8b28f63` : option 2 (amendement ci-dessus).

Reçu courant `b8b28f6` ↔ `9ef88ae` (910 fichiers), après trois livraisons,
toutes intégrées ; main documentaire `9397cf9`. Preuves privées
`controle-6bis-b5c.md`, `-mesure.md` et `-option2.md`. Trois recettes
gelées : `recette-6bis-b5c-recherche.json` (sha256 `92b84606…`),
`-recherche-libre.json` et `-artefacts-libres.json`.

Le pilote a relu le diff et rejoué sur `b8b28f63` :

- `npx tsc --noEmit` → 0 ;
- les cinq tests nommés → 178 vérifications passées ;
- `node tests/run.mjs auras relic artifact resolution classement cli` →
  2 506 passées ;
- build, spec-lint, `git diff --check` verts ; « Reçu valide » ;
- extraction de l'écran relue : même assemblage que le code retiré ;
- **mutation du pilote** (la résolution note avec la relique portée au lieu
  de la candidate) : 15 échecs sur 133 ; fichier restauré depuis git, puis
  133 passées ;
- **vrai CLI** sur `recette-6bis-b5c-recherche.json` (empreinte vérifiée),
  bundle hors de l'arbre : « 100 build(s) sur 5100 … 0 rejeté(s) », n° 1 à
  29 938,0 avec la relique 521159 retenue au lieu de l'équipée 34315 ;
  résolution 104 ms pour 24,5 s de recherche.

Rapportés, non rejoués :

- parité exhaustive dans les trois modes (29 376, 29 376 et 5 100 scores
  égaux à `scoreDeReference`, A.6 bis tenu) ;
- parité du défaut avec la file de l'écran, déroulée en Node, sur quatre
  recettes ;
- rejet de 112 couples infaisables sur 469 (fixture) ;
- mesures : défaut entre 0,6 % et 40,9 % de la recherche.

Écarts acceptés : le CLI résout aussi en `equipped` (parité des trois
modes) ; représentative du CLI et extraction des producteurs, nécessaires à
la parité ; contrôle de source de b5a déplacé ; deux recettes gelées en plus
pour le pire cas. Non prouvé : ligne de troncature en situation réelle,
rejet sur compte réel, file réelle du navigateur, coût de `--resoudre-tout`
au-delà des cas mesurés.

**Découverte, pour la revue technique : la file de l'écran n'est pas
exhaustive en mode `recherche`.** L'ordre de base ignore la relique. Un
build qui monterait une fois résolu peut donc ne jamais être atteint par la
file (100 builds, `K_BUILDS_OPTIMISES`, calibré avant le mode `recherche`).
Sur une fixture faite pour cela, 9 des 20 premiers de l'exhaustif manquent,
dont les n° 2 et 5. Sur les quatre recettes réelles : aucun écart. L'écran
peut afficher un top qui n'est pas le meilleur ; aucune note n'est fausse
pour autant.
**Autres points pour la revue technique :**

- `relicDifferentiel.entreeResolution` reste une copie de l'ancien
  assemblage, sans `codesAmplification` ;
- `artefactsDuCli` ≡ `artifactParams` n'est tenu que par équivalence ;
- un écart d'environ ×3 entre les temps sous `tsx` et sous le bundle ;
- le rapport 1,03986 au lieu de 1,04, retrouvé (29 938,0 / 28 790,2) :
  élucidé par la revue technique (voir plus bas).

##### Revue technique 6bis-b — résultat et décisions

Revue indépendante du 2026-10-01 (Opus), sur `92841bc4`, lots b1 à b5c et
b3c, hors lot O. Preuve `controle-6bis-b-revue-technique.md`, archivée avec
ses sondes dans `revue-technique-6bis-b/` et intégrée au main documentaire
(`3b7d237`). **Verdict : corrections avant le lot 7.**

Rejoué par le pilote : la sonde du défaut B1, sans puis avec Intangible.
Vérifiés à la source : C2, C4, C5.

**Aucun double compte**, sur aucun chemin. Le rapport 1,03986 au lieu de
1,04 est **attendu**. La ligne 222 lit les PV de la cible, creusés coup par
coup : des coups plus forts réduisent son bonus sur les coups suivants. Sans
elle, ou avec une cible quasi infinie, le rapport vaut exactement 1,040000.
L'hypothèse « une part des dégâts échappe au terme `DMG%` » est donc fausse.

| Constat | Ce que c'est | Lot |
| --- | --- | --- |
| B1 | La dominance ignore les stats lues par les lignes 218–221 (« Dégâts réels ») : Energy, Guard, Enhance et Determination tombent. Masqué dès qu'une Intangible est dans le pool. | 6bis-b3d |
| C8 | Les oracles ne notent jamais avec des artéfacts ; le différentiel de b3c ne détecte pas sa propre mutation. | 6bis-b3d |
| C5, C6 | Verrous de sous-propriété : le CLI ≠ l'écran ; `relicDifferentiel.entreeResolution` est une copie divergente. | 6bis-b6 |
| C3, C4 | L'oracle relique (garantie E) est faux depuis b3c ; son tri ignore l'effet unique. | 6bis-b6 |
| C2 | Le régime parallèle annonce « complet » alors qu'une tranche s'est arrêtée sur son quota (antérieur au chantier). | 6bis-b7 |
| C1 | La file de l'écran n'est pas exhaustive en mode relique « recherche » : rangs 16, 17 et 19 manquants sur le vrai compte en PV effectifs. | 6bis-b8 |
| C7 | Le tri par PV/ATQ/DEF mêle la fiche et des points de début de combat. | 6bis-b9 |

Remarques sans lot : Taux Crit en mode Moyenne, décision du 2026-09-29, à
nommer dans `invariants.md` L37 (fait par b3d) ; legs de b4 (JSDoc,
homonyme), repris par b6.

**Décisions de l'utilisateur du 2026-10-01 :**

- **Contrainte commune : aucune correction n'alourdit ni ne ralentit le
  fonctionnement normal.** Chaque contrat ci-dessous la porte et la prouve.
- B1 : le corriger (b3d), sans coût dans le cas normal.
- C1 : la file résout **300 builds en mode relique « recherche »**, et **100
  en « Équipée » et « Off », inchangé**. **Aucun bandeau ni mention à
  l'écran** ; la limite ne s'écrit que dans les notes internes.
- C2 : seulement l'indicateur « tronqué », sans prolonger la recherche.
- C7 : option (a), le tri par stat classe sur la fiche.
- Ordre : les corrections passent avant le lot 7, après une contre-revue
  unique de leurs contrats. L'ordre initial (b3d → b6 → b7 → b8 → b9) a
  été amendé après cette contre-revue : voir le bloc suivant.

##### Contre-revue des contrats de correction — 2026-10-01

Contre-revue indépendante, sur `eac1862c`, des cinq contrats d'origine :
**tous à corriger**, dont deux bloquants.

- **b3d** : sa preuve d'identité tournait sur des recettes qui ne pouvaient
  rien montrer (« PV effectifs », ou Rage + Fight sans emplacement libre) ;
  la garantie « déjà protégé par le joker » est fausse pour un set formable
  seulement grâce à l'Intangible ; son intrant n'était pas borné (un champ
  requis casse 101 sites dans 39 fichiers).
- **b8** : la file tourne PENDANT la recherche, pas après.

Le pilote a vérifié les deux bloquants dans le code et amendé chaque contrat.

**Décisions de l'utilisateur du 2026-10-01, en réponse :**

- **b8** : 300 builds en mode recherche **dès la recherche**, pas seulement
  après. La contention se mesure, et un ralentissement au-delà de la
  dispersion s'arrête sur A.6.
- **b3d** : le surcoût rare de la correction est accepté. Il n'apparaît
  que là où le résultat actuel est faux : sans Intangible, ou pour un set
  formable seulement grâce au joker. Sur les recettes réelles avec
  Intangible, la sonde n'en voit aucun.
- **b9** : en cas d'égalité entre reliques dans un régime de stat, la
  **relique portée** l'emporte si elle est candidate.

**Nouvel ordre**, pour la dépendance b3d → b6 (l'oracle étendu par b3d-2
filtre, en mode recherche, par la copie que b6 corrige) :
b6 → b3d-1 → b3d-2 → b7 → b8 → b9.

##### 6bis-b6 — paramètres d'artéfacts partagés et outils de preuve relique

**Cat. J ; requiert la contre-revue (faite) ; premier des lots de
correction.** Constats C5, C6, C3, C4 et legs de b4 (revue § 4.2, § 4.3,
§ 2.3, § 5.2, § 5.7).

**Intrant borné.**

- `OptimizerSection.tsx` L1378-1468 (`artifactParams` : verrous neutralisés
  L1444, réservations L1423, `codesAmplificationActifs` L1449) ;
- `scripts/lib/recipeToSearchParams.ts` L170-330 (`artefactsDuCli`,
  `paramsArtefacts`) ;
- `scripts/lib/relicDifferentiel.ts` L60-175 (`ReglagesDifferentiel`,
  `entreeResolution`, `resoudreCandidat`) ;
- `scripts/lib/relicOracle.ts` L85-280, et L480-495 (sortie du CLI de
  l'oracle) ;
- `scripts/relic-differentiel.ts` L320-360 (traceur, optimum archivé) ;
- `relicQueue.ts` L240-300 (`entreeResolutionDuBuild`) ;
- `runeBuildOptim.ts` L925-1000 (JSDoc d'`aurasPropresParRunes`) ;
- tests dont l'attente peut changer : `relic-queue.test.ts` L60, L265-364 et
  L545 (« N identique — granularité (statistique, valeur) ») ;
  `auras-modele.test.ts` L347-355 et L617-632 ; `relic-differentiel.test.ts` ;
  `rune-optim-dominance-relique.test.ts` (par `resoudreCandidat`) ;
- sondes de la revue `sonde-verrous-cli.ts`, `sonde-oracle-e-groupe.ts`,
  `sonde-oracle-relique-l267.ts` et leurs recettes
  (`revue-technique-6bis-b/`).

**Contrat.**

- **C5** : un producteur pur des `ArtifactSearchParams` de la fiche,
  neutralisation des verrous comprise, appelé par l'écran **dans le même
  `useMemo`, avec les mêmes dépendances** (sinon `paireRepresentative` se
  recalculerait à chaque rendu), et par le CLI (`artefactsDuCli`). Écart
  documenté : le CLI n'a pas de liste, donc pas de réservations.
- **C6** : `relicDifferentiel.entreeResolution` passe par
  `entreeResolutionDuBuild` et par ce producteur. Le contrat de traduction
  s'écrit dans la preuve : comment `ReglagesDifferentiel` devient les
  entrées du producteur, d'où viennent `exclusive` (`setup`, `element`) et
  le `damageSetup` des amplifications.
- **C3** : l'oracle relique lance un run par couple
  `(principale, statsDeLEffetUnique([r]))`. C'est la seule chose qui, dans un
  run, distingue deux reliques d'un même groupe pour le moteur : la
  rétention ignore la relique, et la fusion renote tout. Invariant
  « Oracle (E) » amendé ; l'attente de `relic-queue.test.ts` L545 bascule,
  et la preuve le justifie.
- **C4** : `fusionnerRunsOracle` classe par `OracleCandidate.score`. Ordre
  des ex æquo : score décroissant, puis `rid` croissant, puis ordre
  d'insertion.
- Legs de b4 : JSDoc d'`aurasPropresParRunes` replacé avant sa fonction ;
  `scoreDuCandidat` local de `relicOracle.ts` renommé.
- **Contrainte du 2026-10-01** : l'écran garde exactement le même
  comportement. La preuve compare les champs des `ArtifactSearchParams`
  produits avant et après (copie figée de l'ancien corps du mémo dans le
  test), et les valeurs d'`evaluer` sur N paires. Un contrôle de source
  vérifie l'appel dans le `useMemo` et ses dépendances.

**Preuves.**

- Tests nommés, rouges puis verts : recette verrouillée (CLI = écran) ;
  oracle E sur deux reliques de même principale aux effets différents ;
  optimum de l'oracle égal au meilleur `score` ; égalité de
  `entreeResolution` avec la résolution du CLI sur une recette « Libre »
  avec buff (`codesAmplification`).
- Mutation qui retire la neutralisation des verrous : échec attendu.
- `node tests/run.mjs dominance-relique auras-coupes relic-queue relic auras`
  rejoué ; chaque attente modifiée est listée avec sa raison.
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b6.md`.

**Ne fait pas :** changement du moteur, du score, ni de la file.

###### Résultat du lot 6bis-b6 — 2026-10-01

Cinq commits, poussés :

- `d80274ba` : legs de b4 (JSDoc replacé, homonyme renommé) ;
- `810745a7` : un seul producteur des paramètres de paires
  (`parametresArtefactsFiche`, `src/lib/artifactFiche.ts`), appelé par
  l'écran dans le même `useMemo` et par le CLI, qui neutralise désormais les
  verrous (C5) ;
- `40ccc426` : le différentiel relique résout par les producteurs de
  l'écran, avec un canal exclusive obligatoire (C6) ;
- `72783391` : l'oracle lance un run par couple (principale, stats de
  l'effet unique) (C3) ;
- `4957a782` : l'optimum de l'oracle est son meilleur score, ex æquo par
  `rid` (C4).

Reçu `4957a78` ↔ `3e26c7f` (934 fichiers), notes intégrées au main
documentaire `946cab2`. Preuve privée `controle-6bis-b6.md`.

Le pilote a relu le diff de l'écran (appel dans le même `useMemo`, mêmes
dépendances) et rejoué sur `4957a782` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs artefactsficheparams relicoraclegroupes
  relicoracleoptimum` → 44 vérifications passées ;
- `node tests/run.mjs dominance-relique auras-coupes relic-queue relic auras
  cli` → 3 073 passées ;
- build, spec-lint, diff-check verts ; « Reçu valide » ;
- **mutation du pilote** (stats d'effet unique retirées de la clé de
  regroupement de l'oracle) : 5 échecs sur 266, dont l'optimum manqué et la
  granularité (b) ; fichier restauré depuis git, puis 266 passées.

Rapportés, non rejoués :

- rouge de 14 échecs sur 30 ;
- « écran identique » : 972 combinaisons d'entrées et 3 321 paires notées à
  l'identique, contrôle de source du `useMemo` ;
- mutation de la neutralisation des verrous : 7 échecs ;
- traduction de `ReglagesDifferentiel` vers les producteurs (§ 7 de la
  preuve) ;
- cas réel Ciri : N de 8 à 10, optimum et statut « fidèle » inchangés.

Attentes modifiées, justifiées dans la preuve : la note de « plan § 2.4
ex. 2 » compte désormais l'effet unique Origine (37 451,28 → 48 620,96) ; la
granularité (b) s'étend au cas qui bascule ; `resolution-partagee.test.ts`
fige sa référence, pour qu'elle ne devienne pas circulaire.

Écarts acceptés : `ReglagesDifferentiel.exclusive` rendu obligatoire, pour
que `tsc` désigne chaque appelant ; `sortesFigeesDe` partagé ; lectures hors
intrant listées. Relevé : un BOM entré dans un message de commit par la forme
`@'…'@ | git commit -F -` du brief, corrigé avant le push. Les briefs suivants
prescrivent seulement `git commit -F <fichier>`. Non fait : le journal de
l'orchestrateur (`relic-differentiel.ts` L222) ne distingue pas deux runs de
même principale. Non prouvé : mémoïsation React au navigateur ; C3 en
général, argument appuyé par les tests sans démonstration ; CLI avec
`ignoreArtifacts` vrai ; différentiel B.6 sur une recette réelle en
« Dégâts réels ».

##### 6bis-b3d-1 — dominance et lignes 218–221 : le correctif

**Cat. J ; requiert b6.** Constat B1 de la revue (§ 2.1), reproduit par le
pilote. En « Dégâts réels », les lignes d'artéfact 218–221 ajoutent un
pourcentage des PV, de l'ATQ, de la DEF ou de la VIT de combat (`damage.ts`
L4576-4580). Or `damageRelevantStats` exclut ces stats de l'objectif
(L5025-5040, décision de rétention), et la dominance reprend ce choix.

**Intrant borné.**

- `runeBuildOptim.ts` L1607-1720 (`reliquesEquipables`, `contexteDominance`,
  `isSetComparable`) ; les appelants L3594 et L3966 ; `poolMinSlotSafe`
  L3550-3600 ;
- `damage.ts` L495-580 (profil d'artéfacts), L4568-4584, L5025-5040 ;
- `artifactOptim.ts` L490-520 (`candidatsParSorte`, règles d'éligibilité) ;
- le producteur des `ArtifactSearchParams` livré par b6 et ses deux
  appelants ;
- `recipeToSearchParams.ts` L100-110 (`ignoreArtifacts` au CLI) ;
- sondes : `revue-technique-6bis-b/sonde-dominance-218.ts` ; celles de la
  contre-revue (`sonde-joker-b3d.ts`, `sonde-compte-b3d.ts`), à archiver dans
  le dossier de preuves de ce lot.

**Contrat.**

- Un champ de `SearchParams` porte **les stats lues par les lignes
  218–221 des artéfacts équipables AU-DELÀ de `params.artifacts`**. Le
  moteur l'unit toujours avec les lignes de la paire représentative : un
  constructeur qui ne le remplit pas reste juste pour une paire figée.
  - Calcul : l'union des lignes des candidats de `candidatsParSorte` sur les
    deux sortes (vue complète, sans verrous ni principale imposée : un
    sur-ensemble sûr), plus les lignes de `params.artifacts`. Le cas mixte
    (une sorte figée, l'autre « Libre ») et `ignoreArtifacts` au CLI sont
    couverts. Le CLI, sans réservations, a une union plus large :
    documenté.
  - Rempli par le producteur de b6, donc par l'écran et par le CLI ; un
    contrôle de source vérifie les deux.
  - Seulement en « Dégâts réels », le seul score de recherche qui lit ces
    lignes.
- `damageRelevantStats` ne change pas : la rétention garde la décision de
  l'utilisateur.
- `invariants.md` L35 et L37 et `algorithme.md` L79-84 amendés, avec le
  **Taux Crit en mode Moyenne nommé** comme décision du 2026-09-29.
- **Garantie de coût, définie précisément (décision du 2026-10-01).** Le
  cas normal est « un pool qui contient une Intangible après principale
  imposée et verrous ». Avec une Intangible, la règle du joker protège déjà
  les sets **complets avec leurs seules vraies runes** : pour eux, rien ne
  change. Un set formable SEULEMENT grâce au joker n'était pas protégé : le
  garder EST la correction, acceptée par l'utilisateur. Sans Intangible,
  l'écart (+2 à +4 % de runes après dominance sur le vrai compte) est aussi
  la correction ; il n'est pas chronométré, et c'est écrit comme limite.

###### 6bis-b3d-1 — preuves

- La sonde de la revue devient un test nommé : quatre porteurs (Energy,
  Guard, Enhance, Determination), rouge puis vert, plus le témoin sans
  ligne et la variante avec Intangible.
- Test nommé, rouge puis vert, d'un set formable seulement par le joker
  (Fatal sur trois emplacements + Intangible, Blade demandé, sort PV,
  ligne 219).
- **Branche « Libre »** : un test où la paire représentative ne porte pas
  la ligne mais où un autre artéfact éligible la porte, noté par la vraie
  résolution (`entreeResolutionDuBuild` → `resoudreEquipementDuBuild`). Une
  mutation qui réduit l'union à la paire représentative doit le faire
  échouer.
- **Identité dans le cas normal** : geler avec leur sha256 deux recettes
  « Dégâts réels » à emplacements libres (variantes `[rage]` et `[blade]`
  de `recette-6bis-b5c-artefacts-libres.json`), en relique `equipped` puis
  `recherche`. Relever `interchangeables` et le nombre de runes après
  dominance, avant et après, avec et sans Intangible. Attendu : identique
  avec Intangible. Sans Intangible, l'écart se consigne sans déclencher
  A.6.
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b3d-1.md`.

**Ne fait pas :** les oracles et le générateur (b3d-2) ; aucune mesure de
temps.

###### Résultat du lot 6bis-b3d-1 — 2026-10-01

Deux commits, poussés :

- `99463b70` : la dominance protège, en « Dégâts réels », les bonus de set
  dont la stat nourrit une ligne 218–221 (`statsLuesParLesLignes` :
  les lignes de la paire `artifacts`, toujours, unies au champ optionnel
  `statsLignesArtefactsEquipables`, que l'écran remplit dans
  `handleSearch` et le CLI dans `resolveStatsLignesArtefacts`). Le commit
  porte aussi le test nommé et trois specs publiques.
- `4e761e7e` : la note de l'oracle 218–221 égale `scoreDuCandidat`,
  candidat par candidat.

Reçu `4e761e7` ↔ `457ec7a` (968 fichiers), notes intégrées au main
documentaire `d4fbb27`. Preuve privée `controle-6bis-b3d-1.md`. Quatre
recettes gelées (`[rage]` et `[blade]`, relique `equipped` et `recherche` ;
sha256 `4c3eb265…`, `fab1fa70…`, `aff0e366…`, `d9a602a6…`).

Le pilote a relu le diff et rejoué sur `4e761e7e` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs dominancelignes` → 99 vérifications passées ;
- `node tests/run.mjs dominance auras-coupes artefactsficheparams runeoptim
  cli auras` → 2 953 passées ; build et spec-lint verts ; « Reçu valide » ;
- **mutation du pilote** (`statsLuesParLesLignes` vidé) : 17 échecs sur
  99, dont « Energy passe la dominance » et le cas `ignoreArtifacts` du CLI ;
  fichier restauré depuis git, puis 99 passées.

Rapportés, non rejoués :

- les quatre porteurs, rouges sur `f40e049f` (10 échecs sur 50, aux chiffres
  de la sonde de la revue), puis verts ;
- le set formable seulement par le joker, rouge puis vert ;
- la branche « Libre » par la vraie résolution, et la mutation « union
  réduite à la paire représentative » : 5 échecs sur 91 ;
- **garantie de coût tenue** : avec Intangible, `interchangeables` et les
  runes après dominance sont identiques sur les quatre recettes. Sans
  Intangible, c'est la correction : `[rage]` equipped 19 → 15
  interchangeables (2 563 → 2 622 runes), `[blade]` equipped 18 → 13
  (2 604 → 2 717), `[blade]` recherche 14 → 13, `[rage]` recherche inchangé.

Écarts acceptés :

- le champ est produit par une fonction voisine
  (`statsLignesArtefactsEquipables`), puisque `parametresArtefactsFiche`
  rend des `ArtifactSearchParams` ; le mémo figé par b6 ne change pas ;
- l'union passe par `candidatsParSorte`, qui applique la principale imposée
  et « Garder l'artéfact équipé » mais pas les verrous. La résolution les
  applique aussi : l'union reste un sur-ensemble de ce qu'elle peut équiper ;
- `ignoreArtifacts` au CLI : le champ reste absent, et le moteur lit la
  paire portée ;
- pas de rouge pour la branche « Libre » (le producteur n'existait pas) :
  la mutation en tient lieu ;
- `algorithme.md` reçoit deux sous-sections, pour un bloc qui dépassait la
  limite du lint.

Non prouvé : le navigateur (couvert par contrôle de source) ; le temps sans
Intangible, comme prévu ; un cas réel où l'optimum affiché change ; les
variantes Swift ×3 et Energy ×1 en tests nommés. La sonde `sonde-joker-b3d.ts`
est archivée telle quelle et ne compile plus (paramètre ajouté).

##### 6bis-b3d-2 — oracles avec artéfacts et différentiel ciblé

**Cat. J ; requiert b3d-1.** Constat C8 de la revue (§ 5.5).

**Intrant borné.** `tests/rune-optim-dominance-relique.test.ts` (oracle,
note, générateur L597-620) ; `tests/rune-optim-auras-coupes.test.ts` L80-130
(`criteresUtiles`) et L575-590 ; `scripts/lib/relicDifferentiel.ts`
(`resoudreCandidat`, corrigé par b6).

**Contrat.**

- L'oracle de b3c note avec une paire fixe tirée au hasard, portant
  parfois les lignes 218–221, dans un `RealDamageContext` à sort
  synthétique : c'est la note de production (A.6 bis).
- **L'oracle de b3b ne note pas** : il compare un maximum par critère, sans
  sort. Le critère de mutation des lignes 218–221 revient donc à l'oracle de
  b3c ; la cécité de celui de b3b s'écrit comme limite.
- Générateur ciblé : porteur sur assez d'emplacements, tranche placée entre
  le build porteur et le neutre, pools **sans Intangible** dans au moins la
  moitié des seeds. Trois pièges prévus :
  - l'effet unique de la relique protège souvent déjà PV, ATQ et DEF :
    prévoir des seeds sans relique, ou dont l'effet ne protège pas la stat
    de la ligne ;
  - Blade en mode « Moyenne » : exclu des tirages de `critMode`, puisque sa
    limite est une décision du 2026-09-29 ;
  - critère chiffré : chaque mutation (`statsDeLEffetUnique` vidé,
    protection 218–221 retirée) fait échouer au moins un scénario sur les
    seeds fixes.

**Preuves :** les deux mutations, rejouées, font échouer le différentiel
lui-même ; `tsc`, tests ciblés, spec-lint, diff-check ; preuve
`controle-6bis-b3d-2.md`.

**Ne fait pas :** changement de code de production.

###### Résultat du lot 6bis-b3d-2 — 2026-10-01

Deux commits de test, poussés, sans code de production :

- `9e56c343` : l'oracle de b3c note avec la paire fixe du cas (principale,
  lignes 218–221) et le mode critique tiré ; `verifier()` confronte sa note
  à celle de la production, candidat par candidat ; nouveau différentiel
  ciblé `testDominanceReliqueDifferentielCible` (seeds 6500..6559) ;
- `d00230e2` : la cécité de l'oracle de b3b, consignée en tête de
  `rune-optim-auras-coupes.test.ts`.

Reçu `d00230e` ↔ `0e6d663` (975 fichiers), notes intégrées au main
documentaire `5f5ac33`. Preuve privée `controle-6bis-b3d-2.md` et ses
sorties brutes (`6bis-b3d-2/`) ; nouvelle sous-section d'`algorithme.md`
« Vérification — oracle noté, paire tirée et différentiel ciblé ».

Le pilote a relu le diff et vérifié la note dans le code (A.6 bis) :

- relique fixe : `scoreDuCandidat` par `optionsDeClassement` ;
  `artefactsDuBuild` rend `null`, donc `scorerPour` retombe sur
  `realDamage.artefacts`, le profil de la paire du cas : c'est l'ordre de
  base de l'écran avec une paire figée ;
- mode `recherche` : `resoudreCandidat` avec `paireFixe` (b6 : « Garder
  l'artéfact équipé » ×2 par le producteur partagé), score du couple
  retenu par la vraie résolution.

Rejoué sur `d00230e2` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs dominance auras-coupes runeoptim` → 3 035
  vérifications passées, contrôles « note de l'oracle = note de
  production » compris ;
- build, spec-lint et `git diff --check` verts (spec-lint relancé en
  PowerShell après un `fork: Permission denied` de Bash) ; « Reçu valide » ;
- **mutation du pilote** (`statsLuesParLesLignes` ne lit que la première
  pièce de la paire, `artifacts.slice(0, 1)`) : 12 échecs sur 2 193, tous
  dans le différentiel ciblé, soit 11 scénarios « ligne » (seeds 6503,
  6510, 6511, 6513, 6531, 6535, 6538, 6544, 6547, 6553, 6558) plus la
  synthèse. L'ancien différentiel et les tests de b3d-1 restent verts :
  seul le différentiel ciblé voit un défaut partiel de la paire. Fichier
  restauré depuis git, puis 2 193 passées ;
- générateur par seed (`mulberry32(seed)`) : les tirages ajoutés en fin
  d'ancien différentiel ne changent pas ses scénarios antérieurs.

Rapportés, non rejoués :

- note = production sur 136 scénarios et 130 074 candidats, dont 32 464
  en mode `recherche` ; 103 scénarios avec paire tirée, dont 74 portent
  une ligne 218–221 ;
- mutations du contrat, sur le différentiel lui-même :
  `statsDeLEffetUnique` vidé, 26 scénarios « effet unique » en échec
  (82 échecs au total) ; `statsLuesParLesLignes` vidé, 30 « ligne » (49) ;
  les seeds en échec sont les seeds détectrices annoncées par le test ;
- générateur : 60 scénarios, 40 sans Intangible, 12 « ligne » sans
  relique, 14 en mode `recherche`, 15 en « Moyenne » sans Blade ;
  protection active dans 60, optimum qui exige les clones dans 56 ; les
  quatre autres (6523, 6530, 6536, 6559, mode `recherche`), où une autre
  relique éligible rend le porteur inutile, sont comptés à part ;
- l'oracle de b3b reste vert sous les deux mutations (920 vérifications).

Écarts acceptés :

- un différentiel ajouté plutôt que l'ancien remplacé : l'ancien
  (6400..6479) reçoit seulement la paire et le mode critique, tirés en
  dernier, et reste aveugle aux deux mutations, mesuré ;
- les échelles des lignes du générateur (`LIGNE_MAX`) sont des valeurs de
  test, pas des valeurs de jeu ; la paire tirée a toujours ses deux pièces.

Non prouvé : la branche « Libre » dans un différentiel aléatoire (seul le
test écrit de b3d-1 la couvre) ; les autres lignes d'artéfact, jamais
tirées (amplification 204–206 et 226, critiques 400–411, 222/223) ; la
mutation partielle qui retire seulement la stat améliorée de l'effet
unique. Aucun code de production : le navigateur est sans objet.

##### 6bis-b7 — troncature du régime parallèle

**Cat. J ; requiert b3d-2.** Constat C2 de la revue (§ 4.1), vérifié par le
pilote, antérieur au chantier. Une tranche qui atteint son quota s'arrête
(`pairBuckets`), mais `combineParallelPairingResults` ne déclare la
recherche tronquée que si le total atteint le plafond global, ou si une
tranche manque de temps.

**Intrant borné**, recalé le 2026-10-01 sur `32278567` (b3d-1 a décalé
`runeBuildOptim.ts`) :

- `runeBuildOptim.ts` L494-539 (`SearchResult`) et L4395-4497 (fin de
  `pairBuckets`, arrêt sur quota L4404, puis `combineParallelPairingResults`
  L4461) ;
- `src/workers/parallelPairing.ts` L85-160 ; `runeBuildOptim.worker.ts`
  L330-345 (`totalPairs`, choix du régime) ;
- `scripts/lib/diagnosticHarness.ts` L1612-1625 (`etatCompletude`) et
  L1812-1855 (`evaluerCompletude` : le motif y est DÉDUIT du plafond
  global) ;
- `OptimizerSection.tsx` L4870-4880 (message affiché) ;
- `invariants.md` L183 ; `parallelisation-partagee.md` § 4.1 (L192-206) ;
  `harnais-diagnostic.md` § 6.2 (L544-600), sous la dérogation de A.2
  étendue le 2026-10-01 ;
- tests dont l'attente bascule : `rune-optim-parallel-truncated.test.ts`
  L55-70 (cas « LE BUG CORRIGÉ ») ; `diagnostic-harness.test.ts` L390-440.

**Contrat.**

- Une tranche arrêtée sur son quota rend la recherche **tronquée**, à
  condition qu'il reste des paires non visitées (`explored <
  totalPairCount`) : une tranche pleine sur sa toute dernière paire ne
  déclare pas de troncature. `totalPairs` est déjà calculé pour choisir le
  régime (Worker L334, harnais) : il se transmet, jamais recalculé
  (contrainte du 2026-10-01).
- Le **motif** (quota de tranche, plafond global ou temps) est transmis par
  `combineParallelPairingResults` dans le résultat, pour le harnais et le
  CLI. `evaluerCompletude` le lit au lieu de le déduire, son JSDoc et
  `harnais-diagnostic.md` § 6.2 sont amendés. Sans cela, le harnais
  afficherait « motif : maxMs », faux.
- **Décision du 2026-10-01 : seul l'indicateur change.** Aucune exploration
  supplémentaire, ni quota partagé ; aucune relance n'existe, et le CLI est
  séquentiel.
- **Effet visible, à écrire** : sur ces recherches parallèles, l'écran
  affichera « Recherche interrompue après examen de N combinaisons —
  resserre tes critères » (`OptimizerSection.tsx` L4875).
- `invariants.md` L183 et `parallelisation-partagee.md` § 4.1 amendés.

**Preuves.**

- Test pur, rouge puis vert, sur `combineParallelPairingResults`, dont le
  cas « quota atteint sur la dernière paire ».
- Les deux tests qui figent l'ancienne attente sont listés, avec leur sortie
  rouge conservée et la justification de l'attente inversée.
- Le cas réel « ATQ 3000 / DC 220 » de b4 gelé en recette (sha256 et
  commande), puis rejoué en vrais `worker_threads` : le harnais rend
  « tronqué » avec le bon motif, et plus « INCOHÉRENT ».
- Témoin : un cas sous les quotas reste « complet ».
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b7.md`.

**Ne fait pas :** changement du partage des quotas, du séquentiel ni de
l'appariement.

###### Résultat du lot 6bis-b7 — 2026-10-01

Un commit, poussé par le pilote : `6d238d08`. Moteur, orchestration,
Worker, harnais, tests et `optimizer.md` § Interruption (dérogation A.2),
pour une même raison.

- `combineParallelPairingResults` reçoit `totalPairs`, celui qui a choisi
  le régime (Worker, harnais), transmis par `driveParallelPairing`, jamais
  recalculé. Une tranche pleine rend la recherche tronquée si
  `explored < totalPairs`.
- Le motif voyage dans `SearchResult.motifTroncature`, optionnel, posé par
  la fusion seule ; ordre : plafond global, temps, quota de tranche. Le
  harnais le lit ; le séquentiel le déduit toujours. La trace retenue porte
  le budget fusionné, copiée sans muter celle de la tranche.

Reçu de l'agent `6d238d0` ↔ `2e94db3` (977 fichiers), intégré au main
documentaire `b3601f5`. Preuve privée `controle-6bis-b7.md` ; recette gelée
`recette-6bis-b7-atq3000-dc220.json` (sha256 `6666e38c…dbba02`).

Le pilote a relu le diff et rejoué sur `6d238d08` :

- `pairBuckets` compte la paire (`explored++`) avant de pousser : un quota
  atteint sur la dernière paire laisse bien `explored` = total ;
- `npx tsc --noEmit` → 0 ; `node tests/run.mjs parallel diagnosticharness
  auraspariteregimes relicsearch runeoptim cli` → 2 342 passées ; build,
  spec-lint, diff-check verts ; « Reçu valide » ;
- **mutation du pilote** (`explored < totalPairs` → `<=`) : 4 échecs sur
  505, les assertions « dernière paire » des deux fichiers ; restauré
  depuis git, puis 505 passées ;
- **cas réel rejoué** par le harnais, même sha256, `maxMs` 600 000
  (recette), fidélité conforme, régime parallèle non forcé : « incomplet —
  raison : quotaTranche », `explored` 83 061 707 / 116 963 286, appariement
  12,2 s (mesure unique, non comparative).

Rapportés, non rejoués : le rouge (7 échecs sur 27, 4 sur 203) ; l'état
« avant » du cas réel (« INCOHÉRENT », même `explored`), obtenu par un
`git stash` dans le worktree du chantier, restauré ; le témoin sous les
quotas, complet (133 890 677 / 133 890 677).

Écarts acceptés : type du motif du traceur élargi ; libellé « DEUX motifs »
devenu « TROIS ». **Complément du pilote**, sur décision de l'utilisateur
(A.2) : notes de correction dans `harnais-diagnostic.md` (préambule, couvert
par la dérogation) et `harnais-diagnostic-extensions.md` (§ 3.5, 9.2, 9.3,
tableau) — la démonstration d'exclusion temps / quota reste juste, seule la
conclusion « tranche pleine = complète » était fausse ; skill
`optimizer-perf-testing` (`c0b20a94`). Reçu `c0b20a9` ↔ `affd6d5`, intégré
au main documentaire `9a28523`.

Non prouvé : la coquille Worker du navigateur (message à l'écran jamais vu
sur une vraie recherche) ; l'arrêt manuel d'une tranche, rangé sous `maxMs`
comme avant, non rejoué.

##### 6bis-b8 — la file de l'écran en mode relique « recherche »

**Cat. J ; requiert b7.** Constat C1 de la revue (§ 5.1). En mode
`recherche`, l'ordre de base note sans relique, et la file ne résout que la
page affichée puis les 100 premiers de cet ordre. Sur le vrai compte, en PV
effectifs, les rangs exhaustifs 16, 17 et 19 manquaient ; ils venaient des
rangs de base 107 à 117.

⚠️ **La file tourne PENDANT la recherche** (`useArtifactOptimQueue.ts`
L1-2 ; `OptimizerSection.tsx` L2062), sur le temps libre du fil principal.
L'invariant L101 (« ne ralentit jamais la recherche de façon perceptible »)
n'a été mesuré qu'à K = 100 (`optimizer.md` L2328).

**Intrant borné**, recalé le 2026-10-01 sur `4bf8e84a` :

- `src/hooks/useArtifactOptimQueue.ts` L1-30 (`K_BUILDS_OPTIMISES` L24) et
  L95-110 (usage L103) ;
- `src/lib/artifactQueue.ts` L140-170 (`prochainsATraiter` L145) ;
- `OptimizerSection.tsx` : `relicContextRecherche` L486-489, appel de la
  file L2207 ;
- `scripts/lib/classementCli.ts` L1-140 (usages L11, L37, L79, L130) ;
  `scripts/optimizer-search.ts` L425-455 (appel L439, message qui cite
  `K_BUILDS_OPTIMISES`) ;
- `scripts/artifact-contention-diag.ts` (mesure de contention) ;
- tests et textes qui changent : `cli-classement.test.ts` L49, L106, L147
  et L256 ; `optimizer.md` L1627-1640 et L2360-2378 ; `invariants.md` L77
  et L101 ; `algorithme-relique.md` L202 ; commentaires de
  `classementCli.ts` L11 et L79 ;
- sonde `revue-technique-6bis-b/sonde-file-marge.ts` et sa recette
  `recette-revue-ehp-libre.json`.

**Contrat (décisions de l'utilisateur du 2026-10-01).**

- Une fonction pure, `kDeLaFile(relicContext)`, partagée par l'écran et par
  `classementCli.ts`, rend **300 en mode relique « recherche »** et **100
  sinon**, **dès le début de la recherche**. Son entrée est le contexte de
  la recherche LANCÉE (`relicContextRecherche` à l'écran,
  `params.relicContext` au CLI), jamais l'état courant des réglages.
- « Équipée » strictement inchangé ; en « Off », il n'y a pas de file (le
  témoin y est trivialement vrai, et c'est écrit).
- Le mode recherche fait partie du fonctionnement courant : c'est le défaut
  de tout monstre sans relique (`useOptimizerState.ts` L67). L'utilisateur
  a accepté le coût en le sachant.
- **Aucun bandeau ni mention à l'écran.** La limite (le top en mode
  recherche reste une approximation) s'écrit dans `limites-connues.md`,
  `pistes.md` et `optimizer.md`.

###### 6bis-b8 — preuves

- Test nommé de `kDeLaFile`, plus un contrôle de source de ses deux appels
  (le dépôt n'a pas d'infrastructure de test React).
- Témoin « Équipée » : le même ensemble de builds résolus qu'avant, sur les
  recettes gelées.
- `recette-revue-ehp-libre.json` : rangs 16, 17 et 19 rattrapés (3
  manquants → 0), comparé à `--resoudre-tout`.
- Fixture de b5c : le reste des manquants consigné comme limite.
- **Mesure de contention** selon `optimizer-perf-testing`, au créneau
  confirmé par l'utilisateur : temps de la recherche avec la file à K = 100
  contre K = 300, en mode recherche, artéfacts « Libre », sur une recette
  réelle (`artifact-contention-diag.ts` ou équivalent fidèle). La charge est
  celle de la file en mode recherche (`resoudreEquipementDuBuild` par build,
  reliques éligibles comprises), pas `chercherPaires` seul, et le script
  affiche sa propre fidélité (coût par build, fourchette attendue) avant les
  temps. Aucune autre session ne tourne pendant la mesure. Min, médiane,
  dispersion, répétitions entrelacées. `invariants.md` L101 réécrit avec le
  chiffre mesuré. **Si la recherche ralentit au-delà de la dispersion :
  A.6, s'arrêter et rapporter le chiffre à l'utilisateur avant de livrer.**
- Les attentes et textes listés dans l'intrant, mis à jour avec leur
  raison.
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b8.md`.

**Ne fait pas :** critère d'arrêt prouvé, ordre de base optimiste ni bouton
« Classement exact ».

###### Résultat du lot 6bis-b8 — 2026-10-01

Deux commits, poussés : `28a765cd` (`kDeLaFile`, artifactQueue.ts, branchée
sur l'écran et le CLI, `K` obligatoire dans `useArtifactOptimQueue`, test
`testKDeLaFile` avec contrôle de source) ; `2594f1b4` (chiffres de la
mesure dans `optimizer.md`). Reçu de l'agent `2594f1b` ↔ `d3c186e`, intégré
au main documentaire `6fa5047`. Preuve privée `controle-6bis-b8.md`.

Le pilote a relu le diff et rejoué sur `2594f1b4` :

- `K` est dans les dépendances de l'effet de la file : un changement de
  mode entre deux recherches relance la boucle ; la signature, qui porte
  l'empreinte du contexte relique, vide le cache ;
- `npx tsc --noEmit` → 0 ; `node tests/run.mjs kdelafile artefactfile
  cliclassement classementresolu relicqueue` → 381 passées ; build,
  spec-lint, diff-check verts ; « Reçu valide » ;
- **mutation du pilote** (`kDeLaFile` rend 300 dès que le mode n'est pas
  `off`) : 3 échecs sur 69, les assertions « Équipée » du test et du CLI ;
  restauré depuis git, puis 69 passées ;
- **CLI réel rejoué** (`optimizer-search.ts`, recette
  `recette-revue-ehp-libre.json` sha256 `88f55b16…3dc5`, `--siege=15` comme
  la sonde) : 29 367 builds, 300 résolus en 1 lot ; les 20 lignes portent
  80 778,3, 80 730,4 et 80 537,6 aux rangs 16, 17 et 19, et 80 517,6 en
  20ᵉ ligne — les notes de la sonde.

Rapportés, non rejoués : la comparaison à `--resoudre-tout` (3 manquants
→ 0, 20 lignes identiques en ordre et en notes ; marge −1,00 % → +3,06 %) ;
le témoin « Équipée » sur trois recettes gelées (ensemble résolu
identique) ; les 9 manquants de la fixture (rangs de base 305 à 399),
limite écrite dans `limites-connues.md`, `pistes.md` et `optimizer.md` ;
la mesure, au créneau confirmé par l'utilisateur (22:22–22:34).

Mesure : charge de 77 ms par build (non effondrée). Une première campagne à
ordre fixe plaçait K = 300 toujours en dernier ; à ordre tourné, K = 300
contre K = 100 : +2,3 % (min), +1,3 % (médiane), dispersion 7,5 % —
**A.6 non déclenché**. À K = 300, la file n'a pas fini à la fin de
l'appariement (122 à 168 builds sur 300) : le reste se résout après la
recherche, ce qui retarde le classement final sans allonger la recherche.

**Découverte, décision de l'utilisateur pendant le lot** : la file
elle-même, K = 100 comme K = 300, allonge la recherche de ~8 à 10 %
contre une recherche sans file, dans les 11 répétitions (plancher formel
11 %), dans un montage Node pessimiste, jamais vérifié au navigateur.
Comportement antérieur au lot. Livré en l'état : `invariants.md` L101
réécrit avec ces chiffres et marqué « doute », `optimizer.md` requalifie
l'ancienne mesure (+0,3 %), piste ouverte dans `pistes.md`.

Non prouvé : rien n'a été exercé au navigateur (coquille Worker,
`requestIdleCallback`, coût réel de la file).

##### 6bis-b9 — le tri par PV, ATQ ou DEF classe sur la fiche

**Cat. J ; requiert b8.** Constat C7 de la revue (§ 5.4). `scorerPour`
(`runeBuildOptim.ts` L1123) classe sur la fiche plus les points de
Bravoure, Éternité et Origine, sans les auras, le lead ni l'invocateur ; la
carte affiche la fiche. Même mélange dans l'évaluateur de paire des
régimes `hp`, `atk` et `def` (`artifactEvaluation.ts` L165-172).

**Intrant borné**, recalé le 2026-10-01 sur `0336257e` :
`runeBuildOptim.ts` L1110-1160 (`scorerPour` L1127, tri par stat L1158) ;
`artifactEvaluation.ts` L90-175 (`evaluerPourRegime`, régimes de stat
L165) ; `relicOptim.ts` L430-460 (`bestRelicForBuild` L432, ex æquo L452) ;
`tests/relic-exclusive.test.ts` (`testRelicClassementParMode` L323,
attentes PV/ATQ/DEF L395-403, et L407-411 « le tri classe sur 2 500 —
écart non corrigé », qui bascule) ; `optimizer.md` L1654-1658 (l'écart
consigné par b5a) ; `invariants.md` L76, L77 et L237 ;
`algorithme-relique.md` L130-150 (choix entre candidates, ex æquo L139).

**Contrat (décisions de l'utilisateur du 2026-10-01).**

- **Option (a)** : le tri par stat et l'évaluateur de paire des régimes
  `hp`, `atk` et `def` jugent la **fiche**, sans les points de relique,
  comme la carte et les conditions min/max. Une seule expression pour les
  trois. Le calcul retiré ne coûte rien.
- **Conséquence voulue, à écrire** : `adapterArtefactsAuTri` étant vrai par
  défaut, le régime d'équipement suit le tri (régime unique, D7). En mode
  recherche, quand on trie par stat, une relique Bravoure, Éternité ou
  Origine n'est plus préférée pour ses points : la relique et la paire
  affichées peuvent changer.
- **Ex æquo dans un régime de stat (décision a)** : la relique **portée**
  l'emporte si elle est candidate, sinon la plus petite `id`. Les régimes
  « Dégâts réels », « PV effectifs » et `aucun` gardent leur règle, et
  l'oracle relique, qui n'utilise pas les régimes de stat, n'est pas
  touché.

**Preuves.**

- Test nommé : la carte égale le tri, sur un build qui franchit une tranche
  de Bravoure.
- Test nommé : mode recherche, tri ATQ, deux reliques de même principale
  dont une Bravoure. La relique portée l'emporte à égalité.
- Les attentes modifiées (`testRelicClassementParMode`, L410) sont listées
  avec leur raison. Témoins : « Dégâts réels » et « PV effectifs »
  inchangés.
- `invariants.md` L76, L77 et L236 et la doc relique amendés.
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b9.md`.

**Ne fait pas :** tri sur les stats de début de combat (option b, écartée).

###### Résultat du lot 6bis-b9 — 2026-10-01

Deux commits, poussés :

- `4fa6ad5c` : `scorerPour` (tri par stat) et `evaluerPourRegime`
  (régimes `hp`, `atk`, `def`) lisent la même expression, `statTotal` sur
  la fiche — principale de la relique comprise, effet unique exclu ; un
  calcul retiré ; `optimizer.md` remplace l'écart consigné par b5a par la
  règle et écrit la conséquence voulue ;
- `f3aa265d` : départage en régime de stat — la relique portée l'emporte si
  elle est parmi les meilleures, sinon la plus petite `id`
  (`bestRelicForBuild`, `departagePortee`) ; `EntreeResolution.regimeDeStat`
  obligatoire, `tsc` a désigné les quatre constructeurs de test.

Reçu de l'agent `f3aa265` ↔ `fb8d549` (1 006 fichiers), intégré au main
documentaire `e833f21`. Preuve privée `controle-6bis-b9.md`.

Le pilote a relu le diff et rejoué sur `f3aa265d` :

- l'oracle relique appelle `bestRelicForBuild` sans `departagePortee` :
  garantie E inchangée ;
- `npx tsc --noEmit` → 0 ; `node tests/run.mjs triparstatsurlafiche
  departagereliqueportee relicexclusive relicclassementparmode relicqueue
  cliclassement artifactevaluation artefactsficheparams relicoracle
  resolutionpartagee artifactficherecherche` → 598 passées ; build,
  spec-lint, diff-check verts ; « Reçu valide » ;
- **mutation du pilote** (départage par la portée étendu à tout régime
  noté) : 1 échec sur 337, le témoin « PV effectifs » (695 au lieu de
  690) ; restauré depuis git, puis 337 passées ;
- piste « Tri par PV, ATQ ou DEF » fermée dans `pistes.md` avec ses
  commits, en même temps que `optimizer.md` (règle du ledger).

Rapportés, non rejoués : rouge (anciennes attentes sur le nouveau code,
6 échecs sur 735 ; nouveaux tests sur `ed57e8f0`, 15 sur 36) ; carte = tri
dans les trois modes et `classementResolu` (A 2 500, B 2 450, A devant) ;
témoins « Dégâts réels » (Bravoure retenue, +300 ATQ) et « PV effectifs »
(plus petite `id`).

Écarts acceptés : deux commits pour deux décisions ; `reliques.md` précisé
(L429, effet unique hors tri par stat) après une livraison intermédiaire
puis `rafraichir` sans changement ; nouvelle section d'`algorithme-relique.md`
pour la limite du lint ; garde `!` remplacée par le repli de `statTotal`
(`computeStats` garantit les huit lignes).

Non prouvé : navigateur (carte, sélecteur de tri, file) ; nombre de builds
dont la relique ou la paire change sur le vrai compte quand on trie par
stat. Le CLI ne trie que par objectif : non concerné.

##### 6bis-b10 — un build écarté à la résolution sort du compte, en direct

**Cat. J ; requiert b9.** Constat de l'utilisateur au navigateur, le
2026-10-01, reproduit par le pilote au CLI. Recette Kinki gelée
(`archive/controles-degats-aura-2026-09/recette-6bis-b10-kinki.json`,
sha256 `89175dd5…7614` ; relique « recherche », artéfacts « Libre »,
minimums PV, ATQ, DEF, VIT et RES) : le moteur collecte 1 build sur une
recherche complète, la résolution exacte le rejette faute de couple
artéfacts/relique faisable (`constat-6bis-b10-cli-kinki.txt`). L'écran
retire bien le build (`classementResolu`), mais garde « 1 combinaison(s)
trouvée(s) » au-dessus d'une liste vide, sans explication : le bloc
« suffirait » et le diagnostic ne s'affichent que si le MOTEUR n'a rien
trouvé. Le CLI, lui, imprime « Aucun build ne reste… ». Défaut antérieur
au chantier (relique, lots 5b-5c).

**Intrant borné**, relevé le 2026-10-01 sur `2f56de5f` :

- `OptimizerSection.tsx` : `fullSortedCandidates` L2064 et le nombre de
  pages L2087 ; `affichees` et `pageCandidates` L2331-2342 ; la ligne de
  progression L4583 ; l'en-tête du compte L4629-4640 ; la visibilité du
  sélecteur « Adapter les artéfacts et reliques au tri » L4651 ; les blocs
  à zéro L4717, L4757 et L4807 ;
- `src/lib/artifactQueue.ts` : `ResultatArtefacts.conforme` L88,
  `classementResolu` L372-397 ;
- `src/hooks/useArtifactOptimQueue.ts` : `PUBLICATION_MS` L36 (cadence de
  publication du cache) ;
- `scripts/optimizer-search.ts` L462 (message du CLI) ;
- `optimizer.md` § Résultats ; `invariants.md` L74 (bloc « suffirait »)
  et L235 (un build sans couple faisable n'est jamais affiché).

**Contrat (décisions de l'utilisateur du 2026-10-01).**

- **Le compte affiché est celui des builds affichables** : trouvés par le
  moteur, moins ceux que la résolution a écartés (`conforme: false`).
  Une seule fonction pure, partagée et testée, alimente l'en-tête, la ligne
  de progression et le nombre de pages ; plus aucun compte affiché ne lit
  `result.candidates.length` ni `progress.found` brut.
- **En direct** : dès qu'un build est résolu et écarté, il sort du compte,
  en pleine recherche, à la cadence de publication du cache de la file,
  sans attendre la fin. Pendant la recherche, la base reste le compte du
  moteur (`progress.found`), diminué des rejets déjà résolus.
- **À zéro après rejet** : l'en-tête dit « Aucune combinaison ne répond à
  ces critères », puis une ligne de raison sur ce modèle : « 1 combinaison
  trouvée par la recherche a été écartée : aucune paire d'artéfacts ni
  relique réelles ne tient toutes les conditions. » Hors mode
  « recherche », la relique est celle de la fiche : la ligne ne parle que
  de la paire. Libellé exact fixé par le lot, dans ce sens.
- **Le bloc « suffirait » et le diagnostic de faisabilité gardent leur
  condition** (moteur vide) : leurs chiffres viennent des bornes du
  moteur, pas de la résolution exacte. Ils ne s'affichent pas sous un zéro
  dû aux rejets (décision du 2026-10-01).
- Un build jamais résolu (au-delà de K) reste compté : état « en attente ».
  Sans optimisation d'artéfacts, pas de file, rien ne change.
- **Aucun coût dans le cas normal** : rejets = candidats reçus
  (`fullSortedCandidates.length`) moins affichables (`affichees.length`),
  deux longueurs déjà calculées à chaque publication ; pendant la
  recherche, compte = `progress.found` moins ces rejets. ⚠️ Jamais compter
  les entrées `conforme: false` du cache : il n'est vidé qu'au changement
  de signature (`useArtifactOptimQueue.ts` L127-130), et une recherche
  relancée aux mêmes réglages garde les rejets de la précédente, y compris
  pour des builds qu'elle n'a pas (encore) trouvés.

**Preuves.**

- Test nommé de la fonction de compte, rouge puis vert : 1 trouvé et 1
  écarté → 0 et ligne de raison ; 3 trouvés et 1 écarté → 2 ; un build en
  attente reste compté ; sans file, compte inchangé ; pendant la recherche,
  `progress.found` moins les rejets.
- Contrôle de source : en-tête, ligne de progression et pagination lisent
  cette fonction.
- Recette Kinki gelée rejouée au CLI : 1 trouvé, 1 écarté.
- **Navigateur, par l'utilisateur** (le pilote ouvre le serveur de dev) :
  recette Kinki, 0 et ligne de raison ; une recette ordinaire, compte
  inchangé.
- `optimizer.md` § Résultats et une entrée d'`invariants.md` ; `tsc`, tests
  ciblés, build, spec-lint, diff-check ; preuve `controle-6bis-b10.md`.

**Ne fait pas :** consulter les builds écartés (option écartée par
l'utilisateur), modifier le bloc « suffirait », la résolution ou le
moteur.

###### Résultat du lot 6bis-b10 — 2026-10-02

Un commit, poussé : `fd9d7f52` — `compteAffichable` (artifactQueue.ts),
l'écran (en-tête, ligne de progression, pagination, ligne de raison), le
test `testCompteAffichable` et `optimizer.md` § Résultats. Notes : entrée
nouvelle d'`invariants.md` (L75), preuve `controle-6bis-b10.md`. Reçu de
l'agent `fd9d7f5` ↔ `12a0296`, intégré au main documentaire `9479774`.

Le pilote a relu le diff et rejoué sur `fd9d7f52` :

- rejets = reçus moins affichables, jamais le cache de la file ; trois
  lecteurs du compte, et la page courante ramenée sur la dernière si le
  nombre de pages diminue ;
- `npx tsc --noEmit` → 0 ; `node tests/run.mjs compteaffichable
  cliclassement classementresolu artefactfile relicqueue kdelafile` → 402
  passées ; build, spec-lint, diff-check verts ; « Reçu valide » ;
- **mutation du pilote** (ligne de raison dès qu'un build est écarté, même
  si le compte n'est pas nul) : 2 échecs sur 21 ; restauré depuis git,
  puis 21 passées.

Rapportés, non rejoués : rouge, 14 échecs sur 21 avec une version
provisoire reproduisant l'ancien comportement ; CLI Kinki sur `fd9d7f52`,
1 trouvé et 1 rejeté.

Interprétations de l'agent, acceptées par le pilote : « Trier par » se
masque aussi sous un zéro dû aux rejets (même condition que « Adapter… ») ;
le nombre de pages se calcule sur la liste réellement paginée (l'aperçu est
plafonné à 3 000 pendant la recherche, le compte du moteur non : des pages
vides sinon) ; pendant la recherche, un zéro par rejets garde l'en-tête
« … pour l'instant — recherche en cours… » avec la ligne de raison, et
« Aucune combinaison ne répond à ces critères » n'apparaît qu'à la fin.

**Vérifié par l'utilisateur au navigateur, le 2026-10-02** (recette Kinki) :
le compte retombe à 0, avec la ligne « 1 combinaison trouvée par la
recherche a été écartée : aucune paire d'artéfacts ni relique réelles ne
tient toutes les conditions. » Non vus : le retour sur la dernière page et
le masquage des deux contrôles.

À la même occasion, l'utilisateur relève que, **pendant une recherche**, la
résolution des builds de la page affichée traîne : lot 6bis-b11.

##### 6bis-b11 — la page affichée se résout sans attendre l'inactivité

**Cat. J ; requiert b10.** Constat de l'utilisateur au navigateur, le
2026-10-02 : pendant une recherche, les builds affichés restent longtemps
« artéfacts pas encore optimisés », ce qui ne lui convient pas. Diagnostic
du pilote, déduit du code, non mesuré au navigateur : la page passe déjà
EN TÊTE de la file (`prochainsATraiter`, `artifactQueue.ts` L196-198),
mais la file ne traite qu'un build par créneau d'inactivité
(`requestIdleCallback`, attente maximale 1 s, `useArtifactOptimQueue.ts`
L43-54). Pendant une recherche, l'écran reçoit la progression toutes les
150 ms et retrie l'aperçu : il est rarement inactif, et chaque build peut
attendre jusqu'à une seconde, alors qu'il coûte peu (8 ms pour la recette
Kinki au CLI, ~77 ms en « Dégâts réels », artéfacts « Libre », 4 reliques).

**Décision de l'utilisateur du 2026-10-02** : d'abord cette solution
simple ; un Worker dédié à la résolution seulement si elle ne suffit pas,
dans le chantier dédié que le lot 14 transmet (coût de la file).

**Intrant borné**, relevé le 2026-10-02 sur `0185d4df` :

- `src/hooks/useArtifactOptimQueue.ts` (218 lignes) : en-tête L1-15
  (pourquoi pas de Worker), `planifierInactif` L43-54, effet de la boucle
  L132-205 (`reveiller` L145, `publier` L154, `tranche` L161) ;
- `src/lib/artifactQueue.ts` : `prochainsATraiter` L160-218 ;
- `OptimizerSection.tsx` : appel de la file L2196-2215, `pageAfficheeRef`
  L839 et L2362 ;
- `tests/artefact-file.test.ts` (tests de `prochainsATraiter`) ;
- `optimizer.md` L2428-2461 (contention, la page passe en premier) ;
  `invariants.md` L101.

**Contrat.**

- **Deux voies.** Tant que la page affichée contient des builds non
  résolus, la tranche suivante se planifie SANS attendre l'inactivité
  (tâche immédiate, par exemple `MessageChannel` ou `setTimeout(0)`) ;
  sinon, la voie actuelle (`requestIdleCallback`) sert l'avance de fond,
  les K premiers. Une fonction pure décide de la voie, à partir de la page
  et du cache ; elle est testée.
- **Toujours un seul build par tâche**, la main rendue au navigateur entre
  deux : jamais de boucle qui garde le fil.
- **Publication** : la cadence de 400 ms reste ; la publication est forcée
  quand le dernier build non résolu de la page vient de l'être, pour que
  les cartes se mettent à jour sans attendre.
- Inchangés : l'ordre de `prochainsATraiter`, K, le cache, la signature,
  le coût de la résolution.
- **Contrainte de l'utilisateur** : le travail total est le même (les mêmes
  builds, résolus plus tôt), et la voie prioritaire est bornée à la page
  (20 builds). La recherche tourne dans des Workers ; le lot l'écrit, et
  dit ce qui n'est pas mesuré.
- **Critère de bascule vers le Worker** (décision du 2026-10-02) : si,
  après ce lot, la page affichée met encore plus de quelques secondes à se
  résoudre pendant une recherche, ou si la barre de progression gèle
  visiblement, on passe au Worker dédié.

**Preuves.**

- Test nommé de la fonction de voie, rouge puis vert : page avec des
  builds non résolus → voie prioritaire ; page entièrement résolue ou vide
  → voie de fond ; rien à traiter → aucune.
- Contrôle de source : la voie prioritaire n'utilise pas
  `requestIdleCallback`, la voie de fond si ; un build par tâche ;
  publication forcée à la fin de la page.
- `tests/artefact-file.test.ts` et les tests de zone restent verts.
- **Navigateur, par l'utilisateur** (le pilote ouvre le serveur de dev) :
  pendant une recherche en mode relique « recherche », artéfacts « Libre »,
  la page affichée perd ses « artéfacts pas encore optimisés » en quelques
  secondes ; une autre page ouverte aussi ; pas de gel visible.
- `optimizer.md` et `invariants.md` L101 amendés ; `tsc`, tests ciblés,
  build, spec-lint, diff-check ; preuve `controle-6bis-b11.md`.

**Ne fait pas :** Worker dédié, changement de K, de l'ordre de la file, du
coût de la résolution ou du throttle de progression.

###### Résultat du lot 6bis-b11 — 2026-10-02

Un commit, poussé : `bfe6f6d7` (`voieDeLaFile`, hook à deux voies,
`testVoieDeLaFile`, `optimizer.md`). Reçu de l'agent `bfe6f6d` ↔ `f17ad7e`,
intégré au main documentaire `8f26d5b`. Preuve privée
`controle-6bis-b11.md`.

Code validé par le pilote sur `bfe6f6d7` : une seule tâche en attente,
piège du changement de page traité (tranche de fond annulée, page
replanifiée), un build par tâche ; `tsc` 0, tests de zone 433 passés,
build, spec-lint, diff-check verts, « Reçu valide » ; **mutation du
pilote** (publication forcée à la fin de la page retirée) : 1 échec sur
76, restauré (sha256 du hook `831a0dc5`, identique au commit). Écart
accepté : file vide, rien n'est plus programmé (avant, chaque créneau
d'inactivité republiait et retriait l'aperçu) — déduit du code.

**Vérification de l'utilisateur au navigateur, le 2026-10-02 : critère
non tenu.** Pendant la recherche, l'écran saccade au point d'être
désagréable ; sur la première page, la première relique est résolue, les
suivantes arrivent après plusieurs secondes, voire dizaines de secondes.

Lecture du pilote, dans le code, non mesurée : à chaque message de
progression (150 ms), l'écran retrie tout l'aperçu en recalculant le
score de chaque candidat (`fullSortedCandidates`, `OptimizerSection.tsx`
L2064-2084 ; en « Dégâts réels », un calcul de combat par candidat), puis
le reclasse (`classementResolu`) et réaffiche. Ce travail peut saturer le
fil de l'écran indépendamment de la file ; la voie prioritaire s'y ajoute.
Un Worker de résolution seul ne réglerait pas des saccades dues au tri.
**Suite : mesurer avant de corriger** (lot 6bis-b12). `bfe6f6d7` reste dans
la branche en attendant ; rien n'est publié.

##### 6bis-b12 — ce qui sature l'écran pendant une recherche, mesuré

**Cat. C (mesure) ; requiert b11.** Décision de l'utilisateur du
2026-10-02 : mesurer avant de corriger, par un agent qui pilote un
Chromium sans affichage (skill `run-sw-forge`, accord explicite donné).
Aucun code de production ne change.

**Intrant borné**, relevé sur `9d75b75c` :

- `OptimizerSection.tsx` : `candidatesSource` L2041, `fullSortedCandidates`
  L2064-2084, `affichees` et `compteAffiche` après L2322 ;
- `src/hooks/useArtifactOptimQueue.ts` (les deux voies de b11) ;
- `src/lib/artifactQueue.ts` (`classementResolu`, `voieDeLaFile`) ;
- `.claude/skills/run-sw-forge/` (driver, import du compte) ;
- skill `optimizer-perf-testing` (protocole, contention, fidélité de la
  charge) ; recette gelée `recette-6bis-b5c-artefacts-libres.json` (relique
  « recherche », 4 reliques, artéfacts « Libre », « Dégâts réels »,
  appariement parallèle, ~16 s au CLI).

**Contrat.**

- **Trois conditions**, sur la même recette, répétitions entrelacées
  (au moins trois par condition), min, médiane, dispersion :
  - (A) code actuel, voie prioritaire de b11 ;
  - (B) code d'avant b11 (`727d52e2`), dans un worktree de MESURE
    (cadrage `orchestration-parallele.md` § 2.1 : junction de
    `node_modules`, déliée dans un `finally`) ;
  - (C) optimisation d'artéfacts désactivée : pas de file, le tri seul.
    Elle change la recherche elle-même ; c'est écrit.
- **Deux modes de l'application** : le serveur de dev (où l'utilisateur a
  observé les saccades : React en mode développement) et la version
  construite servie localement (`npm run build` puis `vite preview`), la
  seule représentative des utilisateurs. L'attribution par fonction se fait
  en dev (noms lisibles) ; les chiffres de saccade, dans les deux.
- **Ce qui se mesure, pendant la recherche** :
  - les tâches longues du fil de l'écran (> 50 ms) : nombre, durée totale,
    plus longue ;
  - leur attribution, par profil CPU (protocole Chrome DevTools) : tri de
    l'aperçu (`sortCandidates`), reclassement (`classementResolu`),
    résolution de la file (`resoudreEquipementDuBuild`), rendu React,
    autres ;
  - le délai jusqu'à ce que la première page n'ait plus aucune carte
    « artéfacts pas encore optimisés », et la même chose après un
    changement de page en pleine recherche ;
  - la durée de la recherche.
- **Fidélité affichée avant les chiffres** : régime d'appariement réel,
  taille de l'aperçu reçu, nombre de reliques éligibles, version du code
  mesurée (sha), mode de l'application.
- **Sortie** : `controle-6bis-b12.md`, les chiffres par condition et par
  mode, puis une recommandation chiffrée parmi : Worker de résolution,
  allègement du tri ou du rendu de l'aperçu, ou les deux. La décision
  revient à l'utilisateur, puis un contrat de correction (6bis-b13).
- Le script de mesure, réutilisable pour comparer la correction, peut
  entrer dans `scripts/` (outil, commit à part) ; sinon il reste dans le
  dossier de preuves.

**Créneau** : la mesure ne se lance qu'au créneau confirmé par
l'utilisateur — aucun autre agent, aucun `npm run dev` du pilote, aucun jeu
ouvert (b8 : le jeu tournait pendant un échauffement).

**Ne fait pas :** aucune correction, aucun changement de `src/`.

###### Résultat du lot 6bis-b12 — 2026-10-02

Mesure au créneau (01:46–01:59), aucun commit de code (le script, à chemins
en dur, reste dans le dossier de preuves). Reçu `f0e77a4` ↔ `a4b54d7`,
notes intégrées (`faa4511`). Preuve `controle-6bis-b12.md`, sorties brutes
dans `controle-6bis-b12/`. Fidélité : même recette gelée, `totalPairs`
120 782 375 égal au harnais pour A et B, 7 Workers (régime parallèle),
5 100 builds ; A = `f0e77a47`, B = `727d52e2` (worktree de mesure supprimé),
C = sans optimisation d'artéfacts ; dev (`StrictMode`) et version
construite ; Chromium sans affichage ; 5 passages entrelacés par condition.

Le pilote a recoupé le rapport avec `sortie-agregat.txt` : chiffres
identiques. Version construite, médianes :

| | A (b11) | B (avant b11) | C (sans file) |
| --- | --- | --- | --- |
| tâches longues pendant la recherche | 65 / 6,6 s | 44 / 4,1 s | 11 / 0,9 s |
| part du fil en tâches longues | 71 % | 42 % | 10 % |
| page 1 résolue | 4,1 s | 6,6 s | immédiat |
| page 2 après changement | 3,7 s | 3,7 s (n = 2) | 0,2 s |
| durée de la recherche | 9,5 s | 9,3 s | 8,8 s |

Dispersions : 5 à 13 % sur les tâches longues ; images/s non exploitables
(jusqu'à 206 %). Attribution (dev, A, temps en tâches longues) :
résolution 66 % (4,0 s ; chaque build, une tâche de 94 à 108 ms), rendu
React 16 %, reclassement 8 %, tri de l'aperçu 2 %. Dans la résolution,
premier temps propre : `artifactDamageProfile` (722 ms), puis
`preFiltrerCandidats` (494 ms) — relevé par le pilote dans l'agrégat.

**La lecture du pilote écrite au résultat de b11 (« le tri peut saturer »)
est fausse** : c'est la résolution qui sature. b11 avance la page 1 (6,6 →
4,1 s) en faisant passer le fil de 42 à 71 % de tâches longues. Durée de la
recherche : aucun écart lisible sous la dispersion (10 à 12 %).

Recommandation de l'agent : un Worker de résolution d'abord ; alléger le
tri n'est pas justifié ; reclassement et rendu des cartes à remesurer
après. Écarts : dev puis construit en deux blocs (entrelacés à l'intérieur
de chacun) ; Chrome personnel ouvert et un processus Codex inactif pendant
la campagne. Non prouvé : le gain d'un Worker (estimé) ; l'écart de
`totalPairs` sur C entre l'écran (120 782 375) et le harnais (121 834 136),
non instruit ; tout chiffre pour un téléphone ou un vrai écran.

##### 6bis-b13 — la résolution d'un build coûte moins, à résultat identique

**Cat. J ; requiert b12.** Décision de l'utilisateur du 2026-10-02 :
alléger d'abord le coût de la résolution par build, remesurer avec le
script de b12, et ne faire le Worker de résolution (6bis-b13bis) que si
les saccades restent. Constat de b12 (dev, condition A) : la résolution
fait 66 % des tâches longues, environ 100 ms par build ; premiers temps
propres : `artifactDamageProfile` 722 ms, `preFiltrerCandidats` 494 ms,
`computeSkillDamageDetail` 343 ms, `chercherPaires` 277 ms,
`avecInvocateur` 234 ms. En « Dégâts réels », `evaluer` recalcule le
profil de dégâts de CHAQUE paire essayée (`artifactEvaluation.ts` L145,
appelé par `chercherPaires` L644), pour chaque build et chaque relique,
alors qu'il semble ne dépendre que des deux pièces : à vérifier.

**Intrant borné**, relevé sur `36668501` :

- `damage.ts` L557-620 (`artifactDamageProfile`) ;
- `artifactEvaluation.ts` L106-200 (`evaluerPourRegime`) ;
- `artifactOptim.ts` L324-460 (`analyserPertinence`,
  `preFiltrerCandidats`) et L623-660 (`chercherPaires`) ;
- `relicQueue.ts` (`resoudreEquipementDuBuild`) ; `artifactFiche.ts`
  L95-135 ;
- `controle-6bis-b12.md`, `controle-6bis-b12/sortie-agregat.txt` et
  `mesure-saccades.mjs` (le script à rejouer) ;
- `invariants.md` L85, L87, L96 et L102.

**Contrat.**

- **Résultat identique, build par build** : même conformité, même
  relique, même paire (identifiants), même score — test différentiel
  contre le chemin d'avant (copie figée dans le test, ou `36668501` dans
  un worktree de mesure), sur les recettes gelées
  `recette-6bis-b5c-artefacts-libres.json` (« Dégâts réels »),
  `recette-revue-ehp-libre.json` (PV effectifs) et
  `recette-6bis-b10-kinki.json` (efficience), et sur des fixtures.
- **Le profil d'abord** (`optimizer-perf-testing` : « le coût est-il
  subi, ou choisi par l'implémentation ? ») : un profil CPU en Node de la
  résolution de 300 builds de la recette « Dégâts réels » chiffre chaque
  poste avant toute optimisation.
- **Pistes, chacune adoptée seulement si elle est exacte et mesurée** :
  mémoïser le profil de dégâts par paire (clé : identifiants des deux
  pièces) ; sortir de la boucle par build ou par relique ce qui n'en
  dépend pas (pertinence, préfiltre), avec la preuve de cette
  indépendance ; les autres postes selon le profil.
- **Mémoire bornée** : jamais un cache de toutes les paires de
  l'inventaire (~2 500 pièces) ; borne écrite et testée ; cache vidé quand
  la signature des réglages ou l'inventaire change.
- Le CLI partage ce code : `--resoudre-tout` mesuré avant et après sur une
  recette.
- **Mesure au navigateur, au créneau de l'utilisateur** : `mesure-saccades.mjs`
  rejoué en version construite, conditions A (après) et C au moins, à
  comparer aux chiffres de b12.
- **Bascule vers le Worker (6bis-b13bis) : décision de l'utilisateur, sur
  son ressenti à l'essai** (2026-10-02), la mesure ci-dessus servant
  d'éclairage ; aucun seuil chiffré. L'essai se fait sur la version
  construite servie localement, que le pilote ouvre après validation.

**Preuves.**

- Profil CPU avant et après (Node), poste par poste.
- Différentiel exact, rouge sur une mutation (par exemple une clé de cache
  qui ignore une des deux pièces), vert sur le code.
- Mesure navigateur avant (b12) et après ; `--resoudre-tout` avant et
  après.
- `tsc`, tests ciblés, build, spec-lint, diff-check ; preuve
  `controle-6bis-b13.md`.

**Ne fait pas :** Worker, changement d'un résultat, de K, de l'ordre ou des
voies de la file.

###### Résultat du lot 6bis-b13 — 2026-10-02

Un commit, poussé : `88e4c76a` — quatre pistes, toutes exactes : profil de
dégâts gardé par paire (clé : identifiants des deux pièces, pièce ≤ 0
jamais en cache), préfiltre mémoïsé (la pertinence reste sondée à chaque
build, sa valeur entre dans la clé), stats et effet unique calculés une
fois par somme de principales (`statsParPaire`), tri des paires différé
(`pairesParScore`). Caches bornés (16 384 profils, 64 préfiltres, 256
tableaux de stats, 64 apports), durée de vie d'une file (`caches`
obligatoire dans `entreeResolutionDuBuild`). Reçu `88e4c76` ↔ `069d7c0`,
notes intégrées (`f67d532`). Preuve `controle-6bis-b13.md`.

Rapportés par l'agent : profil Node 25,3 s → 12,7 s pour 300 builds ×
4 reliques ; 71,6 → 35,6 ms par build au minimum ; différentiel exact
contre `9ce8fecf` sur les trois recettes en `--resoudre-tout` (5 100,
5 969, 1) et 300 en mode file ; quatre mutations détectées ;
`--resoudre-tout` 400 s → 189 s ; navigateur (version construite) : tâches
longues 64 % → 38 % du fil, durée médiane d'une tâche 104 → 55 ms, page 1
3,1 → 1,9 s, page 2 2,8 → 1,6 s, recherche inchangée (8,9 s).

Le pilote a relu le diff (`statsParPaire` et non `computeStats` ; caches
recréés avec la signature et les paramètres de paires) et rejoué sur
`88e4c76a` : `tsc` 0 ; tests de zone 581 passés ; build, spec-lint,
diff-check verts ; « Reçu valide » ; **mutation du pilote** (garde des
pièces ≤ 0 retirée) : le test de la garde et le différentiel « avec
caches = sans caches » échouent sur six fixtures ; restauré, puis 45
passées sur ce filtre.

**Essai de l'utilisateur, version construite, le 2026-10-02** : le
chargement des reliques est « très bien » ; il souhaite plus de fluidité
de la barre de progression et du compte de builds, sans Worker si
possible. Le Worker (b13bis) n'est pas déclenché ; la fluidité passe par
6bis-b14. Remarque à la même occasion : sur la carte de résultat, la fiche
de stats déborde à gauche et la relique à droite (6bis-b15).
**Second essai de l'utilisateur, le 2026-10-02** : la résolution est bonne
en « PV effectifs », pas en « Dégâts réels » (le calcul de dégâts par
paire, ~60 % du coût restant, n'a pas été allégé) : **le Worker est
nécessaire** (6bis-b13bis-a, puis -b). b14 devient sans objet : le Worker
retire aussi la résolution du fil de l'écran.

##### 6bis-b14 — la résolution rend la main entre deux reliques

**Sans objet depuis le 2026-10-02** : remplacé par le Worker de résolution
(6bis-b13bis-a et -b, décision de l'utilisateur), qui retire la résolution
du fil de l'écran ; tableau A.7. Le contrat ci-dessous reste pour mémoire.

**Cat. J ; requiert b13. En attente de l'accord de l'utilisateur**
(question du 2026-10-02 : « est-ce que ça ralentit la recherche ? » —
réponse du pilote : par construction non, le même calcul en morceaux ; la
mesure le vérifie, avec arrêt sinon). Constat de b13 : chaque build résolu
reste une tâche d'environ 55 ms d'un seul tenant sur le fil de l'écran ;
la barre et le compte ne se mettent pas à jour pendant ce temps.

**Intrant borné**, relevé sur `a2691658` : `relicQueue.ts`
(`resoudreEquipementDuBuild`, `resoudreReliqueFixe`) ; `relicOptim.ts`
(`bestRelicForBuild`) ; `src/hooks/useArtifactOptimQueue.ts` (tranche,
deux voies) ; `controle-6bis-b13.md` et le script de mesure de b12/b13.

**Contrat.**

- La résolution d'un build se fait **par étapes** : au moins une étape
  par relique essayée, plus fine (paquets de paires) si une étape dépasse
  encore 50 ms. Le navigateur reprend la main entre deux étapes.
- **Résultat identique** : la résolution par étapes menée à son terme égale
  `resoudreEquipementDuBuild`, build par build (différentiel sur les trois
  recettes gelées de b13) ; le CLI garde le chemin d'un seul tenant, ou le
  même mené d'un coup.
- **Un build commencé se termine** avant qu'un autre commence ; une
  nouvelle recherche ou un changement de signature jette l'état partiel.
  La page passe devant le fond, au plus une étape de retard.
- **Garantie de l'utilisateur** : durée de la recherche mesurée avant
  (`a2691658`) et après, entrelacées ; **un ralentissement au-delà de la
  dispersion arrête le lot (A.6), chiffre rapporté avant toute
  livraison**. Le délai de résolution de la page est mesuré aussi : c'est
  le prix possible de la fluidité, à juger par l'utilisateur.
- Mesure au créneau (script de b12/b13, version construite) : tâches
  longues (nombre, part, plus longue), page 1 et 2, durée de la recherche ;
  puis essai de l'utilisateur.

**Ne fait pas :** Worker, changement de résultat, de K, de l'ordre de la
file ou du coût de la résolution.

##### 6bis-b15 — la relique de la carte de résultat ne déborde plus (ordinateur)

**Cat. J ; requiert b13.** Constat de l'utilisateur, le 2026-10-02, sur
**ordinateur** : dans la carte de résultat, la fiche de stats déborde à
gauche et la relique à droite. La carte vaut au moins ~360 px (deux cartes
par ligne, `optimizer.md` L1489-1496), la fiche a une largeur fixe de
200 px, et la relique, ajoutée par le chantier relique, partage la ligne
de la fiche, des artéfacts et de la roue (`BuildCandidateCard.tsx` L338,
`flex … sm:flex-row` ; `RelicSlot` L393).

**Décision de l'utilisateur** : quand la place manque, la relique passe
**sous** la ligne fiche / artéfacts / roue, avec son texte complet ;
aucun libellé du jeu raccourci. **Révisée par l'utilisateur pendant le
lot** (2026-10-02) : à la souris, la relique est **toujours sous la
roue**, centrée, quelle que soit la largeur ; elle ne change jamais de
place quand la file la résout. Les deux points du contrat qui suivent
(« sous la ligne », « sur la ligne quand la largeur suffit ») sont
remplacés par cette décision.

**Intrant borné**, relevé sur `a2691658` : `BuildCandidateCard.tsx`
L240-420 ; `src/components/RelicSlot.tsx` ; `src/hooks/useMediaQuery.ts`
L40-60 (`COMPACT`) et la variante `compact:` de `tailwind.config.js` ;
`optimizer.md` L1489-1501 ; `spec/shared/design.md` (contours, tokens, un
clic ne déplace rien).

**Contrat.**

- **Ordinateur seulement** (pointeur fin) : le tactile garde son rendu,
  qui relève de la passe responsive (README L334-339) ; une correction
  pour un format ne touche pas l'autre (CLAUDE.md).
- Le plancher de deux cartes par ligne et la largeur fixe de la fiche
  restent ; la bascule base+bonus / total ne déplace toujours rien.
- Aucune couleur ni valeur en dur ; contrôles de `src/ui/` ; la classe
  Tailwind utilisée est vérifiée dans le CSS construit.
- **Navigateur, par l'utilisateur** (le pilote ouvre la version
  construite) : carte large (relique sur la ligne), carte au plancher
  (relique dessous), aucun débordement.

**Preuves :** contrôle de source (portée ordinateur), classe émise dans le
CSS construit, `optimizer.md` amendé, `tsc`, tests de zone, build,
spec-lint, diff-check ; preuve `controle-6bis-b15.md`.

**Ne fait pas :** le rendu tactile, la grille des cartes, le contenu de la
relique.

###### Résultat du lot 6bis-b15 — 2026-10-02

Deux commits, poussés : `add96600` (relique sous toute la ligne, remplacée)
puis `7b3ec767` (relique sous la roue, à la souris). Reçu `7b3ec76` ↔
`1d50ccc`, notes intégrées (`df6e403`). Preuve `controle-6bis-b15.md`
(§ 7 fait foi). Le pilote a relu le diff : au doigt, classes et place de la
relique inchangées ; à la souris, grille deux colonnes (artéfacts | roue,
relique dans la case sous la roue) ; `RelicSlot` partagé, jamais copié.
Rejoué sur `7b3ec767` : `tsc` 0 ; build ; classes
`grid-cols-[auto_min-content]` et `col-start-2` présentes dans le CSS
construit ; spec-lint, diff-check verts ; « Reçu valide ». Pas de test de
rendu dans le dépôt : pas de mutation. **Vérifié par l'utilisateur à
l'écran le 2026-10-02 : la carte lui convient.**

##### 6bis-b13bis-a — Worker de résolution : le corps et le protocole

**Cat. J ; requiert b13 (et b15, déjà fait).** Décision de l'utilisateur du
2026-10-02, au second essai de b13 : en « Dégâts réels », la résolution
reste trop lente sur le fil de l'écran ; le Worker est nécessaire. Ce
premier sous-lot prépare le Worker sans le brancher : aucun changement de
comportement à l'écran.

**Intrant borné**, relevé sur `7b3ec767` : `relicQueue.ts`
(`EntreeResolution`, `entreeResolutionDuBuild`, `resoudreEquipementDuBuild`,
`CachesResolution`) ; `artifactOptim.ts` L174-240 (`ArtifactSearchParams`,
dont `evaluer`, une fonction) ; `artifactEvaluation.ts` (`DegatsContext`) ;
`OptimizerSection.tsx` (`resoudreEquipement`, appel de
`entreeResolutionDuBuild`) ; le patron corps neutre / coquille de
`src/workers/pairSliceBody.ts` et `parallelisation-partagee.md` § 3 ;
`invariants.md` § Workers.

**Contrat.**

- **Des entrées sans fonction** : un type sérialisable de ce qu'il faut
  pour résoudre un build (fiche, runes, paramètres de paires SANS
  `evaluer`, régime, contexte de dégâts, exclusive, conditions, contexte
  relique) ; un test prouve par `structuredClone` qu'aucune fonction ni
  référence non clonable n'y reste, sur les trois recettes gelées.
- **Un corps neutre** (module sans `self` ni `worker_threads`, comme
  `pairSliceBody.ts`) : il reçoit ces entrées, reconstruit l'entrée de
  production par `entreeResolutionDuBuild` et résout par
  `resoudreEquipementDuBuild`, avec ses propres caches
  (`nouveauxCachesResolution`), vidés à chaque nouveau contexte.
- **Un protocole typé** : contexte (une fois par signature : inventaire,
  réglages, contexte relique), demande de résolution d'un build,
  résultat, annulation. Le Worker traite un build à la fois ; la priorité
  (page d'abord) reste décidée par la file, sur le fil de l'écran.
- **La coquille** `src/workers/…worker.ts`, écrite mais pas encore appelée.
- **Résultat identique** : résolution par le corps, entrées passées par
  `structuredClone`, égale à la résolution directe, build par build
  (conformité, relique, paire, score, stats), sur les trois recettes.

**Preuves :** test de sérialisabilité, différentiel corps = direct, une
mutation (un champ d'entrée oublié dans le type sérialisable) qui le fait
échouer ; `tsc`, tests de zone, build, spec-lint, diff-check ; preuve
`controle-6bis-b13bis-a.md`.

**Ne fait pas :** brancher le Worker dans la file, changer l'écran, la
résolution ou le CLI.

###### Résultat du lot 6bis-b13bis-a — 2026-10-02

Premier lot lancé par le pilote lui-même (A.8). Un commit, poussé :
`b0c580e7` — `src/workers/resolutionBody.ts` (type
`EntreesResolutionSerialisables`, `entreesSerialisables` qui ne retire que
`evaluer`, protocole `contexte` / `resoudre` / `annuler` → `resultat` /
`annule` / `erreur`, classe `CorpsResolution`), la coquille
`src/workers/resolution.worker.ts`, référencée nulle part, et le test
`testResolutionWorker`. Reçu `b0c580e` ↔ `5da194f`, notes intégrées
(`8ba5e75`) : § 3.7 de `parallelisation-partagee.md` et une entrée
d'invariant. Preuve `controle-6bis-b13bis-a.md`.

Le pilote a relu le diff (corps neutre, aucune réimplémentation de la
résolution, caches neufs à chaque contexte, une réponse par demande) et
rejoué sur `b0c580e7` : `tsc` 0 ; `node tests/run.mjs resolutionworker
resolutioncaches resolutionproducteurpartage classementresolu relicqueue
artifactevaluation cliclassement` → 619 passées ; build, spec-lint,
diff-check verts ; « Reçu valide » ; **mutation du pilote** (demande d'un
contexte périmé acceptée) : 5 échecs sur 176 ; restauré
(`git -c core.autocrlf=false checkout`), puis 176 passées.

Rapportés, non rejoués : `structuredClone` sans perte sur les fixtures,
les trois recettes et 6 157 contextes de dégâts du bestiaire ; différentiel
corps = direct sur 11 070 builds des trois recettes ; garde de typage
`ProtocoleClonable` (une fonction dans un message fait échouer `tsc`) ;
quatre mutations de l'agent détectées. Écart : le filtre
`resolutionpartagee` du brief ne correspondait à aucun test (les noms sont
`resolutionproducteurpartage`, `classementresolu`).

Non prouvé : la coquille elle-même (vrai `postMessage`, ordre minuterie et
messages, absence de fuite) ; verrous, amplification, maximums et élément
porté sur des recettes réelles (fixtures seulement) ; le coût de transfert
du contexte, ~800 Ko pour 2 518 artéfacts — à mesurer en 6bis-b13bis-b.

##### 6bis-b13bis-b — Worker de résolution : le branchement et la mesure

**Cat. J ; requiert b13bis-a.** Contrat recalé le 2026-10-02 sur
`3b109359`, d'après le protocole livré par -a.

**Intrant borné.** `src/hooks/useArtifactOptimQueue.ts` (312 lignes, en
entier) ; `src/workers/resolutionBody.ts` et `resolution.worker.ts` ;
`OptimizerSection.tsx` : `contexteDegatsArtefacts` L719, `artifactParams`
L1377, `signatureArtefacts` L2105, `cachesResolution` et
`resoudreEquipement` L2182-2200, appel de la file L2201 ;
`useBuildOptimSearch.ts` L131 (création d'un Worker, patron) ;
`invariants.md` L102 et L191 ; `optimizer.md` L2441-2470 ; script de
mesure `controle-6bis-b13/mesure-saccades.mjs`.

**Contrat.**

- **La file confie la résolution au Worker** (`resolution.worker.ts`) :
  contexte envoyé à chaque changement de signature ou de paramètres de
  paires (nouvel `idContexte`), puis une demande par build. Le fil de
  l'écran ne résout plus rien quand le Worker est disponible.
- **La priorité reste sur le fil de l'écran** : la file choisit le build
  suivant (`prochainsATraiter`, page d'abord) et n'envoie au Worker
  qu'une ou deux demandes à la fois ; un changement de page annule les
  demandes pas encore commencées. Une réponse d'un contexte ou d'une
  demande périmés est ignorée, jamais écrite dans le cache.
- **La logique du côté de l'écran est un module pur, testable en Node**
  (quoi envoyer, quoi annuler, quoi ignorer) ; le hook ne fait que la
  brancher. Différentiel : le cache rempli par le Worker égale le cache
  rempli par le chemin direct, sur une file simulée.
- **Repli** : Worker indisponible, ou qui lève à la création ou en cours
  de route → le chemin actuel (deux voies de b11) reprend, sans rien
  perdre de ce qui est déjà résolu ; une erreur du Worker est journalisée
  et ne se tait jamais.
- Le Worker se termine au démontage ; aucune fuite d'un Worker par
  recherche.
- **Garantie de l'utilisateur** : la recherche ne ralentit pas. Mesure au
  créneau (libre, A.8 ; sans serveur du pilote), version construite,
  passages entrelacés : A-avant (`3b109359`, worktree de mesure), A-après,
  C ; tâches longues (part, plus longue), page 1 et page 2 en « Dégâts
  réels » ET en « PV effectifs », durée de la recherche, coût d'envoi du
  contexte ; puis A-avant et A-après **processeur bridé ×4** (approche
  d'un téléphone). **Un ralentissement de la recherche au-delà de la
  dispersion arrête le lot (A.6) avant livraison.**
- `invariants.md` (L102 et § Workers) et `optimizer.md` amendés.

**Preuves :** tests du module pur (envoi, annulation, réponses périmées,
repli) ; différentiel Worker = direct ; contrôle de source du hook ;
mutation (une réponse périmée écrite dans le cache) ; mesure ; `tsc`,
tests de zone, build, spec-lint, diff-check ; preuve
`controle-6bis-b13bis-b.md`. L'essai de l'utilisateur est inscrit en A.8.

**Ne fait pas :** changement de la résolution, de K, de l'ordre de la file,
du compte affiché ; le CLI reste synchrone.

###### Résultat du lot 6bis-b13bis-b — 2026-10-02 (arrêté avant livraison)

Agent lancé par le pilote (A.8). **Arrêt A.6 avant `livrer`** : la recherche
ralentit en « Dégâts réels ». Deux commits locaux, ni livrés ni poussés :
`9a7202a8` — module pur `src/workers/resolutionDistante.ts`
(`ResolutionDistante` : contexte envoyé seulement s'il y a du travail et
qu'il a changé ; au plus `DEMANDES_EN_VOL_MAX` = 2 demandes sans réponse ;
au changement de page, annulation des demandes non commencées, jamais de la
plus ancienne en vol ; réponse écrite seulement si elle est du contexte
courant, par `idContexte` ET par l'identité des entrées et de la
signature ; `publicationForcee`). Le hook ne fait que le brancher : un
Worker pour la vie du hook, terminé au démontage ; repli définitif sur les
deux voies de b11, cache gardé. `OptimizerSection.tsx` construit
`entreesResolution` par `entreesSerialisables` et passe `horsFil`.
`tests/resolution-distante.test.ts` : 67 vérifications, dont 24 files
simulées (module et corps derrière `structuredClone`) contre la résolution
directe ; trois recettes gelées identiques au CLI. `534de15a` : chiffres de
la mesure dans `optimizer.md`. Notes privées amendées, non livrées :
`invariants.md` L102 et L191, `parallelisation-partagee.md` § 3.7, preuves
`controle-6bis-b13bis-b.md` (agent) et `controle-6bis-b13bis-b-pilote.md`
(pilote).

**Rejoué par le pilote sur `534de15a`** : `tsc` 0 ; tests de zone (11
filtres) 797 passés ; build, spec-lint, diff-check verts. Relecture : le
corps répond `annule` à chaque demande touchée par `contexte` ou
`annuler`, donc aucune demande ne reste en vol (pas d'interblocage) ; le
cache ne se vide qu'au changement de signature, donc le repli le garde.
Mutation du pilote (une demande en vol n'est plus annulée tant que son
build reste dans la file) : 1 échec sur 67, l'assertion du changement de
page ; restauré. Mutations de l'agent : réponse périmée acceptée, 9
échecs ; garde rendu→effet retirée, 6.

**Mesure de l'agent** (12 paires « Dégâts réels », 4 « PV effectifs », 4
bridées ×4) : le fil de l'écran se libère (tâches longues 4 % contre 28 %,
plus longue 82 contre 101 ms, page 1 en 1,3 contre 1,9 s, page 2 en 0,9
contre 1,6 s ; contexte 4 ms, ~800 Ko, un envoi par recherche) ; **la
recherche est plus lente dans 11 paires sur 12, médiane des écarts
+3,6 %** (p = 0,006), sous la dispersion des séries ; « PV effectifs » :
rien de lisible.

**Mesure complémentaire du pilote : quand le résultat est-il complet ?**
La campagne de l'agent s'arrêtait 3 s après la fin, sans savoir si les 300
premiers étaient résolus. Instrument : réponses du Worker (A), tranches
`requestIdleCallback` et `MessageChannel` du chemin direct (B), jusqu'à 5 s
de silence ; 6 paires entrelacées, 3 bridées ×4 :

| « Dégâts réels », médianes | A (Worker) | B (avant) | apparié |
| --- | --- | --- | --- |
| recherche | 9 510 ms | 8 883 ms | +7,2 % (6/6) |
| résultat complet (recherche finie, 300 résolus) | 15,2 s | 20,7 s | −26,9 % (6/6) |
| résolus avant / après la fin | 162 / 139 | 85 / 216 | |
| bridé ×4 : recherche / complet | 9,9 / 24,5 s | 11,1 / 113,5 s | non concluant (\*) / −80 % |

(\*) −11 % ici, −1,3 % dans la campagne de l'agent sur le même code ;
seul B bridé diffère (11 067 contre 10 133 ms), n = 3. Relevé par la
revue indépendante : ce chiffre n'est pas un gain.

B finissait l'essentiel de sa file APRÈS la recherche, sur le fil de
l'écran, par tranches d'environ 36 ms : sous le seuil de 50 ms des tâches
longues, d'où leur absence de la mesure de l'agent.

**Lecture.** Le Worker fait le travail PENDANT la recherche au lieu
d'après : la recherche s'allonge de +4 à +7 % (0,35 à 0,6 s sur 9 s ;
deux campagnes, leur écart n'est pas expliqué), le résultat complet arrive
~5,5 s plus tôt, et bien plus tôt sur un fil de l'écran lent. Le contrat
garantissait « la recherche ne ralentit pas » ; l'invariant L102 dit « pas
de façon perceptible ». Le choix revient à l'utilisateur (A.8, décisions
en attente). Options présentées :

1. **Garder le Worker tel quel** (recommandation du pilote) : livrer,
   intégrer, essai à l'écran (A.8).
2. **Le Worker ne résout que la page pendant la recherche, le reste
   après** : la recherche devrait retrouver sa durée, le résultat complet
   revenir vers celui d'avant (~20 s, estimation : 280 builds à ~42 ms
   après la fin), fil libéré et page rapide conservés. Un lot de plus
   (6bis-b13bis-d, après les corrections de 6bis-b13bis-c), même mesure.
3. **Renoncer au Worker** : `git revert` des deux commits, retour au
   chemin direct de b13.

**Décision de l'utilisateur, le 2026-10-02 : garder le Worker tel quel
(option 1).** b13bis-b et b13bis-c sont livrés ensemble ; 6bis-b13bis-d
n'a pas lieu.

**Écarts signalés par l'agent, hors périmètre** : `CLAUDE.md` annonce
« 45 vérifications », le registre en compte 149 (affiché par
`node tests/run.mjs`) ; une erreur 404 de ressource dans A, B et C, non
instruite.

**Non prouvé** : le hook sous React en mode développement (StrictMode) ;
le repli, l'annulation réelle et l'arrêt sans fuite du Worker au
navigateur ; le renvoi du contexte quand un réglage change après la
recherche ; un vrai téléphone ; l'identité du classement affiché entre A
et B à l'écran (prouvée en Node seulement).

###### Revue indépendante du Worker — 2026-10-02

Deux relecteurs lancés par le pilote (A.8), qui n'ont écrit aucune ligne du
Worker, en lecture seule, sur `0da52574` : angle 1 concurrence, cycle de
vie et repli ; angle 2 fidélité de la résolution, preuves, mesure et spec.
**Rien de bloquant.** Angle 2 : les sept arguments du Worker égalent ceux
du chemin direct, le clonage ne perd rien d'utile, les dépendances des
mémos sont complètes, les deux différentiels comparent à la production ;
angle 1 : aucune réponse périmée écrite, aucun interblocage tant que le
Worker répond, StrictMode (double montage) et les quatre transitions entre
chemins tiennent à la lecture.

**Majeur, confirmé par le pilote en appliquant chaque mutation** (`tsc` 0
et `node tests/run.mjs resolutiondistante resolutionworker` → 243 passées
à chaque fois, fichier restauré) : le branchement à l'écran n'est gardé
par aucun test.

| Mutation | Effet si elle arrivait |
| --- | --- |
| `OptimizerSection.tsx` L2225 : `runesDe` rend `[]` | le Worker résout des builds sans runes ; l'expression est dupliquée de L2190 |
| hook L408 : `repli: () => {}` | une erreur du Worker coupe la file sans rien journaliser |
| hook L378 : `onmessage` figé sur le gestionnaire initial | rien n'est jamais écrit, les deux mêmes demandes repartent à chaque rendu |
| hook L418 : `reveillerRef.current = pomper` retiré | les rendus ne relancent plus la file |
| hook L336 : `signatureRef.current = signature` retiré | la garde rendu→effet ne voit plus un changement de signature |

**Mineurs retenus.** Angle 1 : un résultat écrit peut rester non publié si
la file se vide sans nouvelle écriture (`surReponse` ne publie que sur une
écriture, `pomper` jamais ; le chemin direct force la publication quand il
s'endort, hook L286) — faible probabilité, reproduit par le relecteur sur
le module réel ; la simulation du test ne suit ni `publier` ni
`enAttente`, ni un repli en cours de route, ni des entrées changées à
signature égale. Angle 2 : `optimizer.md` écrit deux hypothèses comme des
faits (L2559-2560 « un fil de plus calcule à plein », L2569-2570 « publie
plus souvent ») et surestime « trois recettes de référence » (L2545 : seule
« Dégâts réels » exerce une vraie résolution) ; il ne cite pas la mesure
du pilote ; § 3.7 et `resolutionBody.ts` L112-113 disent « un contexte par
signature » alors qu'il part à chaque nouvelle identité des entrées (une
fois par recherche) ; la promesse de reconstruire `vide` (L159-161) n'est
pas tenue ; le « −11 % » bridé du pilote ne tient pas (corrigé plus haut).

**Laissés en piste, avec leur raison** : la coquille enchaîne des
`setTimeout` imbriqués (4 ms imposées au-delà de cinq, jusqu'à ~1,2 s sur
300 builds) — un Worker plus rapide calcule davantage pendant la recherche,
donc lié à la décision en attente ; l'annulation d'une demande en position
1 à tout réordonnancement peut perdre un calcul commencé (0 ou 1 annulation
par passage mesurée) ; aucun chien de garde si le Worker se tait sans
erreur ; un repli sur erreur déterministe rejoue l'exception sur le chemin
direct (comportement de b11).

**Défaut antérieur, hors lot, signalé par les deux relecteurs** : le cache
de la file ne se vide qu'au changement de signature, or des entrées
changent sans elle — `artefactsReserves` (L1221, réservations des autres
builds validés, absent de la signature L2106-2153), l'objectif via
`evaluateursFiche`. Des paires déjà en cache peuvent alors utiliser un
artéfact devenu réservé, dans les deux chemins. Soumis à l'utilisateur
(A.8, décisions en attente).

##### 6bis-b13bis-c — corrections de la revue du Worker

**Cat. J ; requiert b13bis-b et sa revue indépendante.** Vaut pour les
options 1 et 2 de la décision en attente, sans objet pour l'option 3 : il
ne tranche rien de la question posée à l'utilisateur. Lancé par le pilote
avant la réponse, en commits locaux ; **ni `livrer`, ni `integrer`, ni
push** — le pilote livre b13bis-b et c ensemble après la décision.

**Intrant borné.** Le Résultat et la revue de b13bis-b ci-dessus ;
`src/workers/resolutionDistante.ts` (258 l.) ; `useArtifactOptimQueue.ts`
L331-424 ; `OptimizerSection.tsx` L2184-2230 ; `resolutionBody.ts`
L105-170 ; `tests/resolution-distante.test.ts` (603 l.) ;
`optimizer.md` L2500-2575 ; `parallelisation-partagee.md` § 3.7 ;
`invariants.md` L102 et L191.

**Contrat.**

1. **Un seul producteur des runes d'un build**, partagé par
   `resoudreEquipement` et `resolutionHorsFil`, testé ; les deux appels
   le passent (contrôle de source).
2. **Le branchement gardé** : chacune des cinq mutations du tableau
   ci-dessus fait échouer au moins une vérification nommée. Extraire en
   fonction pure ce qui peut l'être à faible coût, sinon un contrôle de
   source précis (le dépôt n'a pas de test React, `ARCHITECTURE.md` § 9).
3. **Rien d'écrit ne reste non publié** : quand la file se vide (réponse
   ignorée comprise) alors qu'une écriture n'a pas été publiée, et au
   repli, la publication est forcée. La simulation suit `publier` et
   vérifie qu'à la fin, ce qui est publié égale le cache.
4. **La simulation couvre** en plus un repli en cours de route (cache
   intact, plus rien d'écrit ensuite) et des entrées changées à signature
   égale (nouveau contexte, cache gardé, comme le chemin direct).
5. **Spec et commentaires** : les mineurs d'angle 2 ci-dessus corrigés
   (hypothèses marquées comme telles, portée des trois recettes, contexte
   par identité des entrées, `vide` — journalisé avec l'erreur au repli ou
   promesse retirée) ; `optimizer.md` et `invariants.md` L102 citent les
   deux mesures (+3,6 % et +7,2 % de recherche, résultat complet −27 %,
   recherche bridée non concluante) et restent « soumis à la décision de
   l'utilisateur » tant qu'elle n'est pas prise.

**Preuves** : les cinq mutations rejouées, chacune avec son échec ; une
mutation du correctif 3 ; `tsc`, tests de zone, build, spec-lint,
diff-check ; preuve `controle-6bis-b13bis-c.md`. Pas de mesure au
navigateur : aucun changement de calcul ni de cadence, sauf la
publication forcée du point 3 (une de plus par file, au plus).

**Ne fait pas** : ni la variante de l'option 2, ni les pistes ci-dessus, ni
le défaut antérieur ; aucun changement de la résolution, de K, de l'ordre,
du nombre de demandes en vol, de la recherche.

###### Résultat du lot 6bis-b13bis-c — 2026-10-02

Agent lancé par le pilote (A.8). Sept commits locaux sur `3aabf4ad`, ni
livrés ni poussés (comme b13bis-b, en attente de la décision) :
`11abb68d` producteur unique `runesDuBuild` (relicQueue.ts), appelé par
les deux résolutions de l'écran ; `0625cfe9` publication forcée — le
module sait qu'une écriture attend (`publier` rend vrai ou faux selon la
cadence), la publie de force quand la file se vide (réponse ignorée
comprise) et au repli (`renoncer` rend vrai) ; `c1c31d6a` simulation
élargie (48 files : repli en cours de route par trois origines, entrées
changées à signature égale ; publié = cache sur toute file vide et à la
fin) ; `95407be1` `vide` journalisé avec l'erreur au repli
(`repliSurErreur`) ; `380bf00d` contrôles de source du branchement ;
`45bed237` spec et commentaires (deux mesures citées, hypothèses marquées,
contexte par identité des entrées, portée des trois recettes) ;
`f951f3e9` libellé de test. Preuve `controle-6bis-b13bis-c.md` et son
dossier ; notes privées amendées, non livrées : `invariants.md` L102 et
L191, `parallelisation-partagee.md` § 3.7.

**Rejoué par le pilote sur `f951f3e9`** : `tsc` 0 ; tests de zone (11
filtres) 831 passés (797 avant) ; build, spec-lint,
`git diff --check 3aabf4ad..HEAD` verts ; diff relu (l'ancienne
expression des runes et `runesDuBuild` omettent les mêmes runes absentes).
Les six mutations de l'agent (les cinq de la revue et le retrait de la
publication forcée), rejouées par le pilote sur le code final
(`node tests/run.mjs resolutiondistante resolutionproducteurpartage`) :
2, 1, 1, 1, 2 et 6 échecs sur 179, comme rapporté ; restaurées.
**Mutation du pilote** (le port `publier` du hook rend vrai quand la
cadence retient) : 1 échec sur 101, le contrôle « rend faux quand la
cadence retient » ; restauré.

**Écart signalé par l'agent** : le CLI (`recipeToSearchParams.ts` L271) et
`scripts/lib/relicDifferentiel.ts` L110 gardent leur propre expression des
runes ; le contrat ne nommait que l'écran. Les brancher sur `runesDuBuild`
est un petit suivi, à faire avec la livraison si le Worker est gardé.

**Non prouvé** : le hook sous React (contrôles de source seulement) ; la
publication forcée et le repli au navigateur ; les trois recettes gelées
avec les nouveaux contrôles de publication.

##### 6bis-b16 — une carte n'apparaît qu'une fois vérifiée

**Cat. J ; requiert b13bis-c ; avant 7a.** Essai du Worker par
l'utilisateur, le 2026-10-02 : la barre est fluide, mais « les va-et-vient
des cartes de résultat qui apparaissent puis se retirent sont
insupportables, on ne peut pas garder la fonctionnalité comme ça ». Cause
(`OptimizerSection.tsx` L2343-2349) : un build reçu de la recherche est
affiché tout de suite avec sa paire supposée, puis retiré à la résolution
s'il n'atteint pas les minimums ; le Worker résolvant vite, les retraits
s'enchaînent sous les yeux. Recette de l'utilisateur :
`recette-6bis-b16-kinki.json` (Kinki, « Dégâts réels », minimums serrés).
Décision de l'utilisateur : **n'afficher que les builds vérifiés**.

**Intrant borné.** `src/lib/artifactQueue.ts` (492 l. : `prochainsATraiter`
L176, `voieDeLaFile` L247, `classementResolu` L421, `compteAffichable`
L469) ; `OptimizerSection.tsx` L2330-2402 (`affichees`, `compteAffiche`,
page courante, `pageCandidates`, `pageAfficheeRef`) et L4950-4975 (rendu
des cartes) ; `useArtifactOptimQueue.ts` (ports `page` et `restants`) ;
`src/workers/resolutionDistante.ts` ; tests `compteaffichable`,
`classementresolu`, `voiedelafile`, `resolutiondistante` ; `optimizer.md`
§ du compte affiché et de la file ; `invariants.md` L75 et L102.

**Contrat.**

- **Aucune carte non vérifiée n'est affichée**, pendant la recherche comme
  après : une carte n'apparaît qu'une fois son équipement résolu (paire,
  relique) et conforme. Un build écarté à la résolution n'est **jamais**
  montré.
- **Les places pas encore vérifiées de la page courante** affichent
  « Vérification… » : autant de places que la page en attend (au plus la
  taille de page), de hauteur réservée, pour que rien ne saute. Quand un
  build vérifié arrive, il prend sa place dans le classement réel ;
  qu'une carte descende sous un meilleur build vérifié reste permis (comme
  avant le Worker).
- **La priorité suit** : la file résout d'abord les builds qui rempliront
  les places en attente de la page courante, puis les K premiers ; une
  page plus loin que les builds vérifiés (au-delà des K premiers, après la
  recherche) montre ses places en attente et se résout quand on l'ouvre.
  Ni l'ordre de base, ni K, ni la résolution ne changent.
- **Le compte ne change pas de règle** (6bis-b10) : trouvés moins écartés,
  en direct ; une ligne dit combien sont en vérification. Les
  comportements de b10 tiennent (compte retombé à zéro, retour à la
  dernière page, masquages).
- La composition d'une page (cartes vérifiées et places en attente) est
  une **fonction pure** testée en Node, dérivée d'une seule source, comme
  `compteAffichable`.

**Preuves** : tests de la fonction pure (aucun build non vérifié dans une
page ; écarté jamais présent ; places en attente bornées) ; mutation (un
build non vérifié laissé dans la page) ; **mesure au navigateur sur la
recette Kinki**, version construite, avant et après : nombre de cartes
apparues puis retirées sur la page affichée pendant une recherche
(attendu 0 après) et délai jusqu'aux premières cartes de la page 1 ;
`tsc`, tests de zone, build, spec-lint, diff-check ; preuve
`controle-6bis-b16.md`. L'essai de l'utilisateur est inscrit en A.8.

**Ne fait pas** : ni la résolution, ni K, ni l'ordre de base, ni le
Worker ; le CLI (synchrone, il résout tout avant de classer) ne change pas.

###### Résultat du lot 6bis-b16 — 2026-10-02

Agent lancé par le pilote (A.8). Un commit, `6df20ba2` (code, test et spec) ;
reçu `6df20ba` ↔ `226c64d`. Fonction pure `compositionDePage`
(`artifactQueue.ts`) : les cartes de la page sont les builds vérifiés
(résolus et conformes) de rang `début` à `fin` parmi les vérifiés, dans
l'ordre réel ; les places « Vérification… » complètent la page ;
`aVerifier` (les premiers non résolus, une page au plus) devient la page
que la file sert en priorité (`pageAfficheeRef`). Composant
`PlaceEnVerification` et `useHauteurDesCartes` (`BuildCandidateCard.tsx`) :
une place a la hauteur de la plus petite carte mesurée. Ligne « N
combinaison(s) en vérification… », place réservée. `paireProvisoire` retiré
(plus d'appelant). Test `testCompositionDePage` (44 vérifications, 400
tirages). Notes privées : `invariants.md` L75-76 et L103, `artefacts.md`
§ 10, preuve `controle-6bis-b16.md` et son dossier.

**Rejoué par le pilote sur `6df20ba2`** : reçu valide ; `tsc` 0 ; tests de
zone (9 filtres) 701 passés ; build, spec-lint, diff-check verts ; diff
relu. Mutation de l'agent (un non résolu laissé dans la page) : 17 échecs
sur 44. **Mutation du pilote** (le filtre des écartés retiré de
`compositionDePage`) : 1 échec, « un écarté passé directement : ni carte,
ni place, ni à vérifier » — seconde garde, `classementResolu` les retire
déjà ; restauré.

**Mesure** (version construite, 4 passages entrelacés, médianes ;
recoupée par le pilote avec `sortie-agregat.txt`) :

| | avant (`38b98cd7`) | après |
| --- | --- | --- |
| Kinki : cartes écartées montrées puis retirées | 1 070 | **0** |
| Kinki : cartes descendues sous un meilleur vérifié | 172 | 18 |
| Kinki : page 1 définitive | 132 s | **22,7 s** |
| Kinki : première carte | 6,56 s | 7,36 s (+12,7 %) |
| Kinki : durée de la recherche | 137,0 s | 136,5 s (écarts appariés +0,2 %) |
| « Dégâts réels » : cartes descendues | 34 | 3 |
| « Dégâts réels » : première carte / recherche | 1,23 / 9,19 s | 1,40 / 9,22 s |

**Conséquences signalées par l'agent, à connaître** : le compte final
reste « trouvés moins écartés connus » (règle de b10) mais dépend du
nombre de builds vérifiés — sur Kinki, ~693 après contre ~382 avant, le
va-et-vient faisant vérifier ~1 000 builds de plus ; une page au-delà des
vérifiés coûte la vérification de tous les non résolus classés avant elle
(502 résolutions pour la page 8 dans le test) ; un changement de signature
(tri qui change de régime) remplace toutes les cartes par des places
jusqu'à la nouvelle résolution ; la ligne « en vérification » compte le
reste de la file, pas les builds au-delà des K premiers.

**Non prouvé** : aucun passage au navigateur ne change de page ni de tri
(priorité de la page ouverte et coût d'une page lointaine prouvés en Node
seulement) ; campagne au format ordinateur seulement (au téléphone, la
hauteur des places et la ligne « en vérification » sont relevées) ; le
confort réel attend l'essai de l'utilisateur (A.8).

##### 6bis-b17 — le cache de la file suit les artéfacts réservés

**Cat. J ; requiert b13bis-c ; avant 7a.** Défaut antérieur relevé par la
revue du Worker ; décision de l'utilisateur du 2026-10-02 : le corriger
ici. `artefactsReserves` (`OptimizerSection.tsx` L1221, réservations des
autres builds validés de la liste active) entre dans les paramètres
d'artéfacts (L1423) mais pas dans la signature (L2106-2153) : libérer les
artéfacts d'un autre monstre de la liste (bouton de sa ligne, zone C) ou
changer de liste active laisse dans le cache des paires calculées avec
l'ancien inventaire, même après une nouvelle recherche.

**Contrat.** La signature des réglages change quand les artéfacts réservés
changent (ensemble trié, l'ordre de la liste sans effet) ; le cache se vide
alors, et le Worker reçoit le nouveau contexte. Le lot dresse la table des
entrées de `artifactParams` et de `resoudreEquipement` face à la signature
(couverte / non couverte / sans effet sur la paire, avec la raison) ; une
autre entrée non couverte de même nature se corrige ici, une de nature
différente se rapporte au pilote.

**Preuves** : test de la signature (réservations changées → signature
changée ; même ensemble dans un autre ordre → inchangée) ; contrôle de
source (l'écran passe les réservations à la signature) ; mutation ; `tsc`,
tests de zone, build, spec-lint ; preuve `controle-6bis-b17.md`.

**Ne fait pas** : ne change ni la règle des réservations, ni la résolution.

###### Résultat du lot 6bis-b17 — 2026-10-02

Agent lancé par le pilote (A.8 ; un premier lancement, coupé par une
interruption avant toute action, a été relancé). Deux commits :
`d8132284` — `artefactsReserves`, champ obligatoire de `signatureReglages`
et `signatureArtefacts`, lu comme un ensemble trié (ni l'ordre ni un
doublon ne comptent ; vide, la signature est identique octet pour octet à
celle d'avant, chaînes épinglées dans le test) ; `c1d96fd5` —
`piecesFigees` (`piecesFigeesDe`, artifactFiche.ts) : sur un emplacement en
« Garder l'artéfact équipé », la pièce portée est le seul candidat, et elle
changeait sans la signature (validation d'un build du monstre, « Voir le
runage réellement porté », autre exemplaire). Le CLI n'utilise pas la
signature. Reçu `c1d96fd` ↔ `13ac9f3`. Table de 20 entrées dans la preuve
`controle-6bis-b17.md` : 12 couvertes, 2 corrigées, 5 sans effet sur la
paire, 3 rapportées.

**Rejoué par le pilote sur `c1d96fd5`** : reçu valide ; `tsc` 0 ; tests de
zone (8 filtres) 580 passés ; build, spec-lint, diff-check verts ; diff
relu (la signature reste une chaîne comparée par valeur : recalculer le
mémo plus souvent ne vide pas le cache pour rien). Mutations de l'agent :
4, 1 et 2 échecs. **Mutation du pilote** (tri des réservations retiré) :
1 échec, « le même ensemble de réservations dans un autre ordre ne change
rien » ; restauré.

**Rapporté par l'agent, soumis à l'utilisateur (A.8)** : un réimport du
compte qui change le contenu des artéfacts à nombre égal, ou celui des
runes à identifiant égal (le cache est indexé par les identifiants de
runes), ne change pas la signature ; changer d'exemplaire de la même
espèce laisse affichée la recherche faite avec l'ancien exemplaire, ni
relancée ni effacée.

**Non prouvé** : rien au navigateur (le vidage du cache est prouvé par la
fonction pure, le contrôle de source et le test du Worker « signature
changée : nouveau contexte ») ; coût des vidages en plus non mesuré.

##### 6bis-b18 — le compte ne compte que les combinaisons confirmées

**Cat. J ; requiert b16 et b17 ; avant 7a.** Demande de l'utilisateur du
2026-10-02, après l'essai de b16 : « stabiliser le nombre de combinaisons
trouvées, et ne compter qu'après vérification ». Décisions de l'utilisateur
le même jour :

- **La ligne de progression ne change pas** : « X / Y combinaisons
  examinées · Z trouvée(s) » (`OptimizerSection.tsx` L4662), compte de
  6bis-b10 (trouvés moins écartés connus).
- **L'en-tête des résultats** (L4714-4718) devient « XX combinaison(s)
  confirmée(s) pour l'instant — recherche en cours… », puis « XX
  combinaison(s) confirmée(s) » : seulement les builds vérifiés (résolus et
  conformes), un compte qui ne baisse jamais pendant une recherche. Une
  petite infobulle (`HelpPopover`) explique simplement la différence avec
  le chiffre des trouvées (borne optimiste : admises par le moteur stat par
  stat, pas encore toutes vérifiées).
- **L'avance de fond vise K confirmées** (300 en mode relique
  « recherche », 100 sinon), au lieu des K premiers du classement : la file
  continue, dans l'ordre du classement, jusqu'à K confirmées ou jusqu'au
  dernier build trouvé. « Aucune combinaison ne répond à ces critères » ne
  s'affiche donc qu'après avoir tout vérifié sans rien confirmer.
- **Un interrupteur dans « Réglages avancés »**, désactivé par défaut,
  « Vérifier toutes les combinaisons trouvées » (libellé proposé par le
  pilote), avec une aide : au-delà des K confirmées, tous les builds trouvés
  sont vérifiés, ce qui peut prendre plusieurs minutes. Gardé dans les
  recettes (champ optionnel : tous les constructeurs, écran, recette,
  `recipeToSearchParams`, CLI) et respecté par le CLI.
- **Pages** (proposition du pilote, non contestée) : le nombre de pages
  suit les confirmées, plus une page tant qu'il reste des builds non
  vérifiés ; l'ouvrir les vérifie (places « Vérification… » de b16).

**Contrat.** Le compte confirmé, la cible de la file (K confirmées, ou
tout avec l'interrupteur) et le nombre de pages sont dérivés de fonctions
pures testées en Node ; `kDeLaFile` garde sa valeur, son sens devient
« confirmées », au CLI comme à l'écran (parité). Les comportements de b10
se transposent : retour à la dernière page quand le nombre de pages
diminue ; « Trier par » et « Adapter les artéfacts… » masqués seulement
quand tout est vérifié sans aucune confirmée. Composition de page de b16
inchangée.

**Mesure bornée** (consigne de l'utilisateur : pas de phase de mesure
longue — une quinzaine de minutes au plus) : recette « Dégâts réels » de
référence, avant et après, 3 passages entrelacés après un échauffement ;
recette Kinki (`recette-6bis-b16-kinki.json`), un ou deux passages après
seulement, comparés à la mesure de b16 (recherche 136,5 s) : durée de la
recherche, délai après la fin jusqu'aux K confirmées, compte confirmé
final. Une recherche nettement ralentie arrête le lot et se rapporte
(A.6), sans campagne de plus.

**Preuves** : tests des fonctions pures (la file continue au-delà des
écartés jusqu'à K confirmées ; s'arrête à K ; épuisement ; interrupteur) ;
aller-retour de recette avec l'interrupteur ; parité CLI ; contrôles de
source des libellés et de l'infobulle ; mutation ; `tsc`, tests de zone,
build, spec-lint, diff-check ; preuve `controle-6bis-b18.md`. L'essai de
l'utilisateur est inscrit en A.8.

**Ne fait pas** : ni la résolution, ni l'ordre de base, ni le Worker, ni la
composition de page de b16.

###### Résultat du lot 6bis-b18 — 2026-10-02

Agent lancé par le pilote (A.8). Quatre commits : `734d4dd6` — la file vise
K confirmées (`prochainsATraiter` lit le cache et continue au-delà des
écartés ; sans écarté, ce sont exactement les K premiers) ; `69d7ec6a` —
`compteConfirme` (en-tête, infobulle « Combinaisons confirmées », pages,
état « Aucune ») ; `ab1e33f0` — interrupteur « Vérifier toutes les
combinaisons trouvées » par `cibleDeLaFile` (état, recette, CLI) ;
`a9fa6b48` — chiffre Kinki mesuré dans `optimizer.md`. Reçu `a9fa6b4` ↔
`04da233`. Tests nouveaux `testFileConfirmees`, `testCompteConfirme`,
`testVerifierToutes` ; parité CLI avec l'interrupteur dans
`testCliClassementParMode`.

**Rejoué par le pilote sur `a9fa6b48`** : reçu valide ; `tsc` 0 ; tests de
zone (10 filtres) 421 passés ; build, spec-lint, diff-check verts ; diff
relu ; libellés vérifiés dans la source. Mutation de l'agent (la file
s'arrête aux K premiers) : 7 échecs. **Mutation du pilote** (« Aucune »
sans exiger que tout soit vérifié) : 2 échecs, dont « Kinki, recherche
finie, pas encore vérifié : pas « Aucune » » ; restauré.

**Mesure** (8,4 min, bornée comme convenu ; B = `432ce999`, A = `ab1e33f0`) :
« Dégâts réels », recherche 9,30 contre 9,33 s (+0,9 % apparié), délai
après la fin jusqu'aux 300 confirmées 7,6 contre 8,0 s (+5,8 %, signe non
constant, 3 passages), compte final « 300 confirmée(s) » au lieu de « 5100
trouvée(s) » ; Kinki (cible 100, relique hors recherche), recherche 111 et
137 s (b16 : 136,5 s), file vide 0 à 0,5 s après la fin, « 100
confirmée(s) » pour 1 112 builds vérifiés.

**Interprétations de l'agent, retenues par le pilote** : une page de plus
seulement si des non vérifiés n'ont pas de place sur la dernière (jamais
de page vide) ; l'interrupteur lu en direct ; interrupteur et infobulle
masqués sans optimisation d'artéfacts ; la ligne de raison de b10 sous
« Aucune » seulement ; un changement de signature remet compte et pages à
zéro ; `compteAffichable` ne rend plus `pages`.

**Point à surveiller** : interrupteur activé, la file relit toute la liste
à chaque réponse du Worker (quelques millisecondes sur ~29 000 builds, en
petits morceaux ; non mesuré au-delà) — à éprouver à l'essai sur une
grosse recherche, ligne A.8.

**Non prouvé** : rien d'interactif au navigateur (page, tri, bascule de
l'interrupteur, infobulle ouverte, téléphone) ; l'écart de +5,8 % du délai
« Dégâts réels » à 3 passages ; Kinki sans témoin « avant » dans cette
campagne.

##### 6bis-b19 — réimport du compte et changement d'exemplaire

**Cat. J ; requiert b18 ; avant 7a.** Deux cas voisins rapportés par
6bis-b17 ; décisions de l'utilisateur du 2026-10-02 : les corriger ici.

- **Réimport du compte** : un import qui change des artéfacts ou des
  runes sans changer leur nombre ni leurs identifiants laisse le cache de
  la file intact (il est indexé par les identifiants de runes, la
  signature ne compte que le nombre d'artéfacts). **Chaque import de
  compte entre dans la signature** (une identité de l'import, pas une
  empreinte du contenu) : tout réimport vide le cache.
- **Changement d'exemplaire de la même espèce** dans une liste de
  travail : la recherche affichée, faite pour l'ancien exemplaire, n'est
  ni relancée ni effacée. **Changer d'exemplaire efface les résultats
  affichés, comme un changement d'espèce** ; l'utilisateur relance
  lui-même.

**Intrant borné.** `OptimizerSection.tsx` : zone C (sélection d'un membre
de liste), `pickSpecies`, `resetSearch` et la signature (Grep puis
plages) ; `useOptimizerState.ts` (`resetSearch`) ; `App.tsx` (import du
compte, L333 environ) ; `artifactQueue.ts` (`signatureReglages`) ; tests de
la signature et des transitions (`optimizer-damage-transitions`).

**Preuves** : test de la signature (deux imports distincts → signatures
différentes ; même import → inchangée) ; test ou contrôle de source du
changement d'exemplaire (résultats effacés, réglages de contexte gardés
comme au changement d'espèce) ; mutation par point ; `tsc`, tests de
zone, build, spec-lint, diff-check ; preuve `controle-6bis-b19.md`. Pas de
mesure au navigateur. Essai de l'utilisateur en A.8.

**Ne fait pas** : ni la résolution, ni le compte, ni la recherche
elle-même ; pas de relance automatique.

###### Résultat du lot 6bis-b19 — 2026-10-02

Agent lancé par le pilote (A.8). Deux commits : `92db894b` — compteur
`importDuCompte` (`useOptimizerState`), avancé à chaque
`resetSearch('compte')` (appelé par `App.tsx` à chaque import réel, jamais
à la relecture du compte conservé), champ obligatoire de la signature ; à
0 il n'y figure pas, les signatures épinglées par b17 restent valides ;
`62ac3eeb` — `effacerResultats`, partie « résultats » de `resetSearch`
(résultat, progression, page, arrêt manuel, détail ouvert), appelée seule
par la zone C quand un membre de la même espèce est un autre exemplaire
que celui affiché ; recliquer l'exemplaire affiché n'efface rien. Reçu
`62ac3ee` ↔ `16d8d7a`.

**Rejoué par le pilote sur `62ac3eeb`** : reçu valide ; `tsc` 0 ; tests de
zone (8 filtres) 579 passés ; build, spec-lint, diff-check verts ; diff
relu. Mutations de l'agent : 3, 2, 1 et 1 échecs. **Mutation du pilote**
(recliquer l'exemplaire affiché efface aussi) : 1 échec, « membre de liste
de la même espèce, autre exemplaire : résultats effacés, sans resetSearch
ni relance » ; restauré.

**Rapporté par l'agent, soumis à l'utilisateur (A.8)** : trois autres
chemins changent d'exemplaire sans effacer (re-choisir la même espèce au
bestiaire, une puce de source qui remet le sélecteur à `null`, la zone D) ;
le cache ne suit pas l'exemplaire (`fiche.base` hors signature, ligne 11d
de la table de b17) — après une relance sur un autre exemplaire, des
paires de l'ancien peuvent être reprises si les bases diffèrent ;
correctif possible, `ownSelectorKey` dans la signature.

**Non prouvé** : rien au navigateur (ni vrai réimport, ni clic en zone
C) ; le hook ne s'exécute dans aucun test (contrôles de source et
mutations seulement).

### Lot O — verrous de `chantier ouvrir` et `livrer`

**Cat. J ; requiert la contre-revue de ce contrat ; exécuté après
6bis-b3c**, sans dépendance de code (ordre A.7). Incident : A.5 ; diagnostic
et chronologie : `controle-restauration-relique.md` § Diagnostic. Deux trous :

- `ouvrir` garde des notes locales différentes de la base avec un simple
  avertissement ;
- `livrer` recopie en miroir (`copierMiroir`), suppressions comprises, sans
  comparer à ce que les notes locales ont reçu.

**Intrant borné.**

- `scripts/chantier.mjs`, identique à la copie installée au 2026-09-30 :
  - `empreinteArbre` L135 ;
  - `lireChantier` et `ecrireChantier` L184-209 ;
  - `copierMiroir` L210-231 ;
  - `ouvrir` L424-497 ;
  - `livrer` L534-686 ;
  - `rafraichir` L1206 à la fin de la fonction ;
  - `integrer` L1075-1205, en lecture seulement ;
  - `dossierEtat` L158, `controlerIdentite` L271-306 (casse normalisée
    sous win32, L275), `verifier` L687-1074 ;
  - `estPropre` L99-100 et `listerFichiers` L111-130 ;
  - reprises : `livraisonEnCours` L331-359, fusion de `rafraichir`
    reconnue L377-397.
- `tests/chantier.test.ts` : `testChantier` L612, `testChantierRafraichir`
  L352, `testChantierDeuxChantiers` L156.
- `spec/chantiers/orchestration-parallele.md` : sections `ouvrir` (L239-246),
  `livrer` (L247-271), `rafraichir` (L329-415), « Ouvrir un chantier »
  (L447-518).
- Le passage de `CLAUDE.md` « Les notes privées se LIVRENT ».

#### Lot O — contrat

Repris de la revue externe de la restauration (point H) et de la
contre-revue du 2026-09-30 (O1 à O9).

1. **Base synchronisée, conservée durablement.** Le registre du chantier
   garde l'état avec lequel les notes locales ont été synchronisées en
   dernier : révision documentaire, liste des fichiers et empreintes.
   - Qui la pose : `ouvrir`, `livrer` après son commit, et `rafraichir`.
   - Son écriture résiste à une interruption entre copie, commit et
     registre, avec la même discipline que `livraisonEnCours`. Le journal
     de reprise identifie l'**état attendu des notes**, pas seulement
     « une avance qui touche les notes ou les reçus ». Faiblesse
     préexistante à corriger : après le commit des notes, `revisionDocAttendue`
     avance (L602) mais `livraisonEnCours.depuis` garde l'ancienne valeur,
     si bien qu'une interruption après le commit du reçu échoue à la
     reprise (L352). Une livraison qui ne change que le reçu n'a, elle,
     aucun marqueur.
   - `rafraichir` ne fait avancer la base qu'après la copie complète vers
     les notes locales et son contrôle d'égalité (L1353-1363). Jamais à la
     reconnaissance de la fusion (L390-391), qui avance déjà
     `revisionDocAttendue`.
   - Coût : les empreintes par fichier viennent de la même lecture que
     `empreinteArbre`, sans passe de hachage en plus (`verifier` complet :
     1,4 s pour 874 fichiers et 261 Mo).
2. **`ouvrir`** compare l'arbre ENTIER des notes locales à la base, celle
   de `--base` si elle est donnée (elle est respectée), sinon `HEAD` :
   - **absent** : copie de la base, comme aujourd'hui ;
   - **identique à la base** : rien à faire ;
   - **identique à une révision ancêtre de la base** : notes en retard,
     remplacées par la base, avec liste de ce qui change.
     - Recherche parmi `git rev-list <base> -- spec/outils/optimizer`, par
       hash d'arbre git du sous-chemin (un calcul pour l'arbre local, puis
       un `rev-parse` par révision).
     - `git merge-base --is-ancestor <rev> <base>` est exigé.
     - Sauvegarde sous `.git/forge/sauvegardes/<chantier>/<horodatage>/`
       (répertoire Git commun, hors de l'arbre des notes, jamais livrée) ;
       ce que `fermer` en fait est écrit.
   - **tout autre cas** (inédit, vide, partiel, ou égal à une révision qui
     n'est PAS ancêtre de la base, par exemple une `--base` plus ancienne
     que les notes) : refus.
     - Le message donne un diagnostic par fichier (« X identiques à
       `<rev>`, Y inédits ») et la marche à suivre.
     - Une option explicite d'adoption garde les notes et les enregistre
       comme base.
     - Un retour arrière voulu se fait après l'ouverture, par une
       livraison.
   - **Fins de ligne** : comparaison des octets tels que le dépôt
     documentaire les archive, sans normalisation. Son `.gitattributes`
     (`* -text`) désactive toute conversion, quel que soit `core.autocrlf`.
     Une différence CRLF/LF entre deux révisions est donc réelle :
     `artefacts.md` est en CRLF à `bcbb49a` et `153df29`, en LF à `6559ecc`
     (contre-vérification du 2026-09-30).
   - **Casse sous Windows** : la correspondance des CHEMINS est insensible à
     la casse sous win32, comme `controlerIdentite`, sans toucher aux
     empreintes de contenu ; deux chemins Git distincts qui donnent la même
     clé Windows sont refusés. Un renommage qui ne change que la casse passe
     par une suppression puis un ajout explicites, jamais par le seul miroir
     (`copierMiroir` utilise un `Set` sensible à la casse, L212-216).

#### Lot O — contrat, suite : `livrer`, migration, autres commandes

3. **`livrer`** suit cet ordre, validé par la contre-vérification ciblée du
   2026-09-30 :
   - **(a) reprise vérifiée** de toute opération interrompue, livraison ou
     rafraîchissement, jusqu'à l'état attendu du journal (point 1) ;
   - **(b) garde**, sur deux égalités à la base synchronisée :
     - le sous-arbre Git `spec/outils/optimizer/` de la tête de la branche
       documentaire (le sous-arbre, pas le commit : la tête est souvent un
       commit de reçu) ;
     - l'**inventaire physique exhaustif** des notes du worktree
       documentaire, **fichiers ignorés compris**. `estPropre` ne voit pas un
       fichier exclu par `.git/info/exclude`, alors que `copierMiroir`
       l'effacerait (L99-100, L111-130, L212-216) : c'est le faux passage
       qu'une garde sur l'arbre Git seul laisse ouvert.

     Si l'une des deux échoue, la branche ou son worktree portent un
     contenu que les notes locales n'ont pas reçu : refus nommé, liste des
     chemins, marche à suivre (`rafraichir`, ou fusion manuelle si les
     notes ont été adoptées). Un « différent » dû à une opération
     interrompue est traité par (a), jamais pris pour un contenu non reçu ;
   - **(c) miroir** : `copierMiroir` reste. Derrière la garde, il copie
     exactement le delta base → notes locales : suppressions, modifications
     et renommages locaux légitimes passent ;
   - **(d) enregistrement durable** de la nouvelle base, après le commit.

   Hors interventions externes, les notes documentaires ne changent que par
   une livraison ou par un rafraîchissement, y compris la résolution
   manuelle de ses conflits dans le worktree documentaire. Leur
   synchronisation doit être achevée ou reprise avant la garde. La fusion
   fichier par fichier reste inutile tant que ces préconditions tiennent.
   La garde ne protège pas d'un écrivain concurrent entre son contrôle et
   le miroir : c'est une limite écrite.
4. **Migration des chantiers ouverts sans base** (`optimizer-workers`,
   `implementation-relique`, `degats-et-aura`).
   - La base se reconstruit depuis le plus récent de
     `dernierRecu.commitDoc` et `dernierRafraichissement.apres`. Le reçu
     prouve l'égalité des notes locales avec l'état livré
     (`chantier.mjs` L555-568).
   - Sans l'un ni l'autre, il n'y a pas de base : `livrer` refuse par
     défaut, et l'option d'adoption enregistre l'état local courant.
   - Relevé du 2026-09-30, lecture seule : sur les trois chantiers, le
     sous-arbre des notes de la base reconstruite égale celui de la tête
     documentaire. La garde passerait aujourd'hui partout.
     `implementation-relique` a une ligne locale jamais livrée (hash `4ef3542`
     inscrit dans son cadrage, rév. 45) : c'est une avance locale normale,
     que la garde laisse passer.
5. **`verifier`** affiche la présence de la base et l'égalité de l'arbre
   documentaire avec elle.
6. **`integrer` reste inchangé.** Une fusion ne propage que ce que la
   branche a changé, et la garde de `livrer` empêche désormais la branche de
   perdre un contenu jamais reçu. Cette raison s'écrit dans
   `orchestration-parallele.md`.
7. **Documentation** : `orchestration-parallele.md` et `CLAUDE.md` décrivent
   le nouveau comportement dans le même commit.

#### Lot O — preuves

- **Test qui rejoue l'incident** sur des dépôts jetables : un `main`
  documentaire porte des fichiers que des notes locales en retard n'ont pas.
  - `ouvrir` remplace ces notes.
  - Si les notes ont été adoptées, `livrer` refuse.
  - Rouge sur l'outil actuel, puis vert.
- **Scénarios** :
  - notes absentes, identiques, en retard (ancêtre), inédites, vides,
    partielles ;
  - `--base` explicite plus ancienne que les notes : refus, jamais de
    retour arrière ;
  - suppression légitime, renommage, dont un renommage de casse sous
    win32, et une collision de casse refusée ;
  - fichier ignoré (`.git/info/exclude`) présent dans le worktree
    documentaire : `livrer` refuse, rien n'est effacé ;
  - interruptions : pendant le miroir ; après le commit des notes, avant le
    registre ; après le commit du reçu ; pendant la copie de `rafraichir` ;
    entre la reconnaissance d'une fusion et la fin de sa copie. Chaque
    reprise mène à l'état attendu, sans faux refus ;
  - rafraîchissement en conflit → résolution dans le worktree documentaire
    → reprise complète → `livrer` ;
  - fins de ligne : une différence CRLF/LF archivée est détectée ;
  - migration : reçu seul, rafraîchissement plus récent, ni l'un ni
    l'autre.
- **Non-régression** : les `testChantier*` existants restent verts.
- **Chantiers réels ouverts, sans écriture.**
  - `controlerIdentite` refuse un chantier depuis un autre worktree. Le
    NOUVEAU source se lance donc avec, pour dossier courant, chaque
    worktree visé : `sw-forge-optimizer-workers`,
    `sw-forge-implementation-relique` et `sw-forge`.
  - Il y tourne en mode simulation qui n'écrit rien, prévu dans l'outil ou
    dans un script de preuve.
  - `verifier` de l'outil installé complète le relevé.
- **Contrôles** : `node tests/run.mjs chantier`, spec-lint, diff-check ;
  preuve `controle-O.md`.

**Ne fait pas :** `node scripts/chantier.mjs installer` (A.5) ; aucun
`rafraichir`, `livrer` ni `integrer` sur un autre chantier ; aucune note
privée modifiée hors de sa preuve.
**Conséquence assumée :** tant que `installer` n'a pas été lancé, l'outil
installé n'a aucun verrou. Le pilote propose `installer` à l'utilisateur dès
la validation de O, avant toute nouvelle ouverture de chantier.

#### Résultat du lot O — 2026-10-01

Un commit, `32a5da12` : verrous d'`ouvrir` et de `livrer` sur la base
synchronisée, dans `scripts/chantier.mjs`, avec cinq tests,
`orchestration-parallele.md` et `CLAUDE.md`. Reçu `32a5da1` ↔ `c8b6323`
(897 fichiers, sans aucune suppression), notes intégrées au main
documentaire `66b6aa3`. Preuve privée `controle-O.md`, avec ses sorties
complètes et trois scripts rejouables.

Le pilote a relu la garde et rejoué sur `32a5da12` :

- `npx tsc --noEmit` → 0 ;
- `node tests/run.mjs chantier hookscodex` → 239 vérifications passées ;
- spec-lint vert ; « Reçu valide » ;
- **rouge rejoué par le pilote** : l'outil de `aa4169b3` remis
  temporairement, `node tests/run.mjs IncidentNotesEnRetard` donne 6 échecs
  sur 8, dont « rien n'a quitté la branche documentaire » ; outil restauré
  depuis git, puis 8 sur 8.

Rapportés, non rejoués :

- tous les scénarios du contrat, du cas absent à la migration ;
- la correction de la faiblesse de reprise L352 : un journal
  `{ operation, depuis, etatAttendu }`, rouge prouvé sur l'ancien outil ;
- simulation `livrer --simulation` depuis les trois worktrees réels : la
  garde passerait partout, sans aucune écriture (instantanés identiques).

Écarts :

1. `livrer --adopter` lève la garde sur l'arbre, pas celle sur le worktree :
   c'est la seule issue d'une fusion manuelle. **Accepté par le pilote, sous
   condition** (`ea6a37f3`) : `CLAUDE.md` et `orchestration-parallele.md`
   réservent `--adopter` à une décision explicite de l'utilisateur, après
   `livrer --simulation` ; un agent ne le lance jamais de lui-même.
2. La reconnaissance d'une fusion manuelle n'avance plus la révision
   attendue ; `rafraichir` accepte des notes égales à une base
   documentaire ; à la reprise d'une fusion manuelle, les notes locales
   doivent être celles du premier parent. Acceptés : ils ferment des
   blocages réels.
3. Recherche d'ancêtres par `rev-list --full-history` ; inventaire physique
   sans hachage du disque. Acceptés.
4. Ajouts non demandés, testés : reprise d'un `ouvrir` coupé, réalignement
   de casse, refus d'une collision avant la fusion de `rafraichir`, une
   ligne de `fermer` qui signale les sauvegardes. Acceptés.

Relevé, non corrigé : `--archive` et `--sans-cablage` placés en dernier
argument sont ignorés (défaut préexistant). La zone de tests `chantier`
passe d'environ 1 min à 3 min.

Non prouvé :

- pas de run sous Linux ;
- renommage de casse d'un DOSSIER ;
- un fichier exécutable (`100755`) donnerait un faux « inédit » : un refus,
  jamais une perte ;
- l'écrivain concurrent, limite écrite ;
- `ouvrir` et `rafraichir` du nouvel outil n'ont pas tourné sur les
  chantiers réels ;
- le hook `pre-commit` n'a pas été éprouvé, puisqu'il ne change qu'après
  `installer`.

**`installer` lancé le 2026-10-01**, sur décision de l'utilisateur, depuis
`forge/degats-et-aura` @ `62bb877` (installation identique au source, hook
`pre-commit` recâblé, hooks Codex non touchés). Relevé aussitôt, en lecture
seule, avec l'outil installé :

- `degats-et-aura` : base reconstruite depuis le reçu (`c8b6323`) ; seul KO,
  le code postérieur au reçu (commits de cadrage), attendu ;
- `optimizer-workers` : « Reçu valide », garde qui passerait, miroir vide ;
- `implementation-relique` : ses deux KO préexistants (sa ligne jamais
  livrée), garde qui passerait, miroir d'un seul fichier modifié.

### Lot 7 — sets d'aura : l'écran

⚠️ **Recalé le 2026-10-02 et scindé en 7a / 7b** : lire d'abord
« Recalage du lot 7 » en fin de section, qui prévaut sur ce qui suit.

**Cat. J.** Requiert tous les lots 6bis-b-* validés et leur revue technique.
L'écran saisit les auras **externes** du modèle corrigé, jamais un total
incluant le build.

**Écart hérité du lot 6 à corriger ici :** `src/lib/effects.ts` affiche
« Précision alliés +10% » et « Résistance alliés +10% » pour Accuracy et
Tolerance. Aligner ces deux libellés et leurs usages visibles sur les
**+8 points** curés en A.2 ter ; vérifier les surfaces qui les consomment.
Ne pas modifier le calcul validé par les lots 6bis-b-*.
Corriger aussi l'écho d'état qui affichait « aucune aura » alors que des
auras externes étaient renseignées : il doit nommer **les auras externes**
et distinguer les activations propres, calculées par build. C'est un rendu
du lot 7, pas une nouvelle source de calcul. La modale ne connaît aucun
candidat (carte a4c2, `DamageSetupModale.tsx`) : l'écho dit que les sets du
build s'ajoutent sur chaque résultat, sans afficher de nombre d'activations
propres.

**Où** : la carte « État de mon monstre » (`EtatMonstre.tsx`) — et son critère
de coupe, écrit en tête du fichier, la désigne sans ambiguïté : « sortent de
la description du combat EXACTEMENT les réglages qui modifient les
statistiques propres du monstre ». Un set d'aura en est un.

**Quatre comportements :**

1. **Ajouter / visualiser / supprimer.** Libellé explicite : « Nombre de sets
   Fight des autres monstres de l'équipe » (même patron pour les cinq sets),
   avec une aide : les sets du monstre optimisé sont comptés automatiquement
   sur chaque build, même s'ils ne sont pas recherchés. Liste déroulante +
   champ entier borné de 1 à `15 − somme des autres lignes externes` ; absence
   = 0. Une seule ligne par set. Tout vient de `src/ui/` (`Selecteur`,
   `NumberField`, `BoutonIcone`). Une ligne peut être supprimée quel que soit
   le set recherché : les deux sources sont indépendantes. Ne jamais donner
   `min > max` au contrôle ; à somme 15, empêcher l'ajout d'une nouvelle ligne
   sans modifier les lignes existantes.
2. **Indépendance et rappel.** Choisir, augmenter, réduire ou retirer un set
   recherché ne crée, ne relève et ne supprime **aucune** aura externe, ne
   produit aucun conflit et ne bloque pas la recherche. Les nombres externes
   restent conservés au changement de monstre comme le contexte du lot 5.
   Lorsqu'on change le monstre optimisé depuis une liste de travail et que
   des auras externes sont renseignées, surligner temporairement leur zone
   avec un token d'attention jaune/orange et afficher « Pense à vérifier les
   sets d'aura externes. » C'est un rappel non bloquant : l'identité du
   monstre optimisé change ce qui est « externe », mais l'app ne réécrit pas
   les nombres à la place de l'utilisateur. Ne pas déclencher ce rappel à
   l'import initial d'une recette ou d'un compte, ni sur un simple rendu.
   Le rappel est limité au parcours d'une liste de travail, conformément à
   la demande ; un choix de monstre hors liste depuis le bestiaire conserve
   les valeurs mais ne le déclenche pas. Tester explicitement les deux voies.
   Réserver sa place ou le sortir du flux : aucun contrôle cliqué ne bouge.
3. **Un seul interrupteur**, dans « Réglages avancés » : prise en compte des
   auras RES et PRE dans les conditions minimum ET maximum, activée par
   défaut. Il reste toujours visible dans les réglages avancés, même après
   retrait de toutes les auras RES/PRE. Aucun interrupteur pour les conditions PV/ATQ/DEF.
4. **L'ouverture guidée.** Ajouter Accuracy ou Tolerance **aux auras externes**
   ouvre automatiquement la surface de réglages avancés,
   fait défiler l'interface jusqu'à `compterAurasResPre` avec le même patron
   que « Set de runes recherché », puis le surligne temporairement en orange.
   Le contrôle reste toujours rendu ; « guider » ne signifie jamais le monter
   conditionnellement ni le masquer ensuite.
   Choisir Accuracy ou Tolerance comme set recherché ne change pas les auras
   externes : il guide néanmoins vers le même interrupteur, sans modifier
   les nombres. Fight/Determination/Enhance n'ouvrent pas un panneau
   sans contrôle associé.
   L'ouverture guidée n'est pas rejouée automatiquement lors d'un import ou
   d'un simple changement de monstre. Le rappel orange du point 2 réserve sa
   place ou sort du flux : il ne déplace pas le contrôle qui vient d'être cliqué.

#### ⚠️ Le point 4 n'a pas la même forme sur les deux formats

**Sur ordinateur, « Réglages avancés » n'est pas une carte : c'est un
`FlottantAuto`** (`OptimizerSection.tsx`), replié par défaut et
qui s'ouvre **par-dessus** la page précisément pour ne rien pousser
(spec/shared/design.md, « un clic ne déplace jamais ce qu'on vient de
cliquer »). Il n'y a donc rien vers quoi « défiler » : ce qui doit entrer dans
l'écran, c'est **l'ancre** du flottant, puis le flottant s'ouvre autour d'elle.
Un `scrollIntoView` sur le flottant lui-même n'a pas de sens.

**Au doigt**, les mêmes réglages vivent dans le panneau « Options »
(`data-tiroir`) : le comportement s'y définit séparément — **une correction
destinée à un format ne touche pas l'autre** (CLAUDE.md). ⚠️ La famille
`[data-tiroir]` porte des règles descendantes qui ont déjà décentré une modale
entière (`ARCHITECTURE.md` § 7).

**Le patron existe déjà** : `setPickerSectionRef.current?.scrollIntoView({
behavior: 'smooth', block: 'center' })` (cas « aucun set choisi »).
Le surlignage orange se fait par un **token**, jamais une couleur Tailwind
native ni une valeur en dur (spec/shared/design.md).

**Sortie :** les quatre comportements, sur les deux formats, décrits dans
`spec/outils/optimizer.md § Écran (de haut en bas)` ;
`spec/outils/optimizer.md § Conditions, inventaire et réglages avancés`
reçoit l'interrupteur commun. Tester la logique de synchronisation pure :
création, suppression, 15 externes acceptés et 16 refusés, indépendance
complète des sets recherchés (y compris leur retrait), recherche sans aura
externe et conservation au changement de monstre/liste. Tester le rappel
uniquement après un changement de monstre dans une liste avec valeurs non
vides, son absence au premier rendu et à l'import de recette/compte, et la
parité du réglage sur les deux formats. Une recette avec 0 externe reste
valide même si trois Fight sont demandés et activés sur le build.

**Preuve :** `npm run build` (⚠️ une classe correcte dans le TSX peut n'être
jamais émise — vérifier le **CSS construit** pour le surlignage) ; captures
ou relecture à l'œil des deux formats — il n'y a pas de test d'interface dans
ce dépôt, c'est assumé (`ARCHITECTURE.md` § 9).

**Ne fait pas :** ne change aucun calcul validé par 6bis-b-*. N'audite pas le reste de
l'écran en mobile.

#### Recalage du lot 7 — 2026-10-02, sur `4467066b`

Carte établie par un agent en lecture seule ; ancrages principaux vérifiés
par le pilote (écho, panneau au doigt, critère de coupe, flottant). Le fond
du contrat tient ; aucune interface d'aura n'existe encore. **Déjà fait** :
le modèle `DamageSetup.setsAuraExternes` (`damage.ts` L3347) ; la
validation des recettes (une ligne par set, 1 à 15, somme ≤ 15 :
`optimizerRecipe.ts` L267-287, testée) ; la conservation au changement de
monstre (`damageSetupTransition.ts` L12, `useOptimizerState.ts` L415) ;
l'état `compterAurasResPre` (défaut vrai, recette, conditions), sans
contrôle rendu ; l'indépendance du set recherché.

**Corrections du contrat :**

- **Prérequis** : 6bis-b13bis-b et -c validés et livrés après la décision
  de l'utilisateur (et 6bis-b13bis-d si option 2) ; 6bis-b14 sans objet.
- **Libellés** : `effects.ts` L247-248 ; une seule surface les affiche, le
  pied « 2 Set » du détail de rune (`PieceDetail.tsx` L353, rendu L456),
  sur tous les écrans.
- **Écho** : la chaîne « aucune aura » n'existe pas. L'écho est
  `echoEtatMonstre` (`OptimizerSection.tsx` L589-598, sous-titre de
  `DamageSetupModale.tsx` L46), qui ignore les auras : il nomme les auras
  externes par set et dit, sans nombre, que les sets du build s'ajoutent
  sur chaque résultat. Commentaire périmé `DamageSetupModale.tsx` L30-31.
- **Critère de coupe** d'`EtatMonstre.tsx` (L20-27) et d'`optimizer.md`
  (L1183-1185) : pour Accuracy et Tolerance, ce qui bouge est la condition
  RES/PRE, pas le « +X / coup » — amender les deux phrases.
- **Point 1** : `NumberField` ne borne qu'à la sortie du champ et aux
  boutons (un champ vidé vaut 0) : la borne se garantit dans la fonction
  pure d'écriture, pas seulement par `min`/`max`.
- **Point 2, rappel** : déclenché dans le `onClick` de la zone C (liste de
  travail, `OptimizerSection.tsx` L2972-2987), jamais dans `resetSearch` ni
  dans un effet sur `selectedId`. Les autres voies — bestiaire
  (`pickSpecies`, L968-1015), import de recette (L2000-2017), import de
  compte (`App.tsx` L333) — ne le déclenchent pas.
- **Point 3** : fermés, ni le flottant ni le panneau ne montent rien ;
  « toujours visible » porte sur leur contenu : l'interrupteur est rendu
  sans condition dans `reglagesAvancesInner` (L3968-4073, commun aux deux
  formats).
- **Point 4** : « toujours rendu » est impossible quand c'est fermé —
  défiler vers l'ancre (`avancesRef`, L4296), puis ouvrir ; surlignage
  temporaire par minuterie (patron `importMsg`) et tokens `warn` /
  `warn-soft`. Au doigt, le panneau « Options de recherche » est piloté
  par le parent (`menuOuvert`, `onFermerMenu`) : l'ouvrir demande une prop
  venue d'`App.tsx` / `OutilsPage.tsx`, fichiers transverses que ce
  chantier touche pour cette seule prop. Le format se décide par
  `SOUS_LG`.
- **Sortie** : `optimizer.md` § État de mon monstre, § Conditions… (retirer
  « arrivent au lot 7 », L1368), § Zone C ;
  `degats-reels/effets-equipe-et-leaders.md` L178-181 (« ses contrôles
  visuels appartiennent au lot 7 »).
  Logique pure dans un module neuf `src/lib/aurasExternes.ts` (bornes,
  ajout, retrait, validation partagée avec la recette, `doitRappeler`,
  `guideVersResPre`), tests `tests/auras-ecran.test.ts`.

**Scission** (intrant estimé ~3 700 lignes, au-delà d'une session) :

- **7a** — libellés, écho, critère de coupe, saisie des auras externes,
  interrupteur, module pur et ses tests, spec (~2 000 lignes).
- **7b** — rappel en liste de travail et ouverture guidée sur les deux
  formats, prop du shell comprise (~2 000 lignes) ; requiert 7a.

**Réponses de l'utilisateur (2026-10-02)**, qui font partie du contrat :

- 7a — interrupteur libellé « **Compter les effets d'auras Tolerance et
  Précision dans les conditions** », activé par défaut, avec une aide ;
  bouton pointillé « Ajouter un set d'aura » fixe en haut, les lignes
  (set, nombre, corbeille) s'ajoutant SOUS lui ; un champ du nombre vidé
  revient à 1 à la sortie du champ, seule la corbeille retire une ligne.
- 7b — au doigt, l'ouverture guidée ouvre « Options de recherche »
  par-dessus la carte ; à la souris, défiler vers l'ancre puis ouvrir le
  flottant, qui peut déplacer la carte cliquée et se referme au clic
  suivant hors de lui ; rappel et guidage au même token d'attention,
  effacés après 3 s ; un autre exemplaire de la même espèce dans la liste
  déclenche le rappel.

#### Résultat du lot 7a — 2026-10-02

Agent lancé par le pilote (A.8), dans le worktree du chantier. Quatre
commits : `1baecf9e` — libellés Accuracy et Tolerance à +8 points
(`effects.ts`) ; `85c2359d` — module pur `src/lib/aurasExternes.ts`
(bornes, ajout en dernier, changement de nombre borné de 1 à 15 − somme
des autres lignes, champ vidé → 1, une ligne par set, validation
`erreurAurasExternes` **partagée** avec `optimizerRecipe.ts`), saisie dans
« État de mon monstre » (`Selecteur`, `NumberField`, `BoutonIcone`,
`Bouton` pointillé fixe en haut ; libellé « Nombre de sets Fight des autres
monstres de l'équipe » sous chaque ligne ; compteur « X / 15 »), tests
`tests/auras-ecran.test.ts` ; `0b642561` — écho (« auras externes : 2 sets
Fight, 1 set Accuracy ; les sets d'aura du build s'y ajoutent sur chaque
résultat »), commentaire de `DamageSetupModale.tsx`, critère de coupe
amendé ; `3bc596af` — interrupteur « Compter les effets d'auras Tolerance
et Précision dans les conditions » dans `reglagesAvancesInner`. Reçu
`3bc596a` ↔ `42f1a43`.

**Rejoué par le pilote sur `3bc596af`** : reçu valide ; `tsc` 0 ; tests de
zone (9 filtres) 326 passés ; build vert ; six classes nouvelles
contrôlées dans le CSS construit, dont `grid-cols-[minmax(0,1fr)_auto_auto]`
(virgule échappée dans la feuille minifiée) ; spec-lint, diff-check verts ;
diff relu. Mutation de l'agent (borne haute retirée) : 6 échecs. **Mutation
du pilote** (`peutAjouterAura` sans exiger un set libre) : 3 échecs, dont
« cinq sets présents : ajout refusé, même liste rendue » ; restauré.

**Choix d'interface de l'agent, à juger à l'œil (A.8)** : libellé
explicite sous les contrôles (au-dessus, sa longueur variable ferait
bouger le menu cliqué) ; compteur « X / 15 » non demandé ; interrupteur en
dernier de la colonne des réglages avancés ; noms de sets de `RUNE_SETS`.
Écart de méthode signalé : un `Add-Content` PowerShell au lieu de l'outil
Edit sur le fichier de test (contrôlé : ni BOM, fins de ligne ramenées à
LF).

**Non prouvé** : aucun rendu à l'œil (ordinateur ni téléphone) ; le champ
vidé puis quitté n'est prouvé que par la fonction pure et un contrôle de
source ; pas de test de bout en bout de l'interrupteur sur une vraie
recherche (branchement déjà testé en 6bis-b3a et b4).

#### Résultat du lot 7b — 2026-10-02

Agent lancé par le pilote (A.8), dans le worktree du chantier. Deux
commits : `cc85a596` — rappel : `doitRappeler(voie, avant, après)` et
`DUREE_ATTENTION_MS = 3000` (`aurasExternes.ts`), seul appel dans le
`onClick` d'un membre de la zone C, après la séquence de 6bis-b19 ; la
boîte des auras passe en `border-warn bg-warn-soft`, le message « Pense à
vérifier les sets d'aura externes. » occupe la case de l'en-tête, place
réservée ; `9291e1c8` — ouverture guidée : `guideVersResPre` et
`SETS_AURA_RES_PRE` (dérivés de `STAT_DE_L_AURA`), au doigt le panneau
« Options de recherche » s'ouvre par la prop `onOuvrirMenu` (`App.tsx` →
`OutilsPage` → `OptimizerSection`), à la souris défilement vers
`avancesRef` puis ouverture du flottant sur `scrollend` (repli après
1 s) ; cadre `border-warn bg-warn-soft` sur l'interrupteur. Reçu `9291e1c`
↔ `9ca4172`.

**Rejoué par le pilote sur `9291e1c8`** : reçu valide ; `tsc` 0 ; tests de
zone (4 filtres) 229 passés ; build vert, `bg-warn-soft`, `border-warn` et
l'animation contrôlés dans le CSS construit ; spec-lint, diff-check verts.
Mutations de l'agent : 6, 2, 4 et 2 échecs. **Mutation du pilote** (le
rappel ne réagit plus qu'au changement d'espèce) : 1 échec, « liste de
travail, MÊME espèce, autre exemplaire : rappel » ; restauré.

**Question de l'agent, soumise à l'utilisateur (A.8)** : le rappel
s'affiche dans « État de mon monstre », souvent hors de l'écran quand on
clique dans la zone C (toujours au téléphone) ; il peut s'éteindre sans
avoir été vu. Recommandation de l'agent : le même message, même token et
place réservée, sous la liste de la zone C.

**Choix de l'agent, à juger à l'œil (A.8)** : le message remplace
l'en-tête de la boîte pendant 3 s ; pas de défilement si l'ancre est déjà
visible ; au téléphone, le panneau défile pendant qu'il monte ; la boîte
des réglages avancés gagne 4 px en bas ; choisir un monstre de la liste
quand aucun n'était sélectionné déclenche aussi le rappel (si des auras
sont saisies).

**Incohérences relevées, non corrigées** : `spec/shared/design.md` donne
`warn` Atelier `#b7791f` alors qu'`index.css` porte 138 87 12 ;
`invariants.md` dit que l'ouverture des réglages avancés n'est jamais dans
`useOptimizerState`, où vit pourtant `showAdvanced`.

**Non prouvé** : aucun rendu à l'œil ; `scrollend` et son repli par lecture
du source seulement ; au clavier, les flèches sur le menu d'une ligne
pourraient déclencher le guidage plusieurs fois (non examiné).

#### Lot 7c — le rappel aussi sous la liste de travail

**Cat. J ; requiert 7b.** Décision de l'utilisateur du 2026-10-02, sur la
question de l'agent de 7b : le rappel « Pense à vérifier les sets d'aura
externes. » s'affiche **aussi sous la liste de la zone C**, là où l'on
vient de cliquer ; la carte « État de mon monstre » est souvent hors de
l'écran à ce moment (toujours au téléphone).

**Contrat.** Même message, même token (`warn` / `warn-soft`, contour 1 px),
même durée (`DUREE_ATTENTION_MS`), même déclencheur (`doitRappeler`, un
seul état du rappel pour les deux rendus — jamais un second minuteur ni une
seconde condition) ; place réservée sous la liste (rien ne saute quand il
apparaît ou s'efface) ; sur les deux formats (au téléphone, la zone C est
un dépliement : le message vit dans la partie dépliée, ouverte au moment du
clic). La carte des auras garde son surlignage de 7b.

**Preuves** : contrôle de source (un seul état, deux rendus ; aucun
déclencheur nouveau) ; mutation (le rendu de la zone C branché sur une
autre condition) ; `tsc`, tests de zone, build, classes vérifiées dans le
CSS construit, spec-lint, diff-check ; preuve `controle-7c.md`. Vérification
à l'œil en A.8.

**Ne fait pas** : ni nouveau déclencheur, ni changement du guidage, ni
autre texte.

#### Résultat du lot 7c — 2026-10-02

Agent lancé par le pilote (A.8), dans le worktree du chantier, pendant la
seconde vague parallèle. Un commit, `c60bceee` : sous la liste de la zone C,
un `<p>` monté avec la liste (`activeMembers.length > 0`), hors du conteneur
qui défile et avant « Libérer toutes les runes », branché sur
`rappelAuras !== null` — le même état que la boîte des auras, aucun état,
effet ni minuteur nouveau ; `invisible` hors rappel (place réservée, rien
ne bouge), même apparition, même message, `border border-warn bg-warn-soft`.
`testAurasEcranRappel` reçoit 10 vérifications (source : `rappelAuras !==
null` lu deux fois exactement, deux `setTimeout` sur `DUREE_ATTENTION_MS`
seulement) ; `optimizer.md` § Zone C, renvoi de 3 lignes dans § État de mon
monstre ; invariant L266 amendé (« deux rendus dérivés d'un même état »).
Reçu `c60bcee` ↔ `a779e59` ; preuve `controle-7c.md` (525 lignes).

**Rejoué par le pilote sur `c60bceee`** : reçu valide ; `tsc` 0 ; tests de
zone (`auras optimizerrecipe prosessort effetsactifs`) 1475 passés ; build,
spec-lint, diff-check verts. Mutations de l'agent : autre condition (3
échecs), second minuteur (4), condition ajoutée `&& zoneCOpen` (1), place
non réservée (8). **Mutation du pilote** (contour `border-2`) : 1 échec,
« même token […], un seul contour » ; restauré.

**Choix de l'agent, à juger à l'œil (A.8)** : place permanente de 32 px
sous la liste dès qu'elle a un membre (deux lignes possibles sur un
téléphone étroit) ; pas d'`aria-live` sous la liste, la boîte des auras
annonçant déjà le message.

**Non prouvé** : aucun rendu à l'œil ; lecteur d'écran, liste vidée ou
liste active changée pendant les 3 s, par lecture du source seulement.

### Lot 8 — Blade Surge : le 3ᵉ coup, en zone

⚠️ **Recalé le 2026-10-02 et scindé en 8a / 8b** : lire d'abord
« Recalage du lot 8 » en fin de section, qui prévaut sur ce qui suit.

**Cat. J.** Bloqué par les lots 1, son amendement pilote et 2b. Constat 151.
Intrant commun supplémentaire : B.0, champ `cibleDegatsParSort`.

**Le problème structurel :** `SkillDamageProfile.aoe` est un booléen **du
sort**, pas du coup (`damage.ts` l. 2157). Or ce sort a deux coups mono-cible
à `0.5*{ATK}` et un coup de zone à `3.0*{ATK}`. Et le code d'artéfact **224**
(`D.CRIT+ comp cib uniq pdt tour`) est appliqué **au sort entier** depuis
`aoe === false`, via `artifactCritDamagePoints` (l. 553) — seule porte
d'entrée, rien n'est saisi. Il faut donc une granularité **par coup**, ou un
mécanisme équivalent.

#### La forme retenue, et ce qu'elle veut dire

**Deux crans, formulés par CIBLE** — tranché par l'utilisateur (2026-09-23) :
le besoin est pratique, « qu'est-ce que je fais comme dégâts au monstre ciblé,
ou aux autres monstres autour », pas d'isoler un artéfact.

| Cran | Ce qui est calculé | 224 | 411 |
| --- | --- | --- | --- |
| **Dégâts sur la cible visée** (défaut) | les 3 coups : `0.5×ATQ` ×2 **+** `3.0×ATQ` | sur les **2 premiers** seulement | sur le **1ᵉʳ** coup |
| **Dégâts sur les autres ennemis** | le seul coup de zone : `3.0×ATQ` sur **un** autre ennemi | **jamais** | **jamais** |

⚠️ Le second cran calcule **une cible distincte**, jamais la somme sur tous
les ennemis. Ses PV initiaux sont ceux saisis pour cette cible, sans retirer
les dégâts des deux premiers coups reçus par la cible visée. Ne pas dériver
son résultat par soustraction du premier cran, notamment avec 222/223.

⚠️ **411 vaut pour la première attaque DU TOUR** et les passifs offensifs
reçoivent un profil dont `cdPointsPremiereAttaque` est remis à zéro
(`degats-reels.md`, § dédié). Le cran « autres ennemis » ne doit pas rouvrir
ce compteur, ni pour le coup de zone ni pour les passifs. Correction explicite
de l'utilisateur en revue : la première attaque sur une nouvelle cible n'est
pas un nouveau premier coup du tour.

**Sortie :** les **huit identifiants / onze formes de corpus** retenus au lot
1f couvrent les deux crans : `10601`, `10602`, `10603`, `10604`, `10605`,
`10616`, `10618`, `10620`, portés par `19801` à `19805`, `19811` à `19815` et
`19823`. Le socle d'audit `10602`, `10604`, `10616`, `10618`, `10620` n'était
donc pas la famille entière. Les formes non éveillées restent dans la preuve
de corpus mais ne créent pas une entrée sélectionnable dans l'écran, selon
`A.2 ter`.

Un test nommé vérifie les deux crans, **et** que 224 ne porte que sur 2 des 3
coups dans le premier cran. Vérifier aussi l'absence de 411 sur la zone, les PV
propres à chaque cran pour 222/223, et la contribution par coup des dégâts
additionnels. Le test vérifie que `skillupDamagePct` porte aussi sur le
troisième coup, conformément à la valeur curée en A.2 ter.

**Preuve :** le test · les trois unités et listes de couverture du lot 1 citées dans la spec ·
`npx tsc --noEmit` ·
`node tests/run.mjs <nom> degats audit-degats-conditionnels` · `npm run build`.

**Ne fait pas :** ne traite pas les constats **163** (Theonia), **173** (Danu)
et **180** (Jackie) — voisins de catégorie, autre mécanique (lot 1, point 1) :
ils vont au lot 13.

#### Recalage du lot 8 — 2026-10-02, sur `8ea90bd9`

Carte d'un agent en lecture seule ; ancrages structurants vérifiés par le
pilote. Rien n'a été fait entre-temps sur Blade Surge (aucun identifiant
dans `src/`, aucun champ de B.0, aucun test) : le fond tient.

- **Prérequis** : 6bis-b13bis-b et -c livrés (fait le 2026-10-02). Les
  lots 8 à 10 ne dépendent pas de 7a / 7b.
- **Valeurs** : celles de A.2 ter (L136-140, L161-162), plus la décision de
  l'utilisateur du 2026-10-02 — **224 sur les coups 1 et 2, 400 sur les
  trois coups**. Aucune valeur manquante.
- **Spec** : `spec/outils/degats-reels.md` n'est plus qu'un routeur ; le §
  de l'artéfact 411 est `degats-reels/artefacts-critique-et-element.md`
  L62-69. `passifs-offensifs.md` fait 488 lignes (plafond du lint 500) :
  une section nouvelle va dans un fichier nouveau sous `degats-reels/`,
  routé depuis `degats-reels.md`.
- **Ancrages** : `aoe` du sort `damage.ts` L2170 ; 224 par
  `artifactCritDamagePoints` L553-555 (appelée L4262) ; 411 neutralisé pour
  les passifs L4874-4884 ; chemin coup par coup existant `profilUnCoup`
  L4101-4125.
- **Contraintes nées depuis** : `propres: AurasPropres` est obligatoire
  dans `computeTotalDamage` / `computeSkillDamageDetail` ; tout champ
  ajouté au profil ou au réglage reste une **donnée pure** (il traverse le
  Worker de résolution, `ProtocoleClonable`, et `RealDamageContext`) ; la
  classe `'sort'` de `DAMAGE_SETUP_CLASSIFICATION`
  (`damageSetupTransition.ts`) donne le reset demandé par B.0 ; parseur
  de recette `optimizerRecipe.ts` L240-375.
- **Mécanisme** : une table par `com2usId` donnant la séquence des coups
  (formule, portée), jamais un cas Blade Surge en dur ; le chemin court
  reste celui des autres sorts.
- **Écran (n° 8, retenu par l'utilisateur)** : sous « Compétence utilisée »
  (`DamageSetupCard.tsx` L386-430), seulement pour Blade Surge, un
  `Segmented` à deux crans, « Dégâts sur la cible visée » (défaut, les
  trois coups) et « Dégâts sur les autres ennemis » (le 3ᵉ coup seul) ;
  patron `champCoupsVariables` (L254). Les champs de cible existants
  décrivent l'autre ennemi ; aucun champ nouveau. Amender l'aide L379-384
  (« portée… jamais à saisir »), `resumeSort` L225-249, la ligne du CLI
  `scripts/optimizer-search.ts` L198-203 et `invariants.md` L130.
- **Corpus** : l'écran n'atteint que 19811-19815 et 19823 ; 10601 et 10605
  (formes non éveillées 19801 et 19805) sont couverts par la table et le
  test seulement.
- **Compte réel (B.0)** : le compte porte Lapis, Astar, Iris (×3) et Lanett
  (vérifié par script sur l'export le 2026-10-02).

**Scission** (intrant estimé ~3 200 lignes) : **8a** moteur — type,
classification, calcul, test, spec, invariant (~2 300) ; **8b**
propagation — parseur, écran, CLI, tests B.0, CLI sur compte réel
(~2 200) ; 8b requiert 8a.

#### Résultat du lot 8a — 2026-10-02

Lot parallèle (A.8), worktree `sw-forge-lot-8a` parti de `0899b541`, un
commit `88ef067c`, intégré dans la branche du chantier en `f229d2f1`.
`SEQUENCES_DE_COUPS_PAR_ID_CONNUS` (Blade Surge, 8 identifiants : 2 × 0,5
ATQ mono-cible puis 3,0 ATQ en zone), copiée dans `profile.sequenceDeCoups`
(données pures) ; chaque groupe passe par le chemin ordinaire avec sa
portée ; garde si la donnée SWARFARM ne correspond plus au premier groupe.
`DamageSetup.cibleDegatsParSort` (classé `'sort'`) : « visée » (défaut) les
trois coups, « secondaire » le 3ᵉ seul sur un autre ennemi, à ses PV
saisis ; 224 sur les coups 1-2, 400 sur les trois, 411 au seul premier
coup ; `cibleSecondairePriseEnCharge` exportée pour 8b. Spec
`degats-reels/sequences-de-coups.md` (neuve, routée). Test
`testDegatsBladeSurge` (89 vérifications, corpus balayé : 8 identifiants,
11 formes).

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 092 vérifications,
build, spec-lint, diff-check. Mutations de l'agent : 2 et 2 échecs.
**Mutation du pilote** (411 sur tous les groupes) : 3 échecs, dont « 411,
autres ennemis : jamais » ; restauré.

**Laissé à 8b** : `resumeSort` affiche encore « 2 coups · Cible unique » ;
le parseur ne valide pas le champ (le calcul ignore toute valeur autre que
`'secondaire'`) ; l'invariant « rien des paramètres du sort ne se saisit »
non amendé. **Non prouvé** : aucun relevé en jeu ; deux appels de calcul
par évaluation quand Blade Surge est choisi, non mesuré.

#### Résultat du lot 8b — 2026-10-02

Lot parallèle (A.8, seconde vague), worktree `sw-forge-lot-8b` parti de
`22bd4590`, trois commits `3f301d6c`, `79bc6c55`, `bed12a3f`, intégrés en
`12595440`, `d6c576b5`, `22dda1f2`. **Recette** : `cibleDegatsParSort`
validé (objet, identifiant entier positif, « visee » ou « secondaire ») ;
la clé d'un sort sans coup de zone curé est **refusée avec son chemin**
par la table de capacité `cibleSecondairePriseEnCharge` (B.0 L849-851 —
appliqué par l'agent de lui-même, le brief du pilote ne le disait pas) ;
`testBladeSurgeRecette` (33). **Écran** : `Segmented` (taille lg) sous la
liste des sorts, après le champ des coups variables, libellés
`CIBLE_DEGATS_LABELS` partagés avec le CLI ; `resumeSequenceDeCoups`
(« 0.5 × ATQ puis 3.0 × ATQ · 2 coups · Cible unique, puis 1 coup ·
Zone ») ; le résumé ne lit jamais le cran ; aide de la carte complétée ;
`testBladeSurgeEcran` (19). **CLI** : la ligne du sort dit la séquence et
la cible calculée ; `testBladeSurgePariteEcranCli` (14). CLI réel (Lapis,
compte réel) : 10 031,1 sur la cible visée, 7 460,2 sur les autres
ennemis. Invariant L133 amendé ; recettes gelées
`recette-8b-blade-surge-visee.json` et `…-secondaire.json` ; preuve
`controle-8b.md`.

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 425 vérifications
(10 filtres), build, spec-lint, diff-check. Mutations de l'agent : valeur
inconnue acceptée (6 échecs), crans montrés pour un sort qui ne le permet
pas (5). **Mutation du pilote** (clé d'un sort sans coup de zone
acceptée) : 8 échecs ; restauré.

**Laissé ouvert → lot 8c** (créé après la réponse de l'utilisateur, A.8) :
le résumé sous l'objectif (`resumeCombat`) ne dit pas « autres ennemis »
quand ce cran est choisi (l'agent recommande de l'ajouter) ;
`scripts/artifact-search.ts` (diagnostic) écrit encore « 2 coup(s) » pour
Blade Surge ; le parseur accepte une clé à zéro de tête (« 01… »), que
celui de 10b refuse — sans effet au calcul (clé jamais lue), mais les deux
parseurs diffèrent (relevé par le pilote à l'intégration). **Non prouvé** :
aucun rendu à l'œil (A.8).

#### Lot 8c — suites de 8b : le résumé dit la cible, le parseur s'aligne

**Cat. J ; requiert 8b.** Décision de l'utilisateur du 2026-10-02, sur
l'écart rapporté par l'agent de 8b.

**Contrat.**

1. **Résumé sous l'objectif** (`resumeCombat`, `OptimizerSection.tsx`) :
   quand le sort RÉSOLU porte la capacité (`cibleSecondairePriseEnCharge`)
   et que la cible RETENUE par le calcul (`cibleDegatsRetenue(resolvedSkill,
   damageSetup)`, jamais la valeur stockée — même règle que le reste de ce
   résumé) vaut `'secondaire'`, un bout « autres ennemis » suit le sort
   (« S3 Blade Surge · autres ennemis · vs … »). Rien pour la cible visée
   (le défaut), rien pour tout autre sort. Le texte est dérivé de
   `CIBLE_DEGATS_LABELS` ou écrit une seule fois à côté, jamais une seconde
   écriture libre du libellé.
2. **Parseur** (`optimizerRecipe.ts`, `cibleDegatsParSort`) : la clé
   d'identifiant se valide comme celle de `premierCoupIgnoreDefParSort`
   (10b) — entier positif sans zéro de tête, refusé avec son chemin sinon.
   Constater (sans corriger) si d'autres champs indexés par identifiant de
   compétence acceptent encore une clé à zéro de tête ; liste dans le
   rapport.
3. **Script de diagnostic** `scripts/artifact-search.ts` : la ligne du sort
   dit la séquence curée par `resumeSequenceDeCoups`, comme le CLI
   (`optimizer-search.ts`), au lieu de « 2 coup(s) ».

**Preuves** : tests nommés (résumé : cran secondaire → le bout présent ;
visée, autre sort, sort résolu différent de l'identifiant stocké → absent ;
parseur : « 01… » refusé avec son chemin, clé valide acceptée) ; mutation
de l'agent par point ; `tsc`, tests de zone, build, spec-lint, diff-check ;
spec `optimizer.md` (ligne du résumé) et `degats-reels/sequences-de-coups.md`
à jour ; preuve `controle-8c.md`. Vérification à l'œil en A.8.

**Ne fait pas** : ni le cran d'ignore DEF des Blade Dancers dans ce résumé
(non demandé), ni autre changement de la carte, ni correction des autres
champs indexés (point 2 : constat seulement).

#### Résultat du lot 8c — 2026-10-02

Agent lancé par le pilote (A.8), dans le worktree du chantier. Trois
commits, un par point : `66309e93` — la clé de `cibleDegatsParSort` suit la
règle de 10b (`/^[1-9]\d*$/`, refus avec son chemin) ; `62dc6dce` — la
ligne « Sort : … » de `scripts/artifact-search.ts` passe par
`resumeSequenceDeCoups` (compte réel, Lapis : « 2 coups · Cible unique,
puis 1 coup · Zone ») ; `b55a02ec` — « autres ennemis » écrit une seule
fois (`CIBLE_SECONDAIRE_RESUME`, `damage.ts`), le libellé du cran s'en
déduit ; `resumeCibleDegatsRetenue` lit `cibleDegatsRetenue` sur le sort
RÉSOLU, le bout suit le sort dans `resumeCombat`. Tests
`testBladeSurgeResumeObjectif`, `testBladeSurgeLigneArtifactSearch`,
`testBladeSurgeRecette` complété ; spec `optimizer.md`,
`sequences-de-coups.md` ; invariants (« Rien des paramètres… » et
`cibleDegatsParSort`) amendés. Reçu `b55a02e` ↔ `48ea7df` ; preuve
`controle-8c.md` (341 lignes).

**Rejoué par le pilote sur `b55a02ec`** : reçu valide ; `tsc` 0 ; 1 495
vérifications (7 filtres) ; build, spec-lint, diff-check verts. Mutations
de l'agent : identifiant stocké lu (1 échec), texte réécrit par l'écran
(3), ancienne règle de clé (2), ancienne ligne du script (2). **Mutation du
pilote** (condition inversée : le bout pour la cible visée) : 7 échecs ;
restauré.

**Écart — erreur du contrat** : son exemple disait « S3 Blade Surge » ;
Blade Surge est le S1 des onze formes, jamais le sort par défaut (vérifié
par l'agent sur le corpus).

**Constat du point 2, non corrigé — décision de l'utilisateur en attente
(A.8)** : douze champs indexés par identifiant acceptent encore une clé à
zéro de tête (« 010616 »), mesuré avec le vrai parseur —
`validerRecordNumerique` (`optimizerRecipe.ts` L233) via L332
(`coupsPersonnalises`, `effetsCibleCount`, `buffsCibleCount`,
`buffsPropresCount`, `buffsAlliesCount`, `compteurPersonnalise`,
`effetsPropresCount`) et L336 (`stackPersonnalise`,
`pvActuelsAvantSacrificePct`) ; `validerRecordBooleen` (L245) via L340
(`passifsOffensifs`) et L342 (`statsCombatActives`) ;
`scenariosEffetsEntreCoups` (L374). Sans effet au calcul ; la clé morte
repart à l'export suivant.

**À juger à l'œil (A.8)** : au téléphone, « · autres ennemis » peut faire
passer le résumé sur une ligne de plus — derrière la fenêtre, le contrôle
cliqué ne bouge pas. **Non prouvé** : aucun rendu ; l'écran contrôlé par la
source seulement.

#### Lot 8d — une seule règle de clé d'identifiant pour toute la recette

**Cat. M ; requiert 8c.** Décision de l'utilisateur du 2026-10-02, sur le
constat du point 2 de 8c. Agent `lot-m` (A.4). Aucune décision à prendre :
tout est fixé ci-dessous ; un cas qui en demande une s'arrête et va dans le
rapport.

**Intrant** : `src/lib/optimizerRecipe.ts` L225-430 (`validerRecordNumerique`
L229, `validerRecordBooleen` L241, `validerDamageSetup` à partir de L262 —
lignes relevées sur `02f86533`) ; tests de la recette
(`tests/blade-surge-propagation.test.ts`, `tests/blade-dancers.test.ts`,
grep `optimizerRecipe` dans `tests/`) ; le Résultat de 8c ci-dessus.

**Contrat.**

1. Une fonction, `estIdentifiantDeCompetence(cle: string): boolean`, dans
   `optimizerRecipe.ts` : `/^[1-9]\d*$/` (entier positif sans zéro de tête).
2. Elle remplace TOUS les tests de clé d'identifiant de compétence du
   parseur, sans autre changement : `validerRecordNumerique` (sept champs
   entiers, deux décimaux), `validerRecordBooleen` (`passifsOffensifs`,
   `statsCombatActives`), `scenariosEffetsEntreCoups`, `cibleDegatsParSort`
   (8c) et `premierCoupIgnoreDefParSort` (10b) — quatorze champs. Message
   et chemin d'erreur inchangés (« utilise un identifiant de compétence
   invalide »).
3. Test nommé : pour chacun des quatorze champs, la clé « 010616 » est
   refusée avec son chemin exact, et une clé valide du même champ reste
   acceptée. La liste des quatorze champs est écrite une fois dans le test.
   Garde de source : le test compte les sites d'appel de
   `estIdentifiantDeCompetence(` dans `optimizerRecipe.ts` — **cinq**
   (`validerRecordNumerique`, `validerRecordBooleen`,
   `scenariosEffetsEntreCoups`, `cibleDegatsParSort`,
   `premierCoupIgnoreDefParSort` ; les neuf champs des deux tableaux
   passent par `validerRecordNumerique`) — et relit les deux tableaux de
   champs du parseur pour vérifier qu'ils sont dans sa liste : un site ou un
   champ ajouté plus tard sans test fait échouer. (Corrigé par le pilote
   avant le lancement : la première rédaction comparait quatorze champs à
   un nombre d'appels.)

**Preuve** : `grep -n` dans `optimizerRecipe.ts` → plus aucun `/^\d+$/`
ni `/^[1-9]\d*$/` hors de la fonction ; mutation (la fonction revient à
`/^\d+$/`) → échecs nommés ; `tsc`, `node tests/run.mjs optimizerrecipe
bladesurge bladedancers recettepartagee aurasrecette cliclassement`, build,
spec-lint, diff-check ; la spec qui décrit la validation de la recette
(grep « identifiant de compétence invalide » ou « zéro de tête » dans
`spec/`) dit la règle une fois ; preuve `controle-8d.md`.

**Ne fait pas** : aucun autre parseur (persistance, autres fichiers) — s'il
en trouve un qui valide une clé d'identifiant, il le signale dans le
rapport, sans le modifier ; aucune autre règle de validation ; rien à
l'écran.

#### Résultat du lot 8d — 2026-10-02

Premier lot confié à l'agent `lot-m` (Sonnet 5.5, effort bas, A.4). Un
commit, `52717fe0` : `estIdentifiantDeCompetence` (`/^[1-9]\d*$/`,
`optimizerRecipe.ts` L234) remplace les cinq tests de clé (quatorze
champs), message et chemin inchangés ; `testRecetteClesIdentifiant`
(`tests/recette-cles-identifiant.test.ts`, 49 vérifications : « 010616 »
refusé avec son chemin exact pour chaque champ, « 0 » refusé, clé valide
acceptée ; garde de source : cinq sites, les neuf champs des deux tableaux
dans la liste, une seule expression de clé dans le fichier). Aucune spec ne
décrit la validation de la recette en bloc ; `formules-et-combat.md` et
`sequences-de-coups.md` disent déjà « sans zéro de tête » pour leur champ —
rien de modifié. Reçu `52717fe` ↔ `5af83df` ; preuve `controle-8d.md`
(55 lignes).

**Rejoué par le pilote sur `52717fe0`** : reçu valide ; `tsc` 0 ; 777
vérifications (7 filtres) ; build, spec-lint, diff-check verts. Mutation de
l'agent (la fonction revient à `/^\d+$/`) : 26 échecs. **Mutation du
pilote** (un site, `scenariosEffetsEntreCoups`, réécrit avec l'ancienne
règle en ligne) : 3 échecs — le refus, et les deux gardes de source (4
sites au lieu de 5, 2 expressions au lieu d'une) ; restauré. Autres
parseurs : l'agent n'a pas cherché hors du fichier ; le pilote a relevé
`src/` et `scripts/` — les trois autres `/^\d+$/` (`Pager.tsx`,
`SubSearchDialog.tsx`, `OptimizerSection.tsx` L5548) filtrent une frappe
dans un champ, aucune clé de recette.

**Défaut du brief** (relevé par l'agent) : la mutation y venait avant le
commit, et la restauration par `git checkout --` a effacé le travail non
commité, réappliqué ensuite à la main. Règle ajoutée en A.8 : muter après
le commit.

### Lot 9 — Teshar : Tempest après S1/S2, et comme sort

⚠️ **Recalé le 2026-10-02 et scindé en 9a / 9b** : lire d'abord
« Recalage du lot 9 » en fin de section, qui prévaut sur ce qui suit.

**Cat. J.** Bloqué par les lots 1, son amendement pilote et 2b. Constat 164.

**Trois choses, dans cet ordre :**

1. **Une formule curée.** `Tempest (Passive)` (`3213`) porte
   `formule: ""` : `monsterOffensivePassives` (l. 3089) l'ignore
   silencieusement, par la double garde du fichier. La formule entre dans
   `FORMULES_CUREES_PAR_ID` (l. 2581), table qui existe pour ça — avec la
   citation du relevé et de l'audit (`other_skill=1181`) en commentaire.
2. **Un passif offensif à interrupteur.** Entrée dans
   `PASSIFS_OFFENSIFS_CONNUS` (l. 2931) : le passif s'active par
   `DamageSetup.passifsOffensifs[3213]` quand le sort choisi est S1 ou S2, et
   **seulement** ceux-là. ⚠️ `PASSIFS_OFFENSIFS_CONNUS` est keyé par **nom**
   (`Competence.nom`), volontairement — le commentaire de
   `PassifOffensifConnu` dit pourquoi : un `com2usId` de passif change d'une
   fiche à l'autre. Vérifier que `Tempest (Passive)` ne désigne pas un autre
   monstre avant de l'y mettre ; sinon, la table par id.
3. **Sélectionnable comme sort 3.** Un passif qui devient un choix de
   « Compétence utilisée ». ⚠️ **C'est nouveau** : `skillDamageProfile`
   retourne `null` dès `c.passif` (l. 2732). Le lot décide **comment** — un
   `SkillDamageProfile` construit depuis le passif, ou une troisième voie —
   et l'écrit. La règle de calcul ne change pas : sur ce cran, seuls les
   dégâts de cette attaque s'affichent, **une seule fois**. Le passif 3213
   n'est jamais ajouté à lui-même, même si son interrupteur est resté actif.

**Artéfacts :** 411 ne s'applique **jamais** à Tempest, même sélectionné seul.
Il s'applique au premier coup du S1/S2 qui précède, conformément à la règle
du premier coup DU TOUR. 224 ne s'applique jamais à Tempest, en zone.
Le mode « Tempest seul » isole cette contribution, il ne lui attribue pas
une place de premier coup et ne déclenche jamais une seconde Tempest. Les PV
saisis y décrivent l'état avant Tempest. Les lignes 402 et 410 de dégâts
critiques S3 s'appliquent **une fois** à sa contribution `3.7 × ATQ`, qu'elle
soit affichée seule ou après S1/S2 ; elle n'hérite jamais de la ligne du sort
déclencheur. Dans le mode combiné, le S1/S2 initial conserve sa propre ligne.

⚠️ **Les artéfacts 222/223** (D.CRIT+ selon bon / mauvais état des PV ennemis)
doivent voir les PV **tels que le sort précédent les a laissés**. Le
mécanisme existe déjà : `computeSkillDamageDetail` creuse `pvCourant` coup par
coup et les passifs frappent après (`degats-reels.md`, § « Les PV de la cible
se creusent COUP PAR COUP »). Le lot **prouve** que Tempest en profite ; il ne
recode pas la chaîne.

**Sortie :** les trois comportements + un test nommé par comportement. Le
périmètre de même mécanique est `3213`, porté par `14503` Phoenix vent et
`14513` Teshar vent. Le mécanisme générique doit accepter les **81 identifiants
de même architecture** nommés dans `controle-1f.md` : 58 de la famille
`tempest` initiale, trois S2 Kung Fu Girls `8216`, `8217`, `8219` et vingt
compétences de Samouraïs `8021` à `8040`. Cela ne les ajoute pas au calcul de
production de ce lot.

⚠️ **Le mécanisme, lui, est générique et doit le rester** (A.3 bis, second
niveau) : « une compétence supplémentaire à profil propre, déclenchée après
certains sorts et activée par un interrupteur utilisateur, sélectionnable
isolément quand le produit le demande ». Parmi les 58 identifiants initiaux,
17 amorces appartiennent aux constats 168, 178 et 179 ; 41 autres ont été
découverts par l'effet `Additional Attack`. Le lot **n'en code aucune**, mais
il écrit dans la spec **ce qu'il faudra fournir** pour en ajouter une : le
ratio, la liste des sorts déclencheurs, la portée. Un mécanisme limité à
Teshar serait à refaire pour les 81 cas. Les deux lignes du constat 313 sont
explicitement hors de cette architecture.

**Preuve :** les tests · `npx tsc --noEmit` ·
`node tests/run.mjs <noms> degats audit-degats-conditionnels` · `npm run build`.

**Ne fait pas :** ne traite aucun des 81 identifiants de même architecture.
Les 17 amorces gardent leur numéro de constat ; les 41 découvertes
`Additional Attack` et les 23 couples du complément rejoignent nominativement
le lot 13. Les S1 Kung Fu Girls `8201` à `8205` et les S2 `8218`/`8220` sont
déjà comprises dans les 58 identifiants initiaux. Les cinq S3 `8211` à `8215`,
curées mais présentes comme contexte sans couple propre, rejoignent également
l'inventaire du lot 13 sans être comptées dans les 81.

#### Recalage du lot 9 — 2026-10-02, sur `8ea90bd9`

Carte d'un agent en lecture seule ; ancrages structurants vérifiés par le
pilote. Rien n'a été fait entre-temps sur Tempest. Prérequis, spec
(`degats-reels/`, nouveau fichier routé) et contraintes nées depuis
(donnée pure, `AurasPropres`, classe `'sort'`) : comme le recalage du lot 8.

- **Point 1 — ne tient plus tel quel.** `FORMULES_CUREES_PAR_ID`
  (`damage.ts` L2596) n'est lue que par `skillDamageProfile` (L2749), qui
  écarte les passifs (L2748) ; `monsterOffensivePassives` garde
  `!c.formule` et lit `c.formule` (L3108-3111). La formule curée d'un
  passif doit passer par la table curée (garde ET lecture) ; amender le
  commentaire L2856-2861, `passifs-offensifs.md` L19-27 et `invariants.md`
  L150. Donnée vérifiée par la carte : `14513.json`, compétence 1181,
  `com2usId` 3213, `formule: ""`, passif, zone, +30 %.
- **Point 2.** `PASSIFS_OFFENSIFS_CONNUS` L2946 ; « Tempest (Passive) »
  n'est porté que par 14503 et 14513 (déjà vérifié). La restriction S1/S2
  demande un champ curé de slots déclencheurs, lu avec `profile.slot` dans
  `computeTotalDamage` (boucle L4885) ET dans `damageRelevantStats`
  (L5058, invariant L159) : `passifActif` (L4690) ne connaît pas le sort
  choisi, et `setup.skillCom2usId` peut valoir `null`. Interface
  `conditionnel` existante (`DamageSetupCard.tsx` L846-880).
- **Point 3, Tempest comme sort.** Retour `null` dès `c.passif` (L2748). À
  traiter en plus : `defaultDamageSkill` (L3199-3202) ne fait jamais de
  Tempest le sort par défaut ; neutraliser 411 pour Tempest seul (le sort
  actif reçoit les artéfacts entiers, L4855) ; exclure le passif 3213 de la
  boucle quand il est lui-même le sort ; amender `invariants.md` L152 et le
  commentaire L3160 (« un passif n'est jamais le sort choisi »).
- **Après S1/S2, les artéfacts sont déjà assurés par le chemin passif**
  (411 neutralisé L4883-4884, 402/410 par `slot` = 3, 224 absent car
  `aoe`, 222/223 sur PV enchaînés) : le lot le prouve, il ne le recode pas.
- **Valeurs** : toutes présentes (A.2 ter L141-142, L161, L163) ; « 402/410
  une fois sur Tempest » et 222/223 sont sourcés dans
  `controle-1c1-amendement.md` L73-75 et L80-81 (utilisateur, 2026-09-23),
  à citer. Les Samouraïs choisissent leur suite (A.2 ter L153) : la spec du
  mécanisme générique le dit, « activée par un interrupteur » ne les couvre
  pas.
- **Écran (réponses de l'utilisateur du 2026-10-02)** : sort par défaut de
  Teshar inchangé, **S2** ; l'interrupteur s'intitule « **Tempest (S3) se
  déclenche après ce sort** », désactivé par défaut ; il est **masqué**
  quand Tempest est lui-même la compétence choisie.
- **Preuve en plus** : un aller-retour de recette avec `skillCom2usId` =
  3213 (l'identifiant d'un passif). Compte réel : Teshar vent (14513)
  présent.

**Scission** (intrant estimé ~3 100 lignes) : **9a** points 1 et 2
(~2 300) ; **9b** point 3, écran et spec du mécanisme générique (~2 300) ;
9b requiert 9a.

#### Résultat du lot 9a — 2026-10-02

Lot parallèle (A.8), worktree `sw-forge-lot-9a` parti de `0899b541`, deux
commits `0066475e`, `e7f3e524`, intégrés en `50e46aea`, `e5dc87ae`.
`monsterOffensivePassives` lit la formule de `FORMULES_CUREES_PAR_ID`
(garde `!c.formule` retirée ; seul 3213 est un passif de cette table,
balayage des 8 434 compétences) : `3213: '3.7*{ATK}'` ; « Tempest
(Passive) » dans `PASSIFS_OFFENSIFS_CONNUS` en `conditionnel`, désactivé
par défaut, `slotsDeclencheurs: [1, 2]` ; `passifCompte(p, sort, setup)`,
seule porte des boucles de `computeTotalDamage` et `damageRelevantStats`.
Tests `testDegatsTempestFormule`, `testDegatsTempestDeclenchement` (74
vérifications : 3,7 × à +30 %, après S1 et S2 seulement, 411 jamais, 402/410
une fois, 224 absent, 222/223 sur les PV enchaînés).

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 048 vérifications,
build, spec-lint, diff-check. Mutations de l'agent : 4, 3, 2 et 2 échecs.
**Mutation du pilote** (propagation de `slotsDeclencheurs` retirée) :
3 échecs, dont « sort fictif de slot 3 : Tempest ne compte pas » ;
restauré. Coups critiques de Tempest (déduits par l'agent) : **confirmés
par l'utilisateur le 2026-10-02** (A.2 ter).

**Effets visibles avant 9b** : Tempest apparaît dans les passifs de Teshar
et Phoenix vent avec le texte provisoire « Se déclenche si sa recharge est
terminée au moment où ton S1 ou ton S2 frappe (recharge non simulée) » ;
le CLI affiche son état par `passifActif`, sans le slot (repris par 9b).
`passifs-offensifs.md` à 499 lignes (plafond 500).

#### Résultat du lot 9b — 2026-10-02

Lot parallèle (A.8, seconde vague), worktree `sw-forge-lot-9b` parti de
`22bd4590`, trois commits `42cbce3e`, `5d66c5a2`, `33a9239d`, intégrés en
`db32bbd9`, `2402e91d`, `badea22f`. **Moteur** : Tempest (3213) curé
`selectionnableCommeSort` ; `monsterDamageSkills` reprend le profil EXACT
du chemin passif (marqué `passif`), jamais `skillDamageProfile` ;
`defaultDamageSkill` ne retient que les sorts actifs (Teshar reste sur S2,
n° 9) ; `passifPeutSuivre` (exclusion par identifiant, puis slots de 9a)
devient la porte de `passifCompte`, donc du total ET des stats
pertinentes ; 411 neutralisé pour un passif choisi seul. **Écran** :
« Tempest (S3) se déclenche après ce sort » (n° 11), désactivé par défaut,
à la place de la phrase de 9a (la condition reste au survol, `title`) ;
interrupteur **masqué** quand Tempest est la compétence choisie (n° 10).
**CLI** : état des passifs par `passifCompte`, « choisi comme sort : compté
une seule fois ». `scripts/artifact-search.ts` prenait le dernier sort de
la liste (aurait pris Tempest) : passe au sort par défaut. Spec neuve
`degats-reels/attaque-apres-un-sort.md` (routée) ; tests
`testDegatsTempestCommeSort`, `…Recette`, `…Ecran`. CLI réel (Teshar) :
recette 3213 → « Tempest (Passive) » sans repli. Preuve `controle-9b.md`.

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 892 vérifications
(14 filtres), build, spec-lint, diff-check. Mutations de l'agent : 3, 14,
8, 1 et 1 échecs. **Mutation du pilote** (tout passif offensif proposé
comme sort) : **survivante** au premier rendu — la garde « corpus » lisait
le drapeau, jamais la liste réellement proposée. Renvoyée à l'agent :
`33a9239d` vérifie la liste fiche par fiche ; la même mutation donne alors
2 échecs (« 31 écart(s), dont 12134:3464 ») ; restauré.

**Relevé à l'intégration, sans cas aujourd'hui → lot 12 (constat)** : la
prose de « Stats acquises en combat » (lot 11) écarte les compétences des
`...passifs`, alors que le bloc des passifs ne rend plus que
`passifsSuivants` : un passif masqué par 9b qui porterait aussi des stats
de combat perdrait sa prose. Tempest n'en porte pas. **Non prouvé** : rendu
à l'œil (A.8) ; valeur en jeu de Tempest seul ; Worker de résolution avec
un passif comme sort (pas de cas dédié).

#### Lot 9c — l'attaque appelée active, la prose des passifs masqués

**Cat. J ; requiert 12.** Le lot 12 a trouvé le mécanisme 9 en défaut sur
son contrat (Résultat du lot 12 ; `controle-12.md` § 3.3 et § 5) : le
contrat 9 exigeait qu'il accepte les 81 identifiants de même architecture,
dont les **17 amorces des constats 168 (Mina), 178 (RYU et Striker) et 179
(Maîtres ivres)** ; or une attaque appelée qui est une compétence ACTIVE
(la S2 de RYU appelle sa S1) ne peut pas être fournie par une ligne de
table. Règle du lot 12 : correction, puis nouvelle preuve avant clôture.

**Intrant** : ce contrat ; Résultats des lots 9a, 9b et 12 ; contrat du lot
9 (« Le mécanisme, lui, est générique… ») ; `controle-12.md` § 3 et § 5
avec `controle-12-intrants/experience-9-attaque-appelee.ts` ;
`attaque-apres-un-sort.md` (en entier) ; `damage.ts` par plages
(`PASSIFS_OFFENSIFS_CONNUS`, `monsterOffensivePassives`, `passifPeutSuivre`,
`passifCompte`, `computeTotalDamage`, `damageRelevantStats`) ;
`DamageSetupCard.tsx` (`clesProseDejaRendue`, `passifsSuivants`) ;
`tests/degats-tempest.test.ts`, `tests/degats-lot12.test.ts`,
`tests/prose-stats-combat.test.ts` ; `optimizerRecipe.ts` L415-425.

**Contrat.**

1. **Approvisionnement d'une attaque appelée active.** Une table curée
   clée par l'identifiant du **sort déclencheur** et le **slot appelé**
   (jamais par nom : « Hadoken » est porté par 12 formes, dont 6 sans
   Shoryuken), lue par le chemin des passifs offensifs ou par un chemin
   frère qui produit le même `PassifOffensifProfile` : le profil de
   l'attaque est celui de la compétence active de ce slot dans la MÊME
   fiche, déclenchée après ce seul sort. Le calcul ne change pas (le lot 12
   l'a trouvé générique). Le marqueur `passif` du profil dit la vérité (une
   S1 n'est pas un passif) sans changer le sort par défaut, la neutralisation
   de 411 ni l'exclusion par identifiant de `passifPeutSuivre`. **Aucune
   entrée de production** (le contrat 9 : « n'en code aucune ») : la preuve
   injecte les entrées dans un test et les retire (`finally`).
2. **Couverture prouvée** : les 6 formes du constat 178 acceptées par UNE
   entrée chacune (même total que le profil construit à la main du lot 12,
   au centième près) ; les amorces des constats 168 et 179 examinées une
   par une — acceptées de la même façon, ou classées avec leur raison
   (mécanique voisine, donnée manquante) ; jamais forcées.
3. **Espace de clés de l'interrupteur** (`controle-12.md` § 3.3, point 5) :
   pour les 17 amorces, dire si l'interrupteur d'une attaque appelée peut
   partager sa clé de `passifsOffensifs` avec un réglage du même sort ; si
   oui, une clé distincte ; si non, un test qui le garde.
4. **Prose des passifs masqués** : l'exclusion de `clesProseDejaRendue`
   lit ce que le bloc des passifs rend vraiment (`passifsSuivants`), pas
   tous les `passifs` ; le test de source du lot 11 et la sentinelle du lot
   12 suivent ; un passif masqué synthétique porteur de stats de combat
   reçoit sa prose.
5. **Spec** : `attaque-apres-un-sort.md` § « Ce qu'il faudra fournir pour
   un autre cas » dit les deux natures (passif clé par nom ; attaque
   appelée active clé par déclencheur et slot), et la limite de la Marque
   posée par le déclencheur (non modélisée, à relever avant de curer).
6. **Annexe, lot 10** : le message de refus `optimizerRecipe.ts` L420 ne
   dit plus « seuls les six sorts des Blade Dancers » ; il ne compte plus
   les entrées de la table.

**Preuves** : tests nommés ; mutation par point APRÈS le commit (A.8) ;
`tsc`, `node tests/run.mjs tempest lot12 prosestatscombat bladedancers
degats auditdegatsconditionnels optimizerdamagetransitions` + filtres
neufs, build, spec-lint, diff-check ; tous les tests de 9a, 9b et Tempest
inchangés et verts ; preuve `controle-9c.md`. Aucune vérification à l'œil
nouvelle (rien de visible sans entrée de production).

**Ne fait pas** : aucune entrée de production pour l'un des 81 identifiants ;
ni la Marque, ni Head Press (constat 155), ni les voisins classés par le
lot 12 (lot 13) ; aucun changement de la règle de calcul ni de Tempest.

#### Résultat du lot 9c — 2026-10-02

Agent lancé par le pilote (A.8), dans le worktree du chantier. Trois
commits : `38223c94` — `ATTAQUES_APPELEES_PAR_DECLENCHEUR` (clé = sort
déclencheur, valeur = slot appelé et source ; **vide en production**), lue
par `attaquesAppeleesDeLaFiche` à la fin de `monsterOffensivePassives` :
profil de la compétence active du slot appelé par `skillDamageProfile`
(sans marqueur `passif`), après le seul slot du déclencheur, retenu
seulement si ce slot et le slot appelé ne portent qu'une compétence ; deux
déclencheurs vers le même slot → un profil, un interrupteur ; calcul
intact ; test `testAttaqueAppelee…` (`tests/degats-attaque-appelee.test.ts`)
et spec `attaque-apres-un-sort.md` (deux natures, effets posés par le
déclencheur, Marque à relever, tableau des 17 amorces),
`conditions-et-audit.md` ; `783df03d` — la carte passe `...passifsSuivants`
à `clesProseDejaRendue` ; tests du lot 11 et sentinelle du lot 12 suivis,
`testProseStatsCombatPassifMasque` ; `39145f17` — le refus d'une clé sans
règle d'ignore DEF ne compte plus les sorts, `formules-et-combat.md`
suit. Invariants : une entrée neuve (attaque appelée), une amendée (prose).
Reçu `39145f1` ↔ `1b86eb0` ; preuve `controle-9c.md` (264 lignes) et
`controle-9c-intrants/`.

**Les 17 amorces** : **11 acceptables** par une entrée chacune (même total
que le profil construit à la main du lot 12, au centième, sur 4 réglages) —
13907, 13908, 13910, 14407, 14408, 14410 (constat 178) ; 8107, 8110, 8113,
8114 et 8115 (Maîtres ivres, 8115 avec une limite en mode Moyenne) ;
**6 classées** — 8106, 8108, 8109 (One More Drink est un soin sans profil ;
Rolling Punch y prendrait le 411), 8111 (le buff de VIT de Seal Punch lu par
la ligne 221), 8112 (le buff d'ATQ de Tiger Punch), 6161 (Mina : déclenché
par tout coup critique, S1 comprise, qui s'appellerait elle-même).
**Espace de clés** : aucun partage pour les 12 compétences appelées ;
`testAttaqueAppeleeEspaceDeCles` le garde (structure, score du CLI, garde du
corpus pour les entrées futures).

**Rejoué par le pilote sur `39145f17`** : reçu valide ; `tsc` 0 ; 2 187
vérifications (9 filtres) ; build, spec-lint, diff-check verts. Mutations
de l'agent : 67, 23, 5, 1 et 2 échecs. **Mutations du pilote** : la garde
« compétence passive au slot appelé » retirée → aucun échec, mais
**équivalente** (`skillDamageProfile` rend déjà `null` pour un passif,
L2945 : aucun effet observable) ; la garde « déclencheur seul à son slot »
affaiblie → 1 échec ; restauré.

**Renvoyé au lot 13 (13b, famille 08), avant toute entrée de production** :
l'asymétrie 8115 (accepté sur la parole de l'utilisateur, amendement 1c1)
/ 8111 (classé, rien ne le dit sans effet) ; la Marque posée par la S2 des
six formes du constat 178, du même genre que les buffs qui ont fait classer
8111 et 8112, à relever en jeu ; la décision d'interface au premier cas curé
(une attaque appelée active s'afficherait sous « Passifs offensifs », avec
« Hadoken (S1) se déclenche après ce sort »). **Non prouvé** : aucune
valeur de jeu ni relevé ; aucun rendu (rien de visible sans entrée de
production).

### Lot 10 — l'ignore DEF conditionnel des Blade Dancers

⚠️ **Recalé le 2026-10-02 et scindé en 10a / 10b** : lire d'abord
« Recalage du lot 10 » en fin de section, qui prévaut sur ce qui suit.

**Cat. J.** Bloqué par les lots 1, son amendement pilote et 2b. **Tout le
constat 212 — et lui seul : 6 identifiants, 12 formes de corpus, deux
variantes.** Le lot 1f confirme que la famille est close. Les formes non
éveillées restent inventoriées sans devenir sélectionnables (`A.2 ter`). Lire
B.0 pour le champ
`premierCoupIgnoreDefParSort` et sa propagation.

**Aujourd'hui** `ignoreDef` est un booléen dérivé de la seule présence de
l'effet `Ignore DEF` (`damage.ts` l. 2792), sans jamais lire sa `note` : les
six sorts ignorent donc la DEF **sur tous leurs coups**, ce qui surestime.

**La règle, donnée par l'utilisateur** (A.2 ter) : le **coup 1 ne peut jamais**
ignorer la DEF, et **une fois qu'un coup ignore, tous les suivants ignorent**.
C'est une **monotonie** : le choix se réduit donc à *un seul nombre* — le rang
du premier coup qui ignore — jamais à un ensemble de coups. ⚠️ La jauge d'ATB
adverse n'est pas modélisée et ne le sera pas ici : c'est ce qui fait de ce
rang un **choix** de l'utilisateur, pas un état déduit.

**Les crans, par variante :**

| Variante | Identifiants de compétence initiaux | Crans retenus |
| --- | --- | --- |
| **A** — 3 coups, ATB −50 %/coup | `14308`, `14310`, `14808`, `14810` | **aucun ignore DEF** (défaut) · **à partir du 2ᵉ coup** · **à partir du 3ᵉ coup** |
| **B** — 7 coups, ATB −40 %/coup, **7ᵉ coup toujours ignore DEF** | `14311`, `14811` | à partir du 2ᵉ · 3ᵉ · 4ᵉ · 5ᵉ · 6ᵉ · **7ᵉ seul** (défaut) ; « aucun » n'existe pas |

**Aucune ATB initiale ni nombre de réductions réussies n'est déduit.**
L'utilisateur choisit le scénario ; le premier coup reste exclu par la règle
fournie. Supprimer la justification antérieure `⌈100/50⌉` / `⌈100/40⌉`, qui
introduisait arbitrairement 100. La table par `com2usId` porte les rangs
autorisés et l'éventuel dernier coup inconditionnel, avec leur source.

**Décision confirmée par l'utilisateur le 2026-09-23 :** « aucun ignore DEF »
ne concernait que la variante A à trois coups. La variante B garde son
septième coup inconditionnel et prend « septième seul » par défaut.

**Recettes :** décision utilisateur explicite du 2026-09-23, pas de migration
pour préserver l'ancien calcul de ces monstres : aucun utilisateur n'a exporté
de recette avec eux. Champ absent → nouveau défaut retenu ; cette dérogation
ne concerne aucun autre champ/monstre. Un champ présent doit toujours être
validé (type et rang permis), et le choix suit les resets du lot 5.

**Le patron de saisie existe** : `ScenarioEffetsEntreCoups.apresCoup`
(`Record<string, number | null>`, l. 2011) — « numéro du coup APRÈS lequel la
pose réussit ; absent/null = aucune réussite ». C'est exactement la forme
demandée (« même logique que des sorts pouvant poser une brand ou break def et
dont on choisit quels coups sont affectés »).

⚠️ **Ne pas confondre avec `ignoreDefSelonVit`** (une fraction proportionnelle
à l'écart de VIT, l. 2527) ni avec `ignoreDefParStack` (l. 1992) : trois
mécaniques distinctes, celle-ci n'est ni l'une ni l'autre.

**Sortie :** les six identifiants couvrent leurs douze formes de corpus —
variante A : `14308`, `14310`, `14808`, `14810`, formes `24403`, `24405`,
`24413`, `24415`, `24903`, `24905`, `24913`, `24915` ; variante B : `14311`,
`14811`, formes `24401`, `24411`, `24901`, `24911`. Seules les formes
sélectionnables selon `A.2 ter` proposent les crans dans l'écran. Un test nommé
vérifie **chaque cran et le défaut des deux variantes**, que le coup 1 n'ignore
jamais, que le 7ᵉ
de la variante B ignore dans tous les crans, et — contrôle négatif — qu'un sort
ignore-DEF inconditionnel (`IGNORE_DEF_COMPLET_CONNUS`, l. 2716) est
**inchangé**.

**Preuve :** le test, contrôle négatif inclus · l'extraction des identifiants et formes du
lot 1 citée dans la spec · `npx tsc --noEmit` ·
`node tests/run.mjs <nom> degats audit-degats-conditionnels`.

**Ne fait pas :** ne traite pas les 16 autres constats de la catégorie 09
(28 lignes d'audit restantes, lot 13a) — autres mécaniques d'ignore DEF conditionnel,
lot 13.

#### Recalage du lot 10 — 2026-10-02, sur `8ea90bd9`

Carte d'un agent en lecture seule ; ancrages structurants vérifiés par le
pilote. Rien n'a été fait entre-temps ; règle, crans, défauts, recettes et
resets tiennent (A.2 ter L155-156, B.0, contrat ci-dessus). Prérequis,
spec et contraintes nées depuis : comme le recalage du lot 8.

- **Ancrages** : le booléen d'ignore DEF `damage.ts` L2807-2810 ; les six
  sorts portent `Ignore DEF` (« If enemy ATB at 0 [or 7th hit] ») et sont
  absents d'`IGNORE_DEF_CONDITIONNEL_PAR_ID` (L2732-2735) : aujourd'hui ils
  ignorent la DEF sur tous leurs coups ; `IGNORE_DEF_COMPLET_CONNUS` L2731 ;
  type `apresCoup` L2026-2032 ; `Selecteur` de l'écran `DamageSetupCard.tsx`
  L1332-1350 ; découpe coup par coup L3967-4037 et L4101-4125.
- **Mécaniques à ne pas confondre : six, pas trois** — `ignoreDefSelonVit`
  (L2542, L2205, L4293), `ignoreDefParStack` (L2007, L1339, L1434),
  `IGNORE_DEF_CONDITIONNEL_PAR_ID` (L2732 : il neutralise l'ignore, ne pas y
  mettre les Blade Dancers), `compteurMin` (L2008), `ignoreDefPct` des
  conditions de combat (L4296-4302).
- **La DEF de la cible reste affichée** dans tous les crans de ces six
  sorts : `champsDuCombat` (L3228-3234) la masque aujourd'hui dès que
  `ignoreDef` est vrai (écran L327, résumé `OptimizerSection.tsx` L622).
  Vérification à l'écran ajoutée en A.8.
- **Écran (n° 12, retenu par l'utilisateur)** : sélecteur « Ignore la DEF
  (jauge de la cible à 0) » ; sorts à 3 coups : « Aucun » (défaut), « Dès
  le 2ᵉ coup », « Dès le 3ᵉ coup » ; sorts à 7 coups : « Dès le 2ᵉ coup » à
  « Dès le 6ᵉ coup », puis « 7ᵉ coup seul » (défaut).
- Mettre à jour `resumeSort` L229, la ligne du CLI L201, `invariants.md`
  L130 et L161 ; **`npm run build`** dans les preuves (l'écran est touché).
- **Compte réel** : Cordelia (vent) et Vereesa (ténèbres) présentes.

**Scission** (intrant estimé ~2 800 lignes) : **10a** moteur ; **10b**
propagation B.0 et écran, sur le patron de 8b (~1 800) ; 10b requiert 10a.

#### Résultat du lot 10a — 2026-10-02

Lot parallèle (A.8), worktree `sw-forge-lot-10a` parti de `0899b541`, deux
commits `0be409f6`, `7770969a`, intégrés en `db913084`, `dc8e4b5f`.
`IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID` : variante A (`14308`, `14310`,
`14808`, `14810`, 3 coups, rangs 2-3, aucun par défaut), variante B
(`14311`, `14811`, 7 coups, rangs 2-7, 7ᵉ inconditionnel et défaut), avec
leur source ; `profile.ignoreDefAPartirDuCoup` (et `ignoreDef` faux pour
ces six sorts), refus si les données annoncent un autre nombre de coups ;
`DamageSetup.premierCoupIgnoreDefParSort` (classé `'sort'`, `null` =
« aucun ») ; `resolvedPremierCoupIgnoreDef` (toute valeur non permise
retombe sur le défaut) ; calcul en tronçons de coups, PV enchaînés, 411 au
coup 1 seulement, aucune ATB déduite. Corpus balayé (3 073 fiches) : la
famille est close. Test `testBladeDancersIgnoreDef` (227 vérifications).

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 241 vérifications,
build, spec-lint, diff-check. Mutations de l'agent : 29 et 9 échecs.
**Mutation du pilote** (rang non permis accepté) : 3 échecs, dont « un coup
1 demandé retombe sur le défaut, jamais appliqué » ; restauré.

**Effets visibles avant 10b** : `resumeSort` et la ligne du CLI
n'affichent plus « Ignore la DEF » pour ces six sorts ; `champsDuCombat`
montre déjà la DEF de la cible ; le parseur ne valide pas encore le champ.

#### Résultat du lot 10b — 2026-10-02

Lot parallèle (A.8, seconde vague), worktree `sw-forge-lot-10b` parti de
`22bd4590`, quatre commits `f82a7e1f`, `627f8dec`, `98398a08`, `5aed8073`,
intégrés en `784378b9`, `cc3ab044`, `89ea229f`, `072c7c3f`. **Écran** :
sélecteur « Ignore la DEF (jauge de la cible à 0) » pour les six sorts
seulement, crans et libellés dérivés de la règle curée
(`cransIgnoreDefAPartirDuCoup`), valeur montrée = cran retenu par le calcul
(`cranIgnoreDefRetenu`) ; le résumé du sort dit ce cran **sur une ligne à
lui** (`block truncate`, une ligne quel que soit le cran : choix de
l'agent pour que le sélecteur ne bouge pas, à juger à l'œil) ; libellés
« Ignore la DEF : aucun » / « : dès le Nᵉ coup » / « : 7ᵉ coup seul ».
**CLI** : la même phrase (`resumeIgnoreDefRetenu`) ; CLI réel (Cordelia,
rang 2) : 19 320,0 → 59 606,6 (× 3,0852, conforme au calcul à la main).
**Recette** : validée selon la règle du sort (`cransDeLaRegleIgnoreDef`,
même source que les crans) — variante A `null`, 2, 3 ; B 2 à 7 —, refus
avec son chemin de toute autre valeur et de la clé d'un sort sans cette
règle ; clé à zéro de tête refusée aussi (au-delà de B.0).
`premierCoupIgnoreDefParSort` ajouté à la table des transitions
d'`optimizer.md`. Preuve `controle-10b.md`, recettes
`recette-10b-cordelia-defaut.json` et `…-rang2.json`.

**Erreur du pilote** : le premier brief demandait d'accepter à l'import un
rang hors crans (repli au calcul) ; B.0 L819 et L849-851 exige de le
REFUSER, ainsi que toute clé de sort sans la règle. `f82a7e1f` suivait le
brief ; correction demandée à l'agent (`5aed8073`).

**Rejoué par le pilote** dans le worktree, après correction : `tsc` 0,
1 779 vérifications (10 filtres), build, spec-lint, diff-check. Mutation
de l'agent (rang hors crans accepté) : 9 échecs. **Mutation du pilote**
(clé d'un sort sans règle ignorée au lieu d'être refusée) : 5 échecs ;
restauré. **Non prouvé** : rendu à l'œil (A.8) ; CLI non relancé après
`5aed8073` (calcul inchangé) ; variante B au CLI (couverte par les tests).

### Lot 11 — les passifs « Stats acquises en combat » : prose et Gold Headband

⚠️ **Recalé le 2026-10-02** : lire d'abord « Recalage du lot 11 » en fin de section, qui prévaut.

**Cat. C puis J.** Requiert le lot 1 (extraction 4 et amendement pilote) et 2b.
L'inventaire porte 38 identifiants / 40 configurations ; huit configurations
ont déjà leur prose ailleurs. Le correctif porte donc sur 30 identifiants /
32 configurations, en nommant toutes les formes affectées.

**Constat de départ, mesuré :** `CombatStatProfile` **porte déjà**
`description` (la prose SWARFARM, `damage.ts` l. 1676), et les 38 identifiants de
`STATS_COMBAT_PAR_ID_CONNUS` sont bien curées — **y compris Mayasura**
(`18311`, `stacks`, `atkFlat: 100`) **et Jager lumière** (`7814`, `stacks`,
`atkPct: 50`). Aucune branche « Stats acquises en combat » de
`DamageSetupCard.tsx` (l. 960-1040) ne passe `profile.description`, mais huit
configurations ont déjà leur prose rendue par un autre bloc de la carte :

| `source` | Configurations | Rendu actuel | Prose |
| --- | --- | --- | --- |
| `stacks` | 17 | `<span>{label}</span>` + `NumberField` | **non** — ni prose, ni icône |
| `toggle` | 11 | 6 `Jeton` partagés + 5 `PassifInterrupteur` | **4 non** · **7 ailleurs** |
| `buffsPropres` / `buffsAllies` / `debuffsPropres` | 4 / 1 / 1 | idem `stacks` | **non** |
| `toujours` | 5 | `Jeton` (icône + `detail`) | **4 non** · **1 ailleurs** |
| `debuffsInverses` | 1 | `Jeton` + 3 interrupteurs | **non** |

Total inventorié : **40 configurations pour 38 identifiants** ; correctif :
**32 configurations pour 30 identifiants**. `10014` et `11663` portent chacun
deux configurations. Conserver les deux unités dans la preuve.

⚠️ **`Jeton` n'a aucun axe de prose** (`src/ui/Jeton.tsx` : `icone`, `libelle`,
`detail`, `onRetirer`) — et on n'ajoute à la librairie que quand un **axe**
manque, jamais une variante.

**La correction est un patron DÉJÀ en place dans la même carte**, pas une
invention : huit autres familles de passifs y affichent leur prose en
`<p className="mt-1 text-xs leading-snug text-ink-dim">{description}</p>`
**sous** le contrôle (l. 517, 554, 586, 645, 666, 729, 769, 799). Statique,
donc rien ne bouge au clic. Le lot applique ce patron aux 32 configurations qui
perdent réellement la prose, sans la dupliquer sur les huit déjà visibles ;
**prose jamais reformulée** (les libellés sont ceux du jeu).

**Contrat :** 1) reprendre l'extraction 1e exhaustive (40 configurations ×
monstre × `source` × branche) ; 2) corriger les 32 pertes par branche sans
dupliquer les huit proses déjà visibles ; 3) mettre à jour la section de spec.
Les 38 identifiants, 40 configurations et 80 formes sont ceux de
`decisions-lot-1e.json` et sont nommés dans `controle-11.md`. Les dix
habillages coréens `23401` à `23405` et `23411` à `23415`, joints aux
identifiants `13501` à `13505`, restent dans l'inventaire de corpus mais ne
deviennent pas sélectionnables (`A.2 ter`) ; les identifiants partagés avec
les formes jouables restent couverts.

**Correction curée de Gold Headband `7912`.** La configuration actuelle
`{ atkPct: 20, spdFlat: 12 }` est fausse sur les deux assiettes : `atkPct`
multiplie l'ATQ de combat totale et `spdFlat` ajoute des points. Chaque cumul
doit au contraire ajouter `20 % × ATQ de base` et `12 % × VIT de base`, jusqu'à
10 cumuls (A.2 ter). Employer l'axe existant `atkBasePct: 20` et ajouter un axe
explicite `spdBasePct: 12` à `CombatStatProfile`, au résolveur et à
`statsDeCombat` ; ne détourner ni `spdPct` (pourcentage de la VIT de combat)
ni `spdFlat`. Tester 0, 1 et 10 cumuls sur les deux formes, dont la VIT de base
116 de Mei Hou Wang : contributions brutes de VIT `0`, `13,92` et `139,2`
avant toute politique d'arrondi ultérieure. Cette curation ne spécifie aucun
nouvel arrondi intermédiaire : si le chemin existant ne tranche pas ce point,
le lot s'arrête et demande un relevé au lieu d'ajouter `ceil`, `round` ou
`floor`.

⚠️ **Ce que l'hypothèse de la demande recouvrait vraiment.** « Rien de visible
(Mayasura, Jaeger) » et « le sort non survolable (Cordelia) » ne sont pas deux
cas mais **un seul**, à deux rendus près : leur prose n'est nulle part. Le cas
« passif absent de la table » existe aussi, mais **ni Mayasura ni Jager n'en
sont** — la table par identifiant les contient bien.

**Sortie :** `controle-11.md` avec l'inventaire 38 / 40, les huit exclusions
nommées et le correctif 30 / 32 ; la section de spec mise à jour.

**Preuve du constat 110 :** retrouver ou ajouter dans `tests/degats.test.ts`
un contrôle nommé pour chacun des identifiants `14313` et `14813`, construit
depuis les données réelles : extraction du profil `atkDepuisSpd: 5`, puis
calcul avec deux vitesses connues et vérification de l'apport `5 × VIT`.
Un test qui exclut Rankyaku d'une autre mécanique ne suffit pas. Conserver
la commande `node tests/run.mjs degats`, sa sortie et les assertions ciblées
dans `controle-11.md`. Aucune clôture de 110 au lot 13a sans cette preuve.

**Preuve de rendu :** le tableau · `npm run build` · relecture à l'œil sur au
moins un monstre par `source` corrigée (Mayasura pour `stacks`, Cordelia pour
`toujours`) et contrôle d'absence de doublon sur les huit exclusions.

**Ne fait pas :** ne cure ni n'inventorie tous les passifs absents. Leur
repérage depuis l'audit et le corpus est un intrant propre du lot 13a, puis
leur qualification mécanique relève du lot 13b ; la table des présents ne
prouve jamais l'exhaustivité des manquants.

**Résultat du lot 1e validé le 2026-09-24.** L'inventaire réconcilie bien
38 identifiants, 40 configurations, 80 formes et 42 lignes d'audit. Huit
configurations sont **hors famille du correctif** parce que leur prose est déjà
visible ailleurs dans la carte : `2565`, `9611` à `9615`, `10612`, `18139`.
Le périmètre du lot 11 est donc de 30 identifiants / 32 configurations. Les
preuves sont `decisions-lot-1e.json`, `controle-1e.md` et
`valider-lot-1e.mjs`. L'écart `7912` a été tranché ensuite par l'utilisateur le
2026-09-24 : `+20 % ATQ de base` et `+12 % VIT de base` par cumul. Le lot 11
porte sa correction et ses tests ; le lot 1f doit conserver cette résolution.

#### Recalage du lot 11 — 2026-10-02, sur `8ea90bd9`

Carte d'un agent en lecture seule ; ancrages décisifs vérifiés par le
pilote. Rien n'a bougé dans le périmètre depuis 1e (`DamageSetupCard.tsx`
inchangé depuis `b2538ab1`, la table depuis `1cfa5128`) ; l'audit parallèle
ne touche aucun identifiant du lot.

- **Catégorie : J seul.** La partie C est faite par 1e : elle se réduit au
  rejeu de `valider-lot-1e.mjs` et à un contrôle de non-dérive.
- **Inventaires** : 38 identifiants / 40 configurations, tient (`damage.ts`
  L1712-1757 ; mesure : borner la table, compter `^\s{2}\d+: \[` et
  `source: '(\w+)'`) ; 80 formes : `controle-1e.md` L29-68. Correctif 30 /
  32 et huit exclusions, tient : l'exclusion se **déduit des blocs** voisins
  (patron `clesToggleDejaAffichees`, carte L360-363), jamais une liste de
  huit identifiants ; **une prose par identifiant** (30, pas 32 : 10014 et
  11663 portent deux réglages de même `description`).
- **Ancrages** : interface L1688-1708, `description` L1691 (renseignée
  L1768) ; branches L960-1042 ; la prose se place sous le jeton ou
  l'interrupteur qui nomme le passif, **avant** le champ de saisie
  (L586-589, L728-731).
- **Contrat 1)** : `controle-1e.md` L29-68 (tableau) et L101-106
  (exclusions), rejeu de `valider-lot-1e.mjs` ; `decisions-lot-1e.json`
  (3 830 lignes) s'interroge par script, jamais lu en entier.
- **Contrat 3)** : `spec/outils/degats-reels/conditions-et-audit.md`,
  « partie 2 » (L56-90) ; constantes 20 %, 12 %, 10 cumuls dans
  `invariants.md` (recette (c) de `spec-hygiene`) ; ne pas toucher
  `passifs-vitesse.md` (généré). Habillages coréens : déjà écartés
  (`monsterForms.ts` L29-55, L125-146) — citer ce fichier, pas A.2 ter.
- **Gold Headband** : la ligne `{ atkPct: 20, spdFlat: 12 }` (L1713) reste
  fausse ; `atkBasePct` existe (L1698, L3781, L3918), `spdBasePct` non. À
  toucher : type L1688-1708, résolveur L3771 / L3785, `statsDeCombat`
  L3923, **et `damageRelevantStats` L5143**, à parité avec `atkBasePct`
  L5136 (sinon la VIT sort des stats pertinentes de Mei Hou Wang).
  **Sans arrondi** (n° 13, retenu par l'utilisateur) : 13,92 de VIT par
  cumul pour une base 116, comme l'ATQ ; l'écart avec le Speed tune
  (`speedTunePassif.ts` L205, `ceil` par cumul) est consigné par
  `<!-- À trancher -->` et une ligne dans `pistes.md`.
- **Tests 0 / 1 / 10 cumuls** : 16812 Mei Hou Wang (ATQ 692, VIT 116 :
  +138,4 / +1 384 ATQ, +13,92 / +139,2 VIT) et 16802 Monkey King (ATQ 659,
  VIT 100 : +131,8 / +1 318, +12 / +120) ; resserrer le test seulement
  monotone de `tests/audit-degats-conditionnels.test.ts` L1086-1094.
- **Constat 110, Rankyaku** : la VIT de `5 × VIT` est la **VIT finale**
  (A.2 ter, utilisateur, 2026-10-02 : base, runes, set, lead, effet
  d'augmentation de vitesse, artéfacts). Le lot prouve que le calcul lit
  cette VIT finale (`maVitCombat` L3646-3669, puis L3912 et L3920), avec
  lead et buff actifs, dans `audit-degats-conditionnels.test.ts`, qui
  importe déjà `statsDeCombat`. Il n'y a plus d'incertitude à reporter au
  lot 13a.
- **Écran (n° 14, 15, retenus par l'utilisateur)** : Elsharion et Crane,
  une seule description pour leurs deux compteurs ; les 27 réglages sans
  nom de passif reçoivent au-dessus l'icône et le nom du passif (patron
  L577-585), puis la description. Preuve : `npm run build` et un test d'une
  fonction pure « quelle prose est rendue » (30 / 32, aucun doublon) ; la
  relecture à l'œil reste en A.8.
- **À ne pas casser** : le titre exact de ce lot (ancre de
  `valider-lot-1e.mjs` L68) ; l'unicité des fragments que ce validateur
  (L75-79) et `scripts/audit-degats-aura-corpus.mjs` (L80-88) cherchent
  dans la carte.

**Intrant** ~2 400 lignes : une session, de justesse, sans lire le JSON de
1e ni la Partie A en entier. Si l'agent du lot le juge trop serré, il le
dit avant de commencer et le pilote coupe par sujet (Gold Headband et
Rankyaku ; puis la prose).

#### Résultat du lot 11 — 2026-10-02

Lot parallèle (A.8, seconde vague), worktree `sw-forge-lot-11` parti de
`22bd4590`, trois commits `8fbb17c5`, `98969bdb`, `6c40c946`, intégrés en
`92de9890`, `d6ff1b6a`, `5a21fd78`. **Gold Headband** (`7912`) :
`atkBasePct: 20, spdBasePct: 12`, sans arrondi (n° 13), `spdBasePct`
porté par le profil, le résolveur, `statsDeCombat` et
`damageRelevantStats` (1 cumul = +138,4 ATQ et +13,92 VIT sur Mei Hou
Wang). **Rankyaku et Accelerando** : la VIT finale (n° 16), preuve du
constat 110 dans `audit-degats-conditionnels.test.ts`. **Prose** :
`proseStatsCombat.ts` (`clesProseDejaRendue`, `renduStatsCombat`, pur) —
30 proses pour 32 réglages, une par passif, aucune en double sur les 80
formes, huit exclusions déduites des blocs voisins ; icône et nom au-dessus
des 27 réglages sans nom. Partie C (`valider-lot-1e.mjs`) rejouée, sans
dérive. Preuve `controle-11.md`.

**Rejoué par le pilote** dans le worktree : `tsc` 0, tests de zone, build,
spec-lint, diff-check verts. Mutations de l'agent : `ceil` remis sur la VIT,
`spdBasePct` retiré des stats pertinentes, prose rendue deux fois (fonction
pure, puis carte). **Mutation du pilote** (apport de VIT par cumul retiré) :
4 échecs ; restauré.

**À confirmer par l'utilisateur (A.8)** : la prose de Stone Claws
(`13501`-`13505`, S1 actifs) apparaît en clair sous le compteur ET au clic
du « ? » de 11bis dans la case du sort — le recalage, qui fixe 30 / 32, ne
compte pas une bulle à la demande comme déjà visible. **Non prouvé** :
rendu à l'œil ; arrondi de Gold Headband en jeu (aucun relevé) ; Miriam
dans la VIT de Rankyaku (non exercé).

### Lot 11bis — proses de sort au clic, sur les deux formats

**Cat. J.** Demande de l'utilisateur du 2026-10-02 : « toutes les proses de
sort qui étaient indiquées par survol de l'icône du sort doivent être
remplacées par une infobulle cliquable. Aujourd'hui sur mobile on ne pouvait
pas voir ces informations. Le point d'interrogation cliquable pour
l'infobulle doit être dans la case du sort, juste à droite de son nom. »

**Aujourd'hui** : dans « Compétence utilisée » (`DamageSetupCard.tsx`
L386-430), la prose du sort n'est qu'au survol (`title={s.description}`,
L390, et `aria-description` L394). La fiche monstre
(`MonsterDetailDialog.tsx` L362-364) l'affiche déjà en clair.

**Contrat.**

- Dans chaque case de sort de « Compétence utilisée », un bouton « ? »
  juste à droite du nom ouvre la prose du sort : bulle à la souris,
  panneau montant au doigt, par `HelpPopover` (le patron des deux
  supports). Le survol (`title`) disparaît ; la prose reste annoncée aux
  lecteurs d'écran.
- ⚠️ **La case est un `<button>`** (`src/ui/Option.tsx` L37) : un « ? »
  placé dans son `titre` ferait un bouton dans un bouton (HTML invalide),
  et un clic sur « ? » choisirait aussi le sort. `Option` reçoit donc un
  **axe** de plus (une action posée à droite du titre, hors du bouton
  principal, dans la même case) — jamais une variante. Cliquer « ? » ne
  sélectionne pas le sort ; la case cliquée ne bouge pas (la bulle sort du
  flux).
- Un sort sans prose n'a pas de « ? ». Un sort refusé (case désactivée)
  garde son « ? » s'il a une prose.
- Les deux formats sont de premier rang : vérifier le panneau montant au
  doigt sous la carte (piège `[data-tiroir]`, `ARCHITECTURE.md` § 7).

**Les textes d'effet** (décision de l'utilisateur du 2026-10-02 : pas une
infobulle par effet, trop lourd) : l'infobulle existante de « Effets
actifs » (`DamageSetupCard.tsx` L1505, texte écrit à la main aujourd'hui)
regroupe la description de chaque vignette d'effet affichée pour le sort
choisi, **construite à partir des mêmes descriptions que les vignettes**
(`EffetVignette`, prop `description`) : une seule source, seulement les
effets présents. Le survol de chaque vignette (`EffetVignette.tsx` L36)
reste en complément. La fiche monstre ne change pas : la prose du sort y
est déjà en clair au-dessus des pastilles d'effet (`MonsterDetailDialog.tsx`
L362-364), dont le survol reste (précision du pilote, à confirmer par
l'utilisateur).

**Preuves** : test de source (plus aucun `title={s.description}` dans la
carte ; le « ? » est hors du bouton de la case) ; `tsc`, tests de zone,
`npm run build` (vérifier le CSS construit) ; relecture à l'écran inscrite
en A.8, ordinateur ET téléphone.

**Ne fait pas** : ne change ni le texte des proses (libellés du jeu), ni le
choix d'un sort, ni le calcul.

#### Résultat du lot 11bis — 2026-10-02

Lot parallèle (A.8), worktree `sw-forge-lot-11bis` parti de `0899b541`,
deux commits `6980f9f5`, `f4d6ab2a`, intégrés en `a34dedb5`, `aba5306e`.
Axe `actionTitre` d'`Option` (`src/ui/Option.tsx`) : avec une action, la
case devient un cadre recouvert par le bouton principal vide (nommé par
`aria-labelledby`), l'action passe devant ; sans action, la case reste le
bouton d'avant. Dans « Compétence utilisée », un « ? » à droite du nom
ouvre la prose (`HelpPopover`, annoncé « Description de … ») ; le `title`
a disparu, `aria-description` reste ; un sort sans prose n'a pas de « ? »,
un sort refusé garde le sien. L'infobulle « Effets actifs » est dérivée de
la même liste `effetsActifs` que les vignettes (une ligne « libellé —
description » par effet affiché), survol gardé. Tests
`testProsesSortAuClic` (22), `testEffetsActifsInfobulle` (14).

**Rejoué par le pilote** dans le worktree : `tsc` 0, 1 010 vérifications,
build, spec-lint, diff-check. Mutations de l'agent : 2, 1 et 2 échecs.
**Mutation du pilote** (un sort refusé perd son « ? ») : 1 échec ;
restauré.

**Intégration de la première vague** (11bis, 8a, 9a, 10a) : répétée à
blanc sur une branche d'intégration (cinq conflits d'ajouts voisins dans
`damage.ts` et `tests/index.ts`, gardés des deux côtés), puis reportée
sur la branche du chantier après 7b sans conflit ; sur l'ensemble : `tsc`
0, 1 736 + 611 vérifications, build, spec-lint, diff-check verts ; notes
privées fusionnées à trois sans conflit (`invariants.md` : 7 lignes
ajoutées, 4 modifiées), preuves `controle-11bis.md`, `controle-8a.md`,
`controle-9a.md`, `controle-10a.md`.

**Choix de l'agent, à juger à l'œil (A.8)** : « ? » de 28 px (le titre de
la case passe de 18 à 28 px) ; phrase d'introduction de l'infobulle « Seuls
les effets qui changent quelque chose pour ce sort sont proposés. » ; case
désactivée estompée par couleurs à 40 % ; survol du « ? » qui allume la
bordure de la case ; zone tactile de 44 px qui déborde de 8 px sur la
description. **Non prouvé** : rien vu à l'écran ni au lecteur d'écran.

### Lot 12 — les trois mécanismes rejoués sur des cas indépendants

**Cat. C.** Requiert les lots 8, 9, 10.

**Pourquoi ce lot existe.** Les lots 8, 9 et 10 doivent livrer un
**mécanisme**, pas un cas particulier — mais rien ne le vérifie : un mécanisme
qui n'accepte que Teshar passe tous les tests de Teshar. Ce lot le met à
l'épreuve **sans écrire de code de production** : prendre **une** fiche d'une
famille voisine dont les valeurs sont dans le CSV (constat **178** RYU/Striker
pour l'attaque déclenchée, un constat de catégorie 09 pour l'ignore DEF
conditionnel), l'ajouter **dans un test uniquement**, et dire ce qui manque.
Le cas doit relever du mécanisme promis, avec les valeurs sourcées ; une
mécanique voisine différente n'est pas un échec de généricité. Si aucun cas
réel convenable n'est documenté, utiliser une fixture synthétique annoncée
comme telle, sans prétendre valider une nouvelle mécanique du jeu.
Ajouter un **troisième contrôle** pour le lot 8 : fixture indépendante de
Blade Surge avec coups de portées différentes et coefficients distincts,
cible principale/secondaire, 224 selon la portée et 411 selon le rang du tour.
Vérifier que les PV de la cible secondaire ne sont pas creusés par les coups
mono-cible précédents. Ce contrôle rend la dépendance au lot 8 effective.

**Sortie :** `controle-12.md` — pour chacun des trois mécanismes : ce qu'il a
fallu fournir (une ligne de table ? un champ de plus ? une branche de rendu ?),
et le verdict **générique / à retoucher**. Un échec sur le contrat générique
promis rouvre le lot 8, 9 ou 10 : correction puis nouvelle preuve avant clôture.
Seule une extension hors contrat rejoint le lot 13, avec sa justification.

**Preuve :** `controle-12.md` · fixtures, code de contrôle et commande exacte
conservés et rejouables. Un contrôle du contrat permanent rejoint `tests/`
et son registre ; une expérience exploratoire reste dans le dossier de
preuves avec ses intrants. Aucun test cité puis supprimé.

**Ne fait pas :** n'ajoute aucune fiche au calcul de production. Ne corrige
rien — il **constate**.

**Point à constater, relevé à l'intégration de la seconde vague** (Résultat
de 9b) : la prose de « Stats acquises en combat » (`clesProseDejaRendue`,
lot 11) écarte les compétences de tous les `passifs`, alors que le bloc des
passifs ne rend plus que `passifsSuivants` (9b). Un passif masqué (choisi
comme sort, ou exclu par ses slots déclencheurs) qui porterait aussi des
stats de combat perdrait sa prose. Aucun cas aujourd'hui : dire s'il en
existe un dans le corpus, et sinon si le mécanisme générique de 9b peut en
créer un.

#### Résultat du lot 12 — 2026-10-02

Premier lot confié à l'agent `lot-c` (Sonnet 5.5, effort moyen, A.4). Un
commit, `6f16ce5d` : `tests/degats-lot12.test.ts` (quatre tests, 227
vérifications) ; aucun fichier de `src/`. Reçu `6f16ce5` ↔ `c222480` ;
preuve `controle-12.md` (419 lignes) et `controle-12-intrants/`
(expériences par patch en mémoire, sorties).

| Mécanisme | Cas | Verdict de l'agent | Arbitrage du pilote |
| --- | --- | --- | --- |
| 8 — séquence, cible secondaire | 3 fixtures synthétiques (premier coup en zone ; portées entrelacées ; sans zone), `testLot12SequenceDeCoups` (45) ; expérience : une ligne de table suffit sur trois sorts réels | générique ; la garde « le premier groupe recopie la donnée » (`damage.ts` L2965-2971) refuse Head Press (M. BISON, Sagar, constat 155 : `coups: 2` agrège deux attaques) | **extension → lot 13** : le contrat 8 ne promettait que Blade Surge (8 identifiants) ; la limite de la garde va à la famille 08 (13b), avec le constat 155 |
| 9 — attaque déclenchée | constat 178 réel (6 S2 de RYU et Striker qui appellent leur S1), `testLot12AttaqueDeclenchee` (122), profil construit à la main | calcul générique ; **approvisionnement à retoucher** : `monsterOffensivePassives` n'admet que `c.passif` (L3394), clé par nom (« Hadoken » : 12 formes, dont 6 sans Shoryuken) | **échec sur le contrat promis → lot 9c** : le contrat 9 exigeait que le mécanisme accepte les 81 identifiants de même architecture, dont les 17 amorces des constats 168, 178 et 179 |
| 10 — ignore DEF depuis un coup | aucun cas réel indépendant (les 17 entrées de catégorie 09 classées : 212 est le mécanisme lui-même, 16 voisines) ; règles synthétiques C et E, `testLot12IgnoreDefDepuisUnCoup` (56) | générique ; seul le message `optimizerRecipe.ts` L420 (« seuls les six sorts des Blade Dancers ») devient faux dès une septième entrée | message corrigé **dans 9c** (point annexe) |
| point à constater | aucun cas au corpus (aucun passif offensif ne partage son identifiant avec un réglage de stats de combat) ; sentinelle `testLot12PassifMasqueEtStatsDeCombat` (4) | le mécanisme de 9b PEUT en créer un : passif masqué synthétique → la carte rend `{ ouvre: false, prose: null }` | **défaut latent du mécanisme générique → 9c** |

**Rejoué par le pilote sur `6f16ce5d`** : reçu valide ; `tsc` 0 ; 1 974
vérifications (`lot12 bladesurge tempest bladedancers degats`) ;
spec-lint, diff-check verts ; `git diff --stat dd26bef3..HEAD -- src`
vide. Mutations de l'agent (sur les tests, après le commit) : 19, 6, 36,
4 et 2 échecs. **Mutation du pilote** (sur la production : 411 rendu aux
attaques de la boucle des passifs, `damage.ts` L5472) : 6 échecs, « 411 :
la S2 seule… », un par forme ; restauré.

**Défauts de contrat relevés par l'agent** : la liste « ce qu'il faudra
fournir » d'`attaque-apres-un-sort.md` (L92-113) omet le filtre `c.passif`
et la clé par nom (→ 9c) ; le contrat 12 supposait un cas réel de
catégorie 09 (aucun ne convient) ; la garde du lot 8 est écrite comme un
garde-fou, jamais comme une limite (→ 13b, famille 08). **Non prouvé** :
aucune valeur de jeu nouvelle (fixtures synthétiques, coefficients non
curés) ; la Marque posée par la S2 sur la S1 enchaînée (ni modélisée ni
relevée — relevé à demander en 13b, constat 178) ; aucun balayage
automatique du corpus pour la catégorie 09 (lecture des 17 entrées).

### Lot 13 — le reliquat de l'inventaire : un plan, pas une promesse

**Deux étapes : 13a (C), puis 13b (J, plusieurs sessions bornées).**
Requiert les lots 1, 11 et 12, y compris les corrections qu'exige le lot 12,
et la remise de l'audit parallèle de la prose des sorts (A.5).
Le plan n'est pas une implémentation du reliquat.

**Le volume, mesuré le 2026-09-23** (script d'extraction à rejouer et joindre
à la preuve) : sur 325 constats distincts, **243 restants, 521 lignes d'audit** hors
des 78 constats suivis ET des quatre constats de ce chantier. La ventilation
ci-dessous est celle du recomptage de revue ; 13a la rejoue après réconciliation.

| Constats | Lignes d'audit | Catégorie |
| --- | --- | --- |
| 60 | 176 | 08 — Séquences, nombre de coups et attaques déclenchées |
| 57 | 75 | 12 — Critiques garantis, bonus TC/DC et critiques interdits |
| 31 | 57 | 05 — Bonus et conversions de statistiques en combat |
| 18 | 46 | 10 — Pertes de PV, redistribution et dégâts différés |
| 16 | 28 | 09 — Ignore DEF conditionnel ou probabiliste |
| 9 | 34 | 11 — Compétences sans formule / coopération / hors tour |
| 11 | 30 | 04 — Variables de formule actuellement refusées |
| 15 | 29 | 07 — Composantes de dégâts supplémentaires |
| 16 | 22 | 03 — PV, comparaisons de statistiques et boucliers |
| 4 | 12 | 06 — États exclusifs et charges de dégâts |
| 4 | 6 | 01 — Nombre de buffs / débuffs |
| 2 | 6 | 02 — Conditions binaires et états particuliers |

C'est l'ordre de grandeur des parties 3 et 4 de l'audit, restées « à définir »
depuis le 2026-09-08. ⚠️ **Aucune session ne les traite**, et un lot qui le promettrait
livrerait ses premiers constats correctement et les derniers mal — le défaut
exact que `cadrage-chantier` demande d'anticiper en scindant AVANT, sur
l'intrant en lignes.

#### 13a — extraction et réconciliation, sans jugement de mécanique

**Intrants bornés :** les 695 lignes d'audit du CSV, le suivi d'implémentation, les
preuves des lots 1/8/9/10/11/12, et le relevé de l'audit parallèle de la prose
des sorts (A.5 ; `archive/audit-prose-sorts-2026-10-01/`, 39 constats), pour
ce qui n'a pas rejoint les lots 8 à 11. Son balayage initial n'est pas
rejouable tel quel (script supprimé) : 13a refait l'extraction. Chacun de ses
constats est rattaché à l'un des 243 constats, à un lot du chantier, ou classé
découverte hors inventaire avec un identifiant distinct. Il reste un indice,
qualifié en 13b (`game-data-curation`), jamais un verdict de mécanique.
Conserver un instantané des intrants et leur
révision avec le script d'extraction dans `controle-13a.md`.
Commande du recomptage initial (PowerShell, depuis la racine) :

```powershell
$audit = Import-Csv -Delimiter ';' -Encoding UTF8 spec/outils/optimizer/archive/audit-degats-conditionnels-2026-09-08/inventaire.csv
$suivi = Import-Csv -Delimiter ';' -Encoding UTF8 spec/outils/optimizer/archive/audit-degats-conditionnels-2026-09-08/suivi-implementation.csv
$reste = @($audit | Where-Object { $_.entree -notin $suivi.constat -and $_.entree -notin @('110','151','164','212') })
$reste.Count
@($reste.entree | Sort-Object -Unique).Count
$reste | Group-Object categorie | ForEach-Object {
  [pscustomobject]@{ Categorie=$_.Name; Constats=@($_.Group.entree | Sort-Object -Unique).Count; LignesAudit=$_.Count }
}
```

Sorties du 2026-09-23 : **521 lignes d'audit, 243 constats**, ventilation ci-dessus.
Réconcilier `suivi-implementation.csv` avec les preuves : inscrire 110
seulement après validation de la preuve ciblée du lot 11, puis 151/164/212
selon les lots effectivement livrés. Conserver l'inventaire
historique comme photographie datée ; le suivi porte l'état livré actuel.
Les ensembles « livré avant / traité ici / différé » sont disjoints et leur
union retrouve le corpus ; les constats du chantier ne sont pas comptés deux
fois après mise à jour du suivi.

Pour les passifs de stats absents, extraire les candidats de l'audit et
balayer le corpus ; comparer leurs identifiants aux tables existantes.
L'absence d'une table est un signal à examiner, pas un verdict automatique
de mécanique manquante. Toute découverte hors inventaire reçoit un identifiant
de suivi distinct et reste séparée des 243 constats historiques.

**Sortie :** inventaires reproductibles et plan des sous-lots 13b, chacun avec
liste nominative de lignes d'audit, identifiants et formes, et plages de code/spec à lire. Aucun sous-lot ne
traite les 243 constats d'un coup ; au-delà de 800 lignes d'intrants à examiner,
scinder avant exécution, sans tronquer une famille ni omettre ses dépendances.
**Sortie pilote obligatoire :** à partir de ce plan, amender ce cadrage avec
une section de contrat par `13b-<famille>` : intrants et plages bornés, sortie
nommée, preuve/commande attendue, frontière et dépendances. Ajouter une ligne
par sous-lot dans A.7 et mettre à jour le graphe. Revue pilote de cet amendement
avant tout lancement de 13b ; le contrat générique ci-dessous ne suffit pas.

#### Résultat du lot 13a — 2026-10-02

Agent `lot-c` (Sonnet 5.5, effort moyen). Aucun commit de code : tout est
dans les notes privées. Reçu `cd5fe43` ↔ `35d577f` ; preuve `controle-13a.md`
(656 lignes) et `controle-13a-intrants/` (scripts `00` à `07`, sorties,
empreintes SHA-256 des intrants et des sorties). **Recomptage** : la commande
du contrat rejouée rend **521 lignes d'audit / 243 constats**, ventilation
identique. **Partition** des 325 constats / 695 lignes en quatre ensembles
disjoints : livré avant (78 / 160), traité ici (110, 151, 164, 212 :
4 / 14), **déclaré livré par `partie-2.csv` sans être au suivi (51 / 97)**,
différé (192 / 424). **Suivi** (`suivi-implementation.csv`, 78 → 82
lignes) : 110, 151, 164, 212 inscrits avec leurs preuves ; 308 passe de
« report prévu étape 2 » à « implémenté et vérifié » (partie 2 et deux
contrôles « 308 — » passants) ; état d'origine conservé
(`suivi-implementation-avant-13a.*`). **Prose (39 constats)** : 26 vers des
constats différés, 5 en partie, 8 découvertes hors inventaire DH13-01 à
DH13-08 ; aucun vers une famille des lots 8 à 11. **Passifs de stats
absents** : 34 signaux parmi les 62 identifiants de catégorie 05 ; balayage
du corpus (3 073 fichiers) : 173 passifs hors audit relevés par détecteurs
d'indice (DH13-S001 à S173). **Plan 13b** : dix-sept sous-lots couvrant les
243 constats et les 521 lignes sans doublon (le script échoue sinon), volume
maximal 173 lignes (seuil 800).

**Rejoué par le pilote** : reçu valide ; spec-lint vert ; état livré
sauvegardé puis `00-rejouer.mjs` relancé → **empreintes des sorties
identiques**, notes inchangées ; contrôle indépendant (script du pilote,
lecteur CSV qui respecte les guillemets) : `partie-2.csv` déclare livrés 52
constats absents du suivi d'avant 13a — dont 110, traité ici — soit les
**51** de l'agent.

**Arbitrages du pilote** : (1) **les 51 constats déclarés livrés restent
dans les 243** (= 192 différés + 51 à vérifier) et ne comptent comme livrés
qu'une fois vérifiés en 13b (`13b-verif-partie2`, et `13b-ignore-def` pour
ses douze) ; (2) **308**, inscrit par 13a sur la même source, rejoint
`13b-verif-partie2` par cohérence ; (3) 149 (Arsenal of Sacrifice) y reste,
comme proposé ; (4) les découvertes DH13-* sont dénombrées à part,
jamais mêlées aux 243 ; (5) le contrôle permanent proposé (chaque clé de
`STATS_COMBAT_PAR_ID_CONNUS` est un identifiant du corpus) est confié à
`13b-stats-passifs`, qui vérifie d'abord qu'il n'existe pas déjà.
**Non prouvé** (agent) : livraison des 51 rejouée constat par constat ;
rappel et précision des détecteurs des 173 passifs ; formes non éveillées
non filtrées.

#### 13b — qualification et plan par familles

**Cat. J. Gabarit, non lançable en l'état.** Une session par contrat 13b-*
créé et revu après 13a produit des décisions sourcées ;
le pilote consolide ensuite les résultats. La présence d'une formule ou d'une
`note` est un indice, jamais la preuve automatique que la mécanique est connue.

**Ce que le lot produit :** un **plan découpé et chiffré**, dans
`spec/outils/optimizer/decisions/` (nature décision, en-tête posé) :

1. **Un classement des 243 par coût**, sur deux critères documentés et pas sur
   une impression : (a) la valeur est-elle **dans la donnée** (formule, effet,
   `note`) ou faut-il un relevé ? (b) la mécanique **existe-t-elle déjà** dans
   `damage.ts` (une ligne de table suffit) ou demande-t-elle un mécanisme neuf ?
   Les quatre cases qui en résultent ordonnent tout le reste. Chaque verdict
   cite la donnée et le chemin de code ; une incertitude reste nommée au lieu
   d'être forcée artificiellement dans une case.
2. **Les familles reportées par ce chantier, nominativement** : les 17 lignes d'audit
   d'attaque déclenchée (constats 168, 178 et 179), les deux lignes du constat
   313 à stock de dégâts et compteur manuel, les constats 163, 173,
   180 voisins de Blade Surge, le constat 155 (Head Press, M. BISON et
   Sagar : la garde « le premier groupe recopie la donnée » de la séquence
   curée refuse une donnée dont `coups` agrège deux attaques — limite
   relevée par le lot 12), la Marque posée par une S2 sur la S1 qu'elle
   appelle (constat 178, à relever en jeu avant de curer), les onze amorces
   acceptables et les six classées par le lot 9c (Résultat du lot 9c :
   asymétrie 8115 / 8111, interface d'une attaque appelée active au premier
   cas curé), les 16 autres
   constats de catégorie 09, les
   passifs absents de `STATS_COMBAT_PAR_ID_CONNUS` repérés au lot 13a puis
   qualifiés ici. Chacune
   avec son numéro de constat — **jamais un « plus tard » sans numéro**.
3. **Une proposition de lots**, chacun borné par ses trois unités de A.0 et ses plages de lecture, avec
   la liste des relevés en jeu à demander **regroupés en une seule demande**
   (un relevé par mécanique coûte un aller-retour ; 40 demandes séparées ne se
   font pas).
4. **La recommandation explicite** : ce plan est-il un lot de plus de ce
   chantier, ou son propre chantier ? Le lot répond, avec ses chiffres.

**Sortie :** le fichier de plan, plus une ligne dans `pistes.md` qui le pointe.

**Preuve :** `controle-13a.md` et `controle-13b-<famille>.md`, puis synthèse
`controle-13.md` : extraction, décisions citées, totaux par case et liste des
incertitudes (ensemble = 243, ou total réconcilié explicitement justifié).
Les découvertes hors corpus sont dénombrées séparément.

**Ne fait pas :** **n'implémente aucun constat.** Ne relance aucune mesure de
perf. Ne décide pas seul d'ouvrir un chantier — il recommande, l'utilisateur
tranche.

#### Contrats 13b-* — amendement pilote du 2026-10-02, après 13a

**Contrat commun** (chaque session lit ce paragraphe, puis sa ligne de la
table, puis sa section de `controle-13a.md`).

- **Intrant** : sa section de `controle-13a.md` (plage de la table : liste
  nominative des constats, lignes d'audit, identifiants, prose rattachée,
  plages de code et de spec) ; ses lignes de `controle-13a-intrants/plan-13b.csv`
  (colonne `sous_lot`) ; les lignes d'audit correspondantes de
  `inventaire.csv` (par script, jamais en entier) ; les sections de
  `releve-audit-prose-2026-10-01.md` de sa prose ; les fiches du corpus et
  les plages de `damage.ts` / spec citées. Rien d'autre sans raison écrite.
- **Par constat** (et par ligne d'audit quand elles divergent), deux
  verdicts **cités** : (a) la valeur est-elle **dans la donnée** (formule,
  effet, `note` : citer le champ) ou faut-il un **relevé en jeu** ? (b) la
  mécanique **existe-t-elle** dans `damage.ts` (citer la table ou la
  fonction : « une ligne de table suffit ») ou faut-il un **mécanisme
  neuf** ? Une incertitude reste nommée (« indéterminé : … »), jamais forcée
  dans une case. Le skill `game-data-curation` s'applique : la prose n'est
  pas un discriminant, jamais d'analogie.
- **Constat déclaré livré** (ensemble P) : verdict **livraison établie /
  partielle / infirmée**, avec le test nommé et le chemin de code ; aucune
  curation neuve.
- **Sortie** : `spec/outils/optimizer/archive/controles-degats-aura-2026-09/controle-13b-<famille>.md`
  (H1, puis `**Statut :** ARCHIVE — preuve du lot 13b-<famille> du chantier degats-et-aura`)
  et, si besoin, `controle-13b-<famille>-intrants/` : tableau des verdicts
  (constat, lignes, identifiants, (a), (b), citations), relevés en jeu
  nécessaires (protocole selon `game-data-curation`, pour regroupement),
  proposition de lots pour sa famille (bornés par les unités de A.0 et des
  plages de lecture), incertitudes, découvertes hors inventaire avec un
  identifiant distinct.
- **Ne fait pas** : n'implémente rien, aucun fichier suivi modifié, aucun
  commit ; ne touche aucune note partagée (`invariants.md`, `pistes.md`,
  `suivi-implementation.*`, la preuve d'un autre sous-lot) ; ni `livrer` ni
  `push` — le pilote livre après validation ; ne décide pas d'un chantier.
- **Parallèle** (application par le pilote de la décision de l'utilisateur
  du 2026-10-02 sur les lots indépendants) : ces sessions n'écrivent que
  leur propre fichier de preuve et leur dossier d'intrants ; plusieurs
  tournent donc ensemble dans le worktree du chantier, sans worktree séparé.
- **Validation par le pilote** : relecture de la preuve et contrôle
  indépendant d'au moins trois verdicts tirés au hasard (donnée citée et
  chemin de code relus), écrit dans le Résultat du sous-lot.

| Sous-lot | Constats (différés / déclarés livrés) | Lignes d'audit, volume | Section de `controle-13a.md` | Particularités |
| --- | --- | --- | --- | --- |
| `13b-declenchee-amorces` | 4 (4/0) : 168, 178, 179, 313 | 19, 19 | L415-422 | les 17 amorces de 9c (11 acceptables, 6 classées) ; asymétrie 8115 / 8111 ; Marque de la S2 (178) ; interface d'une attaque appelée active au premier cas curé ; 313 hors architecture |
| `13b-declenchee-voisins` | 15 (15/0) | 43, 43 | L423-430 | verdicts « même architecture » de 1c2/1c3 ; les voisins classés par le lot 12 (Energy Ball, Blood Talon, Heaven's Might) |
| `13b-sequences-zone` | 12 (12/0) | 20, 38 | L431-438 | 163, 173, 180 (voisins de Blade Surge) ; 155 Head Press et la limite de la garde « le premier groupe recopie la donnée » (lot 12) |
| `13b-effets-entre-coups` | 13 (13/0) | 43, 97 | L439-446 | dont 322 et 323 (26 lignes) |
| `13b-coups-variables` | 15 (15/0) | 49, 67 | L447-454 | — |
| `13b-ignore-def` | 16 (4/12) | 28, 28 | L455-462 | douze déclarés livrés (200-209, 214, 215) à vérifier ; 210, 211, 213, 216 différés ; aucun n'est « à partir d'un coup » (lot 12) |
| `13b-pertes-pv` | 18 (18/0) | 46, 127 | L463-470 | dont 230, 231, 232 (bombes, DoT) |
| `13b-hors-tour-cooperation` | 9 (9/0) | 34, 52 | L471-478 | — |
| `13b-composantes-supplementaires` | 15 (15/0) | 29, 83 | L479-486 | — |
| `13b-pv-comparaisons-boucliers` | 13 (13/0) | 17, 53 | L487-494 | — |
| `13b-compteurs-etats-binaires` | 8 (8/0) | 14, 68 | L495-502 | — |
| `13b-variables-refusees` | 6 (6/0) | 8, 17 | L503-510 | — |
| `13b-stats-passifs` | 11 (11/0) | 30, 30 | L511-518 | les 34 signaux de 13a (dont 83 et 86, livrés : présence par nom dans une autre table) ; vérifier si un test garde déjà « chaque clé de `STATS_COMBAT_PAR_ID_CONNUS` est un identifiant du corpus », sinon le proposer |
| `13b-stats-passifs-corpus` | 0 | 0, 173 à trier | L519-526 | DH13-S001 à S173 : d'abord trier (passif de stats oui / non / indéterminé, prose et effets cités), puis (a) et (b) pour les « oui » ; découvertes hors inventaire dénombrées à part |
| `13b-critiques-garantis` | 30 (30/0) | 34, 43 | L527-534 | condition exacte de la garantie à lire avant tout verdict |
| `13b-critiques-bonus-tc-dc` | 18 (18/0) | 30, 30 | L535-542 | — |
| `13b-verif-partie2` | 40 (1/39) + 308 | 77, 77 | L543-568 | livraison établie / partielle / infirmée pour les 39 déclarés livrés, 149 (Arsenal of Sacrifice, livré « hors inventaire » par la partie 2) et 308 (inscrit par 13a sur la même source) |

**Consolidation — pilote, après les dix-sept** : le fichier de plan dans
`spec/outils/optimizer/decisions/` (nature décision, en-tête posé :
classement des 243 sur les quatre cases, familles reportées
nominativement, relevés regroupés en **une** demande, proposition de lots,
recommandation chiffrée « lot de plus ou chantier à part »), la synthèse
`controle-13.md` (totaux par case, ensemble = 243 ou total réconcilié
justifié, découvertes DH13-* dénombrées à part, incertitudes), une ligne de
`pistes.md` qui pointe le plan. La recommandation est **soumise à
l'utilisateur**, qui tranche.

**Revue pilote de cet amendement** (2026-10-02) : chaque sous-lot a une
liste nominative (section de `controle-13a.md`, colonne `sous_lot`) et un
volume ≤ 173 lignes ; les 243 constats et les 521 lignes sont couverts une
fois (contrôle du script `06-plan-13b.mjs`, rejoué) ; chaque renvoi
nominatif du lot 13 (point 2) et des Résultats 9c, 11 et 12 a son
sous-lot ; aucune session n'écrit un fichier commun ; aucune n'a besoin
d'un outil créé plus tard.

#### Résultats des sous-lots 13b

Première vague (trois sessions `general-purpose` + Opus, après un premier
lancement de six arrêté net par la limite d'usage de la session, sans
fichier écrit) : `13b-declenchee-amorces`, `13b-sequences-zone`,
`13b-ignore-def`. Les vagues suivantes passent par `lot-j` (A.4).

##### 13b-declenchee-amorces — 2026-10-02

Preuve `controle-13b-declenchee-amorces.md` (473 lignes) et ses intrants
(scripts 01 à 04, sorties). 4 constats, 19 lignes d'audit, 27 formes (14
jouables) ; aucun déclaré livré. **Cases (par ligne)** : donnée × existant 9
(8107, 8110, 8113, 8114 exactes ; 8115 et 8111 avec limite nommée ; One More
Drink 8106/8108/8109 sans entrée : choisir « Rolling Punch (S1) » seul donne
déjà ce total) ; donnée × neuf 3 (8112, 22415, 22915) ; relevé × existant 6
(le constat 178, qui passe à « neuf » si la Marque posée compte) ; relevé ×
neuf 1 (6161, Mina). Un seul mécanisme neuf rendrait exacts 8112, 8111, 8115
et la Marque du 178 : un état « posé par le déclencheur », lu comme
`defBreakApres`. Mina (6161) liée au constat 288 (`13b-critiques-bonus-tc-dc`).
**Relevés** : R1 (S1 enchaînée avec et sans Marque déjà posée ; seuil 0,90),
R2 (Energy Punch de Mina après un critique de la S1, de la S2, d'un Energy
Punch appelé), Q-313 (question à l'utilisateur sur les termes appliqués au
stock de Jin/Kai, relevé R3 seulement à défaut). **Lots proposés** : L-a à
L-f. **Décisions formulées pour l'utilisateur** : D1 asymétrie 8115/8111 ;
D2 interface d'une attaque appelée active ; D3 One More Drink ; D4 « attacks
a random enemy » (rien n'établit que Rolling Punch frappe la cible
configurée : les 10 lignes du 179 en dépendent) ; D5 Mina, interrupteur ou
mode critique ; D6 étendue de R1 et repli. **Découvertes** :
DH13b-declenchee-amorces-01 (contre-attaques de RYU feu et Douglas feu, 13912
et 14412, absentes de l'inventaire) ; -02 (le mode critique « Moyenne »,
dit « devant être supprimé » par l'utilisateur dans l'amendement 1c1, existe
toujours et aucun lot ne porte sa suppression → soumis à l'utilisateur, A.8).

**Validé par le pilote** : citations de code relues (`damage.ts` L3543 garde
du déclencheur passif, L3440, L5369 exclusion par identifiant, L5385 et
L5626 `defBreakApres`) ; deux verdicts recoupés sur les fiches
(`public/data/skills/17202.json`, `17212.json` : Tiger Punch 8112 pose
« Increase ATK » +50 % sur tous les alliés avant Rolling Punch → donnée ×
neuf, exact ; `17201.json`, `17211.json` : One More Drink 8106 n'a qu'une
formule de soin, effet « Heal » → le total est celui de Rolling Punch seul,
exact) ; spec-lint vert, `git status` vide.

##### 13b-sequences-zone — 2026-10-02

Preuve `controle-13b-sequences-zone.md` (327 lignes) et ses intrants.
12 constats, 20 lignes d'audit, 36 formes ; aucun déclaré livré. **Cases
(par ligne)** : donnée × existant 4, donnée × neuf 3, donnée × indéterminé
1 ; relevé × existant 6, relevé × neuf 4, relevé × indéterminé 2 ; 6 des 8
« donnée » viennent d'auxiliaires de l'API (`other_skill`) absents de
l'import ; 154 et 163 divergent selon la ligne. **Verdict structurant** :
la limite de la garde « le premier groupe recopie la donnée » n'est pas
propre à Head Press — éprouvée avec le vrai `skillDamageProfile` (patch en
mémoire), elle refuse 8 sorts actifs sur 19 (10613, 2908, 14113, 14613,
13913, 14413, 10132, 9515) et bloque 6 constats ; six motifs différents
relient `coups`/`aoe` aux phases ; seule une « empreinte de la donnée » par
entrée les couvre tous. Une ligne de table suffit pour 13311, 13314, 158,
159, 163 ; 180 (Jackie) : valeur fournie (A.2 ter L148), une ligne de
`COUPS_VARIABLES_CONNUS` ; 173 (Danu) : une ligne de
`PASSIFS_OFFENSIFS_CONNUS` si l'interrupteur est retenu. **Calcul faux en
silence** aujourd'hui sur plusieurs sorts (Thunder Break +67 % si les 20 %
se recalculent par cible ; Abigail −56 %). **Relevés** : R1 à R12, rapports
à la phase connue avec règle de décision annoncée (R3, Guilty Sentence : 3 %
entre les hypothèses ; R11, R12 : confirmations). **Lots proposés** : SZ-1
(garde par empreinte) à SZ-7 (Jackie avec Hwa, constat 166) ; SZ-5 à
consolider avec 321 (`13b-coups-variables`). **Décisions formulées** : D1
forme de la garde ; D2 l'auxiliaire de l'API comme seule source ; D3
Guilty Sentence (second coup sur l'ennemi de plus faible DEF) ; D4 Danu ;
D5 Jackie ; D6 refuser en attendant les 19 sorts mal calculés ; D7 effets
entre groupes. **Découvertes** : DH13b-sequences-zone-01 (10112, Cow Girl
non éveillée) ; -02 (Triple Crush de Kashmir a ses effets entre coups,
Triple Combo de RYU non, pour les mêmes effets en fiche).

**Validé par le pilote** : Great Sword of the End (Sagar, 14613) porte
`coups: 2` et `aoe: true` dans `public/data/skills/24703.json` et
`24713.json` (précision au lot 12 exacte) ; Head Press (M. BISON, 14113)
`coups: 2`, `aoe: false` ; A.2 ter L148 fournit bien « Exploding Hands
répète une fois son ratio 7.4 × ATQ » ; la garde est écrite en `damage.ts`
L2886. Un `node -p` en lecture seule (écart déclaré).

##### 13b-ignore-def — 2026-10-02

Preuve `controle-13b-ignore-def.md` (291 lignes) et ses intrants (11
scripts). 16 constats, 28 lignes, 58 formes. **Cases** : donnée × existant
12 constats (22 lignes) ; relevé × neuf 4 (210, 211, 213, 216 : 6 lignes).
**Les douze déclarés livrés** : 5 établis (203 à 207), 7 partiels (200,
201, 202, 208, 209, 214, 215 : surtout sans test — Bull's Eye ×5, Shadow
Arrow, Hawk's Eye, Shun, Bombay, Celestara, Isael — et, pour 200, la
décision A.2 ter L151 « Fei choisit l'ignore DEF séparément pour chaque
coup » non implémentée : un seul interrupteur pour ses 4 coups) ; aucun
infirmé ; `auditdegatsconditionnels` 411 vérifications. **Calcul trop
favorable en production** : Madness Judgement (211) et Unlimited Power de
Liam (213) ignorent 100 % de la DEF en permanence (×5,7 à 1 500 de DEF) ;
même cas hors inventaire pour Thunder Strike 7713 (Copper éveillé), et à
consolider pour Katarina 6013 et Barbara 13611. Les contrôles libellés
« 209 — Triss » testent le constat 214 ; Bombay (le vrai 209) n'a aucun
test. **Relevés** : R1 Madness Judgement, R2 Liam, R3 Ezio/Patrick, R4
Agrius (swcalc : plein ignore à +200 de VIT, lu par WebFetch seulement), R5
Meteor Strike, R6 Silver Chakram (facultatif), Q1 premier coup de Fei.
**Lots proposés** : IGN-a (tests seuls, 15 identifiants), IGN-b (Thunder
Strike 7713), IGN-c (mesure conservatoire 211/213, sur décision), IGN-d1 à
IGN-g après relevés. **Décisions formulées** : D1 en attendant les relevés,
211/213 tels quels, neutralisés ou refusés ? D2 choix coup par coup étendu
aux autres sorts à chance par coup ? D3 afficher la chance de 25 % ? D4
contexte « combat de boss » ? D5 borne stricte pour 7713 ? D6 scénario
Meteor Strike actif par défaut ? **Découvertes** : DH13b-ignore-def-01
(7713) à -05 (dont Silver Chakram 12614 à 25 % sans prose, libellés de
test erronés, Meteor Strike, `formules-et-combat.md` L20).

**Validé par le pilote** : `damage.ts` L3037-3041 (`ignoreDef` = effet
« Ignore DEF » sauf table conditionnelle) et L2802-2805
(`IGNORE_DEF_CONDITIONNEL_PAR_ID`, sans 13406, 13410 ni 15511) ; fiches
`23101`, `23105` (Madness Judgement : « Ignore DEF ») et `25701` (Unlimited
Power : « Ignore DEF [If 3 or less enemies] ») → trop favorable, exact ;
`tests/audit-degats-conditionnels.test.ts` L1026 et L1030 « 209 — Triss »
alors que Triss est le constat 214 (plan) → exact ; A.2 ter L151 porte bien
la décision Fei → exact.

Deuxième vague (trois sessions `lot-j`) : `13b-declenchee-voisins`,
`13b-effets-entre-coups`, `13b-coups-variables`.

##### 13b-declenchee-voisins — 2026-10-02

Preuve `controle-13b-declenchee-voisins.md` (297 lignes) et ses intrants
(scripts 01 à 07, patch en mémoire). 15 constats, 43 lignes, 56 formes (32
jouables) ; aucun déclaré livré. **Cases (par ligne)** : donnée × existant
18, donnée × neuf 13 ; relevé × existant 1, relevé × neuf 6, relevé ×
indéterminé 5 ; 177, 182, 184 divergent selon la ligne. **Une ligne de
table suffit** (vérifié en mémoire par le chemin de production) : les appels
des Kung Fu Girls (8201-8205 vers le slot 2, 8216-8219 vers le slot 3) dans
`ATTAQUES_APPELEES_PAR_DECLENCHEUR`, total exact au point près, break DEF de
la S1 transmis (A.2 ter L151) ; Gollum et Lob Ear, Übel dans
`PASSIFS_OFFENSIFS_CONNUS` (+ `COUPS_VARIABLES_CONNUS`). **Bloquant** :
répéter le sort choisi est impossible (garde `appelee === declencheur`) →
mécanisme neuf N1 (Hwa, Vendhan, Zeratu, Elise, S1 de Bella) ; clés
d'interrupteur prises (l'appel de 8215 allumerait aussi l'ignore DEF
« manuel » de Dark Dragon Attack ; 23310 de même) → espace de clés distinct.
**Calcul trop bas en silence** : Trinity Claymore (22515) et Endless Kick
Combo (23015) ne comptent que leurs 3 × 0,8 ATQ, sans les compétences
qu'ils appellent. Clés par nom interdites (« Swing », « Trample »,
« Scratch », « Sonic Boom »). **Relevés** R1 à R7, questions Q1 à Q3.
**Lots** DV-a à DV-h (DV-e à consolider avec sequences-zone et
effets-entre-coups, DV-f avec coups-variables). **Décisions formulées** D1
à D10 (forme de N1, Bella, Gollum/Lob Ear, Trinity Claymore choisissable,
Sapsaree, Chain Fire…). **Découvertes** : DH-01 (Chain Effect 18212,
Vendhan), DH-02 (Might · Hurricane 18213, Chakra), DH-03 (« Emergency
Drive » de Rending Claw, clé par nom, proposé à des formes sans ce passif),
DH-04 (notes de Taebaek), DH-05 (étiquettes `familles_lot1` de 13a
fautives pour sept identifiants). Un `node -p` en lecture seule (écart
déclaré).

**Validé par le pilote** : `damage.ts` L3550 (garde `appelee ===
declencheur`), L2473 (condition manuelle de 8215, même clé) ; fiche
`33205.json` : Trinity Claymore `0.8*{ATK}`, 3 coups, deux « Additional
Attack » (Backlash, Hunting Hawk) non comptées → trop bas, exact.

##### 13b-effets-entre-coups — 2026-10-02

Preuve `controle-13b-effets-entre-coups.md` (250 lignes) et ses intrants (9
scripts). 13 constats, 43 lignes, 79 formes ; aucun déclaré livré. Case
supplémentaire « prose seule » (13 lignes) ; selon qu'elle compte comme
relevé ou donnée : donnée × existant 13 / 16, donnée × neuf 7 / 17, relevé ×
existant 5 / 2, relevé × neuf 17 / 7, relevé × indéterminé 1 (148).
**Saillants** : pour 13 lignes du 322, une ligne de
`EFFETS_ENTRE_COUPS_PAR_ID_CONNUS` suffit (écart actuel ×1,13 à ×1,68) ;
**Barbara (13611) trop favorable en production** (`ignoreDef` permanent,
×5,69 à 1 500 de DEF) ; aucune condition limitée à un coup précis (144 à
147) ; aucun champ pour « le sort allume son propre buff » (323).
**Relevés** R1 à R9, Q1. **Lots** EEC-1 à EEC-6, EEC-T. **Décisions
formulées** D1 à D7 (dont D6, le TC de Chiron qui ne compte qu'en mode
« Moyenne », rendue sans objet par la suppression décidée, lot CM ; D7 :
périmètre des familles découvertes). **Découvertes** : DH-01 (212 sorts à
plusieurs coups qui posent une Brise DEF ou une Marque sans curation, dont
173 hors inventaire — l'annexe de chronologie de l'audit, 225 sorts, n'a
produit aucune ligne : les 243 constats ne couvrent pas cette famille),
DH-02 (82 sorts qui posent un buff ATQ/VIT/TC), DH-03 à DH-06 (dont Triple
Crush : prose 50 % de DEF, code 70 % ; DH13b-sequences-zone-02 confirmé).

**Validé par le pilote** : fiche `23501.json` : Start of Attacking (13611)
porte « Ignore DEF(25) [Per beneficial effect removed] » et n'est pas dans
`IGNORE_DEF_CONDITIONNEL_PAR_ID` → `ignoreDef` vrai en permanence, trop
favorable, exact ; `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS` (`damage.ts` L2568)
et l'entrée par nom de Triple Crush (L2563) existent.

##### 13b-coups-variables — 2026-10-02

Preuve `controle-13b-coups-variables.md` (303 lignes) et ses intrants (8
scripts, 8 sorties). 15 constats, 49 lignes, 83 formes (49 jouables) ;
aucun déclaré livré. **Cases (par ligne, nombre de coups saisi par
l'utilisateur, D1)** : donnée × existant 27, donnée × neuf 1, relevé ×
existant 15, relevé × neuf 6 ; les bascules si le nombre de coups est
dérivé des stats sont listées (§ 10). **Saillants** : clé par nom
impossible pour Whirlpool, Crow Hunt (Prilea) et Dispel! Attack! (homonymes
jouables d'une autre mécanique) → variante par identifiant de
`COUPS_VARIABLES_CONNUS` / `COUPS_FIXES_CORRIGES` ; **calculs faux en
silence** : trop favorables Stella (7 coups toujours), Cannon Girls,
Katarina, Coco, Brutal Fists ; trop bas Espresso / Tea Bunny (−25 %),
Whirlpool, Prilea ; Lala faux dans toutes les lectures ; 321 consolidé avec
SZ-5 (lot CV-7 : 2908, 9413, 4211) ; 183 (ROBO) et Tanya (10713) se ferment
sans code par A.2 ter L152. **Relevés** R1 à R9 et R-COEF. **Lots** CV-1 à
CV-8 et deux clôtures. **Décisions formulées** D1 à D9 (saisir ou dériver
le nombre de coups, défauts des plages, ROBO sous L152, Pungbaek et Taor en
« Autres ennemis », Lala, Coco, Katarina, sorts calculés au maximum en
attendant, portée de God's Weapon). Un `node -e 0` vide (écart déclaré).

**Validé par le pilote** : `COUPS_VARIABLES_CONNUS` indexé par nom
(`damage.ts` L2775) ; A.2 ter L152 écarte bien la seconde attaque de
Shadow Assault de Tanya ; Stella (10711) : prose « up to 7 hits
accordingly to your Attack Speed », `coups: 7` = le maximum → compté
toujours, trop favorable, exact.

Troisième vague (trois sessions `lot-j`, pendant que le lot CM tourne dans
son worktree) : `13b-composantes-supplementaires`,
`13b-hors-tour-cooperation`, `13b-pertes-pv`.

##### 13b-composantes-supplementaires — 2026-10-02

Preuve `controle-13b-composantes-supplementaires.md` (218 lignes) et ses
intrants (4 scripts). 15 constats (124 à 138), 29 lignes, 56 formes ;
aucun déclaré livré. **Cases (lignes)** : donnée × existant 4 (131, 132,
137) ; donnée × neuf 14 (127 en prose seule, 134, 135, 136) ; relevé ×
existant 4 (124, 138) ; relevé × neuf 5 (125, 128, 129, 130, 133) ; relevé
× indéterminé 2 (126). **Saillants** : aucun des sept sorts actifs n'a sa
composante dans le calcul — l'effet « Increase Damage » n'est lu nulle
part — d'où des calculs **trop bas en silence** (Paul et Duke ×3, Cleaving
Light! ×3,27 à 50 % de PV) ; une ligne de table suffit pour 131, 132, 137
(`FORMULES_CUREES_PAR_ID` si la composante est mitigée,
`COMPOSANTES_FIXES_ADDITIONNELLES_PAR_ID` si elle est brute ; pour 132, sur
le sort actif 25110, pas sur le passif 25115) ; aucune condition existante
ne porte une composante plate → mécanisme neuf N-COND (133, 135, 136) ;
126 : sens de l'écart de DEF indéterminé ; 129 (Lydia) avec le constat 313
(stock saisi, lot L-e des amorces). **Relevés** : R-B (composante brute ou
mitigée) puis R1 à R12, cible à ~3 000 de DEF. **Lots** CS-a à CS-g.
**Décisions formulées** D1 à D7 (en attendant R-B, laisser 131/132/137 trop
bas ou les refuser ; variantes « boss », à consolider avec D4 de
13b-ignore-def ; conditions de N-COND ; Lucifer ; Deva ; Kiki ; Disdain).
**Découvertes** : -01 (`Disdain (Passive)` porte aussi 5613 et 5678 → clé
par identifiant) ; -02 (Bullet Assassination et Shining Butterfly en
`aoe: false` pour une prose « all enemies » → la ligne 224 mono-cible leur
est appliquée, trop favorable) ; -03 (buff de DEF posé par Hollyberry ou
Audrey absent de `STATS_COMBAT_PAR_ID_CONNUS`). Deux WebFetch sur swcalc,
cités comme source tierce (écart déclaré).

**Validé par le pilote** : « Increase Damage » n'apparaît dans `src/` qu'en
commentaires (`damage.ts` L1039, L1563, L5055, L5061) — aucun code ne lit
l'effet par son nom, exact ; nuance : quelques passifs qui le portent
(Backup Code, Blessing of Curse) passent par des tables par nom ; fiche
`35905.json` : le passif 25115 « deals additional damage equal to 15% of
your MAX HP when using [Lightning Strike!] » → ligne sur l'actif 25110,
exact ; `ConditionCombatProfile` (`damage.ts` L2006) n'a aucune variante
qui porte une composante plate, exact.

##### 13b-hors-tour-cooperation — 2026-10-02

Preuve `controle-13b-hors-tour-cooperation.md` (282 lignes) et ses
intrants (6 scripts, un patch en mémoire). 9 constats, 34 lignes ; aucun
déclaré livré. **Cases (lignes)** : donnée × existant 21 (dont 17 derrière
la garde ci-dessous), donnée × neuf 1, relevé × existant 9, relevé ×
indéterminé 3 ; 236 et 324 divergent selon la ligne. **Garde bloquante** :
`skillDamageProfile` (`damage.ts` L2945) rend `null` sur une formule vide
AVANT de lire `FORMULES_CUREES_PAR_ID` (L2946) — pour les 21 actifs à
formule vide, une ligne de table ne suffit pas tant que la garde n'est pas
déplacée une fois (comme au lot 9a pour les passifs), et le commentaire de
la table (L2651-2655) dit le contraire. **Mécanisme existant prouvé** :
l'« événement choisi seul » (`selectionnableCommeSort`,
`slotsDeclencheurs: []`) passe par le vrai chemin (24 identifiants
patchés, rapport constant 0,254561, aucun total de sort actif changé).
Horn of Protection (18811) écarté par `estSoinSansDegats` → exception
inverse par identifiant. A.2 ter L152 ne couvre aucune ligne (elle vise la
cible, pas l'auteur : les attaques des alliés restent à décider).
**Relevés** R1 à R9 (dont le facteur de riposte, « 75 % of the Attack
Power » selon l'effet `Counter`), Q1. **Lots** HT-1 (la garde + 17 formules
auxiliaires, à consolider avec D2 de sequences-zone) à HT-7, HT-2 avec DV-h
(Sapsaree). **Décisions formulées** D1 à D7 (événements hors tour choisis
seuls ou exclus ; attaques des alliés ; l'auxiliaire de l'API comme seule
source ; libellés ; nombres saisis ; interrupteur « riposte » ; boucliers).
**Découvertes** : DH-01 (le S2 de Frieren, 24909, est proposé comme sort et
son bouclier calculé comme des dégâts — 19 identifiants candidats, aucun
lot) ; DH-02 (la garde et son commentaire) ; DH-03 à DH-05 (donnée de
Thrash, homonymes non jouables, facteur de riposte des 48 passifs de
riposte). WebFetch de 12 fiches de l'API SWARFARM (écart déclaré).

**Validé par le pilote** : `damage.ts` L2945-2946 (garde `!c.formule`
avant la table) et L2651-2655 (le commentaire annonce une formule
« absente » fournie par la table) → contradiction exacte ; fiche
`35704.json` : Spell to Create a Field of Flowers (24909) `2.8*{ATK}`,
`coups: 0`, effets « Immunity » et « Shield », aucun soin → rien ne
l'écarte, bouclier compté comme des dégâts, exact.

##### 13b-pertes-pv — 2026-10-02

Preuve `controle-13b-pertes-pv.md` (338 lignes) et ses intrants (8
scripts, sorties rejouées à l'identique). 18 constats, 46 lignes, 82
formes ; aucun déclaré livré. **Cases (lignes)** : donnée × existant 1
(Seara), donnée × neuf 4, prose seule × neuf 3, relevé × existant 1 (John),
relevé × neuf 37 ; par constat, 13 relevé × neuf, 1 donnée × neuf (230), 4
divergents (220, 231, 232, 325). **Ce qui structure tout** : ni une perte
de PV ni un effet différé n'entrent dans `computeTotalDamage` (seule
exception : la bombe qui pose sans frapper, comptée comme son explosion) ;
18 lignes se ferment sans code si l'utilisateur exclut les pertes de PV
(D1), 8 de plus s'il exclut les explosions différées (D2). **Existant** :
Seara, une ligne `ATTAQUES_APPELEES_PAR_DECLENCHEUR[7113] = { slotAppele: 2 }`
(l'explosion de Fate of Destruction est déjà calculée) ; John, une ligne de
`FORMULES_CUREES_PAR_ID` après R3. **Calculs faux en silence** : trop bas —
Sword of Destruction (5 identifiants, 14 formes), Devil's Bargain, Dorothy,
toutes les détonations de 230 et 231 ; Hellfire ×2,36 trop bas à 1 500 de
DEF si sa propre Brise DEF s'applique avant le coup (R6) ; Incinerate (1362)
en `aoe: false` pour une prose « Attacks all enemies » → ligne 224 ajoutée
à tort. **Relevés** R1 à R7 (R8, R9 seulement si le hors-tour et la
destruction de PV entrent dans le modèle). **Lots** PV-1 à PV-9 et PV-T
(PV-8 avec le constat 323, PV-9 avec hors-tour ; seul PV-T est prêt sans
relevé). **Décisions formulées** D1 à D8 (pertes de PV, effets différés,
état saisi des détonations, état d'autres monstres, mention « calcul
partiel », libellé de Seara, Hellfire en attendant R6, Sath).
**Découvertes** DH13b-pertes-pv-01 à 09 (dont 6 bombes qui frappent et
posent sans ligne d'audit, Risky Dash 1879 signalé à `13b-verif-partie2`,
la `formule` de 16113 et 16613 qui est celle du bouclier, l'homonyme
Camouflage 8715) ; DH13-01 à 03 qualifiés : la destruction de PV vient
après les dégâts et ne relève que de D2.

**Validé par le pilote** : fiche `15703.json` : Promised Time (7113)
« sets off the bombs on the target », frappe tous les ennemis → la
détonation reprend la bombe du S2, ligne vers le slot 2 cohérente ;
`10332.json` : Incinerate (1362) `aoe: false` pour « Attacks all
enemies », exact ; `26303.json` : la formule de 16113, `0.15*{MAX HP}`, est
celle de son « Shield(15) », exact.

Quatrième vague (trois sessions `lot-j`, le lot CM toujours dans son
worktree) : `13b-variables-refusees`, `13b-pv-comparaisons-boucliers`,
`13b-compteurs-etats-binaires`. Règle de l'utilisateur reçue pendant la
vague et inscrite en A.2 ter (« Une attaque se lit dans la prose ») ; les
boucliers comptés comme des dégâts (Frieren 24909, Internal Force 12515)
ou refusés comme « formule de dégâts » se requalifient par elle à la
consolidation.

##### 13b-variables-refusees — 2026-10-02

Preuve `controle-13b-variables-refusees.md` (259 lignes) et ses intrants
(scripts 01 à 06). 6 constats, 8 lignes ; aucun déclaré livré. **Cases
(lignes)** : donnée × existant 3 (sorts qui ne frappent pas : refus
correct), donnée × neuf 1 (Dice Madness), relevé × existant 2 (Nobara et
Aya lumière), relevé × neuf 1 (Mo Long), indéterminé 1 (Christina) ; le
constat 81 diverge selon la ligne. **Saillants** : Mo Long (80) **livré en
partie sans être suivi** — 12011 accepté par
`DEGATS_FIXES_SANS_STAT_PROPRE_PRIS_EN_CHARGE` depuis `b2538ab1`, test vert,
plafond « can't exceed your current HP » manquant ; le plan le classe
différé et l'inventaire dit encore « refusé » (écart E1, pour la
consolidation) ; **Dice Madness, piège de donnée** : « Ignore DEF »
inconditionnel dans la donnée et 12111 absent de
`IGNORE_DEF_CONDITIONNEL_PAR_ID` — accepter `DICE` sans cette ligne
ferait ignorer la DEF sur les 5 coups ; Nobara et Aya lumière : vrais
dégâts fixes, une ligne en `DEGATS_FIXES_SANS_STAT_PROPRE_PRIS_EN_CHARGE`
suffit, mais le bonus élémentaire d'artéfact ne se suppose pas par
analogie avec Mo Long ; Christina : `{Alive Allies %}` non assimilé à
`{Living Ally %}`, deux attaques pour une formule et `coups: 1` (garde
« premier groupe » probablement bloquante, comme au lot 12) ; variables :
`{Alive Allies %}` et `DICE` relèvent d'une saisie (le nombre de faces d'un
dé est une constante du jeu absente des données), `{Attacker's Level}` est
une donnée du compte mais aucun sort de dégâts jouable ne la lit.
**Relevés** R1 Christina, R2 Mo Long (plafond avant ou après les bonus),
R3 Nobara/Aya (si D2), R4 Reno (si D3). **Lots** VR-1 à VR-5 (VR-5 avec le
constat 260, critiques garantis). **Décisions formulées** D1 (un sort sans
dégâts qui porte une formule : masqué ou refusé avec motif exact ?), D2
(dégâts fixes indépendants des runes), D3 (tirage des dés : saisi,
scénario ou espérance), D4 (PV actuels de Mo Long). **Découvertes** :
DH-01 (8 identifiants de bouclier jouables, 17 formes, affichés refusés
« formule de dégâts » — même famille que le bouclier de Frieren) ; DH-02
(la spec liste 7 variables contre 14 dans le code ; couverture écrite
6 073 / 115, aujourd'hui 6 077 / 113) ; DH-03 (44 attaques de monstres non
jouables, refus juste) ; DH-04. Un `node -p` en lecture seule (écart
déclaré).

**Validé par le pilote** : `damage.ts` L2676
(`DEGATS_FIXES_SANS_STAT_PROPRE_PRIS_EN_CHARGE = new Set([12011])`, une
ligne d'écart avec la citation) ; fiche `21301.json` : Dice Madness (12111)
porte « Ignore DEF » et « Guaranteed Critical Hit » sans note, la prose les
réserve aux dés doublés, et 12111 n'est pas dans la table conditionnelle →
exact ; `importAccount.ts` L644 lit `unit_level` → le niveau est une
donnée du compte, exact.

##### 13b-pv-comparaisons-boucliers — 2026-10-02

Preuve `controle-13b-pv-comparaisons-boucliers.md` (301 lignes) et ses
intrants (4 scripts, rejoués 4 fois à l'identique). 13 constats, 17
lignes, 34 formes ; aucun déclaré livré. **Cases (lignes, clause la plus
coûteuse)** : relevé × existant 9, relevé × neuf 4 (55, 65 ×2, 67), relevé
× indéterminé 4 (60, 61, 62, 68) ; aucune pente n'est dans la donnée ; les
clauses ATQ de Theonia (23515) et TC +30 de Lucas (prose seule, contredite
par l'effet) sont donnée × existant ; le critique de Theonia est déjà livré.
**Saillants** : les formes existantes couvrent la plupart des cas
(`BONUS_DEGATS_STACKABLE_CONNUS`, `BONUS_STACK_PROPRE_PAR_ID_CONNUS`,
`CONDITIONS_COMBAT_PAR_ID_CONNUS` avec `atkCibleSousAtkPropre`) ; partout le
bonus manque : **calculs trop bas** ; seuls Self Repair et Path of the
Brave Warrior sont trop favorables (état intermédiaire, bouton allumé).
**Boucliers** : Born to Fight (Lucas) n'est compté nulle part ; **Internal
Force (12515, constat 108) compte son bouclier `2.0*{DEF}` comme des
dégâts** et écarte l'« Increase Damage 50 » — lecture figée par
`tests/degats.test.ts` L2427-2435 ; à consolider avec les boucliers de
hors-tour (Frieren) et de variables-refusées. **Relevés** R1 à R13 (dont
R1b, R9b, R10b), Q1 (TC de Lucas), un relevé pour Internal Force. **Lots**
PCB-1 (seul prêt : Theonia, Lucas si Q1) à PCB-8 (PCB-7a avec N-COND de
composantes). **Décisions formulées** D1 à D7 (Self Repair et Path of the
Brave Warrior en continu, contre une décision antérieure de l'utilisateur ;
`ownHpPct` comme source unique ; Massacre ; PV détruits ; défaut sans
`enemyAtk` ; TC +30 sur la prose ; mention « calcul partiel »).
**Découvertes** -01 à -04 (commentaire périmé « aucun champ `enemyAtk` » ;
trois passifs réunis par analogie en « PV % » ; Indomitable Will et Martial
Artist's Will restés en bouton alors que `pvPropreSous` existe, mais
stricte face à « 23.5% or below » ; doublon de saisie de Brawler's Will).

**Validé par le pilote** : fiche `21805.json` : Internal Force (12515)
`2.0*{DEF}`, prose « Creates a Shield equal to your Defense » puis le bonus
de dégâts ; `tests/degats.test.ts` L2427-2435 vérifie bien la formule
`2.0*{DEF}` comme passif offensif → bouclier compté comme des dégâts,
exact (cas d'application de la règle « une attaque se lit dans la prose ») ;
`damage.ts` L1320 : `pvPropreSous` compare par `<` strict, exact ; 23515
figure dans `CRITIQUES_GARANTIS_INCONDITIONNELS` (L2682), exact.

##### 13b-compteurs-etats-binaires — 2026-10-02

Preuve `controle-13b-compteurs-etats-binaires.md` (260 lignes) et ses
intrants (scripts 01 à 06). 8 constats, 14 lignes, 25 formes (14
jouables) ; aucun déclaré livré. **Cases (lignes)** : donnée × existant 6
(312 ×4, 314 ×2), donnée × neuf 2 (24, 306), relevé × existant 4 (14 ×2,
25 ×2), relevé × neuf 2 (122, 311) ; quatre verdicts nommés peuvent changer
de case (14, 25, 312, 314). **Saillants** : aucun des 14 identifiants n'est
dans une table ni un test ; 312 (Eightfold : Zenitsu, Qilin Slasher) — une
ligne `manuel` +50 % de `CONDITIONS_COMBAT_CONNUS` suffit, seul lot prêt
sans relevé ; 14 (Yoga Sunburst, Chemical Gas Spray) — donnée 30 %, prose
50 %, le compte d'effets existant serait faux (il ajoute d'office Brise
DEF et Marque) → compteur propre au sort ; 306 (Barque) — valeur fournie
(A.2 ter L154), mécanisme neuf (formule vide, deux attaques appelées) ; 311
(Liliana) — dégâts de la forme transformée Lord of Hell 28715, que
`sansDoublonDeTransformation` écarte au profit de 28615 ; 314 (Pholus,
Himmel) — deux clauses « boss » différentes, non fusionnées ; DH13-05
(Spirit's Wrath 1113) et DH13-06 (Mach Crush 6413, donnée 30 %, prose
20 %) qualifiés. **Relevés** R1 à R6 (aucun ne dépend du mode « Moyenne »).
**Lots** CEB-1 à CEB-9 (CEB-6 avec HT-1, SZ-1 et N1 ; CEB-7 avec SZ-4 ;
CEB-2 avec IGN-e). **Décisions formulées** D1 à D7 (Eightfold ; contexte
« boss » ; conteneur du compte de dégâts continus ; formes transformées
choisissables ; 1113 ; Stark ; table commune de corrections de portée).
**Découvertes** -01 (Nature of Beast 12942, Bellenus transformé) ; -02
(Hollow Purple et Explosion and Blaze en `aoe: false` pour « all
enemies » → ligne 224 appliquée, trop favorable) ; -03, -04.

**Validé par le pilote** : fiche `24303.json` : Yoga Sunburst (14213)
« Debuff Bonus Damage(30) » contre « increases by 50% » dans la prose,
exact ; `32202.json`, `32204.json` : Eightfold (21607, 21609) « Increase
Damage(50) [If the targets Attack Bar is 0] » dans la donnée, exact ;
`monsterForms.ts` L125 `sansDoublonDeTransformation`, appliqué partout
(L12), exact.

Cinquième vague (trois sessions `lot-j`) : `13b-stats-passifs`,
`13b-stats-passifs-corpus`, `13b-critiques-garantis`.

##### 13b-stats-passifs — 2026-10-02

Preuve `controle-13b-stats-passifs.md` (338 lignes) et ses intrants (8
scripts, rejoués à l'identique). 11 constats, 30 lignes, 55 formes (30
jouables) ; aucun déclaré livré. **Cases (lignes)** : donnée × existant 9,
prose seule × existant 6, relevé acquis × existant 1 (Chilling),
indéterminé × existant 1 (Taebaek), prose seule × neuf 2 (Leona, Chacha),
relevé × neuf 10, sans objet 1 (Leo). **Saillants** : 108, Internal Force —
le bouclier n'est pas une attaque (A.2 ter « Une attaque se lit dans la
prose »), le +50 % « damage dealt » est dans la donnée, une ligne de
`BONUS_DEGATS_CONDITIONNEL_CONNUS` suffit (contre la lecture du catalogue
L220-226 : tranché par l'utilisateur, A.8) ; une ligne de
`STATS_COMBAT_PAR_ID_CONNUS` suffit sans relevé pour Ciri et Birgitta
(+50 de VIT en points, ≤ 250), et pour Chilling si l'on accepte le +20
« mesuré » attesté par un seul commentaire ; l'assiette des « +X % » (base
ou totale) n'est nulle part (14 lignes en dépendent) ; source « PV
propres » neuve (7 lignes) ; clauses de TC seules rendues inertes par le
lot CM (Huga, Ardella, Shumar ; Gorgo déjà livré) ; 83 et 86 livrés, par
nom dans `BONUS_STAT_FIXE_CONNUS`, testés ; le test « clés de
`STATS_COMBAT_PAR_ID_CONNUS` ⊂ corpus » n'existe pas (lot SP-0 proposé).
**Relevés** R1 à R9b, Q1 à Q3. **Lots** SP-0 à SP-11 (prêts : SP-0, SP-1
retrait du bouclier, SP-2). **Décisions formulées** D1 à D9.
**Découvertes** -01 à -06, dont -02 : l'extraction de 13a manque trois
tables (dont `BONUS_DEGATS_STACKABLE_CONNUS`) — Sleep Talk classé à tort
« absent de toute table ».

**Validé par le pilote** : `damage.ts` L708-713 (`BONUS_STAT_FIXE_CONNUS`
par nom : Detect Weakspot, Deathblow, Elaborate Plan, Charge) → 83 et 86
livrés, exact ; `speedTunePassif.ts` L30-33 : le +20 de The Cunning n'est
attesté que par le commentaire « mesuré à +20 par buff », exact.

##### 13b-stats-passifs-corpus — 2026-10-02

Preuve `controle-13b-stats-passifs-corpus.md` et ses intrants (scripts 01
à 04, `tri-173.csv`). Les 173 passifs hors audit lus un par un, sans arrêt.
**Tri** : 90 oui, 82 non, 1 indéterminé (Dova) — précision des détecteurs
de 13a : 52 %, rappel non mesurable. **Jouabilité** : 79 passifs ont une
forme sélectionnable, 80 sans objet (non éveillées, génériques, boss), 14
sur des formes transformées. **Les 32 oui sélectionnables** : 5 déjà
modélisés, 20 donnée × existant (buff standard posé sur soi : le réglage
générique existe), 4 prose seule × existant, 1 relevé × indéterminé
(Skogul), 2 RES/PRE hors formule ; **aucun mécanisme neuf** ; les 8 oui des
formes transformées dépendent de la décision sur ces formes (prise : A.8).
**Lots** SPC-1 (rappel des buffs posés par un passif — décidé, A.8) à
SPC-5 ; aucun ne justifie un chantier à part. **Découvertes** -01 à -05,
dont -01 (l'extracteur de 13a ne lit que les déclarations de table sur une
ligne : `BONUS_DEGATS_STACKABLE_CONNUS` L937 et
`BONUS_COEFFICIENT_PAR_COMPTEUR_CONNUS` L2586 lui échappent — la
consolidation ne réutilise pas sa colonne `autres_tables` sans correction)
et -04 (Fatal Cleave de Solide, ignore DEF progressif absent).

**Validé par le pilote** : `tri-173.csv` : 173 lignes, 90 / 82 / 1,
exact ; les deux tables sont bien déclarées sur plusieurs lignes (`damage.ts`
L937, L2586) → défaut de 13a confirmé.

##### 13b-critiques-garantis — 2026-10-02

Preuve `controle-13b-critiques-garantis.md` (257 lignes) et ses intrants
(8 scripts). 30 constats, 34 lignes, 58 formes. **Cases (lignes)** :
donnée × existant 31 — **dont 29 livrées depuis `b2538ab1`
(2026-09-15) sans que l'inventaire l'enregistre** (23 identifiants dans
`CRITIQUES_GARANTIS_INCONDITIONNELS`, Storm of Midnight, Fire Strike et
Flame Strike par condition, Burst Cannon à 10 charges ; seuls 7 ont un test
de la garantie) ; relevé × neuf 2 (Artamiel, contre-attaque hors tour ;
Dice Madness, à fusionner avec VR-5) ; relevé × indéterminé 1 (Moria,
formule vide). Byungchul (269, 270) : garantie portée par le passif 18613,
sans condition ; deux lignes de table suffisent (18608, et 18603 hors
inventaire). La garantie s'applique avant tout mode critique. **Relevés**
R1 à R4. **Lots** CG-1 (tests et statut, prêt), CG-2 (Byungchul, prêt) à
CG-6. **Décisions formulées** D1 (contre-attaques calculables — tranché :
oui, seules, A.8), D2 (découvertes hors inventaire), D3 (part de l'allié de
Moria). **Découvertes** -01 à -08, dont Deadly Swing 6207, 6208, 6209, 6257
non couverts alors que 6258 l'est.

**Validé par le pilote** : fiche `28903.json` : Full of Spirit (18613)
« Your attacks will always land as a Critical Hit », 18608 absent de la
table → exact ; 6258 couvert par une condition (`damage.ts` L2464,
`pvCibleMax` 30 % avec `critiqueGaranti`), 6207 nulle part → exact.

Sixième vague (deux sessions `lot-j`, sur le code où le mode « Moyenne »
est déjà supprimé) : `13b-critiques-bonus-tc-dc`, `13b-verif-partie2`. Les
dix-sept sous-lots sont validés.

##### 13b-critiques-bonus-tc-dc — 2026-10-02

Preuve `controle-13b-critiques-bonus-tc-dc.md` (298 lignes) et ses
intrants (scripts 01 à 05, sonde de production). 18 constats, 30 lignes,
54 formes (29 jouables). **Cases** : donnée × existant 16 / 28, donnée ×
neuf 2 / 2 (288 Mina, 294 Übel) ; aucun relevé. **Effet du lot CM** : 19
lignes (11 constats) ne portent qu'un bonus de Taux Crit et ne changent plus
aucun total (sonde : totaux identiques à +0 et +50 de TC) — non comptées
comme besoins ; 11 lignes changent un total (5 garanties conditionnelles,
2 bonus de Dgts Crit). **5 constats livrés depuis `826fb331` avec leur
test**, encore « Partiel » à l'inventaire (287 Gorgo, 289 Naomi, 293
Eludain, 303 Fire Wall, 304 Flame Eruption). 290 et 291 (Yuji, Rick) : 6
lignes de `CONDITIONS_COMBAT_PAR_ID_CONNUS` (`debuffCiblePresent` +
`critiqueGaranti`), `resumeCondition` à généraliser (figé sur « ignore
DEF ») ; 292 (Ice Smash 2751) à clé par identifiant (2701, homonyme, sans
bonus) ; Mina (condition `aucunDebuffCible`) et Übel (comparaison des PV
max) : mécanismes neufs légers. **Relevé** R-A (Yuji ou Rick : la réduction
de DEF du coup 1 garantit-elle le critique du coup 2 ?) — **rendu inutile
par la décision de l'utilisateur** (A.2 ter : garantie posée). **Lots**
TC-1 à TC-5. **Décisions formulées** D1 (bonus de TC inertes : clore,
afficher ou retirer), D2 (TC ≥ 100 % interdit-il « Non critique » ?), D3
(Übel), D4 (Mina — tranché : suit le mode critique), D5 (Yuji/Rick —
tranché : garantie posée). **Découvertes** DH-01 à 08 (dont la clé par nom
« Tiger's Appearance » qui touche aussi 6113, la réduction de DEF du coup
1 de Divergent Fist / Shockwave Fist qui n'atteint pas le coup 2 dans le
code).

**Validé par le pilote** : fiches `11731.json` (Ice Smash 2751 : « Increase
Attack Critical Chance(50) ») et `11701.json` (2701 : aucun bonus) →
clé par identifiant nécessaire, exact ; `Charge (Passive)` (Gorgo) présent
dans `BONUS_STAT_FIXE_CONNUS` → livré, exact.

##### 13b-verif-partie2 — 2026-10-02

Preuve `controle-13b-verif-partie2.md` et ses intrants (11 scripts). 41
constats (39 déclarés livrés, 149, 308), 78 lignes, 149 formes. **Livraisons
: 12 établies** (51, 74, 77, 89, 97, 149, 241, 244, 254, 268, 308, 309),
**28 partielles**, **1 infirmée (96, Carlos)** : aucun code, et les trois
contrôles « 96 — » testent en réalité Elsharion (constat 97). 55
identifiants sans test ; pour 24 des 28 partielles, seuls des tests
manquent (sonde CLI conforme partout). **Saillants** : 72 Torrent — le
coefficient livré `5,5 × ATQ` constant ne cite aucune source et contredit
la donnée et la prose (relevé R1) ; 256 Jaara et 263 Varus — comparaison
en `<=` alors que la prose et la `note` sont strictes ; 123 Thunderer —
S1/S2 renforcés pendant l'état portés par les formes 28411 et 28415
(rejoint la décision sur les formes transformées) ; Risky Dash 1879 déjà
couvert par `Current HP`, sans test ; réserve sur 26 lignes de stats
appliquées à la stat totale (assiette à relever passif par passif, A.2
ter). **Relevés** R1 (Torrent), R2 (assiette, avec R4b de stats-passifs).
**Lots** VP-a (tests manquants, libellés « 96 — » corrigés, refus de 0
ennemi), VP-b (bornes strictes de Jaara et Varus), VP-c (Torrent après
R1), VP-d (Carlos après D2). **Décisions formulées** D1 (Torrent constant),
D2 (Carlos : ATQ gagnée ou des victimes, assiette du plafond 300 %), D3
(Thunderer : rejoint les formes transformées), D4 (relevé d'assiette).
**Découvertes** DH-01 (18216, 18217, 18218, 18220 des formes Thunderer non
couverts) à DH-03.

**Validé par le pilote** : `damage.ts` L1330 et L1332 comparent en `<=`
(`defCibleSousDefPropre`, `defCibleSousAtkPropre`) → bornes non strictes,
exact ; `tests/audit-degats-conditionnels.test.ts` L1069-1076 : « 96 —
Elsharion… » → libellés erronés, exact ; `partie-2.md` L112 laisse 96 en
partie 4 alors que `partie-2.csv` le déclare livré → contradiction, exact.

#### Résultat de la consolidation du lot 13 — 2026-10-03

Brouillon rédigé par un agent `lot-j`, relu et **validé par le pilote**.
Plan `spec/outils/optimizer/decisions/plan-reliquat-degats-2026-10.md`
(472 lignes, nature décision, « plan proposé, en attente de la décision de
l'utilisateur ») ; synthèse `controle-13.md` et scripts
`controle-13-intrants/` (rejoués par le pilote : deux passes identiques) ;
ligne de `pistes.md` § « Dégâts réels — reliquat de l'audit ». **Classement
des 243** (cases élargies, dites dans le plan : DE, DN, RE, RN,
indéterminé, livré, sans effet) : DE 59, DN 34, RE 42, RN 57, I 14, LIV
23, SANS 14 ; avant les décisions des 2 et 3 octobre, DE 88, RE 25, LIV 24
— les décisions déplacent 37 constats. **Les 51 déclarés livrés** (grille
stricte, un test par identifiant) : 13 établis, 37 partiels, 1 infirmé
(96) ; **32 livraisons non enregistrées** trouvées dans les 192 différés.
**164 constats** à traiter hors des lots 15a-15e. **109 relevés** après
dédoublonnage (97 nécessaires), **65 décisions ouvertes**, **10 valeurs de
jeu à fournir**, **33 lots** proposés. **Recommandation : un chantier à
part**, après la clôture de degats-et-aura (D65) — l'utilisateur tranche
(A.8). Défauts de 13a corrigés (six tables sur plusieurs lignes manquées ;
libellés « 96 — » et « 209 — ») sans changer de verdict.

**Validé par le pilote** : somme des cases = 243, réconciliation 51 + 192
écrite ; rejeu des scripts `00-rejouer.mjs` (empreintes identiques) ;
recommandation chiffrée conforme au contrat (13b, point 4). **Choix du
pilote sur les écarts signalés** : les 17 « +X % » déjà livrés classés RE
(leur assiette se relève passif par passif, A.2 ter) — accepté, le relevé
R01 peut les confirmer sans code ; l'identifiant DH13-C01 (surplus de Taux
Crit hors dominance) accepté.

### Lot CM — le mode critique « Moyenne » supprimé

**Cat. J.** Décisions de l'utilisateur du 2026-10-02 : le mode critique
« Moyenne », dit « non utilisé et devant être supprimé » dans l'amendement
1c1 (L64-66) et resté sans lot (découverte DH13b-declenchee-amorces-02),
est **supprimé dans ce chantier** ; une recette déjà exportée ou partagée
qui l'utilise est **convertie en « Critique » (le défaut) avec un
avertissement visible**, à l'écran comme dans le CLI — jamais refusée,
jamais changée en silence.

**Exécution** : lot parallèle (A.8) dans le worktree `sw-forge-lot-cm`
(branche `forge/dea-cm`, partie de la tête du chantier), pendant les
vagues 13b, qui qualifient sur un code stable ; notes déposées dans
`sw-forge-lot-cm-notes\base` et `\notes` ; ni `livrer` ni `push` ; le
pilote l'intègre après la dernière vague 13b.

**Intrant** : `damage.ts` (`CritMode` L3670, `CRIT_MODE_LABELS` L3676,
puis chaque lecture de `'moyenne'`, par grep — plages seulement) ;
`runeBuildOptim.ts` (ses lectures de `'moyenne'`) ; `optimizerRecipe.ts`
L327 ; `DamageSetupCard.tsx` L1938 ; `useOptimizerState.ts` ; les scripts
`scripts/lib/diagnosticConfig.ts`, `scripts/lib/diagnosticLot.ts`,
`scripts/artifact-contention-diag.ts`, `scripts/construction-time-diag.ts`,
`scripts/monster-search-multicount-diag.ts`, `scripts/lib/chargerRecette.ts`
(avertissements) ; les tests qui citent la valeur (grep `'moyenne'` dans
`tests/`) ; la décision du 2026-09-29 « Taux Crit en mode Moyenne »
(`invariants.md` L37, `algorithme.md` L79-84) ; les specs qui décrivent les
trois modes (grep « Moyenne » dans `spec/` hors `chantiers/`).

**Contrat.**

1. `CritMode` ne connaît plus que `'crit'` et `'normal'` ; les libellés,
   le `Segmented`, l'aide et le bloc propre à « Moyenne » de la carte
   suivent. Tout code qui lisait `'moyenne'` (score, stats pertinentes,
   tirages des scripts de diagnostic et de mesure) est retiré ou ramené
   aux deux modes, sans autre changement de calcul pour `'crit'` et
   `'normal'`.
2. **Recette** : `damageSetup.critMode: "moyenne"` s'importe en `'crit'` et
   produit un avertissement nommé (chemin du champ, ancienne et nouvelle
   valeur), affiché par l'écran à l'import et par le CLI (mécanisme
   d'avertissements de `chargerRecette`). L'export n'écrit jamais
   `'moyenne'`. Toute autre valeur inconnue reste refusée. Tous les
   constructeurs du type (écran, recette, CLI, harnais) suivent :
   `grep -rn` sur `src/`, `scripts/`, `tests/`.
3. **Décision du 2026-09-29** (« Taux Crit en mode Moyenne ») : rendue sans
   objet ; `invariants.md` et `algorithme.md` le disent (recette (c) de
   `spec-hygiene`), sans effacer l'historique.
4. **Tests** : un test qui éprouvait « Moyenne » est retiré ou converti,
   sa raison écrite dans la preuve ; tests neufs : conversion à l'import
   avec avertissement (écran et CLI), refus d'une autre valeur inconnue,
   export sans `'moyenne'`.

**Preuves** : grep `'moyenne'` dans `src/`, `scripts/`, `tests/` → la seule
conversion (et ses tests) ; mutation APRÈS le commit (A.8) par point ;
`tsc`, tests de zone (`degats auditdegatsconditionnels optimizerrecipe
recettepartagee cliclassement speedtune` + ceux qui citaient la valeur),
build (classes vérifiées dans le CSS construit), spec-lint, diff-check ;
CLI réel avec une recette « moyenne » → avertissement et résultat de
« Critique » ; preuve `controle-cm.md`. Vérification à l'œil en A.8.

**Ne fait pas** : aucun mode nouveau ; aucune autre règle de critique
(402, 410, critiques garantis ou interdits) ; ni `livrer` ni `push`.

#### Résultat du lot CM — 2026-10-02

Lot parallèle (agent `lot-j`), worktree `sw-forge-lot-cm` parti de
`e04badb3`. Quatre commits, intégrés en `f1e7d71c` (type, écran, calcul :
la part critique vaut 1 ou 0, la branche qui lisait le Taux Crit est
retirée ; tests convertis), `361cc9d0` (recette : « moyenne » converti en
« crit » par `parseOptimizerRecipe`, avertissement
`AVERTISSEMENT_CRIT_MOYENNE` ; écran, `chargerRecette`, CLI et harnais ;
tests `testCritiqueMoyenneImport`, `testCritiqueMoyenneEcranEtCli`),
`3ea62afe` (`artifact-search` aux deux modes) et `3cba1d5a` (correction
demandée par l'utilisateur : l'avertissement prend le token warn et reste
affiché jusqu'au prochain import — `src/lib/messageImport.ts`,
`testCritiqueMoyenneMessageImport`). Inventaire : 25 occurrences de
`'moyenne'` dans 9 fichiers ; restent la conversion
(`optimizerRecipe.ts`), celle d'`artifact-search --crit=moyenne`, un
commentaire et les tests. Décision du 2026-09-29 « Taux Crit en mode
Moyenne » dite sans objet (`invariants.md`, `algorithme.md`). CLI réel
(Kinki, Sonia) : recette « moyenne » → avertissement, puis sortie
identique à « crit ». Preuve `controle-cm.md`.

**Rejoué par le pilote** : dans le worktree, `tsc` 0, 2 077 vérifications,
build, spec-lint, diff-check ; **mutation du pilote** (conversion en
« normal ») : 3 échecs ; restaurée ; correction rejouée (76 vérifications) ;
sur le combiné, après intégration : `tsc` 0, 2 908 vérifications (16
filtres), build, spec-lint, diff-check verts ; notes fusionnées à trois
sans conflit. Mutations de l'agent : 7, puis 3 pour la correction.

**Écarts** : `artifact-search` convertit aussi `--crit=moyenne` ; huit
scripts de diagnostic appellent le parseur sans `chargerRecette` (recette
convertie, avertissement non affiché) ; le message d'import reste dans le
flux, sous la barre d'actions (le bouton cliqué ne bouge pas, ce qui est
sous le message descend, comme avant). **Hors lot, préexistant** : le
surplus de Taux Crit de Ciri, MOS (Feu) et Reyka change les dégâts sans être
protégé par la dominance → consolidation 13. **Non prouvé** : aucun rendu
à l'œil (A.8) ; les CLI réels ne départagent pas l'ancien calcul (Kinki ne
critique pas, Sonia exige 100 % de TC).

#### Lot LM — la liste des monstres et sorts modifiés

**Cat. C.** Demande de l'utilisateur du 2026-10-02 : une liste exhaustive
des monstres et sorts modifiés par ce chantier, pour tout vérifier à la
fin, **tenue à jour à chaque commit**. Agent `lot-c`.

**Sortie** : `spec/chantiers/degats-et-aura-monstres.md` (en-tête de
cadrage : `**Statut :** CHANTIER en cours — branche forge/degats-et-aura`).
Une table **par monstre** : monstre (formes concernées, com2usId), sort
(nom du jeu, identifiant, slot), ce qui change dans le calcul ou
l'affichage, lot, commit(s), comment le vérifier à l'écran ; puis une
section des **changements transverses** (tous monstres : auras externes,
prose des sorts au clic, mode critique « Moyenne », Worker de résolution,
planchers d'artéfacts et de relique…), chacun avec son lot et sa
vérification.

**Intrant** : `git log` et `git diff` de la branche depuis `81284199`
(tables curées et branches de `damage.ts`, `DamageSetupCard.tsx`, recette,
CLI) ; les Résultats des lots de ce cadrage (par Select-String sur
« Résultat du lot ») ; les tests nommés qui fixent chaque cas. Chaque ligne
cite son commit ; une modification sans monstre nommable va dans les
transverses ; un doute reste écrit, jamais tranché.

**Règle permanente (A.8)** : tout commit qui change le calcul ou
l'affichage d'un monstre ou d'un sort met à jour cette liste **dans le même
commit**.

**Preuve** : la liste, `spec-lint` vert, et un contrôle par script : chaque
identifiant de compétence ajouté ou modifié dans une table curée de
`damage.ts` depuis `81284199` figure dans la liste (sortie dans
`controle-lm.md`).

**Ne fait pas** : aucun code ; aucune vérification à l'œil (c'est la liste
qui la permettra).

#### Résultat du lot LM — 2026-10-02

Agent `lot-c`. Un commit, `7d3a9d77` : `spec/chantiers/degats-et-aura-monstres.md`
(563 lignes) — 47 monstres, 48 identifiants de sort, 77 lignes monstre ×
sort × lot (un titre par monstre, une ligne par lot pour que chaque lot
reste vérifiable), 28 changements transverses et 6 lignes hors produit,
une section « préparé sans effet en production », une section de doutes.
Contrôle par script (`controle-lm-intrants/verifier-liste.mjs`) : les 16
identifiants ajoutés ou modifiés dans les tables curées depuis `81284199`
sont tous dans la liste ; second contrôle, les 108 commits non
documentaires de la branche sont tous cités ; sensibilité éprouvée (un
identifiant et un hash retirés d'une copie : signalés). Preuve
`controle-lm.md`.

**Validé par le pilote** : commit limité au seul fichier ; en-tête de
cadrage ; lignes Blade Surge 10620 (8a, 8b, 8c) et Gold Headband 7912
relues ; spec-lint vert. **Limites dites par l'agent** : les « comment
vérifier » sont écrits d'après le code et les Résultats, pas observés ; le
contrôle par script ne voit que les tables (une branche de calcul sans
table n'est retrouvée que par les commits) ; les formes † (non éveillées,
habillages) restent à confronter au compte réel.

#### Lot 9d — le survol de Tempest retiré

**Cat. J.** Décision de l'utilisateur du 2026-10-02 : l'interrupteur
« Tempest (S3) se déclenche après ce sort » ne garde plus l'ancienne
condition au survol (`title`) — un survol n'existe pas au doigt ; la
condition reste lisible dans la prose de Tempest (« ? », lot 11bis). Le
test de l'écran suit ; la liste du lot LM aussi. Mutation après le commit.
**Ne fait pas** : rien d'autre dans la carte.

#### Résultat du lot 9d — 2026-10-03

Agent `lot-j`, dans le worktree du chantier (pendant la rédaction du plan
du lot 13). Un commit, `2bca1603` : l'interrupteur « … se déclenche après
ce sort » n'a plus de survol (`title={apresSort ? undefined : …}`) ; les
autres interrupteurs de passif gardent le leur ; tests
`testDegatsTempestEcran` (+5 vérifications 9d), specs
`attaque-apres-un-sort.md` et `optimizer.md`, un commentaire de `damage.ts`,
liste des monstres (ligne 9b, ligne 9d — hash inscrit par le pilote,
`3645aff0`). La condition reste lisible par la prose du jeu de 3213, sous
l'interrupteur (`texteJeu`) et au « ? » de la case Tempest. Disparaît de
l'écran : la phrase rédigée « sa recharge est terminée… (recharge non
simulée) » — à confirmer à l'œil (A.8). Preuve `controle-9d.md` (99
lignes).

**Rejoué par le pilote sur `2bca1603`** : `tsc` 0 ; 177 vérifications
(`tempest prosessort effetsactifs`) ; build, spec-lint, diff-check verts.
Mutation de l'agent (`title` remis) : 2 échecs. **Mutation du pilote**
(survol retiré de TOUS les interrupteurs de passif) : 1 échec, « … les
autres interrupteurs de passif gardent le leur » ; restauré.

**Défaut du contrat** (relevé par l'agent) : un commit ne peut pas citer son
propre hash dans la liste ; règle précisée en A.8 — le pilote inscrit le
hash à la validation.

### Lot 15 — les lots prêts du plan (nuit du 2026-10-02)

**Décision de l'utilisateur du 2026-10-02** : pendant la nuit, après le
plan, implémenter dans ce chantier les lots déjà prêts — valeur dans la
donnée, mécanique existante, décision prise, aucun relevé. Chaque sous-lot
part d'un Résultat 13b cité, met à jour la liste du lot LM dans le même
commit, mute après le commit (A.8), et s'exécute **un à la fois** dans le
worktree du chantier (ils touchent tous `damage.ts`). Catégorie J, agent
`lot-j`, sauf 15a (C, `lot-c`).

| Sous-lot | Contenu | Source |
| --- | --- | --- |
| 15a | Tests de couverture des livraisons non gardées : les garanties de critique livrées sans test (22 identifiants), les 5 bonus de critiques livrés (287, 289, 293, 303, 304), les 15 identifiants d'ignore DEF sans test, les tests manquants des livraisons partielles de la partie 2 ; libellés de test faux corrigés (« 96 — » → 97, « 209 — Triss » → 214) | CG-1, TC-2, IGN-a, VP-a |
| 15b | Internal Force (Leona, 12515) : le bouclier `2.0*{DEF}` n'est plus compté comme des dégâts ; « damage dealt +50 % » compté sous un interrupteur « bouclier actif » ; catalogue L220-226 et `tests/degats.test.ts` L2427-2435 corrigés | SP-1, décision A.8 |
| 15c | Sorts sans attaque masqués de la liste des sorts : chaque candidat vérifié par sa **prose** (A.2 ter) — bouclier S2 de Frieren 24909, les 8 boucliers jouables affichés « formule de dégâts refusée », les candidats boucliers de hors-tour (DH-01), 16113 et 16613 — table curée par identifiant, jamais une détection automatique de la prose | VR-1, DH-01 de hors-tour et de variables-refusées, décision A.8 |
| 15d | Garanties et bornes : Byungchul (18608, 18603) ; Yuji et Rick (garantie du 2e coup, A.2 ter ; `resumeCondition` généralisé) ; Jaara (256) et Varus (263) en bornes strictes | CG-2, TC-3, VP-b |
| 15e | Ciri et Birgitta : +50 de VIT en points (≤ 250) dans `STATS_COMBAT_PAR_ID_CONNUS` ; Theonia (23515) : +100 % si l'ATQ ennemie saisie (`enemyAtk`) est inférieure à l'ATQ du build | SP-2, PCB-1 |

**Ne fait pas** : rien qui demande un relevé ou un mécanisme neuf (chaînes
des Kung Fu Girls et de Trinity Claymore, Eightfold à partir d'un coup,
réglage « combat de boss », pertes de PV, formes transformées dans la
modale, Mina, Fei coup par coup : au plan) ; aucune des mesures
conservatoires écartées par l'utilisateur au-delà de ces lots (Madness
Judgement, Liam, Thunder Strike, Barbara attendent le plan).

#### Résultat du lot 15b — 2026-10-03

Agent `lot-j`. Un commit, `dcca28a7` : Internal Force (12515, porté par
Paladin 21805 † et Leona 21815, aucun homonyme par nom) sort de
`PASSIFS_OFFENSIFS_CONNUS` — le bouclier `2.0*{DEF}` n'est plus compté — et
devient une ligne de `BONUS_DEGATS_CONDITIONNEL_CONNUS` (`pct: 50`, « tu as
un bouclier actif », désactivé par défaut ; même clé de stockage
`passifsOffensifs[12515]` : un réglage déjà allumé donne +50 % au lieu de
+2 × DEF) ; test réécrit (deux formes, défaut éteint, ×1,5 exact, la DEF ne
change plus le total), libellé de Comeuppance corrigé ; catalogue et
`passifs-offensifs.md` (499 lignes) ; liste des monstres (hash inscrit par
le pilote, `9be732b5`). Total témoin (Leona, ATQ 2500, DEF 1500) : S1
7 530,76 éteint ; avant, allumé 9 599,07 (bouclier +2 068,31) ; après,
allumé 11 296,14 (×1,5). Preuve `controle-15b.md`.

**Rejoué par le pilote sur `dcca28a7`** : `tsc` 0 ; 1 333 vérifications ;
build, spec-lint, diff-check verts. Mutations de l'agent : 4 et 2 échecs.
**Mutation du pilote** (`pct` 50 → 30) : 3 échecs ; restaurée. `pistes.md`
L108 (historique) mis à jour par le pilote. **Non prouvé** : que le +50 %
porte sur les dégâts infligés (relevé R9 non fait ; la donnée, la prose et
la décision le disent) ; rendu à l'œil.

#### Résultat du lot 15c — 2026-10-03

Agent `lot-j`. Deux commits : `a65b2f28` (table `SORTS_SANS_ATTAQUE_PAR_ID`
dans `damage.ts`, une prose par ligne ; `skillDamageProfile` rend `null`
pour un sort de la table — masqué, jamais refusé ; `monsterOffensivePassives`
écarte un passif de la table ; test `testDegatsSortsSansAttaque` ;
`formules-et-combat.md` ; 28 sections de la liste des monstres, hashes
inscrits par le pilote en `ab59d586`) et `f7bd6a1f` (le test de la garde
passive passait à vide — la mutation 1 l'a montré). **33 candidats lus,
28 masqués** : 17 étaient proposés et calculés comme des dégâts — **16
étaient le sort par défaut**, dont le bouclier de Frieren —, 11 étaient
affichés refusés ; 5 laissés : 16113 et 16613 (leur prose décrit une
riposte qui inflige des dégâts), 12212 (Harmonia S3), 12215 (Vivachel S3)
et 20913 (passif d'Aya vent) déjà hors calcul faute de formule ; Bolverk
S3 (13111) entre dans la table. Preuve `controle-15c.md`.

**Rejoué par le pilote** : `tsc` 0 ; 1 733 vérifications ; build,
spec-lint, diff-check verts. Mutations de l'agent : 6, 57 et 1 échecs.
**Mutation du pilote** (un sort de la table affiché refusé au lieu d'être
masqué) : 56 échecs ; restauré. **Quatre des 14 verdicts par jugement relus
sur leur fiche** (2813 Force Field, 12512 Cry of Threat, 15607 Beneficial
Hammering, 24206 Floral Barrier) : bouclier ou buff seulement, les mots
« damage » / « attack » y décrivent les dégâts absorbés ou les attaques
ennemies → sans attaque, exact.

**Soumis à l'utilisateur (A.8)** : les 14 verdicts rendus par jugement ;
les 144 sorts à formule dont la prose ne dit ni « attack » ni « damage »
(la plupart frappent en jeu ; quelques-uns semblent vraiment ne pas
attaquer : Unleashed Fury 4210, Scroll Trap 13707/13709, Revive, Toad
Poison, Curse, Sleep Spell) — non touchés, liste au § 6 de la preuve.
**Réponse du 2026-10-03** : les 14 verdicts **confirmés** par l'utilisateur,
sur le nom, le monstre et la prose de chacun ; les 144 restent en attente.

#### Résultat du lot 15d — 2026-10-03

Agent `lot-j`. Trois commits : `b2d44b4d` (bornes : drapeau `inclusif?`
ajouté aux deux comparaisons de DEF, strictes par défaut ; Jaara 3216 et
Varus 2565 en strict comme leur prose et leur `note` ; Copper 7763 et
Guard Crush 15907, 15908, 15910 reçoivent `inclusif: true` et ne changent
pas ; Jaara et Varus affichaient « ignore DEF », ils affichent « critique
garanti si la DEF cible < … » ; test `testBornesStrictesDef`), `292716c2`
(Byungchul : 18603 et 18608 dans `CRITIQUES_GARANTIS_INCONDITIONNELS`, sur
la prose du passif 18613 ; Yuji et Rick : les S2 20107, 20108, 20110,
20707, 20708, 20710 reçoivent « débuff sur la cible » avec critique
garanti, la réduction de DEF posée entre les coups — posée après le coup
1, elle rend le coup 2 seul critique, par `setupsAvantChaqueCoup` qui
existait ; `resumeCondition` lit l'effet de l'entrée) et `aa052b63` (test
des bornes inclusives mesuré contre une DEF nulle). Liste des monstres :
hashes inscrits par le pilote (`8273c433`). Totaux témoins (1 000 ATQ,
100 % de Dgts Crit, « Non critique ») : Byungchul S1 1 458,4 → 2 916,8 ;
Yuji vent, réduction posée après le coup 1, 848,5 → 1 272,8 ; Jaara à
l'égalité 4 677,6 → 2 291,0 ; Varus à l'égalité 2 708,0 → 1 326,4 ; Copper
et Guard Crush inchangés. Preuve `controle-15d.md` (167 lignes).

**Rejoué par le pilote** : `tsc` 0 ; 1 507 vérifications ; build,
spec-lint, diff-check verts. Mutations de l'agent : 6, rouges. **Mutation
du pilote** (borne non stricte par défaut) : 2 échecs dans
`testBornesStrictesDef` (« DEF cible égale… : aucune garantie ») ;
restaurée — un premier lancement sans ce filtre l'avait laissée verte.
**Écarts** : liste figée des effets entre les coups complétée
(`auditdegatsconditionnels`) ; les tests « 204 — Copper » et « 205 — Guard
Crush » avaient la même faiblesse que celle corrigée en `aa052b63` →
renforcés par 15a. **Question pour l'utilisateur (A.8)** : la réduction de
DEF du coup 1 de Yuji et Rick baisse-t-elle aussi la DEF du coup 2 ? (non
modélisé ; l'autre lecture donnerait 2 231,3 au lieu de 1 272,8 sur le
témoin). **À l'œil (A.8)** : un cadre des poses entre les coups s'affiche
sur les six S2.

#### Résultat du lot 15e — 2026-10-03

Agent `lot-j`. Deux commits : `6c2b593e` — Flash Step 19014 (Ciri 29314,
29304 †) et Turning Slash 19414 (Birgitta 29714, MOS 29704 †) : `stacks`,
`spdFlat: 50`, `max: 5` (prose « by 50 each, up to 250 », donnée 50 et
note « Up to 250 ») ; `testProseStatsCombat` suit (inventaire 38/40/80 →
40/42/84, 19014 et 19414 dans les exclusions déduites des blocs) ;
`404472a3` — Summary Justice 23515 (Theonia 34215, 34205 †) :
`atkCibleSousAtkPropre`, `ratio: 1`, `pct: 100`, borne stricte ; le champ
« ATQ adverse » existe déjà (`DamageSetupCard.tsx` L1427-1438, ouvert par
`demandeAtkCible`). Tests `testVitCiriBirgitta`, `testTheoniaAtqCible` ;
`conditions-et-audit.md` ; liste des monstres (hashes inscrits par le
pilote, `860e8fcf`). Totaux témoins : S1 de Ciri et Birgitta à 5 cumuls
2 056,44 → 3 038,55 (exactement le score d'un build à VIT 450) ; Theonia
S3 contre une ATQ ennemie de 999 : 1 832,84 → 3 665,68 (×2), contre 1 000
inchangé. Preuve `controle-15e.md` (151 lignes).

**Rejoué par le pilote** : `tsc` 0 ; 2 261 vérifications ; build,
spec-lint, diff-check verts. Mutations de l'agent : 12, 4, 9 et 35 échecs.
**Mutation du pilote** (Theonia `pct` 100 → 50) : 7 échecs ; restaurée.
**Pas fait** : la clause VIT de Theonia (« Attack Speed lower than yours »,
`quantite: null`, relevé) ; la hausse du passif selon les PV de la cible.
**À trancher (A.8)** : `enemyAtk` absent d'une ancienne recette vaut 0, ce
qui allume le +100 % alors que le champ affiche 1 000 (comportement
existant de Kassandra et Eleni, gardé) ; libellés « Cumuls de Flash Step »
et « Cumuls de Turning Slash ». **À l'œil (A.8)** : le compteur de Ciri et
de Birgitta sans en-tête ni prose (déjà sous « Passifs offensifs ») ; le
champ « ATQ adverse » ouvert sur Summary Justice.

#### Résultat du lot 15a — 2026-10-03

Agent `lot-c`. Quatre commits, **349 contrôles** dans
`tests/degats-couverture-livraisons.test.ts` (six fonctions), aucun code de
production : `35541133` garanties de critique (151 contrôles, 22
identifiants), `30b16a1a` bonus de critique propres (14 contrôles : 287,
289, 293, 303, 304), `cdd40fca` ignore DEF (49 contrôles, 15 identifiants),
`4616dab1` partie 2 (135 contrôles, 53 identifiants) ; libellés corrigés
(« 96 — Elsharion » ×3 → 97 ; « 209 — Triss » ×2 → 214, le vrai 209 Bombay
a son contrôle) ; « 204 — Copper » et « 205 — Guard Crush » renforcés
(total au seuil = total à DEF nulle). **Suivi** : 59 lignes « implémenté et
vérifié » ajoutées (82 → 141), état d'avant conservé ; non inscrits, faute
de livraison complète : 72 (Torrent), 96 (Carlos), 123 (Thunderer), 200
(Fei coup par coup). Aucune livraison trouvée fausse. Preuve
`controle-15a.md`.

**Rejoué par le pilote** : `tsc` 0 ; 2 298 vérifications ; spec-lint,
diff-check verts. **Les mutations, que l'outil avait refusées à l'agent
(édition de `damage.ts`), faites par le pilote** : une entrée retirée par
famille (2763, `Fire Wall`, 15714, 6314 et 6511) → 15 échecs, chacun sur
son contrôle (278 Anduril, 303, 208 Shun, 91 Judge, 249 Liesel) ;
restaurées. `suivi-implementation.md` mis à jour par le pilote (141
lignes, section « Réconciliation du lot 15a ») : le ledger et son CSV
disent la même chose. **Écart** : l'agent a utilisé `sed -i` pour
`tests/index.ts` et les imports du test (consigne enfreinte, diff conforme).
**Toujours sans test, hors périmètre** : 2713, 3113, 12410, 8301 à 8305,
1879, le refus de `aliveEnemies: 0`.

### Lot 15 (suite) — 15f et 15g, décisions du 2026-10-03

**Décisions de l'utilisateur du 2026-10-03** (A.8) : la réduction de DEF
posée par le 1er coup de la S2 de Yuji et Rick baisse aussi la DEF que subit
le 2e coup ; une recette sans `enemyAtk` prend la valeur affichée par
l'écran (1 000) ; les 144 sorts du § 6 de `controle-15c.md` sont passés en
revue maintenant. Règles du lot 15 : un Résultat cité, la liste du lot LM
dans le même commit, la mutation après le commit (A.8).

#### 15f — Yuji et Rick : DEF du coup 2 ; ATQ ennemie absente = valeur affichée

**Cat. C, agent `lot-c`, worktree du chantier.** Deux commits, un par
décision.

1. **Yuji et Rick.** `effetCombat: 'defBreak'` sur les six entrées 20107,
   20108, 20110, 20707, 20708, 20710 de `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS`
   (`damage.ts`, vers L2645-2650), comme les cinq sorts « decrease-def »
   indexés par nom (vers L2607-2627) ; le commentaire de la table dit la
   décision du 2026-10-03 au lieu de « ni relevé ni décidé ». Le test
   `garantieyujirick` attend, pour le témoin Yuji vent (20108) avec la
   réduction posée après le coup 1, **2 231,2793** (total de la mutation M2b
   de 15d, `controle-15d.md`, « Totaux témoins ») ; sans scénario, rien ne
   change (848,5363). La section de `spec/outils/degats-reels/conditions-et-audit.md`
   qui décrit ce cas est mise à jour ; six lignes de la liste (Yuji ×3,
   Rick ×3).
2. **ATQ ennemie absente.** `conditionCombatActive` lit `setup.enemyAtk ?? 0`
   (`damage.ts`, vers L1327) alors que l'écran affiche
   `DEFAULT_DAMAGE_SETUP.enemyAtk` (1 000, `DamageSetupCard.tsx` vers
   L1431) : le moteur prend la valeur de l'écran. `grep -rn enemyAtk src/
   scripts/ tests/` avant et après (la recette a plusieurs constructeurs,
   CLAUDE.md) : tout lecteur à un autre défaut est aligné ou justifié dans
   la preuve. Test : recette sans le champ, ATQ du build 900 → condition
   éteinte ; 1 200 → allumée ; résultats identiques à une recette qui porte
   1 000. Spec et liste : chaque monstre dont la condition est
   `atkCibleSousAtkPropre` (Theonia, Kassandra, Eleni, à recompter par
   `grep`).

**Preuve privée :** `controle-15f.md` et `controle-15f-intrants/` — totaux
témoins avant / après, sorties de `grep`, mutations de l'agent (une entrée
sans `effetCombat` ; le défaut `?? 0` remis) et leurs échecs.
**Vérifications :** `npx tsc --noEmit`, `node tests/run.mjs` sur les
contrôles touchés (`garantieyujirick` et ceux de Theonia), `npm run build`,
`spec-lint`, `git diff --check`.
**Ne fait pas :** les libellés « Cumuls de… » (en attente, A.8) ; aucun
autre sort « decrease-def » ; aucune autre valeur par défaut de la recette.

##### Résultat du lot 15f — 2026-10-03

Agent `lot-c`. Deux commits : `616e09a1` — `effetCombat: 'defBreak'` sur
les six entrées de Yuji et Rick, commentaire de la table réécrit, test
`garantieyujirick` (Yuji vent 20108, pose après le coup 1 : 1 272,8044 →
**2 231,2793** ; sans scénario 848,5363 inchangé), spec
`conditions-et-audit.md`, six lignes de la liste ; `372168cd` —
`conditionCombatActive` lit `setup.enemyAtk ?? DEFAULT_DAMAGE_SETUP.enemyAtk!`
(seul lecteur du moteur ; tous les constructeurs de la recette passent par
lui), test `theoniaatqcible` étendu. Reçu de l'agent `372168c` ↔ `2b8ba2a`.

**Écart au contrat, accepté** : **quatre** monstres à condition
`atkCibleSousAtkPropre`, pas trois — Zaiross (2912, « Fiery Breath », seuil
inclusif à 50 % de l'ATQ, critique garanti) s'ajoute à Theonia, Kassandra
et Eleni ; couvert par le test et la liste. Recette sans `enemyAtk`, ATQ
900 : Theonia 3 299,1090 → 1 649,5545 ; Kassandra et Eleni 1 548,7484 →
1 191,3449 ; Zaiross 3 578,3305 → 1 216,1646 ; chaque « après » égal au
total avec 1 000. À 1 200, seul Zaiross change (4 771,1073 → 1 621,5528).

**Rejoué par le pilote** : `tsc` 0 ; `garantieyujirick` + `theoniaatqcible`
102 vérifications ; build, spec-lint, diff-check verts. Mutations de
l'agent : 3 et 8 échecs. **Mutations du pilote**, distinctes : la seule
branche inclusive remise à `?? 0` → 2 échecs (Zaiross) ; `effetCombat`
retiré de Rick ténèbres 20710 → 2 échecs ; restaurées. Hachages inscrits
dans la liste par le pilote.

**Relevé, non traité** : commentaire périmé vers L1906 de `damage.ts`
(« aucun champ `enemyAtk` », Almighty Strength) → au premier lot P qui
touche cette zone ; vider le champ « ATQ adverse » écrit 0 et allume la
condition (cohérent avec ce que montre le champ).

#### 15g — revue des 144 sorts à formule sans « attack » ni « damage »

**Cat. J, conduit par le pilote avec l'utilisateur, notes seules, aucun
commit de code.** Demande de l'utilisateur du 2026-10-03 : les cas lui sont
soumis **dans la conversation, par blocs de 10** — pas d'agent. Le pilote
prépare chaque bloc (contrat ci-dessous, verdict proposé), l'utilisateur
tranche, et son verdict est inscrit dans la preuve bloc par bloc.

**Intrant :** `controle-15c.md` § 6 (L126-139) et
`controle-15c-intrants/03-sortie.txt` (sélection des 144, extraite par
script) ; `04-etat.ts` du même dossier comme modèle de lecture de l'état de
production ; fiches `public/data/skills/<forme>.json` (prose, effets,
note) et `public/data/monsters.json` (noms, éléments) ; A.2 ter, « Une
attaque se lit dans la prose ».

**Contrat :** une ligne par sort — identifiant · nom du jeu · monstre(s) et
élément, formes † dites · slot · formule · **état actuel à l'écran**, lu
par le moteur (proposé ; coché par défaut ; refusé « Formule non prise en
charge… » ; déjà masqué) · verdict **frappe** / **sans attaque** / **doute**
· la phrase de la prose qui décide, citée · **verdict de l'utilisateur**.
Le verdict proposé : « frappe » exige une phrase qui dit un coup porté à
l'ennemi (le verbe exact cité : strike, hit, shoot, slash, inflict…),
jamais l'implicite ; aucun coup dit → « sans attaque » ; prose ambiguë, ou
contredite par les effets ou la note → « doute ». Chaque bloc montre à
l'utilisateur le nom, le ou les monstres, l'état actuel, la prose complète
et le verdict proposé, sous la forme des 14 de 15c.

**Preuve :** `controle-15g.md` et `controle-15g-intrants/` (script,
sortie) ; 144 lignes, le compte de chaque verdict mesuré par script.
**Livraison :** `livrer` par le pilote quand la revue est finie ;
l'inscription bloc par bloc ne touche que la preuve privée.
**Ne fait pas :** aucun masquage (lot 15h, après confirmation de la liste
par l'utilisateur) ; ni `damage.ts` ni la liste du lot LM.

##### Résultat du lot 15g — 2026-10-03

Six blocs soumis dans la conversation, verdict de l'utilisateur sur chacun
(réponses citées dans la preuve) ; preuve `controle-15g.md` (235 lignes) et
`controle-15g-intrants/` (scripts, état avant, `verdicts.json`). Sur les
144 : **55 jouables — 47 gardés, 8 masqués** ; 14 sorts de formes † gardés
par le verdict de leur jumeau de même nom ; 10 sorts de vrais monstres non
éveillés montrés et gardés ; 65 sorts d'entités qu'aucun compte ne peut
posséder (tours, cristaux, boss de raid, tutoriel, unités de collaboration)
inchangés — traitement des 89 accepté par l'utilisateur. **À masquer** :
2113 Regenerate (Lukan), 2611 Revive (Mikene), 2615 Dark Return (Tilasha),
4210 Unleashed Fury (Zeratu), 6713 Soul Revival (Michelle), 6714 Light of
Revival (Iona), 13707 et 13709 Scroll Trap (Jeogun, Hanwul). Précision de
la règle portée en A.2 ter (Sleep Spell, Ice Ball) ; Sleep Spell garde le
ratio de la donnée (« utilise le ratio que tu as ») ; bombes posées seules
confirmées comptées.

#### 15h — les 8 sorts sans attaque confirmés en 15g, masqués

**Cat. C, agent `lot-c`, worktree du chantier.** Un commit.

**Contrat :** les huit identifiants ci-dessus ajoutés à
`SORTS_SANS_ATTAQUE_PAR_ID` (`damage.ts`, vers L2875), chacun avec sa prose
citée en commentaire comme les entrées de 15c, et la mention « confirmé par
l'utilisateur, lot 15g » ; le test `degats-sorts-sans-attaque` couvre les
huit (absents de `monsterDamageSkills` pour chaque forme qui les porte ; le
sort par défaut de Lukan, Zeratu et Michelle devient un sort qui frappe, à
nommer dans le test) ; spec qui décrit la table (`grep -rn
SORTS_SANS_ATTAQUE spec/`) ; liste du lot LM : une ligne par sort dans la
section de chaque monstre jouable, « Vérifier à l'écran » concret.
**Preuve privée :** `controle-15h.md` — état avant / après par forme
(`controle-15g-intrants/04-lancer.mjs` sur les huit identifiants), mutation
après le commit (une entrée retirée → le test échoue) et sa sortie.
**Vérifications :** `npx tsc --noEmit`, `node tests/run.mjs sortssansattaque`,
`npm run build`, `spec-lint`, `git diff --check`.
**Ne fait pas :** aucun autre sort ; aucun changement de règle.

##### Résultat du lot 15h — 2026-10-03

Agent `lot-c`. Un commit, `53668cc2` : huit entrées dans
`SORTS_SANS_ATTAQUE_PAR_ID` (prose citée, « confirmé par l'utilisateur, lot
15g »), test `degats-sorts-sans-attaque` (les huit absents sur les 20 formes
qui les portent ; nouveaux sorts par défaut nommés : Lukan → Sandstorm
2108, Zeratu → Trample 4205, Michelle → Absorb Mana 6703), spec
`formules-et-combat.md` (table de 28 à 36 sorts), huit sections de la liste
(plus la ligne des doutes, « 36 sorts », corrigée dans le même commit).
Reçu de l'agent `53668cc` ↔ `47eb7e6`.

**Rejoué par le pilote** : `tsc` 0 ; `sortssansattaque` 272 vérifications ;
build, spec-lint, diff-check verts. Mutation de l'agent (2113 retiré) : 5
échecs. **Mutation du pilote**, distincte (13709, un sort proposé sans être
le sort par défaut) : 4 échecs ; restaurée. Hachage inscrit dans la liste
par le pilote.

### Lots Q1 et Q2 — le questionnaire du reliquat

**Cat. J, agents `lot-j`, lots parallèles, notes seules.** Sans code, ils
n'ont pas de worktree : ils lisent le worktree du chantier sans y écrire et
déposent leur preuve dans `sw-forge-lot-q1-notes\notes` et
`sw-forge-lot-q2-notes\notes` (A.8), que le pilote recopie. Décision du 2026-10-03 (D65) : le
reliquat se traite dans ce chantier. Ses 74 questions — 10 valeurs de jeu
(Q01-Q10, plan § 5.1) et 64 décisions (D01-D64, § 5.2) — sont rédigées pour
un joueur, afin que l'utilisateur réponde en une fois (« recommandations
retenues sauf n° … », comme pour les seize choix d'interface). Q1 : Q01-Q10
et D01-D32 ; Q2 : D33-D64.

**Intrant :** le plan, §§ 3, 5 et 6 (L90-113, L261-401) ; pour chaque
question, sa source dans la preuve 13b citée par la colonne « Origine »
(`controle-13b-<famille>.md`, par `grep` puis plage, jamais en entier) et la
ligne d'A.2 ter citée ; les fiches pour la prose.

**Contrat, par question :** numéro inchangé ; monstre(s) et sort(s) (nom du
jeu, identifiant) ; la prose utile citée mot pour mot ; la question dite en
termes de joueur — ce que l'écran montre ou calcule selon la réponse, jamais
un nom de mécanisme du code, un cran nommé par la question du joueur ; 2 à 4
options avec leur conséquence concrète ; la recommandation du plan et sa
raison ; le lot P qu'elle débloque. Une question déjà tranchée par A.8 ou
A.2 ter n'est pas reposée : elle est signalée, avec la citation, pour que le
pilote la retire. Une question qui ne se rend pas compréhensible sans le
code est signalée, jamais reformulée au jugé.

**Sortie :** `controle-q1.md`, `controle-q2.md` ; le pilote assemble
`decisions/questionnaire-reliquat-2026-10.md` après validation.
**Preuve :** chaque citation de prose retrouvée par script dans sa fiche
(sortie jointe) ; compte des questions (42 et 32).
**Ne fait pas :** ne répond à aucune question ; ne touche ni le plan ni le
code ; ne rédige pas la demande de relevés (§ 4 du plan), qui suit les
réponses — certains relevés tombent avec elles.

#### Résultat des lots Q1 et Q2 — 2026-10-03

Deux agents `lot-j` en parallèle, aucune écriture dans le worktree du
chantier ; preuves recopiées par le pilote dans le dossier de preuves :
`controle-q1.md` (566 lignes, 42 entrées : 37 rédigées, 4 à retirer, 1 non
rendue ; 59 citations de prose retrouvées) et `controle-q2.md` (725 lignes,
32 entrées : 29 rédigées, 3 à retirer ; 58 citations retrouvées). Scripts de
vérification rejoués par le pilote depuis le dossier de preuves : OK, OK ;
spec-lint sans erreur. Entrées relues par sondage (D01-D08, D33, D63,
retraits) : lisibles sans le code, prose citée, conséquence à l'écran dite.

**Décisions du pilote sur les retraits proposés** : retirées D15, D24, D26
(tranchées par A.2 ter L148, L152 et par D65), D37 (prose de Nobara vent
identique mot pour mot à celle d'Aya vent, nommée par A.2 ter L170 —
signalé à l'utilisateur), D64 (P26 placé ici par D65) ; Q02 réduite aux
lignes 400-403/410 ; D11 (choix de construction) au contrat de P6. **Q04 et
D35 restent posées** : la prose seule ne suffit plus à écarter une attaque
(précision d'A.2 ter du 2026-10-03). Corrections portées au plan : D08 porte
sur Hwoarang et Taebaek **ténèbres** (le plan disait « feu ») ; D63 précisé,
six identifiants d'ignore DEF permanent (13406, 13410, 15511, 13611, 7713,
6013), pas « cinq ».

**Écart au contrat, accepté** : pas de fichier assemblé
`decisions/questionnaire-reliquat-2026-10.md` — l'utilisateur reçoit les
questions dans la conversation, par blocs de 10 (comme les 144 de 15g) ; les
deux preuves sont le questionnaire, et chaque réponse est inscrite dans la
colonne « Recommandation » du plan, § 5.2, puis en A.8.

**Signalé par les agents, à dire à l'utilisateur avec chaque bloc** : sans
recommandation applicable dans le plan, D13, D22, D33, D38, D41, D53, D61,
D62 demandent une réponse explicite ; recommandation contestable pour D04
(prose de Bella inconditionnelle), D07 (Hwa déjà « sur interrupteur »), D12
(l'API comme source inclut les Anges jumeaux de Q04).

### Lots P1 à P26 — le reliquat de l'audit

Décision du 2026-10-03 (D65). Les lots du plan (§ 6, L348-401) deviennent
des lots de ce chantier sous leur nom (P1 à P26, 33 avec les scissions a,
b, c). **Le contrat de chacun est écrit par le pilote au lancement**, à
partir de sa ligne du plan, des Résultats 13b qu'elle cite et des plages de
`damage.ts` relevées à l'instant (elles ont bougé pendant 15a-15f) ; il
s'ajoute ici, suivi de son Résultat. Ordre : P1, P4, P2 (prêts ; un à la
fois dans le worktree du chantier, ils touchent tous `damage.ts`) ; P3 et
P10 dès que leur forme d'interface est montrée et acceptée ; les autres dans
l'ordre des réponses et des relevés revenus. Règles du lot 15 : liste du lot
LM dans le même commit, mutation après le commit.

**Ne fait pas :** un lot P ne démarre jamais avant ses prérequis (colonne
« Prérequis » du plan) ; aucune valeur de jeu supposée.

#### P1 — garde-fous sans valeur de jeu

**Cat. C, agent `lot-c`, worktree du chantier.** Plan § 6, ligne P1 (SP-0,
PV-T, SPC-5) ; aucun prérequis. Un commit par raison.

1. **Garde des clés de `STATS_COMBAT_PAR_ID_CONNUS`** (SP-0,
   `controle-13b-stats-passifs.md` § 7) : un test nommé « chaque clé est un
   identifiant du corpus porté par au moins une forme jouable » ; modèle
   cité par la preuve.
2. **16113 et 16613** (PV-T, `controle-13b-pertes-pv.md` L242, DH-08
   L287) : leur `formule` `0.15*{MAX HP}` est un bouclier. ⚠️ Le lot 15c les a
   laissés hors de `SORTS_SANS_ATTAQUE_PAR_ID` parce que leur prose dit des
   dégâts en riposte. Le lot **établit l'état actuel** (le bouclier
   est-il compté quelque part comme des dégâts ?) et fige par un test le
   seul comportement juste : le bouclier jamais compté. S'il est compté
   aujourd'hui, arrêt et rapport (A.6), sans correction.
3. **Clés par nom qui débordent sur un homonyme** (SPC-5,
   `controle-13b-stats-passifs-corpus.md` DH-02 L472 ;
   `controle-13b-critiques-bonus-tc-dc.md` DH-01 L259 ;
   `controle-13b-declenchee-voisins.md` DH-03 L240 ; `controle-13b-pertes-pv.md`
   DH-09 L288) : « Tiger's Appearance (Passive) » → 6163 ; « Charge
   (Passive) » ; « Rending Claw » → 23306 / 23310 ; aucune entrée par nom
   pour « Camouflage (Passive) » (4714 contre 8715). Pour chaque clé : un
   script liste **tous** les identifiants que le nom atteint aujourd'hui,
   avec forme, jouabilité et prose ; la clé passe par identifiant sur ceux
   dont la prose porte l'effet, et la preuve dit ce que perd chaque
   homonyme (aucune forme jouable ne doit changer de total, mesuré avant /
   après).
4. Le commentaire périmé « aucun champ `enemyAtk` » (vers L1906, relevé au
   lot 15f) est corrigé.

**Preuve privée :** `controle-p1.md` et `controle-p1-intrants/` (sorties
`.txt`, aucun `.md`) ; mutation après chaque commit de code. Liste du lot LM
seulement si un total ou un affichage jouable change (attendu : aucun).
**Vérifications :** `tsc`, contrôles touchés par `node tests/run.mjs`,
build, spec-lint, diff-check.
**Ne fait pas :** aucune valeur de jeu ; aucun autre homonyme que ceux
cités (les autres vont à P4 et P5a).

##### Résultat du lot P1 — 2026-10-03

Agent `lot-c`. Quatre commits : `8db128c7` — garde des clés de
`STATS_COMBAT_PAR_ID_CONNUS` (**40** clés, pas 38 : toutes portées par une
forme jouable) ; `c318918e` — 16113 / 16613 : le bouclier n'est compté
nulle part aujourd'hui (aucun sort ni passif offensif à ces identifiants,
`skillDamageProfile` nul), un test le fige ; `65cef592` — « Tiger's
Appearance » et « Charge » passent par identifiant (6163 Naomi 2A, 1865
Gorgo) : 6113, 6178 et 1880, portés seulement par des formes non jouables,
ne les reçoivent plus ; `61351084` — commentaire « aucun champ `enemyAtk` »
corrigé. Totaux jouables mesurés avant / après : 68 totaux de 9 formes,
identiques ; l'empreinte des 3 073 fiches ne change que sur 4 formes non
jouables. Liste du lot LM non touchée (aucun changement jouable). Reçu de
l'agent `6135108` ↔ `95d93c4`.

**Arrêté selon le contrat, remis à l'utilisateur** : « Rending Claw »
(`BONUS_CONDITIONNEL_PROPRE_CONNUS`, +50 % sous Mechanical Frame State)
atteint 23306 (Cecilia), 23307 (Cynthia) et 23310 (Elise) ; seule la fiche
de Cynthia porte Emergency Drive (« While in the mechanical frame state, …
deal 50% increased damage ») — vérifié par le pilote sur les trois kits.
Restreindre la clé à 23307 retire un bouton jouable à Cecilia et Elise
(1 471,68 → 981,12 sous interrupteur) : question posée en A.8.

**Rejoué par le pilote** : `tsc` 0 ; `auditdegatsconditionnels` + `degats`
1 632 vérifications ; build, spec-lint, diff-check verts. Mutations de
l'agent : cinq, toutes rouges. **Mutation du pilote**, distincte (clé de
Gorgo déplacée sur 1866) : 3 échecs ; restaurée.

#### P4 — effets posés entre les coups, par identifiant (constat 322)

**Cat. C, agent `lot-c`, worktree du chantier.** Plan § 6, ligne P4 (EEC-1,
`controle-13b-effets-entre-coups.md` § 3 L63-76, § 4 L100-107, § 7 L163) ;
aucun prérequis pour 13 identifiants. Un commit.

**Contrat :** une entrée `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS` par identifiant,
**jamais par nom** (Sia : 15 homonymes « Blackout Kick » au texte différent)
— 10413 Cichlid, 12608 Melissa, 13606 / 13607 / 13610 (Barbara, Masha,
Xiana : réduction de DEF du coup de la bête), 15507 / 15508 / 15509
(Carlos, Dominic, Benedict : Marque), 17507 / 17509 (Eivor), 3454 (Sia),
25206 / 25210 (Übel) — chacune avec l'effet de la donnée (`Decrease DEF` →
`effetCombat: 'defBreak'`, `Brand` → `'brand'`) et sa citation (note ou
prose) ; un test par entrée (sans scénario : total inchangé ; effet posé
après le coup qui le pose : total du témoin de la preuve, `sortie-04-sonde.txt`) ;
l'ensemble figé des tests d'audit mis à jour ; `conditions-et-audit.md`
(L56-73 au commit de la preuve) ; liste du lot LM, une ligne par sort jouable
(le cadre des poses entre les coups apparaît sur ce sort).
**Ne fait pas :** Solveig et Berghild (18007, 18009 : la Marque n'est que
dans la prose, relevé R9) ; le sélecteur « après le coup n » qui offre un
coup qui ne pose rien (Cichlid pose au coup 2 : décision D21, questionnaire) ;
Barbara 13611 (ignore DEF, P11) ; aucun buff sur soi (constat 323, P12a).
**Preuve privée :** `controle-p4.md` et `controle-p4-intrants/` (sorties
`.txt`) ; totaux avant / après par le chemin recette → objectif ; mutation
après le commit.
**Vérifications :** `tsc`, `node tests/run.mjs auditdegatsconditionnels
degats`, build, spec-lint, diff-check.

### Lot 14 — clôture

**Cat. M.** Depuis la décision du 2026-10-03 (D65), la clôture suit les lots
P1 à P26, ou le report nominatif de ceux que l'utilisateur décide de sortir
du chantier.

**Déroulé :** 1) vérifier les preuves et tests ciblés de tous les lots, le lint
et l'absence de décision bloquante ; 2) réconcilier le suivi d'audit et les
entrées de `pistes.md` avec leurs sources : dettes de découpage, plan du lot 13,
familles reportées et passifs non curés, et les deux pistes ouvertes par
6bis-b8 — le top approximatif en mode relique « recherche », et le coût de
la file d'artéfacts (~8 à 10 % dans un montage Node, jamais vérifié au
navigateur), que ce chantier ne traite pas : décision de l'utilisateur du
2026-10-01, la transmettre nommément à un chantier dédié, ouvert sur sa
décision ; corriger dans `invariants.md` le
nom `pair-slice-worker.ts` en `src/workers/pairSlice.worker.ts` ; 3) une fois ces contrôles passés,
statut du cadrage → `CHANTIER terminé le <date>` et ligne de `spec/README.md`
mise à jour ; 4) `chantier livrer` → `verifier` → `integrer` du résultat final.
Les notes des lots précédents ont déjà été intégrées après leur validation.

**La suite complète `npm test` est réservée à la fusion sur `main`**, qui
n'est pas réalisée par ce lot. La clôture du travail n'atteste pas une fusion
ni l'exécution de cette suite ; l'intégrateur la lance sur le résultat combiné.

⚠️ **Un ledger et le fichier qu'il référence se mettent à jour ensemble**
(CLAUDE.md) : chaque entrée de `pistes.md` ouverte ici pointe un fichier dont
le statut dit la même chose.

**Preuve privée :** `controle-14.md`, récapitulatif des contrôles ciblés,
de leur révision et du lint. Finaliser cette preuve → `livrer` → `verifier`
→ inscrire reçu et sorties dans le résultat public de ce lot. Aucun nouveau
`livrer` après cette inscription publique. La sortie de `verifier` ne se
recopie jamais dans le fichier privé dont le reçu vérifie le contenu.

**Ne fait pas :** ne fusionne pas dans `main`. Cette branche ne rejoint `main`
qu'avec ou après `forge/implementation-relique` (A.5), et la fusion est une
décision de l'utilisateur, jamais du lot.
