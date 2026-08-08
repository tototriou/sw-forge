import { memo, useMemo, useRef, useState } from 'react';
import { ArtifactDetail, ElementKey } from '../../types';
import { formatArtifactMain, RARITY_META } from '../../lib/effects';
import ArtifactIcon from '../ArtifactIcon';
import { ArtifactDetailBox } from '../MonsterGear';
import Pager from './Pager';
import DetailPopover from './DetailPopover';

interface Props {
  artifacts: ArtifactDetail[];
}

interface ArtRow {
  art: ArtifactDetail;
  id: number;
}

type Archetype = 'attack' | 'defense' | 'hp' | 'support';

const RARITY_ORDER = [5, 4, 3, 2, 1];
const PAGE = 60;

const ELEMENTS: { key: ElementKey; label: string }[] = [
  { key: 'water', label: 'Eau' },
  { key: 'fire', label: 'Feu' },
  { key: 'wind', label: 'Vent' },
  { key: 'light', label: 'Lumière' },
  { key: 'dark', label: 'Ténèbres' },
];
const ARCHETYPES: { key: Archetype; label: string }[] = [
  { key: 'attack', label: 'Attaque' },
  { key: 'defense', label: 'Défense' },
  { key: 'hp', label: 'PV' },
  { key: 'support', label: 'Support' },
];

export default function ArtifactsSection({ artifacts }: Props) {
  const [kind, setKind] = useState<'all' | 'element' | 'archetype'>('all');
  const [element, setElement] = useState<ElementKey | ''>('');
  const [archetype, setArchetype] = useState<Archetype | ''>('');
  const [rarities, setRarities] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);

  function toggleRarity(v: number) {
    const next = new Set(rarities);
    next.has(v) ? next.delete(v) : next.add(v);
    setRarities(next);
    setPage(0);
  }

  // Tri par rareté décroissante puis niveau décroissant.
  const rows = useMemo(
    () =>
      artifacts
        .map((art, id): ArtRow => ({ art, id }))
        .sort((a, b) => b.art.rarity - a.art.rarity || b.art.level - a.art.level),
    [artifacts]
  );

  const filtered = useMemo(() => {
    return rows.filter(({ art }) => {
      if (kind !== 'all' && art.kind !== kind) return false;
      if (element && art.element !== element) return false;
      if (archetype && art.archetype !== archetype) return false;
      if (rarities.size && !rarities.has(art.rarity)) return false;
      return true;
    });
  }, [rows, kind, element, archetype, rarities]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        {/* Type + sous-filtre */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Type</span>
          {(['all', 'element', 'archetype'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setElement('');
                setArchetype('');
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
                ${
                  kind === k
                    ? 'bg-[#2b3170] border-[#4a52a0] text-ink shadow'
                    : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                }`}
            >
              {k === 'all' ? 'Tous' : k === 'element' ? 'Élément' : 'Archétype'}
            </button>
          ))}

          {kind !== 'archetype' &&
            ELEMENTS.map((e) => (
              <button
                key={e.key}
                onClick={() => {
                  setElement((cur) => (cur === e.key ? '' : e.key));
                  if (kind === 'all') setKind('element');
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition select-none
                  ${
                    element === e.key
                      ? 'bg-panel2 border-[#4a52a0] text-ink shadow'
                      : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                  }`}
              >
                {e.label}
              </button>
            ))}
          {kind !== 'element' &&
            ARCHETYPES.map((a) => (
              <button
                key={a.key}
                onClick={() => {
                  setArchetype((cur) => (cur === a.key ? '' : a.key));
                  if (kind === 'all') setKind('archetype');
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition select-none
                  ${
                    archetype === a.key
                      ? 'bg-panel2 border-[#4a52a0] text-ink shadow'
                      : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                  }`}
              >
                {a.label}
              </button>
            ))}
        </div>

        {/* Rareté */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Rareté</span>
          {RARITY_ORDER.map((r) => {
            const meta = RARITY_META[r];
            const active = rarities.has(r);
            return (
              <button
                key={r}
                onClick={() => toggleRarity(r)}
                className="rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide border transition select-none"
                style={
                  active
                    ? { background: meta.bg, color: meta.color, borderColor: meta.color }
                    : { borderColor: '#2b3055', color: meta.color, opacity: 0.6 }
                }
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} artéfact{filtered.length > 1 ? 's' : ''}
          {filtered.length !== artifacts.length && ` sur ${artifacts.length}`}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2 items-start">
        {shown.map((row) => (
          <ArtTile key={row.id} art={row.art} />
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

const ArtTile = memo(function ArtTile({ art }: { art: ArtifactDetail }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = RARITY_META[art.rarity] ?? RARITY_META[1];

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-[#4a52a0]' : 'border-border'}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 p-2 text-left"
        style={{ borderLeft: `3px solid ${meta.color}` }}
      >
        <ArtifactIcon artifact={art} size={26} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-ink-dim">+{art.level}</div>
          <div className="text-[12.5px] font-bold text-ink leading-tight truncate">
            {formatArtifactMain(art.main)}
          </div>
        </div>
      </button>

      {/* Détail flottant : carte récap, placement auto (gauche/haut si bord). */}
      <DetailPopover open={open} anchorRef={ref} height={260}>
        <ArtifactDetailBox artifact={art} />
      </DetailPopover>
    </div>
  );
});
