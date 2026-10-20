import Conditions, { type ConditionsProps } from '../Conditions';

// La largeur de la section : celle de la grille des conditions (plus long
// libellé, deux champs et leurs « Min » / « Max »), sans cadre autour.
export const LARGEUR_CONDITIONS = 328;

// « Conditions », au bureau : `Conditions` (partagé avec le téléphone) dans sa
// variante `bureau`, section des essentiels, sans cadre (le panneau de la
// colonne le porte, bureau/panneau.ts). ⚠️ La variante ramène la colonne des
// libellés au plus long d'entre eux (au lieu de 90 px au moins) et serre les
// écarts des colonnes : Min et Max s'en rapprochent, les champs gardent leur
// largeur ; à côté, la sous-colonne des principales et de l'état du monstre
// garde ainsi ≈ 175 px.
export default function ConditionsBureau(props: Omit<ConditionsProps, 'bureau'>) {
  return (
    <section aria-label="Conditions" style={{ width: LARGEUR_CONDITIONS }} className="flex-none">
      <Conditions {...props} bureau />
    </section>
  );
}
