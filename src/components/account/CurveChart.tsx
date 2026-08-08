// Rendu SVG (sobre) d'une ou plusieurs courbes d'efficience de runes.
// Ordonnée = efficience (%), abscisse = nombre de runes (rang cumulé).
// Réutilisé par « Courbes » (une série) et « Comparaison » (plusieurs séries).

export interface CurveSeries {
  name: string;
  effs: number[]; // efficiences (%), triées décroissant, déjà limitées à l'affichage
  color: string;
  own: boolean; // true = ma courbe (aire + trait plus épais)
}

const W = 820;
const H = 380;
const PAD_L = 52;
const PAD_R = 18;
const PAD_T = 20;
const PAD_B = 42;
const IW = W - PAD_L - PAD_R;
const IH = H - PAD_T - PAD_B;

export const OWN_COLOR = '#ffb347';

interface Pt {
  x: number;
  y: number;
}

function niceStep(range: number): number {
  const raw = range / 5;
  for (const s of [5, 10, 20, 25, 50, 100]) if (raw <= s) return s;
  return 100;
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function downsample(effs: number[], toX: (i: number) => number, toY: (e: number) => number): Pt[] {
  const n = effs.length;
  const MAXP = 240;
  const step = Math.max(1, Math.ceil(n / MAXP));
  const out: Pt[] = [];
  for (let i = 0; i < n; i += step) out.push({ x: toX(i), y: toY(effs[i]) });
  if (out.length && n > 0 && out[out.length - 1].x !== toX(n - 1)) {
    out.push({ x: toX(n - 1), y: toY(effs[n - 1]) });
  }
  return out;
}

export default function CurveChart({ series }: { series: CurveSeries[] }) {
  const active = series.filter((s) => s.effs.length > 0);
  if (active.length === 0) {
    return <p className="text-ink-dim text-[13px]">Aucune rune à afficher.</p>;
  }

  // Bornes X (nb max de runes) et Y (min→max global, arrondis).
  let maxLen = 1;
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of active) {
    maxLen = Math.max(maxLen, s.effs.length);
    hi = Math.max(hi, s.effs[0]);
    lo = Math.min(lo, s.effs[s.effs.length - 1]);
  }
  lo = Math.floor(lo / 10) * 10;
  hi = Math.ceil(hi / 10) * 10;
  if (hi <= lo) hi = lo + 10;

  const x = (i: number) => PAD_L + (maxLen <= 1 ? IW / 2 : (i / (maxLen - 1)) * IW);
  const y = (e: number) => PAD_T + IH - ((e - lo) / (hi - lo)) * IH;

  const yStep = niceStep(hi - lo);
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 0.001; v += yStep) yTicks.push(v);
  const xTickCount = Math.min(6, maxLen);
  const xTicks = Array.from({ length: xTickCount }, (_, k) =>
    Math.round((k / (xTickCount - 1 || 1)) * (maxLen - 1))
  );

  const me = active.find((s) => s.own);

  return (
    <div className="rounded-xl border border-border bg-panel/50 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="rcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={OWN_COLOR} stopOpacity="0.14" />
            <stop offset="100%" stopColor={OWN_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grille + graduations Y */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke="#242a4d"
              strokeWidth="1"
              strokeDasharray={v === lo ? '' : '3 5'}
            />
            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7c85b8" fontFamily="monospace">
              {Math.round(v)}%
            </text>
          </g>
        ))}

        {/* Graduations X (nombre de runes) */}
        {xTicks.map((i) => (
          <g key={`x${i}`}>
            <line x1={x(i)} y1={PAD_T} x2={x(i)} y2={PAD_T + IH} stroke="#1c2140" strokeWidth="1" />
            <text
              x={x(i)}
              y={H - PAD_B + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#7c85b8"
              fontFamily="monospace"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* Aire sous ma courbe */}
        {me &&
          (() => {
            const line = smoothPath(downsample(me.effs, x, y));
            const area = `${line} L${x(me.effs.length - 1).toFixed(1)},${(PAD_T + IH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + IH).toFixed(1)} Z`;
            return <path d={area} fill="url(#rcFill)" />;
          })()}

        {/* Courbes (overlays d'abord, la mienne au-dessus) */}
        {[...active]
          .sort((a, b) => Number(a.own) - Number(b.own))
          .map((s) => (
            <path
              key={s.name}
              d={smoothPath(downsample(s.effs, x, y))}
              fill="none"
              stroke={s.color}
              strokeWidth={s.own ? 2 : 1.6}
              strokeOpacity={s.own ? 1 : 0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

        {/* Titres des axes */}
        <text x={PAD_L + IW / 2} y={H - 5} textAnchor="middle" fontSize="11" fill="#9aa2d0" fontFamily="monospace">
          Nombre de runes
        </text>
        <text
          x={15}
          y={PAD_T + IH / 2}
          textAnchor="middle"
          fontSize="11"
          fill="#9aa2d0"
          fontFamily="monospace"
          transform={`rotate(-90 15 ${PAD_T + IH / 2})`}
        >
          Efficience (%)
        </text>
      </svg>
    </div>
  );
}
