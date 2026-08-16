import { Hammer, Gem } from 'lucide-react';
import { CraftLine, RuneDetail } from '../../types';
import type { AccountView } from '../../App';
import RunesSummary from './RunesSummary';
import RunesList from './RunesList';
import RunesCurve from './RunesCurve';
import RunesCompare from './RunesCompare';
import RunesOptim from './RunesOptim';
import ComingSoon from '../../pages/ComingSoon';

interface Props {
  runes: RuneDetail[];
  crafts: CraftLine[];
  // Vue courante. ⚠️ Elle vient de l'URL et de la barre latérale — les onglets
  // internes qui vivaient ici ont disparu : sept vues cachées derrière une
  // rangée d'onglets qu'on ne voyait qu'une fois sur la page.
  vue: AccountView;
}

export default function RunesSection({ runes, crafts, vue: view }: Props) {
  return (
    <div>
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
