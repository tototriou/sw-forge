import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Swords, BookOpen, Home, Castle, Trophy, Menu, X } from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage from './pages/SiegePage';
import ComingSoon from './pages/ComingSoon';
import { useMonsters, LoadState } from './hooks/useMonsters';
import { useCustomMonsters } from './hooks/useCustomMonsters';

type Route = 'home' | 'bestiary' | 'rta' | 'siege' | 'arene';

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'rta') return 'rta';
  if (h === 'bestiary') return 'bestiary';
  if (h === 'siege') return 'siege';
  if (h === 'arene') return 'arene';
  return 'home';
}

const NAV: { key: Route; label: string; icon: typeof BookOpen; hash: string }[] = [
  { key: 'home', label: 'Accueil', icon: Home, hash: '#/' },
  { key: 'rta', label: 'RTA', icon: Swords, hash: '#/rta' },
  { key: 'siege', label: 'Siège', icon: Castle, hash: '#/siege' },
  { key: 'arene', label: 'Arène', icon: Trophy, hash: '#/arene' },
  { key: 'bestiary', label: 'Bestiaire', icon: BookOpen, hash: '#/bestiary' },
];

export default function App() {
  const data = useMonsters();
  const custom = useCustomMonsters();
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [menuOpen, setMenuOpen] = useState(false);

  // Monstres officiels + monstres créés à la main (RTA & Siège).
  const allMonsters = useMemo(
    () => [...data.monsters, ...custom.customMonsters],
    [data.monsters, custom.customMonsters]
  );

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setMenuOpen(false); // referme le menu mobile à chaque navigation
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-5 sm:py-6 pb-16">
      {/* ---- Barre mobile : logo + menu hamburger ---- */}
      <div className="sm:hidden mb-4">
        <div className="flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="w-7 h-7" />
            <span className="font-display text-[18px] tracking-wide">SW Forge</span>
          </a>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-panel text-ink"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <nav className="mt-2 flex flex-col gap-1 bg-panel border border-border rounded-xl p-2">
            {NAV.map((item) => {
              const active = route === item.key;
              const Icon = item.icon;
              return (
                <a
                  key={item.key}
                  href={item.hash}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-semibold transition
                    ${active ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim'}`}
                >
                  <Icon size={18} /> {item.label}
                </a>
              );
            })}
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 border-t border-border text-[13px]">
              <StatusDot state={data.loadState} />
              <span className="text-ink-dim">
                <StatusText state={data.loadState} generatedAt={data.generatedAt} count={data.monsters.length} />
              </span>
              <button
                onClick={data.reload}
                className="ml-auto flex items-center text-ink-dim hover:text-ink transition"
                title="Recharger les données"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* ---- Barre desktop : onglets + statut ---- */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap mb-3">
        <nav className="flex flex-wrap items-center gap-1 bg-panel border border-border rounded-xl p-1 max-w-full">
          {NAV.map((item) => {
            const active = route === item.key;
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={item.hash}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition flex-none whitespace-nowrap
                  ${
                    active
                      ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                      : 'text-ink-dim hover:text-ink'
                  }`}
              >
                <Icon size={14} /> {item.label}
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 bg-panel border border-border rounded-[10px] px-3 py-1.5 text-[12.5px]">
          <StatusDot state={data.loadState} />
          <span className="text-ink-dim">
            <StatusText state={data.loadState} generatedAt={data.generatedAt} count={data.monsters.length} />
          </span>
          <button
            onClick={data.reload}
            className="flex items-center gap-1.5 text-ink-dim hover:text-ink transition ml-1"
            title="Recharger les données"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {route === 'rta' ? (
        <RtaPage
          monsters={allMonsters}
          loadState={data.loadState}
          onCreateMonster={custom.addCustomMonster}
          customMonsters={custom.customMonsters}
          onDeleteMonster={custom.removeCustomMonster}
        />
      ) : route === 'bestiary' ? (
        <BestiaryPage monsters={data.monsters} loadState={data.loadState} />
      ) : route === 'siege' ? (
        <SiegePage
          monsters={allMonsters}
          loadState={data.loadState}
          onCreateMonster={custom.addCustomMonster}
          customMonsters={custom.customMonsters}
          onDeleteMonster={custom.removeCustomMonster}
        />
      ) : route === 'arene' ? (
        <ComingSoon
          title="Arène"
          icon={Trophy}
          description="Préparation des équipes d'arène classique (offense et défense)."
        />
      ) : (
        <HomePage />
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
  generatedAt,
  count,
}: {
  state: LoadState;
  generatedAt: string | null;
  count: number;
}) {
  if (state === 'loading') return <>Chargement…</>;
  if (state === 'error') return <>Données indisponibles</>;
  const when = generatedAt ? new Date(generatedAt).toLocaleDateString('fr-FR') : null;
  return (
    <>
      <b className="text-ink">{count}</b> monstres{state === 'demo' && ' · démo'}
      {when && ` · ${when}`}
    </>
  );
}
