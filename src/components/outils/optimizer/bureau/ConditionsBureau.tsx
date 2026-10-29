import Conditions, { type ConditionsProps } from '../Conditions';

// La largeur de la section : celle d'une section de « Critères ». La grille
// (plus long libellé, deux champs et leurs « Min » / « Max », ≈ 292 px
// mesurés) y est centrée, à la largeur de son contenu.
export const LARGEUR_CONDITIONS = 294;

// « Conditions », au bureau : `Conditions` (partagé avec le téléphone) dans sa
// variante `bureau`, section de « Critères », sans cadre (le panneau de la
// colonne le porte, bureau/panneau.ts). ⚠️ La variante ramène la colonne des
// libellés au plus long d'entre eux (au lieu de 90 px au moins) et serre les
// écarts des colonnes : Min et Max s'en rapprochent, les champs gardent leur
// largeur, et la grille tient dans les 294 px de la section.
export default function ConditionsBureau(props: Omit<ConditionsProps, 'bureau'>) {
  return (
    <section aria-label="Conditions" style={{ width: LARGEUR_CONDITIONS }} className="flex-none">
      <Conditions {...props} bureau />
    </section>
  );
}
