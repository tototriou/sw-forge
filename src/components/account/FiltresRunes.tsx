import { useMemo } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { Bouton, Deroulant } from '../../ui';
import RuneIcon from '../RuneIcon';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import AncientFilter, { ANCIENTS, AncientFilter as AncientFilterValue } from './AncientFilter';

// ⚠️ **Les filtres des runes À LA SOURIS : trois menus déroulants** (refonte
// graphique, lot 8a, décision 20 — Thomas : « menus déroulants », comme la
// maquette) : Set · Emplacement · Antiques, puis « Effacer les filtres ».
// Chaque menu garde les MÊMES choix qu'avant — `SetFilter`, `SlotFilter`,
// `AncientFilter`, inchangés, dans le panneau. Ils prenaient trois rangées de
// la page ; le bouton dit maintenant la valeur d'un coup d'œil.
// Partagé par la Liste, les Courbes et l'Optimisation. Au doigt, chaque vue
// garde ses filtres d'avant (lot 11).

const SLOTS = [1, 2, 3, 4, 5, 6];

// Au-delà de deux noms, le résumé s'abrège (« Swift, Violent +3 ») : le bouton
// reste sur une ligne, la liste complète est dans l'infobulle.
const NOMS_MAX = 2;

export default function FiltresRunes({
  runes,
  sets,
  onSets,
  slots,
  onSlots,
  ancient,
  onAncient,
  antiques = true,
}: {
  runes: RuneDetail[];
  sets: Set<string>;
  onSets: (next: Set<string>) => void;
  slots: Set<number>;
  onSlots: (next: Set<number>) => void;
  ancient: AncientFilterValue;
  onAncient: (v: AncientFilterValue) => void;
  // L'Optimisation range les antiques dans son propre bloc « Runes » : elle ne
  // les répète pas ici.
  antiques?: boolean;
}) {
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const setsChoisis = present.filter((s) => sets.has(s.key));
  const tousLesSets = setsChoisis.length === present.length;
  const tousLesSlots = SLOTS.every((n) => slots.has(n));
  const parDefaut = tousLesSets && tousLesSlots && (!antiques || ancient === 'all');

  const resumeSets = tousLesSets ? (
    'Tous'
  ) : setsChoisis.length === 0 ? (
    'Aucun'
  ) : (
    <span className="inline-flex items-center gap-1">
      {setsChoisis.slice(0, NOMS_MAX).map((s) => (
        <RuneIcon key={s.key} setKey={s.key} size={14} />
      ))}
      {setsChoisis
        .slice(0, NOMS_MAX)
        .map((s) => s.label)
        .join(', ')}
      {setsChoisis.length > NOMS_MAX && ` +${setsChoisis.length - NOMS_MAX}`}
    </span>
  );
  const slotsChoisis = SLOTS.filter((n) => slots.has(n));
  const resumeSlots = tousLesSlots ? 'Tous' : slotsChoisis.length === 0 ? 'Aucun' : slotsChoisis.join(', ');

  return (
    <div className="flex flex-wrap items-center gap-2" data-filtres-deroulants>
      <Deroulant
        intitule="Set"
        resume={resumeSets}
        title={tousLesSets ? undefined : setsChoisis.map((s) => s.label).join(', ') || 'Aucun set'}
      >
        <SetFilter runes={runes} value={sets} onChange={onSets} sansIntitule />
      </Deroulant>
      <Deroulant intitule="Emplacement" resume={resumeSlots}>
        <SlotFilter value={slots} onChange={onSlots} sansIntitule />
      </Deroulant>
      {antiques && (
        <Deroulant intitule="Antiques" resume={ANCIENTS.find((a) => a.key === ancient)?.label ?? 'Toutes'}>
          <AncientFilter value={ancient} onChange={onAncient} />
        </Deroulant>
      )}
      {/* ⚠️ Toujours affiché, DÉSACTIVÉ quand rien n'est filtré : un bouton
          qui apparaît au premier filtre posé ne s'explique pas. */}
      <Bouton
        onClick={() => {
          onSets(new Set(present.map((s) => s.key)));
          onSlots(new Set(SLOTS));
          if (antiques) onAncient('all');
        }}
        disabled={parDefaut}
        title={parDefaut ? 'Aucun filtre posé' : 'Revenir à tous les sets, tous les emplacements et toutes les runes'}
        fond="vide"
        trait="aucun"
        taille="sm"
        libelle="Effacer les filtres"
      />
    </div>
  );
}
