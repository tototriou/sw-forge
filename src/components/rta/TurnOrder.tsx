import { useMemo, useState } from 'react';
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

// Leader skills de vitesse, du plus fort au plus faible.
const LEADS = [33, 30, 28, 24, 23, 19];

// Totem de vitesse de guilde : +15% de vitesse de base pour tous, toujours actif.
const TOTEM = 15;

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

// Vitesse totale hors lead (base + runes).
function rawTotal(it: TurnItem): number | null {
  const b = it.monster.stats.speed;
  const r = it.entry.runeSpeed;
  return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
}

// Bonus en % appliqué à la vitesse de BASE (totem + lead), arrondi au supérieur.
function pctBonus(it: TurnItem, lead: number): number {
  const base = it.monster.stats.speed;
  if (base === null) return 0;
  return Math.ceil((base * (TOTEM + lead)) / 100);
}

// Vitesse effective = total (base + runes) + bonus % sur la base (totem + lead).
function effective(it: TurnItem, lead: number): number | null {
  const raw = rawTotal(it);
  if (raw === null) return null;
  return raw + pctBonus(it, lead);
}

export default function TurnOrder({ items, onRuneSpeed }: Props) {
  const [lead, setLead] = useState(0);

  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = effective(a, lead);
      const tb = effective(b, lead);
      if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta || a.monster.name.localeCompare(b.monster.name);
    });
  }, [items, lead]);

  return (
    <div>
      {/* Boutons de lead SPD : du plus gros au plus petit */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-dim mr-1">
          Lead SPD
        </span>
        {LEADS.map((pct) => {
          const active = lead === pct;
          return (
            <button
              key={pct}
              onClick={() => setLead(active ? 0 : pct)}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-mono font-semibold transition select-none
                ${
                  active
                    ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star shadow'
                    : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                }`}
            >
              +{pct}%
            </button>
          );
        })}
        <button
          onClick={() => setLead(0)}
          className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
            ${
              lead === 0
                ? 'bg-panel2 border-[#4a52a0] text-ink shadow'
                : 'bg-panel border-border text-ink-dim hover:text-ink'
            }`}
        >
          Sans lead
        </button>
        <span className="font-mono text-[10px] text-ink-dim ml-1">totem +15% inclus</span>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-ink-dim text-[13px]">
          Ajoute des monstres pour visualiser l'ordre de tour.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5 pb-3">
          {ordered.map((it, i) => {
            const eff = effective(it, lead);
            const m = it.monster;
            return (
              <div
                key={m.id}
                className="flex-none w-[128px] rounded-xl border border-border bg-panel2 p-2.5 text-center"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] text-ink-dim">#{i + 1}</span>
                  <span className="font-mono text-[13px] font-bold text-star">{eff ?? '—'}</span>
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
      )}
    </div>
  );
}
