import { List, LineChart, GitCompare, Wand2, Gauge, Hammer, Gem } from 'lucide-react';
import { CraftLine, RuneDetail } from '../../types';
import { useStickyState } from '../../hooks/useStickyState';
import RunesSummary from './RunesSummary';
import RunesList from './RunesList';
import RunesCurve from './RunesCurve';
import RunesCompare from './RunesCompare';
import RunesOptim from './RunesOptim';
import ComingSoon from '../../pages/ComingSoon';

interface Props {
  runes: RuneDetail[];
  crafts: CraftLine[];
}

type View = 'resume' | 'liste' | 'courbes' | 'comparaison' | 'optimisation' | 'meules' | 'gemmes';

const VIEWS: { key: View; label: string; icon: typeof List }[] = [
  { key: 'resume', label: 'Résumé', icon: Gauge },
  { key: 'liste', label: 'Liste', icon: List },
  { key: 'courbes', label: 'Courbes', icon: LineChart },
  { key: 'comparaison', label: 'Comparaison', icon: GitCompare },
  { key: 'optimisation', label: 'Optimisation', icon: Wand2 },
  // ⚠️ Ces deux-là ne refont pas l'Optimisation : « quelles runes puis-je
  // améliorer avec ce que j'ai » y est un simple FILTRE, sans quoi il faudrait
  // y réimplémenter potentiels et gains. Ils porteront la question inverse —
  // ce qui MANQUE, et où aller le chercher.
  { key: 'meules', label: 'Meules', icon: Hammer },
  { key: 'gemmes', label: 'Gemmes', icon: Gem },
];

export default function RunesSection({ runes, crafts }: Props) {
  const [view, setView] = useStickyState<View>('runes.view', 'resume');

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
                ${active ? 'bg-accent-soft text-ink shadow' : 'text-ink-dim hoverable:text-ink'}`}
            >
              <Icon size={14} /> {v.label}
            </button>
          );
        })}
      </div>

      {view === 'resume' && <RunesSummary runes={runes} />}
      {view === 'liste' && <RunesList runes={runes} />}
      {view === 'courbes' && <RunesCurve runes={runes} />}
      {view === 'comparaison' && <RunesCompare runes={runes} />}
      {view === 'optimisation' && <RunesOptim runes={runes} crafts={crafts} />}
      {view === 'meules' && <ComingSoon title="Meules" icon={Hammer} />}
      {view === 'gemmes' && <ComingSoon title="Gemmes" icon={Gem} />}
    </div>
  );
}
