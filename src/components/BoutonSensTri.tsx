import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { SensTri } from '../lib/tri';
import BoutonIcone from '../ui/BoutonIcone';

// Bascule du SENS d'un tri, partagée par toutes les listes qui trient.
//
// ⚠️ **Remonté ici dès son premier usage multiple** (runes, artéfacts,
// optimisation), comme `Segmented` et `Switch` avant lui : trois copies auraient
// divergé au premier ajustement d'icône ou de libellé, et le geste doit se
// reconnaître d'un écran à l'autre.
//
// ⚠️ **L'icône dit l'état COURANT, pas ce que fera le clic.** Flèche vers le bas
// sur « du plus grand au plus petit » : c'est ainsi que les tableurs et les
// listes de fichiers l'écrivent depuis toujours, et l'inverse (« ce qui va se
// passer ») se lit à contresens une fois sur deux. Le titre, lui, annonce
// l'action — c'est son rôle.
export default function BoutonSensTri({
  sens,
  onChange,
  className,
}: {
  sens: SensTri;
  onChange: (sens: SensTri) => void;
  className?: string;
}) {
  const desc = sens === 'desc';
  return (
    <BoutonIcone
      onClick={() => onChange(desc ? 'asc' : 'desc')}
      libelle={desc ? 'Trier du plus petit au plus grand' : 'Trier du plus grand au plus petit'}
      icone={desc ? <ArrowDownWideNarrow size={15} /> : <ArrowUpNarrowWide size={15} />}
      // Cadré : il vit à côté d'une liste déroulante, donc au milieu de
      // contrôles cadrés. Nu, il se lisait comme une icône décorative.
      cadre
      className={className}
    />
  );
}
