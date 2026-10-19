import HelpPopover from '../../HelpPopover';
import { Pastille } from '../../../ui';
import RuneIcon from '../../RuneIcon';
import { runeSetIconFilter, RUNE_EFFECT } from '../../../lib/effects';
import { type Monster, type GearSet } from '../../../types';
import { type Dispatch, type SetStateAction } from 'react';

export interface RunesImposeesProps {
  selected: { monster: Monster; gear: GearSet; } | null;
  lockedRunes: Partial<Record<number, number>>;
  setLockedRunes: Dispatch<SetStateAction<Partial<Record<number, number>>>>;
  // Colonne « Aura, exclusion, avancés » du bureau : deux colonnes, slots
  // impairs puis pairs (1 · 2, 3 · 4, 5 · 6), espacées également entre les
  // bords (`justify-evenly`). Le téléphone et la page d'aujourd'hui gardent la
  // rangée qui passe à la ligne.
  bureau?: boolean;
}

export default function RunesImposees({ selected, lockedRunes, setLockedRunes, bureau = false }: RunesImposeesProps) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="label" data-intitule-conserve>Conserver ces slots dans l'optimisation</p>
        <HelpPopover title="Conserver ces slots dans l'optimisation">
          Verrouille un emplacement sur la rune que le monstre porte déjà : la recherche gardera
          <b className="text-ink"> exactement cette rune</b> et n'optimisera que les autres. Utile pour
          conserver une rune que tu ne veux pas déruner. Les emplacements laissés libres sont optimisés
          normalement.
        </HelpPopover>
      </div>
      {!selected || selected.gear.runes.length === 0 ? (
        <p className="text-micro text-ink-dim">Aucune rune équipée sur cet exemplaire — rien à conserver.</p>
      ) : (
        <div className={bureau ? 'grid grid-cols-[auto_auto] justify-evenly justify-items-start gap-y-1.5' : 'flex flex-wrap gap-1.5'}>
          {[1, 2, 3, 4, 5, 6].map((slot) => {
            const portee = selected.gear.runes.find((r) => r.slot === slot);
            const verrouille = lockedRunes[slot] != null;
            if (!portee) {
              return (
                <span
                  key={slot}
                  className="rounded-full border border-border bg-panel2 px-2.5 py-1 text-micro text-ink-dimmer opacity-50"
                  title={`Aucune rune en emplacement ${slot}`}
                >
                  Slot {slot} —
                </span>
              );
            }
            return (
              <Pastille
                key={slot}
                actif={verrouille}
                onClick={() =>
                  setLockedRunes((prev) => {
                    const next = { ...prev };
                    if (next[slot] != null) delete next[slot];
                    else next[slot] = portee.id;
                    return next;
                  })
                }
                icone={<RuneIcon setKey={portee.set} size={13} filter={runeSetIconFilter(verrouille)} />}
                libelle={`Slot ${slot} · ${RUNE_EFFECT[portee.main.code]?.label ?? portee.main.code}`}
                title={
                  verrouille
                    ? `Libérer l'emplacement ${slot}`
                    : `Imposer cette rune en emplacement ${slot} (le pool de ce slot tombe à 1)`
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
