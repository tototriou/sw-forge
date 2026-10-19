import { type RefObject } from 'react';
import SetComboPicker from '../SetComboPicker';

export interface SetDeRunesProps {
  setPickerSectionRef: RefObject<HTMLDivElement>;
  setPickerInvalid: boolean;
  comboSets: string[];
  onChangeSets: (next: string[]) => void;
}

export default function SetDeRunes({ setPickerSectionRef, setPickerInvalid, comboSets, onChangeSets }: SetDeRunesProps) {
  return (
    <div
      ref={setPickerSectionRef}
      className={`max-w-md ${
        setPickerInvalid
          ? 'rounded-lg border border-bad bg-bad/15 p-2 -m-2 transition'
          : 'transition'
      }`}
    >
      <p className="label mb-1.5">Set de runes recherché</p>
      <SetComboPicker sets={comboSets} onChange={onChangeSets} />
      {setPickerInvalid && (
        <p className="mt-1.5 text-micro font-semibold text-bad">
          Sélectionne au moins un set avant de lancer la recherche.
        </p>
      )}
    </div>
  );
}
