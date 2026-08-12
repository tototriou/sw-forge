import { useMemo } from 'react';
import { ArtifactDetail, ArtifactKind, ELEMENTS, ElementKey } from '../../types';
import {
  RARITY_META,
  ARTIFACT_MAIN,
  artifactSubLabel,
  artifactSubName,
} from '../../lib/effects';
import { artifactScore, artifactEfficiency, maxRolls, isFullStack } from '../../lib/artifacts';
import { Kpi, Panel, pct, fmt } from './SummaryBits';

interface Props {
  artifacts: ArtifactDetail[];
}

// Paliers d'efficience. Les seuils diffèrent de ceux des runes, et c'est voulu :
// mesurée sur 2 120 artéfacts, la médiane tombe vers 76 % et seuls 9 dépassent
// 100 %. Reprendre les paliers des runes (≥ 110 %…) aurait laissé les quatre
// premiers vides.
//
// ⚠️ Pas de teinte par palier ici, contrairement au résumé des runes : la
// couleur porte déjà l'**identité de la sorte** (Attribut / Type) dans ce
// tableau. Lui faire aussi encoder le palier — que le libellé et la longueur de
// barre disent déjà — brûlerait le seul canal disponible pour distinguer les
// deux inventaires.
// ⚠️ Pas de palier « ≥ 100 % » : le divisseur 1,6 place 100 % au-dessus du
// meilleur drop réel (97,9 % sur un inventaire de 2 120 artéfacts). La ligne
// serait vide chez tout le monde — un palier qu'on ne peut pas atteindre
// n'informe pas, il fait douter du calcul.
const EFF_BUCKETS: { min: number; label: string }[] = [
  { min: 90, label: '≥ 90 %' },
  { min: 80, label: '80 – 90 %' },
  { min: 70, label: '70 – 80 %' },
  { min: 60, label: '60 – 70 %' },
  { min: 50, label: '50 – 60 %' },
  { min: 0, label: '< 50 %' },
];

// Le top mis en avant, PAR SORTE : ~100 de chaque sorte, soit ce qu'un compte
// mûr porte réellement sur ses monstres joués (2 artéfacts par monstre).
const TOP_N = 100;

const elementLabel = (k?: ElementKey) => ELEMENTS.find((e) => e.key === k)?.label ?? '—';

const ARCHETYPE_LABEL: Record<string, string> = {
  attack: 'Attaque',
  defense: 'Défense',
  hp: 'PV',
  support: 'Support',
};

// ⚠️ Les deux sortes se lisent EN COLONNES, jamais en sections empilées. Un
// artéfact d'attribut et un de type ne portent pas les mêmes propriétés (codes
// 300-399 contre 400-499, aucun recouvrement) : il faut les distinguer. Mais
// répéter chaque panneau deux fois doublait la hauteur de la page, et le résumé
// doit tenir d'un coup d'œil — d'où deux colonnes dans le MÊME tableau.
const KINDS: { key: ArtifactKind; label: string; tone: string }[] = [
  { key: 'element', label: 'Attribut', tone: 'rgb(var(--pal-3))' },
  { key: 'archetype', label: 'Type', tone: 'rgb(var(--pal-4))' },
];

const moyenne = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);

// Agrégats d'une sorte d'artéfact.
function analyse(arts: ArtifactDetail[]) {
  const effs: number[] = [];
  const scores: number[] = [];
  const buckets = EFF_BUCKETS.map(() => 0);
  const byRarity = new Map<number, number>();
  const byMain = new Map<number, number>();
  const byGroup = new Map<string, { n: number; sum: number; best: number }>();

  // Quad rolls, ventilés PAR PROPRIÉTÉ : sur quelles stats les tirages
  // parfaits sont-ils tombés.
  const byQuad = new Map<number, number>();
  let fullStack = 0;

  let maxed = 0;

  for (const a of arts) {
    const eff = artifactEfficiency(a);
    effs.push(eff);
    scores.push(artifactScore(a));

    const bi = EFF_BUCKETS.findIndex((b) => eff >= b.min);
    buckets[bi < 0 ? EFF_BUCKETS.length - 1 : bi] += 1;

    byRarity.set(a.rarity, (byRarity.get(a.rarity) ?? 0) + 1);

    const g =
      a.kind === 'element' ? elementLabel(a.element) : (ARCHETYPE_LABEL[a.archetype ?? ''] ?? '—');
    const cur = byGroup.get(g) ?? { n: 0, sum: 0, best: 0 };
    cur.n += 1;
    cur.sum += eff;
    if (eff > cur.best) cur.best = eff;
    byGroup.set(g, cur);

    byMain.set(a.main.code, (byMain.get(a.main.code) ?? 0) + 1);

    // ⚠️ Le quad roll suppose 4 rolls disponibles : il n'existe qu'en
    // LÉGENDAIRE. Un héroïque qui concentre ses 3 rolls n'en est pas un, et
    // le compter ici mélangerait deux tirages incomparables.
    if (isFullStack(a) && maxRolls(a.rarity) === 4) {
      fullStack += 1;
      const ligne = a.subs.find((sub) => (sub.rolls ?? 0) === 4);
      if (ligne) byQuad.set(ligne.code, (byQuad.get(ligne.code) ?? 0) + 1);
    }

    if (a.level >= 15) maxed += 1;
  }

  const total = arts.length;
  const sortedEff = [...effs].sort((x, y) => y - x);
  const sortedScore = [...scores].sort((x, y) => y - x);
  const topEff = sortedEff.slice(0, Math.min(TOP_N, total));

  return {
    total,
    maxed,
    topMean: moyenne(topEff),
    topN: topEff.length,
    topMedian: topEff.length ? topEff[Math.floor((topEff.length - 1) / 2)] : 0,
    bestEff: sortedEff[0] ?? 0,
    bestScore: sortedScore[0] ?? 0,
    scoreMean: moyenne(sortedScore.slice(0, Math.min(TOP_N, total))),
    over90: sortedEff.filter((e) => e >= 90).length,
    buckets,
    rarities: [5, 4, 3, 2, 1].map((r) => ({ rarity: r, n: byRarity.get(r) ?? 0 })),
    groups: [...byGroup.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((x, y) => y.n - x.n),
    mains: [...byMain.entries()].map(([code, n]) => ({ code, n })).sort((x, y) => y.n - x.n),
    fullStack,
    // Les propriétés sur lesquelles les quad rolls sont tombés, du plus
    // fréquent au moins fréquent.
    quads: [...byQuad.entries()]
      .map(([code, n]) => ({ code, n }))
      .sort((x, y) => y.n - x.n || x.code - y.code),
  };
}

type Analyse = ReturnType<typeof analyse>;

export default function ArtifactsSummary({ artifacts }: Props) {
  const s = useMemo(() => {
    const par = Object.fromEntries(
      KINDS.map((k) => [k.key, analyse(artifacts.filter((a) => a.kind === k.key))])
    ) as Record<ArtifactKind, Analyse>;
    return { par, total: artifacts.length };
  }, [artifacts]);

  if (!s.total) {
    return (
      <p className="rounded-xl border border-border bg-panel px-4 py-6 text-center text-[13px] text-ink-dim">
        Aucun artéfact dans l'inventaire importé.
      </p>
    );
  }

  const A = s.par.element;
  const T = s.par.archetype;
  // Ce qui reste à monter : le seul « potentiel » d'un artéfact, puisqu'il n'y
  // a ni meule ni gemme — une ligne tombée est définitive.
  const aMonter = s.total - (A.maxed + T.maxed);

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Chiffres clés — le compte entier, puis chaque sorte ---------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi
          label="Artéfacts"
          value={s.total.toLocaleString('fr-FR')}
          sub={
            aMonter > 0
              ? `${A.total} attribut · ${T.total} type · ${aMonter} à monter`
              : `${A.total} attribut · ${T.total} type`
          }
        />
        <Kpi
          label={`Eff. moy. · Attribut`}
          value={`${fmt(A.topMean)} %`}
          sub={A.topN < TOP_N ? `sur ${A.topN}` : `top ${TOP_N} · méd. ${fmt(A.topMedian)} %`}
          tone={KINDS[0].tone}
        />
        <Kpi
          label={`Eff. moy. · Type`}
          value={`${fmt(T.topMean)} %`}
          sub={T.topN < TOP_N ? `sur ${T.topN}` : `top ${TOP_N} · méd. ${fmt(T.topMedian)} %`}
          tone={KINDS[1].tone}
        />
        <Kpi
          label="Meilleur score"
          value={Math.max(A.bestScore, T.bestScore).toLocaleString('fr-FR')}
          sub={`attribut ${A.bestScore} · type ${T.bestScore}`}
          tone="rgb(var(--star))"
        />
        <Kpi
          label="≥ 90 % d'eff."
          value={(A.over90 + T.over90).toLocaleString('fr-FR')}
          sub={`${A.over90} attribut · ${T.over90} type`}
          tone="rgb(var(--pal-2))"
        />
        {/* ⚠️ « Quad roll » — le terme du JEU, que tout joueur connaît. Il
            avait été rebaptisé « rolls concentrés », ce qui obligeait à
            demander ce que ça voulait dire. */}
        <Kpi
          label="Quad rolls"
          value={(A.fullStack + T.fullStack).toLocaleString('fr-FR')}
          sub={`${A.fullStack} attribut · ${T.fullStack} type`}
          tone="rgb(var(--star))"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ---- Distribution : les deux sortes DANS le même tableau -------- */}
        <Panel title="Distribution d'efficience">
          <Deux />
          <div className="mt-1.5 flex flex-col gap-1.5">
            {EFF_BUCKETS.map((b, i) => (
              <LigneDouble
                key={b.label}
                label={b.label}
                gauche={A.buckets[i]}
                droite={T.buckets[i]}
                max={Math.max(...A.buckets, ...T.buckets)}
              />
            ))}
          </div>
        </Panel>

        {/* ---- Raretés ---------------------------------------------------- */}
        <Panel title="Raretés">
          <div className="flex flex-col gap-3">
            {KINDS.map((k) => {
              const a = s.par[k.key];
              return (
                <div key={k.key}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="label" style={{ color: k.tone }}>
                      {k.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-dim">{a.total}</span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel2">
                    {a.rarities.map(
                      (r) =>
                        r.n > 0 && (
                          <div
                            key={r.rarity}
                            title={`${RARITY_META[r.rarity].label} — ${r.n}`}
                            style={{
                              width: `${pct(r.n, a.total)}%`,
                              background: RARITY_META[r.rarity].color,
                            }}
                          />
                        )
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-ink-dim">
                    {a.rarities
                      .filter((r) => r.n > 0)
                      .map((r) => (
                        <span key={r.rarity} className="flex items-center gap-1">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full ring-1 ring-inset ring-black/20"
                            style={{ background: RARITY_META[r.rarity].color }}
                          />
                          {RARITY_META[r.rarity].label} <b className="text-ink">{r.n}</b>
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border pt-3 flex flex-col gap-1.5">
            <p className="label">Stats principales</p>
            {[...new Set([...A.mains, ...T.mains].map((m) => m.code))].map((code) => (
              <LigneDouble
                key={code}
                label={ARTIFACT_MAIN[code]?.label ?? `#${code}`}
                gauche={A.mains.find((m) => m.code === code)?.n ?? 0}
                droite={T.mains.find((m) => m.code === code)?.n ?? 0}
                max={Math.max(...A.mains.map((m) => m.n), ...T.mains.map((m) => m.n))}
              />
            ))}
          </div>
        </Panel>
      </div>

      {/* ---- Par attribut / par type — deux colonnes, un seul panneau ---- */}
      <Panel title="Par attribut et par type">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {KINDS.flatMap((k) =>
            s.par[k.key].groups.map((g) => (
              <div
                key={`${k.key}-${g.label}`}
                className="rounded-lg border border-border bg-panel2 px-3 py-2"
                style={{ borderLeft: `3px solid ${k.tone}` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="label truncate">{g.label}</span>
                  <span className="font-mono text-[12px] text-ink">{g.n}</span>
                </div>
                <div className="mt-1 font-mono text-[12px] text-ink-dim">
                  moy. <b className="text-ink">{fmt(g.sum / g.n)} %</b>
                </div>
                <div className="font-mono text-[11px] text-ink-dim">
                  max <b className="text-star">{fmt(g.best)} %</b>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* ---- Quad rolls, par propriété ------------------------------------ */}
      {/* Les 4 améliorations tombées sur UNE SEULE ligne : le meilleur tirage
          possible, puisque la valeur d'une propriété est poussée au maximum au
          lieu d'être éparpillée. Ce panneau dit SUR QUOI ils sont tombés.
          ⚠️ Deux colonnes disjointes — les propriétés d'attribut et de type
          n'ont aucun recouvrement. */}
      <Panel title="Quad rolls · sur quelle propriété">
        {A.fullStack + T.fullStack === 0 ? (
          <p className="text-[12.5px] text-ink-dim">
            Aucun quad roll dans l'inventaire. Il faut un artéfact{' '}
            <b>légendaire</b> dont les 4 améliorations tombent sur la même
            propriété — c'est rare.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1.5">
            {KINDS.map((k) => {
              const a = s.par[k.key];
              return (
                <div key={k.key} className="flex flex-col gap-1.5">
                  <div className="mb-0.5 flex items-baseline justify-between">
                    <span className="label" style={{ color: k.tone }}>
                      {k.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-dim">
                      {a.fullStack} quad roll{a.fullStack > 1 ? 's' : ''}
                    </span>
                  </div>
                  {a.quads.length === 0 && (
                    <span className="font-mono text-[11.5px] text-ink-dim">—</span>
                  )}
                  {a.quads.map((q) => (
                    <div key={q.code} className="flex items-center gap-2.5">
                      <span
                        className="flex-1 min-w-0 truncate font-mono text-[11px] text-ink-dim"
                        title={artifactSubLabel(q.code)}
                      >
                        {/* `artifactSubName` plutôt qu'un `replace` maison : il
                            gère les libellés dont la valeur est au milieu
                            (« Dégâts add. par X% des PV »). */}
                        {artifactSubName(q.code)}
                      </span>
                      <div className="h-2 w-[64px] flex-none rounded-full bg-panel2 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct(q.n, Math.max(...a.quads.map((x) => x.n), 1))}%`,
                            background: k.tone,
                          }}
                        />
                      </div>
                      <span className="w-[24px] flex-none text-right font-mono text-[11.5px] text-ink tabular-nums">
                        {q.n}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-ink-dim">
          ⚠️ Un quad roll n'existe qu'en <b>légendaire</b> : c'est la seule
          rareté qui distribue 4 améliorations.
        </p>
      </Panel>
    </div>
  );
}

/* ---- Briques à deux colonnes -------------------------------------------- */

// En-tête des lignes doubles : dit une fois quelle colonne est quoi, au lieu de
// répéter les libellés sur chaque ligne.
function Deux() {
  return (
    <div className="flex items-center gap-2.5 pb-1 border-b border-border/60">
      <span className="w-[86px] flex-none" />
      <span className="flex-1" />
      {KINDS.map((k) => (
        <span
          key={k.key}
          className="w-[52px] flex-none text-right label"
          style={{ color: k.tone }}
        >
          {k.label}
        </span>
      ))}
    </div>
  );
}

// Une ligne, deux valeurs : la barre montre les deux sortes empilées côte à
// côte, les chiffres suivent dans leurs colonnes.
function LigneDouble({
  label,
  gauche,
  droite,
  max,
}: {
  label: string;
  gauche: number;
  droite: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[86px] flex-none font-mono text-[11.5px] text-ink-dim truncate" title={label}>
        {label}
      </span>
      {/* ⚠️ UNE piste, deux segments — pas deux barres superposées : à six
          lignes, douze barres fines se lisaient comme du bruit. Côte à côte,
          les segments donnent le total ET la part de chaque sorte d'un seul
          regard, et leur teinte est celle des colonnes de chiffres.
          ⚠️ Séparés par un GAP de surface (2px), jamais par une bordure : un
          trait autour des marques les alourdit, l'écart les sépare tout seul. */}
      <div className="h-2.5 flex-1 flex gap-[2px] rounded-full bg-panel2 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${max ? (gauche / (max * 2)) * 100 : 0}%`, background: KINDS[0].tone }}
          title={`${KINDS[0].label} — ${gauche}`}
        />
        <div
          className="h-full transition-all"
          style={{ width: `${max ? (droite / (max * 2)) * 100 : 0}%`, background: KINDS[1].tone }}
          title={`${KINDS[1].label} — ${droite}`}
        />
      </div>
      {/* ⚠️ Le NOMBRE seul, pas la part : la longueur de barre dit déjà la
          proportion. Répéter « 25,8 % » à côté d'une barre au quart plein
          encode deux fois la même information et alourdit la ligne. */}
      <span className="w-[52px] flex-none text-right font-mono text-[11.5px] text-ink tabular-nums">
        {gauche.toLocaleString('fr-FR')}
      </span>
      <span className="w-[52px] flex-none text-right font-mono text-[11.5px] text-ink tabular-nums">
        {droite.toLocaleString('fr-FR')}
      </span>
    </div>
  );
}
