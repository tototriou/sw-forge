import { memo, useMemo, useRef, useState } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { formatRuneEffect, RARITY_META, runeEfficiency } from '../../lib/effects';
import RuneIcon from '../RuneIcon';
import RuneSlotIcon from '../RuneSlotIcon';
import { RuneDetailBox } from '../MonsterGear';
import Pager from './Pager';
import DetailPopover from './DetailPopover';

interface Props {
  runes: RuneDetail[];
}

// Une rune enrichie de son efficience (calculée une fois).
interface RuneRow {
  rune: RuneDetail;
  eff: number;
  id: number;
}

type SortMode = 'eff_desc' | 'eff_asc' | 'level_desc' | 'slot_asc';

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'eff_desc', label: 'Efficience ↓' },
  { key: 'eff_asc', label: 'Efficience ↑' },
  { key: 'level_desc', label: 'Niveau ↓' },
  { key: 'slot_asc', label: 'Slot ↑' },
];

const SORT_FN: Record<SortMode, (a: RuneRow, b: RuneRow) => number> = {
  eff_desc: (a, b) => b.eff - a.eff,
  eff_asc: (a, b) => a.eff - b.eff,
  level_desc: (a, b) => b.rune.level - a.rune.level || b.eff - a.eff,
  slot_asc: (a, b) => a.rune.slot - b.rune.slot || b.eff - a.eff,
};

const PAGE = 60; // tuiles par page (DOM borné pour rester fluide)

export default function RunesList({ runes }: Props) {
  const [sets, setSets] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Set<number>>(new Set());
  const [ancientOnly, setAncientOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('eff_desc');
  const [page, setPage] = useState(0);

  function toggle<T>(set: Set<T>, v: T, upd: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    upd(next);
    setPage(0);
  }

  // Efficience calculée : une seule fois par import.
  const rows = useMemo(
    () => runes.map((rune, id): RuneRow => ({ rune, id, eff: runeEfficiency(rune) })),
    [runes]
  );

  // Sets réellement présents dans l'inventaire (pour les chips).
  const presentSets = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const r = row.rune;
      if (sets.size && !sets.has(r.set)) return false;
      if (slots.size && !slots.has(r.slot)) return false;
      if (ancientOnly && !(r.rank > 10)) return false;
      return true;
    });
  }, [rows, sets, slots, ancientOnly]);

  // Tri appliqué après filtrage (copie pour ne pas muter `filtered`).
  const sorted = useMemo(() => [...filtered].sort(SORT_FN[sort]), [filtered, sort]);
  const bestEff = useMemo(() => filtered.reduce((m, r) => Math.max(m, r.eff), 0), [filtered]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Sets : multi-sélection */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Sets</span>
          {presentSets.map((s) => {
            const active = sets.has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggle(sets, s.key, setSets)}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[12px] font-semibold transition select-none
                  ${
                    active
                      ? 'bg-[#2b3170] border-[#4a52a0] text-ink shadow'
                      : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                  }`}
              >
                <RuneIcon setKey={s.key} size={15} className={active ? '' : 'opacity-70'} />
                {s.label}
              </button>
            );
          })}
          {sets.size > 0 && (
            <button
              onClick={() => {
                setSets(new Set());
                setPage(0);
              }}
              className="ml-1 text-[11px] text-ink-dim hover:text-fire transition underline"
            >
              tout
            </button>
          )}
        </div>

        {/* Slot + antiques */}
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
            onClick={() => {
              setAncientOnly((v) => !v);
              setPage(0);
            }}
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

        {/* Tri */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Trier par</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortMode);
              setPage(0);
            }}
            className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1 text-[13px] outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} rune{filtered.length > 1 ? 's' : ''}
          {filtered.length !== runes.length && ` sur ${runes.length}`}
          {filtered.length > 0 && (
            <> · meilleure efficience <b className="text-star">{bestEff.toFixed(1)}%</b></>
          )}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Grille de runes (page courante uniquement) */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 items-start">
        {shown.map((row) => (
          <RuneTile key={row.id} row={row} />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

// Tuile uniforme cliquable : cadre de rune (orienté par slot, icône de set
// dedans) à gauche · stat principale à côté · efficience en dessous.
// Mémoïsée : ne se re-rend pas quand seuls les filtres/la page changent ailleurs.
const RuneTile = memo(function RuneTile({ row }: { row: RuneRow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { rune, eff } = row;
  const meta = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const ancient = rune.rank > 10;

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-[#4a52a0]' : 'border-border'}`}
    >
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 p-2 text-left">
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={ancient} height={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink leading-tight truncate">
            {formatRuneEffect(rune.main)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-dim leading-tight">
            Eff. <b style={{ color: meta.color }}>{eff.toFixed(1)}%</b>
          </div>
        </div>
      </button>

      {/* Détail flottant : carte récap, placement auto (gauche/haut si bord). */}
      <DetailPopover open={open} anchorRef={ref} height={320}>
        <RuneDetailBox rune={rune} />
      </DetailPopover>
    </div>
  );
});
