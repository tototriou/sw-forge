import type { RapportImportOptimizer } from '../../lib/importEquipes';
import { Modale } from '../../ui/Dialogs';

// Portée par App : le rapport reste lisible après l'atterrissage dans l'Optimizer.
export default function OptimizerImportRapport({ rapport, onFermer }: {
  rapport: RapportImportOptimizer;
  onFermer: () => void;
}) {
  return <Modale titre="Export vers l'Optimizer" labelledBy="rapport-export-optimizer" croix onClose={onFermer}>
    <div role="status" aria-label="Rapport d’import" className="space-y-2 text-sm text-ink-dim">
      <p>{rapport.listeCreee ? `Liste « ${rapport.listeCreee.name} » créée : ${rapport.membresImportes} monstre(s), ${rapport.equipesCreees} équipe(s).` : 'Aucune liste créée.'}</p>
      {rapport.ignores.map((m, i) => <p key={`ignore-${i}`}>{m.libelle} : {m.raison}</p>)}
      {rapport.messages.map((m, i) => <p key={`message-${i}`}>{m}</p>)}
    </div>
  </Modale>;
}
