# État de la migration spec/ → docs/

Point d'arrêt de la migration de l'ancien dossier spec vers `docs/`, pour la
reprendre dans une autre session. **À supprimer** une fois la migration
commitée.

## Où on en est

- Branche : `forge/refonte-documentation` (partie de `forge/lint-et-hooks`).
- **Rien de la migration n'est commité.** Les 87 déplacements (`git mv`),
  la nouvelle config `scripts/spec-lint.json` et toutes les corrections de
  liens sont dans l'index et l'arbre de travail. Ne pas faire de
  `git stash`, `git checkout -- .` ni `git reset` avant le commit.
- Commits déjà faits sur la branche : le cadrage, la charte et le squelette
  des sections, le retrait des garde-fous public/privé de l'ancien spec.
- L'ancien dossier spec est vide et supprimé ; chaque fichier est à sa
  place dans `docs/` (mapping visible par `git status`, lignes `R`).

## Conventions appliquées aux liens (décidées, à garder)

- Corrections **à la main, fichier par fichier** (outil `Edit`), jamais par
  script ni `sed`.
Les chemins ci-dessous sont donnés depuis la racine du dépôt ; dans un
fichier, le lien s'écrit en relatif depuis ce fichier.

- Lien vers **un autre dossier** → lien relatif vers le **dossier**, pas le
  fichier (par ex. vers `docs/02-app/degats-reels/` ou
  `docs/03-developpeur/optimizer/`). Le nom de l'ancien fichier et la
  section restent dans le libellé, sur le modèle
  « degats-reels/ (formules et combat) § Volontairement hors modèle ».
  Une ancre disparaît ; le titre de la section passe dans le libellé.
- Lien vers **le même dossier** → on garde le lien vers le fichier, sous son
  nouveau nom (`feat-exclusion.md`, `moteur-elagages.md`).
- L'ancien README du dossier spec (les conventions) → dossier
  `docs/03-developpeur/` ; l'ancienne interface partagée (design, librairie
  UI, deux formats) → dossier `docs/03-developpeur/interface/`.
- Liens vers le code : recalculer la profondeur (trois remontées depuis un
  fichier de `docs/<section>/<dossier>/`) ; un chemin qui commence par
  `src/` sans remontée se résout aussi (base racine du dépôt).
- ⚠️ Le test relève aussi les chemins **cités dans le texte** (entre
  backticks ou non), pas seulement les liens Markdown.

## Ce qui reste à faire, dans l'ordre

### 1. Liens morts restants

Mesure : `node tests/run.mjs testrenvois` (la sortie liste chaque lien mort
deux fois ; trier et dédoublonner). À l'arrêt : **112 lignes relevées**,
dont :

**`docs/03-developpeur/optimizer/` — moteur (≈ 62)**, pas encore commencé :
moteur-elagages (13), moteur-optimiseur-artefacts (12), moteur-reliques (10),
moteur-pipeline (7), moteur-parallelisation (7), moteur-diagnostics (7),
moteur-artefacts (6), invariants (2 × pistes.md). Correspondances (ces
fichiers étaient dans l'ancien sous-dossier moteur de l'Optimizer) :

| Ancienne cible (vue depuis l'ancien sous-dossier moteur) | Nouvelle cible |
| --- | --- |
| les fiches écran, exclusion, interruption, listes et réservation, limites connues, le README de routage, la fiche d'entrée de l'Optimizer | dossier `docs/02-app/optimizer/` |
| un fichier du même sous-dossier moteur | `moteur-<nom>.md` (même dossier) |
| verification, harnais, harnais-extensions, harnais-scripts, invariants | même dossier, même nom |
| pistes, pistes-vitesse-et-verification | dossier `docs/07-pilotage/` |
| un fichier de l'ancien dossier dégâts réels | dossier `docs/02-app/degats-reels/` |
| un fichier de l'ancien dossier shared | `docs/02-app/transverse/` ou `docs/03-developpeur/interface/` selon le fichier |
| le code (quatre remontées) | trois remontées |

**`docs/02-app/optimizer/` — chemins cités dans le texte (≈ 25)** : les
liens Markdown sont faits ; restent des chemins **cités entre backticks**,
écrits avec la profondeur de l'ancien sous-dossier écran (vers exclusion,
interruption, listes et réservation, limites connues, un fichier moteur,
la librairie UI), dans feat-ecran-conditions-et-reglages,
feat-ecran-resultats, feat-ecran, feat-ecran-recherche-du-monstre,
feat-ecran-etat-de-mon-monstre, feat-ecran-equipement-actuel,
feat-ecran-lancer-la-recherche, feat-ecran-objectif-de-recherche ; et dans
limites-connues, harnais-extensions.md (3) et harnais-scripts.md (1) →
dossier `docs/03-developpeur/optimizer/`. La fiche de routage
(`routage-par-tache.md`, déjà faite) sert de modèle.

**Ailleurs (déjà tolérés sous l'ancien chemin, voir étape 2)** :
bestiaire/README (components/, components/account/), compte/feat-artefacts
et rta/feat-sections-runes (DetailPopover.tsx), compte/feat-calcul-artefacts
(artifacts/), speed-tuning/README (3 chemins de code),
transverse/feat-import-compte (useKeepAccount.ts),
03-developpeur/outillage-docs (chantiers/ × 6).

### 2. Liste des tolérances

`tests/fixtures/renvois-toleres.json` porte encore ses clés sous les anciens
chemins du dossier spec, d'où les 2 échecs du test.

- **Renommer** chaque clé vers le nouveau fichier : bestiaire →
  `docs/02-app/bestiaire/README.md` ; DetailPopover → `docs/02-app/compte/feat-artefacts.md`
  et `docs/02-app/rta/feat-sections-runes.md` ; artifacts/ →
  `docs/02-app/compte/feat-calcul-artefacts.md` ; speed-tuning →
  `docs/02-app/speed-tuning/README.md` ; useKeepAccount →
  `docs/02-app/transverse/feat-import-compte.md` ; chantiers/ →
  `docs/03-developpeur/outillage-docs.md`.
- **Retirer** les entrées périmées (le lien n'existe plus) : les commentaires
  de src/components/account/SetFilter.tsx, rta/CategoryBar.tsx,
  rta/TurnOrder.tsx, siege/LeadPill.tsx (× 3), siege/RecoCard.tsx, et les
  trois entrées Segmented.tsx (anciens recommandations siège, recherche
  clavier, README de spec).

### 3. Cibles qui ont changé sans casser

Un lien peut encore se résoudre tout en pointant ailleurs qu'avant. Cas
connus à vérifier dans toute la doc migrée :

- `README.md` dans le dossier Optimizer désignait le **routage** ; c'est
  maintenant la **fiche** → `routage-par-tache.md`.
- `../README.md` désignait les conventions de l'ancien spec ; selon la
  profondeur, il tombe maintenant sur un README de section.
- Les champs d'en-tête **Voir aussi** des fichiers moteur citent des chemins
  en texte simple, que le test ne vérifie pas.

### 4. Vérifier et commiter

```
npx tsc --noEmit
node tests/run.mjs testrenvois speclint spectoc precommit
node scripts/spec-lint.mjs
npm test            # suite complète, avant le commit de migration
```

Puis un commit (message par heredoc, en français) : déplacement de spec vers
docs et mise à jour des liens. Le `pre-commit` lance spec-lint sur les
fichiers de `docs/` indexés : le hook installé doit être celui de l'arbre
(`node scripts/installer-hooks.mjs` s'il refuse pour une raison périmée).
Supprimer ce fichier dans le même commit, ou juste après.

## Après la migration (décision à prendre)

- Restructurer le contenu des docs (découpage, index README par dossier,
  ligne de chaque nouveau document dans le README de section).
- Retirer spec-lint et spec-toc au profit d'une doc bien routée.
- Mettre à jour CLAUDE.md, ARCHITECTURE.md et les skills (chemins spec/ →
  docs/).
- Décider du cadre de tests (Vitest, tests de bout en bout, couverture).
- Purge du code mort et des mentions de lot, de décision et de date.
- Fusionner `forge/lint-et-hooks` et `forge/refonte-documentation` dans
  `release/v2.0.1`.
