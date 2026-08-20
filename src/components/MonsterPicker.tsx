import { useId, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Monster } from '../types';
import MonsterAvatar from './MonsterAvatar';
import { formesJouables } from '../lib/monsterForms';
import { useComboboxNav } from '../hooks/useComboboxNav';
import { Champ, Flottant } from '../ui';

interface Props {
  monsters: Monster[];
  onPick: (id: string) => void;
  excludeIds?: Set<string>;
  placeholder?: string;
}

const MAX_RESULTS = 25;

// Recherche de monstre par nom → sélection (dropdown de suggestions).
//
// La navigation au clavier vit dans
// [useComboboxNav](src/hooks/useComboboxNav.ts), partagé avec
// [RtaSearch](src/components/rta/RtaSearch.tsx) : ↑/↓, Entrée sur l'élément
// surligné, Échap pour fermer.
export default function MonsterPicker({ monsters, onPick, excludeIds, placeholder }: Props) {
  const [query, setQuery] = useState('');
  // ⚠️ Plusieurs pickers coexistent (un par slot d'équipe de siège) : les `id`
  // ARIA doivent être uniques, sinon `aria-activedescendant` désigne l'option
  // d'un autre champ.
  const idBase = useId();

  // ⚠️ Seules les formes JOUABLES sont proposées : pas de non éveillée, et la
  // 2A remplace l'éveillée simple quand elle existe (voir lib/monsterForms.ts).
  // Chercher « Seren » renvoyait trois entrées, dont deux qu'on ne joue jamais.
  const jouables = useMemo(() => formesJouables(monsters), [monsters]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Monster[] = [];
    for (const m of jouables) {
      if (excludeIds?.has(String(m.id))) continue;
      if (m.name.toLowerCase().includes(q)) {
        out.push(m);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [jouables, query, excludeIds]);

  const nav = useComboboxNav<Monster>({
    results,
    query,
    setQuery,
    idBase,
    // Les monstres déjà pris sont filtrés en amont (`excludeIds`) : tout ce qui
    // est affiché est sélectionnable.
    onValider: (m) => onPick(String(m.id)),
  });

  return (
    <div className="relative">
      <Champ
        {...nav.inputProps}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Rechercher…'}
        icone={<Search size={16} />}
        // ⚠️ `bg-panel` plutôt que le `panel2` par défaut de `Champ` — même
        // écart assumé que le champ de RtaSearch : ce champ vit DANS un slot
        // déjà en `panel2`, où le fond par défaut se confondrait avec lui.
        className="bg-panel text-sm"
      />

      {/* ⚠️ `rembourrage="aucun"` : les entrées d'une liste doivent toucher les
          bords, comme dans RtaSearch (même recherche, même liste — c'est
          délibérément le même rendu). */}
      {nav.open && (
        <Flottant
          {...nav.listProps}
          aria-label="Résultats de la recherche"
          rembourrage="aucun"
          className="max-h-[300px] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-3 py-2 text-ink-dim text-xs">Aucun monstre trouvé.</div>
          ) : (
            results.map((m, i) => {
              const estActif = i === nav.actif;
              return (
                <div
                  key={m.id}
                  {...nav.optionProps(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(String(m.id));
                    nav.reinitialiser();
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition
                    ${estActif ? 'bg-accent-soft' : ''}`}
                >
                  {/* Portrait : le nom ne suffit pas à distinguer les formes d'un
                      même monstre (voir MonsterAvatar). */}
                  <MonsterAvatar monster={m} size={28} />
                  <span className="text-sm font-medium truncate flex-1">{m.name}</span>
                  <span className="font-mono text-micro text-ink-dim">SPD {m.stats.speed ?? '—'}</span>
                  <Plus size={14} className={`flex-none ${estActif ? 'text-accent' : 'text-ink-dim'}`} />
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
