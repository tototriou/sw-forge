import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { RuneDetail } from '../../types';
import { formatRuneEffect, RARITY_META, runeEfficiency, runeScore } from '../../lib/effects';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import RuneSlotIcon from '../RuneSlotIcon';
import { RuneDetailBox } from '../MonsterGear';
import Pager from './Pager';
import DetailPopover from './DetailPopover';
import { useStickyState } from '../../hooks/useStickyState';
import { RuneMetric, useRuneMetric, formatRuneMetric, runeMetricLabel } from '../../hooks/useRuneMetric';

interface Props {
  runes: RuneDetail[];
}

// Une rune enrichie de ses deux mesures (calculées une fois).
interface RuneRow {
  rune: RuneDetail;
  eff: number; // efficience (%)
  score: number; // score SW (celui du jeu)
  id: number;
}

type SortMode = 'val_desc' | 'val_asc' | 'level_desc' | 'slot_asc';

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'val_desc', label: '↓ décroissant' },
  { key: 'val_asc', label: '↑ croissant' },
  { key: 'level_desc', label: 'Niveau ↓' },
  { key: 'slot_asc', label: 'Slot ↑' },
];

// Le tri « valeur » suit la mesure choisie.
const sortFn = (mode: SortMode, m: RuneMetric) => {
  const v = (r: RuneRow) => (m === 'eff' ? r.eff : r.score);
  const table: Record<SortMode, (a: RuneRow, b: RuneRow) => number> = {
    val_desc: (a, b) => v(b) - v(a),
    val_asc: (a, b) => v(a) - v(b),
    level_desc: (a, b) => b.rune.level - a.rune.level || v(b) - v(a),
    slot_asc: (a, b) => a.rune.slot - b.rune.slot || v(b) - v(a),
  };
  return table[mode];
};

const PAGE = 60; // tuiles par page (DOM borné pour rester fluide)

export default function RunesList({ runes }: Props) {
  const [sets, setSets] = useStickyState<Set<string>>('runesList.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesList.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesList.ancient', false);
  const [sort, setSort] = useStickyState<SortMode>('runesList.sort', 'val_desc');
  const metric = useRuneMetric(); // choix PARTAGÉ avec les autres vues
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const toggleOpen = useCallback((id: number) => setOpenId((c) => (c === id ? null : id)), []);

  // Les deux mesures calculées une seule fois par import (bascule instantanée).
  const rows = useMemo(
    () =>
      runes.map(
        (rune, id): RuneRow => ({ rune, id, eff: runeEfficiency(rune), score: runeScore(rune) })
      ),
    [runes]
  );

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
  const sorted = useMemo(() => [...filtered].sort(sortFn(sort, metric)), [filtered, sort, metric]);
  const best = useMemo(
    () => filtered.reduce((m, r) => Math.max(m, metric === 'eff' ? r.eff : r.score), 0),
    [filtered, metric]
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Sets : multi-sélection, icônes seules (voir SetFilter) */}
        <SetFilter
          runes={runes}
          value={sets}
          onChange={(next) => {
            setSets(next);
            setPage(0);
          }}
        />

        {/* Slot + antiques */}
        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter
            value={slots}
            onChange={(next) => {
              setSlots(next);
              setPage(0);
            }}
          />
          <button
            onClick={() => {
              setAncientOnly((v) => !v);
              setPage(0);
            }}
            className={`ml-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                ancientOnly
                  ? 'bg-accent-soft border-accent text-accent shadow'
                  : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
              }`}
          >
            Antiques
          </button>
        </div>

        {/* Tri. La MESURE (efficience / score) est un réglage global, dans la
            barre de nav — pas un filtre de page. */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label mr-1">
            Trier par
          </span>
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
            <>
              {' '}
              · meilleur{metric === 'eff' ? 'e efficience' : ' score'}{' '}
              <b className="text-star">{metric === 'eff' ? `${best.toFixed(1)}%` : best}</b>
            </>
          )}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Grille de runes (page courante uniquement).
          Clé POSITIONNELLE (et non `row.id`) : la tuile est réutilisée quand la
          page/le filtre change, donc le cadre pivote vers son nouveau slot au
          lieu d'être remonté d'un coup. Voir SPIN dans RuneSlotIcon. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 items-start">
        {shown.map((row, i) => (
          <RuneTile key={i} row={row} metric={metric} open={openId === row.id} onToggle={toggleOpen} />
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
const RuneTile = memo(function RuneTile({
  row,
  metric,
  open,
  onToggle,
}: {
  row: RuneRow;
  metric: RuneMetric;
  open: boolean;
  onToggle: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { rune } = row;
  const meta = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const ancient = rune.rank > 10;

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-accent' : 'border-border'}`}
    >
      <button onClick={() => onToggle(row.id)} className="w-full flex items-center gap-2.5 p-2 text-left">
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={ancient} height={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink leading-tight truncate">
            {formatRuneEffect(rune.main)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-dim leading-tight">
            {runeMetricLabel(metric)}{' '}
            {/* `meta.ink` et non `meta.color` : c'est du TEXTE sur un panneau,
                pas la bannière de rareté. Les couleurs vives du jeu sont
                illisibles sur fond clair. Voir RARITY_META. */}
            <b style={{ color: meta.ink }}>
              {formatRuneMetric(metric === 'eff' ? row.eff : row.score, metric)}
            </b>
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
