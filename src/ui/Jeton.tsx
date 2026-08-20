import { ReactNode } from 'react';
import { X } from 'lucide-react';
import BoutonIcone from './BoutonIcone';

// JETON : une pilule qui NOMME un choix déjà posé, avec une croix pour le
// retirer. Un set ajouté à un combo, un monstre exclu d'une recherche — ce qui
// s'accumule dans une rangée et se défait un à un.
//
// ⚠️ **Distinct de [Pastille](Pastille.tsx).** Une pastille est un FILTRE à deux
// états qu'on enclenche et relâche en place ; un jeton représente une entrée
// AJOUTÉE, qui n'existe que tant qu'elle est là et disparaît quand on la retire.
// La pastille vit dans une grille de critères fixes, le jeton dans une liste qui
// grandit et rétrécit. D'où la croix, qui n'a de sens que sur le second.
//
// ⚠️ **La croix est un [BoutonIcone](BoutonIcone.tsx) `serre`**, pas une croix
// dessinée à la main : sa cible tactile et son `aria-label` viennent de la
// librairie, comme les deux boutons d'une pilule de catégorie. `serre` parce
// qu'elle vit DANS le jeton, plus petit que la cible de 40 px.

export interface JetonProps {
  // Pictogramme à gauche : icône de set, portrait de monstre…
  icone?: ReactNode;
  libelle: ReactNode;
  // Précision atténuée après le libellé (« · Box », « · Défenses siège »).
  detail?: ReactNode;
  // Présent = le jeton porte une croix de retrait. Absent = jeton en lecture
  // seule (rare, mais un jeton sans retrait reste un jeton, pas une pastille).
  onRetirer?: () => void;
  // `aria-label`/`title` de la croix — ce que retire ce jeton précis.
  libelleRetrait?: string;
  className?: string;
}

export default function Jeton({ icone, libelle, detail, onRetirer, libelleRetrait, className = '' }: JetonProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-panel2
        py-0.5 text-xs font-semibold text-ink ${onRetirer ? 'pl-2 pr-1' : 'px-2.5'} ${className}`}
    >
      {icone}
      <span className="truncate">{libelle}</span>
      {detail != null && <span className="font-normal text-ink-dim">{detail}</span>}
      {onRetirer && (
        <BoutonIcone
          taille="serre"
          ton="neutre"
          libelle={libelleRetrait ?? 'Retirer'}
          icone={<X size={12} />}
          onClick={onRetirer}
          className="hoverable:text-bad"
        />
      )}
    </span>
  );
}
