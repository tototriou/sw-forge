import { type ReactNode } from 'react';

export interface ExclusionRunesContenuProps {
  dansPanneau: boolean;
  monstrePrecisBlock: ReactNode;
  dejaUtiliseesBlock: ReactNode;
  runesImposeesBlock: ReactNode;
}

export default function ExclusionRunesContenu({ dansPanneau, monstrePrecisBlock, dejaUtiliseesBlock, runesImposeesBlock }: ExclusionRunesContenuProps) {
  return (
    <>
      <p className="mb-3 pl-8 text-[11px] text-ink-dim">Deux réglages indépendants, qui se superposent.</p>

      {dansPanneau ? (
        // ⚠️ `space-y-4` (blocs) et non `flex flex-col` : sous
        // `[data-tiroir]`, `align-items: flex-start` raboterait ces deux
        // blocs — et donc leurs contrôles pleine largeur — à leur contenu.
        <div className="space-y-4">
          {monstrePrecisBlock}
          {dejaUtiliseesBlock}
        </div>
      ) : (
        // Côte à côte à partir de `sm` — cette carte vit maintenant
        // dans la colonne LARGE (`1fr`) de la grille de réglages, aux
        // côtés de « Monstre & équipement » (voir le commentaire
        // d'ouverture de la grille), largement assez pour ce layout
        // interne. ⚠️ Un `xl:grid-cols-1` a existé ici le temps d'une
        // révision antérieure de la mise en page, où cette carte se
        // retrouvait confinée à une colonne étroite (340-400px) —
        // retiré avec cette colonne, voir historique. Colonne de
        // gauche plus étroite (toggle + 3 options) que celle de droite
        // (recherche + liste), pas un 50/50 aveugle.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(200px,260px)_1fr] sm:gap-5">
          <div className="sm:border-r sm:border-border-soft sm:pr-5">{dejaUtiliseesBlock}</div>
          {monstrePrecisBlock}
        </div>
      )}

      <div className="mt-4 border-t border-border-soft pt-4">{runesImposeesBlock}</div>
    </>
  );
}
