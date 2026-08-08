import { List, LineChart, GitCompare, Wand2 } from 'lucide-react';
import { RuneDetail } from '../../types';
import { useStickyState } from '../../hooks/useStickyState';
import RunesList from './RunesList';
import RunesCurve from './RunesCurve';
import RunesCompare from './RunesCompare';
import RunesOptim from './RunesOptim';

interface Props {
  runes: RuneDetail[];
}

type View = 'liste' | 'courbes' | 'comparaison' | 'optimisation';

const VIEWS: { key: View; label: string; icon: typeof List }[] = [
  { key: 'liste', label: 'Liste', icon: List },
  { key: 'courbes', label: 'Courbes', icon: LineChart },
  { key: 'comparaison', label: 'Comparaison', icon: GitCompare },
  { key: 'optimisation', label: 'Optimisation', icon: Wand2 },
];

export default function RunesSection({ runes }: Props) {
  const [view, setView] = useStickyState<View>('runes.view', 'liste');

  return (
    <div>
      {/* Onglets internes des runes */}
      <div className="flex items-center gap-1 bg-panel border border-border rounded-xl p-1 w-fit mb-5">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition
                ${active ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow' : 'text-ink-dim hover:text-ink'}`}
            >
              <Icon size={14} /> {v.label}
            </button>
          );
        })}
      </div>

      {view === 'liste' && <RunesList runes={runes} />}
      {view === 'courbes' && <RunesCurve runes={runes} />}
      {view === 'comparaison' && <RunesCompare runes={runes} />}
      {view === 'optimisation' && <RunesOptim runes={runes} />}
    </div>
  );
}
