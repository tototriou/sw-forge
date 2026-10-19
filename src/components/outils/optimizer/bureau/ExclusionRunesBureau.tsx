import { useId } from 'react';
import ExclusionRunesContenu, { type ExclusionRunesContenuProps } from '../ExclusionRunesContenu';
import TitreExclusionRunes from '../TitreExclusionRunes';
import { LARGEUR_COMPLEMENTS } from './SetsAuraBureau';

// « Exclusion de runes », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », plus derrière un en-tête qui ouvre un flottant
// (`CarteExclusionRunes`, toujours celle de la page d'aujourd'hui). Le contenu
// est celui d'aujourd'hui (`ExclusionRunesContenu`), dans l'ordre empilé du
// panneau « Options » (`dansPanneau`) : à 314 px de contenu, les deux réglages
// côte à côte ne tiennent pas (`minmax(200px, 260px)` + la recherche).
export default function ExclusionRunesBureau(props: Omit<ExclusionRunesContenuProps, 'dansPanneau'>) {
  const titre = useId();
  return (
    <section aria-labelledby={titre} style={{ width: LARGEUR_COMPLEMENTS }} className="rounded-xl border border-border bg-panel p-3">
      <div id={titre} className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
        <TitreExclusionRunes />
      </div>
      <ExclusionRunesContenu {...props} dansPanneau />
    </section>
  );
}
