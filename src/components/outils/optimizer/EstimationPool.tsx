import { formatBig } from '../../../lib/formatBig';

export interface EstimationPoolProps {
  estimate: { perSlot: number[]; product: number; };
}

export default function EstimationPool({ estimate }: EstimationPoolProps) {
  return (
    <p className="text-micro text-ink-dim">
      {formatBig(estimate.perSlot.reduce((a, b) => a + b, 0))} runes gardées après pré-filtrage
      (pool par emplacement : {estimate.perSlot.join(' + ')})
    </p>
  );
}
