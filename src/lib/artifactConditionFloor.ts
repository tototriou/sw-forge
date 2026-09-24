import type { ArtifactDetail, ArtifactKind } from '../types';
import type { ArtifactMainChoice } from '../hooks/useOptimizerState';
import { ARTIFACT_MAIN, type StatKey } from './effects';
import { ARTIFACT_MAIN_VALUE } from './runeBuildOptim';

export type ArtifactChoicesByKind = Partial<Record<ArtifactKind, ArtifactMainChoice>>;

/** Plancher de saisie à partir des artéfacts garantis, dans le référentiel affiché. */
export function artifactConditionFloor(
  stat: StatKey,
  base: number,
  bonusMode: boolean,
  choices: ArtifactChoicesByKind,
  equipped: ArtifactDetail[],
): number {
  const artifactBonus = (['element', 'archetype'] as const).reduce((sum, kind) => {
    const choice = choices[kind] ?? 'libre';
    if (choice === 'libre') return sum;
    const main = choice === 'equipped'
      ? equipped.find((artifact) => artifact.kind === kind)?.main
      : { code: choice, value: ARTIFACT_MAIN_VALUE[choice] };
    return main && ARTIFACT_MAIN[main.code]?.stat === stat ? sum + main.value : sum;
  }, 0);
  return bonusMode ? artifactBonus : base + artifactBonus;
}
