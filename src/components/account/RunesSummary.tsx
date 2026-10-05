import { useMemo } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { RARITY_META, RUNE_EFFECT, runeEfficiency } from '../../lib/effects';
import { runePotential } from '../../lib/runeOptim';
import RuneIcon from '../RuneIcon';
import { Kpi, Panel, BarRow, pct, fmt, CARTE_CHIFFRES_DOIGT } from './SummaryBits';

interface Props {
  runes: RuneDetail[];
}

// Paliers d'efficience (du meilleur au moins bon) pour la distribution.
//
// ⚠️ Rampe ORDINALE : « ≥ 110 % » … « < 70 % » est une échelle ORDONNÉE, pas six
// catégories. Une seule teinte, du plus foncé au plus clair — le lecteur voit
// l'ordre dans la couleur. Six teintes différentes (ambre, violet, vert, bleu…)
// dépensaient le canal identité pour re-encoder ce que la longueur de barre dit
// déjà, et cinq d'entre elles étaient illisibles sur fond clair.
// Les valeurs vivent dans index.css (`--pal-1..6`), elles suivent le thème.
const EFF_BUCKETS: { min: number; label: string; color: string }[] = [
  { min: 110, label: '≥ 110 %', color: 'rgb(var(--pal-1))' },
  { min: 100, label: '100 – 110 %', color: 'rgb(var(--pal-2))' },
  { min: 90, label: '90 – 100 %', color: 'rgb(var(--pal-3))' },
  { min: 80, label: '80 – 90 %', color: 'rgb(var(--pal-4))' },
  { min: 70, label: '70 – 80 %', color: 'rgb(var(--pal-5))' },
  { min: 0, label: '< 70 %', color: 'rgb(var(--pal-6))' },
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

// Taille du « top » sur lequel portent les moyennes mises en avant. 400 ≈ ce
// qu'un compte mûr équipe réellement (6 runes × ~65 monstres joués).
const TOP_N = 400;

// `pct` / `fmt` et les briques d'affichage sont partagés avec le résumé des
// artéfacts — voir SummaryBits.tsx.

export default function RunesSummary({ runes }: Props) {
  // Tout le résumé est calculé en un seul passage, mémoïsé par import.
  const s = useMemo(() => {
    const effs: number[] = [];
    const paires: { eff: number; pot: number }[] = []; // pour les moyennes du top N
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

      paires.push({ eff, pot: runePotential(r, true).legendEff });
      if (runePotential(r, false).legendGain > 0.05) grindTodo += 1;
    }

    const total = runes.length;
    const sorted = [...effs].sort((a, b) => b - a);

    // ⚠️ La moyenne mise en avant porte sur le **TOP N**, pas sur l'inventaire
    // entier. Une moyenne globale mesure surtout la quantité de déchet stocké :
    // farmer sans jeter la fait baisser, jeter la fait monter, alors que le
    // compte n'a pas bougé. N = 400 ≈ ce qu'un compte mûr équipe réellement
    // (6 runes × ~65 monstres joués).
    const topPaires = [...paires].sort((a, b) => b.eff - a.eff).slice(0, Math.min(TOP_N, total));
    const moyenneDe = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
    const topMean = moyenneDe(topPaires.map((x) => x.eff));
    const topPot = moyenneDe(topPaires.map((x) => x.pot));
    // Médiane sur le MÊME périmètre que la moyenne affichée : mélanger les deux
    // (moyenne du top, médiane de tout) ne se compare pas.
    const topMedian = topPaires.length ? topPaires[Math.floor((topPaires.length - 1) / 2)].eff : 0;
    const topAvg = (k: number) => {
      const slice = sorted.slice(0, Math.min(k, total));
      return slice.length ? slice.reduce((x, y) => x + y, 0) / slice.length : 0;
    };

    return {
      total,
      topMean,
      topPot,
      topN: topPaires.length,
      topMedian,
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
      <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-sm text-ink-dim">
        Aucune rune dans l'inventaire importé.
      </p>
    );
  }

  const varTotal = s.mains.reduce((x, m) => x + m.n, 0);

  // Par emplacement, à la souris : la hauteur de chaque barre suit l'efficience
  // moyenne du slot, rapportée à la meilleure des six.
  const moyMax = Math.max(...s.slots.map(({ agg }) => avg(agg)), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* ⚠️ **En-tête à la SOURIS** (refonte graphique, lot 8a, la maquette) :
          le titre de la vue et le nombre de runes, comme les en-têtes de la
          RTA et du Siège. Au doigt, la barre du haut dit déjà la vue (lot 11). */}
      <div className="hidden items-center gap-2.5 lg:flex">
        <h1 className="font-display text-xl tracking-wide text-ink">Résumé</h1>
        <span className="rounded-full border border-border-soft bg-panel2 px-2 py-0.5 font-mono text-micro text-ink-dim">
          {s.total.toLocaleString('fr-FR')} rune{s.total > 1 ? 's' : ''}
        </span>
      </div>

      {/* ---- Chiffres clés ---------------------------------------------- */}
      {/* ⚠️ À la SOURIS, UN bandeau (`Kpi bandeau`, la maquette `.stats`) :
          six cases séparées par un filet, au lieu de six cartes. Au DOIGT,
          une carte sur deux colonnes (lot 11c, décision 26). */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2
                   lg:flex lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border-soft lg:bg-panel
                   ${CARTE_CHIFFRES_DOIGT}`}
      >
        {/* Les tons reprennent la palette du résumé (`--pal-*`), qui suit le
            thème : mêmes teintes qu'avant en sombre, variante assombrie en
            clair. Voir spec/shared/design.md § Dataviz. */}
        <Kpi label="Runes" value={s.total.toLocaleString('fr-FR')} sub={`${s.maxed} au +15`} bandeau premier />
        <Kpi
          label={s.topN < TOP_N ? 'Eff. moyenne' : `Eff. moyenne · top ${TOP_N}`}
          value={`${fmt(s.topMean)} %`}
          sub={`médiane ${fmt(s.topMedian)} %`}
          tone="rgb(var(--pal-4))"
          bandeau
        />
        <Kpi
          label="Eff. moyenne · top 100"
          value={`${fmt(s.top100)} %`}
          /* Deux-points obligatoires : « top 10 126.1 % » se lisait comme un
             seul nombre, « top 10126.1 % ». */
          sub={`top 10 : ${fmt(s.top10)} %`}
          tone="rgb(var(--pal-3))"
          bandeau
        />
        <Kpi
          label="Meilleure"
          value={`${fmt(s.best)} %`}
          sub={`${s.over110} rune(s) ≥ 110 %`}
          tone="rgb(var(--star))"
          bandeau
        />
        <Kpi
          label="≥ 100 %"
          value={s.over100.toLocaleString('fr-FR')}
          sub={`${fmt(pct(s.over100, s.total))} % du stock`}
          tone="rgb(var(--pal-2))"
          bandeau
        />
        <Kpi
          label="Antiques"
          value={s.ancient.toLocaleString('fr-FR')}
          sub={`${fmt(pct(s.ancient, s.total))} % du stock`}
          bandeau
        />
      </div>

      {/* ⚠️ **À la SOURIS, TROIS colonnes** (la maquette) : Distribution ·
          Qualité du stock · Marge de progression, puis Par emplacement et Stats
          principales (sur deux colonnes), puis Par set (toute la largeur, il
          n'est pas dans la maquette mais reste). L'ORDRE de la souris est posé
          par `lg:order-*` ; au doigt, une colonne, dans l'ordre du code — celui
          d'avant (lot 11). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
        {/* ---- Distribution d'efficience -------------------------------- */}
        <Panel title="Distribution d'efficience" className="lg:order-1">
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
        <Panel title="Qualité du stock" className="lg:order-2">
          <div className="flex flex-col gap-1.5">
            {/* Quatre mesures indépendantes : quatre teintes de la palette,
                comme avant. Chaque barre porte son libellé et sa valeur, donc
                l'identité ne repose jamais sur la couleur seule. */}
            <BarRow label="Montées au +15" n={s.maxed} total={s.total} max={s.total} color="rgb(var(--star))" />
            <BarRow label="4 substats révélés" n={s.fourSubs} total={s.total} max={s.total} color="rgb(var(--pal-3))" />
            <BarRow label="Gemmées" n={s.gemmed} total={s.total} max={s.total} color="rgb(var(--pal-2))" />
            <BarRow label="Antiques" n={s.ancient} total={s.total} max={s.total} color="rgb(var(--pal-4))" />
          </div>

          <div className="mt-3 border-t border-border pt-3 flex flex-col gap-1.5">
            <p className="label">Raretés</p>
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
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-micro text-ink-dim">
              {s.rarities.map((r) => (
                <span key={r.rarity} className="flex items-center gap-1">
                  {/* La PASTILLE garde la couleur vive du jeu (elle a sa propre
                      surface) ; c'est le texte qui suivrait mal en thème clair,
                      et lui reste en `text-ink-dim` hérité. */}
                  <span
                    className="inline-block w-2 h-2 rounded-full ring-1 ring-inset ring-black/20"
                    style={{ background: RARITY_META[r.rarity].color }}
                  />
                  {RARITY_META[r.rarity].label} <b className="text-ink">{r.n}</b>
                </span>
              ))}
            </div>
          </div>
        </Panel>

      {/* ---- Par slot ---------------------------------------------------- */}
      <Panel title="Par emplacement" className="lg:order-4">
        {/* Au DOIGT : une carte par slot (lot 11). */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:hidden">
          {s.slots.map(({ slot, agg }) => (
            <div key={slot} className="rounded-lg border border-border bg-panel2 px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="label">Slot {slot}</span>
                <span className="font-mono text-xs text-ink">{agg.n}</span>
              </div>
              <div className="mt-1 font-mono text-xs text-ink-dim">
                moy. <b className="text-ink">{fmt(avg(agg))} %</b>
              </div>
              <div className="font-mono text-micro text-ink-dim">
                max <b className="text-star">{fmt(agg.best)} %</b>
              </div>
            </div>
          ))}
        </div>
        {/* ⚠️ À la SOURIS, des BARRES VERTICALES (la maquette) : la hauteur
            suit l'efficience moyenne du slot. Le nombre de runes et le
            maximum restent écrits sous chaque barre — rien ne se perd. */}
        <div className="hidden grid-cols-6 items-end gap-2 lg:grid" data-emplacements-barres>
          {s.slots.map(({ slot, agg }) => (
            <div key={slot} className="flex min-w-0 flex-col items-center gap-1">
              <span className="font-mono text-micro text-ink">{fmt(avg(agg))} %</span>
              {/* Même teinte que les barres des stats principales (`pal-4`),
                  passée en `style` comme dans `BarRow`. */}
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(4, (avg(agg) / moyMax) * 88)}px`,
                  background: 'rgb(var(--pal-4))',
                }}
                aria-hidden
              />
              <span className="label">Slot {slot}</span>
              <span className="text-center font-mono text-micro text-ink-dim">
                {agg.n} · max <b className="text-star">{fmt(agg.best)} %</b>
              </span>
            </div>
          ))}
        </div>
      </Panel>

        {/* ---- Stats principales (slots 2/4/6) -------------------------- */}
        <Panel title="Stats principales (slots 2 · 4 · 6)" className="lg:order-5 lg:col-span-2">
          <div className="flex flex-col gap-1.5">
            {s.mains.map((m) => (
              <BarRow
                key={m.code}
                label={RUNE_EFFECT[m.code]?.label ?? `#${m.code}`}
                n={m.n}
                total={varTotal}
                max={s.mains[0].n}
                /* Série NOMINALE (ATQ%, PV%, VIT…) : une seule couleur pour
                   toutes les barres. Colorer chacune re-encoderait en couleur
                   ce que la longueur dit déjà. */
                color="rgb(var(--pal-4))"
              />
            ))}
          </div>
        </Panel>

        {/* ---- Marge de progression ------------------------------------- */}
        <Panel title="Marge de progression" className="lg:order-3">
          <p className="mb-3 text-xs text-ink-dim leading-relaxed">
            Si chaque rune recevait sa gemme optimale puis sa meule au max, en scénario{' '}
            <b className="text-ink">légendaire</b>. Sur{' '}
            <b className="text-ink">tes {s.topN} meilleures runes</b> — mêmes runes des deux côtés,
            sinon la comparaison ne voudrait rien dire.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Eff. moyenne" value={`${fmt(s.topMean)} %`} sub="aujourd'hui" />
            <Kpi
              label="Potentiel moyen"
              value={`${fmt(s.topPot)} %`}
              sub={`+${fmt(s.topPot - s.topMean)} pts`}
              tone="rgb(var(--good))"
            />
            <Kpi
              label="Meules à poser"
              value={s.grindTodo.toLocaleString('fr-FR')}
              sub={`${fmt(pct(s.grindTodo, s.total))} % du stock`}
              tone="rgb(var(--star))"
            />
            <Kpi
              label="Gemmes à poser"
              value={s.gemTodo.toLocaleString('fr-FR')}
              sub={`${fmt(pct(s.gemTodo, s.total))} % du stock`}
              tone="rgb(var(--pal-2))"
            />
          </div>
        </Panel>

      {/* ---- Par set ----------------------------------------------------- */}
      <Panel title={`Par set (${s.sets.length})`} className="lg:order-6 lg:col-span-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,148px),1fr))] gap-2">
          {s.sets.map(({ set, agg }) => (
            <div
              key={set.key}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel2 px-2.5 py-2"
              style={{ borderLeft: `3px solid ${set.accent}` }}
            >
              <RuneIcon setKey={set.key} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-ink truncate">{set.label}</span>
                  <span className="font-mono text-xs text-ink-dim">{agg.n}</span>
                </div>
                <div className="font-mono text-micro text-ink-dim">
                  moy. <b className="text-ink">{fmt(avg(agg))} %</b> · max{' '}
                  <b className="text-star">{fmt(agg.best)} %</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      </div>
    </div>
  );
}

