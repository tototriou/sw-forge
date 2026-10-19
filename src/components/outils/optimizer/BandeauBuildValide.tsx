import { CheckCircle2, Eye } from 'lucide-react';
import { BoutonIcone } from '../../../ui';
import { type ValidatedBuild } from '../../../lib/optimizerExclusion';
import { type Dispatch, type SetStateAction } from 'react';

export interface BandeauBuildValideProps {
  ownValidatedBuild: ValidatedBuild | undefined;
  showRealGear: boolean;
  runesAbsentesValidees: number[];
  artefactsAbsentsValides: number[];
  setShowRealGear: Dispatch<SetStateAction<boolean>>;
}

export default function BandeauBuildValide({ ownValidatedBuild, showRealGear, runesAbsentesValidees, artefactsAbsentsValides, setShowRealGear }: BandeauBuildValideProps) {
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
        <BoutonIcone
          cadre
          libelle={showRealGear ? 'Revoir le build validé' : "Voir le runage réellement porté"}
          icone={showRealGear ? <CheckCircle2 size={13} /> : <Eye size={13} />}
          onClick={() => setShowRealGear((v) => !v)}
          className="h-6 w-6 flex-none"
        />
      </div>
    ) : null
  );
}
