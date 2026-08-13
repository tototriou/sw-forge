import { useRef } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { BuildCandidate, candidateMetricTotal } from '../../lib/runeBuildOptim';
import { activeSets, isAncient } from '../../lib/effects';
import { RuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import { RuneDetailBox } from '../MonsterGear';
import RuneSlotIcon from '../RuneSlotIcon';
import DetailPopover from '../account/DetailPopover';
import StatTable from './StatTable';

interface Props {
  rank: number;
  candidate: BuildCandidate;
  runeById: Map<number, RuneDetail>;
  metric: RuneMetric;
  // Identité de la rune actuellement ouverte, PARTAGÉE entre tous les
  // résultats affichés (pas locale à cette carte) — voir
  // OptimizerSection.tsx / useOptimizerState.ts. Permet qu'un clic sur une
  // autre rune, même dans une autre carte, ferme le popover déjà ouvert.
  openRuneKey: string | null;
  onToggleRune: (key: string) => void;
}

// Une combinaison trouvée : les 6 runes (cadres orientés par slot), les sets
// obtenus, la table de stats résultante et la valeur totale dans la mesure
// choisie (Efficience ou Score SW — réglage global, voir compte/runes.md).
export default function BuildCandidateCard({ rank, candidate, runeById, metric, openRuneKey, onToggleRune }: Props) {
  const runes = candidate.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => !!r);
  const sets = activeSets(runes.map((r) => r.set));
  // ⚠️ Une même rune peut apparaître dans PLUSIEURS candidats affichés (une
  // bonne rune revient souvent) : identifier par le seul `rune.id` ferait
  // s'ouvrir deux popovers d'un coup si cette rune figure dans deux cartes.
  // La clé combine donc la carte (runeIds du candidat) et le slot.
  const candidateKey = candidate.runeIds.join('-');
  // ⚠️ PAS `candidate.effTotal` : figé dans la mesure active au moment de la
  // recherche, il devient incohérent avec le popover d'une rune individuelle
  // (recalculé en direct) si l'utilisateur bascule Efficience ↔ Score après
  // coup sans relancer — voir runeBuildOptim.ts.
  const liveTotal = candidateMetricTotal(candidate, runeById, metric);

  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] font-bold text-star">#{rank}</span>
        <span className="font-mono text-[12px] text-ink-dim">
          {formatRuneMetric(liveTotal / 6, metric)} en moyenne
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {runes.map((r) => {
          const runeKey = `${candidateKey}-${r.slot}`;
          return (
            <ClickableRune
              key={r.slot}
              rune={r}
              open={openRuneKey === runeKey}
              onToggle={() => onToggleRune(runeKey)}
            />
          );
        })}
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

// Clic pour visualiser une rune du build, exactement comme dans Mon compte →
// Runes (même popover ancré, même carte de détail) — un candidat n'est
// composé que des vraies runes du compte, autant pouvoir les inspecter sans
// aller les rechercher ailleurs. `open`/`onToggle` viennent du parent : une
// seule rune ouverte à la fois parmi TOUS les résultats affichés, pas un état
// local par rune (sinon cliquer une autre rune n'en fermerait aucune).
function ClickableRune({ rune, open, onToggle }: { rune: RuneDetail; open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={open}
        className={`block rounded-lg transition hoverable:brightness-110 ${
          open ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : ''
        }`}
        aria-label={`Voir le détail de cette rune (slot ${rune.slot})`}
      >
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={isAncient(rune)} height={38} />
      </button>
      <DetailPopover open={open} anchorRef={ref} width={260} height={320}>
        <RuneDetailBox rune={rune} />
      </DetailPopover>
    </div>
  );
}
