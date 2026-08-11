import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Monster } from '../types';
import MonsterAvatar from './MonsterAvatar';

interface Props {
  monsters: Monster[];
  onPick: (id: string) => void;
  excludeIds?: Set<string>;
  placeholder?: string;
}

const MAX_RESULTS = 25;

// Recherche de monstre par nom → sélection (dropdown de suggestions).
export default function MonsterPicker({ monsters, onPick, excludeIds, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of monsters) {
      if (excludeIds?.has(String(m.id))) continue;
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [monsters, query, excludeIds]);

  const open = focused && query.trim().length > 0;

  function pick(id: string) {
    onPick(id);
    setQuery('');
    setFocused(false);
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-dim" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (results[0]) pick(String(results[0].id));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? 'Rechercher…'}
        className="w-full bg-panel border border-border rounded-lg py-2 pl-9 pr-3 text-[13px]
                   text-ink placeholder:text-ink-dim outline-none transition
                   focus:border-accent focus:shadow-[0_0_0_3px_rgba(91,99,184,0.2)]"
      />

      {open && (
        <div className="absolute z-30 mt-1.5 w-full max-h-[300px] overflow-y-auto rounded-lg border border-border bg-panel shadow-glow shadow-black/60">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-ink-dim text-[12.5px]">Aucun monstre trouvé.</div>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(String(m.id));
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hoverable:bg-panel2 transition"
              >
                {/* Portrait : le nom ne suffit pas à distinguer les formes d'un
                    même monstre (voir MonsterAvatar). */}
                <MonsterAvatar monster={m} size={28} />
                <span className="text-[13px] font-medium truncate flex-1">{m.name}</span>
                <span className="font-mono text-[11px] text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                <Plus size={14} className="text-ink-dim flex-none" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
