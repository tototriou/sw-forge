# Chantier — rangement des specs pour lire à la demande, pas en bloc

**Statut :** CHANTIER terminé le 2026-09-17 — branche forge/spec-rangement

Ce chantier a rendu `spec/` lisible par section plutôt qu'en bloc : trois
natures de documents (état actuel, décision, archive) avec leurs en-têtes,
`node scripts/spec-toc.mjs` (sommaire d'une spec), `scripts/spec-lint.mjs`
et son parseur partagé `scripts/lib/spec-markdown.mjs`, le périmètre et les
exceptions de `spec/spec-lint.json`, le refus au `pre-commit`, le hook
`Read` et son équivalent Codex, le skill `spec-hygiene`. Ses contrats
encore en vigueur sont dans `spec/outillage/spec.md`.

| Section citée | Place publique |
| --- | --- |
| A.1 | journal archivé |
| A.2 | `spec/outillage/spec.md`, titre « Natures de documents et règles de forme (ex-A.2) » |
| A.3 | journal archivé |
| A.5 | journal archivé |
| A.6 | journal archivé |
| A.7 | journal archivé |
| B.1 | `spec/outillage/spec.md`, titre « Déplacer vers `archive/` ou `decisions/` (ex-B.1) » |
| B.2 | `spec/outillage/spec.md`, titre « Sous-titrer un fichier, parseur `spec-markdown` (ex-B.2) » |
| B.3 | `spec/outillage/spec.md`, titre « `spec-toc` (ex-B.3) » |
| B.4 | `spec/outillage/spec.md`, titre « Contrat de `spec-lint` (ex-B.4) » |
| B.4 amendement C6 | `spec/outillage/spec.md`, titre « Amendement C6 — la nature CHANTIER » |
| B.5 | `spec/outillage/spec.md`, titre « En-têtes par nature, slugs uniques (ex-B.5) » |
| B.6 | `spec/outillage/spec.md`, titre « `invariants.md` et critère des invariants (ex-B.6) » |
| B.6 § 6a | `spec/outillage/spec.md`, titre « Extraction (ex-6a) » |
| B.6 § 6b | `spec/outillage/spec.md`, titre « Consolidation (ex-6b) » |
| B.6 § 6c | `spec/outillage/spec.md`, titre « Critère précisé (ex-6c) » |
| B.9 | `spec/outillage/spec.md`, titre « Niveaux d'application et hook `Read` (ex-B.9) » |
| B.9 § Hook `Read` | `spec/outillage/spec.md`, titre « Hook `Read` » |

Les identifiants de lot cités dans le code renvoient au journal archivé.

Journal archivé dans les notes privées du projet : `spec/outils/optimizer/archive/chantiers/spec-rangement.md`
