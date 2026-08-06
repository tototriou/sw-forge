import { useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Monster } from '../../types';
import ElementIcon from '../ElementIcon';

interface Props {
  monsters: Monster[];
  addedIds: Set<string>;
  onAdd: (id: string) => void;
}

const MAX_RESULTS = 25;

export default function RtaSearch({ monsters, addedIds, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of monsters) {
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [monsters, query]);

  const open = focused && query.trim().length > 0;

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-dim" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Rechercher un monstre à ajouter à ta prépa RTA…"
        className="w-full bg-panel border border-border rounded-xl py-3.5 pl-11 pr-4 text-[15px]
                   text-ink placeholder:text-ink-dim outline-none transition
                   focus:border-[#5b63b8] focus:shadow-[0_0_0_3px_rgba(91,99,184,0.2)]"
      />

      {open && (
        <div
          className="absolute z-20 mt-2 w-full max-h-[360px] overflow-y-auto rounded-xl border border-border
                     bg-panel shadow-glow shadow-black/60"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-ink-dim text-[13px]">Aucun monstre trouvé.</div>
          ) : (
            results.map((m) => {
              const added = addedIds.has(String(m.id));
              return (
                <button
                  key={m.id}
                  // onMouseDown (pas onClick) pour agir avant le blur de l'input
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!added) onAdd(String(m.id));
                  }}
                  disabled={added}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition
                    ${added ? 'opacity-50 cursor-default' : 'hover:bg-panel2'}`}
                >
                  <ElementIcon element={m.element} size={18} className="flex-none" />
                  <span className="text-[13.5px] font-medium truncate flex-1">{m.name}</span>
                  {m.stars ? (
                    <span className="font-mono text-[11px] text-star">{m.stars}★</span>
                  ) : null}
                  <span className="font-mono text-[11px] text-ink-dim w-16 text-right">
                    SPD {m.stats.speed ?? '—'}
                  </span>
                  {added ? (
                    <Check size={15} className="text-wind flex-none" />
                  ) : (
                    <Plus size={15} className="text-ink-dim flex-none" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
