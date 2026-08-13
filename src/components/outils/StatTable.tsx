import { StatRow } from '../../lib/stats';
import { displayedTotal, useOvercapDisplay } from '../../hooks/useOvercapDisplay';

// Table de stats en LECTURE SEULE (base / bonus / total), même grammaire que
// MonsterGear.tsx et le tableau de lecture des recommandations de siège —
// non extraite en composant partagé (limite le risque en touchant ces deux
// fichiers qui fonctionnent déjà), simplement le même gabarit visuel repris
// localement à l'Optimizer.
export default function StatTable({ stats }: { stats: StatRow[] }) {
  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const showOvercap = useOvercapDisplay();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[236px] text-[11.5px]">
        <thead>
          <tr className="label">
            <th className="pb-1 pr-2 text-left font-normal">Stat</th>
            <th className="pb-1 pr-2 text-right font-normal">base</th>
            <th className="pb-1 pr-2 text-left font-normal">bonus</th>
            <th className="pb-1 text-right font-normal">total</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.key} className="border-b border-border/40 last:border-0">
              <td className="py-0.5 pr-2 text-ink-dim">{row.label}</td>
              <td className="py-0.5 pr-2 text-right font-mono text-ink-dim tabular-nums">
                {fmt(row.base)}
                {row.suffix}
              </td>
              <td className="py-0.5 pr-2 text-left font-mono text-good tabular-nums">
                {row.bonus > 0 ? `+${fmt(row.bonus)}${row.suffix}` : '—'}
              </td>
              <td className="py-0.5 text-right font-mono font-semibold text-ink tabular-nums">
                {fmt(displayedTotal(row.key, row.total, showOvercap))}
                {row.suffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
