import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar';
import MonsterGrid from '../components/MonsterGrid';
import MonsterDetailDialog from '../components/MonsterDetailDialog';
import { ELEMENTS, ElementKey, Monster } from '../types';
import { LoadState } from '../hooks/useMonsters';

interface Props {
  monsters: Monster[];
  loadState: LoadState;
}

export default function BestiaryPage({ monsters }: Props) {
  const [query, setQuery] = useState('');
  const [activeElements, setActiveElements] = useState<Set<ElementKey>>(new Set());
  const [activeStars, setActiveStars] = useState<Set<number>>(new Set());
  const [sortMode, setSortMode] = useState('stars_desc');
  // Fiche ouverte — état local, non persisté : rouvrir la page sur une fiche
  // consultée la veille serait déroutant.
  const [fiche, setFiche] = useState<Monster | null>(null);

  function toggleElement(k: ElementKey) {
    setActiveElements((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function toggleStar(n: number) {
    setActiveStars((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = monsters.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (activeElements.size && !activeElements.has(m.element)) return false;
      if (activeStars.size && !(m.stars !== null && activeStars.has(m.stars))) return false;
      return true;
    });

    const byElement = new Map<ElementKey, Monster[]>();
    for (const el of ELEMENTS) byElement.set(el.key, []);
    for (const m of filtered) byElement.get(m.element)?.push(m);

    for (const [, list] of byElement) {
      if (sortMode === 'stars_desc') {
        list.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || a.name.localeCompare(b.name));
      } else if (sortMode === 'stars_asc') {
        list.sort((a, b) => (a.stars ?? 99) - (b.stars ?? 99) || a.name.localeCompare(b.name));
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    return byElement;
  }, [monsters, query, activeElements, activeStars, sortMode]);

  const totalShown = useMemo(
    () => Array.from(grouped.values()).reduce((sum, list) => sum + list.length, 0),
    [grouped]
  );

  return (
    <div>
      <div className="mt-6">
        <SearchBar value={query} onChange={setQuery} />
        <FilterBar
          activeElements={activeElements}
          toggleElement={toggleElement}
          activeStars={activeStars}
          toggleStar={toggleStar}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      </div>

      {totalShown === 0 ? (
        <div className="text-center py-16 text-ink-dim">
          <Sparkles className="mx-auto mb-3 opacity-40" />
          Aucun monstre ne correspond à ces filtres.
        </div>
      ) : (
        ELEMENTS.map((el) => (
          <MonsterGrid
            key={el.key}
            elementDef={el}
            monsters={grouped.get(el.key) ?? []}
            onOpen={setFiche}
          />
        ))
      )}

      {/* La MÊME fiche que dans « Mon compte » : mêmes données, même rendu. Le
          bestiaire couvre en plus les monstres qu'on ne possède pas — c'est
          justement là qu'on consulte des coefficients avant d'invoquer. */}
      {fiche && <MonsterDetailDialog monster={fiche} onClose={() => setFiche(null)} />}
    </div>
  );
}
