import { useMemo } from 'react';
import { RuneDetail, RUNE_SETS } from '../../types';
import { Bouton, Deroulant } from '../../ui';
import SetFilter from './SetFilter';
import SlotFilter from './SlotFilter';
import AncientFilter, { ANCIENTS, AncientFilter as AncientFilterValue } from './AncientFilter';

// ⚠️ **Les filtres des runes À LA SOURIS, sur UNE ligne** (refonte graphique,
// lot 8a, décision 20 précisée) : la rangée d'icônes des SETS, visible, puis
// deux menus déroulants — Emplacement · Antiques —, puis « Effacer les
// filtres ». Chaque menu garde les MÊMES choix qu'avant (`SlotFilter`,
// `AncientFilter`, inchangés, dans le panneau) ; ils prenaient deux rangées de
// la page, le bouton dit maintenant la valeur d'un coup d'œil.
// ⚠️ **Les sets ne sont PAS dans un menu** : essayé, puis défait par Thomas
// (« pas très fan d'avoir des drop-down pour un set filtre dedans »). La
// rangée d'icônes du jeu se reconnaît et se coche d'un regard ; fermée dans un
// menu, il fallait l'ouvrir pour voir quels sets étaient choisis.
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
  const present = useMemo(() => {
    const s = new Set(runes.map((r) => r.set));
    return RUNE_SETS.filter((rs) => s.has(rs.key));
  }, [runes]);

  const tousLesSets = present.every((s) => sets.has(s.key));
  const tousLesSlots = SLOTS.every((n) => slots.has(n));
  const parDefaut = tousLesSets && tousLesSlots && (!antiques || ancient === 'all');

  const slotsChoisis = SLOTS.filter((n) => slots.has(n));
  const resumeSlots = tousLesSlots ? 'Tous' : slotsChoisis.length === 0 ? 'Aucun' : slotsChoisis.join(', ');

  return (
    <div className="flex flex-wrap items-center gap-2" data-filtres-deroulants>
      <SetFilter runes={runes} value={sets} onChange={onSets} />
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
