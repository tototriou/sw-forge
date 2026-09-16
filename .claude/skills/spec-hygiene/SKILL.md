---
name: spec-hygiene
description: Trois recettes pour manipuler spec/ sans perdre d'information ni casser les références — déplacer un fichier entre natures (état actuel / décision / archive), découper un fichier en exception de spec-lint.json le jour où un chantier doit en modifier le contenu normatif, et extraire les invariants d'une section d'état actuel nouvelle ou modifiée. Née du cadrage CADRAGE-rangement-specs.md (lots 1 à 9).
---

# Hygiène de `spec/` (SW Forge)

Déclencheur **opérationnel**, au sens strict (B.9) : un chantier qui doit
**modifier le contenu normatif** d'un fichier — ajouter ou changer une règle,
un comportement, une valeur. Une faute de frappe, un lien à réparer, un
en-tête à poser, un changement de statut : **aucune des trois recettes
ci-dessous ne se déclenche**, un simple `Edit` suffit.

## (a) Déplacer un fichier entre natures

Un document change de nature (A.2) quand ce qu'il affirme change de statut —
une décision devenue obsolète part en `archive/`, une analyse dont la
conclusion est reprise ailleurs aussi, un cadrage encore rouvrable part en
`decisions/`. Le critère est **où vit la conclusion maintenant**, jamais le
genre littéraire du texte (B.1).

1. **Déplacer** le fichier avec `git mv`, jamais une copie + suppression : on
   veut l'historique, pas un nouveau fichier qui commence à zéro.
2. **Reposer l'en-tête** selon la nature cible (modèles en B.5 du cadrage) —
   `**Statut :**` change, le reste de l'en-tête suit son gabarit.
3. **Repointer les liens** qui visaient l'ancien chemin — d'ABORD en
   **aperçu** (un script qui liste les fichiers/lignes concernés sans écrire,
   ex. un `grep -rn` de l'ancien chemin sur `spec/`), jamais une réécriture à
   l'aveugle : une référence `fichier § Titre` (B.9) est sensible au chemin
   ET au slug du titre visé.
4. **Relire le diff** produit par le repointage avant de le committer — un
   script d'aperçu qui a raison sur 40 occurrences peut avoir tort sur la
   41e (un lien dans un bloc de code, une référence déjà cassée avant le
   déplacement).
5. **Vérifier** : `node scripts/spec-lint.mjs` (ou `node tests/run.mjs
   spec-lint`) — une référence cassée par le déplacement y apparaît comme
   `reference-cassee`, jamais silencieusement.

## (b) Découper un fichier listé en exception

Un fichier de `spec/spec-lint.json` (`exceptions`) dépasse 500 lignes ou
porte un bloc > 100 — toléré tant que personne n'a besoin d'y toucher
normativement (A.2, note produit/dette). Le jour où un chantier doit changer
son contenu, ne pas ajouter au tas : découper d'abord.

1. **Trier le contenu livré du contenu envisagé.** Ce qui décrit le
   comportement ACTUEL (état actuel) et ce qui est une piste, une intention,
   un TODO (à classer dans `pistes.md` et, si c'est une conclusion encore
   valable à rouvrir un jour, dans `decisions/`) ne vivent pas dans le même
   fichier.
2. **Découper l'état actuel en sections ≤ 500 lignes**, chacune avec son
   propre en-tête (B.5) — un fichier par sous-thème plutôt qu'un fichier
   fourre-tout redécoupé artificiellement : le découpage suit le contenu, pas
   l'inverse.
3. **Poser les en-têtes** sur chaque fichier issu du découpage, selon sa
   nature (état actuel, décision) — jamais de fichier actif sans en-tête
   reconnu (`entete`, B.9).
4. **Retirer l'exception** correspondante de `spec/spec-lint.json` une fois
   qu'aucun des fichiers issus du découpage ne dépasse plus les seuils —
   sinon `exception-perimee` (B.9) le signale au prochain lint : c'est le
   filet, pas le déclencheur de l'étape.
5. **Vérifier** : `node scripts/spec-lint.mjs` propre, `grep -rn` de l'ancien
   nom de fichier sur `spec/` pour repointer les références externes (même
   recette qu'en (a), étape 3-4).

## (c) Extraire les invariants d'une section d'état actuel

Ce qu'un chantier applique quand il **ajoute ou modifie une section d'état
actuel** et doit décider ce qui entre dans `invariants.md` — né du lot 6a,
critère précisé au 6c après que « ça casse quelque chose si on l'ignore »,
seul, a laissé passer plusieurs règles (`controle-6b.md` § 7, archivé sous
`spec/outils/optimizer/archive/controles-rangement-2026-09/`).

**Le critère n'est pas « est-ce important »** mais une des trois familles
suivantes, chacune formulée en **description** du comportement actuel — pas
en impératif, pas en check-list de procédure :

- **Dérivé de** — une valeur affichée ou utilisée n'est jamais saisie
  directement, elle se déduit d'autre chose. Exemple réel (6c) : « un effet
  aug. VIT / critique garanti équipé est **déduit et affiché**, jamais
  redemandé » — un champ de saisie ajouté plus tard casserait cette règle
  sans qu'aucun test ne le voie, précisément parce que rien ne « casse » au
  sens naïf.
- **Ordre fixe** — un pipeline, une séquence d'étapes dont l'ordre est
  significatif et non réordonnable sans changer le résultat.
- **Constante** — une valeur numérique ou un seuil qui n'est dérivable
  d'aucune règle plus générale, et qui casserait silencieusement si on la
  changeait ailleurs sans le savoir.

Une règle qui ne rentre dans AUCUNE des trois reste dans sa section source :
`invariants.md` n'est pas un résumé de tout ce qui est vrai, seulement de ce
qu'un chantier qui touche à côté risque de casser sans le remarquer.

1. Relire la section modifiée (ou nouvelle) en entier une fois.
2. Pour chaque règle candidate, la confronter aux trois familles — pas à
   l'intuition « c'est important ».
3. Ajouter les règles retenues à `invariants.md`, formulées en description
   (« X est dérivé de Y », pas « ne pas ajouter de champ pour X »).
4. **Contrôle de précision** minimal sur ce qui est ajouté : citer la ligne
   source de chaque règle retenue — pas de règle sans coordonnée.

## Voir aussi

- `CADRAGE-rangement-specs.md`, B.1 (natures), B.4 (contrat du lint), B.5
  (gabarits d'en-tête), B.6 § 6c (critère précisé), B.9 (ce skill).
- `node scripts/spec-toc.mjs <fichier>` pour lire une section sans charger
  le fichier entier avant de décider quoi découper ou extraire.
