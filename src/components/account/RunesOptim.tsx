import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw, AlertTriangle, HelpCircle } from 'lucide-react';
import { RuneDetail } from '../../types';
import { formatRuneEffect, isAncient, RARITY_META, RUNE_EFFECT } from '../../lib/effects';
import { runePotential, RunePotential, runePlan } from '../../lib/runeOptim';
import { useRuneMetric, formatRuneMetric } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import RuneSlotIcon from '../RuneSlotIcon';
import Pager from './Pager';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import DetailPopover from './DetailPopover';

interface Props {
  runes: RuneDetail[];
}

interface Row {
  rune: RuneDetail;
  pot: RunePotential;
  id: number;
}

type SortMode = 'gainLegend' | 'gainHero' | 'effCur' | 'potHero' | 'potLegend';
const PAGE = 60;

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'effCur', label: 'Valeur actuelle' },
  { key: 'potHero', label: 'Potentiel héroïque' },
  { key: 'potLegend', label: 'Potentiel légendaire' },
  { key: 'gainHero', label: 'Gain héroïque' },
  { key: 'gainLegend', label: 'Gain légendaire' },
];

const SORT_VAL: Record<SortMode, (p: RunePotential) => number> = {
  gainLegend: (p) => p.legendGain,
  gainHero: (p) => p.heroGain,
  effCur: (p) => p.eff,
  potHero: (p) => p.heroEff,
  potLegend: (p) => p.legendEff,
};

// Scénario (héro/légend) du plan affiché au clic, déduit du tri.
const scenarioOf = (s: SortMode): 'hero' | 'legend' =>
  s === 'gainHero' || s === 'potHero' ? 'hero' : 'legend';

// Gain signé (« +2.3 » / « -1.4 »), à la précision de la mesure (score = entier).
const signed = (g: number, metric: 'eff' | 'score') =>
  (g >= 0 ? '+' : '') + (metric === 'eff' ? g.toFixed(1) : String(Math.round(g)));

// Filtre antiques : les garder toutes, les écarter, ou n'afficher qu'elles.
type AncientFilter = 'all' | 'without' | 'only';
const ANCIENTS: { key: AncientFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Toutes', hint: 'Runes normales et antiques' },
  { key: 'only', label: 'Antiques uniquement', hint: 'Uniquement les runes antiques' },
  { key: 'without', label: 'Aucune antique', hint: 'Masquer les runes antiques' },
];
function keepAncient(rune: RuneDetail, filter: AncientFilter): boolean {
  if (filter === 'all') return true;
  return isAncient(rune) === (filter === 'only');
}

// Couleur d'une efficience potentielle vs l'actuelle : vert au-dessus, rouge en dessous.
const effColor = (e: number, base: number) =>
  e > base + 0.05 ? 'text-emerald-400' : e < base - 0.05 ? 'text-fire' : 'text-ink-dim';

export default function RunesOptim({ runes }: Props) {
  const [threshold, setThreshold] = useStickyState('optim.threshold', 100);
  const metric = useRuneMetric(); // réglage global : efficience ou score SW
  const [sort, setSort] = useStickyState<SortMode>('optim.sort', 'effCur');
  const [gemMode, setGemMode] = useStickyState<'gem' | 'grind'>('optim.gemMode', 'gem');
  // Antiques : elles ont leurs propres tables de max, donc un potentiel qui ne
  // se compare pas aux runes normales — pouvoir les écarter (ou n'avoir qu'elles)
  // évite de mélanger deux échelles dans un même classement.
  const [ancient, setAncient] = useStickyState<AncientFilter>('optim.ancient', 'all');
  const [sets, setSets] = useStickyState<Set<string>>('optim.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('optim.slots', new Set());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const toggleOpen = useCallback((id: number) => setOpenId((c) => (c === id ? null : id)), []);
  const withGem = gemMode === 'gem';

  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showHelp) return;
    const onDown = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showHelp]);

  // Potentiel calculé une fois par import (linéaire, mémoïsé).
  const rows = useMemo(
    () => runes.map((rune, id): Row => ({ rune, id, pot: runePotential(rune, withGem, metric) })),
    [runes, withGem, metric]
  );

  // Runes dont l'efficience actuelle dépasse le palier, triées selon le mode choisi.
  const filtered = useMemo(() => {
    const val = SORT_VAL[sort];
    return rows
      .filter(
        (r) =>
          r.pot.eff >= threshold &&
          keepAncient(r.rune, ancient) &&
          (sets.size === 0 || sets.has(r.rune.set)) &&
          (slots.size === 0 || slots.has(r.rune.slot))
      )
      .sort((a, b) => val(b.pot) - val(a.pot));
  }, [rows, threshold, sort, ancient, sets, slots]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#6d5a37] bg-[#2a2417]/50 px-3 py-2 text-[12px] text-[#e0c48a]">
        <AlertTriangle size={15} className="flex-none mt-0.5" />
        <span>
          Ceci est une optimisation d'<b>efficience</b> : ce n'est pas toujours la bonne solution pour tes
          runes (la stat la plus efficiente n'est pas forcément celle utile à ton monstre).
        </span>
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <SetFilter
          runes={runes}
          value={sets}
          onChange={(next) => {
            setSets(next);
            setPage(0);
          }}
        />

        <SlotFilter
          value={slots}
          onChange={(next) => {
            setSlots(next);
            setPage(0);
          }}
        />

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Palier</span>
          <input
            type="number"
            min={0}
            step={5}
            value={threshold}
            onChange={(e) => {
              setThreshold(Math.max(0, Number(e.target.value) || 0));
              setPage(0);
            }}
            className="w-20 bg-panel border border-border text-ink rounded-lg px-2 py-1 text-[13px] outline-none focus:border-[#5b63b8] tabular-nums"
          />
          <span className="font-mono text-[12px] text-ink-dim">{metric === 'eff' ? '%' : 'pts'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Trier par</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortMode);
              setPage(0);
            }}
            className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1 text-[13px] outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-panel border border-border rounded-lg p-0.5">
          {[
            { key: 'gem' as const, label: 'Gemme + meule' },
            { key: 'grind' as const, label: 'Meule seule' },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setGemMode(o.key);
                setPage(0);
              }}
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

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">Runes</span>
          <div className="flex items-center gap-1 bg-panel border border-border rounded-lg p-0.5">
            {ANCIENTS.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  setAncient(o.key);
                  setPage(0);
                }}
                title={o.hint}
                aria-pressed={ancient === o.key}
                className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition
                  ${ancient === o.key ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink' : 'text-ink-dim hover:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aide : « ? » sur la même ligne, à droite */}
        <div ref={helpRef} className="relative ml-auto">
          <button
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="Comment est-ce calculé ?"
            title="Comment est-ce calculé ?"
            className={`flex items-center justify-center w-8 h-8 rounded-full border transition
              ${showHelp ? 'bg-[#2b3170] border-[#4a52a0] text-ink' : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'}`}
          >
            <HelpCircle size={18} />
          </button>
          {showHelp && (
            <div className="absolute right-0 z-30 mt-1.5 w-[360px] max-w-[88vw] rounded-lg border border-[#4a52a0] bg-panel p-3 text-[12.5px] text-ink-dim leading-relaxed shadow-xl shadow-black/50">
              <p className="text-ink font-semibold mb-1">Comment est-ce calculé ?</p>
              <p>
                Pour chaque rune on calcule son <b className="text-ink">efficience actuelle</b> puis son{' '}
                <b className="text-ink">potentiel maximal</b>, en héroïque et en légendaire (tables distinctes
                pour les runes antiques), selon le mode :
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <b className="text-ink">Gemme + meule</b> — meilleure gemme possible <i>puis</i> toutes les
                  meules poussées au max.
                </li>
                <li>
                  <b className="text-ink">Meule seule</b> — on garde les stats actuelles et on ne pousse que
                  les meules, pour repérer les runes à grinder en priorité.
                </li>
              </ul>
              <p className="mt-2">
                <span className="text-ink font-semibold">Choix de la gemme</span> : si la rune n'est pas
                gemmée, on prend la stat grindable la plus rentable (PV%/ATQ%/DEF%/VIT, sinon un flat), sans
                doublon et en respectant les emplacements (slot 1 sans DEF, slot 3 sans ATQ). Si elle est déjà
                gemmée, la stat est figée : on ne fait que la « procker » au max.
              </p>
              <p className="mt-2">
                <span className="text-ink font-semibold">Gain</span> = potentiel − efficience actuelle : ce
                que la rune gagnerait. Sur chaque carte, il est affiché en{' '}
                <span className="text-emerald-400">vert</span> si le potentiel est au-dessus de l'actuelle, en{' '}
                <span className="text-fire">rouge</span> s'il est en dessous (ex. une rune déjà grindée
                légendaire « perd » en héroïque).
              </p>
              <p className="mt-2">
                <b className="text-ink">Tri</b> : efficience actuelle, potentiel ou gain. Le{' '}
                <b className="text-ink">palier</b> n'affiche que les runes ≥ X %. Clique une rune pour voir le
                plan <b className="text-ink">avant / après</b>.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} rune{filtered.length > 1 ? 's' : ''} ≥ {threshold}
          {metric === 'eff' ? '%' : ''}
          {ancient === 'without' && ' · hors antiques'}
          {ancient === 'only' && ' · antiques seules'}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Clé POSITIONNELLE : la tuile est réutilisée d'une page/d'un tri à
          l'autre, donc le cadre de rune pivote vers son nouveau slot (voir SPIN). */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2 items-start">
        {shown.map((row, i) => (
          <OptimTile
            key={i}
            row={row}
            scenario={scenarioOf(sort)}
            withGem={withGem}
            open={openId === row.id}
            onToggle={toggleOpen}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-ink-dim text-[13px]">
          Aucune rune ≥ {threshold}
          {metric === 'eff' ? '%' : ''}
          {ancient !== 'all' && (ancient === 'without' ? ' hors antiques' : ' parmi les antiques')}. Baisse le
          palier{ancient !== 'all' ? ' ou repasse sur « Toutes »' : ''} pour en voir plus.
        </p>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

const OptimTile = memo(function OptimTile({
  row,
  scenario,
  withGem,
  open,
  onToggle,
}: {
  row: Row;
  scenario: 'hero' | 'legend';
  withGem: boolean;
  open: boolean;
  onToggle: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { rune, pot } = row;
  const meta = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const ancient = rune.rank > 10;
  const metric = useRuneMetric();
  const fmt = (v: number) => formatRuneMetric(v, metric);

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-[#4a52a0]' : 'border-border'}`}
    >
      <button onClick={() => onToggle(row.id)} className="w-full flex items-center gap-2.5 p-2 text-left">
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={ancient} height={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-ink leading-tight truncate">
            {formatRuneEffect(rune.main)}
          </div>
          <div className="font-mono text-[12px] text-ink leading-tight">
            actuelle <b style={{ color: meta.color }}>{fmt(pot.eff)}</b>
          </div>
          <div className="font-mono text-[11px] leading-tight text-[#c79bff]">
            Héro {signed(pot.heroGain, metric)}{' '}
            <span className={effColor(pot.heroEff, pot.eff)}>→ {fmt(pot.heroEff)}</span>
          </div>
          <div className="font-mono text-[11px] leading-tight font-bold text-star">
            Légend {signed(pot.legendGain, metric)}{' '}
            <span className={`font-normal ${effColor(pot.legendEff, pot.eff)}`}>
              → {fmt(pot.legendEff)}
            </span>
          </div>
        </div>
      </button>

      <DetailPopover open={open} anchorRef={ref} height={300} width={340}>
        <OptimPlanBox rune={rune} scenario={scenario} withGem={withGem} />
      </DetailPopover>
    </div>
  );
});

const VIOLET = '#c79bff';

// Ligne de substat façon carte de jeu : base + grind + ↻. Chaque partie peut
// être mise en violet indépendamment (seul ce qui change passe en violet).
function SubLine({
  code,
  base,
  grind,
  enchant,
  baseViolet,
  grindViolet,
}: {
  code: number;
  base: number;
  grind: number;
  enchant?: boolean;
  baseViolet?: boolean;
  grindViolet?: boolean;
}) {
  const def = RUNE_EFFECT[code];
  const label = def ? (def.label.endsWith('%') ? def.label.slice(0, -1) : def.label) : `#${code}`;
  const suffix = def?.suffix ?? '';
  return (
    <div className="flex items-center gap-1 leading-tight">
      <span
        className={baseViolet ? 'font-semibold' : 'text-ink'}
        style={baseViolet ? { color: VIOLET } : undefined}
      >
        {label} {base}
        {suffix}
      </span>
      {grind > 0 && (
        <span
          className={grindViolet ? 'font-semibold' : 'text-orange-400'}
          style={grindViolet ? { color: VIOLET } : undefined}
        >
          +{grind}
          {suffix}
        </span>
      )}
      {enchant && (
        <RotateCw
          size={11}
          className={baseViolet ? '' : 'text-orange-400'}
          style={baseViolet ? { color: VIOLET } : undefined}
        />
      )}
    </div>
  );
}

// Détail « Actuel | Optimisé » : la rune telle quelle à gauche, sa version
// optimisée à droite avec le(s) changement(s) (gemme/grind) en violet.
function OptimPlanBox({
  rune,
  scenario,
  withGem,
}: {
  rune: RuneDetail;
  scenario: 'hero' | 'legend';
  withGem: boolean;
}) {
  const metric = useRuneMetric();
  const plan = runePlan(rune, scenario, withGem, metric);
  const gain = plan.targetEff - plan.eff;

  return (
    <div className="rounded-lg border border-[#6d5a37] bg-gradient-to-b from-[#2a2417] to-[#191510] p-3 text-[12px]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-bold text-ink uppercase tracking-wide text-[11px]">
          {scenario === 'legend' ? 'Légendaire' : 'Héroïque'}
        </span>
        <span className="font-mono text-ink-dim text-[11px]">
          {formatRuneMetric(plan.eff, metric)} →{' '}
          <b className="text-star">{formatRuneMetric(plan.targetEff, metric)}</b>{' '}
          <span className={gain >= 0 ? 'text-emerald-400' : 'text-fire'}>({signed(gain, metric)})</span>
        </span>
      </div>

      {/* stat principale + innée (communes aux deux colonnes) */}
      <div className="text-[14px] font-black text-ink leading-tight">{formatRuneEffect(rune.main)}</div>
      {rune.innate && (
        <div className="text-[12px] font-semibold text-sky-300 leading-tight">{formatRuneEffect(rune.innate)}</div>
      )}

      <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim mb-1">Actuel</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim mb-1">Optimisé</div>

        {/* Colonne gauche : substats actuels */}
        <div className="space-y-1">
          {plan.subs.map((s, i) => (
            <SubLine
              key={i}
              code={s.fromCode}
              base={s.curTotal - s.curGrind}
              grind={s.curGrind}
              enchant={rune.subs[i]?.enchant}
            />
          ))}
        </div>

        {/* Colonne droite : substats optimisés (seul ce qui change en violet) */}
        <div className="space-y-1">
          {plan.subs.map((s, i) => (
            <SubLine
              key={i}
              code={s.code}
              base={s.base}
              grind={s.grind}
              enchant={s.isGem || rune.subs[i]?.enchant}
              baseViolet={s.isGem} // la stat/base ne change qu'à la gemme
              grindViolet={s.isGem || s.grind !== s.curGrind}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
