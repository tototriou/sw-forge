# Import d'un compte SWEX (transverse — RTA & Siège)

Extraire des données d'un export de compte Summoners War (format SWEX). **100 %
côté navigateur** — aucun fichier n'est envoyé. Un **seul import global** remplit
**tout** d'un coup, via trois parseurs :

- **Box RTA** → prépa RTA (`parseAccountJson`).
- **Défenses de siège** → équipes de défense (`parseSiegeDefense`).
- **Offense de siège** → équipes d'attaque sauvegardées (`parseSiegeOffense`).
- **Box 6★** → page « Mon compte » (`parseAccountBox`).
- **Inventaire runes/artéfacts** → page « Mon compte » (`parseAccountInventory`).

Fichiers : [importAccount.ts](src/lib/importAccount.ts) (parseurs) ·
[applyAccount.ts](src/lib/applyAccount.ts) (mapping monstres + vitesses) ·
[AccountImportControl.tsx](src/components/AccountImportControl.tsx) (bouton nav) ·
[App.tsx](src/App.tsx) (orchestration `importAccount`).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/components/AccountImportControl.tsx`, `importAccount` de `src/App.tsx`, le dossier SW Exporter (`bureau/swex.ts`) | [bouton-import.md](bouton-import.md) |
| `parseAccountJson` de `src/lib/importAccount.ts`, la box RTA importée | [box-rta.md](box-rta.md) |
| `parseSiegeDefense`, `parseSiegeOffense`, le mapping de `src/lib/applyAccount.ts` | [equipes-siege.md](equipes-siege.md) |
| `parseAccountBox`, `parseAccountInventory`, les marqueurs et les runes utilisées | [mon-compte.md](mon-compte.md) |
| `src/lib/accountStore.ts`, `src/hooks/usePersistence.ts`, « Garder mes données », « Tout supprimer » (`clearAllData`), `src/lib/migrationStockage.ts`, `src/components/AccountFreshness.tsx` | [persistance.md](persistance.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [bouton-import.md](bouton-import.md) | Un seul bouton d'import invariant dans la barre de nav, le dossier SW Exporter de l'application de bureau, un seul `JSON.parse` par import. |
| [box-rta.md](box-rta.md) | L'import de la box RTA : objectif métier, algorithme, constantes SW, consommation côté RTA. |
| [equipes-siege.md](equipes-siege.md) | L'import des équipes de siège : défense (`parseSiegeDefense`), offense (`parseSiegeOffense`), modèle commun, mapping. |
| [mon-compte.md](mon-compte.md) | L'import pour « Mon compte » : box 6★, inventaire runes et artéfacts, marqueurs de runes, runes utilisées. |
| [persistance.md](persistance.md) | L'interrupteur de conservation de toute l'app (`usePersistence.ts`) et la persistance optionnelle du compte (`accountStore.ts`, IndexedDB) : pourquoi pas `localStorage`, ce qu'on stocke, concurrence, la question posée à chaque import, cycle de vie, âge du compte, repli ; ce que « Tout supprimer » efface et garde ; la migration des clés renommées au rebranding. |

## Confidentialité

- Traitement local uniquement ; le fichier n'est jamais poussé/envoyé.
- Vaut aussi pour le **JSON d'un ami** importé dans la comparaison de courbes
  (voir [compte/](../../compte/)) : lu en mémoire, jamais envoyé.
- Les exports de compte sont **gitignorés** (`*account*.json`, `tototriou-*.json`,
  etc.) — ne jamais committer un export réel.
