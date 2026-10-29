import { CheckCircle2 } from 'lucide-react';
import { type ValidatedBuild } from '../../../lib/optimizerExclusion';

export interface BandeauBuildValideProps {
  ownValidatedBuild: ValidatedBuild | undefined;
  showRealGear: boolean;
  runesAbsentesValidees: number[];
  artefactsAbsentsValides: number[];
}

export default function BandeauBuildValide({ ownValidatedBuild, showRealGear, runesAbsentesValidees, artefactsAbsentsValides }: BandeauBuildValideProps) {
  return (
    ownValidatedBuild ? (
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent">
        <CheckCircle2 size={13} className="flex-none" />
        <span className="grid min-w-0 flex-1">
          <span className={`col-start-1 row-start-1 ${showRealGear ? 'invisible' : ''}`} aria-hidden={showRealGear}>
            Build validé affiché — pas l'équipement réellement porté
          </span>
          <span className={`col-start-1 row-start-1 ${showRealGear ? '' : 'invisible'}`} aria-hidden={!showRealGear}>
            Équipement réellement porté affiché
          </span>
          {runesAbsentesValidees.length > 0 && <span role="status" className="text-warn">
            Build conservé : {runesAbsentesValidees.length} rune(s) absente(s) du compte. Seules les runes présentes sont affichées et réservées.
          </span>}
          {artefactsAbsentsValides.length > 0 && <span role="status" className="text-warn">
            Build conservé : {artefactsAbsentsValides.length} artéfact(s) absent(s) du compte. Seuls les artéfacts présents sont affichés et réservés.
          </span>}
        </span>
      </div>
    ) : null
  );
}
