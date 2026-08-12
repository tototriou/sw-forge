import { List, Gauge } from 'lucide-react';
import { ArtifactDetail } from '../../types';
import { useStickyState } from '../../hooks/useStickyState';
import ArtifactsSummary from './ArtifactsSummary';
import ArtifactsList from './ArtifactsList';

interface Props {
  artifacts: ArtifactDetail[];
}

type View = 'resume' | 'liste';

// Mêmes onglets que les runes, et le **Résumé en premier** comme vue par
// défaut : on arrive sur l'état du stock, pas sur 2 000 tuiles.
//
// ⚠️ Pas d'onglet « Optimisation » ici, et il n'y en aura pas : il n'existe ni
// meule ni gemme pour les artéfacts. Une ligne tombée est définitive, le seul
// levier est de monter la pièce au +15. Voir spec/compte/calcul-artefacts.md.
const VIEWS: { key: View; label: string; icon: typeof List }[] = [
  { key: 'resume', label: 'Résumé', icon: Gauge },
  { key: 'liste', label: 'Liste', icon: List },
];

export default function ArtifactsSection({ artifacts }: Props) {
  const [view, setView] = useStickyState<View>('artefacts.view', 'resume');

  return (
    <div>
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

      {view === 'resume' && <ArtifactsSummary artifacts={artifacts} />}
      {view === 'liste' && <ArtifactsList artifacts={artifacts} />}
    </div>
  );
}
