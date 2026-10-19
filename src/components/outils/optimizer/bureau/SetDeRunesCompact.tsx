import { useState, type RefObject } from 'react';
import SetComboPicker from '../../SetComboPicker';
import RuneIcon from '../../../RuneIcon';
import { TitreCriteresRecherche } from '../CriteresRecherche';
import { LARGEUR_ESSENTIELS } from './ListeDeTravailBureau';
import { SelecteurMultiple } from '../../../../ui';
import { RUNE_SETS } from '../../../../types';
import { runeSetIconFilter, setsCost } from '../../../../lib/effects';

export interface SetDeRunesCompactProps {
  setPickerSectionRef: RefObject<HTMLDivElement>;
  setPickerInvalid: boolean;
  comboSets: string[];
  onChangeSets: (next: string[]) => void;
}

// « Critères de recherche » et le set de runes recherché, au bureau, en forme
// compacte : une liste fermée sur les sets choisis ; ouverte, la grille d'ajout
// d'aujourd'hui (`SetComboPicker`, telle quelle : jetons, retrait, deux
// groupes, « Plus de place »), en flottant — rien ne bouge dessous.
//
// ⚠️ **Une liste, pas deux** (principal · secondaire) : le choix est un
// multiensemble (deux fois le même set), que la grille sait dire et une case
// par set non. `SelecteurMultiple` en prend la surface (axe `surface`).
//
// ⚠️ **Le message « Sélectionne au moins un set… » tient sa place**, invisible
// le reste du temps : il ne pousse plus les Conditions quand il paraît.
//
// ⚠️ **La liste reste ouverte pendant la composition** (après un set de 4, il
// reste un set de 2 à choisir) : elle ne se ferme d'elle-même qu'au choix qui
// remplit les six emplacements, sinon au clic ailleurs ou à Échap.
export default function SetDeRunesCompact({ setPickerSectionRef, setPickerInvalid, comboSets, onChangeSets }: SetDeRunesCompactProps) {
  const [ouvert, setOuvert] = useState(false);
  const noms = comboSets.map((key) => RUNE_SETS.find((s) => s.key === key)?.label ?? key);
  const changer = (next: string[]) => {
    onChangeSets(next);
    if (setsCost(next) >= 6 && setsCost(next) > setsCost(comboSets)) setOuvert(false);
  };
  return (
    <section aria-label="Critères de recherche" style={{ width: LARGEUR_ESSENTIELS }} className="rounded-xl border border-border bg-panel p-3">
      <TitreCriteresRecherche className="mb-2" />
      <div
        ref={setPickerSectionRef}
        className={setPickerInvalid ? 'rounded-lg border border-bad bg-bad/15 p-2 -m-2 transition' : 'transition'}
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="label">Set de runes recherché</p>
          <span className="font-mono text-micro text-ink-dim">{setsCost(comboSets)}/6 runes</span>
        </div>
        <SelecteurMultiple
          libelle="Set de runes recherché"
          vide="Aucun"
          resume={
            comboSets.length > 0
              ? {
                  texte: noms.join(', '),
                  visuel: comboSets.map((key, i) => (
                    <span key={`${key}-${i}`} className="flex flex-none items-center gap-1 text-ink">
                      <RuneIcon setKey={key} size={18} filter={runeSetIconFilter(false)} />
                      <span className="truncate">{noms[i]}</span>
                    </span>
                  )),
                }
              : undefined
          }
          ouvert={ouvert}
          onOuvertChange={setOuvert}
          surface={<SetComboPicker sets={comboSets} onChange={changer} />}
        />
        <p className={`mt-1 text-micro font-semibold text-bad ${setPickerInvalid ? '' : 'invisible'}`} aria-hidden={!setPickerInvalid}>
          Sélectionne au moins un set avant de lancer la recherche.
        </p>
      </div>
    </section>
  );
}
