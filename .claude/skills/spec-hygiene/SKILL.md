---
name: spec-hygiene
description: "Trois recettes pour manipuler docs/ sans perdre d'information ni casser les références — déplacer un fichier entre natures (état actuel / décision) ou l'archiver (le retirer du public et le ranger dans les notes privées), découper un fichier en exception de spec-lint.json le jour où un chantier doit en modifier le contenu normatif, et extraire les invariants d'une section d'état actuel nouvelle ou modifiée. Contrat : docs/03-developpeur/."
---

# Hygiène de `docs/` (SW Blacksmith)

Déclencheur **opérationnel**, au sens strict : un chantier qui doit
**modifier le contenu normatif** d'un fichier — ajouter ou changer une règle,
un comportement, une valeur — ou retirer un document du public. Une faute de
frappe, un lien à réparer, un en-tête à poser, un changement de statut :
**aucune des trois recettes ci-dessous ne se déclenche**, un simple `Edit`
suffit.

Contrat de référence : `docs/03-developpeur/` (titres cités entre
guillemets ci-dessous).

## (a) Déplacer ou archiver un document

Un document change de nature quand ce qu'il affirme change de statut. Le
critère est **où vit la conclusion maintenant**, jamais le genre littéraire
du texte (« Natures de documents et règles de forme »).

- Une conclusion encore en vigueur, qu'un chantier peut devoir rouvrir, va
  dans le dossier `decisions` de la zone, avec sa raison.
- Un document qui n'est plus une source de vérité active (historique,
  analyse close, preuve, récit, délibération) **quitte le public** : tout
  `docs/` est public, et ces textes sont privés (« Public et privé »).

**Déplacer** :

1. `git mv`, jamais une copie + suppression : l'historique suit le fichier.
2. **Reposer l'en-tête** selon la nature cible (« En-têtes par nature, slugs
   uniques ») — `**Statut :**` change, le reste suit son gabarit.

**Archiver** :

1. **Copier** le document, ou le passage, à l'identique dans les notes
   privées du projet.
2. **Le retirer** du dépôt (`git rm`), ou retirer le passage de la spec.
3. Aucun renvoi public ne désigne la copie privée : un renvoi vers le
   document retiré est réécrit (l'information utile passe dans la spec qui
   le citait) ou supprimé.

**Repointer**, dans les deux cas :

1. **Repointer les liens** qui visaient l'ancien chemin — d'ABORD en
   **aperçu** (un script qui liste les fichiers et lignes concernés sans
   écrire, sur le nom de fichier complet avec extension), jamais une
   réécriture à l'aveugle : une référence `fichier § Titre` est sensible au
   chemin ET au slug du titre visé.
2. **Relire le diff** produit par le repointage avant de le committer — un
   script d'aperçu qui a raison sur 40 occurrences peut avoir tort sur la
   41e (un lien dans un bloc de code, une référence déjà cassée avant).
3. **Vérifier** : `node scripts/spec-lint.mjs` (une référence cassée y
   apparaît comme `reference-cassee`) et `node tests/run.mjs renvois` (un
   renvoi vers un fichier absent y échoue).

## (b) Découper un fichier listé en exception

Un fichier de `scripts/spec-lint.json` (`exceptions`) dépasse 500 lignes ou
porte un bloc > 100 — toléré tant que personne n'a besoin d'y toucher
normativement (« Périmètre et exceptions »). Le jour où un chantier doit
changer son contenu, ne pas ajouter au tas : découper d'abord.

1. **Trier le contenu livré du contenu envisagé.** Ce qui décrit le
   comportement ACTUEL (état actuel) et ce qui est une piste, une intention,
   un TODO (à classer dans les pistes futures de la zone et, si c'est une
   conclusion encore valable à rouvrir un jour, dans son dossier
   `decisions`) ne vivent pas dans le même fichier. Ce qui n'est ni l'un ni
   l'autre (historique, récit) s'archive, recette (a).
2. **Découper l'état actuel en fichiers ≤ 500 lignes**, chacun avec son
   propre en-tête — un fichier par sous-thème plutôt qu'un fichier
   fourre-tout redécoupé artificiellement : le découpage suit le contenu,
   pas l'inverse.
3. **Poser les en-têtes** sur chaque fichier issu du découpage, selon sa
   nature (état actuel, décision) — jamais de fichier actif sans en-tête
   reconnu (`entete`).
4. **Retirer l'exception** correspondante de `scripts/spec-lint.json` une fois
   qu'aucun des fichiers issus du découpage ne dépasse plus les seuils —
   sinon `exception-perimee` le signale au prochain lint : c'est le filet,
   pas le déclencheur de l'étape.
5. **Vérifier** : `node scripts/spec-lint.mjs` propre, puis repointer les
   références externes à l'ancien nom (recette (a), « Repointer »).

## (c) Extraire les invariants d'une section d'état actuel

Ce qu'un chantier applique quand il **ajoute ou modifie une section d'état
actuel** et doit décider ce qui entre dans `invariants.md`. Critère et
conduite : « Critère des invariants » ; forme d'une entrée : « Statut du
fichier ».

**Le critère n'est pas « est-ce important »** mais : un chantier qui
ignore la règle casse-t-il quelque chose ? Trois familles y répondent
souvent sans que rien ne casse au sens naïf, et se lisent comme une
description du comportement actuel : la relecture les cherche
explicitement, sans en faire une liste fermée.

- **Dérivé de** — une valeur affichée ou utilisée n'est jamais saisie
  directement, elle se déduit d'autre chose. Exemple réel : « un effet
  aug. VIT / critique garanti équipé est **déduit et affiché**, jamais
  redemandé » — un champ de saisie ajouté plus tard casserait cette règle
  sans qu'aucun test ne le voie, précisément parce que rien ne « casse » au
  sens naïf.
- **Ordre fixe** — un pipeline, une séquence d'étapes dont l'ordre est
  significatif et non réordonnable sans changer le résultat.
- **Constante** — une valeur numérique ou un seuil qui n'est dérivable
  d'aucune règle plus générale, et qui casserait silencieusement si on la
  changeait ailleurs sans le savoir.

Y entre aussi une règle de méthode dont l'oubli fausse une conclusion
(mesure, harnais). Le reste demeure dans sa section source :
`invariants.md` n'est pas un résumé de tout ce qui est vrai, seulement de ce
qu'un chantier qui touche à côté risque de casser sans le remarquer.

1. Relire en entier **toutes** les sections d'état actuel touchées, pas
   seulement celles qui semblent candidates.
2. Pour chaque règle candidate, poser la question du critère en cherchant
   les trois familles et les règles de méthode — pas l'intuition « c'est
   important ».
3. Retrouver chaque règle retenue dans une source normative du dépôt :
   jamais un fichier d'un dossier `decisions`, qui se cite, jamais la seule
   mémoire d'un agent.
4. La comparer à `invariants.md` existant ; n'ajouter que les absentes.
5. Écrire chaque entrée comme une contrainte, impérative ou descriptive,
   qui dit ce qui doit rester vrai (« X est dérivé de Y » ou « Dériver X
   de Y », pas « ne pas ajouter de champ pour X »), suivie de
   `Source : fichier § section`.
6. **Contrôle de précision** minimal sur ce qui est ajouté : citer la ligne
   source de chaque règle retenue — pas de règle sans coordonnée.

## Voir aussi

- `docs/03-developpeur/`, la référence : « Public et privé »,
  « Natures de documents et règles de forme », « Déplacer, archiver ou
  découper un document », « Contrat de `spec-lint` », « En-têtes par
  nature, slugs uniques », « Statut du fichier », « Critère des invariants ».
- `node scripts/spec-toc.mjs <fichier>` pour lire une section sans charger
  le fichier entier avant de décider quoi découper ou extraire.
