import { useMemo, useState } from 'react';
import { Monster, RtaEntry } from '../../types';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;

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

// Tri par vitesse effective décroissante (le plus rapide en premier).
function sortByLead(items: TurnItem[], lead: number): TurnItem[] {
  return [...items].sort((a, b) => {
    const ta = effective(a, lead);
    const tb = effective(b, lead);
    if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta || a.monster.name.localeCompare(b.monster.name);
  });
}

export default function TurnOrder({ items, onRuneSpeed }: Props) {
  const [lead, setLead] = useState(0);
  const [highlightMovers, setHighlightMovers] = useState(false);

  const ordered = useMemo(() => sortByLead(items, lead), [items, lead]);

  // Rang de référence sans lead → sert à repérer les monstres qui changent de place.
  const baselineRank = useMemo(() => {
    const map = new Map<string, number>();
    sortByLead(items, 0).forEach((it, idx) => map.set(String(it.monster.id), idx));
    return map;
  }, [items]);

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

        <button
          onClick={() => setHighlightMovers((v) => !v)}
          role="switch"
          aria-checked={highlightMovers}
          title="Surligner les monstres dont la place change avec le lead actif"
          className="ml-1 flex items-center gap-2 select-none"
        >
          <span
            className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors
              ${highlightMovers ? 'bg-star' : 'bg-panel2 border border-border'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                ${highlightMovers ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}
            />
          </span>
          <span className={`text-[12px] font-semibold ${highlightMovers ? 'text-ink' : 'text-ink-dim'}`}>
            Surligner les changements
          </span>
        </button>
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
            // Change de place par rapport à l'ordre sans lead (quand un lead est actif).
            const moved =
              highlightMovers && lead !== 0 && baselineRank.get(String(m.id)) !== i;
            return (
              <div
                key={m.id}
                className={`relative flex-none w-[168px] rounded-xl border p-2 flex flex-col gap-1.5 transition-colors
                  ${moved ? 'border-star bg-star/10 ring-1 ring-star/50' : 'border-border bg-panel2'}`}
              >
                {/* numéro d'ordre superposé en haut à gauche */}
                <span
                  className="absolute -top-2 -left-2 z-10 flex items-center justify-center min-w-[20px] h-5 px-1
                             rounded-full bg-gradient-to-br from-[#3a4270] to-[#272e52] border border-border
                             font-mono text-[10px] font-bold text-ink shadow"
                >
                  {i + 1}
                </span>

                <div className="flex items-center gap-2">
                  {/* portrait */}
                  <div className="relative flex-none">
                    <div
                      className={`hex-frame w-[42px] h-[42px] p-[2px] bg-gradient-to-br ${RING[m.element]}`}
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
                      size={15}
                      className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold leading-tight truncate" title={m.name}>
                      {m.name}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
                      <span className="font-mono text-[16px] font-black text-ink leading-none">{eff ?? '—'}</span>
                      {(it.entry.sets ?? []).slice(0, 3).map((s, si) => (
                        <RuneIcon key={si} setKey={s} size={16} className="flex-none" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* saisie vitesse des runes */}
                <input
                  type="number"
                  inputMode="numeric"
                  value={it.entry.runeSpeed ?? ''}
                  placeholder="+ runes"
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
