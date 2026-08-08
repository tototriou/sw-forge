import { useMemo, useState } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { runeEfficiency } from '../../lib/effects';
import RuneIcon from '../RuneIcon';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400; // nb de runes affichées par défaut

const median = (sorted: number[]) => (sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0);

export default function RunesCurve({ runes }: Props) {
  const [sets, setSets] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Set<number>>(new Set());
  const [ancientOnly, setAncientOnly] = useState(false);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  function toggle<T>(set: Set<T>, v: T, upd: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    upd(next);
  }

  // Sets réellement présents dans l'inventaire (pour les chips).
  const presentSets = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  // Efficiences filtrées, triées décroissant.
  const effsAll = useMemo(() => {
    return runes
      .filter((r) => {
        if (sets.size && !sets.has(r.set)) return false;
        if (slots.size && !slots.has(r.slot)) return false;
        if (ancientOnly && !(r.rank > 10)) return false;
        return true;
      })
      .map((r) => runeEfficiency(r))
      .sort((a, b) => b - a);
  }, [runes, sets, slots, ancientOnly]);

  const total = effsAll.length;
  const effs = effsAll.slice(0, Math.max(1, limit));
  const series: CurveSeries[] = [{ name: 'Moi', effs, color: OWN_COLOR, own: true }];

  return (
    <div>
      {/* Filtres de la courbe */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Sets</span>
          {presentSets.map((s) => {
            const active = sets.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggle(sets, s.key, setSets)}
                title={s.label}
                aria-label={s.label}
                aria-pressed={active}
                className={`flex items-center justify-center w-8 h-8 rounded-md border transition select-none
                  ${
                    active
                      ? 'bg-[#2b3170] border-[#4a52a0] shadow'
                      : 'bg-panel border-border opacity-55 hover:opacity-100 hover:border-[#4a52a0]'
                  }`}
              >
                <RuneIcon setKey={s.key} size={18} />
              </button>
            );
          })}
          {sets.size > 0 && (
            <button
              onClick={() => setSets(new Set())}
              className="ml-1 text-[11px] text-ink-dim hover:text-fire transition underline"
            >
              tout
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Slot</span>
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const active = slots.has(n);
            return (
              <button
                key={n}
                onClick={() => toggle(slots, n, setSlots)}
                className={`w-8 h-7 rounded-full border text-[12.5px] font-mono font-semibold transition select-none
                  ${
                    active
                      ? 'bg-[#2b3170] border-[#4a52a0] text-ink shadow'
                      : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                  }`}
              >
                {n}
              </button>
            );
          })}
          <button
            onClick={() => setAncientOnly((v) => !v)}
            className={`ml-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                ancientOnly
                  ? 'bg-[#3a2a55] border-[#a074d0] text-[#c79bff] shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
          >
            Antiques
          </button>
        </div>
      </div>

      {/* Stats + nombre de runes affichées */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="font-mono text-[12px] text-ink-dim">
          top {effs.length}
          {total > effs.length && ` sur ${total}`}
          {effs.length > 0 && (
            <>
              {' '}
              · max <b className="text-star">{effs[0].toFixed(1)}%</b> · médiane{' '}
              <b className="text-ink">{median(effs).toFixed(1)}%</b>
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Nb de runes</span>
          <input
            type="number"
            min={1}
            max={total || 1}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 bg-panel border border-border text-ink rounded-lg px-2 py-1 text-[13px] outline-none focus:border-[#5b63b8] tabular-nums"
          />
          <button
            onClick={() => setLimit(total || 1)}
            className="rounded-lg border border-border bg-panel px-2.5 py-1 text-[12px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
          >
            Tout
          </button>
        </div>
      </div>

      <CurveChart series={series} />
    </div>
  );
}
