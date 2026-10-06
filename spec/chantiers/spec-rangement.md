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
| A.2 | `spec/outillage/spec.md`, titre « Natures de documents et règles de forme » |
| A.3 | journal archivé |
| A.5 | journal archivé |
| A.6 | journal archivé |
| A.7 | journal archivé |
| B.1 | `spec/outillage/spec.md`, titre « Déplacer, archiver ou découper un document » |
| B.2 | `spec/outillage/spec.md`, titre « Sous-titrer un fichier, parseur `spec-markdown` » |
| B.3 | `spec/outillage/spec.md`, titre « `spec-toc` » |
| B.4 | `spec/outillage/spec.md`, titre « Contrat de `spec-lint` » |
| B.4 amendement C6 | `spec/outillage/spec.md`, titre « La nature CHANTIER » |
| B.5 | `spec/outillage/spec.md`, titre « En-têtes par nature, slugs uniques » |
| B.6 | `spec/outillage/spec.md`, titre « `invariants.md` et critère des invariants » |
| B.6 § 6a | `spec/outillage/spec.md`, titre « Critère des invariants » |
| B.6 § 6b | `spec/outillage/spec.md`, titre « Critère des invariants » |
| B.6 § 6c | `spec/outillage/spec.md`, titre « Critère des invariants » |
| B.9 | `spec/outillage/spec.md`, titre « Niveaux d'application et garde-fous » |
| B.9 § Hook `Read` | `spec/outillage/spec.md`, titre « Hook `Read` » |

Les identifiants de lot cités dans le code renvoient au journal archivé.

Journal archivé dans les notes privées du projet : `spec/outils/optimizer/archive/chantiers/spec-rangement.md`
