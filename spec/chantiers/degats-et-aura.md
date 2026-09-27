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
| Zeratu — Forbidden Power | L'utilisateur choisit 1, 2 ou 3 attaques, défaut 3. Les attaques 2 et 3 valent chacune 50 % du ratio initial : trois attaques valent `100 % + 50 % + 50 % = 200 %` | utilisateur, confirmation explicite du 2026-09-24 |
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

Les notes du chantier `implementation-relique` **avancent encore** :
`chantier rafraichir --chantier degats-et-aura` à chaque fois qu'il intègre,
rien ne le signale.

**Fichiers transverses portés par CE chantier** : `App.tsx` peut recevoir au
lot 5 le changement ciblé qui distingue import de compte et changement
d'espèce. `package.json`, `tsconfig.json`, `tailwind.config.js` ne sont pas
touchés (ni page ni section ajoutée ou renommée).
`ARCHITECTURE.md` ne reçoit au lot 2b que les corrections de références
effectivement présentes, si l'aperçu en trouve. Dérogation utilisateur du
2026-09-24 : la procédure Codex Windows dans `CLAUDE.md` et les adaptateurs
de skills manquants sont corrigés dans un commit transverse distinct des lots
de mécanique, après le constat de blocage au lot 3.

**Ne pas toucher** : `spec/outils/optimizer/reliques.md` (propriété de
`forge/implementation-relique`). Un besoin dessus se signale, il ne se force
pas.

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
        → amendement et revue pilote → 6bis-b-* → 7
                            (inventaire, cartographies bornées, réconciliation,
                            puis contrats d'implémentation ; l'écran 7 attend
                            tous les sous-lots validés)
8, 9, 10 → 12              (12 éprouve les mécanismes qu'ils livrent)
1f, 11, 12 → 13a → amendement et revue pilote → 13b-*
                            (chaque contrat créé avant son exécution)
3, 4, 5, 6, 6bis-a1, 6bis-a2a1-contexte, 6bis-a2a1-suite,
  6bis-a2a1-suite-correction-stats-chain,
  6bis-a2a1-suite-finalisation-preuve, 6bis-a2a2,
  6bis-a2b1, 6bis-a2b2, 6bis-a2b3, 6bis-a3a, 6bis-a3b,
  6bis-a4a, 6bis-a4b, 6bis-a4c1, 6bis-a4c2, 6bis-a4d1, 6bis-a4d2,
  tous les 6bis-b-*, 7, 12, tous les 13b-* → 14
```

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
| 6bis-a3a — conditions et élagages locaux | C | à lancer | — |
| 6bis-a3b — recherche, diagnostics et filtre final | C | en attente de a3a | — |
| 6bis-a4a — recette, reset et import écran | C | en attente de a3b | — |
| 6bis-a4b — CLI et scripts de diagnostic | C | en attente de a4a | — |
| 6bis-a4c1 — écran de recherche et caches | C | en attente de a4b | — |
| 6bis-a4c2 — cartes de résultat et autres affichages | C | en attente de a4c1 | — |
| 6bis-a4d1 — Workers et tests | C | en attente de a4c2 | — |
| 6bis-a4d2 — réconciliation des cartes | C | en attente de a4d1 | — |
| 6bis-b-* — correction du modèle par sous-lots bornés | J | non lançables avant amendement et revue | — |
| 7 — sets d'aura : l'écran | J | à faire | — |
| 8 — Blade Surge : le 3ᵉ coup en zone (8 identifiants / 11 formes de corpus) | J | à faire | — |
| 9 — Teshar : Tempest après S1/S2 et comme sort (1 identifiant / 2 formes ; 81 de même architecture) | J | à faire | — |
| 10 — ignore DEF conditionnel des Blade Dancers (6 identifiants / 12 formes de corpus, deux variantes) | J | à faire | — |
| 11 — prose et exactitude des passifs « Stats acquises en combat » (inventaire 38/40 ; correctif 30/32) | C+J | à faire | — |
| 12 — les trois mécanismes rejoués sur des cas indépendants | C | à faire | — |
| 13a — extraction et réconciliation du reliquat (243 constats hors chantier) | C | à faire | — |
| 13b-* — contrats de qualification à créer par le pilote après 13a | J | non lançables avant amendement et revue | — |
| 14 — clôture et ledgers après contrôles | M | à faire | — |

**Avant le lot 0 : la revue adversariale.** Au moins deux tours, par une
session qui **n'a pas écrit** ce document, munie de la checklist C du skill
`cadrage-chantier` et de trois questions par lot : *l'intrant est-il borné ? la
preuve est-elle un artefact ? l'outil qu'il utilise existe-t-il déjà à ce
numéro ?* ⚠️ **Elle est conduite par l'utilisateur**, qui la soumet lui-même
(décision du 2026-09-23) ; le prompt de revue lui est fourni sur demande. Une
revue qui ne trouve rien au premier tour n'a pas lu le graphe.

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

**Sortie :** carte a3b, liens vers a2 et a3a, plus inventaire des tests
différentiels nécessaires aux futurs 6bis-b-*. **Ne fait pas :** ces tests,
benchmark ni correction du moteur.

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
`carte-6bis-a4d2.json` consolide coordonnées, runes connues ou
non, cache, tests, incertitudes et scénarios Intangible. `controle-6bis-a4d2.md`
porte commandes, sorties, longueurs, verdict CLI repris de a4b et les
seeds/tests à créer. Proposer des contrats **bornés** `6bis-b-*` ; le pilote
les inscrit dans A.7, les fait revoir et les valide avant tout lancement.

**Ne fait pas :** code, tests différentiels, benchmark ou implémentation du
modèle. Les lots `6bis-b-*` restent non lançables.

#### 6bis-b-* — correction du modèle, contrats à créer après 6bis-a4d2

**Cat. J ; gabarit non lançable en l'état.** Chaque contrat reprend un intrant
borné de la carte réconciliée 6bis-a4d2 et désigne ses producteurs,
consommateurs et preuves, sans
omettre ceux attribués à un autre sous-lot. Ensemble, ils livrent ceci :

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

**Ne fait pas :** aucun contrôle visuel d'aura (lot 7), aucun changement de
la règle de jeu d'Intangible ni des valeurs +8 de A.2 ter. Après tous les
sous-lots et avant le lot 7, revue technique indépendante des coupes sûres,
du double compte et de la parité des chemins ; objections corrigées et
preuves rejouées avant validation.

### Lot 7 — sets d'aura : l'écran

**Cat. J.** Requiert tous les lots 6bis-b-* validés et leur revue technique.
L'écran saisit les auras **externes** du modèle corrigé, jamais un total
incluant le build.

**Écart hérité du lot 6 à corriger ici :** `src/lib/effects.ts` affiche
« Précision alliés +10% » et « Résistance alliés +10% » pour Accuracy et
Tolerance. Aligner ces deux libellés et leurs usages visibles sur les
**+8 points** curés en A.2 ter ; vérifier les surfaces qui les consomment.
Ne pas modifier le calcul validé par les lots 6bis-b-*.

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

### Lot 8 — Blade Surge : le 3ᵉ coup, en zone

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

### Lot 9 — Teshar : Tempest après S1/S2, et comme sort

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

### Lot 10 — l'ignore DEF conditionnel des Blade Dancers

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

### Lot 11 — les passifs « Stats acquises en combat » : prose et Gold Headband

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

### Lot 13 — le reliquat de l'inventaire : un plan, pas une promesse

**Deux étapes : 13a (C), puis 13b (J, plusieurs sessions bornées).**
Requiert les lots 1, 11 et 12, y compris les corrections qu'exige le lot 12.
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
preuves des lots 1/8/9/10/11/12. Conserver un instantané des intrants et leur
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
   180 voisins de Blade Surge, les 16 autres constats de catégorie 09, les
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

### Lot 14 — clôture

**Cat. M.**

**Déroulé :** 1) vérifier les preuves et tests ciblés de tous les lots, le lint
et l'absence de décision bloquante ; 2) réconcilier le suivi d'audit et les
entrées de `pistes.md` avec leurs sources : dettes de découpage, plan du lot 13,
familles reportées et passifs non curés ; corriger dans `invariants.md` le
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
