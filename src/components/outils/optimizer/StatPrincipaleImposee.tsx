import { CONFIGURABLE_SLOTS } from './constantes';
import { SLOT_MAIN_OPTIONS } from '../../../lib/runeBuildOptim';
import { Pastille } from '../../../ui';
import { RUNE_EFFECT } from '../../../lib/effects';

export interface StatPrincipaleImposeeProps {
  mainStatsBySlot: Partial<Record<2 | 4 | 6, number[]>>;
  toggleMainStat: (slot: 2 | 4 | 6, code: number) => void;
}

export default function StatPrincipaleImposee({ mainStatsBySlot, toggleMainStat }: StatPrincipaleImposeeProps) {
  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="label">Statistique principale imposée (slots pairs)</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {CONFIGURABLE_SLOTS.map((slot) => (
          <div key={slot} className="flex items-center gap-2 flex-wrap">
            <span className="text-micro text-ink-dim w-14">Slot {slot}</span>
            {SLOT_MAIN_OPTIONS[slot].map((code) => {
              const active = (mainStatsBySlot[slot] ?? []).includes(code);
              return (
                <Pastille
                  key={code}
                  actif={active}
                  onClick={() => toggleMainStat(slot, code)}
                  libelle={RUNE_EFFECT[code]?.label ?? code}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
