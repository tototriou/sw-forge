import { ZoneCliquable, FlottantAuto } from '../../../ui';
import { ChevronDown } from 'lucide-react';
import { type RefObject, type Dispatch, type SetStateAction, type ReactNode } from 'react';

export interface CarteExclusionRunesProps {
  exclusionRef: RefObject<HTMLDivElement>;
  setShowExclusion: Dispatch<SetStateAction<boolean>>;
  showExclusion: boolean;
  exclusionRunesTitre: ReactNode;
  exclusionRunesBureau: ReactNode;
}

export default function CarteExclusionRunes({ exclusionRef, setShowExclusion, showExclusion, exclusionRunesTitre, exclusionRunesBureau }: CarteExclusionRunesProps) {
  return (
    <div
      ref={exclusionRef}
      className="hidden lg:block relative rounded-xl border border-accent/50 bg-panel p-3 xl:col-start-2 xl:row-start-4"
    >
      <ZoneCliquable
        onClick={() => setShowExclusion((v) => !v)}
        aria-expanded={showExclusion}
        className="flex w-full items-center gap-2 text-sm font-bold text-ink"
      >
        {exclusionRunesTitre}
        <ChevronDown
          size={14}
          className={`ml-auto text-ink-dim transition-transform ${showExclusion ? 'rotate-180' : ''}`}
        />
      </ZoneCliquable>
      {/* `largeurAncre` comme « Réglages avancés » — voir son
          commentaire juste au-dessus.
          ⚠️ `hauteur` plus généreuse (560) : ce contenu porte deux
          réglages d'exclusion, le picker de monstre et la liste des
          runes imposées. Estimation seulement. */}
      <FlottantAuto ouvert={showExclusion} ancre={exclusionRef} largeurAncre hauteur={560} rembourrage="md">
        <div className="max-h-[70vh] overflow-y-auto">{exclusionRunesBureau}</div>
      </FlottantAuto>
    </div>
  );
}
