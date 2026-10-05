import type { RelicDetail } from '../src/types';
import { RELIC_MAIN } from '../src/lib/effects';
import { artifactConditionFloor, relicConditionFloor } from '../src/lib/artifactConditionFloor';
import { egal, titre } from './outils';

const reliques: RelicDetail[] = [100, 101, 102].map((code, index) => ({ id: 77 + index, upgrade: 15, main: { code, value: 8 } }));

export default function testArtifactRelicConditionFloor() {
  titre('Plancher des conditions avec relique équipée');
  const bases: Record<'hp' | 'atk' | 'def', number> = { hp: 8001, atk: 1001, def: 701 };
  const choix = ['equipped', 'libre', 100, 101, 102] as const;
  const bonusGaranti = (stat: keyof typeof bases, relic: RelicDetail | undefined, relicChoice: typeof choix[number]) => {
    if (!relic || relicChoice !== 'equipped' || RELIC_MAIN[relic.main.code]?.stat !== stat) return 0;
    return Math.ceil(bases[stat] * relic.main.value / 100);
  };

  for (const relicChoice of choix) {
    for (const relicEquip of [...reliques, undefined] as const) {
      for (const stat of ['hp', 'atk', 'def'] as const) {
        const base = bases[stat];
        const expectedBonus = bonusGaranti(stat, relicEquip, relicChoice);
        const floor = artifactConditionFloor(stat, base, false, {}, []) + relicConditionFloor(stat, base, relicChoice, relicEquip);
        egal(floor, base + expectedBonus, `${relicChoice}, ${relicEquip ? 'avec' : 'sans'} relique, ${stat}, total`);
        egal(artifactConditionFloor(stat, base, true, {}, []) + relicConditionFloor(stat, base, relicChoice, relicEquip), expectedBonus, `${relicChoice}, ${relicEquip ? 'avec' : 'sans'} relique, ${stat}, bonus`);
      }
    }
  }

  console.log('Mesure — relique portée de principale PV/ATQ/DEF à +8 % ; vecteurs dans l’ordre PV/ATQ/DEF :');
  for (const relicChoice of choix) {
    const equippe = reliques.map((relic) => {
      const total = (['hp', 'atk', 'def'] as const).map((stat) =>
        artifactConditionFloor(stat, bases[stat], false, {}, []) + relicConditionFloor(stat, bases[stat], relicChoice, relic)
      );
      const bonus = (['hp', 'atk', 'def'] as const).map((stat) =>
        artifactConditionFloor(stat, bases[stat], true, {}, []) + relicConditionFloor(stat, bases[stat], relicChoice, relic)
      );
      return `${relic.main.code} total ${total.join('/')} ; bonus ${bonus.join('/')}`;
    });
    const sansTotal = (['hp', 'atk', 'def'] as const).map((stat) =>
      artifactConditionFloor(stat, bases[stat], false, {}, []) + relicConditionFloor(stat, bases[stat], relicChoice, undefined)
    );
    const sansBonus = (['hp', 'atk', 'def'] as const).map((stat) =>
      artifactConditionFloor(stat, bases[stat], true, {}, []) + relicConditionFloor(stat, bases[stat], relicChoice, undefined)
    );
    console.log(`  ${relicChoice}: avec ${equippe.join(' ; ')} | sans total ${sansTotal.join('/')} ; bonus ${sansBonus.join('/')}`);
  }
}
