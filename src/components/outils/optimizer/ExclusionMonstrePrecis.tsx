import IconeInterdite from '../../IconeInterdite';
import GameIcon from '../../GameIcon';
import RuneExclusionPicker from '../RuneExclusionPicker';
import { type ExclusionSourceData, type ExclusionSelector } from '../../../lib/optimizerExclusion';
import { type Monster, type GearSet } from '../../../types';
import { type Dispatch, type SetStateAction } from 'react';

export interface ExclusionMonstrePrecisProps {
  exclusionData: ExclusionSourceData;
  selectedUnitKey: string | null;
  selected: { monster: Monster; gear: GearSet; } | null;
  excludedSelectors: ExclusionSelector[];
  setExcludedSelectors: Dispatch<SetStateAction<ExclusionSelector[]>>;
  // Colonne « Aura, exclusion, avancés » du bureau : monstres exclus à hauteur
  // bornée (`RuneExclusionPicker`, `hauteurBornee`).
  bureau?: boolean;
}

export default function ExclusionMonstrePrecis({ exclusionData, selectedUnitKey, selected, excludedSelectors, setExcludedSelectors, bureau = false }: ExclusionMonstrePrecisProps) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {/* Même icône que « Monstre & équipement » (GameIcon
            "monster"), barrée du symbole « interdit » — même
            traitement que l'icône « Exclusion de runes » plus bas :
            cette action RETIRE le monstre choisi du pool de runes. */}
        <IconeInterdite>
          {/* ⚠️ L'artwork du monstre n'est pas parfaitement centré dans
              son canevas — invisible seul, ça se voit à côté du cercle
              « interdit », lui parfaitement centré par positionnement
              absolu. Léger recalage manuel, propre à cet usage précis. */}
          <GameIcon name="monster" size={13} className="-translate-x-[1.5px]" />
        </IconeInterdite>
        <span className="text-[12.5px] font-semibold text-ink-dim">Exclure les runes d'un monstre</span>
      </div>
      <RuneExclusionPicker
        data={exclusionData}
        excludeOwnUnitKey={selectedUnitKey}
        excludeOwnCom2usId={selected?.monster.com2usId ?? null}
        selected={excludedSelectors}
        onChange={setExcludedSelectors}
        hauteurBornee={bureau}
      />
    </div>
  );
}
