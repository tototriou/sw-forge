import MonsterSourcePicker from '../MonsterSourcePicker';
import MonsterAvatar from '../../MonsterAvatar';
import OptimizerImportButton, { type SourceImportOptimizer } from '../OptimizerImportButton';
import { ZoneCliquable } from '../../../ui';
import { ChevronDown } from 'lucide-react';
import Segmented from '../../../ui/Segmented';
import MonsterGear, { type Selected } from '../../MonsterGear';
import { type Monster, type GearSet } from '../../../types';
import { type RefObject, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { type ExclusionSourceData, type ExclusionSource } from '../../../lib/optimizerExclusion';
import { type ImportOptimizer, type RapportImportOptimizer } from '../../../lib/importEquipes';
import { EMPTY_GEAR } from './constantes';

export interface MonstreEquipementTelephoneProps {
  allMonsters: Monster[];
  pickSpecies: (monster: Monster) => void;
  ligneMonstreTelephoneRef: RefObject<HTMLDivElement>;
  selected: { monster: Monster; gear: GearSet; } | null;
  sourcesImport: SourceImportOptimizer[];
  importerDepuisEcran: (produire: (data: ExclusionSourceData) => ImportOptimizer) => RapportImportOptimizer;
  rapportImport: RapportImportOptimizer | null;
  setZoneCOpen: Dispatch<SetStateAction<boolean>>;
  zoneCOpen: boolean;
  eclatImport: boolean;
  listesTelephone: ReactNode;
  sourceOptions: { label: string; disabled: boolean; key: ExclusionSource; }[];
  matchesValidatedBuild: boolean;
  unowned: boolean;
  gearSource: ExclusionSource;
  pickSource: (source: ExclusionSource) => void;
  allSourcesEmpty: boolean;
  zoneDOpen: boolean;
  zoneDList: ReactNode;
  zoneCContent: ReactNode;
  validatedBadge: ReactNode;
  selectionFiche: Selected;
  setSelectionFiche: (s: Selected) => void;
  relicUsageById: Record<number, number>;
  validateBuildButton: ReactNode;
}

export default function MonstreEquipementTelephone({ allMonsters, pickSpecies, ligneMonstreTelephoneRef, selected, sourcesImport, importerDepuisEcran, rapportImport, setZoneCOpen, zoneCOpen, eclatImport, listesTelephone, sourceOptions, matchesValidatedBuild, unowned, gearSource, pickSource, allSourcesEmpty, zoneDOpen, zoneDList, zoneCContent, validatedBadge, selectionFiche, setSelectionFiche, relicUsageById, validateBuildButton }: MonstreEquipementTelephoneProps) {
  return (
    <div className="space-y-3">
      {/* Bloc 1 — recherche TOUJOURS visible, liste active
          rattachée EN DESSOUS en dépliement (`zoneCOpen`, repliée par
          défaut). */}
      <div>
        <p className="label mb-1.5">Monstre à optimiser</p>
        <MonsterSourcePicker mode="bestiary" candidates={allMonsters} onPick={pickSpecies} />
        <div ref={ligneMonstreTelephoneRef} className="mt-3 h-8 flex items-center gap-2">
          {selected && <>
            <MonsterAvatar monster={selected.monster} size={32} />
            <span className="min-w-0 line-clamp-1 font-semibold text-[14px]" title={selected.monster.name}>{selected.monster.name}</span>
          </>}
        </div>
        <div className="mt-3">
          <OptimizerImportButton sources={sourcesImport} onImporter={importerDepuisEcran} rapport={rapportImport} />
        </div>
        <ZoneCliquable
          onClick={() => setZoneCOpen((v) => !v)}
          aria-expanded={zoneCOpen}
          className={`-mx-1 mt-3 flex w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-md px-1 text-[12.5px] font-semibold transition-colors duration-300 motion-reduce:transition-none ${eclatImport ? 'bg-accent-soft text-ink' : 'text-ink-dim'}`}
        >
          Gérer mes listes
          <ChevronDown size={13} className={`ml-auto transition-transform ${zoneCOpen ? 'rotate-180' : ''}`} />
        </ZoneCliquable>
        {zoneCOpen && (
          <div className={`-mx-1 mt-2 space-y-3 rounded-lg px-1 py-1 transition-colors duration-300 motion-reduce:transition-none ${eclatImport ? 'bg-accent-soft' : ''}`}>
            {listesTelephone}
          </div>
        )}
      </div>

      {/* Bloc 2 — puces TOUJOURS visibles, zone D rattachée EN DESSOUS
          en dépliement (`zoneDOpen`, EN LIGNE plutôt qu'en `Flottant` —
          un panneau flottant se prête mal à un écran étroit). */}
      <div>
        <p className="label mb-1.5">Exemplaire</p>
        <Segmented
          options={sourceOptions}
          value={matchesValidatedBuild || unowned ? null : gearSource}
          onChange={pickSource}
          disabled={allSourcesEmpty}
          size="lg"
        />
        {zoneDOpen && <div className="mt-2 rounded-lg border border-border-soft overflow-hidden">{zoneDList}</div>}
        {/* Les ajouts ne déplacent pas la puce qui les déclenche. */}
        {zoneCOpen && <div className="mt-3">{zoneCContent}</div>}
      </div>

      {/* Bloc 3 — fiche stats/artéfacts/runes/relique (même composant
          `MonsterGear` que RTA/Siège), bandeau « build validé » +
          bouton « Valider ce build » en plus, voir leur commentaire
          plus haut (`validatedBadge`/`validateBuildButton`). */}
      <div className="rounded-xl border border-border-soft bg-panel2/60 p-3">
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
