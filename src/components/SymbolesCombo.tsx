import { RUNE_SETS } from '../types';
import { runeSetIconFilter } from '../lib/effects';
import { BROKEN, ComboVitesse } from '../lib/buildsRapides';
import RuneIcon from './RuneIcon';

// Une combinaison de sets à l'écran — partagé par le bloc « Builds les plus
// rapides » et sa fenêtre de réglage, pour que les deux la disent de la même
// façon.

const libelleSet = (key: string) => (key === BROKEN ? 'Broken' : RUNE_SETS.find((s) => s.key === key)?.label ?? key);

// « Swift + Will ».
export const nomCombo = (combo: ComboVitesse) => `${libelleSet(combo.quatre)} + ${libelleSet(combo.deux)}`;

// Les symboles des sets de la combinaison, SERRÉS en un groupe : à pas égal
// avec le texte, les deux icônes et le mot se lisaient comme trois éléments
// collés. Broken n'a pas de symbole.
// ⚠️ À passer dans l'emplacement `icone` d'un `Bouton` ou d'un `Jeton`, jamais
// dans leur libellé : le libellé est un `<span>` en ligne, où le groupe se pose
// sur la ligne de base du texte et remonte au lieu d'être centré.
export default function SymbolesCombo({ combo, taille = 16 }: { combo: ComboVitesse; taille?: number }) {
  return (
    <span className="inline-flex flex-none items-center gap-0.5">
      <RuneIcon setKey={combo.quatre} size={taille} filter={runeSetIconFilter(false)} />
      {combo.deux !== BROKEN && <RuneIcon setKey={combo.deux} size={taille} filter={runeSetIconFilter(false)} />}
    </span>
  );
}
