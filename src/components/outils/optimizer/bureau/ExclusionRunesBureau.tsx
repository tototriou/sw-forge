import { useId } from 'react';
import ExclusionRunesContenu, { type ExclusionRunesContenuProps } from '../ExclusionRunesContenu';
import TitreExclusionRunes from '../TitreExclusionRunes';
import { LARGEUR_COMPLEMENTS } from './SetsAuraBureau';

// « Exclusion de runes », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », jamais repliée derrière un en-tête. Le contenu est
// celui du panneau « Options » du téléphone (`ExclusionRunesContenu`), dans
// son ordre empilé : à 314 px de contenu, deux réglages côte à côte ne
// tiendraient pas.
export default function ExclusionRunesBureau(props: ExclusionRunesContenuProps) {
  const titre = useId();
  return (
    <section aria-labelledby={titre} style={{ width: LARGEUR_COMPLEMENTS }} className="rounded-xl border border-border bg-panel p-3">
      <div id={titre} className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
        <TitreExclusionRunes />
      </div>
      <ExclusionRunesContenu {...props} />
    </section>
  );
}
