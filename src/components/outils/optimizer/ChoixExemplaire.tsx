import { exclusionSelectorKey, type ExclusionSource, type ExclusionCandidate } from '../../../lib/optimizerExclusion';
import ExclusionCandidateRow from '../ExclusionCandidateRow';

export interface ChoixExemplaireProps {
  candidatesBySource: Record<ExclusionSource, ExclusionCandidate[]>;
  gearSource: ExclusionSource;
  choisirExemplaireZoneD: (c: ExclusionCandidate) => void;
}

export default function ChoixExemplaire({ candidatesBySource, gearSource, choisirExemplaireZoneD }: ChoixExemplaireProps) {
  return (
    candidatesBySource[gearSource].length === 0 ? (
      <div className="px-3 py-2 text-ink-dim text-[12.5px]">Aucun exemplaire.</div>
    ) : (
      candidatesBySource[gearSource].map((c) => (
        <button
          key={exclusionSelectorKey(c.selector)}
          type="button"
          onClick={() => choisirExemplaireZoneD(c)}
          className={`flex w-full items-center gap-3 px-3 text-left transition hoverable:bg-accent-soft ${
            c.teamContext ? 'py-1' : 'py-1.5'
          }`}
        >
          <ExclusionCandidateRow candidate={c} />
        </button>
      ))
    )
  );
}
