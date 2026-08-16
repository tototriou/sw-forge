import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw, AlertTriangle, HelpCircle, PackageCheck, Hammer, Gem } from 'lucide-react';
import { CraftLine, RuneDetail } from '../../types';
import { formatRuneEffect, isAncient, RARITY_META, RUNE_EFFECT } from '../../lib/effects';
import { runePotential, RunePotential, runePlan, planNeeds } from '../../lib/runeOptim';
import { CraftStock, EMPTY_STOCK, GRADE_SCENARIO, buildCraftStock, ownsCraft } from '../../lib/crafts';
import { useRuneMetric, formatRuneMetric, convertirPalier, runeMetricValue } from '../../hooks/useRuneMetric';
import { useStickyState } from '../../hooks/useStickyState';
import RuneSlotIcon from '../RuneSlotIcon';
import Pager from './Pager';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import NumberField from '../NumberField';
import DetailPopover from './DetailPopover';

interface Props {
  runes: RuneDetail[];
  crafts: CraftLine[];
}

// Exporté : la section « Meules » réutilise la même tuile, pour qu'une rune se
// présente pareil d'un onglet à l'autre.
export interface OptimRow {
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
export const signed = (g: number, metric: 'eff' | 'score') =>
  (g >= 0 ? '+' : '') + (metric === 'eff' ? g.toFixed(1) : String(Math.round(g)));

// Filtre antiques : les garder toutes, les écarter, ou n'afficher qu'elles.
export type AncientFilter = 'all' | 'without' | 'only';
export const ANCIENTS: { key: AncientFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Toutes', hint: 'Runes normales et antiques' },
  { key: 'only', label: 'Antiques uniquement', hint: 'Uniquement les runes antiques' },
  { key: 'without', label: 'Aucune antique', hint: 'Masquer les runes antiques' },
];
export function keepAncient(rune: RuneDetail, filter: AncientFilter): boolean {
  if (filter === 'all') return true;
  return isAncient(rune) === (filter === 'only');
}

// Couleur d'une efficience potentielle vs l'actuelle : vert au-dessus, rouge en dessous.
export const effColor = (e: number, base: number) =>
  e > base + 0.05 ? 'text-good' : e < base - 0.05 ? 'text-fire' : 'text-ink-dim';

export default function RunesOptim({ runes, crafts }: Props) {
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

  const stock = useMemo(() => (crafts.length ? buildCraftStock(crafts) : EMPTY_STOCK), [crafts]);
  const stockDispo = stock.total > 0;
  // ⚠️ **Un filtre de plus, pas un onglet de plus.** « Ce que je peux faire
  // maintenant » est la même liste, restreinte : le potentiel héroïque, le
  // potentiel légendaire et les deux gains restent affichés et triables. En
  // faire une vue séparée obligeait à y réimplémenter tout ça.
  const [checkStock, setCheckStock] = useStickyState('optim.checkStock', false);
  const verifie = checkStock && stockDispo;
  const scenario = scenarioOf(sort);

  // Potentiel calculé une fois par import (linéaire, mémoïsé).
  //
  // ⚠️ Sous le filtre, le calcul change deux fois :
  //  - `noDowngrade` : on ne redescend jamais une meule déjà posée ;
  //  - `dispo` : **seules les stats dont le consommable est en réserve** sont
  //    poussées.
  //
  // Exiger le plan COMPLET écartait des runes parfaitement travaillables : une
  // Swift dont trois substats sur quatre étaient meulables disparaissait parce
  // qu'il manquait la meule VIT. Le gain affiché est donc celui qu'on peut
  // vraiment aller chercher aujourd'hui, ni plus ni moins.
  const dispoPour = useCallback(
    (rune: RuneDetail) => (kind: 'grind' | 'gem', stat: number) =>
      ownsCraft(stock, {
        kind,
        setKey: rune.set,
        stat,
        grade: GRADE_SCENARIO[scenario],
        ancient: rune.rank > 10,
      }),
    [stock, scenario]
  );

  const rows = useMemo(
    () =>
      runes.map(
        (rune, id): OptimRow => ({
          rune,
          id,
          pot: runePotential(rune, withGem, metric, verifie, verifie ? dispoPour(rune) : undefined),
        })
      ),
    [runes, withGem, metric, verifie, dispoPour]
  );

  // Une rune est retenue si le plan **restreint à la réserve** apporte encore
  // quelque chose. Plus de confrontation à faire : le plan ne contient déjà que
  // du réalisable.
  const faisable = useMemo(() => {
    if (!verifie) return null;
    const ok = new Set<number>();
    for (const r of rows) {
      const plan = runePlan(r.rune, scenario, withGem, metric, true, dispoPour(r.rune));
      if (planNeeds(plan).length > 0 && plan.targetEff > plan.eff) ok.add(r.id);
    }
    return ok;
  }, [verifie, rows, scenario, withGem, metric, dispoPour]);

  // Runes dont l'efficience actuelle dépasse le palier, triées selon le mode choisi.
  const filtered = useMemo(() => {
    const val = SORT_VAL[sort];
    return rows
      .filter(
        (r) =>
          r.pot.eff >= threshold &&
          keepAncient(r.rune, ancient) &&
          (sets.size === 0 || sets.has(r.rune.set)) &&
          (slots.size === 0 || slots.has(r.rune.slot)) &&
          (!faisable || faisable.has(r.id))
      )
      .sort((a, b) => val(b.pot) - val(a.pot));
  }, [rows, threshold, sort, ancient, sets, slots, faisable]);

  // ⚠️ Le palier est exprimé DANS la mesure courante : « 100 » ne veut pas dire
  // la même chose en efficience et en score. Changer de mesure sans convertir
  // laissait un palier qui coupe ailleurs sans prévenir — souvent une liste
  // vide, prise pour un bug.
  //
  // La conversion préserve la SÉLECTION (voir `convertirPalier`), la seule
  // question que le palier pose. Elle ne s'exécute qu'au **changement** de
  // mesure : la recalculer en continu écraserait la valeur qu'on est en train
  // de taper.
  const mesurePrecedente = useRef(metric);
  useEffect(() => {
    const avant = mesurePrecedente.current;
    if (avant === metric) return;
    mesurePrecedente.current = metric;
    if (runes.length === 0) return;
    setThreshold(
      convertirPalier(
        runes.map((r) => ({ avant: runeMetricValue(r, avant), apres: runeMetricValue(r, metric) })),
        threshold
      )
    );
    setPage(0);
  }, [metric, runes, threshold, setThreshold]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn">
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
          <span className="label">Palier</span>
          <NumberField
            value={threshold}
            min={0}
            step={5}
            width="w-14"
            ariaLabel="Palier"
            onChange={(v) => {
              setThreshold(Math.max(0, v ?? 0));
              setPage(0);
            }}
          />
          <span className="font-mono text-xs text-ink-dim">{metric === 'eff' ? '%' : 'pts'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="label">Trier par</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortMode);
              setPage(0);
            }}
            className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1 text-sm outline-none"
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
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition
                ${gemMode === o.key ? 'bg-accent-soft text-ink' : 'text-ink-dim hoverable:text-ink'}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="label">Runes</span>
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
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition
                  ${ancient === o.key ? 'bg-accent-soft text-ink' : 'text-ink-dim hoverable:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* ⚠️ Un potentiel de +20 ne vaut rien si la meule qui l'apporte n'est
            pas dans le sac. Ce bouton restreint la liste à ce qui est
            applicable **ce soir**, sans rien retirer des colonnes.
            Désactivé sans réserve connue (compte importé avant cette version) :
            un bouton qui viderait la liste sans explication vaut moins qu'un
            bouton grisé qui dit pourquoi. */}
        <button
          onClick={() => {
            setCheckStock((v) => !v);
            setPage(0);
          }}
          disabled={!stockDispo}
          aria-pressed={verifie}
          title={
            stockDispo
              ? `Ne garder que les runes applicables avec tes ${stock.total} meules et gemmes en réserve`
              : 'Aucune meule ni gemme dans les données chargées — réimporte ton compte'
          }
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition
            ${
              verifie
                ? 'bg-accent-soft border-accent text-ink'
                : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <PackageCheck size={14} /> Faisable avec ma réserve
        </button>

        {/* Aide : « ? » sur la même ligne, à droite */}
        <div ref={helpRef} className="relative ml-auto">
          <button
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="Comment est-ce calculé ?"
            title="Comment est-ce calculé ?"
            // ⚠️ Cercle de 32 px : la règle tactile en ferait un ovale de
            // 32 × 40. Exempté, avec une zone touchable rendue par le
            // pseudo-élément — comme HelpPopover, dont c'est le jumeau.
            data-cible-fine
            className={`cible-tactile flex items-center justify-center w-8 h-8 rounded-full border transition
              ${showHelp ? 'bg-accent-soft border-accent text-ink' : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'}`}
          >
            <HelpCircle size={18} />
          </button>
          {showHelp && (
            <div
              className="absolute right-0 z-30 mt-1.5 w-[360px] max-w-[88vw] rounded-lg border border-accent bg-panel p-3 text-xs text-ink-dim leading-relaxed shadow-xl shadow-black/50
                         origin-top-right animate-[popover_150ms_var(--ease-out)]"
            >
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
                <span className="text-good">vert</span> si le potentiel est au-dessus de l'actuelle, en{' '}
                <span className="text-fire">rouge</span> s'il est en dessous (ex. une rune déjà grindée
                légendaire « perd » en héroïque — ce cas disparaît sous « Faisable avec ma réserve »).
              </p>
              <p className="mt-2">
                <b className="text-ink">Tri</b> : efficience actuelle, potentiel ou gain. Clique une rune pour
                voir le plan <b className="text-ink">avant / après</b>.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Palier</span> : n'affiche que les runes dont la{' '}
                <b className="text-ink">valeur actuelle</b> atteint ce seuil — pas le potentiel, ni le gain.
                Une rune médiocre a souvent le plus gros gain relatif, sans devenir bonne pour autant.
              </p>
              <p className="mt-1.5">
                Il est exprimé <b className="text-ink">dans la mesure affichée</b> (100 en efficience n'est pas
                100 en score SW). En changeant de mesure dans ⚙, il est{' '}
                <b className="text-ink">reconverti pour garder exactement la même sélection</b> : le nombre de
                runes affichées ne bouge pas, seul le nombre écrit change. Il n'existe pas de facteur entre les
                deux mesures — le rapport varie du simple au double selon la rune — donc la conversion se fait
                par rang, pas par multiplication.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">
                  <Hammer size={12} className="inline mb-0.5" /> et{' '}
                  <Gem size={12} className="inline mb-0.5" /> dans le plan
                </span>{' '}
                : chaque ligne à travailler porte l'icône de ce qu'elle réclame — un marteau pour une{' '}
                <b className="text-ink">meule</b>, une gemme pour une <b className="text-ink">gemme</b>.
              </p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  <Hammer size={12} className="inline mb-0.5 text-good" />{' '}
                  <b className="text-good">vert</b> — tu l'as en réserve, du bon set et au bon grade :
                  c'est posable maintenant.
                </li>
                <li>
                  <Hammer size={12} className="inline mb-0.5 text-ink-dim opacity-40" />{' '}
                  <b className="text-ink">grisé</b> — il te manque, cette ligne est à farmer.
                </li>
              </ul>
              <p className="mt-1.5">
                Les <b className="text-ink">immémoriaux</b> comptent pour tous les sets ; les consommables{' '}
                <b className="text-ink">antiques</b> ne servent qu'aux runes antiques, et inversement.
              </p>

              <p className="mt-2">
                <span className="text-ink font-semibold">Faisable avec ma réserve</span> : ne garde que les
                runes que tu peux améliorer <b className="text-ink">tout de suite</b>. Le calcul change alors —
                il ne pousse que les stats dont tu as le consommable, et ne redescend jamais une meule déjà
                posée. Le gain affiché est donc <b className="text-ink">celui que tu peux réellement aller
                chercher aujourd'hui</b>, pas le potentiel théorique.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-xs text-ink-dim">
          {filtered.length} rune{filtered.length > 1 ? 's' : ''} ≥ {threshold}
          {metric === 'eff' ? '%' : ''}
          {ancient === 'without' && ' · hors antiques'}
          {ancient === 'only' && ' · antiques seules'}
          {verifie && ' · faisables avec ma réserve'}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Clé POSITIONNELLE : la tuile est réutilisée d'une page/d'un tri à
          l'autre, donc le cadre de rune pivote vers son nouveau slot (voir SPIN). */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-2 items-start">
        {shown.map((row, i) => (
          <OptimTile
            key={i}
            row={row}
            scenario={scenario}
            withGem={withGem}
            noDowngrade={verifie}
            restreint={verifie}
            stock={stockDispo ? stock : null}
            open={openId === row.id}
            onToggle={toggleOpen}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-ink-dim text-sm">
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

export const OptimTile = memo(function OptimTile({
  row,
  scenario,
  withGem,
  noDowngrade,
  restreint,
  stock,
  open,
  onToggle,
}: {
  row: OptimRow;
  scenario: 'hero' | 'legend';
  withGem: boolean;
  noDowngrade: boolean;
  restreint: boolean; // le plan se limite à ce que la réserve permet
  stock: CraftStock | null;
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
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-accent' : 'border-border'}`}
    >
      <button onClick={() => onToggle(row.id)} className="w-full flex items-center gap-2.5 p-2 text-left">
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={ancient} height={46} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-ink leading-tight truncate">
            {formatRuneEffect(rune.main)}
          </div>
          <div className="font-mono text-xs text-ink leading-tight">
            {/* Texte, donc `meta.ink` — voir RARITY_META. */}
            actuelle <b style={{ color: meta.ink }}>{fmt(pot.eff)}</b>
          </div>
          <div className="font-mono text-micro leading-tight" style={{ color: 'rgb(var(--rarity-4))' }}>
            Héro {signed(pot.heroGain, metric)}{' '}
            <span className={effColor(pot.heroEff, pot.eff)}>→ {fmt(pot.heroEff)}</span>
          </div>
          <div className="font-mono text-micro leading-tight font-bold text-star">
            Légend {signed(pot.legendGain, metric)}{' '}
            <span className={`font-normal ${effColor(pot.legendEff, pot.eff)}`}>
              → {fmt(pot.legendEff)}
            </span>
          </div>
        </div>
      </button>

      <DetailPopover open={open} anchorRef={ref} height={300} width={340}>
        <OptimPlanBox
          rune={rune}
          scenario={scenario}
          withGem={withGem}
          noDowngrade={noDowngrade}
          restreint={restreint}
          stock={stock}
        />
      </DetailPopover>
    </div>
  );
});

// Le violet qui signale « ce qui change » dans un plan d'optimisation. Même
// teinte que l'héroïque, donc même token : il suit le thème et reste lisible
// sur fond clair. Voir spec/shared/design.md.
const VIOLET = 'rgb(var(--rarity-4))';

// Ligne de substat façon carte de jeu : base + grind + ↻. Chaque partie peut
// être mise en violet indépendamment (seul ce qui change passe en violet).
function SubLine({
  code,
  base,
  grind,
  enchant,
  baseViolet,
  grindViolet,
  enReserve,
}: {
  code: number;
  base: number;
  grind: number;
  enchant?: boolean;
  baseViolet?: boolean;
  grindViolet?: boolean;
  // `null` = rien à poser sur cette ligne, ou réserve inconnue → aucun marquage.
  enReserve?: { kind: 'grind' | 'gem'; ok: boolean } | null;
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
      {/* ⚠️ La ligne qu'on peut poser TOUT DE SUITE est marquée. L'icône dit de
          quel consommable il s'agit, la couleur dit s'il est en réserve : vert
          = disponible, grisé = à farmer. Sans ce repère, il fallait aller
          compter ses meules ailleurs pour savoir par où commencer. */}
      {enReserve &&
        (enReserve.kind === 'grind' ? (
          <Hammer
            size={10}
            className={`ml-auto flex-none ${enReserve.ok ? 'text-good' : 'text-ink-dim opacity-40'}`}
          />
        ) : (
          <Gem
            size={10}
            className={`ml-auto flex-none ${enReserve.ok ? 'text-good' : 'text-ink-dim opacity-40'}`}
          />
        ))}
    </div>
  );
}

// Détail « Actuel | Optimisé » : la rune telle quelle à gauche, sa version
// optimisée à droite avec le(s) changement(s) (gemme/grind) en violet.
export function OptimPlanBox({
  rune,
  scenario,
  withGem,
  noDowngrade = false,
  restreint = false,
  stock = null,
}: {
  rune: RuneDetail;
  scenario: 'hero' | 'legend';
  withGem: boolean;
  noDowngrade?: boolean;
  restreint?: boolean;
  stock?: CraftStock | null;
}) {
  const metric = useRuneMetric();
  // ⚠️ **Quelle ligne puis-je poser MAINTENANT.** Le plan dit quoi faire, la
  // réserve dit ce qui est à portée : sans le croisement, il faut aller compter
  // ses meules ailleurs pour savoir par où commencer.
  const grade = GRADE_SCENARIO[scenario];
  const dispo = (kind: 'grind' | 'gem', stat: number) =>
    !!stock && ownsCraft(stock, { kind, setKey: rune.set, stat, grade, ancient: rune.rank > 10 });

  // Le plan affiché doit être CELUI du chiffre affiché : sous le filtre, il se
  // limite lui aussi à ce que la réserve permet.
  const plan = runePlan(rune, scenario, withGem, metric, noDowngrade, restreint ? dispo : undefined);
  const gain = plan.targetEff - plan.eff;

  return (
    <div className="rounded-lg border border-border bg-panel2 p-3 text-xs">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-bold text-ink uppercase tracking-wide text-micro">
          {scenario === 'legend' ? 'Légendaire' : 'Héroïque'}
        </span>
        <span className="font-mono text-ink-dim text-micro">
          {formatRuneMetric(plan.eff, metric)} →{' '}
          <b className="text-star">{formatRuneMetric(plan.targetEff, metric)}</b>{' '}
          <span className={gain >= 0 ? 'text-good' : 'text-fire'}>({signed(gain, metric)})</span>
        </span>
      </div>

      {/* stat principale + innée (communes aux deux colonnes) */}
      <div className="text-sm font-black text-ink leading-tight">{formatRuneEffect(rune.main)}</div>
      {rune.innate && (
        <div className="text-xs font-semibold text-water leading-tight">{formatRuneEffect(rune.innate)}</div>
      )}

      <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-x-4">
        <div className="label mb-1">Actuel</div>
        <div className="label mb-1">Optimisé</div>

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
          {plan.subs.map((s, i) => {
            // Une seule marque par ligne : la gemme prime, c'est elle qui
            // conditionne le reste (elle remet la meule du slot à zéro).
            const marque = s.isGem
              ? { kind: 'gem' as const, ok: dispo('gem', s.code) }
              : s.grindable && s.grind > s.curGrind
                ? { kind: 'grind' as const, ok: dispo('grind', s.code) }
                : null;
            return (
              <SubLine
                key={i}
                code={s.code}
                base={s.base}
                grind={s.grind}
                enchant={s.isGem || rune.subs[i]?.enchant}
                baseViolet={s.isGem} // la stat/base ne change qu'à la gemme
                grindViolet={s.isGem || s.grind !== s.curGrind}
                enReserve={stock ? marque : null}
              />
            );
          })}
        </div>
      </div>

      {/* ⚠️ **Déclarer ce qu'on vient de faire en jeu**, sans réexporter son
          compte. Un export est une photo : dès qu'on meule, la réserve affichée
          est fausse et l'app propose des runes qu'on n'a plus de quoi traiter.
          Ce bouton retire les consommables du stock **et** la rune de la liste.
          Réversible : « Annuler » remet tout, une ligne cliquée par erreur ne
          doit pas obliger à réimporter. */}
    </div>
  );
}
