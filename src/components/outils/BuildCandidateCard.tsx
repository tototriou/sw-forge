import { RuneDetail, RUNE_SETS } from '../../types';
import { BuildCandidate } from '../../lib/runeBuildOptim';
import { activeSets, isAncient } from '../../lib/effects';
import { RuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import RuneSlotIcon from '../RuneSlotIcon';
import StatTable from './StatTable';

interface Props {
  rank: number;
  candidate: BuildCandidate;
  runeById: Map<number, RuneDetail>;
  metric: RuneMetric;
}

// Une combinaison trouvée : les 6 runes (cadres orientés par slot), les sets
// obtenus, la table de stats résultante et la valeur totale dans la mesure
// choisie (Efficience ou Score SW — réglage global, voir compte/runes.md).
export default function BuildCandidateCard({ rank, candidate, runeById, metric }: Props) {
  const runes = candidate.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => !!r);
  const sets = activeSets(runes.map((r) => r.set));

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] font-bold text-star">#{rank}</span>
        <span className="font-mono text-[12px] text-ink-dim">
          {formatRuneMetric(candidate.effTotal, metric)} au total
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {runes.map((r) => (
          <RuneSlotIcon key={r.id} slot={r.slot} setKey={r.set} rarity={r.rarity} ancient={isAncient(r)} height={38} />
        ))}
      </div>

      {sets.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-dim">
          {sets.map((key, i) => (
            <span key={`${key}-${i}`}>{RUNE_SETS.find((s) => s.key === key)?.label ?? key}</span>
          ))}
        </p>
      )}

      <StatTable stats={candidate.stats} />
    </div>
  );
}
