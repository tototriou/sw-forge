# Siège · Recommandations (`#/siege/recommandations`)

Troisième sous-onglet du siège. Permet à un joueur de composer une
**recommandation = un ENSEMBLE de decks** (ex. « mes 6 défenses de guilde »),
chaque deck portant 3 monstres avec les **sets**, les **propriétés d'artéfact**
et les **stats à viser** sur chacun ; de **l'exporter** d'un bloc pour la partager ; et à un autre joueur de
**l'importer** puis de voir **immédiatement quels decks il peut jouer**.

Fichiers :
- [RecoBoard.tsx](src/components/siege/RecoBoard.tsx) — barre d'actions, import/export, liste.
- [RecoCard.tsx](src/components/siege/RecoCard.tsx) — une recommandation (vue & édition).
- [useSiegeRecos.ts](src/hooks/useSiegeRecos.ts) — état + persistance.
- [recoShare.ts](src/lib/recoShare.ts) — export/import JSON + validation.
- [recoMatch.ts](src/lib/recoMatch.ts) — confrontation avec le compte (calcul pur).
- [ownedBuilds.ts](src/lib/ownedBuilds.ts) — collecte de tous les builds du joueur.
- [recoFromSiege.ts](src/lib/recoFromSiege.ts) — deck pré-rempli depuis une équipe d'offense.
- [recoSearch.ts](src/lib/recoSearch.ts) — recherche d'un monstre dans les recos (calcul pur).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| l'en-tête, la barre d'outils, les boutons et couleurs de `src/components/siege/RecoCard.tsx` ou `src/components/siege/RecoBoard.tsx` | [rendu-de-la-page.md](rendu-de-la-page.md) |
| le type d'une recommandation, l'origine, la vue Attaque / Défense, `src/lib/recoDefenses.ts` | [modele.md](modele.md) |
| `src/lib/recoSearch.ts`, la recherche par monstre | [recherche-par-monstre.md](recherche-par-monstre.md) |
| les consignes, l'affichage ou la saisie des stats d'un monstre recommandé | [consignes.md](consignes.md) |
| les sets de runes recommandés | [sets-de-runes.md](sets-de-runes.md) |
| les défenses visées (« Fort contre ») | [defenses-visees.md](defenses-visees.md) |
| les propriétés d'artéfact recommandées | [proprietes-artefact.md](proprietes-artefact.md) |
| `src/lib/recoShare.ts`, `src/hooks/useSiegeRecos.ts`, l'export, l'import et sa validation | [persistance-et-partage.md](persistance-et-partage.md) |
| `src/lib/recoMatch.ts`, `src/lib/ownedBuilds.ts`, « Analyser mes decks » | [confrontation.md](confrontation.md) |
| le repli, l'édition, `src/lib/annulerEdition.ts` | [interactions.md](interactions.md) |
| `src/lib/recoFromSiege.ts`, « Importer un deck d'offense » | [import-deck-offense.md](import-deck-offense.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [rendu-de-la-page.md](rendu-de-la-page.md) | Le rendu à la souris et au doigt : en-tête, barre d'outils, en-tête d'une recommandation, crayon d'un deck, boutons d'icône et à libellé, couleurs et pastilles de statut. |
| [modele.md](modele.md) | Le modèle (une recommandation = un lot de decks), l'origine, la vue Attaque / Défense. |
| [recherche-par-monstre.md](recherche-par-monstre.md) | La recherche par monstre (jusqu'à trois, avec un rôle) : la vue, la recherche par composition, le cumul en ET, le rendu des trois cases. |
| [consignes.md](consignes.md) | Les consignes à deux niveaux et l'affichage des stats : lignes `flex-wrap`, stats de fiche seulement, raccourci « Tick rapide / Tick lent ». |
| [sets-de-runes.md](sets-de-runes.md) | Les sets de runes recommandés : plusieurs runages au choix, choix par icônes, activation côté joueur. |
| [defenses-visees.md](defenses-visees.md) | Les défenses visées (« Fort contre ») : précision en popover, recherche sans précision ouverte, bouton « + », défense vide non conservée. |
| [proprietes-artefact.md](proprietes-artefact.md) | Les propriétés d'artéfact recommandées : présence seule exigée, quelle propriété sur quelle sorte d'artéfact, choix par liste déroulante, confrontation. |
| [persistance-et-partage.md](persistance-et-partage.md) | La persistance (`localStorage`), le partage par fichier JSON (format et versions) et la validation d'un fichier importé. |
| [confrontation.md](confrontation.md) | « Analyser mes decks » : à la demande, depuis « Options » au doigt, ce que l'analyse affiche (ordre, filtres de verdict, « réalisable N fois »), source des builds, causes d'un `ko`. |
| [interactions.md](interactions.md) | Le repli de la recommandation et deck par deck, les trois niveaux d'édition, « Annuler les modifications », la rangée du titre et des icônes d'action. |
| [import-deck-offense.md](import-deck-offense.md) | « Importer un deck d'offense » : un deck pré-rempli depuis une équipe d'offense existante. |

## Limites connues / évolutions possibles

- La confrontation ne voit que les builds **présents dans l'export** : un
  monstre au niveau mais déruné (et absent de tout deck) apparaîtra « à
  améliorer ».
- Aucune notion de tolérance : le test est un **`≥` strict** sur chaque stat.
