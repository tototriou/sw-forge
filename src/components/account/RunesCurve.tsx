import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { RuneDetail } from '../../types';
import { runePotential } from '../../lib/runeOptim';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import CurveChart, { CurveSeries, OWN_COLOR } from './CurveChart';

interface Props {
  runes: RuneDetail[];
}

const DEFAULT_LIMIT = 400; // nb de runes affichées par défaut
const HERO_COLOR = '#c88cff'; // Potentiel héroïque → violet
const LEGEND_COLOR = '#f8b24a'; // Potentiel légendaire → orange

// Médiane & max indépendants de l'ordre (les séries « Par rune » ne sont pas triées).
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const maxOf = (arr: number[]) => arr.reduce((m, v) => (v > m ? v : m), -Infinity);

export default function RunesCurve({ runes }: Props) {
  const [sets, setSets] = useStickyState<Set<string>>('runesCurve.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesCurve.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesCurve.ancient', false);
  const [limit, setLimit] = useStickyState('runesCurve.limit', DEFAULT_LIMIT);
  const [hidden, setHidden] = useStickyState<Set<string>>('runesCurve.hidden', new Set());
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('runesCurve.gemMode', 'gem');
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const withGem = gemMode === 'gem';

  // Ferme la popup d'aide au clic à l'extérieur.
  useEffect(() => {
    if (!showHelp) return;
    const onDown = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showHelp]);

  function toggleHidden(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // Potentiels calculés sur les runes filtrées, puis 3 distributions triées ↓.
  const { cur, hero, legend } = useMemo(() => {
    const filtered = runes.filter((r) => {
      if (sets.size && !sets.has(r.set)) return false;
      if (slots.size && !slots.has(r.slot)) return false;
      if (ancientOnly && !(r.rank > 10)) return false;
      return true;
    });
    const pots = filtered.map((r) => runePotential(r, withGem, metric));
    const desc = (a: number, b: number) => b - a;
    return {
      cur: pots.map((p) => p.eff).sort(desc),
      hero: pots.map((p) => p.heroEff).sort(desc),
      legend: pots.map((p) => p.legendEff).sort(desc),
    };
  }, [runes, sets, slots, ancientOnly, withGem, metric]);

  const total = cur.length;
  const cap = Math.max(1, limit);
  const lim = (arr: number[]) => arr.slice(0, cap);

  const allSeries: CurveSeries[] = [
    { name: 'Actuelle', effs: lim(cur), color: OWN_COLOR, own: true },
    { name: 'Potentiel Héro', effs: lim(hero), color: HERO_COLOR, own: false },
    { name: 'Potentiel Légend', effs: lim(legend), color: LEGEND_COLOR, own: false },
  ];
  const visible = allSeries.filter((s) => !hidden.has(s.name));

  return (
    <div>
      {/* Filtres de la courbe */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Sets : icônes seules (voir SetFilter) */}
        <SetFilter runes={runes} value={sets} onChange={setSets} />

        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter value={slots} onChange={setSlots} />
          <button
            onClick={() => setAncientOnly((v) => !v)}
            className={`ml-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                ancientOnly
                  ? 'bg-[#3a2a55] border-[#a074d0] text-[#c79bff] shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
          >
            Antiques
          </button>
        </div>
      </div>

      {/* Mode gemme + nombre de runes */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-panel border border-border rounded-lg p-0.5">
            {[
              { key: 'gem' as const, label: 'Gemme + meule' },
              { key: 'grind' as const, label: 'Meule seule' },
            ].map((o) => (
              <button
                key={o.key}
                onClick={() => setGemMode(o.key)}
                title={
                  o.key === 'gem'
                    ? 'Potentiel avec la gemme optimale + les meules'
                    : 'Potentiel en gardant les stats actuelles (meules seulement)'
                }
                className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition
                  ${gemMode === o.key ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim hover:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="font-mono text-[12px] text-ink-dim">
            top {Math.min(cap, total)}
            {total > cap && ` sur ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Nb de runes</span>
          <input
            type="number"
            min={1}
            max={total || 1}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 bg-panel border border-border text-ink rounded-lg px-2 py-1 text-[13px] outline-none focus:border-[#5b63b8] tabular-nums"
          />
          <button
            onClick={() => setLimit(total || 1)}
            className="rounded-lg border border-border bg-panel px-2.5 py-1 text-[12px] font-semibold text-ink-dim hover:text-ink hover:border-[#4a52a0] transition"
          >
            Tout
          </button>
        </div>
      </div>

      {/* Graphe + bouton d'aide superposé (popup fermable au clic extérieur) */}
      <div className="relative">
        <div ref={helpRef} className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="Comment lire ce graphe ?"
            title="Comment lire ce graphe ?"
            className={`flex items-center justify-center w-9 h-9 rounded-full border transition
              ${showHelp ? 'bg-[#2b3170] border-[#4a52a0] text-ink' : 'bg-panel/80 border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'}`}
          >
            <HelpCircle size={20} />
          </button>
          {showHelp && (
            <div className="absolute right-0 mt-1.5 w-[340px] max-w-[88vw] rounded-lg border border-[#4a52a0] bg-panel p-3 text-[12.5px] text-ink-dim leading-relaxed shadow-xl shadow-black/50">
              <p className="text-ink font-semibold mb-1">À quoi sert ce graphe ?</p>
              <p>
                Il classe toutes tes runes, de la meilleure à la moins bonne :{' '}
                <b className="text-ink">l'efficience (%)</b> en hauteur, le{' '}
                <b className="text-ink">nombre de runes</b> en largeur. Plus les courbes sont{' '}
                <i>hautes et étalées</i>, meilleure est ta box.
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <span style={{ color: OWN_COLOR }}>●</span> <b className="text-ink">Actuelle</b> —
                  l'efficience de tes runes aujourd'hui.
                </li>
                <li>
                  <span style={{ color: HERO_COLOR }}>●</span> <b className="text-ink">Potentiel Héro</b> — ce
                  que deviendrait ta box si chaque rune recevait sa <b className="text-ink">gemme et ses meules
                  héroïques optimales</b> <span className="text-ink-dim">(tri « Potentiel héroïque » de l'onglet Optimisation)</span>.
                </li>
                <li>
                  <span style={{ color: LEGEND_COLOR }}>●</span> <b className="text-ink">Potentiel Légend</b> —
                  la même chose, en <b className="text-ink">légendaire</b>{' '}
                  <span className="text-ink-dim">(tri « Potentiel légendaire »)</span>.
                </li>
              </ul>
              <p className="mt-2">
                Le sélecteur <b className="text-ink">Gemme + meule / Meule seule</b> change les courbes de
                potentiel : <b className="text-ink">Gemme + meule</b> = gemme optimale puis meules au max ;{' '}
                <b className="text-ink">Meule seule</b> = on garde les stats actuelles, seules les meules sont
                poussées.
              </p>
              <p className="mt-2">
                👉 Va dans l'onglet <b className="text-ink">Optimisation</b> pour voir{' '}
                <b className="text-ink">quelles runes améliorer</b> et augmenter ton efficience.
              </p>
            </div>
          )}
        </div>

        <CurveChart
          series={visible}
          yLabel={metric === 'eff' ? 'Efficience (%)' : 'Score SW'}
          unit={metric === 'eff' ? '%' : ''}
        />
      </div>

      {/* Légende — sous le graphe ; cliquer un nom masque/affiche sa courbe */}
      <div className="flex items-center justify-center gap-4 flex-wrap mt-3">
        {allSeries.map((s) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={s.name}
              onClick={() => toggleHidden(s.name)}
              title={off ? 'Afficher' : 'Masquer'}
              className="flex items-center gap-1.5 font-mono text-[12px]"
            >
              <span
                className="inline-block w-3 h-1.5 rounded-full transition"
                style={{ background: s.color, opacity: off ? 0.3 : 1 }}
              />
              <span className={`font-semibold transition ${off ? 'text-ink-dim line-through' : 'text-ink'}`}>
                {s.name}
              </span>
              {s.effs.length > 0 && !off && (
                <span className="text-ink-dim">
                  · max {formatRuneMetric(maxOf(s.effs), metric)} · méd.{' '}
                  {formatRuneMetric(median(s.effs), metric)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
