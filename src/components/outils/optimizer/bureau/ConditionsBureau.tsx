import Conditions, { type ConditionsProps } from '../Conditions';

// La largeur d'une section de « Critères » en colonne. La section prend la
// largeur qu'on lui donne (plus large en deux piles) ; la grille y est
// centrée, à la largeur de son contenu.
export const LARGEUR_CONDITIONS = 294;

// « Conditions », au bureau : `Conditions` (partagé avec le téléphone) dans sa
// variante `bureau`, section de « Critères », sans cadre (le panneau de la
// colonne le porte, bureau/panneau.ts). ⚠️ La variante ramène la colonne des
// libellés au plus long d'entre eux (au lieu de 90 px au moins), serre les
// écarts des colonnes et pose « Min » / « Max » en en-têtes : la grille tient
// dans les 294 px d'une colonne.
export default function ConditionsBureau(props: Omit<ConditionsProps, 'bureau'>) {
  return (
    <section aria-label="Conditions" className="w-full">
      <Conditions {...props} bureau />
    </section>
  );
}
