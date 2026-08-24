import { ReactNode } from 'react';
import MonsterAvatar from '../MonsterAvatar';
import { ExclusionCandidate } from '../../lib/optimizerExclusion';

interface Props {
  candidate: ExclusionCandidate;
  // « déjà exclu » (RuneExclusionPicker) — rien pour un picker à sélection
  // unique (MonsterSourcePicker).
  suffixe?: ReactNode;
}

// Contenu d'une ligne de résultat « monstre + équipement » — portrait, nom,
// compte de runes, et pour le siège l'équipe complète (un même monstre peut
// apparaître dans plusieurs équipes, indiscernables par le seul nom : le
// vrai repère est le NUMÉRO d'équipe et SES COÉQUIPIERS). Remonté ici à son
// second usage — RuneExclusionPicker (exclure) ET MonsterSourcePicker
// (choisir le monstre à optimiser) affichent désormais EXACTEMENT la même
// rangée, demande explicite de cohérence entre les deux écrans.
export default function ExclusionCandidateRow({ candidate: c, suffixe }: Props) {
  return (
    <>
      <MonsterAvatar monster={c.monster} size={c.teamContext ? 46 : 28} className="flex-none" />
      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium truncate flex-1">{c.monster.name}</span>
          <span className="font-mono text-[11px] text-ink-dim flex-none">
            {c.gear.runes.length} rune{c.gear.runes.length > 1 ? 's' : ''}
          </span>
          {suffixe}
        </div>
        {c.teamContext && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-dim">
            <span className="flex-none">Équipe {c.teamContext.teamNumber}</span>
            <span className="flex flex-wrap items-center gap-2.5 min-w-0">
              {c.teamContext.slots.map((m, slotIdx) => {
                const estSlotCourant = 'slotIndex' in c.selector && c.selector.slotIndex === slotIdx;
                return (
                  <span key={slotIdx} className="flex items-center gap-1.5 flex-none">
                    <MonsterAvatar monster={m} element={false} size={34} className="flex-none" />
                    <span className={`whitespace-nowrap ${estSlotCourant ? 'text-ink font-medium' : ''}`}>{m?.name ?? '—'}</span>
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
