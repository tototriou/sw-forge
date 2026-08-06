import { useMemo } from 'react';
import { Monster, RtaEntry } from '../../types';
import ElementIcon from '../ElementIcon';

const RING: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export interface TurnItem {
  monster: Monster;
  entry: RtaEntry;
}

interface Props {
  items: TurnItem[];
  onRuneSpeed: (id: string, value: number | null) => void;
}

function total(it: TurnItem): number | null {
  const b = it.monster.stats.speed;
  const r = it.entry.runeSpeed;
  return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
}

export default function TurnOrder({ items, onRuneSpeed }: Props) {
  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = total(a);
      const tb = total(b);
      // Les vitesses connues d'abord (desc), puis les inconnues.
      if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta || a.monster.name.localeCompare(b.monster.name);
    });
  }, [items]);

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-ink-dim text-[13px]">
        Ajoute des monstres pour visualiser l'ordre de tour.
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-3">
      {ordered.map((it, i) => {
        const t = total(it);
        const m = it.monster;
        return (
          <div
            key={m.id}
            className="flex-none w-[128px] rounded-xl border border-border bg-panel2 p-2.5 text-center"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-ink-dim">#{i + 1}</span>
              <span className="font-mono text-[13px] font-bold text-star">
                ⚡{t ?? '—'}
              </span>
            </div>
            <div className="relative w-[46px] mx-auto mb-1.5">
              <div
                className={`hex-frame w-[46px] h-[46px] p-[2px] bg-gradient-to-br ${RING[m.element]}`}
              >
                <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
                  {m.image ? (
                    <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`font-display font-bold text-sm ${TEXT[m.element]}`}>
                      {initials(m.name)}
                    </span>
                  )}
                </div>
              </div>
              <ElementIcon
                element={m.element}
                size={16}
                className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
              />
            </div>
            <div className="text-[11.5px] font-semibold leading-tight truncate mb-1" title={m.name}>
              {m.name}
            </div>
            <div className="font-mono text-[10px] text-ink-dim mb-1.5">
              base {m.stats.speed ?? '—'}
            </div>
            <input
              type="number"
              inputMode="numeric"
              value={it.entry.runeSpeed ?? ''}
              placeholder="+runes"
              onChange={(e) => {
                const v = e.target.value;
                onRuneSpeed(String(m.id), v === '' ? null : Number(v));
              }}
              className="w-full bg-panel border border-border rounded-md px-1.5 py-1 text-[12px] text-center
                         text-ink outline-none focus:border-[#5b63b8]"
            />
          </div>
        );
      })}
    </div>
  );
}
