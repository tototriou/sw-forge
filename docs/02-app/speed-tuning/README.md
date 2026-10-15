# Outils · Speed tuning (`#/outils/speed-tuning`)

Voir aussi : feat-passifs-vitesse.md, ../outils/README.md, [Exporter vers l’Optimizer](feat-export-optimizer.md).

Outil de speed tune : à chaque « tick » d'horloge, la barre d'action (ATB) de
chaque monstre monte de `vitesse_combat × 7 %` ; **un seul monstre agit par
tick**. L'écran répond à une question précise — « est-ce que je joue **avant**
tel monstre ? » — d'où les deux camps et l'ordre de tour qui les entrelace.

Fichiers : [SpeedTuningSection.tsx](src/components/outils/SpeedTuningSection.tsx)
· calcul pur [speedTune.ts](src/lib/speedTune.ts) · import d'un deck de siège
[speedTuneDeck.ts](src/lib/speedTuneDeck.ts) · vitesse de combat
[speed.ts](src/lib/speed.ts). Rendu depuis [OutilsPage.tsx](src/pages/OutilsPage.tsx)
(`sub === 'speed-tuning'`).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| la formule ATB, le totem, les leads, le mode RTA | [feat-formule.md](feat-formule.md) |
| `src/lib/speedTuneDeck.ts`, « Voir le speed tune » d'un deck de siège | [feat-import-deck-siege.md](feat-import-deck-siege.md) |
| `diagnostiquerChaine` et la recherche du réglage (`src/lib/speedTune.ts`) | [feat-chaine-ouverture.md](feat-chaine-ouverture.md) |
| l'ordre des sorts, un monstre qui joue plusieurs fois, les fenêtres de vitesse | [feat-ordre-des-sorts.md](feat-ordre-des-sorts.md) |
| `src/lib/speedTuneAuto.ts`, `src/lib/speedTuneKit.ts`, `src/lib/speedTunePassif.ts`, ce qu'un sort fait | [feat-competences.md](feat-competences.md) |
| `simulerOrdre`, la règle « un seul monstre par tick » | [feat-un-monstre-par-tick.md](feat-un-monstre-par-tick.md) |
| le camp d'en face, « Copier en face », l'adversaire de référence, les égalités de barre | [feat-deux-camps.md](feat-deux-camps.md) |
| `src/components/outils/SpeedTuningSection.tsx`, `src/hooks/useSpeedTune.ts`, `src/lib/speedTuneLignes.ts`, l'état de l'outil | [feat-ecran.md](feat-ecran.md) |
| l'export de « Ton équipe » vers l'Optimizer, `src/lib/importSpeedTuneOptimizer.ts` | [feat-export-optimizer.md](feat-export-optimizer.md) |
| `scripts/passifs-vitesse.ts` (l'inventaire généré) | [feat-passifs-vitesse.md](feat-passifs-vitesse.md) |

## Documents du dossier

| Document | Contenu |
| --- | --- |
| [feat-formule.md](feat-formule.md) | La formule ATB (modèle partagé avec Mécaniques et les ticks de siège), le totem, les leads, et le mode RTA non modélisé. |
| [feat-import-deck-siege.md](feat-import-deck-siege.md) | L'import d'un deck de siège, et l'autre sens : « Voir le speed tune » depuis un deck. |
| [feat-chaine-ouverture.md](feat-chaine-ouverture.md) | Le diagnostic de la chaîne d'ouverture (problèmes dans l'ordre de jeu) et la façon dont le réglage est cherché. |
| [feat-ordre-des-sorts.md](feat-ordre-des-sorts.md) | L'ordre des sorts (sous-bloc de « Analyse automatique ») : un monstre qui joue plusieurs fois, les fenêtres de vitesse. |
| [feat-competences.md](feat-competences.md) | Les compétences lues dans le kit : effet cible par cible, tour supplémentaire, passifs de vitesse, sort lancé par défaut, retraits à l'adverse, rechargement. |
| [feat-un-monstre-par-tick.md](feat-un-monstre-par-tick.md) | La règle « un seul monstre par tick », cœur de `simulerOrdre`. |
| [feat-deux-camps.md](feat-deux-camps.md) | Les deux camps : ordre raté contre équipe coupée, « Copier en face », vitesse de runes annoncée, le plus rapide gain de passif compris, boosts sous condition, égalité de barre. |
| [feat-ecran.md](feat-ecran.md) | L'écran (rendu seul, la logique est ailleurs), son état et sa persistance. |
| [feat-export-optimizer.md](feat-export-optimizer.md) | L'export de « Ton équipe » vers l'Optimizer, depuis la page et la modale. |
| [feat-passifs-vitesse.md](feat-passifs-vitesse.md) | L'inventaire des passifs qui pèsent sur un speed tune, par catégorie. Fichier généré, à ne pas éditer. |

## Cas de contrôle

Un **deck réel** (Mihyang / Adriana / Sonia, lead 28 %, tous en Swift) est figé
dans [tests/speed-tune.test.ts](tests/speed-tune.test.ts) : vitesses de combat,
trajectoires **au millième** et ordre des tours, comparés à un outil de speed
tune de la communauté. Ce cas échoue si le Swift manque —
et il garantit que le modèle (remise à zéro sans report, un seul monstre par
tick, buff au tick marqué) reste conforme.

## Attendus

- Fonctionne **sans compte importé** : les monstres viennent du bestiaire
  (`allMonsters`, formes jouables), la vitesse de runes se saisit. Cet outil
  passe donc AVANT la garde « aucune donnée de compte » de l'Optimizer.
- Changer un lead recalcule les vitesses de combat de son camp, donc l'ordre.
- Cohérent avec le calcul de vitesse du reste de l'app (`combatSpeed`), arrondi
  du bonus % au supérieur.
