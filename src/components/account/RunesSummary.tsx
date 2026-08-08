import { useMemo } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { RARITY_META, RUNE_EFFECT, runeEfficiency } from '../../lib/effects';
import { runePotential } from '../../lib/runeOptim';
import RuneIcon from '../RuneIcon';

interface Props {
  runes: RuneDetail[];
}

// Paliers d'efficience (du meilleur au moins bon) pour la distribution.
const EFF_BUCKETS: { min: number; label: string; color: string }[] = [
  { min: 110, label: '≥ 110 %', color: '#f8b24a' },
  { min: 100, label: '100 – 110 %', color: '#c88cff' },
  { min: 90, label: '90 – 100 %', color: '#7cf0a6' },
  { min: 80, label: '80 – 90 %', color: '#8fd4ff' },
  { min: 70, label: '70 – 80 %', color: '#8890B8' },
  { min: 0, label: '< 70 %', color: '#5B6280' },
];

// Slots à stat principale variable (les impairs sont figés : 1 ATQ, 3 DEF, 5 PV).
const VAR_SLOTS = [2, 4, 6];

// Agrégat simple (nombre, somme d'efficience, meilleure).
interface Agg {
  n: number;
  sum: number;
  best: number;
}
const emptyAgg = (): Agg => ({ n: 0, sum: 0, best: 0 });
const push = (a: Agg, eff: number) => {
  a.n += 1;
  a.sum += eff;
  if (eff > a.best) a.best = eff;
};
const avg = (a: Agg) => (a.n ? a.sum / a.n : 0);

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const fmt = (v: number) => v.toFixed(1);

export default function RunesSummary({ runes }: Props) {
  // Tout le résumé est calculé en un seul passage, mémoïsé par import.
  const s = useMemo(() => {
    const effs: number[] = [];
    const bySlot = new Map<number, Agg>();
    const bySet = new Map<string, Agg>();
    const byRarity = new Map<number, number>();
    const byMain = new Map<number, number>(); // stat principale des slots 2/4/6
    const buckets = EFF_BUCKETS.map(() => 0);

    let ancient = 0;
    let maxed = 0; // +15
    let gemmed = 0; // au moins un substat gemmé
    let fourSubs = 0; // 4 substats révélés

    // Potentiel (scénario légendaire) : gemme + meule, puis meule seule.
    let potSum = 0;
    let grindTodo = 0; // runes où il reste de la meule à poser
    let gemTodo = 0; // runes non gemmées (une gemme reste à poser)

    for (const r of runes) {
      const eff = runeEfficiency(r);
      effs.push(eff);

      const bi = EFF_BUCKETS.findIndex((b) => eff >= b.min);
      buckets[bi < 0 ? EFF_BUCKETS.length - 1 : bi] += 1;

      if (!bySlot.has(r.slot)) bySlot.set(r.slot, emptyAgg());
      push(bySlot.get(r.slot)!, eff);
      if (!bySet.has(r.set)) bySet.set(r.set, emptyAgg());
      push(bySet.get(r.set)!, eff);
      byRarity.set(r.rarity, (byRarity.get(r.rarity) ?? 0) + 1);
      if (VAR_SLOTS.includes(r.slot)) byMain.set(r.main.code, (byMain.get(r.main.code) ?? 0) + 1);

      if (r.rank > 10) ancient += 1;
      if (r.level >= 15) maxed += 1;
      if (r.subs.length >= 4) fourSubs += 1;

      const isGemmed = r.subs.some((x) => x.enchant);
      if (isGemmed) gemmed += 1;
      else gemTodo += 1;

      const pot = runePotential(r, true);
      potSum += pot.legendEff;
      if (runePotential(r, false).legendGain > 0.05) grindTodo += 1;
    }

    const total = runes.length;
    const sorted = [...effs].sort((a, b) => b - a);
    const mean = total ? effs.reduce((x, y) => x + y, 0) / total : 0;
    const median = total ? sorted[Math.floor((total - 1) / 2)] : 0;
    const topAvg = (k: number) => {
      const slice = sorted.slice(0, Math.min(k, total));
      return slice.length ? slice.reduce((x, y) => x + y, 0) / slice.length : 0;
    };

    return {
      total,
      mean,
      median,
      best: sorted[0] ?? 0,
      top10: topAvg(10),
      top100: topAvg(100),
      over100: sorted.filter((e) => e >= 100).length,
      over110: sorted.filter((e) => e >= 110).length,
      ancient,
      maxed,
      gemmed,
      fourSubs,
      buckets,
      potAvg: total ? potSum / total : 0,
      grindTodo,
      gemTodo,
      slots: [1, 2, 3, 4, 5, 6].map((n) => ({ slot: n, agg: bySlot.get(n) ?? emptyAgg() })),
      sets: RUNE_SETS.filter((rs) => bySet.has(rs.key))
        .map((rs) => ({ set: rs, agg: bySet.get(rs.key)! }))
        .sort((a, b) => b.agg.n - a.agg.n),
      rarities: [5, 4, 3, 2, 1].map((r) => ({ rarity: r, n: byRarity.get(r) ?? 0 })),
      mains: [...byMain.entries()]
        .map(([code, n]) => ({ code, n }))
        .sort((a, b) => b.n - a.n),
    };
  }, [runes]);

  if (!s.total) {
    return (
      <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-[13px] text-ink-dim">
        Aucune rune dans l'inventaire importé.
      </p>
    );
  }

  const varTotal = s.mains.reduce((x, m) => x + m.n, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Chiffres clés ---------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi label="Runes" value={s.total.toLocaleString('fr-FR')} sub={`${s.maxed} au +15`} />
        <Kpi label="Eff. moyenne" value={`${fmt(s.mean)} %`} sub={`médiane ${fmt(s.median)} %`} tone="#8fd4ff" />
        <Kpi label="Top 100" value={`${fmt(s.top100)} %`} sub={`top 10 ${fmt(s.top10)} %`} tone="#7cf0a6" />
        <Kpi label="Meilleure" value={`${fmt(s.best)} %`} sub={`${s.over110} rune(s) ≥ 110 %`} tone="#F2C24C" />
        <Kpi
          label="≥ 100 %"
          value={s.over100.toLocaleString('fr-FR')}
          sub={`${fmt(pct(s.over100, s.total))} % du stock`}
          tone="#c88cff"
        />
        <Kpi
          label="Antiques"
          value={s.ancient.toLocaleString('fr-FR')}
          sub={`${fmt(pct(s.ancient, s.total))} % du stock`}
          tone="#E9E7F0"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---- Distribution d'efficience -------------------------------- */}
        <Panel title="Distribution d'efficience">
          <div className="flex flex-col gap-1.5">
            {EFF_BUCKETS.map((b, i) => (
              <BarRow
                key={b.label}
                label={b.label}
                n={s.buckets[i]}
                total={s.total}
                max={Math.max(...s.buckets)}
                color={b.color}
              />
            ))}
          </div>
        </Panel>

        {/* ---- Qualité du stock ----------------------------------------- */}
        <Panel title="Qualité du stock">
          <div className="flex flex-col gap-1.5">
            <BarRow label="Montées au +15" n={s.maxed} total={s.total} max={s.total} color="#F2C24C" />
            <BarRow label="4 substats révélés" n={s.fourSubs} total={s.total} max={s.total} color="#7cf0a6" />
            <BarRow label="Gemmées" n={s.gemmed} total={s.total} max={s.total} color="#c88cff" />
            <BarRow label="Antiques" n={s.ancient} total={s.total} max={s.total} color="#8fd4ff" />
          </div>

          <div className="mt-3 border-t border-border pt-3 flex flex-col gap-1.5">
            <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Raretés</p>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel2">
              {s.rarities.map(
                (r) =>
                  r.n > 0 && (
                    <div
                      key={r.rarity}
                      title={`${RARITY_META[r.rarity].label} — ${r.n}`}
                      style={{ width: `${pct(r.n, s.total)}%`, background: RARITY_META[r.rarity].color }}
                    />
                  )
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-ink-dim">
              {s.rarities.map((r) => (
                <span key={r.rarity} className="flex items-center gap-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: RARITY_META[r.rarity].color }}
                  />
                  {RARITY_META[r.rarity].label} <b className="text-ink">{r.n}</b>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ---- Par slot ---------------------------------------------------- */}
      <Panel title="Par emplacement">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {s.slots.map(({ slot, agg }) => (
            <div key={slot} className="rounded-lg border border-border bg-panel2 px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-dim">Slot {slot}</span>
                <span className="font-mono text-[12px] text-ink">{agg.n}</span>
              </div>
              <div className="mt-1 font-mono text-[12px] text-ink-dim">
                moy. <b className="text-ink">{fmt(avg(agg))} %</b>
              </div>
              <div className="font-mono text-[11px] text-ink-dim">
                max <b className="text-star">{fmt(agg.best)} %</b>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---- Stats principales (slots 2/4/6) -------------------------- */}
        <Panel title="Stats principales (slots 2 · 4 · 6)">
          <div className="flex flex-col gap-1.5">
            {s.mains.map((m) => (
              <BarRow
                key={m.code}
                label={RUNE_EFFECT[m.code]?.label ?? `#${m.code}`}
                n={m.n}
                total={varTotal}
                max={s.mains[0].n}
                color="#5CC2FF"
              />
            ))}
          </div>
        </Panel>

        {/* ---- Marge de progression ------------------------------------- */}
        <Panel title="Marge de progression">
          <p className="mb-3 text-[12px] text-ink-dim leading-relaxed">
            Si chaque rune recevait sa gemme optimale puis sa meule au max, en scénario{' '}
            <b className="text-ink">légendaire</b>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Eff. moyenne" value={`${fmt(s.mean)} %`} sub="aujourd'hui" />
            <Kpi
              label="Potentiel moyen"
              value={`${fmt(s.potAvg)} %`}
              sub={`+${fmt(s.potAvg - s.mean)} pts`}
              tone="#7cf0a6"
            />
            <Kpi
              label="Meules à poser"
              value={s.grindTodo.toLocaleString('fr-FR')}
              sub={`${fmt(pct(s.grindTodo, s.total))} % du stock`}
              tone="#F2C24C"
            />
            <Kpi
              label="Gemmes à poser"
              value={s.gemTodo.toLocaleString('fr-FR')}
              sub={`${fmt(pct(s.gemTodo, s.total))} % du stock`}
              tone="#c88cff"
            />
          </div>
        </Panel>
      </div>

      {/* ---- Par set ----------------------------------------------------- */}
      <Panel title={`Par set (${s.sets.length})`}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2">
          {s.sets.map(({ set, agg }) => (
            <div
              key={set.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-2.5 py-2"
              style={{ borderLeft: `3px solid ${set.accent}` }}
            >
              <RuneIcon setKey={set.key} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-ink truncate">{set.label}</span>
                  <span className="font-mono text-[12px] text-ink-dim">{agg.n}</span>
                </div>
                <div className="font-mono text-[11px] text-ink-dim">
                  moy. <b className="text-ink">{fmt(avg(agg))} %</b> · max{' '}
                  <b className="text-star">{fmt(agg.best)} %</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---- Briques d'affichage ------------------------------------------------ */

// Tuile de chiffre clé : libellé mono, grande valeur, sous-titre.
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-3 py-2.5">
      <p className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-dim">{label}</p>
      <p className="mt-0.5 text-[22px] font-bold leading-none tabular-nums" style={{ color: tone ?? '#E9E7F0' }}>
        {value}
      </p>
      {sub && <p className="mt-1 font-mono text-[11px] text-ink-dim">{sub}</p>}
    </div>
  );
}

// Panneau titré.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <h3 className="mb-3 font-mono text-[11px] tracking-[0.14em] uppercase text-ink-dim">{title}</h3>
      {children}
    </section>
  );
}

// Ligne de barre : libellé · barre proportionnelle · effectif + part.
function BarRow({
  label,
  n,
  total,
  max,
  color,
}: {
  label: string;
  n: number;
  total: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[104px] flex-none font-mono text-[11.5px] text-ink-dim truncate" title={label}>
        {label}
      </span>
      <div className="h-2.5 flex-1 rounded-full bg-panel2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${max ? (n / max) * 100 : 0}%`, background: color }}
        />
      </div>
      <span className="w-[92px] flex-none text-right font-mono text-[11.5px] text-ink-dim tabular-nums">
        <b className="text-ink">{n.toLocaleString('fr-FR')}</b> · {fmt(pct(n, total))} %
      </span>
    </div>
  );
}
