import Conditions, { type ConditionsProps } from '../Conditions';

export const LARGEUR_CONDITIONS = 362;

// « Conditions », au bureau : `Conditions` (partagé avec le téléphone) dans sa
// variante `bureau`, dans sa propre carte des essentiels. ⚠️ À 362 px, la
// colonne des libellés à 90 px au moins faisait déborder la carte de 13 px :
// la variante la ramène au plus long libellé, Min et Max s'en rapprochent ;
// les champs gardent leur largeur.
export default function ConditionsBureau(props: Omit<ConditionsProps, 'bureau'>) {
  return (
    <section aria-label="Conditions" style={{ width: LARGEUR_CONDITIONS }} className="rounded-xl border border-border bg-panel p-3">
      <Conditions {...props} bureau />
    </section>
  );
}
