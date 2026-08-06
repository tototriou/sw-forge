import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import SearchBar from './components/SearchBar';
import FilterBar from './components/FilterBar';
import MonsterGrid from './components/MonsterGrid';
import { ELEMENTS, ElementKey, Monster, MonstersPayload } from './types';

type LoadState = 'loading' | 'live' | 'demo' | 'error';

export default function App() {
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [activeElements, setActiveElements] = useState<Set<ElementKey>>(new Set());
  const [activeStars, setActiveStars] = useState<Set<number>>(new Set());
  const [sortMode, setSortMode] = useState('stars_desc');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoadState('loading');
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/monsters.json`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: MonstersPayload = await res.json();
      setMonsters(payload.monsters);
      setGeneratedAt(payload.meta?.generated_at ?? null);
      setLoadState(payload.meta?.source === 'live' ? 'live' : 'demo');
    } catch (err) {
      console.error('Impossible de charger data/monsters.json', err);
      setLoadState('error');
    }
  }

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
    <div className="max-w-[1180px] mx-auto px-5 py-8 pb-16">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink-dim mb-2">
          // Sky Arena — Base de données
        </p>
        <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-1.5">
          Bestiaire
        </h1>
        <p className="text-ink-dim text-[14.5px] leading-relaxed max-w-xl">
          Recherche, filtre par élément et par nombre d'étoiles naturelles (à l'invocation).
          Les données sont générées automatiquement par une Action GitHub, donc jamais bloquées
          par le navigateur.
        </p>

        <div className="flex items-center gap-2.5 flex-wrap mt-[18px] p-2.5 px-3.5 bg-panel border border-border rounded-[10px] text-[13px]">
          <StatusDot state={loadState} />
          <span className="text-ink-dim">
            <StatusText state={loadState} count={totalShown} generatedAt={generatedAt} />
          </span>
          <button
            onClick={load}
            className="ml-auto flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-[12.5px]
                       text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
          >
            <RefreshCw size={13} /> Recharger
          </button>
        </div>
      </header>

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
          <MonsterGrid key={el.key} elementDef={el} monsters={grouped.get(el.key) ?? []} />
        ))
      )}

      <footer className="mt-16 text-center font-mono text-xs text-ink-dim">
        Données et images © Com2uS · Source :{' '}
        <a href="https://swarfarm.com" target="_blank" rel="noreferrer" className="text-[#8b92e0]">
          swarfarm.com
        </a>
      </footer>
    </div>
  );
}

function StatusDot({ state }: { state: LoadState }) {
  const color =
    state === 'live'
      ? 'bg-wind-glow shadow-[0_0_8px_#5EDB8F]'
      : state === 'demo'
      ? 'bg-light-glow shadow-[0_0_8px_#FFE07A]'
      : state === 'error'
      ? 'bg-fire-glow shadow-[0_0_8px_#FF7A52]'
      : 'bg-water-glow shadow-[0_0_8px_#5CC2FF] animate-pulse';
  return <span className={`w-2 h-2 rounded-full flex-none ${color}`} />;
}

function StatusText({
  state,
  count,
  generatedAt,
}: {
  state: LoadState;
  count: number;
  generatedAt: string | null;
}) {
  if (state === 'loading') return <>Chargement des données…</>;
  if (state === 'error')
    return (
      <>
        Impossible de charger <code className="text-ink">data/monsters.json</code>. Vérifie que le
        workflow <code className="text-ink">update-data.yml</code> a bien tourné au moins une fois.
      </>
    );
  const when = generatedAt ? new Date(generatedAt).toLocaleString('fr-FR') : null;
  return (
    <>
      <b className="text-ink">{count}</b> monstre{count > 1 ? 's' : ''} affiché{count > 1 ? 's' : ''}
      {state === 'demo' && <> · jeu de démonstration (lance le workflow de mise à jour)</>}
      {when && <> · généré le {when}</>}
    </>
  );
}
