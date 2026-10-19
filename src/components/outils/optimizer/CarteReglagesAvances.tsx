import { ZoneCliquable, FlottantAuto } from '../../../ui';
import { ChevronDown } from 'lucide-react';
import { type RefObject, type Dispatch, type SetStateAction, type ReactNode } from 'react';

export interface CarteReglagesAvancesProps {
  avancesRef: RefObject<HTMLDivElement>;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  showAdvanced: boolean;
  reglagesAvancesTitre: ReactNode;
  reglagesAvancesBureau: ReactNode;
}

export default function CarteReglagesAvances({ avancesRef, setShowAdvanced, showAdvanced, reglagesAvancesTitre, reglagesAvancesBureau }: CarteReglagesAvancesProps) {
  return (
    <div
      ref={avancesRef}
      className="hidden lg:block relative rounded-xl border border-border bg-panel p-3 xl:col-start-2 xl:row-start-5"
    >
      <ZoneCliquable
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        className="flex w-full items-center gap-1.5 text-sm font-bold text-ink"
      >
        {reglagesAvancesTitre}
        <ChevronDown
          size={14}
          className={`ml-auto text-ink-dim transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
        />
      </ZoneCliquable>
      {/* ⚠️ `largeurAncre` : le panneau prend EXACTEMENT la largeur de
          la carte qui l'ancre, et la suit quand l'écran change de
          taille. Les 340 px d'origine en faisaient à peu près la
          moitié — une largeur en dur ne peut pas suivre une carte dont
          la largeur dépend de la fenêtre.
          ⚠️ `hauteur` reste une ESTIMATION, et volontairement
          généreuse : elle ne sert qu'à choisir le côté AVANT que le
          contenu existe. La surestimer biaise le placement vers le
          haut, sans conséquence ; la sous-estimer ouvre du mauvais
          côté. `max-h-[70vh] overflow-y-auto` reste le garde-fou sur
          une fenêtre basse. */}
      <FlottantAuto ouvert={showAdvanced} ancre={avancesRef} largeurAncre hauteur={420} rembourrage="md">
        <div className="max-h-[70vh] overflow-y-auto">{reglagesAvancesBureau}</div>
      </FlottantAuto>
    </div>
  );
}
