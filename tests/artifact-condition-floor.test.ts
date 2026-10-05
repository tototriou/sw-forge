import type { ArtifactDetail } from '../src/types';
import type { StatKey } from '../src/lib/effects';
import { artifactConditionFloor, type ArtifactChoicesByKind } from '../src/lib/artifactConditionFloor';
import { egal, titre } from './outils';

const artifact = (kind: 'element' | 'archetype', code: number, value: number): ArtifactDetail => ({
  id: 1, kind, level: 15, rarity: 5, main: { code, value }, subs: [],
});

export default function testArtifactConditionFloor() {
  titre('Plancher des conditions d’artéfacts par emplacement');
  const empty: ArtifactDetail[] = [];
  const check = (stat: StatKey, base: number, choices: ArtifactChoicesByKind, equipped: ArtifactDetail[], expectedTotal: number, expectedBonus: number, label: string) => {
    egal(artifactConditionFloor(stat, base, false, choices, equipped), expectedTotal, `${label}, affichage total`);
    egal(artifactConditionFloor(stat, base, true, choices, equipped), expectedBonus, `${label}, affichage bonus`);
  };

  check('hp', 8000, { element: 'libre', archetype: 'libre' }, empty, 8000, 0, 'deux emplacements libres');
  check('hp', 8000, { element: 'equipped', archetype: 'equipped' }, [artifact('element', 100, 1500), artifact('archetype', 100, 1500)], 11000, 3000, 'deux emplacements équipés');
  check('hp', 8000, { element: 'equipped', archetype: 'equipped' }, empty, 8000, 0, 'aucun artéfact porté');
  check('atk', 1000, { element: 'equipped', archetype: 'libre' }, [artifact('element', 101, 100)], 1100, 100, 'équipé puis libre');
  check('atk', 1000, { element: 'libre', archetype: 'equipped' }, [artifact('archetype', 101, 100)], 1100, 100, 'libre puis équipé');
  check('atk', 1000, { element: 'libre', archetype: 101 }, empty, 1100, 100, 'libre puis principale ATQ forcée');
  check('hp', 8000, { element: 100, archetype: 'libre' }, empty, 9500, 1500, 'principale PV forcée puis libre');
  check('def', 700, { element: 'equipped', archetype: 102 }, [artifact('element', 102, 100)], 900, 200, 'équipé puis principale DEF forcée');
  check('spd', 100, { element: 'libre', archetype: 'libre' }, empty, 100, 0, 'VIT sans principale d’artéfact');
  // Pour TC/DC/RES/PRE, l'écran passe toujours bonusMode=false, même si « Stats de base exclues » est coché.
  for (const [stat, base] of [['cr', 15], ['cd', 50], ['res', 20], ['acc', 30]] as const) {
    egal(artifactConditionFloor(stat, base, false, { element: 100, archetype: 100 }, empty), base, `${stat} reste total`);
  }
}
