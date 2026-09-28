import { useMemo } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { Bouton } from '../../ui';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import AncientFilter, { AncientFilter as AncientFilterValue } from './AncientFilter';

// ⚠️ **Les filtres des runes À LA SOURIS, tous VISIBLES, sur une ligne**
// (refonte graphique, lot 8a, décision 20 précisée) : sets · emplacements ·
// antiques, puis « Effacer les filtres ». Mêmes contrôles qu'avant —
// `SetFilter`, `SlotFilter`, `AncientFilter`, inchangés —, rangés sur une
// seule ligne au lieu de trois.
// ⚠️ **Pas de menus déroulants** : la maquette en posait trois, essayés puis
// défaits par Thomas, d'abord pour les sets (« pas très fan d'avoir des
// drop-down pour un set filtre dedans »), puis pour le reste (« sors tout des
// boutons »). Un filtre fermé dans un menu ne dit pas ce qu'il filtre sans
// qu'on l'ouvre.
// Partagé par la Liste, les Courbes et l'Optimisation. Au doigt, chaque vue
// garde ses filtres d'avant (lot 11).

const SLOTS = [1, 2, 3, 4, 5, 6];

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
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-filtres-ligne>
      <SetFilter runes={runes} value={sets} onChange={onSets} />
      <SlotFilter value={slots} onChange={onSlots} />
      {/* Intitulé comme ses voisins (« Sets », « Slot ») : celui que
          l'Optimisation donne déjà à ce filtre. */}
      {antiques && (
        <div className="flex items-center gap-1">
          <span className="label mr-1">Runes</span>
          <AncientFilter value={ancient} onChange={onAncient} />
        </div>
      )}
      <EffacerFiltres
        runes={runes}
        sets={sets}
        onSets={onSets}
        slots={slots}
        onSlots={onSlots}
        ancient={ancient}
        onAncient={onAncient}
        antiques={antiques}
        // 32 px : la hauteur des filtres de la ligne (gabaritFiltre.ts).
        className="h-8"
      />
    </div>
  );
}

// « Effacer les filtres » — posé au bout de la ligne de filtres (souris) ET
// dans le panneau « Filtrer mes runes » (téléphone, lot 11c, décision 26).
// Un seul composant pour les deux : même remise à zéro, même raison quand il
// est désactivé.
// ⚠️ Toujours affiché, DÉSACTIVÉ quand rien n'est filtré : un bouton qui
// apparaît au premier filtre posé ne s'explique pas.
export function EffacerFiltres({
  runes,
  sets,
  onSets,
  slots,
  onSlots,
  ancient,
  onAncient,
  antiques = true,
  className = '',
}: {
  runes: RuneDetail[];
  sets: Set<string>;
  onSets: (next: Set<string>) => void;
  slots: Set<number>;
  onSlots: (next: Set<number>) => void;
  ancient: AncientFilterValue;
  onAncient: (v: AncientFilterValue) => void;
  antiques?: boolean;
  className?: string;
}) {
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const tousLesSets = present.every((s) => sets.has(s.key));
  const tousLesSlots = SLOTS.every((n) => slots.has(n));
  const parDefaut = tousLesSets && tousLesSlots && (!antiques || ancient === 'all');

  return (
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
      className={className}
    />
  );
}
