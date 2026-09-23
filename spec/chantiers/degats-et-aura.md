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
| Tempest (Teshar) | `3.7 × ATQ`, **en zone**, déclenché après S1 **ou** S2 | utilisateur, **et** l'audit (3,7 ATQ, `other_skill=1181`) : deux sources concordantes |
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
effectivement présentes, si l'aperçu en trouve. `CLAUDE.md` n'est pas touché.

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
0 → 1a → 1b, 1c1, 1c2, 1c3, 1d, 1e → 1f → amendement pilote → 8, 9, 10, 11
                            (extraction, classifications bornées,
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
| 1b — classification Blade Surge | J | à faire | — |
| 1c1 — Tempest : amorces et noms partagés | J | à faire | — |
| 1c2 — Tempest : effet Additional Attack, première moitié | J | à faire | — |
| 1c3 — Tempest : effet Additional Attack, seconde moitié | J | à faire | — |
| 1d — classification Blade Dancers | J | à faire | — |
| 1e — formes et rendus des stats de combat | C | à faire | — |
| 1f — réconciliation et proposition d'amendement | C+J | à faire | — |
| 2a — classement des blocs et plan de découpage | C | à faire | — |
| 2b — déplacement et repointage selon le plan validé | M | à faire | — |
| 3 — plancher des conditions en « Libre » | M | à faire | — |
| 4 — relique « comme équipé » et les minimums | C→M | à faire | — |
| 5 — le contexte survit au changement de monstre | J | à faire | — |
| 6 — sets d'aura : le modèle | J | à faire | — |
| 7 — sets d'aura : l'écran | J | à faire | — |
| 8 — Blade Surge : le 3ᵉ coup en zone (périmètre à amender après lot 1) | J | à faire | — |
| 9 — Teshar : Tempest après S1/S2 et comme sort | J | à faire | — |
| 10 — ignore DEF conditionnel des Blade Dancers (périmètre à amender après lot 1) | J | à faire | — |
| 11 — prose des passifs « Stats acquises en combat » (38 identifiants, 40 configurations) | C+M | à faire | — |
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
`ea309e7` (76 fichiers, empreinte `6f3dd6da5d98bffc…`). Le constat 313 reste
à trancher : sa lacune parle d'un excédent stocké pour le prochain S3, pas
d'une attaque déclenchée. Aucune classification humaine n'est encore acquise.

#### Contrat commun des lots 1b à 1e

Intrant figé : `corpus-lot-1.json` à l'empreinte ci-dessus. Chaque sous-lot
ne lit que ses enregistrements `decisions`, `competences`, `formes`,
`lignesAudit` et, pour 1e, `configurations`. Il produit
`decisions-lot-<sous-lot>.json` et `controle-<sous-lot>.md`, avec un verdict
sourcé par couple `(famille, skillCom2usId)` : **même mécanique / même
architecture / hors famille / à documenter**. Une ressemblance de nom, de
prose ou d'effet ne suffit jamais. Aucun ratio n'est étendu.

Chaque preuve cite les données lues, toutes les formes affectées et les
incertitudes. Pas de code de production ni de modification du script ; une
erreur d'extraction rouvre 1a. Chaque sous-lot validé suit `livrer` →
`verifier` → `integrer` avant le suivant.

#### Lot 1b — Blade Surge

**Cat. J.** Les 13 identifiants candidats de `famille = bladeSurge` :
`10601`, `10602`, `10603`, `10604`, `10605`, `10616`, `10618`, `10620`,
`11015`, `18314`, `23507`, `23508`, `23510`. Volume maximal mesuré :
69 enregistrements / 28 674 octets, chevauchements inter-familles inclus.
Les constats 151, 163, 173 et 180 restent distingués.

#### Lots 1c1 à 1c3 — Tempest et attaques supplémentaires

**Cat. J.** Trois ensembles disjoints dans `famille = tempest` :

- **1c1** : les 20 amorces des constats 164, 168, 178, 179, 313, plus les
  deux candidats à nom partagé `6111` et `6176` — 22 identifiants,
  97 enregistrements / 48 041 octets ; 313 reçoit un verdict explicite.
- **1c2** : candidats restants découverts uniquement par l'effet
  `Additional Attack`, triés par identifiant, positions **1 à 59** — au plus
  235 enregistrements / 110 181 octets.
- **1c3** : même liste triée, positions **60 à 118** — au plus
  268 enregistrements / 125 670 octets.

Le tri et les positions portent sur le corpus figé, jamais sur une nouvelle
extraction. 1f vérifie que les trois ensembles retrouvent exactement les 140
identifiants Tempest candidats sans doublon ni omission.

#### Lot 1d — Blade Dancers

**Cat. J.** Les six identifiants `14308`, `14310`, `14311`, `14808`,
`14810`, `14811` — 30 enregistrements / 13 210 octets. Vérifier séparément
les variantes trois et sept coups, les deux quantités de baisse d'ATB et le
dernier coup inconditionnel ; ne pas valider les valeurs curées par simple
relecture de la table initiale.

#### Lot 1e — stats acquises en combat

**Cat. C.** Les 38 identifiants / 40 configurations de
`STATS_COMBAT_PAR_ID_CONNUS`, soit au plus 239 enregistrements /
103 966 octets avec les chevauchements. Résoudre les 80 formes, la source et
la branche de rendu de chaque configuration. « Présent dans la table » ne
valide pas la valeur de jeu. Le calcul du constat 110 reste à prouver au lot
11.

#### Lot 1f — réconciliation et proposition d'amendement

**Cat. C+J.** Intrants : les six fichiers de décisions et leurs preuves ; ne
pas relire les 870 lignes brutes. Vérifier **197 couples famille/identifiant**
(13 + 140 + 6 + 38), en autorisant qu'un identifiant apparaisse dans deux
familles candidates. Aucun verdict ne reste absent ou contradictoire.

Produire `controle-1f.md` avec les listes finales par mécanique, les formes,
les incertitudes et le texte exact proposé pour les lots 8, 9, 10, 11 et
A.7. Le pilote applique ensuite cet amendement et le fait revoir ; lui seul
marque l'ensemble du lot 1 terminé.

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

### Lot 2b — déplacement et repointage selon le plan validé

**Cat. M.** Requiert le lot 2a et la validation pilote de son plan.
**Intrants :** plan et décisions de `controle-2a.md`, blocs source nommés dans
ce plan et aperçu des références. Si la source a changé, réconcilier le plan
avec le pilote avant déplacement, jamais choisir de nouvelles destinations seul.

#### Contrat exact

1. **Exécuter le classement validé en 2a**, bloc par bloc, sans requalifier
   les contenus au fil du déplacement.
2. **Destination : un dossier `spec/outils/degats-reels/`** + un
   `degats-reels.md` réduit à son routage (comme
   `spec/outils/optimizer/README.md`). Chaque fichier ≤ 500 lignes, chaque
   bloc terminal ≤ 100 — le bloc de 230 lignes se sous-titre, il ne se coupe
   pas.
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
   au slug du titre.
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

**Sortie :** tous les identifiants retenus par l'amendement du lot 1 et
toutes leurs formes de monstre calculent les deux crans. Point de départ
de l'audit seulement : `10602`, `10604`, `10616`, `10618`, `10620` ; cette
liste ne prétend pas être la famille entière du corpus. Un test nommé qui
vérifie les deux, **et** que 224 ne porte que sur 2 des 3 coups dans le
premier cran. Vérifier aussi l'absence de 411 sur la zone, les PV propres à
chaque cran pour 222/223, et la contribution par coup des dégâts additionnels.
Toute hypothèse de skillup encore non relevée est nommée dans le test (A.2 ter).

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
une place de premier coup. Les PV saisis y décrivent l'état avant Tempest.
Définir et tester l'attribution des lignes par compétence (400–403/410) selon
le profil de la contribution ; ne pas hériter aveuglément du slot S1/S2.

⚠️ **Les artéfacts 222/223** (D.CRIT+ selon bon / mauvais état des PV ennemis)
doivent voir les PV **tels que le sort précédent les a laissés**. Le
mécanisme existe déjà : `computeSkillDamageDetail` creuse `pvCourant` coup par
coup et les passifs frappent après (`degats-reels.md`, § « Les PV de la cible
se creusent COUP PAR COUP »). Le lot **prouve** que Tempest en profite ; il ne
recode pas la chaîne.

**Sortie :** les trois comportements + un test nommé par comportement.
Le constat 164 part d'un identifiant, `3213` ; toutes les formes qui le portent
et les candidats supplémentaires retenus sont nommés par l'amendement du lot 1.
Ne pas confondre la ligne d'audit Teshar et les formes affectées du corpus.

⚠️ **Le mécanisme, lui, est générique et doit le rester** (A.3 bis, second
niveau) : « un passif à formule curée, déclenché après certains sorts,
sélectionnable comme un sort ». Dix-neuf autres lignes d'audit le concernent (constats
168, 178, 179, 313 — lot 1, point 2). Le lot **n'en code aucune**, mais il
écrit dans la spec **ce qu'il faudra fournir** pour en ajouter une : le ratio,
la liste des sorts déclencheurs, la portée. Un mécanisme qui n'accepte que
Teshar serait à refaire dix-neuf fois.

**Preuve :** les tests · `npx tsc --noEmit` ·
`node tests/run.mjs <noms> degats audit-degats-conditionnels` · `npm run build`.

**Ne fait pas :** ne traite aucun des cas des 19 lignes d'audit de même architecture — ils
vont au lot 13, avec leur numéro de constat.

### Lot 10 — l'ignore DEF conditionnel des Blade Dancers

**Cat. J.** Bloqué par les lots 1, son amendement pilote et 2b. **Tout le constat 212 : 6 identifiants initiaux, deux
variantes** (A.3 bis — corriger une fiche et laisser ses jumelles donnerait une
app juste pour Cordelia et fausse pour Vereesa). Lire B.0 pour le champ
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

**Sortie :** tous les identifiants et formes retenus après lot 1 proposent
leurs crans ; les six identifiants initiaux restent le socle, pas une preuve
d'exhaustivité du corpus. Un test nommé qui vérifie
**chaque cran et le défaut des deux variantes**, que le coup 1 n'ignore jamais, que le 7ᵉ
de la variante B ignore dans tous les crans, et — contrôle négatif — qu'un sort
ignore-DEF inconditionnel (`IGNORE_DEF_COMPLET_CONNUS`, l. 2716) est
**inchangé**.

**Preuve :** le test, contrôle négatif inclus · l'extraction des identifiants et formes du
lot 1 citée dans la spec · `npx tsc --noEmit` ·
`node tests/run.mjs <nom> degats audit-degats-conditionnels`.

**Ne fait pas :** ne traite pas les 16 autres constats de la catégorie 09
(28 lignes d'audit restantes, lot 13a) — autres mécaniques d'ignore DEF conditionnel,
lot 13.

### Lot 11 — les passifs « Stats acquises en combat » non survolables

**Cat. C puis M.** Requiert le lot 1 (extraction 4 et amendement pilote) et 2b.
Les 38 identifiants / 40 configurations ci-dessous sont l'état initial,
à corriger dans ce contrat après l'extraction ; nommer toutes les formes affectées.

**Constat de départ, mesuré :** `CombatStatProfile` **porte déjà**
`description` (la prose SWARFARM, `damage.ts` l. 1676), et les 38 identifiants de
`STATS_COMBAT_PAR_ID_CONNUS` sont bien curées — **y compris Mayasura**
(`18311`, `stacks`, `atkFlat: 100`) **et Jager lumière** (`7814`, `stacks`,
`atkPct: 50`). Mais **aucune des 7 branches de rendu** de
`DamageSetupCard.tsx` (l. 960-1040) ne passe la prose :

| `source` | Configurations | Rendu actuel | Prose |
| --- | --- | --- | --- |
| `stacks` | 17 | `<span>{label}</span>` + `NumberField` | **non** — ni prose, ni icône |
| `toggle` | 11 | `PassifInterrupteur`, `title` = le label | **non** |
| `buffsPropres` / `buffsAllies` / `debuffsPropres` | 4 / 1 / 1 | idem `stacks` | **non** |
| `toujours` | 5 | `Jeton` (icône + `detail`) | **non** |
| `debuffsInverses` | 1 | `Jeton` + 3 interrupteurs | **non** |

Total : **40 configurations pour 38 identifiants** ; `10014` et `11663`
portent chacun deux configurations. Conserver les deux unités dans la preuve.

⚠️ **`Jeton` n'a aucun axe de prose** (`src/ui/Jeton.tsx` : `icone`, `libelle`,
`detail`, `onRetirer`) — et on n'ajoute à la librairie que quand un **axe**
manque, jamais une variante.

**La correction est un patron DÉJÀ en place dans la même carte**, pas une
invention : huit autres familles de passifs y affichent leur prose en
`<p className="mt-1 text-xs leading-snug text-ink-dim">{description}</p>`
**sous** le contrôle (l. 517, 554, 586, 645, 666, 729, 769, 799). Statique,
donc rien ne bouge au clic. Le lot applique ce patron aux branches qui le
perdent, **prose jamais reformulée** (les libellés sont ceux du jeu).

**Contrat :** 1) l'extraction 4 du lot 1 (40 configurations × monstre × `source` ×
branche de rendu) ; 2) le correctif par branche ; 3) la section de spec.

⚠️ **Ce que l'hypothèse de la demande recouvrait vraiment.** « Rien de visible
(Mayasura, Jaeger) » et « le sort non survolable (Cordelia) » ne sont pas deux
cas mais **un seul**, à deux rendus près : la prose n'est nulle part. Le cas
« passif absent de la table » existe aussi, mais **ni Mayasura ni Jager n'en
sont** — la table par identifiant les contient bien.

**Sortie :** `controle-11.md` avec les 38 identifiants / 40 configurations ; le correctif ;
la section de spec mise à jour.

**Preuve du constat 110 :** retrouver ou ajouter dans `tests/degats.test.ts`
un contrôle nommé pour chacun des identifiants `14313` et `14813`, construit
depuis les données réelles : extraction du profil `atkDepuisSpd: 5`, puis
calcul avec deux vitesses connues et vérification de l'apport `5 × VIT`.
Un test qui exclut Rankyaku d'une autre mécanique ne suffit pas. Conserver
la commande `node tests/run.mjs degats`, sa sortie et les assertions ciblées
dans `controle-11.md`. Aucune clôture de 110 au lot 13a sans cette preuve.

**Preuve de rendu :** le tableau · `npm run build` · relecture à l'œil sur au moins un
monstre par `source` corrigée (Mayasura pour `stacks`, Cordelia pour
`toujours`).

**Ne fait pas :** ne cure ni n'inventorie tous les passifs absents. Leur
repérage depuis l'audit et le corpus est un intrant propre du lot 13a, puis
leur qualification mécanique relève du lot 13b ; la table des présents ne
prouve jamais l'exhaustivité des manquants.

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
2. **Les familles reportées par ce chantier, nominativement** : les 19 lignes d'audit
   d'attaque déclenchée (constats 168, 178, 179, 313), les constats 163, 173,
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
