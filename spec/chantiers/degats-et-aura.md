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

### A.1 Pourquoi

**Le modèle de dégâts est complet là où SWARFARM est complet, et muet
ailleurs.** Les quatre sorts visés sont exactement des cas où la donnée
manque ou ment :

| Sort | Ce que la donnée dit | Ce qui manque |
| --- | --- | --- |
| Blade Surge (5 fiches) | `coups: 2`, `0.5*{ATK}`, `aoe: false`, effet `Additional Attack` | le 3ᵉ coup, en zone : **absent de l'API**, ni ratio ni portée |
| Tempest (Teshar, `3213`) | `passif: true`, `aoe: true`, `coups: 1`, **`formule: ""`** | tout le ratio ; les skillups (`Damage +10%` ×3) sont là |
| Blade Dance of Night (`14808`, `14810`) et les 4 autres fiches du constat 212 | `coups: 3` ou `7`, effet `Ignore DEF` avec `note: "If enemy ATB at 0"` / `"… or 7th hit"`, et `Decrease ATB` de 50 % ou 40 % **par coup** | la condition : `ignoreDef` est un booléen du sort et la `note` n'est jamais lue |
| Accelerando / Rankyaku (`14813`, `14313`) | `passif: true`, `formule: "5*{SPD}"` | rien au calcul (`atkDepuisSpd: 5` est câblé, damage.ts l. 1728-1729) — **seul l'affichage** de la prose manque |

⚠️ **Les valeurs manquantes sont fournies, pas à relever** : voir A.2 ter. Ce
sont des valeurs CURÉES au sens de `game-data-curation` — leur source est
l'utilisateur (joueur), citée, comme pour la vingtaine d'autres valeurs de
`damage.ts` qui n'ont pas d'autre origine.

⚠️ **Et un défaut de rendu, pas de modèle.** Les passifs « Stats acquises en
combat » sont **curés** — `STATS_COMBAT_PAR_ID_CONNUS` (damage.ts l. 1697)
porte 38 entrées, dont Mayasura (`18311`, `stacks`, `atkFlat: 100`) et Jager
lumière (`7814`, `stacks`, `atkPct: 50`). `CombatStatProfile` porte même
`description` (l. 1676). Mais **aucune des 7 branches de rendu** de
`DamageSetupCard.tsx` (l. 960-1040) ne la passe : les branches à compteur
rendent un `<span>` nu + `NumberField` (Mayasura, Jager — « rien de visible »),
`'toujours'` et `'debuffsInverses'` rendent un `Jeton`, et `Jeton` n'a aucun
axe de prose (`src/ui/Jeton.tsx`). La prose existe et n'est affichée nulle
part. ⚠️ Ma première lecture (« Mayasura et Jaeger n'apparaissent pas dans
`src/` ») était **fausse** : la table est clé par identifiant numérique, sans
commentaire de nom sur ces deux lignes — un `grep` sur le nom du monstre ne la
voit pas.

**Les sets d'aura, eux, sont absents par décision explicite et datée** :
`effects.ts` l. 341 dit « les sets d'alliés (Fight, Determination, Enhance,
Accuracy, Tolerance) ne sont PAS ici : dans SW ils buffent l'équipe en combat
et n'apparaissent pas sur la fiche de stats du monstre ». Vrai pour la fiche,
faux pour le calcul : ces bonus modifient les stats du monstre optimisé, donc
les dégâts réels, les PV effectifs, l'assiette des propriétés uniques de
relique, et l'atteinte des conditions min. Les cinq sets sont déjà dans
`RUNE_SETS` (`types.ts` l. 278-282) et déjà choisissables comme set recherché.

**Deux bugs de plancher, mesurés.** `artifactBonusOf`
(`OptimizerSection.tsx` l. 2370) somme la principale de `searchArtifacts`, qui
en « Libre » est la paire *représentative* — choisie par somme des principales,
donc deux `PV +1500` (`ARTIFACT_MAIN_VALUE`, `runeBuildOptim.ts` l. 548). Le
champ « PV min » reçoit donc un plancher (`min=` et `placeholder=`) de **3 000
alors qu'aucune paire n'est décidée**. Même famille : la relique n'entre pas du
tout dans ce plancher, alors que sa principale est un **pourcentage** de base
(`stats.ts` l. 75-77) et qu'en « comme équipé » elle est fixe et connue.

**Et une saisie perdue à chaque monstre.** `resetSearch`
(`useOptimizerState.ts` l. 411) fait `setDamageSetup(DEFAULT_DAMAGE_SETUP)` :
en parcourant une liste de travail, la DEF de l'adversaire, ses PV, les buffs,
le lead, l'invocateur et les effets d'équipe sont à ressaisir à chaque
sélection — alors que rien de tout cela ne dépend du monstre optimisé.

### A.2 Cible et périmètre

**Cible, en termes vérifiables :**

1. Les quatre sorts se calculent, avec pour chacun le réglage utilisateur
   décrit en Partie B et un test nommé dans `tests/`.
2. Les cinq sets d'aura sont saisissables dans « État de mon monstre »,
   entrent dans `statsDebutCombat`, dans les objectifs `degats_reels` et
   `ehp`, dans l'assiette des exclusives de relique, et — par interrupteur —
   dans l'atteinte des conditions min.
3. Le contexte de combat survit à un changement de monstre ; ce qui désigne un
   sort précis ne survit pas.
4. En « Libre », le plancher des conditions vaut 0 sur les huit stats.
5. `spec/outils/degats-reels.md` n'est plus en exception de `spec-lint.json`.
6. Chaque mécanique corrigée l'est pour **toutes** les fiches de l'inventaire
   qui la partagent (A.3 bis), et le reliquat de l'inventaire a un **plan
   chiffré** (lot 13).

**Hors périmètre, explicitement :**

- **L'IMPLÉMENTATION du reliquat de l'inventaire.** Mesuré : **247 constats
  restants, 535 fiches** (A.2 bis). Le lot 13 en produit le plan découpé et
  chiffré ; ce que ce chantier en implémente se décide **sur ce plan**, pas
  par avance. Promettre les 247 ici serait un engagement qu'aucun lot ne peut
  tenir.
- **Le découpage d'`optimizer.md` (2 135 l.) et d'`artefacts.md` (1 703 l.)**,
  tous deux en exception du lint. `spec-lint.json` les assigne à d'autres
  chantiers (`découpage-optimizer`, `artefacts`) avec, pour `optimizer.md`,
  la mention « hors périmètre de ce cadrage ». Décision de l'utilisateur
  (2026-09-23) : on découpe `degats-reels.md`, qui nous est assigné
  (`chantier_responsable: "degats"`), et on ajoute aux deux autres dans leurs
  sections existantes. Une entrée de `pistes.md` note la dette (lot 14).
- **Les parties 3 et 4 de l'audit des dégâts conditionnels.** Elles restent
  « à définir » ; ce chantier n'est pas leur cadrage (A.2 bis).
- **Une passe responsive** sur les cartes touchées au-delà de ce que la
  demande exige (le panneau « Options » au doigt reçoit les mêmes contrôles,
  rien de plus).

### A.2 bis Croisement avec l'audit des dégâts conditionnels

`spec/outils/optimizer/archive/audit-degats-conditionnels-2026-09-08/inventaire.csv`
(695 lignes) contient **déjà quatre des cinq sujets de dégâts**, tous au
statut `Manquant` et **aucun** dans `suivi-implementation.csv` (78 numéros
livrés : 1-13, 15-23, 26-50, 52-54, 64, 71, 83, 86, 117-121, 160, 185, 186,
195-197, 199, 295-302, 305, 307, 316).

| Constat | Catégorie | Lot | Fiches concernées | Ce que l'audit avait déjà écrit |
| --- | --- | --- | --- | --- |
| **151** | 08 — Séquences et attaques déclenchées | B | Astar, Lapis, Lupinus, Iris, Lanett (`10602`…) | « Magic Knights S1 : deux petits coups puis un troisième plus fort en zone ; `hits=2` et formule unique insuffisants » |
| **164** | 08 | B | Teshar (`3213`) | « Tempest déclenché sur son tour ; formule 3,7 ATQ dans `other_skill=1181` » |
| **110** | 05 — Conversions de stats en combat | B | CHUN-LI vent (`14313`), Cordelia vent (`14813`) | « ATQ augmentée de cinq fois sa VIT » — **implémenté depuis**, `atkDepuisSpd: 5` |
| **212** | 09 — Ignore DEF conditionnel | B | 8 fiches dont Cordelia (`14808`) et Vereesa (`14810`) | « ignore DEF selon ATB à zéro ou dernier coup, variantes distinctes » |

**Trois conséquences pour ce chantier :**

1. **Le ratio de Teshar est en litige** : l'audit dit **3,7 ATQ** (370 %,
   depuis `other_skill=1181`), la demande dit **370 %**. Les deux concordent —
   c'est le seul des quatre où une source antérieure existe. Elle se cite,
   elle ne dispense pas du relevé (lot 1).
2. **Le constat 110 est clos côté calcul** : ce qui reste est un défaut
   d'AFFICHAGE, pas une mécanique manquante. Le lot 11 ne rouvre donc pas le
   constat, il corrige un rendu.
3. **Le constat 212 compte exactement 6 fiches**, et ses deux variantes se
   lisent dans la donnée — le lot 10 traite les six (A.3 bis). La catégorie 09
   entière, elle, pèse 17 constats / 34 fiches restants, dont ce constat est
   un seul.

**Le reliquat, mesuré le 2026-09-23** : sur **325 constats** distincts et
695 lignes de fiches, **247 constats / 535 fiches** ne sont ni dans les 78
livrés ni dans ce chantier — dont 62 constats / 182 fiches pour la seule
catégorie 08. ⚠️ **C'est l'ordre de grandeur des parties 3 et 4 de l'audit**,
restées « à définir » : d'où le lot 13, qui **planifie** et ne promet pas. La
répartition complète par catégorie vit dans la section du lot 13, pas ici.

### A.2 ter Les valeurs de jeu — curées, avec leur source

**Toutes les valeurs nécessaires sont en main.** Elles viennent de
l'utilisateur (joueur), le 2026-09-23, sauf mention contraire. Aucun lot n'a
à les redemander, et **aucun lot n'a le droit d'en inventer une autre**.

| Mécanique | Valeur retenue | Source |
| --- | --- | --- |
| Blade Surge, coups 1 et 2 | `0.5 × ATQ` chacun, **mono-cible** | donnée SWARFARM (`formule`, `coups: 2`) + confirmation |
| Blade Surge, coup 3 | `3.0 × ATQ`, **en zone** | utilisateur — absent de l'API |
| Tempest (Teshar) | `3.7 × ATQ`, **en zone**, déclenché après S1 **ou** S2 | utilisateur, **et** l'audit (3,7 ATQ, `other_skill=1181`) : deux sources concordantes |
| Ignore DEF des Blade Dancers | **le coup 1 ne peut JAMAIS ignorer la DEF** ; une fois qu'un coup ignore, **tous les suivants ignorent** | utilisateur |
| Sets d'aura | **+8 % par effet de set**, en **pourcentage de la statistique de BASE** — « comme tous les % venant des runes » | utilisateur |
| Sets d'aura, les cinq stats | Fight → ATQ · Determination → DEF · Enhance → PV · Accuracy → **PRE** · Tolerance → RES | utilisateur (« Accuracy PV » de la demande était une coquille) |

⚠️ **La jauge d'ATB adverse n'est pas modélisée dans l'Optimizer, et ce
chantier ne la modélise pas.** C'est précisément pourquoi la condition d'ignore
DEF devient un **choix** de l'utilisateur, et non un état déduit : l'app ne
sait pas où en est l'ATB de la cible. Voir lot 10.

⚠️ **Deux résidus assumés, écrits ici pour ne pas être redécouverts** : que les
améliorations de compétence (`skillupDamagePct`) portent aussi sur le 3ᵉ coup
de Blade Surge et sur Tempest, et que le coup de zone de Blade Surge touche
**aussi** la cible visée (ce qui fait « 3 coups sur la cible visée »). Les deux
sont cohérents avec le modèle et avec la formulation de la demande ; le lot 1
les inscrit comme hypothèses **datées et nommées** dans la spec, pour qu'un
relevé futur les infirme sans avoir à relire le code.

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
4. **Ne rien perdre de la spec.** Le découpage du lot 2 est un déplacement,
   pas une réécriture : `git diff | grep -c '^-[^-]'` sur le contenu, hors
   en-têtes ajoutés, doit être justifiable ligne par ligne.
5. **Volume lu.** Un plafond (≤ 500 lignes, ≤ 100 par bloc) n'autorise jamais
   à omettre : on dépasse, ou on scinde — on ne tronque pas.

### A.3 bis Une mécanique corrigée l'est pour TOUTE sa famille

**Règle, posée par l'utilisateur (2026-09-23) :** « si pour certains monstres
on met à jour une mécanique, il faut le faire pour tous les monstres de
l'inventaire qui partagent cette mécanique ». Un lot qui corrige une fiche et
laisse ses jumelles produit une app qui calcule juste pour Cordelia et faux
pour Vereesa, sans que rien ne le signale.

**Comment on délimite « la même mécanique ».** Deux niveaux, à ne pas
confondre — c'est ce qui décide du périmètre d'un lot :

- **Même mécanique** = même règle **et** mêmes paramètres lisibles dans la
  donnée (ratio, nombre de coups, condition). Exemple : les 4 fiches à 3 coups
  du constat 212 (`note: "If enemy ATB at 0"`, ATB −50 %/coup) sont une seule
  mécanique. → **dans le lot**, sans exception.
- **Même architecture, paramètres différents** = la même *forme* de mécanisme
  avec des valeurs propres à chaque monstre. Exemple : Tempest (Teshar) et les
  19 autres fiches d'attaque déclenchée par un sort (constats 168 Mina, 178
  RYU/Striker, 179 Drunken Masters, 313 Jin/Kai). → **le lot livre le
  MÉCANISME générique**, et les fiches dont les valeurs ne sont pas en main
  vont au **lot 13** avec leur numéro de constat. Jamais « plus tard » sans
  numéro.

**Le périmètre de famille se MESURE sur `inventaire.csv`**, il ne s'estime pas.
Chaque lot de mécanique commence par extraire ses fiches du CSV et colle la
sortie dans sa preuve — c'est comme ça qu'on a découvert que le constat 212
compte **6** fiches et non 8, et que 151 en compte exactement 5.

### A.4 Catégories de lots → modèle et effort

La difficulté d'un lot est durable ; l'affectation d'un modèle ne l'est pas.
Deux tables.

- **M — mécanique** : le diff se relit intégralement, la preuve est un `grep`
  vide, un test qui passe ou un déplacement sans perte. Aucune décision.
- **C — classification** : une sortie structurée avec coordonnées (fichier,
  ligne, valeur mesurée). Un inventaire, un relevé de longueurs, un constat.
- **J — jugement** : une décision par élément, chacune adossée à une citation
  (donnée SWARFARM, relevé utilisateur, ligne de spec). Toute mécanique de jeu
  et toute forme d'interface sont en J.

Affectation actuelle (révisable sans toucher au reste) : **M → Sonnet, effort
bas · C → Sonnet, effort moyen · J → Opus, effort élevé.**

### A.5 Branche, chantier, fichiers transverses

**Branche `forge/degats-et-aura`, créée depuis `forge/implementation-relique`**
(tête `81284199`, 62 commits en avance sur `origin/main`, 0 en retard ;
`package.json`, `package-lock.json`, `tsconfig.json` et `tailwind.config.js`
identiques à `main`). Dérogation assumée à « tout nouveau travail part de
`origin/main` » : le point 2 (« les effets d'aura entrent dans les stats de
début de combat pour les propriétés uniques de relique ») et le point 5
(relique en « comme équipé ») n'existent pas sur `main` —
`statsDebutCombat`/`relicExclusive.ts`/`relicOptim.ts` y sont absents. Partir
de `main` rendrait ces deux lots infaisables ou à refaire à la fusion.

**Conséquence sur la fusion** : cette branche ne rejoint `main` **qu'après**
`forge/implementation-relique`, ou en même temps par une branche
d'intégration. Elle n'est pas fusionnable seule.

**Notes privées** : les lots touchent `spec/outils/optimizer/invariants.md`,
`pistes.md`, `artefacts.md` — gitignorés. Un chantier `degats-et-aura` doit
être **ouvert** (lot 0) et chaque lot qui y touche finit par
`livrer` → `verifier`, depuis l'installation :

```bash
node "$(git rev-parse --git-common-dir)/forge/installation/scripts/chantier.mjs" \
  verifier --chantier degats-et-aura
```

⚠️ Le chantier `implementation-relique` est ouvert et à jour (dernier reçu
2026-09-22, code `81284199`, 601 fichiers). Ses notes **avancent encore** :
`chantier rafraichir --chantier degats-et-aura` à chaque fois qu'il intègre,
rien ne le signale.

**Fichiers transverses portés par CE chantier** : aucun a priori. `App.tsx`,
`package.json`, `tsconfig.json`, `tailwind.config.js` ne sont pas touchés (ni
page ni section ajoutée ou renommée — les cartes visées existent déjà).
`ARCHITECTURE.md` reçoit **une seule** modification, au lot 2, quand
`degats-reels.md` devient un dossier. `CLAUDE.md` n'est pas touché.

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

⚠️ **Le message de commit cite le fichier de preuve ; il ne le remplace pas.**
Un lot dont la seule sortie est un relevé ou un inventaire n'a pas de commit
de code : sa preuve est son fichier **et** le commit
`docs(cadrage): lot <n> terminé — …` qui embarque commandes et sorties.

### A.7 Dépendances, ordre, suivi

Notation : **`A → B` signifie « B requiert A »** (prérequis à gauche).

```text
0 → 1 → 8, 9, 10, 11       (aucun lot de mécanique sans le périmètre de sa
                            famille, mesuré — A.3 bis)
0 → 2 → 6, 8, 9, 10, 11    (aucune modification normative de degats-reels.md
                            avant son découpage)
0 → 3 → 4                  (4 mesure le plancher que 3 vient de corriger)
0 → 5                      (indépendant : useOptimizerState seul)
0 → 6 → 7                  (l'écran ne peut pas saisir ce que le modèle
                            n'accepte pas ; 6 ne dépend PAS de 1 — les valeurs
                            d'aura sont en A.2 ter, aucune famille à mesurer)
8, 9, 10 → 12              (12 éprouve les mécanismes qu'ils livrent)
1, 11 → 13
3, 4, 5, 6, 7, 12, 13 → 14
```

L'ordre d'exécution est l'ordre des numéros. Les lots 3, 4, 5 sont
volontairement en tête : ils sont courts, indépendants, et livrent de la
valeur avant les deux gros lots (2 et 6-7).

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 — ouverture du chantier | M | à faire | — |
| 1 — périmètres de famille, mesurés | C | à faire | — |
| 2 — découpage de `degats-reels.md` | C+M | à faire | — |
| 3 — plancher des conditions en « Libre » | M | à faire | — |
| 4 — relique « comme équipé » et les minimums | C→M | à faire | — |
| 5 — le contexte survit au changement de monstre | J | à faire | — |
| 6 — sets d'aura : le modèle | J | à faire | — |
| 7 — sets d'aura : l'écran | J | à faire | — |
| 8 — Blade Surge : le 3ᵉ coup en zone (5 fiches) | J | à faire | — |
| 9 — Teshar : Tempest après S1/S2 et comme sort | J | à faire | — |
| 10 — ignore DEF conditionnel des Blade Dancers (6 fiches) | J | à faire | — |
| 11 — prose des passifs « Stats acquises en combat » (38 entrées) | C+M | à faire | — |
| 12 — le mécanisme rejoué sur une fiche non écrite | C | à faire | — |
| 13 — plan chiffré du reliquat (247 constats) | C | à faire | — |
| 14 — clôture, ledgers, suite complète | M | à faire | — |

**Avant le lot 0 : la revue adversariale.** Au moins deux tours, par une
session qui **n'a pas écrit** ce document, munie de la checklist C du skill
`cadrage-chantier` et de trois questions par lot : *l'intrant est-il borné ? la
preuve est-elle un artefact ? l'outil qu'il utilise existe-t-il déjà à ce
numéro ?* ⚠️ **Elle est conduite par l'utilisateur**, qui la soumet lui-même
(décision du 2026-09-23) ; le prompt de revue lui est fourni sur demande. Une
revue qui ne trouve rien au premier tour n'a pas lu le graphe.

---

## Partie B — un contrat par lot

### Lot 0 — ouverture du chantier

**Cat. M.** Intrant : ce cadrage, Partie A. Aucun fichier de code.

**Déroulé :** `chantier ouvrir --chantier degats-et-aura` depuis
l'installation ; créer
`spec/outils/optimizer/archive/controles-degats-aura-2026-09/README.md`
(H1 + `**Statut :** ARCHIVE — preuves du chantier degats-et-aura`) ; ajouter
la ligne de ce cadrage dans `spec/README.md` § Chantiers (fichier, statut
« en cours », branche `forge/degats-et-aura`).

**Sortie :** l'état du chantier existe, `chantier verifier` passe.

**Preuve :** sortie de `chantier ouvrir`, puis de `chantier livrer` et
`chantier verifier`, collées dans `controle-0.md`.

**Ne fait pas :** ne crée aucun fichier de spec de destination du lot 2, ne
touche à aucun fichier de code.

### Lot 1 — les périmètres de famille, mesurés

**Cat. C.** ⚠️ **Ce lot ne demande AUCUN relevé** : les valeurs sont fournies
et consignées en A.2 ter. Ce qu'il produit, c'est la seule chose que ni la
demande ni le CSV ne donnent toute faite — **la liste nominative des fiches
que chaque lot de mécanique doit couvrir** (A.3 bis). Sans elle, chaque lot
redécouvre son périmètre et se trompe, comme je m'étais trompé sur le constat
212 (8 fiches annoncées, 6 réelles).

**Intrant :** `inventaire.csv` (695 lignes, extraction par script — **jamais**
une lecture de mémoire) ; les fiches `public/data/skills/*.json` des monstres
extraits, en lecture ciblée.

**Sortie :** `controle-1.md`, une section par mécanique, chacune portant : la
requête d'extraction exacte, la liste des fiches (monstre, élément,
`com2usId` du sort, `coups`, `formule`, `note` de l'effet conditionnel), et le
verdict **même mécanique / même architecture** de A.3 bis pour chacune.

#### Les quatre extractions à produire

1. **Blade Surge** — constat 151. Mesuré : **5 fiches** (Astar feu `10602`,
   Iris lumière `10604`, Lapis eau `10616`, Lupinus vent `10618`, Lanett
   ténèbres `10620`). À vérifier : qu'aucune autre fiche du corpus ne porte le
   même sort. ⚠️ Les constats **163** (Theonia : zone puis frappe sur la DEF
   la plus faible), **173** (Danu : zone après sept attaques cumulées) et
   **180** (Jackie : attaque de plus si la cible est étourdie) sont
   **voisins mais distincts** — même catégorie 08, autre mécanique. Ils ne
   rejoignent pas le lot 8 ; ils vont au lot 13.
2. **Tempest** — constat 164, **1 fiche** (Teshar vent `3213`). Même
   architecture : constats **168** (Mina, 1), **178** (RYU/Striker, 6),
   **179** (Drunken Masters, 10), **313** (Jin/Kai ténèbres, 2) — **19
   fiches** d'attaque déclenchée par un sort, aux déclencheurs et ratios
   propres. Le lot 9 livre le mécanisme, ces 19 vont au lot 13 **avec leur
   numéro de constat**.
3. **Les Blade Dancers** — constat 212, **6 fiches**, **deux variantes** que
   la donnée distingue (relevé ci-dessous, à rejouer et coller) :

   | Variante | Fiches | `coups` | `Decrease ATB` / coup | `note` |
   | --- | --- | --- | --- | --- |
   | **A** | Hyakuretsukyaku CHUN-LI vent `14308` et ténèbres `14310` ; Blade Dance of Night Cordelia `14808` et Vereesa `14810` | 3 | 50 % | `If enemy ATB at 0` |
   | **B** | Hoyokusen CHUN-LI eau `14311` ; Moonlight Dance Lariel eau `14811` | 7 | 40 % | `If enemy ATB at 0 or 7th hit` |

   ⚠️ En **B**, la prose ajoute « The 7th attack will always ignore Defense » :
   le dernier coup est **inconditionnel**. C'est une règle de plus, pas la
   même mécanique — d'où deux entrées de table au lot 10, pas une.
4. **Les passifs « Stats acquises en combat »** — les **38 entrées** de
   `STATS_COMBAT_PAR_ID_CONNUS`, avec pour chacune le monstre (résolu depuis
   `public/data/monsters.json`, 3 089 fiches), la `source`, et la branche de
   rendu qui la traite. C'est l'intrant du lot 11.

**Preuve :** `controle-1.md` avec les quatre extractions et leurs commandes.
Un écart avec un chiffre de ce cadrage se **signale** — le cadrage se corrige,
pas la mesure.

**Ne fait pas :** ne code rien, ne touche à `damage.ts` ni à aucune table
`*_CONNUS`, ne décide d'aucun ratio (A.2 ter les fixe déjà).

### Lot 2 — découpage de `spec/outils/degats-reels.md`

**Cat. C puis M.** Skill `spec-hygiene`, recette (b). Déclencheur : les lots
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

#### Contrat exact

1. **Trier d'abord** (étape 1 de la recette) : le catalogue des cinq vagues
   décrit majoritairement du **non implémenté**. Ce qui est une piste part
   dans `pistes.md` ; ce qui décrit un comportement livré reste en état actuel.
   La décision se prend **bloc par bloc**, avec citation de la première ligne.
2. **Destination : un dossier `spec/outils/degats-reels/`** + un
   `degats-reels.md` réduit à son routage (comme
   `spec/outils/optimizer/README.md`). Chaque fichier ≤ 500 lignes, chaque
   bloc terminal ≤ 100 — le bloc de 230 lignes se sous-titre, il ne se coupe
   pas.
3. **En-tête sur chaque fichier issu du découpage** (nature « état actuel » :
   `Statut` / `Lire si` / `Ne pas lire si` / `Voir aussi`).
4. **Repointer les références** : **340 occurrences dans 28 fichiers**
   (mesuré), dont `invariants.md`, `optimizer.md`, `artefacts.md`,
   `pistes.md`, `spec/outils/README.md`, le skill `game-data-curation`,
   `ARCHITECTURE.md`, et des commentaires de `damage.ts`,
   `runeBuildOptim.ts`, `OptimizerSection.tsx`, `DamageSetupCard.tsx`,
   `useOptimizerState.ts`, `artifactOptim.ts`, `optimizerRecipe.ts`,
   `scripts/artifact-search.ts`, `tests/degats.test.ts`. **D'abord en aperçu**
   (script qui liste sans écrire), puis diff relu, jamais une réécriture à
   l'aveugle : une référence `fichier § Titre` est sensible au chemin **et**
   au slug du titre.
5. **Retirer l'exception** de `spec/spec-lint.json`.
6. **`ARCHITECTURE.md`** : la colonne « Spec » et les mentions de
   `degats-reels.md` suivent.

**Preuve** (`controle-2.md`) :
`node scripts/spec-lint.mjs spec/outils` propre · `node tests/run.mjs spec-lint spec-markdown spec-toc` vert ·
`git diff <avant> -- spec/outils/degats-reels.md | grep -c '^-[^-]'` avec sa
justification ligne à ligne · `grep -rn 'degats-reels\.md' .` ne renvoyant
plus aucun chemin mort · le tableau des longueurs après découpage.

**Scission si nécessaire :** si le tri de l'étape 1 dépasse ce qu'une session
tient (les 429 lignes de catalogue = ~40 décisions), scinder en **2a** (tri et
décisions par bloc, sortie = un plan de destination) et **2b** (déplacement +
repointage), dans cet ordre.

**Ne fait pas :** ne corrige aucune faute, ne met à jour aucun contenu, ne
touche ni `optimizer.md` ni `artefacts.md` (A.2).

### Lot 3 — le plancher des conditions en « Libre »

**Cat. M.** Le bug est localisé :
`OptimizerSection.tsx` l. 2370 `artifactBonusOf` somme la principale de
`searchArtifacts` ; l. 3477-3491 en fait `floor`, puis `min={floor}` et
`placeholder={String(floor)}` du champ « Min » (et de « Max »). En « Libre »,
`searchArtifacts = paireRepresentative(...)` retient deux `PV +1500` : plancher
**3 000 PV**, et **0 ATQ / 0 DEF** — asymétrie qui a déjà causé une violation
de monotonie côté moteur (`artefacts.md` § 12.13).

**Contrat :** le plancher n'est **ce qui est garanti**, jamais ce qu'une paire
représentative suppose. Donc, par emplacement :

- `'equipped'` → la pièce réellement portée est fixe et connue : sa principale
  compte.
- un code de stat forcé (100/101/102) → la principale est imposée : elle
  compte.
- `'libre'` → **rien n'est garanti : 0**.
- optimisation d'artéfacts coupée → les deux emplacements valent `'equipped'`
  (déjà le cas, l. 1402-1407) : inchangé.

Le plancher est donc une somme **par emplacement**, pas une lecture de la
paire retenue. ⚠️ Les deux emplacements ont chacun leur choix : un
`'equipped'` + un `'libre'` donne le plancher du seul premier.

**Sortie :** `floor === 0` sur les huit stats quand les deux emplacements sont
sur « Libre », inchangé partout ailleurs. Un test nommé dans `tests/` +
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
avec et sans relique équipée, dans les quatre crans de `relicMainChoice`
(`equipped`, `libre`, 100/101/102) ; 2) comparer au moteur, qui lui a bien
`relPctMax`/`relPctMin` (`runeBuildOptim.ts` l. 2777) ; 3) **si** écart, le
corriger avec la même règle que le lot 3 — « garanti » seulement en
`'equipped'` et sur une principale forcée.

**Sortie :** `controle-4.md` avec le tableau des quatre crans × (avec /
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

**Critère mécanique de la coupe** (c'est ce qui rend le lot vérifiable) :
dans `DamageSetup` (`damage.ts` l. 3254-3432),

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

⚠️ **Trois champs à trancher explicitement**, ni l'un ni l'autre : `defBreakParLeSort`
(déduit du sort choisi), `enemyHpNotDestroyed`/`enemyDestroyedHpPct`
(contexte, mais affichés par certains sorts seulement),
`velaskaPvPerduPct`. Le lot décide, cite sa raison, et l'écrit dans
`optimizer.md`.

⚠️ **La demande dit « d'une même liste ».** À trancher : le contexte se
conserve-t-il aussi en changeant de liste de travail, ou seulement à
l'intérieur d'une liste ? Le cadrage recommande **toujours conserver** — le
contexte ne dépend d'aucune liste — et de le signaler dans le rapport.

**Sortie :** un test nommé qui pose un contexte, change de monstre, et vérifie
champ par champ ce qui survit et ce qui tombe. La liste du test **est** la
spec, citée par
`spec/outils/optimizer.md § Recherche du monstre à optimiser`.

**Preuve :** le test · `npx tsc --noEmit` · `node tests/run.mjs <nom> degats optimizer-recipe-import-selection`.

**Ne fait pas :** ne touche pas aux autres réinitialisations de `resetSearch`
(`minStats`, `lockedRunes`, `lignesVerrouillees`, `objective`… — chacune a sa
raison écrite sur place, et aucune n'est visée par la demande).

### Lot 6 — sets d'aura : le modèle

**Cat. J.** Requiert le lot 2 seulement — **pas** le lot 1 : l'assiette et les
cinq stats sont fixées en A.2 ter, il n'y a aucune famille à mesurer.

⚠️ **L'assiette est tranchée : pourcentage de la statistique de BASE**, « comme
tous les % venant des runes » (utilisateur, 2026-09-23). Ce n'est donc **pas**
la famille du buff ATQ (% du total), c'est celle du lead et des compétences
d'invocateur — d'où le point d'insertion ci-dessous.

**Modèle de données :** une liste de `{ set: 'fight'|'determination'|
'enhance'|'accuracy'|'tolerance', nombre: 1..15 }` dans `DamageSetup` — un
nouveau champ, **optionnel** (compatibilité des recettes déjà exportées).
⚠️ **Champ optionnel = `tsc` ne verra jamais un oubli.** Skill
`optimizer-field-propagation` : le champ se propage à **tous** ses
constructeurs (`useOptimizerState`, `optimizerRecipe.ts`,
`scripts/lib/recipeToSearchParams.ts`, les scripts de diagnostic), et le lot
finit par un `grep -rn` du nom du champ sur `src/`, `scripts/` **et** `tests/`.

**Trois chemins de calcul, distincts :**

1. **Dégâts et PV effectifs.** `statsDebutCombat` (`damage.ts` l. 3753) est le
   point d'entrée : c'est déjà là que vivent l'invocateur et le lead, avec un
   **`ceil` unique** sur la somme des pourcentages de base. L'aura s'y ajoute
   comme un `extraBasePct` de plus — **jamais un second arrondi**. ⚠️ Gain
   collatéral : `relicExclusive.ts` l. 133 lit `statsDebutCombat` pour
   l'assiette `Y` des propriétés uniques, donc la demande « les effets d'aura
   entrent dans les stats de début de combat pour les reliques » est satisfaite
   **par construction**, sans second chemin. Le lot le **prouve** par un test,
   il ne le suppose pas.
2. **Objectifs de recherche.** Determination et Enhance comptent pour `ehp` ;
   Fight, Determination et Enhance peuvent compter pour `degats_reels` selon
   ce que le sort scale. Ce n'est **pas** une liste à coder : ça sort de
   `damageRelevantStats` (`damage.ts` l. 4943) et de l'objectif, comme pour
   les autres bonus de stat. Le lot vérifie que rien n'est à nommer.
3. **Conditions min.** RES et PRE ne passent **pas** par
   `statsDebutCombat` (qui ne rend que atk/def/hp/spd). Les cinq sets doivent
   donc entrer dans le moteur comme un apport **garanti** (famille
   `guaranteed`, pas `artFlatMax`), et **seulement si** l'interrupteur du lot 7
   l'autorise pour ce set.

**Sortie :** un test nommé par chemin (dégâts, EHP, exclusive de relique,
conditions min), plus un test de compatibilité d'une recette sans le champ.

**Preuve :** les tests · `npx tsc --noEmit` · `node tests/run.mjs <noms> degats rune-optim relic-exclusive` ·
le `grep -rn` de propagation, sortie collée.

**Amendement obligatoire :** `invariants.md` l. 20 dit aujourd'hui que les
**cinq** réglages d'« État de mon monstre » « sont exactement les champs qui
modifient les stats propres du monstre ». Ce lot en ajoute un sixième :
l'invariant se corrige **dans le même commit** que la spec source.

**Ne fait pas :** aucun rendu (lot 7). Aucun interrupteur de réglages avancés.

### Lot 7 — sets d'aura : l'écran

**Cat. J.** Requiert le lot 6.

**Où** : la carte « État de mon monstre » (`EtatMonstre.tsx`) — et son critère
de coupe, écrit en tête du fichier, la désigne sans ambiguïté : « sortent de
la description du combat EXACTEMENT les réglages qui modifient les
statistiques propres du monstre ». Un set d'aura en est un.

**Quatre comportements :**

1. **Ajouter / visualiser / supprimer.** Une liste déroulante des cinq sets +
   un champ numérique **borné 1 à 15**, puis les effets actifs listés avec
   leur croix. Tout vient de `src/ui/` (`Selecteur`, `NumberField`,
   `BoutonIcone`) — rien de custom.
2. **Auto-ajout depuis les sets recherchés.** Choisir Fight (ou l'un des
   quatre autres) dans « Set de runes recherché » ajoute l'effet ici. ⚠️ Le
   nombre alors posé est **à trancher** : 1 par set 2-pièces demandé (un combo
   peut demander `3× Fight`, `types.ts` l. 375), ou une valeur laissée à
   l'utilisateur. Le cadrage recommande 1 par occurrence demandée, modifiable.
3. **Les interrupteurs de prise en compte dans les conditions min**, dans
   « Réglages avancés » : **un par set**, activés par défaut pour Accuracy et
   Tolerance, désactivés pour Fight, Determination, Enhance.
4. **L'ouverture guidée.** Sélectionner un set d'aura (dans les sets
   recherchés **ou** ici) ouvre « Réglages avancés », amène l'interrupteur
   concerné à l'écran, et le surligne en orange.

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
reçoit les interrupteurs.

**Preuve :** `npm run build` (⚠️ une classe correcte dans le TSX peut n'être
jamais émise — vérifier le **CSS construit** pour le surlignage) ; captures
ou relecture à l'œil des deux formats — il n'y a pas de test d'interface dans
ce dépôt, c'est assumé (`ARCHITECTURE.md` § 9).

**Ne fait pas :** ne change aucun calcul (lot 6). N'audite pas le reste de
l'écran en mobile.

### Lot 8 — Blade Surge : le 3ᵉ coup, en zone

**Cat. J.** Bloqué par les lots 1 et 2. Constat 151 de l'audit.

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
| **Dégâts sur les autres ennemis** | le seul coup de zone : `3.0×ATQ` | **jamais** | sur ce coup — c'est la 1ʳᵉ attaque **sur cette cible** |

⚠️ Le second cran n'est **pas** « le total moins les deux premiers coups » : la
ligne 411 y redevient active, parce que la cible change. Deux calculs, pas une
soustraction.

⚠️ **411 vaut pour la première attaque DU TOUR** et les passifs offensifs
reçoivent un profil dont `cdPointsPremiereAttaque` est remis à zéro
(`degats-reels.md`, § dédié). Le cran « autres ennemis » ne doit pas rouvrir
ce compteur pour les passifs.

**Sortie :** **les cinq fiches** du constat 151 (`10602` Astar, `10604` Iris,
`10616` Lapis, `10618` Lupinus, `10620` Lanett — A.3 bis : c'est la famille
entière, mesurée au lot 1) calculent les deux crans ; un test nommé qui
vérifie les deux, **et** que 224 ne porte que sur 2 des 3 coups dans le
premier cran.

**Preuve :** le test · la liste des 5 fiches du lot 1 citée dans la spec ·
`npx tsc --noEmit` ·
`node tests/run.mjs <nom> degats audit-degats-conditionnels` · `npm run build`.

**Ne fait pas :** ne traite pas les constats **163** (Theonia), **173** (Danu)
et **180** (Jackie) — voisins de catégorie, autre mécanique (lot 1, point 1) :
ils vont au lot 13.

### Lot 9 — Teshar : Tempest après S1/S2, et comme sort

**Cat. J.** Bloqué par les lots 1 et 2. Constat 164.

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
   dégâts de cette attaque s'affichent.

**Artéfacts, deux règles opposées :** 411 (Dgts CRIT 1ʳᵉ attaque) s'applique
**toujours** à Tempest — c'est une attaque neuve. 224 (cible unique pendant
ton tour) **jamais** — elle est en zone.

⚠️ **Les artéfacts 222/223** (D.CRIT+ selon bon / mauvais état des PV ennemis)
doivent voir les PV **tels que le sort précédent les a laissés**. Le
mécanisme existe déjà : `computeSkillDamageDetail` creuse `pvCourant` coup par
coup et les passifs frappent après (`degats-reels.md`, § « Les PV de la cible
se creusent COUP PAR COUP »). Le lot **prouve** que Tempest en profite ; il ne
recode pas la chaîne.

**Sortie :** les trois comportements + un test nommé par comportement. **Une
seule fiche** (Teshar vent `3213`) : le constat 164 n'en a pas d'autre.

⚠️ **Le mécanisme, lui, est générique et doit le rester** (A.3 bis, second
niveau) : « un passif à formule curée, déclenché après certains sorts,
sélectionnable comme un sort ». Dix-neuf autres fiches l'attendent (constats
168, 178, 179, 313 — lot 1, point 2). Le lot **n'en code aucune**, mais il
écrit dans la spec **ce qu'il faudra fournir** pour en ajouter une : le ratio,
la liste des sorts déclencheurs, la portée. Un mécanisme qui n'accepte que
Teshar serait à refaire dix-neuf fois.

**Preuve :** les tests · `npx tsc --noEmit` ·
`node tests/run.mjs <noms> degats audit-degats-conditionnels` · `npm run build`.

**Ne fait pas :** ne traite aucune des 19 fiches de même architecture — elles
vont au lot 13, avec leur numéro de constat.

### Lot 10 — l'ignore DEF conditionnel des Blade Dancers

**Cat. J.** Bloqué par les lots 1 et 2. **Tout le constat 212 : 6 fiches, deux
variantes** (A.3 bis — corriger une fiche et laisser ses jumelles donnerait une
app juste pour Cordelia et fausse pour Vereesa).

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

| Variante | Fiches | Crans proposés |
| --- | --- | --- |
| **A** — 3 coups, ATB −50 %/coup | `14308`, `14310`, `14808`, `14810` | **aucun ignore DEF** · **à partir du 2ᵉ coup** · **à partir du 3ᵉ coup** |
| **B** — 7 coups, ATB −40 %/coup, **7ᵉ coup toujours ignore-DEF** | `14311`, `14811` | à partir du 3ᵉ · 4ᵉ · 5ᵉ · 6ᵉ · **7ᵉ seul** (plancher : le 7ᵉ ignore toujours, « aucun » n'existe pas) |

Le rang minimal se **justifie** par la donnée (ATB à 0 après ⌈100/50⌉ = 2 coups
en A, ⌈100/40⌉ = 3 en B) mais se **cure** : une table par `com2usId` portant
`premierCoupPossible` et `dernierCoupInconditionnel`, la dérivation écrite en
commentaire comme justification — pas comme implémentation. Même discipline que
les autres tables du fichier.

**Le patron de saisie existe** : `ScenarioEffetsEntreCoups.apresCoup`
(`Record<string, number | null>`, l. 2011) — « numéro du coup APRÈS lequel la
pose réussit ; absent/null = aucune réussite ». C'est exactement la forme
demandée (« même logique que des sorts pouvant poser une brand ou break def et
dont on choisit quels coups sont affectés »).

⚠️ **Ne pas confondre avec `ignoreDefSelonVit`** (une fraction proportionnelle
à l'écart de VIT, l. 2527) ni avec `ignoreDefParStack` (l. 1992) : trois
mécaniques distinctes, celle-ci n'est ni l'une ni l'autre.

**Sortie :** les 6 fiches proposent leurs crans ; un test nommé qui vérifie
**chaque cran des deux variantes**, que le coup 1 n'ignore jamais, que le 7ᵉ
de la variante B ignore dans tous les crans, et — contrôle négatif — qu'un sort
ignore-DEF inconditionnel (`IGNORE_DEF_COMPLET_CONNUS`, l. 2716) est
**inchangé**.

**Preuve :** le test, contrôle négatif inclus · l'extraction des 6 fiches du
lot 1 citée dans la spec · `npx tsc --noEmit` ·
`node tests/run.mjs <nom> degats audit-degats-conditionnels`.

**Ne fait pas :** ne traite pas les 16 autres constats de la catégorie 09
(34 fiches restantes, A.2 bis) — autres mécaniques d'ignore DEF conditionnel,
lot 13.

### Lot 11 — les passifs « Stats acquises en combat » non survolables

**Cat. C puis M.** Requiert les lots 1 (extraction 4) et 2.

**Constat de départ, mesuré :** `CombatStatProfile` **porte déjà**
`description` (la prose SWARFARM, `damage.ts` l. 1676), et les 38 entrées de
`STATS_COMBAT_PAR_ID_CONNUS` sont bien curées — **y compris Mayasura**
(`18311`, `stacks`, `atkFlat: 100`) **et Jager lumière** (`7814`, `stacks`,
`atkPct: 50`). Mais **aucune des 7 branches de rendu** de
`DamageSetupCard.tsx` (l. 960-1040) ne passe la prose :

| `source` | Entrées | Rendu actuel | Prose |
| --- | --- | --- | --- |
| `stacks` | 17 | `<span>{label}</span>` + `NumberField` | **non** — ni prose, ni icône |
| `toggle` | 11 | `PassifInterrupteur`, `title` = le label | **non** |
| `buffsPropres` / `buffsAllies` / `debuffsPropres` | 4 / 1 / 1 | idem `stacks` | **non** |
| `toujours` | 5 | `Jeton` (icône + `detail`) | **non** |
| `debuffsInverses` | 1 | `Jeton` + 3 interrupteurs | **non** |

⚠️ **`Jeton` n'a aucun axe de prose** (`src/ui/Jeton.tsx` : `icone`, `libelle`,
`detail`, `onRetirer`) — et on n'ajoute à la librairie que quand un **axe**
manque, jamais une variante.

**La correction est un patron DÉJÀ en place dans la même carte**, pas une
invention : huit autres familles de passifs y affichent leur prose en
`<p className="mt-1 text-xs leading-snug text-ink-dim">{description}</p>`
**sous** le contrôle (l. 517, 554, 586, 645, 666, 729, 769, 799). Statique,
donc rien ne bouge au clic. Le lot applique ce patron aux branches qui le
perdent, **prose jamais reformulée** (les libellés sont ceux du jeu).

**Contrat :** 1) l'extraction 4 du lot 1 (38 entrées × monstre × `source` ×
branche de rendu) ; 2) le correctif par branche ; 3) la section de spec.

⚠️ **Ce que l'hypothèse de la demande recouvrait vraiment.** « Rien de visible
(Mayasura, Jaeger) » et « le sort non survolable (Cordelia) » ne sont pas deux
cas mais **un seul**, à deux rendus près : la prose n'est nulle part. Le cas
« passif absent de la table » existe aussi, mais **ni Mayasura ni Jager n'en
sont** — ma première lecture était fausse (A.1).

**Sortie :** `controle-11.md` avec le tableau des 38 entrées ; le correctif ;
la section de spec mise à jour.

**Preuve :** le tableau · `npm run build` · relecture à l'œil sur au moins un
monstre par `source` corrigée (Mayasura pour `stacks`, Cordelia pour
`toujours`).

**Ne fait pas :** ne cure aucun passif absent de la table — la liste des
manquants, mesurée, va dans `pistes.md` et au lot 13.

### Lot 12 — le mécanisme, rejoué sur une fiche qu'aucun lot n'a écrite

**Cat. C.** Requiert les lots 8, 9, 10.

**Pourquoi ce lot existe.** A.3 bis demande que les lots 9 et 10 livrent un
**mécanisme**, pas un cas particulier — mais rien ne le vérifie : un mécanisme
qui n'accepte que Teshar passe tous les tests de Teshar. Ce lot le met à
l'épreuve **sans écrire de code de production** : prendre **une** fiche d'une
famille voisine dont les valeurs sont dans le CSV (constat **178** RYU/Striker
pour l'attaque déclenchée, un constat de catégorie 09 pour l'ignore DEF
conditionnel), l'ajouter **dans un test uniquement**, et dire ce qui manque.

**Sortie :** `controle-12.md` — pour chacun des deux mécanismes : ce qu'il a
fallu fournir (une ligne de table ? un champ de plus ? une branche de rendu ?),
et le verdict **générique / à retoucher**. Si une retouche est nécessaire, elle
devient une entrée nommée du lot 13, pas une correction improvisée ici.

**Preuve :** `controle-12.md` · le test jetable, cité mais **non commité** dans
`tests/index.ts` (ce n'est pas un contrôle permanent, c'est une mesure).

**Ne fait pas :** n'ajoute aucune fiche au calcul de production. Ne corrige
rien — il **constate**.

### Lot 13 — le reliquat de l'inventaire : un plan, pas une promesse

**Cat. C.** Requiert les lots 1 et 11. **Le lot le plus facile à mal cadrer**
du chantier, d'où ce qui suit.

**Le volume, mesuré le 2026-09-23** (script d'extraction à rejouer et joindre
à la preuve) : sur 325 constats distincts, **247 restants, 535 fiches** —
statuts : 176 `Manquant`, 59 `Partiel`, 12 cas nommés à part (donnée
contradictoire, calcul trop favorable, interprétation à recouper).

| Constats | Fiches | Catégorie |
| --- | --- | --- |
| 62 | 182 | 08 — Séquences, nombre de coups et attaques déclenchées |
| 57 | 75 | 12 — Critiques garantis, bonus TC/DC et critiques interdits |
| 32 | 59 | 05 — Bonus et conversions de statistiques en combat |
| 18 | 46 | 10 — Pertes de PV, redistribution et dégâts différés |
| 17 | 34 | 09 — Ignore DEF conditionnel ou probabiliste |
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

**Ce que le lot produit :** un **plan découpé et chiffré**, dans
`spec/outils/optimizer/decisions/` (nature décision, en-tête posé) :

1. **Un classement des 247 par coût**, sur deux critères mesurables et pas sur
   une impression : (a) la valeur est-elle **dans la donnée** (formule, effet,
   `note`) ou faut-il un relevé ? (b) la mécanique **existe-t-elle déjà** dans
   `damage.ts` (une ligne de table suffit) ou demande-t-elle un mécanisme neuf ?
   Les quatre cases qui en résultent ordonnent tout le reste.
2. **Les familles reportées par ce chantier, nominativement** : les 19 fiches
   d'attaque déclenchée (constats 168, 178, 179, 313), les constats 163, 173,
   180 voisins de Blade Surge, les 16 autres constats de catégorie 09, les
   passifs absents de `STATS_COMBAT_PAR_ID_CONNUS` relevés au lot 11. Chacune
   avec son numéro de constat — **jamais un « plus tard » sans numéro**.
3. **Une proposition de lots**, chacun borné par son intrant en fiches, avec
   la liste des relevés en jeu à demander **regroupés en une seule demande**
   (un relevé par mécanique coûte un aller-retour ; 40 demandes séparées ne se
   font pas).
4. **La recommandation explicite** : ce plan est-il un lot de plus de ce
   chantier, ou son propre chantier ? Le lot répond, avec ses chiffres.

**Sortie :** le fichier de plan, plus une ligne dans `pistes.md` qui le pointe.

**Preuve :** `controle-13.md` — les commandes d'extraction, les totaux par
case du classement (les quatre nombres doivent sommer à 247), et la liste
nominative des familles reportées.

**Ne fait pas :** **n'implémente aucun constat.** Ne relance aucune mesure de
perf. Ne décide pas seul d'ouvrir un chantier — il recommande, l'utilisateur
tranche.

### Lot 14 — clôture

**Cat. M.**

**Déroulé :** 1) statut du cadrage → `CHANTIER terminé le <date>`, ligne de
`spec/README.md` § Chantiers suivie ; 2) entrées de `pistes.md` pour les
dettes explicitement différées : découpage d'`optimizer.md` et
d'`artefacts.md`, le plan du lot 13 et les familles qu'il reporte, les
passifs « stats de combat » non curés ; 3) `chantier livrer` →
`verifier` → `integrer` ; 4) **`npm test` complet** — les 45 vérifications,
rien de moins : c'est la seule étape du chantier où la suite entière tourne.

⚠️ **Un ledger et le fichier qu'il référence se mettent à jour ensemble**
(CLAUDE.md) : chaque entrée de `pistes.md` ouverte ici pointe un fichier dont
le statut dit la même chose.

**Preuve :** `npm test` complet, sortie collée dans `controle-14.md` ·
`chantier verifier` vert · `node scripts/spec-lint.mjs` propre.

**Ne fait pas :** ne fusionne pas dans `main`. Cette branche ne rejoint `main`
qu'avec ou après `forge/implementation-relique` (A.5), et la fusion est une
décision de l'utilisateur, jamais du lot.
