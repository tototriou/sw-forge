# Refonte de la documentation en sections

**Statut :** CHANTIER en cours — branche forge/refonte-documentation

Cadrage éphémère : il disparaît une fois son contenu passé dans `docs/`
(charte, sections, ADR). Il n'est cité par aucun autre document ; seul
[README.md](README.md) l'indexe.

## Partie A — préambule commun (relu en entier par chaque lot)

### A.1 Pourquoi

Inventaire mesuré le 2026-10-08 sur `forge/lint-et-hooks` (`4ef18a2c`) :

| Mesure | Valeur | Commande |
| --- | --- | --- |
| Specs `spec/**.md` | 87 fichiers, 28 015 lignes | `git ls-files 'spec/*.md' \| xargs cat \| wc -l` |
| Specs de plus de 300 lignes | 36 (la plus longue : 1 815, `spec/siege/recommandations.md`) | `git ls-files 'spec/*.md' \| xargs wc -l \| sort -rn` |
| Dossiers de `spec/` sans README | 5 sur 12 (`outillage`, `shared`, `outils/degats-reels`, `outils/optimizer/moteur`, `outils/degats-reels/decisions`) | boucle `ls` par dossier |
| Renvois `spec/` hors de `spec/` | 705, dans 232 fichiers (`src` 112, `tests` 56, `scripts` 42…) | `git grep -o 'spec/' -- . ':!spec/**' \| wc -l` |
| Renvois `spec/` dans `spec/` | 402 | `git grep -o 'spec/' -- 'spec/**' \| wc -l` |
| Doc hors de `spec/` | `README.md` 182, `ARCHITECTURE.md` 306, `tests/README.md` 89 lignes | `wc -l` |
| Diagrammes | 0 | `git grep -l '```mermaid' -- spec` |
| Outillage maison de la doc | 1 191 lignes : `spec-lint` 220, `spec-toc` 61, `spec-markdown` 249, leurs tests 350, test d'écriture publique 264, liste des publiés 36, `spec-lint.json` 11 | `wc -l` |

Constat : on ne trouve pas simplement ce qu'on cherche. Un même sujet vit à
plusieurs endroits (les hooks Git dans `spec/outillage/spec.md`,
`spec/outillage/qualite-code.md` et `CLAUDE.md` ; trois textes affirmaient
à tort qu'il n'existe aucun test d'interface), et l'outillage maison
(`spec-toc`, natures de documents, limites de taille) compense des fichiers
trop gros et mal routés au lieu d'en corriger la cause.

### A.2 Cible et périmètre

**Cible, vérifiable** :

- `docs/` remplace `spec/`, en sections numérotées sur le modèle de
  référence (une documentation d'entreprise, hors dépôt) :
  `01-presentation`, `02-app`, `03-developpeur`, `04-conformite`,
  `05-decisions`, `06-exploitation`, `07-pilotage` ; carte
  `docs/README.md` avec les règles de la documentation (charte, lot 0).
- Chaque dossier sous `docs/` a un `README.md` qui liste chacun de ses
  documents en une ligne : « quelle question ce fichier répond-il ».
- Un contenu à un seul endroit : les autres pointent.
- Profondeur de 3 niveaux au plus sous `docs/` (`assets/` non compté).
- `README.md` racine court ; `ARCHITECTURE.md` et `tests/README.md` absorbés
  dans `docs/` (ils pointent ou disparaissent).
- Liens internes relatifs, vérifiés en CI ; plus aucun `spec/` dans le dépôt.
- `spec-lint`, `spec-toc`, `spec-markdown`, le test d'écriture publique et
  la liste des publiés de l'Optimizer retirés ; markdownlint avec deux
  règles maison les remplace (lot 9).

**Hors périmètre** (chacun a sa ligne dans `07-pilotage`, lot 8) :

- `CLAUDE.md` et `.claude/skills/` : chantier séparé, après celui-ci. Ce
  chantier ne modifie dans `CLAUDE.md` que les phrases que ses lots rendent
  fausses (chemins `spec/`, `spec-toc`, règle public/privé).
- Le code mort (153 variables inutilisées signalées par ESLint) et les
  mentions « lot N / décision N » dans les commentaires du code.
- Les 9 points de la revue de `release/v2.0.0` (bugs) : ils entrent dans
  `07-pilotage` comme dette, pas corrigés ici.

### A.3 Hiérarchie des priorités

1. **Aucune perte de contenu normatif.** Une règle déplacée se retrouve
   textuellement dans sa destination.
2. **Aucun renvoi cassé** : le test des renvois reste vert à chaque commit.
3. **Un contenu à un seul endroit.**
4. **Trouver vite** : carte → README de section → document.
5. **Moins d'outillage maison** : un outil standard ou rien, plutôt qu'un
   script à maintenir.

Une consigne de compacité (taille de fichier) ne l'emporte jamais sur 1.

### A.4 Catégories de lots → modèle et effort

- **M — mécanique** : diff relu, `grep` vide, tests verts.
- **C — classification** : sortie structurée (tableau avec chemins source
  et destination).
- **J — jugement** : une décision par élément, citation de la source.

Affectation : M → Sonnet, effort bas ; C → Sonnet, effort moyen ; J → Opus,
effort élevé.

### A.5 Branche, chantier, fichiers transverses

- Branche `forge/refonte-documentation`, partie de `forge/lint-et-hooks` et
  non de `origin/main` (écart à la règle de CLAUDE.md, assumé) : la doc à
  réorganiser comprend `spec/outillage/qualite-code.md` et le retrait des
  hooks d'agent, absents de `main`. Fusion dans `release/v2.0.1` après
  `forge/lint-et-hooks`.
- Fichiers transverses portés par ce chantier : `docs/**`, `README.md`,
  `ARCHITECTURE.md`, `tests/README.md`, `spec/spec-lint.json`,
  `.githooks/pre-commit` (refus du dossier de l'Optimizer),
  `.githooks/optimizer-publics.txt`, `tests/renvois.test.ts`,
  `tests/fixtures/renvois-toleres.json`, et les commentaires de code qui
  citent `spec/` (renvois seulement, jamais le code).
- Chantiers voisins : `forge/pve` et `forge/edition-json` (anciens, non
  fusionnés) portent leurs propres renvois `spec/` ; ils les mettront à
  jour à leur fusion. Ne pas les toucher.

### A.6 Si une vérification échoue, si un cas est ambigu

- Une vérification échoue : on s'arrête, on ne la contourne pas
  (`--no-verify` interdit dans ce chantier), on écrit le cas dans le
  « Résultat » du lot et on le signale à Thomas.
- Un contenu dont la destination est ambiguë : on le **garde** à sa place
  la plus proche, avec `<!-- À trancher : … -->`, et une ligne dans
  `docs/07-pilotage/questions-ouvertes.md`.
- Deux textes qui se contredisent : aucun n'est retenu au jugé ; le code
  tranche quand il le peut (lire le fichier cité), sinon question ouverte.
- Validation par lot : deux arrêts, après le relevé et avant le commit.
  « Continue » ne vaut pas validation.

### A.6 bis Preuves

Chaque lot ajoute, à la fin de sa section en Partie B, un bloc
`#### Résultat (AAAA-MM-JJ)` : commit(s), commandes lancées et leur sortie
résumée, écarts au contrat. Pas de fichier de preuve séparé ; le message de
commit cite les commandes et renvoie à ce bloc.

Mécanisme de non-perte (lots 3 à 8) : pour chaque fichier source déplacé ou
découpé, un script vérifie que **chaque paragraphe** de la source (bloc
séparé par une ligne vide, hors titres) se retrouve textuellement dans
l'une des destinations déclarées, et liste les absents. Un absent est soit
réintégré, soit justifié dans le « Résultat » (doublon supprimé : chemin de
l'exemplaire gardé).

### A.7 Dépendances, ordre, suivi

Notation : `A → B : B requiert A`.

- 0 → 1 (la charte fixe les sections que le plan remplit)
- 1 → 3 (le déplacement suit le plan validé)
- 2 → 3 (les garde-fous public/privé visent des chemins `spec/` que le
  déplacement ferait mentir)
- 3 → 4, 5, 6, 7, 8 (le contenu se réécrit à sa place définitive)
- 4, 5, 6, 7, 8 → 9 (markdownlint et ses règles de taille et d'index
  supposent la structure finale ; `spec-toc` ne disparaît qu'une fois les
  gros fichiers découpés)

Ordre d'exécution = ordre des numéros.

| Lot | Cat. | Statut | Commit / date |
| --- | --- | --- | --- |
| 0 — Charte et squelette | J | à faire | |
| 1 — Plan de migration | C | à faire | |
| 2 — Garde-fous public/privé caducs | M | à faire | |
| 3 — Déplacement `spec/` → `docs/` | M | à faire | |
| 4 — `03-developpeur` | J | à faire | |
| 5 — `01-presentation` et README racine | J | à faire | |
| 6a — `02-app` : compte, siège, RTA | J | à faire | |
| 6b — `02-app` : outils hors Optimizer | J | à faire | |
| 6c — `02-app` : Optimizer | J | à faire | |
| 7 — `04-conformite` et `06-exploitation` | J | à faire | |
| 8 — `05-decisions` et `07-pilotage` | J | à faire | |
| 9 — markdownlint, retrait de l'outillage maison | M | à faire | |

## Partie B — un contrat par lot

### Lot 0 — Charte et squelette

- **Intrant** : ce cadrage (Partie A) ; le README du modèle de référence,
  fourni par Thomas le 2026-10-08 (≈ 90 lignes, hors dépôt : le demander à
  Thomas) ; `spec/README.md` (index actuel).
- **Sortie** : `docs/README.md` (carte des sept sections + règles de la
  documentation) ; un `README.md` par section, vide de documents ;
  `docs/07-pilotage/questions-ouvertes.md` vide ; CLAUDE.md : la règle
  « Public et privé » et celle du cadrage (« toujours privé ») réécrites
  pour le nouveau modèle.
- **Contrat** : les règles 1 à 11 du modèle et ses conventions de rédaction,
  adaptées sur trois points seulement : sections `02-app` (une seule app,
  une fiche par page ou outil, `feat-<slug>.md`, `transverse/`) ; français
  partout, commits compris ; restent hors du dépôt l'export de compte, les
  données personnelles et les captures. Chaque adaptation porte sa raison.
- **Preuve** : `node tests/run.mjs renvois` vert ; diff de CLAUDE.md limité
  aux deux règles.
- **Ne fait pas** : aucun déplacement de `spec/`.

### Lot 1 — Plan de migration

- **Intrant** : `node scripts/spec-toc.mjs spec` (en-têtes et titres de
  chaque spec, ≈ 1 500 lignes — à scinder par dossier si besoin) ;
  `README.md`, `ARCHITECTURE.md`, `tests/README.md` ; la charte du lot 0.
- **Sortie** : annexe `refonte-documentation-plan.md` dans ce dossier :
  une ligne par fichier source → destination(s), découpage prévu pour
  chaque fichier de plus de 300 lignes (titre par titre), doublons repérés
  (sujet, exemplaires, exemplaire gardé).
- **Contrat** : chaque fichier source apparaît exactement une fois ; chaque
  destination respecte la profondeur et le nommage de la charte ; les
  fiches `moteur/` de l'Optimizer : décision explicite `02-app` (comportement)
  ou `03-developpeur` (deep-dive technique).
- **Preuve** : script de contrôle : sources du plan = `git ls-files
  'spec/*.md'` + les trois fichiers racine, ni plus ni moins.
- **Ne fait pas** : aucun fichier déplacé. Validé par Thomas avant le lot 3.

### Lot 2 — Garde-fous public/privé caducs

- **Intrant** : `.githooks/pre-commit` (section « sous
  spec/outils/optimizer/, le publié seul »), `.githooks/optimizer-publics.txt`,
  `tests/ecriture-publique.test.ts`, `tests/pre-commit.test.ts`,
  `tests/verifier-commits.test.ts`, `tests/renvois.test.ts`.
- **Sortie** : le refus du dossier de l'Optimizer et sa liste retirés ; le
  test d'écriture publique retiré ; le test des renvois ne garde que les
  liens morts (plus de notion de « notes privées ») ; specs de
  l'outillage mises à jour.
- **Contrat** : les autres refus du `pre-commit` (chemin privé, plus de
  5 Mo, ESLint, spec-lint tant qu'il existe) sont intacts.
- **Preuve** : `node tests/run.mjs precommit verifiercommits renvois
  speclint` vert ; `git grep optimizer-publics` vide.
- **Ne fait pas** : ne touche pas à `spec-lint` ni à `spec-toc` (lot 9).

### Lot 3 — Déplacement `spec/` → `docs/`

- **Intrant** : le plan validé du lot 1.
- **Sortie** : `git mv` de chaque fichier vers sa destination **sans
  changer le contenu** (les découpages attendent les lots 4 à 8 : un
  fichier à découper est déplacé entier dans sa section) ; les 1 107
  renvois réécrits par un script de correspondance ancien → nouveau
  chemin ; `spec/spec-lint.json` pointé sur `docs/`.
- **Contrat** : le script lit la table du plan, jamais une règle de
  réécriture générique ; il échoue sur un renvoi `spec/` sans entrée.
- **Preuve** : `git grep 'spec/'` ne rend que les exceptions listées (texte
  qui ne désigne pas un chemin) ; `npx tsc --noEmit`, `npm run lint`,
  `node tests/run.mjs renvois speclint` verts ; `git diff -M --stat` :
  renommages à 100 %.
- **Ne fait pas** : aucune réécriture de contenu.

### Lot 4 — `03-developpeur`

- **Intrant** : les fichiers que le plan range dans `03-developpeur`
  (outillage, qualité du code, tests, releases, conventions communes) et
  `tests/README.md`.
- **Sortie** : onboarding, conventions, qualité et CI, tests, releases,
  deep-dives ; `tests/README.md` réduit à un renvoi ; un README de section.
- **Contrat** : les hooks Git décrits à un seul endroit ; mécanisme de
  non-perte (A.6 bis).
- **Preuve** : script de non-perte sans absent non justifié ; renvois verts.
- **Ne fait pas** : CLAUDE.md, sauf ses chemins.

### Lot 5 — `01-presentation` et README racine

- **Intrant** : `README.md`, `ARCHITECTURE.md`, la section `02-app` telle
  que déplacée.
- **Sortie** : vue d'ensemble fonctionnelle, architecture (Mermaid),
  technique, librairies, numérotés dans l'ordre de lecture ;
  `ARCHITECTURE.md` remplacé par un renvoi ; `README.md` racine court
  (présentation, installation, liens vers `docs/`).
- **Contrat** : la présentation renvoie aux fiches, elle ne les recopie pas.
- **Preuve** : non-perte de `ARCHITECTURE.md` ; renvois verts.
- **Ne fait pas** : ne réécrit pas les fiches de `02-app`.

### Lots 6a, 6b, 6c — `02-app`

Scindés sur l'intrant en lignes : 6a compte, siège, RTA (≈ 6 900 lignes) ;
6b outils hors Optimizer, dont dégâts réels (≈ 5 800) ; 6c Optimizer
(≈ 8 400). Si l'un dépasse ce qu'une session tient, il se scinde encore
par dossier, avant de commencer.

- **Sortie** : par page ou outil, un `README.md` (fiche) et des
  `feat-<slug>.md`, slug aligné sur le nom du code quand il existe ;
  les fichiers de plus de 300 lignes découpés selon le plan.
- **Contrat** : non-perte (A.6 bis) ; un contenu à un seul endroit.
- **Preuve** : script de non-perte ; renvois verts ; aucun fichier de la
  section au-delà de la taille fixée par la charte.
- **Ne fait pas** : ne corrige aucune règle de comportement ; une
  incohérence trouvée va en question ouverte.

### Lot 7 — `04-conformite` et `06-exploitation`

- **Intrant** : les passages sur les données locales, le consentement à la
  conservation, l'absence de mesure d'audience, la licence et les droits
  Com2uS ; la publication (Vercel, application de bureau, données SWARFARM).
- **Sortie** : `04-conformite` (confidentialité, données, licence) ;
  `06-exploitation` (déploiement, publication, workflows, CI).
- **Contrat, preuve, ne fait pas** : comme les lots 6.

### Lot 8 — `05-decisions` et `07-pilotage`

- **Intrant** : `spec/outils/degats-reels/decisions/` (déplacé au lot 3) ;
  les 49 notes de `sw-forge-notes` (liste seulement) ; les points hors
  périmètre de A.2.
- **Sortie** : `05-decisions/adr/` ; rapatriement des notes que Thomas
  retient, fichier par fichier ; `07-pilotage/dette.md` (code mort,
  avertissements ESLint, 9 points de revue, mentions « lot N » du code) et
  `questions-ouvertes.md`.
- **Contrat** : aucune note rapatriée sans décision de Thomas ; un ADR
  rétrospectif ne s'écrit que pour un choix encore en vigueur et cité.
- **Ne fait pas** : ne corrige aucune dette.

### Lot 9 — markdownlint, retrait de l'outillage maison

- **Intrant** : la structure finale ; `scripts/spec-lint.mjs`,
  `scripts/spec-toc.mjs`, `scripts/lib/spec-markdown.mjs` et leurs tests.
- **Sortie** : markdownlint (`markdownlint-cli2`) en lint, au `pre-commit`
  et en CI, avec deux règles maison : taille d'un document, et « chaque
  document est listé dans le README de son dossier » ; retrait de
  `spec-lint`, `spec-toc`, `spec-markdown`, `spec/spec-lint.json`, de leurs
  tests et de leurs mentions (CLAUDE.md compris).
- **Contrat** : une règle markdownlint n'est en erreur que si `docs/` la
  respecte déjà (même principe que le lint du code).
- **Preuve** : `npx markdownlint-cli2` vert ; `git grep -E
  'spec-lint|spec-toc|spec-markdown'` vide hors historique ;
  `npm test` complet vert.
- **Ne fait pas** : aucun contenu réécrit.
