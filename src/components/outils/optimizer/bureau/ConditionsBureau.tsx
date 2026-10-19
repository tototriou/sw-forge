import Conditions, { type ConditionsProps } from '../Conditions';

export const LARGEUR_CONDITIONS = 362;

// « Conditions », au bureau : la forme d'aujourd'hui (`Conditions`, partagé avec
// le téléphone, tel quel), dans sa propre carte des essentiels.
export default function ConditionsBureau(props: ConditionsProps) {
  return (
    <section aria-label="Conditions" style={{ width: LARGEUR_CONDITIONS }} className="rounded-xl border border-border bg-panel p-3">
      <Conditions {...props} />
    </section>
  );
}
