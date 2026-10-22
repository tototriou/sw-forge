import ExclusionRunesContenu, { type ExclusionRunesContenuProps } from '../ExclusionRunesContenu';

// « Exclusion de runes », au bureau : EN LIGNE dans la colonne repliable « Aura,
// exclusion, avancés », section de son panneau, jamais repliée derrière un
// en-tête, et sans titre ni phrase d'accroche : le panneau de la colonne et les
// traits entre sections situent déjà la section (le téléphone garde son titre
// dans le panneau « Options »). Le contenu est
// celui du panneau « Options » du téléphone (`ExclusionRunesContenu`), dans
// son ordre empilé : à 294 px de contenu, deux réglages côte à côte ne
// tiendraient pas.
export default function ExclusionRunesBureau(props: Omit<ExclusionRunesContenuProps, 'sansAccroche'>) {
  return (
    <section aria-label="Exclusion de runes">
      <ExclusionRunesContenu {...props} sansAccroche />
    </section>
  );
}
