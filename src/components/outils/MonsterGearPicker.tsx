import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { GearSet, Monster } from '../../types';
import MonsterAvatar from '../MonsterAvatar';
import { Champ, Flottant } from '../../ui';
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
      <Champ
        {...nav.inputProps}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Rechercher un monstre…'}
        icone={<Search className="h-4 w-4" />}
      />

      {/* ⚠️ `rembourrage="aucun"` : les entrées d'une liste touchent les bords —
          un rembourrage y laisserait une bande morte au survol. Même pattern
          combobox que RtaSearch (Champ + Flottant). */}
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
                  <span className="text-sm font-medium truncate flex-1">{it.monster.name}</span>
                  <span className="font-mono text-micro text-ink-dim">
                    {it.gear.runes.length} rune{it.gear.runes.length > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })
          )}
        </Flottant>
      )}
    </div>
  );
}
