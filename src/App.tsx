import { useEffect, useState } from 'react';
import { RefreshCw, Swords, BookOpen, Home, Castle, Trophy } from 'lucide-react';
import HomePage from './pages/HomePage';
import BestiaryPage from './pages/BestiaryPage';
import RtaPage from './pages/RtaPage';
import SiegePage from './pages/SiegePage';
import ComingSoon from './pages/ComingSoon';
import { useMonsters, LoadState } from './hooks/useMonsters';

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
  const [route, setRoute] = useState<Route>(routeFromHash);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="max-w-[1180px] mx-auto px-5 py-6 pb-16">
      <div className="flex items-center gap-4 flex-wrap mb-2">
        <nav className="flex items-center gap-1.5 bg-panel border border-border rounded-xl p-1">
          {NAV.map((item) => {
            const active = route === item.key;
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={item.hash}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition
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
        <RtaPage monsters={data.monsters} loadState={data.loadState} />
      ) : route === 'bestiary' ? (
        <BestiaryPage monsters={data.monsters} loadState={data.loadState} />
      ) : route === 'siege' ? (
        <SiegePage monsters={data.monsters} loadState={data.loadState} />
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
