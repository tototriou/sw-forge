# Preuve — lot 1, le format de session

**Statut :** CHANTIER en cours — branche forge/sauvegarde-session

Chantier [sauvegarde-session.md](../sauvegarde-session.md), lot 1,
décisions 5 et 6. Mené le 2026-10-06 sur `forge/sauvegarde-session`.

## Relevé

- Stockage local : 13 clés retenues (travail et réglages), relevées par
  `git grep` des `STORAGE_KEY`/`KEY` des hooks ; « Garder mes données »
  (`-persist-v1`) et l'ancienne clé du siège (`-siege-v1`) écartées.
- ⚠️ Les quatre réglages ne sont **pas** du JSON : thème (`auto`/`light`/
  `dark`), score (`eff`/`score`), overcap et adversaire (`0`/`1`), écrits
  tels quels — la première validation (« tout est du JSON ») aurait refusé
  toute session au thème choisi ; corrigé avant les tests.
- Mémoire : une cinquantaine de clés `useStickyState`, dont une quinzaine
  de `Set` ; deux préférences d'interface écartées (décision 5).
- Optimizer : la recette existante (`buildOptimizerRecipe`,
  `parseOptimizerRecipe`) porte ses critères — réutilisée.
- Compte : `StoredAccount`, JSON pur ; sa validation, interne à
  `loadAccount`, extraite en `compteValide` (pure), partagée.

## Ce qui a été construit

- `src/lib/session.ts` : `FORMAT_SESSION`, `VERSION_SESSION`,
  `CLES_SESSION`, `STICKY_HORS_SESSION`, `encoder`/`decoder` (`Set`, `Map`),
  `composerSession`, `ecrireSession`, `nomFichierSession`, `lireSession`,
  `valeurStockageValide`.
- `src/lib/accountStore.ts` : `compteValide`, `loadAccount` passe par elle.
- `spec/shared/sauvegarde-session.md` (état actuel).

## Preuve — tests

`node tests/run.mjs session` → **40 passées** :

- aller-retour composer → écrire → relire : stockage rendu tel quel, compte
  identique, équipe du speed tuning, recherche de la box, `Set` et `Map`
  revenus avec leur type et leur ordre, recette de l'Optimizer ; « Garder
  mes données », clé étrangère et préférences d'interface absents ;
- refusés : texte illisible, tableau, autre export, version 2, version
  `"1"`, stockage non objet, thème `violet`, prépa RTA non JSON, valeur non
  texte ;
- lus et dits : compte de schéma 6, recette illisible ; ignorés : champ et
  clé inconnus ; session sans compte lue sans avertissement ;
- nom du fichier daté, à deux chiffres ;
- **avec le vrai compte du développeur** : aller-retour identique,
  **2,68 Mo**.

Non-régression : `stockage` (relecture du compte) **59 passées** ;
`renvois` ; `tsc` ; `npm run build`.

## Ce qui n'est pas prouvé

- Rien n'est encore branché : ni lecture de l'app vers une session (lot 2),
  ni application d'une session à l'app (lot 3).
- La photo de l'état en mémoire (`useStickyState`) et sa restauration dans
  les écrans affichés : lot 2 (photo) et lot 3 (restauration).
