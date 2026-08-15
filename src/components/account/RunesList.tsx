import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { RuneDetail } from '../../types';
import {
  formatRuneEffect,
  RARITY_META,
  RUNE_EFFECT,
  runeEfficiency,
  runeScore,
} from '../../lib/effects';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import RuneSlotIcon from '../RuneSlotIcon';
import { RuneDetailBox } from '../MonsterGear';
import Pager from './Pager';
import CritereCase, { Critere } from './CritereCase';
import DetailPopover from './DetailPopover';
import {
  RUNE_SORTS,
  RuneSortMode,
  comparateurRunes,
  estTriConnu,
  valeurSub,
} from '../../lib/runeSort';
import { useStickyState } from '../../hooks/useStickyState';
import {
  RuneMetric,
  useRuneMetric,
  formatRuneMetric,
  runeMetricLabel,
} from '../../hooks/useRuneMetric';

interface Props {
  runes: RuneDetail[];
}

// Une rune enrichie de ses deux mesures (calculées une fois).
interface RuneRow {
  rune: RuneDetail;
  eff: number; // efficience (%)
  score: number; // score SW (celui du jeu)
  id: number;
}

const PAGE = 60; // tuiles par page (DOM borné pour rester fluide)

// Une rune ne porte que 4 propriétés secondaires : un 5ᵉ critère ne pourrait
// jamais être satisfait. La grille se replie à 2 tant qu'on n'en use pas plus.
const MAX_SUBS = 4;
const GRILLE_REPLIEE = 2;

// Propriétés secondaires proposées, dans l'ordre de la table de référence.
// ⚠️ Toutes les lignes de `RUNE_EFFECT` peuvent être un substat SAUF la VIT
// plate… qui l'est aussi. On garde donc la table entière : c'est exactement ce
// qu'une rune peut porter.
const SUBS_OPTIONS = Object.entries(RUNE_EFFECT).map(([code, def]) => ({
  code: Number(code),
  label: def.label,
}));

export default function RunesList({ runes }: Props) {
  const [sets, setSets] = useStickyState<Set<string>>('runesList.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesList.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesList.ancient', false);
  const [sortBrut, setSort] = useStickyState<RuneSortMode>('runesList.sort', 'score');
  // ⚠️ Un tri mémorisé qui n'existe plus (les clés ont changé avec les libellés
  // du jeu) retombe sur le défaut : sinon `sortFn` renvoie `undefined` et le
  // `sort` lève, page blanche à la clé.
  const sort = estTriConnu(sortBrut) ? sortBrut : 'score';
  // Propriétés cherchées, dans l'ordre de priorité — même grammaire que
  // l'inventaire d'artéfacts (voir CritereCase).
  //
  // ⚠️ QUATRE au plus : une rune ne porte que 4 propriétés secondaires, un
  // cinquième critère ne pourrait jamais être satisfait.
  const [criteres, setCriteres] = useStickyState<Critere[]>('runesList.criteres', []);
  const [depliee, setDepliee] = useState(false);
  const cases = depliee ? MAX_SUBS : GRILLE_REPLIEE;
  const actifs = useMemo(
    () => criteres.slice(0, cases).filter((c) => c.code > 0),
    [criteres, cases]
  );
  const metric = useRuneMetric(); // choix PARTAGÉ avec les autres vues
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const toggleOpen = useCallback((id: number) => setOpenId((c) => (c === id ? null : id)), []);

  // Les deux mesures calculées une seule fois par import (bascule instantanée).
  const rows = useMemo(
    () =>
      runes.map(
        (rune, id): RuneRow => ({ rune, id, eff: runeEfficiency(rune), score: runeScore(rune) })
      ),
    [runes]
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const r = row.rune;
      if (sets.size && !sets.has(r.set)) return false;
      if (slots.size && !slots.has(r.slot)) return false;
      if (ancientOnly && !(r.rank > 10)) return false;
      // ⚠️ Les critères se cumulent en ET, seuil compris : la rune doit porter
      // TOUTES les propriétés cherchées, chacune au moins à son minimum. Même
      // règle que la recherche détaillée du jeu et que l'inventaire d'artéfacts.
      for (const c of actifs) {
        const v = valeurSub(r, c.code);
        if (v == null || v < c.min) return false;
      }
      return true;
    });
  }, [rows, sets, slots, ancientOnly, actifs]);

  // Tri appliqué après filtrage (copie pour ne pas muter `filtered`).
  // Le 1ᵉʳ critère posé sert aux deux tris « propriété secondaire ».
  const premierCode = actifs[0]?.code ?? 0;
  const sorted = useMemo(
    () => [...filtered].sort(comparateurRunes(sort, metric, premierCode)),
    [filtered, sort, metric, premierCode]
  );
  const best = useMemo(
    () => filtered.reduce((m, r) => Math.max(m, metric === 'eff' ? r.eff : r.score), 0),
    [filtered, metric]
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = sorted.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Sets : multi-sélection, icônes seules (voir SetFilter) */}
        <SetFilter
          runes={runes}
          value={sets}
          onChange={(next) => {
            setSets(next);
            setPage(0);
          }}
        />

        {/* Slot + antiques */}
        <div className="flex flex-wrap items-center gap-2">
          <SlotFilter
            value={slots}
            onChange={(next) => {
              setSlots(next);
              setPage(0);
            }}
          />
          <button
            onClick={() => {
              setAncientOnly((v) => !v);
              setPage(0);
            }}
            className={`ml-1 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                // ⚠️ La BORDURE seule (voir spec/shared/design.md). Elle
                // cumulait fond + bordure + encre d'accent + ombre : quatre
                // signaux pour un seul état. L'outline est plus discret que
                // l'aplat sur une pastille isolée en bout de rangée — le fond
                // la faisait ressortir comme un bouton d'action.
                ancientOnly
                  ? 'bg-panel border-accent text-ink'
                  : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
              }`}
          >
            Antiques
          </button>
        </div>

        {/* Propriété secondaire — grille de critères, façon recherche détaillée
            du jeu. Même grammaire que l'inventaire d'artéfacts.
            ⚠️ Les cases sont ORDONNÉES : la 1ʳᵉ sert aussi de clé aux deux tris
            « propriété secondaire ». La position porte donc du sens. */}
        <div className="flex flex-wrap items-start gap-2">
          <span className="w-[86px] flex-none label mt-1.5">Propriété</span>
          {/* ⚠️ Largeur BORNÉE, contrairement aux artéfacts : les propriétés de
              rune ont des libellés très courts (« VIT », « Dmg Crit »), là où
              celles d'un artéfact tiennent en une phrase (« Dégâts sur le Feu
              +X% »). Laissée en `flex-1`, la grille s'étirait sur toute la
              largeur pour n'afficher que trois lettres par menu. */}
          {/* 480 px : une case tombe à ~237 px, dont ~126 pris par le rang et
              les commandes du seuil une fois posé — il reste ~110 px au menu,
              de quoi lire « Dmg Crit » sans troncature. En dessous, le libellé
              se coupait dès qu'un seuil était saisi. */}
          <div className="min-w-0 flex-1 max-w-[480px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Array.from({ length: cases }, (_, i) => (
                <CritereCase
                  key={i}
                  rang={i + 1}
                  critere={criteres[i] ?? null}
                  options={SUBS_OPTIONS}
                  nomDe={(code) => RUNE_EFFECT[code]?.label ?? `#${code}`}
                  onChange={(c) => {
                    const next = [...criteres];
                    while (next.length < cases) next.push({ code: 0, min: 0 });
                    next[i] = c ?? { code: 0, min: 0 };
                    setCriteres(next);
                    setPage(0);
                  }}
                />
              ))}
            </div>

            <div className="mt-1.5 flex items-center gap-2">
              {/* ⚠️ Le bouton dit CE QU'IL VA FAIRE, pas l'état courant. */}
              <button
                onClick={() => setDepliee(!depliee)}
                className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold
                           text-ink-dim transition hoverable:text-ink hoverable:border-accent"
              >
                {depliee
                  ? `▴ Replier à ${GRILLE_REPLIEE} propriétés`
                  : `▾ Déplier à ${MAX_SUBS} propriétés`}
              </button>

              {actifs.length > 0 && (
                <button
                  onClick={() => {
                    setCriteres([]);
                    setPage(0);
                  }}
                  className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold
                             text-ink-dim transition hoverable:text-fire hoverable:border-fire"
                >
                  ✕ Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tri — les entrées du JEU, dans son ordre. La MESURE (efficience /
            score) reste un réglage global, dans la barre de nav. */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-[86px] flex-none label">Trier par</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as RuneSortMode);
              setPage(0);
            }}
            title={RUNE_SORTS.find((s) => s.key === sort)?.hint}
            className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1 text-[13px] outline-none"
          >
            {RUNE_SORTS.map((s) => (
              <option key={s.key} value={s.key} title={s.hint}>
                {s.label}
              </option>
            ))}
          </select>
          {/* ⚠️ Les deux tris « propriété » n'ont rien à classer sans critère :
              le dire ici évite de croire que le tri est cassé. */}
          {(sort === 'sub_desc' || sort === 'sub_brut_desc') && !premierCode && (
            <span className="text-[12px] text-warn">
              Choisis une propriété ci-dessus pour trier dessus.
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-[12px] text-ink-dim">
          {filtered.length} rune{filtered.length > 1 ? 's' : ''}
          {filtered.length !== runes.length && ` sur ${runes.length}`}
          {filtered.length > 0 && (
            <>
              {' '}
              · meilleur{metric === 'eff' ? 'e efficience' : ' score'}{' '}
              <b className="text-star">{metric === 'eff' ? `${best.toFixed(1)}%` : best}</b>
            </>
          )}
        </p>
        <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
      </div>

      {/* Grille de runes (page courante uniquement).
          Clé POSITIONNELLE (et non `row.id`) : la tuile est réutilisée quand la
          page/le filtre change, donc le cadre pivote vers son nouveau slot au
          lieu d'être remonté d'un coup. Voir SPIN dans RuneSlotIcon. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 items-start">
        {shown.map((row, i) => (
          <RuneTile key={i} row={row} metric={metric} open={openId === row.id} onToggle={toggleOpen} />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

// Tuile uniforme cliquable : cadre de rune (orienté par slot, icône de set
// dedans) à gauche · stat principale à côté · efficience en dessous.
// Mémoïsée : ne se re-rend pas quand seuls les filtres/la page changent ailleurs.
const RuneTile = memo(function RuneTile({
  row,
  metric,
  open,
  onToggle,
}: {
  row: RuneRow;
  metric: RuneMetric;
  open: boolean;
  onToggle: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { rune } = row;
  const meta = RARITY_META[rune.rarity] ?? RARITY_META[1];
  const ancient = rune.rank > 10;

  return (
    <div
      ref={ref}
      className={`relative rounded-lg border bg-panel ${open ? 'z-20 border-accent' : 'border-border'}`}
    >
      <button onClick={() => onToggle(row.id)} className="w-full flex items-center gap-2.5 p-2 text-left">
        <RuneSlotIcon slot={rune.slot} setKey={rune.set} rarity={rune.rarity} ancient={ancient} height={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink leading-tight truncate">
            {formatRuneEffect(rune.main)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-dim leading-tight">
            {runeMetricLabel(metric)}{' '}
            {/* `meta.ink` et non `meta.color` : c'est du TEXTE sur un panneau,
                pas la bannière de rareté. Les couleurs vives du jeu sont
                illisibles sur fond clair. Voir RARITY_META. */}
            <b style={{ color: meta.ink }}>
              {formatRuneMetric(metric === 'eff' ? row.eff : row.score, metric)}
            </b>
          </div>
        </div>
      </button>

      {/* Détail flottant : carte récap, placement auto (gauche/haut si bord). */}
      <DetailPopover open={open} anchorRef={ref} height={320}>
        <RuneDetailBox rune={rune} />
      </DetailPopover>
    </div>
  );
});
