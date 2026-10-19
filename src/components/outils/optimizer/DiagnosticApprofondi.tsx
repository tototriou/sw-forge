import { RECO_STATS } from '../../../types';
import { type BlockingConditionsDiagnosis } from '../../../lib/runeBuildOptim';

export interface DiagnosticApprofondiProps {
  blockingDiagnosis: BlockingConditionsDiagnosis | null;
  diagnoseBlockingEnabled: boolean;
}

export default function DiagnosticApprofondi({ blockingDiagnosis, diagnoseBlockingEnabled }: DiagnosticApprofondiProps) {
  return blockingDiagnosis && blockingDiagnosis.impacts.length > 0 ? (
    <div className="mb-3 rounded-lg border border-border bg-panel p-3">
      <p className="mb-1.5 text-xs font-semibold text-ink">
        Diagnostic approfondi — pool le plus restreint : {blockingDiagnosis.baselineMinSlot} candidat(s)
        actuellement.
      </p>
      <ul className="space-y-1">
        {blockingDiagnosis.impacts.map((imp) => {
          const st = RECO_STATS.find((s) => s.key === imp.key)!;
          return (
            <li key={`${imp.key}-${imp.kind}`} className="text-xs text-ink-dim">
              {imp.delta == null ? (
                <>
                  <span className="font-semibold text-ink">{st.label}</span> ({imp.kind === 'min' ? '≥' : '≤'}{' '}
                  {imp.requested}
                  {st.suffix}) : aucun gain, même desserrée entièrement.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{st.label}</span>{' '}
                  {imp.kind === 'min' ? `−${imp.delta}` : `+${imp.delta}`}
                  {st.suffix} suffit ({imp.kind === 'min' ? '≥' : '≤'} {imp.threshold}
                  {st.suffix}) : {imp.poolMinSlotAtThreshold} candidat(s).
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-micro text-ink-dim">
        Un indice, pas une preuve — basé sur le pré-filtrage sûr, pas sur une recherche complète.
      </p>
    </div>
  ) : (
    !diagnoseBlockingEnabled && (
      <p className="mb-3 text-[11px] text-ink-dim">
        Astuce : active le diagnostic approfondi (Réglages avancés) pour identifier quelle
        condition libère le plus de candidats.
      </p>
    )
  );
}
