import { RECO_STATS } from '../../../types';
import { type StatFeasibility } from '../../../lib/runeBuildOptim';

export interface DiagnosticFaisabiliteProps {
  impossibleFeasibility: StatFeasibility[];
}

export default function DiagnosticFaisabilite({ impossibleFeasibility }: DiagnosticFaisabiliteProps) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-panel p-3">
      {impossibleFeasibility.length > 0 ? (
        <>
          <p className="mb-1.5 text-xs font-semibold text-bad">
            {impossibleFeasibility.length === 1
              ? 'Une condition est'
              : `${impossibleFeasibility.length} conditions sont`}{' '}
            mathématiquement hors de portée, quel que soit le runage choisi :
          </p>
          <ul className="space-y-1">
            {impossibleFeasibility.map((f) => {
              const st = RECO_STATS.find((s) => s.key === f.key)!;
              return (
                <li key={`${f.key}-${f.kind}`} className="text-xs text-ink-dim">
                  <span className="font-semibold text-ink">{st.label}</span>{' '}
                  {f.kind === 'min'
                    ? `minimum demandé ${f.requested}${st.suffix} — maximum atteignable ${f.bound}${st.suffix} avec ce pool, ce set et ces statistiques principales.`
                    : `maximum demandé ${f.requested}${st.suffix} — ${f.bound}${st.suffix} déjà garanti sans la moindre rune (base, artéfacts, bonus de set).`}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-ink-dim">
          Aucune condition n'est, à elle seule, mathématiquement hors de portée — le blocage
          vient probablement de leur <b className="text-ink">combinaison</b> (rare qu'un seul
          build satisfasse tout à la fois), ou du pré-filtrage de la recherche elle-même. Essaie
          de desserrer une condition, ou un pré-filtrage plus large (Réglages avancés).
        </p>
      )}
    </div>
  );
}
