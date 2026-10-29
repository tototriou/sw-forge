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
  vuesExemplaire: ReactNode;
  gearSource: ExclusionSource | null;
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

export default function ExemplaireEtFiche({ zoneDRef, sourceOptions, vuesExemplaire, gearSource, pickSource, allSourcesEmpty, zoneDOpen, zoneDList, validatedBadge, selected, selectionFiche, setSelectionFiche, relicUsageById, validateBuildButton }: ExemplaireEtFicheProps) {
  return (
    <div className="flex flex-col gap-3">
      <div ref={zoneDRef} className="relative">
        <p className="label mb-1.5">Exemplaire</p>
        {vuesExemplaire}
        <p className="label mb-1.5 mt-2">Voir aussi</p>
        {/* Seule la source regardée en aperçu est allumée. Une source sans
            autre exemplaire que celui du membre reste désactivée. */}
        <Segmented
          options={sourceOptions}
          value={gearSource}
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
      {/* La fiche sans encadré : « Exemplaire » est une section du panneau
          « Monstre » (docs/02-app/optimizer/ecran/README.md, « Panneaux et
          sections »). Le panneau de statistiques, cliquable, et l'emplacement
          de relique, objet du jeu, gardent leur contour. ⚠️ **Dépliée, à la
          façon des cartes de résultat** (`carte` de `MonsterGear`, décision de
          l'utilisateur) : panneau resserré, relique sous la roue, et le groupe
          réduit à côté du panneau. La boîte prend toute la section : la
          réduction se calcule sur sa largeur, jamais sur celle de la fiche. */}
      <div data-fiche-optimizer className="w-full">
        {validatedBadge}
        <MonsterGear
          gear={selected?.gear ?? EMPTY_GEAR}
          selection={selectionFiche}
          onSelectionChange={setSelectionFiche}
          relicUsageById={relicUsageById}
          carte
        />
        {validateBuildButton}
      </div>
    </div>
  );
}
