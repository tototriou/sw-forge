# Mon compte — Runes (`#/compte/runes`)

Explorer et analyser **tout l'inventaire de runes**. Composant conteneur :
`RunesSection` ([RunesSection.tsx](src/components/account/RunesSection.tsx)), avec
**7 onglets internes** (« Résumé » en premier, **vue par défaut**) :

| Onglet | Composant | Rôle |
|--------|-----------|------|
| Résumé | `RunesSummary` | Vue d'ensemble chiffrée de tout l'inventaire |
| Liste | `RunesList` | Toutes les runes, filtrables/triables |
| Courbes | `RunesCurve` | Courbes de qualité (actuelle + potentiels) |
| Comparaison | `RunesCompare` | Export/import & superposition de courbes entre amis |
| Optimisation | `RunesOptim` | Ce qu'il faut grinder/gemmer pour gagner en qualité |
| Meules | `ComingSoon` | **En construction** — ce qui manque en meules, et où le farmer |
| Gemmes | `ComingSoon` | **En construction** — ce qui manque en gemmes, et où le farmer |

**Persistance** : les tris/filtres de chaque onglet (et l'onglet actif) sont
conservés à la navigation via `useStickyState` ([useStickyState.ts](src/hooks/useStickyState.ts))
— cache mémoire par clé, remis à zéro au reload (comme les données de compte).
**Un seul détail (popover) ouvert à la fois** par section (ouvrir une rune ferme
la précédente).

> 📐 **Toutes les formules, tables (efficience, grind max, gemme max) et le
> décodage SWEX** sont détaillés, valeurs comprises, dans
> [feat-calcul-runes.md](../feat-calcul-runes.md) — référence auto-suffisante.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/hooks/useRuneMetric.ts`, le choix Efficience / Score SW | [mesure.md](mesure.md) |
| `src/components/account/RunesSummary.tsx`, `src/components/account/SummaryBits.tsx` | [resume.md](resume.md) |
| `src/components/account/RunesList.tsx`, `src/components/account/Pager.tsx`, `src/components/account/SubSearchBar.tsx`, `src/components/account/SubSearchDialog.tsx`, `src/lib/runeSort.ts` | [liste.md](liste.md) |
| `src/components/account/RunesCurve.tsx`, `src/components/account/CurveChart.tsx`, `src/components/account/CurveLegend.tsx` | [courbes.md](courbes.md) |
| `src/components/account/RunesCompare.tsx`, `src/lib/runeCurveShare.ts`, `src/components/account/curveColors.ts` | [comparaison.md](comparaison.md) |
| `src/components/account/SetFilter.tsx`, `src/components/account/SlotFilter.tsx`, `src/components/account/FiltresRunes.tsx`, `src/components/account/gabaritFiltre.ts` | [filtres-set-et-slot.md](filtres-set-et-slot.md) |
| `src/components/account/RunesOptim.tsx`, `src/components/account/AncientFilter.tsx`, `src/lib/crafts.ts` | [optimisation.md](optimisation.md) |
| les onglets Meules et Gemmes | [meules-et-gemmes.md](meules-et-gemmes.md) |

## Parties

| Document | Contenu |
| --- | --- |
| [mesure.md](mesure.md) | Le choix de la mesure (Efficience ou Score SW) et l'efficience d'une rune. |
| [resume.md](resume.md) | L'onglet Résumé (`RunesSummary`) : la vue d'ensemble chiffrée de l'inventaire. |
| [liste.md](liste.md) | L'onglet Liste (`RunesList`) : la tuile qui est la carte du jeu, le tri (entrées du jeu, dans son ordre), le filtre par propriété secondaire (la modale du jeu). |
| [courbes.md](courbes.md) | L'onglet Courbes (`RunesCurve`) : courbes de qualité actuelle et potentielles, interactives au doigt et lisibles en plein écran. |
| [comparaison.md](comparaison.md) | L'onglet Comparaison (`RunesCompare`) : courbes partagées et fichiers de compte d'amis, rien de conservé, « Tout retirer », ce qui est commun aux deux. |
| [filtres-set-et-slot.md](filtres-set-et-slot.md) | Les filtres par set (`SetFilter`) et par slot (`SlotFilter`), partagés par plusieurs onglets, et leur place dans le panneau « Options » au doigt. |
| [optimisation.md](optimisation.md) | L'onglet Optimisation (`RunesOptim`) : potentiel (gemme optimale puis grind), modes, affichage, filtres à cases, « Marqueurs », « Runes utilisées », « Faisable avec ma réserve ». |
| [meules-et-gemmes.md](meules-et-gemmes.md) | Les onglets Meules et Gemmes, en construction, et pourquoi ils ne refont pas l'Optimisation. |
