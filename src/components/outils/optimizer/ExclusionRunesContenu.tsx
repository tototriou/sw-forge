import { type ReactNode } from 'react';

export interface ExclusionRunesContenuProps {
  monstrePrecisBlock: ReactNode;
  dejaUtiliseesBlock: ReactNode;
  runesImposeesBlock: ReactNode;
}

// Le contenu d'« Exclusion de runes », le même dans le panneau « Options » du
// téléphone et dans la colonne « Aura, exclusion, avancés » du bureau.
// « Exclure les runes d'un monstre » passe AU-DESSUS de « Exclure les runes
// déjà utilisées » (demande explicite — c'est le réglage le plus utilisé au doigt), les
// deux EMPILÉS ; « Runes imposées », un mécanisme DISTINCT (verrou, pas
// exclusion), suit en dernier après un séparateur.
export default function ExclusionRunesContenu({ monstrePrecisBlock, dejaUtiliseesBlock, runesImposeesBlock }: ExclusionRunesContenuProps) {
  return (
    <>
      <p className="mb-3 pl-8 text-[11px] text-ink-dim">Deux réglages indépendants, qui se superposent.</p>

      {/* ⚠️ `space-y-4` (blocs) et non `flex flex-col` : sous
          `[data-tiroir]`, `align-items: flex-start` raboterait ces deux
          blocs — et donc leurs contrôles pleine largeur — à leur contenu. */}
      <div className="space-y-4">
        {monstrePrecisBlock}
        {dejaUtiliseesBlock}
      </div>

      <div className="mt-4 border-t border-border-soft pt-4">{runesImposeesBlock}</div>
    </>
  );
}
