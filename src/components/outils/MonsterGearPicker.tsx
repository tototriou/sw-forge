import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { GearSet, Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { useComboboxNav } from '../../hooks/useComboboxNav';
import { useNameFilteredResults } from '../../hooks/useNameFilteredResults';

export interface GearedMonster {
  monster: Monster;
  gear: GearSet;
}

interface Props {
  items: GearedMonster[];
  onPick: (id: string) => void;
  placeholder?: string;
}

// Recherche de monstre à optimiser, parmi TOUS les monstres 6★ de la box
// importée (voir spec/outils/optimizer/) — avec ou sans runes déjà
// équipées : un monstre nu peut tout aussi bien être optimisé. Même
// grammaire de navigation clavier que MonsterPicker/RtaSearch — voir
// spec/shared/recherche-clavier.md.
export default function MonsterGearPicker({ items, onPick, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const idBase = useId();

  const results = useNameFilteredResults(items, query);

  const nav = useComboboxNav<GearedMonster>({
    results,
    query,
    setQuery,
    idBase,
    onValider: (it) => onPick(String(it.monster.id)),
  });

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-dim" />
      <input
        {...nav.inputProps}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Rechercher un monstre…'}
        className="w-full bg-panel border border-border rounded-lg py-2 pl-9 pr-3 text-[13px]
                   text-ink placeholder:text-ink-dim outline-none transition
                   focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.25)]"
      />

      {nav.open && (
        <div
          {...nav.listProps}
          aria-label="Résultats de la recherche"
          className="absolute z-30 mt-1.5 w-full max-h-[300px] overflow-y-auto rounded-lg border border-border bg-panel shadow-glow shadow-black/60"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-ink-dim text-[12.5px]">Aucun monstre trouvé.</div>
          ) : (
            results.map((it, i) => {
              const estActif = i === nav.actif;
              return (
                <div
                  key={it.monster.id}
                  {...nav.optionProps(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(String(it.monster.id));
                    nav.reinitialiser();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition
                    ${estActif ? 'bg-accent-soft' : ''}`}
                >
                  <MonsterAvatar monster={it.monster} size={28} />
                  <span className="text-[13px] font-medium truncate flex-1">{it.monster.name}</span>
                  <span className="font-mono text-[11px] text-ink-dim">
                    {it.gear.runes.length} rune{it.gear.runes.length > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
