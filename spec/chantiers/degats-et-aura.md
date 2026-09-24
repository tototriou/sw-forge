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
contexte entre monstres (5), les auras absentes des calculs de combat (6–7),
Blade Surge et Tempest incomplets (8–9), l'ignore DEF conditionnel (10), puis
la prose des passifs déjà calculés mais mal présentés (11).
Les constats détaillés et coordonnées de code sont dans chaque contrat.
Les valeurs curées fournies sont en A.2 ter ; le périmètre réel se mesure au
lot 1, sans confondre l'audit et le corpus. Le découpage documentaire précède
les modifications de `degats-reels.md` (2a/2b).

### A.2 Cible et périmètre

**Cible, en termes vérifiables :**

1. Les quatre sorts se calculent, avec pour chacun le réglage utilisateur
   décrit en Partie B et un test nommé dans `tests/`.
2. Les cinq sets d'aura sont saisissables dans « État de mon monstre »,
   entrent dans `statsDebutCombat`, dans les objectifs `degats_reels` et
   `ehp`, dans les calculs des passifs et des exclusives de relique. Un unique
   interrupteur autorise RES/PRE seulement dans les conditions min ET max ;
   les auras PV/ATQ/DEF ne participent jamais aux conditions.
3. Le contexte de combat survit à un changement de monstre ; ce qui désigne un
   sort précis ne survit pas.
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
| Plafond d'auras de l'équipe | **18 sets au total**, tous types confondus : certains contenus accueillent 6 monstres, avec 3 sets chacun (`6 × 3`) | utilisateur, correction de revue du 2026-09-23 |
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
5 → 6 → 7                  (les nouveaux champs suivent la politique du lot 5 ;
                            l'écran ne peut pas saisir ce que le modèle
                            n'accepte pas ; 6 ne dépend PAS de 1 — les valeurs
                            d'aura sont en A.2 ter, aucune famille à mesurer)
8, 9, 10 → 12              (12 éprouve les mécanismes qu'ils livrent)
1f, 11, 12 → 13a → amendement et revue pilote → 13b-*
                            (chaque contrat créé avant son exécution)
3, 4, 5, 6, 7, 12, tous les 13b-* → 14
```

L'ordre d'exécution est l'ordre des numéros, avec 2a puis 2b, et 13a avant
les sous-lots 13b-*. Les lots 3, 4, 5 viennent après 2b et avant les auras.

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
| 4 — relique « comme équipé » et les minimums | C→M | à faire | — |
| 5 — le contexte survit au changement de monstre | J | à faire | — |
| 6 — sets d'aura : le modèle | J | à faire | — |
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

### B.0 Champs traversants — contrat commun aux lots 6, 7, 8 et 10

Les noms ci-dessous sont fixés pour le chantier. Tout renommage exige un
amendement de cette table et le contrôle de propagation de l'ancien ET du
nouveau nom. `SetAura` désigne l'union des cinq clés du lot 6.

| Champ et emplacement | Type | Absent / défaut | Validation | Réinitialisation |
| --- | --- | --- | --- | --- |
| `DamageSetup.setsAura` | `Array<{ set: SetAura; nombre: number }>` optionnel | `[]` | clés reconnues et uniques, entiers 1..18, somme ≤ 18 | conservé entre monstres/listes ; vidé à l'import de compte |
| `OptimizerState.compterAurasResPre` et `OptimizerRecipe.compterAurasResPre` | booléen ; optionnel dans la recette | `true` | booléen strict si présent | réglage avancé conservé par `resetSearch`, même contrat que les autres réglages avancés |
| `DamageSetup.cibleDegatsParSort` | `Record<number, 'visee' \| 'secondaire'>` optionnel | map vide ; clé absente = `'visee'` | identifiants entiers positifs, valeur dans l'union | vidé au changement d'espèce ou import de compte ; conservé au changement d'exemplaire |
| `DamageSetup.premierCoupIgnoreDefParSort` | `Record<number, number \| null>` optionnel | clé absente = `null` pour A, `7` pour B | A : `null`, 2, 3 ; B : entiers 2..7, jamais `null` | vidé au changement d'espèce ou import de compte ; conservé au changement d'exemplaire |

Les champs de `DamageSetup` voyagent dans `OptimizerRecipe.damageSetup`.
L'import de recette restaure les valeurs validées sans reset ultérieur ;
pas de migration du précédent calcul ignore DEF (décision du lot 10).
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

**Conservation en session, validée en revue :** le contexte se conserve
aussi en changeant de liste de travail, pas seulement entre ses monstres.
L'import de compte garde la réinitialisation complète définie ci-dessus.

**Sortie :** une table normative des champs et événements dans
`spec/outils/optimizer.md § Recherche du monstre à optimiser`.
Elle est accompagnée d'un test qui vérifie changement d'espèce, d'exemplaire, de liste, import de
recette et import de compte. Le test protège cette table, il ne remplace pas
la spec. Les nombres d'auras dans l'équipe survivent au changement de
monstre ; le lot 7 éprouve leur interaction avec les sets recherchés.

**Preuve :** le test · `npx tsc --noEmit` · `node tests/run.mjs <nom> degats optimizer-recipe-import-selection`.

**Ne fait pas :** ne touche pas aux autres réinitialisations de `resetSearch`
(`minStats`, `lockedRunes`, `lignesVerrouillees`, `objective`… — chacune a sa
raison écrite sur place, et aucune n'est visée par la demande).

### Lot 6 — sets d'aura : le modèle

**Cat. J.** Requiert les lots 2b et 5 — pas le lot 1 : les valeurs sont en
A.2 ter, et les nouveaux champs suivent la politique de réinitialisation.

⚠️ **PV/ATQ/DEF : pourcentage de la statistique de BASE. RES/PRE : points
de pourcentage additifs** (A.2 ter). Pour deux effets : +16 % de base en
PV/ATQ/DEF ; +16 points de RES/PRE, même si la valeur de base est nulle.

**Modèle de données :** `DamageSetup.setsAura` (contrat B.0), liste de `{ set: 'fight'|'determination'|
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

1. **Dégâts, passifs et reliques.** `statsDebutCombat` (`damage.ts` l. 3753) est le
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
documentaire de remplacement de B.0. B.0 fait partie des intrants de ce lot.

**Amendement obligatoire :** `invariants.md` l. 20 dit aujourd'hui que les
**cinq** réglages d'« État de mon monstre » « sont exactement les champs qui
modifient les stats propres du monstre ». Ce lot en ajoute un sixième :
l'invariant se corrige **dans le même commit** que la spec source.

**Ne fait pas :** aucun rendu (lot 7). Le champ du toggle et sa propagation
sont livrés ici ; son contrôle visuel est livré au lot 7.

### Lot 7 — sets d'aura : l'écran

**Cat. J.** Requiert le lot 6.

**Où** : la carte « État de mon monstre » (`EtatMonstre.tsx`) — et son critère
de coupe, écrit en tête du fichier, la désigne sans ambiguïté : « sortent de
la description du combat EXACTEMENT les réglages qui modifient les
statistiques propres du monstre ». Un set d'aura en est un.

**Quatre comportements :**

1. **Ajouter / visualiser / supprimer.** Libellé : « Nombre de sets Fight
   dans l'équipe » (même patron pour les cinq sets). Liste déroulante + champ
   entier borné, hors conflit, de `max(1, nombre demandé dans les sets recherchés)`
   à `18 − somme des autres lignes` : plafond d'équipe, pas 18 par type.
   Une seule ligne par set. Tout vient de `src/ui/` (`Selecteur`,
   `NumberField`, `BoutonIcone`). Une ligne requise par les sets recherchés
   ne peut être supprimée sans retirer ce choix de recherche ; l'expliquer.
2. **Auto-ajout et minimum.** Choisir un set d'aura dans les sets recherchés
   ajoute sa ligne si absente. Le nombre total devient au moins le nombre
   d'occurrences demandé : `max(total précédent, nombre demandé)` ; un
   `3× Fight` impose au moins 3. Réduire/retirer un set recherché ne réduit
   pas automatiquement le total d'équipe. Changer de monstre dans une liste
   conserve les totaux. Le total saisi est l'hypothèse d'équipe utilisée au
   calcul, pas une somme automatiquement reconstruite depuis les candidats.
   Si le nouveau nombre demandé dépasse un total précédemment renseigné,
   relever le total au minimum requis et afficher en rouge (token `bad`) :
   « Nombre sélectionné actuellement de sets {X} pour la recherche du monstre
   supérieur à la valeur précédente de sets {X} : vous en aviez potentiellement
   oublié. » Conserver la valeur précédente pour expliquer l'alerte ; une
   création initiale de ligne sans valeur antérieure n'est pas un oubli.
   Si le relèvement automatique ferait dépasser 18, **ne pas modifier la
   valeur précédente**, ni aucune autre ligne. Conserver une saisie valide,
   mémoriser séparément le minimum recherché non satisfait, afficher le
   conflit et bloquer la recherche jusqu'à résolution. Une ligne absente reste
   absente du modèle (0) ; afficher sa demande non satisfaite sans fabriquer
   une entrée invalide. Le conflit est dérivé des sets recherchés et du total
   valide : il ne s'exporte pas dans la recette et se reconstruit à l'import.
   Dès que de la place est libérée, appliquer le relèvement requis et lever
   le conflit ; retirer la demande de recherche le lève également.
   **Jamais `min > max` dans `NumberField` :** pendant le conflit, les lignes
   existantes gardent les bornes valides 1..`18 − somme des autres lignes`,
   sans appliquer le minimum recherché à ce contrôle. Ce minimum reste
   visible dans le message de conflit. Pour une ligne absente, rendre la
   demande en attente sans champ numérique jusqu'à ce qu'une place existe.
3. **Un seul interrupteur**, dans « Réglages avancés » : prise en compte des
   auras RES et PRE dans les conditions minimum ET maximum, activée par
   défaut. Il reste toujours visible dans les réglages avancés, même après
   retrait de toutes les auras RES/PRE. Aucun interrupteur pour les conditions PV/ATQ/DEF.
4. **L'ouverture guidée.** Ajouter Accuracy ou Tolerance (dans les sets
   recherchés ou ici) ouvre automatiquement la surface de réglages avancés,
   fait défiler l'interface jusqu'à `compterAurasResPre` avec le même patron
   que « Set de runes recherché », puis le surligne temporairement en orange.
   Le contrôle reste toujours rendu ; « guider » ne signifie jamais le monter
   conditionnellement ni le masquer ensuite.
   Fight/Determination/Enhance n'ouvrent pas un panneau sans contrôle associé.
   L'ouverture guidée n'est pas rejouée automatiquement lors d'un import ou
   d'un simple changement de monstre. Le message rouge réserve sa place ou
   sort du flux : il ne déplace pas le contrôle qui vient d'être cliqué.

#### ⚠️ Le point 4 n'a pas la même forme sur les deux formats

**Sur ordinateur, « Réglages avancés » n'est pas une carte : c'est un
`FlottantAuto`** (`OptimizerSection.tsx` l. 1864-1878), replié par défaut et
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
behavior: 'smooth', block: 'center' })` (l. 1760, cas « aucun set choisi »).
Le surlignage orange se fait par un **token**, jamais une couleur Tailwind
native ni une valeur en dur (spec/shared/design.md).

**Sortie :** les quatre comportements, sur les deux formats, décrits dans
`spec/outils/optimizer.md § Écran (de haut en bas)` ;
`spec/outils/optimizer.md § Conditions, inventaire et réglages avancés`
reçoit l'interrupteur commun. Tester la logique de synchronisation pure :
création, conservation 1 → 1, relèvement 1 → 3 avec alerte, baisse 3 → 1 sans
perte du total, retrait d'un set, changement de monstre et import de recette.
La suppression explicite d'une ligne ne permet jamais de violer le minimum.
Tester aussi : total 18 et demande supplémentaire → valeurs inchangées,
conflit séparé, recherche bloquée, aucune borne inversée ; réduction d'une
autre ligne → relèvement puis résolution ; import d'une recette avec totaux
valides mais minimum recherché non satisfait → même conflit reconstruit.

**Preuve :** `npm run build` (⚠️ une classe correcte dans le TSX peut n'être
jamais émise — vérifier le **CSS construit** pour le surlignage) ; captures
ou relecture à l'œil des deux formats — il n'y a pas de test d'interface dans
ce dépôt, c'est assumé (`ARCHITECTURE.md` § 9).

**Ne fait pas :** ne change aucun calcul (lot 6). N'audite pas le reste de
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
familles reportées et passifs non curés ; 3) une fois ces contrôles passés,
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
