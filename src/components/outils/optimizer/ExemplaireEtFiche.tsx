import Segmented from '../../../ui/Segmented';
import { Flottant } from '../../../ui';
import MonsterGear, { type Selected } from '../../MonsterGear';
import { type RefObject, type ReactNode } from 'react';
import { type ExclusionSource } from '../../../lib/optimizerExclusion';
import { type Monster, type GearSet } from '../../../types';
import { EMPTY_GEAR } from './constantes';

export interface ExemplaireEtFicheProps {
  zoneDRef: RefObject<HTMLDivElement>;
  sourceOptions: { label: string; disabled: boolean; key: ExclusionSource; }[];
  matchesValidatedBuild: boolean;
  unowned: boolean;
  gearSource: ExclusionSource;
  pickSource: (source: ExclusionSource) => void;
  allSourcesEmpty: boolean;
  zoneDOpen: boolean;
  zoneDList: ReactNode;
  validatedBadge: ReactNode;
  selected: { monster: Monster; gear: GearSet; } | null;
  selectionFiche: Selected;
  setSelectionFiche: (s: Selected) => void;
  relicUsageById: Record<number, number>;
  validateBuildButton: ReactNode;
}

export default function ExemplaireEtFiche({ zoneDRef, sourceOptions, matchesValidatedBuild, unowned, gearSource, pickSource, allSourcesEmpty, zoneDOpen, zoneDList, validatedBadge, selected, selectionFiche, setSelectionFiche, relicUsageById, validateBuildButton }: ExemplaireEtFicheProps) {
  return (
    <div className="flex flex-col gap-3">
      <div ref={zoneDRef} className="relative">
        <p className="label mb-1.5">Exemplaire</p>
        {/* ⚠️ Puce individuellement grisée si l'espèce n'est PAS
            possédée dans CETTE source précise, tout le contrôle grisé
            si elle ne l'est dans AUCUNE des 4 — voir l'axe `disabled` par option, ajouté à
            Segmented.tsx pour ce cas précis. ⚠️ **`value={null}`
            quand le build VALIDÉ est ACTUELLEMENT affiché**
            (`matchesValidatedBuild`, PAS `ownValidatedBuild` seul —
            la bascule « voir le runage réellement porté »,
            `showRealGear`, peut en montrer l'équipement réel, qui
            LUI reste la source réelle d'une puce) **ou quand
            `sourceSelector` est `unowned`** (monstre non possédé,
            demande explicite) : dans les deux cas, aucune puce ne
            doit s'allumer — voir l'axe `value: T | null` ajouté à
            Segmented.tsx pour ce cas précis. */}
        <Segmented
          options={sourceOptions}
          value={matchesValidatedBuild || unowned ? null : gearSource}
          onChange={pickSource}
          disabled={allSourcesEmpty}
          size="lg"
        />
        {zoneDOpen && (
          <Flottant aria-label="Choisir l'exemplaire" rembourrage="aucun" className="max-h-[300px] overflow-y-auto">
            {zoneDList}
          </Flottant>
        )}
      </div>
      {/* La fiche sans encadré : « Exemplaire » est une section du panneau de
          la colonne de droite (docs/02-app/optimizer/ecran/README.md,
          « Panneaux et sections »). Le panneau de statistiques, cliquable,
          et l'emplacement de relique, objet du jeu, gardent leur contour.
          ⚠️ Boîte à la largeur de la fiche (`w-fit`, centrée) : « Valider ce
          build », pleine largeur, va du bord gauche du panneau de
          statistiques au bord droit de la relique (décision de
          l'utilisateur), jamais au-delà. `max-w-full` laisse la fiche se
          réduire comme avant quand la place manque. */}
      <div className="mx-auto w-fit max-w-full">
        {validatedBadge}
        <MonsterGear
          gear={selected?.gear ?? EMPTY_GEAR}
          selection={selectionFiche}
          onSelectionChange={setSelectionFiche}
          relicUsageById={relicUsageById}
        />
        {validateBuildButton}
      </div>
    </div>
  );
}
