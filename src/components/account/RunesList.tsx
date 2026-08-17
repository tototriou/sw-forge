import { memo, useMemo, useState } from 'react';
import { RuneDetail } from '../../types';
import { RUNE_EFFECT, runeEfficiency, runeScore } from '../../lib/effects';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import RuneSlotIcon from '../RuneSlotIcon';
import { RuneDetailBox } from '../MonsterGear';
import Pager from './Pager';
import { Critere } from './SubSearchDialog';
import SubSearchBar from './SubSearchBar';
import MobileSheet from '../../ui/MobileSheet';
import {
  RUNE_SORTS,
  RuneSortMode,
  comparateurRunes,
  estTriConnu,
  valeurSub,
} from '../../lib/runeSort';
import { useStickyState } from '../../hooks/useStickyState';
import { useRuneMetric } from '../../hooks/useRuneMetric';

interface Props {
  runes: RuneDetail[];
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
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
// jamais être satisfait. C'est aussi le nombre de cases de rappel du jeu.
const MAX_SUBS = 4;

// Propriétés secondaires proposées, dans l'ordre de la table de référence.
// ⚠️ Toutes les lignes de `RUNE_EFFECT` peuvent être un substat SAUF la VIT
// plate… qui l'est aussi. On garde donc la table entière : c'est exactement ce
// qu'une rune peut porter.
const SUBS_OPTIONS = Object.entries(RUNE_EFFECT).map(([code, def]) => ({
  code: Number(code),
  label: def.label,
}));

export default function RunesList({ runes, menuOuvert, onFermerMenu }: Props) {
  const [sets, setSets] = useStickyState<Set<string>>('runesList.sets', new Set());
  const [slots, setSlots] = useStickyState<Set<number>>('runesList.slots', new Set());
  const [ancientOnly, setAncientOnly] = useStickyState('runesList.ancient', false);
  const [sortBrut, setSort] = useStickyState<RuneSortMode>('runesList.sort', 'score');
  // ⚠️ Un tri mémorisé qui n'existe plus (les clés ont changé avec les libellés
  // du jeu) retombe sur le défaut : sinon `sortFn` renvoie `undefined` et le
  // `sort` lève, page blanche à la clé.
  const sort = estTriConnu(sortBrut) ? sortBrut : 'score';
  // Propriétés cherchées, dans l'ordre de priorité — même grammaire que
  // l'inventaire d'artéfacts (voir SubSearchDialog).
  //
  // ⚠️ QUATRE au plus : une rune ne porte que 4 propriétés secondaires, un
  // cinquième critère ne pourrait jamais être satisfait.
  const [criteres, setCriteres] = useStickyState<Critere[]>('runesList.criteres', []);
  // La modale ne pose que des critères complets ; ce garde-fou couvre un état
  // mémorisé d'une version antérieure, où une case vide valait `{code: 0}`.
  const actifs = useMemo(() => criteres.filter((c) => c.code > 0), [criteres]);
  // Codes recherchés : les tuiles s'en servent pour surligner la ligne visée.
  const cherches = useMemo(() => new Set(actifs.map((c) => c.code)), [actifs]);
  const metric = useRuneMetric(); // choix PARTAGÉ avec les autres vues
  const [page, setPage] = useState(0);
  // ⚠️ Plus d'état « rune ouverte » : la tuile EST la carte de détail, il n'y a
  // plus rien à ouvrir. Voir RuneTile.

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
      // ⚠️ Les critères se cumulent en ET, bornes comprises : la rune doit
      // porter TOUTES les propriétés cherchées, chacune dans son intervalle.
      // Même règle que la recherche détaillée du jeu.
      // ⚠️ `max` absent = pas de plafond, ce qui n'est PAS « au plus zéro ».
      for (const c of actifs) {
        const v = valeurSub(r, c.code);
        if (v == null || v < c.min) return false;
        if (c.max != null && v > c.max) return false;
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

  // Les filtres, rendus une seule fois et posés à DEUX endroits selon la
  // largeur. Deux copies auraient divergé au premier filtre ajouté.
  const filtres = (
    <>
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
            className={`ml-1 rounded-full border px-3 py-1 text-xs font-semibold transition select-none
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

        {/* Propriété secondaire — la barre du JEU : quatre cases de rappel
            et la bascule 2 ↔ 4 à côté.
            ⚠️ Les cases sont ORDONNÉES : la 1ʳᵉ sert aussi de clé aux deux tris
            « propriété secondaire ». La position porte donc du sens. */}
        <div className="flex flex-wrap items-start gap-2">
          <span className="w-[86px] flex-none label mt-1">Propriété</span>
          <div className="min-w-0 flex-1 max-w-[480px]">
            <SubSearchBar
              options={SUBS_OPTIONS}
              criteres={criteres}
              max={MAX_SUBS}
              nomDe={(code) => RUNE_EFFECT[code]?.label ?? `#${code}`}
              onChange={(c) => {
                setCriteres(c);
                setPage(0);
              }}
            />
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
            className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1 text-sm outline-none"
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
            <span className="text-xs text-warn">
              Choisis une propriété ci-dessus pour trier dessus.
            </span>
          )}
        </div>
    </>
  );

  return (
    <div>
      {/* ⚠️ CINQ rangées de filtres — sets, slots, propriété secondaire, tri —
          soit près de la moitié d'un écran de téléphone avant la première rune.
          Sous `lg` elles descendent dans le panneau « Options ». */}
      <div className="hidden lg:flex lg:flex-col gap-3 mb-4">{filtres}</div>

      <MobileSheet ouvert={menuOuvert} onFermer={onFermerMenu} titre="Filtrer mes runes">
        <div className="flex flex-col gap-3">{filtres}</div>
      </MobileSheet>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="font-mono text-xs text-ink-dim">
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
      {/* ⚠️ 215 px : c'est la largeur en dessous de laquelle la bannière de
          rareté passe SOUS la stat principale — chaque tuile gagne alors une
          ligne, l'inverse du but. La bannière est resserrée en mode compact
          justement pour descendre jusque-là (voir RuneDetailBox). */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(215px,100%),1fr))] gap-2 items-start">
        {shown.map((row, i) => (
          <RuneTile key={i} row={row} cherches={cherches} />
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

// Tuile de rune — **la carte du jeu**, en rendu resserré.
//
// ⚠️ C'est la MÊME carte que celle qu'on ouvrait au clic (`RuneDetailBox`), pas
// un résumé qui y mènerait. Tout ce qu'on vient chercher dans l'inventaire — la
// stat principale, l'innée, les quatre substats avec leur part de meule, la
// rareté, le score, le bonus de set — y est d'emblée. Un aperçu qui cachait les
// substats obligeait à ouvrir les runes une par une pour comparer, ce qui est
// exactement ce qu'on fait en parcourant 2 000 runes.
//
// ⚠️ Plus de popover au clic : il n'aurait rien montré de plus. La tuile n'est
// donc plus cliquable — un bouton qui ne fait rien se lit comme un défaut.
//
// Mémoïsée : ne se re-rend pas quand seuls les filtres/la page changent ailleurs.
const RuneTile = memo(function RuneTile({
  row,
  cherches,
}: {
  row: RuneRow;
  cherches: Set<number>; // codes recherchés → la ligne est surlignée
}) {
  const { rune } = row;
  return (
    <RuneDetailBox
      rune={rune}
      compact
      cherches={cherches}
      icone={
        <RuneSlotIcon
          slot={rune.slot}
          setKey={rune.set}
          rarity={rune.rarity}
          ancient={rune.rank > 10}
          height={36}
        />
      }
    />
  );
});
